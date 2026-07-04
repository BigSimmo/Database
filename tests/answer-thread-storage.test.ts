import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import type { RagAnswer } from "@/lib/types";
import {
  answerThreadStorageKey,
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
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips a stored thread", () => {
    expect(savePersistedAnswerThread(sampleThread)).toBe(true);
    expect(loadPersistedAnswerThread()).toEqual(sampleThread);
  });

  it("clears stored thread state", () => {
    savePersistedAnswerThread(sampleThread);
    clearPersistedAnswerThread();
    expect(storage.has(answerThreadStorageKey)).toBe(false);
    expect(loadPersistedAnswerThread()).toBeNull();
  });

  it("rejects invalid persisted payloads", () => {
    storage.set(answerThreadStorageKey, JSON.stringify({ version: 2 }));
    expect(loadPersistedAnswerThread()).toBeNull();
  });
});
