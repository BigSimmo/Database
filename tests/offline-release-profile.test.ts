import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("offline release profile wiring", () => {
  const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };

  it("preserves the provider-backed release gate and adds explicit offline commands", () => {
    expect(packageJson.scripts["eval:quality:release"]).not.toContain("offline");
    expect(packageJson.scripts["eval:quality:release:offline"]).toContain("--provider-mode offline");
    expect(packageJson.scripts["verify:release"]).toContain("eval:quality:release");
    expect(packageJson.scripts["verify:release"]).not.toContain("eval:quality:release:offline");
    expect(packageJson.scripts["verify:release:offline"]).toContain("verify-release-offline.mjs");
  });

  it("sanitizes provider credentials and keeps staging workflow variables OpenAI-free", () => {
    const evalRunner = readFileSync(join(process.cwd(), "scripts", "run-eval-safe.mjs"), "utf8");
    const releaseRunner = readFileSync(join(process.cwd(), "scripts", "verify-release-offline.mjs"), "utf8");
    const stagingWorkflow = readFileSync(join(process.cwd(), ".github", "workflows", "staging-tenancy.yml"), "utf8");
    for (const source of [evalRunner, releaseRunner]) {
      expect(source).toContain('RAG_PROVIDER_MODE: "offline"');
      expect(source).toContain('OPENAI_API_KEY: ""');
      expect(source).toContain('OPENAI_ORG_ID: ""');
      expect(source).toContain('OPENAI_PROJECT_ID: ""');
    }
    expect(stagingWorkflow).not.toMatch(/OPENAI_(?:API_KEY|ORG_ID|PROJECT_ID)/);
  });
});
