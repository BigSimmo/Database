"use client";

import { Check, ChevronRight } from "lucide-react";
import Link from "next/link";

import { CmeNavHeader } from "@/components/cme/cme-nav-header";
import { cardInteractive, cardSurface, focusRing } from "@/components/card-recipes";
import { inPageAnchor } from "@/components/in-page-nav/in-page-nav-classes";
import { InformationPageShell } from "@/components/information-page-shell";
import { cn, primaryControl, toggleThumbSurface } from "@/components/ui-primitives";
import type { CmeRequirementSet } from "@/lib/cme/types";

export type CmeSetupStepStatus = "done" | "in-progress" | "not-started" | "waiting";

export type CmeSetupStep = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly status: CmeSetupStepStatus;
};

const setupStepStatusLabel: Record<CmeSetupStepStatus, string> = {
  done: "Done",
  "in-progress": "In progress",
  "not-started": "Not started",
  waiting: "Waiting",
};

/**
 * The one step this page can actually see the state of in Phase 1: whether a
 * requirement set has been confirmed for this year. The other three steps'
 * real state lives on screens this phase does not build — the development
 * plan, renewals, and the log's own catch-up view — so they are offered as
 * open, unstarted work rather than guessed at from data this page cannot see.
 * A caller that owns one of those screens can pass its own `steps` once it
 * has something real to report.
 */
function defaultSetupSteps(set: CmeRequirementSet | null): readonly CmeSetupStep[] {
  return [
    {
      id: "targets",
      title: "Your CPD home and targets",
      description: "Confirm the hours you have to reach.",
      status: set ? "done" : "not-started",
    },
    {
      id: "plan",
      title: "Write your development plan",
      description: "Required every year, and worth hours in its own right.",
      status: "not-started",
    },
    {
      id: "renewals",
      title: "Add your renewal dates",
      description: "Registration, indemnity, checks, mandatory training.",
      status: "not-started",
    },
    {
      id: "catch-up",
      title: "Catch up on this year so far",
      description: set ? "Log anything you have already done this year." : "Available once targets are confirmed.",
      status: "waiting",
    },
  ];
}

/** A future task hands a real handler here; Phase 3 (automatic capture) is blocked pending an explicit privacy ruling. */
function noop() {}

/**
 * The first-run screen: four things to set up once, an optional shortcut to
 * routines, and the capture switch — always drawn off, because Phase 3
 * capture does not exist yet and this screen must never claim otherwise.
 */
export function CmeSetupPage({
  set,
  steps,
  onToggleCapture,
}: {
  /** Null when the owner has not yet confirmed a requirement set for this year. */
  set: CmeRequirementSet | null;
  /** Overrides the four default steps once a caller has real state for them. */
  steps?: readonly CmeSetupStep[];
  onToggleCapture?: () => void;
}) {
  const resolvedSteps = steps ?? defaultSetupSteps(set);

  return (
    <>
      <CmeNavHeader title="Set up" />
      <InformationPageShell testId="cme-setup-page">
        <h1 className="sr-only">Set up CME</h1>

        <div className="flex flex-col gap-1.5">
          <h2 className="text-xl font-extrabold text-[color:var(--text-heading)]">Set this up once</h2>
          <p className="text-sm leading-relaxed text-[color:var(--text-muted)]">
            Four things, then the app runs itself. Start logging before you finish — nothing here blocks anything.
          </p>
        </div>

        <section
          id="cme-setup-steps"
          data-testid="cme-setup-steps"
          className={cn(inPageAnchor, cardSurface, "flex flex-col divide-y divide-[color:var(--border)] p-2")}
        >
          {resolvedSteps.map((step) => (
            <div key={step.id} className="flex items-center gap-3 px-2 py-3">
              <span
                aria-hidden
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full",
                  step.status === "done"
                    ? "bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                    : "border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface)]",
                )}
              >
                {step.status === "done" ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[color:var(--text-heading)]">{step.title}</span>
                <span className="block text-xs leading-relaxed text-[color:var(--text-muted)]">{step.description}</span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-[color:var(--text-muted)]">
                {setupStepStatusLabel[step.status]}
              </span>
            </div>
          ))}
        </section>

        {/* Optional, and deliberately not drawn as a fifth step: it is a
            shortcut worth taking, not a gate the four steps above wait on. */}
        <Link
          href="/cme/routines"
          id="cme-setup-routines"
          className={cn(inPageAnchor, cardInteractive, "flex items-center gap-3 p-4")}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-2xs font-black uppercase tracking-eyebrow text-[color:var(--clinical-accent)]">
              Optional — not a fifth step
            </span>
            <span className="mt-1 block text-sm font-bold text-[color:var(--text-heading)]">Set up your routines</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-[color:var(--text-muted)]">
              Supervision, journal club, peer review group — most of your hours, every month. Set them up once and each
              is one tap.
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-[color:var(--text-muted)]" aria-hidden />
        </Link>

        <section
          id="cme-setup-capture"
          data-testid="cme-setup-capture"
          className={cn(inPageAnchor, cardSurface, "flex flex-col gap-3 p-4")}
        >
          <div>
            <h2 className="text-sm font-extrabold text-[color:var(--text-heading)]">Nothing is being recorded yet</h2>
            <p className="mt-1 text-xs leading-relaxed text-[color:var(--text-muted)]">
              Automatic capture is off. If you turn it on, it would record document titles and how long they were open —
              never what you typed in the search box.
            </p>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-[color:var(--text-heading)]">Automatic capture</span>
            {/* Always rendered off. Phase 3 (automatic capture) is blocked
                pending an explicit privacy ruling — see the CME design record
                §6 — so this switch has nothing to turn on yet and must not
                imply otherwise by holding its own toggled state. */}
            <button
              type="button"
              role="switch"
              aria-checked={false}
              aria-label="Turn on automatic capture"
              onClick={onToggleCapture ?? noop}
              className={cn("relative inline-grid size-tap shrink-0 place-items-center rounded-full", focusRing)}
            >
              <span className="relative inline-flex h-6 w-tap items-center rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface-inset)]">
                <span
                  className={cn(
                    toggleThumbSurface,
                    "grid h-[18px] w-[18px] translate-x-0.5 place-items-center rounded-full border border-[color:var(--border)] shadow-[var(--e1)]",
                  )}
                />
              </span>
            </button>
          </div>
        </section>

        <Link href="/cme/new" className={cn(primaryControl, "w-full")}>
          Log your first activity
        </Link>
      </InformationPageShell>
    </>
  );
}
