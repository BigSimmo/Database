// One module for empty, offline, error and not set up.
import { Info, TriangleAlert, WifiOff } from "lucide-react";
import { FnButton } from "@/components/first-nations/kit";

export type StateKind = "empty" | "offline" | "error" | "not-set-up";

const COPY = {
  empty: {
    Icon: Info,
    title: "No hospital numbers yet",
    line: "They appear here once your hospital's Aboriginal health team adds them.",
    action: "Report a missing number",
  },
  offline: {
    Icon: WifiOff,
    title: "Offline",
    line: "The numbers on this page still work. Nothing new can load.",
    action: "Try again",
  },
  error: {
    Icon: TriangleAlert,
    title: "This page didn't load",
    line: "Crisis numbers still work.",
    action: "Try again",
  },
  "not-set-up": {
    Icon: Info,
    title: "Liaison not set up here yet",
    line: "Statewide numbers still work.",
    action: "Report a missing number",
  },
} as const;

export function StateModule({ kind, href, onAction }: { kind: StateKind; href?: string; onAction?: () => void }) {
  const { Icon, title, line, action } = COPY[kind];
  return (
    <section
      role={kind === "error" ? "alert" : "status"}
      data-fn-part="state"
      className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 shadow-[var(--e1)]"
    >
      <span className="grid size-7 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]">
        <Icon className="size-icon-md" aria-hidden="true" />
      </span>
      <div className="grid gap-0.5">
        <h2 className="text-sm-minus font-medium text-[color:var(--text-heading)]">{title}</h2>
        <p className="text-sm-minus text-[color:var(--text-muted)]">{line}</p>
      </div>
      {href ? (
        <div className="col-span-2 mt-2">
          <FnButton label={action} href={href} />
        </div>
      ) : onAction ? (
        <div className="col-span-2 mt-2">
          <FnButton label={action} onClick={onAction} />
        </div>
      ) : null}
    </section>
  );
}
