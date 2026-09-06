"use client";

import { useState } from "react";
import { ExternalLink, FileText, Scale, X } from "lucide-react";

import { cn } from "@/components/ui-primitives";

import {
  AdvisoryLine,
  CautionBlock,
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
 * Direction A — Clinical record dialog.
 *
 * One centred dialog that holds the whole record. Tabs run across the
 * top, the actions are pinned to a footer bar that never scrolls away,
 * and the phone form is the same dialog as a near-full-height bottom
 * sheet. The scenario and the ranked list stay behind it, so closing
 * returns the reader to the exact row they opened.
 * ------------------------------------------------------------------ */

const TABS: TabId[] = ["overview", "deliver", "cautions", "fit", "sources"];

function TabPanel({ tab }: { tab: TabId }) {
  if (tab === "overview") return <OverviewBlock />;
  if (tab === "deliver")
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-[color:var(--info-border)] bg-[color:var(--info-soft)] px-3 py-2">
          <Eyebrow>Brief version</Eyebrow>
          <p className="m-0 mt-1 text-2xs font-semibold leading-4 text-[color:var(--text-muted)]">
            Steps 1 to 3 are deliverable in a 15 minute outpatient slot. Steps 4 onward need a booked series.
          </p>
        </div>
        <StepList />
      </div>
    );
  if (tab === "cautions") return <CautionBlock />;
  if (tab === "sources") return <SourceBlock />;
  return <FitPanel />;
}

/** The one tab that collects input: the episode is set up before the popup closes. */
function FitPanel() {
  const [driver, setDriver] = useState("Avoidance");
  const [capacity, setCapacity] = useState("6 to 12 sessions");
  const [target, setTarget] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <FactGrid />
      <div className="rounded-xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] p-3">
        <Eyebrow tone="accent">Set up this episode</Eyebrow>
        <p className="m-0 mt-1 mb-3 text-2xs font-semibold leading-4 text-[color:var(--text-muted)]">
          Entered here, carried into the plan and the patient sheet. Nothing is stored against a patient.
        </p>
        <div className="flex flex-col gap-3">
          <SegmentedField
            label="Main maintaining mechanism"
            options={["Avoidance", "Rumination", "Withdrawal", "Compulsions"]}
            value={driver}
            onChange={setDriver}
          />
          <SegmentedField
            label="Session capacity"
            options={["Single session", "6 to 12 sessions", "Open ended"]}
            value={capacity}
            onChange={setCapacity}
          />
          <div>
            <FieldLabel htmlFor="dossier-target">First exposure target</FieldLabel>
            <input
              id="dossier-target"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder="e.g. catching the bus to the clinic without a companion"
              className={cn(
                "mt-1.5 min-h-12 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-2xs font-semibold text-[color:var(--text)] placeholder:text-[color:var(--text-soft)]",
                focusRing,
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function TabRail({ tab, onChange, phone = false }: { tab: TabId; onChange: (next: TabId) => void; phone?: boolean }) {
  return (
    <div
      role="tablist"
      aria-label="Therapy record sections"
      className={cn(
        "flex shrink-0 items-stretch gap-1 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-2",
        phone ? "overflow-x-auto" : "",
      )}
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

function DialogHeader({ slug, onClose, phone = false }: { slug: string; onClose: () => void; phone?: boolean }) {
  const [saved, setSaved] = useState(false);
  const match = RANKED.find((item) => item.slug === slug) ?? RANKED[0];

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
        </div>
      </div>
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

function ActionBar({ phone = false }: { phone?: boolean }) {
  return (
    <footer className="shrink-0 border-t border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3.5 py-2.5">
      <div className={cn("flex gap-2", phone ? "" : "items-center")}>
        <PrimaryButton icon={ExternalLink} className={phone ? "flex-1" : ""}>
          Open full record
        </PrimaryButton>
        <GhostButton icon={Scale} className={phone ? "flex-1" : ""}>
          Add to compare
        </GhostButton>
        <GhostButton icon={FileText} className={phone ? "flex-1" : ""}>
          {phone ? "Sheet" : "Patient sheet"}
        </GhostButton>
        {phone ? null : <AdvisoryLine className="ml-auto max-w-[22rem] text-right" />}
      </div>
      {phone ? <AdvisoryLine className="mt-2" /> : null}
    </footer>
  );
}

function DesktopDialog({ slug, onClose }: { slug: string; onClose: () => void }) {
  const [tab, setTab] = useState<TabId>("overview");

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center p-6">
      <button
        type="button"
        aria-label="Close record"
        onClick={onClose}
        className="absolute inset-0 animate-overlay-in bg-[color:var(--neutral-950)]/50 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Exposure-Based CBT record"
        className="relative flex h-full max-h-[34rem] w-full max-w-[52rem] animate-dialog-rise flex-col overflow-hidden rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--background)] shadow-[var(--shadow-lux)]"
      >
        <DialogHeader slug={slug} onClose={onClose} />
        <TabRail tab={tab} onChange={setTab} />
        <div className="min-h-0 flex-1 overflow-y-auto bg-[color:var(--background)] px-3.5 py-3.5">
          <TabPanel tab={tab} />
        </div>
        <ActionBar />
      </div>
    </div>
  );
}

function PhoneSheet({ slug, initialTab, onClose }: { slug: string; initialTab: TabId; onClose: () => void }) {
  const [tab, setTab] = useState<TabId>(initialTab);

  return (
    <div className="absolute inset-0 z-[100] flex items-end">
      <button
        type="button"
        aria-label="Close record"
        onClick={onClose}
        className="absolute inset-0 animate-overlay-in bg-[color:var(--neutral-950)]/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Exposure-Based CBT record"
        className="relative flex max-h-[93%] w-full animate-sheet-up flex-col overflow-hidden rounded-t-[1.25rem] border-t border-[color:var(--border-strong)] bg-[color:var(--background)] shadow-[var(--shadow-lux)]"
      >
        <div className="flex shrink-0 justify-center bg-[color:var(--surface)] pt-2 pb-1">
          <span aria-hidden="true" className="h-1 w-9 rounded-full bg-[color:var(--border-strong)]" />
        </div>
        <DialogHeader slug={slug} onClose={onClose} phone />
        <TabRail tab={tab} onChange={setTab} phone />
        <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5">
          <TabPanel tab={tab} />
        </div>
        <ActionBar phone />
      </div>
    </div>
  );
}

function DesktopScene() {
  const [open, setOpen] = useState<string | null>(RANKED[0].slug);

  return (
    <DesktopFrame>
      <div className="flex h-full flex-col">
        <TopBar />
        <div className="min-h-0 flex-1 overflow-y-auto bg-[color:var(--background)] px-6 py-5">
          <div className="mx-auto max-w-[44rem]">
            <ScenarioHeader />
            <RankedList activeSlug={open} onOpen={setOpen} />
          </div>
        </div>
      </div>
      {open ? <DesktopDialog slug={open} onClose={() => setOpen(null)} /> : null}
    </DesktopFrame>
  );
}

function PhoneScene({ caption, initialTab }: { caption: string; initialTab: TabId }) {
  const [open, setOpen] = useState<string | null>(RANKED[0].slug);

  return (
    <PhoneFrame caption={caption}>
      <TopBar phone />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <ScenarioHeader compact />
        <RankedList activeSlug={open} onOpen={setOpen} dense />
      </div>
      {open ? <PhoneSheet slug={open} initialTab={initialTab} onClose={() => setOpen(null)} /> : null}
    </PhoneFrame>
  );
}

export function TherapyRecommendPopupDossierMockup() {
  return (
    <StudyPage
      eyebrow="Therapy · Recommend · Direction A"
      title="Clinical record dialog"
      lede="The ranked row opens the whole record in one centred dialog. Tabs across the top, a footer action bar that never scrolls away, and the same dialog as a bottom sheet on a phone. Close returns to the row you opened, with the scenario and the ranking untouched."
      points={[
        {
          label: "Best for",
          body: "Reading one therapy properly before deciding. Everything the record holds is one tab away.",
        },
        {
          label: "Entry point",
          body: "Fit for patient carries the short episode setup: mechanism, session capacity, first exposure target.",
        },
        {
          label: "Trade-off",
          body: "Only one therapy is visible at a time. Moving between ranked matches means closing and reopening.",
        },
      ]}
    >
      <FrameBlock
        label="Desktop"
        size="Dialog 832px wide, capped at 544px tall"
        note="Click any ranked row to open it. The list stays mounted behind the scrim, so the ranking is never rebuilt."
      >
        <DesktopScene />
      </FrameBlock>

      <FrameBlock
        label="Phone"
        size="390px viewport, sheet at 93% height"
        note="Same dialog, docked to the bottom edge. The tab rail scrolls horizontally, and the action bar sits above the home indicator rather than floating over the content."
      >
        <div className="flex flex-wrap gap-6">
          <PhoneScene caption="Phone · Overview" initialTab="overview" />
          <PhoneScene caption="Phone · Fit for patient, with entry fields" initialTab="fit" />
          <PhoneScene caption="Phone · Cautions" initialTab="cautions" />
        </div>
      </FrameBlock>
    </StudyPage>
  );
}
