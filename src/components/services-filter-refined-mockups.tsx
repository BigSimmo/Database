"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Funnel,
  ListFilter,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { cn } from "@/components/ui-primitives";

/**
 * Three directions for the services filter surface — the sheet reached from the
 * "Filter" control in the services results band.
 *
 * The thesis in one line: the shipped sheet is titled "Filter services" but
 * nothing in it filters. Every chip calls `applyServiceQuery(...)`, which pushes
 * a new route and REPLACES the query, so choosing "Crisis" while reading
 * "16 services · lithium level timing" discards that search. It is a preset
 * switcher wearing a funnel icon. All three directions below start by separating
 * the two verbs — narrow these results vs. start a different search — and differ
 * only in how far they take the second half.
 *
 * Every count on this page is real. `data/services-snapshot.json` already carries
 * populated `CatalogServiceTags` for all 219 services; the facet masks below are
 * generated from it, and the counts you see recompute live as facets are
 * selected (OR within a group, AND across groups). Nothing here is a placeholder
 * number, which matters because "no per-chip counts" is one of the defects being
 * fixed — a comp that fakes them would be arguing its own case.
 *
 * Deliberate departures from the shipped sheet, common to all three:
 *   - Presets are visually separated from filters and marked as navigational.
 *     They leave the current search; filters do not.
 *   - The footer's passive "16 showing" becomes the primary commit — "Show 41
 *     services" — so the button states its own outcome.
 *   - Counts on every facet, so a choice is never blind and a zero-yield facet
 *     is legible before it is tapped.
 *   - One selection contract across breakpoints. Today phone is a
 *     `role="radiogroup"` (single-select) while desktop is a rail of
 *     `aria-pressed` toggles (multi-select) — the same six filters under two
 *     contradictory promises.
 *
 * Sizing note: these studies render a 390px phone frame inside a wide page, so
 * viewport `sm:` variants would resolve against the page rather than the frame.
 * Every component here takes an explicit `compact` flag instead — `compact`
 * mirrors the production `min-h-tap` (48px) phone floor, and the wide variant
 * mirrors `sm:min-h-9`/`min-h-10`.
 */

/* ------------------------------------------------------------------------- */
/* Facet index — generated from data/services-snapshot.json (219 services)    */
/* ------------------------------------------------------------------------- */

export const SERVICE_TOTAL = 219;

/**
 * One base64 bitmask per facet, 219 bits wide, index-aligned to the snapshot's
 * service order. ~1KB total, which is what makes live recomputation affordable
 * inside a mockup that still has to answer to `check:bundle-budget`.
 */
const FACET_MASKS: Record<string, string> = {
  "acuity:crisis_high": "gYAUgA88gAKABMMMPxQCAABFAHAIAAAQAUgAAg==",
  "acuity:high": "8KcQ084ePBCBhJCUOUMDA4NuCmnICv0blRhHAw==",
  "acuity:moderate": "9qc/qftbv81j9Brs/+9Xw+dvv+nsuxOJtzv3Aw==",
  "acuity:supportive": "//vf/3v9/Gb+v///f3W//5//zB9fzv//2fz9Bg==",
  "catchment:Metro-wide": "1/qP/X384AXs/0r/X2Q//p7HzB8dwPv9n/x9Ag==",
  "catchment:Regional WA": "gwABQwAQYP6Hg7wAEDwAAALoOIBIfL4D4ScABA==",
  "catchment:SMHS/Fremantle": "OAAAQQABHwAQggAQoAACEAQcAwCiAgQCAACDAQ==",
  "catchment:NMHS/North Metro": "QCACQQAAAAEAAAAggEDA58ACAAAwAEUIEYBlAA==",
  "catchment:EMHS City East": "AA8wA4oGAAAAQAEgiIMBACMAAGAAAQACABCBAQ==",
  "catchment:Peel": "AABAAAAAAAAAggAAqAAAIACYAwAAAgQCAAAAAA==",
  "catchment:Armadale/Kalamunda": "AAEAQAAAAAAAAAAggAAAAAAAAAAgAQACAAAAAA==",
  "age:youth": "AMINgMFUAAEhAAKQgBBDwh1AxAAhAAEAAer/Bw==",
  "age:young_adult": "AAIAAIAEAAEAAAIAAAABAgAAxAAgAAAAAIBfBw==",
  "age:adult": "cGc6AAADP0QDoDgATHVCnQMfKwAC2OkIkhYhAA==",
  "age:older_adult": "AAYwgAAAGUQDADgAADUCQQAICgAAWAAAgBYAAA==",
  "setting:community": "dH/2/5oDP4r29RR+cUvAf4Ar0zIW5O0ttZPtBw==",
  "setting:hospital_residential": "8G/2/9uXP97f99z6cUvDf44v23uT7P3/v5vvBQ==",
  "setting:digital_phone": "u5BTn0ubzHDr99YUW5PqaQrVIFkIEBJSCBrHBw==",
  "focus:aod": "kAIBOVRMoIqkQTSDkBoLAHPg8OTgJxCgIhEYAg==",
  "focus:housing_support": "wBxQxkiwoBAaP0GbJIIJAJ6ggAmFwPzLCchUAA==",
  "focus:home_based": "YAAAAAIAAAAAAAAAIAAAAQAAAAAAAAAAAQAGAA==",
  "confidence:High": "tq8/7Vv2n4+8vo65/W1fw+vf3/87b/2rt739Aw==",
  "confidence:Medium": "QVDAEqQJIGBDQXFGApKgPBQgIADEkAIUSEICBA==",
  "confidence:Low": "CAAAAAAAQBAAAAAAAAAAAAAAAAAAAABAAAAAAA==",
};

export type FacetGroupId = "acuity" | "catchment" | "age" | "setting" | "focus" | "confidence";

type FacetGroup = {
  id: FacetGroupId;
  label: string;
  /** Shown under the group heading in the widest direction only. */
  hint: string;
  facets: ReadonlyArray<{ id: string; label: string }>;
};

export const FACET_GROUPS: ReadonlyArray<FacetGroup> = [
  {
    id: "acuity",
    label: "Acuity",
    hint: "What the service is equipped to hold.",
    facets: [
      { id: "acuity:crisis_high", label: "Crisis" },
      { id: "acuity:high", label: "High acuity" },
      { id: "acuity:moderate", label: "Moderate" },
      { id: "acuity:supportive", label: "Supportive" },
    ],
  },
  {
    id: "catchment",
    label: "Catchment",
    hint: "Where the patient has to live.",
    facets: [
      { id: "catchment:Metro-wide", label: "Metro-wide" },
      { id: "catchment:Regional WA", label: "Regional WA" },
      { id: "catchment:SMHS/Fremantle", label: "SMHS / Fremantle" },
      { id: "catchment:NMHS/North Metro", label: "NMHS / North Metro" },
      { id: "catchment:EMHS City East", label: "EMHS / City East" },
      { id: "catchment:Peel", label: "Peel" },
      { id: "catchment:Armadale/Kalamunda", label: "Armadale / Kalamunda" },
    ],
  },
  {
    id: "age",
    label: "Age group",
    hint: "Stated age scope, beyond the near-universal “mixed”.",
    facets: [
      { id: "age:youth", label: "Youth" },
      { id: "age:young_adult", label: "Young adult" },
      { id: "age:adult", label: "Adult" },
      { id: "age:older_adult", label: "Older adult" },
    ],
  },
  {
    id: "setting",
    label: "Setting",
    hint: "How contact actually happens.",
    facets: [
      { id: "setting:community", label: "Community" },
      { id: "setting:hospital_residential", label: "Hospital / residential" },
      { id: "setting:digital_phone", label: "Digital & phone" },
    ],
  },
  {
    id: "focus",
    label: "Specialist focus",
    hint: "Co-occurring need the service names explicitly.",
    facets: [
      { id: "focus:aod", label: "Alcohol & other drugs" },
      { id: "focus:housing_support", label: "Housing support" },
      { id: "focus:home_based", label: "Home-based" },
    ],
  },
  {
    id: "confidence",
    label: "Record confidence",
    hint: "How well verified this entry is.",
    facets: [
      { id: "confidence:High", label: "High" },
      { id: "confidence:Medium", label: "Medium" },
      { id: "confidence:Low", label: "Low" },
    ],
  },
];

const GROUP_OF_FACET = new Map<string, FacetGroupId>(
  FACET_GROUPS.flatMap((group) => group.facets.map((facet) => [facet.id, group.id] as const)),
);

const FACET_LABEL = new Map<string, string>(
  FACET_GROUPS.flatMap((group) => group.facets.map((facet) => [facet.id, facet.label] as const)),
);

const MASK_LENGTH = Math.ceil(SERVICE_TOTAL / 8);

/** TypeScript 6 distinguishes the backing buffer, so the alias keeps every helper in agreement. */
type Mask = Uint8Array<ArrayBuffer>;

function decodeMask(encoded: string): Mask {
  const binary = atob(encoded);
  if (binary.length !== MASK_LENGTH) {
    throw new Error(`Service facet mask length mismatch: expected ${MASK_LENGTH} bytes, got ${binary.length}`);
  }
  const bytes = new Uint8Array(MASK_LENGTH);
  for (let index = 0; index < MASK_LENGTH; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

const DECODED: Record<string, Mask> = Object.fromEntries(
  Object.entries(FACET_MASKS).map(([key, value]) => [key, decodeMask(value)]),
);

/** All 219 bits set — the "no filters" starting universe. */
const UNIVERSE = (() => {
  const bytes = new Uint8Array(MASK_LENGTH).fill(0xff);
  const overflow = MASK_LENGTH * 8 - SERVICE_TOTAL;
  if (overflow > 0) bytes[MASK_LENGTH - 1] &= 0xff >> overflow;
  return bytes;
})();

function and(left: Mask, right: Mask): Mask {
  const out = new Uint8Array(MASK_LENGTH);
  for (let index = 0; index < MASK_LENGTH; index += 1) out[index] = left[index] & right[index];
  return out;
}

function or(left: Mask, right: Mask): Mask {
  const out = new Uint8Array(MASK_LENGTH);
  for (let index = 0; index < MASK_LENGTH; index += 1) out[index] = left[index] | right[index];
  return out;
}

function popcount(mask: Mask): number {
  let total = 0;
  for (let index = 0; index < MASK_LENGTH; index += 1) {
    let byte = mask[index];
    while (byte) {
      byte &= byte - 1;
      total += 1;
    }
  }
  return total;
}

/** OR within a group, AND across groups — the standard facet contract. */
function maskForSelection(selected: ReadonlySet<string>, skipGroup?: FacetGroupId): Mask {
  let result: Mask = UNIVERSE;
  for (const group of FACET_GROUPS) {
    if (group.id === skipGroup) continue;
    const chosen = group.facets.filter((facet) => selected.has(facet.id));
    if (chosen.length === 0) continue;
    let union: Mask = new Uint8Array(MASK_LENGTH);
    for (const facet of chosen) union = or(union, DECODED[facet.id]);
    result = and(result, union);
  }
  return result;
}

export type FacetCounts = { total: number; perFacet: Record<string, number> };

export function useFacetCounts(selected: ReadonlySet<string>): FacetCounts {
  return useMemo(() => {
    const total = popcount(maskForSelection(selected));
    const perFacet: Record<string, number> = {};
    for (const group of FACET_GROUPS) {
      for (const facet of group.facets) {
        const candidate = new Set(selected);
        candidate.add(facet.id);
        perFacet[facet.id] = popcount(maskForSelection(candidate));
      }
    }
    return { total, perFacet };
  }, [selected]);
}

/* ------------------------------------------------------------------------- */
/* Presets — the six that ship today, unchanged in meaning                    */
/* ------------------------------------------------------------------------- */

export const PRESETS: ReadonlyArray<{ id: string; label: string; detail: string }> = [
  { id: "best-fit", label: "Best fit", detail: "13YARN crisis · culturally safe · phone" },
  { id: "crisis", label: "Crisis", detail: "Searches “crisis”" },
  { id: "culturally-safe", label: "Culturally safe", detail: "Aboriginal & Torres Strait Islander" },
  { id: "phone", label: "Phone referral", detail: "Searches “phone referral”" },
  { id: "free", label: "Free", detail: "Searches “free”" },
  { id: "wa", label: "WA", detail: "Searches “WA”" },
];

/** Real records from the snapshot, so the frames are not populated with invented services. */
const SAMPLE_RESULTS: ReadonlyArray<{ name: string; meta: string; confidence: string }> = [
  { name: "Crisis Care", meta: "Metro-wide · Community, phone", confidence: "High" },
  { name: "CAMHS Crisis Connect", meta: "Metro-wide · Digital & phone", confidence: "High" },
  { name: "Alcohol and Drug Support Line", meta: "Regional WA · Digital & phone", confidence: "High" },
  { name: "13YARN", meta: "Regional WA, Metro-wide · Phone", confidence: "Medium" },
];

/* ------------------------------------------------------------------------- */
/* Shared control primitives                                                  */
/* ------------------------------------------------------------------------- */

export const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

/** The tap floor: 48px on phone per the repo's `--spacing-tap`, 36px where a pointer is likely. */
function tapHeight(compact: boolean) {
  return compact ? "min-h-tap" : "min-h-9";
}

export function FacetChip({
  label,
  count,
  selected,
  compact,
  onToggle,
}: {
  label: string;
  count: number;
  selected: boolean;
  compact: boolean;
  onToggle: () => void;
}) {
  const empty = count === 0 && !selected;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={onToggle}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 text-2xs font-semibold transition",
        "motion-reduce:transition-none",
        tapHeight(compact),
        focusRing,
        selected
          ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
          : empty
            ? // A muted pair plus a dashed edge, never `opacity-50`: transparency
              // multiplies against an already-muted foreground and does not
              // survive forced colors, where border-style is preserved.
              "border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] text-[color:var(--text-soft)]"
            : "border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-icon-sm shrink-0 place-items-center rounded-[0.25rem] border transition-colors",
          selected
            ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--surface)]"
            : "border-[color:var(--border-strong)] bg-[color:var(--surface)]",
        )}
      >
        {selected ? <Check className="h-2.5 w-2.5" strokeWidth={3.5} /> : null}
      </span>
      <span className="truncate">{label}</span>
      <span className="nums text-3xs font-bold tabular-nums text-[color:var(--text-soft)]">{count}</span>
    </button>
  );
}

export function ActiveFilterPill({
  facetId,
  onRemove,
  compact,
}: {
  facetId: string;
  onRemove: () => void;
  compact: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] pl-2.5 pr-1 text-2xs font-bold text-[color:var(--clinical-accent)]",
        compact ? "min-h-8" : "min-h-7",
      )}
    >
      {FACET_LABEL.get(facetId)}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${FACET_LABEL.get(facetId)} filter`}
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-full hover:bg-[color:var(--clinical-accent)]/15",
          focusRing,
        )}
      >
        <X aria-hidden className="h-3 w-3" />
      </button>
    </span>
  );
}

export function PresetRow({
  preset,
  compact,
  onRun,
}: {
  preset: (typeof PRESETS)[number];
  compact: boolean;
  onRun: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRun}
      className={cn(
        "group flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2.5 text-left transition",
        "hover:border-[color:var(--border)] hover:bg-[color:var(--surface-subtle)]",
        compact ? "min-h-tap" : "min-h-10",
        focusRing,
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-2xs font-bold text-[color:var(--text)]">{preset.label}</span>
        <span className="block truncate text-3xs font-medium text-[color:var(--text-soft)]">{preset.detail}</span>
      </span>
      {/* The glyph is the whole point: it says this control leaves the page. */}
      <ArrowUpRight
        aria-hidden
        className="size-icon-sm shrink-0 text-[color:var(--text-soft)] group-hover:text-[color:var(--clinical-accent)]"
      />
    </button>
  );
}

/** The band the sheet is opened from — reproduced so each frame has real context. */
export function ResultsBand({
  compact,
  count,
  query,
  activeCount,
  onOpen,
  variant,
  children,
}: {
  compact: boolean;
  count: number;
  query: string;
  activeCount: number;
  onOpen: () => void;
  variant: "trigger" | "rail";
  children?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]">
      <div className={cn("flex items-center gap-2 px-2.5", compact ? "min-h-14" : "min-h-12")}>
        <span className="min-w-0 flex-1 truncate">
          <span className="nums text-sm font-extrabold tabular-nums text-[color:var(--text-heading)]">{count}</span>{" "}
          <span className="text-xs font-bold text-[color:var(--text-muted)]">services</span>
          <span className="text-xs font-medium text-[color:var(--text-soft)]"> · {query}</span>
        </span>
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-2xs font-bold transition",
            compact ? "min-h-tap" : "min-h-9",
            focusRing,
            activeCount > 0
              ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
              : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]",
          )}
        >
          <Funnel aria-hidden className="size-icon-sm" />
          {variant === "rail" ? "More filters" : "Filter"}
          {activeCount > 0 ? (
            <span className="nums grid h-4 min-w-4 place-items-center rounded-full bg-[color:var(--clinical-accent)]/15 px-1 text-3xs font-black tabular-nums">
              {activeCount}
            </span>
          ) : null}
        </button>
      </div>
      {children}
    </div>
  );
}

export function ResultsPreview({ compact, count }: { compact: boolean; count: number }) {
  const previewCount = compact ? 2 : 3;
  const visible = Math.min(count, previewCount);
  const remaining = Math.max(count - previewCount, 0);

  return (
    <div className="mt-2 grid content-start gap-1.5">
      {count === 0 ? (
        <span className="px-1 py-3 text-center text-3xs font-semibold text-[color:var(--text-soft)]">
          No services match this filter set.
        </span>
      ) : (
        <>
          {SAMPLE_RESULTS.slice(0, visible).map((result) => (
            <div
              key={result.name}
              className="flex items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-2xs font-bold text-[color:var(--text)]">{result.name}</span>
                <span className="block truncate text-3xs font-medium text-[color:var(--text-soft)]">{result.meta}</span>
              </span>
              <span className="shrink-0 rounded-full bg-[color:var(--surface-subtle)] px-1.5 py-0.5 text-3xs font-bold text-[color:var(--text-soft)]">
                {result.confidence}
              </span>
            </div>
          ))}
          {remaining > 0 ? (
            <span className="px-1 text-3xs font-semibold text-[color:var(--text-soft)]">+ {remaining} more</span>
          ) : null}
        </>
      )}
    </div>
  );
}

/** Bottom-sheet shell used by the phone frames — an in-frame simulation of `Sheet`. */
export function PhoneSheetShell({
  title,
  description,
  onClear,
  children,
  footer,
  fullHeight = false,
  maxHeight = "max-h-[72%]",
}: {
  title: string;
  description?: string;
  onClear?: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
  fullHeight?: boolean;
  /** Overrides the default detent. Use when the surface behind the sheet is
      part of the argument and must stay visible. */
  maxHeight?: string;
}) {
  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-2xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-elevated)]",
        fullHeight ? "top-6" : maxHeight,
      )}
    >
      <div className="flex shrink-0 justify-center pb-1 pt-2" aria-hidden>
        <span className="h-1 w-9 rounded-full bg-[color:var(--border-strong)]" />
      </div>
      <div className="flex shrink-0 items-start gap-2 border-b border-[color:var(--border)] px-3.5 pb-3">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-extrabold text-[color:var(--text-heading)]">{title}</h4>
          {description ? (
            <p className="mt-0.5 text-3xs font-medium text-[color:var(--text-soft)]">{description}</p>
          ) : null}
        </div>
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            className={cn(
              "inline-flex min-h-tap shrink-0 items-center gap-1 rounded-lg px-2 text-3xs font-bold text-[color:var(--clinical-accent)] hover:bg-[color:var(--clinical-accent-soft)]",
              focusRing,
            )}
          >
            <RotateCcw aria-hidden className="h-3 w-3" />
            Clear
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-2.5">{children}</div>
      <div className="shrink-0 border-t border-[color:var(--border)] bg-[color:var(--surface)] px-3.5 py-2.5">
        {footer}
      </div>
    </div>
  );
}

/** The committed primary action — states its own outcome instead of "Done". */
export function CommitButton({
  count,
  compact,
  disabled = false,
}: {
  count: number;
  compact: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-disabled={disabled || undefined}
      onClick={() => {
        /* Comp only — the real control closes the sheet and commits the selection. */
      }}
      className={cn(
        "inline-flex w-full items-center justify-center rounded-lg px-3 text-xs font-extrabold transition",
        compact ? "min-h-tap" : "min-h-10",
        focusRing,
        disabled
          ? "cursor-default border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] text-[color:var(--text-soft)]"
          : "bg-[color:var(--clinical-accent)] text-white hover:brightness-110",
      )}
    >
      {disabled ? "No services match — widen a filter" : `Show ${count} ${count === 1 ? "service" : "services"}`}
    </button>
  );
}

function GroupHeading({ group, showHint }: { group: FacetGroup; showHint?: boolean }) {
  return (
    <>
      <h5 className="flex min-h-7 items-center text-3xs font-black uppercase tracking-eyebrow text-[color:var(--text-muted)]">
        {group.label}
      </h5>
      {showHint ? (
        <p className="-mt-0.5 mb-1.5 text-3xs font-medium text-[color:var(--text-soft)]">{group.hint}</p>
      ) : null}
    </>
  );
}

/** The facet body every direction shares, so the three differ by frame and not by content. */
export function FacetGroupsBody({
  selected,
  counts,
  onToggle,
  compact,
  columns = 1,
  showHints = false,
  needle = "",
  collapsible = false,
  collapsedGroups,
  onToggleGroup,
}: {
  selected: ReadonlySet<string>;
  counts: FacetCounts;
  onToggle: (facetId: string) => void;
  compact: boolean;
  columns?: 1 | 2;
  showHints?: boolean;
  needle?: string;
  collapsible?: boolean;
  collapsedGroups?: ReadonlySet<FacetGroupId>;
  onToggleGroup?: (groupId: FacetGroupId) => void;
}) {
  const trimmed = needle.trim().toLowerCase();
  const groups = FACET_GROUPS.map((group) => ({
    group,
    // A selected facet stays reachable while searching: hiding it would strand
    // the only control that can remove it.
    facets: trimmed
      ? group.facets.filter((facet) => selected.has(facet.id) || facet.label.toLowerCase().includes(trimmed))
      : group.facets,
  })).filter((entry) => entry.facets.length > 0);

  if (groups.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-2xs font-semibold text-[color:var(--text-soft)]">
        No filter matches “{needle}”.
      </p>
    );
  }

  return (
    <div className={cn("grid gap-2.5", columns === 2 && "sm:grid-cols-2 sm:gap-x-5")}>
      {groups.map(({ group, facets }) => {
        const isCollapsed = collapsible && Boolean(collapsedGroups?.has(group.id)) && !trimmed;
        const chosen = group.facets.filter((facet) => selected.has(facet.id)).length;
        return (
          <section key={group.id} className="min-w-0">
            {collapsible ? (
              <button
                type="button"
                onClick={() => onToggleGroup?.(group.id)}
                aria-expanded={!isCollapsed}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded-md px-1 text-left hover:bg-[color:var(--surface-subtle)]",
                  compact ? "min-h-tap" : "min-h-8",
                  focusRing,
                )}
              >
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "size-icon-sm shrink-0 text-[color:var(--text-soft)] transition-transform motion-reduce:transition-none",
                    isCollapsed && "-rotate-90",
                  )}
                />
                <span className="flex-1 text-3xs font-black uppercase tracking-eyebrow text-[color:var(--text-muted)]">
                  {group.label}
                </span>
                {chosen > 0 ? (
                  <span className="nums rounded-full bg-[color:var(--clinical-accent-soft)] px-1.5 text-3xs font-black tabular-nums text-[color:var(--clinical-accent)]">
                    {chosen}
                  </span>
                ) : null}
              </button>
            ) : (
              <GroupHeading group={group} showHint={showHints} />
            )}
            {isCollapsed ? null : (
              <div className={cn("flex flex-wrap gap-1.5", collapsible && "pb-1 pl-1 pt-1")}>
                {facets.map((facet) => (
                  <FacetChip
                    key={facet.id}
                    label={facet.label}
                    count={counts.perFacet[facet.id] ?? 0}
                    selected={selected.has(facet.id)}
                    compact={compact}
                    onToggle={() => onToggle(facet.id)}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function PresetBlock({ compact, onRun }: { compact: boolean; onRun: () => void }) {
  return (
    <section className="min-w-0">
      <div className="flex min-h-7 items-center gap-1.5">
        <ArrowUpRight aria-hidden className="size-icon-sm shrink-0 text-[color:var(--text-soft)]" />
        <h5 className="text-3xs font-black uppercase tracking-eyebrow text-[color:var(--text-muted)]">
          Start a new search
        </h5>
      </div>
      <p className="mb-1 text-3xs font-medium text-[color:var(--text-soft)]">
        These replace the current query and clear your filters.
      </p>
      <div className="grid">
        {PRESETS.map((preset) => (
          <PresetRow key={preset.id} preset={preset} compact={compact} onRun={onRun} />
        ))}
      </div>
    </section>
  );
}

function ActiveFilterBar({
  selected,
  onRemove,
  onClear,
  compact,
}: {
  selected: ReadonlySet<string>;
  onRemove: (facetId: string) => void;
  onClear: () => void;
  compact: boolean;
}) {
  if (selected.size === 0) return null;
  // Ordered by the group ladder rather than click order, so the bar does not
  // reshuffle under the reader's thumb as filters are added.
  const ordered = FACET_GROUPS.flatMap((group) => group.facets.filter((facet) => selected.has(facet.id))).map(
    (facet) => facet.id,
  );
  return (
    <div className="flex items-center gap-1.5 border-t border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2.5 py-1.5">
      <div className="polished-scroll flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
        {ordered.map((facetId) => (
          <ActiveFilterPill key={facetId} facetId={facetId} compact={compact} onRemove={() => onRemove(facetId)} />
        ))}
      </div>
      <button
        type="button"
        onClick={onClear}
        className={cn(
          "inline-flex shrink-0 items-center rounded-lg px-2 text-3xs font-bold text-[color:var(--clinical-accent)] hover:bg-[color:var(--clinical-accent-soft)]",
          compact ? "min-h-tap" : "min-h-7",
          focusRing,
        )}
      >
        Clear all
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Today — the shipped sheet, reproduced so the comparison is honest          */
/* ------------------------------------------------------------------------- */

function TodaySheet() {
  return (
    <div className="relative h-[30rem] overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2.5">
      <ResultsBand
        compact
        count={16}
        query="lithium level timing"
        activeCount={0}
        onOpen={() => {}}
        variant="trigger"
      />
      <ResultsPreview compact count={16} />
      <div className="absolute inset-x-0 bottom-0 flex h-[62%] flex-col rounded-t-2xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-elevated)]">
        <div className="flex shrink-0 justify-center pb-1 pt-2" aria-hidden>
          <span className="h-1 w-9 rounded-full bg-[color:var(--border-strong)]" />
        </div>
        <div className="flex shrink-0 items-start gap-3 border-b border-[color:var(--border)] p-3.5">
          <div className="min-w-0 flex-1">
            <h4 className="text-base font-extrabold text-[color:var(--text-heading)]">Filter services</h4>
            <p className="mt-0.5 text-2xs font-medium text-[color:var(--text-soft)]">
              Quick filters run a new service search.
            </p>
          </div>
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-[color:var(--border)]">
            <X aria-hidden className="size-icon-md text-[color:var(--text-muted)]" />
          </span>
        </div>
        <div className="flex-1 p-3.5">
          <h5 className="mb-2 text-3xs font-black uppercase tracking-eyebrow text-[color:var(--text-muted)]">
            Quick filters
          </h5>
          <div className="flex flex-wrap gap-2">
            {["Current search", "Best fit", "Crisis", "Culturally safe", "Phone referral", "Free", "WA"].map(
              (label, index) => (
                <span
                  key={label}
                  className={cn(
                    "inline-flex min-h-tap items-center gap-1.5 rounded-md border px-2.5 text-2xs font-semibold",
                    index === 0
                      ? "border-[color:var(--clinical-accent)]/35 bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                      : "border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)]",
                  )}
                >
                  {index === 0 ? <Check aria-hidden className="h-3 w-3" /> : null}
                  {label}
                </span>
              ),
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[color:var(--border)] p-3.5">
          <span className="text-2xs font-semibold text-[color:var(--text-muted)]">16 showing</span>
          <span className="inline-flex min-h-tap items-center rounded-lg border border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] px-3 text-xs font-extrabold text-[color:var(--clinical-accent)]">
            Done
          </span>
        </div>
      </div>
    </div>
  );
}

const TODAY_DEFECTS: ReadonlyArray<{ label: string; detail: string }> = [
  {
    label: "“Filter” does not filter",
    detail:
      "Every chip calls applyServiceQuery() and replaces the query. Choosing Crisis discards “lithium level timing” and the 16 results with it.",
  },
  {
    label: "One flat row, four categories",
    detail: "Match quality, clinical need, cost and region share an undifferentiated chip row with no grouping.",
  },
  {
    label: "No counts anywhere",
    detail: "Nothing tells you what a chip yields, so every choice is blind. “16 showing” is a passive footer label.",
  },
  {
    label: "Dead band below the fold",
    detail: "Content fills roughly a third of a sheet that takes 45% of the viewport. The rest is empty surface.",
  },
  {
    label: "Two dismissals, no reset",
    detail:
      "A heavy outlined ✕ competes with the title while “Done” — the primary action — is a low-emphasis outlined button. Clear only appears once a preset is already active.",
  },
  {
    label: "Breakpoints disagree",
    detail:
      'Phone is a role="radiogroup" (pick one); desktop is a rail of aria-pressed toggles (pick many). Same six filters, two contracts.',
  },
];

/* ------------------------------------------------------------------------- */
/* Direction A — Refine in place                                              */
/* ------------------------------------------------------------------------- */

function DirectionA({
  compact,
  selected,
  counts,
  onToggle,
  onClear,
}: {
  compact: boolean;
  selected: ReadonlySet<string>;
  counts: FacetCounts;
  onToggle: (facetId: string) => void;
  onClear: () => void;
}) {
  if (compact) {
    return (
      <div className="relative h-[34rem] overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2.5">
        <ResultsBand
          compact
          count={counts.total}
          query="all services"
          activeCount={selected.size}
          onOpen={() => {}}
          variant="trigger"
        >
          <ActiveFilterBar compact selected={selected} onRemove={onToggle} onClear={onClear} />
        </ResultsBand>
        <ResultsPreview compact count={counts.total} />
        <PhoneSheetShell
          title="Refine services"
          description={`${counts.total} of ${SERVICE_TOTAL} in the catalogue`}
          onClear={selected.size > 0 ? onClear : undefined}
          footer={<CommitButton count={counts.total} compact disabled={counts.total === 0} />}
        >
          <FacetGroupsBody selected={selected} counts={counts} onToggle={onToggle} compact />
          <div className="my-2.5 border-t border-[color:var(--border)]" />
          <PresetBlock compact onRun={onClear} />
        </PhoneSheetShell>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <ResultsBand
        compact={false}
        count={counts.total}
        query="all services"
        activeCount={selected.size}
        onOpen={() => {}}
        variant="rail"
      >
        <ActiveFilterBar compact={false} selected={selected} onRemove={onToggle} onClear={onClear} />
      </ResultsBand>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <ResultsPreview compact={false} count={counts.total} />
        {/* The popover the "More filters" control opens, shown open. */}
        <div className="overflow-hidden rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-elevated)]">
          <div className="flex items-start gap-2 border-b border-[color:var(--border)] px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <h4 className="text-2xs font-extrabold text-[color:var(--text-heading)]">Refine services</h4>
              <p className="text-3xs font-medium text-[color:var(--text-soft)]">
                {counts.total} of {SERVICE_TOTAL} in the catalogue
              </p>
            </div>
            {selected.size > 0 ? (
              <button
                type="button"
                onClick={onClear}
                className={cn(
                  "inline-flex min-h-7 items-center gap-1 rounded-lg px-2 text-3xs font-bold text-[color:var(--clinical-accent)] hover:bg-[color:var(--clinical-accent-soft)]",
                  focusRing,
                )}
              >
                <RotateCcw aria-hidden className="h-3 w-3" />
                Clear
              </button>
            ) : null}
          </div>
          <div className="max-h-[22rem] overflow-y-auto px-3 py-2.5">
            <FacetGroupsBody selected={selected} counts={counts} onToggle={onToggle} compact={false} />
            <div className="my-2.5 border-t border-[color:var(--border)]" />
            <PresetBlock compact={false} onRun={onClear} />
          </div>
          <div className="border-t border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5">
            <CommitButton count={counts.total} compact={false} disabled={counts.total === 0} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Direction B — Presets vs Filters, split by a visible segment               */
/* ------------------------------------------------------------------------- */

type SegmentValue = "narrow" | "new";

function SegmentSwitch({
  value,
  onChange,
  compact,
  narrowCount,
}: {
  value: SegmentValue;
  onChange: (next: SegmentValue) => void;
  compact: boolean;
  narrowCount: number;
}) {
  const segments: ReadonlyArray<{ value: SegmentValue; label: string }> = [
    { value: "narrow", label: `Narrow these ${narrowCount}` },
    { value: "new", label: "Start a new search" },
  ];
  return (
    <div
      role="group"
      aria-label="Filter mode"
      className="inline-flex w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-1"
    >
      {segments.map((segment) => (
        <button
          key={segment.value}
          type="button"
          aria-pressed={value === segment.value}
          onClick={() => onChange(segment.value)}
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-2xs font-extrabold transition-colors",
            "motion-reduce:transition-none",
            compact ? "min-h-tap" : "min-h-9",
            focusRing,
            value === segment.value
              ? "bg-[color:var(--surface)] text-[color:var(--text-heading)] shadow-[var(--shadow-inset)]"
              : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
          )}
        >
          {segment.value === "narrow" ? (
            <ListFilter aria-hidden className="size-icon-sm shrink-0" />
          ) : (
            <ArrowUpRight aria-hidden className="size-icon-sm shrink-0" />
          )}
          <span className="truncate">{segment.label}</span>
        </button>
      ))}
    </div>
  );
}

function DirectionBBody({
  segment,
  selected,
  counts,
  onToggle,
  onClear,
  compact,
  columns,
}: {
  segment: SegmentValue;
  selected: ReadonlySet<string>;
  counts: FacetCounts;
  onToggle: (facetId: string) => void;
  onClear: () => void;
  compact: boolean;
  columns?: 1 | 2;
}) {
  if (segment === "new") {
    return (
      <div className="grid gap-1">
        <p className="px-1 pb-1 text-3xs font-medium text-[color:var(--text-soft)]">
          Each of these replaces the current query and clears your filters — the behaviour every chip in the shipped
          sheet already has, now stated.
        </p>
        {PRESETS.map((preset) => (
          <PresetRow key={preset.id} preset={preset} compact={compact} onRun={onClear} />
        ))}
      </div>
    );
  }
  return (
    <FacetGroupsBody
      selected={selected}
      counts={counts}
      onToggle={onToggle}
      compact={compact}
      columns={columns}
      showHints
    />
  );
}

function DirectionB({
  compact,
  selected,
  counts,
  onToggle,
  onClear,
  segment,
  onSegment,
}: {
  compact: boolean;
  selected: ReadonlySet<string>;
  counts: FacetCounts;
  onToggle: (facetId: string) => void;
  onClear: () => void;
  segment: SegmentValue;
  onSegment: (next: SegmentValue) => void;
}) {
  const body = (columns?: 1 | 2) => (
    <DirectionBBody
      segment={segment}
      selected={selected}
      counts={counts}
      onToggle={onToggle}
      onClear={onClear}
      compact={compact}
      columns={columns}
    />
  );

  if (compact) {
    return (
      <div className="relative h-[34rem] overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2.5">
        <ResultsBand
          compact
          count={counts.total}
          query="all services"
          activeCount={selected.size}
          onOpen={() => {}}
          variant="trigger"
        >
          <ActiveFilterBar compact selected={selected} onRemove={onToggle} onClear={onClear} />
        </ResultsBand>
        <ResultsPreview compact count={counts.total} />
        <PhoneSheetShell
          title="Filter services"
          onClear={selected.size > 0 ? onClear : undefined}
          footer={<CommitButton count={counts.total} compact disabled={counts.total === 0} />}
        >
          <div className="pb-2.5">
            <SegmentSwitch value={segment} onChange={onSegment} compact narrowCount={counts.total} />
          </div>
          {body(1)}
        </PhoneSheetShell>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <ResultsBand
        compact={false}
        count={counts.total}
        query="all services"
        activeCount={selected.size}
        onOpen={() => {}}
        variant="trigger"
      >
        <ActiveFilterBar compact={false} selected={selected} onRemove={onToggle} onClear={onClear} />
      </ResultsBand>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <ResultsPreview compact={false} count={counts.total} />
        <div className="overflow-hidden rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-elevated)]">
          <div className="border-b border-[color:var(--border)] px-3 py-2.5">
            <SegmentSwitch value={segment} onChange={onSegment} compact={false} narrowCount={counts.total} />
          </div>
          <div className="max-h-[22rem] overflow-y-auto px-3 py-2.5">{body(2)}</div>
          <div className="flex items-center gap-2 border-t border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5">
            {selected.size > 0 ? (
              <button
                type="button"
                onClick={onClear}
                className={cn(
                  "inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg border border-[color:var(--border)] px-2.5 text-2xs font-bold text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
                  focusRing,
                )}
              >
                <RotateCcw aria-hidden className="h-3 w-3" />
                Reset
              </button>
            ) : null}
            <span className="min-w-0 flex-1">
              <CommitButton count={counts.total} compact={false} disabled={counts.total === 0} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Direction C — Directory-grade refine                                       */
/* ------------------------------------------------------------------------- */

function FilterSearchField({
  value,
  onChange,
  compact,
}: {
  value: string;
  onChange: (next: string) => void;
  compact: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5",
        compact ? "min-h-tap" : "min-h-9",
      )}
    >
      <Search aria-hidden className="size-icon-sm shrink-0 text-[color:var(--text-soft)]" />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Find a filter…"
        aria-label="Find a filter"
        className="min-w-0 flex-1 bg-transparent text-2xs font-semibold text-[color:var(--text)] outline-none placeholder:font-medium placeholder:text-[color:var(--text-soft)]"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear filter search"
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-full hover:bg-[color:var(--surface-subtle)]",
            focusRing,
          )}
        >
          <X aria-hidden className="h-3 w-3 text-[color:var(--text-muted)]" />
        </button>
      ) : null}
    </div>
  );
}

function DirectionC({
  compact,
  selected,
  counts,
  onToggle,
  onClear,
  needle,
  onNeedle,
  collapsedGroups,
  onToggleGroup,
}: {
  compact: boolean;
  selected: ReadonlySet<string>;
  counts: FacetCounts;
  onToggle: (facetId: string) => void;
  onClear: () => void;
  needle: string;
  onNeedle: (next: string) => void;
  collapsedGroups: ReadonlySet<FacetGroupId>;
  onToggleGroup: (groupId: FacetGroupId) => void;
}) {
  const facetBody = (
    <FacetGroupsBody
      selected={selected}
      counts={counts}
      onToggle={onToggle}
      compact={compact}
      needle={needle}
      collapsible
      collapsedGroups={collapsedGroups}
      onToggleGroup={onToggleGroup}
    />
  );

  if (compact) {
    return (
      <div className="relative h-[34rem] overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2.5">
        <ResultsBand
          compact
          count={counts.total}
          query="all services"
          activeCount={selected.size}
          onOpen={() => {}}
          variant="trigger"
        />
        <ResultsPreview compact count={counts.total} />
        <PhoneSheetShell
          fullHeight
          title="Refine services"
          onClear={selected.size > 0 ? onClear : undefined}
          footer={
            <div className="grid gap-2">
              <div className="flex items-center gap-1.5 text-3xs font-semibold text-[color:var(--text-soft)]">
                <span className="nums font-black tabular-nums text-[color:var(--clinical-accent)]">{counts.total}</span>
                match ·
                <span className="nums tabular-nums">
                  {popcount(and(maskForSelection(selected), DECODED["confidence:High"]))}
                </span>{" "}
                high confidence ·
                <span className="nums tabular-nums">
                  {popcount(and(maskForSelection(selected), DECODED["setting:digital_phone"]))}
                </span>{" "}
                digital &amp; phone
              </div>
              <CommitButton count={counts.total} compact disabled={counts.total === 0} />
            </div>
          }
        >
          <div className="sticky top-0 z-10 -mx-3.5 -mt-2.5 bg-[color:var(--surface-raised)] px-3.5 pb-2 pt-2.5">
            <FilterSearchField value={needle} onChange={onNeedle} compact />
            {selected.size > 0 ? (
              <div className="polished-scroll mt-2 flex gap-1.5 overflow-x-auto">
                {FACET_GROUPS.flatMap((group) => group.facets.filter((facet) => selected.has(facet.id))).map(
                  (facet) => (
                    <ActiveFilterPill key={facet.id} facetId={facet.id} compact onRemove={() => onToggle(facet.id)} />
                  ),
                )}
              </div>
            ) : null}
          </div>
          {facetBody}
        </PhoneSheetShell>
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[17rem_minmax(0,1fr)]">
      {/* A persistent rail, not a popover: for a 219-item directory the facets are
          the primary navigation, and hiding them behind a button costs a click on
          every refinement. */}
      <aside className="overflow-hidden rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)]">
        <div className="flex items-center gap-1.5 border-b border-[color:var(--border)] px-3 py-2.5">
          <SlidersHorizontal aria-hidden className="size-icon-sm shrink-0 text-[color:var(--decoration-soft)]" />
          <h4 className="flex-1 text-2xs font-extrabold text-[color:var(--text-heading)]">Refine</h4>
          {selected.size > 0 ? (
            <button
              type="button"
              onClick={onClear}
              className={cn(
                "inline-flex min-h-7 items-center rounded-lg px-2 text-3xs font-bold text-[color:var(--clinical-accent)] hover:bg-[color:var(--clinical-accent-soft)]",
                focusRing,
              )}
            >
              Reset
            </button>
          ) : null}
        </div>
        <div className="border-b border-[color:var(--border)] px-3 py-2.5">
          <FilterSearchField value={needle} onChange={onNeedle} compact={false} />
        </div>
        <div className="max-h-[30rem] overflow-y-auto px-3 py-2">{facetBody}</div>
      </aside>
      <div className="min-w-0">
        <ResultsBand
          compact={false}
          count={counts.total}
          query="all services"
          activeCount={selected.size}
          onOpen={() => {}}
          variant="trigger"
        >
          <ActiveFilterBar compact={false} selected={selected} onRemove={onToggle} onClear={onClear} />
        </ResultsBand>
        <ResultsPreview compact={false} count={counts.total} />
        <div className="mt-2 grid">
          <PresetBlock compact={false} onRun={onClear} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Study frame                                                                */
/* ------------------------------------------------------------------------- */

function PreviewFrame({
  label,
  phone = false,
  children,
}: {
  label: string;
  phone?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0", phone && "mx-auto w-full max-w-[24.375rem]")}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-3xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
          {label}
        </span>
        <span className="text-3xs font-bold text-[color:var(--text-soft)]">{phone ? "390 px" : "1440 px"}</span>
      </div>
      <div
        className={cn(
          "overflow-x-auto rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-inset)]",
          phone ? "p-2.5" : "p-4",
        )}
      >
        <div className={cn(!phone && "min-w-[46rem]")}>{children}</div>
      </div>
    </div>
  );
}

function DirectionSection({
  id,
  eyebrow,
  title,
  lede,
  strengths,
  cost,
  desktop,
  phone,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lede: string;
  strengths: ReadonlyArray<string>;
  cost: string;
  desktop: React.ReactNode;
  phone: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
    >
      <div className="grid gap-4 border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <span className="text-3xs font-black uppercase tracking-eyebrow text-[color:var(--clinical-accent)]">
            {eyebrow}
          </span>
          <h2 id={id} className="mt-1 text-lg font-extrabold text-[color:var(--text-heading)]">
            {title}
          </h2>
          <p className="mt-1 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">{lede}</p>
          <p className="mt-2 max-w-3xl text-xs font-semibold text-[color:var(--text-soft)]">
            <span className="font-black uppercase tracking-eyebrow">Blast radius · </span>
            {cost}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 lg:justify-end">
          {strengths.map((strength) => (
            <span
              key={strength}
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-1 text-3xs font-bold text-[color:var(--text-muted)]"
            >
              {strength}
            </span>
          ))}
        </div>
      </div>
      <div className="grid gap-6 p-4 sm:p-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(21rem,0.7fr)]">
        <PreviewFrame label="Desktop">{desktop}</PreviewFrame>
        <PreviewFrame label="Phone" phone>
          {phone}
        </PreviewFrame>
      </div>
    </section>
  );
}

const anatomy: ReadonlyArray<{ term: string; detail: string }> = [
  {
    term: "Filters narrow, presets navigate",
    detail:
      "The single change everything else follows from. A filter keeps your query and subtracts from the result set; a preset throws the query away and starts again. The shipped sheet offers only the second while promising the first.",
  },
  {
    term: "Every facet carries its own count",
    detail:
      "Counts are OR-within-group and AND-across-groups, computed against the other groups' selections — so a number answers “what would I get if I added this?” rather than collapsing to zero when a sibling is chosen.",
  },
  {
    term: "Zero-yield facets stay reachable",
    detail:
      "A facet at 0 is dashed and muted rather than removed or opacity-faded. It keeps its tab stop, survives forced-colors (where border-style is preserved and opacity is not), and tells the reader the combination is empty before they commit.",
  },
  {
    term: "The footer states its outcome",
    detail:
      "“Show 41 services” replaces the passive “16 showing” plus a generic “Done”. At zero matches it becomes an explained dead end — aria-disabled with a reason, never a native disabled that drops the tab stop.",
  },
  {
    term: "Active filters survive dismissal",
    detail:
      "A pill row under the band means the current refinement is legible without reopening the sheet, and each pill removes exactly one facet. Ordered by the group ladder, not click order, so the row does not reshuffle under a thumb.",
  },
  {
    term: "One contract at both widths",
    detail:
      "Multi-select checkboxes everywhere, retiring the phone radiogroup / desktop aria-pressed split. Whatever ships must pick one — the current disagreement is a bug in the accessible name, not a styling choice.",
  },
];

export function ServicesFilterRefinedMockupsPage() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [segment, setSegment] = useState<SegmentValue>("narrow");
  const [needle, setNeedle] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<FacetGroupId>>(
    () => new Set<FacetGroupId>(["age", "confidence"]),
  );
  const counts = useFacetCounts(selected);

  const toggleFacet = useCallback((facetId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(facetId)) next.delete(facetId);
      else next.add(facetId);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setSelected(new Set<string>()), []);

  const toggleGroup = useCallback((groupId: FacetGroupId) => {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const activeSummary =
    selected.size === 0
      ? "No filters applied — all 219 catalogue services."
      : `${selected.size} ${selected.size === 1 ? "filter" : "filters"} applied across ${
          new Set(Array.from(selected, (facetId) => GROUP_OF_FACET.get(facetId))).size
        } ${new Set(Array.from(selected, (facetId) => GROUP_OF_FACET.get(facetId))).size === 1 ? "group" : "groups"} — ${counts.total} of ${SERVICE_TOTAL} match.`;

  return (
    <main className="min-h-dvh bg-[color:var(--surface-inset)] pb-16 text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto grid max-w-[92rem] gap-4 px-4 py-8 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <span className="text-3xs font-black uppercase tracking-eyebrow text-[color:var(--clinical-accent)]">
              Services · filter surface
            </span>
            <h1 className="mt-1.5 text-2xl font-black tracking-tight text-[color:var(--text-heading)]">
              Three directions for the services filter
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">
              The shipped sheet is titled “Filter services” and contains no filter. Every chip replaces the query and
              re-runs the search, so the control that promises to narrow your results is the one that discards them.
              These three directions separate the two verbs and differ in how far they take the second half.
            </p>
            <p className="mt-2 max-w-3xl text-xs font-semibold text-[color:var(--text-soft)]">
              All counts are real, computed live from the {SERVICE_TOTAL} services in{" "}
              <code className="font-mono text-3xs">data/services-snapshot.json</code>. Selections are shared across all
              three directions and both breakpoints, so a facet chosen on the phone updates every frame on the page.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2.5">
            <ListFilter aria-hidden className="size-icon-md shrink-0 text-[color:var(--clinical-accent)]" />
            <span className="min-w-0 flex-1 text-xs font-bold text-[color:var(--text)]">{activeSummary}</span>
            {selected.size > 0 ? (
              <button
                type="button"
                onClick={clearAll}
                className={cn(
                  "inline-flex min-h-tap shrink-0 items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-2xs font-bold text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)] sm:min-h-9",
                  focusRing,
                )}
              >
                <RotateCcw aria-hidden className="h-3 w-3" />
                Reset all frames
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[92rem] gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <section
          aria-labelledby="services-filter-today"
          className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
        >
          <div className="border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4 sm:px-5">
            <span className="text-3xs font-black uppercase tracking-eyebrow text-[color:var(--danger)]">Today</span>
            <h2 id="services-filter-today" className="mt-1 text-lg font-extrabold text-[color:var(--text-heading)]">
              What ships now, and what is wrong with it
            </h2>
            <p className="mt-1 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">
              Reproduced from <code className="font-mono text-xs">ResultFilterSheet</code> as rendered by the services
              page, so the comparison is against the real control rather than a memory of it.
            </p>
          </div>
          <div className="grid gap-6 p-4 sm:p-5 xl:grid-cols-[minmax(21rem,0.6fr)_minmax(0,1fr)]">
            <PreviewFrame label="Phone · today" phone>
              <TodaySheet />
            </PreviewFrame>
            <ul className="grid content-start gap-2">
              {TODAY_DEFECTS.map((defect) => (
                <li
                  key={defect.label}
                  className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2.5"
                >
                  <p className="text-2xs font-extrabold text-[color:var(--text-heading)]">{defect.label}</p>
                  <p className="mt-0.5 text-xs font-medium leading-5 text-[color:var(--text-muted)]">{defect.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <DirectionSection
          id="services-filter-direction-a"
          eyebrow="Direction A"
          title="Refine in place"
          lede="Keeps the shared sheet exactly as it is structurally — one panel, groups of chips, a footer — and fixes it from the inside. Facet groups with live counts sit above a visually separated “Start a new search” block whose rows carry an outbound arrow, so the two verbs stop competing. Desktop keeps the existing chip rail and gains a “More filters” popover holding the same body."
          cost="Expressible in the current ResultFilterSheet props — the unused ResultFilterOption.hint field already exists for counts. Multi-select is the one genuine addition. Upgrades all 7 modes at once; nothing forks."
          strengths={["Lowest risk", "Reuses the shared sheet", "Ships to 7 modes at once"]}
          desktop={
            <DirectionA compact={false} selected={selected} counts={counts} onToggle={toggleFacet} onClear={clearAll} />
          }
          phone={<DirectionA compact selected={selected} counts={counts} onToggle={toggleFacet} onClear={clearAll} />}
        />

        <DirectionSection
          id="services-filter-direction-b"
          eyebrow="Direction B"
          title="Presets and filters, split"
          lede="Makes the distinction a visible affordance instead of a spacing convention. Two tabs — “Narrow these N” and “Start a new search” — so the reader picks a verb before picking a value, and a mis-tap can no longer silently discard the query. An active-filter pill row under the band keeps the refinement legible after the sheet closes, at both widths."
          cost="Needs a tab contract inside the shared sheet plus a new persistent band row. The band row is the part other modes inherit whether or not they want it, so this one wants a per-mode opt-in."
          strengths={["Names the two verbs", "Filters visible when closed", "One contract both widths"]}
          desktop={
            <DirectionB
              compact={false}
              selected={selected}
              counts={counts}
              onToggle={toggleFacet}
              onClear={clearAll}
              segment={segment}
              onSegment={setSegment}
            />
          }
          phone={
            <DirectionB
              compact
              selected={selected}
              counts={counts}
              onToggle={toggleFacet}
              onClear={clearAll}
              segment={segment}
              onSegment={setSegment}
            />
          }
        />

        <DirectionSection
          id="services-filter-direction-c"
          eyebrow="Direction C"
          title="Directory-grade refine"
          lede="Treats services as what it is — a 219-record directory — rather than a search results page that happens to have filters. Desktop gets a persistent left rail instead of a popover, because in a directory the facets are the navigation and hiding them costs a click on every refinement. Phone gets a near-fullscreen sheet with find-a-filter, collapse-by-default groups and a live preview strip above the commit."
          cost="Largest change: a new desktop layout for the services route, plus a services facet index modelled on the documents one. Deliberately services-only — the other 6 modes have far smaller option sets and would not earn a rail."
          strengths={["Right shape for 219 records", "Find-a-filter", "Services-only, no shared risk"]}
          desktop={
            <DirectionC
              compact={false}
              selected={selected}
              counts={counts}
              onToggle={toggleFacet}
              onClear={clearAll}
              needle={needle}
              onNeedle={setNeedle}
              collapsedGroups={collapsedGroups}
              onToggleGroup={toggleGroup}
            />
          }
          phone={
            <DirectionC
              compact
              selected={selected}
              counts={counts}
              onToggle={toggleFacet}
              onClear={clearAll}
              needle={needle}
              onNeedle={setNeedle}
              collapsedGroups={collapsedGroups}
              onToggleGroup={toggleGroup}
            />
          }
        />

        <section
          aria-labelledby="services-filter-anatomy"
          className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
        >
          <div className="border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4 sm:px-5">
            <h2 id="services-filter-anatomy" className="text-lg font-extrabold text-[color:var(--text-heading)]">
              Anatomy
            </h2>
            <p className="mt-1 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">
              Decisions common to all three, so the reasoning survives into whichever direction is built.
            </p>
          </div>
          <dl className="grid gap-0 sm:grid-cols-2">
            {anatomy.map((entry, index) => (
              <div
                key={entry.term}
                className={cn(
                  "border-[color:var(--border)] px-4 py-3.5 sm:px-5",
                  index > 0 && "border-t",
                  index % 2 === 1 && "sm:border-l",
                  index === 1 && "sm:border-t-0",
                )}
              >
                <dt className="text-sm-minus font-bold text-[color:var(--text-heading)]">{entry.term}</dt>
                <dd className="mt-1 text-xs font-medium leading-5 text-[color:var(--text-muted)]">{entry.detail}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section
          aria-labelledby="services-filter-notes"
          className="rounded-2xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-4 py-4 sm:px-5"
        >
          <h2 id="services-filter-notes" className="text-lg font-extrabold text-[color:var(--text-heading)]">
            Before this becomes production
          </h2>
          <ol className="mt-2 grid list-decimal gap-1.5 pl-5 text-sm font-medium text-[color:var(--text-muted)]">
            <li>
              <strong className="font-bold text-[color:var(--text)]">Filtering is new behaviour, not styling.</strong>{" "}
              Services has no filter state today — the chip <em>is</em> the query. Any direction here needs real
              selection state, URL round-tripping, and a services facet index modelled on{" "}
              <code className="font-mono text-xs">buildSmartDocumentTagFacetIndex</code> in{" "}
              <code className="font-mono text-xs">src/lib/document-tags.ts</code>.
            </li>
            <li>
              <strong className="font-bold text-[color:var(--text)]">A “No cost” facet is not free.</strong>{" "}
              <code className="font-mono text-xs">cost_funding</code> is 87 distinct free-text values (“Public”, “Public
              service”, “Publicly funded”, “Free”, “Not publicly stated”…). Roughly 69 of 219 match a free-ish pattern,
              but that is a guess until the field is normalised. It is deliberately absent from these comps rather than
              faked.
            </li>
            <li>
              <strong className="font-bold text-[color:var(--text)]">Not every tag is a good facet.</strong>{" "}
              <code className="font-mono text-xs">age_groups: mixed</code> covers 202 of 219 and{" "}
              <code className="font-mono text-xs">setting_flags: public</code> covers 207 — both are omitted here
              because a facet that never excludes anything is a row of dead pixels.
            </li>
            <li>
              <strong className="font-bold text-[color:var(--text)]">
                The radiogroup / aria-pressed split must be resolved deliberately.
              </strong>{" "}
              These comps pick multi-select checkboxes at both widths. If single-select survives anywhere, the roving
              tabindex and arrow-key behaviour in <code className="font-mono text-xs">FilterRadioGroup</code> has to be
              preserved with it.
            </li>
            <li>
              <strong className="font-bold text-[color:var(--text)]">Direction B and C change the band.</strong> Adding
              a persistent row under the results band touches phone chrome reserve — read{" "}
              <code className="font-mono text-xs">docs/search-chrome-behaviour.md</code> and run{" "}
              <code className="font-mono text-xs">npm run verify:phone-chrome</code> before trusting either.
            </li>
            <li>
              <strong className="font-bold text-[color:var(--text)]">Mockups skip two gates, not all of them.</strong>{" "}
              Button-wiring and route-reachability are exempt here; tokens, type scale, tap targets and the bundle
              budget are not. Every control on this page is already at{" "}
              <code className="font-mono text-xs">min-h-tap</code> (48px) on phone — do not relax that to 44px to
              satisfy generic a11y guidance, which reintroduces a known{" "}
              <code className="font-mono text-xs">ui-smoke</code> flake.
            </li>
          </ol>
        </section>
      </div>
    </main>
  );
}
