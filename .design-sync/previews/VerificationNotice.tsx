import { VerificationNotice } from "prompt-for-codex-medical-knowledge-base";

export default function Preview() {
  return (
    <div className="space-y-3 p-4">
      <VerificationNotice state="ready" />
      <VerificationNotice state="ungrounded" attribution="extractive" />
    </div>
  );
}
