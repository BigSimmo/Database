/**
 * Known problems in specific source documents, shown wherever the document is cited.
 *
 * Some errors are in the source itself, not in how PsychSift read it, so re-indexing cannot fix
 * them. Each entry names the document, says exactly what looks wrong and what to check instead,
 * and cites the ledger row that holds the evidence. Wording is deliberately "appears": an entry is
 * a caution to verify, not a correction, until the document owner confirms.
 *
 * Matching is by the stored file name or title, lower-cased, so no database change is needed.
 */
export type DocumentCaution = {
  id: string;
  /** Every fragment must appear in the lower-cased file name or title. */
  matchAll: readonly string[];
  message: string;
  ledger: string;
  recordedOn: string;
};

export const DOCUMENT_CAUTIONS: readonly DocumentCaution[] = [
  {
    id: "rkpg-clozapine-wbc-anc-labels",
    matchAll: ["clozapine therapy", "rkpg"],
    message:
      "Caution: page 16 of this RkPG clozapine policy appears to give neutrophil thresholds (1.5 and 0.5 × 10⁹/L) as white-cell counts (WBC). WA monitoring stops clozapine when WBC is below 3.0 and/or neutrophils are below 1.5 × 10⁹/L. Check the WA Clozapine Monitoring Form before relying on these figures.",
    ledger: "#7VQ5RC",
    recordedOn: "2026-09-25",
  },
];

export function documentCautionFor(document: { file_name?: string | null; title?: string | null }) {
  const haystacks = [document.file_name, document.title]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.toLowerCase());
  return (
    DOCUMENT_CAUTIONS.find((caution) =>
      haystacks.some((haystack) => caution.matchAll.every((fragment) => haystack.includes(fragment))),
    ) ?? null
  );
}
