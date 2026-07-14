import type { RagAnswer, SearchResult } from "@/lib/types";

export const answerThreadStorageKey = "clinical-kb-answer-thread";
export const maxStoredAnswerTurns = 12;
// sessionStorage already dies with the tab, but long-lived clinical-workstation
// tabs can idle for days; bound how long raw query/answer text stays restorable.
export const answerThreadTtlMs = 12 * 60 * 60 * 1000;

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

// Stored envelope = the thread plus a write timestamp. savedAt stays internal to
// this module: loads strip it after the TTL check so callers round-trip the
// plain PersistedAnswerThread shape. Payloads written before the TTL existed
// have no savedAt and are accepted once; the next save stamps them.
type PersistedAnswerThreadEnvelope = PersistedAnswerThread & { savedAt?: number };

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
  const record = value as Partial<PersistedAnswerThreadEnvelope>;
  if (record.version !== 1) return null;
  if (
    typeof record.savedAt === "number" &&
    Number.isFinite(record.savedAt) &&
    Date.now() - record.savedAt > answerThreadTtlMs
  ) {
    return null;
  }
  const priorTurns = Array.isArray(record.priorTurns)
    ? record.priorTurns.filter(isStoredAnswerTurn).slice(-maxStoredAnswerTurns)
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

function scopedStorageKey(ownerId: string) {
  return `${answerThreadStorageKey}:${ownerId}`;
}

export function loadPersistedAnswerThread(ownerId: string): PersistedAnswerThread | null {
  if (typeof window === "undefined" || !ownerId) return null;
  try {
    const raw = window.sessionStorage.getItem(scopedStorageKey(ownerId));
    if (!raw) return null;
    return normalizePersistedAnswerThread(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function savePersistedAnswerThread(ownerId: string, thread: PersistedAnswerThread): boolean {
  if (typeof window === "undefined" || !ownerId) return false;
  try {
    const payload: PersistedAnswerThreadEnvelope = {
      version: 1,
      priorTurns: thread.priorTurns.slice(-maxStoredAnswerTurns),
      latestTurn: thread.latestTurn,
      collapsedTurnIds: thread.collapsedTurnIds,
      savedAt: Date.now(),
    };
    const serialized = JSON.stringify(payload);
    if (serialized.length > maxStorageBytes) return false;
    window.sessionStorage.setItem(scopedStorageKey(ownerId), serialized);
    return true;
  } catch {
    return false;
  }
}

export function clearPersistedAnswerThread(ownerId?: string) {
  if (typeof window === "undefined") return;
  try {
    if (ownerId) {
      window.sessionStorage.removeItem(scopedStorageKey(ownerId));
      window.sessionStorage.removeItem(answerThreadStorageKey);
      window.localStorage.removeItem(answerThreadStorageKey);
      return;
    }
    window.localStorage.removeItem(answerThreadStorageKey);
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index);
      if (key === answerThreadStorageKey || key?.startsWith(`${answerThreadStorageKey}:`)) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Thread persistence is a convenience only.
  }
}
