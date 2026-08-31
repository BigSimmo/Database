import type { AppModeId } from "@/lib/app-modes";
import { isClinicalAskModeId } from "@/lib/clinical-ask/contracts";

export type SmartSearchSubmissionIntent = "search" | "clinical-ask";

const explicitLookupPattern = /^(?:find|search|look\s*up|lookup|show|open|browse)\b/i;
const compactCodePattern = /^(?:form\s+)?[a-z]{0,4}\s*\d{1,3}(?:\.\d+)?[a-z]?$/i;
const questionLeadPattern = /^(?:what|which|when|where|why|how|who|can|could|should|would|is|are|do|does|did)\b/i;
const synthesisCuePattern =
  /\b(?:best|recommend(?:ed|ation)?|appropriate|consider|next steps?|options?|approach|distinguish|compare|formulat(?:e|ion)|fit|most likely)\b/i;
const caseSubjectPattern =
  /\b(?:patient|person|client|consumer|presentation|symptoms?|features?|condition|episode|risk|impairment|course|response|they|them|their|he|him|his|she|her|this case)\b/i;
const caseStateVerbPattern =
  /\b(?:is|are|was|were|has|have|had|presents?|presented|reports?|reported|experiences?|experienced|shows?|showed|remains?|remained|worsens?|worsened|improves?|improved|persists?|persisted|continues?|continued|meets?|met|denies?|denied|needs?|needed|requires?|required)\b/i;

function lexicalTokens(value: string): string[] {
  return value.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [];
}

/**
 * Resolves what Enter means without provider access.
 *
 * Explicit lookups, compact catalogue codes, terse phrases, and unsupported
 * modes retain deterministic search. Supported modes use Clinical Ask only for
 * clear questions or sufficiently developed synthesis/case statements.
 */
export function resolveSmartSearchSubmissionIntent(modeId: AppModeId, query: string): SmartSearchSubmissionIntent {
  const trimmed = query.trim();
  if (!trimmed || !isClinicalAskModeId(modeId)) return "search";
  if (explicitLookupPattern.test(trimmed)) return "search";

  const withoutTerminalPunctuation = trimmed.replace(/[?!.,;:]+$/u, "").trim();
  if (compactCodePattern.test(withoutTerminalPunctuation)) return "search";

  if (questionLeadPattern.test(trimmed) || trimmed.endsWith("?")) return "clinical-ask";

  const developedStatement = lexicalTokens(trimmed).length >= 6;
  const explicitCaseState = caseSubjectPattern.test(trimmed) && caseStateVerbPattern.test(trimmed);
  return developedStatement && (synthesisCuePattern.test(trimmed) || explicitCaseState) ? "clinical-ask" : "search";
}

export function smartSearchUsesClinicalAsk(modeId: AppModeId, query: string): boolean {
  return resolveSmartSearchSubmissionIntent(modeId, query) === "clinical-ask";
}
