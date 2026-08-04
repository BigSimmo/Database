import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");

describe("design-sync public contract", () => {
  it("keeps sources, entry exports, previews and published props in parity", () => {
    expect(() =>
      execFileSync(process.execPath, ["scripts/check-design-sync-contract.mjs"], { cwd: root, stdio: "pipe" }),
    ).not.toThrow();
  });

  it("publishes source-derived answer and EmptyState contracts", () => {
    const config = JSON.parse(fs.readFileSync(path.join(root, ".design-sync/config.json"), "utf8"));
    expect(config.dtsPropsFor.AnswerCard).toContain("DegradedAnswerState");
    expect(config.dtsPropsFor.VerificationNotice).toContain("attribution?:");
    expect(config.dtsPropsFor.VerificationNotice).toContain("presentation?:");
    expect(config.dtsPropsFor.EmptyState).toContain("headingLevel?: 2 | 3 | 4 | 5 | 6");
    expect(config.dtsPropsFor.EmptyState).toContain("testId?: string");
    expect(config.dtsPropsFor.EmptyState).toContain('live?: "off" | "assertive" | "polite"');
  });

  it("commits the preview compiler alias used by the publication tool", () => {
    const config = JSON.parse(fs.readFileSync(path.join(root, ".design-sync/config.json"), "utf8"));
    const previewTsconfig = JSON.parse(fs.readFileSync(path.join(root, config.tsconfig), "utf8"));
    expect(config.tsconfig).toBe(".design-sync/tsconfig.previews.json");
    expect(previewTsconfig.extends).toBe("../tsconfig.json");
    expect(previewTsconfig.compilerOptions.paths[config.pkg]).toEqual([".design-sync/entry.tsx"]);
  });

  it("publishes ISO provenance examples and all five answer states", () => {
    const answerCardPreview = fs.readFileSync(path.join(root, ".design-sync/previews/AnswerCard.tsx"), "utf8");
    const answerFooterPreview = fs.readFileSync(path.join(root, ".design-sync/previews/AnswerFooter.tsx"), "utf8");
    for (const state of ["ready", "stale_evidence", "partial_retrieval", "ungrounded", "source_only"]) {
      expect(answerCardPreview).toContain(`state: "${state}"`);
    }
    expect(answerCardPreview).toContain('reviewDate: "2026-05-18"');
    expect(answerCardPreview).toContain('generatedAt: "2026-07-31T13:04:00+08:00"');
    expect(answerFooterPreview).toContain('reviewDate="2026-05-18"');
    expect(answerFooterPreview).toContain('generatedAt="2026-07-31T13:04:00+08:00"');
    expect(`${answerCardPreview}\n${answerFooterPreview}`).not.toMatch(/\b\d{2}\/\d{2}\/\d{4}\b/);
  });
});
