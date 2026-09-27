import { describe, expect, it } from "vitest";

import {
  allocateOnCallGroupSlug,
  onCallGroupAnchorId,
  onCallGroupSlug,
} from "@/components/on-call/on-call-page-anchors";

describe("onCallGroupSlug", () => {
  it("collapses punctuation the way colliding labels do", () => {
    // The review case: two owner-typed groups that are different words but
    // one slug. The allocator below is what keeps their anchors apart.
    expect(onCallGroupSlug("ED / General")).toBe("ed-general");
    expect(onCallGroupSlug("ED General")).toBe("ed-general");
  });

  it("falls back to a usable fragment when a label is all punctuation", () => {
    expect(onCallGroupSlug("///")).toBe("group");
  });
});

describe("allocateOnCallGroupSlug", () => {
  it("disambiguates labels that normalize to the same slug", () => {
    const taken = new Set<string>();
    expect(allocateOnCallGroupSlug("ED / General", taken)).toBe("ed-general");
    expect(allocateOnCallGroupSlug("ED General", taken)).toBe("ed-general-2");
    expect(taken.has("ed-general")).toBe(true);
    expect(taken.has("ed-general-2")).toBe(true);
  });

  it("keeps a later third collision going, rather than reusing -2", () => {
    const taken = new Set<string>();
    allocateOnCallGroupSlug("ED / General", taken);
    allocateOnCallGroupSlug("ED General", taken);
    expect(allocateOnCallGroupSlug("ED--General", taken)).toBe("ed-general-3");
  });

  it("still produces the id the header and the heading share", () => {
    const taken = new Set<string>();
    const slug = allocateOnCallGroupSlug("Ward 4B", taken);
    expect(onCallGroupAnchorId(slug)).toBe("on-call-group-ward-4b");
  });
});

describe("hub page groups (kit 1.8)", () => {
  it("drops empty groups and keeps the declared order", async () => {
    const { onCallHubPageSections } = await import("@/components/on-call/on-call-page-sections");
    const sections = onCallHubPageSections(
      "find",
      new Map([
        ["downtime", 1],
        ["wards", 2],
      ]),
    );
    expect(sections.map((section) => section.id)).toEqual(["on-call-group-downtime", "on-call-group-wards"]);
    expect(sections.map((section) => section.label)).toEqual(["Systems down", "Wards"]);
  });

  it("offers no bar for a single non-empty group", async () => {
    const { onCallHubPageSections } = await import("@/components/on-call/on-call-page-sections");
    expect(onCallHubPageSections("call", new Map([["hospital", 4]]))).toEqual([]);
  });

  it("puts My team first on Who's on, with the one-word bar label", async () => {
    const { onCallWhosOnSections } = await import("@/components/on-call/on-call-page-sections");
    const sections = onCallWhosOnSections(
      [
        { team: "ICU", count: 1 },
        { team: "Medicine", count: 2 },
        { team: "After-hours manager", count: 1 },
      ],
      "Medicine",
    );
    expect(sections[0]?.label).toBe("Medicine");
    expect(sections.map((section) => section.label)).toEqual(["Medicine", "ICU", "Manager"]);
  });

  it("keeps Call's and Who's on's filter tabs to three labels at most", async () => {
    const { ON_CALL_CALL_TABS, ON_CALL_WHOS_ON_TABS } = await import("@/components/on-call/on-call-page-sections");
    expect(ON_CALL_CALL_TABS.map((tab) => tab.label)).toEqual(["Hospital", "External"]);
    expect(ON_CALL_WHOS_ON_TABS.map((tab) => tab.label)).toEqual(["Yesterday", "Today", "Tomorrow"]);
  });

  it("points the On site link at the one admin-rows constant", async () => {
    const { ON_CALL_ON_SITE_HREF } = await import("@/components/on-call/on-call-section-identity");
    const { ON_CALL_ADMIN_ROWS_HREF } = await import("@/lib/on-call/feature-flags");
    expect(ON_CALL_ON_SITE_HREF).toBe(ON_CALL_ADMIN_ROWS_HREF);
  });
});
