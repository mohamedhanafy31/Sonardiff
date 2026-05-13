/** @type {import('next').NextConfig} */
const backendBase = process.env.BACKEND_URL || 'http://localhost:3001';

const nextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/api/:path*',
          destination: `${backendBase}/api/:path*`,
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

module.exports = nextConfig;
