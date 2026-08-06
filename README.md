# Savitri Foundation — Kannada Community Platform

Savitri Foundation is a production-oriented community platform for Kannada events, competitions, photo submissions, ₹2 PhonePe votes, live leaderboards, and immutable winner reveals. The public experience includes the supplied Claude Design-inspired Three.js scrollytelling homepage; the operational side is a protected single-admin dashboard.

This README is the complete setup and deployment handoff. Follow it in order before accepting submissions or payments.

> **Important:** The app deliberately renders read-only showcase content when `DATABASE_URL` is not configured. That is useful for reviewing the UI, but it is **not** a live system: it cannot accept real submissions, process payments, or persist admin changes.

## Contents

- [What is included](#what-is-included)
- [Prerequisites](#prerequisites)
- [Fast local UI preview](#fast-local-ui-preview)
- [Configure a real local environment](#configure-a-real-local-environment)
- [Environment variables](#environment-variables)
- [Provision cloud services](#provision-cloud-services)
- [Initialize the database](#initialize-the-database)
- [Admin access and content operations](#admin-access-and-content-operations)
- [PhonePe sandbox configuration](#phonepe-sandbox-configuration)
- [Testing and security checks](#testing-and-security-checks)
- [Vercel deployment and production launch](#vercel-deployment-and-production-launch)
- [Operations, troubleshooting, and rollback](#operations-troubleshooting-and-rollback)

## What is included

### Public experience

- A four-chapter, 520vh Three.js home experience with the Claude Design palette, glass treatment, Kannada decorative glyphs, scroll transitions, reduced-motion support, and WebGL fallback.
- Events, competition details, submissions, public leaderboards, legal/support pages, loading/error/404 states, and responsive navigation.
- Photo-entry form: name, Indian mobile number, email, description, and JPEG/PNG/WebP photo.
- A ₹2-per-vote PhonePe Standard Checkout flow. Each checkout creates exactly one vote; the browser cannot set an amount or quantity.
- Five-second live leaderboard polling while a competition is active.

### Admin and data protection

- One server-side bcrypt-protected admin identity, with an eight-hour secure HTTP-only session.
- Event and competition creation, editing, archiving, entry moderation, safe deletion of unpaid entries, payment review, and winner completion.
- IST (`Asia/Kolkata`) inputs stored as UTC; overlapping events and competitions are supported. A competition must remain within its parent event.
- PII encryption at rest (AES-256-GCM), non-reversible lookup hashes, origin checks, upload validation, rate limits, audit records, and public DTOs that omit phone/email data.
- Images are auto-rotated, metadata-stripped, limited to 4 MB at upload, resized to a maximum 2048px, re-encoded as WebP, then stored in Vercel Blob.
- PostgreSQL/Drizzle transactions and locks prevent duplicate entry-limit bypasses and duplicate payment crediting.

### Payment and finalization behaviour

- A vote is credited only after PhonePe reports `COMPLETED` through a verified callback or a verified server-side status check. Closing an iframe is not proof of payment.
- One unresolved order is allowed per voter mobile number at a time. After it settles, the voter may cast another single ₹2 vote.
- Durable Vercel Workflows reconcile pending payments and refund status.
- Completing a competition first moves it to `CLOSING`, settles pending orders, then transactionally snapshots the top three. Late successes after the snapshot are refunded instead of changing the podium.
- Ties rank by vote total, then by who reached that tied total first, then by submission time.

## Prerequisites

Use the following before doing any configuration:

- Node.js **20.9+** (Node 20 LTS is recommended).
- pnpm **10**. Corepack is the simplest way to install the pinned package-manager version.
- A Vercel account and a Git repository containing this project.
- A Neon PostgreSQL database, Vercel Blob store, and Upstash Redis database. Vercel Marketplace provisioning is convenient but not required.
- A PhonePe Payment Gateway V2 merchant account with **sandbox/UAT** credentials. Production credentials and launch approval come later.
- A real organization name, address, support email, support phone number, legal review, and a public HTTPS domain before production payments.

On Windows PowerShell, verify the tools:

```powershell
node --version
corepack enable
corepack prepare pnpm@10 --activate
pnpm --version
```

Clone or open the project, then install its exact locked dependencies:

```powershell
pnpm install --frozen-lockfile
```

Do not commit `.env.local`, exported Vercel environment files, merchant credentials, or generated secrets. `.gitignore` already excludes `.env*`.

## Fast local UI preview

This is the fastest way to inspect the home page and all showcase content. No cloud account or secrets are required.

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

In this mode:

- Public routes show the read-only showcase dataset.
- `/admin/login` accepts the development-only fallback `admin@savitrifoundation.in` / `savitri-demo` **only when no bcrypt hash is configured and `NODE_ENV` is not production**.
- Admin mutations, real photo uploads, and PhonePe orders are intentionally unavailable without the managed-service configuration below.

Never deploy with that fallback. The production runtime requires `AUTH_SECRET` and the PII encryption key when their protected features run; production admin login also rejects the demo fallback.

## Configure a real local environment

### 1. Create the environment file

Copy the tracked template. In PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Fill in every value described in [Environment variables](#environment-variables). At a minimum, a working real-data environment needs:

- `DATABASE_URL`
- `BLOB_READ_WRITE_TOKEN`
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `AUTH_SECRET`, and `PII_ENCRYPTION_KEY`
- `APP_URL=http://localhost:3000` for ordinary local UI work, or a public HTTPS URL for PhonePe testing
- all PhonePe values before trying a real sandbox checkout

### 2. Generate the admin password hash

Choose a long, unique password; do not put the plain-text password in any environment file. This command prints a bcrypt hash that belongs in `ADMIN_PASSWORD_HASH`:

```powershell
pnpm admin:hash -- "replace-this-with-a-long-unique-password"
```

Set `ADMIN_EMAIL` to the corresponding admin email address. This version supports one admin identity only.

### 3. Generate independent application secrets

Run this command **twice**. Put the first output in `AUTH_SECRET` and the second in `PII_ENCRYPTION_KEY`.

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Keep both values stable after data exists:

- Rotating `AUTH_SECRET` signs every current admin out.
- Replacing `PII_ENCRYPTION_KEY` makes existing encrypted participant/voter PII unreadable and changes future identity hashes. Treat a PII-key rotation as a planned data migration, not an edit.

### 4. Check the configured build

After the cloud service values are present, run:

```powershell
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The seeded content is deliberately marked as showcase/read-only. It provides visual sample events, competitions, entries, and presentation-only vote counts; it accepts no payments or submissions and is excluded from real revenue reporting.

## Environment variables

Start from [.env.example](./.env.example). All secret values are server-only: do **not** prefix any of them with `NEXT_PUBLIC_`.

| Variable | Required when | What to enter |
| --- | --- | --- |
| `DATABASE_URL` | Real data/admin mutations | Neon PostgreSQL connection string. Use the pooled/serverless URL supplied by Neon. |
| `BLOB_READ_WRITE_TOKEN` | Real photo uploads | Read/write token from the Vercel Blob store connected to this project. |
| `UPSTASH_REDIS_REST_URL` | Production | REST URL for the Upstash Redis database. |
| `UPSTASH_REDIS_REST_TOKEN` | Production | REST token for that Upstash database. Without it, rate limits are permissive for local development only. |
| `ADMIN_EMAIL` | Production | The one admin email address, for example `admin@yourdomain.in`. |
| `ADMIN_PASSWORD_HASH` | Production | Bcrypt output from `pnpm admin:hash`; never the original password. |
| `AUTH_SECRET` | Production | Independent 32-byte random base64 value used to sign admin sessions. |
| `PII_ENCRYPTION_KEY` | Production | Independent 32-byte random base64 value used to encrypt PII and derive identity hashes. |
| `APP_URL` | Metadata, checkout redirects, webhooks | Exact canonical origin, for example `https://savitri.example.in`, without a trailing path. Use `http://localhost:3000` only for non-PhonePe local work. |
| `PHONEPE_ENV` | PhonePe | `SANDBOX` until merchant UAT and production approval are complete; then `PRODUCTION`. |
| `PHONEPE_MERCHANT_ID` | PhonePe | Merchant ID supplied by PhonePe for the selected environment. |
| `PHONEPE_CLIENT_ID` | PhonePe | Client ID supplied by PhonePe. |
| `PHONEPE_CLIENT_SECRET` | PhonePe | Client secret supplied by PhonePe. |
| `PHONEPE_CLIENT_VERSION` | PhonePe | Client/API version supplied by PhonePe (the template defaults to `1`). |
| `PHONEPE_WEBHOOK_USERNAME` | PhonePe | Callback basic-auth username configured in PhonePe. |
| `PHONEPE_WEBHOOK_PASSWORD` | PhonePe | Callback basic-auth password configured in PhonePe. |
| `LEGAL_BUSINESS_NAME` | Production | Registered organization/business name shown on legal and support pages. |
| `LEGAL_ADDRESS` | Production | Complete registered business address. |
| `SUPPORT_EMAIL` | Production | Monitored customer-support email address. |
| `SUPPORT_PHONE` | Production | Monitored customer-support phone number, ideally in `+91…` form. |

Example **shape only**—do not copy literal placeholders into a live deployment:

```dotenv
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxx
UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxxxxxxxx

ADMIN_EMAIL=admin@yourdomain.in
ADMIN_PASSWORD_HASH=$2b$...
AUTH_SECRET=first-random-base64-value
PII_ENCRYPTION_KEY=second-random-base64-value
APP_URL=https://savitri.yourdomain.in

PHONEPE_ENV=SANDBOX
PHONEPE_MERCHANT_ID=your-sandbox-merchant-id
PHONEPE_CLIENT_ID=your-sandbox-client-id
PHONEPE_CLIENT_SECRET=your-sandbox-client-secret
PHONEPE_CLIENT_VERSION=1
PHONEPE_WEBHOOK_USERNAME=your-webhook-username
PHONEPE_WEBHOOK_PASSWORD=your-webhook-password

LEGAL_BUSINESS_NAME=Your Registered Organization
LEGAL_ADDRESS=Your complete registered address
SUPPORT_EMAIL=support@yourdomain.in
SUPPORT_PHONE=+919999999999
```

## Provision cloud services

Keep Development, Preview, and Production isolated. Preview must use its own database branch and sandbox PhonePe credentials; it must never point at the production database or production merchant account.

### 1. Link the Vercel project

Install the Vercel CLI and link the repository once:

```powershell
npm install --global vercel
vercel login
vercel link
```

In the Vercel dashboard, create a project from this Git repository. Vercel detects Next.js automatically. The application already includes the Vercel Workflow integration in `next.config.ts`; no custom build command is required.

Add every value from the environment-variable table in **Project → Settings → Environment Variables**. Add each to the appropriate environment scope:

| Vercel scope | Recommended configuration |
| --- | --- |
| Development | Local/Development Neon branch, Blob/Upstash development resources, sandbox PhonePe, local or tunnel `APP_URL`. |
| Preview | Separate Neon preview branch, preview Blob/Upstash resources if available, sandbox PhonePe, preview URL as `APP_URL`. |
| Production | Production Neon database, production Blob/Upstash resources, production PhonePe only after approval, canonical HTTPS domain as `APP_URL`. |

Pull Vercel's development values into your ignored local file whenever they change:

```powershell
vercel env pull .env.local --yes
```

That command overwrites `.env.local`. Keep local-only temporary overrides elsewhere or re-add them afterward.

### 2. Provision Neon PostgreSQL

1. Create a Neon project/database in the Vercel Marketplace or at Neon.
2. Create separate branches/databases for development, preview, and production.
3. Copy the correct connection string into `DATABASE_URL` for each environment.
4. Keep SSL enabled; use the pooled/serverless connection string where Neon provides one.
5. Do not reuse the production URL in local `.env.local` just for convenience.

The schema and migration history are in [`db/schema.ts`](./db/schema.ts) and [`drizzle/`](./drizzle). The app creates its Neon client lazily at runtime, so a build can succeed without opening a database connection; mutations still require `DATABASE_URL`.

### 3. Provision Vercel Blob

1. In the Vercel project, open **Storage → Blob** and create/connect a Blob store.
2. Copy the store's read/write token to `BLOB_READ_WRITE_TOKEN` in every environment that accepts real uploads.
3. Confirm the token belongs to the same Vercel project/environment.

The upload API accepts only JPEG, PNG, or WebP under 4 MB, then runs Sharp sanitization before writing a public WebP object. Blob URLs are allowed in the Next image configuration.

### 4. Provision Upstash Redis

1. Create an Upstash Redis database (Vercel Marketplace or Upstash).
2. Copy its REST URL and REST token to the matching Vercel environment.
3. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` locally as well when testing limits.

Redis applies sliding-window limits to login attempts, submissions, vote orders by IP, and vote orders by normalized phone hash. Its absence is intentionally tolerated for non-production UI work, but it must be configured before launch.

### 5. Vercel Blob, Neon, and Redis verification

After adding values, pull them and run:

```powershell
vercel env pull .env.local --yes
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Then sign in and create one non-showcase event/competition. Add a JPEG/PNG/WebP entry under 4 MB and verify it appears on the public competition page. This proves database, Blob, encryption, and validation are connected before payments are introduced.

## Initialize the database

### Development database

With `DATABASE_URL` in `.env.local`, apply committed migrations and seed idempotently:

```powershell
pnpm db:migrate
pnpm db:seed
```

Useful Drizzle commands:

```powershell
pnpm db:generate   # generate a migration after a deliberate schema change
pnpm db:migrate    # apply committed migrations using .env.local
pnpm db:seed       # add showcase data; safe to rerun
```

Do not run `db:generate` during ordinary setup. It is for future schema changes that you review and commit with their generated migration.

### Production database

Use a short-lived, ignored production environment file rather than copying a production URL into your day-to-day `.env.local`:

```powershell
vercel env pull .env.production.local --environment=production --yes
pnpm exec dotenv -e .env.production.local -- drizzle-kit migrate
Remove-Item .env.production.local
```

Run this once for every release that contains a new committed migration, **before** promoting the application that depends on it. Take a Neon branch/backup first and run the same migration on a preview database before production.

The showcase seed is optional in production. If you want the supplied reference content visible there, run it exactly once after migrations with the intended production environment file:

```powershell
pnpm exec dotenv -e .env.production.local -- tsx scripts/seed.ts
```

It remains read-only and does not affect live payment/revenue data.

## Admin access and content operations

1. Start the app and open `/admin/login`.
2. Sign in with `ADMIN_EMAIL` and the original password used to make `ADMIN_PASSWORD_HASH`.
3. Create a real event in **Admin → Events**.
4. Create a real competition in **Admin → Competitions** and select its parent event.
5. Create only dates that sit inside the parent event. Every date input is interpreted as IST and rendered to the public in IST.
6. Set the per-participant entry limit. Leave it blank for unlimited; otherwise choose a positive number from 1 to 100. The limit is enforced if either normalized phone **or** normalized email reaches the limit.
7. Test a public entry, hide/restore it from **Admin → Submissions**, and check that phone/email data appear only inside authenticated admin surfaces.

Operational rules to understand before launch:

- Events and competitions may overlap freely.
- Submissions and newly initiated payments stop immediately after a competition end time, even if the winners have not yet been revealed.
- Showcase records remain visibly read-only and cannot be edited, paid for, or submitted to.
- A paid entry cannot simply be deleted. Disqualifying it starts an audited refund workflow; an entry with no payment history may be deleted.
- **Close & Reveal Winners** puts the competition into `CLOSING`, blocks new activity, reconciles outstanding payments/refunds, and only then makes the podium immutable. Monitor Admin → Payments/Leaderboard until it reaches a terminal state.

## PhonePe sandbox configuration

PhonePe is the last service to turn on. Do not enter production credentials or advertise paid voting until PhonePe explicitly approves the merchant and the repeat paid-voting use case.

### 1. Obtain sandbox/UAT values

In the PhonePe merchant dashboard/support process, obtain sandbox values for:

- Merchant ID
- Client ID
- Client secret
- Client/API version
- Webhook username and password

Set those in your local/Preview `PHONEPE_*` variables and set:

```dotenv
PHONEPE_ENV=SANDBOX
```

This app uses the official `@phonepe-pg/pg-sdk-node` Standard Checkout SDK. The front end loads PhonePe's checkout bundle and invokes its recommended `IFRAME` PayPage with the server-provided checkout token URL. If that library is unavailable, it falls back to the PhonePe redirect URL.

### 2. Provide a public HTTPS URL

PhonePe cannot call `http://localhost:3000`. Use either:

- a Vercel Preview deployment, or
- an approved HTTPS tunnel for temporary local sandbox testing.

Set `APP_URL` to the exact public origin exposed to PhonePe, for example:

```dotenv
APP_URL=https://savitri-preview-your-team.vercel.app
```

Do not use a different origin in the Vercel variable and the PhonePe configuration. The app derives its checkout redirect from `APP_URL`.

### 3. Configure the callback

In PhonePe, configure the HTTPS callback URL:

```text
https://YOUR-PUBLIC-DOMAIN/api/webhooks/phonepe
```

Configure the callback basic-auth credentials to exactly match `PHONEPE_WEBHOOK_USERNAME` and `PHONEPE_WEBHOOK_PASSWORD`. Enable payment-completed/payment-failed events and refund status events available for your PhonePe PG V2 account. PhonePe's callback must reach this endpoint without an interactive login, IP allowlist block, or redirect.

The endpoint validates callback authentication, the local merchant order, PhonePe order ID, merchant ID, amount (fixed at 200 paise), and state before updating a vote. It responds quickly and treats duplicate callbacks as harmless.

### 4. Verify the complete sandbox flow

Use a real, non-showcase competition that is live. Test each case separately:

1. Successful ₹2 checkout: the order becomes `COMPLETED`, then exactly one vote appears.
2. User cancels/closes checkout: no vote is added.
3. Payment failure: no vote is added and the user can try again after the order settles.
4. Pending order that later succeeds: the server-side reconciliation credits it once.
5. Pending order that later fails/expires: no vote is added and a new order becomes possible.
6. Deliver the same successful callback twice: vote count must increase once only.
7. Delay or omit a callback temporarily: status reconciliation should eventually reach the correct terminal state.
8. Disqualify an entry with paid votes: orders move into refund processing and are shown in Admin → Payments.
9. Close a competition with a pending payment: wait for the finalization workflow; verify the podium is locked only after settlement or explicitly flagged for review.

The customer browser polls a sanitized status endpoint after checkout. The callback and Vercel Workflow remain the source of truth, so do not manually alter vote totals in the database.

### 5. Inspect workflow health

Vercel Workflows are already enabled by `withWorkflow()` in [`next.config.ts`](./next.config.ts). A successful build reports two workflow bundles. On a linked environment, these commands help inspect the durable reconciliation/finalization runs:

```powershell
pnpm exec workflow health
pnpm exec workflow inspect runs
pnpm exec workflow web
```

`workflow dev` is currently marked “coming soon” by the installed CLI, so use the normal Next development server plus a Vercel preview for realistic end-to-end payment testing.

## Testing and security checks

Run all automated checks before a preview or production deployment:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

`pnpm test:e2e` starts/reuses `http://localhost:3000` and executes desktop/mobile public and scrollytelling checks. If port 3000 is already occupied by an unrelated app, stop it or run the Savitri Foundation dev server first.

The expected quality gate is:

- Lint and TypeScript checks pass.
- Domain tests pass (time/status, normalization, entry limits, ranking/winner logic).
- Playwright passes on desktop and mobile without browser console errors.
- Production build succeeds and reports the workflow build completion.
- A real preview validates database writes, image sanitization, webhook delivery, PhonePe sandbox flow, and admin access.

### Manual privacy/security review

Before production, explicitly verify all of the following:

- View public event, competition, leaderboard pages and API responses in a browser/network inspector. Participant email/phone and voter name/phone must not be present in public HTML or JSON.
- Confirm the correct `APP_URL` and HTTPS custom domain in production.
- Confirm all secrets are server-side Vercel variables and that no `NEXT_PUBLIC_` variable contains a secret.
- Confirm the production admin account has a strong bcrypt hash, a unique `AUTH_SECRET`, and a unique 32-byte `PII_ENCRYPTION_KEY`.
- Confirm Upstash limits are active and do not reject legitimate test traffic unexpectedly.
- Confirm the Vercel deployment has the security headers configured by `next.config.ts`.
- Confirm legal pages contain the real business name, address, and monitored support details. Obtain legal review for the privacy, terms, and refund-policy templates; they are not legal advice.
- Confirm PhonePe has approved both the merchant and this repeat-paid-voting use case.

## Vercel deployment and production launch

### 1. Create and validate a preview

Push the branch to the linked Git repository or create a CLI preview:

```powershell
vercel deploy
```

For a proper Preview environment, ensure its `APP_URL` is the preview URL and its services are non-production resources. The preview must remain on `PHONEPE_ENV=SANDBOX`.

Validate the preview using the full sandbox checklist above. Do not route production PhonePe callbacks to a transient preview URL.

### 2. Prepare production

Before promoting:

1. Connect the final custom domain to Vercel and wait for valid HTTPS.
2. Add all Production environment variables using production Neon/Blob/Upstash resources and the final canonical `APP_URL`.
3. Set the legal business/support values to real, reviewed information.
4. Back up or branch the production Neon database.
5. Pull production variables to a temporary ignored file and run the committed migration as described in [Production database](#production-database).
6. Keep `PHONEPE_ENV=SANDBOX` until PhonePe provides production credentials and approves the use case. Do not test payment on production with unapproved credentials.
7. Confirm the build, preview checks, and the administrator's operational review have all passed.

### 3. Enable production PhonePe only after UAT approval

Replace **every** PhonePe value in the Production environment with the production values and switch:

```dotenv
PHONEPE_ENV=PRODUCTION
APP_URL=https://your-final-domain.example
```

Update PhonePe's callback configuration to the final production endpoint:

```text
https://your-final-domain.example/api/webhooks/phonepe
```

Deploy again, then run one controlled ₹2 production transaction. Verify the callback in Vercel logs, the order in Admin → Payments, the single vote increment, and the refund flow (where PhonePe/UAT policy permits testing it).

### 4. Promote the tested artifact

Once the exact preview deployment has passed the checklist:

```powershell
vercel promote <preview-deployment-url>
```

Alternatively, merge to the Git branch configured as Vercel Production after the same checks. Record the deployment URL and the PhonePe configuration/change ticket used for the launch.

## Operations, troubleshooting, and rollback

### Useful commands

```powershell
pnpm dev                 # local Next.js development server
pnpm build               # production build
pnpm start               # serve a completed local production build
pnpm lint                # ESLint
pnpm typecheck           # TypeScript without emitting output
pnpm test                # Vitest domain tests
pnpm test:e2e            # Playwright desktop/mobile tests
pnpm db:migrate          # apply migrations with .env.local
pnpm db:seed             # idempotent showcase seed
pnpm admin:hash -- "..." # print bcrypt hash for a new admin password
```

### Common issues

| Symptom | Likely cause and resolution |
| --- | --- |
| Public pages show only sample content | `DATABASE_URL` is missing or unreachable. Add the correct Neon URL, run `pnpm db:migrate`, and restart the dev server. |
| Admin pages open but writes fail | The database is not configured/migrated, or the session lacks the configured admin credentials. Check `DATABASE_URL`, migrations, `ADMIN_EMAIL`, hash, and `AUTH_SECRET`. |
| Admin login fails in production | `ADMIN_PASSWORD_HASH`, `AUTH_SECRET`, or the email is wrong. Re-run `pnpm admin:hash` and update the Production environment variable; never use `savitri-demo` in production. |
| Image upload fails | Check Blob token, permitted file type (JPEG/PNG/WebP), size under 4 MB, and Vercel Function logs for Sharp/Blob errors. |
| “PhonePe sandbox and database credentials must be configured first” | One or more `DATABASE_URL`, `PHONEPE_MERCHANT_ID`, `PHONEPE_CLIENT_ID`, or `PHONEPE_CLIENT_SECRET` values are absent. |
| Checkout opens but no vote appears | Check PhonePe callback delivery/authentication, `APP_URL`, merchant credentials, Admin → Payments, Vercel logs, and workflow runs. An iframe close is not a payment confirmation. |
| Customer cannot start another vote | An unresolved `CREATED`/`PENDING` order exists for that normalized phone. Wait for reconciliation or investigate the order in Admin → Payments; do not manually increment votes. |
| Competition stays `CLOSING` | A pending payment/refund is being reconciled. Inspect the payment records and workflow runs. If the workflow records `REVIEW_REQUIRED`, investigate PhonePe status before any manual remedy. |
| Home page seems static | Check WebGL/browser hardware acceleration and `prefers-reduced-motion`. The application intentionally renders a lighter static fallback in those cases. |

### Rollback

To restore the preceding Vercel deployment without rebuilding:

```powershell
vercel rollback
```

Application rollback does **not** roll back database migrations. Migrations should therefore be additive/backward-compatible whenever possible. If a data rollback is necessary, restore/branch the Neon database using your approved backup procedure and coordinate it with the deployed application version.

### Ongoing operations

- Watch Vercel function/workflow logs and Admin → Payments during active events.
- Never change vote counts, payment states, winner snapshots, or encrypted PII directly in SQL as an operational shortcut.
- Archive events/competitions only after unresolved payments/refunds have settled.
- Rotate the admin password by generating a new bcrypt hash and deploying the new `ADMIN_PASSWORD_HASH`. Rotate `AUTH_SECRET` only if ending every admin session is acceptable.
- Plan PII key rotation with a migration and a maintenance window; do not simply replace `PII_ENCRYPTION_KEY`.
- Keep Next.js, React, PhonePe SDK, Sharp, Drizzle, and security dependencies patched, then run the full quality gate before each release.

## Route reference

| Area | Routes |
| --- | --- |
| Public | `/`, `/events`, `/events/[slug]`, `/competitions`, `/competitions/[slug]`, `/leaderboard` |
| Support/legal | `/support`, `/privacy`, `/terms`, `/refund-policy` |
| Admin | `/admin/login`, `/admin`, `/admin/events`, `/admin/competitions`, `/admin/submissions`, `/admin/payments`, `/admin/leaderboard` |
| Public API | `POST /api/submissions`, `POST /api/votes/phonepe/orders`, `GET /api/votes/phonepe/orders/[statusToken]`, `GET /api/competitions/[slug]/leaderboard` |
| Provider callback | `POST /api/webhooks/phonepe` |

The smaller historical setup document remains available at [SETUP.md](./SETUP.md); this README is the primary, complete runbook.
