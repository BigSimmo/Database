"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, FileText, Scale, X } from "lucide-react";

import { cn } from "@/components/ui-primitives";

import {
  AdvisoryLine,
  CautionBlock,
  CheckRow,
  DesktopFrame,
  Eyebrow,
  FactGrid,
  FavouriteButton,
  FrameBlock,
  GhostButton,
  OverviewBlock,
  PhoneFrame,
  PrimaryButton,
  RankChip,
  RankedList,
  RANKED,
  ReviewChip,
  ScenarioHeader,
  SegmentedField,
  SourceBlock,
  StepList,
  StudyPage,
  TAB_ICONS,
  TAB_LABELS_SHORT,
  TopBar,
  focusRing,
  type TabId,
} from "./shared";

/* ------------------------------------------------------------------ *
 * Direction B — Docked triage panel.
 *
 * The panel takes the right third of the desktop and leaves the ranked
 * list live beside it, so the reader steps through matches 1 to 6
 * without closing anything. Its distinguishing feature is the fit
 * check at the top: four inputs that resolve to a verdict for this
 * patient before the record is read at all.
 * ------------------------------------------------------------------ */

const TABS: TabId[] = ["overview", "deliver", "cautions", "fit", "sources"];

const RISK_FLAGS = ["Active psychosis", "Severe dissociation", "Unstable substance withdrawal", "Acute suicidality"];

type Verdict = {
  tone: "good" | "modify" | "switch";
  label: string;
  body: string;
};

function verdictFor(driver: string, capacity: string, flags: string[]): Verdict {
  if (flags.length) {
    return {
      tone: "modify",
      label: "Hold and reconsider",
      body: `${flags.join(", ")} recorded. The record says to confirm avoidance is the barrier rather than a syndrome needing a different first-line treatment.`,
    };
  }
  if (driver === "Compulsions") {
    return {
      tone: "switch",
      label: "Use the more specific subtype",
      body: "Compulsions point to ERP rather than generic exposure. Exposure alone is described as usually not enough here.",
    };
  }
  if (driver === "Trauma memories") {
    return {
      tone: "switch",
      label: "Use the trauma-focused protocol",
      body: "Exposure is the active ingredient, but prolonged exposure or CPT is the better named treatment for this driver.",
    };
  }
  if (driver === "Low mood") {
    return {
      tone: "modify",
      label: "Behavioural activation first",
      body: "Where withdrawal and inactivity dominate, BA is ranked 5 in this list and targets the mechanism more directly.",
    };
  }
  if (capacity === "Single session") {
    return {
      tone: "modify",
      label: "Good fit, brief version only",
      body: "Steps 1 to 3, formulation, feared cues and hierarchy, fit a 15 minute slot. Book the exposure series before starting step 4.",
    };
  }
  return {
    tone: "good",
    label: "Good fit for this presentation",
    body: "Avoidance-maintained anxiety in outpatient care is the record's strongest use. NICE describes 7 to 14 hours for panic, weekly, within 4 months.",
  };
}

function VerdictBanner({ verdict }: { verdict: Verdict }) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        verdict.tone === "good"
          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]"
          : "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)]",
      )}
    >
      <Eyebrow tone={verdict.tone === "good" ? "accent" : "warning"}>Fit check</Eyebrow>
      <p
        className={cn(
          "m-0 mt-1 text-sm-minus font-bold",
          verdict.tone === "good" ? "text-[color:var(--clinical-accent)]" : "text-[color:var(--warning-text)]",
        )}
      >
        {verdict.label}
      </p>
      <p
        className={cn(
          "m-0 mt-1 text-2xs leading-4 font-semibold",
          verdict.tone === "good" ? "text-[color:var(--text-muted)]" : "text-[color:var(--warning-text)]",
        )}
      >
        {verdict.body}
      </p>
    </div>
  );
}

function FitCheck({
  driver,
  setDriver,
  capacity,
  setCapacity,
  flags,
  setFlags,
}: {
  driver: string;
  setDriver: (next: string) => void;
  capacity: string;
  setCapacity: (next: string) => void;
  flags: string[];
  setFlags: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <SegmentedField
        label="What is maintaining it"
        options={["Avoidance", "Compulsions", "Trauma memories", "Low mood"]}
        value={driver}
        onChange={setDriver}
      />
      <SegmentedField
        label="Sessions available"
        options={["Single session", "6 to 12 sessions", "Open ended"]}
        value={capacity}
        onChange={setCapacity}
      />
      <div>
        <Eyebrow>Present on assessment</Eyebrow>
        <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
          {RISK_FLAGS.map((flag) => (
            <CheckRow
              key={flag}
              label={flag}
              checked={flags.includes(flag)}
              onChange={(checked) => setFlags(checked ? [...flags, flag] : flags.filter((item) => item !== flag))}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function PanelTabs({ tab, onChange }: { tab: TabId; onChange: (next: TabId) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Therapy record sections"
      className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-[color:var(--border)] bg-[color:var(--surface)] px-1"
    >
      {TABS.map((id) => {
        const Icon = TAB_ICONS[id];
        const active = id === tab;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={cn(
              "my-1.5 inline-flex min-h-12 shrink-0 items-center gap-1 rounded-lg px-1.5 text-2xs font-bold transition",
              active
                ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                : "text-[color:var(--text-soft)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
              focusRing,
            )}
          >
            <Icon aria-hidden="true" size={13} strokeWidth={2} />
            {TAB_LABELS_SHORT[id]}
          </button>
        );
      })}
    </div>
  );
}

function PanelBody({
  tab,
  driver,
  setDriver,
  capacity,
  setCapacity,
  flags,
  setFlags,
}: {
  tab: TabId;
  driver: string;
  setDriver: (next: string) => void;
  capacity: string;
  setCapacity: (next: string) => void;
  flags: string[];
  setFlags: (next: string[]) => void;
}) {
  if (tab === "overview") return <OverviewBlock />;
  if (tab === "deliver") return <StepList />;
  if (tab === "cautions") return <CautionBlock />;
  if (tab === "sources") return <SourceBlock />;
  return (
    <div className="flex flex-col gap-4">
      <FitCheck
        driver={driver}
        setDriver={setDriver}
        capacity={capacity}
        setCapacity={setCapacity}
        flags={flags}
        setFlags={setFlags}
      />
      <FactGrid columns={1} />
    </div>
  );
}

function usePanelState() {
  const [index, setIndex] = useState(0);
  const [tab, setTab] = useState<TabId>("fit");
  const [driver, setDriver] = useState("Avoidance");
  const [capacity, setCapacity] = useState("6 to 12 sessions");
  const [flags, setFlags] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const verdict = useMemo(() => verdictFor(driver, capacity, flags), [driver, capacity, flags]);
  return {
    index,
    setIndex,
    tab,
    setTab,
    driver,
    setDriver,
    capacity,
    setCapacity,
    flags,
    setFlags,
    saved,
    setSaved,
    verdict,
  };
}

function StepperHeader({
  index,
  onStep,
  onClose,
  saved,
  onToggleSave,
}: {
  index: number;
  onStep: (delta: number) => void;
  onClose: () => void;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const match = RANKED[index];
  return (
    <header className="shrink-0 border-b border-[color:var(--border)] bg-[color:var(--surface)]">
      <div className="flex items-center gap-1.5 border-b border-[color:var(--border)] px-2.5 py-1.5">
        <button
          type="button"
          onClick={() => onStep(-1)}
          className={cn(
            "grid size-tap place-items-center rounded-lg border border-[color:var(--border)] text-[color:var(--text-muted)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
            focusRing,
          )}
        >
          <ChevronLeft aria-hidden="true" size={16} strokeWidth={2} />
          <span className="sr-only">Previous match</span>
        </button>
        <span className="nums text-3xs font-extrabold text-[color:var(--text-soft)]">
          Match {index + 1} of {RANKED.length}
        </span>
        <button
          type="button"
          onClick={() => onStep(1)}
          className={cn(
            "grid size-tap place-items-center rounded-lg border border-[color:var(--border)] text-[color:var(--text-muted)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
            focusRing,
          )}
        >
          <ChevronRight aria-hidden="true" size={16} strokeWidth={2} />
          <span className="sr-only">Next match</span>
        </button>
        <span className="ml-auto flex items-center gap-1.5">
          <FavouriteButton saved={saved} onToggle={onToggleSave} />
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "grid size-tap place-items-center rounded-lg border border-[color:var(--border)] text-[color:var(--text-muted)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
              focusRing,
            )}
          >
            <X aria-hidden="true" size={16} strokeWidth={2} />
            <span className="sr-only">Close panel</span>
          </button>
        </span>
      </div>
      <div className="flex items-start gap-2.5 px-3.5 py-3">
        <RankChip rank={match.rank} />
        <div className="min-w-0">
          <h2 className="m-0 text-sm font-semibold leading-snug tracking-[-0.02em] text-[color:var(--text-heading)]">
            {match.name}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-3xs font-bold text-[color:var(--text-soft)]">{match.category}</span>
            <ReviewChip compact />
          </div>
        </div>
      </div>
    </header>
  );
}

function PanelActions({ stacked = false }: { stacked?: boolean }) {
  return (
    <footer className="shrink-0 border-t border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3 py-2.5">
      <div className={cn("grid gap-2", stacked ? "grid-cols-3" : "grid-cols-3")}>
        <PrimaryButton icon={ExternalLink}>Open</PrimaryButton>
        <GhostButton icon={Scale}>Compare</GhostButton>
        <GhostButton icon={FileText}>Sheet</GhostButton>
      </div>
      <AdvisoryLine className="mt-2" />
    </footer>
  );
}

function DesktopScene() {
  const state = usePanelState();
  const [open, setOpen] = useState(true);

  const step = (delta: number) => state.setIndex((prev) => (prev + delta + RANKED.length) % RANKED.length);

  return (
    <DesktopFrame>
      <div className="flex h-full flex-col">
        <TopBar />
        <div className="flex min-h-0 flex-1">
          <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-5 transition", open ? "opacity-60" : "")}>
            <div className="mx-auto max-w-[38rem]">
              <ScenarioHeader />
              <RankedList
                activeSlug={open ? RANKED[state.index].slug : null}
                onOpen={(slug) => {
                  state.setIndex(RANKED.findIndex((item) => item.slug === slug));
                  setOpen(true);
                }}
              />
            </div>
          </div>
          {open ? (
            <aside
              aria-label="Therapy record panel"
              className="flex w-[25rem] shrink-0 animate-dialog-rise flex-col border-l border-[color:var(--border-strong)] bg-[color:var(--background)] shadow-[var(--shadow-lux)]"
            >
              <StepperHeader
                index={state.index}
                onStep={step}
                onClose={() => setOpen(false)}
                saved={state.saved}
                onToggleSave={() => state.setSaved(!state.saved)}
              />
              <div className="shrink-0 border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2.5">
                <VerdictBanner verdict={state.verdict} />
              </div>
              <PanelTabs tab={state.tab} onChange={state.setTab} />
              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                <PanelBody {...state} />
              </div>
              <PanelActions />
            </aside>
          ) : null}
        </div>
      </div>
    </DesktopFrame>
  );
}

function PhoneScene({ caption, expanded: initialExpanded }: { caption: string; expanded: boolean }) {
  const state = usePanelState();
  const [expanded, setExpanded] = useState(initialExpanded);
  const [open, setOpen] = useState(true);

  const step = (delta: number) => state.setIndex((prev) => (prev + delta + RANKED.length) % RANKED.length);

  return (
    <PhoneFrame caption={caption}>
      <TopBar phone />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <ScenarioHeader compact />
        <RankedList
          activeSlug={open ? RANKED[state.index].slug : null}
          onOpen={(slug) => {
            state.setIndex(RANKED.findIndex((item) => item.slug === slug));
            setOpen(true);
          }}
          dense
        />
      </div>
      {open ? (
        <div className="absolute inset-0 z-[100] flex items-end">
          <button
            type="button"
            aria-label="Close panel"
            onClick={() => setOpen(false)}
            className={cn(
              "absolute inset-0 animate-overlay-in bg-[color:var(--neutral-950)]/50",
              expanded ? "" : "bg-[color:var(--neutral-950)]/25",
            )}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Therapy record panel"
            className={cn(
              "relative flex w-full animate-sheet-up flex-col overflow-hidden rounded-t-[1.25rem] border-t border-[color:var(--border-strong)] bg-[color:var(--background)] shadow-[var(--shadow-lux)] transition-[max-height]",
              expanded ? "max-h-[92%]" : "max-h-[66%]",
            )}
          >
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              aria-expanded={expanded}
              className={cn("flex shrink-0 justify-center bg-[color:var(--surface)] pt-2 pb-1.5", focusRing)}
            >
              <span aria-hidden="true" className="h-1 w-9 rounded-full bg-[color:var(--border-strong)]" />
              <span className="sr-only">{expanded ? "Collapse panel" : "Expand panel"}</span>
            </button>
            <StepperHeader
              index={state.index}
              onStep={step}
              onClose={() => setOpen(false)}
              saved={state.saved}
              onToggleSave={() => state.setSaved(!state.saved)}
            />
            <div className="shrink-0 border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2.5">
              <VerdictBanner verdict={state.verdict} />
            </div>
            {expanded ? (
              <>
                <PanelTabs tab={state.tab} onChange={state.setTab} />
                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                  <PanelBody {...state} />
                </div>
              </>
            ) : (
              <div className="shrink-0 px-3 py-2.5">
                <p className="m-0 text-2xs font-semibold text-[color:var(--text-muted)]">
                  Pull up for the record, the delivery steps and the cautions.
                </p>
              </div>
            )}
            <PanelActions stacked />
          </div>
        </div>
      ) : null}
    </PhoneFrame>
  );
}

export function TherapyRecommendPopupTriageMockup() {
  return (
    <StudyPage
      eyebrow="Therapy · Recommend · Direction B"
      title="Docked triage panel"
      lede="The record opens beside the ranking, not over it. A stepper walks matches 1 to 6 without closing anything, and the fit check at the top turns four inputs into a verdict for this patient before the record is read. On a phone it is a two-stage sheet: peek for the verdict and the actions, pull up for the record."
      points={[
        {
          label: "Best for",
          body: "Working down the shortlist. The ranking stays on screen and the panel changes under it.",
        },
        {
          label: "Entry point",
          body: "Fit check drives a live verdict: maintaining mechanism, session capacity and four assessment flags.",
        },
        {
          label: "Trade-off",
          body: "The reading column is narrower than a dialog, so long source text scrolls more.",
        },
      ]}
    >
      <FrameBlock
        label="Desktop"
        size="Panel 400px, list stays live at 60% opacity"
        note="Try changing the maintaining mechanism to Compulsions, or ticking Active psychosis. The verdict rewrites itself from the record's own cautions rather than from a rule invented for the mockup."
      >
        <DesktopScene />
      </FrameBlock>

      <FrameBlock
        label="Phone"
        size="390px viewport, sheet at 66% then 92%"
        note="Tap the grab handle to move between the two snap points. The verdict and the three actions are readable without expanding."
      >
        <div className="flex flex-wrap gap-6">
          <PhoneScene caption="Phone · Peek, verdict only" expanded={false} />
          <PhoneScene caption="Phone · Expanded, fit check" expanded />
        </div>
      </FrameBlock>
    </StudyPage>
  );
}
