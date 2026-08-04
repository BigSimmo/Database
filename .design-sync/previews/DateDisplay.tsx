import { DateDisplay } from "prompt-for-codex-medical-knowledge-base";

export const Dates = () => (
  <div className="flex flex-col gap-2">
    <DateDisplay value="2026-05-18" kind="review" />
    <DateDisplay value="2026-05-18T08:30:00+08:00" kind="generated" />
    <DateDisplay value={null} kind="review" missingReason="unknown" />
  </div>
);
