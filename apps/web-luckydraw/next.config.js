/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@event-platform/ui', '@event-platform/types'],
};
module.exports = nextConfig;
