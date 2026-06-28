import type { ClinicalQueryMode } from "@/lib/types";

export type AppModeId = "answer" | "documents" | "prescribing" | "evidence" | "favourites" | "tools";
export type SearchableAppModeId = AppModeId;

export type AppModeSearchKind = "answer" | "documents" | "favourites" | "tools";
export type AppModeResultKind = "answer" | "documents" | "favourites" | "tools";

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
    id: "evidence",
    label: "Evidence",
    description: "Tables, quotes, images, PDFs",
    devOnly: true,
    href: "/mockups/evidence-option",
    search: {
      kind: "documents",
      placeholder: "Search evidence...",
      inputAriaLabel: "Search evidence across indexed sources",
      submitIdleLabel: "Evidence",
      submitBusyLabel: "Evidence",
      submitAriaLabel: "Search evidence",
      emptyTitle: "Enter an evidence search term",
      readyTitle: "Search evidence",
      progressLabel: "Searching evidence.",
      resultKind: "documents",
      resultHeading: "Evidence matches",
      statusLabel: "Evidence",
      nextStep: "Review matching evidence",
      badgeLabel: null,
    },
  },
  {
    id: "favourites",
    label: "Favourites",
    description: "Saved sources and workflows",
    devOnly: true,
    href: "/?mode=favourites",
    search: {
      kind: "favourites",
      placeholder: "Search or ask from favourites...",
      inputAriaLabel: "Search saved favourites",
      submitIdleLabel: "Faves",
      submitBusyLabel: "Faves",
      submitAriaLabel: "Search favourites",
      emptyTitle: "Browse favourites",
      readyTitle: "Search saved favourites",
      progressLabel: "Searching favourites.",
      resultKind: "favourites",
      resultHeading: "Favourites",
      statusLabel: "Favourites",
      nextStep: "Browse saved items",
      badgeLabel: null,
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

export function appModeHomeHref(modeId: AppModeId, options: { query?: string; focus?: boolean; run?: boolean } = {}) {
  const params = new URLSearchParams({ mode: modeId });
  const query = options.query?.trim();
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

export function isSearchableAppMode(modeId: string): modeId is SearchableAppModeId {
  const mode = appModeDefinitions.find((definition) => definition.id === modeId);
  if (!mode) return false;
  const kind = mode.search.kind;
  return kind === "answer" || kind === "documents" || kind === "favourites" || kind === "tools";
}
