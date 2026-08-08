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
  // Empty is a real answer, not a gap. These seven modes each registered one
  // `action: "search"` entry, which rendered a lone <button> inside its own
  // <nav> landmark whose only effect was focusing a composer already visible on
  // the same screen — a landmark and a tab stop spent on a no-op. Every one of
  // them is genuinely single-surface (records, or one page), so there was no
  // destination to adopt onto the shared bar and nothing to replace the button
  // with. Deleted rather than ported.
  answer: [],
  documents: [],
  services: [],
  forms: [],
  favourites: [],
  differentials: [
    { id: "search", label: "Search", href: appModeHomeHref("differentials", { focus: true }) },
    { id: "diagnoses", label: "Diagnoses", href: "/differentials/diagnoses" },
    { id: "compare", label: "Compare", href: "/differentials/compare" },
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
  prescribing: [],
  tools: [],
  // Inert: `PageSecondaryNavigation` early-returns on `/therapy-compass*`, and
  // the mode's live destination list is `useTherapyNavItems` in
  // `src/components/therapy-compass/nav.tsx`, which feeds the shared `ModeNav`.
  // Kept because this registry is a 13-mode contract, not because it renders.
  // Editing these entries changes nothing a user sees.
  "therapy-compass": [
    { id: "search", label: "Search", action: "therapy-search" },
    { id: "recommend", label: "Recommend", action: "therapy-recommend" },
    { id: "compare", label: "Compare", action: "therapy-compare" },
    { id: "pathways", label: "Pathways", action: "therapy-pathways" },
    { id: "brief", label: "Brief Intervention", action: "therapy-brief" },
    { id: "sheets", label: "Patient Sheets", action: "therapy-sheets" },
  ],
  // Two genuinely distinct surfaces: `/factsheets` is the browse home (category
  // chips + a featured grid) and `/factsheets/search` is a separate component
  // with filters, a view toggle and result rows. `/factsheets/[slug]` is a
  // record and never reaches here — `hasLocalInformationPageNavigation` returns
  // null for it first.
  // No `focus: true` on Topics, unlike the Search/Find entry of every mode
  // above. Those tabs are the mode's search affordance, so focusing the composer
  // on arrival is the point. Topics is a browse destination — autofocusing there
  // would open the phone keyboard over the topics the user asked to see. The
  // search affordance for this mode is the Search tab.
  factsheets: [
    { id: "topics", label: "Topics", href: appModeHomeHref("factsheets") },
    { id: "search", label: "Search", href: "/factsheets/search" },
  ],
} as const satisfies Record<AppModeId, readonly ModeSecondaryNavigationEntry[]>;

type RegistryEntry = (typeof modeSecondaryNavigationRegistry)[AppModeId][number];

/**
 * The ids of registry entries that carry an `href`, and so can become a
 * `ModeNavItem`. Derived from the registry literal rather than written out, so
 * adding a routed entry without choosing an icon for it fails the typecheck in
 * `RegistryModeNav` instead of shipping a silent default.
 */
export type RoutedModeSecondaryNavigationId = Extract<RegistryEntry, { href: string }>["id"];

/**
 * Modes whose destinations render as the shared header bar rather than the
 * in-flow `SecondaryNavigation` strip.
 *
 * Listed rather than derived from "has two or more routed entries". The
 * derivation is the *criterion*, and `tests/mode-secondary-navigation.test.ts`
 * checks this set against it — but a registry edit must not silently move a
 * mode onto a different navigation surface. Adoption is a per-mode decision
 * with its own density evidence (`tests/ui-mode-nav-density.spec.ts`).
 *
 * `therapy-compass` is absent because it never reaches this registry:
 * `PageSecondaryNavigation` early-returns on `/therapy-compass*` and the mode
 * feeds `ModeNav` from `useTherapyNavItems` instead.
 */
export const MODE_NAV_ADOPTED_MODES = [
  "dsm",
  "specifiers",
  "formulation",
  "differentials",
  "factsheets",
] as const satisfies readonly AppModeId[];

export function modeUsesHeaderModeNav(modeId: AppModeId): boolean {
  return (MODE_NAV_ADOPTED_MODES as readonly AppModeId[]).includes(modeId);
}

export function modeSecondaryNavigationEntries(modeId: AppModeId): readonly ModeSecondaryNavigationEntry[] {
  return modeSecondaryNavigationRegistry[modeId];
}

/** Count of registry entries that carry an href (eligible ModeNav slots). */
export function routedModeSecondaryNavigationCount(modeId: AppModeId): number {
  return modeSecondaryNavigationEntries(modeId).filter((entry) => Boolean(entry.href)).length;
}

/**
 * Which destination is current for `modeId` on `pathname`.
 *
 * Returns `null` when no registered destination owns the route (record/detail
 * pages, unknown in-mode paths). Callers that always pass this into `ModeNav`
 * must treat `null` as "no `aria-current`", not fall back to the first slot —
 * otherwise Find/Search is falsely marked current on every unmatched path.
 */
export function activeModeSecondaryNavigationId(modeId: AppModeId, pathname: string): string | null {
  if (modeId === "differentials") {
    if (pathname.startsWith("/differentials/diagnoses")) return "diagnoses";
    if (pathname.startsWith("/differentials/compare") || pathname.startsWith("/differentials/presentations")) {
      return "compare";
    }
    if (pathname === "/differentials" || pathname.startsWith("/differentials?")) return "search";
    return null;
  }
  if (modeId === "dsm") {
    if (pathname.startsWith("/dsm/compare")) return "compare";
    if (pathname === "/dsm" || pathname === "/dsm/search" || pathname.startsWith("/dsm?")) return "search";
    return null;
  }
  if (modeId === "specifiers" || modeId === "formulation") {
    // Exact segment prefixes, not `includes`: a future slug containing
    // "map"/"compare"/"builder" must not steal `aria-current` from Find.
    // Matches the exact-path checks in `isModeSecondaryNavigationRoute`.
    if (pathname === `/${modeId}/builder` || pathname.startsWith(`/${modeId}/builder/`)) return "builder";
    if (pathname === `/${modeId}/compare` || pathname.startsWith(`/${modeId}/compare/`)) return "compare";
    if (pathname === `/${modeId}/map` || pathname.startsWith(`/${modeId}/map/`)) return "map";
    if (pathname === `/${modeId}` || pathname.startsWith(`/${modeId}?`)) return "search";
    return null;
  }
  if (modeId === "factsheets") {
    if (pathname === "/factsheets/search" || pathname.startsWith("/factsheets/search?")) return "search";
    if (pathname === "/factsheets" || pathname.startsWith("/factsheets?")) return "topics";
    // `/factsheets/<slug>` is a record. It cannot reach `ModeNav` today —
    // `hasLocalInformationPageNavigation` returns null for it first — but
    // without this branch it would inherit the mode's first entry.
    return null;
  }
  // Every mode with destinations has a branch above; the rest register none, so
  // nothing can be current. This used to be
  // `modeSecondaryNavigationRegistry[modeId][0]?.id ?? null`, which existed only
  // to keep a lone action button lit. With real multi-tab modes it would mark
  // the first slot current on every unmatched path — the exact bug this
  // function's doc comment warns callers about.
  return null;
}

export function isModeSecondaryNavigationRoute(params: {
  modeId: AppModeId;
  pathname: string;
  hasSubmittedSearch: boolean;
}): boolean {
  const { modeId, pathname, hasSubmittedSearch } = params;
  // Load-bearing for all five adopted modes: it is the only thing that puts the
  // bar on a submitted-search mode home, e.g. `/differentials?q=…&run=1`, whose
  // clause below lists only the workflow routes. Not leftover gating.
  if (hasSubmittedSearch) return true;

  if (modeId === "differentials") {
    return (
      pathname === "/differentials/diagnoses" ||
      pathname === "/differentials/compare" ||
      pathname === "/differentials/presentations" ||
      pathname.startsWith("/differentials/presentations/")
    );
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
  // Same shape as `dsm` above: list the routed destination that is not the mode
  // home. The clean `/factsheets` home stays out so its `ModeHomeTemplate` tiles
  // remain the single answer to "where can I go"; it reaches the bar through the
  // `hasSubmittedSearch` early return, and Topics is marked current there.
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
    // Compare (and other in-mode tabs) reuse URL-backed selection so ticks on
    // search survive ModeNav handoff without a second client store.
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

  if (modeId === "factsheets") {
    // Search carries the live query and category filter so switching tabs does
    // not silently discard them. Topics goes to the clean browse home: it reads
    // neither param, so appending them would only produce a misleading URL.
    if (itemId !== "search") return href;
    const category = currentSearchParams.get("category");
    return navigationHrefWithParams(href, [
      ...(query ? ([["q", query]] as const) : []),
      ...(category ? ([["category", category]] as const) : []),
      // `run` travels with the query, as it does for dsm. Search is the current
      // tab on /factsheets/search, and dropping `run` from its own link flips
      // `hasSubmittedModeSearch` (global-search-shell.tsx:421) to false, which
      // re-places the composer — a layout jump from clicking where you already are.
      ...(query && currentSearchParams.get("run") === "1" ? ([["run", "1"]] as const) : []),
    ]);
  }

  return href;
}
