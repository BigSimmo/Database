"use client";

import { ArrowLeft, Copy, Plus, Search, Trash2, X } from "lucide-react";
import { useState } from "react";

import { cn } from "@/components/ui-primitives";

import {
  AddedToast,
  ComparisonPreview,
  CurrentDefects,
  MAX_COMPARE,
  MockupSection,
  MockupShell,
  NoteCard,
  PhoneComposer,
  PhoneFrame,
  PhoneTopBar,
  ReviewPill,
  SLOT_LETTERS,
  SlotBadge,
  THERAPY_COUNT,
  bySlug,
  filterTherapies,
  focusRing,
  useCompareSet,
} from "./shared";

/* ------------------------------------------------------------------ *
 * Direction A — Add as you go.
 *
 * The screen shows what you have chosen and one way to add the next one.
 * Zero selections means zero cards: a single primary button and two starter
 * pairs. The slot letters still exist — they are what the comparison keys
 * off — but they are minted as you fill them, never drawn empty.
 * ------------------------------------------------------------------ */

const STARTERS: Array<{ label: string; slugs: [string, string] }> = [
  { label: "CBT vs ACT", slugs: ["cognitive-behavioural-therapy-cbt", "acceptance-and-commitment-therapy-act"] },
  { label: "DBT vs MBT", slugs: ["dialectical-behaviour-therapy-dbt", "mentalisation-based-treatment-mbt"] },
  {
    label: "EMDR vs CPT",
    slugs: ["eye-movement-desensitisation-and-reprocessing-emdr", "cognitive-processing-therapy-cpt"],
  },
];

function ProgressivePhone() {
  const set = useCompareSet();
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const results = filterTherapies(query, "All");
  const count = set.selected.length;

  function choose(slug: string) {
    set.add(slug);
    setPicking(false);
    setQuery("");
    const therapy = bySlug(slug);
    setToast(therapy ? `${therapy.short} added as ${SLOT_LETTERS[count] ?? "next"}` : null);
    window.setTimeout(() => setToast(null), 1600);
  }

  return (
    <PhoneFrame
      label="Direction A — live"
      note="Tap Add a therapy. Nothing renders for a therapy you have not chosen, so the first thing under the title is always the next thing to do."
      tall
    >
      <PhoneTopBar />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-4">
        {/* Title block: one line, and a count that only exists once it counts. */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight text-[color:var(--text-heading)]">Compare therapies</h2>
            <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">
              {count === 0
                ? "Add two or more to see fit, cautions and delivery side by side."
                : count === 1
                  ? "Add one more to start the comparison."
                  : `${count} of ${MAX_COMPARE} · fit, cautions, delivery and evidence.`}
            </p>
          </div>
          {count > 0 ? (
            <button
              type="button"
              onClick={set.clear}
              aria-label="Clear all selected therapies"
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[color:var(--text-muted)]",
                focusRing,
              )}
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {/* Chosen therapies — one row each, nothing more. */}
        {count > 0 ? (
          <ul className="mt-4 space-y-2">
            {set.items.map((therapy, index) => (
              <li
                key={therapy.slug}
                className="flex items-start gap-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3"
              >
                <SlotBadge index={index} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold leading-5 text-[color:var(--text-heading)]">{therapy.name}</p>
                  <p className="mt-0.5 truncate text-3xs font-semibold text-[color:var(--text-muted)]">
                    {therapy.category}
                  </p>
                  <div className="mt-1.5">
                    <ReviewPill />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => set.remove(therapy.slug)}
                  aria-label={`Remove ${therapy.short}`}
                  className={cn(
                    "-mr-1 -mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-lg text-[color:var(--text-muted)]",
                    focusRing,
                  )}
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {/* The single add affordance. Primary while empty, quiet once filling. */}
        {set.full ? (
          <p className="mt-3 rounded-xl border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] px-3 py-2.5 text-center text-xs font-semibold text-[color:var(--text-muted)]">
            {MAX_COMPARE} of {MAX_COMPARE} — remove one to swap in another
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className={cn(
              "mt-3 flex w-full items-center justify-center gap-2 rounded-xl font-extrabold",
              focusRing,
              count === 0
                ? "min-h-12 bg-[color:var(--command)] text-sm text-[color:var(--command-contrast)]"
                : "min-h-12 border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface)] text-sm text-[color:var(--clinical-accent)]",
            )}
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            {count === 0 ? "Add a therapy" : `Add therapy ${SLOT_LETTERS[count]}`}
          </button>
        )}

        {/* Starter pairs — only while they can still fit. */}
        {count === 0 ? (
          <div className="mt-5">
            <p className="text-3xs font-black uppercase tracking-eyebrow text-[color:var(--text-soft)]">
              Or start from a pair
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {STARTERS.map((starter) => (
                <button
                  key={starter.label}
                  type="button"
                  onClick={() => set.setSelected([...starter.slugs])}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-bold text-[color:var(--text-heading)]",
                    focusRing,
                  )}
                >
                  {starter.label}
                </button>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-[color:var(--text-muted)]">
              You can also add from a search result or from any therapy record — the set follows you.
            </p>
          </div>
        ) : null}

        {/* Everything that only makes sense with a comparison on screen. */}
        {count >= 2 ? (
          <>
            <button
              type="button"
              onClick={() => undefined}
              className={cn(
                "mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-xs font-bold text-[color:var(--text-heading)]",
                focusRing,
              )}
            >
              <Copy aria-hidden="true" className="h-3.5 w-3.5" />
              Copy set as text
            </button>
            <div className="mt-5">
              <ComparisonPreview items={set.items} />
            </div>
          </>
        ) : null}
      </div>

      <PhoneComposer />
      <AddedToast label={toast} />

      {/* Full-screen picker. One tap adds and returns. */}
      {picking ? (
        <div className="absolute inset-0 z-20 flex flex-col bg-[color:var(--surface)]">
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[color:var(--border)] px-2">
            <button
              type="button"
              onClick={() => setPicking(false)}
              aria-label="Back to comparison"
              className={cn("grid h-11 w-11 place-items-center rounded-lg text-[color:var(--text-muted)]", focusRing)}
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            </button>
            <p className="text-sm font-bold text-[color:var(--text-heading)]">
              Add therapy {SLOT_LETTERS[set.selected.length] ?? ""}
            </p>
          </div>
          <div className="shrink-0 px-4 pb-2 pt-3">
            <div className="flex h-11 items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3">
              <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${THERAPY_COUNT} therapies`}
                aria-label="Search therapies"
                className="min-w-0 flex-1 bg-transparent text-sm text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-muted)]"
              />
            </div>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto px-4 pb-5">
            {results.map((therapy) => {
              const already = set.selected.includes(therapy.slug);
              return (
                <li key={therapy.slug} className="border-b border-[color:var(--border)] last:border-b-0">
                  <button
                    type="button"
                    onClick={() => (already ? undefined : choose(therapy.slug))}
                    aria-disabled={already || undefined}
                    className={cn("flex w-full items-center gap-2 py-3 text-left", focusRing, already && "opacity-45")}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold leading-5 text-[color:var(--text-heading)]">
                        {therapy.name}
                      </span>
                      <span className="mt-0.5 block truncate text-3xs font-semibold text-[color:var(--text-muted)]">
                        {therapy.category}
                      </span>
                    </span>
                    <span className="shrink-0 text-3xs font-black text-[color:var(--clinical-accent)]">
                      {already ? "ADDED" : "ADD"}
                    </span>
                  </button>
                </li>
              );
            })}
            {results.length === 0 ? (
              <li className="py-8 text-center text-xs text-[color:var(--text-muted)]">No matching therapies.</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </PhoneFrame>
  );
}

function StatePhone({ label, note, slugs }: { label: string; note: string; slugs: string[] }) {
  const items = slugs.map((slug) => bySlug(slug)).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  return (
    <PhoneFrame label={label} note={note}>
      <PhoneTopBar />
      <div className="min-h-0 flex-1 overflow-hidden px-4 pb-5 pt-4">
        <h2 className="text-xl font-semibold tracking-tight text-[color:var(--text-heading)]">Compare therapies</h2>
        <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">
          {items.length} of {MAX_COMPARE} · fit, cautions, delivery and evidence.
        </p>
        <ul className="mt-4 space-y-2">
          {items.map((therapy, index) => (
            <li
              key={therapy.slug}
              className="flex items-start gap-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3"
            >
              <SlotBadge index={index} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-5 text-[color:var(--text-heading)]">{therapy.name}</p>
                <p className="mt-0.5 truncate text-3xs font-semibold text-[color:var(--text-muted)]">
                  {therapy.category}
                </p>
              </div>
              <X aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-[color:var(--text-muted)]" />
            </li>
          ))}
        </ul>
        <p className="mt-3 rounded-xl border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] px-3 py-2.5 text-center text-xs font-semibold text-[color:var(--text-muted)]">
          {MAX_COMPARE} of {MAX_COMPARE} — remove one to swap in another
        </p>
        <div className="mt-5">
          <ComparisonPreview items={items.slice(0, 2)} />
        </div>
      </div>
      <PhoneComposer />
    </PhoneFrame>
  );
}

export function TherapyCompareProgressiveMockups() {
  return (
    <MockupShell
      current="therapy-compare-progressive"
      letter="A"
      name="Add as you go"
      headline="Draw what was chosen, not what could be."
      intro="The closest answer to the ask: stop rendering four empty slots. An empty screen offers one button and three starter pairs. Each therapy you add becomes a row; the add control moves down under it and quietens once the set is started. Four is enforced at the ceiling, not advertised at the start."
    >
      <CurrentDefects />

      <MockupSection
        id="a-live"
        title="The screen, live"
        intro="Tap through it. The first tap target under the title is always the one that moves you forward."
      >
        <div className="flex flex-wrap items-start gap-8">
          <ProgressivePhone />
          <StatePhone
            label="Direction A — at the ceiling"
            note="At four, the add control becomes a plain sentence rather than a disabled button. Nothing on screen invites a fifth."
            slugs={[
              "cognitive-behavioural-therapy-cbt",
              "acceptance-and-commitment-therapy-act",
              "behavioural-activation-ba",
              "interpersonal-psychotherapy-ipt",
            ]}
          />
        </div>
      </MockupSection>

      <MockupSection id="a-rules" title="The rules this direction commits to">
        <div className="grid gap-2 lg:grid-cols-3">
          <NoteCard
            tone="accent"
            title="Nothing empty is ever drawn"
            body="No placeholder cards, no `Choose therapy` rows, no `0 of 4` badge. An empty screen is one heading, one sentence, one button and three chips — roughly 240 px instead of the current 1,100."
          />
          <NoteCard
            title="One affordance per outcome"
            body="`Change therapies` and the second `Add therapies to compare` button both disappear. Adding is the button; removing is the × on the row it removes; clearing is the bin beside the title, and only once there is something to clear."
          />
          <NoteCard
            title="Controls arrive with their subject"
            body="Copy set and Add another appear at two selections, immediately above the comparison they act on. Density does not appear on a phone at all — a stacked per-field layout has no wide table to loosen."
          />
          <NoteCard
            title="The count moved into the sentence"
            body="`2 of 4 · fit, cautions, delivery and evidence` replaces the detached badge. Before the first pick it says what to do instead of counting nothing."
          />
          <NoteCard
            title="The ceiling is a statement, not a dead control"
            body="At four, the add row becomes plain text. That avoids the repo's disabled-button trap: no `disabled` attribute removing a tab stop, and no `aria-disabled` control that looks live but is not."
          />
          <NoteCard
            tone="warn"
            title="Desktop keeps its shape"
            body="Above `sm` the rows can lay out two or three across and the density toggle returns with the table. This direction only changes what the phone renders and in what order — the same selection model drives both."
          />
        </div>
      </MockupSection>

      <MockupSection id="a-cost" title="What it costs to build">
        <div className="grid gap-2 lg:grid-cols-3">
          <NoteCard
            title="Smallest change of the three"
            body="`CompareSlotStrip` renders filled slots only and appends one add row; `CompareIdsChrome` drops the separate empty state; `CompareScreen` moves its toolbar below the selection and behind a count check. The picker, the ids in the URL and the commit path are untouched."
          />
          <NoteCard
            title="Shared by five compare screens"
            body="`compare/` is used by therapy, dictionary, DSM, formulation and specifiers. A change here lands on all five, which is an argument for it — the four-empty-slots problem is the same on every one."
          />
          <NoteCard
            tone="warn"
            title="What it does not fix"
            body="You still leave the page to add each therapy, so building a set of four is four round trips. Directions B and C attack exactly that."
          />
        </div>
      </MockupSection>
    </MockupShell>
  );
}
