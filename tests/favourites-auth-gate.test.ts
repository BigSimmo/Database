import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("favourites auth gate", () => {
  it("keeps Favourites out of public Tools and behind Your library + access helper", () => {
    const sidebar = source("src/components/clinical-dashboard/ClinicalSidebar.tsx");
    const modes = source("src/lib/app-modes.ts");
    const shell = source("src/components/clinical-dashboard/global-search-shell.tsx");
    const dashboard = source("src/components/ClinicalDashboard.tsx");
    const header = source("src/components/clinical-dashboard/master-search-header.tsx");
    const library = source("src/components/clinical-dashboard/favourites-command-library-page.tsx");
    const accountSetup = source("src/components/clinical-dashboard/account-setup-dialog.tsx");
    const commandSurface = source("src/components/clinical-dashboard/universal-search-command-surface.tsx");
    const toolsCatalog = source("src/lib/tools-catalog.ts");
    const launcher = source("src/components/applications-launcher-page.tsx");
    const alsoMatches = source("src/components/clinical-dashboard/universal-search-also-matches.tsx");

    expect(modes).toContain("export function canAccessFavouritesMode");
    expect(modes).toContain("export function visibleAppModeDefinitionsForSession");
    expect(modes).toContain("export function filterCrossModesForSession");

    expect(sidebar).toContain("sidebarAccountLibraryItems");
    expect(sidebar).toContain("Your library");
    expect(sidebar).toContain('aria-label="Your library"');
    expect(sidebar).toContain("showAccountLibrary");
    expect(sidebar).toContain("primarySidebarToolIds");
    expect(sidebar).not.toMatch(/const sidebarToolItems = \[[\s\S]*\{ id: "favourites", label: "Favourites"/);

    // Constrain to the Set initializer so later activeMode/href mentions of
    // specialist modes (e.g. differentials) do not false-fail the exclusion check.
    const primarySidebarInitializer = sidebar.match(
      /const primarySidebarToolIds = new Set<\(typeof sidebarToolItems\)\[number\]\["id"\]>\(\[([\s\S]*?)\]\);/,
    )?.[1];
    expect(primarySidebarInitializer).toBeTruthy();
    const primarySidebarIds = [...(primarySidebarInitializer ?? "").matchAll(/"([^"]+)"/g)].map((match) => match[1]);
    expect(primarySidebarIds).toEqual(["answer", "documents", "services", "forms", "tools", "therapy-compass"]);
    for (const excludedId of ["differentials", "dsm", "specifiers", "formulation", "prescribing", "factsheets"]) {
      expect(primarySidebarIds).not.toContain(excludedId);
    }

    expect(shell).toContain("showAccountLibrary={favouritesAccessible}");
    expect(shell).toContain("canAccessFavourites={favouritesAccessible}");
    expect(shell).toContain("useFavouritesAccess");
    expect(shell).toContain('openAccountSetup("favourites")');
    expect(shell).toContain('if (mode === "favourites" && !favouritesAccessible)');
    expect(shell).toContain('if (favouritesAccessible) router.prefetch("/favourites")');

    expect(dashboard).toContain("canAccessFavourites={favouritesAccessible}");
    expect(dashboard).toContain("showAccountLibrary={favouritesAccessible}");
    expect(dashboard).toContain("useDashboardShellActions");
    expect(dashboard).toContain('openAccountSetup("favourites")');
    expect(dashboard).toContain("intent={accountSetupIntent}");
    expect(dashboard).toContain('mode === "favourites" && !favouritesAccessible');
    expect(dashboard).toContain("FavouritesGuestGate");

    const shellActions = source("src/components/clinical-dashboard/use-dashboard-shell-actions.ts");
    expect(shellActions).toContain("useFavouritesAccess");
    expect(shellActions).toContain("favouritesAccessible");
    expect(shellActions).toContain('if (favouritesAccessible) prefetch("/favourites")');

    expect(header).toContain("canAccessFavourites");
    expect(header).toContain("canAccessFavourites = false");
    expect(header).toContain("visibleAppModeDefinitionsForSession");
    expect(header).toContain("onRequestAccountSetup");
    expect(header).toContain("canAccessFavourites={canAccessFavourites}");
    expect(header).toContain('targetMode === "favourites" && !canAccessFavourites');
    expect(header).toContain("demoMode: false");
    expect(header).toContain('searchMode === "favourites" && !canAccessFavourites');

    expect(commandSurface).toContain("filterCrossModesForSession");
    expect(commandSurface).toContain("canAccessFavourites");
    expect(commandSurface).toContain("canAccessFavourites && trimmedQuery && visibleFavouriteMatches.length");
    expect(commandSurface).toContain("demoMode: false");

    expect(toolsCatalog).toContain("export function toolCatalogRecordsForSession");
    expect(launcher).toContain("toolCatalogRecordsForSession");
    expect(launcher).toContain("quickActionsForSession");
    expect(launcher).toContain("desktopFiltersForSession");
    expect(alsoMatches).toContain("favouritesAccessible");
    expect(alsoMatches).toContain("isFavouritesHref");

    expect(library).toContain("canAccessFavouritesMode");
    expect(library).toContain('intent="favourites"');
    expect(library).toContain("Sign up to save favourites");
    expect(library).toContain('data-testid="favourites-open-account-setup"');

    expect(accountSetup).toContain('intent?: "default" | "favourites"');
    expect(accountSetup).toContain("Sign up to save favourites");
  });
});
