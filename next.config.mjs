/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Explicitly allow the microphone for our own origin so voice input
          // is never blocked by a restrictive default policy (needed on iOS/Safari).
          { key: 'Permissions-Policy', value: 'microphone=(self), camera=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
