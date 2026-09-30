import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next derives outputFileTracingRoot from turbopack.root; a hardcoded local
  // path breaks the Vercel bundle. Worktree dev: TURBOPACK_ROOT=<repo root>.
  turbopack: { root: process.env.TURBOPACK_ROOT ?? process.cwd() },
};

export default nextConfig;
