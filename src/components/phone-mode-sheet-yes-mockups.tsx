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
 * Design scratch: phone "Choose mode" sheet — new YES comps (2026-08).
 *
 * Feedback rejected Find / Diagnose / Care organisation and roomy spacing —
 * they made mode choice harder at a glance. Both YES directions stay flat.
 *
 * YES 01 — Dense title list (shipping recommendation)
 * YES 02 — Flat icon tiles (alternate glance layout, still no lanes)
 */

type VariantId = "current" | "dense" | "tiles";
type DensePreview = "rest" | "scrolled" | "switched";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const ACTIVE_MODE: AppModeId = "answer";
const FLAT_MODE_IDS = visibleAppModeDefinitions("production").map((mode) => mode.id);
const MID_SCROLL_MODE: AppModeId = "differentials";

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
    title: "Organisation slowed the pick",
    detail:
      "Find / Diagnose / Care headers, hints, and counts spent height on chrome. Mode choice on phone is a glance task — more visible rows beat clinical grouping.",
  },
  {
    severity: "P1",
    title: "Subtitles cost catalogue height",
    detail: "Two-line rows hide modes below the fold. Titles carry the choice; descriptions can live in aria-label.",
  },
  {
    severity: "P2",
    title: "Selected state must survive density",
    detail: "Soft fill alone is weak mid-list. A left rail + check keeps place without a second sticky card.",
  },
  {
    severity: "P3",
    title: "Header should orient, not instruct",
    detail: "Currently · {mode} orients faster than ‘Switch the clinical workspace mode’.",
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
    id: "dense",
    title: "Dense title list",
    verdict: "YES · Fastest pick",
    description:
      "Flat catalogue, title-only rows. Nearly every mode visible on open — pick by name without scrolling through section chrome. Shipping recommendation.",
    changes: [
      "No Find / Diagnose / Care headers, hints, or counts.",
      "Title-only min-h-12 rows; description stays in aria-label.",
      "Header carries Currently · {mode}; selection lifts into the top-bar pill.",
      "Arrow / Home / End roving focus; preview scroll stays inside the sheet.",
    ],
  },
  {
    id: "tiles",
    title: "Flat icon tiles",
    verdict: "YES · Icon-forward",
    description:
      "Same flat catalogue, presented as a compact two-column tile grid. Still no clinical lanes — icon + label for glance recognition.",
    changes: [
      "One continuous grid — no section labels or lane chips.",
      "Compact tiles (icon + title) keep all modes in view.",
      "Selected tile uses accent wash, ring, and corner check.",
      "Use when icon recognition matters more than a single text column.",
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

function CurrentShippingSheet() {
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

function DenseModeRow({
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
      aria-label={`${mode.label}. ${mode.description}`}
      tabIndex={tabIndex}
      onClick={() => onSelect(modeId)}
      onKeyDown={(event) => onKeyDown(event, index)}
      style={{ animationDelay: `${Math.min(index, 8) * 28}ms` }}
      className={cn(
        "relative grid min-h-12 w-full grid-cols-[2rem_minmax(0,1fr)_1.25rem] items-center gap-2 rounded-lg px-2 py-1 text-left transition-[background-color,color] duration-[var(--duration-fast)] ease-[var(--ease-out-soft)] motion-reduce:transition-none",
        focusRing,
        active
          ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--text)]"
          : "text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)]",
      )}
    >
      {active ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-1 left-0 w-0.5 rounded-r-full bg-[color:var(--clinical-accent)]"
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
      <span className="min-w-0 truncate text-sm font-semibold tracking-[-0.01em] text-[color:var(--text-heading)]">
        {mode.label}
      </span>
      {active ? (
        <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" strokeWidth={2.5} />
      ) : (
        <span aria-hidden="true" className="h-4 w-4" />
      )}
    </button>
  );
}

/**
 * YES 01 — dense title list. Flat catalogue, no section organisation.
 * Selection is controlled by the phone frame so the top-bar pill stays in sync.
 */
function DenseListSheet({
  selected,
  onSelectedChange,
  preview = "rest",
}: {
  selected: AppModeId;
  onSelectedChange: (id: AppModeId) => void;
  preview?: DensePreview;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(0, FLAT_MODE_IDS.indexOf(selected));
  const midScrollIndex = Math.max(0, FLAT_MODE_IDS.indexOf(MID_SCROLL_MODE));
  const [focusIndex, setFocusIndex] = useState(selectedIndex);
  const mountSelectedIndexRef = useRef(selectedIndex);

  useEffect(() => {
    if (preview === "rest") return;
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
        data-perfected="yes-01-dense"
        data-preview={preview}
        className="grid gap-0 px-1.5 py-1"
      >
        {FLAT_MODE_IDS.map((modeId, flatIndex) => (
          <DenseModeRow
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

/**
 * YES 02 — flat icon tiles. Still no Find / Diagnose / Care lanes.
 */
function FlatTileSheet({
  selected,
  onSelectedChange,
}: {
  selected: AppModeId;
  onSelectedChange: (id: AppModeId) => void;
}) {
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(0, FLAT_MODE_IDS.indexOf(selected));
  const [focusIndex, setFocusIndex] = useState(selectedIndex);

  function focusModeOption(index: number) {
    const next = Math.max(0, Math.min(FLAT_MODE_IDS.length - 1, index));
    setFocusIndex(next);
    optionRefs.current[next]?.focus();
  }

  function handleModeOptionKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    const cols = 2;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusModeOption(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusModeOption(index - 1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      focusModeOption(index + cols);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusModeOption(index - cols);
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
    >
      <div
        role="menu"
        aria-label="Choose app mode"
        data-perfected="yes-02-tiles"
        className="grid grid-cols-2 gap-2 px-3 py-3"
      >
        {FLAT_MODE_IDS.map((modeId, flatIndex) => {
          const mode = modeOf(modeId);
          const Icon = appModeIcons[modeId];
          const active = modeId === selected;
          return (
            <button
              key={modeId}
              ref={(element) => {
                optionRefs.current[flatIndex] = element;
              }}
              type="button"
              role="menuitemradio"
              aria-checked={active}
              aria-label={`${mode.label}. ${mode.description}`}
              tabIndex={flatIndex === focusIndex ? 0 : -1}
              onClick={() => selectMode(modeId)}
              onKeyDown={(event) => handleModeOptionKeyDown(event, flatIndex)}
              style={{ animationDelay: `${Math.min(flatIndex, 8) * 24}ms` }}
              className={cn(
                "relative flex min-h-[4.75rem] flex-col items-start gap-2 rounded-2xl border p-3 text-left transition",
                focusRing,
                active
                  ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] shadow-[var(--shadow-tight)]"
                  : "border-[color:var(--border)] bg-[color:var(--surface)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]",
              )}
            >
              {active ? (
                <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--surface)]">
                  <Check aria-hidden="true" className="h-3 w-3" strokeWidth={2.5} />
                </span>
              ) : null}
              <span
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-xl border",
                  active
                    ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] text-[color:var(--clinical-accent)]"
                    : "border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text)]",
                )}
              >
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <span className="min-w-0 pr-5 text-sm font-semibold leading-tight tracking-[-0.01em] text-[color:var(--text-heading)]">
                {mode.label}
              </span>
            </button>
          );
        })}
      </div>
    </SheetChrome>
  );
}

function DensePhoneFrame({
  large = false,
  caption,
  densePreview = "rest",
  initialMode,
}: {
  large?: boolean;
  caption: string;
  densePreview?: DensePreview;
  initialMode: AppModeId;
}) {
  const [selectedMode, setSelectedMode] = useState<AppModeId>(initialMode);
  const modeLabel = modeOf(selectedMode).label;

  return (
    <figure className={cn("m-0 max-w-full min-w-0", large ? "w-[390px]" : "w-[340px]")}>
      <figcaption className="mb-2.5">
        <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">{caption}</p>
      </figcaption>
      <div
        data-variant="dense"
        data-dense-preview={densePreview}
        className={cn(
          "relative isolate flex flex-col overflow-hidden rounded-[1.35rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]",
          large ? "h-[46rem]" : "h-[30rem]",
        )}
      >
        <UniversalHeader modeLabel={modeLabel} />
        <DimmedHome modeLabel={modeLabel} />
        <DenseListSheet selected={selectedMode} onSelectedChange={setSelectedMode} preview={densePreview} />
      </div>
    </figure>
  );
}

function TilesPhoneFrame({
  large = false,
  caption,
  initialMode,
}: {
  large?: boolean;
  caption: string;
  initialMode: AppModeId;
}) {
  const [selectedMode, setSelectedMode] = useState<AppModeId>(initialMode);
  const modeLabel = modeOf(selectedMode).label;

  return (
    <figure className={cn("m-0 max-w-full min-w-0", large ? "w-[390px]" : "w-[340px]")}>
      <figcaption className="mb-2.5">
        <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">{caption}</p>
      </figcaption>
      <div
        data-variant="tiles"
        className={cn(
          "relative isolate flex flex-col overflow-hidden rounded-[1.35rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]",
          large ? "h-[46rem]" : "h-[30rem]",
        )}
      >
        <UniversalHeader modeLabel={modeLabel} />
        <DimmedHome modeLabel={modeLabel} />
        <FlatTileSheet selected={selectedMode} onSelectedChange={setSelectedMode} />
      </div>
    </figure>
  );
}

function PhoneFrame({
  variant,
  large = false,
  caption,
  densePreview = "rest",
  initialMode,
}: {
  variant: VariantId;
  large?: boolean;
  caption: string;
  densePreview?: DensePreview;
  initialMode?: AppModeId;
}) {
  if (variant === "dense") {
    const denseInitial = initialMode ?? ACTIVE_MODE;
    return (
      <DensePhoneFrame
        key={`${densePreview}-${denseInitial}`}
        large={large}
        caption={caption}
        densePreview={densePreview}
        initialMode={denseInitial}
      />
    );
  }

  if (variant === "tiles") {
    const tilesInitial = initialMode ?? ACTIVE_MODE;
    return <TilesPhoneFrame key={tilesInitial} large={large} caption={caption} initialMode={tilesInitial} />;
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
        Glance first — no lanes
      </h2>
      <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
        Organisation and roomy spacing made mode choice harder at a glance. Both YES directions stay flat so more modes
        are visible on open.
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
        YES 01 is the dense title list. YES 02 is flat icon tiles — still no Find / Diagnose / Care.
      </p>
    </aside>
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
            New YES comps · glance without organisation
          </h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)] sm:text-base sm:leading-7">
            Two large directions. Both drop Find / Diagnose / Care lanes and roomy chrome so you can see and pick a mode
            in one glance.
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
                Dense title list
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-[color:var(--text-muted)]">
              Title-only rows — no section chrome. Full catalogue scannable on open; switch keeps header and selection
              in sync.
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-5">
            <PhoneFrame variant="dense" large caption="Rest · most modes visible" densePreview="rest" />
            <PhoneFrame variant="dense" large caption="Scrolled · mid catalogue" densePreview="scrolled" />
            <PhoneFrame
              variant="dense"
              large
              caption="Switched · DSM-5 current"
              densePreview="switched"
              initialMode="dsm"
            />
          </div>
        </section>

        <section aria-labelledby="tiles-pair-title" className="mt-14">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-3xs font-black uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
                YES 02 · Icon-forward
              </p>
              <h2
                id="tiles-pair-title"
                className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[color:var(--text-heading)]"
              >
                Flat icon tiles
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-[color:var(--text-muted)]">
              Same flat catalogue as a two-column tile grid — still no clinical lanes. Tap to switch; header tracks the
              pick.
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-5">
            <PhoneFrame variant="tiles" large caption="Rest · Answer selected" />
            <PhoneFrame variant="tiles" large caption="Switched · Tools selected" initialMode="tools" />
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
                Flat list with subtitles
              </h2>
            </div>
            <PhoneFrame variant="current" caption="Current · title + truncated description" />
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

              {variant.id === "dense" ? (
                <PhoneFrame variant="dense" large caption="Detail · Dense title list" />
              ) : (
                <PhoneFrame variant="tiles" large caption="Detail · Flat icon tiles" />
              )}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
