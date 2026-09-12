import {
  normalizePreformattedDisplayText,
  sourceTextForClinicalProsePreservingBreaks,
} from "@/lib/source-text-sanitizer";
import { polishClinicalAnswerProse } from "@/lib/rag/rag-answer-text";

const displayJsonArtifactPattern =
  /"?(answer|heading|body|grounded|confidence|citations?|answerSections?|citation_chunk_ids|conflictsOrGaps|quoteCards?|source_chunk_ids|chunk_id)"?\s*:\s*/i;

export type DisplayTextSanitizeOptions = {
  minLength?: number;
  minTokens?: number;
  compactSource?: boolean;
  // Server-`preformatted` answers (doc-support lists, table/visual references)
  // are display-ready by construction; run only lossless normalization so their
  // document names / facility codes are not deleted as "source noise".
  preformatted?: boolean;
  // Keep server high-yield bold (**…**) so <SafeBoldText> can render it.
  preserveBold?: boolean;
};

export function normalizeDisplayText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function looksLikeDisplayArtifact(value: string) {
  const normalized = normalizeDisplayText(value);
  if (!normalized) return true;
  const quoteCount = (normalized.match(/"/g) ?? []).length;
  const colonCount = (normalized.match(/:/g) ?? []).length;
  if (normalized.startsWith("{") && normalized.endsWith("}") && displayJsonArtifactPattern.test(normalized))
    return true;
  if (/[{}\[\]]/.test(normalized) && quoteCount >= 4 && colonCount >= 2 && displayJsonArtifactPattern.test(normalized))
    return true;
  return false;
}

export function sanitizeAnswerDisplayText(value: string, options: DisplayTextSanitizeOptions = {}) {
  const normalized = (
    options.preformatted
      ? normalizePreformattedDisplayText(value, {
          preserveBold: options.preserveBold,
        })
      : polishClinicalAnswerProse(sourceTextForClinicalProsePreservingBreaks(value), {
          preserveBold: options.preserveBold,
        })
  ).trim();
  if (!normalized) return "";
  const artifactStart = normalizeDisplayText(normalized).search(
    /\{\s*"(?:answer|heading|body|grounded|confidence|citations?|answerSections?|citation_chunk_ids|source_chunk_ids|chunk_id|conflictsOrGaps|quoteCards?)\s*:/i,
  );
  const trimmed =
    artifactStart === -1 ? normalized : artifactStart === 0 ? "" : normalized.slice(0, artifactStart).trim();
  if (!trimmed) return "";
  const { minLength = 2, minTokens = 1 } = options;
  if (trimmed.length < minLength) return "";
  const tokenCount = normalizeDisplayText(trimmed).split(/\s+/).filter(Boolean).length;
  if (tokenCount < minTokens) return "";
  if (!/[A-Za-z]{2,}/.test(trimmed)) return "";
  return looksLikeDisplayArtifact(trimmed) ? "" : trimmed;
}

/** Canonical primary prose shared by display rendering and client claim projection. */
export function primaryAnswerDisplayText(value: string, options: DisplayTextSanitizeOptions = {}) {
  return sanitizeAnswerDisplayText(value, { ...options, minLength: 8, minTokens: 2 })
    .replace(/(?:\s*\n\s*)?Synthetic demo only:.*$/i, "")
    .trim();
}
