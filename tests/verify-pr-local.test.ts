import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const script = path.resolve("scripts/verify-pr-local.mjs");

function dryRun(files: string, ...args: string[]) {
  return execFileSync(process.execPath, [script, "--dry-run", "--files", files, ...args], {
    encoding: "utf8",
  });
}

describe("verify-pr-local CLI", () => {
  it("uses the explicit file list and does not execute checks in dry-run mode", () => {
    const output = dryRun("docs/frontend-architecture.md");

    expect(output).toContain("Changed files: docs/frontend-architecture.md");
    expect(output).toContain("PR-local verification plan (dry run)");
    expect(output).toContain("- npm run check:runtime");
    expect(output).toContain("- npm run format:changed");
    expect(output).toContain("- build skipped");
    expect(output).not.toContain("\n> npm run ");
  });

  it("selects build, offline RAG, and extended UI checks for affected source", () => {
    const output = dryRun("src/app/api/answer/stream/route.ts", "--extended");

    expect(output).toContain("- npm run build");
    expect(output).toContain("- npm run check:rag:fixtures");
    expect(output).not.toContain("- npm run eval:rag:offline");
    expect(output).toContain("- npm run verify:ui");
  });

  it("requires explicit approval before executing the extended plan", () => {
    const result = spawnSync(process.execPath, [script, "--extended", "--files", "docs/frontend-architecture.md"], {
      encoding: "utf8",
      env: { ...process.env, ALLOW_EXTENDED_PR_LOCAL: "" },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("ALLOW_EXTENDED_PR_LOCAL=true");
  });
});
