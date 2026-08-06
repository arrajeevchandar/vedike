# Savitri Foundation — Complete Setup and Go-Live Checklist

This is the ordered runbook for taking Savitri Foundation from the current local UI into a real, safe deployment. Complete each section in order. Do not enable real payments until the sandbox checklist and PhonePe approval are complete.

The project also contains a detailed technical reference in [README.md](./README.md). This document is the practical checklist to follow.

## 1. What works without configuration

The site can be reviewed locally without any cloud services. In this mode it uses read-only showcase content only. It cannot save events, accept real uploads, or take payments.

```powershell
cd C:\Users\rajee\Downloads\vedike
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000`.

For this no-environment development preview only, the admin login is:

```text
Email:    admin@savitrifoundation.in
Password: savitri-demo
```

Use `pnpm dev`, not `pnpm start`, for that fallback. Production mode deliberately rejects the demo password.

## 2. Accounts and services to create

Create or obtain these before enabling real data:

1. **Git repository and Vercel project** — hosts the Next.js app and Vercel Workflows.
2. **Neon PostgreSQL** — permanent database for events, competitions, entries, votes, winners, payments, and audit logs.
3. **Vercel Blob store** — stores sanitized participant photos.
4. **Upstash Redis** — applies login, submission, and vote-order rate limits.
5. **PhonePe Payment Gateway V2 merchant account** — start with sandbox/UAT credentials, not production credentials.
6. **A public HTTPS domain** — required before real PhonePe callbacks. A Vercel Preview URL is suitable for sandbox testing; use the final domain in production.
7. **Real business and support details** — registered name, address, support email, support phone, and legal review for the policy pages.

Install and link Vercel:

```powershell
npm install --global vercel
vercel login
vercel link
```

In Vercel, provision Neon and Upstash from **Storage / Marketplace**, then create a Blob store. Vercel can inject the service values automatically; still confirm every value in **Project → Settings → Environment Variables**.

## 3. Create the local environment file

Copy the tracked template:

```powershell
Copy-Item .env.example .env.local
```

Fill it with the real Development or sandbox values. Never commit `.env.local` and never use `NEXT_PUBLIC_` for a secret.

```dotenv
# Neon
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require

# Vercel Blob
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://YOUR-REDIS.upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# One administrator
ADMIN_EMAIL=admin@yourdomain.in
ADMIN_PASSWORD_HASH=$2b$...
AUTH_SECRET=...
PII_ENCRYPTION_KEY=...

# Exact public origin; no trailing path
APP_URL=https://YOUR-PREVIEW-OR-DOMAIN.example

# PhonePe — sandbox first
PHONEPE_ENV=SANDBOX
PHONEPE_MERCHANT_ID=...
PHONEPE_CLIENT_ID=...
PHONEPE_CLIENT_SECRET=...
PHONEPE_CLIENT_VERSION=1
PHONEPE_WEBHOOK_USERNAME=...
PHONEPE_WEBHOOK_PASSWORD=...

# Public legal/support pages
LEGAL_BUSINESS_NAME=Savitri Foundation
LEGAL_ADDRESS=Your complete registered address
SUPPORT_EMAIL=support@yourdomain.in
SUPPORT_PHONE=+919999999999
```

Generate the administrator hash from the password you want to use:

```powershell
pnpm admin:hash -- "choose-a-long-unique-password"
```

Copy only the command output into `ADMIN_PASSWORD_HASH`; keep the original password in a password manager.

Generate `AUTH_SECRET` and `PII_ENCRYPTION_KEY` separately:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Run that command twice. These values must remain stable after real data exists. Changing `AUTH_SECRET` signs administrators out; replacing `PII_ENCRYPTION_KEY` without a data migration makes existing encrypted contact details unreadable.

When Vercel is linked, pull its Development variables if desired:

```powershell
vercel env pull .env.local --yes
```

That command replaces `.env.local`, so restore any local-only values afterward.

## 4. Initialize Neon and the showcase data

With `DATABASE_URL` set, run the committed Drizzle migrations:

```powershell
pnpm db:migrate
pnpm db:seed
```

The current release includes migration `0002_competition_review_voting_flow` and `0003_promote_legacy_competitions`. They add the private-application/public-voting lifecycle and safely convert old real `PUBLISHED` competitions into `VOTING_OPEN` competitions.

The seed command is idempotent. It creates read-only showcase records for UI review. Showcase entries accept no uploads or payments and never count toward real revenue.

Verify locally:

```powershell
pnpm dev
```

Sign in at `http://localhost:3000/admin/login` using `ADMIN_EMAIL` and the original password used to generate its bcrypt hash.

## 5. Test the actual admin competition flow

After migrations are applied, use this sequence:

1. Go to **Admin → Events** and create a real event with IST start/end dates.
2. Go to **Admin → Competitions** and select that event.
3. Set four IST values:
   - Application opens
   - Application closes
   - Voting opens
   - Voting closes
4. The dates must be inside the event and obey:

   ```text
   Event start ≤ application start < application end ≤ voting start < voting end ≤ event end
   ```

5. The competition starts in `APPLICATIONS_OPEN`.
6. While applications are open, public visitors can submit an entry. Their entry is private as `PENDING_REVIEW`; the public gallery, leaderboard, and voting do not expose it.
7. In **Admin → Competitions**, use **Open public voting**. Select at least one pending application in the release checklist. Selected entries become public and voting opens immediately.
8. Entries not selected remain private. During live voting, use **Admin → Submissions → Release** to make an additional private entry public.
9. At the configured voting start, the workflow opens voting automatically if it has not already been opened manually. At voting end, it closes the competition and begins finalization.
10. In **Admin → Leaderboard**, use **Close & Reveal Winners** to close voting early if needed. It settles outstanding PhonePe orders, then locks the top three winners.

Do not edit a competition schedule after voting begins. The application blocks that to protect public voting and winner integrity.

## 6. Configure Vercel Blob and Upstash

### Blob

1. In Vercel project storage, create/connect a Blob store.
2. Copy its read/write token to `BLOB_READ_WRITE_TOKEN` in Development, Preview, and Production as appropriate.
3. Submit a JPEG, PNG, and WebP test file under 4 MB.

The server auto-rotates images, removes metadata, limits them to 2048px, encodes WebP, and stores only the sanitized result.

### Upstash

1. Create/connect an Upstash Redis database.
2. Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
3. Confirm repeated login, upload, and vote-order attempts are rate limited in a test environment.

Do not share the Redis token, Blob token, connection string, or PII key with the browser or in screenshots.

## 7. PhonePe sandbox/UAT setup

### Obtain sandbox values

Request/obtain PhonePe PG V2 sandbox credentials and enter the values in the `PHONEPE_*` section of `.env.local` and Vercel Preview variables. Keep:

```dotenv
PHONEPE_ENV=SANDBOX
```

The application uses the official PhonePe Node SDK and creates every payment server-side at a fixed amount of **₹2 / 200 paise**. No client request can set a price or quantity.

### Create a publicly reachable sandbox URL

PhonePe cannot call `localhost`. Deploy a Vercel preview:

```powershell
vercel deploy
```

Set `APP_URL` to that exact HTTPS preview origin, for example:

```dotenv
APP_URL=https://savitri-foundation-git-feature-your-team.vercel.app
```

Redeploy after changing `APP_URL`. The origin configured in Vercel and the origin given to PhonePe must be identical.

### Configure the callback

In the PhonePe sandbox merchant portal, configure the HTTPS callback endpoint:

```text
https://YOUR-APP-DOMAIN/api/webhooks/phonepe
```

Configure the callback authentication values to exactly match:

```dotenv
PHONEPE_WEBHOOK_USERNAME=...
PHONEPE_WEBHOOK_PASSWORD=...
```

Enable the payment and refund status callbacks offered for your PG V2 account, including completed and failed checkout orders and completed/failed refunds.

The application treats closing the PhonePe iframe only as a UI event. A vote is added only after a validated callback or verified server-side PhonePe status reports `COMPLETED`.

### Execute the sandbox checklist

For a real, released submission in a live voting competition, test each case one at a time:

1. Successful ₹2 payment; vote count rises exactly once.
2. User cancellation; no vote is added.
3. Failed payment; no vote is added.
4. Pending payment that later succeeds; one vote is added after reconciliation.
5. Pending payment that later fails/expires; no vote is added.
6. Duplicate callback; no second vote is added.
7. Callback delay/missed callback; order-status reconciliation reaches the correct state.
8. A second vote from the same phone after the first reaches a terminal state; it is allowed as a new ₹2 checkout.
9. A second vote while one order is pending; it is blocked.
10. Disqualify an entry with completed votes; verify each affected order starts/refuses a refund correctly.
11. Close a competition with a pending order; verify finalization settles/refunds it before freezing winners.

Check **Admin → Payments**, Vercel logs, and workflow runs for every result. Never manually increment a vote total in SQL.

## 8. Verify Vercel Workflows

The application builds three workflows: payment reconciliation, competition finalization, and scheduled competition phase transitions.

After linking the project, inspect their health/runs:

```powershell
pnpm exec workflow health
pnpm exec workflow inspect runs
pnpm exec workflow web
```

Verify that:

- a created competition schedules its phase workflow;
- a pending payment starts reconciliation;
- a closing competition reconciles pending payments/refunds before snapshotting winners;
- a stuck settlement is logged for administrative review rather than silently changing a podium.

## 9. Quality gate before deployment

Run this from a clean checkout:

```powershell
pnpm check
pnpm test:e2e
```

Confirm manually at desktop and mobile widths:

- home page splash and scrollytelling load without console errors;
- mobile navigation, admin forms, review dialog, and public competition page fit safely;
- private application data is absent from public page source/API responses before voting release;
- only public `VISIBLE` submissions have a vote button;
- date/time displays are IST and overlap between unrelated events/competitions works;
- policy/support pages contain the real organization information.

## 10. Configure Preview and Production environments

Use separate service resources where possible.

| Environment | Database | PhonePe | `APP_URL` |
| --- | --- | --- | --- |
| Development | Development Neon branch | Sandbox | local URL for UI; HTTPS URL for payment test |
| Preview | Separate Neon branch | Sandbox | exact preview HTTPS URL |
| Production | Production Neon database | Production only after approval | final custom-domain HTTPS URL |

In Vercel, add all environment variables in **Project → Settings → Environment Variables** for the correct scope. Do not point a Preview deployment at the production database or production merchant credentials.

Attach and verify the custom domain in Vercel before production payment activation. Update `APP_URL`, redeploy, then configure the final PhonePe callback URL using that exact domain.

## 11. Production launch

Only proceed after PhonePe approves the merchant, the repeat paid-voting use case, and UAT results.

1. Back up/branch Neon according to your operational policy.
2. Add Production environment variables using production Neon, Blob, Upstash, and business/support details.
3. Run `pnpm db:migrate` against the production `DATABASE_URL`.
4. Run `pnpm db:seed` only if you want the read-only showcase records present in production.
5. Deploy a preview and repeat the quality gate.
6. Keep `PHONEPE_ENV=SANDBOX` until PhonePe supplies/approves production credentials.
7. Replace every PhonePe value with the production value, set:

   ```dotenv
   PHONEPE_ENV=PRODUCTION
   APP_URL=https://your-final-domain.example
   ```

8. Deploy/promote the reviewed artifact:

   ```powershell
   vercel promote YOUR-PREVIEW-DEPLOYMENT-URL
   ```

9. Update PhonePe’s production webhook URL if it differs from preview.
10. Perform one controlled ₹2 production payment, confirm one vote and payment audit record, then monitor logs/workflows during the first live event.

## 12. Operations, troubleshooting, and rollback

| Symptom | Check first |
| --- | --- |
| Admin login is invalid | Ensure `pnpm dev` is used locally, or confirm the email and plain password match `ADMIN_PASSWORD_HASH`. |
| Only sample content appears | `DATABASE_URL` is missing/unreachable, migrations have not run, or the server needs a restart after env changes. |
| Real entry upload fails | Check Blob token, 4 MB/type limit, Vercel Blob permissions, and server logs. |
| Checkout cannot start | Check database, required PhonePe credentials, active public voting phase, and `APP_URL`. |
| Payment succeeded but vote is absent | Check PhonePe callback delivery/authentication, Admin → Payments, Vercel logs, and reconciliation workflow. |
| Competition remains `CLOSING` | Pending payment/refund reconciliation is in progress; inspect workflow runs and PhonePe status before taking action. |
| Private entry appears publicly | Stop voting, inspect the submission state and release audit records, then review deployment logs immediately. |

To roll back the deployed application version:

```powershell
vercel rollback
```

Vercel rollback does **not** roll back database migrations. The migrations in this project are additive; coordinate any database restoration through Neon backups/branches and deploy a compatible application version.

## Non-negotiable safety rules

- Never commit `.env.local`, credentials, database URLs, secrets, hashes, or customer PII.
- Do not use the development `savitri-demo` password in production.
- Do not manually edit paid vote totals, payment states, winner snapshots, or encrypted PII in SQL.
- Do not turn on PhonePe production until PhonePe has approved the use case and sandbox/UAT results are signed off.
- Keep private applications private until an administrator explicitly releases them into voting.
