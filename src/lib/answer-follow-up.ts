import type { RagAnswer } from "@/lib/types";

// Client-side follow-up context for the single-query answer API.
// The /api/answer/stream schema accepts one query string (max 2000 chars), so
// a short conversational follow-up ("what about renal impairment?") loses the
// topic established by the previous turn. Rather than extending the API with a
// messages/history payload, the client wraps ambiguous follow-ups with the
// prior question so retrieval still sees the topic terms.

/** Matches the z.string().max(2000) limit in src/app/api/answer/stream/route.ts. */
const answerQueryMaxLength = 2000;

/**
 * A follow-up at or above this length is treated as self-contained: users who
 * type a full clinical question almost always restate the topic, and wrapping
 * long questions dilutes retrieval with the previous query's terms.
 */
const selfContainedFollowUpLength = 80;

const followUpCuePattern =
  /\b(what about|how about|and (?:for|in|with|the)|also|too\??$|same (?:for|with)|instead|as well|it\b|they\b|them\b|this\b|that\b|those\b|these\b)\b/i;

function significantTokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? []).filter(
    (token) => !["what", "when", "where", "which", "about", "does", "should", "would", "could"].includes(token),
  );
}

/**
 * True when the follow-up already names the prior topic (shares a significant
 * token with the previous question), so no wrapping is needed.
 */
function followUpRestatesTopic(priorQuery: string, followUp: string): boolean {
  const priorTokens = new Set(significantTokens(priorQuery));
  if (priorTokens.size === 0) return false;
  return significantTokens(followUp).some((token) => priorTokens.has(token));
}

/**
 * Build the query text sent to the answer API for a follow-up turn.
 *
 * Returns the follow-up unchanged when there is no prior question, when the
 * follow-up is long enough to be self-contained, or when it already restates
 * the prior topic. Otherwise prepends the prior question so single-query
 * retrieval keeps the conversation's subject.
 */
export function buildAnswerFollowUpQuery(priorQuery: string | undefined, followUp: string): string {
  const trimmedFollowUp = followUp.trim();
  const trimmedPrior = priorQuery?.trim();
  if (!trimmedPrior || !trimmedFollowUp) return trimmedFollowUp;
  if (trimmedFollowUp.length >= selfContainedFollowUpLength) return trimmedFollowUp;
  if (followUpRestatesTopic(trimmedPrior, trimmedFollowUp)) return trimmedFollowUp;
  // Only wrap when the follow-up reads like a continuation; a short but
  // complete question on a new topic should be searched as-is.
  if (!followUpCuePattern.test(trimmedFollowUp)) return trimmedFollowUp;

  const wrapped = `Follow-up to "${trimmedPrior}": ${trimmedFollowUp}`;
  if (wrapped.length <= answerQueryMaxLength) return wrapped;
  // Keep the follow-up intact and truncate the prior-question context instead.
  const budget = answerQueryMaxLength - `Follow-up to "": ${trimmedFollowUp}`.length;
  if (budget <= 0) return trimmedFollowUp.slice(0, answerQueryMaxLength);
  return `Follow-up to "${trimmedPrior.slice(0, budget)}": ${trimmedFollowUp}`;
}

const maxFollowUpSuggestions = 4;

function normalizeSuggestionKey(value: string) {
  return value.trim().toLowerCase();
}

function topicLabel(priorQuery: string, answer: RagAnswer) {
  const medications = answer.queryAnalysis?.medications ?? [];
  const medication = medications.find((item) => item.trim());
  if (medication) return medication.trim();
  const trimmed = priorQuery.trim();
  if (!trimmed) return "this topic";
  return trimmed.length > 48 ? `${trimmed.slice(0, 45).trimEnd()}…` : trimmed;
}

function medicationFollowUpTemplates(topic: string) {
  return [
    "What about renal impairment?",
    "What monitoring is required?",
    "What are the elderly dosing considerations?",
    "What about pregnancy or breastfeeding?",
    "Are there important drug interactions?",
    `What cautions apply to ${topic}?`,
  ];
}

function thresholdFollowUpTemplates(topic: string) {
  return [
    "What should trigger escalation?",
    "What are the alternative thresholds?",
    `When should I repeat ${topic}?`,
    "What monitoring supports this threshold?",
  ];
}

function comparisonFollowUpTemplates(topic: string) {
  return [
    "Which option is preferred in pregnancy?",
    "Which option needs less monitoring?",
    `What are the key differences for ${topic}?`,
    "When would you choose the alternative?",
  ];
}

function genericFollowUpTemplates(topic: string) {
  return [
    `What monitoring is required for ${topic}?`,
    `What are the main cautions for ${topic}?`,
    `What should I document for ${topic}?`,
    "What would change the management plan?",
  ];
}

function templatesForAnswer(priorQuery: string, answer: RagAnswer) {
  const topic = topicLabel(priorQuery, answer);
  const queryClass = answer.queryClass ?? answer.queryAnalysis?.queryClass;
  if (queryClass === "medication_dose_risk" || /\b(dose|dosing|mg|monitor|medication|drug)\b/i.test(priorQuery)) {
    return medicationFollowUpTemplates(topic);
  }
  if (queryClass === "table_threshold" || /\b(threshold|level|cut[- ]?off|range)\b/i.test(priorQuery)) {
    return thresholdFollowUpTemplates(topic);
  }
  if (queryClass === "comparison" || answer.queryAnalysis?.comparisonIntent) {
    return comparisonFollowUpTemplates(topic);
  }
  if (queryClass === "document_lookup" || answer.queryAnalysis?.documentTitleIntent) {
    return [
      "What are the key action points?",
      "What monitoring or follow-up is documented?",
      "Are there any contraindications noted?",
      `Summarise the practical steps for ${topic}.`,
    ];
  }
  return genericFollowUpTemplates(topic);
}

function gapFollowUpTemplates(answer: RagAnswer) {
  const gaps = answer.conflictsOrGaps ?? answer.smartPanel?.conflictsOrGaps ?? [];
  return gaps
    .map((gap) => gap.message.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((message) => {
      const cleaned = message.replace(/\.$/, "");
      return cleaned.endsWith("?") ? cleaned : `What does the source say about ${cleaned.toLowerCase()}?`;
    });
}

/**
 * Build short follow-up question chips for the latest answer turn.
 * Suggestions avoid repeating questions already asked in the thread.
 */
export function buildAnswerFollowUpSuggestions(
  priorQuery: string,
  answer: RagAnswer,
  priorQueries: string[] = [],
): string[] {
  const trimmedPrior = priorQuery.trim();
  if (!trimmedPrior) return [];

  const seen = new Set(priorQueries.map(normalizeSuggestionKey));
  seen.add(normalizeSuggestionKey(trimmedPrior));

  const suggestions: string[] = [];
  for (const candidate of [...gapFollowUpTemplates(answer), ...templatesForAnswer(trimmedPrior, answer)]) {
    const normalized = normalizeSuggestionKey(candidate);
    if (!normalized || seen.has(normalized)) continue;
    if (suggestions.some((item) => normalizeSuggestionKey(item) === normalized)) continue;
    suggestions.push(candidate);
    seen.add(normalized);
    if (suggestions.length >= maxFollowUpSuggestions) break;
  }
  return suggestions;
}
