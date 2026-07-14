import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSecurityHeaders, resolveRuntimeFlags } from "./src/lib/security-headers";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

// Static (non-CSP) headers for every route. The nonce'd CSP is emitted per
// request from src/proxy.ts; both derive their runtime flags from the same helper.
const securityHeaders = buildSecurityHeaders(resolveRuntimeFlags());

// Opt-in bundle analysis (npm run build:analyze). The analyzer is a devDependency
// loaded lazily so production runtimes (pruned node_modules) never import it.
async function withOptionalBundleAnalyzer(config: NextConfig): Promise<NextConfig> {
  if (process.env.ANALYZE !== "true") return config;
  const { default: bundleAnalyzer } = await import("@next/bundle-analyzer");
  return bundleAnalyzer({ enabled: true })(config);
}

const nextConfig: NextConfig = {
  // Playwright and some local tooling hit the dev server via 127.0.0.1; without
  // this, Next blocks HMR/client hydration from that host and phone scroll-hide
  // never wires up its listeners.
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
  experimental: {
    cpus: 1,
    optimizePackageImports: ["lucide-react"],
    // Proxy is on every API route. Bound its buffered client body so a
    // chunked multipart upload cannot grow without limit before route code
    // reaches request.formData(). MAX_UPLOAD_MB is capped at 150 below this
    // 151 MiB transport envelope (1 MiB reserved for multipart framing).
    proxyClientMaxBodySize: "151mb",
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

export default withOptionalBundleAnalyzer(nextConfig);
