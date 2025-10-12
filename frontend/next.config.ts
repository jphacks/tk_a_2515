import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/terview",
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
    ],
  },
};

export default nextConfig;
