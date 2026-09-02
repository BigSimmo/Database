# Fifteen modes, or one search with fifteen lenses?

**A decision brief for the owner. Nothing in the app changed to produce this — it is a
description of what is already there, three arguments about what it means, and the
consequences of each way forward.**

---

## How to read this

It is long because the evidence is the point. If you read only part of it, read the first three
sections and then the options.

1. **What you are deciding** — the question in one paragraph.
2. **A correction to the premise** — the consolidation is much further along than assumed.
3. **What each mode actually is** — a table of all fifteen, from the code, not the labels.
4. **The finding that matters most** and **the honest grouping** — what the census adds up to.
5. **Three arguments** — three independent reviews arguing three incompatible positions, in
   full and unrefereed, followed by notes on where their numbers disagree.
6. **What each way forward would mean** — five options including doing nothing, with what
   changes, what breaks, and how much work each is.
7. **Things the census found on the way** — problems worth fixing whichever option you pick.
8. **The question only you can answer.**

---

## What you are deciding

PsychSift is described, in its own code and its own documentation, as fifteen "app modes"
sharing one search box. Answer, Documents, Services, Forms, Favourites, Differentials, DSM,
Specifiers, Formulation, Medication, Tools, Calculators, Therapy, Factsheets, Dictionary.

The question is whether that is a true description of the app or a leftover label. If the
fifteen are really fifteen small products that happen to share a search box, the app should
stop trying to squeeze them through one shared front door. If they are really one search
surface wearing fifteen different hats, then the mode concept is an expensive fiction and
should be retired.

This is a product decision, not an engineering one. This brief exists to make it decidable.
It deliberately contains no recommendation of its own.

---

## First, a correction to the premise

The question, as put, assumed that three modes — Therapy, DSM and Forms — had already given
up their own front pages and become redirects onto one shared home page.

**It is ten, not three.** Ten of the sixteen mode addresses no longer render a page of their
own. Visiting them bounces you straight to the single shared home:

> `/dsm` · `/dictionary` · `/factsheets` · `/services` · `/forms` · `/calculators` ·
> `/specifiers` · `/formulation` · `/differentials` · `/therapy-compass`

Besides the shared home itself, only five addresses still render something of their own:
`/documents`, `/tools`, `/favourites`, `/medications` and `/sources`. And of those five, two
are not what they appear — `/documents` shows a hidden heading and three buttons that open a panel the
shared header can already open, and `/medications` renders the exact same component the
shared home renders, just at a different address.

There is also a sixteenth mode nobody counts: **Sources**. The code declares sixteen; the
documentation says fifteen. That gap has been there long enough for both numbers to appear in
the same repository.

So the consolidation is not a small experiment on three pages. It is most of the way done
already, and the app has been running that way without the mode labels changing to match.

---

## What each mode actually is

Fifteen separate reviews were run against the source code — one per mode — each answering the
same five questions from what the code _does_, not from what the mode list _claims_.

Two words below need a gloss. **"The library"** means the indexed PDF collection — your
uploaded clinical documents, searched by meaning. **"A built-in list"** means a fixed file of
records shipped inside the app itself, searched by matching text; it never touches the
library and never reaches the internet.

| Mode              | Own front page?                      | What its search actually looks in                        | What only it can do                                         | Lost if it became a filter                | Its own code  |
| ----------------- | ------------------------------------ | -------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------- | ------------- |
| **Answer**        | It _is_ the shared home              | The library, plus written-answer generation              | Follow-up questions, citations, evidence panel              | Nothing — it already is the shared page   | ~12,400 lines |
| **Documents**     | Hidden heading + 3 buttons           | The library, same query, answer-writing switched off     | The PDF reader: highlights, download, tagging, summarising  | The reader — everything real              | ~7,900 lines  |
| **Services**      | No — redirects                       | A database table of service records (219 shipped)        | Shortlist and compare, catchment filters, referral rail     | Compare, filters, the record pages        | ~3,470 lines  |
| **Forms**         | No — redirects                       | The **same table**, one column different                 | Statutory record pages, Act sections, form PDFs             | The record pages                          | ~3,540 lines  |
| **Favourites**    | Yes — and a second, lighter one      | Nothing. Typing filters what is already on screen        | Making and reordering saved sets, pinning, Continue         | The only place saved things are organised | ~3,278 lines  |
| **Differentials** | No — redirects                       | Its own table (232 records) _and_ the library            | Compare queue, presentation workflows, diagnosis map        | Browse, records, compare                  | ~9,640 lines  |
| **DSM**           | No — redirects                       | A built-in list of 146 diagnoses                         | Side-by-side criteria matrix, diagnosis→differential links  | Compare and the bridge                    | ~2,216 lines  |
| **Specifiers**    | No — redirects                       | A built-in list (12 written up, 585 stubs)               | A wizard that assembles conflict-checked diagnostic wording | The wizard                                | ~3,818 lines  |
| **Formulation**   | No — redirects                       | A built-in list of 12 mechanisms                         | A wizard that drafts a formulation from templates           | The wizard                                | ~3,611 lines  |
| **Medication**    | Same page as home, different address | A medication table (330 records) — **never the library** | Interaction checking, organ/allergy alerts, safety verdict  | The record pages and the checker          | ~6,600 lines  |
| **Tools**         | Yes — and a second, different one    | A built-in list of 16 tools                              | Safety pre-flight before opening a tool                     | Little — 14 of 16 links point back inward | ~2,046 lines  |
| **Calculators**   | No — redirects                       | 8 built-in instruments, 5 actually released              | Entering scores and getting a banded, caveated result       | Scoring — nothing else does it            | ~3,200 lines  |
| **Therapy**       | No — redirects                       | A built-in list of 205 therapies                         | Recommend, compare, pathways, session briefs, patient sheet | More than any other mode                  | ~7,350 lines  |
| **Factsheets**    | No — redirects                       | 8 built-in patient sheets                                | Printing an A4 handout for a patient                        | The printable handout                     | ~2,528 lines  |
| **Dictionary**    | No — redirects                       | 96 built-in terms                                        | Grouping abbreviations by meaning, an A–Z index             | Little                                    | ~3,840 lines  |

---

## The finding that matters most

**Fifteen search boxes. Three of them search your library.**

Only Answer, Documents, and the evidence half of Differentials actually query the indexed PDF
collection. And the app's own search code treats "differentials" as an exact synonym for
"documents" — same collection, same settings, no filter at all.

Everything else searches something that ships inside the app: eight modes match text against
built-in lists, four query a database table of records, and Favourites searches nothing at all
(typing filters the screen; pressing the button shows a message saying "Favourites filtered
from the composer").

So the shared search box is not fifteen views onto one library. It is one control wired to
fifteen mostly-unrelated things, and the mode label is what decides which.

**The word "mode" is doing three different jobs at once.** It picks _which data to look in_.
It picks _which record layout to render_. And it picks _which instrument to open_. Those three
choices do not line up with each other — Forms and Services are the same data with two
different layouts; Specifiers and Formulation are two different datasets running two
near-identical wizards that were built twice rather than shared. As long as one label makes
all three choices, no clean line can be drawn anywhere.

---

## The honest grouping

Set the labels aside and sort by what a clinician actually does at each surface.

**Group 1 — Instruments and workspaces (nine).** These are not searches. They are things that
take input and produce something: Answer (writes a cited answer), Documents (reads a PDF),
Calculators (scores an instrument), Specifiers and Formulation (two drafting wizards),
Therapy (recommends, compares, prints session briefs and patient sheets), Medication (checks
interactions and gives a safety verdict), Favourites (organises saved things), Factsheets
(prints a patient handout). Each has a search box bolted to the front, but the search box is
the least of what it is.

**Group 2 — Catalogue browsers (six).** DSM, Dictionary, Services, Forms, Differentials,
Tools, Sources. Every one has the same shape: a fixed list, ranked by text matching, shown as
cards, opening onto a record page. They differ in their dataset and their record layout, and
in almost nothing else.

**Group 3 — Already consolidated (ten front pages).** The ten redirects. This group cuts
_across_ the first two: Therapy is a serious workspace whose front page is already gone;
Dictionary is a thin browser whose front page is also gone. Losing the front page turned out
to say nothing about whether the mode was substantial.

That last point is the quiet result of the census. **The consolidation already done did not
follow any principle.** It removed the front pages that happened to duplicate the shared home,
which is a rendering fact, not a product fact. It left `/tools` and `/favourites` alone
because each had content worth keeping — and both now have _two_ different front pages showing
different things.

---

## Three arguments

Three independent reviews were asked to argue three incompatible positions as strongly as the
evidence allows, each working from the same census. They are reproduced in full and unrefereed,
including the paragraph each was required to write naming the strongest fact against its own
case. The disagreement is the useful part; no attempt is made here to settle it.

In one line each:

- **One:** the modes are real products, the consolidation has already broken working surfaces
  twice, and it should be reversed.
- **Two:** the mode concept is an expensive fiction that describes behaviour the code does not
  run, and it should be deleted — keeping the tools, losing the labels.
- **Three:** both extremes are wrong; the real joint is at five destinations, and here is the
  test that finds it.

### Argument one — "These are fifteen products and the consolidation is a mistake"

**Ten of your mode homes were not consolidated — they were emptied, and the code says so out
loud.** The shared home every redirect now points at is built by one component,
`src/components/clinical-dashboard/answer-status.tsx`. At line 76 it passes `actions={[]}` — an
empty list of starter actions — for every mode except Calculators, which gets a single "Show
all" chip. So when you tap Forms, or Differentials, or Therapy Compass, you now arrive at a
title, a subtitle, a search box, and, if the preference is on, up to five of your own recent
typed queries. That is the entire home. The mode-specific doorways are gone, not merged.

**The redirect file itself admits consolidation broke things — twice, in its own comments.**
`src/lib/consolidated-mode-home-redirect.ts` explains why `/documents` was pulled back out:
folding it in "silently deleted those three affordances (`/issues` tracked this as a Production
UI regression); restored." Browse, recent documents, and the document-search empty state simply
vanished from production until someone noticed. A few lines further down it records a second
casualty: sending a submitted link to the shared home "is what broke four phone journeys… so
`/forms?q=transport&run=1` stopped reaching `FormsSearchResultsPage`." Two separate breakages,
both found after shipping, both written into the source as scar tissue. That is not a smooth
de-duplication; that is a migration that has already cost you working surfaces and needed
emergency reversals.

**The premise — "they all share one search" — is false for thirteen of the sixteen.** Only
three mode searches ever touch your indexed guideline library: Answer, Documents, and the
evidence half of Differentials (and `api/search` treats "differentials" as a literal alias of
"documents"). Eight modes search static files committed into the repo using plain text
matching — DSM, Specifiers, Formulation, Calculators, Therapy Compass, Factsheets, Dictionary,
Tools. Four query a plain database table. Favourites searches nothing at all: typing filters
your own saved rows in the browser and pressing Enter shows a toast. Calling that "one search"
is a naming convention, not an architecture. It is a single-shaped box in front of thirteen
different mechanisms, and the box cannot tell you which one you are talking to.

**Two of the biggest modes exempt themselves from the very thing that supposedly unites them.**
`/tools` has no search box: `global-search-shell.tsx` suppresses the composer with
`pathname !== "/tools"`, and a comment says Tools "owns its catalogue controls rather than a
shared composer." Medications never reaches the search API at all — `ClinicalDashboard.tsx:1570`
reads `if (mode === "prescribing") return;`. Its declared search kind of `"documents"` is dead
code. And the cross-mode "ask this here" bridge only actually runs the query for two modes:
line 2357 is `if (mode === "answer" || mode === "documents")`. For the other fourteen it changes
the URL and leaves you sitting in a shell that has not searched. The shared composer is not a
shared capability; it is a shared appearance.

**What these modes are is instruments, and instruments do not consolidate.** Specifiers is a
four-step wizard that resolves conflicts and hands you diagnostic wording. Formulation is a
four-step builder with six templates producing an editable draft. Medications runs an
interaction engine off a 541-line lexicon (`src/lib/medication-interaction-lexicon.ts`) with
renal, hepatic and allergy alerts and a fail-closed traffic-light verdict. Calculators refuse to
show a score band until every item is answered. Therapy Compass builds a printable patient
handout. Factsheets prints an A4 sheet with crisis numbers. Differentials holds a compare queue
and a 1,116-line diagnosis map. None of those is a query. You do not "search" a wizard, and a
psychiatrist mid-consultation is not browsing — they want the interaction checker, now, from a
URL their fingers already know.

**Muscle memory and deep links are exactly what got taxed.** The browsable content that used to
be at `/formulation` now lives at `/formulation/search` — `formulation-home-page.tsx` (367 lines)
and `specifiers-home-page.tsx` (425 lines) are still in the tree, but the only route that
renders them is a path called "search". So the catalogue you want to _look at_ is behind a word
that means _type something_. Meanwhile `/formulation` itself is a redirect stub, and the
redirect logic needs a legacy `?query=` alias and a `run=1` check to stop old bookmarks landing
somewhere useless — the file says so.

**The consolidation also quietly cost you two safety-shaped things.** The scope caveat under the
composer ("clinical reference, not validated decision support") was removed from every mode
home, and there is now a purpose-built test, `tests/mode-home-no-caveat-footer.test.ts`, whose
job is to keep it removed — your own ledger item `#MPZTBR` flags that an audit says the
opposite. And `bundle-budget.json` still describes itself as guarding "the five Lighthouse
journeys" while listing only two routes, `/` and `/documents/search`. Fourteen surfaces have no
per-page weight guard.

**Consolidation has not simplified anything; it has centralised the complexity.**
`ClinicalDashboard.tsx` is 4,100 lines special-casing modes by name. Sixty files reference the
mode list. There are 6,688 lines of tests devoted purely to mode plumbing. Every one of those
lines exists to make fifteen different things behave like one thing. Reversing the redirects
deletes plumbing; finishing the consolidation adds more.

**The strongest fact against this position:** before consolidation, all thirteen standalone
homes had already been rewired (ledger item `#TWKWE4`) to draw their title and subtitle from
the _same_ table, `sharedHomePresentation` in `src/lib/ui-copy.ts`. So the ten homes that were
folded in demonstrably did contain little more than shared copy and a search box — which is why
nine of the ten folded without an incident report. This case rests on what those homes _should_
have held, not on what they held on the day they were removed.

### Argument two — "This is one search with fifteen filters, and the mode concept costs more than it earns"

**Fifteen labels are sitting on top of three searches.** Of the sixteen declared modes, only
three ever query your actual document library — the indexed PDFs (Answer, Documents, and half
of Differentials). And two of those three are the same query: `/api/search` contains a function
called `isSourceLibrarySearchMode` that returns true for exactly `"documents"` and
`"differentials"` — same corpus, same response, no filter (`src/app/api/search/route.ts`). Eight
modes "search" by matching text against files committed into the repo. Four query a small table.
Favourites searches nothing at all — typing filters a list, and pressing submit shows a toast.
So the thing the user picks a mode for, before typing, changes the underlying behaviour in three
cases out of sixteen.

**The mode declarations describe behaviour the code refuses to run.** This is the part that
should worry you most. `src/lib/app-modes.ts:306-309` says, in a comment written to justify a
design choice: _"Deliberately kind:'documents' (unlike forms): prescribing intentionally
searches the document corpus for dosing/threshold guidance."_ It does not. `ClinicalDashboard.tsx`
bails out for that mode twice — `if (mode === "prescribing") return;` at line 1570 and again at
line 2221 — before any search runs. The declaration, its comment, and its `dose_threshold_lookup`
setting are all inert. Second case: Tools declares a full search configuration at
`app-modes.ts:334-340` — placeholder text, an accessibility label, submit-button wording. Its own
canonical page cannot use any of it, because `global-search-shell.tsx:495` suppresses the search
box with `pathname !== "/tools"`. The register of modes is not a description of the app. It is a
wish list the app has partly ignored.

**The abstraction manufactures duplication instead of preventing it.** Services and Forms are one
Postgres table distinguished by a single `kind` column, sharing one ranker and one API — yet they
are two mode entries, two component folders, and Services alone has two independent
implementations of its own result list. Specifiers and Formulation have byte-identical route
shapes — six pages each: `/page`, `/search`, `/[slug]`, `/builder`, `/compare`, `/map` — and
instead of sharing the builder, they duplicate it: 653 lines versus 713 lines of near-parallel
wizard. Favourites has two homes rendering different components (`favourites-hub.tsx`, 665 lines;
`favourites-command-library-page.tsx`, 1,941 lines). Tools has two: a flat list at `/tools` and
the real launcher at `/?mode=tools`. Fourteen of the sixteen registered tools are links back to
other modes.

**The tax is real and measurable.** 85 source files and 31 test files reference the mode list.
Those tests total 11,828 lines, of which roughly 4,470 exist purely to prove that mode plumbing
is internally consistent — that every mode declares a surface type, owns a search route, resolves
an identity colour, has no duplicate caveat footer. That is thousands of lines of test verifying
that a table of labels is well-formed, not that any clinical answer is correct.
`ClinicalDashboard.tsx` is 4,100 lines special-casing six modes. The shared shell is another
~9,600. And 31,396 lines of "mockup" components sit inside production source directories —
alternate versions of Favourites, Tools, Calculators, Therapy, Care Plan, Settings, all still
compiling.

**The rot is the clinical argument, not the engineering one.** Every mode ships a label promising
a capability. Several of those promises are false, and a false promise in a clinical reference
tool is not a cosmetic bug — it is an impression of coverage you may act on. Therapy Compass
carries records that are every single one marked `needs_review`; the "reviewed only" filter
therefore returns nothing, and there is no way to sign anything off. Forms ships five care-pathway
records and hard-disables the button that shows them — `const supportsPathwayClaims = false;` at
`forms-search-results-page.tsx:57`. Specifiers holds 585 items, all pending clinician review,
only 71 with definitions. Factsheets has a Save button that writes to a store Favourites never
reads. Dictionary's "related entries" are array positions, not relationships, and its sources page
is 267 lines of unreachable code. DSM keeps a component alive solely because its own test imports
it. Each of these hides behind a mode label that reads like a finished feature.

**Fifteen shallow surfaces are worse for one user than one deep one.** You are one psychiatrist.
Every hour spent keeping sixteen labels internally consistent — colours, routes, placeholders,
contract tests, redirect stubs — is an hour not spent on the one thing that actually earns its
keep: grounded answers with citations back to your PDFs. That surface is ~12,400 lines and is the
only place generation, threading, evidence review and feedback exist. Excellence at this width is
unaffordable; the census is the proof, because half the surfaces are visibly half-finished.

**The honest shape is already visible in the code.** Ten bare mode paths are redirect stubs
already, and nothing broke. What remains is one search over your documents, plus a small number
of things that were never search modes: the medication safety workspace (which already refuses to
search), the prescribing interaction engine, the calculators, the Caring Contacts tool, the PDF
viewer. Call those tools, put them behind one launcher, and delete the register. You lose fifteen
labels and roughly 4,500 lines of tests about labels. You lose no clinical capability.

**The strongest fact against this position.** The genuinely separate interaction models are real
and substantial. Specifiers' conflict-resolving builder, the drug-interaction engine with its
fail-closed traffic-light verdict, the calculators that refuse a score until every item is
answered, the A4 print handout, the differentials compare queue — these are not skins on a search
box, and folding them into one surface would either delete them or produce a home page carrying
fifteen conditional panels. That risk is the strongest thing the other side has, and it is why
this argument is to delete the _mode_ concept, not the tools.

### Argument three — "Both are wrong; the natural line is at five"

**Five.** Home/Answer, Documents, Medications, Calculators, Favourites keep their own place; the
other eleven become filters and detail pages inside them. Here is why that is the joint and not a
midpoint.

**I tested the obvious principle first and it failed.** "Does it hold state the user creates?"
sounds like the right test, so I measured it rather than assumed it. I searched every mode's
component folder for browser storage or a save path. Result: `src/components/favourites/` is the
only one with any (`favourites-storage.ts`, 224 lines, backed by a real authenticated API at
`src/app/api/account/favourites/route.ts`, 371 lines). Calculators, Specifiers, Formulation,
Therapy Compass, DSM, Differentials, Services, Forms — zero, all of it thrown away on reload.
Factsheets has a "Save" button that writes to browser storage nothing ever reads. So that
principle splits the app 1 against 15. It reproduces one of the extremes you already rejected. It
is not a joint.

**The second obvious principle fails differently.** "Does it query a different data source?"
splits roughly 8/8 — three modes reach the document corpus, four reach a database table, eight
read committed files. Tidy number, indefensible edges. Services and Forms are literally one table
separated by one column: `src/app/api/registry/records/route.ts` line 40 declares
`kind: z.enum(["service", "form"])` and line 149 picks the record list off that enum. Counting
them as two different data sources double-counts one thing. Worse, Medications sits on a database
but never touches search at all — `ClinicalDashboard.tsx` line 2221 returns early for prescribing
before any search runs. And none of this is visible to the person using the app.

**The principle that carves cleanly is: can this surface be operated by typing one line of text?**
If yes, it is a filter on one search, no matter how much code sits behind it. If it needs several
separate inputs, carries a working state across steps, and produces something that exists in no
document — it is an instrument, and an instrument cannot live inside a search box. Then one
further gate, because this is clinical: the instrument's underlying content must be signed off.
An instrument that dresses unreviewed material in an authoritative-looking output is worse than no
instrument.

**Applying it.** Medications passes on both counts. `src/lib/medication-patient-alerts.ts` takes
age, kidney function, liver severity, QTc, allergies and pregnancy; `src/lib/medication-interactions.ts`
(377 lines) cross-checks the patient's current drug list in both directions and is built so a
green "all clear" is unreachable whenever the analysis is incomplete. Six inputs, computed verdict,
and its 330 records carry real dosing content, not placeholders. Calculators passes: item-by-item
responses, a refusal to show a band until every item is answered, and a genuine release gate —
`calculator-fixtures.ts` lines 803–808 admit only instruments that are active, rights-cleared,
evidence-verified and released, which is why 5 of 8 ship and the rest are quarantined. Documents
passes on the second half of the test: the PDF viewer, highlighting, tagging, summarising and
upload are a workspace you work inside, not a result you read. Answer is the shell itself.
Favourites passes for the reason nothing else does — it is the only place holding anything the
psychiatrist made.

**The losers, and where their capability goes.** Nothing is deleted. The redirect file already
establishes that sub-routes survive independently of modes, so every detail page keeps working.
Services and Forms merge into one registry search with two chips; their record pages (1,038 lines
each) survive untouched — that is where the value actually is. DSM, Dictionary, Factsheets,
Specifiers, Formulation, Differentials become filters on the one search plus their existing detail
and print pages. Sources becomes a tab inside Documents; it is the provenance ledger of that
corpus and belongs nowhere else. Tools dies outright as a mode: 14 of its 16 entries link back to
other modes, and its own route already suppresses its search box (`global-search-shell.tsx` line
494 reads `pathname !== "/tools"`), so its entire search declaration is dead code. Its two real
destinations — the safety plan and Caring Contacts — move to the sidebar as applications.

**The two I find genuinely hard.** Therapy Compass is instrument-shaped — constraint-based
recommendation, printable briefs, a handout builder, 6,616 lines — and it fails only my second
gate. All 205 records in `src/data/therapies-source.json` are marked `needs_review`, the "reviewed
only" filter therefore returns nothing, and no sign-off path exists. I demote it rather than
delete it; it earns its place back the day a clinician can sign records off. Differentials is the
painful one: 9,640 lines and a 1.2MB snapshot, but its snapshot's own governance block says
`"reviewStatus": "Pending review"`, and its search is an exact alias of Documents (`api/search`
line 81) — same corpus, same response, no filter. Specifiers settles itself: its index states
`itemsWithDefinitions: 71` against `itemsPendingClinicianReview: 585`, and every entry's
definition field is the literal string `needs-manual-or-clinician-verification`. A four-step
wizard assembling diagnostic wording out of that is a hazard, not a feature.

**The strongest fact against this line.** Medications, the flagship instrument here, never reaches
the shared search at all — the dashboard exits before search runs, and its declared search
settings are inert. If the thing that most deserves its own place is not participating in the
search shell, then what this argument has really shown is that four of the five are standalone
_applications_ that happen to be filed as search modes. Push that honestly and the true mode count
is one search with four apps beside it — which is closer to the consolidation extreme than to
five. I still hold the line, because five destinations is what the psychiatrist chooses between
and one is not, but you should know the argument bends that way under pressure.

### Fact-check notes on the three arguments

The arguments are reproduced as written, not refereed. Four of their more striking claims were
checked independently against the source and all four hold: the shared home really does pass an
empty starter-action list while `/documents` and `/medications` pass real ones; `/tools` really
has no search box; Medication really never reaches the search API; and the Forms pathway button
really is switched off in the source.

Two numbers in the arguments differ from what was measured directly, and the measured figures
are used elsewhere in this brief:

- The therapy library holds **205** records, not 410. All 205 are marked "needs review" — the
  substance of the claim is right; the count is double.
- The three arguments quote different totals for how many files mention the mode list (60, 72, 85) and for the size of the mode test suite (4,000, 4,470, 6,688 lines). These are different
  ways of drawing the boundary, all defensible. The narrow measure — files naming the mode list
  or its type directly — is **72 files** and roughly **4,000 lines** of mode-plumbing tests. The
  wider counts include files that touch a mode indirectly.

---

## What each way forward would mean

Five options, including doing nothing. For each: what changes on screen, what happens to the
design system's home layouts, what it costs to add something new afterwards, what breaks, and
roughly how much work it is.

Effort is given in plain terms because the work is done in AI sessions, not by a team:
**small** means a day or two, **medium** means a couple of weeks of steady sessions, **large**
means a month or more with real risk attached.

### Option A — Do nothing

**On screen:** Nothing changes. Sixteen labels in the menu; ten of them open a page that is a
title, a subtitle and a search box; six open something else; two of those six (Tools and
Favourites) have a _second_, different version of themselves at another address, showing
different things.

**Home layouts:** Unchanged. The shared home template stays, carrying no starter actions for
any mode. The design system continues to describe all sixteen modes with just three identity
families, which is a truer description than the mode list gives.

**Adding a new mode afterwards:** The current cost. Around seventy files mention the mode
list; roughly four thousand lines of tests exist only to prove the mode plumbing is
self-consistent. A new mode must declare a search behaviour it may never use, be given a home
decision, a menu entry, an identity colour and a results-surface type.

**What breaks:** Nothing today. Everything found in the census stays shipped, including the
promises that are not true.

**Effort:** None.

### Option B — Finish the front door

Make the remaining five addresses redirect to the shared home too, so every mode label leads to
the same page with different words on it. Every real surface underneath stays exactly where it
is.

**On screen:** The menu looks the same. The difference is that Tools, Favourites, Medication,
Documents and Sources stop being special cases. The two double-homes collapse to one each —
that part is a genuine repair, not a loss.

**Home layouts:** One home layout, sixteen rows of copy. The mode-home template survives only
as the template for standalone tool pages.

**Adding a new mode afterwards:** Slightly cheaper — the home question has only one answer
now — but otherwise unchanged. The seventy files and the four thousand lines of contract tests
are all still there.

**What breaks:** The Tools launcher and the Favourites library are real content and must be
relocated to a sub-page or they are deleted. Bookmarks and deep links to the five affected
addresses need redirects that carry the typed query across — that is precisely what went wrong
the first time, when four phone journeys stopped working because a submitted link was sent to
the home page with the query dropped.

**Effort:** Small to medium. Same shape as the ten already done, but with real content to move
in three of the cases rather than empty pages to delete.

### Option C — Collapse the mode concept

One search page with filter chips, plus a plainly-named tool tray holding the instruments.

**On screen:** The mode menu disappears. In its place: one search box; a row of filters
(Library, Services, Forms, Diagnoses, Terms, Therapies, Medications…); and a Tools tray
listing the instruments by name — Calculators, Interaction checker, Specifier builder,
Formulation builder, Patient factsheets, Therapy planner, PDF library, Favourites.

**Home layouts:** The sixteen rows of home copy collapse to one. The three identity families
survive untouched, because they already describe the real shape better than the modes do. The
mode-home template becomes the tool-page template.

**Adding something new afterwards:** Two cheap questions instead of a registration. Is it a
new thing to search? Add a ranker and a filter chip. Is it a new tool? Add a page and a tray
entry. No mode identifier, no declared search behaviour, no home decision, no contract-test
surface.

**What breaks:** Every address of the form `/?mode=…` and every bare mode path — all sixteen
need permanent redirects. The four thousand lines of mode contract tests are deleted or
rewritten. And the thirty-six places where the four-thousand-line dashboard branches on mode
name have to be unwound. That is where the risk concentrates, because the answer path — the
threading, the citations, the evidence drawer — lives in that same file. A mistake there
damages the surface you actually rely on.

**Effort:** Large, and the only option with real risk to a working surface.

### Option D — Reverse the consolidation

Give every mode a real front page again.

**On screen:** Sixteen labels leading to sixteen genuinely different pages. Bookmarks and
muscle memory get better, not worse.

**Home layouts:** This is the expensive part. The mode-home template is already built for
this — it takes a title, an icon, a set of starter actions and a set of pills — but every mode
currently passes it an empty action list. Reversing means designing sixteen sets of starter
actions and keeping them worth looking at.

**Adding a new mode afterwards:** The most expensive of all five options — everything it costs
today, plus a front page worth visiting.

**What breaks:** Nothing technical. The redirect module can simply be removed. What this costs
is your attention: sixteen homes have to earn their place or you have rebuilt exactly what was
just taken out. The census found several modes already shipping unfinished content behind a
finished-looking label, which is the same failure at a smaller scale.

**Effort:** Medium in code, large in design and content.

### Option E — Split at a smaller number

Keep a real front page for the surfaces that genuinely are their own thing, and turn the rest
into filters or sub-pages of a survivor. The third argument above names a specific number — five — and defends it. The consequences
depend on where the line lands, but the shape is consistent:

**On screen:** A short menu of real destinations, plus a filter row for everything that is
just a different list.

**Home layouts:** A small number of designed homes instead of sixteen thin ones or one generic
one — which is what the mode-home template was built for.

**Adding something new afterwards:** You must answer one question honestly — does this hold
state the user creates, or is it another list? — and the answer decides which side it lands on.
That is a cheaper and more honest test than today's registration.

**What breaks:** The demoted modes' addresses need redirects, and their genuine capabilities
have to be re-homed somewhere specific rather than quietly dropped. A split that does not say
where each discarded capability goes is not a plan.

**Effort:** Medium. More than finishing the front door, much less than collapsing the concept.

---

## What doing nothing costs over a year

Not a crash. A slow drift between the map and the territory, in a codebase where most of the
work is done by AI sessions reading the map.

**The mode tax keeps being paid on unrelated work.** Around seventy files are coupled to the
mode list and roughly four thousand lines of tests exist only to keep it self-consistent.
Every feature that touches search, navigation or a home page pays some of that toll whether or
not it cares about modes.

**The descriptions keep being wrong in the same four places.** The mode list says Medication
searches your document library — it never reaches it. It gives Tools a search box that its own
page suppresses. It describes Differentials as its own kind of search when the search code
treats it as an exact synonym for Documents. It advertises a Forms pathway view that is
switched off in the source. Every session that reads that file either spends effort
rediscovering the truth or repeats the error into new code.

**The two double-homes drift further apart.** Tools and Favourites each render different
content at two different addresses today. Nothing is keeping them in step.

**The unfinished promises stay shipped.** A therapy library where every one of 205 records is
marked "needs review" and the reviewed-only filter therefore returns nothing. A specifier
catalogue of 585 items where only 71 have definitions. A Save button on patient factsheets
that writes somewhere Favourites never reads. In a clinical reference tool these are not
cosmetic — a label that reads like a finished feature is an impression of coverage.

**Weight guards cover two surfaces out of sixteen.** Only the shared home and document search
have a page-weight budget; the other fourteen can grow without anything noticing.

**And the count keeps disagreeing with itself.** The code declares sixteen modes. The
documentation says fifteen. Both numbers appear in the same repository today.

---

## Things the census found on the way

These are true whichever option you pick, and several are worth acting on regardless. They are
listed here because they were found while answering the question, not because they settle it.

**Promises the app makes that it does not keep.** Every one of the 205 therapy records is
marked "needs review", so the "reviewed only" filter returns an empty list and there is no way
to sign anything off. The specifier catalogue holds 585 items with only 71 definitions. The
Forms mode ships five care-pathway records and the button that shows them is switched off in
the source. The Save button on a patient factsheet writes to a place Favourites never reads.
The Dictionary's "related terms" are the next few entries in the file, not related terms.

**Two modes have two different homes each.** Tools shows a flat list at `/tools` and a proper
launcher at the shared home. Favourites shows a full library at `/favourites` and a lighter,
read-only version at the shared home. Nothing keeps either pair in step.

**Code kept alive only by its own test.** One DSM component has no user of any kind except the
test that imports it. One Dictionary page of 267 lines is unreachable.

**One open question already on your list.** Ledger item `#MPZTBR` records that the scope
caveat under the search box ("clinical reference, not validated decision support") was
deliberately removed from every mode home, and that a separate audit says it should be mounted
on every mode home. There is now a purpose-built test whose job is to keep it removed. That
contradiction is unresolved and is more urgent than the mode question, because it concerns
what the app tells you about its own limits.

---

## The question only you can answer

The three arguments above disagree about the facts far less than they appear to. They agree on
almost everything: that three searches touch your library, that the instruments are real, that
the mode declarations are wrong in several places. What they disagree about is what PsychSift
_is_.

One says it is a set of clinical instruments that happens to include a search engine. One says
it is a search engine over your library that has accumulated fifteen labels. One says it is
both, with a line between them that can be drawn.

That is your call, and it is not answerable from the code. Three things would settle it:

1. **How do you actually arrive?** Over the last month, how often did you get where you were
   going by typing into the search box, versus by going straight to a named tool? Nobody has
   this answer; the app does not record it and there is only one user.

2. **What do you want mid-consultation?** When you reach for the interaction checker or a
   rating scale with a patient in front of you, is the fastest path a search box you type
   into, or a name your fingers already know?

3. **How wide do you want to be?** Fifteen adequate surfaces or a small number of excellent
   ones is a real trade, and at one user with AI-assisted maintenance the width is affordable
   only if most of it stays shallow. The census shows several surfaces are already shallower
   than their labels suggest.

Answer those three and the option chooses itself.
