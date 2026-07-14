import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import type { RagAnswer } from "@/lib/types";
import {
  answerThreadStorageKey,
  answerThreadTtlMs,
  clearPersistedAnswerThread,
  loadPersistedAnswerThread,
  savePersistedAnswerThread,
  type PersistedAnswerThread,
} from "@/lib/answer-thread-storage";

const sampleAnswer = {
  answer: "Monitor renal function every 3 months.",
  grounded: true,
  confidence: "high",
  citations: [],
  sources: [],
} satisfies RagAnswer;

const sampleThread: PersistedAnswerThread = {
  version: 1,
  priorTurns: [
    {
      id: "answer-turn-1",
      query: "lithium dosing",
      answer: sampleAnswer,
      sources: [],
    },
  ],
  latestTurn: {
    query: "what about renal impairment?",
    answer: sampleAnswer,
    sources: [],
  },
  collapsedTurnIds: ["answer-turn-1"],
};

describe("answer thread storage", () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    storage = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem(key: string) {
          return storage.get(key) ?? null;
        },
        setItem(key: string, value: string) {
          storage.set(key, value);
        },
        removeItem(key: string) {
          storage.delete(key);
        },
      },
      sessionStorage: {
        get length() {
          return storage.size;
        },
        key(index: number) {
          return [...storage.keys()][index] ?? null;
        },
        getItem(key: string) {
          return storage.get(key) ?? null;
        },
        setItem(key: string, value: string) {
          storage.set(key, value);
        },
        removeItem(key: string) {
          storage.delete(key);
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips a stored thread", () => {
    expect(savePersistedAnswerThread("user-a", sampleThread)).toBe(true);
    expect(loadPersistedAnswerThread("user-a")).toEqual(sampleThread);
    expect(loadPersistedAnswerThread("user-b")).toBeNull();
  });

  it("clears stored thread state", () => {
    savePersistedAnswerThread("user-a", sampleThread);
    clearPersistedAnswerThread();
    expect([...storage.keys()].some((key) => key.startsWith(answerThreadStorageKey))).toBe(false);
    expect(loadPersistedAnswerThread("user-a")).toBeNull();
  });

  it("clears only the active owner's thread when an owner is provided", () => {
    savePersistedAnswerThread("user-a", sampleThread);
    savePersistedAnswerThread("user-b", sampleThread);

    clearPersistedAnswerThread("user-a");

    expect(loadPersistedAnswerThread("user-a")).toBeNull();
    expect(loadPersistedAnswerThread("user-b")).toEqual(sampleThread);
  });

  it("rejects invalid persisted payloads", () => {
    storage.set(`${answerThreadStorageKey}:user-a`, JSON.stringify({ version: 2 }));
    expect(loadPersistedAnswerThread("user-a")).toBeNull();
  });

  it("expires persisted threads once the TTL has elapsed", () => {
    storage.set(
      `${answerThreadStorageKey}:user-a`,
      JSON.stringify({ ...sampleThread, savedAt: Date.now() - answerThreadTtlMs - 1 }),
    );
    expect(loadPersistedAnswerThread("user-a")).toBeNull();
  });

  it("keeps fresh threads and stamps savedAt on save", () => {
    savePersistedAnswerThread("user-a", sampleThread);
    const raw = JSON.parse(storage.get(`${answerThreadStorageKey}:user-a`) ?? "{}");
    expect(typeof raw.savedAt).toBe("number");
    expect(Date.now() - raw.savedAt).toBeLessThan(answerThreadTtlMs);
    expect(loadPersistedAnswerThread("user-a")).toEqual(sampleThread);
  });

  it("accepts legacy payloads without a savedAt stamp", () => {
    storage.set(`${answerThreadStorageKey}:user-a`, JSON.stringify(sampleThread));
    expect(loadPersistedAnswerThread("user-a")).toEqual(sampleThread);
  });
});
