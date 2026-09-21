"use client";

import { Check, Loader2, TriangleAlert } from "lucide-react";
import { useId, type ReactNode } from "react";
import { cn, textMuted } from "@/components/ui-primitives";

export type ProgressProps = {
  /** 0–100. Omit for an indeterminate bar. */
  value?: number;
  label: string;
  /** Right-aligned detail, e.g. "42 of 118 chunks". Tabular so it stops jittering. */
  detail?: ReactNode;
  /**
   * An optional reference point on the same scale as `value` — "where you would
   * need to be today". Drawn as a notch, not a second fill, and kept out of
   * `aria-valuenow`, which still reports the real value: a screen reader that
   * announced the target as the progress would be stating the opposite of the
   * truth. `label` reaches assistive technology as the bar's description, from
   * a sibling node — see the note on the notch below.
   */
  mark?: { value: number; label: string };
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
export function Progress({ value, label, detail, mark, className }: ProgressProps) {
  const determinate = typeof value === "number";
  const clamped = determinate ? Math.max(0, Math.min(100, value)) : undefined;
  const markPercent = mark ? Math.max(0, Math.min(100, mark.value)) : undefined;
  const markDescriptionId = useId();

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-[color:var(--text)]">{label}</span>
        {detail ? <span className={cn("nums shrink-0 text-xs", textMuted)}>{detail}</span> : null}
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-describedby={mark ? markDescriptionId : undefined}
        aria-valuenow={clamped}
        aria-valuemin={determinate ? 0 : undefined}
        aria-valuemax={determinate ? 100 : undefined}
        data-testid="progress"
        className={cn(
          "h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--surface-inset)] shadow-[var(--shadow-inset)]",
          // Only a positioning context when there is a mark to position — an
          // unconditional `relative` here would be harmless too (no visible
          // effect without an absolute child) but this keeps the no-mark
          // markup byte-identical to before this prop existed.
          mark && "relative",
        )}
      >
        <div
          data-testid="progress-fill"
          className={cn(
            "h-full origin-left rounded-full bg-[color:var(--command)]",
            determinate
              ? "w-full transition-transform duration-[var(--duration-base)] motion-reduce:transition-none"
              : // `animate-shimmer` is the `@theme` token (`--animate-shimmer`), not a
                // second hand-written copy of the same sweep. The literal it replaces
                // (`animate-[shimmer_1.4s_ease-in-out_infinite]`) pinned both the
                // duration and a different easing here, so retiming the system's
                // shimmer would have left this one bar behind.
                "w-1/3 animate-shimmer motion-reduce:w-full motion-reduce:animate-none",
          )}
          style={determinate ? { transform: `scaleX(${(clamped ?? 0) / 100})`, transformOrigin: "left" } : undefined}
        />
        {mark ? (
          <span
            data-testid="progress-mark"
            // Hidden from assistive technology ON PURPOSE, and the description
            // below is why. `progressbar` is one of the roles WAI-ARIA 1.2
            // §5.2.3 gives "Presentational Children: True", so a conforming
            // browser may strip the role and name of everything inside the
            // track. A `role="img"` + `aria-label` notch nested here therefore
            // risks being announced not twice but ZERO times — and no jsdom
            // test can catch that, because `toHaveAccessibleName` computes the
            // name on the node directly and never models the flattening.
            aria-hidden="true"
            // A notch, not a second fill: 2px wide, spans the track's own height
            // rather than setting one, and centred on its percentage rather than
            // left-edge-aligned so it reads as a point, not a tick starting there.
            className="absolute top-0 h-full w-0.5 -translate-x-1/2 bg-[color:var(--text)] forced-colors:bg-[CanvasText]"
            style={{ left: `${markPercent}%` }}
          />
        ) : null}
      </div>
      {/* Sibling of the track, never a child — the same reason StageList's
          status node is a sibling of its list. `aria-describedby` points at it
          from the progressbar, so the description is computed from outside the
          presentational subtree and survives. */}
      {mark ? (
        <span id={markDescriptionId} data-testid="progress-mark-description" className="sr-only">
          {mark.label}
        </span>
      ) : null}
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

export type StageListProps = {
  stages: Stage[];
  label?: string;
  className?: string;
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
 * The current stage carries `aria-current="step"`, and one `sr-only`
 * `role="status"` node — NOT the list itself — is what announces a transition.
 * `aria-live` on the `<ol>` made the whole list the live region, so advancing
 * one stage re-read every stage label, its detail count and its position; on a
 * five-stage ingestion that is five sentences to learn that step 3 started.
 * The status node carries the one sentence that changed.
 */
export function StageList({ stages, label = "Progress", className }: StageListProps) {
  const activeIndex = stages.findIndex((stage) => stage.state === "active");
  const failedIndex = stages.findIndex((stage) => stage.state === "failed");
  const currentIndex = activeIndex >= 0 ? activeIndex : failedIndex;
  const doneCount = stages.filter((stage) => stage.state === "done").length;
  const step = stages.length
    ? currentIndex >= 0
      ? currentIndex + 1
      : Math.min(Math.max(doneCount, 1), stages.length)
    : 0;
  const currentStage = currentIndex >= 0 ? stages[currentIndex] : undefined;

  return (
    <>
      {/* Sibling of the list, never a child: an sr-only <li> would have made a
          five-stage job announce as "list, 6 items". */}
      <span data-testid="stage-list-status" role="status" className="sr-only">
        {currentStage ? `${label}: step ${step} of ${stages.length}, ${currentStage.label}` : ""}
      </span>
      <ol
        data-testid="stage-list"
        aria-label={stages.length ? `${label}: step ${step} of ${stages.length}` : label}
        className={cn("m-0 flex list-none flex-col gap-0 p-0", className)}
      >
        {stages.map((stage, index) => {
          const last = index === stages.length - 1;
          return (
            <li
              key={stage.id}
              data-state={stage.state}
              aria-current={index === currentIndex && currentIndex >= 0 ? "step" : undefined}
              className="relative flex items-start gap-3 pb-3 last:pb-0"
            >
              {/* Connector owned by the gutter column, stopping at the dot centres. */}
              {!last ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-[calc(var(--gutter-col)/2)] top-4 h-[calc(100%-var(--gutter-dot))] w-px -translate-x-1/2",
                    stage.state === "done" ? "bg-[color:var(--success)]" : "bg-[color:var(--border)]",
                  )}
                />
              ) : null}
              <span className="relative z-5 grid w-[var(--gutter-col)] shrink-0 place-items-center pt-0.5">
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
                {stage.detail ? (
                  <span className={cn("nums mt-0.5 block text-xs", textMuted)}>{stage.detail}</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </>
  );
}
