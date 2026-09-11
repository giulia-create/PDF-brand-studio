import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
};

export default nextConfig;
