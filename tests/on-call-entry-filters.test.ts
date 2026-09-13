import { describe, expect, it } from "vitest";

import {
  ON_CALL_FILTER_ALL,
  onCallEntryMatchesFilter,
  onCallFilterOptions,
  onCallTagFacet,
} from "@/lib/on-call/entry-filters";
import { type OnCallEntry } from "@/lib/on-call/entry-model";

function entry(slug: string, tags: string[]): OnCallEntry {
  return {
    id: slug,
    slug,
    section: "referrals",
    title: slug,
    subtitle: null,
    body: null,
    details: {},
    tags,
    linkedDocumentIds: [],
    isPersonal: false,
    sortOrder: 0,
    lastVerifiedAt: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  } as unknown as OnCallEntry;
}

describe("onCallFilterOptions", () => {
  it("puts All in front of every value present, in first-seen order", () => {
    const options = onCallFilterOptions([entry("a", ["Youth"]), entry("b", ["Community"])], onCallTagFacet);
    expect(options).toEqual([ON_CALL_FILTER_ALL, "Youth", "Community"]);
  });

  it("lists a value once however many entries carry it", () => {
    const options = onCallFilterOptions(
      [entry("a", ["Youth"]), entry("b", ["Youth", "Community"]), entry("c", ["Youth"])],
      onCallTagFacet,
    );
    expect(options).toEqual([ON_CALL_FILTER_ALL, "Youth", "Community"]);
  });

  it("offers no row when there is nothing to choose between", () => {
    // A chip row reading "All | Wards" over a list where everything is a ward
    // is furniture, and a tap on either chip changes nothing.
    expect(onCallFilterOptions([entry("a", ["Wards"]), entry("b", ["Wards"])], onCallTagFacet)).toEqual([]);
    expect(onCallFilterOptions([entry("a", [])], onCallTagFacet)).toEqual([]);
    expect(onCallFilterOptions([], onCallTagFacet)).toEqual([]);
  });

  it("ignores blank and whitespace-only values", () => {
    const options = onCallFilterOptions([entry("a", ["  ", "Youth"]), entry("b", ["Community"])], onCallTagFacet);
    expect(options).toEqual([ON_CALL_FILTER_ALL, "Youth", "Community"]);
  });
});

describe("onCallEntryMatchesFilter", () => {
  it("keeps everything under All and under no selection", () => {
    const row = entry("a", ["Youth"]);
    expect(onCallEntryMatchesFilter(row, onCallTagFacet, ON_CALL_FILTER_ALL)).toBe(true);
    expect(onCallEntryMatchesFilter(row, onCallTagFacet, null)).toBe(true);
  });

  it("keeps only entries carrying the active value", () => {
    expect(onCallEntryMatchesFilter(entry("a", ["Youth"]), onCallTagFacet, "Youth")).toBe(true);
    expect(onCallEntryMatchesFilter(entry("a", ["Community"]), onCallTagFacet, "Youth")).toBe(false);
  });

  it("never hides an untagged entry", () => {
    // Withholding a number because nobody tagged it is the failure this mode
    // exists to prevent.
    expect(onCallEntryMatchesFilter(entry("a", []), onCallTagFacet, "Youth")).toBe(true);
    expect(onCallEntryMatchesFilter(entry("a", ["   "]), onCallTagFacet, "Youth")).toBe(true);
  });
});
