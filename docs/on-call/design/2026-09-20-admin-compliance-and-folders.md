# On Call — Admin, Compliance, and folders: what was decided and what forced it

**Date:** 2026-09-20 · **Scope:** the `logistics` section of On Call, the two pages that now
render it, and Orientation's folders.

Companion to [`2026-09-19-review-and-proposals.md`](2026-09-19-review-and-proposals.md), which
reviewed the shipped hub, and to
[`docs/product/2026-09-19-doctor-compliance-and-feature-brainstorm.md`](../../product/2026-09-19-doctor-compliance-and-feature-brainstorm.md),
which argued the compliance design before any of it was code. This document records what was
built and, for each choice, the constraint that left no better option.

Two questions bring a maintainer here, and both have short answers:

- **Why is Compliance not a section?** Because `section` is a database CHECK constraint, and in
  this repository merging a migration reaches the live clinical database within seconds, with no
  deploy step in between. A new enum value is not a schema edit here; it is a production write.
- **Why does the page refuse to tell me whether I am compliant?** Because nothing on it has been
  checked with the body that issues the requirement. Every date on it is one the holder typed.
  A page that displays confidence it does not have replaces checking with reassurance.

Both answers are set out in full below.

## The constraint the rest of this bends around

`supabase/migrations/20260904120000_on_call_entries.sql` declares one table for the whole mode,
discriminated by a text column with a CHECK on it:

```sql
section text not null check (
  section in ('contacts', 'playbook', 'referrals', 'orientation', 'education', 'logistics')
),
...
unique (owner_id, section, slug)
```

Three facts about that line decide almost everything that follows.

1. **Changing it is a migration.** Six values, fixed in the database, mirrored by
   `ON_CALL_SECTIONS` in `src/lib/on-call/entry-model.ts`.
2. **Merging that migration is the deploy.** The Supabase GitHub integration has "Deploy to
   production" enabled with production branch `main` — see `AGENTS.md`, "Supabase project
   safety". There is no separate apply step to hold back and no window to reconsider in.
3. **`details` is `jsonb` with no constraint on it at all.** A new key inside `details` costs
   nothing, reaches nothing live, and is validated in the application layer by a Zod schema per
   section.

So the cheap axis is `details`, and the expensive axis is `section`. Every decision below took
the cheap axis unless something made it wrong.

## 1. Logistics became Admin — the label only

`ON_CALL_SECTION_TITLES` in `src/components/on-call/on-call-section-identity.ts` now renders
`logistics` as "Admin". Nothing else moved: the stored section id, the route segment
`/on-call/logistics`, and the CHECK constraint all still say `logistics`.

This is the precedent `education` → "Teaching" already set in the same file, and for the same
reason — renaming the id would be a migration for no functional gain. The mode-nav registry
entry in `src/lib/mode-secondary-navigation.ts` follows suit: the item keeps the id `logistics`
and the href `/on-call/logistics`, and only its label reads "Admin".

**What the section holds did change, and that part is content rather than schema.** It was site
logistics — parking, after-hours food, call rooms, IT. It is now the work admin a doctor does
for themselves: leave, rosters, pay, forms, access. `Facilities` is kept as one folder rather
than dropped, so the rooms-and-food entries that were the whole of the old section are still
there and nothing already stored is orphaned. The page summary in
`src/components/on-call/on-call-section-page.tsx` names Facilities last for the same reason: a
summary that stopped mentioning them would read as if they had gone.

**A loose end, since closed.** The route metadata in
`src/app/(search-app)/on-call/logistics/page.tsx` still read "Logistics | On Call | PsychSift" with
the old parking-and-food description, so the browser tab and any shared link still said Logistics
while every surface a reader could see said Admin. It now reads "Admin | On Call | PsychSift" with
a description naming leave, rosters, pay, forms and access. The route segment and the stored
section are unchanged, for the reason above.

## 2. Compliance is a view over `logistics`, not a seventh section

`src/lib/on-call/compliance.ts` owns the split. A compliance row is a `logistics` row carrying
`details.kind: "compliance"`, and `partitionLogisticsEntries` is the single place the two lists
are told apart.

This is the exact route Who's who already took out of `contacts`
(`src/lib/on-call/who-is-who.ts`), and the new module deliberately mirrors it function for
function so the two read as one pattern rather than two inventions.

Three details in it are load-bearing:

- **The discriminator is `z.literal("compliance").optional()`, not a free string.** An
  unrecognised value must fail validation rather than fall back to "ordinary admin row", which
  would hide a requirement whose expiry can stop someone working.
- **`isComplianceEntry` tests the section before it tests `kind`, and that is not redundant.**
  `details` is typed `unknown` on the entry, every section shares the column, and nothing stops
  a contacts row carrying a `kind` key. Without the section test such a row would be adopted
  into Compliance, where its role would read as a requirement.
- **`partitionLogisticsEntries` drops entries from other sections rather than passing them
  through**, so no caller can accidentally render a contacts row on either page.

**The cost of this choice is one hazard, and it is written down rather than hoped away:** a
compliance requirement appearing in the Admin list, filed among forms and rosters where nothing
is expected to run out. Two surfaces close it — `adminGroups` in
`src/components/on-call/on-call-page-sections.ts` and the list in
`src/components/on-call/on-call-logistics-section.tsx` — and both go through
`partitionLogisticsEntries` rather than a `section === "logistics"` filter.
`tests/on-call-section-page-wiring.dom.test.tsx` pins it in both directions: compliance rows out
of Admin, admin rows out of Compliance.

The editor writes the discriminator through `mergeOnCallEditorDetails` in
`src/lib/on-call/editor-details.ts`, which gained a `complianceRequirement` flag beside the
existing `roleExplainer` one. They write the same `kind` key and are still separate flags on
purpose: they mean different things in different sections, and one shared flag would let a
contacts form strip a compliance row's discriminator.

### The shape this schema cannot yet refuse

Admin and Compliance share `logisticsDetails`, so every compliance field — `consequence`,
`expiresOn`, `leadTimeDays`, `issuingBody`, `provenance`, `evidenceUrl` — is optional on an
ordinary admin row too. Nothing currently ties them to `kind`. An Admin row saved with
`consequence: "stops-work"` and no `kind` validates cleanly and never appears on the Compliance
page.

No editor produces that row today, so it is a latent shape rather than a live defect. It is
recorded here because it is the honest trigger for revisiting section 6 below: the day the two
shapes genuinely diverge, one schema validating both stops being the cheap option.

## 3. Compliance sorts by consequence, never by expiry date

`ON_CALL_COMPLIANCE_CONSEQUENCES` in `src/lib/on-call/entry-model.ts` is
`["stops-work", "stops-part", "chased"]`, worst first, and its **order is the sort key** —
`complianceSortRank` calls `indexOf` on it, so a value inserted in the middle re-orders the
page.

Date order answers "what runs out soonest", which is not the question. A registration lapsing
next month stops you working; a training module three weeks overdue gets you an email. Sorting
by date puts the training module first. The bands put them the right way round, and the date
breaks ties inside a band.

The full comparator in `sortComplianceEntries` is band, then soonest expiry, then title. Title
is last so the list is stable: two requirements in the same band with no date must not swap
places between renders. A row with no date sorts after the dated rows inside its own band —
it cannot be shown as more urgent than something with a real deadline.

**A fourth band exists for rows with no recorded consequence, and it is never folded into the
one above it.** No recorded consequence is unknown, not harmless. It cannot be ranked against a
stated cost, and guessing it a band would be the app forming exactly the judgement section 4
forbids. `complianceSortRank` puts those rows last for the same reason.

`ON_CALL_COMPLIANCE_BANDS` in `src/components/on-call/on-call-page-sections.ts` carries the
words. Each band has a `heading` (the sentence the page renders, and the source of the anchor
slug), a `barLabel` (the one word the in-page bar gets), and a glyph:

| Stored value | Heading on the page     | Bar slot   |
| ------------ | ----------------------- | ---------- |
| `stops-work` | Stops you working       | Blocking   |
| `stops-part` | Stops part of your work | Partial    |
| `chased`     | Someone chases you      | Chased     |
| _(none)_     | No consequence recorded | Unrecorded |

The bands are mapped from the enum rather than retyped, so adding a consequence is a compile
error here until somebody writes the words for it, instead of a band that silently never
appears.

## 4. The no-verdict rule

**No surface built on these rows may render a verdict.** Not "compliant", not "valid", not
"current to", and not a tick standing for any of them. The rule is stated three times — at the
top of `src/lib/on-call/compliance.ts`, in a banner comment at the top of
`src/components/on-call/on-call-compliance-section.tsx`, and on the schema field itself in
`src/lib/on-call/entry-model.ts` — because it is a wording rule and wording is the only thing
enforcing it.

A clinical-governance review rejected an earlier design of this feature for exactly this.

The reasoning is a safety one, not a legal-cover one. A green tick beside "Medical registration"
is an assertion about a person's legal standing, made from a date they typed months ago. The app
cannot know about a condition on registration, a notification, a failed payment, a withdrawn
certificate, or a requirement that changed. A reader who sees a tick stops checking, which is
the one outcome worse than having no tracker at all.

What the page does instead:

- **Every line reads as a record of an act, not a state.** `PROVENANCE_PHRASES` gives three:
  "as you confirmed it", "as you entered it", "read from a certificate". Each describes
  something the reader did. "Confirmed" on its own would be the app vouching for a register it
  has never contacted.
- **The scope note renders unconditionally**, above the empty state as well as above a full
  list — a reader who has just added their first requirement is precisely the one who has not
  yet been told what this page does not know. It says, in the body text rather than in small
  print, that nothing here is checked with the issuing body and that whether the reader holds a
  requirement today is a question only Ahpra, their insurer or their health service can answer.
- **That note wears `Info`, and the view itself no longer wears a tick at all.** `ShieldCheck` was
  the first choice for both, and a shield carrying a tick set beside the sentence "nothing here is
  checked" is a glyph arguing with its own caption. The view's mark is `CalendarClock`, read from
  `ON_CALL_VIEW_ICONS` by the rail, the home tile, the loading state and the empty state alike —
  see the P3 entry under "What two reviews found" below.
- **No band glyph is a tick either.** The band glyphs grade how bad a lapse would be, which is
  the one thing the row actually records. `Unrecorded` in the bar is a statement about the
  consequence field, never about whether the requirement is held.
- **The one tick-shaped control on a row is the mode's existing freshness stamp**, which says
  when a human last looked at the record. It has always meant that, and it still does.
- **`evidenceUrl` is a URL, deliberately not an upload.** The default upload path indexes a
  document and sends it to a provider; a registration certificate is identity data with no
  business in the clinical corpus.

The page summary in `on-call-section-page.tsx` and the route metadata in
`src/app/(search-app)/on-call/compliance/page.tsx` are held to the same rule, because the
description is the one line a search result or a shared link shows — the "not a check" half
cannot be left to the page body.

## 5. Orientation gained folders, and its `category` is optional where Admin's is required

Orientation rows now file into folders through an optional `details.category`. Two things about
that are deliberate and easy to get wrong later.

**It is optional because rows already exist without one.** A required field would invalidate
every pre-existing orientation row on read. Rows with no folder land under a trailing fallback
heading — `ON_CALL_ORIENTATION_UNFILED_LABEL`, the single word "Unfiled" — rather than
disappearing.

**It is read off the raw object rather than through the section schema.** `orientationDetails`
also requires `pinnedSummaryIsOwnerNote`, so a manual saved without an owner's note parses as
invalid; reading the folder through that schema would lose a folder the row plainly has.
`onCallOrientationCategoryFacet` therefore reads `details.category` directly.

**Admin's `category` is the opposite on both counts, and that is not an inconsistency.** It is
required (`category: trimmed`, no `.optional()`) so no Admin row lands in a fallback bucket by
accident, and it is read _through_ the schema by `onCallAdminCategoryLabel`, because the Admin
list component parses before it renders — see bug 2 below.

## 6. One word per folder

**Every Admin category, Orientation folder and Compliance bar label is a single word.**

A category is two things at once: the heading the page draws, and a slot in a 48px bar of bare
words that truncate rather than fold (`wordmark-five` in
`src/components/mode-nav/mode-nav-bands.ts`). The taxonomy was first cut with phrases, and "What
you can authorise" measured **165px in that row against a 288px phone viewport**. It was cut to
"Authorise". The measurement is recorded in `tests/ui-on-call-boards.spec.ts`, board 11, and the
demo corpus in `src/lib/on-call/demo-entries.ts` models the same convention so the truncation
cannot come back unseen in a browser.

The Admin folders that survived the re-cut are Leave, Rosters, Pay, Forms, Access and
Facilities. Orientation's are Induction, Manuals, Policies and Departure.

**A group whose meaning genuinely needs a phrase keeps the phrase as its heading and gives the
bar a short label instead.** `ON_CALL_COMPLIANCE_BANDS` is the worked example: "Stops part of
your work" on the page, "Partial" in the bar. The anchor slug is always derived from the
_heading_ on both sides, so shortening a bar slot can never move an anchor.

## Two bugs found on the way

Both were found by reading the code rather than by a failing test, and both are the same class
of fault: a second copy of a rule that had already been decided somewhere else.

### The bulk write that would have reached rows the reader cannot see

`visibleCount` and `staleEntries` in `src/components/on-call/on-call-section-page.tsx` filtered
with `entry.section === view`. That test is wrong for four of the views, because four of them
are half a stored section — Contacts and Who's who share `contacts`, Admin and Compliance share
`logistics`.

On the count it merely inflates a number. On `staleEntries` it is considerably worse: that list
is what the page's "mark all as still correct" control writes to. On the Admin page it would
have stamped today onto **compliance requirements the reader cannot see from there** — a bulk
write over off-screen rows, on precisely the rows where a date nobody has looked at is the
hazard the Compliance page exists to surface.

Fixed by `onCallVisibleEntries`, which defers to the two partition helpers rather than
re-deriving either rule. A bulk write is only defensible when the reader can see everything it
touches, and that function is now the definition of "everything it touches".

### The jump list that declared an anchor the page never drew

The Admin jump list read the raw `details.category`; the Admin list component parses the row
through the section schema before rendering it, and falls back to "General" when parsing fails.
The two therefore disagreed about exactly one kind of row — one whose details fail validation.
The header would declare a jump to a heading the page never drew.

That fault is quiet by design: it is not a visible glitch, it is a jump list row that does
nothing. Fixed by exporting `onCallAdminCategoryLabel` from
`src/components/on-call/on-call-page-sections.ts` and having the list import it, so the
declaration and the render read one function.

The same shape is why Compliance and Orientation also take their keys from that module
(`ON_CALL_COMPLIANCE_BANDS`, `onCallOrientationCategoryFacet`, `sortOnCallEntries`). Contacts
and Who's who keep their own copies, and that is safe only because a DOM test already asserts
every anchor they declare against the page they render. The dependency runs one way: a list may
read the declaration, never the reverse.

## What two reviews found, and what was done

Two reviews read this work before it was proposed for merge: a clinical-governance review of the
Compliance page, and a code review of the branch. Between them they raised twelve findings. The
severities below are the ones the reviews assigned, and each entry says what was done. **Where
nothing was done, it says that instead** - a decision record that quietly omits an open defect is
worse than no record at all.

### P0 - the page published a doctor's regulatory record to anyone on the internet

`GET /api/on-call/entries` has no auth gate: it answers any caller, signed in or not, with every
row not flagged `is_personal`. That is the deliberate 2026-09-04 owner decision, and it was taken
about ward phone numbers, switchboard extensions and escalation ladders. This page quietly extended
it to one named clinician's medical registration, indemnity, credentialing, Working with Children
Check and national police clearance, each with a recorded date and often a link to the certificate

- published unless the author ticked a box then labelled "Personal number", which defaults off and
  does not read as a question about a police clearance.

Closed in four places, deliberately more than one:

1. **`onCallEntryToRow` stamps `is_personal` on the server.** Both write handlers funnel through
   that one function, so an authenticated caller posting straight to the API cannot publish a
   requirement whatever the request body says. A compliance requirement is about one person by
   definition, so this is a property of what the row is rather than a setting on it.
2. **`fetchSharedOnCallEntries` filters the shared read fail-closed**, through
   `rowMayBeComplianceRequirement`. That predicate reads the RAW database row rather than the
   parsed entry, because `rowToOnCallEntry` nulls details it cannot read and a compliance row with
   one stray character in `kind` would otherwise parse into something `isComplianceEntry` calls an
   ordinary Admin row - publishing exactly the rows most likely to be malformed. It matches any
   `kind` key rather than the exact string, and treats unreadable details on a `logistics` row as a
   requirement. Withholding a broken parking note from the public page costs nothing; publishing a
   broken registration record cannot be undone.
3. **The editor stops offering the choice.** On a compliance requirement the privacy tick box is
   replaced by a sentence saying the entry is private; the general checkbox beside it is relabelled
   "Private - only you" and now says what leaving it unticked means.
4. **The demo corpus writes every compliance row private**, so the fixture models what the app
   produces rather than the defect it used to.

`tests/on-call-repository.test.ts` pins the write stamp and the read filter, including a misspelt
discriminator and unreadable details. The defect never reached `main` and so was never deployed;
it is recorded, with the fixed behaviour, as **PIA-9** in
[`docs/privacy-impact-assessment.md`](../../privacy-impact-assessment.md), which had no On Call
entry at all before this.

### P1 - switching the taxonomy orphaned the other one's fields, and re-ticking resurrected them

Found independently by both reviewers, which is usually the sign of a real one. Unticking
"Compliance requirement" swapped the form's fields but left the stored ones in the JSON. The Admin
page renders none of them, so an expiry date went on existing in the database and on no screen; tick
the box again a year later and the editor re-offered it pre-filled, as though it had just been
entered.

Three changes, and they are separate because they fail separately:

- **A save-time sweep.** `TAXONOMY_EXCLUSIVE_DETAIL_KEYS` is the union of the keys exclusive to each
  side of the split, and every one the form did not send is added to `clearedKeys` and deleted.
  Stated as an invariant rather than as a reaction to the tick changing, so it holds however many
  times the box is toggled and across sheets - and so opening and saving an already-orphaned row
  repairs it, which is the only repair path an owner has for data no page shows them. `category` and
  `url` are in both forms and are not swept at all.
- **A warning before it happens.** `complianceLossWarning` names the boxes by their own labels, in
  both directions: while the tick is on it says what unticking would delete, and after an untick it
  says what saving will delete and that putting the tick back keeps them. Deleting them is the
  honest outcome, but one mis-tap is enough and nothing else on the form said so.
- **`salvageExistingDetails` in `src/lib/on-call/editor-details.ts`.** A whole-object parse is
  all-or-nothing, and the merge previously treated a refused parse as `{}` - a silent wipe of every
  stored field the form does not own, triggered by one stray character or one unrecognised key on a
  `.strict()` schema. It now salvages key by key: every stored key the schema knows and whose own
  value it accepts survives.

### P1 - a date that had passed looked exactly like a date next year

Nothing on the page compared a date to today, so a registration recorded as expiring last March and
one recorded as expiring next March rendered identically.

`recordedExpiryHasPassed` in `src/lib/on-call/compliance.ts` now answers it, and the name is the
whole care taken: it is arithmetic on a stored string, and a function called `isLapsed` would be a
claim about the reader's standing that this module may never make. The row appends the words
"- that date has passed", in ink rather than a colour or a glyph, because a reader scanning eight
requirements should not have to do date arithmetic on each one. The comparison is `YYYY-MM-DD`
strings against the viewer's own local day; parsing either side into a `Date` would put a
requirement recorded as expiring today on the wrong side of the line for everybody east of UTC,
which is everybody using this.

### P2 - four that are closed

- **"Mark all as still correct" was a one-tap bulk assertion about regulatory records.** One tap,
  no confirmation, would have cleared the warning off every unrecorded requirement on the page for
  twelve months without the reader having read any of them. `offersBulkVerify` now excludes the
  Compliance view outright, which is a governance decision rather than a layout one: everywhere else
  in the mode the stamp and the content are the same question, and here they come apart - the stamp
  is about the record, and the question the reader has is about the requirement. The per-row control
  stays, because it is the same act with the row's own subject in front of the person doing it. This
  is a second, narrower control than the `onCallVisibleEntries` fix recorded above: that one stopped
  the Admin page reaching compliance rows, this one stops the Compliance page offering the action.
- **Search and Recent labelled compliance rows "Admin" and linked to a page not containing them.**
  Both read `entry.section`, which is `logistics`. `onCallViewForEntry` in
  `src/components/on-call/on-call-section-identity.ts` is now the one place an entry is turned into
  a destination, a name or a glyph, and it sits next to its own inverse so the pair cannot drift.
  `ON_CALL_VIEW_TITLES`, `ON_CALL_VIEW_HREFS` and `ON_CALL_VIEW_ICONS` widen the section-keyed maps
  to the two views, which also removed three hardcoded copies of `/on-call/compliance`.
- **The printable card could carry a requirement stripped of everything that made it honest.**
  `selectCardEntries` now excludes compliance rows by name. It is belt-and-braces beside the
  `isPersonal` test above it, and stays even though that test would now exclude them anyway: privacy
  is a decision about who can read a screen, and whoever revisits it will not be thinking about what
  a printed card leaves off. The freshness guard would not have caught this either, and it is worth
  being exact about why - `stale` is computed from `lastVerifiedAt`, not from `expiresOn`, so a
  requirement that ran out last month on a row ticked still-correct last week is "fresh" by that
  test. If a compliance card is ever wanted it is a different artefact, one that prints the date, the
  band and the "recorded, not checked" sentence beside every row.
- **Nothing enforced the no-verdict rule; it was prose in six files and zero gates.**
  `tests/on-call-compliance.test.ts` now carries one. It reads the two compliance surfaces through
  the TypeScript parser rather than by grep, so the comments - which necessarily discuss every banned
  word at length - are excluded structurally rather than by an exclusion list, and a companion case
  proves both halves of that so the gate cannot pass vacuously. The band headings declared in
  `on-call-page-sections.ts` get their own case.

### P2 - one that is only half closed: a details parse failure still files the row under Admin

`rowToOnCallEntry` sets `details: null` when a row's details fail their section schema, and
`isComplianceEntry` reads `details`. So a malformed compliance row still resolves to `false` and is
rendered on the Admin page, among forms and rosters where nothing is expected to run out. That is
exactly the hazard section 2 above says this design's one cost is.

**Both consequences that made it dangerous are closed.** It is no longer published, because the
shared read's predicate reads the raw row and fails closed (P0 above). And a later save no longer
destroys the compliance fields, because `salvageExistingDetails` replaced the wipe (P1 above).

**The misfiling itself is open**, and knowingly. Closing it means either teaching
`rowToOnCallEntry` to carry the raw details alongside the parsed ones, or giving `isComplianceEntry`
the raw-row reading that `rowMayBeComplianceRequirement` already has - both are changes to the entry
type that every consumer in the mode reads, for a row no editor in this app can produce: the API
validates `details` against the same strict schema on write, so a malformed row arrives only by
direct database edit or by import. That is the honest reason it was left, not that it was missed.

### P3 - the small four

- **`ShieldCheck` was a tick on a page that may not show one.** A shield carrying a tick, beside the
  sentence "nothing here is checked with the issuing body", is a glyph arguing with its own caption.
  The view now wears `CalendarClock` in `ON_CALL_VIEW_ICONS`, and the rail, the home tile, the
  loading state and the empty state all read that one map rather than naming a glyph again. The scope
  note wears `Info`.
- **The Compliance add control carried Contacts copy.** "Role first, name only if you must." was
  hardcoded under every add control in the mode, so the Compliance sheet read "Add requirement /
  Role first, name only if you must." - advice about naming other people, on the page holding your
  own registration. `ON_CALL_ADD_HINT` is now per view and deliberately partial, so a view with
  nothing worth saying renders no second line rather than a padded one.
- **An unranked requirement sinks to the bottom of the page, and still does.** This one was
  reviewed and kept. No recorded consequence is unknown, not harmless; it cannot be ranked against a
  stated cost, and guessing it a band would be the app forming exactly the judgement section 4
  forbids. What changed is that the band now says so on the page - "Nobody has said what lapsing
  these costs, so they cannot be ranked against the bands above" - instead of leaving the reader to
  infer that last means least important.
- **The truncation guard never followed the pages it was written for.** The one-word convention in
  section 6 comes from a measurement recorded in `tests/ui-on-call-boards.spec.ts`, and that spec
  measured label truncation on Contacts alone. The three pages re-cut because of the measurement -
  Admin, Orientation and Compliance - had no truncation coverage at all. They are now in that test's
  route list, measured at 320px and 390px. One boundary is worth knowing: the test can only measure
  the slots the current width band renders, so Admin's Leave appears only at the five-slot band and
  its Pay and Rosters never reach the bar at all, and Orientation's Departure and Unfiled likewise
  wait for that band. A word folded into the More sheet is not in the 48px row and cannot be clipped
  by it, so that is the right boundary rather than a hole.

### What the reviews did not close

- The misfiling half of the parse-failure defect, above.
- **The no-verdict gate covers two files and the band labels, not the mode.** `COMPLIANCE_SURFACES`
  in `tests/on-call-compliance.test.ts` is `src/lib/on-call/compliance.ts` and
  `src/components/on-call/on-call-compliance-section.tsx`. Compliance prose also lives in the home
  tile's description, the page summary and add hint in `on-call-section-page.tsx`, and the route
  metadata in `src/app/(search-app)/on-call/compliance/page.tsx`, and none of those is scanned. The
  home tile currently reads "What has to stay current", which the gate's own
  `(is|are|was|were|still|remains?|stays?)\s+current` pattern would match if it were pointed at that
  file. It is arguably describing the obligation rather than the reader, which is the distinction the
  gate's own comment draws and allows - but the distinction is currently being drawn by nobody,
  which is the state the gate exists to end.
- **The card exclusion has no test.** `selectCardEntries` excludes compliance rows by name, and
  `tests/on-call-card.test.ts` covers personal, stale and both-together but not this. The line most
  explicitly described in its own comment as belt-and-braces is the one nothing would notice the
  removal of.

## What would have to change to make Compliance a real section

Recorded so the work is costed honestly, not so it gets done.

**The database change.**

1. **A new migration — never an edit to the existing one.** A migration on `main` has been
   applied to the live database, and changing the file cannot change what was applied.
   `npm run check:migration-immutability` hashes every shipped migration and fails on any edit.
   The new file needs the newest timestamp and must target role `postgres`
   (`npm run check:migration-role`).
2. **Drop and re-add the CHECK constraint, and backfill in the same transaction.** The
   integration applies each migration in one transaction, so the constraint change and the
   update that moves every row with `details->>'kind' = 'compliance'` across to the new section
   must both succeed or neither does. Nothing here may be a bare `CREATE INDEX CONCURRENTLY`:
   it cannot run inside a transaction, so it fails outright.
3. **Check `unique (owner_id, section, slug)` and `on_call_entries_owner_section_idx`.** Moving
   rows between sections changes their uniqueness scope. On today's data it only relaxes, but it
   is the kind of thing that is obvious before the write and expensive after it.

**The code change.** Adding `"compliance"` to `ON_CALL_SECTIONS` makes several `Record<OnCallSection, …>`
maps fail to compile, which is the good case — TypeScript names most of the work:
`ON_CALL_SECTION_TITLES`, `ON_CALL_SECTION_ICONS`, `ON_CALL_SECTION_TILE_DESCRIPTIONS` and
`ON_CALL_SECTION_HREFS` in `on-call-section-identity.ts`, and `detailsSchemas` in
`entry-model.ts`, which would need `logisticsDetails` split into two. Beyond the compiler:
`onCallViewStorageSection` loses its compliance branch, `OnCallPageView` collapses back to the
section union, `partitionLogisticsEntries` and `isComplianceEntry` disappear, and every caller
of them needs re-reading rather than deleting.

One test fails in a way worth knowing in advance: `tests/on-call-migration-contract.test.ts`
asserts every value of `ON_CALL_SECTIONS` appears in
`supabase/migrations/20260904120000_on_call_entries.sql` — that one file and no other. A seventh
section makes it red until it is taught to read the new migration too.

**The process, which is the part that actually makes this expensive.**

- A PR touching `supabase/` is **owner-merged, never agent-merged**. The required
  `Owner approval` status stays pending until Josh adds the `owner-approved` label himself after
  the latest push. Agents must never add that label, merge the PR, or arm auto-merge on it.
- Merge approval **is** production-deploy approval. PR metadata must never promise a deferred
  deploy; `scripts/pr-policy.mjs` hard-blocks that claim on any PR touching
  `supabase/migrations/**` and quotes the offending phrase back.
- The schema-application gate is the post-merge `live-drift` workflow
  (`.github/workflows/live-drift.yml`), which must finish with both `npm run check:drift` and
  `npm run check:migration-history` green. `supabase migration list` is not that gate — it reads
  recorded history only, so it cannot tell an applied migration from a history row whose
  statements never ran.
- Automatic branching is on, so the PR spins up a preview database. Supabase warns that
  Branching Compute is not covered by the organisation's spend cap.
- **The guard-migration contract applies if — and only if — any history repair is involved**: a
  mark-applied version, `supabase migration repair --status applied`, or hand-applied SQL later
  recorded as a migration. A clean new migration applied by the integration does not by itself
  require a validation guard. Full text in `AGENTS.md` under "Supabase project safety", and
  `docs/database-drift-detection.md`.

**What it would buy.** A tidier enum, and a schema that can refuse the mixed shape described in
section 2. What it costs is an irreversible write to a live clinical database, an owner-blocking
merge, and a backfill. The current arrangement costs one documented hazard, closed in two places
and pinned by tests. Until the two shapes genuinely diverge, that is the cheaper side of the
trade — and it is a trade that can be made later, whereas the migration cannot be unmade.

## What this does not decide

- The route segment stays `/on-call/logistics` for the Admin page. Renaming it is cosmetic and
  would break any link a reader has already kept.
- Nothing here touches the Change B work — sites, the `forms` section value, the Shift module —
  which is still waiting on its own migration.
- Nothing here adds a check against any issuing body, and section 4 is the reason: the moment
  this app contacts a register, the wording rules change, and they would need rewriting from the
  clinical-governance question outward rather than patched.

## Invited service handbook addition — 23 September 2026

`/on-call/service` adds a separate service/site workspace. It does not import or
republish legacy public entries, private compliance or CME records. Membership is
invitation-based after a doctor creates their service; invitations expire within seven
days and are shared explicitly by the administrator. Member, editor and administrator
roles are separate from the designated clinical-review capability.

All server reads and writes check current membership. Operational entries can be
published by editors. Clinical and legal revisions require a different designated
reviewer; an existing published revision remains available while its replacement is
reviewed. Revision conflicts fail visibly rather than overwriting a newer edit. Members
can flag incorrect information into the editor queue. Personal orientation completion
is scoped to doctor, service, site, rotation and published revision.

The handbook starts with linked official WA resources and blank documentation
structures. Local numbers, referral requirements and procedures are editor-supplied;
the app does not infer a roster or certify a clinician's compliance. Templates copy
blank headings only and provide no patient-note storage workflow. Service information
is not persisted in the legacy browser cache. Approved offline packs remain a later
feature; this addition makes no offline availability promise.

Database isolation and publishing checks use a disposable local database. The new
migration remains subject to owner merge and the production rules above; local checks
do not establish hosted acceptance.
