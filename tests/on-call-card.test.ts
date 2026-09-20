import { describe, expect, it } from "vitest";

import { selectCardEntries } from "@/lib/on-call/card-selection";
import { partitionLogisticsEntries, recordedExpiryHasPassed } from "@/lib/on-call/compliance";
import { onCallEntryFreshness, type OnCallEntry } from "@/lib/on-call/entry-model";

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

/**
 * A compliance requirement must never reach the printed card, and the exclusion
 * has to be the NAMED one in `selectCardEntries` rather than a side effect of
 * the privacy rule.
 *
 * The hazard is specific. `stale` is computed from `lastVerifiedAt` — when
 * somebody last said the record was right — and not from `expiresOn`, so a
 * registration that ran out last month, on a row confirmed last week, is
 * "fresh" by that test. Flagged for the card and not personal, it satisfied
 * every condition the selector had before the fix and printed: under the
 * heading "Admin", as a bare title, with no expiry, no consequence band, no
 * issuing body, no provenance, and without the Compliance page's own note that
 * nothing here is checked with an issuing body. A reader is entitled to take
 * that as a statement that the registration is in order.
 */
describe("selectCardEntries — compliance requirements", () => {
  const EXPIRED_LAST_MONTH = "2026-08-01";

  const REGISTRATION = entry({
    id: "66666666-6666-6666-6666-666666666666",
    slug: "medical-registration",
    title: "Medical registration",
    section: "logistics",
    details: {
      category: "Registration",
      kind: "compliance",
      consequence: "stops-work",
      expiresOn: EXPIRED_LAST_MONTH,
      issuingBody: "Ahpra",
      provenance: "typed",
    },
    includeOnCard: true,
    // Explicitly NOT personal. Compliance rows are stored personal now, which
    // would exclude them through the privacy test above — but that decision was
    // taken about who can read a screen, and whoever revisits it will not be
    // thinking about what a printed card leaves off. Setting it false here is
    // what makes this a test of the card rule rather than of the privacy rule.
    isPersonal: false,
    lastVerifiedAt: FRESH_VERIFIED_AT,
  });

  const LEAVE_FORM = entry({
    id: "77777777-7777-7777-7777-777777777777",
    slug: "study-leave-form",
    title: "Study leave form",
    section: "logistics",
    details: { category: "Leave" },
    includeOnCard: true,
  });

  it("is built from a row that would have passed every other condition", () => {
    // Without this the exclusion could be coming from somewhere else and the
    // test below would prove nothing.
    expect(REGISTRATION.includeOnCard).toBe(true);
    expect(REGISTRATION.isPersonal).toBe(false);
    expect(onCallEntryFreshness(REGISTRATION, NOW).state).toBe("fresh");
    // And yet the requirement itself ran out well before `now`: the exact gap
    // between "the record was checked" and "the thing has not lapsed".
    expect(recordedExpiryHasPassed(REGISTRATION, NOW)).toBe(true);
    // Asked of the module that owns the split rather than read off `details`.
    const { compliance, admin } = partitionLogisticsEntries([REGISTRATION, LEAVE_FORM]);
    expect(compliance).toEqual([REGISTRATION]);
    expect(admin).toEqual([LEAVE_FORM]);
  });

  it("excludes it while still printing the ordinary Admin row beside it", () => {
    expect(selectCardEntries([REGISTRATION, LEAVE_FORM], NOW)).toEqual([LEAVE_FORM]);
  });
});
