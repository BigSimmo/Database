import {
  sourceTextForCompactDisplay,
  sourceTextForClinicalProse,
  sourceTextForClinicalProsePreservingBreaks,
} from "@/lib/source-text-sanitizer";
import { polishClinicalAnswerProse } from "@/lib/rag-answer-text";
import type { SearchResult } from "@/lib/types";

const displayJsonArtifactPattern =
  /"?(answer|heading|body|grounded|confidence|citations?|answerSections?|citation_chunk_ids|conflictsOrGaps|quoteCards?|source_chunk_ids|chunk_id)"?\s*:\s*/i;

export type DisplayTextSanitizeOptions = {
  minLength?: number;
  minTokens?: number;
  compactSource?: boolean;
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

export function sanitizeDisplayText(value: string, options: DisplayTextSanitizeOptions = {}) {
  const normalized = normalizeDisplayText(
    options.compactSource ? sourceTextForCompactDisplay(value) : sourceTextForClinicalProse(value),
  );
  if (!normalized) return "";
  const artifactStart = normalized.search(
    /\{\s*"(?:answer|heading|body|grounded|confidence|citations?|answerSections?|citation_chunk_ids|source_chunk_ids|chunk_id|conflictsOrGaps|quoteCards?)\s*:/i,
  );
  const trimmed =
    artifactStart === -1 ? normalized : artifactStart === 0 ? "" : normalized.slice(0, artifactStart).trim();
  if (!trimmed) return "";
  const { minLength = 2, minTokens = 1 } = options;
  if (trimmed.length < minLength) return "";
  const tokenCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (tokenCount < minTokens) return "";
  if (!/[A-Za-z]{2,}/.test(trimmed)) return "";
  return looksLikeDisplayArtifact(trimmed) ? "" : trimmed;
}

export function truncateWords(value: string, maxWords: number) {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return value;
  return `${words.slice(0, maxWords).join(" ")}...`;
}

export function sourceSnippetKey(value: string) {
  return value
    .toLowerCase()
    .replace(/\b(?:page|chunk|source|citation|document|file)\b\s*[:#=-]?\s*[\w.-]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 160);
}

export function compactSourceSnippet(value: string) {
  const normalized = sanitizeDisplayText(value, { minLength: 10, minTokens: 2, compactSource: true });
  if (!normalized) return "";
  const fragments = normalized
    .replace(
      /\b(?:source excerpt|relevant excerpt|source text|table text|clinical table|image caption|caption)\s*[:=-]\s*/gi,
      " ",
    )
    .match(/[^.!?]+[.!?]?/g) ?? [normalized];
  const seen = new Set<string>();
  const selected: string[] = [];

  for (const fragment of fragments) {
    const cleaned = fragment.replace(/\s+/g, " ").trim();
    if (!cleaned || cleaned.length < 10) continue;
    if (/^(?:source|citation|document|file|filename|chunk|page|image|provenance)\b/i.test(cleaned)) continue;
    const key = sourceSnippetKey(cleaned);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    selected.push(cleaned);
    if (selected.length >= 4) break;
  }

  return truncateWords((selected.length ? selected : [normalized]).join(" "), 90);
}

export function compactTableFact(fact: NonNullable<SearchResult["table_facts"]>[number]) {
  const fields = [
    { label: "Table", value: fact.table_title },
    { label: "Row", value: fact.row_label },
    { label: "Threshold", value: fact.threshold_value },
    { label: "Action", value: fact.action },
  ];
  const seen = new Set<string>();
  const cleanedFields = fields.flatMap((field) => {
    const value = sanitizeDisplayText(String(field.value ?? ""), { minLength: 2, minTokens: 1, compactSource: true });
    const key = sourceSnippetKey(value);
    if (!value || !key || seen.has(key)) return [];
    seen.add(key);
    return [{ ...field, value: truncateWords(value, 28) }];
  });

  return cleanedFields.length ? { id: fact.id, fields: cleanedFields } : null;
}

export function sanitizeAnswerDisplayText(value: string, options: DisplayTextSanitizeOptions = {}) {
  const normalized = polishClinicalAnswerProse(sourceTextForClinicalProsePreservingBreaks(value)).trim();
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

export function sourceDisplayTitle(source: SearchResult) {
  return source.title
    .replace(/^Synthetic /, "")
    .replace(/\.pdf$/i, "")
    .trim();
}

export function sourceDisplayMeta(source: SearchResult, title: string) {
  const fileBase = source.file_name?.replace(/\.pdf$/i, "").trim();
  const titleBase = title.toLowerCase();
  const fileBaseNormalized = (fileBase ?? "").toLowerCase();
  const includeFile =
    Boolean(fileBase) && fileBaseNormalized !== titleBase && !fileBaseNormalized.startsWith(titleBase);
  return [includeFile ? source.file_name : null, `page ${source.page_number ?? "n/a"}`].filter(Boolean).join(" · ");
}
