import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withSentryConfig } from "@sentry/nextjs";
import { buildSecurityHeaders, resolveRuntimeFlags } from "./src/lib/security-headers";
import { resolveSentryRelease } from "./src/lib/observability/sentry-release";
import { expectedSupabaseProject } from "./src/lib/supabase/project";
import { THERAPY_CATALOGUE_ASSETS } from "./src/components/therapy-compass/data/generated-assets";

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
  productionBrowserSourceMaps: shouldEnableSentrySourceMapUpload(),
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
    // Explicit responsive breakpoints for next/image. Leave minimumCacheTTL at
    // Next's default (60s): a day-long floor can retain optimizer output past
    // signed-URL lifetimes if a private preview ever omits `unoptimized`.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
    // Prefer AVIF (~20-30% smaller than WebP), falling back to WebP, for any
    // next/image output.
    formats: ["image/avif", "image/webp"],
    // Private signed document/image previews opt out of the optimizer at the
    // component level (`SignedImage` sets `unoptimized`). Do not raise
    // `minimumCacheTTL` as a "safety" cap for bearer URLs: it is a lower bound,
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
        // Static design-review assets under public/mockups remain intentionally
        // retrievable, but must not appear in search results. Next applies
        // headers before public-file handling, so this covers nested assets as
        // well as the app-route namespace without broadening to other files.
        source: "/mockups/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
      {
        // Therapy catalogues are content-addressed by the generator. A new data
        // revision gets a new URL, so browsers and the CDN can retain old bytes
        // without revalidation while an already-open client finishes using them.
        source: "/therapy-compass-data/:asset(therapies(?:-index)?\\.[a-f0-9]{16}\\.json)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        // Compatibility aliases for deployment-straddling clients. These names
        // stay stable across regenerations, so force revalidation instead of
        // inheriting the hashed-asset immutable policy above. Matched on the
        // REQUEST path, so the rewrite below does not pull the destination's
        // immutable policy onto the alias.
        source: "/therapy-compass-data/:asset(therapies(?:-index)?\\.json)",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
    ];
  },
  // Serve the unversioned catalogue aliases from the current content-addressed
  // asset instead of writing a byte-identical duplicate to disk. `useTherapyData`
  // falls back to these names when a bundle older than the one-deploy grace
  // generation names a hashed file that no longer exists, so the URLs must keep
  // working — but they cost 2.66 MB of duplicated payload in the working tree and
  // every Docker image when they were real files (5.33 MB mid-grace-window).
  //
  // `afterFiles` rather than `beforeFiles`: the alias files no longer exist, so
  // the rewrite is reached once the static handler finds nothing, and nothing
  // legitimate at these paths is shadowed. build-therapies-index.mjs --check
  // fails if an alias file reappears, since a real file would win over this
  // rewrite and then silently go stale on the next regeneration.
  async rewrites() {
    const alias = (name: string, asset: string) => ({
      source: `/therapy-compass-data/${name}`,
      destination: `/therapy-compass-data/${asset}`,
    });
    return {
      beforeFiles: [],
      afterFiles: [
        alias("therapies.json", THERAPY_CATALOGUE_ASSETS.full),
        alias("therapies-index.json", THERAPY_CATALOGUE_ASSETS.index),
      ],
      fallback: [],
    };
  },
};

function shouldEnableSentrySourceMapUpload() {
  return Boolean(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT);
}

export default async function loadNextConfig() {
  const baseConfig = await withOptionalBundleAnalyzer(nextConfig);

  if (!shouldEnableSentrySourceMapUpload()) {
    return baseConfig;
  }

  return withSentryConfig(baseConfig, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    release: { name: resolveSentryRelease() },
    silent: process.env.NODE_ENV === "production",
    // Browser telemetry is intentionally disabled by the repository privacy
    // policy, so there is no Sentry router-transition hook to register.
    suppressOnRouterTransitionStartWarning: true,
    sourcemaps: {
      disable: false,
      // Successor to the removed `hideSourceMaps` option: upload maps to
      // Sentry, never serve them publicly.
      deleteSourcemapsAfterUpload: true,
    },
    widenClientFileUpload: true,
  });
}
