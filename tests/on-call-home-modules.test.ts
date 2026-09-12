import { describe, expect, it } from "vitest";

import type { OnCallEntry } from "@/lib/on-call/entry-model";
import {
  ON_CALL_CALL_FIRST_LIMIT,
  ON_CALL_WARD_STRIP_LIMIT,
  countOnCallEntriesBySection,
  onCallLocalDateKey,
  onCallPrimaryNumber,
  onCallTelHref,
  selectCallFirstContacts,
  selectPinnedPlaybookEntry,
  selectSwitchboardContact,
  selectUpcomingSessions,
  selectWardContacts,
} from "@/lib/on-call/home-modules";
import { ROLE_EXPLAINER_KIND } from "@/lib/on-call/who-is-who";

/**
 * The home is derived entirely from tags the owner controls. These tests pin the
 * derivation, and in particular the three ways it could put something useless on
 * the most-looked-at screen in the mode: a call card with no number, a role
 * explainer masquerading as a contact, and a teaching session that already
 * happened.
 */

let seq = 0;
function entry(overrides: Partial<OnCallEntry> & { section: OnCallEntry["section"] }): OnCallEntry {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-${`${seq}`.padStart(12, "0")}`,
    slug: `entry-${seq}`,
    title: `Entry ${seq}`,
    subtitle: null,
    body: null,
    details: {},
    linkedDocumentIds: [],
    tags: [],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: null,
    ...overrides,
  };
}

const contact = (over: Partial<OnCallEntry> & { details?: unknown }) =>
  entry({ section: "contacts", details: { role: "Role" }, ...over });

describe("onCallPrimaryNumber", () => {
  it("prefers direct over after-hours over pager over extension", () => {
    // The same precedence Contacts uses, so one role never appears to have two
    // different numbers depending on the screen.
    expect(
      onCallPrimaryNumber(
        contact({ details: { role: "R", phone: "1", afterHoursPhone: "2", pager: "3", extension: "4" } }),
      ),
    ).toEqual({ label: "Direct", value: "1" });
    expect(onCallPrimaryNumber(contact({ details: { role: "R", afterHoursPhone: "2", pager: "3" } }))).toEqual({
      label: "After hours",
      value: "2",
    });
    expect(onCallPrimaryNumber(contact({ details: { role: "R", extension: "4" } }))).toEqual({
      label: "Ext",
      value: "4",
    });
  });

  it("is null for a contact with no number at all", () => {
    expect(onCallPrimaryNumber(contact({ details: { role: "R" } }))).toBeNull();
  });

  it("is null for an entry that is not a contact", () => {
    expect(
      onCallPrimaryNumber(entry({ section: "logistics", details: { category: "Parking", phone: "5" } })),
    ).toBeNull();
  });
});

describe("onCallTelHref", () => {
  it("strips the formatting a human typed", () => {
    expect(onCallTelHref("(08) 9224 8888")).toBe("tel:0892248888");
  });

  it("keeps a leading plus, which is part of the number", () => {
    expect(onCallTelHref("+61 8 9224 8888")).toBe("tel:+61892248888");
  });

  it("is undefined when there are no digits to dial", () => {
    expect(onCallTelHref("via switchboard")).toBeUndefined();
    expect(onCallTelHref(undefined)).toBeUndefined();
    expect(onCallTelHref(null)).toBeUndefined();
  });
});

describe("selectCallFirstContacts", () => {
  it("takes the tagged contacts in the owner's order", () => {
    const second = contact({ tags: ["call-first"], sortOrder: 2, details: { role: "R", phone: "2" } });
    const first = contact({ tags: ["call-first"], sortOrder: 1, details: { role: "R", phone: "1" } });
    expect(selectCallFirstContacts([second, first]).map((e) => e.id)).toEqual([first.id, second.id]);
  });

  it("matches the tag regardless of case or padding", () => {
    const tagged = contact({ tags: ["  Call-First "], details: { role: "R", phone: "1" } });
    expect(selectCallFirstContacts([tagged])).toHaveLength(1);
  });

  it("never shows a call card that cannot call", () => {
    const noNumber = contact({ tags: ["call-first"], details: { role: "Consultant via switchboard" } });
    expect(selectCallFirstContacts([noNumber])).toEqual([]);
  });

  it("excludes a role explainer even when it is tagged", () => {
    const explainer = contact({
      tags: ["call-first"],
      details: { role: "Registrar", kind: ROLE_EXPLAINER_KIND, phone: "1" },
    });
    expect(selectCallFirstContacts([explainer])).toEqual([]);
  });

  it("caps at two, because a pair is the point", () => {
    const many = Array.from({ length: 5 }, (_, index) =>
      contact({ tags: ["call-first"], sortOrder: index, details: { role: "R", phone: `${index}` } }),
    );
    expect(selectCallFirstContacts(many)).toHaveLength(ON_CALL_CALL_FIRST_LIMIT);
  });
});

describe("selectSwitchboardContact", () => {
  it("returns the tagged contact", () => {
    const switchboard = contact({ tags: ["switchboard"], details: { role: "Switchboard", phone: "9" } });
    expect(selectSwitchboardContact([switchboard])?.id).toBe(switchboard.id);
  });

  it("returns one even when it carries no number, because 'ask switchboard' is still the answer", () => {
    const noNumber = contact({ tags: ["switchboard"], details: { role: "Switchboard" } });
    expect(selectSwitchboardContact([noNumber])?.id).toBe(noNumber.id);
  });

  it("is null when nothing is tagged", () => {
    expect(selectSwitchboardContact([contact({})])).toBeNull();
  });
});

describe("selectWardContacts", () => {
  it("keeps only tagged contacts that can actually be dialled", () => {
    const dialable = contact({ tags: ["ward"], details: { role: "Ward 4B", extension: "5210" } });
    const notDialable = contact({ tags: ["ward"], details: { role: "Ward 5A" } });
    expect(selectWardContacts([dialable, notDialable]).map((e) => e.id)).toEqual([dialable.id]);
  });

  it("caps the strip so it stays one swipe", () => {
    const many = Array.from({ length: ON_CALL_WARD_STRIP_LIMIT + 4 }, (_, index) =>
      contact({ tags: ["ward"], sortOrder: index, details: { role: "W", extension: `${index}` } }),
    );
    expect(selectWardContacts(many)).toHaveLength(ON_CALL_WARD_STRIP_LIMIT);
  });
});

describe("selectPinnedPlaybookEntry", () => {
  it("returns the tagged playbook scenario", () => {
    const pinned = entry({
      section: "playbook",
      tags: ["pinned"],
      details: { trigger: "Owner-written trigger", escalationSteps: [] },
    });
    expect(selectPinnedPlaybookEntry([pinned])?.id).toBe(pinned.id);
  });

  it("pins one, not all of them", () => {
    const first = entry({
      section: "playbook",
      tags: ["pinned"],
      sortOrder: 1,
      details: { trigger: "a", escalationSteps: [] },
    });
    const second = entry({
      section: "playbook",
      tags: ["pinned"],
      sortOrder: 2,
      details: { trigger: "b", escalationSteps: [] },
    });
    expect(selectPinnedPlaybookEntry([second, first])?.id).toBe(first.id);
  });

  it("ignores a tagged entry from another section", () => {
    expect(selectPinnedPlaybookEntry([contact({ tags: ["pinned"] })])).toBeNull();
  });
});

describe("selectUpcomingSessions", () => {
  const dated = (date: string, title: string) =>
    entry({ section: "education", title, details: { nextOccurrenceDate: date, nextOccurrence: "Thursday 1pm" } });

  it("orders by date, soonest first", () => {
    const later = dated("2026-10-01", "Later");
    const sooner = dated("2026-09-16", "Sooner");
    expect(selectUpcomingSessions([later, sooner], "2026-09-12").map((s) => s.entry.title)).toEqual([
      "Sooner",
      "Later",
    ]);
  });

  it("includes a session happening today", () => {
    // A session at 08:00 is still today's session at 03:00, which is when this
    // screen is being read.
    expect(selectUpcomingSessions([dated("2026-09-12", "Today")], "2026-09-12")).toHaveLength(1);
  });

  it("drops a session that has already happened", () => {
    expect(selectUpcomingSessions([dated("2026-09-11", "Yesterday")], "2026-09-12")).toEqual([]);
  });

  it("omits an undated session rather than guessing where it belongs", () => {
    const undated = entry({ section: "education", details: { nextOccurrence: "first Tuesday of term" } });
    expect(selectUpcomingSessions([undated], "2026-09-12")).toEqual([]);
  });

  it("carries the owner's own wording through, where they gave one", () => {
    expect(selectUpcomingSessions([dated("2026-09-16", "Journal club")], "2026-09-12")[0]?.when).toBe("Thursday 1pm");
  });
});

describe("onCallLocalDateKey", () => {
  it("uses the viewer's own day, not UTC", () => {
    // 23:00 on the 12th in a zone ahead of UTC is still the 12th to the person
    // holding the phone; keying on UTC would call tonight's teaching yesterday's.
    const localLateEvening = new Date(2026, 8, 12, 23, 0, 0);
    expect(onCallLocalDateKey(localLateEvening)).toBe("2026-09-12");
  });

  it("pads single-digit months and days", () => {
    expect(onCallLocalDateKey(new Date(2026, 0, 5, 12, 0, 0))).toBe("2026-01-05");
  });
});

describe("countOnCallEntriesBySection", () => {
  it("counts each section, and role explainers separately", () => {
    const { counts, roleExplainers } = countOnCallEntriesBySection([
      contact({}),
      contact({}),
      contact({ details: { role: "R", kind: ROLE_EXPLAINER_KIND } }),
      entry({ section: "logistics", details: { category: "Parking" } }),
    ]);
    expect(counts.get("contacts")).toBe(2);
    expect(counts.get("logistics")).toBe(1);
    expect(roleExplainers).toBe(1);
  });

  it("does not count a role explainer as a contact", () => {
    // Otherwise the Contacts tile promises a number that is not in the list.
    const { counts } = countOnCallEntriesBySection([contact({ details: { role: "R", kind: ROLE_EXPLAINER_KIND } })]);
    expect(counts.get("contacts")).toBeUndefined();
  });
});
