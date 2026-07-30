import { describe, expect, it } from "vitest";
import { validateOutstandingIssues } from "../scripts/check-outstanding-issues.mjs";

function sampleLedger(overrides: { openRows?: string[]; resolvedRows?: string[]; nextId?: number } = {}) {
  const openRows = overrides.openRows ?? ["| #001 | P2 | task | open one | detail | session | 2026-07-29 |"];
  const resolvedRows = overrides.resolvedRows ?? ["| #002 | issue | closed one | fixed | 2026-07-30 |"];
  const nextId = overrides.nextId ?? 3;
  return [
    "# Ledger",
    "",
    `<!-- issues:next-id=${nextId} -->`,
    "",
    "## Open items",
    "",
    "| ID | Pri | Type | Summary | Detail | Source | Added |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...openRows,
    "",
    "## Resolved / archive",
    "",
    "| ID | Type | Summary | Outcome | Resolved |",
    "| --- | --- | --- | --- | --- |",
    ...resolvedRows,
    "",
  ].join("\n");
}

describe("outstanding-issues ledger guard", () => {
  it("accepts a unique id set with a forward next-id marker and union merge", () => {
    const result = validateOutstandingIssues({ markdown: sampleLedger(), mergeAttribute: "union" });
    expect(result.failures).toEqual([]);
    expect(result.idCount).toBe(2);
    expect(result.nextId).toBe(3);
  });

  it("rejects duplicate ids, stale markers, missing union merge, and conflict markers", () => {
    expect(
      validateOutstandingIssues({
        markdown: sampleLedger({ resolvedRows: ["| #001 | issue | collision | dropped | 2026-07-30 |"] }),
        mergeAttribute: "union",
      }).failures.some((failure) => failure.includes("duplicate issue id #001")),
    ).toBe(true); // padded form from the guard

    expect(
      validateOutstandingIssues({
        markdown: sampleLedger({ nextId: 2 }),
        mergeAttribute: "union",
      }).failures.some((failure) => failure.includes("strictly greater")),
    ).toBe(true);

    expect(
      validateOutstandingIssues({
        markdown: sampleLedger(),
        mergeAttribute: "",
      }).failures.some((failure) => failure.includes("merge=union")),
    ).toBe(true);

    expect(
      validateOutstandingIssues({
        markdown: `${sampleLedger()}<<<<<<< ours\n`,
        mergeAttribute: "union",
      }).failures.some((failure) => failure.includes("conflict marker")),
    ).toBe(true);
  });

  it("does not treat prose PR numbers as ledger row ids", () => {
    const markdown = sampleLedger({
      openRows: ["| #010 | P3 | rec | Mentions PR #001 in detail | keep | session | 2026-07-30 |"],
      resolvedRows: ["| #011 | issue | Mentions #001 again in outcome | ok | 2026-07-30 |"],
      nextId: 12,
    });
    const result = validateOutstandingIssues({ markdown, mergeAttribute: "union" });
    expect(result.failures).toEqual([]);
    expect(result.idCount).toBe(2);
  });
});
