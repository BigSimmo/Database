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
| Audience for v1           | The owner alone                                                                                                   | Cohort sharing. The app has exactly two visibility states, owner-only and fully public, and `psychiatry.tools` has no login wall, so the only available "share" would publish a hospital's internal contacts to the open internet. Deferred to its own reviewed project (§11) |
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

Every route resolves the owner from the validated session, never from the request body.
Signed out, in production, GET returns an empty set with a `signedOut` marker and the writes
return 401 — no fixtures, no sample entries. Demo mode (no Supabase configured) serves an
obviously synthetic, non-clinical fixture set so the offline demo still shows a working mode.

## 6. Client behaviour

**Search is local.** One search box covers all six sections at once, filtering the entry set
the page already holds. A single owner's hub is small enough that this is both correct and
instant — and because it needs no network, search keeps working offline.

**Offline.** On a successful fetch, the entry set is written to browser storage. When the
network fails, the page renders the cached copy behind an explicit banner naming the date it
was saved. The cache is cleared on sign-out, so personal numbers do not outlive the session
on a shared machine.

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

Each of these gets a test (§9).

## 8. Mode registration

Adding a mode touches roughly sixty files, because the app is built so a mode cannot be
half-added: about thirty registries and maps in `src/lib`, about ten components, and about
twenty tests that each hold a complete list of all sixteen modes.

- Mode id `on-call`, label `On Call`, namespace-isolated at `/on-call`, which owns a real
  home rather than redirecting to the shared home.
- A new search kind `on-call`, results surface `results-band`.
- Routes: `/on-call`, `/on-call/search`, and one page per section, plus `/on-call/card`,
  a `layout.tsx`, and a `loading.tsx` rendering `ModeHomeRouteLoading`.
- Secondary navigation carries the **six sections only**. No `Search` tab: the composer is
  already on screen, and the registry's own notes record that a lone search button in a nav
  landmark is a wasted tab stop. The printable card is reached from Contacts, not the nav.
- No dynamic `[slug]` route in v1. Entries expand in place, which keeps the mode clear of the
  dynamic-route reachability gate and its explicit route list.
- Generated artefacts to refresh: the site map, the repo-awareness snapshot, the
  design-system adoption manifest, and the codebase index. Several docs carry the number
  sixteen and need updating.

## 9. Testing

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

## 10. Verification and deployment

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

## 11. Explicitly out of scope

Recorded here so they are decisions rather than omissions:

- **Cohort sharing.** Deferred to its own project. It requires a group-membership concept the
  database does not have, in the area with the most tenancy history.
- **Rosters.**
- **Hosting recordings.**
- **Any patient information.** This mode stores none, and nothing in it should invite it.
