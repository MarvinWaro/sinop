<?php

use App\Models\ActivityLog;
use App\Models\RisSlip;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\IOFactory;

test('an RIS exports to Excel with the e-signature from the bucket, and the export is logged', function () {
    config(['filesystems.uploads' => 's3']);
    Storage::fake('s3');
    Storage::disk('s3')->put('signatures/ada.png', UploadedFile::fake()->image('ada.png', 300, 100)->getContent());

    $admin = User::factory()->admin()->create(['name' => 'Ada Admin', 'signature_path' => 'signatures/ada.png']);
    $department = DB::table('departments')->insertGetId(['name' => 'Admin Division', 'created_at' => now(), 'updated_at' => now()]);
    DB::table('supplies')->insert(['supply_id' => 1, 'stock_no' => '01', 'item_name' => 'ALCOHOL', 'unit_of_measurement' => 'GALLON', 'created_at' => now(), 'updated_at' => now()]);
    $slip = RisSlip::create([
        'ris_no' => '2026-01-001',
        'ris_date' => now(),
        'entity_name' => 'CHED',
        'division' => $department,
        'requested_by' => $admin->id,
        'requester_signature_type' => 'esign',
        'status' => 'draft',
    ]);
    DB::table('ris_items')->insert(['ris_id' => $slip->ris_id, 'supply_id' => 1, 'quantity_requested' => 2, 'created_at' => now(), 'updated_at' => now()]);

    $response = $this->actingAs($admin)->get(route('ris.export-excel', $slip));

    $response->assertOk()->assertDownload('RIS_2026-01-001_'.now()->format('Y_m_d').'.xlsx');

    $sheet = IOFactory::load($response->getFile()->getPathname())->getActiveSheet();
    unlink($response->getFile()->getPathname());

    // Signed before placements were kept: where the export always put it.
    $drawing = $sheet->getDrawingCollection()[0];
    expect($sheet->getDrawingCollection())->toHaveCount(1)
        ->and($drawing->getCoordinates())->toStartWith('C')
        ->and([$drawing->getOffsetX(), $drawing->getOffsetY(), $drawing->getHeight()])->toBe([10, 5, 35])
        ->and(collect($sheet->toArray())->flatten()->filter()->values()->all())->toContain('ALCOHOL', 'Ada Admin')
        ->and(ActivityLog::where('action', 'exported')->sole()->subject_label)->toBe('RIS 2026-01-001');
});

test('a frozen signature is drawn where the signer placed it; a missing image prints SGD', function () {
    Storage::fake('public');
    Storage::disk('public')->put('ris-signatures/frozen.png', UploadedFile::fake()->image('frozen.png', 300, 100)->getContent());

    $admin = User::factory()->admin()->create(['signature_path' => 'signatures/gone.png']);
    $department = DB::table('departments')->insertGetId(['name' => 'Admin Division', 'created_at' => now(), 'updated_at' => now()]);
    $slip = RisSlip::create([
        'ris_no' => '2026-01-002', 'ris_date' => now(), 'entity_name' => 'CHED', 'division' => $department,
        'requested_by' => $admin->id, 'requester_signature_type' => 'esign',
        'approved_by' => $admin->id, 'approved_at' => now(), 'approver_signature_type' => 'esign',
        'status' => 'approved',
    ]);
    // Approved by spans D and E (70 px each). Centre at 75% of the box, half
    // its width: a 70 x 23 px picture from 70 px in, i.e. the start of E.
    $slip->signatures()->create(['step' => 'approved', 'user_id' => $admin->id, 'path' => 'ris-signatures/frozen.png', 'x' => 0.75, 'y' => 0.5, 'width' => 0.5, 'rotation' => 10, 'signed_at' => now()]);

    $response = $this->actingAs($admin)->get(route('ris.export-excel', $slip))->assertOk();
    $sheet = IOFactory::load($response->getFile()->getPathname())->getActiveSheet();
    unlink($response->getFile()->getPathname());

    $drawing = $sheet->getDrawingCollection()[0];
    $row = (int) preg_replace('/\D/', '', $drawing->getCoordinates());
    expect($sheet->getDrawingCollection())->toHaveCount(1)
        ->and($drawing->getCoordinates())->toStartWith('E')
        ->and([$drawing->getOffsetX(), $drawing->getOffsetY(), $drawing->getWidth(), $drawing->getHeight(), $drawing->getRotation()])->toBe([0, 22, 70, 23, 10])
        // The requester's e-signature file is gone: "SGD", as before.
        ->and($sheet->getCell("C{$row}")->getValue())->toBe('SGD');
});

test('the RIS print page is gone', function () {
    expect(Route::has('ris.print'))->toBeFalse();
});
