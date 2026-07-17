import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("standalone TSX server-only compatibility", () => {
  it("routes package TSX commands through the server-only-aware runner", () => {
    const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      scripts: Record<string, string>;
    };
    const directTsx = Object.entries(packageJson.scripts).filter(([, command]) => command.startsWith("tsx "));
    expect(directTsx).toEqual([]);
    const bareTsxTargets = Object.entries(packageJson.scripts).filter(
      ([, command]) => /(^|&&\s*)tsx\s/.test(command) || command.includes("npx tsx"),
    );
    expect(bareTsxTargets).toEqual([]);
    expect(packageJson.scripts["check:production-readiness:ci"]).toContain("scripts/run-tsx.mjs");
    expect(packageJson.scripts["check:supabase-project"]).toContain("scripts/run-tsx.mjs");
  });

  it("boots the worker image from the server-only-safe esbuild bundle, not bare tsx", () => {
    const dockerfile = readFileSync(new URL("../Dockerfile.worker", import.meta.url), "utf8");
    const cmdLine = dockerfile.split(/\r?\n/).find((line) => line.trimStart().startsWith("CMD"));
    expect(cmdLine, "Dockerfile.worker must define a CMD").toBeDefined();
    // worker/index.ts imports src/lib/env, which is `import "server-only"`.
    // Bare tsx throws on that import at boot. The image runs the prebuilt
    // esbuild bundle, whose build (scripts/build-worker.mjs) aliases
    // `server-only` to the standalone stub — the same guarantee run-tsx.mjs
    // gave at runtime. Assert the exact exec-form vector so no bare-tsx
    // variant (["tsx", …], ["npx","tsx", …], tsx/dist/cli.mjs, or a reordered
    // command) can slip through.
    const bracket = cmdLine!.indexOf("[");
    expect(bracket, "worker CMD must use JSON exec form").toBeGreaterThan(-1);
    const execVector = JSON.parse(cmdLine!.slice(bracket)) as string[];
    expect(execVector).toEqual(["node", "dist/worker/index.mjs"]);
    // The bundle is only server-only-safe because the build stubs the marker;
    // lock that alias so a build-script edit can't silently drop it.
    const buildScript = readFileSync(new URL("../scripts/build-worker.mjs", import.meta.url), "utf8");
    expect(buildScript).toContain('"server-only": "./tests/stubs/server-only.ts"');
    // And the Dockerfile build stage must actually produce the bundle the CMD runs.
    expect(dockerfile).toContain("RUN node scripts/build-worker.mjs");
    expect(dockerfile).toContain("npm ci --omit=dev");
  });

  it("keeps the Next server-only marker while stubbing it only for standalone runners", () => {
    expect(readFileSync(new URL("../src/lib/env.ts", import.meta.url), "utf8")).toMatch(/^import ["']server-only["'];/);
    expect(readFileSync(new URL("../scripts/register-server-only.mjs", import.meta.url), "utf8")).toContain(
      'specifier === "server-only"',
    );
  });

  it("bounds Vitest workers and uses the shared non-destructive run lock", () => {
    const runner = readFileSync(new URL("../scripts/run-vitest.mjs", import.meta.url), "utf8");
    const config = readFileSync(new URL("../vitest.config.mts", import.meta.url), "utf8");
    expect(runner).toContain("acquireHeavyRunLock");
    expect(runner).not.toContain("taskkill");
    // Workers stay bounded to a finite default (tunable via VITEST_MAX_WORKERS) so a
    // parallel run can never spawn unlimited workers and thrash the host.
    expect(config).toMatch(
      /maxWorkers:\s*process\.env\.VITEST_MAX_WORKERS\s*\?\s*Number\(process\.env\.VITEST_MAX_WORKERS\)\s*:\s*\d+/,
    );
    expect(config).toContain("testTimeout: 30_000");
  });
});
