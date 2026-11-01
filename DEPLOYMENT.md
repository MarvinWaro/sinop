# SINOP: data, files and going live

How SINOP's data and uploaded files are set up, and the steps to go live on the Hostinger VPS (Coolify, services from Berth).
The module-by-module work is in `REFACTOR_PLAN.md`. This file is the one to read before deploying.

**Status on 2026-10-30**

- Data foundation is done. Development runs on `sinop_dev`, built from the live system's Oct 28 export.
- Uploaded files go to Berth's S3 bucket (checked against the real bucket, including the copy made when signing).
- Ready for an alpha deploy: every library the code uses is installed, and every page opens without a server error for admin, CAO and staff on `sinop_dev`.
  The config, route and view caches build. Section 6 lists what is known and still open.
- Normalization batch 1 is waiting for Marvin's go-ahead.

---

## 1. Databases

| Database                   | What it is                                                 | Use it for                                                      |
| -------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------- |
| Old live system            | Still in use by the office                                 | Its phpMyAdmin exports are the only clean copy of the real data |
| `sinop_dev` (local)        | Built from `OneDrive\Documents\cims.sql` (Oct 28 export)   | Development and clicking around. `.env` points here             |
| `cims` (local)             | The first import; holds browser-test RIS (2026-10-001…004) | Nothing. It can be dropped                                      |
| `sys_sinop` (Berth, MySQL) | The production database                                    | Filled only at go-live, by the import command                   |
| SQLite in memory           | Automated tests (`phpunit.xml`)                            | `php artisan test`. Never touches MySQL                         |

**Commands**

```
# Rebuild sinop_dev from an export (about 6 s). This is the "start over" button.
php artisan sinop:import-legacy "C:\Users\Marvin Waro\OneDrive\Documents\cims.sql" --database=sinop_dev --replace --force

# Count the data problems (read-only)
php artisan sinop:audit-data
```

The import runs the export as it is, then `migrate` adds only the new tables (roles, activity log, notifications, settings),
then it checks every table's row count against the export and runs the audit.

**Rules**

- Never run `migrate:fresh`, `migrate:reset` or `db:wipe` on a database with real data.
- Never import an export into tables made by `migrate:fresh`. Accounts end up without roles. Use the import command.
- `php artisan migrate:fresh --seed` gives an empty system with one Administrator (`admin@gmail.com`, password `password`; the seeder skips it in production).
  Only use it to test an empty install, and in its own database (`sinop_fresh`), never `sinop_dev`: switch `DB_DATABASE` in `.env`.

**Audit baseline** (Oct 28 export): 147 RIS numbers on several slips, 1,316 issue lines without a fund cluster,
186 stock rows with a wrong total cost, 931 manual RIS missing from "Received supplies",
8 RIS whose issued quantity differs from the ledger. Everything else is 0.
These come from the old system. The normalization batches fix them (`REFACTOR_PLAN.md` section 3, D18–D25).

---

## 2. Uploaded files (S3)

**What:** e-signatures (`signatures/` saved ones, `ris-signatures/` the frozen copies on signed RIS), profile photos, property images,
and files sent in Messages (`message-attachments/`). PDFs and other files will go to the same place later.

**Where:** Berth › system `sinop` › **S3** tab (Garage). Bucket `sinop`, private.

**How the browser gets them:** from `/files/<path>`, through the app, for signed-in users only.
Message attachments are the exception: they come from `/messages/attachments/<id>`, only for the people in that conversation.
E-signatures are personal: a saved one loads only for its owner, and one on an RIS only for people who may open that RIS
(older slips, signed before copies were frozen, load the signer's signature through `/ris/<key>/signatures/<step>`).
File names are unique per upload, so the browser keeps them (no repeat downloads), except signatures, which are never cached.
Signing an RIS stamps the RIS number and date faintly across the frozen copy. That needs PHP GD with FreeType
(`gd_info()['FreeType Support']`); without it the copy is saved unstamped.
The database still stores the same short paths as before (`signatures/abc.png`).

| Setting                                                                                                        | Local (`.env`)                                       | Production (Coolify) |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------- |
| `UPLOADS_DISK`                                                                                                 | `s3` (or `public` to work without the bucket)        | `s3`                 |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`                                                                   | From Berth's S3 tab. The secret is filled in by hand | Same                 |
| `AWS_DEFAULT_REGION`                                                                                           | `garage`                                             | `garage`             |
| `AWS_BUCKET`                                                                                                   | `sinop`                                              | `sinop`              |
| `AWS_ENDPOINT`                                                                                                 | Berth's S3 endpoint (`https://s3-….sslip.io`)        | Same                 |
| `AWS_USE_PATH_STYLE_ENDPOINT`                                                                                  | `true`                                               | `true`               |
| **One folder per environment.** Inside the bucket, each environment has its own folder, named after `APP_ENV`: |

```
sinop/
├── local/        ← your laptop (APP_ENV=local): test uploads, safe to delete any time
└── production/   ← the server (APP_ENV=production): the live files
```

Nothing has to be set for this. The folder name follows `APP_ENV`, so a laptop can't write into `production/` by mistake,
even though `sinop_dev` has the same users and paths as the live data. `AWS_ROOT=name` overrides the folder name.
To clear your test uploads, delete the `local/` folder in Berth's S3 › **Browse**.

**Copy existing files to the bucket**

```
php artisan sinop:copy-uploads                    # this app's storage/app/public
php artisan sinop:copy-uploads /path/to/public    # e.g. the old server's storage/app/public
```

It copies `signatures/`, `ris-signatures/`, `profile-photos/` and `property_images/`, skips files already there, and then lists any file
the database points to that is still missing. Safe to run again.

**Old signatures with a paper background** (white boxes on the form, black boxes in dark mode):

```
php artisan sinop:clean-signatures
```

It makes the background transparent and trims each saved signature (new file name, old file deleted).
Signatures that are already transparent are skipped, so it is safe to run again.

**Code:** `App\Support\Uploads` (disk, URL, local copy for Excel exports), `UploadController` (the `/files` route),
`config/filesystems.php` (`uploads`, and the `s3` disk settings for Garage).

**Not on S3 yet:** property QR images. They are a cache in `storage/app/public/qrcodes` and are rebuilt when missing.
Module 9 (Property) moves or replaces them.

---

## 3. Berth services for `sinop`

| Tab       | Used for                                 | Notes                                                                                                                  |
| --------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| MySQL     | Production database `sys_sinop`          | The host is an internal container name, so it only works on the VPS. From a laptop, use the Tailscale host (TablePlus) |
| S3        | Uploaded files                           | Section 2                                                                                                              |
| WebSocket | Live notifications and Messages (Soketi) | `SKILL.md`. Locally the backend uses the public host                                                                   |
| Redis     | Not used                                 |                                                                                                                        |

Secrets (database password, S3 secret, Pusher secret) live only in `.env` and in Coolify. They never go into git.
Only `PUSHER_APP_KEY` reaches the browser.

---

## 4. Coolify app setup (once)

**Environment variables**

- `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL=https://<the app's domain>`
  (the property stickers' QR codes link to `APP_URL/p/<property no.>`, so set it before printing stickers)
- `APP_KEY`: a new one (`php artisan key:generate --show`). Passwords don't depend on it and nobody uses two-factor, so every old login keeps working.
- `APP_TIMEZONE=UTC`. The old system stored UTC: its transactions cluster at 00:00–09:00, which is 8 AM–5 PM in Manila.
  Keep it, so new rows match the imported ones. The screens show times in Manila time.
- `DB_CONNECTION=mysql` and the `DB_*` values from Berth's MySQL tab (`DB_DATABASE=sys_sinop`).
- `UPLOADS_DISK=s3` and the `AWS_*` values from section 2. With `APP_ENV=production`, files go to `production/` in the bucket.
- `BROADCAST_CONNECTION=pusher` and the `PUSHER_*` values (internal host). The five `VITE_PUSHER_*` values are marked **Build Variable**.

**Commands**

- Post-deployment: `php artisan migrate --force`. It only adds new migrations, so it is safe on every deploy.
  Never put `migrate:fresh` or `db:seed` there.
- Build: `npm run build` (not `build:ssr`). Without an SSR bundle Inertia renders in the browser, so no Node process is needed.
- Start: `php artisan storage:link` (property QR images are still served from `/storage`).
- Optional, for speed: `php artisan optimize` after each deploy (config, route and view caches; all three build).
- Scheduled task, every minute: `php artisan schedule:run`. Needed for the daily clean-up of read notifications.
- No queue worker is needed today. Live updates are sent right after each response.

---

## 5. Going live

### Rehearsal (while the old system is still in use)

1. Deploy the app on Coolify.
2. Export the old system's database from phpMyAdmin, the same way as `cims.sql`.
3. Copy it to the VPS and into the app container (`scp`, then `docker cp`).
4. In the container's terminal (Coolify):
    ```
    php artisan sinop:import-legacy /tmp/cims.sql --database=sys_sinop --replace --force
    ```
    If the first deploy already made empty tables, `--replace` rebuilds the database anyway.
5. Copy the old server's `storage/app/public` folder into the container, then:
    ```
    php artisan sinop:copy-uploads /tmp/old-public
    php artisan sinop:clean-signatures
    ```
6. Log in as admin, CAO and staff. Compare a few RIS, stock cards and reports with the old system.

Berth's server is MySQL and the old one is MariaDB 10.11. The rehearsal is where any difference between them shows up.
The import drops and recreates `sys_sinop`. The database user should have the rights for that. If it says "access denied", ask the Berth admin.
Anything typed into the rehearsal copy is replaced at go-live.

### Go-live day

1. Tell users to stop using the old system (maintenance mode), so nothing is typed after the export.
2. Export the database again.
3. Run the same import (step 4 above) with the new export.
4. Run `sinop:copy-uploads` again with the old server's latest `storage/app/public`, then `sinop:clean-signatures`.
5. Check:
    - every table's row count matches;
    - "Accounts without a role" is 0;
    - `copy-uploads` says every file the database points to is on the disk;
    - `php artisan sinop:audit-data` gives the same kind of numbers as the rehearsal.
6. Smoke test as admin, CAO and staff, then give users the new link.

---

## 6. Open before go-live

- **Libraries:** done (2026-10-30).
    - `phpoffice/phpspreadsheet`, `barryvdh/laravel-dompdf` and `endroid/qr-code` are installed.
    - `symfony/mime` is patched (CVE-2026-45070).
- **RIS date before 8 AM.** `ris_date` is today's date in UTC, so a request made between midnight and 8 AM Manila time gets the previous day's date.
  This is the same as the old system. Fix it with the RIS module, since it needs a decision on old rows.
- **Password reset by email.** `MAIL_MAILER=log`, so "Forgot password" mails go nowhere. For the alpha, an admin resets passwords from Users.
  Set up mail later if self-service is wanted.
- **Issuing lock.** Requests are first come, first served. Issuing (`RisSlipController::issue()`) has no lock yet.
- **Normalization batches 1–6** (`REFACTOR_PLAN.md` section 3). Batch 1, "protect records", changes no report numbers.
- **S3 secret.** Put it in `.env`, then run `php artisan config:clear`. Copying the old local files into `local/` is optional (they are test files).
