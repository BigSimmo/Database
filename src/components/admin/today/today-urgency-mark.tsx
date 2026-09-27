import { CircleDashed, Diamond } from "lucide-react";

/**
 * The two date-state marks "Needs you" rows use, in grey shapes and plain
 * words (`lane-rules.md` #4: "urgency = grey shapes + words"). Never red —
 * red is reserved for the emergency number — and never a verdict word.
 *
 * `AdminUrgencyMark` (Task 1) marks a row's CONSEQUENCE band ("Stops you
 * working"); this marks a row's DATE STATE ("Date passed", "Not recorded
 * yet") instead, which is a different axis and has no existing home yet — see
 * the Integration ask in the lane report.
 */
export function TodayUrgencyMark({ state }: { state: "passed" | "not-recorded" }) {
  const Icon = state === "passed" ? Diamond : CircleDashed;
  const label = state === "passed" ? "Date passed" : "Not recorded yet";
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-[color:var(--text-muted)]">
      <Icon aria-hidden="true" strokeWidth={1.5} className="size-icon-xs shrink-0" />
      {label}
    </span>
  );
}
