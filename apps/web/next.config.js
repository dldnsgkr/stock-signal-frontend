/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@stock-signal/shared-types'],
  env: {
    API_URL: process.env.API_URL || 'http://localhost:3001/api',
  },
};

module.exports = nextConfig;
