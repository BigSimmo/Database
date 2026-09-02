import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../.github/workflows/live-domain-monitor.yml", import.meta.url), "utf8");

describe("live domain monitor workflow", () => {
  it("accepts descriptive server-rendered titles that retain the PsychSift brand", () => {
    expect(workflow).toContain("grep -Eq '<title>[^<]*PsychSift[^<]*</title>'");
  });
});
