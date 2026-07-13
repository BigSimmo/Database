import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

const tokenVersion = 1;
const tokenLifetimeMs = 24 * 60 * 60 * 1000;
const clockSkewMs = 5 * 60 * 1000;
const signingContext = "clinical-kb:answer-feedback:v1";
const answerHashPattern = /^[a-f0-9]{64}$/;

type AnswerFeedbackTokenClaims = {
  v: typeof tokenVersion;
  interactionId: string;
  answerHash: string;
  issuedAt: number;
  expiresAt: number;
};

function signingSecret() {
  return env.RAG_QUERY_HASH_SECRET;
}

function signatureFor(encodedClaims: string, secret: string) {
  return createHmac("sha256", secret).update(`${signingContext}.${encodedClaims}`).digest("base64url");
}

function safeSignatureMatch(expected: string, received: string) {
  const expectedBytes = Buffer.from(expected, "utf8");
  const receivedBytes = Buffer.from(received, "utf8");
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
}

export function hashAnswerForFeedback(answer: string) {
  return createHash("sha256").update(answer, "utf8").digest("hex");
}

export function createAnswerFeedbackToken({
  interactionId,
  answer,
  now = Date.now(),
}: {
  interactionId: string;
  answer: string;
  now?: number;
}) {
  const secret = signingSecret();
  if (!secret) return undefined;

  const claims: AnswerFeedbackTokenClaims = {
    v: tokenVersion,
    interactionId,
    answerHash: hashAnswerForFeedback(answer),
    issuedAt: now,
    expiresAt: now + tokenLifetimeMs,
  };
  const encodedClaims = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  return `${encodedClaims}.${signatureFor(encodedClaims, secret)}`;
}

export function answerFeedbackMetadata(interactionId: string, answer: string) {
  const feedbackToken = createAnswerFeedbackToken({ interactionId, answer });
  return feedbackToken ? { interactionId, feedbackToken } : { interactionId };
}

export function verifyAnswerFeedbackToken({
  token,
  interactionId,
  answerHash,
  now = Date.now(),
}: {
  token: string;
  interactionId: string;
  answerHash: string;
  now?: number;
}) {
  const secret = signingSecret();
  if (!secret || !answerHashPattern.test(answerHash)) return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [encodedClaims, receivedSignature] = parts;
  if (!encodedClaims || !receivedSignature) return false;
  if (!safeSignatureMatch(signatureFor(encodedClaims, secret), receivedSignature)) return false;

  try {
    const claims = JSON.parse(
      Buffer.from(encodedClaims, "base64url").toString("utf8"),
    ) as Partial<AnswerFeedbackTokenClaims>;
    if (
      claims.v !== tokenVersion ||
      claims.interactionId !== interactionId ||
      claims.answerHash !== answerHash ||
      typeof claims.issuedAt !== "number" ||
      typeof claims.expiresAt !== "number"
    ) {
      return false;
    }
    if (claims.issuedAt > now + clockSkewMs || claims.expiresAt <= now) return false;
    return claims.expiresAt - claims.issuedAt === tokenLifetimeMs;
  } catch {
    return false;
  }
}
