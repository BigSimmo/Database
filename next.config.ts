import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSecurityHeaders } from "./src/lib/security-headers";

const isDevelopment = process.env.NODE_ENV === "development";
const isLocalHttpRuntime = isDevelopment || process.env.PLAYWRIGHT_BASE_URL?.startsWith("http://localhost:");
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const securityHeaders = buildSecurityHeaders({ isDevelopment, isLocalHttpRuntime: Boolean(isLocalHttpRuntime) });

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    cpus: 1,
    optimizePackageImports: ["lucide-react"],
  },
  poweredByHeader: false,
  turbopack: {
    root: projectRoot,
  },
  webpack(config) {
    // Avoid a Next/webpack WasmHash worker crash observed on Node 24 during local production builds.
    config.output = {
      ...config.output,
      hashFunction: "sha256",
    };
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
