/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow embedding as iframe from the NPU platform domain
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL',
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://*.neuroprogeny.com https://*.vercel.app",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
