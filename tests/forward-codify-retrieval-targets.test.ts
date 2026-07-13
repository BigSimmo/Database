import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Guards drift backlog item 0 (docs/forward-codify-retrieval-rpcs-workorder.md):
// the read-only capture query scripts/sql/capture-live-retrieval-rpcs.sql must
// target exactly the retrieval RPCs still flagged "LIVE IS AHEAD" in the drift
// allowlist. Reconciling a sibling (removing its allowlist entry) then forces a
// matching edit to the capture query, so the work-order artifact cannot silently
// rot as the backlog is worked down.

const root = join(__dirname, "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

// Allowlist entries the work-order treats as its authoritative target set.
const LIVE_AHEAD_PREFIX = "LIVE IS AHEAD";

type AllowlistEntry = { category: string; kind: string; key: string; reason: string };

function liveAheadRetrievalSignatures(): string[] {
  const { entries } = JSON.parse(read("supabase/drift-allowlist.json")) as { entries: AllowlistEntry[] };
  return entries
    .filter((e) => e.category === "functions" && e.kind === "mismatch" && e.reason.startsWith(LIVE_AHEAD_PREFIX))
    .map((e) => e.key)
    .sort();
}

function captureQuerySignatures(): string[] {
  const sql = read("scripts/sql/capture-live-retrieval-rpcs.sql");
  const start = sql.indexOf(">>> forward-codify targets >>>");
  const end = sql.indexOf("<<< forward-codify targets <<<");
  expect(start, "capture query is missing its `>>> forward-codify targets >>>` marker").toBeGreaterThanOrEqual(0);
  expect(end, "capture query is missing its `<<< forward-codify targets <<<` marker").toBeGreaterThan(start);
  const region = sql.slice(start, end);
  // Signatures are single-quoted VALUES literals; regprocedure text never
  // contains a single quote, so this is an exact extraction.
  const matches = [...region.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  return matches.sort();
}

describe("forward-codify retrieval target set stays in sync with the drift allowlist", () => {
  it("has no unresolved live-ahead retrieval functions after reconciliation", () => {
    expect(liveAheadRetrievalSignatures()).toEqual([]);
  });

  it("the capture query lists every live-ahead retrieval signature, and only those", () => {
    expect(captureQuerySignatures()).toEqual(liveAheadRetrievalSignatures());
  });

  it("the capture query has no duplicate target signatures", () => {
    const signatures = captureQuerySignatures();
    expect(new Set(signatures).size).toBe(signatures.length);
  });
});
