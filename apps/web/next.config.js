/** @type {import('next').NextConfig} */
// STATIC_EXPORT=1 builds a static site (for Surge / any static host) — a
// design preview with no backend. Otherwise builds the normal server app.
const isExport = process.env.STATIC_EXPORT === '1';

const nextConfig = {
  reactStrictMode: true,
  output: isExport ? 'export' : 'standalone',
  images: { unoptimized: true }, // required for static export
  trailingSlash: isExport, // nicer static routing on Surge
};

if (!isExport) {
  // Proxy API + tracking to the NestJS backend (server mode only).
  nextConfig.rewrites = async () => {
    const api = process.env.API_URL ?? 'http://localhost:4000';
    return [
      { source: '/api/:path*', destination: `${api}/api/:path*` },
      { source: '/track-api/:path*', destination: `${api}/track/:path*` },
    ];
  };
}

module.exports = nextConfig;
