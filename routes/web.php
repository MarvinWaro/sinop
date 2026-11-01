<?php

use App\Http\Controllers\CategoryController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DepartmentController;
use App\Http\Controllers\DesignationController;
use App\Http\Controllers\LocationController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PropertyConditionController;
use App\Http\Controllers\PropertyController;
use App\Http\Controllers\PropertyScanController;
use App\Http\Controllers\ReportPhysicalCountController;
use App\Http\Controllers\ReportSuppliesMaterialsIssuedController;
use App\Http\Controllers\RisSlipController;
use App\Http\Controllers\SignatureController;
use App\Http\Controllers\StaffDashboardController;
use App\Http\Controllers\StockCardController;
use App\Http\Controllers\SupplierController;
use App\Http\Controllers\SupplyController;
use App\Http\Controllers\SupplyLedgerCardController;
use App\Http\Controllers\SupplyStockController;
use App\Http\Controllers\SupplyTransactionController;
use App\Http\Controllers\UploadController;
use App\Http\Controllers\UserController;
use App\Http\Middleware\HandleInertiaRequests;
use App\Support\Uploads;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

/*
|--------------------------------------------------------------------------
| Authenticated routes (admin, cao and staff)
|--------------------------------------------------------------------------
|
| Same URIs and route names as the Jetstream version. Pages that used to be
| separate create/edit screens for the small libraries (categories,
| departments, designations, suppliers, locations) are now dialogs on the
| index page, so only their index/store/update/destroy routes remain.
|
*/
// What a property sticker's QR opens: public basics, full details when
// signed in. Rate-limited so property numbers can't be run through quickly.
// Listed first: the scan route's number may contain slashes.
Route::get('/p/{propertyNumber}/sign-in', [PropertyScanController::class, 'signIn'])
    ->where('propertyNumber', '.+')
    ->middleware('auth')
    ->name('property.scan.sign-in');
Route::get('/p/{propertyNumber}', [PropertyScanController::class, 'show'])
    ->where('propertyNumber', '.+')
    ->middleware('throttle:60,1')
    ->name('property.scan');

Route::middleware(['auth', 'verified'])->group(function () {
    // Messages between requesters and the supply office: the page, and the
    // JSON it works through. The controller and the policy keep each
    // conversation to its requester and the office.
    Route::get('/messages', [MessageController::class, 'index'])->name('messages.index');
    Route::prefix('messages')->name('messages.')->controller(MessageController::class)
        ->withoutMiddleware(HandleInertiaRequests::class)
        ->group(function () {
            Route::get('/conversations', 'conversations')->middleware('throttle:120,1')->name('conversations');
            Route::post('/conversations', 'start')->middleware('throttle:20,1')->name('start');
            Route::get('/options', 'options')->name('options');
            Route::get('/attachments/{attachment}', 'attachment')->name('attachment');
            Route::middleware('can:view,conversation')->group(function () {
                Route::get('/conversations/{conversation}', 'show')->middleware('throttle:120,1')->name('show');
                Route::post('/conversations/{conversation}/messages', 'send')->middleware('throttle:30,1')->name('send');
                Route::post('/conversations/{conversation}/read', 'read')->name('read');
                Route::post('/conversations/{conversation}/typing', 'typing')->middleware('throttle:60,1')->name('typing');
                Route::patch('/conversations/{conversation}/status', 'status')->name('status');
            });
        });

    // Notifications: the page, and the JSON the header bell uses. Every
    // signed-in person has their own; the controller keeps them private.
    Route::prefix('notifications')->name('notifications.')->controller(NotificationController::class)->group(function () {
        Route::get('/', 'index')->name('index');
        Route::get('/recent', 'recent')->middleware('throttle:60,1')->name('recent');
        Route::get('/summary', 'summary')->middleware('throttle:60,1')->name('summary');
        Route::post('/read-all', 'readAll')->name('read-all');
        Route::whereUlid('notification')->group(function () {
            Route::get('/{notification}', 'open')->name('open');
            Route::patch('/{notification}', 'update')->name('update');
            Route::delete('/{notification}', 'destroy')->name('destroy');
        });
    });

    // ==========================================
    // SHARED ROUTES - available to all authenticated users
    // Specific routes must come before dynamic ones.
    // ==========================================
    Route::get('/ris/next', [RisSlipController::class, 'nextRis'])->name('ris.next')->middleware('can:ris.manual-entry');
    Route::get('/ris/current-cao', [RisSlipController::class, 'getCurrentCAO'])->name('ris.current-cao');
    Route::get('/ris/department-details', [RisSlipController::class, 'getDepartmentDetails'])->name('ris.department-details');

    Route::get('/ris', [RisSlipController::class, 'index'])->name('ris.index')->middleware('can:ris.view');
    Route::post('/ris', [RisSlipController::class, 'store'])->name('ris.store')->middleware('can:ris.request');

    Route::get('/ris/{risSlip}', [RisSlipController::class, 'show'])->name('ris.show')->middleware('can:view,risSlip');
    Route::get('/ris/{risSlip}/export-excel', [RisSlipController::class, 'exportExcel'])->name('ris.export-excel')->middleware('can:view,risSlip');
    // The form as it will print, for the signing preview (JSON).
    Route::get('/ris/{risSlip}/document', [RisSlipController::class, 'document'])->name('ris.document')->middleware('can:view,risSlip')->withoutMiddleware(HandleInertiaRequests::class);
    Route::get('/ris/{risSlip}/signatures/{step}', [UploadController::class, 'risSignature'])->whereIn('step', ['requested', 'approved', 'issued', 'received'])->name('ris.signature')->middleware('can:view,risSlip')->withoutMiddleware(HandleInertiaRequests::class);
    Route::post('/ris/{risSlip}/receive', [RisSlipController::class, 'receive'])->name('ris.receive');

    // Stock cards
    Route::get('/stock-cards', [StockCardController::class, 'index'])->name('stock-cards.index')->middleware('can:stock-cards.view');
    Route::get('/stock-cards/{supplyId}', [StockCardController::class, 'show'])->name('stock-cards.show')->middleware('can:stock-cards.view');
    Route::get('/stock-cards/{supplyId}/export-pdf', [StockCardController::class, 'exportPdf'])->name('stock-cards.export-pdf')->middleware('can:stock-cards.export');
    Route::get('/stock-cards/{supplyId}/export-excel', [StockCardController::class, 'exportExcel'])->name('stock-cards.export-excel')->middleware('can:stock-cards.export');

    // Supply ledger cards
    Route::get('/supply-ledger-cards', [SupplyLedgerCardController::class, 'index'])->name('supply-ledger-cards.index')->middleware('can:ledger-cards.view');
    Route::get('/supply-ledger-cards/{supplyId}', [SupplyLedgerCardController::class, 'show'])->name('supply-ledger-cards.show')->middleware('can:ledger-cards.view');
    Route::get('/supply-ledger-cards/{supplyId}/export-pdf', [SupplyLedgerCardController::class, 'exportPdf'])->name('supply-ledger-cards.export-pdf')->middleware('can:ledger-cards.export');
    Route::get('/supply-ledger-cards/{supplyId}/export-excel', [SupplyLedgerCardController::class, 'exportExcel'])->name('supply-ledger-cards.export-excel')->middleware('can:ledger-cards.export');

    // Stock data for the edit dialog
    Route::get('/stocks/{stock}/iar-data', [SupplyStockController::class, 'getIarData'])->name('stocks.iar-data')->middleware('can:stocks.view');

    // Saved e-signatures (JSON, used by Settings › E-signature and the
    // signing preview). They need no shared page props.
    Route::withoutMiddleware(HandleInertiaRequests::class)->group(function () {
        Route::get('/signatures', [SignatureController::class, 'index'])->name('signatures.index');
        Route::post('/signatures', [SignatureController::class, 'store'])->name('signatures.store');
        Route::patch('/signatures/{signature}/default', [SignatureController::class, 'makeDefault'])->name('signatures.make-default')->middleware('can:manage,signature');
        Route::delete('/signatures/{signature}', [SignatureController::class, 'destroy'])->name('signatures.destroy')->middleware('can:manage,signature');
    });

    // Uploaded files (e-signatures, profile photos, property images). A file
    // needs no shared page props, which cost queries on every request.
    Route::get('/files/{path}', [UploadController::class, 'show'])
        ->where('path', '('.implode('|', Uploads::FOLDERS).')/[A-Za-z0-9][A-Za-z0-9._-]*')
        ->withoutMiddleware(HandleInertiaRequests::class)
        ->name('uploads.show');

    /*
    |--------------------------------------------------------------------------
    | ADMIN SIDE (anyone whose roles include "dashboard.view")
    |--------------------------------------------------------------------------
    | `admin-cao` now means "may use the admin side"; others are sent to their
    | own dashboard, as before. Each route below also needs its own permission.
    */
    Route::middleware(['admin-cao'])->group(function () {

        // Role switching - always available to admin/cao
        Route::post('/switch-to-user-mode', [DashboardController::class, 'switchToUserMode'])->name('admin.switch-to-user');
        Route::post('/switch-to-admin-mode', [DashboardController::class, 'switchToAdminMode'])->name('admin.switch-to-admin');
        Route::get('/user-dashboard', [StaffDashboardController::class, 'adminAsUser'])->name('admin.user-dashboard');

        // Admin functions - only when NOT in user mode
        Route::middleware(['admin.not-user-mode'])->group(function () {

            // Creates the public/storage symlink (useful on shared hosting).
            // Previously public; now limited to the super admin.
            Route::get('/run-storage-link', function () {
                Artisan::call('storage:link');

                return 'Symlink created!';
            })->middleware('can:super-admin');

            // Dashboards
            Route::get('/dashboard', [DashboardController::class, 'dashboard'])->name('dashboard');
            Route::get('/assets-dashboard', [DashboardController::class, 'assets'])->name('assets.dashboard')->middleware('can:assets.view');

            // RIS admin functions (approve, decline, issue, manual entry)
            Route::post('/ris/{risSlip}/approve', [RisSlipController::class, 'approve'])->name('ris.approve')->middleware('can:ris.approve');
            Route::post('/ris/{risSlip}/decline', [RisSlipController::class, 'decline'])->name('ris.decline')->middleware('can:ris.approve');
            Route::post('/ris/{risSlip}/issue', [RisSlipController::class, 'issue'])->name('ris.issue')->middleware('can:ris.issue');
            Route::post('/ris/manual-entry', [RisSlipController::class, 'storeManual'])->name('ris.store-manual')->middleware('can:ris.manual-entry');
            Route::post('/ris/validate-manual-stock', [RisSlipController::class, 'validateManualStock'])->name('ris.validate-manual-stock')->middleware('can:ris.manual-entry');

            // RPCI (Report on Physical Count of Inventories)
            Route::get('/rpci', [ReportPhysicalCountController::class, 'index'])->name('rpci.index')->middleware('can:rpci.view');
            Route::get('/rpci/generate', [ReportPhysicalCountController::class, 'generate'])->name('rpci.generate')->middleware('can:rpci.view');
            Route::get('/rpci/export-excel', [ReportPhysicalCountController::class, 'exportExcel'])->name('rpci.export-excel')->middleware('can:rpci.export');

            // User management
            Route::get('/users', [UserController::class, 'index'])->name('users.index')->middleware('can:users.view');
            Route::post('/users', [UserController::class, 'storeUser'])->name('users.store')->middleware('can:users.create');
            Route::put('/users/{id}', [UserController::class, 'updateUser'])->name('users.update')->middleware('can:users.update');
            Route::post('/users/{id}/reset-password', [UserController::class, 'resetPassword'])->name('users.reset-password')->middleware('can:users.reset-password');

            // Supplies
            Route::get('/supplies', [SupplyController::class, 'index'])->name('supplies.index')->middleware('can:supplies.view');
            Route::post('/supplies', [SupplyController::class, 'store'])->name('supplies.store')->middleware('can:supplies.create');
            Route::put('/supplies/{supply}', [SupplyController::class, 'update'])->name('supplies.update')->middleware('can:supplies.update');
            Route::delete('/supplies/{supply}', [SupplyController::class, 'destroy'])->name('supplies.destroy')->middleware('can:supplies.delete');

            // Supply stocks (IAR)
            Route::get('/stocks/next-iar', [SupplyStockController::class, 'nextIar'])->name('stocks.next-iar')->middleware('can:stocks.create');
            Route::post('/stocks/create-beginning-balances', [SupplyStockController::class, 'createBeginningBalances'])->name('stocks.create-beginning-balances')->middleware('can:stocks.beginning-balances');
            Route::get('/stocks', [SupplyStockController::class, 'index'])->name('stocks.index')->middleware('can:stocks.view');
            Route::post('/stocks', [SupplyStockController::class, 'store'])->name('stocks.store')->middleware('can:stocks.create');
            Route::match(['put', 'patch'], '/stocks/{stock}', [SupplyStockController::class, 'update'])->name('stocks.update')->middleware('can:stocks.update');
            Route::delete('/stocks/{stock}', [SupplyStockController::class, 'destroy'])->name('stocks.destroy')->middleware('can:stocks.delete');

            // Supply transactions
            Route::get('supply-transactions', [SupplyTransactionController::class, 'index'])->name('supply-transactions.index')->middleware('can:transactions.view');
            Route::post('supply-transactions', [SupplyTransactionController::class, 'store'])->name('supply-transactions.store')->middleware('can:transactions.create');
            // Corrections by admins (a reason is required; the stock follows).
            Route::put('supply-transactions/iar-number', [SupplyTransactionController::class, 'renumber'])->name('supply-transactions.renumber')->middleware('can:transactions.update');
            Route::put('supply-transactions/{transaction}', [SupplyTransactionController::class, 'update'])->whereNumber('transaction')->name('supply-transactions.update')->middleware('can:transactions.update');
            Route::delete('supply-transactions/{transaction}', [SupplyTransactionController::class, 'destroy'])->whereNumber('transaction')->name('supply-transactions.destroy')->middleware('can:transactions.delete');

            // RSMI (Report of Supplies and Materials Issued)
            Route::get('/rsmi', [ReportSuppliesMaterialsIssuedController::class, 'index'])->name('rsmi.index')->middleware('can:rsmi.view');
            Route::get('/rsmi/generate', [ReportSuppliesMaterialsIssuedController::class, 'generate'])->name('rsmi.generate')->middleware('can:rsmi.view');
            Route::get('/rsmi/detailed', [ReportSuppliesMaterialsIssuedController::class, 'detailed'])->name('rsmi.detailed')->middleware('can:rsmi.view');
            Route::get('/rsmi/analytics', [ReportSuppliesMaterialsIssuedController::class, 'analytics'])->name('rsmi.analytics')->middleware('can:rsmi.view');
            Route::get('/rsmi/yearly-analytics', [ReportSuppliesMaterialsIssuedController::class, 'yearlyAnalytics'])->name('rsmi.yearly-analytics')->middleware('can:rsmi.view');
            Route::get('/rsmi/summary', [ReportSuppliesMaterialsIssuedController::class, 'summary'])->name('rsmi.summary')->middleware('can:rsmi.export');
            Route::get('/rsmi/export-pdf', [ReportSuppliesMaterialsIssuedController::class, 'exportPdf'])->name('rsmi.export-pdf')->middleware('can:rsmi.export');
            Route::get('/rsmi/monthly-comparison', [ReportSuppliesMaterialsIssuedController::class, 'monthlyComparison'])->name('rsmi.monthly-comparison')->middleware('can:rsmi.view');
            Route::get('/rsmi/export-pdf-formatted', [ReportSuppliesMaterialsIssuedController::class, 'exportPdfFormatted'])->name('rsmi.export-pdf-formatted')->middleware('can:rsmi.export');
            Route::get('/rsmi/export-excel', [ReportSuppliesMaterialsIssuedController::class, 'exportExcel'])->name('rsmi.export-excel')->middleware('can:rsmi.export');

            // Departments
            Route::get('/departments', [DepartmentController::class, 'index'])->name('departments.index')->middleware('can:divisions.view');
            Route::post('/departments', [DepartmentController::class, 'store'])->name('departments.store')->middleware('can:divisions.create');
            Route::put('/departments/{department}', [DepartmentController::class, 'update'])->name('departments.update')->middleware('can:divisions.update');
            Route::delete('/departments/{department}', [DepartmentController::class, 'destroy'])->name('departments.destroy')->middleware('can:divisions.delete');

            // Designations
            Route::get('/designations', [DesignationController::class, 'index'])->name('designations.index')->middleware('can:designations.view');
            Route::post('/designations', [DesignationController::class, 'store'])->name('designations.store')->middleware('can:designations.create');
            Route::put('/designations/{designation}', [DesignationController::class, 'update'])->name('designations.update')->middleware('can:designations.update');
            Route::delete('/designations/{designation}', [DesignationController::class, 'destroy'])->name('designations.destroy')->middleware('can:designations.delete');

            // Suppliers
            Route::get('/supplier', [SupplierController::class, 'index'])->name('supplier.index')->middleware('can:suppliers.view');
            Route::post('/supplier', [SupplierController::class, 'store'])->name('supplier.store')->middleware('can:suppliers.create');
            Route::put('/supplier/{id}', [SupplierController::class, 'update'])->name('supplier.update')->middleware('can:suppliers.update');
            Route::delete('/supplier/{id}', [SupplierController::class, 'destroy'])->name('supplier.destroy')->middleware('can:suppliers.delete');

            // Categories
            Route::get('/categories', [CategoryController::class, 'index'])->name('categories.index')->middleware('can:categories.view');
            Route::post('/categories', [CategoryController::class, 'store'])->name('categories.store')->middleware('can:categories.create');
            Route::put('/categories/{category}', [CategoryController::class, 'update'])->name('categories.update')->middleware('can:categories.update');
            Route::delete('/categories/{category}', [CategoryController::class, 'destroy'])->name('categories.destroy')->middleware('can:categories.delete');

            // Locations
            Route::get('/location', [LocationController::class, 'index'])->name('location.index')->middleware('can:locations.view');
            Route::post('/location', [LocationController::class, 'store'])->name('location.store')->middleware('can:locations.create');
            Route::put('/location/{location}', [LocationController::class, 'update'])->name('location.update')->middleware('can:locations.update');
            Route::delete('/location/{location}', [LocationController::class, 'destroy'])->name('location.destroy')->middleware('can:locations.delete');

            // Property conditions (the list the property form picks from)
            Route::get('/property-conditions', [PropertyConditionController::class, 'index'])->name('property-conditions.index')->middleware('can:property-conditions.view');
            Route::post('/property-conditions', [PropertyConditionController::class, 'store'])->name('property-conditions.store')->middleware('can:property-conditions.create');
            Route::put('/property-conditions/{condition}', [PropertyConditionController::class, 'update'])->name('property-conditions.update')->middleware('can:property-conditions.update');
            Route::delete('/property-conditions/{condition}', [PropertyConditionController::class, 'destroy'])->name('property-conditions.destroy')->middleware('can:property-conditions.delete');

            // Properties
            Route::get('/property', [PropertyController::class, 'index'])->name('property.index')->middleware('can:properties.view');
            Route::get('/property/create', [PropertyController::class, 'create'])->name('property.create')->middleware('can:properties.create');
            Route::post('/property', [PropertyController::class, 'store'])->name('property.store')->middleware('can:properties.create');
            Route::get('/property/{property}/edit', [PropertyController::class, 'edit'])->name('property.edit')->middleware('can:properties.update');
            Route::put('/property/{property}', [PropertyController::class, 'update'])->name('property.update')->middleware('can:properties.update');
            Route::delete('/property/{property}', [PropertyController::class, 'destroy'])->name('property.destroy')->middleware('can:properties.delete');
            Route::get('/property/{property}', [PropertyController::class, 'view'])->name('property.view')->middleware('can:properties.view');
            Route::get('/property/{property}/download-qr', [PropertyController::class, 'downloadQr'])->name('property.download-qr')->middleware('can:properties.qr');
        });
    });

    /*
    |--------------------------------------------------------------------------
    | STAFF ROUTES
    |--------------------------------------------------------------------------
    */
    Route::middleware(['requester'])->group(function () {
        Route::get('/staff-dashboard', [StaffDashboardController::class, 'index'])->name('staff.dashboard');
        Route::get('/my-requests', [StaffDashboardController::class, 'requests'])->name('staff.requests');
        Route::get('/my-requests/new', [StaffDashboardController::class, 'newRequest'])->name('staff.new-request')->middleware('can:ris.request');
        Route::get('/my-received-supplies', [StaffDashboardController::class, 'received'])->name('staff.received');
        Route::get('/my-properties', [StaffDashboardController::class, 'properties'])->name('staff.properties');
        Route::get('/force-change-password', [StaffDashboardController::class, 'showChangePasswordForm'])->name('user.force-change-password');
        Route::post('/force-change-password', [StaffDashboardController::class, 'updatePassword'])->name('user.force-change-password.update');
    });
});

require __DIR__.'/settings.php';
