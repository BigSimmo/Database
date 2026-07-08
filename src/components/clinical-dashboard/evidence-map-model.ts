import { cleanDisplayTitle } from "@/components/clinical-dashboard/display-text";
import { type AnswerRenderModel } from "@/lib/answer-render-policy";
import { sourceTextForCompactDisplay } from "@/lib/source-text-sanitizer";
import { type AnswerEvidenceMapRow } from "@/lib/ward-output";

// Pure projection of an answer render model into evidence-map rows. Extracted verbatim from
// evidence-panels.tsx so the dashboard can compute these rows without statically importing the
// heavy evidence-panels component tree — that module now loads lazily with the results surface.
// evidence-panels re-exports this for its own consumers.
export function evidenceMapRowsFromRenderModel(renderModel: AnswerRenderModel): AnswerEvidenceMapRow[] {
  return renderModel.evidenceRows.map((row, index) => ({
    id: row.id || `${row.source.chunk_id}:${index}`,
    section: row.section || "Source evidence",
    detail:
      sourceTextForCompactDisplay(row.quote || row.source.snippet || row.source.reason || "") ||
      cleanDisplayTitle(row.source.title),
    supportLevel: row.supportLevel || row.source.sourceStrength,
    citationCount: 1,
    sourceStatus:
      row.source.sourceStrength === "none" ? "Source requires review" : `${row.source.sourceStrength} source support`,
    bestSourceLabel: row.source.label,
    bestLinkedPassage: row.quote || row.source.snippet || row.source.reason,
    href: row.source.href,
  }));
}
