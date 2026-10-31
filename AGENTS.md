# Dive

Project memory for agents and humans. Dive is a SIMULATED useful-work mining game. No wallets, tokens or blockchain. Never imply Quanta is withdrawable or a real QMS reward.

## Stack

- Next.js 14 App Router (dev server on port 5173), strict TypeScript, Tailwind 3, Radix + shadcn-style UI in `src/components/ui`
- PostgreSQL + Prisma 6 (`prisma/schema.prisma`, migrations in `prisma/migrations`, seed `prisma/seed.ts`)
- Zod validation, Vitest + React Testing Library, Playwright (`e2e/`)
- TypeScript is pinned to 5.9 because Next 14 cannot load the native TypeScript 7 package.

## Layout

- `src/lib/game/*`: pure game rules. `config.ts` holds every price rule, energy formula, reward formula, progression threshold. `catalog.ts` holds seed data. `rig.ts` rig stats and compatibility. `progression.ts` levels and rewards.
- `src/lib/challenges/*`: seeded generators, exact solvers (Dijkstra, backtracking colouring, knapsack DP, Kruskal) and server-side solution validators.
- `src/server/services/*`: domain services. All balance changes go through `ledger.ts` `adjust()` (conditional update + ledger entry in one transaction).
- `src/app/api/**`: thin route handlers wrapped by `route()` in `src/server/http.ts` (envelope `{ ok, data | error }`, central error mapping).
- `src/server/session.ts`: demo-player session. NOT authentication. Replace `getPlayerId` to add real auth.
- `src/app/*/page.tsx`, `src/components/*`, `src/hooks/use-game.ts`: UI (React Query, polling for jobs).

## Rules to keep

- Never trust client prices, stats, rewards or completion. Services recompute them.
- Balances are integers: credits, milli-Quanta (1 Q = 1000 mQ), energy. Balances must equal the sum of ledger entries per resource.
- Job settlement is request-driven (`settleDueJobs`). Services accept an injectable `now` for tests.
- `<input type="number">` crashes the headless Chromium in this sandbox. Use stepper buttons instead.

## Commands

- `bun run db:up`, `db:migrate`, `db:seed`, `dev`, `test`, `test:e2e`, `check`, `build`
- Sandbox dev database: Docker container `dive-pg` (postgres:18-alpine, volume `divepgdata`).
- E2E in the sandbox needs `LD_LIBRARY_PATH` and `FONTCONFIG_FILE` pointing at extracted Chromium libraries and fonts (see the README for a normal machine).
