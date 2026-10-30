<?php

namespace App\Http\Middleware;

use App\Enums\ActivityAction;
use App\Enums\ActivityModule;
use App\Models\Property;
use App\Models\RisSlip;
use App\Models\Supply;
use App\Services\ActivityRecorder;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Records report exports, prints and downloads in the activity log. Runs on
 * every web request but only acts on the routes listed below, and only when
 * the file was actually produced (a successful response).
 */
class RecordExport
{
    /** Route name => [module, report name, format]. */
    private const ROUTES = [
        'ris.export-excel' => [ActivityModule::Ris, 'RIS', 'Excel'],
        'stock-cards.export-pdf' => [ActivityModule::Reports, 'Stock card', 'PDF'],
        'stock-cards.export-excel' => [ActivityModule::Reports, 'Stock card', 'Excel'],
        'supply-ledger-cards.export-pdf' => [ActivityModule::Reports, 'Supply ledger card', 'PDF'],
        'supply-ledger-cards.export-excel' => [ActivityModule::Reports, 'Supply ledger card', 'Excel'],
        'rpci.export-excel' => [ActivityModule::Reports, 'RPCI', 'Excel'],
        'rsmi.summary' => [ActivityModule::Reports, 'RSMI summary', 'PDF'],
        'rsmi.export-pdf' => [ActivityModule::Reports, 'RSMI', 'PDF'],
        'rsmi.export-pdf-formatted' => [ActivityModule::Reports, 'RSMI (formatted)', 'PDF'],
        'rsmi.export-excel' => [ActivityModule::Reports, 'RSMI', 'Excel'],
        'property.download-qr' => [ActivityModule::Properties, 'QR code', 'download'],
    ];

    public function __construct(private readonly ActivityRecorder $recorder) {}

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $route = $request->route();
        $name = $route?->getName();

        if ($name === null || ! isset(self::ROUTES[$name]) || ! $response->isSuccessful()) {
            return $response;
        }

        [$module, $report, $format] = self::ROUTES[$name];
        $subject = $this->subjectOf($request);

        $this->recorder->record(
            match ($format) {
                'print' => ActivityAction::Printed,
                'download' => ActivityAction::Downloaded,
                default => ActivityAction::Exported,
            },
            $module,
            $subject,
            // The filters the report was made with (month, year, fund cluster…).
            properties: array_filter(
                ['format' => $format, ...$request->query()],
                fn ($value) => is_scalar($value) && $value !== '',
            ),
            summary: collect([$format === 'print' || $format === 'download' ? null : $format, $this->filtersLine($request)])->filter()->join(' · ') ?: null,
            label: $subject !== null ? null : $report,
        );

        return $response;
    }

    private function subjectOf(Request $request): Supply|RisSlip|Property|null
    {
        $route = $request->route();

        foreach (['risSlip', 'property'] as $parameter) {
            if (! $route->hasParameter($parameter)) {
                continue;
            }

            $value = $route->parameter($parameter);

            if ($value instanceof RisSlip || $value instanceof Property) {
                return $value;
            }

            if ($parameter === 'property' && is_numeric($value)) {
                return Property::find($value);
            }
        }

        $supplyId = $route->hasParameter('supplyId') ? $route->parameter('supplyId') : null;

        return $supplyId !== null ? Supply::find($supplyId) : null;
    }

    private function filtersLine(Request $request): ?string
    {
        $parts = [];

        if ($month = $request->query('month')) {
            $parts[] = is_numeric($month) ? date('F', mktime(0, 0, 0, (int) $month, 1)) : $month;
        }

        if ($year = $request->query('year')) {
            $parts[] = (string) $year;
        }

        if ($cluster = $request->query('fund_cluster')) {
            $parts[] = "Fund cluster {$cluster}";
        }

        return $parts === [] ? null : implode(' · ', $parts);
    }
}
