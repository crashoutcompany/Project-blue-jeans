import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "tcsdez3brx.ufs.sh", pathname: "/**" },
    ],
  },
};

export default withWorkflow(nextConfig);
