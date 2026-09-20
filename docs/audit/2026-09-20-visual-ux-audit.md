# Visual, UX and defect audit — master report

**Date:** 2026-09-20
**App:** PsychSift · guest · **demo/offline** (synthetic corpus, no OpenAI, no live Supabase)
**Commit read:** `eec96f5602d6fef6095abd621d7d22042c661e5b` (== `origin/main` at the time of the run)
**Branch:** `claude/psychsift-audit-prompt-qzazsv`
**Base URL:** `http://localhost:4400` — a **production build** (`next start`) from the sanctioned
isolated offline output (`.next-playwright/audit/dist`, `PLAYWRIGHT_OFFLINE_MODE=true`), not `next dev`
**Method:** six read-only specialist agents plus a coordinator, driving Chromium directly
**Scope:** the 78 real routes across the 17 app modes, plus `/privacy`, `/safety-plan`,
`/reference/colour-coding`
**Out of scope, not audited:** all `/mockups/**`, all `/caring-contacts/**`, Ward Flow, RAG answer
quality and ranking behaviour, the ingestion worker, physical Safari and the installed PWA,
signed-in-only deep paths

## Evidence

| Artifact                                | Location                                                                   |
| --------------------------------------- | -------------------------------------------------------------------------- |
| Screenshots (509 + agent-driven extras) | session scratchpad, `visual-audit/<width>-<theme>/<slug>.png`              |
| Per-route signal JSON                   | same folders, `<slug>.json`; per-folder `_summary.json`                    |
| Agent scripts and their captures        | `visual-audit/agent-c/`, `visual-audit/f-detail/`, `visual-audit/f-empty/` |

Screenshots live in an ephemeral session scratchpad and are **not** committed. Every finding below
quotes the decisive number or string, so the report stands without them.

### Viewport and theme matrix

| Tier                    | Widths                         | Themes         |
| ----------------------- | ------------------------------ | -------------- |
| 20 highest-value routes | 320, 390, 639, 768, 1440, 1920 | light and dark |
| The other 58 routes     | 390, 1440                      | light and dark |

All 78 routes returned HTTP 200 on a full sweep before captures began, and **zero of the 509 captures
errored**. That is not the same as all 78 rendering: **at least two are soft 404s that return HTTP 200
while displaying "Page not found"** (VUX-40). A status sweep is a liveness check, not a render check.

---

## Executive summary

The app is in better shape than a sweep of this size usually finds. Layout discipline is genuinely
good: **not one of the 78 routes scrolls sideways at any width from 320px to 1920px, in either
theme** — a question the design spec had never verified against a rendered page. The composer and
dock ownership contract in `docs/search-chrome-behaviour.md` holds exactly as written across all 78
routes, with no exception in either direction. Every control that was clicked on 13 mode homes and 12
detail pages did something. Race conditions, double-submit and back-button behaviour came back clean.
Twelve of thirteen invalid routes give an honest not-found. Accessibility is stronger than expected:
axe found **zero violations across all 20 high-value routes at phone width**, and 50 of the other 58
routes were clean at desktop; focus traps, Escape handling, reduced motion and forced colours all
behave. Two long-standing open issues (`#EKB6XR`, `#WFARS3`) were **refuted** with evidence and
should be closed.

The serious problems are not layout. They are **claims the interface makes that are not true**, and
they cluster on the surfaces where being wrong costs most.

**The five things worth fixing first:**

1. **A phone loses safety text with no sign it has.** On `/differentials/diagnoses/acute-psychosis`
   — a record headed EMERGENT — a grid track sized to content pushed the Safety snapshot past the
   screen, and the page's own clip swallowed the rest. Sentences stopped mid-word, one of three
   safety counters was entirely off-screen, "Watch for" chips were sliced. No ellipsis, no
   scrollbar, nothing to swipe. **Fixed in this pass.**
2. **The document results list shows a match percentage that measures nothing.** For a nonsense
   query the retrieval layer returned `verdict: "nearby"`, `matchedTerms: []`, `score: 0.063`, and
   the grid rendered "Best match", "Relevant", "**78% related**". The percentage is a hard-coded
   per-verdict constant, and the constant for `nearby` is high enough to trip the "Relevant" branch,
   so a nearby-only document can never display honestly.
3. **The statutory forms register reports that it is empty.** Bare `/forms/search` renders "0 forms"
   and "View all forms (0)" while holding **54** WA Mental Health Act forms — `?q=transport` returns
   them. A registrar reaching for a transport order at 2am is told the register is empty.
4. **Services search returns the wrong specialty and calls it "Best fit".** Query tokens are ORed, so
   "panic disorder" surfaces eating-disorder services in positions 1–5 with an affirmative "Best fit"
   badge; "panic disorder criteria" matches **206 of 244** services.
5. **A comparison table says it is showing four diagnoses while rendering seven, and hides two
   EMERGENCY rows.** On `/differentials/presentations/acute-confusion-encephalopathy` the banner
   reads "4 of 7 diagnoses compared"; 442px is clipped with no cue, concealing the Must-not-miss
   cells for **Wernicke encephalopathy** and **hepatic encephalopathy** — on the presentation where
   Wernicke is the classic miss.

Items 2, 4 and 5 all fail the same way: the interface states something with confidence that its own
data contradicts. That is the through-line of this audit.

---

## Master status matrix

`docOverflow` is the page-level horizontal overflow in pixels; it was **0 on every row of every
capture**. "Clipped content" counts content lost inside a container rather than by page scroll —
which is how the worst finding hid.

| Width |        Routes | Page overflow | Routes with confirmed findings                                                                                                                                       |
| ----: | ------------: | ------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   320 | 20 (+5 extra) |             0 | `/differentials/diagnoses/*`, `/on-call`, `/favourites`, `/tools`                                                                                                    |
|   390 |            78 |             0 | `/differentials/diagnoses/*`, `/forms/*`, `/on-call*`, `/favourites`, `/services/search`, `/factsheets/bipolar`, `/medications/*`, `/documents/[id]`                 |
|   639 |            20 |             0 | `/on-call`                                                                                                                                                           |
|   768 |            20 |             0 | none — this width is clean                                                                                                                                           |
|  1440 |            78 |             0 | `/documents/search`, `/forms/search`, `/services/search`, `/differentials/presentations/*`, `/differentials/compare`, `/tools`, `/documents/[id]`, mode homes (rail) |
|  1920 |            20 |             0 | `/tools`, `/on-call`, `/favourites`                                                                                                                                  |

**Scoreboard by viewport:** 768px is the best width in the app and produced no findings at all — a
reversal of its historical reputation. 320px and 390px carry the most serious layout loss. 1440px
carries the most serious _content_ problems, because that is where the dense comparison and result
surfaces live. 1920px is mostly fine; `/on-call` is the one route that does not cap its content
column.

---

## Cross-cutting findings

These repeat across modes and matter more than any single page.

**C1 · The interface asserts confidence its own data does not support.** Four independent instances:
the fabricated relevance percentage (VUX-02), the "Best fit" badge on a wrong-specialty result
(VUX-04), the "4 of 7" comparison banner (VUX-05), and "0 forms" over a 54-form register (VUX-03). In
each case the honest value is already computed and available — `relevanceChipLabel()` already returns
"Nearby only"; the verdict is already in the payload; the column count is already known; the register
count is already loaded. The app is discarding truth it has, not failing to compute it.

**C2 · The reassuring word is visible; the disqualifying one is a click away.** The answer header chip
reads "Strong support" while the adjacent dialog says the sources are not locally validated and every
cited row reads "Status unknown". "Strong support" is derived from the model's own confidence, not
from source governance. In psychiatry that phrase is the language of evidence strength.

**C3 · Traceability breaks at the last step.** The answer → claim → passage → drawer chain is the best
designed surface in the app. Its final step — "View original PDF" — landed on a raw JavaScript
exception, beside an indexed extract that looks exactly like verified source text. The failure did not
degrade conservatively; it degraded into false reassurance. The message is fixed; the underlying PDF
dependency question is open (VUX-07).

**C4 · The records with the most dose-specific content have the least provenance.**
`/medications/[slug]` and `/therapy-compass/[slug]` render **zero links** inside `<main>` on every tab,
while their footers instruct the clinician to "verify every dose and interaction against **the linked
source**". `/dictionary/*` and `/factsheets/*` do this properly, so the pattern exists — the data model
for medications and therapies simply has nowhere to put a citation.

**C6 · Accessibility is good where it was designed and absent where a surface escaped the shells.**
Every defect found sits on a page or component that bypasses the shared layout: the not-found page has
no `<main>` because it does not use a shell; five compare routes share one unnamed listbox; three
routes share one malformed `<dl>` shape. Inside the shells the work is genuinely solid. The pattern is
worth knowing — the risk is not the design system, it is anything that opts out of it.

**C5 · Fixed-width elements that never flex.** `/on-call` ward chips are `w-32` at every viewport;
`/services/search` applies a 150-character text cap identically at 320 and 1920; `/tools` packs six
category tiles into a ~780px column at `xl`. Each produces truncation that is invisible to the
automated signals and obvious to the eye.

---

## Confirmed findings

Severity: **P0** clinically unsafe · **P1** repeatable broken or badly misleading workflow, or a
WCAG 2.1 A failure · **P2** real defect worth fixing before relying on the surface · **P3** polish.

### P1

**VUX-01 · `/differentials/diagnoses/[slug]` · 320 + 390, both themes · FIXED**
The Overview column is a grid whose implicit `auto` track sizes to its widest item's min-content. The
Safety snapshot's horizontally scrollable "Watch for" row drove that to **493px**, so the section
overflowed its 366px column and `#main-content`'s `overflow-x: clip` swallowed the remainder, with
`docOverflow: 0` — no page scroll, no ellipsis, no cue. On `acute-psychosis` (headed **EMERGENT**):
"Subjective bodily torment and urge to move dominate. Moo" cut mid-word; the third safety counter
entirely off-screen; "Watch for" chips sliced. Measured min-content: safety snapshot 493px, its three
siblings 140/113/180px. Fix: `grid-cols-1` on `differential-detail-page.tsx:1457`. Section width
493→296px at 320, 493→366px at 390, **identical at 639/768/1440**.

**VUX-02 · `/documents/search` · all widths**
`relevance-score.ts:5-7` returns hard-coded constants per verdict (`direct→96`, `partial→84`,
`nearby→78`). `document-search-results.tsx:241` reads `if (verdict === "partial" || percent >= 75)`,
so the `nearby` constant of 78 always trips the "Relevant" branch and the honest
`"Related" / "% nearby"` branch at `:244` is **unreachable**. Observed live: API returned
`verdict: "nearby"`, `label: "Nearby only"`, `matchedTerms: []`, `missingTerms: ["zzqqxnotathing"]`,
`score: 0.063`, `isSourceBacked: false`; UI rendered "Best match", "Relevant", "78% related".
_Touches retrieval/ranking presentation — flag and follow the RAG approval path before editing._

**VUX-03 · `/forms/search` · 390 + 1440**
Bare route renders the results band as "0 forms", a full column header row with no rows, no
empty-state copy, and "View all forms (0)". `?q=transport` returns **54** forms including 3A Detention
and 4A Transport orders. `forms-search-results-page.tsx:267` and `:551` interpolate `matches.length`,
which is 0 for an empty query. Every sibling catalogue lists its contents on an empty query. This is
the WA Mental Health Act 2014 register. Related to open `#6GR6B8`, which recorded the tablet case as
fixed — it is **not closed**; it reproduces at phone and desktop.

**VUX-04 · `/services/search` and `/therapy-compass/search` · 1440**
Catalogue search ORs query tokens. `"panic disorder"` returns eating-disorder services as results
1–5, the top two badged **"Best fit"**. Counts: services `""`→244, `"qwertyuiop zxcvbnm"`→0,
`"panic disorder criteria"`→**206**, `"lithium"`→0. Therapy Compass: `""`→205,
`"panic disorder criteria"`→105. The badge is the part that lies; an unranked list would be honest.
_Ranking surface — flag and canary before editing._

**VUX-05 · `/differentials/presentations/acute-confusion-encephalopathy` · 1440**
Banner reads "4 of 7 diagnoses compared" and the rail "+3 not selected", but the table renders all
seven columns identically styled. `.polished-scroll` measures `scrollWidth 1344` vs
`clientWidth 902` — **442px hidden**, no scrollbar, no edge fade, no cue. The hidden region contains
the Must-not-miss cells for **Wernicke encephalopathy** ("Permanent cognitive injury, Korsakoff
syndrome") and **hepatic encephalopathy** ("GI bleed, sepsis, over-sedation, impending coma"), both
tagged EMERGENCY. Secondary: the sticky CRITERIA column has a transparent background, so scrolled
cell text bleeds through the "Must-not-miss" and "Immediate action" labels.

**VUX-06 · `/medications/[slug]` and `/therapy-compass/[slug]` · all widths**
**Zero `<a>` elements inside `<main>`** on all four medication tabs and on the therapy record, while
the footer on every tab reads "verify every dose and interaction against **the linked source**".
`/medications/acamprosate` states `Max 1998 mg/day`, a `serum creatinine >120 micromol/L`
contraindication, `Half-life 13-28.4 h` and an unattributed `EFFICACY: MODERATE` tile; the only
provenance is one prose sentence on the fourth tab, below the fold. Root cause:
`medication-records.ts:118-126` derives governance from a free-text `src` section with no URL or
document id. `/dictionary/*` and `/factsheets/*` do this correctly.

**VUX-07 · `/documents/[id]` · all widths · PARTIALLY FIXED**
Two defects. (a) Both the load and render paths passed the library's `Error.message` straight into the
visible panel — which also feeds an assertive announcement, so a screen reader spoke
`this[#re].getOrInsertComputed is not a function`. **Fixed.** (b) The app imports the **modern**
pdf.js build (`pdf-canvas-viewer.tsx:498-500`, not `pdfjs-dist/legacy/build/…`), and `pdfjs-dist
6.3.289` calls `Map.prototype.getOrInsertComputed` in three places with no polyfill and no
`browserslist` key in `package.json`. That method is absent in Chromium 141, which is what this audit
had to run. **Not fixed, and needs a decision** — see Limitations. (c) The PDF toolbar (page nav,
zoom, rotate, Fit width, Retry preview) stays fully enabled over the failed preview and does nothing
observable. Download and "Source PDF" do still work, so the clinician is degraded, not stranded.

**VUX-08 · `/forms/extension-transport-order` · 320 + 390**
The official-PDF attachment row collapses: the form title renders as **"Ext…"** (three characters),
the publisher as "Offic…", and the restriction sentence breaks one word per line
("Editing / restricte / (printing / and / form- / filling / permitted)") while two status badges sit
across it. `form-detail-page.tsx:844-890` — the phone badge row takes its natural width beside a text
column allowed to collapse to ~55px. "Password required" and "Editing restricted" are exactly the
facts that decide whether the clinician can fill it now or must print it.

**VUX-40 · Not-found pages, both themes and viewports · FIXED**
The generic 404 and the soft 404s render **no `<main>` and no `#main-content`**, so the global skip
link (`app/layout.tsx:157-162`) points at a target that does not exist: pressing Enter on it leaves
focus on the skip link. WCAG 2.4.1 Bypass Blocks, **Level A**. This is DQA-19 in a new place — that
fix reached `/reference/colour-coding` (genuinely fixed) but never the not-found surface. A mistyped
or stale URL is exactly when a clinician needs to get out fast, and this was the one page where
keyboard escape was dead. **Fixed:** the page root is now `<main id="main-content" tabIndex={-1}>`.
Separately and **not fixed**: `/sources/<unknown-slug>` and
`/therapy-compass/acceptance-and-commitment-therapy-act/brief` render "Page not found" while returning
**HTTP 200**, which is why a status sweep cannot certify that a route renders.

**VUX-41 · The five compare surfaces · 1440 · FIXED**
The catalogue picker is `role="listbox"` with **no accessible name** — axe `aria-input-field-name`,
serious, one node on each of `/differentials/compare`, `/dictionary/compare`, `/formulation/compare`,
`/specifiers/compare` and `/therapy-compass/compare`. The `role="option"` children are correctly
named, so a screen-reader user hears the items but is never told what list they are choosing from.
WCAG 4.1.2 Name, Role, Value, **Level A**. **Fixed** in `compare-catalog-picker.tsx:182` by pointing
`aria-labelledby` at the picker's existing `sr-only` heading, with a literal fallback when a caller
supplies no title. One component, all five routes.

**VUX-42 · Sheets do not return focus to their trigger**
Measured at +100/400/1000/2500ms after Escape, so not a timing artefact. On `/documents/search` the
Filter sheet leaves focus on `<body>` although the trigger is still in the DOM. On
`/calculators/search` closing the PHQ-9 sheet drops `?calculator=phq9`, the list re-renders and the
original button node is destroyed, so restore targets a detached node. The document-actions sheet
restores correctly, which proves the shared mechanism in `ui/sheet.tsx:43-46,108-110,181` is sound —
these are two call-site failures. Consequence: after closing PHQ-9, reaching GAD-7 takes roughly 20
Tab presses from the top of the document. WCAG failure technique F85 against SC 2.4.3 Focus Order,
Level A, on a narrow reading; P2 on a broader one.

### P2

| ID     | Route / surface                        | Finding                                                                                                                                                                                                                                                                                                                                                                   | Evidence                                                                                                                                                                                     |
| ------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VUX-09 | Collapsed left rail, all modes         | The active indicator lights the generic four-square **"More modes"** menu opener, not the current mode, on 9 of 15 modes; on `/?mode=calculators` **nothing** is lit. The rail is the one element surviving every route change.                                                                                                                                           | `ClinicalSidebar.tsx:333-349`; default pin set is 6 of 15 (`use-sidebar-pins.ts:10-29`). Confirmed at 768 and 1440                                                                           |
| VUX-10 | `/on-call` ward strip                  | Ward chips are a hard `w-32` at every viewport; "Demo Emergenc…" truncates at 320, 390, 639, 768 **and** 1920, where ~1180px of the row is empty.                                                                                                                                                                                                                         | `on-call-home.tsx:211`                                                                                                                                                                       |
| VUX-11 | `/on-call/card` · 390                  | Every phone number is a bare `tel:` link **132×17px** with no button styling and only `hover:underline`, which never fires on touch. Rows ~47px apart. The pocket card exists to be used one-handed at 3am.                                                                                                                                                               | `on-call-card.tsx:174`                                                                                                                                                                       |
| VUX-12 | `/tools` · 1440 + 1920                 | Category tiles truncate titles ("Ask evi…", "Prescri…", "Docum…", "Safety …") and break descriptions mid-word ("prescribin/g", "coordinati/on", "document/s and pages"). Clean at 768.                                                                                                                                                                                    | `applications-launcher-page.tsx:287` `xl:grid-cols-6` packs six tiles into a ~780px column                                                                                                   |
| VUX-13 | `/tools` · 320 + 390                   | **Regression.** Tool descriptions are clamped to two lines. The 2026-07-17 audit removed exactly this clamp; PR **#2317** (2026-08-23, "Elevate Tools catalogue cards") reintroduced it.                                                                                                                                                                                  | `tools-search-results-page.tsx:141`, `git log -L`                                                                                                                                            |
| VUX-14 | `/services/search` · all widths        | A fixed **150-character** cap is applied identically at 320 and 1920. On the 13YARN crisis line the cut lands on "…Crisis Supporter. **Immedia…**", removing the availability statement that decides whether to ring now.                                                                                                                                                 | `services-navigator-page.tsx:160-166`                                                                                                                                                        |
| VUX-15 | `/differentials/compare` · 1440        | Landing on the route auto-opens a chooser sheet taller than the viewport, pushing the page's own empty state off the top; the only `<h1>` is the picker's title, duplicated as an `<h2>`. The other five compare surfaces land on a clean page with their own heading.                                                                                                    | `use-compare-picker.ts:9`; `differential-compare-picker-control.tsx:70-105`                                                                                                                  |
| VUX-16 | `/medications/zzz`                     | An unknown slug renders an almost-empty page whose only content is a red "**Request failed (404)**", while the breadcrumb still reads "Medications / ZZZ". Every other catalogue gives a named not-found with a route back.                                                                                                                                               | `use-medication-catalog.ts:192`                                                                                                                                                              |
| VUX-17 | Answer cited-document cards            | The two cards are visually identical, but their accessible names differ in the way that matters: "Source 1 … **Direct**" vs "Source 2 … **Unsupported**". The distinction is exposed only to assistive technology.                                                                                                                                                        | `answer-source-rows.ts`; verified live                                                                                                                                                       |
| VUX-18 | `/favourites` results band · 320 + 390 | Count and scope collide with the "Recently used" pill: "5 favourites \| **Al**" at 390, "**5 favo**" at 320, both themes.                                                                                                                                                                                                                                                 | `favourites-command-library-page.tsx:1791-1807`                                                                                                                                              |
| VUX-19 | `/favourites` · all widths             | Hard-coded prototype fixtures render as the clinician's own saved items and activity history, with no demo label — "last opened Today 08:44", "Yesterday 16:12". Imported by the **production** page, not only mockups.                                                                                                                                                   | `favourites-prototype-data.ts` ← `favourites-hub.tsx:31`, `favourites-command-library-page.tsx:46`. _Needs one line of owner confirmation on whether this is an accepted prototype surface._ |
| VUX-20 | `/differentials/diagnoses/[slug]`      | Counts of reference bullets are dressed as clinical assessment states: green "**2 present**" with a tick, "8 possible", "1 positive", "5 pending". Nothing patient-specific has been entered. The DSM sibling gets this right ("0 of 5 recorded").                                                                                                                        | `differential-detail.ts:110-124`                                                                                                                                                             |
| VUX-21 | `/differentials/diagnoses/[slug]`      | A card headed "**DO NOW**" numbers four items that are teaching observations, not actions ("Violence in psychosis is often defensive from perceived threat"). The same items also form the collapsed summary space-joined with no punctuation — **87 of 556** multi-item sections in the snapshot do this.                                                                | `differential-overview-rail.tsx:114`; corpus scan                                                                                                                                            |
| VUX-22 | `/?mode=answer`                        | "Strong support" is reached from the model's own confidence and does not consider source governance, while the same card shows "Status unknown" on every cited row and the limitations dialog says the sources are not locally validated. The clipboard output states both: `Render trust: high` … `Validation: Not locally validated`.                                   | `answer-render-policy.ts:144-162`; `answer-card.tsx:67-72`                                                                                                                                   |
| VUX-23 | Transient feedback, app-wide           | `ToastProvider`/`ToastRegion` is **never mounted** — nothing in `src/` imports `ui/toast`, and `on-call-copy-number.tsx:36-37` says so in a comment. **35** in-scope files hand-roll their own "Copied" confirmation against **2** that use the shared primitive, with four different wordings. The 2026-07-07 fix for overwriting notifications exists but is unmounted. | `grep -rn 'ui/toast' src` returns nothing                                                                                                                                                    |
| VUX-24 | `/factsheets/bipolar` · 390            | "More in Conditions" row subtitles run past the viewport and are chopped mid-word with no ellipsis ("…the signs to look for, and the treatm"). A `truncate` class is present but never engages because an ancestor lacks `min-w-0`.                                                                                                                                       | probe `right: 572` in a 390px viewport                                                                                                                                                       |
| VUX-25 | `/medications/acamprosate` · 320 + 390 | Dose strings are clamped to two lines with 40–80px hidden: "PO 2 tablets (666 mg) TDS with meals (Total 1998 mg/day…". A dose, frequency and daily total is clinically necessary text.                                                                                                                                                                                    | 5 × `span.mt-1.line-clamp-2.text-xs`                                                                                                                                                         |
| VUX-26 | `/on-call/contacts` · 390              | The contact-name column is squeezed to roughly two words while the number and two circular action buttons take the right half: "Demo nurse manager,…", "Demo registrar on…". Two hospital entries would be indistinguishable.                                                                                                                                             | 5 × `line-clamp-2` with `over: 19`                                                                                                                                                           |

| VUX-43 | `/documents/search?q=…` · 390 | Tabbing to the third result's action row puts focus on a button **completely covered by the fixed phone composer**, and the page does not scroll to clear it. Three occluded tab stops. This is SPEC 9.4's "sticky elements not covering focused content", which had never been checked against a rendered page. | measured box `[13, 790, 121, 48]` in an 844px viewport, `scrollY: 0`; `elementsFromPoint` returns the composer input |
| VUX-44 | `/documents/[id]` · **both themes** | The section-nav subtitle "Long sections collapsed" computes **3.13:1** at 10px against a 4.5 requirement — a live control, not a disabled one, so the inert-control exemption does not apply. | axe `color-contrast`, `fg #5291ca` on `bg #f2f8fe`; `section-nav.tsx:183-185` (`opacity-75`) |
| VUX-45 | `/?mode=calculators`, `/?mode=sources` · **light only** | The shared "Show all" chip computes **4.23:1** at 13px against 4.5. Passes in dark. Light theme carries three axe violations to dark's one. | axe `color-contrast`, `fg #1d6fb8` on `bg #dde9f4`; `show-all-chip.tsx:39-40` |
| VUX-46 | `/reference/colour-coding`, `/sources/method`, `/services/13yarn` | Description lists are broken: `<dl>` → `<div>` → `<div>` → `<dt>/<dd>`. HTML permits one wrapper, not two, so the term/definition association is lost and a screen reader reads paired data as plain prose. The correct single-div shape already exists in one of the same files. | axe `definition-list` + `dlitem` (12 nodes each on two routes); `colour-coding-reference-content.tsx:121-138`, `source-method-reference-content.tsx:89-94`, `service-detail-page.tsx:391` |

### P3

| ID     | Surface                            | Finding                                                                                                                                                                                                                                                                                                                                                                                               |
| ------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VUX-27 | `/favourites` · xl+ · **FIXED**    | "Last used" was a 6.5rem column holding a `whitespace-nowrap` timestamp needing 86px against an 80px content box, so "Yesterday 16:12" lost its final digit to the next column. Widened to 8.5rem.                                                                                                                                                                                                    |
| VUX-28 | `/on-call`                         | The one mode fully out of family: no hero icon or `<h1>` block, a plain rectangular search box instead of the shared pill, a teal accent, a "Tonight / ON CALL" pill where every other reads "MODE / name", an ellipsis button that appears nowhere else, and the only tier-1 route that goes full-bleed at 1920. The different _content_ is documented as deliberate; the different _chrome_ is not. |
| VUX-29 | Mode homes                         | The composer sits ~88px lower on `/?mode=calculators` (y≈486) than on the 11-mode majority (y≈398), because calculators carries a two-line subtitle and a "Show all" chip. `/?mode=sources` sits low for the same reason. The search box is the one control used on every one of these pages.                                                                                                         |
| VUX-30 | `/?mode=differentials`             | The hero subtitle reads "**Match your catalogue to your library.**" — it says nothing about differential diagnosis and reads like copy borrowed from another feature (`ui-copy.ts:65`).                                                                                                                                                                                                               |
| VUX-31 | `/?mode=prescribing`               | Titled "**Medication Guidance**" in a product whose own banners read "this is not clinical guidance" and "not validated decision support" (`ui-copy.ts:84`). Suggest "Medication Reference". _Report for a human — do not reword unilaterally._                                                                                                                                                       |
| VUX-32 | `/?mode=answer`                    | The inline citation marker is an **11×12px** button — the control that takes a clinician from a claim to its source. WCAG 2.5.5 exempts inline targets, so it is not a conformance failure, but it is far under the repo's 48px floor and deserves an owner ruling rather than a silent exception.                                                                                                    |
| VUX-33 | Not-found pages                    | Render with **no landmarks at all** (no `<header>`, `<nav>` or `<main>`) and their two actions are 308×**37**px.                                                                                                                                                                                                                                                                                      |
| VUX-34 | Composer, any mode                 | A query over 200 characters makes `/api/search/universal` return **HTTP 400 silently** — no message anywhere on screen. `.min(2)` means a single character 400s the same way (`route.ts:36`).                                                                                                                                                                                                         |
| VUX-35 | Patient details panel              | Entering `1.02` in Serum creatinine is rejected with "**Enter 15–3000.**" — the only numeric field whose range message carries no unit (CrCl says "mL/min", QTc says "ms"). 1.02 is an ordinary mg/dL creatinine and the bound shown is the µmol/L one.                                                                                                                                               |
| VUX-36 | `/?mode=answer` off-corpus         | A correct, conservative refusal still advertises "**CITED DOCUMENTS · 3 cited**", which reads as a partial answer. Suggest "Documents searched".                                                                                                                                                                                                                                                      |
| VUX-37 | Local and http-served builds       | `metadata-base.ts:49` defaults the protocol to `https` when no `x-forwarded-proto` header is present, so a local build emits `https://localhost:4400/...` links that fail with `ERR_SSL_PROTOCOL_ERROR`. This was the only distinct console error in all 509 captures. **Production behind Railway is unaffected** — it sets the header.                                                              |
| VUX-38 | `/forms/extension-transport-order` | Duplicated label text in the pathway card: "None \| **No parallel formNo parallel form is listed for this step**".                                                                                                                                                                                                                                                                                    |
| VUX-39 | Development environment            | The `next dev` server was **OOM-killed three times** (13.6 GB RSS) while compiling routes in sequence, at ~55–60 routes each time. A heap cap did not help. This audit had to build and serve production instead. Not a product defect, but it costs anyone doing sustained local work.                                                                                                               |

---

## Checked and found sound

Recorded because a clean result is evidence too, and because several of these were open questions.

- **No page-level horizontal scroll anywhere** — 509 captures, 78 routes, 320px to 1920px, both
  themes. Closes SPEC §9.4's page-scroll clause against rendered pages for the first time.
- **The composer and dock ownership contract holds exactly**, measured from the fixed layer rather
  than a selector count: 31 routes show the phone dock, 47 do not; `/tools` and
  `/therapy-compass/recommend` correctly have none; **all 22 information and record detail pages**
  have none at any phone width; the four catalogue result docks are present. Exactly one composer on
  every route. **No exception and no miss in either direction.**
- **axe: zero violations** across all 20 high-value routes at 390 dark. 50 of 58 tier-2 routes clean
  at 1440 dark. Zero `label`, `button-name`, `link-name` or `image-alt` violations anywhere in 118
  route-captures.
- **The skip link works on 76 of 78 routes** — reachable on first Tab, visible outline, Enter moves
  focus to `#main-content`. The two exceptions were the not-found surfaces (VUX-40), now fixed.
- **Focus traps work.** Twelve consecutive Tabs stayed inside the filter sheet, ten inside the
  calculator sheet; both are `role="dialog"` + `aria-modal="true"` and labelled; focus enters on open
  and Escape closes. The 2026-07-07 modal fixes hold.
- **Reduced motion holds.** `.answer-progress-dot` computes `opacity: 1`, `animationName: none`, with
  zero infinitely-animating elements, and the in-app opt-back-in path works.
- **Forced colours lose nothing.** Borders survive, the selected sort segment stays distinct, chips
  keep borders and text, and both the synthetic-data disclaimer and the AI-generated warning remain
  legible. Tone-coloured badges lose hue but keep icon and text.
- **Theme fidelity: 118 of 118 captures rendered the theme they claimed.**
- **768px produced no findings at all**, reversing its historical reputation as this app's weakest
  width.
- **Interaction integrity.** Double-Enter 120ms apart produced exactly one answer; changing the query
  mid-flight produced both answers in order with no stale result shown against the wrong query;
  navigating away mid-answer and returning restored the correct thread. Back works after a search,
  after a detail page, and closes the calculator sheet (which is deep-linkable via `?calculator=`).
- **No dead controls.** Every visible control in `<main>` on 13 mode homes and 12 detail pages was
  clicked and diffed. The only non-responding controls were the PDF toolbar over the failed preview.
- **The answer → claim → passage → source drawer chain** is the best-designed surface in the app:
  verbatim passage, an explicit verdict sentence, pagination, "Ask about this passage". Both clipboard
  outputs carry the demo disclosure, a numbered source list with per-source match strength and deep
  links, and the warnings verbatim. What leaves the app stays honest.
- **`/dictionary/*` and `/factsheets/*` are the provenance gold standard** — working external links,
  publication years, checked and next-review dates, and an explicit separation of source-checking from
  clinical approval.

## Discarded and invalid findings

Recorded so the next auditor does not chase them.

**Harness artifacts — my own tooling was wrong, not the app:**

- **852 "controls with no accessible name"** collapsed to 13 distinct selectors, 804 of them one
  checkbox on `/differentials/diagnoses`. It is wrapped in a `<label>` carrying an `.sr-only` name and
  sized `min-h-12 min-w-12` — correctly labelled and a correct 48px target. The probe never resolved
  an ancestor `<label>`, and its own screen-reader-only filter hid the span carrying the name.
- **The entire computed-contrast array, in both themes — root cause identified.** Chromium serialises
  translucent surfaces as CSS Color 4 `color(srgb 0.988 0.992 0.996 / 0.72)`. The harness parsed
  colours with `/[\d.]+/g` and read those 0–1 floats as 0–255 channels, so a near-white glass surface
  computed as near-black. That is the whole `1.11` / `3.39` / `3.41` family, and it misfires precisely
  where translucent chrome is used — the header, the composer shell, the suggestion chips. Dark-theme
  numbers are no sounder; they just cross the threshold less often. Discarded entirely; every
  accessibility finding in this report comes from axe. A specific check asked for: the
  "SAFETY SNAPSHOT" heading reported at 2.7:1 is **refuted** — axe reports `violations=0 incomplete=0`
  on that route.
- **20×20 checkboxes and a 23px search input flagged as sub-floor tap targets.** Both measure the
  inner element; the padded interactive container is the real hit area.
- **`_summary.json` at 390 and 1440 initially held 58 rows instead of 78**, because two capture
  batches wrote the same index. The screenshots and per-route files were always complete; the indexes
  were rebuilt.

**Previously open issues, now refuted with evidence:**

- **`#EKB6XR` (calculator/modal close and hit-layer interception) — REFUTED. Recommend closing.** A
  geometric probe did flag the backdrop over the answer buttons at 1.6s, but driving real clicks at 0,
  150, 300, 600 and 1000ms after the sheet opens: the sheet never closed and the answer registered in
  9 of 10 trials at both 1440 and 390. The one miss was a click during the slide-up that landed on
  nothing. The earlier reading was mid-animation paint order. The fix recorded in
  `calculator-sheet.tsx:88-113` is holding.
- **`#WFARS3` (CrCl/QTc number-field corruption) — REFUTED on the reported path. Recommend closing.**
  The exact reported sequence (type 420, rejected, Tab away, return, select-all, type 95) leaves the
  field reading `95`, valid and committed. Typing `95` after `420` _without_ selecting gives `42095`
  flagged invalid — literal appending with a correct error, not corruption. Carry VUX-35 forward as
  its own small item.

**Not defects:**

- Dimmed `disabled:opacity-*` text computes as low as 1.96:1, but every instance is a genuinely inert
  control, which WCAG exempts. The one case where a reason-why would matter (a disabled mode-home
  action) puts that text in `title`/sr-only strings, not in the dimmed description. **No
  `disabled:opacity-*` use puts text a clinician still needs to read below 4.5:1.**
- Duplicate `<main>` landmarks on every route — a Next.js streaming placeholder that is
  `display: none`, 0×0 and out of the accessibility tree.
- Chip carousels overflowing on `/?mode=specifiers`, `/?mode=services`, `/dsm/compare` and the
  `/on-call` strips — genuine horizontal scrollers with visible affordances.
- `/therapy-compass/[slug]/brief` returning "Page not found" for ACT — correct: the route calls
  `notFound()` when the record has no brief intervention.
- `/differentials/search` result rows measuring 220×20 — they carry `after:absolute after:inset-0`,
  so the whole card is the hit area.
- Truncated placeholders and ticker chips at 320, tablet 2+1 mode-home grids, the collapsed-vs-expanded
  sidebar — all recorded as deliberate decisions.

---

## Rediscoveries and status corrections

- **`#6GR6B8` is not closed.** The tablet forms-search case was fixed, but `/forms/search` still
  reports "0 forms" over a 54-form register at both 390 and 1440 (VUX-03).
- **The 2026-07-17 Tools truncation fix regressed** via PR #2317 on 2026-08-23 (VUX-13). One agent
  read this as the fixed design; the git history is decisive that the clamp was removed and later
  re-added.
- **The 2026-07-07 notification-stack fix is unmounted** (VUX-23). The primitive exists; nothing
  mounts it.
- **PRIOR-ART baseline corrections:** `disabled:opacity-*` is now 42 in-scope (was recorded as 41);
  the off-ladder `z-index: 50` residual is in a mockup-only stylesheet and out of scope.
- **SPEC §9.4 (320px reflow, no page-level horizontal scroll) is now verified against rendered
  pages** and passes everywhere. It had never been checked.

---

## What was fixed in this pass

Commit `ba4fa367e`, three files, each seen in pixels and traced before the change.

| Finding   | Change                                                                                                     | Proof                                                                                                       |
| --------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| VUX-01    | `grid-cols-1` on the Overview column so an implicit `auto` track cannot exceed it                          | Section width 493→296px at 320, 493→366px at 390, **identical at 639/768/1440**                             |
| VUX-07(a) | Fixed sentences replace `Error.message` on both the load and render paths; technical detail to the console | Makes PDF consistent with the image path, which already used a fixed string; `data-preview-error` preserved |
| VUX-27    | "Last used" column 6.5rem → 8.5rem                                                                         | Longest value needs 86px; content box 80px → 112px, measured at 1280, 1440 and 1920                         |
| VUX-40    | The not-found page root is now `<main id="main-content" tabIndex={-1}>`                                    | Restores the global skip link's target; no layout change                                                    |
| VUX-41    | `aria-labelledby` on the compare listbox, pointing at its existing `sr-only` heading                       | Clears an axe `aria-input-field-name` violation on all five compare routes from one component               |

Gates: `npm run test:focused` over the first three files — **6 test files, 50 tests passed**.
`npx tsc --noEmit` — **exit 0** with the accessibility fixes in place. Prettier clean on all five
files. `npm run verify:cheap` was re-run after these commits; its result is recorded on the pull
request.

**Deliberately not fixed**, because each needs a decision rather than a patch: anything touching
retrieval or ranking presentation (VUX-02, VUX-04), clinical wording (VUX-20, VUX-21, VUX-22,
VUX-31), the `/tools` grid composition (VUX-12, VUX-13), the compare-picker's opening behaviour
(VUX-15), and the pdf.js browser-support question (VUX-07b).

---

## Recommended fix order

1. **VUX-03** `/forms/search` — a statutory register reporting itself empty. Small, self-contained.
2. **VUX-02** relevance labelling — an afternoon; the honest label and verdict are already in hand.
   Flag as a RAG-adjacent change first.
3. **VUX-05** comparison count vs rendered columns, and the transparent sticky column.
4. **VUX-04** catalogue search token handling and the "Best fit" badge. Ranking surface — canary.
5. **VUX-07b** decide the pdf.js browser baseline: legacy build, polyfill, or a declared minimum.
6. **VUX-08, VUX-10, VUX-11, VUX-14, VUX-26** — the phone truncation cluster; all small and local.
7. **VUX-09** rail active state; **VUX-16** medication not-found; **VUX-18** favourites band.
8. **VUX-06** structured citations on medication and therapy records — the largest piece, and the one
   that most defines whether the product is what it says it is.

---

## Feature suggestions

Each answers a gap observed in this session.

**1 · Structured, clickable citations on medication and therapy records.** _Gap:_ VUX-06 — zero
anchors in `<main>` while the footer instructs the clinician to check "the linked source". _Who:_ the
prescriber checking a ceiling or contraindication before writing. _Size:_ a week for the shape
(schema field, renderer, sources promoted to tab 1); **a project** to backfill every record's
free-text source into structured citations. _Approval:_ database migration **and** clinical
governance. _Why first:_ it is the product's stated purpose, absent where a wrong number does most
harm.

**2 · Make result labels say what retrieval actually decided.** _Gap:_ VUX-02. _Size:_ **an
afternoon** — `relevanceChipLabel()` already returns "Nearby only" and the verdict is already in the
payload; the change is to stop discarding it and drop the constant percentage. _Approval:_ flag as a
RAG-ranking-adjacent change. _Why:_ lowest cost here, and it stops the app asserting something it
already knows to be false.

**3 · A coverage statement and an honest floor on every result set.** _Gap:_ VUX-02 and VUX-03 are
the same missing idea — no surface states what it searched and what it found. One line under every
results band: "Searched 3 indexed documents · 0 matched your terms · showing nearest neighbours", and
below a coverage threshold, "No indexed source covers this." An empty query lists the catalogue
rather than claiming zero. _Size:_ a week. _Approval:_ the threshold is retrieval; the wording is
clinical governance.

**4 · A source-verification fallback contract for the document viewer.** _Gap:_ VUX-07. When the
canvas fails: a plain sentence (done), "Open the PDF file" promoted to primary, the toolbar disabled,
and every extracted panel stamped "indexed extract — not the original page" while the canvas is down.
Make it a contract the viewer cannot render without, as `AnswerCard` already refuses to render
without its verification props. _Size:_ an afternoon. _Approval:_ none.

**5 · Comparison completeness guard.** _Gap:_ VUX-05. A rendered comparison must agree with its own
count, and a row tagged as a red flag may never be horizontally clipped — below the width where all
selected columns fit, stack to per-diagnosis rows. Add a static test asserting banner count equals
rendered column count. _Size:_ a week. _Approval:_ none unless the fix changes which diagnoses are
selected.

**Do first: #2.** An afternoon, the correct answer is already computed, and it is the only item where
the app displays a number it knows to be wrong. **Start #1 immediately behind it.**

---

## Limitations — what this audit did not establish

- **The repository's own browser gate did not run.** It pins Playwright chromium revision 1243 and
  this network blocks `cdn.playwright.dev`, so the audit drove the pre-installed **Chromium 141**
  directly. This is **not** `verify:ui`, and nothing here should be read as that gate passing. The
  phone-geometry specs pinning `/differentials/diagnoses/*` are unrun against the VUX-01 fix — CI must
  confirm it.
- **The PDF preview failure is partly an artifact of that older browser.** `pdfjs-dist 6.3.289` calls
  `Map.prototype.getOrInsertComputed`, which Chromium 141 does not implement. What is _not_ an
  artifact: the app ships the modern pdf.js build with no legacy fallback, no polyfill and no
  `browserslist` key, so the same break lands on any browser lacking that very new method. **Whether
  the owner's own current browser is affected was not tested.**
- **Everything ran against the synthetic demo corpus** with no OpenAI and no live Supabase.
  Demo-mode success is not proof of the live path where the code forks. VUX-02 in particular was
  proved with a nonsense query; a live `nearby` verdict has not been observed.
- **Two harness signals were unreliable** and were discarded (see Discarded findings).
- **The accessibility results are axe run directly, not the repository's accessibility gate.**
  `npm run test:e2e:accessibility` was never attempted, and nothing here should be read as that gate
  passing. The engine was Chromium 141, so the results are indicative of that engine rather than of
  the pinned matrix. Tier-2 routes were checked with axe in dark theme only; since the one
  light-only defect found (VUX-45) lives in a shared component, a light-theme tier-2 axe pass is the
  highest-value thing left undone.
- **Coverage is uneven by design.** Agent C's interaction work is light-theme and desktop-heavy.
  Roughly a quarter of the 58 tier-2 routes were opened as pixels at 1440 rather than only read as
  signals — and two of the three most serious 1440 findings carried **no useful signal at all**, so a
  further eyes-on pass over the remainder would likely find more.
- **CI on `main` is unreliable** (`#T82ND3`) and its failures report to nobody (`#TN512M`), so a
  green-looking CI is not evidence for or against anything here.

---

## Classification

**FAILING REVIEW.**

Eleven P1 findings were confirmed; three are fixed in this pass and **eight remain open**, four of
which involve the interface
asserting something its own data contradicts, on surfaces a clinician uses to decide whether to stop
looking: a fabricated match percentage, a "Best fit" badge on a wrong-specialty result, a statutory
register reporting itself empty, and a comparison that hides two EMERGENCY rows while claiming to
show fewer columns than it renders. None is a crash; all are quiet, and quiet is what makes them
serious.

The minimum to re-review: VUX-02, VUX-03, VUX-04 and VUX-05 closed or explicitly accepted with a
recorded rationale, and a decision recorded on VUX-07b.

---

## Closing note

The app is well built. Nothing overflows the screen at any size, every button does something,
navigation and back behaviour are sound, and the path from an answer to the exact quoted passage is
the best thing in the product. Two problems people have been chasing for weeks turned out not to
exist. What needs attention is not how the app looks but what it claims: in four places it tells a
clinician something with confidence that its own data contradicts, and the one that would worry me
most is a search result badged "Best fit" when it belongs to the wrong specialty. I would fix the
forms register first because it is small and it is a legal document store, then the relevance
labelling because the honest answer is already sitting in the payload. I have fixed the three
problems that were unarguable, including a phone layout that was silently discarding safety text on a
page marked EMERGENT.
