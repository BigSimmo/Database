import { cn } from "@/components/ui-primitives";

export type ServiceReferralStage = "search" | "shortlist" | "compare" | "refer";

const stages = [
  { id: "search", label: "Search", detail: "Need, location, population and urgency" },
  { id: "shortlist", label: "Shortlist", detail: "Best use, eligibility, cost and access" },
  { id: "compare", label: "Compare", detail: "Fit, route, confidence and local checks" },
  { id: "refer", label: "Refer", detail: "Actionable contact, source and handover" },
] as const;

export function ServiceReferralFlow({
  active,
  variant = "track",
  className,
}: {
  active?: ServiceReferralStage;
  variant?: "track" | "cards";
  className?: string;
}) {
  return (
    <section aria-label="Referral workflow" className={className}>
      <ol
        className={cn(
          "grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4",
          variant === "track" &&
            "grid-cols-4 gap-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-1.5 sm:gap-2 sm:p-2",
        )}
      >
        {stages.map((stage, index) => {
          const isActive = stage.id === active;
          return (
            <li
              key={stage.id}
              aria-current={isActive ? "step" : undefined}
              className={cn(
                "min-w-0",
                variant === "cards"
                  ? "rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3 text-left shadow-[var(--shadow-inset)]"
                  : "grid justify-items-center gap-1 rounded-lg px-1 py-1.5 text-center sm:grid-cols-[2rem_minmax(0,1fr)] sm:justify-items-stretch sm:gap-2 sm:px-2 sm:text-left",
                isActive && "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]",
              )}
            >
              <span
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-full border text-xs font-extrabold",
                  isActive
                    ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                    : "border-[color:var(--border-strong)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)]",
                )}
              >
                {index + 1}
              </span>
              <span className={cn(variant === "cards" && "mt-2 block", variant === "track" && "min-w-0")}>
                <span className="block truncate text-xs font-bold text-[color:var(--text-heading)] sm:text-sm">
                  {stage.label}
                </span>
                <span
                  className={cn(
                    "block text-2xs font-medium leading-4 text-[color:var(--text-muted)]",
                    variant === "track" && "max-sm:hidden",
                  )}
                >
                  {stage.detail}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
