import type { PublicAnswerProgressEvent, PublicAnswerProgressStage } from "@/lib/answer-progress-public";

export type AnswerProgressUpdate = PublicAnswerProgressEvent;
export type TimedAnswerProgressUpdate = AnswerProgressUpdate & { receivedAt: number };

export const answerProgressSteps = [
  { label: "Prepare scope", stage: "scoping" },
  { label: "Search sources", stage: "retrieving" },
  { label: "Select evidence", stage: "ranking" },
  { label: "Draft answer", stage: "generating" },
  { label: "Check answer", stage: "verifying" },
] as const;

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

export function normalizeAnswerProgressEvent(data: unknown): AnswerProgressUpdate | null {
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

  return {
    stage,
    message,
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

/** UI copy is derived from the public stage/counts and never from an incoming message. */
export function answerProgressDisplayMessage(progress: AnswerProgressUpdate) {
  if (progress.stage === "scoping") return "Preparing the clinical search scope.";
  if (progress.stage === "retrieved" && progress.resultCount !== undefined) {
    return `Found ${progress.resultCount} candidate source passage${progress.resultCount === 1 ? "" : "s"}.`;
  }
  if (progress.stage === "retrieving" || progress.stage === "retrieved") {
    return "Searching indexed clinical documents.";
  }
  if (progress.stage === "ranking") {
    if (progress.australianSourceCount) {
      const waDetail = progress.waSourceCount ? `, including ${progress.waSourceCount} WA` : "";
      return `Prioritising ${progress.australianSourceCount} Australian source passage${progress.australianSourceCount === 1 ? "" : "s"}${waDetail}.`;
    }
    return "Selecting the most relevant source passages.";
  }
  if (progress.stage === "retrying") {
    return "The draft needs another pass; revising it against the evidence.";
  }
  if (progress.stage === "fallback") {
    return "Building a source-backed answer from the selected passages.";
  }
  if (progress.stage === "generating") return "Drafting a cited answer from the selected passages.";
  if (progress.stage === "verifying") return "Checking citations, clinical numbers, and source metadata.";
  if (progress.stage === "cached") return "Loading a recent cited answer.";
  return "Answer ready.";
}
