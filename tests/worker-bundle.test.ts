import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { describe, expect, it } from "vitest";
import { workerBuildOptions } from "../scripts/build-worker.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

/**
 * The worker image runs the esbuild bundle under plain `node` with
 * production-only node_modules (Dockerfile.worker). Two failure modes are
 * invisible to tsx/vitest and only surface at container boot:
 *  1. an external import Node's strict ESM resolver can't resolve (e.g.
 *     `next/server` — next has no `exports` map, so the explicit
 *     `next/server.js` file is required);
 *  2. an external that only exists because of a devDependency, which
 *     `npm ci --omit=dev` prunes from the runtime stage.
 * This test rebuilds the bundle in-memory and checks every external against
 * both, so the class of bug is caught in CI instead of at deploy.
 */
describe("worker production bundle", () => {
  it("keeps every external import resolvable under plain node with prod-only deps", async () => {
    const result = await build({
      ...workerBuildOptions,
      write: false,
      metafile: true,
      sourcemap: false,
      logLevel: "silent",
    });
    if (!result.metafile) throw new Error("esbuild did not return a metafile");
    const externals = new Set<string>();
    for (const output of Object.values(result.metafile.outputs)) {
      for (const imported of output.imports ?? []) {
        if (imported.external) externals.add(imported.path);
      }
    }
    expect(externals.size).toBeGreaterThan(0);
    // server-only must be compiled into the bundle as the stub, never left
    // external — the production image has no runtime loader hook.
    expect([...externals]).not.toContain("server-only");

    const bareSpecs = [...externals].filter((spec) => !spec.startsWith("node:")).sort();

    // (2) every external package must survive `npm ci --omit=dev`.
    const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8")) as {
      packages: Record<string, { dev?: boolean }>;
    };
    const devOnly = bareSpecs.filter((spec) => {
      const segments = spec.split("/");
      const pkgName = spec.startsWith("@") ? segments.slice(0, 2).join("/") : segments[0];
      const entry = lock.packages[`node_modules/${pkgName}`];
      return !entry || entry.dev === true;
    });
    expect(devOnly, "externals pruned by --omit=dev (import them from prod deps or bundle them)").toEqual([]);

    // (1) every external must resolve under Node's native ESM resolver (the
    // vitest/vite resolver is more lenient, so ask a plain node subprocess).
    const probe = [
      "import { existsSync } from 'node:fs';",
      "import { fileURLToPath } from 'node:url';",
      "const bad = [];",
      "for (const spec of JSON.parse(process.env.WORKER_BUNDLE_SPECS)) {",
      "  try {",
      "    const url = import.meta.resolve(spec);",
      "    if (url.startsWith('file:') && !existsSync(fileURLToPath(url))) bad.push(spec);",
      "  } catch { bad.push(spec); }",
      "}",
      "process.stdout.write(JSON.stringify(bad));",
    ].join("\n");
    const out = execFileSync(process.execPath, ["--input-type=module", "-e", probe], {
      cwd: repoRoot,
      env: { ...process.env, WORKER_BUNDLE_SPECS: JSON.stringify(bareSpecs) },
      encoding: "utf8",
    });
    expect(JSON.parse(out), "externals plain `node` cannot resolve at boot").toEqual([]);
  });
});
