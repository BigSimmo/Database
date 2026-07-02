import type { ClinicalQueryMode } from "@/lib/types";

export type AppModeId =
  "answer" | "documents" | "services" | "forms" | "favourites" | "differentials" | "prescribing" | "tools";
export type SearchableAppModeId = AppModeId;

export type AppModeSearchKind = "answer" | "documents" | "favourites" | "differentials" | "tools";
export type AppModeResultKind = "answer" | "documents" | "favourites" | "differentials" | "tools";

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
    description: "Search indexed PDFs and notes",
    search: {
      kind: "documents",
      placeholder: "Search documents...",
      inputAriaLabel: "Search indexed documents",
      submitIdleLabel: "Docs",
      submitBusyLabel: "Docs",
      submitAriaLabel: "Find matching documents",
      emptyTitle: "Enter a document search term",
      readyTitle: "Find matching documents",
      progressLabel: "Finding matching documents.",
      resultKind: "documents",
      resultHeading: "Document matches",
      statusLabel: "Docs",
      nextStep: "Review matching documents",
      badgeLabel: null,
    },
  },
  {
    id: "services",
    label: "Services",
    description: "Service records and referral pathways",
    href: "/services",
    search: {
      kind: "documents",
      placeholder: "Search services...",
      inputAriaLabel: "Search services, source records, pathways, and criteria",
      submitIdleLabel: "Services",
      submitBusyLabel: "Services",
      submitAriaLabel: "Search services",
      emptyTitle: "Enter a service search term",
      readyTitle: "Search services",
      progressLabel: "Searching service records.",
      resultKind: "documents",
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
      kind: "documents",
      placeholder: "Search forms...",
      inputAriaLabel: "Search forms, source records, pathways, and criteria",
      submitIdleLabel: "Forms",
      submitBusyLabel: "Forms",
      submitAriaLabel: "Search forms",
      emptyTitle: "Enter a form search term",
      readyTitle: "Search forms",
      progressLabel: "Searching form records.",
      resultKind: "documents",
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
    id: "prescribing",
    label: "Medication",
    description: "Prescribing checks and guidance",
    href: "/?mode=prescribing",
    search: {
      kind: "documents",
      placeholder: "Search medications...",
      inputAriaLabel: "Search medication guidance",
      submitIdleLabel: "Meds",
      submitBusyLabel: "Meds",
      submitAriaLabel: "Search medication guidance",
      emptyTitle: "Enter a medication search term",
      readyTitle: "Search medication guidance",
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

const namespaceIsolatedModes = new Set<AppModeId>(["services", "forms", "favourites", "differentials"]);

export function appModeHomeHref(modeId: AppModeId, options: { query?: string; focus?: boolean; run?: boolean } = {}) {
  const mode = appModeDefinition(modeId);
  const query = options.query?.trim();

  if (namespaceIsolatedModes.has(modeId) && "href" in mode && mode.href) {
    const namespacedParams = new URLSearchParams();
    if (query) namespacedParams.set("q", query);
    if (options.focus) namespacedParams.set("focus", "1");
    if (options.run) namespacedParams.set("run", "1");

    const suffix = namespacedParams.toString();
    return suffix ? `${mode.href}?${suffix}` : mode.href;
  }

  if ("href" in mode && mode.href && !query && !options.run) {
    const homeParams = new URLSearchParams();
    if (options.focus) homeParams.set("focus", "1");
    const suffix = homeParams.toString();
    return suffix ? `${mode.href}?${suffix}` : mode.href;
  }

  const params = new URLSearchParams({ mode: modeId });
  if (query) params.set("q", query);
  if (options.focus) params.set("focus", "1");
  if (options.run && query) params.set("run", "1");
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
    kind === "answer" || kind === "documents" || kind === "favourites" || kind === "differentials" || kind === "tools"
  );
}
