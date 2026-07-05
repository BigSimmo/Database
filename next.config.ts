import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const isDevelopment = process.env.NODE_ENV === "development";
const isLocalHttpRuntime = isDevelopment || process.env.PLAYWRIGHT_BASE_URL?.startsWith("http://localhost:");
const scriptSrc = `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}; `;
const upgradeInsecureRequests = isLocalHttpRuntime ? "" : "upgrade-insecure-requests; ";
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Origin-Agent-Cluster", value: "?1" },
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self'; " +
      "base-uri 'self'; " +
      "object-src 'none'; " +
      "frame-ancestors 'none'; " +
      "form-action 'self'; " +
      upgradeInsecureRequests +
      "img-src 'self' data: blob: https:; " +
      "media-src 'self' https:; " +
      "connect-src 'self' https://*.supabase.co https://api.openai.com; " +
      scriptSrc +
      "style-src 'self' 'unsafe-inline'",
  },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  ...(isLocalHttpRuntime
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

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
  async redirects() {
    return [
      {
        source: "/applications",
        destination: "/?mode=tools",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
