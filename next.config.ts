import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  async redirects() {
    return [
      // Closet UI lives on /dashboard (post-login home). Keep /closet as an alias.
      { source: "/closet", destination: "/dashboard", permanent: false },
      { source: "/closet/:path*", destination: "/dashboard", permanent: false },
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
