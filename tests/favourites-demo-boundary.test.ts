import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { resolveClientDemoMode, resolveUploadReadOnlyMode } from "@/lib/client-env";

const routeSource = readFileSync(new URL("../src/app/(search-app)/favourites/page.tsx", import.meta.url), "utf8");
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
const mobileCardSource = librarySource.slice(
  librarySource.indexOf("function FavouriteMobileCard"),
  librarySource.indexOf("function FavouritesTable"),
);

describe("favourites demo-data boundary", () => {
  it("passes trusted server demo state and never merges prototype favourites into live mode unconditionally", () => {
    expect(routeSource).toContain("const demoMode = resolveClientDemoMode({");
    expect(routeSource).toContain("explicitDemoMode: isDemoMode(),");
    expect(routeSource).toContain("localNoAuthMode: isLocalNoAuthMode(),");
    expect(routeSource).toContain("demoMode={demoMode}");
    expect(librarySource).toContain("...(demoMode ? prototypeFavouriteItems : [])");
    expect(librarySource).not.toContain("[...prototypeFavouriteItems, ...savedRegistryFavourites]");
    expect(dashboardSource).toContain("demoMode={clientDemoMode}");
    expect(hubSource).toContain("...(demoMode ? favouriteItems : [])");
    expect(hubSource).not.toContain("[...favouriteItems, ...savedRegistryFavourites]");
    expect(hubSource).toContain('aria-describedby="favourites-sort-unavailable"');
    expect(hubSource).toContain('aria-describedby="favourites-add-unavailable"');
    expect(hubSource).toContain('aria-describedby="favourites-new-set-unavailable"');
    expect(hubSource).toContain("Browse sets");
    expect(dashboardSource).not.toContain("Favourite creation is ready to connect.");
    expect(globalShellSource).toContain("demoMode={clientDemoMode}");
    expect(universalSearchSource).toContain("...(demoMode ? favouriteItems : [])");
    expect(universalSearchSource).not.toContain("[...favouriteItems, ...savedRegistryFavourites]");
    expect(universalSearchSource).toContain("if (includePrototypeSets)");
    expect(universalSearchSource).toContain("rankLocalFavourites(allFavouriteItems, trimmedQuery, demoMode)");
  });

  it("fails closed in production while preserving explicit and non-production demo modes", () => {
    expect(
      resolveClientDemoMode({
        explicitDemoMode: false,
        authUnavailableFallback: true,
        localNoAuthMode: false,
        environment: "production",
      }),
    ).toBe(false);
    expect(
      resolveClientDemoMode({
        explicitDemoMode: true,
        authUnavailableFallback: true,
        localNoAuthMode: false,
        environment: "production",
      }),
    ).toBe(true);
    expect(
      resolveClientDemoMode({
        explicitDemoMode: false,
        authUnavailableFallback: true,
        localNoAuthMode: false,
        environment: "development",
      }),
    ).toBe(true);
  });

  it("limits item selection to xl tables and keeps mobile cards action-only", () => {
    expect(mobileCardSource).toContain("function FavouriteMobileCard({ item }: { item: FavouriteItem })");
    expect(mobileCardSource).not.toContain("aria-pressed");
    expect(mobileCardSource).not.toContain("onSelect");
    expect(mobileCardSource).toContain("<RowActionsMenu item={item} />");
    expect(librarySource).toContain('"hidden min-w-0 max-w-full items-center gap-2.5 rounded-md text-left xl:flex"');
    expect(librarySource).toContain('"block min-w-0 max-w-full rounded-md text-left xl:hidden"');
    expect(librarySource).toContain(
      '"xl:bg-[color:var(--clinical-accent-soft)]/45 xl:shadow-[var(--shadow-rail-active)]"',
    );
  });

  it("keeps upload read-only independent of local no-auth demo treatment", () => {
    // Local no-auth is demo for favourites/recent-query owners, but uploads must stay writable.
    expect(
      resolveClientDemoMode({
        explicitDemoMode: false,
        authUnavailableFallback: false,
        localNoAuthMode: true,
        environment: "development",
      }),
    ).toBe(true);
    expect(
      resolveClientDemoMode({
        explicitDemoMode: false,
        authUnavailableFallback: false,
        localNoAuthMode: false,
        environment: "development",
      }),
    ).toBe(false);
    const browserAuthUnavailableDemoFallback = true;
    expect(
      resolveUploadReadOnlyMode({
        explicitDemoMode: false,
        authUnavailableFallback: browserAuthUnavailableDemoFallback,
        environment: "development",
      }),
    ).toBe(true);
    expect(
      resolveUploadReadOnlyMode({
        explicitDemoMode: false,
        authUnavailableFallback: false,
        environment: "development",
      }),
    ).toBe(false);
    expect(dashboardSource).toMatch(/const uploadReadOnlyMode = resolveUploadReadOnlyMode\(\{/);
    expect(dashboardSource).toContain("authUnavailableFallback: browserAuthUnavailableDemoFallback");
    expect(dashboardSource).not.toMatch(/const uploadReadOnlyMode = clientDemoMode\b/);
  });
});
