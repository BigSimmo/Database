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

  it("publishes the five answer states and current EmptyState hooks", () => {
    const config = JSON.parse(fs.readFileSync(path.join(root, ".design-sync/config.json"), "utf8"));
    expect(config.dtsPropsFor.AnswerCard).toContain('"ungrounded"');
    expect(config.dtsPropsFor.VerificationNotice).toContain("attribution?:");
    expect(config.dtsPropsFor.EmptyState).toContain("headingLevel?: 2 | 3 | 4 | 5 | 6");
    expect(config.dtsPropsFor.EmptyState).toContain("testId?: string");
  });
});
