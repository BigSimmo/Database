"use client";

import { ChevronUp, Plus, Search, X } from "lucide-react";
import { useId } from "react";

import { cn } from "@/components/ui-primitives";

import {
  CATEGORY_COUNT,
  ContentSkeleton,
  CurrentDefects,
  DeviceFrame,
  MAX_COMPARE,
  MockupSection,
  MockupShell,
  NoteCard,
  PATHWAY_COUNT,
  REVIEW_COUNT,
  THERAPY_COUNT,
  UniversalTopBar,
  compareBasket,
  destinationsIn,
  focusRing,
  selectedTherapy,
  type TherapyFixture,
} from "./shared";

/* ------------------------------------------------------------------ *
 * Direction C — Working-set dock.
 *
 * Navigation is a readout of what you are carrying. The library shrinks to
 * a search-first strip, and the persistent surface is the working set: the
 * record you have open, the compare basket with its four slots drawn, and
 * the artifacts those two produce. You move by acting on what you hold.
 * ------------------------------------------------------------------ */

const LIBRARY = destinationsIn("library");
const THERAPY_ACTIONS = destinationsIn("therapy");

function SearchField({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3",
        compact ? "h-10" : "h-11",
      )}
    >
      <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-[color:var(--text-soft)]" />
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-[color:var(--text-soft)]">
        Search {THERAPY_COUNT} therapies…
      </span>
    </div>
  );
}

function LibraryLinks({ activeId }: { activeId: string }) {
  return (
    <ul className="mt-2 space-y-0.5">
      {LIBRARY.filter((destination) => destination.id !== "search").map((destination) => {
        const Icon = destination.icon;
        const active = destination.id === activeId;
        return (
          <li key={destination.id}>
            <button
              type="button"
              onClick={() => undefined}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 text-left transition",
                focusRing,
                active
                  ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                  : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
              )}
            >
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-xs font-semibold">{destination.label}</span>
              <span className="nums shrink-0 text-3xs font-bold text-[color:var(--text-soft)]">{destination.meta}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Four slots, always drawn. An empty slot is a slot, not an absence. */
function CompareTray({ horizontal = false }: { horizontal?: boolean }) {
  const empties = Math.max(0, MAX_COMPARE - compareBasket.length);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 px-0.5">
        <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">Compare basket</p>
        <p className="nums text-3xs font-bold text-[color:var(--text-soft)]">
          {compareBasket.length}/{MAX_COMPARE}
        </p>
      </div>
      <ul className={cn("mt-1.5 gap-1", horizontal ? "flex items-center" : "space-y-1")}>
        {compareBasket.map((therapy: TherapyFixture) => (
          <li key={therapy.short} className={horizontal ? "min-w-0" : undefined}>
            <span
              className={cn(
                "flex min-h-11 items-center gap-1.5 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2",
                horizontal ? "max-w-[7.5rem]" : "w-full",
              )}
            >
              <span className="min-w-0 flex-1 truncate text-3xs font-black text-[color:var(--clinical-accent)]">
                {horizontal ? therapy.short : therapy.name}
              </span>
              <span
                aria-hidden="true"
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[color:var(--clinical-accent)]"
              >
                <X className="h-3 w-3" />
              </span>
            </span>
          </li>
        ))}
        {Array.from({ length: empties }, (_, slot) => (
          <li key={`empty-${slot}`}>
            <span
              className={cn(
                "flex min-h-11 items-center gap-1.5 rounded-lg border border-dashed border-[color:var(--border-strong)] px-2 text-3xs font-semibold text-[color:var(--text-soft)]",
                horizontal ? "w-[5.5rem]" : "w-full",
              )}
            >
              <Plus aria-hidden="true" className="h-3 w-3 shrink-0" />
              <span className="truncate">Empty slot</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SelectedTherapyCard({ activeId }: { activeId: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-2.5">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-3xs font-black text-[color:var(--clinical-accent)]">
          {selectedTherapy.short}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-bold text-[color:var(--text-heading)]">
            {selectedTherapy.name}
          </span>
          <span className="block truncate text-3xs font-semibold text-[color:var(--text-soft)]">
            {selectedTherapy.category}
          </span>
        </span>
      </div>
      <ul className="mt-2 space-y-0.5 border-t border-[color:var(--border)] pt-2">
        {THERAPY_ACTIONS.map((destination) => {
          const Icon = destination.icon;
          const active = destination.id === activeId;
          return (
            <li key={destination.id}>
              <button
                type="button"
                onClick={() => undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2 text-left transition",
                  focusRing,
                  active
                    ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                    : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
                )}
              >
                <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold">{destination.label}</span>
                {destination.meta ? (
                  <span className="shrink-0 text-3xs font-bold text-[color:var(--text-soft)]">{destination.meta}</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ReviewCounter() {
  return (
    <button
      type="button"
      onClick={() => undefined}
      className={cn(
        "flex min-h-11 w-full items-center gap-2 rounded-lg border border-[color:var(--border)] px-2.5 text-left",
        focusRing,
      )}
    >
      <span className="min-w-0 flex-1 truncate text-3xs font-bold text-[color:var(--text-muted)]">Review queue</span>
      <span className="nums shrink-0 rounded-full bg-[color:var(--surface-subtle)] px-1.5 py-0.5 text-3xs font-black text-[color:var(--text-soft)]">
        {REVIEW_COUNT}
      </span>
    </button>
  );
}

function EmptyWorkingSet() {
  return (
    <div className="rounded-xl border border-dashed border-[color:var(--border-strong)] p-3">
      <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
        Your working set is empty
      </p>
      <p className="mt-1 text-3xs leading-4 text-[color:var(--text-soft)]">
        Open a therapy and it appears here with its brief intervention and patient sheet. Add up to {MAX_COMPARE} to the
        basket and Compare turns on.
      </p>
    </div>
  );
}

/* -- Desktop and tablet ------------------------------------------------- */

function DesktopFrame({ empty = false }: { empty?: boolean }) {
  return (
    <DeviceFrame
      device="desktop"
      label={empty ? "Desktop · 1440 px · empty working set" : "Desktop · 1440 px · carrying three"}
      note={
        empty
          ? "Before anything is selected the rail is only a library, and the dock says plainly what it is for. Nothing is greyed out to imply a broken feature."
          : "The library is the top third and never grows. The bottom two thirds are a live readout: ACT with its own artifacts, the basket with three of four slots filled and the fourth drawn, and the review counter."
      }
    >
      <UniversalTopBar device="desktop" />
      <div className="flex min-h-0 flex-1">
        <nav
          aria-label="Therapy navigation"
          className="flex w-[16.25rem] shrink-0 flex-col border-r border-[color:var(--border)] bg-[color:var(--surface)]"
        >
          <div className="shrink-0 p-3">
            <SearchField />
            <LibraryLinks activeId={empty ? "browse" : ""} />
          </div>
          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto border-t border-[color:var(--border)] bg-[color:var(--surface-subtle)]/60 p-3">
            <p className="px-0.5 text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--clinical-accent)]">
              Working set
            </p>
            {empty ? (
              <EmptyWorkingSet />
            ) : (
              <>
                <SelectedTherapyCard activeId="brief" />
                <CompareTray />
                <ReviewCounter />
              </>
            )}
          </div>
        </nav>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[color:var(--background)]">
          <ContentSkeleton
            eyebrow={empty ? "Library" : selectedTherapy.short}
            title={empty ? `Browse ${CATEGORY_COUNT} categories` : "Brief intervention · 5 minutes"}
            blocks={2}
          />
        </div>
      </div>
    </DeviceFrame>
  );
}

function TabletFrame() {
  return (
    <DeviceFrame
      device="tablet"
      label="Tablet · 768 px"
      note="The two halves split apart: the library becomes a quiet top strip, and the working set becomes a bottom tray. The basket lays out horizontally with short names, and the fourth slot is still drawn."
    >
      <UniversalTopBar device="tablet" />
      <div className="flex shrink-0 items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2">
        <span className="min-w-0 flex-1">
          <SearchField compact />
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {LIBRARY.filter((destination) => destination.id !== "search").map((destination) => {
            const Icon = destination.icon;
            return (
              <span
                key={destination.id}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-3xs font-bold text-[color:var(--text-muted)]"
              >
                <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                {destination.label === "Browse by category" ? "Browse" : destination.label}
              </span>
            );
          })}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-[color:var(--background)]">
        <ContentSkeleton eyebrow={selectedTherapy.short} title="Brief intervention · 5 minutes" compact blocks={2} />
      </div>
      <div className="shrink-0 border-t border-[color:var(--border)] bg-[color:var(--surface)] p-2.5">
        <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-3">
          <SelectedTherapyCard activeId="brief" />
          <div className="space-y-2">
            <CompareTray horizontal />
            <ReviewCounter />
          </div>
        </div>
      </div>
    </DeviceFrame>
  );
}

/* -- Phone -------------------------------------------------------------- */

type PhoneState = "rest" | "expanded" | "empty" | "hidden";

function DockHandle({ expanded, trayId, empty }: { expanded: boolean; trayId: string; empty: boolean }) {
  return (
    <button
      type="button"
      onClick={() => undefined}
      aria-expanded={expanded}
      aria-controls={trayId}
      className={cn(
        "flex min-h-[3.5rem] w-full items-center gap-2 px-3 pb-[env(safe-area-inset-bottom)] text-left",
        focusRing,
      )}
    >
      {empty ? (
        <>
          <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-[color:var(--text-soft)]" />
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-[color:var(--text-soft)]">
            Search {THERAPY_COUNT} therapies…
          </span>
        </>
      ) : (
        <>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-3xs font-black text-[color:var(--clinical-accent)]">
            {selectedTherapy.short}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-bold text-[color:var(--text-heading)]">
              {selectedTherapy.name}
            </span>
            <span className="block truncate text-3xs font-semibold text-[color:var(--text-soft)]">
              Brief intervention · basket {compareBasket.length}/{MAX_COMPARE}
            </span>
          </span>
        </>
      )}
      <ChevronUp
        aria-hidden="true"
        className={cn("h-4 w-4 shrink-0 text-[color:var(--text-muted)]", expanded && "rotate-180")}
      />
    </button>
  );
}

function PhoneFrame({ state }: { state: PhoneState }) {
  const trayId = useId();
  const expanded = state === "expanded";
  const empty = state === "empty";
  const hidden = state === "hidden";

  return (
    <div className="relative flex h-full flex-col">
      {hidden ? null : <UniversalTopBar device="phone" />}
      <div className="min-h-0 flex-1 overflow-hidden bg-[color:var(--background)]">
        <ContentSkeleton
          eyebrow={empty ? "Library" : selectedTherapy.short}
          title={empty ? `Search ${THERAPY_COUNT} therapy records` : "Brief intervention · 5 minutes"}
          compact
          blocks={3}
        />
      </div>
      {expanded ? <span aria-hidden="true" className="absolute inset-0 z-40 bg-[color:var(--text-heading)]/35" /> : null}
      {hidden ? null : (
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 z-50 border-t border-[color:var(--border)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-lux)]",
            expanded && "rounded-t-[1rem] border-[color:var(--border-lux)]",
          )}
        >
          {expanded ? (
            <div id={trayId} className="max-h-[26rem] space-y-2.5 overflow-y-auto px-3 pt-2">
              <span
                aria-hidden="true"
                className="mx-auto mb-1 block h-1 w-9 rounded-full bg-[color:var(--border-strong)]/60"
              />
              <SelectedTherapyCard activeId="brief" />
              <CompareTray />
              <ReviewCounter />
              <div className="border-t border-[color:var(--border)] pt-2">
                <SearchField compact />
                <LibraryLinks activeId="" />
              </div>
            </div>
          ) : null}
          <DockHandle expanded={expanded} trayId={trayId} empty={empty} />
        </div>
      )}
    </div>
  );
}

const PHONE_STATES: Array<{ state: PhoneState; label: string; note: string }> = [
  {
    state: "rest",
    label: "At rest · one line",
    note: "The dock is a sentence: this is the record you are holding, this is what you are doing to it, this is how full the basket is. That is less chrome than seven pills and strictly more information.",
  },
  {
    state: "expanded",
    label: "Pulled up",
    note: "The whole working set: ACT with its artifacts, four basket slots with the fourth drawn empty, the review counter, and the library underneath because it is the least urgent thing here.",
  },
  {
    state: "empty",
    label: "Nothing held yet",
    note: "With an empty working set the dock is just the search field. No greyed-out actions implying a broken feature, and no silent retarget to a therapy you never chose.",
  },
  {
    state: "hidden",
    label: "Scrolled — chrome gone",
    note: "The dock hides with the universal header and releases its reserve to 0 rem, matching the phone chrome contract the rest of the app already keeps.",
  },
];

export function TherapyNavigationDockMockups() {
  return (
    <MockupShell
      current="therapy-navigation-dock"
      letter="C"
      name="Working-set dock"
      headline="Stop showing a menu. Show what you are carrying"
      intro="The library shrinks to a search field and four quiet links, because getting in is a one-off. The permanent surface is the working set — the therapy you have open with its own artifacts, the compare basket with all four slots drawn, and the review counter. Every destination in it is reachable because you are already holding the thing it acts on."
    >
      <CurrentDefects />

      <MockupSection
        id="dock-model-title"
        title="The model this direction commits to"
        intro="State is the navigation. Nothing in the working set is abstract — each row names a record you actually hold."
      >
        <div className="grid gap-2 lg:grid-cols-3">
          <NoteCard
            tone="accent"
            title="The basket is drawn, not counted"
            body={`All ${MAX_COMPARE} slots are visible at all times, filled or empty. A count in a badge tells you a number; four slots tell you how much room is left and what is in them.`}
          />
          <NoteCard
            tone="accent"
            title="Artifacts hang off their record"
            body="Brief intervention and Patient sheet live inside the ACT card, so they cannot be read as peers of Search — and cannot quietly open a different therapy's."
          />
          <NoteCard
            tone="accent"
            title="The library is deliberately quiet"
            body={`One search field plus category, recommend and pathways with their counts — ${CATEGORY_COUNT} and ${PATHWAY_COUNT}. You use it to arrive, not to work.`}
          />
        </div>
      </MockupSection>

      <MockupSection id="dock-wide-title" title="Desktop and tablet">
        <div className="space-y-6">
          <DesktopFrame />
          <DesktopFrame empty />
          <TabletFrame />
        </div>
      </MockupSection>

      <MockupSection
        id="dock-phone-title"
        title="Phone · 390 px"
        intro="One line at rest, the whole set on a pull, and an honest empty state."
      >
        <div className="flex flex-wrap gap-5">
          {PHONE_STATES.map((item) => (
            <DeviceFrame key={item.state} device="phone" label={item.label} note={item.note}>
              <PhoneFrame state={item.state} />
            </DeviceFrame>
          ))}
        </div>
      </MockupSection>

      <MockupSection id="dock-cost-title" title="What it costs">
        <div className="grid gap-2 sm:grid-cols-2">
          <NoteCard
            tone="warn"
            title="It is weakest on arrival"
            body="A first-time user with an empty working set sees the least navigation of the three directions, at exactly the moment they know the tool least."
          />
          <NoteCard
            tone="warn"
            title="It needs state it does not yet keep"
            body="The compare basket already survives between screens, but the selected therapy resets on a full reload. This direction only pays off if the working set is genuinely durable."
          />
        </div>
      </MockupSection>
    </MockupShell>
  );
}
