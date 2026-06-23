import { formatCitationLabel } from "@/lib/citations";
import { parseAnswerDisplayContent, type AnswerDisplayGroup } from "@/lib/answer-formatting";
import {
  clipboardProvenanceLine,
  extractionQualityLabel,
  normalizeSourceMetadata,
  sourceStatusLabel,
  validationStatusLabel,
} from "@/lib/source-metadata";
import {
  clinicalProseUsefulness,
  isLowYieldClinicalText,
  sourceTextForClinicalProse,
} from "@/lib/source-text-sanitizer";
import type { AnswerSectionKind, QuoteCard, RagAnswer, VisualEvidenceCard } from "@/lib/types";

export type ClinicalOutputSectionId =
  | "bottom-line"
  | "support-map"
  | "action"
  | "monitoring"
  | "medication"
  | "thresholds"
  | "escalation"
  | "cautions"
  | "documentation"
  | "comparison"
  | "source-gap"
  | "verify-source";

export type ClinicalThresholdTable = {
  id: string;
  caption: string;
  markdown?: string | null;
  rows?: string[][] | null;
  columns?: string[] | null;
};

export type ClinicalOutputSection = {
  id: ClinicalOutputSectionId;
  title: string;
  items: string[];
  tables?: ClinicalThresholdTable[];
};

export type AnswerViewMode = "standard" | "high_yield" | "evidence_map";

export type AnswerEvidenceMapRow = {
  id: string;
  section: string;
  detail: string;
  supportLevel: string;
  citationCount: number;
  sourceStatus: string;
  bestSourceLabel: string;
  bestLinkedPassage: string;
  href?: string;
};

const thresholdPattern =
  /\b(thresholds?|cut[\s-]?offs?|withhold|cease|stop|hold|discontinue|anc|fbc|wbc|neutrophils?|levels?|ranges?|criteria|scores?|ratings?|below|above|less than|greater than|mmol|mg\/l|x\s*10)\b|[<>]=?|[≤≥]/i;
const unsupportedGapPattern =
  /\b(?:supplied\s+)?(?:sources?|documents?|guidelines?)\s+(?:do|does)\s+not\s+(?:provide|state|include|answer|cover)\b|\bnot\s+(?:provided|available|stated|covered|supported)\b|\bsource\s+gap\b/i;

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeClinicalItem(text: string) {
  const usefulness = clinicalProseUsefulness(text);
  return normalizeText(usefulness.text || sourceTextForClinicalProse(text));
}

function normalizeClinicalToken(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const genericClinicalTableTokens = new Set([
  "action",
  "below",
  "clinical",
  "criteria",
  "dose",
  "dosing",
  "greater",
  "level",
  "less",
  "monitor",
  "monitoring",
  "range",
  "review",
  "source",
  "table",
  "threshold",
  "thresholds",
]);

const medicationSpecificTokens = new Set([
  "amisulpride",
  "aripiprazole",
  "carbamazepine",
  "clozapine",
  "diazepam",
  "droperidol",
  "haloperidol",
  "lamotrigine",
  "lithium",
  "lorazepam",
  "olanzapine",
  "paliperidone",
  "promethazine",
  "quetiapine",
  "risperidone",
  "valproate",
  "zuclopenthixol",
]);

function clinicalTokens(text: string) {
  const tokens = text
    .split(/[^a-zA-Z0-9]+/)
    .map(normalizeClinicalToken)
    .filter((token) => token.length >= 4 && !genericClinicalTableTokens.has(token));
  return new Set(tokens);
}

function hasSharedClinicalToken(a: string, b: string) {
  const left = clinicalTokens(a);
  if (left.size === 0) return false;
  for (const token of clinicalTokens(b)) {
    if (left.has(token)) return true;
  }
  return false;
}

function medicationTokens(text: string) {
  return Array.from(clinicalTokens(text)).filter((token) => medicationSpecificTokens.has(token));
}

function hasRequiredMedicationMatch(query: string, text: string) {
  const queryMedications = medicationTokens(query);
  if (queryMedications.length === 0) return true;
  const textMedications = new Set(medicationTokens(text));
  return queryMedications.some((token) => textMedications.has(token));
}

function uniqueShortItems(items: string[], limit: number) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const rawItem of items) {
    const usefulness = clinicalProseUsefulness(rawItem);
    const item = normalizeClinicalItem(rawItem);
    if (!item) continue;
    if (!usefulness.useful && isLowYieldClinicalText(item)) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item.length > 240 ? `${item.slice(0, 237).trim()}...` : item);
    if (output.length >= limit) break;
  }

  return output;
}

function parseMarkdownTable(markdown?: string | null) {
  if (!markdown) return null;
  const rows = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes("|") && !/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(line))
    .map((line) =>
      line
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.replace(/\\\|/g, "|").trim()),
    )
    .filter((row) => row.some(Boolean));
  return rows.length ? rows : null;
}

function tableShape(table: Pick<ClinicalThresholdTable, "markdown" | "rows" | "columns">) {
  const rows = table.rows?.length ? table.rows : parseMarkdownTable(table.markdown);
  const rowCount = rows?.length ?? 0;
  const columnCount = Math.max(table.columns?.length ?? 0, ...(rows?.map((row) => row.length) ?? [0]));
  return { rowCount, columnCount };
}

function tableHasUsableShape(table: Pick<ClinicalThresholdTable, "markdown" | "rows" | "columns">) {
  const { rowCount, columnCount } = tableShape(table);
  return rowCount >= 2 && columnCount >= 2;
}

function visualEvidenceText(card: VisualEvidenceCard) {
  return [card.tableLabel, card.tableTitle, card.caption, card.tableTextSnippet, card.labels?.join(" ")]
    .filter(Boolean)
    .join(" ");
}

function isWeakAnswer(answer: RagAnswer) {
  return (
    answer.confidence === "unsupported" ||
    answer.grounded === false ||
    answer.relevance?.isSourceBacked === false ||
    answer.relevance?.verdict === "nearby" ||
    answer.relevance?.verdict === "none"
  );
}

function isPromotableClinicalTable(card: VisualEvidenceCard, answer: RagAnswer) {
  const text = visualEvidenceText(card);
  if (!thresholdPattern.test(text)) return false;

  const query = answer.smartPanel?.query ?? "";
  const relevance = card.relevance;
  const directlyRelevant = relevance?.verdict === "direct" || relevance?.verdict === "partial";

  if (query && !hasSharedClinicalToken(query, text)) return false;
  if (query && !hasRequiredMedicationMatch(query, text)) return false;
  if (isWeakAnswer(answer)) return Boolean(directlyRelevant && query && hasSharedClinicalToken(query, text));

  return !relevance || directlyRelevant;
}

function isPromotableThresholdItem(item: string, answer: RagAnswer) {
  if (unsupportedGapPattern.test(item)) return false;
  if (isLowYieldClinicalText(item)) return false;
  const query = answer.smartPanel?.query ?? "";
  if (query && !hasSharedClinicalToken(query, item)) return false;
  if (query && !hasRequiredMedicationMatch(query, item)) return false;
  return true;
}

function sectionBodyMatchesKind(kind: AnswerSectionKind | undefined, body: string) {
  if (!kind) return true;
  const text = body.toLowerCase();
  if (kind !== "source_gap" && unsupportedGapPattern.test(text)) return false;
  if (kind === "medication_dose") {
    return /\b(?:dose|dosing|dosage|mg|mcg|mmol|route|oral|intramuscular|medication|lithium|clozapine|olanzapine|haloperidol|lorazepam|quetiapine|risperidone)\b/.test(
      text,
    );
  }
  if (kind === "thresholds") return thresholdPattern.test(text);
  if (kind === "monitoring_timing")
    return /\b(?:monitor|timing|weekly|monthly|hours?|days?|weeks?|blood|level|review interval)\b/.test(text);
  if (kind === "escalation_risk")
    return /\b(?:risk|escalat|urgent|red flag|withhold|cease|stop|emergency)\b/.test(text);
  if (kind === "documentation") return /\b(?:document|form|record|audit|consent|register|completion)\b/.test(text);
  if (kind === "required_actions")
    return /\b(?:action|required|must|arrange|contact|notify|assess|complete|follow up|report)\b/.test(text);
  return true;
}

function tableFromVisualEvidence(card: VisualEvidenceCard): ClinicalThresholdTable | null {
  const markdown = card.accessibleTableMarkdown?.trim()
    ? card.accessibleTableMarkdown
    : card.tableTextSnippet?.includes("|")
      ? card.tableTextSnippet
      : null;
  const candidate: ClinicalThresholdTable = {
    id: card.id,
    caption: clinicalTableCaption(card.tableTitle || card.caption),
    markdown,
    rows: card.tableRows,
    columns: card.tableColumns,
  };

  if (!tableHasUsableShape(candidate)) return null;
  return candidate;
}

function buildThresholdTables(answer: RagAnswer) {
  const evidence = [...(answer.visualEvidence ?? []), ...(answer.smartPanel?.visualEvidence ?? [])];
  const seen = new Set<string>();
  const tables: ClinicalThresholdTable[] = [];

  for (const card of evidence) {
    if (seen.has(card.id)) continue;
    seen.add(card.id);
    if (!isPromotableClinicalTable(card, answer)) continue;

    const table = tableFromVisualEvidence(card);
    if (!table) continue;
    tables.push(table);
    if (tables.length >= 2) break;
  }

  return tables;
}

function buildVerifySourceItems(answer: RagAnswer) {
  const citationCount = answer.citations.length;
  const quoteCount = answer.quoteCards?.length ?? 0;
  const sourceStrength = answer.evidenceSummary?.source_strength;
  return uniqueShortItems(
    [
      citationCount
        ? `${citationCount} linked citation${citationCount === 1 ? "" : "s"} for verification.`
        : "No linked citations.",
      quoteCount
        ? `${quoteCount} exact source quote${quoteCount === 1 ? "" : "s"} available.`
        : "No exact source quote returned.",
      sourceStrength && sourceStrength !== "none" ? `Strongest retrieved source support: ${sourceStrength}.` : "",
      answer.confidence === "unsupported"
        ? "Unsupported: verify against source text before use."
        : "Verify source passage before copying into the medical record.",
    ],
    4,
  );
}

const groupToClinicalSection: Partial<Record<AnswerDisplayGroup, { id: ClinicalOutputSectionId; title: string }>> = {
  bottom_line: { id: "bottom-line", title: "Bottom line" },
  action: { id: "action", title: "Action" },
  monitoring: { id: "monitoring", title: "Monitoring" },
  medication: { id: "medication", title: "Medication" },
  escalation: { id: "escalation", title: "Escalation" },
  documentation: { id: "documentation", title: "Documentation" },
  comparison: { id: "comparison", title: "Comparison" },
  gap: { id: "source-gap", title: "Source gap" },
};

const sectionKindLabels: Record<AnswerSectionKind, string> = {
  bottom_line: "Bottom line",
  required_actions: "Required actions",
  monitoring_timing: "Monitoring/timing",
  medication_dose: "Medication/dose details",
  thresholds: "Thresholds",
  escalation_risk: "Escalation/risk",
  contraindications_cautions: "Contraindications/cautions",
  comparison: "Comparison",
  documentation: "Documentation/forms",
  source_gap: "Source gap",
  visual_evidence: "Relevant visual evidence",
  quotes: "Exact quotes",
  verification: "Verify source",
};

const genericBottomLinePlaceholders = [
  "no usable answer text.",
  "no usable answer text for this result",
  "no usable section text available",
  "no usable section text for this result",
];

function isGenericBottomLine(value: string) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return true;
  return genericBottomLinePlaceholders.some((placeholder) => normalized.includes(placeholder));
}

function sectionKindToClinicalSection(kind?: AnswerSectionKind): { id: ClinicalOutputSectionId; title: string } | null {
  if (kind === "bottom_line") return { id: "bottom-line", title: "Bottom line" };
  if (kind === "required_actions") return { id: "action", title: "Action" };
  if (kind === "monitoring_timing") return { id: "monitoring", title: "Monitoring" };
  if (kind === "medication_dose") return { id: "medication", title: "Medication" };
  if (kind === "thresholds") return { id: "thresholds", title: "Thresholds" };
  if (kind === "escalation_risk") return { id: "escalation", title: "Escalation" };
  if (kind === "contraindications_cautions") return { id: "cautions", title: "Cautions" };
  if (kind === "comparison") return { id: "comparison", title: "Comparison" };
  if (kind === "documentation") return { id: "documentation", title: "Documentation" };
  if (kind === "source_gap") return { id: "source-gap", title: "Source gap" };
  return null;
}

function isPromotableAnswerSection(section: NonNullable<RagAnswer["answerSections"]>[number], answer: RagAnswer) {
  if (section.kind === "source_gap") return true;
  if (section.kind === "verification" || section.kind === "quotes" || section.kind === "visual_evidence") return false;
  const useful = clinicalProseUsefulness(`${section.heading}. ${section.body}`);
  if (!useful.useful && isLowYieldClinicalText(`${section.heading}. ${section.body}`)) return false;
  if (!sectionBodyMatchesKind(section.kind, useful.text || section.body)) return false;
  if (section.supportLevel === "unsupported") return false;
  if (section.supportLevel === "nearby") return false;
  if (isWeakAnswer(answer) && section.supportLevel !== "direct" && section.supportLevel !== "partial") return false;
  return true;
}

function sectionDisplayLines(answer: RagAnswer) {
  return (answer.answerSections ?? [])
    .filter((section) => isPromotableAnswerSection(section, answer))
    .flatMap((section) => {
      const label = section.kind ? sectionKindLabels[section.kind] : section.heading;
      return parseAnswerDisplayContent(`${label}: ${section.body}`, answer.responseMode).lines;
    });
}

function compactTableCell(value: string, limit = 180) {
  const normalized = normalizeClinicalItem(value);
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 3).trim()}...`;
}

function compactEvidencePassage(value: string, limit = 140) {
  const normalized = normalizeClinicalItem(value);
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 3).trim()}...`;
}

function clinicalTableCaption(value: string) {
  return normalizeText(value)
    .replace(/\btable\s+\d+\s*[:.-]?\s*/i, "")
    .replace(/\b(?:page|p\.)\s*\d+\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function answerSectionTableArea(section: NonNullable<RagAnswer["answerSections"]>[number]) {
  if (section.kind) return sectionKindLabels[section.kind];
  return normalizeText(section.heading) || "Clinical support";
}

function shouldBuildStructuredSupportTable(answer: RagAnswer, rowCount: number) {
  if (rowCount < 2) return false;
  if (rowCount >= 3) return true;
  return (
    answer.responseMode === "clinical_pathway" ||
    answer.responseMode === "comparison_matrix" ||
    answer.responseMode === "threshold_table" ||
    answer.queryClass === "comparison" ||
    answer.queryClass === "medication_dose_risk" ||
    answer.queryClass === "table_threshold"
  );
}

function buildStructuredSupportTable(answer: RagAnswer): ClinicalThresholdTable | null {
  const seen = new Set<string>();
  const rows = (answer.answerSections ?? [])
    .filter((section) => isPromotableAnswerSection(section, answer))
    .filter(
      (section) =>
        section.kind !== "bottom_line" &&
        section.kind !== "source_gap" &&
        section.kind !== "verification" &&
        section.kind !== "quotes" &&
        section.kind !== "visual_evidence",
    )
    .map((section) => {
      const area = compactTableCell(answerSectionTableArea(section), 52);
      const detail = compactTableCell(section.body);
      return [area, detail];
    })
    .filter((row) => {
      if (!row[0] || !row[1]) return false;
      const key = `${row[0].toLowerCase()}||${row[1].toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);

  if (!shouldBuildStructuredSupportTable(answer, rows.length)) return null;

  return {
    id: "structured-support-map",
    caption: "Clinical details from the answer",
    columns: ["Clinical area", "Clinical detail"],
    rows,
  };
}

function buildSourceComparisonTable(answer: RagAnswer): ClinicalThresholdTable | null {
  const documents = (answer.documentBreakdown ?? []).slice(0, 4);
  const shouldCompare =
    answer.responseMode === "comparison_matrix" || answer.queryClass === "comparison" || documents.length >= 3;
  if (!shouldCompare || documents.length < 2) return null;
  const rows = documents
    .map((document) => compactTableCell(document.best_quote ?? "", 180))
    .filter(Boolean)
    .map((detail) => [detail]);

  if (rows.length < 2) return null;

  return {
    id: "source-comparison-map",
    caption: "Clinical comparison detail",
    columns: ["Clinical detail"],
    rows,
  };
}

function evidenceHref(documentId: string, pageNumber?: number | null, chunkId?: string | null) {
  const params = new URLSearchParams();
  if (pageNumber) params.set("page", String(pageNumber));
  if (chunkId) params.set("chunk", chunkId);
  const query = params.toString();
  return `/documents/${documentId}${query ? `?${query}` : ""}`;
}

function supportLevelLabel(value?: string | null) {
  if (value === "direct") return "Direct";
  if (value === "partial") return "Partial";
  if (value === "nearby") return "Nearby only";
  if (value === "unsupported") return "Unsupported";
  if (value === "strong") return "Strong";
  if (value === "moderate") return "Moderate";
  if (value === "limited") return "Limited";
  return "Not classified";
}

function sourceStatusSummary(metadataInput: unknown) {
  const metadata = normalizeSourceMetadata(metadataInput);
  return [sourceStatusLabel(metadata), validationStatusLabel(metadata), extractionQualityLabel(metadata)].join(" / ");
}

function displaySectionLabel(section: NonNullable<RagAnswer["answerSections"]>[number]) {
  if (section.kind) return sectionKindLabels[section.kind];
  return normalizeText(section.heading) || "Answer section";
}

export function buildAnswerEvidenceMap(answer: RagAnswer | null | undefined): AnswerEvidenceMapRow[] {
  if (!answer) return [];

  const sourceByChunkId = new Map((answer.sources ?? []).map((source) => [source.id, source]));
  const citationByChunkId = new Map(answer.citations.map((citation) => [citation.chunk_id, citation]));
  const quoteByChunkId = new Map((answer.quoteCards ?? []).map((quote) => [quote.chunk_id, quote]));
  const rows: AnswerEvidenceMapRow[] = [];
  const sections = (answer.answerSections ?? []).filter(
    (section) => section.kind !== "verification" && section.kind !== "quotes" && section.kind !== "visual_evidence",
  );

  for (const [index, section] of sections.entries()) {
    const citationIds = Array.from(new Set(section.citation_chunk_ids.filter(Boolean)));
    const source = citationIds.map((id) => sourceByChunkId.get(id)).find(Boolean);
    const citation = citationIds.map((id) => citationByChunkId.get(id)).find(Boolean);
    const quote = citationIds.map((id) => quoteByChunkId.get(id)).find(Boolean);
    const metadata = source?.source_metadata ?? citation?.source_metadata ?? null;
    const bestSourceLabel = source
      ? `${source.title}, page ${source.page_number ?? "n/a"}`
      : citation
        ? formatCitationLabel(citation)
        : "No linked source";
    const bestLinkedPassage = compactTableCell(quote?.quote ?? source?.content ?? section.body, 220);
    const supportLevel = section.supportLevel ?? source?.source_strength ?? answer.evidenceSummary?.source_strength;
    const href = source
      ? evidenceHref(source.document_id, source.page_number, source.id)
      : citation
        ? evidenceHref(citation.document_id, citation.page_number, citation.chunk_id)
        : undefined;

    rows.push({
      id: `${section.heading || "section"}:${index}`,
      section: displaySectionLabel(section),
      detail: compactTableCell(section.body, 180),
      supportLevel: supportLevelLabel(supportLevel),
      citationCount: citationIds.length,
      sourceStatus: sourceStatusSummary(metadata),
      bestSourceLabel,
      bestLinkedPassage: compactEvidencePassage(bestLinkedPassage, 130),
      href,
    });
  }

  if (rows.length > 0) return rows.slice(0, 8);

  return answer.citations.slice(0, 6).map((citation, index) => ({
    id: `citation:${citation.chunk_id}:${index}`,
    section: "Citation",
    detail: "Source passage available.",
    supportLevel: supportLevelLabel(answer.evidenceSummary?.source_strength),
    citationCount: 1,
    sourceStatus: sourceStatusSummary(citation.source_metadata),
    bestSourceLabel: formatCitationLabel(citation),
    bestLinkedPassage: "Open source passage.",
    href: evidenceHref(citation.document_id, citation.page_number, citation.chunk_id),
  }));
}

export function buildHighYieldClinicalOutputSections(answer: RagAnswer | null | undefined) {
  const highYieldIds = new Set<ClinicalOutputSectionId>([
    "action",
    "thresholds",
    "cautions",
    "escalation",
    "monitoring",
    "medication",
    "source-gap",
    "verify-source",
  ]);

  return buildClinicalOutputSections(answer)
    .filter((section) => highYieldIds.has(section.id))
    .map((section) => ({
      ...section,
      items: uniqueShortItems(section.items, section.id === "verify-source" ? 2 : 4),
    }))
    .filter((section) => section.items.length > 0 || Boolean(section.tables?.length));
}

function clinicalTableToTextRows(table: ClinicalThresholdTable) {
  const rows = table.rows?.length ? table.rows : parseMarkdownTable(table.markdown);
  if (!rows?.length) return [];
  const hasColumns = Boolean(table.columns?.length);
  const header = hasColumns ? (table.columns ?? []) : rows[0];
  const body = hasColumns ? rows : rows.slice(1);
  const visibleBody = body.slice(0, 6);

  return [
    table.caption,
    header.length ? `| ${header.join(" | ")} |` : "",
    header.length ? `| ${header.map(() => "---").join(" | ")} |` : "",
    ...visibleBody.map((row) => `| ${row.join(" | ")} |`),
  ].filter(Boolean);
}

export function buildClinicalOutputSections(answer: RagAnswer | null | undefined) {
  if (!answer) return [];

  const answerContent = parseAnswerDisplayContent(answer.answer, answer.responseMode);
  const answerLead =
    (answerContent.lead && !isGenericBottomLine(answerContent.lead.text) ? answerContent.lead : undefined) ??
    answerContent.lines.find((line) => !isGenericBottomLine(line.text) && line.group === "bottom_line") ??
    answerContent.lines.find((line) => !isGenericBottomLine(line.text));
  const answerDetailLines = answerLead
    ? answerContent.lines.filter((line) => line.id !== answerLead.id)
    : answerContent.lines;
  const parsedLines = [...answerDetailLines, ...sectionDisplayLines(answer)];
  const quoteTexts = answer.quoteCards?.map((quote) => quote.quote) ?? [];
  const allTexts = [...parsedLines.map((line) => line.text), ...quoteTexts];
  const thresholdTables = buildThresholdTables(answer);
  const thresholdItems = uniqueShortItems(
    allTexts.filter((item) => thresholdPattern.test(item) && isPromotableThresholdItem(item, answer)),
    4,
  );
  const structuredSupportTable = buildStructuredSupportTable(answer);
  const sourceComparisonTable = buildSourceComparisonTable(answer);
  const verifySource = buildVerifySourceItems(answer);

  const sections: ClinicalOutputSection[] = [];
  if (answerLead?.text) {
    sections.push({
      id: answerLead.group === "gap" ? "source-gap" : "bottom-line",
      title: answerLead.group === "gap" ? "Source gap" : "Bottom line",
      items: uniqueShortItems([answerLead.text], 1),
    });
  }

  if (structuredSupportTable) {
    sections.push({
      id: "support-map",
      title: "Structured support",
      items: [],
      tables: [structuredSupportTable],
    });
  }

  for (const group of [
    "bottom_line",
    "action",
    "monitoring",
    "medication",
    "escalation",
    "documentation",
    "comparison",
    "gap",
  ] as const) {
    const section = groupToClinicalSection[group];
    if (!section) continue;
    const items = uniqueShortItems(
      parsedLines.filter((line) => line.group === group).map((line) => line.text),
      group === "bottom_line" ? 1 : 4,
    );
    if (items.length === 0) continue;
    const existing = sections.find((candidate) => candidate.id === section.id);
    if (existing) {
      existing.items = uniqueShortItems([...existing.items, ...items], group === "bottom_line" ? 1 : 4);
    } else {
      sections.push({ ...section, items });
    }
  }

  for (const section of answer.answerSections ?? []) {
    if (!isPromotableAnswerSection(section, answer)) continue;
    const clinicalSection = sectionKindToClinicalSection(section.kind);
    if (!clinicalSection || clinicalSection.id === "bottom-line" || clinicalSection.id === "thresholds") continue;
    const items = uniqueShortItems([section.body], 4);
    if (!items.length) continue;
    const existing = sections.find((candidate) => candidate.id === clinicalSection.id);
    if (existing) {
      existing.items = uniqueShortItems([...existing.items, ...items], 4);
    } else {
      sections.push({ ...clinicalSection, items });
    }
  }

  if (thresholdItems.length || thresholdTables.length) {
    sections.push({
      id: "thresholds",
      title: "Thresholds",
      items: thresholdItems,
      tables: thresholdTables,
    });
  }

  if (sourceComparisonTable) {
    const existing = sections.find((section) => section.id === "comparison");
    if (existing) {
      existing.tables = [...(existing.tables ?? []), sourceComparisonTable];
    } else {
      sections.push({
        id: "comparison",
        title: "Comparison",
        items: [],
        tables: [sourceComparisonTable],
      });
    }
  }

  sections.push({
    id: "verify-source",
    title: "Verify source",
    items: verifySource,
  });

  return sections;
}

function normalizedOutputText(text: string) {
  return normalizeClinicalToken(normalizeText(text));
}

function isRepeatedBottomLine(item: string, bottomLine: string) {
  const normalizedItem = normalizedOutputText(item);
  const normalizedBottomLine = normalizedOutputText(bottomLine);
  if (!normalizedItem || !normalizedBottomLine) return false;
  if (normalizedItem === normalizedBottomLine) return true;
  if (item.length >= 80 && normalizedBottomLine.includes(normalizedItem)) return true;
  if (bottomLine.length >= 80 && normalizedItem.includes(normalizedBottomLine)) return true;
  return false;
}

function bottomLineForOutput(answer: RagAnswer, sections: ClinicalOutputSection[]) {
  const bottomLineSection = sections.find((section) => section.id === "bottom-line");
  const parsedLead = parseAnswerDisplayContent(answer.answer, answer.responseMode).lead;
  const fallbackFromSections = (answer.answerSections ?? [])
    .map((section) => normalizeClinicalItem(section.body))
    .find((item) => Boolean(item) && !isGenericBottomLine(item));
  const fallbackFromParsed = parseAnswerDisplayContent(answer.answer, answer.responseMode)
    .lines.map((line) => normalizeClinicalItem(line.text))
    .find((item) => Boolean(item) && !isGenericBottomLine(item));

  const candidateBottomLine =
    bottomLineSection?.items[0] ??
    fallbackFromParsed ??
    fallbackFromSections ??
    parsedLead?.text ??
    normalizeClinicalItem(answer.answer) ??
    normalizeText(answer.answer);
  return isGenericBottomLine(candidateBottomLine)
    ? "No stable source-backed lead. Review cited passages before reuse."
    : candidateBottomLine;
}

function highYieldSectionsForOutput(answer: RagAnswer, bottomLine: string) {
  return buildHighYieldClinicalOutputSections(answer)
    .filter((section) => section.id !== "bottom-line" && section.id !== "verify-source")
    .map((section) => ({
      ...section,
      items: uniqueShortItems(
        section.items.filter((item) => !isRepeatedBottomLine(item, bottomLine)),
        4,
      ),
    }))
    .filter((section) => section.items.length > 0 || Boolean(section.tables?.length));
}

function sectionOutputLines(section: ClinicalOutputSection) {
  return [
    section.title,
    ...section.items.map((item) => `- ${item}`),
    ...(section.tables ?? []).flatMap(clinicalTableToTextRows),
    "",
  ];
}

function citationOutputLines(answer: RagAnswer) {
  if (answer.citations.length === 0) return ["No linked citations."];
  return answer.citations.map((citation, index) => `${index + 1}. ${formatCitationLabel(citation)}`);
}

function sourceStatusOutputLines(answer: RagAnswer) {
  if (answer.citations.length === 0) return ["No source provenance."];
  return answer.citations.map(
    (citation, index) =>
      `${index + 1}. ${formatCitationLabel(citation)} | ${clipboardProvenanceLine(citation.source_metadata)}`,
  );
}

const clinicalReviewRequirement =
  "Draft for clinician review only. Verify source text, local policy, patient context, and medication details before use.";

function compactOutputDocument(lines: string[]) {
  return lines
    .filter((line, index, allLines) => line || (allLines[index - 1] && allLines[index + 1]))
    .join("\n")
    .trim();
}

export function formatAnswerForClipboard(answer: RagAnswer) {
  const sections = buildClinicalOutputSections(answer);
  const bottomLine = bottomLineForOutput(answer, sections);
  const highYieldSections = highYieldSectionsForOutput(answer, bottomLine);
  return compactOutputDocument([
    "Source-backed answer draft",
    "Verify against linked source documents before clinical use.",
    "",
    "Bottom line",
    `- ${bottomLine}`,
    "",
    ...highYieldSections.flatMap(sectionOutputLines),
    "Citations",
    ...citationOutputLines(answer),
    "",
    "Source status",
    ...sourceStatusOutputLines(answer),
    "",
    "Review requirement",
    clinicalReviewRequirement,
  ]);
}

export function formatQuotesForClipboard(quotes: QuoteCard[] = []) {
  return quotes
    .map((quote, index) => `${index + 1}. "${normalizeText(quote.quote)}"\n${formatCitationLabel(quote)}`)
    .join("\n\n");
}

export function formatWardNote(answer: RagAnswer, demoMode = false) {
  const clinicalSections = buildClinicalOutputSections(answer);
  const bottomLine = bottomLineForOutput(answer, clinicalSections);
  const highYieldSections = highYieldSectionsForOutput(answer, bottomLine);
  const generatedAt = new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Australia/Perth",
    timeZoneName: "short",
  }).format(new Date());
  return compactOutputDocument([
    "Source-backed clinical draft",
    "Verify against linked source documents before clinical use.",
    demoMode ? "Synthetic demo only: not clinical guidance." : "Generated only from indexed source documents.",
    `Generated: ${generatedAt}`,
    "",
    "Bottom line",
    `- ${bottomLine}`,
    "",
    ...highYieldSections.flatMap(sectionOutputLines),
    "Citations",
    ...citationOutputLines(answer),
    "",
    "Source status",
    ...sourceStatusOutputLines(answer),
    "",
    "Review requirement",
    clinicalReviewRequirement,
  ]);
}

export function createQuoteFollowUp(quote: QuoteCard) {
  return `Using the quoted source from ${quote.title}, page ${quote.page_number ?? "n/a"}, what is the practical clinical answer? Quote: "${normalizeText(quote.quote)}"`;
}

export function shouldPollForUpdates(
  demoMode: boolean,
  visibilityState: DocumentVisibilityState | "visible" | "hidden",
  hasActiveWork = true,
) {
  return hasActiveWork && !demoMode && visibilityState === "visible";
}
