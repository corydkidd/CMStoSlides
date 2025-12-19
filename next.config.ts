import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    // WARNING: This allows production builds to complete even with type errors
    // TODO: Fix all TypeScript errors and remove this
    ignoreBuildErrors: true,
  },
  eslint: {
    // WARNING: This allows production builds to complete even with ESLint errors
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
