# Vedike

Vedike is a production-oriented Kannada community platform for concurrent events, competitions, photo submissions, ₹2 PhonePe voting and immutable winner reveals.

The interface is a Next.js port of the supplied Claude Design prototype. It includes a four-chapter Three.js/GSAP home experience, public event and competition pages, live leaderboards, a protected admin dashboard, encrypted participant data, Vercel Blob media handling, Neon/PostgreSQL persistence and durable PhonePe reconciliation through Vercel Workflows.

See [SETUP.md](./SETUP.md) for local setup, sandbox configuration, migrations and go-live steps.

## Commands

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

Without `DATABASE_URL`, public pages intentionally render the read-only showcase dataset. Real submissions, payments and admin mutations require the managed services described in `SETUP.md`.
