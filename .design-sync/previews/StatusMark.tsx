import { StatusMark } from "prompt-for-codex-medical-knowledge-base";

export const States = () => (
  <div className="flex items-center gap-5 text-sm">
    {(["current", "review_due", "outdated", "unknown"] as const).map((status) => (
      <span key={status} className="inline-flex items-center gap-2">
        <StatusMark status={status} /> {status}
      </span>
    ))}
  </div>
);
