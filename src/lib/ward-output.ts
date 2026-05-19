import { formatCitationLabel } from "@/lib/citations";
import type { QuoteCard, RagAnswer } from "@/lib/types";

export type ClinicalOutputSection = {
  id: "key-actions" | "monitoring-checklist" | "escalation-triggers";
  title: string;
  items: string[];
};

const escalationPattern =
  /\b(escalat|urgent|senior|review|risk|intent|attempt|agitation|supervision|toxicity|vomiting|diarrhoea|dehydration|tremor|confusion|ataxia|fever|chest pain|dyspnoea|seizure|constipation)\b/i;
const monitoringPattern =
  /\b(monitor|check|baseline|fbc|anc|renal|thyroid|calcium|metabolic|myocarditis|blood pressure|weight|level|schedule)\b/i;

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

export function buildClinicalOutputSections(answer: RagAnswer | null | undefined) {
  if (!answer) return [];

  const sectionBodies = answer.answerSections?.map((section) => section.body) ?? [];
  const quoteTexts = answer.quoteCards?.map((quote) => quote.quote) ?? [];
  const combined = [...sectionBodies, ...quoteTexts];

  const keyActions = uniqueShortItems(sectionBodies.length ? sectionBodies : [answer.answer], 3);
  const monitoring = uniqueShortItems(
    combined.filter((item) => monitoringPattern.test(item)),
    4,
  );
  const escalation = uniqueShortItems(
    combined.filter((item) => escalationPattern.test(item)),
    4,
  );

  const sections: ClinicalOutputSection[] = [];
  if (keyActions.length) sections.push({ id: "key-actions", title: "Key actions", items: keyActions });
  if (monitoring.length) {
    sections.push({ id: "monitoring-checklist", title: "Monitoring checklist", items: monitoring });
  }
  if (escalation.length) {
    sections.push({ id: "escalation-triggers", title: "Escalation triggers", items: escalation });
  }

  return sections;
}

export function formatAnswerForClipboard(answer: RagAnswer) {
  const citations = answer.citations.map((citation, index) => `${index + 1}. ${formatCitationLabel(citation)}`);
  return [
    "Answer",
    normalizeText(answer.answer),
    citations.length ? "\nCitations" : "",
    ...citations,
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
  const body = [
    "Source-backed ward note",
    "Review before pasting into the medical record.",
    demoMode ? "Synthetic demo only: not clinical guidance." : "Generated only from indexed source documents.",
    "",
    normalizeText(answer.answer),
    "",
    ...clinicalSections.flatMap((section) => [
      section.title,
      ...section.items.map((item) => `- ${item}`),
      "",
    ]),
    "Citations",
    ...answer.citations.map((citation, index) => `${index + 1}. ${formatCitationLabel(citation)}`),
  ];

  return body.filter((line, index, lines) => line || lines[index - 1]).join("\n").trim();
}

export function createQuoteFollowUp(quote: QuoteCard) {
  return `Using the quoted source from ${quote.title}, page ${quote.page_number ?? "n/a"}, what is the practical clinical answer? Quote: "${normalizeText(quote.quote)}"`;
}

export function shouldPollForUpdates(demoMode: boolean, visibilityState: DocumentVisibilityState | "visible" | "hidden") {
  return !demoMode && visibilityState === "visible";
}
