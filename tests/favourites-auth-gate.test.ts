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

    expect(modes).toContain("export function canAccessFavouritesMode");
    expect(modes).toContain("export function visibleAppModeDefinitionsForSession");

    expect(sidebar).toContain("sidebarAccountLibraryItems");
    expect(sidebar).toContain("Your library");
    expect(sidebar).toContain('aria-label="Your library"');
    expect(sidebar).toContain("showAccountLibrary");
    expect(sidebar).not.toMatch(/const sidebarToolItems = \[[\s\S]*\{ id: "favourites", label: "Favourites"/);

    expect(shell).toContain("showAccountLibrary={favouritesAccessible}");
    expect(shell).toContain("canAccessFavourites={favouritesAccessible}");
    expect(shell).toContain("useFavouritesAccess");
    expect(shell).toContain('openAccountSetup("favourites")');

    expect(dashboard).toContain("canAccessFavourites={favouritesAccessible}");
    expect(dashboard).toContain("showAccountLibrary={favouritesAccessible}");
    expect(dashboard).toContain('openAccountSetup("favourites")');
    expect(dashboard).toContain("intent={accountSetupIntent}");
    expect(dashboard).toContain('mode === "favourites" && !favouritesAccessible');

    expect(header).toContain("canAccessFavourites");
    expect(header).toContain("canAccessFavourites = false");
    expect(header).toContain("visibleAppModeDefinitionsForSession");
    expect(header).toContain("onRequestAccountSetup");
    expect(header).toContain("demoMode,");

    expect(library).toContain("canAccessFavouritesMode");
    expect(library).toContain('intent="favourites"');
    expect(library).toContain("Sign up to save favourites");
    expect(library).toContain('data-testid="favourites-open-account-setup"');

    expect(accountSetup).toContain('intent?: "default" | "favourites"');
    expect(accountSetup).toContain("Sign up to save favourites");
  });
});
