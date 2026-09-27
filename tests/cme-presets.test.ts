import { describe, expect, it } from "vitest";

import { CME_PRESET_VERSION, createAustralianRanzcpPreset, describeConfirmedSource } from "@/lib/cme/presets";

describe("the confirmed source, as a person reads it", () => {
  it("names the starting preset in words instead of its internal id and links", () => {
    const stored = createAustralianRanzcpPreset(2026, "2026-01-05").confirmedSource;
    expect(stored.startsWith(CME_PRESET_VERSION)).toBe(true);
    expect(describeConfirmedSource(stored)).toBe("RANZCP (Medical Board baseline plus RANZCP peer review)");
    expect(describeConfirmedSource(stored)).not.toContain(CME_PRESET_VERSION);
    expect(describeConfirmedSource(CME_PRESET_VERSION)).toBe("RANZCP (Medical Board baseline plus RANZCP peer review)");
    // A later version of the preset is named the same way, never shown as its raw id.
    expect(describeConfirmedSource("au-ranzcp-2027-v2; https://example.org/guide")).toBe(
      "RANZCP (Medical Board baseline plus RANZCP peer review)",
    );
  });

  it("keeps anything the owner added after the preset, so the printed summary loses nothing of theirs", () => {
    const stored = createAustralianRanzcpPreset(2026, "2026-01-05").confirmedSource;
    expect(describeConfirmedSource(`${stored}; Demo hospital CPD policy, checked 5 Jan`)).toBe(
      "RANZCP (Medical Board baseline plus RANZCP peer review); Demo hospital CPD policy, checked 5 Jan",
    );
  });

  it("keeps the owner's own words, trimmed", () => {
    expect(describeConfirmedSource("  Demo CPD home guide, 2026 edition  ")).toBe("Demo CPD home guide, 2026 edition");
  });

  it("says so plainly when no source was recorded", () => {
    expect(describeConfirmedSource("")).toBe("Your own targets");
    expect(describeConfirmedSource("   ")).toBe("Your own targets");
  });
});
