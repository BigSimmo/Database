import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("maturity governance documentation", () => {
  it("keeps the privacy assessment explicit about approval and operational evidence", () => {
    const pia = read("docs/privacy-impact-assessment.md");
    expect(pia).toContain("Status:** Draft for governance approval");
    expect(pia).toContain("Revised:** 2026-08-23");
    expect(pia).toMatch(/\| PIA-2 \| Mitigated \|/);
    expect(pia).toContain("PIA-1");
    expect(pia).toContain("remaining privacy governance launch blocker");
    expect(pia).not.toMatch(/PIA-1[^\n]*and \*\*PIA-2\*\*[^\n]*launch-blockers/);
  });

  it("records current schema parity without preserving superseded counts", () => {
    const staging = read("docs/staging-setup.md");
    const backlog = read("docs/operator-backlog.md");
    expect(staging).toContain("211 migration");
    expect(staging).toContain("20260820120000");
    expect(staging).not.toContain("staging now holds **194**");
    expect(backlog).toContain("aligned at 211 migration versions");
    expect(backlog).not.toMatch(/#1268|#1269/);
  });

  it("requires environment-only authenticated soak evidence and exact-SHA tenancy evidence", () => {
    for (const path of [
      "docs/audit/capacity-review.md",
      "docs/auth-connection-cap-runbook.md",
      "docs/launch-operator-runbook.md",
      "docs/staging-setup.md",
    ]) {
      const document = read(path);
      expect(document).toContain("SOAK_BEARER_TOKEN");
      expect(document).not.toContain('--bearer "$STAGING_ACCESS_TOKEN"');
    }
    const tenancy = read("docs/staging-tenancy-release-evidence.md");
    expect(tenancy).toContain("exact candidate SHA");
    expect(tenancy).toContain("both checkout and deployed SHAs");
    expect(tenancy).not.toContain("proven to be its ancestor");
  });

  it("documents the offline tenancy to auto load-profile transition on the same image", () => {
    const runbook = read("docs/launch-operator-runbook.md");
    expect(runbook).toContain("same candidate image");
    expect(runbook).toContain("RAG_PROVIDER_MODE=offline");
    expect(runbook).toContain("RAG_PROVIDER_MODE=auto");
    expect(runbook).toContain("Rehearse rollback");
  });

  it("does not retain stale source line numbers in PIA link labels", () => {
    const pia = read("docs/privacy-impact-assessment.md");
    expect(pia).not.toMatch(/\[[^\]\n]+\.(?:ts|tsx|sql):\d+(?:-\d+)?\]\(/);
  });
});
