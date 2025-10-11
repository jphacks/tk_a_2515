import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/terview",
  turbopack: {
    root: path.resolve("./"),
  },
  outputFileTracingRoot: path.resolve("./"),
  images: {
    domains: ["yamareco.org", "yamareco.info"],
  },
};

export default nextConfig;
