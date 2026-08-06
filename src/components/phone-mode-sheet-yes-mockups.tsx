"use client";

import { Check, ChevronDown, MessageSquarePlus, Search, X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";

import { cn } from "@/components/ui-primitives";
import { appModeIcons } from "@/lib/app-mode-icons";
import { appModeDefinitions, visibleAppModeDefinitions, type AppModeId } from "@/lib/app-modes";

/**
 * Design scratch: phone "Choose mode" sheet — review + YES comps.
 *
 * YES 01 is a dense glance list: no Find/Diagnose/Care sections. Organisation
 * slowed picking; height goes to modes. Keyboard roving, contained preview
 * scroll, and lifted selection into the phone frame stay.
 */

type GroupId = "find" | "diagnose" | "care";
type VariantId = "current" | "sections" | "deck";
type SectionsPreview = "rest" | "scrolled" | "switched";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const GROUPS: Array<{ id: GroupId; label: string; hint: string; modes: AppModeId[] }> = [
  {
    id: "find",
    label: "Find",
    hint: "Answers, sources, services",
    modes: ["answer", "documents", "services", "forms", "favourites"],
  },
  {
    id: "diagnose",
    label: "Diagnose",
    hint: "Criteria, clues, mechanisms",
    modes: ["differentials", "dsm", "specifiers", "formulation"],
  },
  {
    id: "care",
    label: "Care",
    hint: "Meds, tools, therapy",
    modes: ["prescribing", "tools", "therapy-compass", "factsheets"],
  },
];

const ACTIVE_MODE: AppModeId = "answer";

function modeOf(id: AppModeId) {
  const definition = appModeDefinitions.find((mode) => mode.id === id);
  if (!definition) {
    throw new Error(`Unknown app mode: ${id}`);
  }
  return definition;
}

const reviewFindings = [
  {
    severity: "P1",
    title: "Hard to pick at a glance",
    detail:
      "Section headers, hints, counts, and roomy rows spend height on organisation. On a phone sheet that means fewer modes visible and more scrolling before you can choose.",
  },
  {
    severity: "P1",
    title: "Descriptions truncate on phone",
    detail:
      "Live rows use `truncate` on a single line — fine for density if the title carries the choice. Titles must stay fully readable.",
  },
  {
    severity: "P2",
    title: "Selected state is easy to miss",
    detail: "Soft fill alone is weak mid-list. A left rail + check keeps place without a second sticky card.",
  },
  {
    severity: "P3",
    title: "Header copy is generic",
    detail:
      "‘Choose mode / Switch the clinical workspace mode’ names the UI. A one-line Currently · {mode} orients faster.",
  },
] as const;

const perfectedResolutions = [
  {
    issue: "Organisation tax",
    fix: "No Find / Diagnose / Care sections, sticky labels, or count badges — one flat list.",
  },
  {
    issue: "Wasted vertical space",
    fix: "Tight rows (min-h-12, 32 px icons, single-line subtitle) so nearly the full catalogue fits at once.",
  },
  {
    issue: "Lost selection",
    fix: "Header Currently · {mode} plus soft fill, left rail, and check — no bulky current card.",
  },
  {
    issue: "Keyboard / scroll a11y",
    fix: "Arrow/Home/End roving focus; preview scroll stays inside the sheet body.",
  },
] as const;

const variants: Array<{
  id: Exclude<VariantId, "current">;
  title: string;
  verdict: string;
  description: string;
  changes: string[];
}> = [
  {
    id: "sections",
    title: "Dense glance list",
    verdict: "YES · Fastest pick",
    description:
      "Flat catalogue, no clinical lanes. Most modes visible at once; pick by name without scrolling through section chrome. This is the shipping recommendation.",
    changes: [
      "No section headers, hints, or counts — organisation was slowing choice.",
      "Compact min-h-12 rows with 32 px icon wells and one-line subtitles.",
      "Header carries Currently · {mode}; selection is interactive and lifts into the top-bar pill.",
      "Arrow/Home/End roving focus; proof-frame scroll stays inside the sheet.",
    ],
  },
  {
    id: "deck",
    title: "Icon deck with lane chips",
    verdict: "Alternate · Overview",
    description:
      "Two-column cards with Find / Diagnose / Care filters. Kept only as an alternate if browsing by lane matters more than a single glance pick.",
    changes: [
      "Lane chips filter the deck without opening a second surface.",
      "Current mode sits in a full-width identity card above the grid.",
      "Cards are icon-forward; selected card uses accent ring + check.",
      "More organisation than YES 01 — use only if that trade-off is wanted.",
    ],
  },
];

function UniversalHeader({ modeLabel }: { modeLabel: string }) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[0.6rem] bg-[color:var(--text-heading)] text-3xs font-black tracking-[-0.04em] text-[color:var(--surface)]">
        KB
      </span>
      <span className="inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-semibold text-[color:var(--text)]">
        <span className="truncate">{modeLabel}</span>
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[color:var(--text-soft)]" />
      </span>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)]">
        <MessageSquarePlus aria-hidden="true" className="h-4 w-4" />
      </span>
    </div>
  );
}

function DimmedHome({ modeLabel }: { modeLabel: string }) {
  return (
    <div className="pointer-events-none relative flex min-h-0 flex-1 flex-col bg-[color:var(--background)]">
      <div className="flex flex-1 flex-col items-center justify-center px-6 opacity-40">
        <p className="text-center text-sm font-semibold text-[color:var(--text-heading)]">{modeLabel}</p>
        <p className="mt-1 text-center text-xs text-[color:var(--text-muted)]">Clinical workspace</p>
        <div className="mt-6 h-12 w-full max-w-[18rem] rounded-full border border-[color:var(--border)] bg-[color:var(--surface)]" />
      </div>
      <div aria-hidden="true" className="absolute inset-0 bg-[color:var(--text)]/35" />
    </div>
  );
}

function SheetChrome({
  title,
  description,
  descriptionContent,
  closeLabel,
  children,
  bodyClassName,
  bodyRef,
}: {
  title: string;
  description?: string;
  descriptionContent?: ReactNode;
  closeLabel: string;
  children: ReactNode;
  bodyClassName?: string;
  bodyRef?: RefObject<HTMLDivElement | null>;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const hasDescription = Boolean(description || descriptionContent);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={hasDescription ? descriptionId : undefined}
      className="absolute inset-x-0 bottom-0 z-10 flex max-h-[90%] flex-col overflow-hidden rounded-t-[1.35rem] border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-lux)]"
    >
      <div className="flex justify-center pt-2.5" aria-hidden="true">
        <span className="h-1 w-10 rounded-full bg-[color:var(--border-strong)]/65" />
      </div>
      <div className="flex items-start gap-3 px-4 pb-3 pt-1.5">
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="text-base font-semibold tracking-[-0.02em] text-[color:var(--text-heading)]">
            {title}
          </h3>
          {descriptionContent ? (
            <div id={descriptionId} className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">
              {descriptionContent}
            </div>
          ) : description ? (
            <p id={descriptionId} className="mt-0.5 text-xs leading-5 text-[color:var(--text-muted)]">
              {description}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => undefined}
          className={cn(
            "grid h-tap w-tap shrink-0 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
            focusRing,
          )}
          aria-label={closeLabel}
          title={closeLabel}
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      <div aria-hidden="true" className="h-px shrink-0 bg-[color:var(--border)]" />
      <div ref={bodyRef} className={cn("min-h-0 flex-1 overflow-y-auto polished-scroll", bodyClassName)}>
        {children}
      </div>
      <div aria-hidden="true" className="h-[max(0.75rem,env(safe-area-inset-bottom))] shrink-0" />
    </div>
  );
}

/** Scroll a target into a scroll container without bubbling to document ancestors. */
function scrollContainerToTarget(container: HTMLElement, target: HTMLElement, block: "start" | "center") {
  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  if (block === "start") {
    container.scrollTop += targetRect.top - containerRect.top;
    return;
  }
  const targetCenter = targetRect.top + targetRect.height / 2;
  const containerCenter = containerRect.top + containerRect.height / 2;
  container.scrollTop += targetCenter - containerCenter;
}

function CurrentShippingSheet() {
  // `visibleAppModeDefinitions("production")`, not a local `!mode.devOnly`:
  // `devOnly` is optional on the union, so reading it off every member does not
  // typecheck (TS2339). app-modes.ts already exports this guard — passing
  // "production" reproduces the intent here, which is the shipping mode list.
  const modes = visibleAppModeDefinitions("production");

  return (
    <SheetChrome
      title="Choose mode"
      description="Switch the clinical workspace mode."
      closeLabel="Close mode menu"
      bodyClassName="p-2"
    >
      <div role="menu" aria-label="Choose app mode" className="grid gap-0.5">
        {modes.map((mode) => {
          const Icon = appModeIcons[mode.id];
          const active = mode.id === ACTIVE_MODE;
          return (
            <button
              key={mode.id}
              type="button"
              role="menuitemradio"
              aria-checked={active}
              onClick={() => undefined}
              className={cn(
                "grid min-h-[3.25rem] w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2.5 py-2 text-left transition",
                focusRing,
                active
                  ? "border-l-2 border-l-[color:var(--clinical-accent)] bg-[color:var(--surface-chrome)] text-[color:var(--text)]"
                  : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
              )}
            >
              <span
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-lg border",
                  active
                    ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                    : "border-[color:var(--border)] bg-[color:var(--surface-raised)]",
                )}
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{mode.label}</span>
                <span className="block truncate text-2xs font-medium text-[color:var(--text-soft)]">
                  {mode.description}
                </span>
              </span>
              {active ? <Check aria-hidden="true" className="h-4 w-4 text-[color:var(--clinical-accent)]" /> : null}
            </button>
          );
        })}
      </div>
    </SheetChrome>
  );
}

function CurrentlyLine({ modeId }: { modeId: AppModeId }) {
  const mode = modeOf(modeId);
  const Icon = appModeIcons[modeId];

  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
        <Icon aria-hidden="true" className="h-3 w-3" />
      </span>
      <span className="min-w-0 truncate">
        Currently <span className="font-semibold text-[color:var(--text-heading)]">{mode.label}</span>
      </span>
    </span>
  );
}

function ModeRow({
  modeId,
  active,
  index,
  tabIndex,
  onSelect,
  onKeyDown,
  buttonRef,
}: {
  modeId: AppModeId;
  active: boolean;
  index: number;
  tabIndex: number;
  onSelect: (id: AppModeId) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => void;
  buttonRef?: (element: HTMLButtonElement | null) => void;
}) {
  const mode = modeOf(modeId);
  const Icon = appModeIcons[modeId];

  return (
    <button
      ref={buttonRef}
      type="button"
      role="menuitemradio"
      aria-checked={active}
      tabIndex={tabIndex}
      onClick={() => onSelect(modeId)}
      onKeyDown={(event) => onKeyDown(event, index)}
      style={{ animationDelay: `${Math.min(index, 8) * 28}ms` }}
      className={cn(
        "relative grid min-h-12 w-full grid-cols-[2rem_minmax(0,1fr)_1.25rem] items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-[background-color,color] duration-[var(--duration-fast)] ease-[var(--ease-out-soft)] motion-reduce:transition-none",
        focusRing,
        active
          ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--text)]"
          : "text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)]",
      )}
    >
      {active ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-1.5 left-0 w-0.5 rounded-r-full bg-[color:var(--clinical-accent)]"
        />
      ) : null}
      <span
        className={cn(
          "grid h-8 w-8 place-items-center rounded-lg border",
          active
            ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] text-[color:var(--clinical-accent)]"
            : "border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)]",
        )}
      >
        <Icon aria-hidden="true" className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold tracking-[-0.01em] text-[color:var(--text-heading)]">
          {mode.label}
        </span>
        <span className="block truncate text-2xs font-medium leading-4 text-[color:var(--text-soft)]">
          {mode.description}
        </span>
      </span>
      {active ? (
        <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" strokeWidth={2.5} />
      ) : (
        <span aria-hidden="true" className="h-4 w-4" />
      )}
    </button>
  );
}

const FLAT_MODE_IDS = visibleAppModeDefinitions("production").map((mode) => mode.id);
const MID_SCROLL_MODE: AppModeId = "differentials";

/**
 * YES 01 — dense glance list. Flat catalogue, no section organisation.
 * Selection is controlled by the phone frame so the top-bar pill stays in sync.
 */
function SectionedListSheet({
  selected,
  onSelectedChange,
  preview = "rest",
}: {
  selected: AppModeId;
  onSelectedChange: (id: AppModeId) => void;
  preview?: SectionsPreview;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(0, FLAT_MODE_IDS.indexOf(selected));
  const midScrollIndex = Math.max(0, FLAT_MODE_IDS.indexOf(MID_SCROLL_MODE));
  const [focusIndex, setFocusIndex] = useState(selectedIndex);
  // Proof-frame scroll uses the mount selection only — live taps must not re-scroll.
  const mountSelectedIndexRef = useRef(selectedIndex);

  useEffect(() => {
    if (preview === "rest") return;
    // Constrain preview scroll to the sheet body — scrollIntoView would yank
    // every scrollable ancestor, including the document, past the study heading.
    // Run once per proof-frame mount only: re-running on live selection taps
    // would yank the Scrolled frame after every mode pick.
    const frame = window.requestAnimationFrame(() => {
      const body = bodyRef.current;
      if (!body) return;
      if (preview === "scrolled") {
        const target = optionRefs.current[midScrollIndex];
        if (target) scrollContainerToTarget(body, target, "start");
        return;
      }
      const target = optionRefs.current[mountSelectedIndexRef.current];
      if (target) scrollContainerToTarget(body, target, "center");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [preview, midScrollIndex]);

  function focusModeOption(index: number) {
    const next = Math.max(0, Math.min(FLAT_MODE_IDS.length - 1, index));
    setFocusIndex(next);
    optionRefs.current[next]?.focus();
  }

  function handleModeOptionKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusModeOption(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusModeOption(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusModeOption(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusModeOption(FLAT_MODE_IDS.length - 1);
    }
  }

  function selectMode(id: AppModeId) {
    onSelectedChange(id);
    const nextIndex = FLAT_MODE_IDS.indexOf(id);
    if (nextIndex >= 0) setFocusIndex(nextIndex);
  }

  return (
    <SheetChrome
      title="Choose mode"
      descriptionContent={<CurrentlyLine modeId={selected} />}
      closeLabel="Close mode menu"
      bodyRef={bodyRef}
    >
      <div
        role="menu"
        aria-label="Choose app mode"
        data-perfected="yes-01"
        data-preview={preview}
        className="grid gap-0 px-1.5 py-1"
      >
        {FLAT_MODE_IDS.map((modeId, flatIndex) => (
          <ModeRow
            key={modeId}
            modeId={modeId}
            active={modeId === selected}
            index={flatIndex}
            tabIndex={flatIndex === focusIndex ? 0 : -1}
            onSelect={selectMode}
            onKeyDown={handleModeOptionKeyDown}
            buttonRef={(element) => {
              optionRefs.current[flatIndex] = element;
            }}
          />
        ))}
      </div>
    </SheetChrome>
  );
}

function IconDeckSheet() {
  const instanceId = useId();
  const [lane, setLane] = useState<"all" | GroupId>("all");
  const active = modeOf(ACTIVE_MODE);
  const ActiveIcon = appModeIcons[ACTIVE_MODE];
  const visibleGroups = lane === "all" ? GROUPS : GROUPS.filter((group) => group.id === lane);

  return (
    <SheetChrome title="Choose mode" description="Browse the clinical workspace." closeLabel="Close mode menu">
      <div className="space-y-3 px-3 pb-3 pt-3">
        <div className="rounded-2xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] p-3">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] text-[color:var(--clinical-accent)]">
              <ActiveIcon aria-hidden="true" className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--clinical-accent)]">
                Current mode
              </span>
              <span className="block truncate text-base font-semibold text-[color:var(--text-heading)]">
                {active.label}
              </span>
              <span className="mt-0.5 line-clamp-2 text-2xs leading-4 text-[color:var(--text-muted)]">
                {active.description}
              </span>
            </span>
          </div>
        </div>

        <div
          role="group"
          aria-label="Filter modes by clinical lane"
          className="flex gap-1.5 overflow-x-auto polished-scroll pb-0.5"
        >
          {(
            [
              { id: "all" as const, label: "All" },
              ...GROUPS.map((group) => ({ id: group.id, label: group.label })),
            ] as const
          ).map((chip) => {
            const selected = lane === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setLane(chip.id)}
                className={cn(
                  "inline-flex h-tap shrink-0 items-center rounded-full border px-3.5 text-xs font-semibold transition",
                  focusRing,
                  selected
                    ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent)] text-[color:var(--surface)]"
                    : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
                )}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        <div role="menu" aria-label="Choose app mode" className="space-y-4">
          {visibleGroups.map((group) => {
            const headingId = `${instanceId}-deck-${group.id}`;
            return (
              <section key={group.id} aria-labelledby={headingId}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2 px-0.5">
                  <h4
                    id={headingId}
                    className="text-3xs font-black uppercase tracking-[0.14em] text-[color:var(--text-soft)]"
                  >
                    {group.label}
                  </h4>
                  <span className="text-3xs font-medium text-[color:var(--text-muted)]">{group.hint}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {group.modes.map((modeId) => {
                    const mode = modeOf(modeId);
                    const Icon = appModeIcons[modeId];
                    const isActive = modeId === ACTIVE_MODE;
                    return (
                      <button
                        key={modeId}
                        type="button"
                        role="menuitemradio"
                        aria-checked={isActive}
                        onClick={() => undefined}
                        className={cn(
                          "relative flex min-h-[6.5rem] flex-col items-start gap-2 rounded-2xl border p-3 text-left transition",
                          focusRing,
                          isActive
                            ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] shadow-[var(--shadow-tight)]"
                            : "border-[color:var(--border)] bg-[color:var(--surface)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]",
                        )}
                      >
                        {isActive ? (
                          <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--surface)]">
                            <Check aria-hidden="true" className="h-3.5 w-3.5" />
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            "grid h-10 w-10 place-items-center rounded-xl border",
                            isActive
                              ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] text-[color:var(--clinical-accent)]"
                              : "border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text)]",
                          )}
                        >
                          <Icon aria-hidden="true" className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold leading-tight text-[color:var(--text-heading)]">
                            {mode.label}
                          </span>
                          <span className="mt-1 line-clamp-2 text-2xs font-medium leading-4 text-[color:var(--text-soft)]">
                            {mode.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </SheetChrome>
  );
}

function SectionsPhoneFrame({
  large = false,
  caption,
  sectionsPreview = "rest",
  initialMode,
}: {
  large?: boolean;
  caption: string;
  sectionsPreview?: SectionsPreview;
  initialMode: AppModeId;
}) {
  // Owned here so the top-bar pill tracks live sheet selection. Parent keys this
  // component on preview/initialMode so state resets without a sync effect.
  const [selectedMode, setSelectedMode] = useState<AppModeId>(initialMode);
  const modeLabel = modeOf(selectedMode).label;

  return (
    <figure className={cn("m-0 max-w-full min-w-0", large ? "w-[390px]" : "w-[340px]")}>
      <figcaption className="mb-2.5">
        <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">{caption}</p>
      </figcaption>
      <div
        data-variant="sections"
        data-dense-preview={sectionsPreview}
        className={cn(
          "relative isolate flex flex-col overflow-hidden rounded-[1.35rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]",
          large ? "h-[46rem]" : "h-[30rem]",
        )}
      >
        <UniversalHeader modeLabel={modeLabel} />
        <DimmedHome modeLabel={modeLabel} />
        <SectionedListSheet selected={selectedMode} onSelectedChange={setSelectedMode} preview={sectionsPreview} />
      </div>
    </figure>
  );
}

function PhoneFrame({
  variant,
  large = false,
  caption,
  sectionsPreview = "rest",
  initialMode,
}: {
  variant: VariantId;
  large?: boolean;
  caption: string;
  sectionsPreview?: SectionsPreview;
  initialMode?: AppModeId;
}) {
  if (variant === "sections") {
    const sectionsInitial = initialMode ?? ACTIVE_MODE;
    return (
      <SectionsPhoneFrame
        key={`${sectionsPreview}-${sectionsInitial}`}
        large={large}
        caption={caption}
        sectionsPreview={sectionsPreview}
        initialMode={sectionsInitial}
      />
    );
  }

  const modeLabel = modeOf(ACTIVE_MODE).label;

  return (
    <figure className={cn("m-0 max-w-full min-w-0", large ? "w-[390px]" : "w-[340px]")}>
      <figcaption className="mb-2.5">
        <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">{caption}</p>
      </figcaption>
      <div
        data-variant={variant}
        className={cn(
          "relative isolate flex flex-col overflow-hidden rounded-[1.35rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]",
          large ? "h-[46rem]" : "h-[30rem]",
        )}
      >
        <UniversalHeader modeLabel={modeLabel} />
        <DimmedHome modeLabel={modeLabel} />
        {variant === "current" ? <CurrentShippingSheet /> : null}
        {variant === "deck" ? <IconDeckSheet /> : null}
      </div>
    </figure>
  );
}

function ReviewPanel() {
  return (
    <aside className="rounded-2xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-5 shadow-[var(--shadow-soft)]">
      <p className="text-3xs font-black uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
        Design review · Phone sheet
      </p>
      <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[color:var(--text-heading)]">
        Glance first, organise later
      </h2>
      <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
        Sectioned Find / Diagnose / Care lanes looked tidy but spent height on chrome. Mode choice on phone is a glance
        task — more visible rows beat clinical grouping.
      </p>
      <ul className="mt-4 space-y-3">
        {reviewFindings.map((finding) => (
          <li
            key={finding.title}
            className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3.5 py-3"
          >
            <div className="flex items-baseline gap-2">
              <span className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--clinical-accent)]">
                {finding.severity}
              </span>
              <span className="text-sm font-semibold text-[color:var(--text-heading)]">{finding.title}</span>
            </div>
            <p className="mt-1.5 text-xs leading-5 text-[color:var(--text-muted)]">{finding.detail}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-[color:var(--text-muted)]">
        <Search aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--clinical-accent)]" />
        YES 01 is the dense flat list. YES 02 keeps lanes only as an optional overview alternate.
      </p>
    </aside>
  );
}

function PerfectedResolutions() {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {perfectedResolutions.map((item) => (
        <li
          key={item.issue}
          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3.5 py-3"
        >
          <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--clinical-accent)]">
            Resolved · {item.issue}
          </p>
          <p className="mt-1.5 text-xs leading-5 text-[color:var(--text-muted)]">{item.fix}</p>
        </li>
      ))}
    </ul>
  );
}

export function PhoneModeSheetYesMockups() {
  return (
    <main className="min-h-dvh bg-[color:var(--background)] px-3 pb-20 pt-7 text-[color:var(--text)] sm:px-6 sm:pt-10 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <header className="max-w-3xl">
          <p className="text-3xs font-black uppercase tracking-[0.16em] text-[color:var(--clinical-accent)]">
            Phone · Choose mode sheet
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[color:var(--text-heading)] sm:text-4xl">
            Dense glance list
          </h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)] sm:text-base sm:leading-7">
            Organisation and roomy section chrome made mode choice slower. YES 01 is a flat, tight list so you can see
            and pick a mode in one glance — no Find / Diagnose / Care lanes.
          </p>
        </header>

        <section aria-labelledby="dense-pair-title" className="mt-10">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-3xs font-black uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
                YES 01 · Three states
              </p>
              <h2
                id="dense-pair-title"
                className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[color:var(--text-heading)]"
              >
                Rest · Scrolled · Switched
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-[color:var(--text-muted)]">
              Most of the catalogue visible on open. Scroll only for the tail; switch keeps header and selection in
              sync.
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-5">
            <PhoneFrame variant="sections" large caption="Rest · most modes visible" sectionsPreview="rest" />
            <PhoneFrame variant="sections" large caption="Scrolled · mid catalogue" sectionsPreview="scrolled" />
            <PhoneFrame
              variant="sections"
              large
              caption="Switched · DSM-5 current"
              sectionsPreview="switched"
              initialMode="dsm"
            />
          </div>
        </section>

        <section aria-labelledby="resolutions-title" className="mt-12">
          <h2
            id="resolutions-title"
            className="text-lg font-semibold tracking-[-0.02em] text-[color:var(--text-heading)]"
          >
            What changed after feedback
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[color:var(--text-muted)]">
            Dropped section organisation and vertical padding that made the sheet feel spacious but harder to scan.
          </p>
          <div className="mt-4">
            <PerfectedResolutions />
          </div>
        </section>

        <div className="mt-14 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
          <section aria-labelledby="current-title" className="space-y-4">
            <div>
              <p className="text-3xs font-black uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
                Baseline · Shipping today
              </p>
              <h2
                id="current-title"
                className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[color:var(--text-heading)]"
              >
                Flat list sheet
              </h2>
            </div>
            <PhoneFrame variant="current" caption="Current · truncated flat list" />
          </section>
          <ReviewPanel />
        </div>

        <div className="mt-12 space-y-14">
          {variants.map((variant, index) => (
            <section
              key={variant.id}
              className="border-t border-[color:var(--border)] pt-10"
              aria-labelledby={`${variant.id}-title`}
            >
              <div className="mb-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,34rem)] lg:items-end">
                <div>
                  <p className="text-3xs font-black uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
                    YES {String(index + 1).padStart(2, "0")} · {variant.verdict}
                  </p>
                  <h2
                    id={`${variant.id}-title`}
                    className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[color:var(--text-heading)] sm:text-3xl"
                  >
                    {variant.title}
                  </h2>
                </div>
                <p className="max-w-2xl text-sm leading-6 text-[color:var(--text-muted)] lg:justify-self-end lg:text-right">
                  {variant.description}
                </p>
              </div>

              <ul className="mb-6 grid gap-2 sm:grid-cols-2">
                {variant.changes.map((change) => (
                  <li
                    key={change}
                    className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3.5 py-2.5 text-xs leading-5 text-[color:var(--text-muted)]"
                  >
                    {change}
                  </li>
                ))}
              </ul>

              {variant.id === "sections" ? (
                <PhoneFrame variant="sections" large caption="Detail · Dense glance list" />
              ) : (
                <PhoneFrame variant="deck" large caption="Detail · Icon deck (alternate)" />
              )}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
