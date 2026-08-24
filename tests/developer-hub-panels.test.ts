import { describe, expect, it } from "vitest";
import { HUB_PANELS, panelsInGroup } from "@/lib/developer-area/hub-panels";
// Test files live outside `src/**`, so unlike `hub-panels.ts` itself they are
// not bound by eslint.config.mjs's mockup-import boundary and may import this
// constant freely — see the anti-drift assertion below.
import { CARING_CONTACT_MOCKUP_ROUTES } from "@/components/caring-contacts/mockups/routes";
import { loadRepoAwarenessSnapshot } from "@/lib/developer-area/repo-awareness-snapshot";

describe("hub panels", () => {
  it("gives every built panel a destination and every planned panel none", () => {
    for (const panel of HUB_PANELS) {
      if (panel.phase === 1) expect(panel.href, `${panel.id} is built but has no href`).toBeTruthy();
      else expect(panel.href, `${panel.id} is planned but has an href`).toBeUndefined();
    }
  });

  it("has unique ids", () => {
    expect(new Set(HUB_PANELS.map((panel) => panel.id)).size).toBe(HUB_PANELS.length);
  });

  it("places every panel in exactly one group", () => {
    const total = (["work", "clinical", "system", "reference"] as const).reduce(
      (sum, group) => sum + panelsInGroup(group).length,
      0,
    );
    expect(total).toBe(HUB_PANELS.length);
  });

  it("ships the ledger as a phase 1 panel", () => {
    const ledger = HUB_PANELS.find((panel) => panel.id === "task-ledger");
    expect(ledger?.phase).toBe(1);
    expect(ledger?.href).toBe("/mockups/development/ledger");
  });

  it("keeps the existing prototypes reachable as real destinations", () => {
    for (const id of ["caring-contact", "ward-flow"]) {
      const panel = HUB_PANELS.find((entry) => entry.id === id);
      expect(panel?.phase, `${id} should be built`).toBe(1);
      expect(panel?.href, `${id} needs a destination`).toBeTruthy();
    }
  });

  it("never points a card at its own section", () => {
    // A card whose href is a fragment on this same page is a self-link, not a
    // destination. Both original offenders (`environment`, `prototypes`) were
    // removed for this reason.
    for (const panel of HUB_PANELS) {
      expect(panel.href?.startsWith("#"), `${panel.id} self-links`).not.toBe(true);
    }
  });

  it("keeps the caring-contact href in sync with its route source, since hub-panels.ts must pin it as a literal", () => {
    // hub-panels.ts is production space and cannot import
    // CARING_CONTACT_MOCKUP_ROUTES (eslint's mockup-import boundary), so its
    // caring-contact href is a hand-written literal. This test is what stands
    // in for that import: if the Caring Contact route is ever renamed, this
    // assertion goes red instead of the hub card silently rotting.
    const panel = HUB_PANELS.find((entry) => entry.id === "caring-contact");
    expect(
      panel?.href,
      "hub-panels.ts's pinned caring-contact literal has drifted from CARING_CONTACT_MOCKUP_ROUTES.today — update the literal in src/lib/developer-area/hub-panels.ts",
    ).toBe(CARING_CONTACT_MOCKUP_ROUTES.today);
  });
});

describe("phase 2 panels", () => {
  const expected = [
    { id: "routes", href: "/mockups/development/routes" },
    { id: "documentation", href: "/mockups/development/documentation" },
    { id: "test-health", href: "/mockups/development/test-health" },
    { id: "work-in-flight", href: "/mockups/development/review-state" },
  ];

  it("ships all four with a phase of 1 and a real href", () => {
    for (const { id, href } of expected) {
      const panel = HUB_PANELS.find((entry) => entry.id === id);
      expect(panel, id).toBeDefined();
      expect(panel!.phase).toBe(1);
      expect(panel!.href).toBe(href);
    }
  });

  it("leaves no phase 2 entry behind", () => {
    expect(HUB_PANELS.filter((panel) => panel.phase === 2)).toEqual([]);
  });

  it("renames work in flight to Review state while keeping its id", () => {
    // The id is the extension mechanism Phase 1 built; only the label changes.
    const panel = HUB_PANELS.find((entry) => entry.id === "work-in-flight");
    expect(panel!.name).toBe("Review state");
    expect(panel!.summary).not.toMatch(/open changes/i);
  });

  it("keeps every phase-1 panel's href pointing at a route that exists", () => {
    // Guards the one failure this flip can introduce: a card that navigates to
    // a 404. Checked against the generated route list rather than a hand copy.
    const snapshot = loadRepoAwarenessSnapshot();
    const routePaths = new Set([
      ...snapshot.routes.pages.map((page) => page.path),
      // A redirect is a real address a card may legitimately point at; it is
      // only excluded from `pages` so it is not listed twice.
      ...snapshot.routes.redirects.map((redirect) => redirect.path),
    ]);
    for (const panel of HUB_PANELS) {
      if (panel.phase !== 1 || !panel.href) continue;
      expect(routePaths.has(panel.href), `${panel.id} -> ${panel.href}`).toBe(true);
    }
  });
});
