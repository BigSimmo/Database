import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { isHeaderAddonSlotOwnedRoute } from "@/components/mode-nav/header-addon-slot";
import { PageSecondaryNavigation } from "@/components/page-secondary-navigation";
import { phoneHeaderCollapseAddonSlotId } from "@/lib/mode-home-composer";
import { MODE_NAV_ADOPTED_MODES, modeUsesHeaderModeNav } from "@/lib/mode-secondary-navigation";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

/** The universal header's single addon slot, as `master-search-header` renders it. */
function renderIntoHeaderWithAddonSlot(ui: React.ReactElement) {
  const slot = document.createElement("div");
  slot.id = phoneHeaderCollapseAddonSlotId;
  document.body.append(slot);
  const result = render(ui);
  return {
    ...result,
    occupants: () => slot.querySelectorAll('[data-testid="mode-nav"]'),
    cleanupSlot: () => slot.remove(),
  };
}

describe("header addon slot ownership", () => {
  it("recognises the routes whose page portals its own header", () => {
    expect(isHeaderAddonSlotOwnedRoute("/differentials/diagnoses/delirium")).toBe(true);
    expect(isHeaderAddonSlotOwnedRoute("/documents/11111111-1111-4111-8111-111111111111")).toBe(true);

    // The presentations workflow page renders no portal, and the shell index is
    // not a document detail route.
    expect(isHeaderAddonSlotOwnedRoute("/differentials/presentations/acute-confusion-encephalopathy")).toBe(false);
    expect(isHeaderAddonSlotOwnedRoute("/documents/search")).toBe(false);
    expect(isHeaderAddonSlotOwnedRoute("/differentials/diagnoses")).toBe(false);
  });

  it("gives an adopted mode's own workflow route exactly one bar in the slot", async () => {
    expect(modeUsesHeaderModeNav("dsm")).toBe(true);
    expect(isHeaderAddonSlotOwnedRoute("/dsm/compare")).toBe(false);

    const view = renderIntoHeaderWithAddonSlot(
      <PageSecondaryNavigation modeId="dsm" pathname="/dsm/compare" hasSubmittedSearch={false} onSearch={vi.fn()} />,
    );
    await waitFor(() => expect(view.occupants()).toHaveLength(1));
    view.cleanupSlot();
  });

  it("names every component that claims the slot", () => {
    // The only evidence a route claims the slot is that its component renders
    // `PhoneHeaderCollapsePortal`, so the predicate cannot be derived from
    // routes alone. Enumerate the claimants instead: a new one fails here until
    // `isHeaderAddonSlotOwnedRoute` is given its route.
    const claimants: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(path);
          continue;
        }
        if (!entry.name.endsWith(".tsx")) continue;
        // Design-scratch routes 404 in production and own no header.
        if (entry.name.includes("-mockups")) continue;
        if (/<PhoneHeaderCollapsePortal\b/.test(readFileSync(path, "utf8"))) {
          claimants.push(path.replace(`${process.cwd()}/`, ""));
        }
      }
    };
    walk(join(process.cwd(), "src/components"));

    expect(claimants.sort()).toEqual([
      "src/components/DocumentViewer.tsx",
      "src/components/differentials/differential-detail-page.tsx",
    ]);
  });

  it("keeps single-destination modes off the bar entirely", () => {
    // `documents` owns the slot on every detail route and has one registered
    // destination. Adopting it would be a deletion decision about that lone
    // entry, not a port — deliberately out of this rollout's scope.
    for (const modeId of ["documents", "answer", "prescribing", "tools", "factsheets"] as const) {
      expect([...MODE_NAV_ADOPTED_MODES]).not.toContain(modeId);
      expect(modeUsesHeaderModeNav(modeId)).toBe(false);
    }
  });
});
