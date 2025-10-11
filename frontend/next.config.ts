import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/terview",
  turbopack: {
    root: path.resolve("./"),
  },
  outputFileTracingRoot: path.resolve("./"),
  env: {
    NEXT_PUBLIC_BASE_URL: "http://localhost:8000",
  },
};

export default nextConfig;
