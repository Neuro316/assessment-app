/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow embedding as iframe from the NPU platform domain only
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://university.neuroprogeny.com",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
