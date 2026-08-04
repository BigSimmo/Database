"use client";

import { ArrowLeft, ChevronDown, Columns3, Search } from "lucide-react";
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
  destinations,
  focusRing,
  selectedTherapy,
  type Destination,
} from "./shared";

/* ------------------------------------------------------------------ *
 * Direction B — Context row and jump sheet.
 *
 * The pill row is deleted. In its place, one two-line row that answers
 * "where am I" and one panel that answers "where else can I go". The row
 * is the document-navigation study's contract applied to a tool: it hides
 * with the universal header, releases its reserve to zero, and returns
 * already correct.
 * ------------------------------------------------------------------ */

/** Therapy is a sequence of jobs, so the track is the job, not the menu. */
type Stage = {
  id: string;
  label: string;
  /** Share of the job, used to weight the track. Sequence is not progress. */
  weight: number;
  destinationIds: string[];
};

const STAGES: Stage[] = [
  { id: "find", label: "Find", weight: 4, destinationIds: ["search", "browse", "recommend", "pathways"] },
  { id: "choose", label: "Choose", weight: 2.5, destinationIds: ["compare", "detail"] },
  { id: "deliver", label: "Deliver", weight: 2, destinationIds: ["brief"] },
  { id: "handover", label: "Hand over", weight: 1.5, destinationIds: ["sheets"] },
];

function byId(id: string): Destination {
  const found = destinations.find((destination) => destination.id === id);
  if (!found) throw new Error(`Unknown destination: ${id}`);
  return found;
}

function stageOf(destinationId: string): Stage {
  return STAGES.find((stage) => stage.destinationIds.includes(destinationId)) ?? STAGES[0];
}

/** Weighted segments: width is the stage's share of the job, not 1/n. */
function StageTrack({ activeId }: { activeId: string }) {
  const activeStage = stageOf(activeId);
  const activeIndex = STAGES.findIndex((stage) => stage.id === activeStage.id);

  return (
    <span aria-hidden="true" className="absolute inset-x-0 bottom-0 flex items-end gap-px px-1.5">
      {STAGES.map((stage, index) => (
        <span
          key={stage.id}
          style={{ flexGrow: stage.weight }}
          className={cn(
            "min-w-[6px] flex-shrink rounded-full",
            index === activeIndex
              ? "h-[3px] bg-[color:var(--clinical-accent)]"
              : index < activeIndex
                ? "h-0.5 bg-[color:var(--clinical-accent)]/40"
                : "h-0.5 bg-[color:var(--border-strong)]/35",
          )}
        />
      ))}
    </span>
  );
}

/**
 * Line one names the record when one is open and the workspace when none is.
 * A workspace context never borrows a therapy name it does not have.
 */
function ContextRow({
  device,
  activeId,
  expanded,
  panelId,
  workspace = false,
}: {
  device: "desktop" | "tablet" | "phone";
  activeId: string;
  expanded: boolean;
  panelId: string;
  workspace?: boolean;
}) {
  const phone = device === "phone";
  const destination = byId(activeId);
  const stage = stageOf(activeId);
  const DestinationIcon = destination.icon;

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center gap-1 border-b border-[color:var(--border)] bg-[color:var(--surface)]",
        phone ? "h-14 px-1.5" : "h-[3.75rem] px-2 sm:px-3",
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center gap-1.5 rounded-full text-[color:var(--text-muted)]",
          phone ? "h-11 w-10 justify-center" : "h-11 px-2 text-sm font-semibold",
        )}
      >
        <ArrowLeft aria-hidden="true" className="h-5 w-5" />
        {phone ? null : <span>Therapy</span>}
      </span>
      <button
        type="button"
        onClick={() => undefined}
        aria-expanded={expanded}
        aria-controls={panelId}
        className={cn("flex min-h-11 min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1 text-left", focusRing)}
      >
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate font-semibold leading-tight text-[color:var(--text-heading)]",
              phone ? "text-sm-minus" : "text-base-minus",
            )}
          >
            {workspace ? `Compare · ${compareBasket.length} of ${MAX_COMPARE}` : selectedTherapy.name}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-3xs font-bold text-[color:var(--clinical-accent)]">
            <DestinationIcon aria-hidden="true" className="h-3 w-3 shrink-0" />
            <span className="min-w-0 truncate">
              {stage.label} · {destination.label}
            </span>
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn("h-3.5 w-3.5 shrink-0 text-[color:var(--text-muted)]", expanded && "rotate-180")}
        />
      </button>
      <span
        className={cn(
          "nums flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--border)] px-2 text-3xs font-bold text-[color:var(--text-soft)]",
          phone ? "h-8" : "h-9",
        )}
      >
        <Columns3 aria-hidden="true" className="h-3 w-3" />
        {compareBasket.length}/{MAX_COMPARE}
      </span>
      <StageTrack activeId={activeId} />
    </div>
  );
}

function DestinationRow({ destination, active }: { destination: Destination; active: boolean }) {
  const Icon = destination.icon;

  return (
    <li>
      <button
        type="button"
        onClick={() => undefined}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 text-left transition",
          focusRing,
          active
            ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
            : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
        )}
      >
        {active ? (
          <span
            aria-hidden="true"
            className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-[color:var(--clinical-accent)]"
          />
        ) : null}
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-xs font-bold">{destination.label}</span>
        {destination.meta ? (
          <span className="nums shrink-0 text-3xs font-semibold text-[color:var(--text-soft)]">{destination.meta}</span>
        ) : null}
      </button>
    </li>
  );
}

/** One list, four stage headings, used by the sheet, the popover and the margin card. */
function StageList({ activeId, dense = false }: { activeId: string; dense?: boolean }) {
  const activeStage = stageOf(activeId);
  const activeIndex = STAGES.findIndex((stage) => stage.id === activeStage.id);

  return (
    <ul className="space-y-0.5">
      {STAGES.map((stage, index) => (
        <li key={stage.id}>
          <div className="flex items-center gap-2 px-0.5 pb-1 pt-3 first:pt-0">
            <span
              aria-hidden="true"
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                index <= activeIndex ? "bg-[color:var(--clinical-accent)]" : "bg-[color:var(--border-strong)]",
              )}
            />
            <p
              className={cn(
                "text-3xs font-black uppercase tracking-[0.12em]",
                index === activeIndex ? "text-[color:var(--clinical-accent)]" : "text-[color:var(--text-soft)]",
              )}
            >
              {stage.label}
            </p>
            {dense ? null : (
              <span className="nums ml-auto text-3xs font-bold text-[color:var(--text-soft)]">
                {stage.destinationIds.length}
              </span>
            )}
          </div>
          <ul className="space-y-0.5">
            {stage.destinationIds.map((id) => (
              <DestinationRow key={id} destination={byId(id)} active={id === activeId} />
            ))}
          </ul>
        </li>
      ))}
      <li className="mt-3 border-t border-[color:var(--border)] pt-2">
        <ul>
          <DestinationRow destination={byId("review")} active={activeId === "review"} />
        </ul>
        <p className="px-2.5 pt-1 text-3xs leading-4 text-[color:var(--text-soft)]">
          Outside the sequence: a governance queue, not a step. All {REVIEW_COUNT} records are still unreviewed.
        </p>
      </li>
    </ul>
  );
}

function JumpPanelHeading({ activeId }: { activeId: string }) {
  const stage = stageOf(activeId);
  const position = STAGES.findIndex((item) => item.id === stage.id) + 1;

  return (
    <div className="px-0.5 pb-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--clinical-accent)]">
          In Therapy
        </p>
        <p className="nums text-3xs font-bold text-[color:var(--text-soft)]">
          {position}/{STAGES.length}
        </p>
      </div>
      <p className="mt-1 text-3xs leading-4 text-[color:var(--text-soft)]">
        {THERAPY_COUNT} records · {CATEGORY_COUNT} categories · {PATHWAY_COUNT} pathways
      </p>
    </div>
  );
}

/* -- Desktop and tablet ------------------------------------------------- */

function MarginCard({ activeId, sticky = false }: { activeId: string; sticky?: boolean }) {
  return (
    <nav
      aria-label="Therapy sections"
      className={cn(
        "rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-2.5",
        sticky && "sticky top-0",
      )}
    >
      <JumpPanelHeading activeId={activeId} />
      <StageList activeId={activeId} />
    </nav>
  );
}

function DesktopFrame({ popover = false }: { popover?: boolean }) {
  const panelId = useId();
  const activeId = "brief";

  return (
    <DeviceFrame
      device="desktop"
      label={popover ? "Desktop · 1440 px · panel open" : "Desktop · 1440 px · at rest"}
      note={
        popover
          ? "Clicking the row opens the same list as a popover anchored under it — for someone who navigates from the title rather than the margin. It closes on escape and returns focus to the row."
          : "The row names the open record; the margin card is the menu. The card is sticky with a top offset that reads the live row height, so a jump taken while the row is away still lands with its heading at the top."
      }
    >
      <UniversalTopBar device="desktop" />
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <ContextRow device="desktop" activeId={activeId} expanded={popover} panelId={panelId} />
        {popover ? (
          <div
            id={panelId}
            role="dialog"
            aria-label="Jump to a therapy destination"
            className="absolute left-[3.5rem] top-[3.9rem] z-40 w-[19rem] rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-2.5 shadow-[var(--shadow-lux)]"
          >
            <JumpPanelHeading activeId={activeId} />
            <StageList activeId={activeId} />
          </div>
        ) : null}
        <div className="grid grid-cols-[minmax(0,1fr)_19rem] items-start">
          <ContentSkeleton eyebrow={selectedTherapy.short} title="Brief intervention · 5 minutes" blocks={2} />
          <div className="p-4 pl-0">
            <MarginCard activeId={activeId} sticky />
          </div>
        </div>
      </div>
    </DeviceFrame>
  );
}

function TabletFrame() {
  const panelId = useId();

  return (
    <DeviceFrame
      device="tablet"
      label="Tablet · 768 px"
      note="There is no room for a third sticky layer, so the card moves into the page flow and scrolls away with the content. The row and its track stay — they are the part you need while scrolling."
    >
      <UniversalTopBar device="tablet" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ContextRow device="tablet" activeId="brief" expanded={false} panelId={panelId} />
        <div className="space-y-3 p-3">
          <MarginCard activeId="brief" />
          <ContentSkeleton eyebrow={selectedTherapy.short} title="Brief intervention · 5 minutes" compact blocks={1} />
        </div>
      </div>
    </DeviceFrame>
  );
}

/* -- Phone -------------------------------------------------------------- */

type PhoneState = "rest" | "sheet" | "hidden" | "revealed" | "workspace";

function JumpSheet({ id, activeId }: { id: string; activeId: string }) {
  return (
    <>
      <span aria-hidden="true" className="absolute inset-0 z-40 bg-[color:var(--text-heading)]/40" />
      <div
        id={id}
        role="dialog"
        aria-label="Jump to a therapy destination"
        className="absolute inset-x-0 bottom-0 z-50 max-h-[76%] overflow-y-auto rounded-t-[1rem] border-t border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] px-3 pb-4 pt-2 shadow-[var(--shadow-lux)]"
      >
        <span
          aria-hidden="true"
          className="mx-auto mb-2 block h-1 w-9 rounded-full bg-[color:var(--border-strong)]/60"
        />
        <p className="truncate text-sm font-semibold text-[color:var(--text-heading)]">{selectedTherapy.name}</p>
        <p className="mb-2 mt-0.5 text-3xs font-semibold text-[color:var(--text-soft)]">
          {selectedTherapy.category} · every destination below acts on this record
        </p>
        <StageList activeId={activeId} dense />
      </div>
    </>
  );
}

function PhoneComposerPill({ dimmed = false }: { dimmed?: boolean }) {
  return (
    <div className={cn("absolute inset-x-0 bottom-0 z-30 px-3 pb-3", dimmed && "opacity-70")}>
      <div className="flex min-h-[56px] items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3 shadow-[var(--shadow-lux)]">
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-[color:var(--text-soft)]">
          Search {THERAPY_COUNT} therapies…
        </span>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]">
          <Search aria-hidden="true" className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function PhoneFrame({ state }: { state: PhoneState }) {
  const panelId = useId();
  const hidden = state === "hidden";
  const sheet = state === "sheet";
  const workspace = state === "workspace";
  const activeId = state === "revealed" ? "sheets" : workspace ? "compare" : "brief";

  return (
    <div className="relative flex h-full flex-col">
      {hidden ? null : (
        <>
          <UniversalTopBar device="phone" />
          <ContextRow device="phone" activeId={activeId} expanded={sheet} panelId={panelId} workspace={workspace} />
        </>
      )}
      <div className="min-h-0 flex-1 overflow-hidden bg-[color:var(--background)]">
        <ContentSkeleton
          eyebrow={workspace ? `${compareBasket.length} therapies` : selectedTherapy.short}
          title={
            workspace
              ? "Compare · differences"
              : state === "revealed"
                ? "Patient sheet · plain language"
                : "Brief intervention · 5 minutes"
          }
          compact
          blocks={3}
        />
      </div>
      {hidden ? null : <PhoneComposerPill dimmed={sheet} />}
      {sheet ? <JumpSheet id={panelId} activeId={activeId} /> : null}
    </div>
  );
}

const PHONE_STATES: Array<{ state: PhoneState; label: string; note: string }> = [
  {
    state: "rest",
    label: "At rest",
    note: "Two lines and a weighted track replace seven pills. Nothing scrolls sideways, and the compare basket finally has a permanent readout.",
  },
  {
    state: "sheet",
    label: "Sheet open",
    note: "Viewport-anchored, so the scroll signal never touches it. Opening it blurs the composer so hide-on-scroll can reclaim both edges afterwards.",
  },
  {
    state: "hidden",
    label: "Scrolled — chrome gone",
    note: "Row, track and composer leave together and release every reserve to 0 rem. While they are away the section heading in the content is what names your place.",
  },
  {
    state: "revealed",
    label: "Scrolled back up",
    note: "The row returns already correct: the label and the track moved on to Hand over · Patient sheet while they were gone.",
  },
  {
    state: "workspace",
    label: "A workspace, not a record",
    note: "On Compare there is no therapy to name, so line one names the workspace and its fill instead of borrowing a title that is not yours.",
  },
];

export function TherapyNavigationContextMockups() {
  return (
    <MockupShell
      current="therapy-navigation-context"
      letter="B"
      name="Context row"
      headline="Delete the strip. Keep one line that says where you are"
      intro="Navigation stops being a permanent menu and becomes an answer plus a door. The row states the record you have open and the job you are doing; a weighted track shows the shape of that job; and one panel — a sheet on a phone, a popover or a margin card on a desktop — holds every destination, grouped by stage."
    >
      <CurrentDefects />

      <MockupSection
        id="context-model-title"
        title="The model this direction commits to"
        intro="Therapy is a sequence — find something, choose between candidates, deliver it, hand something over. The track is that sequence, weighted by how much of the job each stage is."
      >
        <div className="grid gap-2 lg:grid-cols-3">
          <NoteCard
            tone="accent"
            title="The track shows share, not progress"
            body="Find carries four destinations and most of the work; Hand over carries one. Equal segments would have implied four equal parts of the job."
          />
          <NoteCard
            tone="accent"
            title="The row leaves with the header"
            body="It sits in the universal collapse row, so it hides on a deliberate descent and returns on deliberate upward intent, taking the track with it. Hidden means a zero reserve, not phantom padding."
          />
          <NoteCard
            tone="accent"
            title="Review is deliberately outside the track"
            body={`It is a governance queue, not a step in delivering care, so it sits below the sequence with its own count — currently all ${REVIEW_COUNT} records.`}
          />
        </div>
      </MockupSection>

      <MockupSection id="context-wide-title" title="Desktop and tablet">
        <div className="space-y-6">
          <DesktopFrame />
          <DesktopFrame popover />
          <TabletFrame />
        </div>
      </MockupSection>

      <MockupSection
        id="context-phone-title"
        title="Phone · 390 px · the whole cycle"
        intro="Including what happens when the chrome disappears, and what the row says when there is no record to name."
      >
        <div className="flex flex-wrap gap-5">
          {PHONE_STATES.map((item) => (
            <DeviceFrame key={item.state} device="phone" label={item.label} note={item.note}>
              <PhoneFrame state={item.state} />
            </DeviceFrame>
          ))}
        </div>
      </MockupSection>

      <MockupSection id="context-cost-title" title="What it costs">
        <div className="grid gap-2 sm:grid-cols-2">
          <NoteCard
            tone="warn"
            title="Every move past the first is two taps"
            body="Nothing but the current destination is visible without opening the panel. This direction bets that people arrive with an intent rather than browsing the menu — if that is wrong, it is the slowest of the three."
          />
          <NoteCard
            tone="warn"
            title="The stage model has to be right"
            body="Find, Choose, Deliver, Hand over is a claim about how clinicians actually use this tool. If a real session moves between compare and search repeatedly, a sequence track is a fiction that will read as progress."
          />
        </div>
      </MockupSection>
    </MockupShell>
  );
}
