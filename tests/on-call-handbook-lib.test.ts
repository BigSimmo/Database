// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import {
  ON_CALL_TEAMS,
  compareOnCallTeams,
  handbookAliases,
  handbookMobileRoute,
  onCallTeamBarLabel,
  parseHandbookTitle,
} from "@/lib/on-call/handbook-title";
import { pinnedEmergencyEntries, publishedHandbookItems } from "@/lib/on-call/handbook-items";
import { searchHandbookItems } from "@/lib/on-call/handbook-search";
import {
  HANDBOOK_REPORT_REASONS,
  hasReportedOnThisDevice,
  rememberReportOnThisDevice,
} from "@/lib/on-call/handbook-reports";
import { onCallDigitsOf, onCallFieldMatches, onCallSearchTerms } from "@/lib/on-call/entry-search";
import type { ServiceEntry } from "@/lib/on-call/service-model";

const SITE_A = "30000000-0000-4000-8000-00000000000a";
const SITE_B = "30000000-0000-4000-8000-00000000000b";

function entry(id: string, title: string, over: Partial<ServiceEntry> = {}, body = ""): ServiceEntry {
  const content = {
    siteId: null,
    section: "contacts" as const,
    kind: "operational" as const,
    title,
    body,
    phone: "(08) 9000 0001",
    sources: [],
    orientationPhase: "first_shift" as const,
  };
  return {
    id,
    revision: 1,
    publishedRevision: 1,
    content,
    publishedContent: content,
    status: "published",
    authorId: null,
    reviewedBy: null,
    reviewedAt: null,
    reviewComment: "",
    updatedAt: "2026-09-20T04:00:00.000Z",
    ...over,
  };
}

function withContent(base: ServiceEntry, over: Partial<ServiceEntry["content"]>): ServiceEntry {
  const content = { ...base.content, ...over };
  return { ...base, content, publishedContent: content };
}

beforeEach(() => window.localStorage.clear());

describe("parseHandbookTitle", () => {
  it.each([
    ["Emergency: Medical emergency team", { prefix: "Emergency", team: null, label: "Medical emergency team" }],
    ["ward: 4B", { prefix: "Ward", team: null, label: "4B" }],
    ["Medicine: Registrar on call", { prefix: null, team: "Medicine", label: "Registrar on call" }],
    ["Intensive care: Registrar", { prefix: null, team: "ICU", label: "Registrar" }],
    ["Paeds: Registrar", { prefix: null, team: "Paediatrics", label: "Registrar" }],
    ["Gen Med: Consultant", { prefix: null, team: "Medicine", label: "Consultant" }],
    // Any prefix is a team (review F10): nothing is misfiled or dropped, and the
    // editor's preview names where it will appear.
    ["Orthopaedics: Registrar", { prefix: null, team: "Orthopaedics", label: "Registrar" }],
    ["cardiology: Fellow", { prefix: null, team: "Cardiology", label: "Fellow" }],
    ["Pharmacy on call", { prefix: null, team: null, label: "Pharmacy on call" }],
    ["Handover at 08:00", { prefix: null, team: null, label: "Handover at 08:00" }],
    ["4B: side room", { prefix: null, team: null, label: "4B: side room" }],
  ])("%s", (title, expected) => {
    expect(parseHandbookTitle(title)).toEqual(expected);
  });
});

describe("teams", () => {
  it("orders the common teams first, then any other team by name", () => {
    expect(["Orthopaedics", "ICU", "Cardiology", "Medicine"].sort(compareOnCallTeams)).toEqual([
      "Medicine",
      "ICU",
      "Cardiology",
      "Orthopaedics",
    ]);
    expect(ON_CALL_TEAMS[0]).toBe("Medicine");
  });

  it("gives the 48px bar one word per team", () => {
    expect(onCallTeamBarLabel("After-hours manager")).toBe("Manager");
    expect(onCallTeamBarLabel("Orthopaedics")).toBe("Orthopaedics");
  });
});

describe("handbookAliases", () => {
  it("reads the one Also known as line", () => {
    expect(handbookAliases("Level 3.\nAlso known as: HDU, high dependency")).toEqual(["HDU", "high dependency"]);
  });
  it("ignores the phrase mid-sentence", () => {
    expect(handbookAliases("This ward is also known as: nothing else")).toEqual([]);
  });
});

describe("handbookMobileRoute", () => {
  it("reads the recorded route from a mobile", () => {
    expect(handbookMobileRoute("Dial from a desk phone.\nFrom a mobile: 9000 0000, 55")).toBe("9000 0000, 55");
    expect(handbookMobileRoute("No route recorded")).toBeNull();
  });
});

describe("publishedHandbookItems", () => {
  it("shows readers only what was published, never an editor's draft", () => {
    const draftOnly = entry("d", "Draft only", { publishedContent: null, publishedRevision: null, status: "draft" });
    const edited = entry("e", "Published title");
    const editedWithDraft = { ...edited, content: { ...edited.content, title: "Unpublished edit" } };
    expect(publishedHandbookItems({ entries: [draftOnly, editedWithDraft] }).map((item) => item.title)).toEqual([
      "Published title",
    ]);
  });

  it("dates a row by its published text, and shows no date while a newer draft sits over it", () => {
    const published = entry("p", "Published title");
    const withNewerDraft = { ...entry("n", "Newer draft over it"), revision: 2, updatedAt: "2026-09-25T04:00:00.000Z" };
    const byId = new Map(
      publishedHandbookItems({ entries: [published, withNewerDraft] }).map((item) => [item.id, item.updatedAt]),
    );
    expect(byId.get("p")).toBe("2026-09-20T04:00:00.000Z");
    expect(byId.get("n")).toBeNull();
  });

  it("resolves the dial once, and the mobile route beside a desk-only number", () => {
    const [item] = publishedHandbookItems({
      entries: [
        withContent(entry("p", "Emergency: Synthetic emergency line"), {
          phone: "55",
          body: "Synthetic example only.\nFrom a mobile: 9000 0000, 55",
        }),
      ],
    });
    expect(item?.dial).toMatchObject({ display: "55", tel: null, route: "hospital-phone" });
    expect(item?.mobileDial).toMatchObject({ kind: "switchboard-extension", tel: "tel:0890000000,55" });
  });
});

describe("pinnedEmergencyEntries", () => {
  const pin = (id: string, over: Partial<ServiceEntry["content"]>) =>
    withContent(entry(id, `Emergency: Line ${id}`), { siteId: SITE_A, kind: "clinical", phone: "55", ...over });

  it("pins only a site-named clinical Emergency entry for this hospital", () => {
    const items = publishedHandbookItems({
      entries: [
        pin("ok", {}),
        pin("no-site", { siteId: null }),
        pin("other-site", { siteId: SITE_B }),
        pin("operational", { kind: "operational" }),
        pin("not-emergency", { title: "Ward: 4B" }),
        pin("no-number", { phone: "" }),
      ],
    });
    expect(pinnedEmergencyEntries(items, SITE_A).map((item) => item.id)).toEqual(["ok"]);
  });

  it("shows every qualifying row up to three, never only the first", () => {
    const items = publishedHandbookItems({ entries: ["a", "b", "c", "d"].map((id) => pin(id, {})) });
    expect(pinnedEmergencyEntries(items, SITE_A).map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("pins nothing when no hospital is chosen", () => {
    const items = publishedHandbookItems({ entries: [pin("a", {})] });
    expect(pinnedEmergencyEntries(items, null)).toEqual([]);
  });
});

describe("searchHandbookItems", () => {
  const items = publishedHandbookItems({
    entries: [
      entry("a", "Ward: 4B", {}, "Also known as: HDU"),
      entry("b", "ICU: Registrar"),
      entry("c", "Switchboard"),
    ],
  });
  it("finds an alias as strongly as a title", () => {
    expect(searchHandbookItems(items, "hdu").map((item) => item.id)).toEqual(["a"]);
  });
  it("ranks a title match above a team match", () => {
    const more = publishedHandbookItems({
      entries: [entry("t", "ICU: Registrar"), entry("l", "Liaison", {}, "Ask for ICU outreach")],
    });
    expect(searchHandbookItems(more, "icu").map((item) => item.id)).toEqual(["t", "l"]);
  });
  it("matches a typed number against a formatted one", () => {
    expect(searchHandbookItems(items, "0890000001")).toHaveLength(3);
    expect(searchHandbookItems(items, "9000 0001")).toHaveLength(3);
  });
  it("returns nothing for an empty query", () => {
    expect(searchHandbookItems(items, "  ")).toEqual([]);
  });
});

describe("entry-search's exported helpers keep their behaviour", () => {
  it("splits terms and matches digits as the entry search does", () => {
    expect(onCallSearchTerms("  Ward  4B ")).toEqual(["ward", "4b"]);
    expect(onCallDigitsOf("(08) 9000-0001")).toBe("0890000001");
    expect(onCallFieldMatches("(08) 9000 0001", "90000001", "90000001")).toBe(true);
    expect(onCallFieldMatches("(08) 9000 0001", "2", "2")).toBe(false);
  });
});

describe("report reasons and de-duplication on this device", () => {
  it("offers only the two number faults, never a record about a person", () => {
    expect(HANDBOOK_REPORT_REASONS).toEqual({
      "not-in-service": "Number not in service",
      "wrong-department": "Reaches the wrong department",
    });
  });

  it("remembers a report for 30 days, per entry and reason", () => {
    const now = new Date("2026-09-26T02:00:00Z");
    rememberReportOnThisDevice("a", "not-in-service", now);
    expect(hasReportedOnThisDevice("a", "not-in-service", now)).toBe(true);
    expect(hasReportedOnThisDevice("a", "wrong-department", now)).toBe(false);
    expect(hasReportedOnThisDevice("a", "not-in-service", new Date("2026-10-27T02:00:00Z"))).toBe(false);
  });
});
