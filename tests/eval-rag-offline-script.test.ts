import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("offline RAG preflight wiring", () => {
  it("runs real RAG tests and the production preflight without provider credentials", () => {
    const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      scripts: Record<string, string>;
    };
    const cliPath = join(process.cwd(), "scripts", "eval-rag-offline.ts");
    const productionPath = join(process.cwd(), "scripts", "lib", "eval-rag-offline-production.ts");
    expect(packageJson.scripts["eval:rag:offline"]).toBe("node scripts/run-tsx.mjs scripts/eval-rag-offline.ts");
    expect(existsSync(cliPath)).toBe(true);
    expect(existsSync(productionPath)).toBe(true);

    const cli = readFileSync(cliPath, "utf8");
    const production = readFileSync(productionPath, "utf8");
    expect(cli).toContain("delete process.env[key]");
    expect(cli).toContain('process.env.RAG_PROVIDER_MODE = "auto"');
    expect(cli).toContain("scripts/run-vitest.mjs");
    expect(cli).toContain("tests/eval-retrieval.test.ts");
    expect(cli).toContain("tests/retrieval-selection.test.ts");
    expect(cli).toContain("tests/rag-routing.test.ts");
    expect(cli).toContain("tests/rag-answer-fallback.test.ts");
    expect(cli).toContain("tests/rag-trust.test.ts");
    expect(cli).toContain("tests/rag-injection.test.ts");
    expect(cli).toContain("runOfflineRagPreflight");
    for (const productionImport of [
      'import("@/lib/clinical-search")',
      'import("@/lib/rag")',
      'import("@/lib/retrieval-selection")',
      'import("@/lib/answer-render-policy")',
    ]) {
      expect(production).toContain(productionImport);
    }
    expect(production).toContain("analysis.queryClass === testCase.expectedQueryClass");
    expect(production).toContain("selectRetrievalEvidence");
    expect(production).toContain("parseAnswerJson");
    expect(production).toContain("buildAnswerRenderModel");
  });
});
