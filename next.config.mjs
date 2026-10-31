/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lets the end-to-end suite build/run in its own folder next to a running dev server.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  // Type checking runs separately via `bun run typecheck` (tsc).
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
}

export default nextConfig
