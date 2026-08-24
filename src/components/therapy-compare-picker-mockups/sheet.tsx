"use client";

import { Check, Copy, Layers, Pencil, Plus, Scale, Search, X } from "lucide-react";
import { useState } from "react";

import { cn } from "@/components/ui-primitives";

import {
  CATEGORY_FILTERS,
  ComparisonPreview,
  CurrentDefects,
  MAX_COMPARE,
  MockupSection,
  MockupShell,
  NoteCard,
  PhoneComposer,
  PhoneFrame,
  PhoneTopBar,
  SLOT_LETTERS,
  THERAPY_COUNT,
  bySlug,
  filterTherapies,
  focusRing,
  useCompareSet,
} from "./shared";

/* ------------------------------------------------------------------ *
 * Direction B — Build the set in one sheet.
 *
 * The page body never holds a picker. Choosing is one full-height sheet:
 * search, category filter, a multi-select list, and a docked bar that
 * counts what you have and commits the whole set in one action. You return
 * to the comparison, not to another empty slot.
 * ------------------------------------------------------------------ */

function SheetPhone() {
  const set = useCompareSet();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const results = filterTherapies(query, category);

  function openSheet() {
    setDraft(set.selected);
    setQuery("");
    setCategory("All");
    setOpen(true);
  }

  function toggleDraft(slug: string) {
    setDraft((current) => {
      if (current.includes(slug)) return current.filter((entry) => entry !== slug);
      return current.length >= MAX_COMPARE ? current : [...current, slug];
    });
  }

  function commit() {
    set.setSelected(draft);
    setOpen(false);
  }

  const count = set.selected.length;
  const draftItems = draft
    .map((slug) => bySlug(slug))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  return (
    <PhoneFrame
      label="Direction B — live"
      note="Tap Choose therapies. Everything happens in the sheet: search, filter, tick up to four, then one Compare button returns you to the result."
      tall
    >
      <PhoneTopBar />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-4">
        <h2 className="text-xl font-semibold tracking-tight text-[color:var(--text-heading)]">Compare therapies</h2>

        {count === 0 ? (
          <>
            <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">
              Choose two to four therapies and see fit, cautions, delivery and evidence together.
            </p>
            <button
              type="button"
              onClick={openSheet}
              className={cn(
                "mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--command)] text-sm font-extrabold text-[color:var(--command-contrast)]",
                focusRing,
              )}
            >
              <Search aria-hidden="true" className="h-4 w-4" />
              Choose therapies
            </button>
            <div className="mt-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
              <p className="flex items-center gap-1.5 text-3xs font-black uppercase tracking-eyebrow text-[color:var(--text-soft)]">
                <Layers aria-hidden="true" className="h-3.5 w-3.5" />
                What you get
              </p>
              <ul className="mt-2 space-y-1.5 text-xs leading-5 text-[color:var(--text-muted)]">
                <li>· Cautions first, then best fit, time and clinician skill</li>
                <li>· Every field links back to the source record</li>
                <li>· Copy the whole set as text for a letter or note</li>
              </ul>
            </div>
          </>
        ) : (
          <>
            {/* The whole selection as one wrapping line of pills. */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {set.items.map((therapy, index) => (
                <span
                  key={therapy.slug}
                  className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] py-1 pl-1 pr-1 text-xs font-bold text-[color:var(--text-heading)]"
                >
                  <span
                    className={cn(
                      "grid h-5 w-5 place-items-center rounded-full text-3xs font-black text-[color:var(--command-contrast)]",
                      index === 0
                        ? "bg-[color:var(--clinical-accent)]"
                        : index === 1
                          ? "bg-[color:var(--info)]"
                          : "bg-[color:var(--text-muted)]",
                    )}
                  >
                    {SLOT_LETTERS[index]}
                  </span>
                  {therapy.short}
                  <button
                    type="button"
                    onClick={() => set.remove(therapy.slug)}
                    aria-label={`Remove ${therapy.short}`}
                    className={cn(
                      "grid h-6 w-6 place-items-center rounded-full text-[color:var(--text-muted)]",
                      focusRing,
                    )}
                  >
                    <X aria-hidden="true" className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={openSheet}
                className={cn(
                  "inline-flex min-h-8 items-center gap-1 rounded-full border border-dashed border-[color:var(--border-strong)] px-2.5 text-xs font-bold text-[color:var(--clinical-accent)]",
                  focusRing,
                )}
              >
                <Pencil aria-hidden="true" className="h-3 w-3" />
                Edit set
              </button>
            </div>

            {count === 1 ? (
              <p className="mt-3 rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--warning-bg)] px-3 py-2.5 text-xs font-semibold text-[color:var(--warning-text)]">
                One more needed before anything can be compared.
              </p>
            ) : (
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
                <div className="mt-4">
                  <ComparisonPreview items={set.items} />
                </div>
              </>
            )}
          </>
        )}
      </div>

      <PhoneComposer />

      {/* The full-height sheet: the only place selection happens. */}
      {open ? (
        <div className="absolute inset-0 z-20 flex flex-col bg-[color:var(--surface)]">
          <div className="flex shrink-0 items-center gap-2 border-b border-[color:var(--border)] px-2 py-2">
            <div className="min-w-0 flex-1 pl-2">
              <p className="text-sm font-bold text-[color:var(--text-heading)]">Choose therapies</p>
              <p className="text-3xs font-semibold text-[color:var(--text-muted)]">
                Up to {MAX_COMPARE} · tick as many as you need
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close without changing the set"
              className={cn("grid h-11 w-11 place-items-center rounded-lg text-[color:var(--text-muted)]", focusRing)}
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
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

          {/* Category is a first-class field in the data; give it a way in. */}
          <div className="shrink-0 overflow-x-auto px-4 pb-2.5">
            <div className="flex w-max gap-1.5">
              {CATEGORY_FILTERS.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => setCategory(entry)}
                  aria-pressed={category === entry}
                  className={cn(
                    "inline-flex min-h-9 items-center whitespace-nowrap rounded-full border px-3 text-3xs font-bold",
                    focusRing,
                    category === entry
                      ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent-hover)]"
                      : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]",
                  )}
                >
                  {entry === "All" ? `All ${THERAPY_COUNT}` : entry.replace(" Therapies", "")}
                </button>
              ))}
            </div>
          </div>

          <ul className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
            {results.map((therapy) => {
              const ticked = draft.includes(therapy.slug);
              const blocked = !ticked && draft.length >= MAX_COMPARE;
              return (
                <li key={therapy.slug} className="border-b border-[color:var(--border)] last:border-b-0">
                  <button
                    type="button"
                    onClick={() => (blocked ? undefined : toggleDraft(therapy.slug))}
                    aria-pressed={ticked}
                    aria-disabled={blocked || undefined}
                    className={cn("flex w-full items-center gap-3 py-3 text-left", focusRing)}
                    style={blocked ? { opacity: 0.4 } : undefined}
                  >
                    <span
                      className={cn(
                        "grid h-6 w-6 shrink-0 place-items-center rounded-md border-2",
                        ticked
                          ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--command-contrast)]"
                          : "border-[color:var(--border-strong)]",
                      )}
                    >
                      {ticked ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold leading-5 text-[color:var(--text-heading)]">
                        {therapy.name}
                      </span>
                      <span className="mt-0.5 block truncate text-3xs font-semibold text-[color:var(--text-muted)]">
                        {therapy.category}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {results.length === 0 ? (
              <li className="py-8 text-center text-xs text-[color:var(--text-muted)]">
                No therapies match that search in this category.
              </li>
            ) : null}
          </ul>

          {/* Docked commit bar: what you have, and the one way out. */}
          <div className="shrink-0 border-t border-[color:var(--border)] bg-[color:var(--surface-lux)] px-4 pb-4 pt-3">
            <div className="mb-2 flex min-h-6 flex-wrap items-center gap-1.5">
              {draftItems.length === 0 ? (
                <span className="text-3xs font-semibold text-[color:var(--text-muted)]">
                  Nothing ticked yet — choose at least two.
                </span>
              ) : (
                draftItems.map((therapy) => (
                  <span
                    key={therapy.slug}
                    className="inline-flex items-center gap-1 rounded-full bg-[color:var(--clinical-accent-soft)] px-2 py-0.5 text-3xs font-black text-[color:var(--clinical-accent-hover)]"
                  >
                    {therapy.short}
                  </span>
                ))
              )}
            </div>
            <button
              type="button"
              onClick={() => (draft.length >= 2 ? commit() : undefined)}
              aria-disabled={draft.length < 2 || undefined}
              className={cn(
                "flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-extrabold",
                focusRing,
                draft.length >= 2
                  ? "bg-[color:var(--command)] text-[color:var(--command-contrast)]"
                  : "bg-[color:var(--surface-inset)] text-[color:var(--text-muted)]",
              )}
            >
              {draft.length >= 2 ? (
                <>
                  <Scale aria-hidden="true" className="h-4 w-4" />
                  Compare {draft.length}
                </>
              ) : (
                <>
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  {draft.length === 0 ? "Tick two to compare" : "Tick one more"}
                </>
              )}
            </button>
          </div>
        </div>
      ) : null}
    </PhoneFrame>
  );
}

function SheetStatePhone() {
  return (
    <PhoneFrame
      label="Direction B — the sheet, mid-selection"
      note="Two ticked, the docked bar naming them and offering the single way out. The count is on the button you are about to press, not in a header badge."
    >
      <div className="flex h-full flex-col bg-[color:var(--surface)]">
        <div className="flex shrink-0 items-center gap-2 border-b border-[color:var(--border)] px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[color:var(--text-heading)]">Choose therapies</p>
            <p className="text-3xs font-semibold text-[color:var(--text-muted)]">Up to 4 · tick as many as you need</p>
          </div>
          <X aria-hidden="true" className="h-4 w-4 text-[color:var(--text-muted)]" />
        </div>
        <div className="shrink-0 px-4 pb-2 pt-3">
          <div className="flex h-11 items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3">
            <Search aria-hidden="true" className="h-4 w-4 text-[color:var(--text-muted)]" />
            <span className="text-sm text-[color:var(--text-muted)]">trauma</span>
          </div>
        </div>
        <div className="shrink-0 px-4 pb-2.5">
          <div className="flex gap-1.5">
            <span className="inline-flex min-h-9 items-center rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-3xs font-bold text-[color:var(--clinical-accent-hover)]">
              Trauma
            </span>
            <span className="inline-flex min-h-9 items-center rounded-full border border-[color:var(--border)] px-3 text-3xs font-bold text-[color:var(--text-muted)]">
              All 205
            </span>
          </div>
        </div>
        <ul className="min-h-0 flex-1 overflow-hidden px-4">
          {["eye-movement-desensitisation-and-reprocessing-emdr", "cognitive-processing-therapy-cpt"].map((slug) => {
            const therapy = bySlug(slug);
            if (!therapy) return null;
            return (
              <li key={slug} className="flex items-center gap-3 border-b border-[color:var(--border)] py-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--command-contrast)]">
                  <Check aria-hidden="true" className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold leading-5 text-[color:var(--text-heading)]">
                    {therapy.name}
                  </span>
                  <span className="mt-0.5 block truncate text-3xs font-semibold text-[color:var(--text-muted)]">
                    {therapy.category}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        <div className="shrink-0 border-t border-[color:var(--border)] bg-[color:var(--surface-lux)] px-4 pb-4 pt-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center rounded-full bg-[color:var(--clinical-accent-soft)] px-2 py-0.5 text-3xs font-black text-[color:var(--clinical-accent-hover)]">
              EMDR
            </span>
            <span className="inline-flex items-center rounded-full bg-[color:var(--clinical-accent-soft)] px-2 py-0.5 text-3xs font-black text-[color:var(--clinical-accent-hover)]">
              CPT
            </span>
          </div>
          <span className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--command)] text-sm font-extrabold text-[color:var(--command-contrast)]">
            <Scale aria-hidden="true" className="h-4 w-4" />
            Compare 2
          </span>
        </div>
      </div>
    </PhoneFrame>
  );
}

export function TherapyCompareSheetMockups() {
  return (
    <MockupShell
      current="therapy-compare-sheet"
      letter="B"
      name="Build the set in one sheet"
      headline="One visit to choose, not one visit per slot."
      intro="Direction A still costs you a round trip per therapy. Here the picker is the screen: search once, filter by category, tick up to four, and commit the whole set with one button that names the count. The page underneath shrinks to a line of pills and the comparison itself."
    >
      <CurrentDefects />

      <MockupSection
        id="b-live"
        title="The screen, live"
        intro="Open the sheet, try the category chips, tick three, then press Compare 3. Nothing is committed until you do — closing the sheet leaves the previous set alone."
      >
        <div className="flex flex-wrap items-start gap-8">
          <SheetPhone />
          <SheetStatePhone />
        </div>
      </MockupSection>

      <MockupSection id="b-rules" title="The rules this direction commits to">
        <div className="grid gap-2 lg:grid-cols-3">
          <NoteCard
            tone="accent"
            title="Selection is a mode, not a widget"
            body="While the sheet is open it is the whole screen — no slot strip behind it, no page toolbar, no second search bar. That also settles the repo's one-composer rule: the sheet's search is the only composer on screen while it is up."
          />
          <NoteCard
            title="Four is enforced quietly"
            body="Tick the fifth and the untickable rows dim rather than a ceiling message firing. The commit button carries the count, so the limit is felt in the list rather than announced in the header."
          />
          <NoteCard
            title="Category finally has a way in"
            body="Every record is categorised into sixteen groups and today the phone offers search or nothing. A scrolling chip row over the six largest gets you to `Trauma` in one tap instead of remembering a name."
          />
          <NoteCard
            title="The page body is three lines"
            body="After committing you land on one wrapping row of pills, a Copy button and the comparison. No slot cards at all — the letters live on the pills, which is where they matter for reading the table."
          />
          <NoteCard
            title="Draft state means Cancel is safe"
            body="Ticks live in a draft until you commit, so backing out of the sheet cannot destroy the set you were comparing. Today every tap writes straight through to the URL."
          />
          <NoteCard
            tone="warn"
            title="One more tap when you want just one change"
            body="Swapping a single therapy means opening the sheet, unticking, ticking and committing. Direction A is better for that; this one is better for building a set from scratch."
          />
        </div>
      </MockupSection>

      <MockupSection id="b-cost" title="What it costs to build">
        <div className="grid gap-2 lg:grid-cols-3">
          <NoteCard
            title="Medium — a real picker rewrite"
            body="`CompareCatalogPicker` moves from assign-to-active-slot to multi-select with a draft array and a commit, and the phone shell becomes full-height rather than a sheet over the page. The slot strip disappears from the phone entirely."
          />
          <NoteCard
            title="Category filter is new data-side work"
            body="The chip row needs the category counts the catalogue already carries, plus a decision about which six of the sixteen groups surface before `All`."
          />
          <NoteCard
            tone="warn"
            title="Shared component, five consumers"
            body="Dictionary, DSM, formulation and specifiers all use this picker and not all of them have a category field. The multi-select shell would need to work with the filter row absent."
          />
        </div>
      </MockupSection>
    </MockupShell>
  );
}
