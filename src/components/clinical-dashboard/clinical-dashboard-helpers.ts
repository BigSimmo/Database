// Pure domain helpers extracted from ClinicalDashboard.tsx (#51 — centralise
// domain logic into a reusable, unit-tested module). These are verbatim moves:
// behaviour is unchanged, and the module is framework-free (no React) so each
// helper can be unit-tested directly instead of only through the 4k-line
// component.

import type { SetupCheck } from "@/components/clinical-dashboard/DocumentManagerPanel";
import { navigationHashes } from "@/components/clinical-dashboard/dashboard-contracts";
import { makeSearchError } from "@/components/clinical-dashboard/search-utils";
import { canAccessFavouritesMode } from "@/lib/app-modes";
import type { ClinicalDocument, ImportBatch, IngestionJob, RagAnswer, RelatedDocument } from "@/lib/types";
import type { SearchScopeFilters } from "@/lib/search-scope";

// Poll-delay ceiling for setup re-checks; also the clamp ceiling for
// `normalizedPollDelay`. Shared with the dashboard's polling loop.
export const setupRecheckPollMs = 60_000;

export function compactScopeFilters(filters: SearchScopeFilters) {
  const next: SearchScopeFilters = {};
  if (filters.medications?.length) next.medications = filters.medications;
  if (filters.topics?.length) next.topics = filters.topics;
  if (filters.documentTypes?.length) next.documentTypes = filters.documentTypes;
  if (filters.sites?.length) next.sites = filters.sites;
  if (filters.services?.length) next.services = filters.services;
  if (filters.settings?.length) next.settings = filters.settings;
  if (filters.populations?.length) next.populations = filters.populations;
  if (filters.risks?.length) next.risks = filters.risks;
  if (filters.workflows?.length) next.workflows = filters.workflows;
  if (filters.clinicalActions?.length) next.clinicalActions = filters.clinicalActions;
  if (filters.carePhases?.length) next.carePhases = filters.carePhases;
  if (filters.documentIntents?.length) next.documentIntents = filters.documentIntents;
  if (filters.contentFeatures?.length) next.contentFeatures = filters.contentFeatures;
  if (filters.sourceStatuses?.length) next.sourceStatuses = filters.sourceStatuses;
  if (filters.validationStatuses?.length) next.validationStatuses = filters.validationStatuses;
  if (filters.extractionQualities?.length) next.extractionQualities = filters.extractionQualities;
  if (filters.locality) next.locality = filters.locality;
  if (filters.importBatchIds?.length) next.importBatchIds = filters.importBatchIds;
  if (filters.collections?.length) next.collections = filters.collections;
  if (filters.labelTypesAny?.length) next.labelTypesAny = filters.labelTypesAny;
  return next;
}

export function hasNonProductionSupabaseApiKeyFallback(checks: SetupCheck[]) {
  return (
    process.env.NODE_ENV !== "production" &&
    checks.some(
      (check) =>
        check.id === "search" &&
        check.status !== "ready" &&
        /\b(?:unregistered|invalid)\s+api\s+key\b/i.test(check.detail),
    )
  );
}

/** True when an error originates from an AbortController (user pressed Stop / component unmounted). */
export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** Abort any in-flight controller and install a fresh one owned by `ref`. */
export function replaceOwnedAbortController(ref: { current: AbortController | null }): AbortController {
  ref.current?.abort();
  const next = new AbortController();
  ref.current = next;
  return next;
}

/** Clear `ref` only when it still points at `controller` (avoids clobbering a newer owner). */
export function releaseOwnedAbortController(
  ref: { current: AbortController | null },
  controller: AbortController,
): void {
  if (ref.current === controller) ref.current = null;
}

export function normalizeNavigationHash(hash: string) {
  return navigationHashes.includes(hash as (typeof navigationHashes)[number]) ? hash : "#search";
}

// Non-retryable so an aborted request does not immediately re-fetch against the
// already-aborted signal; the user re-submits to try again. Raised by the
// stall watchdog (see createAnswerRequestWatchdog): a live stream that keeps
// delivering progress/heartbeat bytes is never aborted, no matter how
// long a fast->strong escalation takes, so this now only appears when the
// stream genuinely went silent or hit the absolute ceiling.
export function answerTimedOutError() {
  return makeSearchError("Answer generation timed out. Please try again.", 408, false);
}

export function answerReferencesDocument(answer: RagAnswer | null, documentId: string) {
  if (!answer) return false;
  // Detection must cover every field applyRenamedDocumentToAnswer rewrites
  // (incl. quoteCards and the nested smartPanel), otherwise a document referenced
  // only there is guarded out and keeps its stale title after a rename.
  return (
    answer.citations.some((citation) => citation.document_id === documentId) ||
    answer.sources.some((source) => source.document_id === documentId) ||
    Boolean(answer.quoteCards?.some((card) => card.document_id === documentId)) ||
    Boolean(answer.bestSource?.document_id === documentId) ||
    Boolean(answer.relatedDocuments?.some((document) => document.document_id === documentId)) ||
    Boolean(answer.visualEvidence?.some((image) => image.document_id === documentId)) ||
    Boolean(answer.smartPanel?.bestSource?.document_id === documentId) ||
    Boolean(answer.smartPanel?.relatedDocuments?.some((document) => document.document_id === documentId))
  );
}

export function applyRenamedDocumentToAnswer(answer: RagAnswer | null, document: ClinicalDocument) {
  if (!answer || !answerReferencesDocument(answer, document.id)) return answer;
  const renameCitation = <T extends { document_id: string; title: string }>(item: T): T =>
    item.document_id === document.id ? { ...item, title: document.title } : item;
  const renameRelated = (item: RelatedDocument): RelatedDocument =>
    item.document_id === document.id ? { ...item, title: document.title } : item;

  return {
    ...answer,
    citations: answer.citations.map(renameCitation),
    quoteCards: answer.quoteCards?.map(renameCitation),
    sources: answer.sources.map(renameCitation),
    visualEvidence: answer.visualEvidence?.map(renameCitation),
    bestSource: answer.bestSource ? renameCitation(answer.bestSource) : answer.bestSource,
    relatedDocuments: answer.relatedDocuments?.map(renameRelated),
    smartPanel: answer.smartPanel
      ? {
          ...answer.smartPanel,
          bestSource: answer.smartPanel.bestSource
            ? renameCitation(answer.smartPanel.bestSource)
            : answer.smartPanel.bestSource,
          relatedDocuments: answer.smartPanel.relatedDocuments?.map(renameRelated),
        }
      : answer.smartPanel,
  } satisfies RagAnswer;
}

export function normalizedPollDelay(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(Math.max(parsed, 3_000), setupRecheckPollMs);
}

export function shorterPollDelay(current: number | null, next: unknown) {
  const normalized = normalizedPollDelay(next);
  if (!normalized) return current;
  return current === null ? normalized : Math.min(current, normalized);
}

export function hasActiveIndexingWork(
  documents: ClinicalDocument[],
  jobs: IngestionJob[] = [],
  batches: ImportBatch[] = [],
  routeHint = false,
) {
  return (
    routeHint ||
    documents.some((document) => document.status === "queued" || document.status === "processing") ||
    jobs.some((job) => job.status === "pending" || job.status === "processing") ||
    batches.some((batch) => batch.status === "queued" || batch.status === "processing")
  );
}

export function setupNeedsSlowRecheck(checks: SetupCheck[]) {
  return checks.some((check) => check.status !== "ready");
}

export function mergeDocumentRefresh(current: ClinicalDocument[], updates: ClinicalDocument[]) {
  const currentById = new Map(current.map((document) => [document.id, document]));
  return updates.map((document) => {
    const existing = currentById.get(document.id);
    if (!existing) return document;
    return {
      ...existing,
      ...document,
      labels: document.labels ?? existing.labels,
      summary: document.summary ?? existing.summary,
    };
  });
}

export function sessionFavouritesAccessible(authStatus: string, demoMode: boolean) {
  return canAccessFavouritesMode({ authenticated: authStatus === "authenticated", demoMode });
}
