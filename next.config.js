/** @type {import('next').NextConfig} */
const nextConfig = {
  // The commit this build came from, for the practice-complete message's appSha.
  // An explicit NEXT_PUBLIC_APP_SHA wins; on Vercel the system variable is there.
  env: {
    NEXT_PUBLIC_APP_SHA: process.env.NEXT_PUBLIC_APP_SHA || process.env.VERCEL_GIT_COMMIT_SHA || '',
  },
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
