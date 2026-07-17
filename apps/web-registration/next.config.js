/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: [
    '@event-platform/ui',
    '@event-platform/types',
    '@event-platform/utils',
  ],
};

module.exports = nextConfig;
