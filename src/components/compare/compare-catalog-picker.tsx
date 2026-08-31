"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowRight, Search } from "lucide-react";

import { filterCompareCatalog, padCompareIds, slotLetters } from "@/components/compare/filter-catalog";
import type { CompareCatalogItem, CompareStarterChip } from "@/components/compare/types";
import { cn, searchShell, searchShellInput } from "@/components/ui-primitives";

export function CompareCatalogPicker({
  items,
  query,
  onQueryChange,
  selectedIds,
  maxCount,
  activeSlot,
  onActiveSlotChange,
  onChoose,
  onDone,
  onReset,
  searchPlaceholder,
  emptyHint,
  announcement,
  filterLocally = true,
  title,
  titleId,
  starters,
}: {
  items: readonly CompareCatalogItem[];
  query: string;
  onQueryChange: (query: string) => void;
  selectedIds: readonly (string | null | undefined)[];
  maxCount?: number;
  activeSlot: number;
  onActiveSlotChange?: (index: number) => void;
  onChoose: (id: string) => void;
  onDone?: () => void;
  onReset?: () => void;
  searchPlaceholder: string;
  emptyHint?: string;
  announcement?: string;
  filterLocally?: boolean;
  title?: string;
  titleId?: string;
  starters?: readonly CompareStarterChip[];
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const highlightScope = `${query}::${activeSlot}`;
  const [highlightState, setHighlightState] = useState({ scope: highlightScope, index: 0 });
  // Keep highlight scoped to the current query/slot during render — do not reset in an effect.
  if (highlightState.scope !== highlightScope) {
    setHighlightState({ scope: highlightScope, index: 0 });
  }
  const highlight = highlightState.scope === highlightScope ? highlightState.index : 0;
  const count = maxCount ?? Math.max(selectedIds.length, 1);
  const slots = padCompareIds(selectedIds, count);
  const labels = slotLetters(count);
  const hits = useMemo(
    () => (filterLocally ? filterCompareCatalog(items, query) : items).slice(0, 12),
    [filterLocally, items, query],
  );
  const taken = new Set(slots.filter((id): id is string => Boolean(id)));
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeSlot]);

  function choose(id: string) {
    if (taken.has(id) && slots[activeSlot] !== id) return;
    onChoose(id);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!hits.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightState({ scope: highlightScope, index: (highlight + 1) % hits.length });
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightState({ scope: highlightScope, index: (highlight - 1 + hits.length) % hits.length });
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const hit = hits[highlight];
      if (hit) choose(hit.id);
    }
  }

  return (
    <div className="grid gap-3">
      {title ? (
        <h2 id={titleId} className="text-sm font-extrabold text-[color:var(--text-heading)]">
          {title}
        </h2>
      ) : null}
      {labels.length > 1 && onActiveSlotChange ? (
        <div
          className={cn(
            "grid items-center gap-2",
            labels.length === 2 ? "grid-cols-2" : labels.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3",
          )}
          role="tablist"
          aria-label="Active comparison slot"
        >
          {labels.map((label, index) => {
            const selected = slots[index];
            const item = selected ? itemById.get(selected) : undefined;
            return (
              <button
                key={`${label}-${index}`}
                type="button"
                role="tab"
                aria-selected={activeSlot === index}
                onClick={() => onActiveSlotChange(index)}
                className={cn(
                  "min-h-tap rounded-lg border px-3 text-left text-xs font-bold",
                  activeSlot === index
                    ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)]"
                    : "border-[color:var(--border)]",
                )}
              >
                <span className="block text-3xs text-[color:var(--text-muted)]">{label}</span>
                {item?.title ?? "Choose"}
              </button>
            );
          })}
        </div>
      ) : null}
      <label htmlFor={inputId} className={searchShell}>
        <Search className="size-icon-sm text-[color:var(--decoration-soft)]" aria-hidden="true" />
        <span className="sr-only">{searchPlaceholder}</span>
        <input
          ref={inputRef}
          id={inputId}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={searchPlaceholder}
          className={cn(searchShellInput, "text-base sm:text-sm")}
        />
      </label>
      {!query.trim() && starters?.length ? (
        <div className="flex flex-wrap gap-2">
          {starters.map((chip) => (
            <Link
              key={chip.id}
              href={chip.href}
              className="inline-flex min-h-tap items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-bold"
            >
              {chip.label}
            </Link>
          ))}
        </div>
      ) : null}
      <div className="max-h-[24rem] overflow-y-auto border-y border-[color:var(--border)]" role="listbox">
        {hits.length === 0 ? (
          <p className="px-3 py-6 text-sm text-[color:var(--text-muted)]">{emptyHint ?? "No matching items."}</p>
        ) : (
          hits.map((item, index) => {
            const duplicate = taken.has(item.id) && slots[activeSlot] !== item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={highlight === index}
                onClick={() => choose(item.id)}
                disabled={duplicate}
                className={cn(
                  "grid min-h-[4.5rem] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-[color:var(--border)] px-2 py-2.5 text-left last:border-b-0 hover:bg-[color:var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-45",
                  highlight === index && !duplicate ? "bg-[color:var(--surface-subtle)]" : null,
                )}
              >
                <span>
                  <strong className="block text-sm text-[color:var(--text-heading)]">{item.title}</strong>
                  {item.snippet ? (
                    <span className="mt-0.5 line-clamp-2 block text-xs leading-4 text-[color:var(--text-muted)]">
                      {item.snippet}
                    </span>
                  ) : null}
                  {item.tag ? (
                    <span className="mt-1 block text-3xs font-bold text-[color:var(--clinical-accent)]">
                      {item.tag}
                    </span>
                  ) : null}
                </span>
                <ArrowRight className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
              </button>
            );
          })
        )}
      </div>
      {onDone || onReset ? (
        <div className="flex items-center justify-between gap-3">
          {onReset ? (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex min-h-tap items-center px-3 text-sm font-bold text-[color:var(--clinical-accent)]"
            >
              Reset
            </button>
          ) : (
            <span />
          )}
          {onDone ? (
            <button
              type="button"
              onClick={onDone}
              className="min-h-tap flex-1 rounded-lg bg-[color:var(--command)] px-4 text-sm font-extrabold text-[color:var(--command-contrast)]"
            >
              Done
            </button>
          ) : null}
        </div>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {announcement ?? ""}
      </p>
    </div>
  );
}
