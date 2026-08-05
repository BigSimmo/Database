import { MissingValue } from "prompt-for-codex-medical-knowledge-base";

export const Reasons = () => (
  <div className="flex flex-col gap-2">
    <MissingValue reason="not_recorded" />
    <MissingValue reason="not_applicable" />
    <MissingValue reason="extraction_failed" />
  </div>
);
