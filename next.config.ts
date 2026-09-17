import type { NextConfig } from "next";

import { withAppDefaults } from "./lib/next-config";

const nextConfig: NextConfig = withAppDefaults({
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
