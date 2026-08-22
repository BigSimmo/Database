import type { RagAnswer, SearchResult } from "@/lib/types";

export const answerThreadStorageKey = "clinical-kb-answer-thread";
export const guestAnswerThreadOwnerId = "guest-tab-session";
export const maxStoredAnswerTurns = 12;
// sessionStorage already dies with the tab, but long-lived clinical-workstation
// tabs can idle for days; bound how long raw query/answer text stays restorable.
export const answerThreadTtlMs = 12 * 60 * 60 * 1000;

export function createAnswerThreadSnapshotMetadata(latestSubmissionSignature: string, now = Date.now()) {
  return { latestSubmissionSignature, expiresAt: now + answerThreadTtlMs };
}

type AnswerThreadAuthStatus = "unconfigured" | "loading" | "signed_out" | "authenticated" | "expired" | "error";

export function resolveAnswerThreadOwnerId({
  userId,
  demoMode,
  demoOwnerId,
  authStatus,
}: {
  userId?: string;
  demoMode: boolean;
  demoOwnerId: string;
  authStatus: AnswerThreadAuthStatus;
}) {
  if (userId) return userId;
  if (demoMode) return demoOwnerId;
  if (authStatus === "loading" || authStatus === "authenticated") return null;
  return guestAnswerThreadOwnerId;
}

export type StoredAnswerTurn = {
  id: string;
  query: string;
  answer: RagAnswer;
  sources: SearchResult[];
};

export type PersistedAnswerThread = {
  version: 2;
  priorTurns: StoredAnswerTurn[];
  latestTurn: Omit<StoredAnswerTurn, "id"> | null;
  collapsedTurnIds: string[];
  showEarlierTurns: boolean;
  latestSubmissionSignature: string;
  expiresAt: number;
};

type LegacyPersistedAnswerThread = {
  version: 1;
  priorTurns?: unknown;
  latestTurn?: unknown;
  collapsedTurnIds?: unknown;
  savedAt?: unknown;
};

export type AnswerThreadRestoreOptions = {
  /** Exact canonical signature for a submitted answer URL. Omit on the unsubmitted answer home. */
  expectedSubmissionSignature?: string;
};

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
    Array.isArray(turn.sources) &&
    turn.sources.every(
      (source) =>
        Boolean(source) &&
        typeof source === "object" &&
        typeof source.id === "string" &&
        typeof source.document_id === "string",
    )
  );
}

function normalizeLatestTurn(value: unknown): Omit<StoredAnswerTurn, "id"> | null {
  if (!value || typeof value !== "object") return null;
  const turn = value as Partial<Omit<StoredAnswerTurn, "id">>;
  if (
    typeof turn.query !== "string" ||
    !turn.query.trim() ||
    !turn.answer ||
    typeof turn.answer !== "object" ||
    typeof turn.answer.answer !== "string" ||
    !Array.isArray(turn.sources)
  ) {
    return null;
  }
  return { query: turn.query, answer: turn.answer, sources: turn.sources };
}

function normalizeTurns(value: unknown) {
  return Array.isArray(value) ? value.filter(isStoredAnswerTurn).slice(-(maxStoredAnswerTurns - 1)) : [];
}

function normalizeCollapsedTurnIds(value: unknown, priorTurns: StoredAnswerTurn[]) {
  if (!Array.isArray(value)) return priorTurns.map((turn) => turn.id);
  const availableIds = new Set(priorTurns.map((turn) => turn.id));
  return Array.from(new Set(value.filter((id): id is string => typeof id === "string" && availableIds.has(id))));
}

function normalizeV2(value: Record<string, unknown>): PersistedAnswerThread | null {
  const now = Date.now();
  const priorTurns = normalizeTurns(value.priorTurns);
  const latestTurn = normalizeLatestTurn(value.latestTurn);
  if (!priorTurns.length && !latestTurn) return null;
  if (
    typeof value.latestSubmissionSignature !== "string" ||
    !value.latestSubmissionSignature ||
    typeof value.expiresAt !== "number" ||
    !Number.isFinite(value.expiresAt) ||
    value.expiresAt <= now ||
    value.expiresAt > now + answerThreadTtlMs
  ) {
    return null;
  }
  return {
    version: 2,
    priorTurns,
    latestTurn,
    collapsedTurnIds: normalizeCollapsedTurnIds(value.collapsedTurnIds, priorTurns),
    showEarlierTurns: value.showEarlierTurns === true,
    latestSubmissionSignature: value.latestSubmissionSignature,
    expiresAt: value.expiresAt,
  };
}

function migrateV1(
  value: LegacyPersistedAnswerThread,
  expectedSubmissionSignature: string | undefined,
): PersistedAnswerThread | null {
  const priorTurns = normalizeTurns(value.priorTurns);
  const latestTurn = normalizeLatestTurn(value.latestTurn);
  if (!latestTurn || !expectedSubmissionSignature) return null;
  // V1 had no query-mode/scope signature. It is safe to accept only for an
  // unscoped answer URL whose exact query matches the latest completed turn.
  const unscopedLegacySignature = `answer:${latestTurn.query.trim()}:`;
  if (expectedSubmissionSignature !== unscopedLegacySignature) return null;
  const now = Date.now();
  const savedAt = typeof value.savedAt === "number" && Number.isFinite(value.savedAt) ? value.savedAt : now;
  const expiresAt = savedAt + answerThreadTtlMs;
  if (savedAt > now || expiresAt <= now) return null;
  return {
    version: 2,
    priorTurns,
    latestTurn,
    collapsedTurnIds: normalizeCollapsedTurnIds(value.collapsedTurnIds, priorTurns),
    showEarlierTurns: false,
    latestSubmissionSignature: expectedSubmissionSignature,
    expiresAt,
  };
}

function scopedStorageKey(ownerId: string) {
  return `${answerThreadStorageKey}:${ownerId}`;
}

function removeStoredThread(ownerId: string) {
  window.sessionStorage.removeItem(scopedStorageKey(ownerId));
}

export function loadPersistedAnswerThread(
  ownerId: string,
  options: AnswerThreadRestoreOptions = {},
): PersistedAnswerThread | null {
  if (typeof window === "undefined" || !ownerId) return null;
  try {
    const raw = window.sessionStorage.getItem(scopedStorageKey(ownerId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      removeStoredThread(ownerId);
      return null;
    }
    const record = parsed as Record<string, unknown>;
    const thread =
      record.version === 2
        ? normalizeV2(record)
        : record.version === 1
          ? migrateV1(record as LegacyPersistedAnswerThread, options.expectedSubmissionSignature)
          : null;
    if (!thread) {
      removeStoredThread(ownerId);
      return null;
    }
    // A URL/signature mismatch means this navigation does not own the stored
    // thread — leave it intact for a later forward restore or home restore.
    if (
      options.expectedSubmissionSignature &&
      thread.latestSubmissionSignature !== options.expectedSubmissionSignature
    ) {
      return null;
    }
    if (record.version === 1) savePersistedAnswerThread(ownerId, thread);
    return thread;
  } catch {
    try {
      removeStoredThread(ownerId);
    } catch {
      // Thread persistence is a convenience only.
    }
    return null;
  }
}

export function savePersistedAnswerThread(ownerId: string, thread: PersistedAnswerThread): boolean {
  if (typeof window === "undefined" || !ownerId) return false;
  try {
    const now = Date.now();
    if (thread.expiresAt <= now || thread.expiresAt > now + answerThreadTtlMs) {
      removeStoredThread(ownerId);
      return false;
    }
    const payload: PersistedAnswerThread = {
      version: 2,
      priorTurns: thread.priorTurns.slice(-(maxStoredAnswerTurns - 1)),
      latestTurn: thread.latestTurn,
      collapsedTurnIds: thread.collapsedTurnIds,
      showEarlierTurns: thread.showEarlierTurns,
      latestSubmissionSignature: thread.latestSubmissionSignature,
      expiresAt: thread.expiresAt,
    };
    const serialized = JSON.stringify(payload);
    if (new TextEncoder().encode(serialized).byteLength > maxStorageBytes) {
      removeStoredThread(ownerId);
      return false;
    }
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
