import type { NextConfig } from 'next';
const config: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  experimental: {
    cpus: 2,
    turbopackFileSystemCacheForDev: false,
    turbopackFileSystemCacheForBuild: false,
  },
};
export default config;
