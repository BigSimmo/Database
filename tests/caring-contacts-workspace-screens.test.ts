import { existsSync, readdirSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const WORKSPACE_APP_DIR = "src/app/caring-contacts";
const WORKSPACE_SPEC_PATH = "tests/ui-caring-contacts-workspace.spec.ts";

/**
 * Discovers all page routes under `src/app/caring-contacts/` by scanning the filesystem.
 */
function discoverWorkspacePageRoutes(): string[] {
  const rootDir = resolve(process.cwd(), WORKSPACE_APP_DIR);
  if (!existsSync(rootDir)) return [];

  const routes: string[] = [];
  const entries = readdirSync(rootDir, { recursive: true, withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || entry.name !== "page.tsx") continue;
    const absPath = resolve(entry.parentPath, entry.name);
    const relFromApp = relative(resolve(process.cwd(), "src/app"), absPath).split(sep).join("/");
    // "caring-contacts/page.tsx" -> "/caring-contacts"
    // "caring-contacts/patients/page.tsx" -> "/caring-contacts/patients"
    const route = "/" + relFromApp.replace(/\/page\.tsx$/, "");
    routes.push(route);
  }

  return routes.sort();
}

/**
 * Parses the registered route constants from `tests/ui-caring-contacts-workspace.spec.ts`.
 */
function parseRegisteredWorkspaceScreens(): { name: string; route: string }[] {
  const specSource = readFileSync(resolve(process.cwd(), WORKSPACE_SPEC_PATH), "utf8");

  const routeMap = new Map<string, string>();
  const constMatches = [...specSource.matchAll(/const\s+([A-Z_]+_ROUTE)\s*=\s*([^;\n]+);/g)];
  for (const match of constMatches) {
    const varName = match[1];
    let val = match[2].trim();
    if (val.startsWith('"') || val.startsWith("'")) {
      val = val.slice(1, -1);
    } else if (val.startsWith("`")) {
      val = val.slice(1, -1).replace(/\$\{([A-Z_]+_ROUTE)\}/g, (_, ref) => routeMap.get(ref) ?? "");
    }
    routeMap.set(varName, val);
  }

  const screensMatch = specSource.match(/const\s+WORKSPACE_SCREENS\s*=\s*\[([\s\S]*?)\]\s*as\s+const/);
  if (!screensMatch) {
    throw new Error(`${WORKSPACE_SPEC_PATH}: could not find WORKSPACE_SCREENS definition`);
  }

  const screenEntries: { name: string; route: string }[] = [];
  const itemMatches = [
    ...screensMatch[1].matchAll(/\{\s*name:\s*["']([^"']+)["'],\s*route:\s*([A-Za-z0-9_]+|["'`][^"'`]+["'`])/g),
  ];

  for (const match of itemMatches) {
    const name = match[1];
    let rawRoute = match[2].trim();
    if (rawRoute.startsWith('"') || rawRoute.startsWith("'") || rawRoute.startsWith("`")) {
      rawRoute = rawRoute.slice(1, -1);
    } else if (routeMap.has(rawRoute)) {
      rawRoute = routeMap.get(rawRoute)!;
    }
    screenEntries.push({ name, route: rawRoute });
  }

  return screenEntries;
}

describe("Caring Contacts workspace screen registration", () => {
  it("discovers all filesystem page routes under src/app/caring-contacts", () => {
    const routes = discoverWorkspacePageRoutes();
    expect(routes).toContain("/caring-contacts");
    expect(routes).toContain("/caring-contacts/patients");
    expect(routes.length).toBeGreaterThanOrEqual(2);
  });

  it("asserts that all page routes under src/app/caring-contacts are registered in WORKSPACE_SCREENS", () => {
    const discoveredRoutes = discoverWorkspacePageRoutes();
    const registeredScreens = parseRegisteredWorkspaceScreens();
    const registeredRoutes = registeredScreens.map((screen) => screen.route);

    for (const route of discoveredRoutes) {
      expect(
        registeredRoutes,
        `Route "${route}" in ${WORKSPACE_APP_DIR} is missing from WORKSPACE_SCREENS in ${WORKSPACE_SPEC_PATH}. ` +
          `Every production caring-contacts route must be tested across all review widths and accessibility modes.`,
      ).toContain(route);
    }
  });

  it("asserts that every WORKSPACE_SCREENS entry corresponds to an existing page.tsx file", () => {
    const registeredScreens = parseRegisteredWorkspaceScreens();
    for (const screen of registeredScreens) {
      const relPath = screen.route.replace(/^\//, "");
      const pagePath = resolve(process.cwd(), "src/app", relPath, "page.tsx");
      expect(
        existsSync(pagePath),
        `WORKSPACE_SCREENS entry "${screen.name}" (${screen.route}) points to non-existent ${pagePath}`,
      ).toBe(true);
    }
  });
});
