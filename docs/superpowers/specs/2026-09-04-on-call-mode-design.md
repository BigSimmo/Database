# On Call mode — design

Status: draft for owner review
Date: 2026-09-04
Owner decisions captured in session `claude/on-call-mode-health-n17dvm`

## 1. What this is

A seventeenth app mode, `on-call`, giving a junior doctor one place for the operational
knowledge a shift needs: orientation manuals, contacts, referral pathways, teaching, an
escalation playbook, and site logistics.

It is an **owner-scoped operational reference**. It is not clinical decision support, it
stores no patient information, and it never authors clinical guidance in the app's own voice.

## 2. Decisions taken, and what they rule out

| Decision                  | Chosen                                                                                                            | Rejected, and why                                                                                                                                                                                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where content lives       | Private rows in Supabase, owner-scoped, edited in the app                                                         | Committing real contacts/manuals into the repository — exposes internal service information to anyone with repo access and makes every correction a code change                                                                                                               |
| Audience for v1           | The owner alone                                                                                                   | Cohort sharing. The app has exactly two visibility states, owner-only and fully public, and `psychiatry.tools` has no login wall, so the only available "share" would publish a hospital's internal contacts to the open internet. Deferred to its own reviewed project (§12) |
| Referrals list            | On Call keeps its own list                                                                                        | Reusing the Services registry — the owner asked for a separate list shaped for on-call use                                                                                                                                                                                    |
| Orientation manuals       | The uploaded PDF is the source of truth; the owner may pin a short summary above it, labelled as the owner's note | Retyping manual content as app pages — creates a second copy that silently drifts from the real manual                                                                                                                                                                        |
| Rosters                   | Not built                                                                                                         | A hand-maintained "who is on tonight" decays within a fortnight, and its failure mode is a junior calling the wrong person in an emergency. Role-based contacts give the same benefit without decay                                                                           |
| Education recordings      | Linked to where they already live                                                                                 | Hosting video — duplicates the recording _and_ its access control                                                                                                                                                                                                             |
| Playbook clinical content | Only links to the owner's own uploaded guidelines, each shown with its title and date                             | App-authored management steps — the constraint this whole codebase exists to enforce                                                                                                                                                                                          |
| Signed-out behaviour      | Generic section names plus a sign-in prompt; no entry content                                                     | Synthetic sample entries in production — entry content leaks facts about the service                                                                                                                                                                                          |
| Offline                   | Contacts readable with no signal, from a local cached copy                                                        | Full offline for all six sections — manuals and recordings are not the emergency                                                                                                                                                                                              |
| Editing                   | In-app create, edit, delete                                                                                       | Developer-entered content — guarantees the hub goes stale                                                                                                                                                                                                                     |
| Delivery                  | All six sections at once                                                                                          | Half the sections — the mode-registration cost is paid once regardless, so the extra sections are mostly presentation                                                                                                                                                         |
| Freshness                 | Every entry carries a last-checked date and shows an unmissable stale state after **12 months**                   | Silent rot                                                                                                                                                                                                                                                                    |
| Print                     | A one-page essentials card, personal details excluded                                                             | No print — juniors carry paper, and it is the safe way to share while group access does not exist                                                                                                                                                                             |

## 3. Sections

Six sections, one underlying entry store. Adding a seventh later is cheap.

1. **Orientation** — manuals held as documents in the existing corpus, each optionally
   carrying the owner's own pinned summary, visibly attributed to the owner.
2. **Contacts** — filed by **role** first (`after-hours registrar`, `Ward 4B`), so entries
   survive rotations. A contact may additionally carry a person's name and direct number;
   those are flagged personal and are excluded from the printable card and any export.
3. **Referrals & Services** — its own list: who a service accepts, exclusions, catchment,
   hours, how to refer, and the number to ring.
4. **Education** — the teaching calendar: what, when, who presents, what it covers, and a
   link out to the recording where it already lives.
5. **Playbook** — the escalation ladder as plain administrative fact, plus scenario cards.
   Every clinical statement is a link to one of the owner's own guideline documents. Where no
   local guideline is linked, the card states that and offers a Documents search. It must
   never fall through to app-written clinical content.
6. **Logistics & Survival** — parking, after-hours food, call rooms, IT, rostering, payroll,
   leave.

## 4. Data

One table, `public.on_call_entries`, following the `clinical_registry_records` template
(`supabase/migrations/20260703020000_clinical_registry_records.sql`) exactly.

```
id                  uuid primary key default gen_random_uuid()
owner_id            uuid not null references auth.users(id) on delete cascade
section             text not null check (section in
                      ('orientation','contacts','referrals','education','playbook','logistics'))
slug                text not null check (btrim(slug) <> '')
title               text not null check (btrim(title) <> '')
subtitle            text
body                text
details             jsonb not null default '{}'::jsonb
linked_document_ids uuid[] not null default '{}'
tags                text[] not null default '{}'
is_personal         boolean not null default false
include_on_card     boolean not null default false
sort_order          integer not null default 0
last_verified_at    timestamptz
created_at          timestamptz not null default now()
updated_at          timestamptz not null default now()
unique (owner_id, section, slug)
index on (owner_id, section, sort_order, title)
before update trigger -> public.set_updated_at()
```

`owner_id` is **NOT NULL**: this table has no public state, by design. A null owner carries
no visibility meaning here, unlike `documents`.

Row-level security follows the repository's established model: RLS enabled, all privileges
revoked from `anon` and `authenticated`, granted to `service_role` only, with a single
service-role policy. Ownership is enforced in the API layer, and the owner predicate rides
the same fluent query chain as the `.from()` call so `npm run check:owner-scope` can prove it.

### Section-specific `details`

Validated with Zod per section; unknown keys rejected.

- **orientation** — `{ pinnedSummaryIsOwnerNote: true }` (the summary text lives in `body`;
  the flag exists so the renderer cannot forget the attribution)
- **contacts** — `{ role, phone?, extension?, afterHoursPhone?, pager?, contactName?, availability? }`
- **referrals** — `{ accepts: string[], exclusions: string[], catchment?, hours?, howToRefer?, phone?, fax?, referralFormUrl? }`
- **education** — `{ recurrence?, nextOccurrence?, presenter?, location?, recordingUrl?, topics: string[] }`
- **playbook** — `{ trigger, escalationSteps: { order, whoToCall, when, phone? }[] }`
- **logistics** — `{ category, location?, hours?, phone?, url? }`

### Freshness

`ON_CALL_REVIEW_INTERVAL_MONTHS = 12`. An entry is **stale** when
`last_verified_at` is null or older than twelve months. Staleness is derived at read time —
never stored — so changing the interval never requires a migration or a backfill.

Stale entries render an unmissable state, are sorted to the top of a "needs checking" group,
and are excluded from the printable card. A one-tap "still correct" action stamps
`last_verified_at`.

## 5. Server surface

| Route                              | Method | Behaviour                                       |
| ---------------------------------- | ------ | ----------------------------------------------- |
| `/api/on-call/entries`             | GET    | Owner's entries, optionally filtered by section |
| `/api/on-call/entries`             | POST   | Create                                          |
| `/api/on-call/entries/[id]`        | PATCH  | Update                                          |
| `/api/on-call/entries/[id]`        | DELETE | Delete                                          |
| `/api/on-call/entries/[id]/verify` | POST   | Stamp `last_verified_at = now()`                |

Reads resolve the caller through `publicAccessContext` (the helper that already handles the
anonymous case for the registry routes); writes require an authenticated user. Either way the
owner comes from the validated session, never from the request body.
Signed out, in production, GET returns an empty set with a `signedOut` marker and the writes
return 401 — no fixtures, no sample entries. Demo mode (no Supabase configured) serves an
obviously synthetic, non-clinical fixture set so the offline demo still shows a working mode.

## 6. Client behaviour

**Search is local.** One search box covers all six sections at once, filtering the entry set
the page already holds. A single owner's hub is small enough that this is both correct and
instant — and because it needs no network, search keeps working offline.

**Offline.** On a successful fetch, the entry set is written to browser storage through the
existing `createBrowserStore` helper (`src/lib/client-store-factory.ts`), following
`saved-registry-storage.ts` as the precedent rather than introducing a new storage mechanism.
When the network fails, the page renders the cached copy behind an explicit banner naming the
date it was saved. The cache is cleared on sign-out, so personal numbers do not outlive the
session on a shared machine.

**Printable card.** `/on-call/card` renders a print-styled single page of the contacts
flagged `include_on_card`, excluding anything flagged personal and anything stale.

## 7. Clinical-safety constraints

These are requirements, not preferences.

1. No component in this mode ships hard-coded clinical instruction text.
2. Playbook scenario cards render clinical guidance **only** as links to documents in the
   owner's corpus, each shown with the document's title and date.
3. A scenario with no linked guideline renders an explicit "no local guideline linked" state.
   It must not substitute a generated answer.
4. The owner's pinned orientation summaries are always visibly attributed to the owner and
   never presented as the manual's words.
5. Demo fixtures contain no clinical guidance of any kind.

Each of these gets a test (§10).

## 8. Design and phone behaviour

### 8.1 It borrows; it does not invent

On Call introduces no new colours, type sizes, spacing values or motion. It cannot: the
design gates hold thirteen metrics at hard zero, and a new page fails on a raw hex, a
`shadow-md`, arbitrary tracking or a hardcoded duration. The practical effect is that On Call
looks like the rest of the app from its first commit.

Two identity entries are needed: a glyph in `APP_MODE_ICON`, which must be unique across all
modes because a test compares them pairwise, and an accent in `APP_MODE_ACCENT` drawn from the
category triads. The accent may never resolve to a danger, warning, success or info colour —
a category is not a status.

Every tap target is 48px. Never 44: `min-h-11` reintroduces a known browser-test flake, and
generic accessibility guidance does not override that. Metadata chips, filter rows and table
micro-actions may use the 40px compact rung, each with a comment saying why.

### 8.2 The shape of a page

The structural template is **Sources** (`src/components/sources/sources-pages.tsx`): four peer
browse surfaces rendered from one module off one data load. On Call copies that factoring so
six sections cannot drift into six divergent shells.

Each section page is `InformationPageShell` — reading width for prose, default width for lists
— headed by `InPageNavHeader`. The page's section table is exported from a colocated
`"use client"` sibling named for its route, which is the convention the chrome contract binds
new pages to.

`InPageNavHeader` supplies, consistently with the document viewer the owner already uses: a
back control, the page title with a chevron opening a section sheet on phones, the active
section named beneath the title in the mode accent, an ellipsis actions sheet, and a weighted
segment track along the bottom edge. It attaches beneath the universal phone header through
`PhoneHeaderCollapsePortal` and hides and reveals with that single owner. No second sticky
header, no second scroll-hide hook, no page-local dock reserve.

### 8.3 Home and navigation

The mode bar carries all six sections under short labels — Contacts, Playbook, Referrals,
Orientation, Teaching, Logistics. On phones it shows three and a More sheet, which is the
established pattern. On Call joins the adopted-nav set with a density profile, and its label
widths are proved by the browser test that exists for that purpose.

**If six labels fail the density evidence, the fallback is already decided**: the bar carries
Contacts, Playbook, Referrals and Orientation, and Teaching and Logistics are reached from the
home and from search. Nobody makes a fresh decision mid-build.

Contacts leads, because it is the page a shift actually opens.

### 8.4 Each page, designed for the thumb first

- **Contacts** — one scrolling column of role rows. The whole row is the tap target and the
  number is a `tel:` link, so ringing someone is a single tap. Rows group by area under sticky
  headings, and anything overdue for checking collects into a group at the top. This is the
  page built for one hand in a corridor; the desktop view is this widened, not a different
  design.
- **Playbook** — scenario cards opening to an escalation ladder: an ordered list of who, when,
  and a number to tap, then the linked local guidance with each document's title and date. A
  scenario with no linked guideline renders a real empty state offering a Documents search.
- **Referrals** — rows expanding to accepts, does not accept, catchment, hours, how to refer.
  Accepts and exclusions are labelled text, never colour-coded chips alone.
- **Orientation** — a shelf of documents. Where the owner has pinned a summary it sits above
  the document link in a bordered note, visibly attributed to the owner.
- **Education** — a list in order of next occurrence, each with its topics and, where one
  exists, a recording link marked as leaving the app.
- **Logistics** — the plainest page: grouped rows, each with a place, an hour range or a number.

### 8.5 States

- **Loading** — `ModeHomeRouteLoading` on the home; skeletons with stable geometry elsewhere.
  A spinner is never a terminal state.
- **Empty** — a real next action. For an empty section that action is adding the first entry.
- **Signed out** — the same empty-state component, naming sign-in as the action, showing no
  entry content.
- **Error** — never renders a count.
- **Stale** — carries a non-colour channel: an icon and the words "checked <date>". Status may
  never be signalled by colour alone, and a number is never painted in a status colour.
- **Offline** — a banner naming the date of the saved copy. Its announcement goes to a
  screen-reader-only live region; the visible banner is not itself a live region.

### 8.6 Search

`/on-call/search` wears the shared results band. The mode declares its results surface, which
makes the band mandatory rather than optional — the type system refuses the mode otherwise and
a contract test then requires the band to be mounted. Sort is a segmented control from tablet
width up; the phone filter is the badged trigger opening a sheet, never a native select. A
faulted search renders no count at all.

### 8.7 The printable card

`/on-call/card` follows the Dictionary record page: the print action lives in the actions
sheet, the page composes `PrintSection` with `BrowserPrintButton`, and it carries the shared
confidential-document footer. Excluded from the card: anything flagged personal, and anything
stale. Both exclusions are tests, not conventions.

### 8.8 Registration the design gates require

Beyond the mode registries in §9: an icon for every new navigation entry, a nav density
profile plus its recorded evidence, the section anchors asserted against rendered DOM, the new
routes added to the phone-scroll route lists, and every new page declared exactly once in the
design-system adoption contract with its five proofs — dark, forced colours, 320px, print, and
browser. Gate before push: the design-system contract, the type scale and the icon scale, then
`npm run verify:phone-chrome`.

## 9. Mode registration

Adding a mode touches roughly sixty files, because the app is built so a mode cannot be
half-added: about thirty registries and maps in `src/lib`, about ten components, and about
twenty tests that each hold a complete list of all sixteen modes.

- Mode id `on-call`, label `On Call`, namespace-isolated at `/on-call`. The home is the
  **shared home** at `/?mode=on-call`, with `/on-call` redirecting to it — the convention every
  recently added mode follows. An earlier draft of this spec had On Call owning a real home;
  that was wrong, and following the convention removes work rather than adding it.
- A new search kind `on-call`, results surface `results-band`.
- Routes: a `/on-call` redirect stub, `/on-call/search`, one page per section, `/on-call/card`,
  a `layout.tsx`, and a `loading.tsx` rendering `ModeHomeRouteLoading`.
- Secondary navigation carries the **six sections only**. No `Search` tab: the composer is
  already on screen, and the registry's own notes record that a lone search button in a nav
  landmark is a wasted tab stop. The printable card is reached from Contacts, not the nav.
  §8.3 settles what happens if six labels fail the density evidence.
- No dynamic `[slug]` route in v1. Entries expand in place, which keeps the mode clear of the
  dynamic-route reachability gate and its explicit route list.
- Generated artefacts to refresh: the site map, the repo-awareness snapshot, the
  design-system adoption manifest, and the codebase index. Several docs carry the number
  sixteen and need updating.

## 10. Testing

Test-first, per the repository's TDD practice.

**Unit** — per-section `details` validation; twelve-month staleness derivation including the
null case and the exact boundary; personal and stale exclusion from the printable card;
offline cache round-trip and its clear-on-sign-out; the signed-out empty payload.

**Component** — each of the six sections renders its entries; the signed-out state reveals no
entry content; the stale badge appears at the boundary; the offline banner names its date;
the playbook's "no local guideline" state; owner attribution on pinned summaries.

**Contract** — the mode-registry exhaustive lists; owner-scope proof for the new table and
routes; the results-band adoption contract; route reachability; the site map matching its
generator.

**Browser** — On Call reachable from the desktop sidebar and the phone mode sheet; the
contacts page usable on a phone viewport; the printable card route renders.

## 11. Verification and deployment

Local gate: `npm run verify:pr-local`, plus `npm run check:owner-scope` for the new table and
routes, and a focused browser run selected by `npm run plan:browser` rather than the full
suite. Formatting runs and is committed before push.

The PR body must carry `RAG impact: no retrieval behaviour change — new owner-scoped
operational content mode with local-only search; no change to retrieval, ranking, the RPCs,
or the eval fixtures.`

**Migration timing.** Merging a migration reaches the live clinical database within seconds,
with no deploy step in between. The migration in this change must be merged only inside an
approved window, auto-merge must not be armed on it, and the PR must not claim any deferred
deploy. After merge, the post-merge `live-drift` workflow is the gate that the schema
actually applied.

## 12. Explicitly out of scope

Recorded here so they are decisions rather than omissions:

- **Cohort sharing.** Deferred to its own project. It requires a group-membership concept the
  database does not have, in the area with the most tenancy history.
- **Rosters.**
- **Hosting recordings.**
- **Any patient information.** This mode stores none, and nothing in it should invite it.
