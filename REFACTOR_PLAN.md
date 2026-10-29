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
| Database | MySQL, database `cims`, 24 app tables, 27 migrations already recorded      |
| Extras   | dompdf, endroid/qr-code, phpspreadsheet, Pusher (optional)                 |

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
| 11 | Notifications & real-time                | Counts API, Pusher events, toasts and sounds                                            | Not started |
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

_Not started._

### 6 · RIS

_Not started._

### 7 · RSMI reports & analytics

_Not started._

### 8 · RPCI

_Not started._

### 9 · Property (PPE)

_Not started._

### 10 · Dashboards

_Not started._

### 11 · Notifications & real-time

_Not started._

### 12 · Hardening & release

_Not started._

---

## 7. Open questions for Marvin

1. Is `cims` a live production database people use today? If yes, is there a staging copy to test
   migrations on?
2. Where is it deployed (shared hosting without SSH, VPS, local office server)? This decides how
   migrations, queues and `storage:link` run.
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
