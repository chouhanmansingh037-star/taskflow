/** @type {import('next').NextConfig} */
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:4000";

const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // The browser only ever talks to this origin; /api is proxied to the backend,
  // which keeps the session cookie first-party and avoids CORS in the browser.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
};

export default nextConfig;
