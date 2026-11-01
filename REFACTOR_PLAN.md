# SINOP Refactor Plan

A working plan for refactoring SINOP one module at a time: UI/UX, business logic, and data structure.
This file is the source of truth between sessions. Update it at the end of every module.

- **Owner:** Marvin Waro
- **Engineer:** Raphael (Claude), senior full-stack engineer, UI/UX and front-end focus
- **Started:** 2026-10-29
- **Backup of the original conversion:** `C:\Users\Marvin Waro\OneDrive\Documents\sinop-conversion`
- **Original app (Jetstream / Livewire):** `C:\Users\Marvin Waro\projects\property-management`

---

## 1. Where we are

The Livewire/Blade app has been ported to the Laravel React starter kit and it runs.

| Layer    | Stack                                                                      |
| -------- | -------------------------------------------------------------------------- |
| Backend  | Laravel 13, Fortify, Inertia v3, Wayfinder, Pest                           |
| Frontend | React 19, TypeScript, Tailwind v4, shadcn/ui (Radix), Vite+ (`vp`), sonner |
| Database | MySQL: `sinop_dev` locally (built from live exports), `sys_sinop` on Berth |
| Files    | Berth S3 bucket (Garage), served at `/files/...` (see `DEPLOYMENT.md`)     |
| Extras   | dompdf, endroid/qr-code, phpspreadsheet (used, not installed yet), Pusher  |

Deployment, databases, uploaded files and the go-live steps: **`DEPLOYMENT.md`**.

Known state:

- The conversion is **not committed yet**; it sits on top of `first commit` on `main`.
- It was a faithful port, so the old app's weak spots came along with it: very large controllers,
  denormalized tables, hard-coded values, and pages built in the Blade layout style.
- There are almost no feature tests outside auth and settings.

Largest files (lines). These are where most of the logic cleanup will happen:

| File                                           | Lines |
| ---------------------------------------------- | ----: |
| `RisSlipController.php`                        |  2134 |
| `ReportSuppliesMaterialsIssuedController.php`  |  1628 |
| `SupplyStockController.php`                    |   819 |
| `ReportPhysicalCountController.php`            |   740 |
| `SupplyLedgerCardController.php`               |   606 |
| `StockCardController.php`                      |   503 |
| `DashboardController.php`                      |   478 |
| `PropertyController.php`                       |   446 |

---

## 2. Ground rules

These apply to every module. If a rule must be broken, write down why in the decision log (section 8).

### Data safety

1. **Never run `migrate:fresh`, `migrate:reset` or `db:wipe` against `cims`.**
2. Schema changes are **new, additive migrations** only. The existing 27 migrations are never edited.
3. Every structural change follows **expand → backfill → switch → contract**:
   add the new column/table, copy the data, move the code over, and only drop the old column
   in a later release once the data is verified.
4. Take a database dump before running any migration that touches existing data.
5. Backfill migrations must be safe to run twice and must log row counts.
6. **Databases** (from 2026-10-30):
   - **Live old system:** still in use. Its exports, such as `OneDrive\Documents\cims.sql` (Oct 28), are the only clean source of data.
   - **`sinop_dev`:** where development and manual testing happen. Build or rebuild it from an export with `php artisan sinop:import-legacy <export.sql> --database=sinop_dev`. Add `--replace` to rebuild, and `--force` because `.env` points at it.
   - **`cims` (local):** the first import. It holds browser-test rows (RIS 2026-10-001…004), so don't use it any more.
   - **Automated tests:** in-memory SQLite; they never touch MySQL.
7. **Go-live cutover:**
   1. Put the old system in maintenance and export it.
   2. Run `sinop:import-legacy <export> --database=<live name>`: it imports, runs the migrations and checks row counts.
   3. Run `sinop:audit-data --json=…` and compare it with the rehearsal report.
   4. Smoke test as admin, CAO and staff, then switch over.
   - Rehearse every step on `sinop_dev` with each new export.
   - Never build the live database with `migrate:fresh` followed by a data import: the role migration would run on an empty users table, and every account would be left without access.
   - The full runbook, with Coolify and Berth settings and copying the uploaded files, is in `DEPLOYMENT.md`.

### Backend

- **Thin controllers.** A controller validates (Form Request), authorizes (Policy), calls one
  Action or Service, and returns a response. Target: under ~150 lines per controller.
- **Form Requests** for all validation. No inline `$request->validate()` in controllers.
- **Policies / Gates** for authorization instead of role checks scattered in controllers.
- **Actions** (`app/Actions/<Module>/...`) for single business operations, for example
  `IssueRisSlip`, `ReceiveStock`. **Services** for shared reusable logic, for example the stock ledger.
- **PHP enums** instead of string literals: roles, RIS status, transaction type, fund cluster,
  property condition, stock status.
- **DB transactions + row locks** around anything that moves stock.
- **Eager loading** everywhere; no N+1 queries. Paginate every list.
- **API Resources / DTOs** for Inertia props, so pages get only the fields they use.
- Run `vendor/bin/pint` and `vendor/bin/phpstan` before handing over a module.

### Frontend

- **TypeScript strict.** Every page has typed props; shared types live in `resources/js/types`.
- **Wayfinder** for every URL. No hard-coded paths.
- **Reuse before creating.** Check `resources/js/components` first; a new shared component is
  added only when a pattern appears a second time.
- **Inertia forms** (`useForm` / `<Form>`) with server-side validation errors shown inline.
- **One look across the app.** Use the theme tokens in `resources/css/app.css`; no raw hex colours
  or one-off spacing in pages.
- Run `npm run check` (lint + format) and `npm run types:check` before handing over a module.

### UI/UX standards

- **Page anatomy:** page header (title, short description, primary action) → filter bar → content →
  pagination. The same order on every list page.
- **Lists:** one shared data table with sorting, search, filters kept in the URL, column visibility
  where useful, sticky header, and row actions in a menu.
- **Forms:** dialogs for short reference-data forms (up to ~6 fields); full pages or side sheets for
  long forms (property, RIS, stock receiving). Group fields, mark required fields, keep the primary
  button at the bottom right.
- **Feedback:** loading skeletons, empty states with a next step, toasts for success, inline errors,
  confirmation dialogs for anything destructive or irreversible (issue, decline, delete).
- **Status** always shown with the shared badge component and the same colours everywhere.
- **Numbers and money:** right-aligned, tabular figures, `₱` with two decimals, consistent date format.
- **Accessibility:** keyboard reachable, visible focus, labels on every input, WCAG AA contrast,
  works in light and dark mode.
- **Responsive:** usable from 360 px; tables scroll inside their card, never the whole page.
- **Printed government forms** (RIS, IAR, Stock Card, SLC, RSMI, RPCI) keep their official
  layout exactly. Only the screens around them get redesigned.

### Testing

- Every module ends with Pest feature tests for its main flows and its authorization rules.
- Stock-moving logic (receive, issue, adjust, balances) gets unit tests with edge cases.
- MySQL-only queries are isolated so the rest can run on SQLite in tests.

---

## 3. Data model review

Findings from the migrations. Each one is a **proposal**; it is confirmed against the real `cims`
data before any change, and handled inside the module that owns the table.

| #  | Table / area                         | Problem                                                                                                                         | Proposed change                                                                                          | Module |
| -- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------ |
| D1 | `end_users`                          | Not used anywhere in `app/`, `routes/` or `resources/js`. Stores department/designation as free text.                           | Confirm it is empty or obsolete, then drop it.                                                            | 1      |
| D2 | Fund cluster (several tables)        | Stored as free text in `supply_stocks`, `supply_transactions`, `ris_slips`; `properties.fund` is free text too. `'101'`/`'151'` are hard-coded ~20 times in PHP. | `fund_clusters` lookup table (code, name, active) + FK columns, or at minimum a PHP enum used everywhere. | 2      |
| D3 | `properties.condition`, `unit_of_measure`, `supplies.unit_of_measurement` | Free text, so the same value is spelled several ways, which breaks grouping in dashboards and reports. | Enum for condition; `units` lookup table for units of measure.                                            | 2, 3, 9 |
| D4 | `properties.active` + `excluded`, `locations.active` + `excluded` | Two booleans for one lifecycle; unclear combinations (active and excluded?).                                   | One `status` enum (e.g. active / disposed / transferred) or soft deletes, chosen per table.               | 2, 9   |
| D5 | `supply_stocks.total_cost`, `supply_transactions.total_cost` | Derived values (`qty × unit_cost`) stored and can drift.                                                                    | Compute on read, or keep but always set in one place (model mutator) and verify with a check command.    | 4, 5   |
| D6 | `supply_transactions.balance_quantity` | Running balance stored on each row. A back-dated or edited transaction makes every later balance wrong.                       | Single `StockLedger` service that recalculates balances in date order inside a locked transaction; nightly integrity check. | 5 |
| D7 | `supply_stocks.quantity_on_hand` vs transactions | Two sources of truth for the same quantity.                                                                           | Ledger (transactions) is the truth; `quantity_on_hand` becomes a maintained cache, reconciled by command. | 4, 5   |
| D8 | `supply_transactions.reference_no`   | Links to IAR/RIS by text only; no foreign key.                                                                                  | Add nullable `ris_id` / `stock_id` (or a polymorphic source) and backfill from `reference_no`.            | 5      |
| D9 | `ris_slips` approval columns         | Five actor/timestamp pairs plus four `*_signature_type` columns plus decline fields on one row.                                 | `ris_slip_signatories` (or events) table: step, user, signed_at, signature_type, remarks. Keep the old columns until verified. | 6 |
| D10 | `ris_slips.division`                | FK to `departments` named `division`; `entity_name` and `office` repeated as free text on every slip.                          | Rename in code via a model accessor first; move entity/office defaults to settings.                       | 6      |
| D11 | `ris_slips.ris_no`                  | Not unique.                                                                                                                     | Check for duplicates, then add a unique index.                                                            | 6      |
| D12 | `ris_slips.status`                  | `string(20)` checked against constants in `RisStatus`.                                                                          | PHP backed enum cast on the model.                                                                       | 6      |
| D13 | `ris_items.stock_available`         | Derived flag stored on the row.                                                                                                 | Compute from stock at read time, or set only by the issuing action.                                       | 6      |
| D14 | Primary key naming                  | `supply_id`, `stock_id`, `transaction_id`, `ris_id`, `item_id` instead of `id`.                                                | Keep as is (renaming PKs is high risk, low value). Document it; set `$primaryKey` everywhere.             | —      |
| D15 | `users`                             | `role` as free string, `status` boolean, leftover Jetstream `current_team_id`.                                                 | Role enum + policies; drop `current_team_id` once confirmed unused.                                       | 1      |
| D16 | `properties` FKs                    | `location_id` and `user_id` cascade on delete, so deleting a user or location deletes their properties.                       | Change to restrict (or null + reassign) so property records are never lost.                                | 9      |
| D17 | Missing indexes                     | Report queries filter by date, fund cluster, supply and department without composite indexes.                                 | Add indexes based on the slow-query list collected per module.                                            | 5, 7, 8 |
| D18 | Manual RIS = one slip per item      | The old manual entry saved each item as its own `ris_slips` row with the same RIS number. In the Oct 28 export, 147 numbers are shared, e.g. RIS 2025-01-001 is 13 slips of 1 item each. | Group into one slip with many items (keep a mapping); then add the unique index from D11.                  | 6      |
| D19 | `supply_stocks.total_cost`          | Never lowered when supplies are issued: 186 of 246 rows are wrong (e.g. 0 on hand × ₱33.50 but ₱636.50 total). Inflates the dashboard stock value and the next IAR's average cost. | Keep it right inside one `StockLedger` service, or compute it.                                             | 5      |
| D20 | Issue lines without fund cluster    | `RisSlipController@issue` doesn't save `fund_cluster`: 1,316 lines. RSMI screen vs PDF and RPCI then disagree.                 | Write it on issue; backfill from the RIS slip.                                                             | 5      |
| D21 | Stock re-value                      | Adds an "adjustment" line dated on the IAR but carrying today's quantity, so card, ledger, RSMI and RPCI balances can go negative. The IAR line keeps the old cost. | Part of the `StockLedger` work. Before/after reports are signed off.                                       | 5      |
| D22 | `user_transactions`                 | Never written for manual RIS, so 931 received slips are missing from the staff "Received supplies" page. | Derive "received" from `ris_slips.received_by`, or backfill.                                               | 1      |
| D23 | Signed RIS forms change             | Signatory names, designations and signatures are looked up live, so editing a person rewrites past forms. `ris_slips.office` is a half-snapshot. | `ris_slip_signatories` snapshot at signing (with D9, D10). E-signatures are frozen since 2026-10-30 (`ris_slip_signatures`); names and designations are still live. | 6      |
| D24 | Reused rows / caches                | Adding a location or property overwrites a removed one (its ID, history, QR). Property QR images are cached and keep old names. | Stop the reuse; regenerate the QR on change.                                                               | 2, 9   |
| D25 | Dropped values                      | `storeManual` sends `cao_name`, `cao_designation`, `created_at`, `updated_at`; none are fillable, so they are silently lost. The RIS "Requested" date shows the typing date, not the RIS date. | Decide what to keep; write it explicitly.                                                                 | 6      |
| D26 | Duplicate empty stock row           | Adding a supply makes an empty `supply_stocks` row with no fund cluster; the first IAR added a second row for its fund cluster instead of filling it, so Stocks listed the item twice ("Depleted, 0" plus the real one): 18 items in the Oct 28 export. | Fixed 2026-10-31: a receipt fills that empty row (`SupplyStockController::processStockReceipt`); migration `2026_10_31_000007` removes the empty duplicates. | 5      |

Baseline from `php artisan sinop:audit-data` on the Oct 28 export:
- 0 accounts without a role; 0 orphan rows; 0 supplies whose on-hand differs from receipts − issues.
- 147 shared RIS numbers (D18); 1,316 issue lines without a fund cluster (D20); 186 total-cost rows (D19).
- 8 RIS numbers whose issued quantity differs from the ledger; 931 manual RIS missing from "Received supplies" (D22).
- 0 fund/unit/condition spelling variants. The export has no properties, locations or suppliers rows.

---

## 4. Module roadmap

Order follows dependencies: foundations first, then reference data, then the supply chain from
catalog to reports, then property, then dashboards (which read from everything).

| #  | Module                                   | Covers                                                                                  | Status      |
| -- | ---------------------------------------- | --------------------------------------------------------------------------------------- | ----------- |
| 0  | Foundation                               | Baseline commit, enums, shared data table, page layout, form patterns, status badges, formatters, CI checks | In progress |
| 1  | Users, roles & access                    | Users list, roles/policies, admin "user mode", forced password change, profile, signature, D1, D15 | Not started |
| 2  | Reference data                           | Divisions, designations, categories, locations, suppliers, fund clusters, units, D2–D4  | Not started |
| 3  | Supplies catalog                         | Supplies list, create/edit, reorder point, category, D3                                 | Not started |
| 4  | Stock receiving (IAR)                    | Supply stocks, IAR numbers, beginning balances, D5, D7                                  | Not started |
| 5  | Transactions & ledger                    | Supply transactions, stock card, supply ledger card, `StockLedger` service, D6, D8      | Not started |
| 6  | RIS (requisition & issue)                | Request → approve/decline → issue → receive, manual entry, print/Excel, D9–D13          | Not started |
| 7  | RSMI reports & analytics                 | RSMI report, detailed, analytics, yearly, monthly comparison, exports                   | Not started |
| 8  | RPCI (physical count)                    | Physical count report and export                                                        | Not started |
| 9  | Property (PPE)                           | Property list/create/edit/view, images, QR codes, MR assignment, D4, D16                | Not started |
| 10 | Dashboards                               | Admin dashboard, assets dashboard, staff dashboard                                      | Not started |
| 11 | Notifications & real-time                | Notification center, Berth/Soketi live updates, toasts                                  | Done        |
| 12 | Hardening & release                      | Performance pass, security review, full test run, deployment notes                      | Not started |

Status values: `Not started` · `In progress` · `In review` · `Done`

---

## 5. How each module is done

1. **Audit.** Read the module's controller, models, pages and the matching code in the old app.
   List current behaviour, bugs, and UI problems in this file under the module.
2. **Propose.** Short write-up: UI changes (with a layout sketch), logic changes, schema changes,
   risks. Marvin approves before code is written.
3. **Branch.** `refactor/<nn>-<module>` from `main`.
4. **Build.** Migrations (additive) → models/enums → actions/services → requests/policies →
   controller → pages/components → tests.
5. **Verify.** `php artisan test`, `vendor/bin/pint --test`, `vendor/bin/phpstan`,
   `npm run check`, `npm run types:check`, `npm run build`. Then a click-through on a copy of `cims`.
6. **Hand over.** Summary of what changed, what to test by hand, migration commands, and anything
   that behaves differently on purpose.
7. **Close.** Update the status table, the module notes, and the decision log here.

### Definition of done

- [ ] Approved proposal
- [ ] Migrations are additive, reversible, and tested on a copy of `cims`
- [ ] Controllers thin; logic in actions/services; validation in Form Requests; access in policies
- [ ] No string literals for statuses, roles, fund clusters or conditions
- [ ] Pages follow the UI standards in section 2 (light, dark, mobile, keyboard)
- [ ] Printed forms unchanged unless a change was agreed
- [ ] Feature tests for main flows and permissions pass
- [ ] Pint, PHPStan, lint, type check and build pass
- [ ] This file updated

---

## 6. Module notes

Filled in during each module's audit and work.

### 0 · Foundation

**UI pass 1 (2026-10-29), done, awaiting click-through:**

- SAP Fiori theme as SINOP's single theme (tokens copied from UniFAST's `theme-fiori`), Inter font,
  tabular figures, Fiori first-paint and progress-bar colours. No theme picker yet.
- Appearance page: UniFAST-style Light / Dark / System cards.
- Settings menu grouped like PHLGADIS: Account, User management, System configuration.
  The menu definitions live in `hooks/use-navigation.ts` (`accountSettingsNav`, `adminSettingsNav`).
- Users table moved off the dashboard to Settings → Users (`GET /users`, `users.index`,
  `UserController@index`). Logic unchanged; CAO still view-only.
- Libraries (Divisions, Designations, Categories, Suppliers) and Locations moved into
  Settings → System configuration. URLs and route names unchanged; pages now live in
  `pages/settings/*`.
- Sidebar: "Libraries" group and Locations removed; "Settings" link in the footer for admin/CAO.
- `Heading` gained an optional `actions` slot.
- Tests: `tests/Feature/Settings/AdminSettingsTest.php`.

**UI pass 2 (2026-10-29):**

- Charts (`components/charts.tsx`) measure their container and draw in real pixels: fixed
  height (260px), 12px axis text, round tick values, dashed grid, smooth line with soft fill,
  rounded bars, hover tooltips. Same props, so no page changed.
- Light/dark toggle in the top-right of the header (`components/appearance-toggle.tsx`).
- Performance: Assets Overview crashed (ambiguous `excluded` column, 6 s error page) and is fixed;
  RIS list 80 → 25 queries (pending quantities and stock rows loaded once, not per supply);
  debug `Log::info` calls removed from the RIS list; avatars no longer fetched from
  ui-avatars.com (initials fallback instead); sidebar/settings links prefetch on mousedown,
  not hover, so the single-threaded dev server isn't flooded.
- Stocks (IAR): old CIMS action colours restored (Stock cards green, Ledger cards grey, New IAR red;
  row actions red add / amber re-value / green stock card / grey ledger card / red delete) with
  tooltips, via the shared `components/icon-action.tsx` (`IconAction`, `solidTones`). Status filter
  tabs get coloured icons and count pills.
- Stock Card and SLC tables: light column-group tints like the old screens (receipt green, issue red,
  balance blue) from `components/cards/column-tones.ts`. Display only; no data or formula changes.
**UI pass 3 (2026-10-29):**

- One container per table: `components/table-panel.tsx` (`TablePanel`, `TablePanel flush` inside
  titled cards). Toolbars sit on the page; ~20 pages converted. Dialog tables left as they are.
- Stock Card / SLC: blue banner (`components/cards/supply-card-banner.tsx`) with item, stock no,
  filters, exports and Prev / Next ("Item 2 of 228"); icon tiles (`supply-card-stats.tsx`) with
  stock-level colour and period totals. Backend: `App\Services\SupplyCardNavigation` (supplies with
  stock records, by `supply_id`), passed as the additive `navigation` prop.
- Dashboard: "Issuance analytics" section (deferred prop, year + fund cluster) with the RSMI yearly
  analytics and a new 1st vs 2nd semester comparison; "Stock value" KPI; greeting.
  `App\Services\RsmiAnalyticsService` holds `correctUnitCosts()` and `yearly()` moved verbatim from
  the RSMI controller (controller keeps one-line delegates); only addition is `semester_data`.
  Verified on `cims`: semester totals = yearly total = RSMI yearly page.
- Shared `components/analytics/yearly-issuance-analytics.tsx` used by Dashboard and RSMI yearly page.

**UI pass 4 (2026-10-29):**

- Theme picker (Settings › Appearance › Theme): SAP Fiori (default), Vercel, Notion. Definitions in
  `lib/themes.ts`, state in `hooks/use-color-theme.tsx` (localStorage, class on `<html>`, applied
  before paint in `app.blade.php`). Tokens in `app.css` from the getdesign.md DESIGN.md files
  (Vercel: Geist + Geist Mono, ink on #fafafa, 6px controls; Notion: Inter, warm #f6f5f4 paper,
  #0075de, indigo band). Dark palettes derived. New `--band` token colours the SC/SLC header.
- SC/SLC: stat tiles without icons (one hairline panel with dividers); banner flat (no glow/ring),
  export buttons without icons.

**Activity log (2026-10-29):** Settings › System configuration › Activity logs, Admin only.

- New table `activity_logs` (migration `2026_10_29_000000`), written only by
  `App\Services\ActivityRecorder` (ported from PHLGADIS; never throws). Kept forever.
- Sources: `LogsActivity` trait on Category, Department, Designation, Location, Supplier, Supply,
  Property, User (create / edit with before → after / delete; removed-row reuse read correctly);
  User model hooks for password changed / reset, photo, e-signature; `RecordAuthenticationActivity`
  listener (login, logout, failed login, 2FA); one entry per RIS step via `App\Support\RisActivity`
  (requested, approved, declined, issued with stock before → after, received, manual entry);
  IAR recorded / re-valued / deleted / beginning balances in `SupplyStockController`; manual
  transactions; admin user-mode switches; `RecordExport` middleware for the 12 export, print and
  download routes (successful responses only). Page views are not logged.
- Tests: `tests/Feature/ActivityLogTest.php`.

**Roles & permissions (RBAC, 2026-10-30):** same design as PHLGADIS.

- New tables only: `roles`, `permissions`, `permission_role`, `role_user` (migration
  `2026_10_30_000000`), filled by `2026_10_30_000001` (61 permissions; Administrator = locked super
  admin with every permission; CAO = today's CAO access, 47 permissions; Staff = `ris.request`;
  every account placed by `users.role`). Insert-if-missing only, safe to re-run. `app_settings`
  (`2026_10_30_000002`) holds the RIS CAO signatory, seeded with the current CAO.
- Verified on `cims`: all 25 existing tables unchanged (checksums), all 27 accounts keep exactly
  their old access, signatory unchanged.
- `users.role` kept and synced (`User::syncLegacyRole()`); new accounts always get a role.
- Checks: `Gate::before` (super admin + permission slugs), `can:` on every route,
  `RisSlipPolicy` (own slips), `admin-cao` = `dashboard.view`, `requester` = staff screens,
  friendly redirect on 403. Front end: `useCan()`, menus/buttons follow permissions.
- Screens: Settings › Roles & permissions, roles picker on Users, Settings › RIS signatory.
- Now closed to staff (were reachable only by typing the URL): stock/ledger card lists, the full
  RIS list, stock IAR data.
- Tests: `tests/Feature/RbacTest.php`.
- Seeded role **Supply and Procurement Officer** (`supply-officer`, migration `2026_10_30_000003`):
  42 permissions; admin-only stays out (accounts, roles, activity log, RIS signatory, deleting
  stocks/supplies/properties, editing divisions/designations), and `ris.approve` stays with the CAO
  (separation of duties). Assigned to nobody by the migration. Activity log now records each
  person's main role (`User::primaryRoleSlug()`) and shows its name.

**Transactions page (2026-10-30):** document view (default) + item-lines view.

- `SupplyTransactionController@index` only (store untouched): `view=documents|lines`, new filters
  `search` (reference, item, stock no), `division`, `fund`; both views sort by transaction date.
  Documents = lines grouped by type + reference number (359 documents from 2,582 lines on `cims`);
  a document is listed when any line matches and its totals use all its lines; item lines for the
  page are sent slimmed (`lineData()`). Verified on `cims`: totals and per-document sums match.
- Page: Documents | Item lines switch, expandable documents (items, units, unit cost, value,
  balance after, stock-card link), RIS reference links to the slip, "Recorded on" shown apart
  from the transaction date. Tests: `tests/Feature/SupplyTransactionsPageTest.php`.

**Dropdowns:** every dropdown is now shadcn/Radix.

- Long searchable lists (supplies, users, locations) use `SearchableSelect`, which opens in a modal
  Popover (`components/ui/popover.tsx`), so it floats above dialogs instead of stretching them.
- All other selects use `FormSelect` (`components/form-select.tsx`, a shadcn Select with an
  options/groups list). It replaced the native `NativeSelect`, which was removed (56 selects in 18
  files). Values stay strings, and an option with value `''` ("All …", "No supplier") is allowed
  through a sentinel. `required` and `name` still work inside forms. Use one of these two for any
  new dropdown; no native `<select>`.

**Long item forms (Manual RIS entry, New IAR):** the dialog keeps a fixed header and footer, and
only the middle scrolls.

- **Shared helper** `hooks/use-line-items.ts`:
  - Items keep their entry order: the saved and printed order, and the `items.N` error indexes.
  - Each item carries a client-only `row_key`, which `form.transform` strips, so the request body
    is unchanged.
  - Updates use the functional `setData`.
- **Rows:** newest first, numbered with the entry number (#), and memoized (`ManualItemRow`,
  `IarItemRow`), so typing re-renders one row only.
  - A new row scrolls into view and opens its supply list.
  - Enter in an item field adds the next item instead of submitting.
- **Toolbar:** the item list header (`components/line-items-toolbar.tsx`) sticks while scrolling.
- **Footer:**
  - RIS: Final status (plus decline reason), item and quantity totals, and the buttons.
  - IAR: item count, Grand total and the buttons.
- **Closing with changes** (Esc, outside click, ✕, Cancel) asks before discarding.

**Landing and sign-in pages:** Calendly-style ("navy ink on cool marble") on the theme tokens.

- **Files:** `pages/welcome.tsx`; `components/landing/*`, which holds the ambient background,
  product preview, sections, brand mark and `brandPanel`; `layouts/auth/auth-split-layout.tsx`,
  now the auth layout for all auth pages. The preview uses sample data only.
- **Own light/dark switch, dark by default:**
  - `hooks/use-public-appearance.ts` stores the choice in the `public_appearance` cookie and in
    localStorage. The cookie is unencrypted.
  - `HandleAppearance` renders these routes (home, login, register, password.*, two-factor.login)
    in that mode on first paint. `setAppearanceOverride` in `use-appearance` applies it.
  - The app's Appearance setting is not changed, and it comes back as soon as you leave these
    pages. Tests: `tests/Feature/PublicAppearanceTest.php`.
- **App default:** the app itself is also dark until the user picks a mode (`DEFAULT_APPEARANCE` in
  `use-appearance`, HandleAppearance's cookie fallback).
  - A stored `system` only counts once it was chosen (`appearance_chosen`), because older
    versions wrote `system` automatically.
  - A chosen light or dark is kept.
- **Motion** (all `motion-safe`): aurora glows, the shimmering hero headline (`text-shimmer` +
  `animate-shimmer` in app.css), the floating cards, and a dot-grid spotlight. The spotlight is
  rAF-batched and writes CSS variables, so it causes no React re-renders.

**Uploads on S3 (2026-10-30).** E-signatures, profile photos and property images go to the uploads disk
(`UPLOADS_DISK`: Berth's Garage bucket, or `public`).

- `App\Support\Uploads` is the one place for the disk, the URL and a local copy (Excel signature drawings).
- The browser loads files from `/files/<path>` (`UploadController`): signed-in users only, the three upload folders only,
  cached by the browser. The bucket stays private; the stored paths are unchanged.
- Changed callers: `User` (photo, avatar, signature), `PropertyImage`, `SignatureController`, `PropertyController`
  (images only), `NotificationResource`, the RIS Excel export and `ris/print.blade.php` (it used the default disk).
- One folder per environment in the bucket, named after `APP_ENV` (`local/`, `production/`; `AWS_ROOT` overrides),
  so local test uploads can be wiped without touching the live files.
- `php artisan sinop:copy-uploads [folder]` copies existing files and lists any still missing.
- Property QR images stay in `storage/app/public/qrcodes` until module 9.
- Tests: `tests/Feature/UploadsTest.php` (the bucket is faked); `phpunit.xml` pins `UPLOADS_DISK=public`.

**Next phase:** backend and table structure, step by step (section 3, D1–D17), starting with
the foundation items (enums, baseline commit) and Users/roles.

- Dev-environment finding: each request spends ~0.5–1 s booting Laravel on Windows
  (file I/O). Not an app bug; see notes given to Marvin.

### 1 · Users, roles & access

_Not started._

### 2 · Reference data

_Not started._

### 3 · Supplies catalog

_Not started._

### 4 · Stock receiving (IAR)

_Not started._

### 5 · Transactions & ledger

_Not started as a module._ One piece landed ahead of it:

**Correcting recorded transactions (2026-10-31).** Admins fix typing mistakes on the Transactions page instead of in phpMyAdmin.

- **Who:** new permissions `transactions.update` and `transactions.delete` (migration `2026_10_31_000006`), given to no role. The Administrator has them as super admin; they can be given to others in Roles & permissions. The Supply and Procurement Officer migration lists them as admin-only, so re-running it doesn't hand them out.
- **What can be changed:**
  - A receipt (IAR) line: date, IAR no. (same format; an IAR lists an item once), quantity, unit cost, remarks.
  - An issue (RIS) line: date, quantity, division, remarks. Its reference is the RIS number, and its cost is re-derived by the ledger card and RSMI anyway.
  - Item and fund cluster can't be changed (delete the line and record it again). Re-value (adjustment) lines can't be corrected here.
  - A whole IAR can be renumbered ("Change IAR no." on the document). It is refused, naming the items, when the new number already has one of them.
- **Every change needs a reason.** One activity-log entry each, with before → after, the stock on hand before → after, and the RIS issued quantity before → after.
- **What follows:**
  - Read-time figures (stock card, ledger card, RSMI, RPCI past dates, dashboard charts) follow by themselves.
  - Stored copies are updated in the same database transaction (`App\Services\StockLedger`), under the same `supply_stocks` row lock RIS requests take:
    - each later line's `balance_quantity`;
    - the stock row's `quantity_on_hand` and `status`, and its `unit_cost` and `total_cost`, from the ledger's weighted average (the ledger card's figures). The row is the line's fund cluster, else the RIS's, else issuing's FIFO order;
    - an RIS line's `ris_items.quantity_issued`, set to the sum of that RIS's lines for the item. If several slips share the RIS number and the item (D18), the change is refused.
- **Below zero is refused**, naming the line: "RIS 2026-10-005 on Oct 20, 2026 would leave -3 in stock". Only new or deeper dips count, so an old back-dated dip doesn't block an unrelated fix.
- **Code:** `App\Actions\Transactions\{CorrectTransaction, DeleteTransaction, RenumberIar}`, Form Requests in `App\Http\Requests\Transactions`, `SupplyTransactionController@update|destroy|renumber`, `components/transactions/transaction-corrections.tsx`.
- **Not done (module 5):**
  - Only the corrected item's stock row is re-priced; D19 (`total_cost` never lowered on issue) and D20 (issue lines without a fund cluster) remain for the others.
  - The RIS status and issued date are not changed by a correction.
- **Tests:** `tests/Feature/TransactionCorrectionTest.php`. There is also a real-mouse walk on a throwaway SQLite: correct a receipt, the delete refused, delete an issue, renumber an IAR, and the CAO sees no buttons.

### 6 · RIS

_Not started as a module._ One fix landed ahead of it:

**Simultaneous requests (2026-10-30).** Requests are served first come, first served. Before, two submits for the same supply within the same moment could both pass the stock check and over-reserve; the old system had the same gap.

- **The lock:** `RisSlipController::store()` and `storeManual()` lock the requested supplies' `supply_stocks` rows (`lockForUpdate`, in supply order) as the transaction's first query. The stock check then runs inside the same transaction.
  - A later request for the same supply waits for the earlier one to save, then sees what it took.
  - Requests for other supplies don't wait.
- **Unchanged:** the check itself (`ensureStockAvailable()`, moved verbatim from `store()`), its messages, and the RIS-number retry. The transactions are retried up to 3 times on a deadlock.
- **Verified on MySQL** in a scratch database:
  - B submitted 0.5 s after A, waited for A's save, and was rejected with "Only 2 units available".
  - When both fit, both were saved, as RIS …-001 and …-002.
- **Tests:** `tests/Feature/RisRequestStockTest.php`.
- **Not covered:** issuing (`issue()`) still has no lock. Two people issuing at the same moment is a separate, rarer case.

**Request dialog review, conflicts and inline e-signature (2026-10-30).**

- **Bug fixed — Continue used to submit at once.**
  - Cause: the Continue (`type="button"`) and Submit (`type="submit" form=…`) buttons shared one DOM node across the step ternary. React re-rendered before the browser finished the click, which turned the click into a submit.
  - Fix: the footer groups are keyed (`<Fragment key="items|review">`).
  - Test browser flows with real mouse events (`Input.dispatchMouseEvent`); `element.click()` hides this bug.
- **Review step:** entity, division, office, RCC and purpose; the items with icons and a total; then the signature choice. Only **Submit request** sends the request.
- **Stock conflict:**
  - On `supplies.N.quantity` errors the dialog maps them to supply ids and shows an amber "Someone requested some of these items first" notice. It refreshes the list, notes "Only N left now (you asked for M)" or "None left" on each affected row, and offers **Update to what's left**.
  - Server messages are unchanged and are used as the fallback.
- **Catalog in state:** the dialog's `supplies` and `departments` live in `pages/staff/requests.tsx` state, filled from `onSuccess(page)`. Before, the page reload after a failed submit or an upload dropped the optional props and blanked Division, Office and the items.
- **E-signature upload:** replaced by the signing preview, see "E-signature studio" below.

**Purpose is optional (2026-10-30).** It is optional in both Request supplies and the admin Manual RIS entry.

- **Validation:**
  - `store` uses `nullable|string`.
  - `storeManual` and `RisSlip::getValidationRules` use `nullable|string|max:1000`.
  - Both saves read `$validated['purpose'] ?? null`.
- **Database:** no schema change; `ris_slips.purpose` was already nullable.
- **Display:** an empty purpose shows "—" on Review, "N/A" on the RIS page, and a blank line on the printout.
- **Tests:** `tests/Feature/RisPurposeOptionalTest.php`.

**Print removed; exports fixed (2026-10-30).**

- **Print:** the RIS Print button, route, controller method and `resources/views/ris/print.blade.php` are removed (Marvin: not needed for now). Old "Printed" log entries still show. It is in git if wanted back.
- **Exports:**
  - `phpoffice/phpspreadsheet` and `barryvdh/laravel-dompdf` are installed.
  - The five Excel exports (RIS, stock card, ledger card, RSMI, RPCI) used `header()` + `exit`, so they were never logged and temporary files were never deleted. They now return `App\Support\ExcelDownload::response()`.
  - All 11 export URLs return 200 on `sinop_dev`.
- **Tests:** `tests/Feature/RisExportTest.php`.

**E-signature studio (2026-10-30).** Like the DTR's "Sign & print": a preview of the form, saved signatures, drag to place, Apply.

- **Decisions (Marvin):**
  - A signer places their signature only inside their own box.
  - Up to 10 saved signatures each, one of them the default.
  - A signed RIS keeps the image and position used at signing (D23).
- **Data** (additive):
  - `user_signatures` (name, source drawn/typed/uploaded, path, is_default). The migration copies each `users.signature_path` in as the default.
  - `users.signature_path` stays, kept equal to the default by `App\Services\SignatureLibrary`.
  - `ris_slip_signatures` (ris_id, step, user_id, path, x, y, width, rotation, signed_at; unique ris_id + step). `path` is a copy in `ris-signatures/`. Placement is stored as fractions of the signer's box.
- **Boxes:** `App\Support\RisSignatureBox` (PHP) and `resources/js/lib/signature-placement.ts` (TS) share the Excel column widths, so the preview, the RIS page and the Excel file put a signature in the same spot.
- **Signing:**
  - `App\Support\RisSignaturePlacement::rules()` and `record()`, called from `store`, `approve`, `issue` and `receive`.
  - E-sign needs `signature: {id, x, y, width, rotation}` from one of the signer's own saved signatures. SGD needs nothing, as before. Decline stays SGD.
- **Excel:** the four copy-pasted drawing blocks are one loop (`drawSignature`). Slips signed before this use the person's current signature at the old position.
  - Their `catch` caught nothing (`Exception` without an import). A bad image now falls back to "SGD" as intended.
- **Background removal, no library:**
  - The browser runs `lib/signature-image.ts`: the paper colour is the median of the edges, the ink is separated from it, and the image is trimmed.
  - `App\Support\SignatureInk` is the same rule in GD. It is used by `php artisan sinop:clean-signatures` for signatures uploaded before this; that command is idempotent and writes new file names because `/files` is cached as immutable.
  - Dark mode shows ink with `dark:invert dark:hue-rotate-180` (blue stays blue). This replaces `mix-blend-multiply dark:invert`, which made the black box.
- **Frontend (`components/signature/`):**
  - `signature-studio.tsx`: the "Sign" dialog.
  - `ris-form-preview.tsx`: Appendix 63 in HTML, scaled with `cqw`.
  - `placement-editor.tsx`: pointer-event drag, resize and tilt; keyboard arrows, +/− and [ ].
  - `signature-creator-dialog.tsx`: Draw with `signature_pad`, Type with `@fontsource` Great Vibes, Allura or Sacramento, Upload.
  - `signature-library.tsx` and `signature-box.tsx`.
  - The studio and creator are `React.lazy` chunks (about 6 KB and 9 KB gzipped); fonts load only when used.
  - JSON endpoints: `signatures.*` and `ris.document`, without the Inertia middleware.
- **Tests:** `SignatureLibraryTest`, `RisSignatureTest`, `RisExportTest`, `CleanSignaturesTest`. There is also a real-mouse browser walk in throwaway SQLite: create drawn, typed and uploaded signatures, approve with a dragged and tilted signature, then request as staff, creating a signature inside the preview.

**New request page (2026-10-30).** Request supplies moved out of the dialog to `/my-requests/new` (`staff.new-request`, `pages/staff/request-create.tsx`). The dialog had grown into a workflow, and signing stacked three dialogs.

- **Step 1, Items:**
  - A dense catalog list with category tabs and search (press `/` to jump to it). Add puts in 1; the quantity is then changed in the row. The request panel on the right is sticky; phones get a bottom bar instead.
  - The old "Add all to request" button is gone, because quantities now go straight into the request.
- **Step 2, Review & sign:** the Appendix 63 preview updates live as the details are typed, next to the details, the signature choice and Submit. The Sign window opens over the page, never over another dialog.
- **Draft:** the request (not the signature) is kept in `localStorage` per user until it is submitted, so a refresh or a stray Back doesn't lose it ("Picked up where you left off · Start over").
- **Stock conflicts:** unchanged. The page reloads `supplies` and returns to step 1 with the notice. Other errors stay on step 2.
- **Server:**
  - `ris.store` now redirects to `staff.requests` (it used `back()`, which would land on the new page).
  - `/my-requests?new` redirects to the new page.
  - The My requests page no longer carries the optional `supplies` and `departments` props.
- **Moved and removed:** shared pieces live in `components/staff/request-parts.tsx`. `request-supply-dialog.tsx` is removed. `SignatureChoice` gained `showPreview` and passes the image URL to `onSignatureChange`.
- **Tests:** `StaffPagesTest`. There is also a real-mouse walk in throwaway SQLite at desktop (light and dark) and phone width: add, reload restores the draft, e-sign, submit, back on the list with the draft cleared.

### 7 · RSMI reports & analytics

_Not started._

### 8 · RPCI

_Not started._

### 9 · Property (PPE)

**Property form, sticker and scan page (2026-10-30).**

- **Type to add:**
  - **Location:** a location that isn't listed can be typed in the form; it is saved to `locations` (an active one with the same name, in any case, is reused; removed rows are not reused). Only people with `locations.create` can type a new one.
  - **Condition:** conditions have their own list, `property_conditions` (seeded with Serviceable and Unserviceable plus any condition already used). A typed one is added; a different case of a listed one takes the listed spelling. `properties.condition` still holds the name (D3).
  - Both use `SearchableSelect`'s new `onCreate` ("Add “…”" as the last row).
- **Property number:** saved in capitals, both in the browser and on the server.
- **Layout:** photos and the sticker take 4/12; the details take 8/12.
- **Sticker** (`components/properties/property-sticker.tsx`):
  - 3 × 2 in: CHED header, item name, property no., S/N, and a QR.
  - Print at actual size, or save as a 300 dpi PNG. One SVG serves the preview, print and PNG.
  - The QR is drawn in the browser (`qrcode`, loaded only on property pages).
- **The QR holds a link, not text:** `/p/{property number}` (`property.scan`).
  - This fixes the stale-QR half of D24: editing never makes a printed sticker wrong (renumbering does; reprint then).
  - The PDF sticker (`property.download-qr`) uses the same link, under a new cache name.
- **Public scan page** (`PropertyScanController`, `pages/public/property.tsx`):
  - Opens without login and shows the item, property no., serial and model, condition, location and the accountable person.
  - Signed-in users also see cost, fund, quantity, description, remarks and photos; users with `properties.view` get "Open in SINOP".
  - "Sign in" goes through `/p/{number}/sign-in` (behind auth), so login comes back to the page.
  - Removed or unknown numbers return 404. The route is rate-limited at 60 per minute.
- **Settings › Property conditions** (`PropertyConditionController`, `settings/property-conditions.tsx`):
  - Add, rename and delete conditions. A rename is applied to the properties that use it; a condition still in use can't be deleted.
  - Serviceable and Unserviceable are built in (the assets overview counts them).
  - New permissions `property-conditions.*`, given to every role that had the matching `locations.*` permission.
  - Typing a new condition in the property form needs `property-conditions.create`, as a new location needs `locations.create`.
- **"Locations" is now "Property locations" everywhere people read it:** the settings menu and page, the property form, the permission names and the activity-log module. The URLs and permission slugs are unchanged.
- **Tests:** `PropertyFormTest`, `PropertyScanTest`, `PropertyConditionSettingsTest`. There is also a real-mouse walk: type a new condition and location, type the number in lower case, save the PNG, open the scan page signed in and signed out.

### 10 · Dashboards

**Mini graphs in the yearly analytics (2026-10-30).** Used on the admin dashboard and RSMI › Yearly analytics (`components/analytics/yearly-issuance-analytics.tsx`). They fill the space beside the 12-row Monthly breakdown with figures that are not already on the page.

- **Top categories › Average cost per item:** total ÷ line items per category.
- **Yearly insights › Spending by month:** 12 columns grouped by quarter, with the busiest month in the accent colour and the strongest quarter named. Hover or focus shows the value; the table beside it has every figure.
- `ChartCard` gained `contentClassName` so a footer can sit at the bottom of the card.

### 11 · Notifications & real-time

**Notification center (2026-10-29).** Ported from PHLGADIS and adapted to SINOP.

- **Storage:** the `notifications` table, one row per recipient (migration `2026_10_31_000000`, new table only).
  - Each row links to the action's `activity_logs` entry, which supplies the actor and the record's name, so no message text is copied.
  - Stock alerts also name their `supply_id`.
  - Kinds (`App\Enums\NotificationKind`): RIS submitted, approved, ready to issue, declined, issued and received; stock low and out; IAR recorded; account requested and activated; property assigned.
- **Writer:** `App\Services\Notifier` is the only one. It picks recipients by permission (`User::scopeWithPermission`), skips inactive users and the actor, and never throws.
  - `RisActivity::record` returns its entry.
  - `ActivityRecorder` is scoped per request and remembers entries per record (`latestFor`), for actions logged by model events.
- **Live updates:** through Berth's Soketi app, using the Pusher protocol (`SKILL.md`).
  - `App\Services\LiveUpdates` sends one `InboxUpdated` signal (`ShouldBroadcastNow`, empty payload) after the response, through `defer()`. No queue worker is needed, and a socket failure can't undo a save.
  - The channel is `App.Models.User.{id}`.
  - Without the secret in `.env`, the broadcaster falls back to `null` and pages check every minute instead.
- **Browser:**
  - `lib/realtime.ts` holds one lazy pusher-js socket per tab (its own chunk).
  - `hooks/use-inbox.ts` refreshes `inbox` and the sidebar badges in one async partial reload, and shows arrival toasts.
  - Header bell: `components/notifications/notification-bell.tsx`.
  - Page: `/notifications`, with All/Unread, search, Type and Module filters, and infinite scroll.
  - Each notification can be marked read or unread, or deleted. Only its owner can touch it; anyone else gets a 404.
- **Removed:** the `RequisitionStatusUpdated` / `UserNotificationUpdated` events, the old `cao-notifications` / `admin-notifications` / `user.{id}` channels, the CDN Pusher hook, and the unused `/api/*initial-counts` endpoints.
- **Retention:** read notices are pruned after 90 days (`model:prune`, daily). Production needs the scheduler.
- **Tests:** `tests/Feature/Notifications/*`.
- **Live lists:** pages call `useLiveProps([...])` so their own lists are reloaded together with the bell: My requests, Received, the requester dashboard, and RIS index and show.

**Requester side split into pages (2026-10-29).** Before, the old single staff dashboard took ~1.5 s, ran 264 queries and sent 184 KB on every visit.

- **Pages:**
  - `staff.dashboard` (also `/user-dashboard` in user mode): personal status tiles, the division's year (requests, items issued per month, most-issued supplies) and the last 8 requested items.
  - `staff.requests` (`/my-requests`), `staff.received` and `staff.properties`, each its own page in the sidebar.
  - Old `?received` / `?properties` / `?status` links redirect to the matching page.
- **Request supply dialog:** its supplies are an `Inertia::optional` prop, loaded when the dialog opens. Pending quantities come from one grouped query instead of one query per stock.
- **Default-password check:** bcrypt, ~0.4 s, now runs once per password per session.
- **User mode:** `requester` middleware lets admin-side users in.
- **Result:** dashboard ~25 ms / 8 queries / 13 KB after the first visit; requests ~85 ms / 4 queries.
- **Tests:** `tests/Feature/StaffPagesTest.php`.

**Request supplies dialog and SSR hydration (2026-10-30).**

- **Supplies prop:** now `supplies`, one slim row per supply: `{supply_id, name, description, stock_no, unit, category, reorder_point, available}`.
  - The "largest available stock row" rule moved from the browser into `StaffDashboardController::requestableSupplies()`.
  - Payload went from ~148 KB to ~39 KB for 228 supplies.
- **Opening:** hovering or focusing "Request supply" loads the list in the background. A click opens at once when the list is loaded, and refreshes it in the background if it's older than 30 s. The spinner shows only on a cold click. Submitting still re-checks stock on the server.
- **Rendering:**
  - Cards are a memoized `SupplyCard` with stable callbacks.
  - 24 cards render first, then 24 more as the list end nears (IntersectionObserver).
  - Category chips (All / Office / Cleaning / Maintenance) combine with the search.
- **Visuals:** `components/staff/supply-visual.tsx`.
  - Icon tile picked from keywords in the item name, falling back to the category icon, tinted by category.
  - `StockTag`: green "N available", amber "Low · N left" at or below the reorder point, red "Out of stock".
- **Hydration (SSR is on):**
  - The appearance toggle renders both icons and swaps them with CSS on `.dark`.
  - `lib/format.ts` dates and times are read in Asia/Manila, so the server and browser output match.
  - The notification `<time>` uses `suppressHydrationWarning`, because relative time depends on "now".
- **Office auto-fill** (`officeOfDivision` in `lib/ris.ts`), in both Request supplies and the admin Manual RIS entry:
  - Office is filled from the division: the part after " - " ("Scholarship Division - UniFAST BARMM" → "UniFAST BARMM"), or the whole name when there is no dash.
  - It stays editable. Typed text is kept when the division changes; a cleared Office follows the division again.

**Messages (2026-10-31), live over Soketi.** Conversations between a requester and the supply office, which answers as a shared inbox. Replaces the static preview.

- **Who:**
  - The new permission `messages.office` ("Answer messages for the supply office") is given to the roles that have `ris.issue` or `ris.approve` (Admin, CAO, Supply officer).
  - People with it see every conversation and answer for the office. Admins in user mode count as requesters.
  - Everyone else sees only their own conversations (`Conversation::scopeVisibleTo`, `ConversationPolicy`).
- **Starting:**
  - Either side can start a conversation, with its first message: about a request (an RIS), a concern (optionally one of the requester's properties), or something else.
  - The office first picks the person.
  - An RIS has one conversation per requester; asking again adds to it.
  - The RIS page has a "Message supply office" / "Message requester" button (`/messages?ris=<key>`).
- **Status:**
  - A requester's message makes the conversation "waiting" (Needs reply).
  - An office reply makes it "open".
  - Either side can mark it resolved or reopen it. This leaves a line in the thread (`messages.side = system`).
- **Unread:** the other side's messages after the last one each person has read (`conversation_reads`). This drives the Messages badge in the header and sidebar (shared prop `messagesUnread`). New messages don't go to the bell.
- **Attachments:**
  - Photos, PDFs and spreadsheets, up to 4 files of 10 MB each.
  - They are stored in `message-attachments/` on the uploads disk.
  - They are served by `MessageController::attachment` only to the people in the conversation, never through `/files`.
- **Thread extras:**
  - The RIS's own history (requested, approved, declined, issued, received) is read from `activity_logs` and shown as lines in the thread.
  - The context pane shows the RIS items, or the property.
- **Live:**
  - `LiveUpdates::messages()` sends `messages` (`{conversation}`) after the response to the requester and the office, minus the sender.
  - `LiveUpdates::typing()` sends `typing` at once, throttled to one every 3 s per person.
  - Both go on the user's private channel.
  - `useInboxUpdates` turns them into window events for the page.
  - Without Soketi, the page catches up with the regular 60 s checks.
- **Code:**
  - Server: `App\Services\Messenger` (the rules), `MessageController` (the page and its JSON).
  - Browser: `components/messages/use-messages.ts`, `message-parts.tsx`, `new-conversation-dialog.tsx`.
  - Tests: `tests/Feature/MessagesTest.php`.
- **Not done:**
  - Starting and resolving conversations are not in the activity log. Messages are not an audited module.
  - Messages can't be edited or deleted.

### 12 · Hardening & release

_Not started._

---

## 7. Open questions for Marvin

1. ~~Is `cims` a live production database?~~ Answered: the old system is live; its exports are the
   source, and `sinop_dev` is the working copy (section 2, rule 6).
2. ~~Where is it deployed?~~ Answered: Hostinger VPS with Coolify; MySQL, S3 and WebSocket from Berth
   (`DEPLOYMENT.md`).
3. Are schema changes allowed (new tables/columns, backfills), or must the old app keep working on
   the same database during the transition?
4. Brand: official name, logo, and colours to use for the UI. Is "SINOP" the final product name?
5. Who uses it and how many: number of admins, CAO, staff; do staff mostly use phones?
6. Fund clusters: is the list always `101` and `151`, or should admins be able to add more?
7. Property condition values: what is the official list (e.g. Serviceable, Unserviceable, For repair)?
8. Should the conversion first be committed as a baseline on `main` (recommended), so every module
   shows up as its own clean diff?

---

## 8. Decision log

| Date       | Decision                                                                        | Reason                                         |
| ---------- | ------------------------------------------------------------------------------- | ---------------------------------------------- |
| 2026-10-29 | Refactor module by module, in the order in section 4                            | Smaller, reviewable changes; dependencies first |
| 2026-10-29 | Schema changes only through additive migrations (expand → backfill → contract) | `cims` holds real data                          |
| 2026-10-29 | Keep non-standard primary key names (`supply_id`, `ris_id`, ...)                | Renaming is high risk for little gain           |
| 2026-10-29 | Printed government forms keep their official layout                             | Compliance                                      |
| 2026-10-29 | SAP Fiori is the only theme for now; a picker may come later                     | Match Marvin's other systems; keep it simple   |
| 2026-10-29 | Users and reference lists live under Settings, URLs unchanged                   | Same admin layout as PHLGADIS; no broken links  |
| 2026-10-30 | Develop on `sinop_dev`, rebuilt from live exports by `sinop:import-legacy`       | Test data never mixes with real data            |
| 2026-10-30 | Uploads on Berth's S3 bucket, private, served through the app at `/files`       | Survives redeploys; access stays with the app   |
| 2026-10-30 | RIS Print removed for now; Excel export is the form                              | Marvin: not needed                              |
| 2026-10-30 | Signers place e-signatures in their own box only; signed RIS keep a frozen copy | Form stays valid; past forms never change (D23) |
| 2026-10-31 | Admins correct transactions in the app (with a reason), never in the database | Stored copies (stock, balances, RIS) stay in step; every fix is logged |
| 2026-10-31 | E-signatures load only for their owner or the RIS's viewers, are never cached, and the copy on an RIS is stamped with its number and date | A screen can always be captured; a stamped copy is no use on another document |
