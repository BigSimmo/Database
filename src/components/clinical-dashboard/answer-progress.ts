import type { PublicAnswerProgressEvent, PublicAnswerProgressStage } from "@/lib/answer-progress-public";
import { isDeliverableVerifiedUnit } from "@/lib/answer-stream-contract";

export type AnswerProgressUpdate = PublicAnswerProgressEvent;
export type TimedAnswerProgressUpdate = AnswerProgressUpdate & { receivedAt: number };

const answerProgressStages = new Set<PublicAnswerProgressStage>([
  "scoping",
  "retrieving",
  "retrieved",
  "ranking",
  "generating",
  "retrying",
  "fallback",
  "verifying",
  "cached",
  "complete",
]);

function inferLegacyStage(message: string): PublicAnswerProgressStage {
  if (/\b(?:scope|prepar)/i.test(message)) return "scoping";
  if (/\b(?:search|retriev|indexed documents?)/i.test(message)) return "retrieving";
  if (/\b(?:rank|select|australian|evidence)/i.test(message)) return "ranking";
  if (/\b(?:fallback|source-backed|source based)/i.test(message)) return "fallback";
  if (/\b(?:retry|revis)/i.test(message)) return "retrying";
  if (/\b(?:draft|generat|answer route)/i.test(message)) return "generating";
  if (/\b(?:check|verif|citation|finaliz)/i.test(message)) return "verifying";
  if (/\bcach/i.test(message)) return "cached";
  if (/\bready|complete/i.test(message)) return "complete";
  return "retrieving";
}

function finiteCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : undefined;
}

export function normalizeAnswerProgressEvent(
  data: unknown,
  lastVerifiedUnitSequence: number | null = null,
): AnswerProgressUpdate | null {
  if (typeof data === "string" && data.trim()) {
    const message = data.trim();
    return { stage: inferLegacyStage(message), message };
  }
  if (!data || typeof data !== "object") return null;

  const value = data as Record<string, unknown>;
  const message = typeof value.message === "string" && value.message.trim() ? value.message.trim() : "";
  if (!message) return null;
  const stage =
    typeof value.stage === "string" && answerProgressStages.has(value.stage as PublicAnswerProgressStage)
      ? (value.stage as PublicAnswerProgressStage)
      : inferLegacyStage(message);
  const verifiedUnit = isDeliverableVerifiedUnit(value.verifiedUnit, lastVerifiedUnitSequence)
    ? value.verifiedUnit
    : undefined;

  return {
    stage,
    message,
    ...(verifiedUnit === undefined ? {} : { verifiedUnit }),
    resultCount: finiteCount(value.resultCount),
    selectedContextCount: finiteCount(value.selectedContextCount),
    australianSourceCount: finiteCount(value.australianSourceCount),
    waSourceCount: finiteCount(value.waSourceCount),
    elapsedMs: finiteCount(value.elapsedMs),
  };
}

export function answerProgressStepIndex(stage: PublicAnswerProgressStage) {
  if (stage === "scoping") return 0;
  if (stage === "retrieving" || stage === "retrieved") return 1;
  if (stage === "ranking") return 2;
  if (stage === "generating" || stage === "retrying" || stage === "fallback") return 3;
  return 4;
}

/** UI copy is derived from the public stage/counts and never from an incoming message.
 *
 * Written for a single quiet line rather than a stepper panel, so each string is
 * a clause the reader can take in at a glance while waiting. Two rules hold it
 * together:
 *
 *  - **One noun per stage.** Retrieval counts *passages* (`resultCount`, every
 *    candidate chunk) and selection counts *sources* (the trimmed documents the
 *    rail actually shows). Those are different numbers, and using one word for
 *    both is how a reader ends up believing 24 documents are behind an answer
 *    that cites three.
 *  - **The unusual route says so while it is happening.** `fallback` means the
 *    answer is being assembled without the model, which on the only measurement
 *    in the handover was the majority case. The wait is the honest place to set
 *    that expectation — not the answer, which would then have to defend it.
 */
export function answerProgressDisplayMessage(progress: AnswerProgressUpdate) {
  if (progress.stage === "scoping") return "Reading your question\u2026";
  if (progress.stage === "retrieving" || progress.stage === "retrieved") {
    return progress.resultCount === undefined
      ? "Searching your documents\u2026"
      : `Searching your documents \u00b7 ${progress.resultCount} passage${progress.resultCount === 1 ? "" : "s"} found`;
  }
  if (progress.stage === "ranking") {
    if (progress.australianSourceCount) {
      const waDetail = progress.waSourceCount ? `, ${progress.waSourceCount} from WA` : "";
      return `Prioritising ${progress.australianSourceCount} Australian source${progress.australianSourceCount === 1 ? "" : "s"}${waDetail}`;
    }
    return "Selecting the most relevant passages\u2026";
  }
  if (progress.stage === "retrying") return "Revising the draft against the evidence\u2026";
  if (progress.stage === "fallback") return "Assembling the answer from the sources directly\u2026";
  if (progress.stage === "generating") return "Writing the answer\u2026";
  if (progress.stage === "verifying") return "Checking citations and clinical numbers\u2026";
  if (progress.stage === "cached") return "Loading a recent cited answer\u2026";
  return "Answer ready.";
}

/** The stages worth disclosing after the fact.
 *
 * A routine answer has nothing to explain — scope, search, select, write, check,
 * in that order, every time — which is why the old Processing details disclosure
 * held the same five lines for every question and nobody opened it. These three
 * stages mean the answer did NOT take the ordinary route, and that is worth a
 * reader being able to read back. */
const disclosableStages = new Set<PublicAnswerProgressStage>(["retrying", "fallback", "cached"]);

export function answerProgressTookUnusualRoute(events: readonly AnswerProgressUpdate[]) {
  return events.some((event) => disclosableStages.has(event.stage));
}
