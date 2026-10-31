# Deploying Dive (QPouch Games)

Dive needs a server and a PostgreSQL database, so it is deployed on its own, separate from the QPouch site.

1. **Database.** Create a free PostgreSQL database (Neon, Supabase or Vercel Postgres). Copy its connection string.
2. **Set up the tables, once, from your computer** (needs Bun and Node):
   ```bash
   bun install
   export DATABASE_URL="<your connection string>"
   bun run db:migrate
   bun run db:seed
   ```
3. **Deploy.** Push this folder to a GitHub repo and import it into Vercel (framework: Next.js).
   Add the environment variable `DATABASE_URL` with the same connection string. Build command: `bun run build`.
4. **Link it from the site.** Open `index.html` in the QPouch site, find `const DIVE_URL=""`, paste your Vercel address between the quotes, and redeploy the site. The Dive card's button then turns on.

Everyone who opens Dive shares one demo player (see "Known limitations" in README.md).
