import { documentCitationHref, formatCitationLabel } from "@/lib/citations";
import { queryCoreTerms } from "@/lib/evidence-relevance";
import { sanitizeAnswerText } from "@/lib/rag/rag-answer-text";
import {
  clinicalProseUsefulness,
  sourceTextForCompactDisplay,
  sourceTextForDisplay,
} from "@/lib/source-text-sanitizer";
import type { Citation, RagAnswer, SafetyWarning, SafetyWarningKind, SearchResult } from "@/lib/types";

export type SafetyFindingKind = SafetyWarningKind;
export type SafetyFinding = SafetyWarning;

const safetyPatterns: Array<{ kind: SafetyFindingKind; label: string; pattern: RegExp }> = [
  {
    kind: "contraindication",
    label: "Contraindication",
    pattern: /\b(contraindicat\w*|do not use|avoid|not recommended|must not)\b/i,
  },
  {
    kind: "red_flag",
    label: "Red flag",
    pattern: /\b(red flag|urgent|emergency|immediate|severe|toxicity|seizure|chest pain|dyspnoea)\b/i,
  },
  {
    kind: "escalation",
    label: "Escalation",
    pattern: /\b(escalat|senior review|specialist review|urgent review|higher level|transfer)\b/i,
  },
  {
    kind: "dose_limit",
    label: "Dose limit",
    pattern: /\b(maximum dose|max dose|dose limit|do not exceed|mg\/day|microgram|mcg)\b/i,
  },
  {
    kind: "monitoring",
    label: "Monitoring",
    pattern: /\b(monitor|baseline|repeat|review|blood test|level|fbc|anc|renal|thyroid|metabolic)\b/i,
  },
  {
    kind: "exclusion",
    label: "Exclusion",
    pattern: /\b(exclusion|exclude|not applicable|unless|except|avoid if)\b/i,
  },
  {
    kind: "caveat",
    label: "Caveat",
    pattern: /\b(caution|consider|if symptoms|seek advice|consult|limited evidence)\b/i,
  },
];

/**
 * How much of a passage two findings must share before containment is treated as
 * "the same passage". Below this, a short fragment is a substring of too much.
 */
const minPassageOverlap = 40;

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function conciseSourceText(text: string) {
  const useful = clinicalProseUsefulness(text);
  const normalized = normalizeText(
    (sourceTextForCompactDisplay(useful.text || text) || sourceTextForDisplay(text))
      .replace(/\bsource mentions\s*:?\s*/gi, "")
      .replace(/\b(?:procedure|policy|protocol)\s+[A-Z]{2,}(?:-[A-Z0-9]+)+(?:\/\d+)?\b[\s.:-]*/gi, "")
      .replace(/\bpage\s+\d+\s+of\s+\d+\b[\s.:-]*/gi, "")
      .replace(/\bchunk\s*(?:id|index)?\s*[:#=-]?\s*[a-z0-9_-]+\b[\s.:-]*/gi, ""),
  );
  if (normalized.length <= 260) return normalized;
  return `${normalized.slice(0, 257).trim()}...`;
}

function citationFromSource(source: SearchResult): Citation {
  return {
    chunk_id: source.id,
    document_id: source.document_id,
    title: source.title,
    file_name: source.file_name,
    page_number: source.page_number,
    chunk_index: source.chunk_index,
    similarity: source.similarity,
    source_metadata: source.source_metadata,
  };
}

function hasQueryConceptOverlap(text: string, terms: string[]) {
  if (terms.length === 0) return true;
  const haystack = text.toLowerCase();
  return terms.some((term) => haystack.includes(term.toLowerCase()));
}

/**
 * Collapse findings that are the same passage counted twice.
 *
 * The candidate list below draws from `quoteCards` AND `sources`, and a quote
 * card is an extract of its own parent chunk — same document, same page, its
 * text a substring of the chunk's. Both used to survive, because the dedupe key
 * was the text itself and two different lengths of one passage are two different
 * strings. They could also carry different labels: `safetyPatterns.find` returns
 * the first pattern the text matches, and the longer text reaches severities the
 * extract does not. On the live clozapine answer that rendered as "3 safety
 * notes" over two passages, the first two of them the same words under "Red
 * flag" and "Monitoring".
 *
 * A count is the whole point of this surface, so an inflated one is not cosmetic.
 * Same document, same page, one text containing the other: keep the fuller text,
 * and keep the most severe label of the group — a passage that names both an
 * urgent trigger and a monitoring step is a red flag that also mentions
 * monitoring, not two findings.
 *
 * Applied to every path into this module, including an answer that arrives with
 * `safetyWarnings` already computed, so a future producer of those warnings
 * cannot reintroduce the double count.
 */
export function collapseDuplicateSafetyFindings(findings: SafetyFinding[]): SafetyFinding[] {
  const kept: SafetyFinding[] = [];
  const normalized = new Map<SafetyFinding, string>();
  const passageKey = (finding: SafetyFinding) =>
    `${finding.citation.document_id}:${finding.citation.page_number ?? "?"}`;

  for (const finding of findings) {
    const text = normalizeText(finding.text).toLowerCase();
    normalized.set(finding, text);
    const duplicateIndex = kept.findIndex((candidate) => {
      if (passageKey(candidate) !== passageKey(finding)) return false;
      const other = normalized.get(candidate) ?? "";
      if (other === text) return true;
      // Containment only counts when the shorter side is long enough to identify
      // a passage. A stray fragment is a substring of almost anything.
      const shorter = other.length < text.length ? other : text;
      if (shorter.length < minPassageOverlap) return false;
      return other.includes(text) || text.includes(other);
    });

    if (duplicateIndex === -1) {
      kept.push(finding);
      continue;
    }

    const existing = kept[duplicateIndex];
    const existingText = normalized.get(existing) ?? "";
    const fuller = text.length > existingText.length ? finding : existing;
    const severest = safetyKindPriority[finding.kind] < safetyKindPriority[existing.kind] ? finding : existing;
    kept[duplicateIndex] = fuller === severest ? fuller : { ...fuller, kind: severest.kind, label: severest.label };
    normalized.set(kept[duplicateIndex], normalizeText(kept[duplicateIndex].text).toLowerCase());
  }

  return kept;
}

export function extractSafetyFindings(answer: RagAnswer | null | undefined, limit = 5): SafetyFinding[] {
  if (answer?.safetyWarnings) return collapseDuplicateSafetyFindings(answer.safetyWarnings).slice(0, limit);
  if (!answer?.grounded) return [];
  if (answer.relevance && !answer.relevance.isSourceBacked) return [];

  const sourceByChunkId = new Map((answer.sources ?? []).map((source) => [source.id, source]));
  const queryTerms = queryCoreTerms(answer.smartPanel?.query ?? "");
  const relevanceTerms = answer.relevance?.matchedTerms ?? [];
  const coreTerms = queryTerms.length ? queryTerms : relevanceTerms;

  const candidates = [
    ...(answer.quoteCards ?? []).map((quote) => {
      const source = sourceByChunkId.get(quote.chunk_id);
      return {
        id: quote.chunk_id,
        text: quote.quote,
        citation: quote,
        source,
        sourceStrength: quote.source_strength ?? source?.source_strength,
      };
    }),
    ...(answer.sources ?? []).map((source) => ({
      id: source.id,
      text: source.content,
      citation: citationFromSource(source),
      source,
      sourceStrength: source.source_strength,
    })),
  ];

  const seen = new Set<string>();
  const findings: SafetyFinding[] = [];

  for (const candidate of candidates) {
    const text = sanitizeAnswerText(conciseSourceText(candidate.text)) || conciseSourceText(candidate.text);
    if (!text) continue;
    if (answer.relevance) {
      const sourceBacked = candidate.source?.relevance?.isSourceBacked;
      const moderateOrStrong = candidate.sourceStrength === "strong" || candidate.sourceStrength === "moderate";
      const overlapsQuery = hasQueryConceptOverlap(text, coreTerms);
      if (!sourceBacked && !(moderateOrStrong && overlapsQuery)) continue;
    }

    const match = safetyPatterns.find((item) => item.pattern.test(text));
    if (!match) continue;

    const key = `${match.kind}:${candidate.citation.document_id}:${candidate.citation.page_number}:${text.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    findings.push({
      id: `${match.kind}:${candidate.id}`,
      kind: match.kind,
      label: match.label,
      text,
      citation: candidate.citation,
      href: documentCitationHref(candidate.citation),
    });

    // Deliberately NOT `>= limit`: the collapse below can merge two of these
    // into one, and stopping at the limit first would let a duplicate crowd out
    // a genuinely distinct finding.
    if (findings.length >= limit * 2) break;
  }

  return collapseDuplicateSafetyFindings(findings).slice(0, limit);
}

export function formatSafetyFindingLabel(finding: SafetyFinding) {
  return `${finding.label} · ${formatCitationLabel(finding.citation)}`;
}

const safetyKindPriority: Record<SafetyFindingKind, number> = {
  contraindication: 10,
  red_flag: 20,
  escalation: 30,
  dose_limit: 40,
  monitoring: 50,
  exclusion: 60,
  caveat: 70,
};

export function sortSafetyFindingsBySeverity(findings: SafetyFinding[]): SafetyFinding[] {
  return [...findings].sort((left, right) => safetyKindPriority[left.kind] - safetyKindPriority[right.kind]);
}
