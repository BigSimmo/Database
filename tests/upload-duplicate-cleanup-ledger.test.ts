import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const uploadRoute = readFileSync(new URL("../src/app/api/upload/route.ts", import.meta.url), "utf8");

describe("duplicate upload cleanup ledger", () => {
  it("fails closed when storage.remove fails and the cleanup ledger insert also fails", () => {
    expect(uploadRoute).toContain('from("storage_cleanup_jobs").insert({');
    expect(uploadRoute).toContain("const { error: cleanupLedgerError }");
    expect(uploadRoute).toContain("Duplicate upload cleanup ledger insert failed");
    expect(uploadRoute).toMatch(/if \(cleanupLedgerError\) \{[\s\S]*throw new Error\(/);
  });
});
