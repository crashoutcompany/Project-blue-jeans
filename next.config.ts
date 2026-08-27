import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Icons are imported from the lucide-react barrel throughout the app, which
  // pulls the whole re-export map into dev and cold starts without this.
  experimental: {
    optimizePackageImports: ["lucide-react"],
    // Instant-nav e2e only. Never set EXPOSE_TESTING_API in real production.
    exposeTestingApiInProductionBuild: process.env.EXPOSE_TESTING_API === "1",
  },
  /**
   * Baseline hardening for every response. A Content-Security-Policy is
   * deliberately not set here: the app relies on Next's inline bootstrap and
   * the next-themes inline script, so it needs nonce plumbing in `proxy.ts`
   * rather than a static header that would silently break hydration.
   */
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=()",
      },
    ];
    if (process.env.NODE_ENV === "production") {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains",
      });
    }
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/closet",
        permanent: false,
      },
      {
        source: "/dashboard/:path*",
        destination: "/closet",
        permanent: false,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "tcsdez3brx.ufs.sh", pathname: "/**" },
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
