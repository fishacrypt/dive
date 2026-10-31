# Dive

Dive is a useful-work mining simulator. You buy equipment, assemble rigs, solve real computational challenges (routing, scheduling, channel assignment, network design), run persistent mining jobs, and earn simulated Quanta to grow your farm.

**Build Your Rig. Solve Useful Work. Earn Quanta.**

## Simulated resources

Everything in Dive is simulated. Credits, Quanta (Q) and Energy are game currencies with no real-world value. Quanta cannot be withdrawn and is not a real QMS reward. Dive has no wallet connection, no token transfers and no blockchain integration.

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
| `DEMO_PLAYER_HANDLE` | Handle of the shared demo player. Optional, defaults to `demo`. |
| `TEST_DATABASE_URL` | Database used by the unit and service tests. Optional, defaults to a local `dive_test` database. |
| `E2E_DATABASE_URL` | Database used by the end-to-end tests. Optional, defaults to a local `dive_e2e` database. |
| `ALLOW_DEMO_RESET` | Set to `true` to allow the demo reset endpoint in a production build. Optional, off by default. |
| `NEXT_DIST_DIR` | Alternative Next.js output folder. Optional, defaults to `.next`. |

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
bun run db:seed        # equipment, challenge templates, achievements and the demo player
```

The seed is safe to run again. To wipe everything and start over: `bun run db:reset` then `bun run db:seed`. There is also a "Reset demo" API at `POST /api/demo/reset` (disabled in production builds).

## Run locally

```bash
bun run dev            # http://localhost:5173
```

## Tests

```bash
bun run test           # unit, service (real PostgreSQL) and component tests
bun run test:e2e       # Playwright: buy, build, solve, mine, claim and verify the ledger
bun run check          # lint and type check
```

The service tests and the end-to-end test use their own databases (created automatically), so your playable data is never touched. Playwright needs a Chromium browser: run `bunx playwright install --with-deps chromium` once on a fresh machine. The end-to-end test takes about 40 seconds because it waits for a real job to finish.

## Production build

```bash
bun run build
bun run start          # serves on port 5173
```

Run `bun run db:migrate` against the production database first.

## Known limitations

- **Demo player only.** There is no authentication. Everyone who opens the app shares one demo player. This is intentional and not meant for production use; every server operation already takes a player id and checks ownership, so real sign-in can replace the demo session later.
- **Request-driven job settlement.** There is no background worker. A job is marked finished the next time its owner reads or claims jobs after its end time. Timing and rewards are exact, but a job that nobody looks at stays "running" in the database until someone does. A worker can reuse the same settlement step later.
- **Polling, not push.** The interface refreshes job progress every couple of seconds instead of using live connections.
- **Energy has no passive regeneration.** Recharge it with credits. Energy is capped.
- **Small puzzles.** Puzzle sizes are chosen so they are solvable by hand in a browser. Optimal answers are verified on the server with exact algorithms.
- **Fonts** are loaded from Google Fonts in the browser, with system fallbacks if they are unavailable.
