# On Call: plan to complete the health-service rebuild

**Written 2026-09-27, after the rebuild merged (#3110).** This is the remaining work, in order,
with the condition each piece waits on. The full design and task detail are in the build plan
(round 6), which this plan does not repeat.

## Where it stands

Merged to main:

- **Shared mode kit (#3115).** This is `src/components/mode-kit/`. Every mode imports it.
- **On Call rebuild (#3110):**
  - **Now:** the hospital line, the pinned emergency number, the "Right now" panel, Needs you,
    Your usual, your team and the footer.
  - **Call:** numbers by department, External lines and Mine. It has "Didn't connect", the
    fixed-reason report and the hospital-phone switch.
  - **Refer** and **Find**.
  - **Manage service:** CSV import with a preview, "What needs checking" and batch publish.
  - **Who's on:** built, but hidden (`ON_CALL_WHOS_ON_ENABLED=false`).
  - **Crisis lines:** 000, MHERL and Lifeline show in the client pages' data-loading, signed-out and failure states. The route-level `on-call/loading.tsx` fallback still needs these contacts.
  - **Device storage:** the device keeps only ids, times, yes/no flags and the reader's team
    name, and every key is on the sign-out wipe list.

What is not built yet, and why:

| Piece                              | Waits on                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| Database drift check after Stage B | #3117 merged; verify the applied database schema against the migration before using it |
| Offline hospital copy (lane D)     | Owner's typed decision and the privacy-design prerequisites below                      |
| Stage C features                   | Stage B post-merge drift check                                                         |
| Names on Who's on                  | The owner's "go ahead with the names" and a privacy review                             |

## Step 1: small follow-ups (no approval needed, one PR)

1. **Demo numbers.** Move the demo handbook and hint numbers (`9000 00xx`, `0400 000 xxx`) into
   ACMA's reserved fictitious ranges, so no demo number can ring a real service.
2. **One crisis-line component.** Now and Call each have their own crisis-line component. Merge
   them into one, so the two lists cannot drift apart.
3. **Unused search box.** `OnCallSearchBox` is no longer used by any page, because Now has no
   search (ruling F6). Prefer reusing it where useful. If retirement is chosen, defer deletion of
   the exported component and its test until `npm run check:dead-code-candidate` permits deletion
   and the owner gives typed approval. Check the test-removal guard before deleting the test.

Proof: focused Vitest on the touched files, `npm run check:dead-code-candidate` for any proposed
deletion, then CI.

## Step 2: Shifts and Calendar route move (complete in #3118)

PR #3118 moved the routes to `/roster/shifts` and `/roster/calendar`, removed the old On Call
navigation rows and pages, and added redirects from the old URLs in `src/proxy.ts`.

## Step 3: Stage B database items (merged in Roster's PR #3117)

On Call adds no migration of its own. Its items travel as file 2 of Roster's combined database PR:

- `published_at` and `last_confirmed_at`, plus an `entry.confirm` action.
- A full replacement of `on_call_service_command` that keeps the join-order fix. It adds:
  - the `playbook` and `cover` sections, both forced to `kind in ('clinical','legal')`;
  - the `steps` and `cover` keys.
- A reviewer's team scope, so a ladder can only be approved by a reviewer from its own team.
- A yearly membership recheck.
- A short hospital notice for each site.
- The after-hours times for each site, set through `site.update`.
- The ladder wait on each step (`waitMinutes`, 1 to 120).
- The `invitation.create` `issuedViaMode` fix.

PR #3117 is merged, and `20260926225309_on_call_service_items.sql` contains these items.
Before depending on the new schema, record the post-merge database drift result. Do not edit
the already-applied migration; any further SQL needs a new migration. For future `supabase/`
PRs, only the owner merges during an approved deployment window; never enable auto-merge,
because merging applies migrations to the live clinical database within seconds.

**App follow-up once it merges** (a small PR in `service-page.tsx`):

- The invite form asks for the invitee's work email.
- An editor's invites offer "Member" only.
- The success message reads "This invite works only for <email>".
- The member list shows `display_name`, and falls back to "Member".
- The stated limits become 5,000 members and 1,000 invites.

## Step 4: Stage C (after Stage B post-merge drift check; each item is its own small PR)

1. **Playbook ladders from the handbook.**
   - Ladders are hospital-wide for the pilot.
   - Each step shows who, the number and when, and nothing clinical.
   - Near changeover, both roles show.
   - A call from a ladder step is marked on the device only ("Called 02:14").
2. **After-hours times and ladder waits in the UI.** Now and Call switch to after-hours roles and
   times only when the hospital has set its times. Until then they show nothing extra, as now.
3. **Roster-site prompt.** When today's rostered site differs from the chosen hospital, Now asks
   whether to switch.
4. **Who's on, switched on.**
   - Editors record `cover` rows in Manage service.
   - Who's on and Your team read those rows.
   - Then set `ON_CALL_WHOS_ON_ENABLED = true`.
5. **"Still correct" button.** It uses `entry.confirm`, and readers then see "Confirmed <date>"
   beside "Updated <date>".
6. **"What changed since your last shift"** on Now. It uses `published_at`.
7. **Share a number, and editor photos.** Only if the pilot asks for them.

## Step 5: offline hospital copy (lane D, blocked)

The owner's typed decision is required but is not sufficient to begin storage. Before building
the broader offline copy, complete a threat model, privacy review and product decision, define
the data lifecycle and access expiry, revocation/logout and multi-tab cleanup (including devices
that remain offline), browser fallback, accessible consent UX, and targeted offline/update tests.
Keep the existing public-only offline policy in `docs/pwa.md` until those controls are approved
and implemented. Then obtain the owner's typed decision:

> "I approve keeping a copy of my hospital's published On Call numbers and downtime plan on the
> phone, for up to 7 days, deleted at sign-out."

Until then:

- the offline page shows the crisis numbers and the Act pack only;
- Now's Systems down line says the plan needs a connection.

Once those prerequisites and the typed decision are complete, the proposed work is:

- `handbook-offline.ts`, which saves at most 60 items for at most 7 days. Using the existing
  `onCallHandbookOfflineStorageKey` provides a sign-out wipe, but expiry and revocation while
  offline also need an enforceable access and cleanup design.
- A saved-copy block in `offline.html`, inside the one inline script, with the CSP hash
  recomputed.
- The kit's number rule, used in place of the page's own number rule.
- Changes to `docs/pwa.md` and its tests.

Close the route-level crisis-line gap: `src/app/(search-app)/on-call/loading.tsx` currently shows
only a skeleton. Add 000, MHERL and Lifeline to that loading boundary and cover it with a
focused route-loading test before treating crisis lines as available in every loading state.

## Step 6: before real staff data

- **P1 #F9HZEG.** Close the two-user staging isolation proof for On Call before any real hospital
  or staff data goes in.
- **Pilot hosting.** The pilot still runs on servers in Singapore. Decide whether that is
  acceptable before real staff data is loaded.

## Always true

- **Approvals.** Josh alone approves any live-database merge, clinical wording, a typed offline
  sentence, a file deletion or provider spend.
- **Public repository.** This repository is public, so no patient data and no real hospital
  numbers go in it.
- **Design standard.** All work follows design standard v13.3 and the mode kit. Numbers and type
  are never bold.
