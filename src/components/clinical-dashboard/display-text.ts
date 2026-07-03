import {
  normalizeExtractedGlyphs,
  sourceTextForCompactDisplay,
  sourceTextForClinicalProse,
  sourceTextForClinicalProsePreservingBreaks,
  stripClassificationBanner,
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

// A clinical unit that should stay attached to a preceding bare number when a
// snippet is truncated (so "150 mg/day" or "1.5 ×10⁹/L" never lose their unit).
const TRUNCATION_UNIT_PATTERN =
  /^(?:×10|x10|mg|mcg|microgram|micrograms|µg|μg|g|kg|ml|l|mmol|mol|umol|µmol|ng|units?|iu|hours?|hrs?|h|days?|weeks?|wk|months?|minutes?|mins?|years?|°c|mmhg|bpm|%)\b/i;
const TRUNCATION_TRAILING_CONNECTOR = /^(?:or|and|to|with|of|for|the|a|an|until|than|in|on|at|by)$/i;

function isBareNumberWord(word: string) {
  return /^[<>≤≥~]?\d[\d.,–—-]*$/.test(word);
}

export function truncateWords(value: string, maxWords: number) {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return value;
  let end = maxWords;
  // Keep a number attached to its following unit so a threshold/dose is never
  // cut between the value and the unit.
  if (isBareNumberWord(words[end - 1]) && words[end] && TRUNCATION_UNIT_PATTERN.test(words[end])) {
    end += 1;
  }
  // Drop a dangling connector left at the very end ("... or", "... until").
  while (end > 1 && TRUNCATION_TRAILING_CONNECTOR.test(words[end - 1])) {
    end -= 1;
  }
  return `${words.slice(0, end).join(" ")}...`;
}

export function sourceSnippetKey(value: string) {
  return value
    .toLowerCase()
    .replace(/\b(?:page|chunk|source|citation|document|file)\b\s*[:#=-]?\s*[\w.-]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 160);
}

// Strips a leading duplicate of the card's own visible title (extraction often
// glues the running header onto the body text). Matches word-by-word so
// punctuation/spacing differences ("Guideline(EMHS)" vs "Guideline (EMHS)")
// don't defeat it, but requires a non-space separator after the title so a
// sentence that legitimately starts with the title words as its grammatical
// subject is never cut.
function stripLeadingTitleDuplicate(text: string, title: string) {
  const titleWords = title.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  if (titleWords.length < 2) return text;
  let matched = 0;
  let end = 0;
  for (const wordMatch of text.matchAll(/[A-Za-z0-9]+/g)) {
    const gap = text.slice(end, wordMatch.index);
    if (!/^[\s\-–—:,()&/'"·]*$/.test(gap)) break;
    if (wordMatch[0].toLowerCase() !== titleWords[matched]) break;
    matched += 1;
    end = wordMatch.index + wordMatch[0].length;
    if (matched === titleWords.length) break;
  }
  if (matched !== titleWords.length) return text;
  // Allow closers left over from a parenthetical title ("… Guideline (EMHS)")
  // before the separator, but the separator itself is mandatory.
  const separator = text.slice(end).match(/^[\s)\]]*[;:·\-–—]+\s*/);
  if (!separator) return text;
  const rest = text.slice(end + separator[0].length).trim();
  return rest.length >= 20 ? rest : text;
}

export type CompactSourceSnippetOptions = {
  // The card's visible title, so a glued duplicate of it at the head of the
  // snippet can be dropped.
  dropTitle?: string;
};

export function compactSourceSnippet(value: string, options: CompactSourceSnippetOptions = {}) {
  const normalized = sanitizeDisplayText(value, { minLength: 10, minTokens: 2, compactSource: true });
  if (!normalized) return "";
  // A trailing ellipsis (stored truncation) must come off before the sentence
  // split, otherwise the cut tail masquerades as a complete final sentence.
  const truncatedTail = /(?:\.{3}|…)\s*$/.test(normalized);
  let body = normalized.replace(/\s*(?:\.{3}|…)\s*$/, "");
  if (options.dropTitle) {
    body = stripLeadingTitleDuplicate(body, cleanDisplayTitle(options.dropTitle));
  }
  if (!body) return "";
  const fragments = body
    .replace(
      /\b(?:source excerpt|relevant excerpt|source text|table text|clinical table|image caption|caption)\s*[:=-]\s*/gi,
      " ",
    )
    .match(/[^.!?]+[.!?]?/g) ?? [body];
  const seen = new Set<string>();
  const selected: string[] = [];

  for (const fragment of fragments) {
    let cleaned = fragment.replace(/\s+/g, " ").trim();
    if (selected.length === 0) {
      // The head of the snippet can be cut mid-structure by chunking: shed
      // orphaned closers (")." "]:") and a mid-list ordinal ("2. MO to
      // check…" keeps its content, loses the navigational marker; "1." is a
      // genuine list start and is kept).
      cleaned = cleaned.replace(/^[)\]}»”’]+[.,;:]?\s*/, "").replace(/^(?:[2-9]|1\d)[.)]\s+(?=["'(]?[A-Z])/, "");
    }
    if (!cleaned || cleaned.length < 10) continue;
    if (/^(?:source|citation|document|file|filename|chunk|page|image|provenance)\b/i.test(cleaned)) continue;
    const key = sourceSnippetKey(cleaned);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    selected.push(cleaned);
    if (selected.length >= 4) break;
  }

  if (!selected.length) selected.push(body.replace(/\s+/g, " ").trim());
  // A first fragment starting lowercase is a mid-clause continuation. When the
  // rest of the snippet has real sentence starts and enough substance, start
  // there instead — the missing clause head could carry a negation. When the
  // partial fragment is all we have, keep every word and mark the continuation
  // honestly rather than fabricating a sentence start by capitalizing.
  if (selected.length > 1 && /^[a-z]/.test(selected[0])) {
    const rest = selected.slice(1);
    if (rest.some((fragment) => /^["'(]?[A-Z0-9]/.test(fragment)) && rest.join(" ").length >= 40) {
      selected.shift();
    }
  }
  const leadingContinuation = /^[a-z]/.test(selected[0]);

  let text = truncateWords(selected.join(" "), 90);
  if (leadingContinuation) text = `… ${text}`;
  if (truncatedTail && !/(?:\.{3}|…)$/.test(text)) text = `${text} …`;
  return text;
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

export function cleanDisplayTitle(title: string) {
  return (
    stripClassificationBanner(normalizeExtractedGlyphs(title ?? ""))
      .replace(/^Synthetic /, "")
      .replace(/\.pdf$/i, "")
      // Missing space before an acronym-like parenthetical: "Guideline(EMHS)" →
      // "Guideline (EMHS)". Requires 2+ leading capitals inside the parens so
      // "guideline(s)" and "dose(mg)" stay untouched.
      .replace(/([A-Za-z])\((?=[A-Z]{2}[^)]*\))/g, "$1 (")
      .replace(/\s+/g, " ")
      .trim()
  );
}

export function sourceDisplayTitle(source: SearchResult) {
  return cleanDisplayTitle(source.title);
}

export function sourceDisplayMeta(source: SearchResult, title: string) {
  const fileBase = source.file_name?.replace(/\.pdf$/i, "").trim();
  const titleBase = title.toLowerCase();
  const fileBaseNormalized = (fileBase ?? "").toLowerCase();
  const includeFile =
    Boolean(fileBase) && fileBaseNormalized !== titleBase && !fileBaseNormalized.startsWith(titleBase);
  return [includeFile ? source.file_name : null, `page ${source.page_number ?? "n/a"}`].filter(Boolean).join(" · ");
}

export function comparableAnswerText(value: string) {
  return value
    .replace(/\*\*/g, "")
    .replace(/\.\.\.$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
