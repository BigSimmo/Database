import { afterEach, describe, expect, it, vi } from "vitest";

const interactionId = "11111111-1111-4111-8111-111111111111";
const issuedAt = Date.UTC(2026, 6, 14, 0, 0, 0);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function tokenModule() {
  vi.stubEnv("RAG_QUERY_HASH_SECRET", "test-answer-feedback-secret-at-least-16-chars");
  return import("../src/lib/answer-feedback-token");
}

describe("answer feedback tokens", () => {
  it("binds a signed token to the interaction and exact answer hash", async () => {
    const { createAnswerFeedbackToken, hashAnswerForFeedback, verifyAnswerFeedbackToken } = await tokenModule();
    const answer = "Use the cited monitoring schedule.";
    const answerHash = hashAnswerForFeedback(answer);
    const token = createAnswerFeedbackToken({ interactionId, answer, now: issuedAt });

    expect(token).toBeTypeOf("string");
    expect(verifyAnswerFeedbackToken({ token: token!, interactionId, answerHash, now: issuedAt + 60_000 })).toBe(true);
    expect(
      verifyAnswerFeedbackToken({
        token: token!,
        interactionId: "22222222-2222-4222-8222-222222222222",
        answerHash,
        now: issuedAt + 60_000,
      }),
    ).toBe(false);
    expect(
      verifyAnswerFeedbackToken({ token: token!, interactionId, answerHash: "f".repeat(64), now: issuedAt + 60_000 }),
    ).toBe(false);
  });

  it("rejects tampered and expired tokens", async () => {
    const { createAnswerFeedbackToken, hashAnswerForFeedback, verifyAnswerFeedbackToken } = await tokenModule();
    const answer = "Use the cited monitoring schedule.";
    const answerHash = hashAnswerForFeedback(answer);
    const token = createAnswerFeedbackToken({ interactionId, answer, now: issuedAt })!;
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;

    expect(verifyAnswerFeedbackToken({ token: tampered, interactionId, answerHash, now: issuedAt + 60_000 })).toBe(
      false,
    );
    expect(verifyAnswerFeedbackToken({ token, interactionId, answerHash, now: issuedAt + 24 * 60 * 60 * 1000 })).toBe(
      false,
    );
  });

  it("does not mint or accept tokens without the server signing secret", async () => {
    vi.stubEnv("RAG_QUERY_HASH_SECRET", undefined);
    const { createAnswerFeedbackToken, hashAnswerForFeedback, verifyAnswerFeedbackToken } =
      await import("../src/lib/answer-feedback-token");
    const answerHash = hashAnswerForFeedback("answer");

    expect(createAnswerFeedbackToken({ interactionId, answer: "answer", now: issuedAt })).toBeUndefined();
    expect(verifyAnswerFeedbackToken({ token: "payload.signature", interactionId, answerHash, now: issuedAt })).toBe(
      false,
    );
  });
});
