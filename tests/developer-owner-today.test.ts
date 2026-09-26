import { describe, expect, it } from "vitest";

import { loadLedgerSnapshot, type LedgerOpenItem } from "@/lib/developer-area/ledger-snapshot";
import { openPrivacyItems, ownerDecisionItems, resolveOwnerToday } from "@/lib/developer-area/owner-today";

function item(id: string, summary: string, priority = "P2", detail = ""): LedgerOpenItem {
  return { id, priority, type: "task", summary, detail, source: "", added: "" };
}

describe("owner panel — decisions waiting on the owner", () => {
  it("matches the wordings the ledger uses for owner-only items", () => {
    const matched = ownerDecisionItems([
      item("#A", "Owner decision: enable a flag"),
      item("#B", "Owner design decision: first publication"),
      item("#C", "Clinical owner sign-off for three sources"),
      item("#D", "Sixteen candidate sources await owner review"),
      item("#E", "No deliberate tests; owner to confirm the behaviour"),
      item("#F", "Six sources need a fresh owner review"),
    ]).map((entry) => entry.id);
    expect(matched).toEqual(["#A", "#B", "#C", "#D", "#E", "#F"]);
  });

  it("ignores items that only mention the owner in their detail", () => {
    expect(ownerDecisionItems([item("#X", "Fix the parser", "P1", "Owner decision recorded 2026-08-01")])).toEqual([]);
  });

  it("lists P1 before P2 before P3", () => {
    const ordered = ownerDecisionItems([
      item("#3", "Owner decision: c", "P3"),
      item("#1", "Owner decision: a", "P1"),
      item("#2", "Owner decision: b", "P2"),
    ]).map((entry) => entry.priority);
    expect(ordered).toEqual(["P1", "P2", "P3"]);
  });
});

describe("owner panel — privacy items", () => {
  it("lists every requirement that is not verified, with a plain name", () => {
    const items = openPrivacyItems({
      reviewExpiresAt: "2026-12-01",
      requirements: [
        { id: "PRIV-CODE-QUERY-HASH", status: "verified" },
        { id: "PRIV-LEGAL-OPENAI-DPA", status: "pending" },
        { id: "PRIV-NEW-UNLABELLED", status: "partial", reviewExpiresAt: "2026-11-01" },
      ],
    });
    expect(items).toEqual([
      {
        id: "PRIV-LEGAL-OPENAI-DPA",
        label: "OpenAI data processing agreement",
        status: "pending",
        reviewBy: "2026-12-01",
      },
      { id: "PRIV-NEW-UNLABELLED", label: "PRIV-NEW-UNLABELLED", status: "partial", reviewBy: "2026-11-01" },
    ]);
  });

  it("reads the committed register", () => {
    const items = openPrivacyItems();
    for (const entry of items) expect(entry.status).not.toBe("verified");
  });
});

describe("owner panel — today facts from committed files", () => {
  it("resolves without a network read", () => {
    const today = resolveOwnerToday(loadLedgerSnapshot());
    expect(Array.isArray(today.decisions)).toBe(true);
    expect(Number.isInteger(today.uncontrolledHazards)).toBe(true);
  });
});
