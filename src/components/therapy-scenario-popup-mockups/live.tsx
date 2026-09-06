"use client";

import { useState } from "react";
import { RotateCcw, Sparkles, X } from "lucide-react";

import { cn } from "@/components/ui-primitives";

import {
  AdvisoryLine,
  Chip,
  CONSTRAINT_GROUPS,
  constraintsIn,
  DesktopFrame,
  EXAMPLE_SITUATION,
  Eyebrow,
  FrameBlock,
  GhostButton,
  InertChipNotice,
  narrowing,
  PhoneFrame,
  PrimaryButton,
  ScopeReadout,
  SituationField,
  StudyPage,
  TopBar,
  focusRing,
  inferConstraints,
  labelFor,
  useNarrowing,
} from "./shared";

/* ------------------------------------------------------------------ *
 * Direction 2 — Docked live composer.
 *
 * Every field on one surface in a panel docked to the right, with the
 * ranked list left visible beside it and re-ranking as each chip moves.
 * Nothing is hidden behind a step or a tab: the whole scenario, and the
 * whole consequence of it, are on screen at once.
 * ------------------------------------------------------------------ */

function useScenario() {
  const [situation, setSituation] = useState(EXAMPLE_SITUATION);
  const [explicit, setExplicit] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const inferred = inferConstraints(situation).filter((key) => !dismissed.includes(key));
  const active = Array.from(new Set([...explicit, ...inferred]));
  const result = useNarrowing(active);

  const toggle = (key: string) => {
    if (explicit.includes(key)) {
      setExplicit(explicit.filter((value) => value !== key));
      if (inferConstraints(situation).includes(key)) setDismissed([...dismissed, key]);
      return;
    }
    if (inferred.includes(key)) {
      setDismissed([...dismissed, key]);
      return;
    }
    setDismissed(dismissed.filter((value) => value !== key));
    setExplicit([...explicit, key]);
  };

  const reset = () => {
    setExplicit([]);
    setDismissed([]);
  };

  return { situation, setSituation, active, inferred, toggle, reset, result };
}

type Scenario = ReturnType<typeof useScenario>;

/**
 * Per-chip delta: what this chip costs, computed before it is pressed.
 * This is the argument for the whole direction — a chip that removes
 * nothing, or removes everything, says so before you commit to it.
 */
function chipEffect(activeKeys: string[], key: string): string {
  const current = narrowing(activeKeys).count;
  const on = activeKeys.includes(key);
  const without = narrowing(activeKeys.filter((k) => k !== key)).count;
  const withIt = narrowing([...activeKeys, key]).count;

  if (on) {
    const excluded = without - current;
    return excluded > 0 ? `excludes ${excluded}` : "no change";
  }
  const cost = current - withIt;
  return cost > 0 ? `-${cost}` : "no change";
}

function ComposerFields({ scenario, idPrefix }: { scenario: Scenario; idPrefix: string }) {
  return (
    <div className="flex flex-col gap-3.5">
      <SituationField
        id={`${idPrefix}-situation`}
        value={scenario.situation}
        onChange={scenario.setSituation}
        rows={4}
      />

      {scenario.inferred.length ? (
        <p className="m-0 text-3xs font-semibold leading-4 text-[color:var(--text-muted)]">
          <Sparkles
            aria-hidden="true"
            size={11}
            strokeWidth={2.2}
            className="mr-1 inline text-[color:var(--clinical-accent)]"
          />
          Accent chips were read from what you typed. Press one to drop it.
        </p>
      ) : null}

      {CONSTRAINT_GROUPS.map((group) => (
        <fieldset key={group.id} className="min-w-0 border-0 p-0">
          <legend className="mb-1.5 p-0">
            <Eyebrow>{group.label}</Eyebrow>
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {constraintsIn(group.id).map((constraint) => {
              const effect = chipEffect(scenario.active, constraint.key);
              const on = scenario.active.includes(constraint.key);
              return (
                <span key={constraint.key} className="inline-flex flex-col items-start">
                  <Chip
                    label={constraint.label}
                    active={on}
                    inferred={scenario.inferred.includes(constraint.key)}
                    disabled={scenario.result.emptyingKeys.includes(constraint.key)}
                    onToggle={() => scenario.toggle(constraint.key)}
                  />
                  <span className="nums mt-0.5 w-full text-center text-3xs font-bold text-[color:var(--text-soft)]">
                    {effect}
                  </span>
                </span>
              );
            })}
          </div>
        </fieldset>
      ))}

      <InertChipNotice result={scenario.result} />
    </div>
  );
}

function PanelHeader({ scenario, onClose }: { scenario: Scenario; onClose: () => void }) {
  return (
    <header className="shrink-0 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3.5 py-3">
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-sm font-semibold tracking-[-0.02em] text-[color:var(--text-heading)]">
            Clinical situation
          </h2>
          <p className="m-0 mt-0.5 text-3xs font-bold text-[color:var(--text-soft)]">The list re-ranks as you edit</p>
        </div>
        <GhostButton icon={RotateCcw} onClick={scenario.reset}>
          Clear
        </GhostButton>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "grid size-tap shrink-0 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
            focusRing,
          )}
        >
          <X aria-hidden="true" size={16} strokeWidth={2} />
          <span className="sr-only">Close the composer</span>
        </button>
      </div>
    </header>
  );
}

function PanelFooter({ scenario, onClose }: { scenario: Scenario; onClose: () => void }) {
  return (
    <footer className="shrink-0 border-t border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3.5 py-2.5">
      <div className="flex items-center gap-2">
        <ScopeReadout result={scenario.result} compact />
        <PrimaryButton icon={Sparkles} className="ml-auto" onClick={onClose}>
          Done
        </PrimaryButton>
      </div>
      <AdvisoryLine className="mt-2" />
    </footer>
  );
}

/**
 * The results column. Unlike the other two directions this is not backdrop:
 * it is the feedback surface, so it stays at full contrast and re-ranks live.
 */
function LiveResults({ scenario, phone = false }: { scenario: Scenario; phone?: boolean }) {
  return (
    <div className={cn("mx-auto", phone ? "" : "max-w-[34rem]")}>
      <h2 className="m-0 text-lg font-semibold tracking-[-0.02em] text-[color:var(--text-heading)]">Recommend</h2>
      <p className="m-0 mt-0.5 text-2xs font-semibold text-[color:var(--text-muted)]">
        Rank catalogue therapies against a clinical scenario. Advisory only.
      </p>
      <p className="m-0 mt-3 flex items-baseline gap-1.5">
        <span className="nums text-base font-extrabold text-[color:var(--text-heading)]">{scenario.result.count}</span>
        <span className="text-2xs font-bold text-[color:var(--text-soft)]">
          of {scenario.result.total} records in scope
        </span>
      </p>
      {/* Unnumbered for the same reason as the other two directions: this is
          what the constraints leave in scope, not a relevance ordering. */}
      <div className="mt-2 flex flex-col gap-1.5">
        {scenario.result.names.map((name) => (
          <div
            key={name}
            className="flex items-center gap-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5"
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--decoration-soft)]" />
            <span className="min-w-0 truncate text-2xs font-semibold text-[color:var(--text-heading)]">{name}</span>
          </div>
        ))}
        {scenario.result.count === 0 ? (
          <p className="m-0 rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-3 py-2.5 text-2xs font-semibold text-[color:var(--warning-text)]">
            Nothing matches this combination. Drop a constraint to widen it.
          </p>
        ) : null}
      </div>
      <p className="m-0 mt-2 text-3xs font-semibold text-[color:var(--text-soft)]">
        In scope, catalogue order. Relevance ranking is not modelled here.
      </p>
    </div>
  );
}

function DesktopScene() {
  const scenario = useScenario();
  const [open, setOpen] = useState(true);

  return (
    <DesktopFrame>
      <div className="flex h-full flex-col">
        <TopBar />
        <div className="flex min-h-0 flex-1">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <LiveResults scenario={scenario} />
          </div>
          {open ? (
            <aside
              aria-label="Clinical situation composer"
              className="flex w-[26rem] shrink-0 animate-dialog-rise flex-col border-l border-[color:var(--border-strong)] bg-[color:var(--background)] shadow-[var(--shadow-lux)]"
            >
              <PanelHeader scenario={scenario} onClose={() => setOpen(false)} />
              <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5">
                <ComposerFields scenario={scenario} idPrefix="live-desktop" />
              </div>
              <PanelFooter scenario={scenario} onClose={() => setOpen(false)} />
            </aside>
          ) : (
            <div className="flex w-[26rem] shrink-0 items-start justify-center border-l border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-5">
              <GhostButton icon={Sparkles} onClick={() => setOpen(true)}>
                Edit the situation
              </GhostButton>
            </div>
          )}
        </div>
      </div>
    </DesktopFrame>
  );
}

function PhoneScene({ caption, expanded: initial }: { caption: string; expanded: boolean }) {
  const scenario = useScenario();
  const [expanded, setExpanded] = useState(initial);
  const [open, setOpen] = useState(true);

  return (
    <PhoneFrame caption={caption}>
      <TopBar phone />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <LiveResults scenario={scenario} phone />
      </div>
      {open ? (
        <div className="absolute inset-0 z-[100] flex items-end">
          <button
            type="button"
            aria-label="Close the composer"
            onClick={() => setOpen(false)}
            className={cn(
              "absolute inset-0 animate-overlay-in",
              expanded ? "bg-[color:var(--neutral-950)]/50" : "bg-[color:var(--neutral-950)]/20",
            )}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Clinical situation composer"
            className={cn(
              "relative flex w-full animate-sheet-up flex-col overflow-hidden rounded-t-[1.25rem] border-t border-[color:var(--border-strong)] bg-[color:var(--background)] shadow-[var(--shadow-lux)] transition-[max-height]",
              expanded ? "max-h-[92%]" : "max-h-[54%]",
            )}
          >
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              aria-expanded={expanded}
              className={cn("flex shrink-0 justify-center bg-[color:var(--surface)] pt-2 pb-1.5", focusRing)}
            >
              <span aria-hidden="true" className="h-1 w-9 rounded-full bg-[color:var(--border-strong)]" />
              <span className="sr-only">{expanded ? "Collapse the composer" : "Expand the composer"}</span>
            </button>
            <PanelHeader scenario={scenario} onClose={() => setOpen(false)} />
            <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5">
              {expanded ? (
                <ComposerFields scenario={scenario} idPrefix="live-phone" />
              ) : (
                <div className="flex flex-col gap-2">
                  <SituationField
                    id="live-phone-peek"
                    value={scenario.situation}
                    onChange={scenario.setSituation}
                    rows={2}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {scenario.active.map((key) => (
                      <span
                        key={key}
                        className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-1.5 py-0.5 text-3xs font-bold text-[color:var(--text-muted)]"
                      >
                        {labelFor(key)}
                      </span>
                    ))}
                  </div>
                  <p className="m-0 text-3xs font-semibold text-[color:var(--text-soft)]">
                    Pull up for setting, time, support and cautions.
                  </p>
                </div>
              )}
            </div>
            <PanelFooter scenario={scenario} onClose={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </PhoneFrame>
  );
}

export function TherapyScenarioPopupLiveMockup() {
  return (
    <StudyPage
      eyebrow="Therapy · Recommend scenario · Direction 2"
      title="Docked live composer"
      lede="Every field on one surface in a panel docked to the right, with the ranking left visible beside it and re-ranking on every keystroke and every chip. Each chip carries the number of records it will cost you, worked out before you press it."
      points={[
        {
          label: "Best for",
          body: "Tuning a scenario you already roughly know, and seeing immediately whether it worked.",
        },
        {
          label: "Live feedback",
          body: "Per-chip deltas plus a running total, both computed from the real 205-record catalogue.",
        },
        {
          label: "Trade-off",
          body: "Denser than a stepped flow, and the panel takes a quarter of the desktop width while open.",
        },
      ]}
    >
      <FrameBlock
        label="Desktop"
        size="Panel 416px, results stay at full contrast"
        note="Press Handout or 15 minutes and watch the chip read “no change” — against today's catalogue those chips match every record. That is a real finding from the shipped predicates, not a mockup simplification."
      >
        <DesktopScene />
      </FrameBlock>

      <FrameBlock
        label="Phone"
        size="390px viewport, sheet at 54% then 92%"
        note="Peek keeps the situation box and the chips currently in force. Pull up for the four groups. The count sits beside Done at both heights."
      >
        <div className="flex flex-wrap gap-6">
          <PhoneScene caption="Phone · Peek, situation only" expanded={false} />
          <PhoneScene caption="Phone · Expanded, all four groups" expanded />
        </div>
      </FrameBlock>
    </StudyPage>
  );
}
