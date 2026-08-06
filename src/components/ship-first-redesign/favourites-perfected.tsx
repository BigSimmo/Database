"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ExternalLink, Heart, Star } from "lucide-react";

import { cn } from "@/components/ui-primitives";

import { AppShell, DeviceFrame, Pair, SectionIntro, focusRing } from "./shared";

type FavItem = {
  id: string;
  title: string;
  detail: string;
  type: string;
  set: string;
  lastUsed: string;
};

const SETS = [
  { id: "all", label: "All", count: 5 },
  { id: "ward", label: "Ward round", count: 2 },
  { id: "safety", label: "Prescribing safety", count: 2 },
  { id: "clozapine", label: "Clozapine clinic", count: 1 },
  { id: "pinned", label: "Pinned" },
] as const;

const ITEMS: FavItem[] = [
  {
    id: "clozapine-guide",
    title: "Clozapine monitoring guide",
    detail: "Saved table · ANC monitoring",
    type: "Document",
    set: "Clozapine clinic",
    lastUsed: "Yesterday 16:10",
  },
  {
    id: "lithium",
    title: "Lithium levels checklist",
    detail: "Saved note · trough timing",
    type: "Note",
    set: "Prescribing safety",
    lastUsed: "Mon 09:12",
  },
  {
    id: "acamprosate",
    title: "Acamprosate renal screen",
    detail: "Continue · ward round",
    type: "Tool",
    set: "Ward round",
    lastUsed: "Today 08:44",
  },
];

function FavouritesFrame({ device }: { device: "desktop" | "phone" }) {
  const phone = device === "phone";
  const [query, setQuery] = useState("");
  const [activeSet, setActiveSet] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ITEMS.filter((item) => {
      const inSet =
        activeSet === "all" ||
        (activeSet === "ward" && item.set === "Ward round") ||
        (activeSet === "safety" && item.set === "Prescribing safety") ||
        (activeSet === "clozapine" && item.set === "Clozapine clinic") ||
        (activeSet === "pinned" && item.id === "clozapine-guide");
      if (!inSet) return false;
      if (!q) return true;
      return `${item.title} ${item.detail} ${item.set}`.toLowerCase().includes(q);
    });
  }, [activeSet, query]);

  const emptyQuery = query.trim().length === 0;

  return (
    <DeviceFrame device={device} label={phone ? "Phone workspace" : "Desktop workspace"}>
      <AppShell device={device} active="favourites" modeLabel="Favourites" ModeIcon={Heart}>
        <div className={cn(phone ? "px-3 pb-4 pt-3" : "px-6 py-5")}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <h3
                className={cn(
                  "font-extrabold tracking-[-0.03em] text-[color:var(--text-heading)]",
                  phone ? "text-2xl" : "text-3xl",
                )}
              >
                Favourites
              </h3>
              <p className="mt-1 text-2xs font-medium text-[color:var(--text-muted)]">5 items · one workspace</p>
            </div>
          </div>

          <div className="mt-4">
            <label className="sr-only" htmlFor={`fav-q-${device}`}>
              Search favourites
            </label>
            <div
              className={cn(
                "flex w-full items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] py-2 pl-4 pr-2 shadow-[var(--shadow-inset)]",
                phone ? "min-h-12" : "min-h-14",
              )}
            >
              <input
                id={`fav-q-${device}`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search saved items…"
                className="min-w-0 flex-1 bg-transparent text-sm text-[color:var(--text-heading)] outline-none placeholder:text-[color:var(--text-soft)]"
              />
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--surface)]"
                aria-hidden
              >
                →
              </span>
            </div>
          </div>

          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1" role="listbox" aria-label="Favourite sets">
            {SETS.map((set) => {
              const selected = activeSet === set.id;
              return (
                <button
                  key={set.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => setActiveSet(set.id)}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-2xs font-bold",
                    focusRing,
                    selected
                      ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                      : "border-[color:var(--border)] text-[color:var(--text-muted)]",
                  )}
                >
                  {set.label}
                  {"count" in set && typeof set.count === "number" ? (
                    <span className="tabular-nums opacity-80">{set.count}</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {emptyQuery ? (
            <div className="mt-4 rounded-xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-3xs font-extrabold uppercase tracking-[0.1em] text-[color:var(--clinical-accent)]">
                    Continue
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-[color:var(--text-heading)]">
                    Acamprosate renal screen
                  </p>
                  <p className="text-2xs text-[color:var(--text-muted)]">Ward round · Last opened Today 08:44</p>
                </div>
                <span className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[color:var(--clinical-accent)] px-3 text-2xs font-bold text-[color:var(--surface)]">
                  Continue
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </span>
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex items-center justify-between gap-2">
            <p className="text-2xs font-bold text-[color:var(--text-muted)]">
              {emptyQuery
                ? "Recent + saved"
                : `${filtered.length} match${filtered.length === 1 ? "" : "es"} for “${query.trim()}”`}
            </p>
            <span className="inline-flex items-center gap-1 text-2xs font-semibold text-[color:var(--text-soft)]">
              Sort: Last used
              <ChevronDown className="h-3 w-3" aria-hidden />
            </span>
          </div>

          <div className="mt-2 overflow-hidden rounded-xl border border-[color:var(--border)]">
            {filtered.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-start gap-3 border-b border-[color:var(--border)] last:border-b-0",
                  phone ? "px-3 py-3" : "px-4 py-3.5",
                )}
              >
                <Star
                  className="mt-0.5 h-4 w-4 shrink-0 fill-[color:var(--clinical-accent)] text-[color:var(--clinical-accent)]"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[color:var(--text-heading)]">{item.title}</p>
                  <p className="text-2xs text-[color:var(--text-muted)]">{item.detail}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className="rounded-full border border-[color:var(--border)] px-2 py-0.5 text-3xs font-semibold text-[color:var(--text-muted)]">
                      {item.type}
                    </span>
                    <span className="rounded-full border border-[color:var(--border)] px-2 py-0.5 text-3xs font-semibold text-[color:var(--text-muted)]">
                      {item.set}
                    </span>
                    <span className="text-3xs text-[color:var(--text-soft)]">{item.lastUsed}</span>
                  </div>
                </div>
                <span className="inline-flex h-9 shrink-0 items-center rounded-lg border border-[color:var(--border)] px-3 text-2xs font-bold">
                  Open
                </span>
              </div>
            ))}
            {filtered.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[color:var(--text-muted)]">No saved items match.</p>
            ) : null}
          </div>

          {emptyQuery ? (
            <div className="mt-3 grid gap-2">
              <span className="inline-flex items-center justify-between rounded-xl border border-[color:var(--border)] px-3 py-2.5 text-2xs font-bold text-[color:var(--text-muted)]">
                Recent
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              </span>
            </div>
          ) : null}
        </div>
      </AppShell>
    </DeviceFrame>
  );
}

export function FavouritesPerfectedSection() {
  return (
    <section id="favourites" aria-labelledby="favourites-title" className="scroll-mt-8">
      <SectionIntro
        issue="#164"
        title="Favourites redesign"
        body="One page: search + saved sets + recent items. Empty search shows Continue / recent; typing filters in place. Sets are chips, not buried menus. Not a ModeHome."
        pick="B — Search-Led Workspace. Persistent search, set chips, in-place filter table."
      />
      <Pair desktop={<FavouritesFrame device="desktop" />} phone={<FavouritesFrame device="phone" />} />
    </section>
  );
}
