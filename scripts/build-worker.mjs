#!/usr/bin/env node
/**
 * build-worker — bundle the ingestion worker for the production image.
 *
 * The worker previously ran through tsx (a devDependency) inside the
 * container, which forced Dockerfile.worker to ship the full dev-inclusive
 * node_modules (2026-07-13 audit, finding 12). This bundles worker/index.ts
 * and every repo-local import into a single ESM file so the runtime stage
 * needs only production node_modules.
 *
 * - `packages: "external"`: npm packages are NOT bundled; they resolve from
 *   the image's production node_modules exactly as they do under tsx today,
 *   so native/binary packages and package-internal asset loading keep working.
 * - `server-only` alias: src/lib/env.ts starts with `import "server-only"`,
 *   which throws outside the Next bundler. run-tsx.mjs stubs it with a module
 *   hook at runtime; this bundle resolves it to the same stub at build time
 *   (guarded by tests/tsx-server-only-runner.test.ts).
 * - `.mjs` output: the repo's package.json has no `"type": "module"`, so the
 *   extension is what marks the bundle as ESM.
 */
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

/**
 * Shared with tests/worker-bundle.test.ts, which resolve-checks externals.
 * @type {import("esbuild").BuildOptions}
 */
export const workerBuildOptions = {
  entryPoints: ["worker/index.ts"],
  outfile: "dist/worker/index.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  packages: "external",
  sourcemap: true,
  logLevel: "info",
  alias: {
    "server-only": "./tests/stubs/server-only.ts",
    // next's package.json has no `exports` map, so Node's ESM resolver needs
    // the explicit file: `import "next/server"` boots under tsx/Turbopack but
    // throws ERR_MODULE_NOT_FOUND under plain `node`. src/lib/http.ts pulls
    // this in. tests/worker-bundle.test.ts resolve-checks every external.
    "next/server": "next/server.js",
  },
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await build(workerBuildOptions);
}
