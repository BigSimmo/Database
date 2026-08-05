import { AnswerFooter } from "prompt-for-codex-medical-knowledge-base";

export const Complete = () => (
  <div className="w-[40rem] overflow-hidden rounded-lg border border-[color:var(--border)]">
    <AnswerFooter
      publisher="Sir Charles Gairdner Hospital"
      version="4.2"
      reviewDate="2026-05-18"
      generatedAt="2026-07-31T13:04:00+08:00"
    />
  </div>
);

// Missing metadata renders explicit MissingValue phrases for every absent field;
// nothing is silently dropped from the provenance strip.
export const SparseMetadata = () => (
  <div className="w-[40rem] overflow-hidden rounded-lg border border-[color:var(--border)]">
    <AnswerFooter publisher="RANZCP" generatedAt="2026-07-31T13:04:00+08:00" />
  </div>
);
