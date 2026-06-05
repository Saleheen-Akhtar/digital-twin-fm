import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@digital-twin-fm/db'],
};

export default nextConfig;
