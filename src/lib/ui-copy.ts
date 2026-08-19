import type { AppModeId } from "@/lib/app-modes";

/**
 * Central home for static, user-facing UI copy.
 *
 * New visible strings (headings, empty states, error/toast messages, starter
 * prompts, help text) should live here — alongside the existing centralized
 * `app-modes.ts` (mode labels/placeholders) and `source-metadata.ts` (status
 * labels) — so wording, casing, and punctuation stay consistent and reviewable.
 *
 * This module is for CHROME copy only. Document-derived text (answers, quotes,
 * snippets, titles, captions, extracted tables) is NOT copy: it must be rendered
 * through the source-text formatters (`source-text-sanitizer` / `display-text`),
 * never hardcoded here.
 */

export type SharedHomePresentation = {
  title: string;
  subtitle: string;
  suggestions: readonly string[];
};

/**
 * Per-mode copy for the one shared home at `/`.
 *
 * `/` is the single home page for every mode — the mode pill retargets the
 * composer rather than navigating (see `appModeSelectionHref`), so this table is
 * the *only* thing that changes between modes on that page. Each entry mirrors
 * the mode's own standalone home (`*-home-page.tsx`) so a clinician sees the
 * same words whichever door they came through.
 */
export const sharedHomePresentation = {
  answer: {
    title: "Clinical Answers",
    subtitle: "Ask a clinical question or search your documents.",
    suggestions: ["lithium level timing", "clozapine ANC monitoring", "ECT consent requirements"],
  },
  documents: {
    title: "Clinical Documents",
    subtitle: "Open, browse, and continue reading your clinical sources.",
    suggestions: ["clozapine ANC thresholds", "lithium monitoring table", "QT prolongation quote"],
  },
  services: {
    title: "Clinical Services",
    subtitle: "Search by need, catchment, or route.",
    suggestions: ["crisis ATSI phone WA", "perinatal psychiatry metro", "older adult CMH Fremantle"],
  },
  forms: {
    title: "Clinical Forms",
    subtitle: "The WA MHA 2014 forms register.",
    suggestions: ["transport order", "Form 3A detention", "extension of transport"],
  },
  favourites: {
    title: "Clinical Favourites",
    subtitle: "Saved notes, sources, and sets.",
    suggestions: ["ward round set", "pinned monitoring tables", "clozapine clinic"],
  },
  differentials: {
    title: "Differential Diagnosis",
    subtitle: "Match your catalogue to your library.",
    suggestions: ["acute confusion", "first episode psychosis", "catatonia vs NMS"],
  },
  dsm: {
    title: "DSM-5 Diagnosis",
    subtitle: "Criteria, specifiers, and comparisons.",
    suggestions: ["major depressive disorder", "F31.81", "panic disorder criteria"],
  },
  specifiers: {
    title: "Diagnostic Specifiers",
    subtitle: "Check specifier fit and exclusions.",
    suggestions: ["depressed but racing thoughts", "returns every winter", "much better but not fully recovered"],
  },
  formulation: {
    title: "Clinical Formulation",
    subtitle: "Build a formulation from the evidence.",
    suggestions: ["avoidance after panic", "rumination after rejection", "dissociation under threat"],
  },
  prescribing: {
    title: "Medication Guidance",
    subtitle: "Medication dosing and safety.",
    suggestions: ["acamprosate renal", "naltrexone dose ceiling", "disulfiram counselling"],
  },
  tools: {
    title: "Clinical Tools",
    subtitle: "Clinical tools and applications.",
    suggestions: ["renal calculator", "dose converter", "clinical forms"],
  },
  calculators: {
    title: "Clinical Calculators",
    subtitle: "Validated psychiatry scores with the indication, items, and next actions in one place.",
    suggestions: ["depression severity", "anxiety screening", "alcohol use"],
  },
  "therapy-compass": {
    // "Therapy", not "Therapy Compass": the mode's own copy rule, pinned by
    // tests/therapy-compass-mode-wiring.test.ts, which the retired detailed home
    // followed. This title became user-visible when that home was consolidated here.
    title: "Therapy",
    subtitle: "Source-grounded therapy records.",
    suggestions: ["trauma-focused CBT", "behavioural activation", "insomnia"],
  },
  factsheets: {
    title: "Patient Factsheets",
    subtitle: "Plain-language patient handouts.",
    suggestions: ["sertraline", "lithium monitoring", "CBT"],
  },
  dictionary: {
    title: "Clinical Dictionary",
    subtitle: "Source-governed psychiatric terms, abbreviations, and distinctions.",
    suggestions: ["mental state examination", "auditory hallucination", "ACT"],
  },
} as const satisfies Record<AppModeId, SharedHomePresentation>;

export const sharedHomeEmptyState = {
  starterActionsLabel: "Starter actions",
  recentLabel: "Recent searches",
} as const;

// Recovery copy for the answer flow — actions and calm no-results guidance shown
// when a question fails or returns nothing usable.
export const answerRecovery = {
  retry: "Retry",
  searchDocuments: "Search documents instead",
  rephrase: "Rephrase question",
  failureHint: "Something interrupted this answer.",
  noResults: {
    heading: "No answer for that yet",
    body: "Nothing in the indexed library matched this question. Try rephrasing it, or search the documents directly.",
  },
} as const;

export const copyButton = {
  copied: "Copied",
} as const;

export const specifierBuilderCopy = {
  hero: {
    eyebrow: "Diagnostic wording",
    title: "Build a clear diagnosis",
    body: "Choose the base diagnosis, then add only the episode, course, and severity specifiers that apply.",
  },
  steps: {
    base: {
      shortLabel: "Base",
      detail: "Diagnosis",
      eyebrow: "1 · Base diagnosis",
      title: "Choose the base diagnosis",
      body: "Start with the disorder and current episode.",
    },
    episodeFeatures: {
      shortLabel: "Features",
      detail: "Episode",
      eyebrow: "2 · Episode features",
      title: "Add episode features",
      body: "Select only features supported by the current presentation.",
    },
    courseOnset: {
      shortLabel: "Course",
      detail: "Timing",
      eyebrow: "3 · Course and onset",
      title: "Add course and onset",
      body: "Describe the timing or pattern when supported.",
    },
    severityRemission: {
      shortLabel: "Severity",
      detail: "Current state",
      eyebrow: "4 · Severity or remission",
      title: "Set severity or remission",
      body: "Choose one current severity or remission state, if applicable.",
    },
  },
  navigation: {
    previous: "Previous",
    continueToFeatures: "Continue to features",
    continueToCourse: "Continue to course",
    continueToSeverity: "Continue to severity",
    reviewWording: "Review wording",
  },
  review: {
    eyebrow: "Review",
    title: "Review the wording",
    body: "Check compatibility and chronology before documenting.",
    copy: "Copy wording",
    copied: "Wording copied to the clipboard.",
    startOver: "Start over",
    notSpecified: "Not specified",
  },
} as const;

export const answerLoading = {
  ariaLabel: "Loading answer",
} as const;

// Empty-state copy for the answer/evidence panels and document manager.
// Keyed by surface; every entry is a static { title, body } pair so wording
// and punctuation stay consistent across panels.
export const emptyStates = {
  topSource: {
    title: "No top source",
    body: "No source was strong enough to recommend as the leading citation.",
  },
  sourcePassages: {
    title: "No source passages yet",
    body: "Policy-approved source links appear here after a source-backed answer.",
  },
  evidenceMap: {
    title: "No evidence map rows",
    body: "This answer did not return structured answer sections or linked citations.",
  },
  exactQuotes: {
    title: "No exact quotes returned",
    body: "No separate quote cards. Verify linked citations and source passages before use.",
  },
  indexedVisuals: {
    title: "No indexed visuals",
    body: "This answer did not cite any indexed images.",
  },
  tablesUsed: {
    title: "No tables used",
    body: "No table evidence was used for this answer.",
  },
  imagesUsed: {
    title: "No images used",
    body: "Image and table evidence appears here when available.",
  },
  pdfsUsed: {
    title: "No PDFs used",
    body: "PDF source documents appear here when available.",
  },
  documentsNoneIndexed: { title: "No indexed documents" },
  documentsNoMatch: { title: "No matching documents" },
  ingestionJobs: {
    none: "No ingestion jobs",
    noneActive: "No active indexing work",
    noneFailed: "No failed indexing work",
  },
  ingestionQuality: {
    title: "No ingestion quality issues",
    body: "Loaded documents have no current OCR, table, extraction, or failed-job review items.",
  },
} as const;

// Privacy / data-handling copy — labels for the /privacy transparency page.
// Wording is a plain-language engineering summary of
// docs/privacy-impact-assessment.md; it is not legal advice. See PIA-1 /
// PIA-5. The APP-5 composer/upload warning itself lives in
// components/privacy-input-notice.tsx.
export const privacyCopy = {
  pageEyebrow: "Privacy",
  pageTitle: "How Clinical KB handles your data",
} as const;

// User-visible error / status messages.
export const errorCopy = {
  searchSetupNotReady: "Search setup not ready.",
  clipboardCopyFailed: "Couldn't copy to the clipboard. Select the text and copy it manually.",
  bulkReindexFailed: "Bulk reindex failed.",
  bulkMetadataUpdateFailed: "Bulk metadata update failed.",
  uploadFailed: "Upload failed",
} as const;
