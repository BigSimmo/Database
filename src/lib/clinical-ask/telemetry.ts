import type { ClinicalAskModeId, ClinicalAskResponse, EvidenceTier } from "@/lib/clinical-ask/contracts";

export type ClinicalAskTelemetry = {
  mode: ClinicalAskModeId;
  inputTransport: "typed" | "voice";
  clarificationOccurred: boolean;
  tiersUsed: EvidenceTier[];
  externalResult: "not_attempted" | "used" | "empty" | "rejected" | "failed";
  responseState: ClinicalAskResponse["state"];
  failureClass: string | null;
  latencyBucket: "lt_1s" | "1_3s" | "3_10s" | "gte_10s";
};

export function clinicalAskLatencyBucket(elapsedMs: number): ClinicalAskTelemetry["latencyBucket"] {
  if (elapsedMs < 1_000) return "lt_1s";
  if (elapsedMs < 3_000) return "1_3s";
  if (elapsedMs < 10_000) return "3_10s";
  return "gte_10s";
}

export function buildClinicalAskTelemetry(input: Omit<ClinicalAskTelemetry, "latencyBucket"> & { elapsedMs: number }) {
  const { elapsedMs, ...allowlisted } = input;
  return { ...allowlisted, latencyBucket: clinicalAskLatencyBucket(elapsedMs) } satisfies ClinicalAskTelemetry;
}
