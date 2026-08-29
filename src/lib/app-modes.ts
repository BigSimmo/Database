import type { ClinicalQueryMode } from "@/lib/types";
import { documentsSearchHref } from "@/lib/document-flow-routes";
import { consolidatedModeHomeModeIds, consolidatedModeSearchPath } from "@/lib/consolidated-mode-home-redirect";
import { appendSearchNavigationContext, type SearchNavigationOptions } from "@/lib/search-navigation-context";

export const appModeIds = [
  "answer",
  "documents",
  "services",
  "forms",
  "favourites",
  "differentials",
  "dsm",
  "specifiers",
  "formulation",
  "prescribing",
  "tools",
  "calculators",
  "therapy-compass",
  "factsheets",
  "dictionary",
] as const;

export type AppModeId = (typeof appModeIds)[number];
export type SearchableAppModeId = AppModeId;

export type AppModeSearchKind =
  | "answer"
  | "documents"
  | "services"
  | "forms"
  | "favourites"
  | "differentials"
  | "dsm"
  | "specifiers"
  | "formulation"
  | "therapies"
  | "calculators"
  | "tools";
export type AppModeResultKind = AppModeSearchKind;

export type AppModeResultsSurface = "results-band" | "answer";

export type AppModeSearchConfig = {
  kind: AppModeSearchKind;
  placeholder: string;
  inputAriaLabel: string;
  submitIdleLabel: string;
  submitBusyLabel: string;
  submitAriaLabel: string;
  emptyTitle: string;
  readyTitle: string;
  progressLabel: string;
  resultKind: AppModeResultKind;
  /** Does this mode present a result LIST (which must wear the shared results
      band) or a synthesised answer? Required and non-optional on purpose: a new
      mode cannot compile until its author states which surface it is, and the
      band-adoption contract test reads this to know what it must find. */
  resultsSurface: AppModeResultsSurface;
  resultHeading: string;
  statusLabel: string;
  nextStep: string;
  badgeLabel: string | null;
  defaultQueryMode?: ClinicalQueryMode;
};

export type AppModeDefinition = {
  id: AppModeId;
  label: string;
  description: string;
  devOnly?: boolean;
  href?: string;
  search: AppModeSearchConfig;
};

/** Canonical destinations for the Factsheets local search and category browse surfaces. */
export const factsheetsSearchHref = "/factsheets/search";
export const factsheetsTopicsHref = "/factsheets/topics";

/** Canonical destination for the DSM diagnosis catalogue search surface. */
export const dsmSearchHref = "/dsm/search";

export const appModeDefinitions = [
  {
    id: "answer",
    label: "Answer",
    description: "Source-backed clinical answer",
    search: {
      kind: "answer",
      placeholder: "Ask a clinical question...",
      inputAriaLabel: "Ask a source-backed clinical question",
      submitIdleLabel: "Ask",
      submitBusyLabel: "Answer",
      submitAriaLabel: "Generate source-backed answer",
      emptyTitle: "Enter a clinical question",
      readyTitle: "Generate a source-backed answer",
      progressLabel: "Searching indexed documents.",
      resultKind: "answer",
      resultHeading: "Answer",
      resultsSurface: "answer",
      statusLabel: "Answer",
      nextStep: "Ask a question first",
      badgeLabel: "?",
    },
  },
  {
    id: "documents",
    label: "Documents",
    description: "Find source PDFs, notes, and evidence passages",
    // Documents owns a real home at /documents so it is reachable from nav like
    // every other mode. `/` is the shared home for all modes and no longer renders
    // any one mode's content. A query still routes to /documents/search below.
    href: "/documents",
    search: {
      kind: "documents",
      placeholder: "Search source documents...",
      inputAriaLabel: "Search indexed source documents",
      submitIdleLabel: "Docs",
      submitBusyLabel: "Docs",
      submitAriaLabel: "Find matching documents",
      emptyTitle: "Enter a document search term",
      readyTitle: "Find matching source documents",
      progressLabel: "Finding matching documents.",
      resultKind: "documents",
      resultHeading: "Document matches",
      resultsSurface: "results-band",
      statusLabel: "Docs",
      nextStep: "Open a source document or evidence passage",
      badgeLabel: null,
    },
  },
  {
    id: "services",
    label: "Services",
    description: "Service records and referral pathways",
    href: "/services",
    search: {
      kind: "services",
      placeholder: "Search services...",
      inputAriaLabel: "Search services, source records, pathways, and criteria",
      submitIdleLabel: "Services",
      submitBusyLabel: "Services",
      submitAriaLabel: "Search services",
      emptyTitle: "Enter a service search term",
      readyTitle: "Search services",
      progressLabel: "Searching service records.",
      resultKind: "services",
      resultHeading: "Service matches",
      resultsSurface: "results-band",
      statusLabel: "Services",
      nextStep: "Review matching service records",
      badgeLabel: null,
    },
  },
  {
    id: "forms",
    label: "Forms",
    description: "Clinical forms and pathways",
    href: "/forms",
    search: {
      // Forms are a registry catalogue, not corpus documents. Declaring the honest kind
      // removes the ClinicalDashboard special-casing that the old kind:"documents" forced.
      kind: "forms",
      placeholder: "Search forms...",
      inputAriaLabel: "Search forms, source records, pathways, and criteria",
      submitIdleLabel: "Forms",
      submitBusyLabel: "Forms",
      submitAriaLabel: "Search forms",
      emptyTitle: "Enter a form search term",
      readyTitle: "Search forms",
      progressLabel: "Searching form records.",
      resultKind: "forms",
      resultHeading: "Form matches",
      resultsSurface: "results-band",
      statusLabel: "Forms",
      nextStep: "Review matching form records",
      badgeLabel: null,
    },
  },
  {
    id: "favourites",
    label: "Favourites",
    description: "Saved clinical items and sets",
    href: "/favourites",
    search: {
      kind: "favourites",
      placeholder: "Search favourites...",
      inputAriaLabel: "Search saved favourites",
      submitIdleLabel: "Faves",
      submitBusyLabel: "Faves",
      submitAriaLabel: "Search favourites",
      emptyTitle: "Search saved favourites",
      readyTitle: "Browse favourites",
      progressLabel: "Filtering favourites.",
      resultKind: "favourites",
      resultHeading: "Favourites",
      resultsSurface: "results-band",
      statusLabel: "Favourites",
      nextStep: "Open a saved item",
      badgeLabel: null,
    },
  },
  {
    id: "differentials",
    label: "Differentials",
    description: "Compare causes and clinical clues",
    href: "/differentials",
    search: {
      kind: "differentials",
      placeholder: "Ask or search a presentation...",
      inputAriaLabel: "Search differential presentations, symptoms, and scenarios",
      submitIdleLabel: "Diffs",
      submitBusyLabel: "Diffs",
      submitAriaLabel: "Search differential presentations",
      emptyTitle: "Start a differential search",
      readyTitle: "Search differential presentations",
      progressLabel: "Searching differential source records.",
      resultKind: "differentials",
      resultHeading: "Differentials",
      resultsSurface: "results-band",
      statusLabel: "Diffs",
      nextStep: "Search or compare differentials",
      badgeLabel: null,
      defaultQueryMode: "compare_guidance",
    },
  },
  {
    id: "dsm",
    label: "DSM-5 Diagnosis",
    description: "Diagnostic criteria, specifiers, and comparisons",
    href: "/dsm",
    search: {
      kind: "dsm",
      placeholder: "Search DSM diagnoses or criteria...",
      inputAriaLabel: "Search DSM diagnoses, ICD codes, criteria, and categories",
      submitIdleLabel: "DSM",
      submitBusyLabel: "DSM",
      submitAriaLabel: "Search DSM diagnoses",
      emptyTitle: "Search DSM diagnoses",
      readyTitle: "Search DSM diagnosis criteria",
      progressLabel: "Searching the local DSM diagnosis catalogue.",
      resultKind: "dsm",
      resultHeading: "DSM diagnoses",
      resultsSurface: "results-band",
      statusLabel: "DSM",
      nextStep: "Open a diagnosis or compare criteria",
      badgeLabel: null,
    },
  },
  {
    id: "specifiers",
    label: "Specifiers",
    description: "Refine diagnostic wording and episode patterns",
    href: "/specifiers",
    search: {
      kind: "specifiers",
      placeholder: "Describe the presentation or search a specifier...",
      inputAriaLabel: "Search psychiatric specifiers by presentation or diagnosis",
      submitIdleLabel: "Find",
      submitBusyLabel: "Find",
      submitAriaLabel: "Find matching psychiatric specifiers",
      emptyTitle: "Describe the presentation",
      readyTitle: "Find the most relevant specifier",
      progressLabel: "Matching presentation features to specifiers.",
      resultKind: "specifiers",
      resultHeading: "Specifier matches",
      resultsSurface: "results-band",
      statusLabel: "Specifiers",
      nextStep: "Check fit and refine the diagnostic wording",
      badgeLabel: null,
    },
  },
  {
    id: "formulation",
    label: "Formulation",
    description: "Build and test clinical mechanism hypotheses",
    href: "/formulation",
    search: {
      kind: "formulation",
      placeholder: "Describe a pattern or clinical clue...",
      inputAriaLabel: "Search formulation mechanisms by pattern or patient language",
      submitIdleLabel: "Find",
      submitBusyLabel: "Find",
      submitAriaLabel: "Find matching formulation mechanisms",
      emptyTitle: "Describe a clinical pattern",
      readyTitle: "Find a testable mechanism hypothesis",
      progressLabel: "Matching clinical clues to formulation mechanisms.",
      resultKind: "formulation",
      resultHeading: "Mechanism matches",
      resultsSurface: "results-band",
      statusLabel: "Formulation",
      nextStep: "Check fit, alternatives, and treatment leverage",
      badgeLabel: null,
    },
  },
  {
    id: "prescribing",
    label: "Medication",
    description: "Medication dosing, safety, and monitoring checks",
    // Medication owns a real home at /medications (previously a 307 alias for
    // /?mode=prescribing, which is now the shared home). A submitted search still
    // resolves to /?mode=prescribing&q=…&run=1, which stays dashboard-owned.
    href: "/medications",
    search: {
      // Deliberately kind:"documents" (unlike forms): prescribing intentionally searches the
      // document corpus for dosing/threshold guidance (defaultQueryMode dose_threshold_lookup).
      // The medication registry joins cross-entity search via /api/search/universal instead.
      kind: "documents",
      placeholder: "Search medication dosing or safety...",
      inputAriaLabel: "Search medication dosing, safety, and monitoring guidance",
      submitIdleLabel: "Meds",
      submitBusyLabel: "Meds",
      submitAriaLabel: "Search medication prescribing guidance",
      emptyTitle: "Enter a medication search term",
      readyTitle: "Search medication prescribing guidance",
      progressLabel: "Searching medication guidance.",
      resultKind: "documents",
      resultHeading: "Medication matches",
      resultsSurface: "results-band",
      statusLabel: "Meds",
      nextStep: "Review medication guidance",
      badgeLabel: null,
      defaultQueryMode: "dose_threshold_lookup",
    },
  },
  {
    id: "tools",
    label: "Tools",
    description: "Clinical tools and applications",
    // PT-11: standalone /tools is the canonical entry; /?mode=tools remains a
    // dashboard-mode alias for bookmarks and deep links.
    href: "/tools",
    search: {
      kind: "tools",
      placeholder: "Search tools...",
      inputAriaLabel: "Search clinical tools and applications",
      submitIdleLabel: "Tools",
      submitBusyLabel: "Tools",
      submitAriaLabel: "Search tools",
      emptyTitle: "Browse tools",
      readyTitle: "Search clinical tools",
      progressLabel: "Searching tools.",
      resultKind: "tools",
      resultHeading: "Tools",
      resultsSurface: "results-band",
      statusLabel: "Tools",
      nextStep: "Launch a tool",
      badgeLabel: null,
    },
  },
  {
    id: "calculators",
    label: "Calculators",
    description: "Source-cited psychiatry scores and clinical decision calculators",
    href: "/calculators",
    search: {
      kind: "calculators",
      placeholder: "Search calculators by scale, symptom, or indication...",
      inputAriaLabel: "Search clinical calculators by scale, symptom, or indication",
      submitIdleLabel: "Calculate",
      submitBusyLabel: "Calculate",
      submitAriaLabel: "Search clinical calculators",
      emptyTitle: "Search clinical calculators",
      readyTitle: "Find a clinical calculator",
      progressLabel: "Searching the local calculator catalogue.",
      resultKind: "calculators",
      resultHeading: "Calculator matches",
      resultsSurface: "results-band",
      statusLabel: "Calculators",
      nextStep: "Open a calculator to score it and review next actions",
      badgeLabel: null,
    },
  },
  {
    id: "therapy-compass",
    label: "Therapy",
    description: "Source-grounded therapy reference",
    href: "/therapy-compass",
    // Therapy ships in production with its review state disclosed rather than
    // hidden. It was previously `devOnly`, which 404'd the route and every
    // record for real users; the owner's decision is that a catalogue labelled
    // "needs source review" on the library notice, every result card and every
    // record page is more useful — and no less honest — than an absent mode.
    // Per-record sign-off is still tracked by `therapyNeedsReview` and surfaced
    // everywhere the record appears; it no longer gates reachability.
    search: {
      kind: "therapies",
      // The longer phrase became the late portal's LCP element on Therapy Home.
      // Keep the full search scope in the accessible name below; the concise
      // visible prompt lets the already-painted hero remain the LCP owner.
      placeholder: "Search therapies...",
      inputAriaLabel: "Search therapies by problem, symptom, skill, or population",
      submitIdleLabel: "Therapy",
      submitBusyLabel: "Therapy",
      submitAriaLabel: "Open Therapy",
      emptyTitle: "Browse the therapy library",
      readyTitle: "Search source-grounded therapies",
      progressLabel: "Loading the therapy library.",
      resultKind: "therapies",
      resultHeading: "Therapies",
      resultsSurface: "results-band",
      statusLabel: "Therapy",
      nextStep: "Open a therapy record",
      badgeLabel: null,
    },
  },
  {
    id: "factsheets",
    label: "Factsheets",
    description: "Plain-language patient information to read, save, and print",
    href: "/factsheets",
    search: {
      // Factsheets owns its own in-tool search over the local patient-information
      // library (not the document corpus), so it borrows the benign "tools" search
      // kind — like Therapy Compass — while keeping the shared composer visible.
      kind: "tools",
      placeholder: "Search a medicine, condition, therapy or test...",
      inputAriaLabel: "Search patient information factsheets",
      submitIdleLabel: "Sheets",
      submitBusyLabel: "Sheets",
      submitAriaLabel: "Search patient information factsheets",
      emptyTitle: "Search patient information",
      readyTitle: "Find a patient factsheet",
      progressLabel: "Searching patient factsheets.",
      resultKind: "tools",
      resultHeading: "Factsheets",
      resultsSurface: "results-band",
      statusLabel: "Factsheets",
      nextStep: "Open a factsheet to read, save, or print",
      badgeLabel: null,
    },
  },
  {
    id: "dictionary",
    label: "Dictionary",
    description: "Source-governed clinical terms, abbreviations, and related concepts",
    href: "/dictionary",
    search: {
      // Dictionary owns a local static catalogue. The shared composer uses the
      // benign tools command kind, then appModeHomeHref routes into its results.
      kind: "tools",
      placeholder: "Search a term or abbreviation...",
      inputAriaLabel: "Search clinical terms, abbreviations, and topics",
      submitIdleLabel: "Terms",
      submitBusyLabel: "Terms",
      submitAriaLabel: "Search the clinical dictionary",
      emptyTitle: "Search the clinical dictionary",
      readyTitle: "Find a clinical term",
      progressLabel: "Searching source-linked dictionary entries.",
      resultKind: "tools",
      resultHeading: "Dictionary results",
      resultsSurface: "results-band",
      statusLabel: "Dictionary",
      nextStep: "Open a term, browse the catalogue, or compare definitions",
      badgeLabel: null,
    },
  },
] as const satisfies readonly AppModeDefinition[];

export function appModeDefinition(modeId: AppModeId) {
  return appModeDefinitions.find((mode) => mode.id === modeId) ?? appModeDefinitions[0];
}

export function isAppModeId(value: string | null | undefined): value is AppModeId {
  return appModeDefinitions.some((mode) => mode.id === value);
}

export function isAppModeVisible(modeId: string, environment = process.env.NODE_ENV) {
  const mode = appModeDefinitions.find((definition) => definition.id === modeId);
  if (!mode) return false;
  return !("devOnly" in mode) || !mode.devOnly || environment === "development";
}

export function visibleAppModeDefinitions(environment = process.env.NODE_ENV) {
  return appModeDefinitions.filter((mode) => !("devOnly" in mode) || !mode.devOnly || environment === "development");
}

export function appModeSearchConfig(modeId: AppModeId) {
  return appModeDefinition(modeId).search;
}

const namespaceIsolatedModes = new Set<AppModeId>([
  "services",
  "forms",
  "favourites",
  "differentials",
  "dsm",
  "specifiers",
  "formulation",
  "therapy-compass",
  "factsheets",
  "dictionary",
  "tools",
  "calculators",
]);

export function appModeHomeHref(modeId: AppModeId, options: SearchNavigationOptions = {}) {
  const mode = appModeDefinition(modeId);
  const query = options.query?.trim();

  if (modeId === "documents" && query) {
    return documentsSearchHref({ ...options, query });
  }

  // A consolidated mode has no home of its own: its bare path only redirects to
  // the shared home. An unsubmitted href therefore targets `/?mode=<id>` directly
  // rather than routing in-app navigation through that redirect for nothing.
  if (consolidatedModeHomeModeIds.has(modeId) && !query) {
    return appModeSelectionHref(modeId, options);
  }

  if (namespaceIsolatedModes.has(modeId) && "href" in mode && mode.href) {
    const namespacedParams = new URLSearchParams();
    if (query) namespacedParams.set("q", query);
    if (options.focus) namespacedParams.set("focus", "1");
    if (options.run && query) namespacedParams.set("run", "1");
    appendSearchNavigationContext(namespacedParams, options);

    const suffix = namespacedParams.toString();
    // A submitted search resolves to the mode's own `/search` route. Every
    // consolidated mode has one, because its bare path is now a redirect onto the
    // shared home: routing a submitted query back to the bare path would bounce
    // through that redirect and return here, an infinite loop
    // (tests/app-modes.test.ts pins the no-loop property for every mode).
    const namespacedHref =
      query && consolidatedModeHomeModeIds.has(modeId) ? consolidatedModeSearchPath(modeId) : mode.href;
    return suffix ? `${namespacedHref}?${suffix}` : namespacedHref;
  }

  if ("href" in mode && mode.href && !query && !options.run) {
    const homeParams = new URLSearchParams();
    if (options.focus) homeParams.set("focus", "1");
    appendSearchNavigationContext(homeParams, options);
    const suffix = homeParams.toString();
    const separator = mode.href.includes("?") ? "&" : "?";
    return suffix ? `${mode.href}${separator}${suffix}` : mode.href;
  }

  return appModeSelectionHref(modeId, options);
}

/**
 * The shared home URL (`/`) with `modeId` preselected.
 *
 * `/` is the single home page for every mode: the mode pill retargets the
 * composer rather than navigating, so selecting a mode rewrites this href in
 * place (`history.replaceState`) instead of pushing a route. Keeping the mode in
 * the URL means a reload or a shared link server-renders the right placeholder
 * with no hydration flip, and lets the existing render-time URL sync keep owning
 * `searchMode` — never an optimistic state set, per the hero-vs-dock rule in
 * docs/search-chrome-behaviour.md.
 *
 * Distinct from `appModeHomeHref`, which resolves a mode's *own* surface
 * (`/dsm/search`, `/tools`, …). This always stays on `/`.
 */
export function appModeSelectionHref(modeId: AppModeId, options: SearchNavigationOptions = {}) {
  const query = options.query?.trim();
  const params = new URLSearchParams({ mode: modeId });
  if (query) params.set("q", query);
  if (options.focus) params.set("focus", "1");
  if (options.run && query) params.set("run", "1");
  appendSearchNavigationContext(params, options);
  return `/?${params.toString()}`;
}

export function appModeResultKind(modeId: AppModeId): AppModeResultKind {
  return appModeSearchConfig(modeId).resultKind;
}

export function appModeQueryMode(modeId: AppModeId, queryMode: ClinicalQueryMode): ClinicalQueryMode {
  const searchConfig = appModeSearchConfig(modeId);
  const defaultQueryMode = "defaultQueryMode" in searchConfig ? searchConfig.defaultQueryMode : undefined;
  return queryMode === "auto" && defaultQueryMode ? defaultQueryMode : queryMode;
}

export function appModeSourceLibrarySearchMode(
  modeId: AppModeId,
): Extract<AppModeSearchKind, "documents" | "differentials"> {
  return appModeSearchConfig(modeId).kind === "differentials" ? "differentials" : "documents";
}

export function appModeCanUseSourceLibraryShortcut(modeId: AppModeId) {
  const kind = appModeSearchConfig(modeId).kind;
  return kind === "documents" || kind === "differentials";
}

export function isSearchableAppMode(modeId: string): modeId is SearchableAppModeId {
  const mode = appModeDefinitions.find((definition) => definition.id === modeId);
  if (!mode) return false;
  const kind = mode.search.kind;
  return (
    kind === "answer" ||
    kind === "documents" ||
    kind === "services" ||
    kind === "forms" ||
    kind === "favourites" ||
    kind === "differentials" ||
    kind === "dsm" ||
    kind === "specifiers" ||
    kind === "formulation" ||
    kind === "therapies" ||
    kind === "calculators" ||
    kind === "tools"
  );
}

/**
 * Favourites are account-scoped. Show the mode in nav (mode menu + sidebar library)
 * only when the user is authenticated, or when local/demo mode is active so CI and
 * prototype flows keep working without a real session.
 */
export function canAccessFavouritesMode(options: { authenticated: boolean; demoMode: boolean }): boolean {
  return options.demoMode || options.authenticated;
}

export function visibleAppModeDefinitionsForSession(
  options: { authenticated: boolean; demoMode: boolean },
  environment = process.env.NODE_ENV,
) {
  const favouritesAllowed = canAccessFavouritesMode(options);
  return visibleAppModeDefinitions(environment).filter((mode) => mode.id !== "favourites" || favouritesAllowed);
}

/** Omit Favourites from composer cross-mode chips for signed-out non-demo sessions. */
export function filterCrossModesForSession(
  crossModes: readonly AppModeId[],
  options: { authenticated: boolean; demoMode: boolean },
): AppModeId[] {
  if (canAccessFavouritesMode(options)) return [...crossModes];
  return crossModes.filter((mode) => mode !== "favourites");
}
