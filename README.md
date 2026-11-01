# Deploying Docker Images with GHCR + Coolify

**Push to `main` → GitHub Actions builds the image → GHCR stores it → Coolify pulls and runs it.**
Nobody builds images locally. Repos can live under your personal account or the org.

> **Our setup**
>
> - GitHub org: `Commission-on-Higher-Education-XII`
> - Image prefix (lowercase): `ghcr.io/commission-on-higher-education-xii/`
> - Coolify server: `hostinger-vps` (already logged in to GHCR by an org owner)
> - Example: `berth` → `ghcr.io/commission-on-higher-education-xii/berth`

---

## Part 1: One-time setup (per developer)

### 1.1 Join the org

Accept the GitHub invite, or open https://github.com/Commission-on-Higher-Education-XII → **Join**.
You set up builds for **your own systems**. Whoever pushes an image first owns it.

### 1.2 Create a classic token

**Profile picture → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token (classic)**

- **Note:** `ghcr push` · **Expiration:** 90 days · **Scope:** ✅ `write:packages`
- Copy it immediately (shown only once) and save it in a password manager.

> ⚠️ Must be **classic**. Fine-grained tokens don't work with GHCR.

One token covers all your repos. When it expires, make a new one and update each repo's secret.

### 1.3 Add the token to each repo

Repo → **Settings → Secrets and variables → Actions → New repository secret**
(**Repository** secrets, not Environment secrets)

- **Name:** `GHCR_TOKEN` (exact) · **Secret:** your token

---

## Part 2: Add the build workflow (per project)

### 2.1 Create `.github/workflows/docker-image.yml`

Replace `APP-NAME` (lowercase). If your branch is `master`, change `main`.

```yaml
name: Docker Image

on:
  push:
    branches:
      - main
    paths-ignore:          # docs-only changes don't trigger a build
      - 'docs/**'
      - '**/*.md'
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: docker-image-${{ github.ref }}
  cancel-in-progress: false

env:
  IMAGE: ghcr.io/commission-on-higher-education-xii/APP-NAME

jobs:
  build-and-push:
    name: Build and push
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v5

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GHCR_TOKEN }}

      - name: Generate image tags
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.IMAGE }}
          tags: |
            type=raw,value=latest
            type=sha,format=short
            type=raw,value={{date 'YYYY-MM-DD' tz='Asia/Manila'}}-${{ github.run_number }}

      - name: Build and push image
        uses: docker/build-push-action@v6
        with:
          context: .
          platforms: linux/amd64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### 2.2 Know where `.env` values go

The build only sees committed files, so your `.env` is never in it. That's intentional.

| Values                                             | Read when…          | Put them in                     |
| -------------------------------------------------- | ------------------- | ------------------------------- |
| Server: `APP_KEY`, `DB_*`, `AWS_*`, `PUSHER_*`, …  | the app **runs**    | Coolify (Part 3)                |
| Frontend: `VITE_*`                                 | the image **builds** | Not Coolify. See below (`vite-build-env.md`) |

> ✅ Never commit `.env` or copy it into the image.

**Fix the "Laravel" tab title (one-time).** The title comes from `VITE_APP_NAME`, which the build doesn't have. In `resources/js/app.tsx` (and `ssr.tsx` if present), set your own fallback:

```tsx
const appName = import.meta.env.VITE_APP_NAME || 'Your App Name';
```

**Have `VITE_*` values in your `.env` (e.g. websockets)?** They won't reach the build on their own, and don't hardcode them in the Dockerfile. Download [`vite-build-env.md`](https://github.com/Commission-on-Higher-Education-XII/.github-private/blob/main/vite-build-env.md) (click **Download raw file**), save it in your project's root, then tag it in Claude (`@vite-build-env.md`) and say "set up websockets for the build". Claude asks for the values, wires them into the build, and saves the repo secret for you.

### 2.3 Push and check

1. Commit and push to `main`.
2. Repo → **Actions → Docker Image** → wait for the green check (first build is slow).
3. Org → **Packages** → your image should have three tags:
    - `latest`: newest build
    - `sha-abc1234`: source commit
    - `2026-10-18-5`: date + run number (use for rollbacks)

Rebuild without code changes: **Actions → Docker Image → Run workflow**.

---

## Part 3: Set up the app in Coolify

### 3.1 Create the app (don't deploy yet)

**Projects → your project → environment → + New → Docker Image**

- **Image:** `ghcr.io/commission-on-higher-education-xii/APP-NAME`
- **Tag:** `latest` · **Server:** `hostinger-vps`

Save, but **don't Deploy** yet. It will crash without its credentials.

### 3.2 Copy credentials from Berth

Open [berth.chedro12.com](http://berth.chedro12.com), select or create your system, and copy its `.env` block, **skipping any `VITE_*` lines** (Coolify can't use them; see 2.2). It looks like:

```bash
DB_CONNECTION=mysql
DB_HOST=w7ooxhztpjvxuhkyo5hitsuu
DB_PORT=3306
DB_DATABASE=sys_dtr
DB_USERNAME=sys_dtr
DB_PASSWORD=••••••••••••

FILESYSTEM_DISK=s3
AWS_ACCESS_KEY_ID=GK••••••••••••
AWS_SECRET_ACCESS_KEY=••••••••••••
AWS_DEFAULT_REGION=garage
AWS_BUCKET=dtr
AWS_ENDPOINT=https://s3-abvdbao3y7o1isc4uofcdqa0.179.197.242.43.sslip.io
AWS_USE_PATH_STYLE_ENDPOINT=true

BROADCAST_CONNECTION=pusher
PUSHER_APP_ID=dtr
PUSHER_APP_KEY=••••••••••••
PUSHER_APP_SECRET=••••••••••••
PUSHER_HOST=soketi-fdfdku5xx7cujur1tuh5z11m
PUSHER_PORT=6001
PUSHER_SCHEME=http
PUSHER_APP_CLUSTER=mt1
```

- `DB_*`: MySQL. `DB_HOST` is an internal container name, so it only works inside Coolify.
- `AWS_*`: Garage S3 uploads. Keep `AWS_USE_PATH_STYLE_ENDPOINT=true`.
- `PUSHER_*`: server → Soketi, internal (`6001`, `http`).

> 🔒 Live secrets. Paste them only into Coolify, never into chat, screenshots, Git, or this page.

### 3.3 Paste into Environment Variables

App → **Environment Variables → Developer view**. Paste the Berth block, then add:

```bash
APP_NAME="Your App Name"
APP_ENV=production
APP_DEBUG=false
APP_KEY=base64:YOUR-APP-KEY            # existing key, or: php artisan key:generate --show
APP_URL=https://your-app-domain.chedro12.com   # must match the domain in 3.4
```

**Save All Environment Variables**, then check **Normal view** for stray quotes or spaces.

### 3.4 Set port and domain

App → **General**:

- **Ports Exposes:** the container's listening port (e.g. `8080`)
- **Domains:** full URL with `https://` (SSL is automatic)

Save.

### 3.5 Deploy and verify

1. **Deploy** → watch **Deployment Logs** until **Running (healthy)**.
2. First deploy only: **Terminal** → app container → `php artisan migrate --force`
3. Check the site:
    - Login works → database OK
    - Test upload works → S3 OK
    - Live updates without refresh → Soketi OK

If something fails, check **Logs**. It's usually a typo or missing variable from 3.3.

### Moving an app from Docker Hub

App → **General → Container image** → change **Image** to the GHCR name → keep `latest` (or a date tag) → Save → **Deploy**.
To undo, restore the old image name and deploy.

---

## Part 4: Everyday release

1. Push to `main`.
2. Wait for the green check in **Actions**.
3. Coolify → app → **Deploy** → check logs and the live site.

**Rollback:** set **Tag** to an older date tag from **Packages** (e.g. `2026-10-17-4`) → **Deploy**. Switch back to `latest` once fixed.

---

## Troubleshooting

| Problem                                                    | Cause                                               | Fix                                                                                      |
| ---------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Workflow didn't run                                        | Wrong branch, or only `docs/` / `.md` changed       | Check branch in 2.1, or **Run workflow** manually                                        |
| `Username and password required` (Log in to GHCR)          | `GHCR_TOKEN` missing or misnamed                    | Add it as a **repository** secret (1.3)                                                  |
| `unauthorized` (Log in to GHCR)                            | Token expired or deleted                            | New token (1.2), update each repo (1.3)                                                  |
| `denied: permission_denied` (Build and push)               | No `write:packages`, or someone else owns the image | Check scopes. To share, the owner adds you in **Package settings → Manage access**       |
| `repository name must be lowercase`                        | Uppercase in `IMAGE`                                | Use lowercase                                                                            |
| Coolify: `unauthorized` / `pull access denied`             | Server's GHCR login expired                         | **Registries → Log in on multiple servers** with an org owner's `read:packages` token    |
| Coolify: `manifest unknown` / `not found`                  | Wrong image name or tag                             | Compare with the **Packages** tab                                                        |
| Site still shows the old version                           | Deployed before the build finished                  | Wait for the green check, deploy again                                                   |
| Tab title says "Laravel"                                   | No `VITE_APP_NAME` at build time                    | Change the fallback in `app.tsx` (2.2)                                                   |

---

## Costs

- GHCR storage and bandwidth are **currently free** for our Free org (GitHub promises a month's notice before changes).
- Actions is free for public repos. Private repos get a monthly minutes allowance, which is enough for normal use.
- Delete old tags now and then.
