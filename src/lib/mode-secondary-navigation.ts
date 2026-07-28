import { appModeHomeHref, type AppModeId } from "@/lib/app-modes";

export type ModeSecondaryNavigationEntry = {
  id: string;
  label: string;
  shortLabel?: string;
  href?: string;
  action?:
    | "search"
    | "therapy-search"
    | "therapy-recommend"
    | "therapy-compare"
    | "therapy-pathways"
    | "therapy-brief"
    | "therapy-sheets";
};

/**
 * Canonical secondary destinations for every app mode. These are deliberately
 * task-oriented: the global/sidebar navigation already owns mode homes, so a
 * secondary bar must never repeat a generic Home destination.
 */
export const modeSecondaryNavigationRegistry = {
  answer: [{ id: "ask", label: "Ask", action: "search" }],
  documents: [{ id: "search", label: "Search", action: "search" }],
  services: [{ id: "search", label: "Search", action: "search" }],
  forms: [{ id: "search", label: "Search", action: "search" }],
  favourites: [{ id: "search", label: "Search", action: "search" }],
  differentials: [
    { id: "search", label: "Search", href: appModeHomeHref("differentials", { focus: true }) },
    { id: "diagnoses", label: "Diagnoses", href: "/differentials/diagnoses" },
    { id: "compare", label: "Compare", href: "/differentials/presentations" },
  ],
  dsm: [
    { id: "search", label: "Search", href: appModeHomeHref("dsm", { focus: true }) },
    { id: "compare", label: "Compare", href: "/dsm/compare" },
  ],
  specifiers: [
    { id: "search", label: "Find", href: appModeHomeHref("specifiers", { focus: true }) },
    { id: "builder", label: "Build", href: "/specifiers/builder" },
    { id: "compare", label: "Compare", href: "/specifiers/compare" },
    { id: "map", label: "Map", href: "/specifiers/map" },
  ],
  formulation: [
    { id: "search", label: "Find", href: appModeHomeHref("formulation", { focus: true }) },
    { id: "builder", label: "Build", href: "/formulation/builder" },
    { id: "compare", label: "Compare", href: "/formulation/compare" },
    { id: "map", label: "Map", href: "/formulation/map" },
  ],
  prescribing: [{ id: "search", label: "Search", action: "search" }],
  tools: [{ id: "search", label: "Search", action: "search" }],
  "therapy-compass": [
    { id: "search", label: "Search", action: "therapy-search" },
    { id: "recommend", label: "Recommend", action: "therapy-recommend" },
    { id: "compare", label: "Compare", action: "therapy-compare" },
    { id: "pathways", label: "Pathways", action: "therapy-pathways" },
    { id: "brief", label: "Brief Intervention", action: "therapy-brief" },
    { id: "sheets", label: "Patient Sheets", action: "therapy-sheets" },
  ],
  factsheets: [{ id: "search", label: "Search", action: "search" }],
} as const satisfies Record<AppModeId, readonly ModeSecondaryNavigationEntry[]>;

export function modeSecondaryNavigationEntries(modeId: AppModeId): readonly ModeSecondaryNavigationEntry[] {
  return modeSecondaryNavigationRegistry[modeId];
}

export function activeModeSecondaryNavigationId(modeId: AppModeId, pathname: string): string {
  if (modeId === "differentials") {
    if (pathname.startsWith("/differentials/diagnoses")) return "diagnoses";
    if (pathname.startsWith("/differentials/presentations")) return "compare";
    return "search";
  }
  if (modeId === "dsm") return pathname.startsWith("/dsm/compare") ? "compare" : "search";
  if (modeId === "specifiers" || modeId === "formulation") {
    if (pathname.includes("/builder")) return "builder";
    if (pathname.includes("/compare")) return "compare";
    if (pathname.includes("/map")) return "map";
    return "search";
  }
  return modeSecondaryNavigationRegistry[modeId][0].id;
}

export function isModeSecondaryNavigationRoute(params: {
  modeId: AppModeId;
  pathname: string;
  hasSubmittedSearch: boolean;
}): boolean {
  const { modeId, pathname, hasSubmittedSearch } = params;
  if (hasSubmittedSearch) return true;

  // /documents/search is the documents mode home (composer already visible); do
  // not add a lone Search focus control until a query has been submitted.
  if (modeId === "documents") return false;
  if (modeId === "differentials") {
    return pathname === "/differentials/diagnoses" || pathname === "/differentials/presentations";
  }
  if (modeId === "dsm") return pathname === "/dsm/search" || pathname === "/dsm/compare";
  if (modeId === "specifiers") {
    return pathname === "/specifiers/builder" || pathname === "/specifiers/compare" || pathname === "/specifiers/map";
  }
  if (modeId === "formulation") {
    return (
      pathname === "/formulation/builder" || pathname === "/formulation/compare" || pathname === "/formulation/map"
    );
  }
  if (modeId === "factsheets") return pathname === "/factsheets/search";
  if (modeId === "therapy-compass") return pathname !== "/therapy-compass";
  return false;
}

function navigationHrefWithParams(href: string, entries: Iterable<readonly [string, string]>): string {
  const url = new URL(href, "http://secondary-navigation.local");
  const replacedKeys = new Set<string>();
  for (const [key, value] of entries) {
    if (!value) continue;
    if (!replacedKeys.has(key)) {
      url.searchParams.delete(key);
      replacedKeys.add(key);
    }
    url.searchParams.append(key, value);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

function uniqueValues(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim())),
  );
}

/** Carry route-backed query and selection state between compatible workflows. */
export function modeSecondaryNavigationHref(params: {
  modeId: AppModeId;
  itemId: string;
  href: string;
  currentSearchParams: URLSearchParams;
}): string {
  const { modeId, itemId, href, currentSearchParams } = params;
  const query = currentSearchParams.get("q") ?? currentSearchParams.get("query") ?? "";

  if (modeId === "differentials") {
    const entries: Array<readonly [string, string]> = query ? [["q", query]] : [];
    if (itemId === "search" && currentSearchParams.get("run") === "1") entries.push(["run", "1"]);
    if (currentSearchParams.get("ids")) {
      entries.push(["ids", currentSearchParams.get("ids") ?? ""]);
    }
    return navigationHrefWithParams(href, entries);
  }

  if (modeId === "dsm") {
    if (itemId === "search" && query) {
      return navigationHrefWithParams(
        appModeHomeHref("dsm", { query, focus: true, run: currentSearchParams.get("run") === "1" }),
        currentSearchParams.get("ids") ? [["ids", currentSearchParams.get("ids") ?? ""]] : [],
      );
    }
    return navigationHrefWithParams(
      href,
      currentSearchParams.get("ids") ? [["ids", currentSearchParams.get("ids") ?? ""]] : [],
    );
  }

  if (modeId === "specifiers") {
    const selections = uniqueValues([
      ...currentSearchParams.getAll("specifier"),
      currentSearchParams.get("a"),
      currentSearchParams.get("b"),
      currentSearchParams.get("selected"),
    ]);
    if (itemId === "builder")
      return navigationHrefWithParams(
        href,
        selections.map((value) => ["specifier", value] as const),
      );
    if (itemId === "compare") {
      return navigationHrefWithParams(
        href,
        selections.slice(0, 2).map((value, index) => [index === 0 ? "a" : "b", value] as const),
      );
    }
    if (itemId === "map" && selections[0]) {
      return navigationHrefWithParams(href, [
        ["selected", selections[0]],
        ...selections.map((value) => ["specifier", value] as const),
      ]);
    }
    return navigationHrefWithParams(href, [
      ...(query ? ([["q", query]] as const) : []),
      ...selections.map((value) => ["specifier", value] as const),
    ]);
  }

  if (modeId === "formulation") {
    const selections = uniqueValues([
      ...currentSearchParams.getAll("mechanism"),
      currentSearchParams.get("a"),
      currentSearchParams.get("b"),
    ]);
    const template = currentSearchParams.get("template");
    const templateEntry: Array<readonly [string, string]> = template ? [["template", template]] : [];
    if (itemId === "builder")
      return navigationHrefWithParams(href, [
        ...selections.map((value) => ["mechanism", value] as const),
        ...templateEntry,
      ]);
    if (itemId === "compare") {
      return navigationHrefWithParams(href, [
        ...selections.slice(0, 2).map((value, index) => [index === 0 ? "a" : "b", value] as const),
        ...templateEntry,
      ]);
    }
    if (itemId === "map" && selections[0]) {
      return navigationHrefWithParams(href, [
        ...selections.map((value) => ["mechanism", value] as const),
        ...templateEntry,
      ]);
    }
    return navigationHrefWithParams(href, [
      ...(query ? ([["q", query]] as const) : []),
      ...selections.map((value) => ["mechanism", value] as const),
      ...templateEntry,
    ]);
  }

  return href;
}
