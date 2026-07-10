# Vedike Setup and Go-Live Guide

## 1. Prerequisites

- Node.js 20.9 or newer.
- pnpm 10 (`npm install -g pnpm@10` if Corepack is unavailable).
- A Vercel account and project.
- Vercel Marketplace Neon PostgreSQL and Upstash Redis integrations.
- A Vercel Blob store.
- A PhonePe Payment Gateway V2 merchant account. Begin with sandbox/UAT credentials.
- A public HTTPS domain before PhonePe webhook and production testing.

Install and verify the application:

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

The public UI works without service credentials using non-payable showcase data. This fallback must never be mistaken for a production database.

## 2. Vercel and managed services

Install the Vercel CLI, log in and link the repository:

```bash
npm install -g vercel
vercel login
vercel link
```

Provision Neon and Upstash from the Vercel Marketplace and create a Blob store from the project Storage page. Marketplace provisioning normally injects the service variables automatically.

After provisioning or changing any secret, pull the development environment:

```bash
vercel env pull .env.local --yes
```

`vercel env pull` replaces `.env.local`. Keep manual development-only overrides in `.env.development.local`, or re-add them after pulling.

Copy every key from `.env.example`. Required service values are:

```dotenv
DATABASE_URL=postgresql://...
BLOB_READ_WRITE_TOKEN=vercel_blob_...
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

Do not prefix secrets with `NEXT_PUBLIC_`.

## 3. Admin and PII secrets

Choose the one admin email and generate a bcrypt password hash:

```bash
pnpm admin:hash -- "a-long-unique-admin-password"
```

Generate two independent 32-byte secrets:

```bash
openssl rand -base64 32
openssl rand -base64 32
```

Configure:

```dotenv
ADMIN_EMAIL=admin@example.org
ADMIN_PASSWORD_HASH=<bcrypt output>
AUTH_SECRET=<first random secret>
PII_ENCRYPTION_KEY=<second random secret>
```

`PII_ENCRYPTION_KEY` encrypts phone numbers, emails and voter identity with AES-256-GCM and derives non-reversible identity hashes. Rotating it requires a data migration; do not replace it casually.

When admin credentials are absent in local development only, the fallback is `admin@vedike.in` / `vedike-demo`. Production refuses that fallback.

## 4. Database migrations and showcase seed

Only Next.js automatically loads `.env.local`; the scripts use `dotenv-cli` explicitly.

```bash
pnpm db:migrate
pnpm db:seed
```

The seed is idempotent. It creates five read-only showcase events, eight competitions and 28 sample entries. Showcase counts are presentation-only:

- They cannot accept submissions or payments.
- They are excluded from revenue and real-vote metrics.
- They contain no participant contact information.

Create all real events from `/admin/events` after signing in.

## 5. PhonePe PG V2 sandbox

Obtain PG V2 sandbox values from PhonePe and configure:

```dotenv
APP_URL=https://your-preview-or-tunnel-domain.example
PHONEPE_ENV=SANDBOX
PHONEPE_MERCHANT_ID=...
PHONEPE_CLIENT_ID=...
PHONEPE_CLIENT_SECRET=...
PHONEPE_CLIENT_VERSION=1
PHONEPE_WEBHOOK_USERNAME=...
PHONEPE_WEBHOOK_PASSWORD=...
```

The application uses the official `@phonepe-pg/pg-sdk-node` Standard Checkout client. Each call to `POST /api/votes/phonepe/orders` creates one server-controlled order for exactly 200 paise. The browser cannot send an amount or quantity.

Configure PhonePe to POST these events to:

```text
https://YOUR_DOMAIN/api/webhooks/phonepe
```

Subscribe to:

- `checkout.order.completed`
- `checkout.order.failed`
- `pg.refund.completed`
- `pg.refund.failed`

The webhook must use HTTPS and return promptly. Its authorization is validated with `PHONEPE_WEBHOOK_USERNAME` and `PHONEPE_WEBHOOK_PASSWORD`. An iframe `CONCLUDED` callback is never treated as payment proof; only a validated webhook or server-side status result can credit a vote.

Vercel Workflows performs the required pending-order status schedule. It is enabled through `withWorkflow()` in `next.config.ts`. Inspect runs with:

```bash
npx workflow health
npx workflow inspect runs
npx workflow web
```

Complete PhonePe UAT cases for successful payment, user cancellation, failure, pending-to-success, pending-to-failure, duplicate webhook, missed webhook/status recovery and refund. Check the admin Payments page after every case.

## 6. Content and policy configuration

Configure the public support and legal identity:

```dotenv
LEGAL_BUSINESS_NAME=Your registered organization
LEGAL_ADDRESS=Your complete business address
SUPPORT_EMAIL=support@example.org
SUPPORT_PHONE=+91...
```

Review `/privacy`, `/terms`, `/refund-policy` and `/support` with qualified Indian counsel. They are implementation templates, not legal advice.

PhonePe must explicitly approve the merchant and the repeat-paid-voting use case before production launch. Do not switch to production based only on a successful local or sandbox test.

## 7. Local development

```bash
pnpm dev
```

Open `http://localhost:3000`. PhonePe requires a public HTTPS return and webhook URL, so use a secure tunnel or a Vercel preview for end-to-end sandbox work and set `APP_URL` to that exact origin.

Useful checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

## 8. Production deployment

Set secrets separately for Development, Preview and Production. Preview must use PhonePe sandbox credentials and a preview database branch. Production must use the production database and PhonePe production credentials.

Create a preview:

```bash
vercel deploy
```

Before promotion:

1. Run the migration against the production Neon database.
2. Verify admin login, real event CRUD and image upload.
3. Verify no participant phone or email appears in page HTML or public JSON.
4. Complete PhonePe UAT and confirm webhook delivery.
5. Confirm pending-order and competition-finalization workflows in Vercel.
6. Review policy pages and business/support data.
7. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, Playwright and `pnpm build`.

After the exact preview artifact is approved:

```bash
vercel promote <preview-deployment-url>
```

Then set the production webhook URL in PhonePe, scan runtime logs and verify a controlled ₹2 production transaction.

Rollback without rebuilding:

```bash
vercel rollback
```

## 9. Production switch

Only after PhonePe production approval and UAT sign-off:

```dotenv
PHONEPE_ENV=PRODUCTION
APP_URL=https://your-final-domain.example
```

Replace every PhonePe credential with its production value and redeploy. Never share production secrets in source, screenshots, issue trackers or client-side variables.

## Operational behavior

- Public status is derived from timestamps in `Asia/Kolkata`; storage is UTC.
- The competition end time immediately stops new submissions and vote orders.
- Admin completion changes a competition to `CLOSING` and drains pending orders before locking winners.
- Duplicate callbacks cannot credit a second vote.
- A successful payment discovered after winner locking is moved to refund processing.
- Winners sort by paid vote count, then the earlier time the final tied count was reached, then entry time.
- Payment and submission records with financial history are never hard-deleted.
