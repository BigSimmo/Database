import { appModeHomeHref, factsheetsSearchHref, factsheetsTopicsHref, type AppModeId } from "@/lib/app-modes";
import { therapyWorkspaceNavigationEntries } from "@/lib/therapy-compass-navigation";

export type ModeSecondaryNavigationEntry = {
  id: string;
  label: string;
  shortLabel?: string;
  href?: string;
};

/**
 * Canonical secondary destinations for every app mode. These are deliberately
 * task-oriented: the global/sidebar navigation already owns mode homes, so a
 * secondary bar must never repeat a generic Home destination.
 */
export const modeSecondaryNavigationRegistry = {
  // Empty is a real answer, not a gap. These eight modes each registered one
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
    { id: "presentations", label: "Presentations", href: "/differentials/presentations" },
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
  calculators: [],
  // Record-owned outputs (briefs and patient sheets) deliberately stay off the
  // global mode bar: they require an explicitly selected therapy. This prevents
  // a generic navigation action from silently opening an unrelated default
  // record. The global/sidebar mode switch already owns Home.
  "therapy-compass": [
    { id: "search", label: "Search", href: "/therapy-compass/search" },
    { id: "recommend", label: "Recommend", href: "/therapy-compass/recommend" },
    { id: "compare", label: "Compare", href: "/therapy-compass/compare" },
    { id: "pathways", label: "Pathways", href: "/therapy-compass/pathways" },
    { id: "review", label: "Review", href: "/therapy-compass/review" },
  ],
  // Two genuinely distinct surfaces: `/factsheets/search` (query + filters +
  // result rows) and `/factsheets/topics` (category browse). Search leads, the
  // same way Dictionary leads with Terms then Topics. `/factsheets/[slug]` is a
  // record and never reaches here — `hasLocalInformationPageNavigation` returns
  // null for it first.
  //
  // No `focus: true` on Topics, unlike the Search/Find entry of every mode
  // above. Those tabs are the mode's search affordance, so focusing the composer
  // on arrival is the point. Topics is a browse destination — autofocusing there
  // would open the phone keyboard over the topics the user asked to see. The
  // search affordance for this mode is the Search tab.
  factsheets: [
    { id: "search", label: "Search", href: factsheetsSearchHref },
    { id: "topics", label: "Topics", href: factsheetsTopicsHref },
  ],
  // Search and Browse were one catalogue behind two destinations: the same
  // entries, the same rows, the same data, so a reader who typed a term while on
  // Browse had to change tab to see it. They are merged onto `/dictionary/search`,
  // which is why the surviving tab is labelled for the content ("Terms") rather
  // than for one of the two verbs it now covers. `/dictionary/browse` redirects.
  //
  // Four destinations, not five, is also what puts Terms and Topics — the two a
  // reader reaches for — in the phone bar's three slots beside More, instead of
  // Search and Browse, which were the same place.
  dictionary: [
    { id: "search", label: "Terms", href: "/dictionary/search" },
    { id: "topics", label: "Topics", href: "/dictionary/topics" },
    { id: "compare", label: "Compare", href: "/dictionary/compare" },
    { id: "sources", label: "Sources", href: "/dictionary/sources" },
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
 * Therapy uses the same registry as every other multi-route catalogue. Its
 * record-owned brief and patient-sheet outputs are intentionally absent.
 */
export const MODE_NAV_ADOPTED_MODES = [
  "dsm",
  "specifiers",
  "formulation",
  "differentials",
  "factsheets",
  "therapy-compass",
  "dictionary",
] as const satisfies readonly AppModeId[];

export type ModeNavAdoptedMode = (typeof MODE_NAV_ADOPTED_MODES)[number];

export function modeUsesHeaderModeNav(modeId: AppModeId): modeId is ModeNavAdoptedMode {
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
    // Browse + presentation detail are one Presentations family (symmetric with Diagnoses).
    if (pathname.startsWith("/differentials/presentations")) return "presentations";
    if (pathname === "/differentials/compare" || pathname.startsWith("/differentials/compare/")) {
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
    if (pathname === "/factsheets/topics" || pathname.startsWith("/factsheets/topics?")) return "topics";
    // `/factsheets` redirects to the shared home and never renders ModeNav.
    // `/factsheets/<slug>` is a record. Neither path is Search or Topics;
    // without this explicit null they would inherit the mode's first entry.
    return null;
  }
  if (modeId === "therapy-compass") {
    if (pathname === "/therapy-compass/search") return "search";
    if (pathname === "/therapy-compass/recommend") return "recommend";
    if (pathname === "/therapy-compass/compare") return "compare";
    if (pathname === "/therapy-compass/pathways") return "pathways";
    if (pathname === "/therapy-compass/review") return "review";
    return null;
  }
  if (modeId === "dictionary") {
    // `/dictionary/browse` is absent deliberately: it redirects to
    // `/dictionary/search` before a page renders, so it can never reach here.
    if (pathname === "/dictionary/search") return "search";
    if (pathname === "/dictionary/topics" || pathname.startsWith("/dictionary/topics/")) return "topics";
    if (pathname === "/dictionary/compare") return "compare";
    if (pathname === "/dictionary/sources") return "sources";
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
      pathname === "/differentials/presentations" ||
      pathname.startsWith("/differentials/presentations/") ||
      pathname === "/differentials/compare" ||
      pathname.startsWith("/differentials/compare/")
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
  // Same shape as `dsm` above: list the routed destinations that are not the
  // mode home. The clean `/factsheets` home stays out so the shared home remains
  // the single answer to "where can I go"; it reaches the bar through the
  // `hasSubmittedSearch` early return. Topics browse and Search both show the bar.
  if (modeId === "factsheets") return pathname === "/factsheets/search" || pathname === "/factsheets/topics";
  if (modeId === "therapy-compass") return pathname !== "/therapy-compass";
  if (modeId === "dictionary") {
    return ["/dictionary/search", "/dictionary/topics", "/dictionary/compare", "/dictionary/sources"].includes(
      pathname,
    );
  }
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

  if (modeId === "therapy-compass") {
    return navigationHrefWithParams(href, therapyWorkspaceNavigationEntries(currentSearchParams));
  }

  if (modeId === "differentials") {
    const entries: Array<readonly [string, string]> = query ? [["q", query]] : [];
    // Returning to Search with a carried query must reopen the results view
    // (`run=1`), not the empty mode home — even when the previous tab lacked run.
    if (itemId === "search" && query) entries.push(["run", "1"]);
    else if (itemId === "search" && currentSearchParams.get("run") === "1") entries.push(["run", "1"]);
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
    // not silently discard them. Topics goes to the clean category browse: it
    // reads neither param, so appending them would only produce a misleading URL.
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

  if (modeId === "dictionary") {
    if (itemId === "search") {
      // Terms is the current tab on `/dictionary/search`, so its own link must
      // not reset what you are looking at: `view` (the Terms/Abbrev scope),
      // `letter` and `run` travel with the query and the facets. `run` in
      // particular flips `hasSubmittedModeSearch` in `global-search-shell.tsx`,
      // which re-places the composer — a layout jump from clicking the tab you
      // are already on.
      return navigationHrefWithParams(href, [
        ...(query ? ([["q", query]] as const) : []),
        ...(query && currentSearchParams.get("run") === "1" ? ([["run", "1"]] as const) : []),
        ...(currentSearchParams.get("view") ? ([["view", currentSearchParams.get("view") ?? ""]] as const) : []),
        ...(currentSearchParams.get("letter") ? ([["letter", currentSearchParams.get("letter") ?? ""]] as const) : []),
        ...currentSearchParams.getAll("topic").map((value) => ["topic", value] as const),
        ...currentSearchParams.getAll("kind").map((value) => ["kind", value] as const),
      ]);
    }
    if (itemId === "compare") {
      return navigationHrefWithParams(href, [
        ...(currentSearchParams.get("a") ? ([["a", currentSearchParams.get("a") ?? ""]] as const) : []),
        ...(currentSearchParams.get("b") ? ([["b", currentSearchParams.get("b") ?? ""]] as const) : []),
      ]);
    }
  }

  return href;
}
