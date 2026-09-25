import { describe, expect, it } from "vitest";

import { type OnCallEntry } from "@/lib/on-call/entry-model";
import { deriveOnCallNotifications } from "@/lib/on-call/notifications";

/**
 * The notification list is the only place the hub speaks to its owner unasked,
 * so two things have to hold: it must say what is true about the record, and it
 * must never say anything about the person.
 */

const NOW = new Date("2026-09-22T09:00:00+08:00");

function entry(overrides: Partial<OnCallEntry> & { id: string; title: string }): OnCallEntry {
  return {
    slug: overrides.id,
    section: "contacts",
    subtitle: null,
    body: null,
    details: {},
    tags: [],
    isPersonal: false,
    sortOrder: 0,
    lastVerifiedAt: NOW.toISOString(),
    ...overrides,
  } as unknown as OnCallEntry;
}

function complianceEntry(id: string, title: string, expiresOn: string): OnCallEntry {
  return entry({
    id,
    title,
    section: "logistics",
    details: { kind: "compliance", expiresOn },
    // Verified today, so the only thing this row can raise is the date.
    lastVerifiedAt: NOW.toISOString(),
  });
}

describe("deriveOnCallNotifications", () => {
  it("raises a compliance requirement whose recorded date has passed", () => {
    const list = deriveOnCallNotifications([complianceEntry("bls", "Basic life support", "2026-01-01")], NOW);

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ kind: "compliance-date-passed", title: "Basic life support" });
    expect(list[0].detail).toContain("2026-01-01");
  });

  it("leaves a compliance requirement alone while its recorded date is still ahead", () => {
    const list = deriveOnCallNotifications([complianceEntry("bls", "Basic life support", "2027-01-01")], NOW);
    expect(list).toEqual([]);
  });

  it("never says expired, lapsed, valid, current or compliant about a person", () => {
    // `recordedExpiryHasPassed` carries this rule in its own docblock: the
    // holder may have renewed last week and not updated the row, so the
    // surface may describe the RECORD and never the reader's standing. A
    // notification is the easiest place in the app to get this wrong, because
    // the obvious phrasing is the forbidden one.
    const list = deriveOnCallNotifications(
      [
        complianceEntry("bls", "Basic life support", "2026-01-01"),
        complianceEntry("mand", "Mandatory training", "2025-06-30"),
      ],
      NOW,
    );

    expect(list).toHaveLength(2);
    for (const notification of list) {
      const text = `${notification.title} ${notification.detail}`.toLowerCase();
      for (const forbidden of ["expired", "expires", "lapsed", "invalid", "valid", "compliant", "up to date"]) {
        expect(text, `"${forbidden}" must not appear in a compliance notification`).not.toContain(forbidden);
      }
    }
  });

  it("does not raise the same compliance row twice when it is also stale", () => {
    // A requirement can be both past its recorded date and unconfirmed for a
    // long time. It is one thing to deal with, and the date is the part that
    // matters, so the freshness pass must not add a second row for it — that
    // would make the badge count disagree with the number of things to do.
    const both = complianceEntry("bls", "Basic life support", "2026-01-01");
    const list = deriveOnCallNotifications([{ ...both, lastVerifiedAt: null } as unknown as OnCallEntry], NOW);

    expect(list.filter((item) => item.title === "Basic life support")).toHaveLength(1);
    expect(list[0].kind).toBe("compliance-date-passed");
  });

  it("puts a passed date above an unconfirmed entry, and sorts by title within a kind", () => {
    const list = deriveOnCallNotifications(
      [
        entry({ id: "b", title: "Beta ward", lastVerifiedAt: null }),
        entry({ id: "a", title: "Alpha ward", lastVerifiedAt: null }),
        complianceEntry("bls", "Basic life support", "2026-01-01"),
      ],
      NOW,
    );

    expect(list.map((item) => item.title)).toEqual(["Basic life support", "Alpha ward", "Beta ward"]);
  });

  it("says nothing about a hub whose entries are all confirmed and in date", () => {
    const list = deriveOnCallNotifications(
      [entry({ id: "a", title: "Alpha ward" }), complianceEntry("bls", "Basic life support", "2027-01-01")],
      NOW,
    );
    expect(list).toEqual([]);
  });

  it("gives every notification a stable id so a re-render cannot duplicate a row", () => {
    const entries = [entry({ id: "a", title: "Alpha ward", lastVerifiedAt: null })];
    const first = deriveOnCallNotifications(entries, NOW);
    const second = deriveOnCallNotifications(entries, NOW);

    expect(first.map((item) => item.id)).toEqual(second.map((item) => item.id));
    expect(new Set(first.map((item) => item.id)).size).toBe(first.length);
  });
});
