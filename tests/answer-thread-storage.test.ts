import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RagAnswer } from "@/lib/types";
import {
  answerThreadStorageKey,
  answerThreadTtlMs,
  clearPersistedAnswerThread,
  loadPersistedAnswerThread,
  maxStoredAnswerTurns,
  resolveAnswerThreadOwnerId,
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

function createSampleThread(overrides: Partial<PersistedAnswerThread> = {}): PersistedAnswerThread {
  return {
    version: 2,
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
    showEarlierTurns: false,
    latestSubmissionSignature: "answer:what about renal impairment?:",
    expiresAt: Date.now() + answerThreadTtlMs,
    ...overrides,
  };
}

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

  it("round-trips an exact-match completed thread without extending its expiry", () => {
    const sampleThread = createSampleThread({ showEarlierTurns: true });
    expect(savePersistedAnswerThread("user-a", sampleThread)).toBe(true);
    expect(
      loadPersistedAnswerThread("user-a", {
        expectedSubmissionSignature: sampleThread.latestSubmissionSignature,
      }),
    ).toEqual(sampleThread);
    expect(loadPersistedAnswerThread("user-b")).toBeNull();

    const raw = JSON.parse(storage.get(`${answerThreadStorageKey}:user-a`) ?? "{}");
    expect(raw.expiresAt).toBe(sampleThread.expiresAt);
    expect(raw).not.toHaveProperty("savedAt");
  });

  it("scopes snapshots to accounts or the resolved current-tab guest", () => {
    expect(
      resolveAnswerThreadOwnerId({
        userId: "user-a",
        demoMode: false,
        demoOwnerId: "demo-owner",
        authStatus: "authenticated",
      }),
    ).toBe("user-a");
    expect(
      resolveAnswerThreadOwnerId({
        demoMode: true,
        demoOwnerId: "demo-owner",
        authStatus: "unconfigured",
      }),
    ).toBe("demo-owner");
    for (const authStatus of ["unconfigured", "signed_out", "expired", "error"] as const) {
      expect(resolveAnswerThreadOwnerId({ demoMode: false, demoOwnerId: "demo-owner", authStatus })).toBe(
        "guest-tab-session",
      );
    }
    expect(
      resolveAnswerThreadOwnerId({ demoMode: false, demoOwnerId: "demo-owner", authStatus: "loading" }),
    ).toBeNull();
  });

  it("purges a valid thread when the returned URL signature does not match", () => {
    const sampleThread = createSampleThread();
    savePersistedAnswerThread("user-a", sampleThread);

    expect(
      loadPersistedAnswerThread("user-a", {
        expectedSubmissionSignature: "answer:what about renal impairment?:queryMode=compare_guidance",
      }),
    ).toBeNull();
    expect(storage.has(`${answerThreadStorageKey}:user-a`)).toBe(false);
  });

  it("restores the latest thread on the unsubmitted answer home", () => {
    const sampleThread = createSampleThread();
    savePersistedAnswerThread("guest-tab-session", sampleThread);
    expect(loadPersistedAnswerThread("guest-tab-session")).toEqual(sampleThread);
  });

  it("clears stored thread state", () => {
    savePersistedAnswerThread("user-a", createSampleThread());
    clearPersistedAnswerThread();
    expect([...storage.keys()].some((key) => key.startsWith(answerThreadStorageKey))).toBe(false);
    expect(loadPersistedAnswerThread("user-a")).toBeNull();
  });

  it("clears only the active owner's thread when an owner is provided", () => {
    const sampleThread = createSampleThread();
    savePersistedAnswerThread("user-a", sampleThread);
    savePersistedAnswerThread("user-b", sampleThread);
    storage.set(answerThreadStorageKey, JSON.stringify(sampleThread));

    clearPersistedAnswerThread("user-a");

    expect(storage.has(answerThreadStorageKey)).toBe(false);
    expect(loadPersistedAnswerThread("user-a")).toBeNull();
    expect(loadPersistedAnswerThread("user-b")).toEqual(sampleThread);
  });

  it("purges invalid and corrupt persisted payloads", () => {
    storage.set(`${answerThreadStorageKey}:user-a`, JSON.stringify({ version: 3 }));
    expect(loadPersistedAnswerThread("user-a")).toBeNull();
    expect(storage.has(`${answerThreadStorageKey}:user-a`)).toBe(false);

    storage.set(`${answerThreadStorageKey}:user-a`, "{not-json");
    expect(loadPersistedAnswerThread("user-a")).toBeNull();
    expect(storage.has(`${answerThreadStorageKey}:user-a`)).toBe(false);
  });

  it("expires and purges threads once the completed-answer TTL has elapsed", () => {
    const expiredThread = createSampleThread({ expiresAt: Date.now() - 1 });
    storage.set(`${answerThreadStorageKey}:user-a`, JSON.stringify(expiredThread));
    expect(loadPersistedAnswerThread("user-a")).toBeNull();
    expect(storage.has(`${answerThreadStorageKey}:user-a`)).toBe(false);
    expect(savePersistedAnswerThread("user-a", expiredThread)).toBe(false);
  });

  it("rejects an expiry beyond the 12-hour privacy boundary", () => {
    const overlongThread = createSampleThread({ expiresAt: Date.now() + answerThreadTtlMs + 60_000 });
    storage.set(`${answerThreadStorageKey}:user-a`, JSON.stringify(overlongThread));
    expect(loadPersistedAnswerThread("user-a")).toBeNull();
    expect(savePersistedAnswerThread("user-a", overlongThread)).toBe(false);
  });

  it("drops an oversized snapshot instead of leaving an older answer behind", () => {
    savePersistedAnswerThread("user-a", createSampleThread());
    const oversizedAnswer = { ...sampleAnswer, answer: "ü".repeat(2_300_000) };
    const oversizedThread = createSampleThread({
      latestTurn: { query: "large answer", answer: oversizedAnswer, sources: [] },
      latestSubmissionSignature: "answer:large answer:",
    });

    expect(savePersistedAnswerThread("user-a", oversizedThread)).toBe(false);
    expect(storage.has(`${answerThreadStorageKey}:user-a`)).toBe(false);
  });

  it("migrates a fresh v1 thread only for its exact unscoped answer URL", () => {
    const savedAt = Date.now() - 1_000;
    const legacyThread = {
      version: 1,
      priorTurns: createSampleThread().priorTurns,
      latestTurn: createSampleThread().latestTurn,
      collapsedTurnIds: ["answer-turn-1"],
      savedAt,
    };
    storage.set(`${answerThreadStorageKey}:user-a`, JSON.stringify(legacyThread));

    const migrated = loadPersistedAnswerThread("user-a", {
      expectedSubmissionSignature: "answer:what about renal impairment?:",
    });
    expect(migrated).toMatchObject({
      version: 2,
      latestSubmissionSignature: "answer:what about renal impairment?:",
      expiresAt: savedAt + answerThreadTtlMs,
    });
    expect(JSON.parse(storage.get(`${answerThreadStorageKey}:user-a`) ?? "{}").version).toBe(2);
  });

  it("rejects v1 snapshots on answer home, query mismatch, scoped URL, or expiry", () => {
    const legacyThread = {
      version: 1,
      priorTurns: [],
      latestTurn: createSampleThread().latestTurn,
      collapsedTurnIds: [],
      savedAt: Date.now(),
    };
    const key = `${answerThreadStorageKey}:user-a`;

    for (const expectedSubmissionSignature of [
      undefined,
      "answer:different question?:",
      "answer:what about renal impairment?:scope.medications=lithium",
    ]) {
      storage.set(key, JSON.stringify(legacyThread));
      expect(loadPersistedAnswerThread("user-a", { expectedSubmissionSignature })).toBeNull();
      expect(storage.has(key)).toBe(false);
    }

    storage.set(key, JSON.stringify({ ...legacyThread, savedAt: Date.now() - answerThreadTtlMs - 1 }));
    expect(
      loadPersistedAnswerThread("user-a", {
        expectedSubmissionSignature: "answer:what about renal impairment?:",
      }),
    ).toBeNull();

    storage.set(key, JSON.stringify({ ...legacyThread, savedAt: Date.now() + 60_000 }));
    expect(
      loadPersistedAnswerThread("user-a", {
        expectedSubmissionSignature: "answer:what about renal impairment?:",
      }),
    ).toBeNull();
  });

  it("keeps no more than 12 completed turns including the latest", () => {
    const priorTurns = Array.from({ length: 20 }, (_, index) => ({
      id: `answer-turn-${index + 1}`,
      query: `question ${index + 1}`,
      answer: sampleAnswer,
      sources: [],
    }));
    savePersistedAnswerThread("user-a", createSampleThread({ priorTurns }));
    const restored = loadPersistedAnswerThread("user-a");
    expect(restored?.priorTurns).toHaveLength(maxStoredAnswerTurns - 1);
    expect(restored?.priorTurns[0]?.id).toBe("answer-turn-10");
  });

  it("keeps blocked storage non-blocking", () => {
    vi.stubGlobal("window", {
      localStorage: {
        removeItem() {
          throw new Error("blocked");
        },
      },
      sessionStorage: {
        get length() {
          throw new Error("blocked");
        },
        getItem() {
          throw new Error("blocked");
        },
        setItem() {
          throw new Error("blocked");
        },
        removeItem() {
          throw new Error("blocked");
        },
      },
    });
    expect(loadPersistedAnswerThread("user-a")).toBeNull();
    expect(savePersistedAnswerThread("user-a", createSampleThread())).toBe(false);
    expect(() => clearPersistedAnswerThread()).not.toThrow();
  });
});
