/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone", // required for the multi-stage Dockerfile
  async rewrites() {
    // Proxies /api/* to the FastAPI backend so the browser talks to a single
    // origin in development. In production, point NEXT_PUBLIC_API_URL at the
    // real backend URL directly and this rewrite becomes unnecessary/inert
    // for absolute-URL calls made via lib/api.ts.
    const backend = process.env.BACKEND_URL || "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${backend}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
