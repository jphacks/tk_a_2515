import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/peak-sight",
  assetPrefix: "/peak-sight",
  output: "standalone",
  turbopack: {
    root: path.resolve("./"),
  },
  outputFileTracingRoot: path.resolve("./"),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "yamareco.org",
      },
      {
        protocol: "https",
        hostname: "yamareco.info",
      },
      {
        protocol: "https",
        hostname: "imgu.web.nhk",
      },
    ],
  },
};

export default nextConfig;
