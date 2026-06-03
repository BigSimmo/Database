import { formatCitationLabel } from "@/lib/citations";
import { clipboardProvenanceLine } from "@/lib/source-metadata";
import type { QuoteCard, RagAnswer, VisualEvidenceCard } from "@/lib/types";

export type ClinicalOutputSectionId = "action" | "monitoring" | "thresholds" | "escalation" | "verify-source";

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

const actionPattern =
  /\b(action|start|stop|hold|withhold|cease|avoid|review|assess|check|refer|discuss|required|must|should)\b/i;
const escalationPattern =
  /\b(escalat|urgent|senior|review|risk|intent|attempt|agitation|supervision|toxicity|vomiting|diarrhoea|dehydration|tremor|confusion|ataxia|fever|chest pain|dyspnoea|seizure|constipation)\b/i;
const monitoringPattern =
  /\b(monitor|check|baseline|fbc|anc|renal|thyroid|calcium|metabolic|myocarditis|blood pressure|weight|level|schedule)\b/i;
const thresholdPattern =
  /\b(threshold|cut[\s-]?off|withhold|cease|stop|hold|discontinue|anc|fbc|wbc|neutrophil|level|range|criteria|score|rating|below|above|less than|greater than|mmol|mg\/l|x\s*10)\b|[<>]=?|[≤≥]/i;

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function uniqueShortItems(items: string[], limit: number) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const item of items.map(normalizeText).filter(Boolean)) {
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
    if (!thresholdPattern.test(visualEvidenceText(card))) continue;

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

export function buildClinicalOutputSections(answer: RagAnswer | null | undefined) {
  if (!answer) return [];

  const sectionBodies = answer.answerSections?.map((section) => section.body) ?? [];
  const quoteTexts = answer.quoteCards?.map((quote) => quote.quote) ?? [];
  const combined = [...sectionBodies, ...quoteTexts, answer.answer];

  const actionSource = sectionBodies.length
    ? sectionBodies.filter((item) => actionPattern.test(item) || !monitoringPattern.test(item))
    : [answer.answer];
  const actions = uniqueShortItems(actionSource.length ? actionSource : [answer.answer], 3);
  const monitoring = uniqueShortItems(
    combined.filter((item) => monitoringPattern.test(item)),
    4,
  );
  const thresholdItems = uniqueShortItems(
    combined.filter((item) => thresholdPattern.test(item)),
    4,
  );
  const thresholdTables = buildThresholdTables(answer);
  const escalation = uniqueShortItems(
    combined.filter((item) => escalationPattern.test(item)),
    4,
  );
  const verifySource = buildVerifySourceItems(answer);

  const sections: ClinicalOutputSection[] = [];
  sections.push({
    id: "action",
    title: "Action",
    items: actions.length ? actions : ["Use the source-backed answer as the starting action and verify citations first."],
  });
  sections.push({
    id: "monitoring",
    title: "Monitoring",
    items: monitoring.length ? monitoring : ["No explicit monitoring schedule was extracted from the answer or quotes."],
  });
  sections.push({
    id: "thresholds",
    title: "Thresholds",
    items: thresholdItems.length ? thresholdItems : ["No explicit numeric threshold or table row was extracted."],
    tables: thresholdTables,
  });
  sections.push({
    id: "escalation",
    title: "Escalation",
    items: escalation.length ? escalation : ["No explicit escalation trigger was extracted from the answer or quotes."],
  });
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
