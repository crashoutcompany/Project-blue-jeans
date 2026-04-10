import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "tcsdez3brx.ufs.sh", pathname: "/**" },
    ],
  },
};

export default nextConfig;
