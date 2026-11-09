import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the workspace root: a stray lockfile above the repo must not change it.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
