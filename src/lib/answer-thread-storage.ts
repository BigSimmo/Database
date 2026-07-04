import type { RagAnswer, SearchResult } from "@/lib/types";

export const answerThreadStorageKey = "clinical-kb-answer-thread";

export type StoredAnswerTurn = {
  id: string;
  query: string;
  answer: RagAnswer;
  sources: SearchResult[];
};

export type PersistedAnswerThread = {
  version: 1;
  priorTurns: StoredAnswerTurn[];
  latestTurn: Omit<StoredAnswerTurn, "id"> | null;
  collapsedTurnIds: string[];
};

const maxStoredTurns = 12;
const maxStorageBytes = 4_500_000;

function isStoredAnswerTurn(value: unknown): value is StoredAnswerTurn {
  if (!value || typeof value !== "object") return false;
  const turn = value as StoredAnswerTurn;
  return (
    typeof turn.id === "string" &&
    typeof turn.query === "string" &&
    Boolean(turn.query.trim()) &&
    Boolean(turn.answer) &&
    typeof turn.answer === "object" &&
    typeof turn.answer.answer === "string" &&
    Array.isArray(turn.sources)
  );
}

function normalizePersistedAnswerThread(value: unknown): PersistedAnswerThread | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<PersistedAnswerThread>;
  if (record.version !== 1) return null;
  const priorTurns = Array.isArray(record.priorTurns)
    ? record.priorTurns.filter(isStoredAnswerTurn).slice(-maxStoredTurns)
    : [];
  const latestTurn =
    record.latestTurn &&
    typeof record.latestTurn === "object" &&
    typeof record.latestTurn.query === "string" &&
    Boolean(record.latestTurn.query.trim()) &&
    record.latestTurn.answer &&
    typeof record.latestTurn.answer.answer === "string" &&
    Array.isArray(record.latestTurn.sources)
      ? {
          query: record.latestTurn.query,
          answer: record.latestTurn.answer,
          sources: record.latestTurn.sources,
        }
      : null;
  const collapsedTurnIds = Array.isArray(record.collapsedTurnIds)
    ? record.collapsedTurnIds.filter((id): id is string => typeof id === "string")
    : priorTurns.map((turn) => turn.id);
  if (!priorTurns.length && !latestTurn) return null;
  return {
    version: 1,
    priorTurns,
    latestTurn,
    collapsedTurnIds,
  };
}

export function loadPersistedAnswerThread(): PersistedAnswerThread | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(answerThreadStorageKey);
    if (!raw) return null;
    return normalizePersistedAnswerThread(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function savePersistedAnswerThread(thread: PersistedAnswerThread): boolean {
  if (typeof window === "undefined") return false;
  try {
    const payload: PersistedAnswerThread = {
      version: 1,
      priorTurns: thread.priorTurns.slice(-maxStoredTurns),
      latestTurn: thread.latestTurn,
      collapsedTurnIds: thread.collapsedTurnIds,
    };
    const serialized = JSON.stringify(payload);
    if (serialized.length > maxStorageBytes) return false;
    window.localStorage.setItem(answerThreadStorageKey, serialized);
    return true;
  } catch {
    return false;
  }
}

export function clearPersistedAnswerThread() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(answerThreadStorageKey);
  } catch {
    // Thread persistence is a convenience only.
  }
}
