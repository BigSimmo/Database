import { describe, expect, it } from "vitest";

import { onCallEntryGroups } from "@/components/on-call/on-call-entry-groups";
import { onCallTagFacet } from "@/lib/on-call/entry-filters";
import type { OnCallEntry } from "@/lib/on-call/entry-model";

/**
 * The grouping that replaced the chip rows on Contacts, Referrals and
 * Orientation. All three filed by the same facet the page groups by, so a chip
 * named a heading further down the page and a row in the in-page header's jump
 * list — and, unlike either, it HID the other groups when tapped.
 */
function entry(slug: string, tags: string[]): OnCallEntry {
  return {
    id: slug,
    slug,
    section: "referrals",
    title: slug,
    subtitle: null,
    body: null,
    details: {},
    linkedDocumentIds: [],
    tags,
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: new Date("2026-09-01T00:00:00.000Z").toISOString(),
  } as unknown as OnCallEntry;
}

describe("onCallEntryGroups", () => {
  it("files each entry under its first tag, in first-seen order", () => {
    // First-seen, not alphabetical: the entries arrive in the owner's own
    // order, and sorting here would reshuffle the page on any rename.
    const groups = onCallEntryGroups([entry("a", ["Youth"]), entry("b", ["Community"])], onCallTagFacet);
    expect(groups.map((group) => group.label)).toEqual(["Youth", "Community"]);
    expect(groups.map((group) => group.slug)).toEqual(["youth", "community"]);
  });

  it("puts an entry in one group only, however many tags it carries", () => {
    // Repeating it under three headings would make every count lie and show
    // the same number three times in one scroll.
    const groups = onCallEntryGroups([entry("a", ["Youth", "Community"]), entry("b", ["Community"])], onCallTagFacet);
    expect(groups.map((group) => [group.label, group.entries.length])).toEqual([
      ["Youth", 1],
      ["Community", 1],
    ]);
  });

  it("never drops an untagged entry, and files it last", () => {
    // Withholding a number because nobody tagged it is the failure this mode
    // exists to prevent.
    const groups = onCallEntryGroups([entry("a", []), entry("b", ["Youth"])], onCallTagFacet, "Other services");
    expect(groups.map((group) => group.label)).toEqual(["Youth", "Other services"]);
    expect(groups.at(-1)?.entries.map((row) => row.slug)).toEqual(["a"]);
  });

  it("reports no groups when there is nothing to group by", () => {
    // One heading over the whole list is furniture, and it is also what tells
    // the header to drop back to a plain title with no jump list.
    expect(onCallEntryGroups([entry("a", ["Youth"]), entry("b", ["Youth"])], onCallTagFacet)).toEqual([]);
    expect(onCallEntryGroups([entry("a", [])], onCallTagFacet)).toEqual([]);
    expect(onCallEntryGroups([], onCallTagFacet)).toEqual([]);
  });

  it("ignores blank and padded tags rather than making a group out of one", () => {
    const groups = onCallEntryGroups([entry("a", ["  ", " Youth "]), entry("b", ["Community"])], onCallTagFacet);
    expect(groups.map((group) => group.label)).toEqual(["Youth", "Community"]);
  });
});
