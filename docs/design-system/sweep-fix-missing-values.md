# Missing values — call-site sweep (29 Aug 2026)

SPEC §11 gives four phrases for a missing value — `Not recorded`, `Not applicable`, `Unknown`,
`Unable to extract` — and names `MissingValue` (COMPONENTS §3) as their owner. GATES.md §3 records
the call-site half of that rule as `implemented-partial … broader legacy call-site convergence
remains manual`, i.e. unenforced. This is the manual pass, and its deliberate shape is **four
call sites changed and nineteen left alone with a reason**, not a clean sweep.

The governing judgement, from the primitive's own header comment: a dash at least admits it is
saying nothing. A **wrong** phrase asserts something false about a patient, so a phrase is only
adopted where the surrounding code _proves_ which one is true.

## The true count

The brief estimated "roughly sixteen". The real number is higher, and it splits into two classes.

| Class                                             | Sites  | Disposition                    |
| ------------------------------------------------- | ------ | ------------------------------ |
| Bare em-dash rendered as a value                  | **23** | 4 changed, 19 left with reason |
| `"n/a"` rendered as a missing PDF page number     | **12** | 0 changed — see §4             |
| `"n/a"` in cache keys / model prompts (not shown) | 9      | out of scope — never rendered  |

Counted over `src/**` with `src/app/mockups/**` and `*-mockups.tsx` excluded, discarding matches
where `"-"` is a slug separator, a keyboard key, or a parser token. Nothing was changed under
`src/components/document-viewer/**` — another agent owns those files this session.

## 1 · Changed — the phrase is provable from the code

### `src/components/ward-management/discharges/discharge-board.tsx:197` → `Not applicable`

`release.blocker ?? "—"`. `ward-model.ts` types the field
`blocker: BedReleaseBlocker | null` and documents it **"Non-null only while `state` is
`blocked`"**; the reducer writes `blocker: null` on every predicted, confirmed and released path
and refuses a `BLOCK_BED_RELEASE` without one. A null therefore means _this release is not in a
state where a blocker can exist_ — not _somebody forgot to write the blocker down_. Those are
different things and the dash rendered them identically, which is the defect the brief describes.

Rendered check (see §5): the Blocked rows show real blockers, and every Confirmed / Predicted /
Released row now reads `Not applicable`.

### `src/components/clinical-dashboard/favourites-hub.tsx:215` and `:221` → `Unknown`

`libraryCountsTrusted ? String(itemCount) : "—"`. Untrusted means the saved registry is still
`loading` or has `error`ed. The count exists and we cannot read it — that is _unknown_, not _not
recorded_ (nothing was omitted) and not _not applicable_ (it plainly applies). A dash inside a
numeric tile reads as **zero**, i.e. "your library is empty", which is the one claim that must not
be made.

The tile already carried an `aria-label` ("Items unavailable until favourites finish loading"), so
before this change the screen-reader text and the visible text disagreed: one said "unavailable",
the other said nothing at all. They now agree, with the label carrying the extra _reason_. The
label wording is unchanged — it is pinned by a committed test's locator.

### `src/components/specifiers/specifier-reference-page.tsx:255` → `Not applicable` (derived)

`item.definition?.sourceFamily ?? item.review.sourceFamily ?? "—"`, in the "Review status" list.
`review.sourceFamily` is optional, so the fallback is reachable. Measured against the shipped
catalogue: **20 of 585 items reach it, and all 20 carry `sourceVerificationStatus:
"source-not-applicable"`** — they are the "Unspecified" and "Other type" specifiers, which have no
source family to name. The phrase is therefore driven off that status rather than hardcoded, so an
item that ever lacks a family for a different reason reads as `Not recorded`, which it would be.

## 2 · Left alone — no one of the four phrases is true

**The calculator score slots** — `calculator-sheet.tsx:151`, `clinical-console.tsx:204`,
`directory-grid.tsx:57`, `search-detail.tsx:544` and `:646`. Each renders
`derived.started ? derived.score : "—"` immediately followed by `/ {calc.maxScore}`, so the phrase
would land inside a fraction: "Not recorded / 27". The value is not missing, it is **not yet
computed** — nothing has been answered. Every one of these already states that honestly in the
adjacent `SeverityPill`, whose label is literally **"Not started"**. Adopting `Unknown` here would
be less honest than the dash: it implies a score exists somewhere we cannot see.

**`calculator-ui.tsx:141`** — `label: band?.label ?? "—"`. The band is **deliberately withheld**,
not missing: the file's own comment explains that a half-ticked checkbox-only screen "must never
read negative", so `showBand` suppresses it. A suppressed value and an absent one are different,
and none of the four phrases says "withheld pending completion". SPEC §11 explicitly excludes a
"Withheld" phrase, so following the spec here would force a false one.

**`ward-management-console.tsx:223`** — `verdict ? candidateReason(verdict) : "—"` under an
"Eligibility" heading. `verdict` is undefined only when no destination is selected, and the heading
directly above already says **"No destination selected"**. `Not applicable` would assert that this
patient's eligibility does not apply, which is false; the truth is that it is not computable until
the coordinator picks a destination. Same class as the calculators.

**`answer-source-rows.ts:133`** — `source.cited === false ? "—" : sourceBadgeLabel(index)`. This is
not a missing value at all: it is the deliberate absence of a citation badge number for an
uncited source. A phrase would read as though the badge were missing.

## 3 · Left alone — cannot take a component, and the phrase is uncertain

**`compare-screen.tsx:57, 63, 65, 66, 67, 196` and `brief-screen.tsx:219, 220`.** These sit in a
`get: (t: Therapy) => string` accessor. Line 103 computes the "Differences" tab as
`new Set(items.map((t) => r.get(t))).size > 1`, and line 113 builds the clipboard export from the
same strings. Returning a React element would make every row compare unequal (distinct objects),
so **the Differences tab would report every field as differing** and the export would emit
`[object Object]`. This is the "string context that cannot take a component" exemption.

Swapping the literal for `"Not recorded"` _would_ be possible and would satisfy §11's wording rule
without the component — I did not do it because it is a copy change to a clinical comparison table
that deserves its own review, and because the same accessors chain two fields
(`t.bestUsedFor || t.targetSymptoms`), so "not recorded" would be asserting an omission across two
fields at once. **Recommend as a follow-up, not a silent fix.**

## 4 · Left for a human decision

**`src/components/therapy-compass/ui.tsx:188` — the completeness `Meter`.** `value == null ? "—"`,
and `sourceCompleteness` / `indexCompleteness` / `reviewCompleteness` are `null` for **all 205
records in `src/data/therapies-index.json`**, while `src/data/therapies-source.json` carries real
values (100, …) for all 205. `use-therapy-data.ts` fetches either an `index` or a `full`
catalogue. So the three meters on `other-screen.tsx` very likely always render a dash, and the
dash may be signalling _the wrong catalogue was loaded_ rather than a missing value.

_What I would need to settle it:_ whether `other-screen` is meant to load the `full` catalogue. If
yes, this is a data-plumbing bug and no phrase is correct. If the light index is intended, the
phrase is `Unknown` (the metric exists, this catalogue does not carry it) — never `Not recorded`.
I did not guess.

**`guided-flow.tsx:282` — the answer-review list.** `item.options?.[value ?? -1]?.label ?? "—"` for
an item the user skipped. `Not recorded` is defensible, but the row renders at `text-2xs`, below
`MissingValue`'s smallest `cell` density (`text-xs`), so adopting the primitive here would make
every *un*answered item visually **larger** than the answered ones — the opposite of the rule that
a missing value must not gain prominence. Needs either a smaller density on the primitive or an
owner decision to leave it.

**The twelve `"n/a"` page-number sites** (`answer-evidence-preview.tsx:90`,
`answer-source-drawer.tsx:163`, `answer-source-rail.tsx:206`, `document-admin.tsx:512`,
`evidence-panels.tsx:1417`, `visual-evidence.tsx:190` and `:709`, plus five in
`document-viewer/source-panels.tsx` owned by another agent this session). All render as
`p. {pageNumber ?? "n/a"}` — a compact citation where none of the four phrases fits
("page Not recorded"). SPEC §11 lists the phrases but gives no compact form for a citation, which
is a genuine gap in the spec rather than in these call sites.

## 5 · Verification

**Tests** — run set discovered from disk by grepping `tests/` for the component names, the
primitive, and the changed copy, not chosen by hand:

```
Test Files  27 passed (27)
     Tests  588 passed (588)
```

`tests/design-system-adoption.test.ts` failed first, correctly: the generated adoption manifest did
not list the three new `MissingValue` importers. Regenerated with
`npm run design-system:adoption:update` (never hand-edited) and re-run green.

**One committed test was updated**, `tests/favourites-hub-unavailable-controls.dom.test.tsx`, which
pinned `toHaveTextContent("—")`. Its two cases are named _"does not assert library zeroes while the
saved registry is still loading"_ and _"…after the saved registry fails"_, so the dash was the
incidental implementation, not the contract; the named subject is unchanged and better served by
`Unknown`. This is not the spec losing to a higher source — it is the same intent, stated in words.

**Lint / types / contract:**

```
npx eslint <4 changed files> --max-warnings 0     → exit 0, no output
npx tsc --noEmit -p tsconfig.json                 → exit 0
node scripts/check-design-system-contract.mjs     → "Design-system contract passed (1079 production files; …)"
```

**Rendered result**, read from the live DOM on the dev server at `localhost:3350`:

`/mockups/ward-flow/discharges` —

```
[Blocked]        Blocker="Awaiting accommodation"
[Blocked]        Blocker="Awaiting receiving-service acceptance"
[Confirmed]      Blocker="Not applicable"
[Predicted]      Blocker="Not applicable"
[Released today] Blocker="Not applicable"
bare dashes left in table cells: 0
MissingValue span: fontSize=12px color=rgb(85, 98, 122)   (smaller and quieter than its neighbours)
```

`/specifiers/specifier-psy-delusional-disorder-type-unspecified-type` —

```
Source           = "Source not applicable"
Clinician review = "Pending qualified review"
Source family    = "Not applicable"
Content hash     = "fc967471"
MissingValue span: fontSize=12px, identical to the sibling values' 12px — no added prominence
```

The one em-dash still on that page is ordinary prose punctuation, not a value.

### What I could not verify in the browser, and why

**The favourites-hub tiles were not proved in a real browser.** Two obstacles, both real:

1. Its untrusted state requires the saved registry to be loading or failing, which I cannot induce
   from the page.
2. More importantly, `FavouritesHub` did not render on any route the dev server served.
   `/favourites` is `FavouritesCommandLibraryPage` (a different component that shares the
   `favourites-hub` test id), and `/?mode=favourites&q=…&run=1` **redirected to `/favourites`** —
   confirmed in `dev-server.log`. The plain mode home rendered `shared-home-empty-state`. So
   `FavouritesHub` may no longer be reachable in production. **Stated as an observation, not a
   conclusion** — I did not trace the redirect logic, and it deserves checking separately.

The evidence I do have for that site is the jsdom render assertion (both untrusted branches now
render the text `Unknown` under the existing accessible names), which is a real DOM render but not
a browser one.

The dev server on port 3350 went down partway through this session. I neither stopped nor
restarted it, and did not restart it afterwards because the brief forbade that.

## 6 · Where the spec is the defect

Two gaps, both where following SPEC §11 would have made the display _less_ honest:

1. **No phrase for "not yet computed".** Six call sites (five calculator scores, one eligibility
   verdict) are awaiting user input, not missing data. The UI already says `Not started` /
   `No destination selected` beside them, which is a fifth phrase the product uses and the spec
   does not list.
2. **No phrase for "deliberately withheld".** `calculator-ui.tsx:141` suppresses a severity band
   on purpose so a half-completed screen cannot read "negative". §11 explicitly excludes
   "Withheld" on the grounds that there is no redaction pipeline — but this is suppression for
   clinical safety, not redaction, and it exists today.

Neither is a reason to weaken the rule. Both are reasons the manual half of Gate 3 needs an owner
decision before it can become an automated gate, because a mechanical "no bare dashes" check would
fail on eight sites where the dash is currently the most honest thing on screen.
