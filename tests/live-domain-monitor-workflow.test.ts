import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../.github/workflows/live-domain-monitor.yml", import.meta.url), "utf8");

describe("live domain monitor workflow", () => {
  it("accepts descriptive server-rendered titles that retain the PsychSift brand", () => {
    expect(workflow).toContain("grep -Eq '<title>[^<]*PsychSift[^<]*</title>'");
  });

  // Every probe in this workflow was green throughout the seven-day search outage, because all of
  // them measured status codes and a search returning nothing is a 200. The step that asserts
  // results must not be quietly dropped, and it needs its script on disk to run at all.
  it("asserts live search results, not just status codes", () => {
    expect(workflow).toContain("run: node scripts/check-live-search-results.mjs");
    // The sparse checkout is what puts it on disk; listing only its sibling would fail at runtime.
    expect(workflow).toMatch(/sparse-checkout: \|\n(?:\s+scripts\/\S+\n)*\s+scripts\/check-live-search-results\.mjs\n/);
  });
});
