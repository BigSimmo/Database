import type { DocumentMatch } from "@/lib/types";

export type DocumentRelevanceLabel = "Strong match" | "Partial match" | "Nearby only" | "No direct support";

/**
 * What a document result's relevance chip says (#1M22X5, owner decision
 * 2026-09-25): the verdict in words, and no number. The search surface used to
 * show `documentRelevancePercent` beside the word, but that percentage is a
 * hard-coded constant per verdict (96/84/78), so it measured nothing, and the
 * 78 given to "nearby" crossed the ">= 75" line and dressed every nearby-only
 * result as "Relevant". Below "nearby" the chip reuses the product's existing
 * honest label (`relevanceChipLabel` in relevance.tsx) rather than a stronger
 * word. Display only: result order comes from the server and never reads this.
 */
export function documentRelevanceLabel(document: Pick<DocumentMatch, "relevance">): DocumentRelevanceLabel {
  const verdict = document.relevance?.verdict as string | undefined;
  if (verdict === "direct") return "Strong match";
  if (verdict === "partial") return "Partial match";
  if (verdict === "nearby") return "Nearby only";
  return "No direct support";
}

/**
 * Mockup-only (the /mockups document-flow exhibits, blocked in production). The
 * verdict branches are fixed constants, not a measurement, which is why the
 * product surface shows `documentRelevanceLabel` instead (#1M22X5).
 */
export function documentRelevancePercent(document: Pick<DocumentMatch, "relevance" | "score">) {
  const verdict = document.relevance?.verdict as string | undefined;
  if (verdict === "direct") return 96;
  if (verdict === "partial") return 84;
  if (verdict === "nearby") return 78;

  const values = [document.relevance?.score, document.score].filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  const raw = values[0] ?? 0;
  // Scores here are unit-scale fractions: relevance.score is clamped to [0,1] and
  // raw search scores can drift slightly above 1. Treat anything on the unit
  // scale (<= 1.5) as a fraction so e.g. 1.2 renders as ~100% (capped) rather
  // than "1%". Only values clearly on a 0–100 scale are passed through as-is.
  const normalized = raw <= 1.5 ? raw * 100 : raw;
  return Math.max(0, Math.min(99, Math.round(normalized)));
}
