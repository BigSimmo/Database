"use client";

import { useMemo, useState } from "react";

import { cn } from "@/components/ui-primitives";

import {
  DesktopFrame,
  FrameSheet,
  PageHeader,
  PhoneComposer,
  PhoneFrame,
  SetRail,
  StatusBar,
  UniversalHeader,
  focusRing,
} from "./favourites-phone-shell";
import {
  ContinueCard,
  ContinueStrip,
  FavouritesList,
  RecentCard,
  ItemActionsSheetBody,
  NoMatchesState,
  NothingSavedState,
  PageActionsSheetBody,
  PartialLoadNotice,
  SetsSheetBody,
  SignedOutGate,
} from "./favourites-rows";
import {
  countsBySet,
  favouriteRows,
  kindIdentity,
  matchesQuery,
  pinnedFirst,
  setLabels,
  setOrder,
  type FavouriteRow,
  type FavouriteSetId,
} from "./fixtures";

/**
 * Design scratch: Favourites on a phone, one perfected direction.
 *
 * WHAT THIS ARGUES
 *
 * `/favourites` is the page a signed-in user opens to get back to something
 * they already decided they wanted. Measured on the dev server at 390x844:
 * the first row of the saved list begins at y=1141, about 300px BELOW the
 * fold, and each card is 228px tall. Above it sit an h1 and count, a hint
 * strip, an in-flow composer, a privacy notice, a results band, a Continue
 * card and a Recent card. None of the library itself is on the first screen.
 *
 * This design puts 165px of app chrome above the list and 72px rows under it.
 * Measured: the Continue strip plus six saved rows sit fully above the fold
 * and a seventh is partly visible; with Continue removed it is seven rows.
 * The strip costs exactly one row.
 *
 * The argument here is one sentence: for a surface whose entire content is
 * things you already chose, THE LIST IS THE PAGE, and a band earns its
 * vertical space only by beating a row of favourites for it.
 *
 * FIVE DECISIONS
 *
 *  1. One header, not six bands. Title, live count, one ellipsis sheet.
 *  2. Sets are the navigation, as a scrolling chip rail. The weighted segment
 *     track was tried and dropped - see `SetRail` for why.
 *  3. A row costs one line: 72px against the shipped card's measured 228px.
 *  4. Pinning finally gets a control. `pinnedAt` has been in the schema and
 *     the PATCH contract with no UI anywhere.
 *  5. The shared composer stays the only input. No search field in the header.
 *  6. Continue survives from the shipped page, at 72px instead of 113px, and
 *     the recency-sorted list makes a Recent card redundant. Frame 10 draws
 *     the opposite choice at the owner's request: both cards in full, with
 *     the library grouped by set so the three surfaces answer three different
 *     questions. Measured, that lands one saved row above the fold instead of
 *     six. The frames are the argument; the numbers are on each of them.
 *
 * WHAT IT REFUSES TO DRAW
 *
 * Saved medications, documents, quotes and searches, which the six existing
 * favourites mockups all draw. `favouriteContentTypeSchema` allows exactly
 * `service | form | differential | therapy`; the rest have no content type and
 * cannot be persisted. Nothing here is wired to the account API and all copy
 * is synthetic.
 */

type FrameState =
  | "library"
  | "set"
  | "filtering"
  | "no-matches"
  | "empty"
  | "item-sheet"
  | "sets-sheet"
  | "partial"
  | "signed-out"
  | "no-continue"
  | "type-chips"
  | "cards";

type SortMode = "recent" | "title" | "set";

const frames: ReadonlyArray<{
  id: FrameState;
  number: string;
  name: string;
  summary: string;
  cost: string;
  note?: string;
}> = [
  {
    id: "library",
    number: "01",
    name: "The library",
    summary:
      "32 saved items, four pinned. Continue plus six saved rows sit fully above the fold and a seventh is partly visible, where the shipped page shows none of the library at all. The rail, the header, Continue and the composer are the entire chrome budget.",
    cost: "A row carries no description, so two similarly named forms are told apart by their code and set rather than by a summary line.",
    note: "interactive",
  },
  {
    id: "set",
    number: "02",
    name: "One set selected",
    summary:
      "Ward round, 7 items. The rail is the filter; the header count follows it. Pinned items inside the set still lead.",
    cost: "Later sets sit off-screen until you scroll the rail. That is the price of keeping every set name legible.",
    note: "interactive",
  },
  {
    id: "filtering",
    number: "03",
    name: "Filtering as you type",
    summary:
      "Typing in the shared composer filters in place. The header becomes a matched-of-total pair and the rail counts re-weight to the match, so no chip promises rows the search has already excluded.",
    cost: "The composer is at the far end of the phone from the count it changes.",
  },
  {
    id: "no-matches",
    number: "04",
    name: "No matches",
    summary:
      "One empty state, rendered once, that says plainly this searched your saved items and not the whole library.",
    cost: "The offer to search everywhere is a sentence rather than a button, so it is read rather than tapped.",
  },
  {
    id: "empty",
    number: "05",
    name: "Nothing saved yet",
    summary:
      "First run names the four things that can actually be saved. Somebody with an empty library cannot infer them, and no other surface tells them.",
    cost: "It spends the whole first screen on explanation, which is only ever seen once.",
  },
  {
    id: "item-sheet",
    number: "06",
    name: "Item actions",
    summary:
      "Everything the card carried inline, plus the pin toggle the API has always supported and no screen has ever exposed. Four full-width 48px targets.",
    cost: "Removing a favourite is now two taps rather than one. On a destructive action that is a gain.",
    note: "interactive",
  },
  {
    id: "sets-sheet",
    number: "07",
    name: "Managing sets",
    summary:
      "Six controlled names with a database CHECK behind them, so this is a picker, not a text field. In-use and available are distinguished, and Unfiled is named rather than hidden.",
    cost: "It cannot express a workflow the six names do not cover; renaming needs a schema change.",
  },
  {
    id: "partial",
    number: "08",
    name: "Partial load",
    summary:
      "Some favourites failed to fetch. The header reports what actually loaded, the notice says how many did not, and Retry is present. No fabricated zero.",
    cost: "A warning band above the list is the one band that buys its space back, and only in this state.",
  },
  {
    id: "signed-out",
    number: "09",
    name: "Signed out",
    summary:
      "The boundary of the whole feature: `canAccessFavouritesMode` is demo mode or authenticated. Drawn once so the gate is designed rather than inherited.",
    cost: "Nothing here hints at what is behind the gate beyond naming the four kinds.",
  },
  {
    id: "cards",
    number: "10",
    name: "Continue and Recent restored",
    summary:
      "Both shipped cards rebuilt in full — Continue with its own action, Recent with View all, type pills and per-row Open. The library beneath then groups by set rather than by recency, so the three parts answer three different questions instead of repeating one.",
    cost: "Measured: Continue 152px, Recent 271px, and one saved row above the fold — against six with the compact strip. You land on the two cards and scroll to reach your library.",
    note: "interactive",
  },
  {
    id: "no-continue",
    number: "11",
    name: "Without Continue",
    summary:
      "The same library with the resume strip removed, for comparison. One more row fits. The question is whether resuming what you were doing is worth a row of what you saved.",
    cost: "Resuming costs a scan of the list instead of a tap, and after a set filter the item you were on may not be in view at all.",
  },
  {
    id: "type-chips",
    number: "12",
    name: "Type as a chip",
    summary:
      "The metadata line carries the shipped Recent card's pill instead of a coloured word. It scans faster down a column of mixed kinds, which is what the shipped card got right.",
    cost: "The pill costs about 14px of a line that also holds the qualifier and the timestamp, so a long service name truncates sooner.",
  },
];

/* ═══════════════════════  the screen  ═══════════════════════ */

function sortRows(rows: readonly FavouriteRow[], sort: SortMode) {
  const copy = [...rows];
  if (sort === "title") return copy.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === "set")
    return copy.sort((a, b) => setOrder.indexOf(a.setId) - setOrder.indexOf(b.setId) || a.recency - b.recency);
  return copy.sort((a, b) => a.recency - b.recency);
}

function FavouritesPhoneScreen({ state }: { state: FrameState }) {
  // Continue is suppressed only in the comparison frame and in the states
  // where there is nothing to resume.
  const showContinue = !["no-continue", "empty", "signed-out", "no-matches", "cards"].includes(state);
  // The shipped page's two cards, restored in full. The library beneath then
  // groups by set: a recency-sorted list under a Recent card would repeat its
  // three rows immediately.
  const cardsMode = state === "cards";
  const typeAs = state === "type-chips" || cardsMode ? "chip" : "word";
  const [activeSet, setActiveSet] = useState<FavouriteSetId>(state === "set" ? "ward-round" : "all");
  // Cards mode lands on the user's own filing, because a recency-sorted list
  // under a Recent card repeats it. "View all" switches to recency, which is
  // what makes that control do something.
  const [sort, setSort] = useState<SortMode>(state === "cards" ? "set" : "recent");
  const [sheet, setSheet] = useState<null | "item" | "sets" | "page">(
    state === "item-sheet" ? "item" : state === "sets-sheet" ? "sets" : null,
  );
  const [activeRow, setActiveRow] = useState<FavouriteRow>(favouriteRows[1]);

  const query = state === "filtering" ? "ward" : state === "no-matches" ? "clozapine clinic" : "";
  const signedOut = state === "signed-out";
  const empty = state === "empty";
  const partial = state === "partial";

  // A partial load is honest about what it holds: the rows it could not fetch
  // are absent from the list AND from the count, never counted as loaded.
  const loadedRows = useMemo(() => (partial ? favouriteRows.slice(0, 26) : favouriteRows), [partial]);

  const queryMatched = useMemo(() => loadedRows.filter((row) => matchesQuery(row, query)), [loadedRows, query]);
  // The item Continue is offering to resume.
  const resumeRow = useMemo(() => [...loadedRows].sort((a, b) => a.recency - b.recency)[0], [loadedRows]);

  // What the search and the set actually matched, counted BEFORE Continue is
  // lifted out of the list. Counting after it made an unfiltered library read
  // "31 of 32 saved" while the All chip still said 32 — two answers to one
  // question, which is a defect #164 removed from this page once already.
  const matchedCount = useMemo(
    () => (activeSet === "all" ? queryMatched : queryMatched.filter((row) => row.setId === activeSet)).length,
    [queryMatched, activeSet],
  );

  const recentRows = useMemo(
    () =>
      [...loadedRows]
        .sort((a, b) => a.recency - b.recency)
        .filter((row) => row.id !== resumeRow.id)
        .slice(0, 3),
    [loadedRows, resumeRow],
  );

  const visible = useMemo(() => {
    const inSet = activeSet === "all" ? queryMatched : queryMatched.filter((row) => row.setId === activeSet);
    // Drawn once. The shipped page shows the resumed item in Continue AND
    // again in Recent AND again in the table; on a phone that is the same
    // 72px row spent twice on the same thing, and it reads as a bug.
    const withoutResume = showContinue ? inSet.filter((row) => row.id !== resumeRow.id) : inSet;
    return sort === "recent" ? pinnedFirst(withoutResume) : sortRows(withoutResume, sort);
  }, [queryMatched, activeSet, sort, showContinue, resumeRow]);

  // Rail counts reflect the search, so a chip never promises rows the query
  // has already excluded.
  const counts = useMemo(() => countsBySet(queryMatched), [queryMatched]);

  const rails = setOrder
    .filter((id) => id === "all" || counts[id] > 0 || (!query && id === activeSet))
    .map((id) => ({ id, label: setLabels[id], count: counts[id] }));

  return (
    <>
      <StatusBar />
      <UniversalHeader />

      {signedOut || empty ? (
        <>
          <PageHeader
            matched={0}
            total={0}
            statusNote={signedOut ? "Sign in to see your saved items" : "Nothing saved yet"}
            onOpenActions={() => setSheet("page")}
          />
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[color:var(--surface)]">
            {signedOut ? <SignedOutGate /> : <NothingSavedState />}
          </div>
        </>
      ) : (
        <>
          <PageHeader matched={matchedCount} total={loadedRows.length} onOpenActions={() => setSheet("page")} />
          <SetRail sets={rails} activeId={activeSet} onSelect={(id) => setActiveSet(id as FavouriteSetId)} />
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[color:var(--surface)]">
            {partial ? <PartialLoadNotice failed={5} /> : null}
            {showContinue && visible.length > 0 ? (
              <ContinueStrip
                row={resumeRow}
                onOpen={(row) => {
                  setActiveRow(row);
                  setSheet("item");
                }}
              />
            ) : null}
            {cardsMode ? (
              <div className="space-y-2.5 border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
                <ContinueCard
                  row={resumeRow}
                  onOpen={(row) => {
                    setActiveRow(row);
                    setSheet("item");
                  }}
                />
                <RecentCard
                  rows={recentRows}
                  onOpen={(row) => {
                    setActiveRow(row);
                    setSheet("item");
                  }}
                  onViewAll={() => setSort("recent")}
                />
              </div>
            ) : null}
            {visible.length === 0 ? (
              <NoMatchesState query={query} total={loadedRows.length} />
            ) : (
              <FavouritesList
                rows={visible}
                showPinnedGroup={sort === "recent" && !cardsMode}
                groupBySet={cardsMode && sort !== "recent"}
                typeAs={typeAs}
                onOpen={(row) => {
                  setActiveRow(row);
                  setSheet("item");
                }}
                onOpenActions={(row) => {
                  setActiveRow(row);
                  setSheet("item");
                }}
              />
            )}
          </div>
        </>
      )}

      <PhoneComposer query={query} />

      {sheet === "item" ? (
        <FrameSheet
          title={activeRow.title}
          description={kindIdentity[activeRow.kind].label}
          onClose={() => setSheet(null)}
        >
          <ItemActionsSheetBody row={activeRow} onClose={() => setSheet(null)} />
        </FrameSheet>
      ) : null}

      {sheet === "sets" ? (
        <FrameSheet title="Sets" description="Six approved clinical workflows" onClose={() => setSheet(null)}>
          <SetsSheetBody counts={countsBySet(loadedRows)} onClose={() => setSheet(null)} />
        </FrameSheet>
      ) : null}

      {sheet === "page" ? (
        <FrameSheet title="Favourites" description={`${loadedRows.length} saved`} onClose={() => setSheet(null)}>
          <PageActionsSheetBody
            sort={sort}
            onSelectSort={(value) => {
              setSort(value);
              setSheet(null);
            }}
            onOpenSets={() => setSheet("sets")}
          />
        </FrameSheet>
      ) : null}
    </>
  );
}

/* ═══════════════════════  desktop reference  ═══════════════════════ */

/**
 * One frame, not a second study. The phone design opens out rather than
 * changing: the rail unrolls into a left list, the metadata line spreads into
 * columns, and the width that a phone does not have becomes the detail panel
 * `/favourites` already earns at `xl:`.
 */
function DesktopReference() {
  const counts = countsBySet(favouriteRows);
  const rows = pinnedFirst(favouriteRows).slice(0, 9);
  const selected = rows[0];
  const identity = kindIdentity[selected.kind];

  return (
    <div
      className="grid bg-[color:var(--surface)]"
      // Pinned inline for the same reason `PhoneFrame` pins its geometry: an
      // arbitrary `grid-cols-[...]` is not emitted for this route and the three
      // columns silently collapse into one stacked list. `mockups/README.md`
      // records the identical failure against a bare `grid-cols-6`.
      style={{ gridTemplateColumns: "13rem minmax(0,1fr) 18rem" }}
    >
      <aside className="border-r border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
        <p className="px-2 pb-2 text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--text-soft)]">
          Sets
        </p>
        <ul className="space-y-0.5">
          {setOrder.map((id) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => undefined}
                className={cn(
                  "flex w-full min-h-12 items-center justify-between gap-2 rounded-lg px-2.5 text-left text-sm-minus font-bold",
                  focusRing,
                  id === "all"
                    ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                    : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface)]",
                )}
              >
                <span className="truncate">{setLabels[id]}</span>
                <span className="shrink-0 tabular-nums text-2xs text-[color:var(--text-soft)]">{counts[id]}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="min-w-0">
        <div className="flex items-baseline gap-2 border-b border-[color:var(--border)] px-4 py-3">
          <h3 className="text-lg-minus font-extrabold tracking-display text-[color:var(--text-heading)]">Favourites</h3>
          <span className="text-2xs font-semibold text-[color:var(--text-muted)]">{favouriteRows.length} saved</span>
        </div>
        <ul>
          {rows.map((row) => {
            const rowIdentity = kindIdentity[row.kind];
            const Glyph = rowIdentity.icon;
            const isSelected = row.id === selected.id;
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => undefined}
                  style={{ gridTemplateColumns: "minmax(0,1fr) 7rem 6rem" }}
                  className={cn(
                    "grid w-full min-h-12 items-center gap-3 border-b border-[color:var(--border)] px-4 py-2.5 text-left",
                    focusRing,
                    isSelected ? "bg-[color:var(--clinical-accent-soft)]" : "hover:bg-[color:var(--surface-subtle)]",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      aria-hidden
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border"
                      style={{
                        background: rowIdentity.soft,
                        borderColor: rowIdentity.border,
                        color: rowIdentity.ink,
                      }}
                    >
                      <Glyph className="size-icon-sm" />
                    </span>
                    <span className="truncate text-sm-minus font-bold text-[color:var(--text-heading)]">
                      {row.title}
                    </span>
                  </span>
                  <span className="truncate text-2xs font-semibold text-[color:var(--text-muted)]">
                    {setLabels[row.setId]}
                  </span>
                  <span className="truncate text-2xs font-semibold text-[color:var(--text-soft)]">
                    {row.lastOpened}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <aside className="border-l border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4">
        <p className="text-3xs font-extrabold uppercase tracking-kicker" style={{ color: identity.ink }}>
          {identity.label}
        </p>
        <h4 className="mt-1.5 text-base-minus font-extrabold leading-5 text-[color:var(--text-heading)]">
          {selected.title}
        </h4>
        <p className="mt-1 text-2xs font-semibold text-[color:var(--text-muted)]">
          {selected.detail} · {setLabels[selected.setId]}
        </p>
        <div className="mt-4 space-y-1.5">
          {["Open", "Move to a set", "Unpin", "Copy link"].map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => undefined}
              className={cn(
                "flex w-full min-h-12 items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm-minus font-bold text-[color:var(--text-heading)] hover:border-[color:var(--border-strong)]",
                focusRing,
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}

/* ═══════════════════════  the page  ═══════════════════════ */

const decisions: ReadonlyArray<{ n: string; head: string; body: string }> = [
  {
    n: "1",
    head: "One header, not six bands",
    body: "Title, live count, one ellipsis sheet. Sort, set management and clear-all move behind it. Everything above the list — app header, page header and set rail — measures 165px.",
  },
  {
    n: "2",
    head: "Sets become the navigation",
    body: "A scrolling chip rail carrying every set name and its count. A weighted segment track was tried first and dropped: eight sets across 390px leaves each about 48px, under the width a set name needs.",
  },
  {
    n: "3",
    head: "A row costs one line",
    body: "Glyph, title, one metadata line, one trailing control. 72px against the shipped card's measured 228px, and both targets clear 44px.",
  },
  {
    n: "4",
    head: "Pinning finally gets a control",
    body: "`pinnedAt` has been in the schema and the PATCH contract since August with no UI anywhere. Pinned rows lead every view under one label that disappears when nothing is pinned.",
  },
  {
    n: "5",
    head: "The composer stays the only input",
    body: "Typing filters in place; the count becomes a matched-of-total pair and the rail counts re-weight. No header search field. The six existing favourites mockups each draw a second search bar, which the one-composer contract forbids.",
  },
  {
    n: "6",
    head: "Continue stays; Recent does not",
    body: "The shipped Continue card measures 113px because the title, the metadata and a full-width button are three stacked things. Here the strip is the button, so it costs 72px — one row. The Recent card measures 277px to show three items the recency-sorted list already has as its first three rows.",
  },
];

export function FavouritesPhonePerfectedMockupsPage() {
  return (
    <main
      data-testid="favourites-phone-perfected-mockups"
      className="min-h-full bg-[color:var(--background)] text-[color:var(--text)]"
    >
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-mockup-wide px-4 py-7 sm:px-6 lg:px-8">
          <p className="text-xs font-extrabold uppercase tracking-kicker text-[color:var(--clinical-accent)]">
            Favourites · signed in · phone
          </p>
          <h1 className="mt-2 max-w-4xl text-balance text-3xl font-extrabold tracking-display text-[color:var(--text-heading)] sm:text-4xl">
            The list is the page
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            Favourites is where you go to get back to something you already chose. Measured at 390 × 844, the shipped
            page puts the first row of your saved list at <strong>y = 1141</strong> — about 300px below the fold —
            behind a hint strip, a composer, a privacy notice, a results band, a Continue card and a Recent card, and
            then spends <strong>228px</strong> on each item. Nothing of the library is on the first screen. This
            direction spends <strong>165px</strong> of chrome and <strong>72px</strong> a row, which puts Continue plus
            six saved rows above the fold, and it is drawn across every state that actually occurs.
          </p>

          <ol className="mt-6 grid max-w-5xl gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {decisions.map((decision) => (
              <li key={decision.n} className="min-w-0">
                <p className="text-2xs font-extrabold uppercase tracking-kicker text-[color:var(--text-soft)]">
                  {decision.n}
                </p>
                <p className="mt-0.5 text-sm-minus font-extrabold text-[color:var(--text-heading)]">{decision.head}</p>
                <p className="mt-1 text-xs font-medium leading-5 text-[color:var(--text-muted)]">{decision.body}</p>
              </li>
            ))}
          </ol>

          <p className="mt-5 max-w-3xl text-xs font-medium leading-5 text-[color:var(--text-soft)]">
            <span className="font-extrabold">How the numbers were taken — </span>
            Chromium at a 390 × 844 viewport against the local dev server, reading
            <code className="font-mono"> getBoundingClientRect()</code> on the live{" "}
            <code className="font-mono">/favourites</code> route and on these frames. The 1141px figure includes a
            demo-mode hint strip a signed-in user does not see, worth roughly 40px; it is below the fold either way.
          </p>

          <p className="mt-6 max-w-3xl rounded-lg border border-[color:var(--info-border)] bg-[color:var(--info-bg)] px-3.5 py-2.5 text-xs font-medium leading-5 text-[color:var(--text-muted)]">
            <span className="font-extrabold text-[color:var(--info-text)]">Only four things can be saved.</span>{" "}
            <code className="font-mono">favouriteContentTypeSchema</code> allows{" "}
            <span className="font-bold text-[color:var(--text-heading)]">service, form, differential, therapy</span>.
            The six existing favourites mockups draw saved medications, documents, quotes and searches; none of those
            has a content type, so none can be persisted. Nothing here is wired to the account API and every row is
            synthetic — not clinical content.
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-mockup-wide gap-x-8 gap-y-10 px-4 py-9 sm:px-6 md:grid-cols-2 lg:px-8 xl:grid-cols-3">
        {frames.map((frame) => (
          <article key={frame.id} className="min-w-0">
            <div className="flex items-baseline gap-2">
              <p className="text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--text-soft)]">
                {frame.number}
              </p>
              <h2 className="text-lg font-extrabold text-[color:var(--text-heading)]">{frame.name}</h2>
            </div>
            <p className="mt-1.5 text-sm font-medium leading-5 text-[color:var(--text-muted)]">{frame.summary}</p>
            <p className="mt-1.5 text-xs font-medium leading-5 text-[color:var(--text-soft)]">
              <span className="font-extrabold">Cost — </span>
              {frame.cost}
            </p>
            <div className="mt-4">
              <PhoneFrame label={`390 × 844 · ${frame.number}`} note={frame.note ?? "static"}>
                <FavouritesPhoneScreen state={frame.id} />
              </PhoneFrame>
            </div>
          </article>
        ))}
      </div>

      <div className="border-t border-[color:var(--border)] bg-[color:var(--surface-subtle)]">
        <div className="mx-auto max-w-mockup-wide px-4 py-9 sm:px-6 lg:px-8">
          <div className="flex items-baseline gap-2">
            <p className="text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--text-soft)]">D</p>
            <h2 className="text-lg font-extrabold text-[color:var(--text-heading)]">Desktop reference</h2>
          </div>
          <p className="mt-1.5 max-w-3xl text-sm font-medium leading-5 text-[color:var(--text-muted)]">
            One frame, not a second study. The design opens out rather than changing shape: the rail unrolls into a left
            list, the metadata line spreads into columns, and the width a phone does not have becomes the detail panel{" "}
            <code className="font-mono">/favourites</code> already earns at <code className="font-mono">xl:</code>.
          </p>
          <div className="mt-4">
            <DesktopFrame label="1280 wide · D" note="static">
              <DesktopReference />
            </DesktopFrame>
          </div>
        </div>
      </div>
    </main>
  );
}
