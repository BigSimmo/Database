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

  it("boots the worker image through the server-only-aware runner, not bare tsx", () => {
    const dockerfile = readFileSync(new URL("../Dockerfile.worker", import.meta.url), "utf8");
    const cmdLine = dockerfile.split(/\r?\n/).find((line) => line.trimStart().startsWith("CMD"));
    expect(cmdLine, "Dockerfile.worker must define a CMD").toBeDefined();
    // worker/index.ts imports src/lib/env, which is `import "server-only"`.
    // Bare tsx throws on that import at boot; the entrypoint must route through
    // scripts/run-tsx.mjs, which registers the server-only stub hook.
    expect(cmdLine).toContain("scripts/run-tsx.mjs");
    expect(cmdLine).toContain("worker/index.ts");
    expect(cmdLine).not.toContain("tsx/dist/cli.mjs");
  });

  it("keeps the Next server-only marker while stubbing it only for standalone runners", () => {
    expect(readFileSync(new URL("../src/lib/env.ts", import.meta.url), "utf8")).toMatch(/^import ["']server-only["'];/);
    expect(readFileSync(new URL("../scripts/register-server-only.mjs", import.meta.url), "utf8")).toContain(
      'specifier === "server-only"',
    );
  });

  it("bounds Vitest workers and scopes stale-process cleanup to this checkout", () => {
    const runner = readFileSync(new URL("../scripts/run-vitest.mjs", import.meta.url), "utf8");
    const config = readFileSync(new URL("../vitest.config.mts", import.meta.url), "utf8");
    expect(runner).toContain("const vitestNeedle = vitestBin.toLowerCase()");
    expect(runner).not.toContain("repoNeedle");
    expect(config).toContain("maxWorkers: 2");
    expect(config).toContain("testTimeout: 30_000");
  });
});
