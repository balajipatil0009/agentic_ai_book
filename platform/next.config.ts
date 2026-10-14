import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Every route here reads the session cookie and per-user rows, so there is
   * no static shell worth caching — Cache Components would only force
   * Suspense boundaries around each dynamic read. Flip to `true` if you later
   * add public, cacheable pages (e.g. a marketing/courses section).
   */
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
