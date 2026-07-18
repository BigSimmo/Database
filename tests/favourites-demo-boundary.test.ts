import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const routeSource = readFileSync(new URL("../src/app/favourites/page.tsx", import.meta.url), "utf8");
const librarySource = readFileSync(
  new URL("../src/components/clinical-dashboard/favourites-command-library-page.tsx", import.meta.url),
  "utf8",
);
const hubSource = readFileSync(
  new URL("../src/components/clinical-dashboard/favourites-hub.tsx", import.meta.url),
  "utf8",
);
const dashboardSource = readFileSync(new URL("../src/components/ClinicalDashboard.tsx", import.meta.url), "utf8");
const globalShellSource = readFileSync(
  new URL("../src/components/clinical-dashboard/global-search-shell.tsx", import.meta.url),
  "utf8",
);
const universalSearchSource = readFileSync(
  new URL("../src/components/clinical-dashboard/universal-search-command-surface.tsx", import.meta.url),
  "utf8",
);

describe("favourites demo-data boundary", () => {
  it("passes trusted server demo state and never merges prototype favourites into live mode unconditionally", () => {
    expect(routeSource).toContain("demoMode={isDemoMode()}");
    expect(librarySource).toContain("...(demoMode ? prototypeFavouriteItems : [])");
    expect(librarySource).not.toContain("[...prototypeFavouriteItems, ...savedRegistryFavourites]");
    expect(dashboardSource).toContain("demoMode={clientDemoMode}");
    expect(hubSource).toContain("...(demoMode ? favouriteItems : [])");
    expect(hubSource).not.toContain("[...favouriteItems, ...savedRegistryFavourites]");
    expect(hubSource).toContain('title="Additional sort options are coming soon"');
    expect(hubSource).toContain('title="Adding favourites from this screen is coming soon"');
    expect(hubSource).toContain('title="Creating favourite sets is coming soon"');
    expect(hubSource).toContain("Browse sets");
    expect(dashboardSource).not.toContain("Favourite creation is ready to connect.");
    expect(globalShellSource).toContain("demoMode={clientDemoMode}");
    expect(universalSearchSource).toContain("...(demoMode ? favouriteItems : [])");
    expect(universalSearchSource).not.toContain("[...favouriteItems, ...savedRegistryFavourites]");
  });
});
