import { formatCitationLabel } from "@/lib/citations";
import { parseAnswerDisplayContent, type AnswerDisplayGroup } from "@/lib/answer-formatting";
import { clipboardProvenanceLine } from "@/lib/source-metadata";
import { isLowYieldClinicalText, sourceTextForClinicalProse } from "@/lib/source-text-sanitizer";
import type { AnswerSectionKind, QuoteCard, RagAnswer, VisualEvidenceCard } from "@/lib/types";

export type ClinicalOutputSectionId =
  | "bottom-line"
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
  sourceLabel?: string;
};

export type ClinicalOutputSection = {
  id: ClinicalOutputSectionId;
  title: string;
  items: string[];
  tables?: ClinicalThresholdTable[];
};

const thresholdPattern =
  /\b(thresholds?|cut[\s-]?offs?|withhold|cease|stop|hold|discontinue|anc|fbc|wbc|neutrophils?|levels?|ranges?|criteria|scores?|ratings?|below|above|less than|greater than|mmol|mg\/l|x\s*10)\b|[<>]=?|[≤≥]/i;

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeClinicalItem(text: string) {
  return normalizeText(sourceTextForClinicalProse(text));
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

  for (const item of items.map(normalizeClinicalItem).filter(Boolean)) {
    if (isLowYieldClinicalText(item)) continue;
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
  if (isLowYieldClinicalText(item)) return false;
  const query = answer.smartPanel?.query ?? "";
  if (query && !hasSharedClinicalToken(query, item)) return false;
  if (query && !hasRequiredMedicationMatch(query, item)) return false;
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
    caption: [card.tableLabel, card.tableTitle].filter(Boolean).join(": ") || card.caption,
    markdown,
    rows: card.tableRows,
    columns: card.tableColumns,
    sourceLabel: `${card.title}, page ${card.page_number ?? "n/a"}`,
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
        ? `${citationCount} linked citation${citationCount === 1 ? "" : "s"} available for source verification.`
        : "No linked citations were returned for this answer.",
      quoteCount
        ? `${quoteCount} exact source quote${quoteCount === 1 ? "" : "s"} available before clinical use.`
        : "No exact source quote was returned; verify the answer against the source document.",
      sourceStrength && sourceStrength !== "none" ? `Strongest retrieved source support: ${sourceStrength}.` : "",
      answer.confidence === "unsupported"
        ? "Treat as unsupported: do not use clinically without opening and checking source text."
        : "Open the cited source passage before copying into the medical record.",
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
  if (isLowYieldClinicalText(`${section.heading}. ${section.body}`)) return false;
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
      return parseAnswerDisplayContent(`${label}: ${section.body}`).lines;
    });
}

export function buildClinicalOutputSections(answer: RagAnswer | null | undefined) {
  if (!answer) return [];

  const answerContent = parseAnswerDisplayContent(answer.answer);
  const answerLead = answerContent.lead ?? answerContent.lines[0];
  const answerDetailLines = answerContent.lines.filter((line) => line.id !== answerLead?.id);
  const parsedLines = [...answerDetailLines, ...sectionDisplayLines(answer)];
  const quoteTexts = answer.quoteCards?.map((quote) => quote.quote) ?? [];
  const allTexts = [...parsedLines.map((line) => line.text), ...quoteTexts];
  const thresholdTables = buildThresholdTables(answer);
  const thresholdItems = uniqueShortItems(
    allTexts.filter((item) => thresholdPattern.test(item) && isPromotableThresholdItem(item, answer)),
    4,
  );
  const verifySource = buildVerifySourceItems(answer);

  const sections: ClinicalOutputSection[] = [];
  if (answerLead?.text) {
    sections.push({
      id: answerLead.group === "gap" ? "source-gap" : "bottom-line",
      title: answerLead.group === "gap" ? "Source gap" : "Bottom line",
      items: uniqueShortItems([answerLead.text], 1),
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
    sections.push({ ...section, items });
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

  sections.push({
    id: "verify-source",
    title: "Verify source",
    items: verifySource,
  });

  return sections;
}

export function formatAnswerForClipboard(answer: RagAnswer) {
  const citations = answer.citations.map((citation, index) => `${index + 1}. ${formatCitationLabel(citation)}`);
  const provenance = answer.citations.map(
    (citation, index) =>
      `${index + 1}. ${formatCitationLabel(citation)} | ${clipboardProvenanceLine(citation.source_metadata)}`,
  );
  return [
    "Source-backed answer draft",
    "Clinician must verify against linked source documents before clinical use.",
    "",
    normalizeText(answer.answer),
    citations.length ? "\nCitations" : "",
    ...citations,
    provenance.length ? "\nSource status" : "",
    ...provenance,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatQuotesForClipboard(quotes: QuoteCard[] = []) {
  return quotes
    .map((quote, index) => `${index + 1}. "${normalizeText(quote.quote)}"\n${formatCitationLabel(quote)}`)
    .join("\n\n");
}

export function formatWardNote(answer: RagAnswer, demoMode = false) {
  const clinicalSections = buildClinicalOutputSections(answer);
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
  const sourceStatus = answer.citations.map(
    (citation, index) =>
      `${index + 1}. ${formatCitationLabel(citation)} | ${clipboardProvenanceLine(citation.source_metadata)}`,
  );
  const body = [
    "Source-backed clinical draft",
    "Clinician must verify against linked source documents before clinical use.",
    demoMode ? "Synthetic demo only: not clinical guidance." : "Generated only from indexed source documents.",
    `Generated: ${generatedAt}`,
    "",
    normalizeText(answer.answer),
    "",
    ...clinicalSections.flatMap((section) => [section.title, ...section.items.map((item) => `- ${item}`), ""]),
    "Citations",
    ...answer.citations.map((citation, index) => `${index + 1}. ${formatCitationLabel(citation)}`),
    "",
    "Source status",
    ...sourceStatus,
    "",
    "Review requirement",
    "This is a draft for clinician review only. Verify source text, source status, local policy, patient context, and medication details before use.",
  ];

  return body
    .filter((line, index, lines) => line || lines[index - 1])
    .join("\n")
    .trim();
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
