import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { isHeaderAddonSlotOwnedRoute } from "@/components/mode-nav/header-addon-slot";
import { hasLocalInformationPageNavigation, PageSecondaryNavigation } from "@/components/page-secondary-navigation";
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
  afterEach(() => {
    for (const slot of document.querySelectorAll(`#${phoneHeaderCollapseAddonSlotId}`)) {
      slot.remove();
    }
  });

  it("recognises the routes whose page portals its own header", () => {
    expect(isHeaderAddonSlotOwnedRoute("/differentials/diagnoses/delirium")).toBe(true);
    expect(isHeaderAddonSlotOwnedRoute("/documents/11111111-1111-4111-8111-111111111111")).toBe(true);

    // The presentations workflow page renders no portal, and the shell index is
    // not a document detail route.
    expect(isHeaderAddonSlotOwnedRoute("/differentials/presentations/acute-confusion-encephalopathy")).toBe(false);
    expect(isHeaderAddonSlotOwnedRoute("/documents/search")).toBe(false);
    expect(isHeaderAddonSlotOwnedRoute("/differentials/diagnoses")).toBe(false);
  });

  it("is covered, route for route, by the locally-owned early return", () => {
    // This is the load-bearing assertion. Nothing in `PageSecondaryNavigation`
    // states "do not mount a bar where the page owns the slot" — what keeps the
    // slot to one occupant is that every claimant route happens to also be
    // `hasLocalInformationPageNavigation`, which returns null well before the
    // mode branch. Two independently maintained lists agreeing by coincidence.
    //
    // A future claimant outside that cover reaches the mode branch and mounts a
    // second header into an occupied slot. This fails when that happens, and
    // the fix is an explicit guard at the mode branch.
    for (const pathname of [
      "/differentials/diagnoses/delirium",
      "/documents/11111111-1111-4111-8111-111111111111",
      "/documents/11111111-1111-4111-8111-111111111111/source",
    ]) {
      expect(isHeaderAddonSlotOwnedRoute(pathname)).toBe(true);
      expect(hasLocalInformationPageNavigation(pathname)).toBe(true);
    }
  });

  it("renders no bar on a claimant route, even for an adopted mode", async () => {
    // Behavioural pin on the outcome the cover above produces. Differentials is
    // adopted and carries three destinations, so the old incidental protection
    // — fewer than MODE_NAV_MIN_ITEMS, ModeNav renders nothing — no longer
    // applies to it.
    expect(modeUsesHeaderModeNav("differentials")).toBe(true);

    const view = renderIntoHeaderWithAddonSlot(
      <PageSecondaryNavigation
        modeId="differentials"
        pathname="/differentials/diagnoses/delirium"
        hasSubmittedSearch
        onSearch={vi.fn()}
      />,
    );
    await waitFor(() => expect(view.occupants()).toHaveLength(0));
    view.cleanupSlot();
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
    //
    // `factsheets` left this list when it gained a real second destination:
    // `/factsheets` (browse) and `/factsheets/search` are separate components,
    // so it is a port rather than a deletion. The others still have one surface
    // each, and ModeNav renders nothing below two items — adopting them would
    // remove the control they have and put nothing back (PR #1645).
    for (const modeId of ["documents", "answer", "prescribing", "tools"] as const) {
      expect([...MODE_NAV_ADOPTED_MODES]).not.toContain(modeId);
      expect(modeUsesHeaderModeNav(modeId)).toBe(false);
    }
  });
});
