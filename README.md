# dive

dive is a useful-work mining simulator. You buy equipment, assemble rigs, solve real computational challenges (routing, scheduling, channel assignment, network design), run persistent mining jobs, and earn simulated Quanta to grow your farm.

**Build Your Rig. Solve Useful Work. Earn Quanta.**

## Accounts

Every player has their own account (username, email and password). Credits, Quanta, energy, XP, level, equipment, rigs, jobs, achievements and the ledger belong to that account only, are stored in PostgreSQL, and follow you to any device. You can recover a forgotten password by email and change it, or your username, in Account settings.

## Simulated resources

Everything in dive is simulated. Credits, Quanta (Q) and Energy are game currencies with no real-world value. Quanta cannot be withdrawn and is not a real QMS reward. dive has no wallet connection, no token transfers and no blockchain integration.

## How to play

1. **Buy**: spend credits at the Market on chassis, processors, accelerators, memory, cooling and power supplies. Higher tiers unlock as you level up.
2. **Build**: combine parts into rigs. Power draw must stay under your power supply, and heat above your cooling throttles compute. A ready Starter Rig is waiting for you.
3. **Solve**: generate a challenge, solve it on the board, and use "Check solution" to test your answer for free. Four challenge types: shortest route, channel assignment (graph colouring), batch scheduling (knapsack) and cable layout (spanning tree).
4. **Mine**: pick a rig and start a job. It costs an entry fee in credits and Energy, runs on the server for a set time, and keeps running if you close the page.
5. **Earn**: claim the finished job for Quanta and XP. Optimal answers earn a 25% bonus and finishing under the energy par earns 15% more.
6. **Grow**: upgrade parts, recharge Energy, convert Quanta into credits at the Refinery (one-way), unlock achievements and level up.

Every balance change appears in the Ledger, and each balance must equal the sum of its ledger entries.

## Tech stack

- Next.js 14 (App Router), React 18, strict TypeScript
- Tailwind CSS, Radix UI primitives with shadcn-style components, Lucide icons, Framer Motion, Recharts
- PostgreSQL with Prisma ORM, Zod validation
- Vitest and React Testing Library for unit, service and component tests, Playwright for end-to-end tests

## Prerequisites

- [Bun](https://bun.sh) 1.x
- Docker (for the bundled PostgreSQL), or any PostgreSQL 14+ server
- Node.js 20+ (used by the Next.js and Prisma tooling)

## Environment variables

Copy `.env.example` to `.env` and adjust.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used by the app and Prisma. Required. |
| `APP_URL` | Public address of the site (for example `https://your-app.vercel.app`), used in password-reset emails. Required in production. |
| `CRON_SECRET` | Secret that protects the scheduled housekeeping endpoint. Required for the cron job (Vercel sends it automatically). |
| `RESEND_API_KEY` | API key of the email provider (Resend) used to send password-reset emails. |
| `MAIL_FROM` | Sender address for those emails, for example `dive <no-reply@your-domain.com>`. |
| `EMAIL_TRANSPORT` | Optional. `dev-outbox` writes emails to a local `.dev-mail/` folder instead of sending them (local development only). |
| `ALLOWED_ORIGINS` | Optional, comma-separated extra origins allowed to call the API. Normally empty. |
| `TEST_DATABASE_URL` | Database used by the automated tests. Optional, defaults to a local `dive_test` database. |
| `E2E_DATABASE_URL` | Database used by the end-to-end tests. Optional, defaults to a local `dive_e2e` database. |
| `NEXT_DIST_DIR` | Alternative Next.js output folder. Optional, defaults to `.next`. |

There is no session secret to manage: sessions are random tokens stored (hashed) in the database.

## PostgreSQL setup

```bash
bun install
bun run db:up          # starts PostgreSQL 18 in Docker on port 5432 (database "dive")
cp .env.example .env
```

Without Docker, create a database yourself and point `DATABASE_URL` at it.

## Migrations and seeding

```bash
bun run db:migrate     # applies the migrations in prisma/migrations
bun run db:seed        # equipment, challenge templates and achievements (players register themselves)
```

The seed is safe to run again. To wipe the database and start over: `bun run db:reset` then `bun run db:seed`.

For password-reset emails during local development, set `EMAIL_TRANSPORT=dev-outbox` in `.env`; each email is saved as a file in `.dev-mail/` (the link is in the file, never in the logs).

## Run locally

```bash
bun run dev            # http://localhost:5173
```

## Tests

```bash
bun run test           # unit, account, player-isolation, service (real PostgreSQL) and component tests
bun run test:e2e       # Playwright: sign up, buy, build, solve, mine, claim, log out and in, second player isolation
bun run check          # lint and type check
```

The service tests and the end-to-end test use their own databases (created automatically), so your playable data is never touched. Playwright needs a Chromium browser: run `bunx playwright install --with-deps chromium` once on a fresh machine. The end-to-end test takes about 40 seconds because it waits for a real job to finish.

## Production build

```bash
bun run build
bun run start          # serves on port 5173
```

Run `bun run db:migrate` against the production database first.

## Deploying to Vercel with Neon

1. Create a Neon project. In Vercel, set `DATABASE_URL` to Neon's **pooled** connection string with `&pgbouncer=true` added.
2. Set `APP_URL` to your site address, a random `CRON_SECRET`, and `RESEND_API_KEY` plus `MAIL_FROM` for password-reset emails.
3. Migrations run during the Vercel build (`vercel-build`). If your build cannot reach the pooled address for migrations, run `bunx prisma migrate deploy` once from your machine using Neon's **direct** (non-pooled) string, and seed with `bun run db:seed`.
4. Deploy. Players register themselves; no demo or admin account exists.

**Background processing.** Mining jobs are timed in the database, so they keep running while nobody is logged in, and a job's state is brought up to date whenever its owner (or the scheduled task) looks at it. Rewards are always claimed by the player and paid exactly once. Vercel functions cannot run continuously, so `vercel.json` schedules `/api/cron/settle` once a day for housekeeping (marking finished jobs, deleting expired sessions and old counters). Vercel Hobby only allows daily schedules; on a paid plan you can change the schedule to every minute (`* * * * *`) so finished jobs are marked promptly even for players who never return. No other worker is required.

## Security notes

- Passwords are hashed with Argon2id. Sessions use random tokens in HttpOnly, SameSite=Lax cookies (Secure and `__Host-` prefixed in production); only a hash of each token is stored. Sessions last 30 days, renew while you play, and end after 90 days at most.
- Every request to a game endpoint is checked against the server-side session, and every query is limited to the signed-in player's own records. A player id sent by the browser is never used.
- Sign-up, login and password-recovery attempts are rate limited (stored in the database, so limits hold across serverless instances). On hosts other than Vercel, make sure your proxy overwrites the `X-Forwarded-For` header, or the per-address limits can be dodged (the per-account limits still apply).
- State-changing requests from other websites are rejected (SameSite cookies plus an origin check).
- Password-reset links work once, expire after 30 minutes, are stored hashed, carry the token in the URL fragment, and are never written to logs. A successful reset signs out every device.
- Passwords must be at least 10 characters with a letter and a number.

## Existing data

Before accounts existed, everyone shared one demo player. That player's record (balances, inventory, rigs, ledger) is kept in the database as an archived "legacy-demo" record that no account can log in to or see. New accounts never inherit it; they always receive the standard starting resources and a Starter Rig.

## Known limitations

- **Job state is updated on demand.** Without the scheduled task, a finished job is marked finished the next time its owner (or anyone running the task) looks at it. Timing and rewards are exact either way.
- **Polling, not push.** The interface refreshes job progress every couple of seconds instead of using live connections.
- **Energy has no passive regeneration.** Recharge it with credits. Energy is capped.
- **Small puzzles.** Puzzle sizes are chosen so they are solvable by hand in a browser. Optimal answers are verified on the server with exact algorithms.
- **No email change or two-factor sign-in yet.** Only the username and password can be changed.
- **Fonts** are loaded from Google Fonts in the browser, with system fallbacks if they are unavailable.
