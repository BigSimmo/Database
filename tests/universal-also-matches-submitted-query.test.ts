import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * THE DEFECT. On a phone dashboard result view, editing the bottom composer calls `setQuery`
 * alone: the results and `modeSearchSubmitted` both stay as they were. The cross-mode
 * also-matches lookup was keyed on `query`, so a paused draft fetched matches for a search the
 * reader never ran, replaced the tray and its "N related modes" count, and left those matches
 * disagreeing with the primary cards still on screen for the last submitted query.
 *
 * The fix keys the lookup on the submitted query instead. These assertions read the shipped
 * source, because the behaviour lives in how ClinicalDashboard derives one value and cannot be
 * reached without mounting the whole dashboard.
 */
const DASHBOARD = readFileSync(join(__dirname, "..", "src/components/ClinicalDashboard.tsx"), "utf8");

function sourceOf(pattern: RegExp): string {
  const match = DASHBOARD.match(pattern);
  expect(match, `expected to find ${pattern}`).toBeTruthy();
  return match![0];
}

describe("cross-mode also-matches follows the submitted query, not the draft", () => {
  it("derives the lookup query from submittedModeQuery rather than the live composer query", () => {
    const derivation = sourceOf(/const universalAlsoMatchesQuery =[\s\S]*?;\n/);
    expect(derivation).toContain("submittedModeQuery ?? query");
    // The regression this guards: the whole non-answer arm used to be the bare draft.
    expect(derivation).not.toMatch(/:\s*query;\s*$/);
  });

  it("keeps answer mode on the generated answer's query", () => {
    const derivation = sourceOf(/const universalAlsoMatchesQuery =[\s\S]*?;\n/);
    expect(derivation).toContain('activeModeResultKind === "answer" ? (latestAnswerQuery ?? query)');
  });

  it("holds submittedModeQuery separately from query, so typing cannot move it", () => {
    expect(DASHBOARD).toMatch(/const \[submittedModeQuery, setSubmittedModeQuery\] = useState<string \| null>/);
    // Nothing may write the submitted query except the submission wrapper, or a composer edit
    // would reach it after all.
    const writes = [...DASHBOARD.matchAll(/setSubmittedModeQuery\(/g)];
    expect(writes.length).toBe(2);
    const wrapper = sourceOf(/const setModeSearchSubmitted = useCallback\([\s\S]*?\n  \}, \[\]\);/);
    expect((wrapper.match(/setSubmittedModeQuery\(/g) ?? []).length).toBe(2);
  });

  it("records the submitted text at every submission, and clears it when submission is cleared", () => {
    const submissions = [...DASHBOARD.matchAll(/setModeSearchSubmitted\(true[^)]*\)/g)].map((m) => m[0]);
    expect(submissions.length).toBeGreaterThan(0);
    // Every submission passes the text it submitted; a bare `true` would leave the previous
    // query in place and reintroduce the mismatch.
    for (const call of submissions) {
      expect(call, `submission without its query: ${call}`).toMatch(/setModeSearchSubmitted\(true, \S+\)/);
    }
    const wrapper = sourceOf(/const setModeSearchSubmitted = useCallback\([\s\S]*?\n  \}, \[\]\);/);
    expect(wrapper).toContain("if (!submitted) setSubmittedModeQuery(null);");
  });

  it("seeds the submitted query from an auto-run URL, so a restored result view is not blank", () => {
    const seed = sourceOf(/const \[submittedModeQuery, setSubmittedModeQuery\][\s\S]*?\);\n/);
    expect(seed).toContain("autoRunSearch");
    expect(seed).toContain("initialQuery.trim()");
    expect(seed).toContain('initialSearchMode !== "tools"');
  });
});

/**
 * The lookup itself is gated on this query, so with the draft no longer reaching it, typing
 * without pressing Enter changes neither the request nor the count.
 */
describe("the also-matches lookup is gated on that query", () => {
  const PANEL = readFileSync(
    join(__dirname, "..", "src/components/clinical-dashboard/universal-search-also-matches.tsx"),
    "utf8",
  );

  it("enables the fetch only from the query it was given", () => {
    expect(PANEL).toMatch(/enabled: trimmedQuery\.length >= 2 && searchActive/);
    expect(PANEL).toMatch(/query: trimmedQuery,/);
  });

  it("renders its count from the same query, so the closed row cannot describe a draft", () => {
    expect(PANEL).toContain("universal.query === trimmedQuery");
  });
});
