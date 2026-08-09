"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, FileText, GitCompareArrows, ShieldAlert } from "lucide-react";

import { appModeHomeHref } from "@/lib/app-modes";
import { normalizeSearchText } from "@/lib/catalog-search";
import { differentialRouteWithQuery, differentialSelectedCompareHref } from "@/lib/differentials-navigation";
import { differentialsMobileCompareAddonSlotId } from "@/lib/mode-home-composer";
import type {
  DifferentialStreamItem,
  DifferentialStreamModel,
  DifferentialStreamType,
} from "@/lib/differential-stream-model";
import type { DifferentialLikelihood } from "@/lib/differential-snapshot";

type BrowseGrouping = "urgency" | "presentation";

type DifferentialStreamWorkspaceProps = {
  model: DifferentialStreamModel;
  query: string;
  initialFocus?: string;
};

const streamCopy: Record<
  DifferentialStreamType,
  { heading: string; description: string; intro: string; entriesLabel: string }
> = {
  presentations: {
    heading: "Differentials: Presentations",
    description: "Search and refine by presenting pattern before locking differential pathways.",
    intro: "Use this stream for symptom-first intake, acute presentations, and rapid sorting.",
    entriesLabel: "Presentation-focused differential content",
  },
  diagnoses: {
    heading: "Differentials: Diagnoses",
    description: "Compare likely causes side-by-side and check exclusion clues.",
    intro: "Use this stream for differential ranking, safety ordering, and comparison notes.",
    entriesLabel: "Diagnosis-focused differential content",
  },
};

function statusLabel(status: DifferentialStreamItem["status"]) {
  if (status === "emergent") return "Emergent";
  if (status === "urgent") return "Urgent";
  return "Routine";
}

function statusTone(status: DifferentialStreamItem["status"]) {
  if (status === "emergent") {
    return "border-transparent bg-[color:var(--danger-solid)] text-[color:var(--danger-solid-contrast)]";
  }
  if (status === "urgent") {
    return "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]";
  }
  return "border-[color:var(--info-border)] bg-[color:var(--info-soft)] text-[color:var(--info)]";
}

function likelihoodTone(likelihood: DifferentialLikelihood) {
  if (likelihood === "must-not-miss") {
    return "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]";
  }
  if (likelihood === "most-likely") {
    return "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]";
  }
  if (likelihood === "possible") {
    return "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]";
  }
  return "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]";
}

function StreamMobileCompareBar({
  selectedCount,
  selectedIds,
  query,
}: {
  selectedCount: number;
  selectedIds: Set<string>;
  query: string;
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const phoneMediaQuery = window.matchMedia("(max-width: 1023px)");
    const sync = () => {
      setHost(phoneMediaQuery.matches ? document.getElementById(differentialsMobileCompareAddonSlotId) : null);
    };
    sync();
    phoneMediaQuery.addEventListener("change", sync);
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      phoneMediaQuery.removeEventListener("change", sync);
      observer.disconnect();
    };
  }, []);

  if (!host) return null;

  const canCompare = selectedCount >= 2;

  return createPortal(
    <div aria-live="polite" className="differentials-mobile-compare-fab">
      {canCompare ? (
        <Link
          href={differentialSelectedCompareHref(query, selectedIds)}
          data-testid="differentials-stream-compare-mobile"
          className="differentials-mobile-compare-fab__button"
        >
          <GitCompareArrows className="h-5 w-5 shrink-0" aria-hidden />
          <span className="truncate">Compare selected</span>
          <span className="nums grid h-7 min-w-7 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-accent-contrast)]/20 px-1.5 text-xs font-extrabold">
            {selectedCount}
          </span>
        </Link>
      ) : (
        <p
          data-testid="differentials-stream-compare-mobile"
          className="differentials-mobile-compare-fab__button differentials-mobile-compare-fab__button--empty"
          aria-disabled={selectedCount === 1 ? true : undefined}
        >
          <GitCompareArrows className="h-5 w-5 shrink-0 text-[color:var(--decoration-soft)]" aria-hidden />
          <span className="truncate">
            {selectedCount === 1 ? "Select one more to compare" : "Tick diagnoses to compare"}
          </span>
        </p>
      )}
    </div>,
    host,
  );
}

function MatchRail({
  matchItems,
  activeSlug,
  onJump,
}: {
  matchItems: DifferentialStreamItem[];
  activeSlug: string | null;
  onJump: (slug: string) => void;
}) {
  if (matchItems.length === 0) return null;
  return (
    <div
      data-testid="differentials-stream-match-rail"
      className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {matchItems.slice(0, 12).map((item) => {
        const active = item.slug === activeSlug;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onJump(item.slug)}
            className={[
              "inline-flex min-h-12 shrink-0 items-center rounded-lg border px-3 text-xs font-bold transition",
              active
                ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:border-[color:var(--clinical-accent-border)] hover:text-[color:var(--clinical-accent)]",
            ].join(" ")}
          >
            {item.title}
          </button>
        );
      })}
    </div>
  );
}

function StreamCard({
  item,
  highlight,
  selected,
  showSelect,
  familyMode,
  onFocus,
  onToggleSelect,
  onShowFamily,
}: {
  item: DifferentialStreamItem;
  highlight: "match" | "related" | "dim" | "neutral";
  selected: boolean;
  showSelect: boolean;
  familyMode: boolean;
  onFocus: () => void;
  onToggleSelect: () => void;
  onShowFamily: () => void;
}) {
  const cardTone =
    highlight === "match"
      ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] shadow-[var(--shadow-inset)]"
      : highlight === "related"
        ? "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] shadow-[var(--shadow-inset)]"
        : highlight === "dim"
          ? "border-[color:var(--border)] bg-[color:var(--surface)] opacity-45"
          : "border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]";

  return (
    <article
      id={`differential-stream-card-${item.slug}`}
      data-testid={`differential-stream-card-${item.slug}`}
      data-highlight={highlight}
      data-match={item.isMatch ? "true" : "false"}
      className={`rounded-lg border p-4 transition ${cardTone}`}
      onFocus={onFocus}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-[color:var(--text-heading)]">{item.title}</h3>
            <span
              className={`inline-flex rounded-md border px-2 py-0.5 text-3xs font-extrabold ${statusTone(item.status)}`}
            >
              {statusLabel(item.status)}
            </span>
          </div>
          <p className="text-sm text-[color:var(--text-muted)]">{item.description}</p>
        </div>
        {showSelect ? (
          <label className="inline-flex min-h-12 min-w-12 shrink-0 cursor-pointer items-center justify-center">
            <span className="sr-only">
              {selected ? `Remove ${item.title} from comparison` : `Add ${item.title} to comparison`}
            </span>
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelect}
              className="h-5 w-5 accent-[color:var(--clinical-accent)]"
            />
          </label>
        ) : null}
      </div>

      {item.matchReasons.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Match reasons">
          {item.matchReasons.map((reason) => (
            <li
              key={`${item.id}:${reason}`}
              className="rounded-md border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] px-2 py-0.5 text-3xs font-bold text-[color:var(--clinical-accent)]"
            >
              {reason}
            </li>
          ))}
        </ul>
      ) : null}

      {item.exclusionPreview ? (
        <p className="mt-2 text-xs leading-5 text-[color:var(--text-muted)]">
          <span className="font-bold text-[color:var(--warning)]">Exclusion / mimics: </span>
          {item.exclusionPreview}
        </p>
      ) : null}

      <ul className="mt-2 flex flex-col gap-1 text-xs leading-6 text-[color:var(--text-muted)]">
        {item.examples.map((example, index) => (
          <li key={`${item.href}:${index}:${example}`} className="flex items-start gap-2">
            <FileText className="mt-0.5 h-4 w-4 text-[color:var(--text-muted)]" aria-hidden />
            {example}
          </li>
        ))}
      </ul>

      {item.related.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.related.slice(0, 4).map((node) => (
            <span
              key={`${item.id}:${node.slug}`}
              className={`inline-flex rounded-md border px-2 py-0.5 text-3xs font-bold ${likelihoodTone(node.likelihood)}`}
            >
              {node.label}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={item.href}
          onClick={onFocus}
          className="inline-flex min-h-12 items-center gap-1.5 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] px-3 text-xs font-extrabold text-[color:var(--clinical-accent)] hover:opacity-90"
        >
          Open
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
        <button
          type="button"
          onClick={() => {
            onFocus();
            onShowFamily();
          }}
          className="inline-flex min-h-12 items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 text-xs font-bold text-[color:var(--text)] hover:bg-[color:var(--surface)]"
        >
          {familyMode ? "Family focused" : "Show family"}
        </button>
      </div>
    </article>
  );
}

export function DifferentialStreamWorkspace({ model, query, initialFocus = "" }: DifferentialStreamWorkspaceProps) {
  const router = useRouter();
  const copy = streamCopy[model.stream];
  // Match buildDifferentialStreamModel: punctuation-only queries are browse mode.
  const hasQuery = Boolean(normalizeSearchText(query));
  const matchItems = useMemo(() => model.items.filter((item) => item.isMatch), [model.items]);
  const itemBySlug = useMemo(() => new Map(model.items.map((item) => [item.slug, item])), [model.items]);
  const itemById = useMemo(() => new Map(model.items.map((item) => [item.id, item])), [model.items]);

  const [focusedSlug, setFocusedSlug] = useState<string | null>(() => {
    const requested = initialFocus.trim().toLowerCase();
    if (requested && itemBySlug.has(requested)) return requested;
    return matchItems[0]?.slug ?? null;
  });
  const [familyMode, setFamilyMode] = useState(false);
  const [browseGrouping, setBrowseGrouping] = useState<BrowseGrouping>("urgency");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const matchJumpRegionId = useId();
  const didAutoJumpForQuery = useRef("");

  const resultSignature = matchItems.map((item) => item.slug).join("|");
  const [lastResultSignature, setLastResultSignature] = useState("");
  if (lastResultSignature !== resultSignature) {
    setLastResultSignature(resultSignature);
    if (model.stream === "diagnoses") {
      setSelectedIds(new Set(model.compareSeedIds));
    } else {
      setSelectedIds(new Set());
    }
    if (!initialFocus.trim() && matchItems[0]) {
      setFocusedSlug(matchItems[0].slug);
    }
    setFamilyMode(false);
  }

  const focusedItem = focusedSlug ? (itemBySlug.get(focusedSlug) ?? null) : null;
  const relatedSlugSet = useMemo(() => {
    if (!focusedItem) return new Set<string>();
    return new Set(focusedItem.related.map((node) => node.slug));
  }, [focusedItem]);

  const visibleItems = useMemo(() => {
    if (!familyMode || !focusedItem) return model.items;
    const allowed = new Set<string>([focusedItem.slug, ...relatedSlugSet]);
    return model.items.filter((item) => allowed.has(item.slug));
  }, [familyMode, focusedItem, model.items, relatedSlugSet]);

  const activeChapters =
    !hasQuery && model.stream === "diagnoses"
      ? browseGrouping === "presentation"
        ? model.presentationChapters
        : model.chapters
      : model.chapters;

  const matchIndex = focusedSlug ? matchItems.findIndex((item) => item.slug === focusedSlug) : -1;

  function scrollToSlug(slug: string) {
    const node = document.getElementById(`differential-stream-card-${slug}`);
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    setFocusedSlug(slug);
  }

  useEffect(() => {
    const queryKey = `${query.trim().toLowerCase()}::${initialFocus.trim().toLowerCase()}`;
    if (!hasQuery || didAutoJumpForQuery.current === queryKey) return;
    const target = (initialFocus.trim().toLowerCase() || matchItems[0]?.slug) ?? "";
    if (!target) return;
    didAutoJumpForQuery.current = queryKey;
    // Defer one frame so cards are in the DOM after hydration.
    const frame = window.requestAnimationFrame(() => {
      const node = document.getElementById(`differential-stream-card-${target}`);
      if (!node) return;
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      setFocusedSlug(target);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hasQuery, initialFocus, matchItems, query]);

  function highlightFor(item: DifferentialStreamItem): "match" | "related" | "dim" | "neutral" {
    if (!hasQuery && !familyMode) {
      if (focusedSlug && item.slug === focusedSlug) return "match";
      if (focusedSlug && relatedSlugSet.has(item.slug)) return "related";
      return "neutral";
    }
    if (item.isMatch) return "match";
    if (relatedSlugSet.has(item.slug) || (focusedSlug && item.slug === focusedSlug)) return "related";
    if (hasQuery) return "dim";
    return "neutral";
  }

  function jumpMatch(delta: number) {
    if (matchItems.length === 0) return;
    const current = matchIndex >= 0 ? matchIndex : 0;
    const next = (current + delta + matchItems.length) % matchItems.length;
    scrollToSlug(matchItems[next]!.slug);
  }

  function toggleSelected(slug: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function applyPreset(presetQuery: string) {
    router.push(differentialRouteWithQuery("/differentials/diagnoses", presetQuery));
  }

  const safetyItems = model.safetyShelfIds
    .map((id) => itemById.get(id))
    .filter((item): item is DifferentialStreamItem => Boolean(item));

  const selectedCount = selectedIds.size;
  const showSelect = model.stream === "diagnoses";

  function renderCardGrid(items: DifferentialStreamItem[]): ReactNode {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <StreamCard
            key={item.id}
            item={item}
            highlight={highlightFor(item)}
            selected={selectedIds.has(item.slug)}
            showSelect={showSelect}
            familyMode={familyMode && focusedSlug === item.slug}
            onFocus={() => setFocusedSlug(item.slug)}
            onToggleSelect={() => toggleSelected(item.slug)}
            onShowFamily={() => {
              setFocusedSlug(item.slug);
              setFamilyMode(true);
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <main
      data-testid="differentials-stream-workspace"
      className="min-h-0 overflow-x-clip bg-[color:var(--background)] px-4 py-10 text-[color:var(--text)] sm:min-h-[calc(100dvh-var(--shell-header-h))] sm:px-6 lg:px-8"
    >
      <div className="mx-auto grid w-full max-w-6xl gap-6">
        <section className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-inset)] sm:p-6">
          <p className="text-xs font-bold uppercase tracking-eyebrow text-[color:var(--clinical-accent)]">
            {copy.heading}
          </p>
          <h1 className="mt-1 text-4xl font-bold leading-tight text-[color:var(--text-heading)] sm:text-5xl">
            {copy.description}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--text-muted)]">{copy.intro}</p>
          {hasQuery ? (
            <p
              className="mt-2 text-sm font-bold text-[color:var(--clinical-accent)]"
              data-testid="differentials-stream-query"
            >
              Query: {query.trim()}
              {model.matchCount > 0 ? (
                <span className="ml-2 font-semibold text-[color:var(--text-muted)]">
                  · {model.matchCount} match{model.matchCount === 1 ? "" : "es"}
                </span>
              ) : (
                <span className="ml-2 font-semibold text-[color:var(--text-muted)]">· no direct matches</span>
              )}
            </p>
          ) : null}
        </section>

        {!hasQuery && model.presets.length > 0 ? (
          <section className="grid gap-2" aria-label="Scenario presets">
            <p className="text-xs font-bold uppercase tracking-eyebrow text-[color:var(--text-muted)]">
              Start from a scenario
            </p>
            <div className="flex flex-wrap gap-2">
              {model.presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.query)}
                  className="inline-flex min-h-12 items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-bold text-[color:var(--text)] hover:border-[color:var(--clinical-accent-border)] hover:text-[color:var(--clinical-accent)]"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {!hasQuery && safetyItems.length > 0 ? (
          <section
            data-testid="differentials-stream-safety-shelf"
            className="grid gap-2 rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] p-3"
          >
            <div className="flex items-center gap-2 text-sm font-extrabold text-[color:var(--danger)]">
              <ShieldAlert className="h-4 w-4" aria-hidden />
              Must-check / emergent shelf
            </div>
            <div className="flex flex-wrap gap-2">
              {safetyItems.map((item) => (
                <button
                  key={`safety-${item.id}`}
                  type="button"
                  onClick={() => scrollToSlug(item.slug)}
                  className="inline-flex min-h-12 items-center rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--surface)] px-3 text-xs font-bold text-[color:var(--danger)]"
                >
                  {item.title}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {hasQuery ? (
          <section
            id={matchJumpRegionId}
            data-testid="differentials-stream-match-controls"
            className="sticky top-[calc(var(--shell-header-h)+0.5rem)] z-10 grid gap-2 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-inset)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold text-[color:var(--text-heading)]">
                {model.matchCount} match{model.matchCount === 1 ? "" : "es"}
                {focusedItem ? ` · focused ${focusedItem.title}` : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => jumpMatch(-1)}
                  disabled={matchItems.length === 0}
                  className="inline-flex min-h-12 items-center gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-bold text-[color:var(--text)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronUp className="h-4 w-4" aria-hidden />
                  Prev match
                </button>
                <button
                  type="button"
                  onClick={() => jumpMatch(1)}
                  disabled={matchItems.length === 0}
                  className="inline-flex min-h-12 items-center gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-bold text-[color:var(--text)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next match
                  <ChevronDown className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setFamilyMode((current) => !current)}
                  disabled={!focusedItem}
                  className="inline-flex min-h-12 items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-xs font-extrabold text-[color:var(--clinical-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {familyMode ? "Show all" : "Show family"}
                </button>
              </div>
            </div>
            <MatchRail matchItems={matchItems} activeSlug={focusedSlug} onJump={scrollToSlug} />
            {focusedItem && relatedSlugSet.size > 0 ? (
              <p className="text-xs text-[color:var(--text-muted)]">
                Related cluster lit for <span className="font-bold text-[color:var(--text)]">{focusedItem.title}</span>
                {" — "}
                {focusedItem.related
                  .slice(0, 4)
                  .map((node) => node.label)
                  .join(", ")}
              </p>
            ) : null}
          </section>
        ) : null}

        {showSelect ? (
          <section className="hidden items-center justify-between gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 lg:flex">
            <p className="text-sm text-[color:var(--text-muted)]">
              {selectedCount === 0
                ? "Tick two or more diagnoses to open side-by-side compare."
                : selectedCount === 1
                  ? "Select one more diagnosis to enable compare."
                  : `${selectedCount} diagnoses selected for compare.`}
            </p>
            {selectedCount >= 2 ? (
              <Link
                href={differentialSelectedCompareHref(query, selectedIds)}
                data-testid="differentials-stream-compare-desktop"
                className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-4 text-sm font-extrabold text-[color:var(--clinical-accent)]"
              >
                <GitCompareArrows className="h-4 w-4" aria-hidden />
                Compare selected ({selectedCount})
              </Link>
            ) : (
              <button
                type="button"
                disabled
                aria-describedby="stream-compare-need-two"
                className="inline-flex min-h-12 cursor-not-allowed items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 text-sm font-extrabold text-[color:var(--text-muted)] opacity-60"
              >
                <GitCompareArrows className="h-4 w-4" aria-hidden />
                Compare selected
              </button>
            )}
            <span id="stream-compare-need-two" className="sr-only">
              Select at least two diagnoses before opening compare.
            </span>
          </section>
        ) : null}

        <section className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-[color:var(--text-heading)]">Clinical entries</h2>
              <span className="text-sm text-[color:var(--text-muted)]">{copy.entriesLabel}</span>
            </div>
            {!hasQuery && model.stream === "diagnoses" ? (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Browse grouping">
                <button
                  type="button"
                  onClick={() => setBrowseGrouping("urgency")}
                  aria-pressed={browseGrouping === "urgency"}
                  className={[
                    "inline-flex min-h-12 items-center rounded-lg border px-3 text-xs font-bold",
                    browseGrouping === "urgency"
                      ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                      : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]",
                  ].join(" ")}
                >
                  By urgency
                </button>
                <button
                  type="button"
                  onClick={() => setBrowseGrouping("presentation")}
                  aria-pressed={browseGrouping === "presentation"}
                  className={[
                    "inline-flex min-h-12 items-center rounded-lg border px-3 text-xs font-bold",
                    browseGrouping === "presentation"
                      ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                      : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]",
                  ].join(" ")}
                >
                  By presentation
                </button>
                {familyMode ? (
                  <button
                    type="button"
                    onClick={() => setFamilyMode(false)}
                    className="inline-flex min-h-12 items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-bold text-[color:var(--text)]"
                  >
                    Clear family filter
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {hasQuery || familyMode || activeChapters.length === 0
            ? renderCardGrid(visibleItems)
            : activeChapters.map((chapter) => {
                const chapterItems = chapter.itemIds
                  .map((id) => itemById.get(id))
                  .filter((item): item is DifferentialStreamItem => Boolean(item))
                  .filter((item) => visibleItems.some((visible) => visible.id === item.id));
                if (chapterItems.length === 0) return null;
                return (
                  <div
                    key={chapter.id}
                    data-testid={`differential-stream-chapter-${chapter.id}`}
                    className="grid gap-2"
                  >
                    <div className="pt-2">
                      <h3 className="text-sm font-extrabold text-[color:var(--text-heading)]">{chapter.title}</h3>
                      <p className="text-xs text-[color:var(--text-muted)]">{chapter.description}</p>
                    </div>
                    {renderCardGrid(chapterItems)}
                  </div>
                );
              })}
        </section>

        <section className="grid gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 sm:grid-cols-[1fr_auto] sm:grid">
          <div className="grid gap-2">
            <h2 className="text-sm font-bold text-[color:var(--text-heading)]">Keep exploring</h2>
            <p className="text-sm leading-6 text-[color:var(--text-muted)]">
              Return to the differentials home to start from a different presentation, or open search to look up another
              differential.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={differentialRouteWithQuery("/differentials", query)}
              className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 text-sm font-bold text-[color:var(--text)] hover:bg-[color:var(--surface)]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to differential home
            </Link>
            <Link
              href={appModeHomeHref("differentials", { focus: true, query: query.trim() || undefined })}
              className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-sm font-bold text-[color:var(--clinical-accent)] hover:opacity-90"
            >
              <ArrowRight className="h-4 w-4" aria-hidden />
              Open differential search
            </Link>
          </div>
        </section>
      </div>

      {showSelect ? (
        <StreamMobileCompareBar selectedCount={selectedCount} selectedIds={selectedIds} query={query} />
      ) : null}
    </main>
  );
}
