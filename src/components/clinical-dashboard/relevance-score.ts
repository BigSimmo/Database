import type { DocumentMatch } from "@/lib/types";

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
