import { readdirSync, readFileSync } from "node:fs";
import { join, relative as relativePath, sep } from "node:path";

import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { isHeaderAddonSlotOwnedRoute } from "@/components/mode-nav/header-addon-slot";
import { hasLocalInformationPageNavigation, PageSecondaryNavigation } from "@/components/page-secondary-navigation";
import { phoneHeaderCollapseAddonSlotId } from "@/lib/mode-home-composer";
import {
  MODE_NAV_ADOPTED_MODES,
  modeSecondaryNavigationEntries,
  modeUsesHeaderModeNav,
} from "@/lib/mode-secondary-navigation";

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
    // The six information routes converted onto `InPageNavHeader`.
    expect(isHeaderAddonSlotOwnedRoute("/services/community-team")).toBe(true);
    expect(isHeaderAddonSlotOwnedRoute("/forms/transport-crisis-form")).toBe(true);
    expect(isHeaderAddonSlotOwnedRoute("/specifiers/with-anxious-distress")).toBe(true);
    expect(isHeaderAddonSlotOwnedRoute("/formulation/rumination")).toBe(true);
    expect(isHeaderAddonSlotOwnedRoute("/dsm/diagnoses/major-depressive-disorder")).toBe(true);
    expect(isHeaderAddonSlotOwnedRoute("/dsm/diagnoses/major-depressive-disorder/differentials")).toBe(true);
    // Factsheet and medication detail, converted onto the shared header.
    expect(isHeaderAddonSlotOwnedRoute("/factsheets/sertraline")).toBe(true);
    expect(isHeaderAddonSlotOwnedRoute("/medications/sertraline")).toBe(true);
    expect(isHeaderAddonSlotOwnedRoute("/medications")).toBe(false);

    // The presentations workflow page renders no portal, and the shell index is
    // not a document detail route.
    expect(isHeaderAddonSlotOwnedRoute("/differentials/presentations/acute-confusion-encephalopathy")).toBe(false);
    expect(isHeaderAddonSlotOwnedRoute("/documents/search")).toBe(false);
    expect(isHeaderAddonSlotOwnedRoute("/differentials/diagnoses")).toBe(false);
    // Mode homes and the builder/compare/map/search surfaces keep the mode bar,
    // so they must stay outside the claimant set.
    expect(isHeaderAddonSlotOwnedRoute("/services")).toBe(false);
    expect(isHeaderAddonSlotOwnedRoute("/specifiers/compare")).toBe(false);
    expect(isHeaderAddonSlotOwnedRoute("/formulation/builder")).toBe(false);
    expect(isHeaderAddonSlotOwnedRoute("/dsm/search")).toBe(false);
    expect(isHeaderAddonSlotOwnedRoute("/dsm/compare")).toBe(false);
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
      "/services/community-team",
      "/forms/transport-crisis-form",
      "/specifiers/with-anxious-distress",
      "/formulation/rumination",
      "/dsm/diagnoses/major-depressive-disorder",
      "/dsm/diagnoses/major-depressive-disorder/differentials",
      "/factsheets/sertraline",
      "/medications/sertraline",
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
      />,
    );
    await waitFor(() => expect(view.occupants()).toHaveLength(0));
    view.cleanupSlot();
  });

  it("gives an adopted mode's own workflow route exactly one bar in the slot", async () => {
    expect(modeUsesHeaderModeNav("dsm")).toBe(true);
    expect(isHeaderAddonSlotOwnedRoute("/dsm/compare")).toBe(false);

    const view = renderIntoHeaderWithAddonSlot(
      <PageSecondaryNavigation modeId="dsm" pathname="/dsm/compare" hasSubmittedSearch={false} />,
    );
    await waitFor(() => expect(view.occupants()).toHaveLength(1));
    view.cleanupSlot();
  });

  it("names every component that claims the slot", () => {
    // The only evidence a route claims the slot is that its component renders
    // into it, so the predicate cannot be derived from routes alone. Enumerate
    // the claimants instead: a new one fails here until
    // `isHeaderAddonSlotOwnedRoute` is given its route.
    //
    // There are two forms of that evidence, and both must be scanned. A page can
    // render `PhoneHeaderCollapsePortal` itself (DocumentViewer still does), or
    // it can render `InPageNavHeader`, which portals on its behalf. Scanning only
    // for the portal would have gone quiet the moment the shared header was
    // extracted — every future adopter would claim the slot invisibly to this
    // guard, which is the exact failure it exists to prevent.
    const claimsSlot = /<(PhoneHeaderCollapsePortal|InPageNavHeader)\b/;
    // The shared header is the mechanism, not a claimant: it has no route.
    const sharedHeader = "src/components/in-page-nav/in-page-nav-header.tsx";
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
        // Posix separators regardless of host: a `String.replace` of
        // `${cwd}/` matches nothing on Windows, so both the shared-header
        // exclusion below and the comparison at the end silently missed.
        const relative = relativePath(process.cwd(), path).split(sep).join("/");
        if (relative === sharedHeader) continue;
        if (claimsSlot.test(readFileSync(path, "utf8"))) {
          claimants.push(relative);
        }
      }
    };
    walk(join(process.cwd(), "src/components"));

    // The `*-nav-header.tsx` modules are the section-table siblings
    // `docs/search-chrome-behaviour.md` pins every new conversion to. For the
    // four Server Component pages they are also a necessity — sections carry
    // `LucideIcon` values and the header needs hooks, neither of which crosses
    // the RSC boundary — while `factsheet-` and `medication-nav-header.tsx`
    // adopt the same shape from Client Component pages by convention. Either
    // way the route's claim is registered in the sibling, not the page.
    expect(claimants.sort()).toEqual([
      "src/components/DocumentViewer.tsx",
      "src/components/clinical-dashboard/medication-nav-header.tsx",
      "src/components/differentials/differential-detail-page.tsx",
      "src/components/dsm/dsm-diagnosis-nav-header.tsx",
      "src/components/dsm/dsm-differential-considerations-page.tsx",
      "src/components/factsheets/factsheet-nav-header.tsx",
      "src/components/forms/form-detail-page.tsx",
      "src/components/formulation/formulation-nav-header.tsx",
      "src/components/services/service-detail-page.tsx",
      "src/components/specifiers/specifier-map-nav-header.tsx",
      "src/components/specifiers/specifier-nav-header.tsx",
    ]);
  });

  it("keeps the modes that register no destinations off the bar entirely", () => {
    // These four each carried a single `action` entry that focused a composer
    // already on screen. It was deleted rather than adopted: a one-button <nav>
    // is a landmark and a tab stop spent on a no-op, and ModeNav renders
    // nothing below two items, so adopting would have removed the control and
    // put nothing back (PR #1645). They now have neither the header bar nor the
    // in-flow strip.
    //
    // `factsheets` left this list when it gained a real second destination:
    // `/factsheets` (browse) and `/factsheets/search` are separate components,
    // so it was a port rather than a deletion.
    for (const modeId of ["documents", "answer", "prescribing", "tools"] as const) {
      expect(modeSecondaryNavigationEntries(modeId)).toEqual([]);
      expect([...MODE_NAV_ADOPTED_MODES]).not.toContain(modeId);
      expect(modeUsesHeaderModeNav(modeId)).toBe(false);
    }
  });
});
