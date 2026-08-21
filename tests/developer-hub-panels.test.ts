import { describe, expect, it } from "vitest";
import { HUB_PANELS, panelsInGroup } from "@/lib/developer-area/hub-panels";

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
});
