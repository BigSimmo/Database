import { AnswerFooter } from "prompt-for-codex-medical-knowledge-base";

export const Complete = () => (
  <div className="w-[40rem] overflow-hidden rounded-lg border border-[color:var(--border)]">
    <AnswerFooter
      publisher="Sir Charles Gairdner Hospital"
      version="4.2"
      reviewDate="18/05/2026"
      generatedAt="31/07/2026 13:04"
    />
  </div>
);

// Missing segments are dropped rather than filled with "Unknown" - except the
// review date, which stays explicit because its absence is itself a signal.
export const SparseMetadata = () => (
  <div className="w-[40rem] overflow-hidden rounded-lg border border-[color:var(--border)]">
    <AnswerFooter publisher="RANZCP" generatedAt="31/07/2026 13:04" />
  </div>
);
