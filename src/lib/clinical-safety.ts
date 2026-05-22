import { documentCitationHref, formatCitationLabel } from "@/lib/citations";
import type { Citation, RagAnswer, SearchResult } from "@/lib/types";

export type SafetyFindingKind =
  | "contraindication"
  | "red_flag"
  | "escalation"
  | "dose_limit"
  | "monitoring"
  | "exclusion"
  | "caveat";

export type SafetyFinding = {
  id: string;
  kind: SafetyFindingKind;
  label: string;
  text: string;
  citation: Citation;
  href: string;
};

const safetyPatterns: Array<{ kind: SafetyFindingKind; label: string; pattern: RegExp }> = [
  {
    kind: "contraindication",
    label: "Contraindication",
    pattern: /\b(contraindicat|do not use|avoid|not recommended|must not)\b/i,
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

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function conciseSourceText(text: string) {
  const normalized = normalizeText(text);
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

export function extractSafetyFindings(answer: RagAnswer | null | undefined, limit = 5): SafetyFinding[] {
  if (!answer?.grounded) return [];

  const candidates = [
    ...(answer.quoteCards ?? []).map((quote) => ({
      id: quote.chunk_id,
      text: quote.quote,
      citation: quote,
    })),
    ...(answer.sources ?? []).map((source) => ({
      id: source.id,
      text: source.content,
      citation: citationFromSource(source),
    })),
  ];

  const seen = new Set<string>();
  const findings: SafetyFinding[] = [];

  for (const candidate of candidates) {
    const text = conciseSourceText(candidate.text);
    if (!text) continue;

    const match = safetyPatterns.find((item) => item.pattern.test(text));
    if (!match) continue;

    const key = `${match.kind}:${candidate.citation.document_id}:${candidate.citation.page_number}:${text.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    findings.push({
      id: `${match.kind}:${candidate.id}`,
      kind: match.kind,
      label: match.label,
      text: `Source mentions: ${text}`,
      citation: candidate.citation,
      href: documentCitationHref(candidate.citation),
    });

    if (findings.length >= limit) break;
  }

  return findings;
}

export function formatSafetyFindingLabel(finding: SafetyFinding) {
  return `${finding.label} · ${formatCitationLabel(finding.citation)}`;
}
