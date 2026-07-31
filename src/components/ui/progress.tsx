"use client";

import { Check, Loader2, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn, textMuted } from "@/components/ui-primitives";

export type ProgressProps = {
  /** 0–100. Omit for an indeterminate bar. */
  value?: number;
  label: string;
  /** Right-aligned detail, e.g. "42 of 118 chunks". Tabular so it stops jittering. */
  detail?: ReactNode;
  className?: string;
};

/**
 * A determinate bar when a total is known, indeterminate when it is not — and
 * never a determinate-looking bar over an unknown total, which is a lie about how
 * long something will take.
 *
 * `role="progressbar"` with real `aria-valuenow/min/max`, so the percentage is
 * announced rather than inferred from a coloured rectangle.
 */
export function Progress({ value, label, detail, className }: ProgressProps) {
  const determinate = typeof value === "number";
  const clamped = determinate ? Math.max(0, Math.min(100, value)) : undefined;

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-[color:var(--text)]">{label}</span>
        {detail ? <span className={cn("nums shrink-0 text-xs", textMuted)}>{detail}</span> : null}
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={clamped}
        aria-valuemin={determinate ? 0 : undefined}
        aria-valuemax={determinate ? 100 : undefined}
        data-testid="progress"
        className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--surface-inset)] shadow-[var(--shadow-inset)]"
      >
        <div
          className={cn(
            "h-full rounded-full bg-[color:var(--command)]",
            determinate
              ? "transition-[width] duration-[var(--duration-base,180ms)] motion-reduce:transition-none"
              : "w-1/3 animate-[shimmer_1.4s_ease-in-out_infinite] motion-reduce:w-full motion-reduce:animate-none",
          )}
          style={determinate ? { width: `${clamped}%` } : undefined}
        />
      </div>
    </div>
  );
}

export type Stage = {
  id: string;
  label: string;
  state: "pending" | "active" | "done" | "failed";
  /** Live count while the stage runs, e.g. "118 chunks". */
  detail?: ReactNode;
};

/**
 * A staged job, shown as stages — not as one skeleton.
 *
 * Ingestion is upload → parse → chunk → embed → index. Rendering that as a single
 * indeterminate placeholder throws away every piece of information the user
 * actually wants: which stage is running, how far in, whether it is stuck, and
 * which stage failed. A five-minute job with no named stage is indistinguishable
 * from a hung one.
 *
 * `aria-live="polite"` on the list so a stage transition is announced without
 * interrupting; the current stage carries `aria-current="step"`.
 */
export function StageList({
  stages,
  label = "Progress",
  className,
}: {
  stages: Stage[];
  label?: string;
  className?: string;
}) {
  const activeIndex = stages.findIndex((stage) => stage.state === "active");
  const doneCount = stages.filter((stage) => stage.state === "done").length;

  return (
    <ol
      data-testid="stage-list"
      aria-label={`${label}: step ${Math.max(activeIndex + 1, doneCount)} of ${stages.length}`}
      aria-live="polite"
      className={cn("m-0 flex list-none flex-col gap-0 p-0", className)}
    >
      {stages.map((stage, index) => {
        const last = index === stages.length - 1;
        return (
          <li
            key={stage.id}
            data-state={stage.state}
            aria-current={stage.state === "active" ? "step" : undefined}
            className="relative flex items-start gap-3 pb-3 last:pb-0"
          >
            {/* Connector owned by the gutter column, stopping at the dot centres. */}
            {!last ? (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[calc(var(--gutter-col,1.25rem)/2)] top-4 h-[calc(100%-0.5rem)] w-px -translate-x-1/2",
                  stage.state === "done" ? "bg-[color:var(--success)]" : "bg-[color:var(--border)]",
                )}
              />
            ) : null}
            <span className="relative z-5 grid w-[var(--gutter-col,1.25rem)] shrink-0 place-items-center pt-0.5">
              {stage.state === "done" ? (
                <Check aria-hidden="true" className="size-icon-sm text-[color:var(--success)]" strokeWidth={3} />
              ) : stage.state === "active" ? (
                <Loader2
                  aria-hidden="true"
                  className="size-icon-sm animate-spin text-[color:var(--command)] motion-reduce:animate-none"
                />
              ) : stage.state === "failed" ? (
                <TriangleAlert aria-hidden="true" className="size-icon-sm text-[color:var(--danger)]" />
              ) : (
                <span className="size-2 rounded-full border border-[color:var(--border-strong)]" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block text-sm leading-5",
                  stage.state === "pending"
                    ? textMuted
                    : stage.state === "failed"
                      ? "font-semibold text-[color:var(--danger)]"
                      : "font-medium text-[color:var(--text)]",
                )}
              >
                {stage.label}
              </span>
              {stage.detail ? <span className={cn("nums mt-0.5 block text-xs", textMuted)}>{stage.detail}</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
