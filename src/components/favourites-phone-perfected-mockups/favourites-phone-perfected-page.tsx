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
 * Design scratch: Favourites on a phone, the chosen arrangement.
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
 * THE ARRANGEMENT
 *
 * The owner chose to keep both derived cards rather than the compressed
 * resume strip, so this is drawn as the design and the strip is kept as
 * frame 10, the record of the choice. What makes the cards affordable is a
 * single rule:
 *
 *   Continue and Recent are the LANDING surface, and nothing else. Tap a set
 *   or type in the composer and they give the screen back to the list.
 *
 * Narrowing means you are hunting for something specific, and a resume
 * affordance is not what you asked for. So the cards cost the fold only on
 * the screen where arriving, not searching, is what you are doing: one saved
 * row on the landing view, seven the moment you narrow. A degraded load also
 * falls back to the 72px strip, because the notice plus two full cards left
 * zero rows visible on the one screen that most needs to show what survived.
 *
 * The library groups by the user's own sets rather than by recency, because a
 * recency-sorted list under a Recent card is a second copy of that card. So
 * the three surfaces answer three different questions: what was I mid-way
 * through, what did I just touch, and what have I filed.
 *
 * THE REST OF IT
 *
 *  - One header, not six bands: title, live count, one ellipsis sheet.
 *  - Sets are the navigation, as a scrolling chip rail. The weighted segment
 *    track was tried and dropped - see `SetRail` for why.
 *  - A row costs one line: 72px against the shipped card's measured 228px.
 *  - Pinning finally gets a control. `pinnedAt` has been in the schema and
 *    the PATCH contract with no UI anywhere.
 *  - The shared composer stays the only input. No search field in the header.
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
  | "compact-strip"
  | "type-word";

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
    name: "Landing",
    summary:
      "Continue and Recent as the shipped page draws them, then the library grouped by your own sets. The three answer three different questions: what was I mid-way through, what did I just touch, and what have I filed.",
    cost: "Measured: Continue 152px, Recent 271px, one saved row above the fold. That is the price of arriving on the two cards, and frame 10 draws the alternative.",
    note: "interactive",
  },
  {
    id: "set",
    number: "02",
    name: "One set selected",
    summary:
      "Tap a set and the cards hand the screen back. Narrowing means you are hunting for something specific, and a resume affordance is not what you asked for — so seven rows of Ward round fill the space the cards had.",
    cost: "Continue is two taps away again once you have narrowed: clear the set, then tap it.",
    note: "interactive",
  },
  {
    id: "filtering",
    number: "03",
    name: "Filtering as you type",
    summary:
      "Typing in the shared composer does the same thing a set chip does — the cards give way and matches fill the screen. The header becomes a matched-of-total pair and the rail counts re-weight, so no chip promises rows the search has excluded.",
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
      "First run names the four things that can actually be saved. Somebody with an empty library cannot infer them, and no other surface tells them. No cards, because there is nothing to resume.",
    cost: "It spends the whole first screen on explanation, which is only ever seen once.",
  },
  {
    id: "item-sheet",
    number: "06",
    name: "Item actions",
    summary:
      "Everything the shipped card carried inline, plus the pin toggle the API has always supported and no screen has ever exposed. Four full-width 48px targets.",
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
    cost: "Resume degrades to the 72px strip here — with the notice and the two full cards, zero saved rows fitted above the fold, which is the wrong screen to show nothing on.",
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
    id: "compact-strip",
    number: "10",
    name: "Alternative — compact resume strip",
    summary:
      "The rejected alternative, kept as the record of a real choice. Continue compressed to a 72px strip where the strip is the button, no Recent card, and the library sorted by recency beneath it.",
    cost: "Six saved rows above the fold instead of one — but resuming and re-opening this morning's work both become a scan rather than a tap.",
    note: "interactive",
  },
  {
    id: "type-word",
    number: "11",
    name: "Alternative — type as a word",
    summary:
      "The chosen rows carry the shipped Recent card's type pill. This draws the alternative: the type as a coloured word on the metadata line, which buys back about 14px of a line that also holds the qualifier and the timestamp.",
    cost: "Down a column of mixed kinds the word is markedly harder to scan than the pill, which is what the shipped Recent card got right.",
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
  // The two alternatives the study keeps for comparison. Everything else is
  // the chosen arrangement.
  const compactAlternative = state === "compact-strip";
  const typeAs = state === "type-word" ? "word" : "chip";

  const [activeSet, setActiveSet] = useState<FavouriteSetId>(state === "set" ? "ward-round" : "all");
  // The landing view is the user's own filing. A recency-sorted list under a
  // Recent card repeats that card's three rows, so keeping the card means the
  // library below it has to be something else. "View all" switches to
  // recency, which is what makes that control do something.
  const [sort, setSort] = useState<SortMode>(compactAlternative ? "recent" : "set");
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

  /**
   * THE RULE THAT PAYS FOR THE CARDS.
   *
   * Continue and Recent are the landing surface for the whole library, and
   * nothing else. The moment you narrow — tap a set, or type in the composer —
   * they give the screen back to the list, because at that point you are
   * hunting for something specific and a resume affordance is not what you
   * asked for. So the cards cost the fold only on the screen where arriving,
   * not searching, is what you are doing.
   */
  const narrowed = activeSet !== "all" || query.trim() !== "";
  const hasLibrary = !empty && !signedOut && loadedRows.length > 0;
  // A degraded load falls back to the cheap resume form. Measured, the failure
  // notice plus the two full cards left ZERO saved rows above the fold: the
  // one state where the user most needs to see what survived is the one where
  // the cards leave no room for it. The 72px strip keeps resume reachable and
  // gives the rows back.
  const showCards = hasLibrary && !narrowed && !compactAlternative && !partial;
  const showStrip = hasLibrary && !narrowed && (compactAlternative || partial);

  const visible = useMemo(() => {
    const inSet = activeSet === "all" ? queryMatched : queryMatched.filter((row) => row.setId === activeSet);
    // Drawn once. The shipped page shows the resumed item in Continue AND
    // again in Recent AND again in the table; on a phone that is the same
    // 72px row spent twice on the same thing, and it reads as a bug.
    const liftedOut = showCards || showStrip;
    const withoutResume = liftedOut ? inSet.filter((row) => row.id !== resumeRow.id) : inSet;
    return sort === "recent" ? pinnedFirst(withoutResume) : sortRows(withoutResume, sort);
  }, [queryMatched, activeSet, sort, showCards, showStrip, resumeRow]);

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
            {showStrip ? (
              <ContinueStrip
                row={resumeRow}
                onOpen={(row) => {
                  setActiveRow(row);
                  setSheet("item");
                }}
              />
            ) : null}
            {showCards ? (
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
                showPinnedGroup={sort === "recent"}
                groupBySet={!narrowed && sort === "set"}
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
    head: "Continue and Recent are the landing surface",
    body: "Both shipped cards, drawn in full. They show on arrival and nowhere else: tap a set or type in the composer and they hand the screen back to the list. That rule is what pays for them — one saved row above the fold on arrival, seven the moment you narrow.",
  },
  {
    n: "2",
    head: "The library groups by your sets",
    body: "Not by recency. A recency-sorted list under a Recent card is a second copy of that card, so keeping the card means the library below it has to be your own filing. View all switches to recency when that is what you want.",
  },
  {
    n: "3",
    head: "One header, not six bands",
    body: "Title, live count, one ellipsis sheet. Sort, set management and clear-all move behind it. Everything above the list — app header, page header and set rail — measures 165px.",
  },
  {
    n: "4",
    head: "A row costs one line",
    body: "Type pill, title, one metadata line, one trailing control. 72px against the shipped card's measured 228px, and both targets clear 44px.",
  },
  {
    n: "5",
    head: "Pinning finally gets a control",
    body: "`pinnedAt` has been in the schema and the PATCH contract since August with no UI anywhere. Pinned rows lead every view under one label that disappears when nothing is pinned.",
  },
  {
    n: "6",
    head: "The composer stays the only input",
    body: "Typing filters in place; the count becomes a matched-of-total pair and the rail counts re-weight. No header search field. The six existing favourites mockups each draw a second search bar, which the one-composer contract forbids.",
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
            page puts the first row of your saved list at <strong>y = 1141</strong> — about 300px below the fold — and
            then spends <strong>228px</strong> on each item. Nothing of the library is on the first screen. This keeps
            the Continue and Recent cards, and pays for them with one rule: they are the landing surface only. Tap a set
            or type in the composer and they hand the screen back to the list —<strong>one</strong> saved row above the
            fold on arrival, <strong>seven</strong> the moment you narrow.
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
