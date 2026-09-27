import { describe, expect, it } from "vitest";

import { ISOBAR_HEADINGS, ISOBAR_SOURCE } from "@/lib/on-call/isobar-source";

describe("iSoBAR source slot", () => {
  it("either ships a WA source with its headings, or ships nothing", () => {
    if (ISOBAR_SOURCE === null) {
      expect(ISOBAR_HEADINGS).toEqual([]);
      return;
    }
    const url = new URL(ISOBAR_SOURCE.url);
    expect(url.protocol).toBe("https:");
    expect(url.hostname).toMatch(/(^|\.)wa\.gov\.au$/);
    expect(ISOBAR_SOURCE.readOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(ISOBAR_HEADINGS.map((row) => row.letter).join("")).toBe("iSoBAR");
  });
});
