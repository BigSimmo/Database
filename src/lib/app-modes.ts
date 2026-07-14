import type { ClinicalQueryMode } from "@/lib/types";
import { documentsSearchHref } from "@/lib/document-flow-routes";
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
] as const;

export type AppModeId = (typeof appModeIds)[number];
export type SearchableAppModeId = AppModeId;

export type AppModeSearchKind =
  "answer" | "documents" | "services" | "forms" | "favourites" | "differentials" | "dsm" | "specifiers" | "formulation" | "tools";
export type AppModeResultKind = AppModeSearchKind;

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
      statusLabel: "Answer",
      nextStep: "Ask a question first",
      badgeLabel: "?",
    },
  },
  {
    id: "documents",
    label: "Documents",
    description: "Find source PDFs, notes, and evidence passages",
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
      placeholder: "Ask or search a presentation",
      inputAriaLabel: "Search differential presentations, symptoms, and scenarios",
      submitIdleLabel: "Diffs",
      submitBusyLabel: "Diffs",
      submitAriaLabel: "Search differential presentations",
      emptyTitle: "Start a differential search",
      readyTitle: "Search differential presentations",
      progressLabel: "Searching differential source records.",
      resultKind: "differentials",
      resultHeading: "Differentials",
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
      placeholder: "Describe a pattern, mechanism, or clinical clue...",
      inputAriaLabel: "Search formulation mechanisms by pattern or patient language",
      submitIdleLabel: "Find",
      submitBusyLabel: "Find",
      submitAriaLabel: "Find matching formulation mechanisms",
      emptyTitle: "Describe a clinical pattern",
      readyTitle: "Find a testable mechanism hypothesis",
      progressLabel: "Matching clinical clues to formulation mechanisms.",
      resultKind: "formulation",
      resultHeading: "Mechanism matches",
      statusLabel: "Formulation",
      nextStep: "Check fit, alternatives, and treatment leverage",
      badgeLabel: null,
    },
  },
  {
    id: "prescribing",
    label: "Medication",
    description: "Medication dosing, safety, and monitoring checks",
    href: "/?mode=prescribing",
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
    href: "/?mode=tools",
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
      statusLabel: "Tools",
      nextStep: "Launch a tool",
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
]);

export function appModeHomeHref(modeId: AppModeId, options: SearchNavigationOptions = {}) {
  const mode = appModeDefinition(modeId);
  const query = options.query?.trim();

  if (modeId === "documents" && query) {
    return documentsSearchHref({ ...options, query });
  }

  if (namespaceIsolatedModes.has(modeId) && "href" in mode && mode.href) {
    const namespacedParams = new URLSearchParams();
    if (query) namespacedParams.set("q", query);
    if (options.focus) namespacedParams.set("focus", "1");
    if (options.run && query) namespacedParams.set("run", "1");
    appendSearchNavigationContext(namespacedParams, options);

    const suffix = namespacedParams.toString();
    const namespacedHref = modeId === "dsm" && query ? "/dsm/search" : mode.href;
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
    kind === "tools"
  );
}
