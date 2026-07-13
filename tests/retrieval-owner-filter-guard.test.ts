import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Guard for the retrieval owner-scope boundary (48h-review finding #3).
//
// The SQL `retrieval_owner_matches(owner_filter, row_owner_id)` now fails CLOSED when
// `owner_filter IS NULL` (migration 20260708160001_retrieval_owner_matches_fail_closed), and
// src/lib/owner-scope.ts no longer emits null — so the database has a real tenant floor. This
// test remains as defense-in-depth on the app side: no `.rpc(...)` call in `src/` may pass a
// *literal* null/undefined `owner_filter`, and every owner_filter value must come from the
// sanctioned scope helpers (which fail closed in production) or the public sentinel — never a
// raw/unaudited value.

const SRC_DIR = join(process.cwd(), "src");

// Sanctioned right-hand sides for an `owner_filter` / `p_owner_filter` RPC argument.
const SANCTIONED_SOURCES = [
  /^retrievalOwnerFilter\(/,
  /^requireOwnerScope\(/,
  /^ownerScopeForDocumentFilteredRetrieval\(/,
  /^PUBLIC_OWNER_FILTER_SENTINEL\b/,
  // corpus-grounding threads through the exact scope it was handed; documented safe because rag.ts
  // derives `args.ownerFilter` from ownerScopeForDocumentFilteredRetrieval (never a raw null in prod).
  /^args\.ownerFilter\b/,
  // Versioned-RPC rollout adapters derive these locals from RetrievalAccessScope before
  // issuing exact-owner and public-sentinel legacy calls.
  /^ownerFilter\b/,
  /^scope\.ownerId\b/,
  /^accessScope\.ownerId\b/,
];

const OWNER_FILTER_ARG = /\b(?:p_)?owner_filter\s*:\s*(.+?)\s*,?\s*$/;

function sourceFiles(dir: string): string[] {
  // `recursive: true` without `withFileTypes` returns relative paths as strings — avoids the
  // Dirent.parentPath/path typing churn across @types/node versions.
  return readdirSync(dir, { recursive: true })
    .map((entry) => String(entry))
    .filter((name) => /\.tsx?$/.test(name) && !name.endsWith(".d.ts") && !name.includes("database.types"))
    .map((name) => join(dir, name));
}

describe("retrieval owner_filter callsite guard (finding #3)", () => {
  it("routes every owner_filter RPC argument through a sanctioned scope source (never literal null)", () => {
    const offenders: string[] = [];
    let checked = 0;

    for (const file of sourceFiles(SRC_DIR)) {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
        const match = trimmed.match(OWNER_FILTER_ARG);
        if (!match) return;

        checked += 1;
        const rhs = match[1].trim();
        const location = `${file.replace(process.cwd(), "").replace(/\\/g, "/")}:${index + 1}`;
        if (/^(null|undefined)\b/.test(rhs)) {
          offenders.push(`${location} — literal ${rhs}`);
        } else if (!SANCTIONED_SOURCES.some((pattern) => pattern.test(rhs))) {
          offenders.push(`${location} — unsanctioned owner_filter source: ${rhs}`);
        }
      });
    }

    // Fail loudly if the scan matched nothing (e.g. the RPC param was renamed) rather than passing vacuously.
    expect(
      checked,
      "found no owner_filter RPC callsites to guard — has the param name changed?",
    ).toBeGreaterThanOrEqual(5);
    expect(
      offenders,
      `owner_filter must come from retrievalOwnerFilter / requireOwnerScope / ` +
        `ownerScopeForDocumentFilteredRetrieval / PUBLIC_OWNER_FILTER_SENTINEL — never a raw or null value:\n` +
        offenders.join("\n"),
    ).toEqual([]);
  });
});
