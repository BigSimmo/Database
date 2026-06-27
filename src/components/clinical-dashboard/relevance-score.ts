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
  const normalized = raw > 1 ? raw : raw * 100;
  return Math.max(0, Math.min(99, Math.round(normalized)));
}
