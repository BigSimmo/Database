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
});
