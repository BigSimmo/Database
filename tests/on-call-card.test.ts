import { describe, expect, it } from "vitest";

import { selectCardEntries } from "@/lib/on-call/card-selection";
import { type OnCallEntry } from "@/lib/on-call/entry-model";

const NOW = new Date("2026-09-04T00:00:00.000Z");
const FRESH_VERIFIED_AT = new Date("2026-06-01T00:00:00.000Z").toISOString();
const STALE_VERIFIED_AT = new Date("2020-01-01T00:00:00.000Z").toISOString();

function entry(overrides: Partial<OnCallEntry> & { id: string; slug: string; title: string }): OnCallEntry {
  return {
    section: "contacts",
    subtitle: null,
    body: null,
    details: { role: overrides.title },
    linkedDocumentIds: [],
    tags: [],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: FRESH_VERIFIED_AT,
    ...overrides,
  };
}

describe("selectCardEntries", () => {
  it("excludes a personal entry even when flagged for the card", () => {
    const personal = entry({
      id: "11111111-1111-1111-1111-111111111111",
      slug: "my-mobile",
      title: "My mobile",
      isPersonal: true,
      includeOnCard: true,
    });
    expect(selectCardEntries([personal], NOW)).toEqual([]);
  });

  it("excludes a stale entry even when flagged for the card", () => {
    const stale = entry({
      id: "22222222-2222-2222-2222-222222222222",
      slug: "on-call-anaesthetist",
      title: "On-call anaesthetist",
      includeOnCard: true,
      lastVerifiedAt: STALE_VERIFIED_AT,
    });
    expect(selectCardEntries([stale], NOW)).toEqual([]);
  });

  it("excludes an entry that is both personal and stale", () => {
    const both = entry({
      id: "33333333-3333-3333-3333-333333333333",
      slug: "my-old-mobile",
      title: "My old mobile",
      isPersonal: true,
      includeOnCard: true,
      lastVerifiedAt: STALE_VERIFIED_AT,
    });
    expect(selectCardEntries([both], NOW)).toEqual([]);
  });

  it("includes a fresh, non-personal entry flagged for the card", () => {
    const included = entry({
      id: "44444444-4444-4444-4444-444444444444",
      slug: "ed-registrar",
      title: "ED registrar",
      includeOnCard: true,
    });
    expect(selectCardEntries([included], NOW)).toEqual([included]);
  });

  it("excludes a fresh, non-personal entry that is not flagged for the card", () => {
    const unflagged = entry({
      id: "55555555-5555-5555-5555-555555555555",
      slug: "ward-4b-nic",
      title: "Ward 4B nurse in charge",
      includeOnCard: false,
    });
    expect(selectCardEntries([unflagged], NOW)).toEqual([]);
  });
});
