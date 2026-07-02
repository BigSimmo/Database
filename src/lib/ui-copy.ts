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

export const answerEmptyState = {
  heading: "How can I help?",
  subheading: "Ask a clinical question or search your documents.",
  starterActionsLabel: "Starter actions",
  starters: {
    ask: {
      title: "Ask a question",
      description: "Start a source-backed clinical answer.",
      samplePrompt: "What monitoring and escalation issues should I consider across these documents?",
    },
    searchDocuments: {
      title: "Search documents",
      description: "Browse matching files and source sections.",
    },
    uploadDocument: {
      title: "Upload document",
      description: "Add a guideline, PDF, or local source.",
    },
  },
} as const;

export const copyButton = {
  copied: "Copied",
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

// User-visible error / status messages.
export const errorCopy = {
  searchSetupNotReady: "Search setup not ready.",
  clipboardCopyFailed: "Couldn't copy to the clipboard. Select the text and copy it manually.",
  bulkReindexFailed: "Bulk reindex failed.",
  bulkMetadataUpdateFailed: "Bulk metadata update failed.",
  uploadFailed: "Upload failed",
} as const;
