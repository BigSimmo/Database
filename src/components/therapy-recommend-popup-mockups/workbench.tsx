"use client";

import { useMemo, useState } from "react";
import { Check, ClipboardCopy, ExternalLink, FileText, Scale, X } from "lucide-react";

import { cn } from "@/components/ui-primitives";

import {
  AdvisoryLine,
  CautionBlock,
  CheckRow,
  DesktopFrame,
  Eyebrow,
  FactGrid,
  FavouriteButton,
  FieldLabel,
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
  TAB_LABELS,
  TopBar,
  focusRing,
  type TabId,
} from "./shared";

/* ------------------------------------------------------------------ *
 * Direction C — Consult workbench.
 *
 * The dialog is two columns: the record on the left, a plan builder on
 * the right that is always visible while reading. Ticking a plan item
 * writes a line into a note the reader copies into the record system.
 * On a phone the plan is a sixth tab with the copy bar pinned below it.
 * ------------------------------------------------------------------ */

const READING_TABS: TabId[] = ["overview", "deliver", "cautions", "fit", "sources"];
const PHONE_TABS: TabId[] = ["plan", "overview", "deliver", "cautions", "fit", "sources"];

const PLAN_ITEMS: Array<{ id: string; label: string; line: string }> = [
  {
    id: "formulation",
    label: "Behavioural formulation agreed",
    line: "Behavioural formulation agreed linking trigger, fear prediction, avoidance and short-term relief.",
  },
  {
    id: "hierarchy",
    label: "Graded hierarchy built",
    line: "Graded exposure hierarchy built with the patient, easiest to hardest.",
  },
  {
    id: "safety",
    label: "Safety behaviours identified",
    line: "Safety, escape and reassurance behaviours identified and agreed to be dropped.",
  },
  {
    id: "homework",
    label: "Between-session practice set",
    line: "Between-session exposure practice set with a written record of predictions and outcomes.",
  },
  {
    id: "sheet",
    label: "Patient sheet given",
    line: "Patient information sheet on exposure given and explained.",
  },
  {
    id: "screen",
    label: "Exclusions screened",
    line: "Screened for psychosis, delirium, unstable withdrawal and severe dissociation. None present.",
  },
];

function buildNote({ target, review, items }: { target: string; review: string; items: string[] }) {
  const lines = [
    "Therapy plan: Exposure-Based CBT / Exposure Therapy (OCD and Exposure Therapies).",
    "Indication: avoidance-maintained anxiety, outpatient setting.",
    target.trim() ? `First agreed exposure target: ${target.trim()}.` : "First agreed exposure target: to be set.",
    ...PLAN_ITEMS.filter((item) => items.includes(item.id)).map((item) => item.line),
    `Review: ${review}.`,
    "Source: uploaded therapy record, not clinically reviewed. Confirm against local guidance.",
  ];
  return lines.join("\n");
}

function PlanBuilder({
  target,
  setTarget,
  review,
  setReview,
  items,
  setItems,
  compact = false,
}: {
  target: string;
  setTarget: (next: string) => void;
  review: string;
  setReview: (next: string) => void;
  items: string[];
  setItems: (next: string[]) => void;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const note = useMemo(() => buildNote({ target, review, items }), [target, review, items]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-[color:var(--border)] px-3 py-2.5">
        <Eyebrow tone="accent">Plan for this patient</Eyebrow>
        <p className="m-0 mt-1 text-3xs font-semibold leading-4 text-[color:var(--text-soft)]">
          Nothing here is stored. It builds a note you paste into the record system.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="flex flex-col gap-3">
          <div>
            <FieldLabel htmlFor={`plan-target-${compact ? "phone" : "desktop"}`}>First exposure target</FieldLabel>
            <input
              id={`plan-target-${compact ? "phone" : "desktop"}`}
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder="e.g. supermarket at a quiet hour, no companion"
              className={cn(
                "mt-1.5 min-h-12 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-2xs font-semibold text-[color:var(--text)] placeholder:text-[color:var(--text-soft)]",
                focusRing,
              )}
            />
          </div>

          <SegmentedField
            label="Review"
            options={["2 weeks", "4 weeks", "6 weeks"]}
            value={review}
            onChange={setReview}
          />

          <div>
            <Eyebrow>Covered today</Eyebrow>
            <div className="mt-1.5 flex flex-col gap-1.5">
              {PLAN_ITEMS.map((item) => (
                <CheckRow
                  key={item.id}
                  label={item.label}
                  checked={items.includes(item.id)}
                  onChange={(checked) => setItems(checked ? [...items, item.id] : items.filter((id) => id !== item.id))}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Pinned, not scrolled: the note is the output of this column, so it has
          to be visible while the boxes above it are being ticked. */}
      <div className="shrink-0 border-t border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3 pt-2.5">
        <Eyebrow>Note preview</Eyebrow>
        <pre className="m-0 mt-1.5 max-h-28 overflow-y-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-2.5 text-3xs leading-4 font-semibold whitespace-pre-wrap text-[color:var(--text-muted)]">
          {note}
        </pre>
      </div>

      <div className="shrink-0 bg-[color:var(--surface-lux)] px-3 py-2.5">
        <PrimaryButton icon={copied ? Check : ClipboardCopy} className="w-full" onClick={() => setCopied(true)}>
          {copied ? "Copied to clipboard" : "Copy note"}
        </PrimaryButton>
      </div>
    </div>
  );
}

function ReadingTabs({ tab, onChange, tabs }: { tab: TabId; onChange: (next: TabId) => void; tabs: TabId[] }) {
  return (
    <div
      role="tablist"
      aria-label="Therapy record sections"
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-[color:var(--border)] bg-[color:var(--surface)] px-2"
    >
      {tabs.map((id) => {
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
              "relative inline-flex min-h-12 shrink-0 items-center gap-1.5 px-2.5 text-2xs font-bold transition",
              active
                ? "text-[color:var(--clinical-accent)]"
                : "text-[color:var(--text-soft)] hover:text-[color:var(--text)]",
              focusRing,
            )}
          >
            <Icon aria-hidden="true" size={13} strokeWidth={2} />
            {TAB_LABELS[id]}
            <span
              aria-hidden="true"
              className={cn(
                "absolute inset-x-1.5 bottom-0 h-0.5 rounded-full",
                active ? "bg-[color:var(--clinical-accent)]" : "bg-transparent",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

function ReadingPanel({ tab }: { tab: TabId }) {
  if (tab === "overview") return <OverviewBlock />;
  if (tab === "deliver") return <StepList />;
  if (tab === "cautions") return <CautionBlock />;
  if (tab === "sources") return <SourceBlock />;
  return <FactGrid />;
}

function WorkbenchHeader({ onClose, phone = false }: { onClose: () => void; phone?: boolean }) {
  const [saved, setSaved] = useState(false);
  const match = RANKED[0];

  return (
    <header className="flex shrink-0 items-start gap-2.5 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3.5 py-3">
      <RankChip rank={match.rank} />
      <div className="min-w-0 flex-1">
        <h2
          className={cn(
            "m-0 font-semibold leading-snug tracking-[-0.02em] text-[color:var(--text-heading)]",
            phone ? "text-sm" : "text-base",
          )}
        >
          {match.name}
        </h2>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="text-3xs font-bold text-[color:var(--text-soft)]">{match.category}</span>
          <ReviewChip compact />
          <span className="text-3xs font-bold text-[color:var(--text-soft)]">Best match for the current scenario</span>
        </div>
      </div>
      {phone ? null : (
        <span className="flex items-center gap-2">
          <GhostButton icon={ExternalLink}>Open record</GhostButton>
          <GhostButton icon={Scale}>Compare</GhostButton>
          <GhostButton icon={FileText}>Sheet</GhostButton>
        </span>
      )}
      <FavouriteButton saved={saved} onToggle={() => setSaved((prev) => !prev)} />
      <button
        type="button"
        onClick={onClose}
        className={cn(
          "grid size-tap shrink-0 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
          focusRing,
        )}
      >
        <X aria-hidden="true" size={16} strokeWidth={2} />
        <span className="sr-only">Close</span>
      </button>
    </header>
  );
}

function usePlanState() {
  const [target, setTarget] = useState("");
  const [review, setReview] = useState("4 weeks");
  const [items, setItems] = useState<string[]>(["formulation", "screen"]);
  return { target, setTarget, review, setReview, items, setItems };
}

function DesktopScene() {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<TabId>("overview");
  const plan = usePlanState();

  return (
    <DesktopFrame tall>
      <div className="flex h-full flex-col">
        <TopBar />
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="mx-auto max-w-[44rem]">
            <ScenarioHeader />
            <RankedList activeSlug={open ? RANKED[0].slug : null} onOpen={() => setOpen(true)} />
          </div>
        </div>
      </div>
      {open ? (
        <div className="absolute inset-0 z-[100] flex items-center justify-center p-5">
          <button
            type="button"
            aria-label="Close record"
            onClick={() => setOpen(false)}
            className="absolute inset-0 animate-overlay-in bg-[color:var(--neutral-950)]/50 backdrop-blur-[2px]"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Exposure-Based CBT workbench"
            className="relative flex h-full w-full max-w-[62rem] animate-dialog-rise flex-col overflow-hidden rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--background)] shadow-[var(--shadow-lux)]"
          >
            <WorkbenchHeader onClose={() => setOpen(false)} />
            <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_22rem]">
              <div className="flex min-h-0 flex-col border-r border-[color:var(--border)]">
                <ReadingTabs tab={tab} onChange={setTab} tabs={READING_TABS} />
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                  <ReadingPanel tab={tab} />
                </div>
                <div className="shrink-0 border-t border-[color:var(--border)] bg-[color:var(--surface-lux)] px-4 py-2">
                  <AdvisoryLine />
                </div>
              </div>
              <div className="min-h-0 bg-[color:var(--surface-subtle)]">
                <PlanBuilder {...plan} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </DesktopFrame>
  );
}

function PhoneScene({ caption, initialTab }: { caption: string; initialTab: TabId }) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<TabId>(initialTab);
  const plan = usePlanState();

  return (
    <PhoneFrame caption={caption}>
      <TopBar phone />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <ScenarioHeader compact />
        <RankedList activeSlug={open ? RANKED[0].slug : null} onOpen={() => setOpen(true)} dense />
      </div>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Exposure-Based CBT workbench"
          className="absolute inset-0 z-[100] flex animate-sheet-up flex-col bg-[color:var(--background)]"
        >
          <WorkbenchHeader onClose={() => setOpen(false)} phone />
          <ReadingTabs tab={tab} onChange={setTab} tabs={PHONE_TABS} />
          {tab === "plan" ? (
            <div className="min-h-0 flex-1 bg-[color:var(--surface-subtle)]">
              <PlanBuilder {...plan} compact />
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5">
                <ReadingPanel tab={tab} />
              </div>
              <footer className="shrink-0 border-t border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3 py-2.5">
                <div className="grid grid-cols-3 gap-2">
                  <PrimaryButton icon={ClipboardCopy} onClick={() => setTab("plan")}>
                    Plan
                  </PrimaryButton>
                  <GhostButton icon={ExternalLink}>Open</GhostButton>
                  <GhostButton icon={FileText}>Sheet</GhostButton>
                </div>
                <AdvisoryLine className="mt-2" />
              </footer>
            </>
          )}
        </div>
      ) : null}
    </PhoneFrame>
  );
}

export function TherapyRecommendPopupWorkbenchMockup() {
  return (
    <StudyPage
      eyebrow="Therapy · Recommend · Direction C"
      title="Consult workbench"
      lede="A wide dialog split in two: the record on the left, a plan builder on the right that stays visible while you read. Ticking what you covered writes the note, and the note is copied out in one action. On a phone the plan is the first tab and the copy bar is pinned under it."
      points={[
        {
          label: "Best for",
          body: "Using the therapy in the room. Reading and documenting happen in the same surface.",
        },
        {
          label: "Entry point",
          body: "Target, review interval and six covered-today items, assembled into a paste-ready note.",
        },
        {
          label: "Trade-off",
          body: "The widest of the three. Below about 1100px the plan column has to become a tab, as it does on the phone.",
        },
      ]}
    >
      <FrameBlock
        label="Desktop"
        size="Dialog 992px wide, plan column 352px"
        note="Type a target and tick a few items. The note preview rewrites as you go, and Copy note is the only filled button in the plan column."
      >
        <DesktopScene />
      </FrameBlock>

      <FrameBlock
        label="Phone"
        size="390px viewport, full-screen takeover"
        note="No scrim and no bottom sheet: at this width the record earns the whole screen. Plan leads the tab rail because that is what the phone case is for."
      >
        <div className="flex flex-wrap gap-6">
          <PhoneScene caption="Phone · Plan tab, note building" initialTab="plan" />
          <PhoneScene caption="Phone · Overview, plan one tap away" initialTab="overview" />
        </div>
      </FrameBlock>
    </StudyPage>
  );
}
