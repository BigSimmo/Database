import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSecurityHeaders, resolveRuntimeFlags } from "./src/lib/security-headers";
import { expectedSupabaseProject } from "./src/lib/supabase/project";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const requestedDistDir = process.env.NEXT_DIST_DIR?.trim();
if (requestedDistDir && !/^\.next-playwright\/[a-z0-9-]+\/dist$/i.test(requestedDistDir)) {
  throw new Error("NEXT_DIST_DIR must be an owned .next-playwright/<run-id>/dist directory.");
}
const requestedTsConfigPath = process.env.NEXT_TSCONFIG_PATH?.trim();
if (requestedTsConfigPath && !/^\.next-playwright\/[a-z0-9-]+\/tsconfig\.json$/i.test(requestedTsConfigPath)) {
  throw new Error("NEXT_TSCONFIG_PATH must be an owned .next-playwright/<run-id>/tsconfig.json file.");
}

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
  distDir: requestedDistDir || ".next",
  ...(requestedTsConfigPath ? { typescript: { tsconfigPath: requestedTsConfigPath } } : {}),
  // Playwright and some local tooling hit the dev server via 127.0.0.1; without
  // this, Next blocks HMR/client hydration from that host and phone scroll-hide
  // never wires up its listeners.
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
  experimental: {
    // Default 1 is the safe fallback for a Node-24 webpack WasmHash worker crash
    // seen on constrained local builds (see the webpack hashFunction override
    // below). CI runners have the cores/memory to build in parallel, so raise it
    // there via NEXT_BUILD_CPUS without changing the local default.
    cpus: process.env.NEXT_BUILD_CPUS ? Number(process.env.NEXT_BUILD_CPUS) : 1,
    optimizePackageImports: ["lucide-react"],
    // Proxy is on every API route. Bound its buffered client body so a
    // chunked multipart upload cannot grow without limit before route code
    // reaches request.formData(). MAX_UPLOAD_MB is capped at 150 below this
    // 151 MiB transport envelope (1 MiB reserved for multipart framing).
    proxyClientMaxBodySize: "151mb",
  },
  poweredByHeader: false,
  images: {
    // Prefer AVIF (~20-30% smaller than WebP), falling back to WebP, for any
    // next/image output.
    formats: ["image/avif", "image/webp"],
    // Private signed document/image previews opt out of the optimizer at the
    // component level (`SignedImage` sets `unoptimized`). Do not rely on
    // `minimumCacheTTL` as an expiry cap for bearer URLs: it is a lower bound,
    // and stale-while-revalidate can keep serving private bytes past the
    // signed-URL lifetime without re-entering the authenticated signed-URL route.
    // Permit optimizing other Supabase Storage URLs through next/image when a
    // caller intentionally uses the optimizer. Scoped to this app's exact
    // production and (when configured) staging project hostnames, not the
    // wildcard *.supabase.co.
    remotePatterns: (() => {
      const allowedHostnames = [expectedSupabaseProject.ref + ".supabase.co"];
      const stagingRef = process.env.SUPABASE_STAGING_PROJECT_REF?.trim();
      if (stagingRef) {
        allowedHostnames.push(stagingRef + ".supabase.co");
      }
      return allowedHostnames.map((hostname) => ({
        protocol: "https" as const,
        hostname,
        pathname: "/storage/v1/object/**",
      }));
    })(),
  },
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
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/offline.html",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
          },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
    ];
  },
};

export default withOptionalBundleAnalyzer(nextConfig);
