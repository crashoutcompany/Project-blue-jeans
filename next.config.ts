import type { NextConfig } from "next";

import { withAppDefaults } from "./lib/next-config";

const isDev = process.env.NODE_ENV !== "production";

/**
 * App-specific CSP (the shared defaults in lib/next-config.ts set the rest).
 * Next's inline RSC bootstrap needs 'unsafe-inline' without a nonce setup;
 * the policy still blocks foreign script hosts, plugins, framing, and
 * <base> hijacks. browser-image-compression's worker imports its bundle from
 * jsDelivr; UploadThing uploads PUT to *.ingest.uploadthing.com and photos
 * are served from *.ufs.sh after the /api/media redirect.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net${isDev ? " 'unsafe-eval'" : ""}`,
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://*.uploadthing.com https://*.ufs.sh${isDev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = withAppDefaults({
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
        ],
      },
    ];
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
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
});

export default nextConfig;
