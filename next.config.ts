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

// Gated Sentry build integration. Only wraps the config when a DSN is present, so
// a build WITHOUT Sentry configured is byte-for-byte unchanged (no plugin, no
// source-map step). Source-map upload additionally requires SENTRY_ORG/PROJECT/
// AUTH_TOKEN; without them the plugin still runs but silently skips upload. The
// runtime SDK is initialised separately in src/instrumentation*.ts.
async function withOptionalSentry(config: NextConfig): Promise<NextConfig> {
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) return config;
  const { withSentryConfig } = await import("@sentry/nextjs");
  return withSentryConfig(config, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    silent: !process.env.CI,
    // We hand-roll the tunnel route (src/app/api/monitoring/route.ts), so the SDK
    // must not also auto-generate one.
    tunnelRoute: false,
    // Keep the client bundle lean; upload is opt-in via SENTRY_AUTH_TOKEN.
    sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  }) as NextConfig;
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
  webpack(config, { webpack }) {
    // Avoid a Next/webpack WasmHash worker crash observed on Node 24 during local production builds.
    config.output = {
      ...config.output,
      hashFunction: "sha256",
    };
    // Build-time flag so the client Sentry SDK is fully tree-shaken out unless a
    // public DSN is set at build time. Next does NOT fold an UNSET NEXT_PUBLIC_*
    // var to a compile-time constant, so a plain `if (process.env.NEXT_PUBLIC_SENTRY_DSN)`
    // gate leaves the (large) dynamic import in the graph and its chunk on disk.
    // This literal boolean lets webpack dead-code-eliminate the whole block, so an
    // unconfigured build ships zero Sentry bytes. See src/instrumentation-client.ts.
    config.plugins.push(
      new webpack.DefinePlugin({
        __SENTRY_ENABLED__: JSON.stringify(Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN)),
      }),
    );
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

export default withOptionalBundleAnalyzer(nextConfig).then(withOptionalSentry);
