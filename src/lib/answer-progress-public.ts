export type PublicAnswerProgressStage =
  | "scoping"
  | "retrieving"
  | "retrieved"
  | "ranking"
  | "generating"
  | "retrying"
  | "fallback"
  | "verifying"
  | "cached"
  | "complete";

export type PublicAnswerProgressEvent = {
  stage: PublicAnswerProgressStage;
  message: string;
  resultCount?: number;
  selectedContextCount?: number;
  australianSourceCount?: number;
  waSourceCount?: number;
  elapsedMs?: number;
};

function safeProgressNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : undefined;
}

/** Convert internal RAG progress into the minimal, stable DTO allowed at the browser boundary. */
export function toPublicAnswerProgressEvent(event: unknown): PublicAnswerProgressEvent | null {
  if (!event || typeof event !== "object") return null;
  const value = event as Record<string, unknown>;
  const resultCount = safeProgressNumber(value.resultCount);
  const selectedContextCount = safeProgressNumber(value.selectedContextCount);
  const australianSourceCount = safeProgressNumber(value.australianSourceCount);
  const waSourceCount = safeProgressNumber(value.waSourceCount);
  const elapsedMs = safeProgressNumber(value.elapsedMs);

  let stage: PublicAnswerProgressStage;
  let message: string;
  switch (value.stage) {
    case "scoping":
      stage = "scoping";
      message = "Preparing the clinical search scope.";
      break;
    case "retrieving":
      stage = "retrieving";
      message = "Searching indexed clinical documents.";
      break;
    case "retrieved":
      stage = "retrieved";
      message =
        resultCount === undefined
          ? "Source passages found."
          : `Found ${resultCount} candidate source passage${resultCount === 1 ? "" : "s"}.`;
      break;
    case "ranking":
    case "routing":
      stage = "ranking";
      message = "Selecting the most relevant source passages.";
      break;
    case "generating":
      stage = "generating";
      message = "Drafting a cited answer from the selected passages.";
      break;
    case "retrying":
      stage = "retrying";
      message = "The draft needs another pass; revising it against the evidence.";
      break;
    case "fallback":
      stage = "fallback";
      message = "Building a source-backed answer from the selected passages.";
      break;
    case "verifying":
    case "finalizing":
      stage = "verifying";
      message = "Checking citations, clinical numbers, and source metadata.";
      break;
    case "cached":
      stage = "cached";
      message = "Loading a recent cited answer.";
      break;
    case "complete":
      stage = "complete";
      message = "Answer ready.";
      break;
    default:
      return null;
  }

  return {
    stage,
    message,
    ...(resultCount === undefined ? {} : { resultCount }),
    ...(selectedContextCount === undefined ? {} : { selectedContextCount }),
    ...(australianSourceCount === undefined ? {} : { australianSourceCount }),
    ...(waSourceCount === undefined ? {} : { waSourceCount }),
    ...(elapsedMs === undefined ? {} : { elapsedMs }),
  };
}
