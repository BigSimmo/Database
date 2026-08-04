import { VerificationNotice } from "prompt-for-codex-medical-knowledge-base";

export default function Preview() {
  return (
    <div className="space-y-3 p-4">
      <VerificationNotice state="ready" presentation="responsive-compact" sourceCount={4} />
      <VerificationNotice state="stale_evidence" presentation="responsive-compact" sourceCount={4} />
      <VerificationNotice state="partial_retrieval" presentation="responsive-compact" sourceCount={3} />
      <VerificationNotice
        state="ungrounded"
        attribution="extractive"
        presentation="responsive-compact"
        sourceCount={2}
      />
    </div>
  );
}
