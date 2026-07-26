import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SEARCH_APP_ROOT = join(process.cwd(), "src/app/(search-app)");

const MODE_HOME_LOADING_ROUTES = [
  "services",
  "forms",
  "favourites",
  "differentials",
  "dsm",
  "specifiers",
  "formulation",
  "therapy-compass",
  "factsheets",
  "tools",
] as const;

describe("mode-home loading contract", () => {
  it("uses ModeHomeRouteLoading for every standalone mode home", () => {
    for (const route of MODE_HOME_LOADING_ROUTES) {
      const loadingPath = join(SEARCH_APP_ROOT, route, "loading.tsx");
      expect(existsSync(loadingPath), `missing ${route}/loading.tsx`).toBe(true);
      const source = readFileSync(loadingPath, "utf8");
      expect(source).toContain("ModeHomeRouteLoading");
      expect(source).not.toMatch(/Loading services|Loading medication|Loading library/);
    }
  });

  it("does not blank standalone mode children behind ClientHydrationBoundary", () => {
    const shellSource = readFileSync(
      join(process.cwd(), "src/components/clinical-dashboard/global-search-shell.tsx"),
      "utf8",
    );
    expect(shellSource).not.toMatch(/import\s*\{[^}]*ClientHydrationBoundary/);
    expect(shellSource).not.toMatch(/<ClientHydrationBoundary\b/);
    expect(shellSource).toContain("SearchCommandProvider value={searchCommandContextValue}>{children}");
  });

  it("keeps route children outside useSearchParams Suspense on standalone shells", () => {
    const shellSource = readFileSync(
      join(process.cwd(), "src/components/clinical-dashboard/global-search-shell.tsx"),
      "utf8",
    );
    const ownershipSource = readFileSync(join(process.cwd(), "src/lib/search-route-ownership.ts"), "utf8");
    expect(ownershipSource).toContain("export function isAlwaysStandaloneShellPath");
    // Outer shell skips the useSearchParams Suspense for always-standalone paths.
    expect(shellSource).toMatch(
      /export function GlobalSearchShell[\s\S]*?if \(isAlwaysStandaloneShellPath\(pathname\)\) \{[\s\S]*?GlobalStandaloneSearchShellClient/,
    );
    expect(shellSource).toContain("ShellSearchParamsBridge");
    // Bridge is the only Suspense child that may call useSearchParams in the
    // standalone path; the body that renders {children} must not.
    expect(shellSource).toMatch(
      /function GlobalStandaloneSearchShellClient[\s\S]*?<Suspense fallback=\{null\}>[\s\S]*?ShellSearchParamsBridge/,
    );
    expect(shellSource).toMatch(
      /function GlobalStandaloneSearchShellBody[\s\S]*?SearchCommandProvider value=\{searchCommandContextValue\}>\{children\}/,
    );
    expect(shellSource).not.toMatch(/function GlobalStandaloneSearchShellBody[\s\S]*?useSearchParams\(\)/);
  });

  it("lazy-loads ClinicalDashboard so namespaced homes skip its module graph", () => {
    const shellSource = readFileSync(
      join(process.cwd(), "src/components/clinical-dashboard/global-search-shell.tsx"),
      "utf8",
    );
    expect(shellSource).toMatch(/dynamic\(\s*\(\)\s*=>\s*import\("@\/components\/ClinicalDashboard"\)/);
    expect(shellSource).not.toMatch(/^import \{ ClinicalDashboard \} from/m);
  });

  it("keeps mode-home route loading top-aligned on phones", () => {
    const skeletonSource = readFileSync(join(process.cwd(), "src/components/mode-home-page-skeleton.tsx"), "utf8");
    expect(skeletonSource).toContain("items-start");
    expect(skeletonSource).toContain("sm:items-center");
  });
});

// Keep the suite from being deleted as unused if the route inventory drifts.
describe("search-app route inventory smoke", () => {
  it("still has a (search-app) tree", () => {
    expect(statSync(SEARCH_APP_ROOT).isDirectory()).toBe(true);
    expect(readdirSync(SEARCH_APP_ROOT).length).toBeGreaterThan(5);
  });
});
