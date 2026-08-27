"use client";

// Design-scratch: the Tools search RESULTS state (`/tools?q=…`), three directions.
//
// Grounds `docs/outstanding-issues.md` `#162`, which rates this page an urgent redesign and
// picked "Compact Results Instrument" from the static comps in
// `public/mockups/mode-page-redesign-2026-07/tools-search/`. Those comps were never built, so
// the pick had never been read against the real 13-record catalogue. These directions are
// fresh, informed by that study rather than tracing it.
//
// Every frame draws its own top bar, composer and results band, so
// `src/app/mockups/mockups-layout-client.tsx` suppresses the shared app chrome for this route
// (`chromeVisible={false}`) — otherwise the real header reads as a second, live header sitting
// over the study. Per `mockups/README.md`, shared chrome is inherited or suppressed, never
// forked into the page, which is why the in-frame band here is a deliberate replica and the
// real `SearchResultsHeaderBand` is not mounted: directions 01 and 03 exist to restructure
// that band, and it reads its count noun from the live mode registry.
//
// Results state only. The pre-query home state and the Tools launcher redesign are out of
// scope (`#162`'s own stop rule).

import {
  ArrowLeft,
  Brain,
  Calculator,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  FileText,
  Menu,
  Pill,
  Plus,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  TriangleAlert,
  Users,
  Waves,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/components/ui-primitives";
import { normalizeSearchText } from "@/lib/catalog-search";
import {
  rankToolRecords,
  toolCatalogRecordsForSession,
  toolSearchText,
  type ToolCatalogArea,
  type ToolCatalogRecord,
} from "@/lib/tools-catalog";

type DirectionId = "instrument" | "brief" | "deck";
type FrameQuery = "monitoring" | "compare";
type FrameDevice = "phone" | "desktop";

/* ------------------------------------------------------------------ *
 * Data — the real catalogue, not fixtures.
 * ------------------------------------------------------------------ */

const areaLabels: Record<ToolCatalogArea, string> = {
  assessment: "Assess",
  reference: "Evidence",
  care: "Treat",
  coordination: "Coordinate",
  saved: "Saved",
};

// Presentation-only mapping, mirroring `applications-launcher-page.tsx`: the shared catalogue
// is icon-free so server code (universal search) can import it.
const iconById: Record<string, LucideIcon> = {
  "clinical-kb-search": Search,
  differentials: Brain,
  documents: FileText,
  guidelines: ShieldCheck,
  "risk-safety": ShieldCheck,
  "medication-prescribing": Pill,
  services: Users,
  forms: FileCheck2,
  "care-plans": ClipboardCheck,
  "safety-plan": ClipboardList,
  calculators: Calculator,
  monitoring: Waves,
  favourites: Star,
};

/** Catalogue record with its icon already attached, so no component is resolved during render. */
type MockupTool = ToolCatalogRecord & { icon: LucideIcon };

const withIcon = (record: ToolCatalogRecord): MockupTool => ({
  ...record,
  icon: iconById[record.id] ?? Sparkles,
});

const session = { authenticated: true, demoMode: false } as const;
const catalogue: MockupTool[] = toolCatalogRecordsForSession(session).map(withIcon);

/**
 * The matcher used by the submitted /tools results route. Reuse its normalizer and shared
 * catalogue search text so the study cannot drift back to the retired launcher matcher.
 */
function submittedMatches(query: string): MockupTool[] {
  const normalized = normalizeSearchText(query);
  return catalogue.filter(
    (tool) => (!normalized || toolSearchText(tool).includes(normalized)) && tool.id !== "favourites",
  );
}

/** Focused contract surface: demo-query IDs must stay aligned with the production results route. */
export function submittedToolIdsForMockup(query: string): string[] {
  return submittedMatches(query).map((tool) => tool.id);
}

/** Reason labels as `rankToolRecords` emits them, mapped to reader-facing copy. */
const reasonLabels: Record<string, string> = {
  title: "Name",
  keywords: "Keywords",
  description: "Description",
  content: "Detail",
  phrase: "Exact phrase",
};

const rankedMatches = (query: string) =>
  rankToolRecords(query, 8, [], session).map((match) => ({ ...match, tool: withIcon(match.tool) }));

const queryCopy: Record<FrameQuery, { label: string; note: string }> = {
  monitoring: {
    label: "monitoring",
    note: "Submitted search finds 4 and puts the exactly-named tool last. Ranked keeps 4, Monitoring first.",
  },
  compare: {
    label: "compare",
    note: "One match — the state in the reported screenshot, where the only result fell below the fold.",
  },
};

/* ------------------------------------------------------------------ *
 * Direction annotations
 * ------------------------------------------------------------------ */

const directions: Array<{
  id: DirectionId;
  title: string;
  verdict: string;
  description: string;
  changes: string[];
}> = [
  {
    id: "instrument",
    title: "Compact Results Instrument",
    verdict: "Smallest change that fixes it",
    description:
      "The results state stops pretending to be the home page. The mode hero drops on submit, the band becomes the page title with the query as the only h1, and the filter row collapses onto that same line so one control no longer occupies a whole shelf. Results become dense rows whose primary button launches the tool.",
    changes: [
      "Mode hero and the 7-chip quick-action grid are gone once a query exists — one h1, and it is the query.",
      "Count, mode and area filters share the title row; the second band shelf disappears. Phone lists only the areas the result set contains, so the row stays one line.",
      "Each row's primary button is the tool's own actionLabel (Ask / Compare / Prescribe / Open); Details demotes to a desktop-only secondary, and the row itself opens detail on phone.",
      "A filter is only drawn when there is something to filter — at one match the row disappears entirely rather than offering All 1.",
      "Cross-mode escape added as a collapsed disclosure at the foot, so a miss is recoverable without retyping.",
      "The colour-coding reference link leaves the results flow — it is settings, not a result.",
    ],
  },
  {
    id: "brief",
    title: "Ranked Clinical Brief",
    verdict: "Best decision support",
    description:
      "Everything in 01, plus the page finally calls rankToolRecords — which the catalogue already exports and this page has never used. The top match is promoted into an inline brief built from the four catalogue fields the results state currently hides, so the likely answer needs no dialog at all.",
    changes: [
      "rankToolRecords replaces submitted-order ranking: `monitoring` keeps all four matches and moves Monitoring from last to first.",
      "Rows carry why they matched, from the ranker's own reasons array, as neutral metadata chips.",
      "The top match expands inline into Best for / Check first / You'll need / Output — real per-tool catalogue fields, authored for all 13 tools and currently invisible.",
      "Match-reason chips deliberately use categorical --type-* tones, never the semantic source-backed treatment: a keyword hit must not be able to read as a grounding claim.",
      "Remaining matches stay as 01's dense rows, so density is only spent where it buys a decision.",
    ],
  },
  {
    id: "deck",
    title: "Launch-First Triage Deck",
    verdict: "Fewest taps to the tool",
    description:
      "An interaction-model change: no dialog anywhere. Every match is a disclosure that opens its detail inline, so nothing is hidden behind a modal, and the area filter folds into the band as a segmented control that doubles as the count. Safety-first tools are marked permanently rather than one tap deep.",
    changes: [
      "The detail dialog is removed. Rows are native <details>, so detail costs no modal and no JavaScript.",
      "Filter and count become one segmented control; the phone filter sheet and its trigger both disappear.",
      "Areas with no matches are present but inert, so the filter still reports the shape of the catalogue.",
      "safetyFirst tools (Risk & Safety, Medication Prescribing, Safety plan) carry a persistent warning edge and chip.",
      "Trade-off to judge: at desktop width the inline detail makes rows tall, and no modal means no room for anything longer.",
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Shared in-frame chrome (replicas — see the header note)
 * ------------------------------------------------------------------ */

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const iconTone: Record<ToolCatalogArea | "safety" | "medication" | "differentials", string> = {
  assessment:
    "border-[color:var(--type-service-border)] bg-[color:var(--type-service-soft)] text-[color:var(--type-service)]",
  reference: "border-[color:var(--type-table-border)] bg-[color:var(--type-table-soft)] text-[color:var(--type-table)]",
  care: "border-[color:var(--type-document-border)] bg-[color:var(--type-document-soft)] text-[color:var(--type-document)]",
  coordination:
    "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
  saved: "border-[color:var(--type-search-border)] bg-[color:var(--type-search-soft)] text-[color:var(--type-search)]",
  safety: "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
  medication: "border-[color:var(--type-form-border)] bg-[color:var(--type-form-soft)] text-[color:var(--type-form)]",
  differentials:
    "border-[color:var(--type-source-border)] bg-[color:var(--type-source-soft)] text-[color:var(--type-source)]",
};

function toneFor(tool: MockupTool) {
  if (tool.safetyFirst && tool.id !== "medication-prescribing") return iconTone.safety;
  if (tool.id === "medication-prescribing") return iconTone.medication;
  if (tool.id === "differentials") return iconTone.differentials;
  return iconTone[tool.area];
}

function ToolGlyph({ tool, size = "md" }: { tool: MockupTool; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-[0.6rem] border",
        size === "sm" && "size-8",
        size === "md" && "size-9",
        size === "lg" && "size-11",
        toneFor(tool),
      )}
    >
      <tool.icon aria-hidden="true" className={size === "lg" ? "size-icon-lg" : "size-icon-md"} strokeWidth={1.75} />
    </span>
  );
}

function FrameTopBar({ device }: { device: FrameDevice }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3",
        device === "phone" ? "h-11" : "h-12 px-4",
      )}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-[0.6rem] bg-[color:var(--text-heading)] text-3xs font-black tracking-[-0.04em] text-[color:var(--surface)]">
        KB
      </span>
      <span className="mx-auto inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text)]">
        <span className="grid size-5 place-items-center rounded-full bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
          <Wrench aria-hidden="true" className="size-icon-xs" strokeWidth={2} />
        </span>
        Tools
        <ChevronDown aria-hidden="true" className="size-icon-sm text-[color:var(--text-soft)]" />
      </span>
      <span className="grid size-8 shrink-0 place-items-center rounded-[0.6rem] border border-[color:var(--border)] text-[color:var(--text-muted)]">
        <Menu aria-hidden="true" className="size-icon-md" />
      </span>
    </div>
  );
}

/** Back affordance to the Tools home — every direction keeps a single return path. */
function BackRow({ label = "Tools" }: { label?: string }) {
  return (
    <p className="flex items-center gap-1.5 text-xs font-semibold text-[color:var(--text-muted)]">
      <ArrowLeft aria-hidden="true" className="size-icon-sm" />
      {label}
    </p>
  );
}

function FrameComposer({ query, device }: { query: FrameQuery; device: FrameDevice }) {
  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--e2)]",
          device === "phone" ? "px-2 py-1.5" : "px-2.5 py-2",
        )}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)]">
          <Plus aria-hidden="true" className="size-icon-lg" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-[color:var(--text)]">
          {queryCopy[query].label}
        </span>
        <span className="grid size-7 shrink-0 place-items-center rounded-full text-[color:var(--text-soft)]">
          <X aria-hidden="true" className="size-icon-md" />
        </span>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]">
          <Send aria-hidden="true" className="size-icon-md" />
        </span>
      </div>
      {/* Governance copy (APP-5 / PIA-5) — reproduced verbatim, never reworded. */}
      <p className="mt-2 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center text-2xs leading-4 text-[color:var(--text-muted)]">
        <ShieldAlert aria-hidden="true" className="size-icon-sm text-[color:var(--warning)]" />
        Do not enter patient-identifiable information.
        <span className="underline decoration-dotted">Privacy and data processing</span>
      </p>
    </div>
  );
}

/** The query as the page's only heading — the change every direction shares. */
function QueryTitle({
  query,
  countLabel,
  device,
  trailing,
}: {
  query: FrameQuery;
  countLabel: string;
  device: FrameDevice;
  trailing?: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-3 gap-y-1", device === "desktop" && "justify-between")}>
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h3
          className={cn(
            "font-semibold tracking-[-0.03em] text-[color:var(--text-heading)]",
            device === "phone" ? "text-2xl" : "text-3xl",
          )}
        >
          {queryCopy[query].label}
        </h3>
        <p className="text-xs font-semibold text-[color:var(--text-muted)]">{countLabel}</p>
      </div>
      {trailing}
    </div>
  );
}

/**
 * Phone shows only the areas the result set actually contains, so the row stays one line at
 * 390 px; desktop has room to show every area with its count, empty ones included.
 */
function AreaFilterRow({ tools, device }: { tools: MockupTool[]; device: FrameDevice }) {
  const present = new Set(tools.map((tool) => tool.area));
  const allAreas: ToolCatalogArea[] = ["assessment", "reference", "care", "coordination"];
  const areas = device === "phone" ? allAreas.filter((area) => present.has(area)) : allAreas;
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by tool category">
      <span className="rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2.5 py-1 text-2xs font-bold text-[color:var(--clinical-accent)]">
        All {tools.length}
      </span>
      {areas.map((area) => (
        <span
          key={area}
          className={cn(
            "rounded-full border px-2.5 py-1 text-2xs font-semibold",
            present.has(area)
              ? "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]"
              : "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-soft)]",
          )}
        >
          {areaLabels[area]}
          {device === "desktop" ? ` ${tools.filter((tool) => tool.area === area).length}` : null}
        </span>
      ))}
    </div>
  );
}

function SourceChip({ tool }: { tool: MockupTool }) {
  return tool.sourceBacked ? (
    <span className="inline-flex items-center gap-1 rounded-md border border-[color:var(--success-border)] bg-[color:var(--success-soft)] px-1.5 py-0.5 text-3xs font-bold text-[color:var(--success-text)]">
      <ShieldCheck aria-hidden="true" className="size-icon-xs" />
      Source-backed
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-1.5 py-0.5 text-3xs font-bold text-[color:var(--text-muted)]">
      Private
    </span>
  );
}

function SafetyChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] px-1.5 py-0.5 text-3xs font-bold text-[color:var(--warning-text)]">
      <TriangleAlert aria-hidden="true" className="size-icon-xs" />
      Safety-first
    </span>
  );
}

function PrimaryAction({ label, device }: { label: string; device: FrameDevice }) {
  return (
    <button
      type="button"
      className={cn(
        "shrink-0 rounded-lg bg-[color:var(--clinical-accent)] px-3 text-xs font-bold text-[color:var(--clinical-accent-contrast)]",
        device === "phone" ? "min-h-11" : "min-h-11 px-4 text-sm",
        focusRing,
      )}
    >
      {label}
    </button>
  );
}

/** Collapsed cross-mode escape. Modes are named rather than counted — nothing here is live. */
function CrossModeFoot() {
  return (
    <p className="flex items-center gap-1.5 border-t border-[color:var(--border)] pt-3 text-xs font-semibold text-[color:var(--clinical-accent)]">
      Also in Documents · Medications · Services
      <ChevronDown aria-hidden="true" className="size-icon-sm" />
    </p>
  );
}

/* ------------------------------------------------------------------ *
 * 01 — Compact Results Instrument
 * ------------------------------------------------------------------ */

function InstrumentRow({ tool, device }: { tool: MockupTool; device: FrameDevice }) {
  return (
    <li className="flex items-center gap-3 border-b border-[color:var(--border)] px-3 py-2.5 last:border-b-0">
      <ToolGlyph tool={tool} size={device === "phone" ? "sm" : "md"} />
      <span className="min-w-0 flex-1">
        {/* The tool name wraps rather than truncating — a half-read tool name is not a result. */}
        <span className="block text-sm font-semibold leading-5 text-[color:var(--text-heading)]">{tool.title}</span>
        <span className="mt-0.5 block text-xs leading-4 text-[color:var(--text-muted)]">{tool.bestFor}</span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          {tool.safetyFirst ? <SafetyChip /> : null}
          {device === "desktop" ? <SourceChip tool={tool} /> : null}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <PrimaryAction label={tool.actionLabel} device={device} />
        {/* Details is a desktop-only secondary; on phone the row itself opens the detail. */}
        {device === "desktop" ? (
          <button
            type="button"
            className={cn(
              "min-h-11 shrink-0 rounded-lg px-2 text-xs font-semibold text-[color:var(--text-muted)]",
              focusRing,
            )}
          >
            Details
          </button>
        ) : null}
      </span>
    </li>
  );
}

function InstrumentDirection({ query, device }: { query: FrameQuery; device: FrameDevice }) {
  const tools = submittedMatches(queryCopy[query].label);
  return (
    <div className="flex flex-col gap-3.5 px-3 py-3.5">
      <BackRow />
      <QueryTitle
        query={query}
        countLabel={`${tools.length} ${tools.length === 1 ? "tool" : "tools"} · Tools`}
        device={device}
        trailing={
          device === "desktop" && tools.length > 1 ? <AreaFilterRow tools={tools} device={device} /> : undefined
        }
      />
      <FrameComposer query={query} device={device} />
      {device === "phone" && tools.length > 1 ? <AreaFilterRow tools={tools} device={device} /> : null}
      <ul className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]">
        {tools.map((tool) => (
          <InstrumentRow key={tool.id} tool={tool} device={device} />
        ))}
      </ul>
      <CrossModeFoot />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 02 — Ranked Clinical Brief
 * ------------------------------------------------------------------ */

function ReasonChips({ reasons }: { reasons: string[] }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {reasons.map((reason) => (
        <span
          key={reason}
          // Categorical --type-* tone on purpose: this is a text-match signal, and it must not
          // be mistakable for the semantic source-backed badge one line away.
          className="rounded border border-[color:var(--type-search-border)] bg-[color:var(--type-search-soft)] px-1.5 py-0.5 text-3xs font-bold text-[color:var(--type-search)]"
        >
          {reasonLabels[reason] ?? reason}
        </span>
      ))}
    </span>
  );
}

function BriefField({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2.5 py-2">
      <dt className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">{term}</dt>
      <dd className="mt-1 text-2xs leading-4 text-[color:var(--text-muted)]">{children}</dd>
    </div>
  );
}

function BriefDirection({ query, device }: { query: FrameQuery; device: FrameDevice }) {
  const matches = rankedMatches(queryCopy[query].label);
  const [top, ...rest] = matches;
  if (!top) return null;
  return (
    <div className="flex flex-col gap-3.5 px-3 py-3.5">
      <BackRow />
      <QueryTitle
        query={query}
        countLabel={`${matches.length} ${matches.length === 1 ? "tool" : "tools"} · ranked`}
        device={device}
        trailing={
          device === "desktop" && matches.length > 1 ? (
            <AreaFilterRow tools={matches.map((match) => match.tool)} device={device} />
          ) : undefined
        }
      />
      <FrameComposer query={query} device={device} />
      {device === "phone" && matches.length > 1 ? (
        <AreaFilterRow tools={matches.map((match) => match.tool)} device={device} />
      ) : null}

      {/* Promoted top match — the inline brief that removes the dialog for the likely answer. */}
      <section className="rounded-xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]/40 p-3">
        <p className="text-3xs font-black uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
          Best match
        </p>
        <div className="mt-2 flex items-start gap-3">
          <ToolGlyph tool={top.tool} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold tracking-[-0.02em] text-[color:var(--text-heading)]">
              {top.tool.title}
            </p>
            <p className="mt-0.5 text-xs leading-5 text-[color:var(--text-muted)]">{top.tool.description}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <SourceChip tool={top.tool} />
              {top.tool.safetyFirst ? <SafetyChip /> : null}
              <ReasonChips reasons={top.reasons} />
            </div>
          </div>
        </div>
        <dl className={cn("mt-3 grid gap-2", device === "phone" ? "grid-cols-2" : "grid-cols-4")}>
          <BriefField term="Best for">{top.tool.bestFor}</BriefField>
          <BriefField term="Check first">{top.tool.checkFirst.slice(0, 2).join(" · ")}</BriefField>
          <BriefField term="You'll need">{top.tool.neededInput.slice(0, 2).join(" · ")}</BriefField>
          <BriefField term="Output">{top.tool.output}</BriefField>
        </dl>
        <div className="mt-3">
          <PrimaryAction label={`${top.tool.actionLabel} — ${top.tool.title}`} device={device} />
        </div>
      </section>

      {rest.length > 0 ? (
        <div>
          <p className="mb-1.5 text-3xs font-black uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
            {rest.length} more {rest.length === 1 ? "match" : "matches"}
          </p>
          <ul className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]">
            {rest.map((match) => (
              <li
                key={match.tool.id}
                className="flex items-center gap-3 border-b border-[color:var(--border)] px-3 py-2.5 last:border-b-0"
              >
                <ToolGlyph tool={match.tool} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-5 text-[color:var(--text-heading)]">
                    {match.tool.title}
                  </span>
                  <span className="mt-0.5 block text-xs leading-4 text-[color:var(--text-muted)]">
                    {match.tool.bestFor}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    {match.tool.safetyFirst ? <SafetyChip /> : null}
                    <ReasonChips reasons={match.reasons} />
                  </span>
                </span>
                <PrimaryAction label={match.tool.actionLabel} device={device} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <CrossModeFoot />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 03 — Launch-First Triage Deck
 * ------------------------------------------------------------------ */

function SegmentedCountBand({ tools }: { tools: MockupTool[] }) {
  const areas: ToolCatalogArea[] = ["assessment", "reference", "care", "coordination"];
  return (
    <div
      className="flex items-stretch overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-center"
      role="group"
      aria-label="Filter by tool category"
    >
      <span className="flex-1 border-r border-[color:var(--border)] bg-[color:var(--clinical-accent-soft)] px-1.5 py-1.5">
        <span className="block text-sm font-black leading-4 text-[color:var(--clinical-accent)]">{tools.length}</span>
        <span className="block text-3xs font-bold uppercase tracking-[0.1em] text-[color:var(--clinical-accent)]">
          All
        </span>
      </span>
      {areas.map((area) => {
        const count = tools.filter((tool) => tool.area === area).length;
        return (
          <span
            key={area}
            aria-disabled={count === 0 ? "true" : undefined}
            className={cn(
              "flex-1 border-r border-[color:var(--border)] px-1.5 py-1.5 last:border-r-0",
              count === 0 && "opacity-55",
            )}
          >
            <span className="block text-sm font-black leading-4 text-[color:var(--text-heading)]">
              {count === 0 ? "—" : count}
            </span>
            <span className="block text-3xs font-bold uppercase tracking-[0.1em] text-[color:var(--text-soft)]">
              {areaLabels[area]}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function DeckRow({ tool, device, open }: { tool: MockupTool; device: FrameDevice; open: boolean }) {
  return (
    <li
      className={cn(
        "border-b border-[color:var(--border)] last:border-b-0",
        tool.safetyFirst && "border-l-2 border-l-[color:var(--warning)] bg-[color:var(--warning-soft)]/25",
      )}
    >
      <div className="flex items-start gap-2 px-3 py-2.5">
        <details open={open} className="group min-w-0 flex-1">
          <summary
            className={cn(
              "flex cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden",
              focusRing,
            )}
          >
            <ToolGlyph tool={tool} size={device === "phone" ? "sm" : "md"} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold leading-5 text-[color:var(--text-heading)]">
                {tool.title}
              </span>
              <span className="mt-0.5 block text-xs leading-4 text-[color:var(--text-muted)]">{tool.bestFor}</span>
              {tool.safetyFirst ? (
                <span className="mt-1 flex">
                  <SafetyChip />
                </span>
              ) : null}
            </span>
            <ChevronDown
              aria-hidden="true"
              className="size-icon-md mt-0.5 shrink-0 self-start text-[color:var(--text-soft)] transition-transform group-open:rotate-180"
            />
          </summary>
          <dl className={cn("mt-2.5 grid gap-2", device === "phone" ? "grid-cols-1" : "grid-cols-3")}>
            <BriefField term="Check first">{tool.checkFirst.join(" · ")}</BriefField>
            <BriefField term="You'll need">{tool.neededInput.join(" · ")}</BriefField>
            <BriefField term="Output">{tool.output}</BriefField>
          </dl>
          <p className="mt-2 flex flex-wrap items-center gap-1.5">
            <SourceChip tool={tool} />
          </p>
        </details>
        <PrimaryAction label={tool.actionLabel} device={device} />
      </div>
    </li>
  );
}

function DeckDirection({ query, device }: { query: FrameQuery; device: FrameDevice }) {
  const tools = submittedMatches(queryCopy[query].label);
  return (
    <div className="flex flex-col gap-3.5 px-3 py-3.5">
      <BackRow />
      <QueryTitle query={query} countLabel={tools.length === 1 ? "1 tool" : `${tools.length} tools`} device={device} />
      <FrameComposer query={query} device={device} />
      <SegmentedCountBand tools={tools} />
      <ul className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]">
        {tools.map((tool, index) => (
          <DeckRow key={tool.id} tool={tool} device={device} open={index === 0} />
        ))}
      </ul>
      <CrossModeFoot />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Frames and showcase
 * ------------------------------------------------------------------ */

const directionRenderers: Record<DirectionId, (props: { query: FrameQuery; device: FrameDevice }) => React.ReactNode> =
  {
    instrument: InstrumentDirection,
    brief: BriefDirection,
    deck: DeckDirection,
  };

function DeviceFrame({ direction, query, device }: { direction: DirectionId; query: FrameQuery; device: FrameDevice }) {
  const Render = directionRenderers[direction];
  return (
    <figure
      data-direction={direction}
      data-query={query}
      data-device={device}
      className={cn("m-0 shrink-0", device === "phone" ? "w-[390px]" : "w-[1280px]")}
    >
      <div className="overflow-hidden rounded-[1rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--e2)]">
        <FrameTopBar device={device} />
        <Render query={query} device={device} />
      </div>
      <figcaption className="mt-2 text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
        {device === "phone" ? "Phone 390" : "Desktop 1280"} · “{queryCopy[query].label}”
        <span className="mt-1 block font-medium normal-case tracking-normal text-[color:var(--text-muted)]">
          {queryCopy[query].note}
        </span>
      </figcaption>
    </figure>
  );
}

function DirectionShowcase({ direction, number }: { direction: (typeof directions)[number]; number: number }) {
  return (
    <section className="border-t border-[color:var(--border)] pt-8" aria-labelledby={`${direction.id}-title`}>
      <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,32rem)] lg:items-end">
        <div>
          <p className="text-3xs font-black uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
            Direction {String(number).padStart(2, "0")} · {direction.verdict}
          </p>
          <h2
            id={`${direction.id}-title`}
            className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[color:var(--text-heading)]"
          >
            {direction.title}
          </h2>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-[color:var(--text-muted)] lg:justify-self-end lg:text-right">
          {direction.description}
        </p>
      </div>

      <ul className="mb-5 grid gap-2 sm:grid-cols-2">
        {direction.changes.map((change) => (
          <li
            key={change}
            className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 text-xs leading-5 text-[color:var(--text-muted)]"
          >
            {change}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-start gap-5">
        <DeviceFrame direction={direction.id} query="monitoring" device="phone" />
        <DeviceFrame direction={direction.id} query="compare" device="phone" />
        <DeviceFrame direction={direction.id} query="monitoring" device="desktop" />
        <DeviceFrame direction={direction.id} query="compare" device="desktop" />
      </div>
    </section>
  );
}

const currentDefects: string[] = [
  "Two competing page titles — the mode hero’s “Tools” h1 and the band’s query heading.",
  "The home hero and the 7-chip quick-action grid survive submission, pushing a single result below the phone fold.",
  "Those chips read as refinements beside results, but each one opens a detail dialog instead of re-searching.",
  "A two-row band shelf carrying one lone Filter control.",
  "Card-grid density for a 13-item catalogue where most queries return 1–4 matches.",
  "The primary affordance on a result is “Details” — a dialog — not launching the tool you searched for.",
  "A “Colour coding reference” link rendered inside the results flow as though it were a result.",
  "No cross-mode escape when the 13-tool catalogue misses the query.",
  "Relevance thrown away: a plain substring filter, while rankToolRecords already computes scores and match reasons.",
];

export function ToolsSearchDirectionsMockups() {
  return (
    <main className="min-h-dvh bg-[color:var(--background)] px-3 pb-16 pt-7 text-[color:var(--text)] sm:px-6 sm:pt-10 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <header className="max-w-3xl">
          <p className="text-3xs font-black uppercase tracking-[0.16em] text-[color:var(--clinical-accent)]">
            Tools · Search results state
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[color:var(--text-heading)] sm:text-4xl">
            Three directions for the Tools results page
          </h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)] sm:text-base sm:leading-7">
            All three fix the same nine defects in today’s <code>/tools?q=…</code>; they differ in how far they go.
            Every frame is built from the real 13-record catalogue in <code>src/lib/tools-catalog.ts</code>, so the
            match counts, orderings, badges and per-tool copy below are the genuine data — not fixtures. Design scratch:
            this route 404s in production and changes no production surface.
          </p>
          <dl className="mt-5 grid gap-2 sm:grid-cols-3">
            {[
              [
                "Shared by all three",
                "Query is the only h1; hero and quick-action grid drop on submit; launch beats dialog",
              ],
              [
                "Queries shown",
                "“monitoring” (multi-match, exposes the ranking defect) and “compare” (the reported screenshot)",
              ],
              ["Read in light theme", "Frames use role tokens, so set the app to Clinical White before judging"],
            ].map(([term, detail]) => (
              <div
                key={term}
                className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2"
              >
                <dt className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
                  {term}
                </dt>
                <dd className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{detail}</dd>
              </div>
            ))}
          </dl>
        </header>

        <section
          className="mt-8 rounded-xl border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)]/30 p-4"
          aria-labelledby="current-defects-title"
        >
          <h2
            id="current-defects-title"
            className="text-sm font-bold tracking-[-0.01em] text-[color:var(--text-heading)]"
          >
            What every direction is fixing
          </h2>
          <ol className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {currentDefects.map((defect, index) => (
              <li key={defect} className="flex gap-2 text-xs leading-5 text-[color:var(--text-muted)]">
                <span className="shrink-0 font-black text-[color:var(--warning-text)]">{index + 1}</span>
                {defect}
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-10 space-y-12">
          {directions.map((direction, index) => (
            <DirectionShowcase key={direction.id} direction={direction} number={index + 1} />
          ))}
        </div>
      </div>
    </main>
  );
}
