# Recovery and publication — 27 September 2026

The previous checkout disappeared before publication. The complete recorded file inventory was restored from the saved edits at the same base commit into `C:/Users/joshs/.codex/worktrees/on-call-publication/Database`, branch `codex/on-call-publication`.

The restored tracked diff matches the recorded 46 files, 622 insertions and 206 deletions. Generated site-map and repository-awareness documents match their recorded Git content hashes. The original screenshots and build cache were not recovered.

The checks below are historical results from before the checkout disappeared. Tests, build, lint and typecheck were not rerun on this recovered checkout for the owner's bare PR publication request. GitHub checks and review remain outstanding. The owner has now authorised committing, pushing and opening the PR; merge, deployment, providers and the separately gated features remain outside that approval.

---

# Current local continuation — 27 September 2026

The original plan below is retained as historical intent. This section supersedes its status claims.

- Workspace: `C:/Users/joshs/.codex/worktrees/on-call-recovery/Database`, branch `codex/on-call-recovery`, base `7e928ae3eb0df5f11c38a055737bb215668ef37b`.
- The previous `on-call-completion` checkout was no longer available. Its uncommitted Step 1 changes were reconstructed here against current main; the primary checkout was preserved.
- Stage B #3117 is merged at `ce549810295a16c6ef186fb44d04e5e401f4392e`. Post-merge [live drift run 36294704486](https://github.com/BigSimmo/PsychSift/actions/runs/36294704486) succeeded, including schema drift and migration-history checks. This was inspected during continuation, not rerun.
- Josh approved local API changes and mocked tests. No new provider calls, migrations, commits, pushes, publication, merge or deployment are authorised by that approval.

## Implemented locally

- Reserved synthetic hospital numbers, one crisis list, connection-only downtime wording and hospital-phone fallback.
- Existing Roster navigation retained; compatibility pages restore old On Call shifts/calendar bookmarks.
- Strict ladder, role-cover, hospital-time and confirmation action validation matching the merged SQL. Source/review and revision safeguards remain.
- Editors can author role-only cover and ordered ladders with optional hospital-set waits, and configure after-hours times. No new treatment instructions or staff-name field.
- Readers see published ladders, local call timestamps, current cover and both roles within 15 minutes of a recorded changeover. Unknown hours never imply a default period. Who's on is enabled after local editor/time/permission proof.
- Published and confirmed dates stay separate from draft saves. Still correct targets the displayed published revision and respects reviewer/editor permissions.
- Now prompts on a roster workplace mismatch without auto-switching; published changes use the end of the latest completed roster shift.
- Editor invitations offer Member only; success identifies the restricted email, and admin member labels use displayName or Member.
- Reader filtering prevents a draft moved to this hospital from exposing a published entry belonging to another site.

## Verification and completion

- Focused final batch: 12 files / 203 tests passed in 20.15 seconds. Earlier complementary batch: 15 files passed, with the two failures confined to an accidentally over-broad test assertion; those assertions were repaired and passed in the final batch. Earlier API, editor, governance, cover/time and handbook results remain valid unless their inputs change.
- Typecheck passed. Focused ESLint identified one test variable name and an unnecessary hook dependency; both were corrected and their focused lint passed.
- Final diff integrity passed: 23/23 checker self-tests; 16 changed test files, 156 to 179 cases, base `7e928ae3e`.
- `npm run check:production-readiness` failed at `check:privacy-readiness:release`: OpenAI ZDR/DPA, Railway DPA, APP8 cross-border basis, APP1/APP5 notices pending; PHI minimisation partial. No privacy records were changed to manufacture a pass.
- `npm run ensure` started the isolated offline demo at `http://localhost:4109`. Interactive app-browser access was blocked by `ERR_BLOCKED_BY_CLIENT`; this is not visual proof.
- Owning Chromium specs passed: **26 tests in 27.3 seconds**, after an isolated production build: `tests/ui-on-call-now.spec.ts`, `tests/ui-on-call-call.spec.ts`, `tests/ui-on-call-service.spec.ts`. Build cache ID: `on-call-stage-c`.
- Follow-up review found that the review queue needed to display all structured fields before approval. Added a shared read-only ladder/cover preview to the review queue and handbook, plus a regression for cover titles with prefixes. The direct follow-up batch passed **6 files / 31 tests** in 10.50 seconds, including the new roster prompt/publication-date tests and confirmation permissions.
- Inspected the generated 390px and 1440px Playbook screenshots: clear hospital context, visible numbers, source dates and keyboard focus, without horizontal overflow. Copies are retained under `.local/on-call-proof/`. Browser assertions also covered widths 320, 390, 639, 768, 1440 and 1920, reduced motion and forced colors.
- The temporary development server was stopped after the interactive browser blocked access. The browser wrapper owns and cleans up its separate server.
- Final Manage service browser recheck passed: **8 tests in 12.0 seconds**, including structured cover/ladder review at 320px, after a fresh production build into the existing cache. Final focused ESLint passed for all eight late-change files.
- Authorised local implementation is complete. Publication, real-service acceptance and the separately gated features below remain outside this completion.

## Remaining boundaries

No offline hospital copy without the exact typed approval sentence in the original plan. No named cover, real staff data, two-user hosted isolation test or hosting acceptance without the separately specified approval. The unused search component remains because deletion was not authorised. Publication and deployment are not performed. Browser emulation does not prove physical devices.

---

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
  - **Crisis lines:** 000, MHERL and Lifeline show in every loading, signed-out and failure state.
  - **Device storage:** the device keeps only ids, times, yes/no flags and the reader's team
    name, and every key is on the sign-out wipe list.

What is not built yet, and why:

| Piece                                  | Waits on                                                         |
| -------------------------------------- | ---------------------------------------------------------------- |
| Database items (Stage B)               | Roster's combined database PR (#3117); the owner merges it       |
| Offline hospital copy (lane D)         | The owner's typed offline sentence (a tapped card is not enough) |
| Shifts and Calendar links to `/roster` | Roster's app routes reaching main                                |
| Stage C features                       | Stage B merged                                                   |
| Names on Who's on                      | The owner's "go ahead with the names" and a privacy review       |

## Step 1: small follow-ups (no approval needed, one PR)

1. **Demo numbers.** Move the demo handbook and hint numbers (`9000 00xx`, `0400 000 xxx`) into
   ACMA's reserved fictitious ranges, so no demo number can ring a real service.
2. **One crisis-line component.** Now and Call each have their own crisis-line component. Merge
   them into one, so the two lists cannot drift apart.
3. **Unused search box.** `OnCallSearchBox` is no longer used by any page, because Now has no
   search (ruling F6). Retire it and its test, or reuse it. Deleting files needs the owner's typed
   OK, so ask first.

Proof: focused Vitest on the touched files, then CI.

## Step 2: flip Shifts and Calendar (when Roster's routes land)

When Roster's app PR puts `/roster/*` on main, change the two "More" links in
`src/lib/mode-secondary-navigation.ts` (the `shifts` and `calendar` rows and their two route-map
entries) from `/on-call/shifts` and `/on-call/calendar` to Roster's routes. Whichever of the two
PRs lands second makes the change. Leave `src/app/on-call/shifts/page.tsx` and
`src/app/on-call/calendar/page.tsx` alone unless Roster's plan retires them.

## Step 3: Stage B database items (inside Roster's PR #3117; the owner merges)

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

Merging a `supabase/` PR applies it to the live clinical database within seconds, so only the
owner merges it.

**App follow-up once it merges** (a small PR in `service-page.tsx`):

- The invite form asks for the invitee's work email.
- An editor's invites offer "Member" only.
- The success message reads "This invite works only for <email>".
- The member list shows `display_name`, and falls back to "Member".
- The stated limits become 5,000 members and 1,000 invites.

## Step 4: Stage C (after Stage B merges; each item is its own small PR)

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

This starts only after the owner types:

> "I approve keeping a copy of my hospital's published On Call numbers and downtime plan on the
> phone, for up to 7 days, deleted at sign-out."

Until then:

- the offline page shows the crisis numbers and the Act pack only;
- Now's Systems down line says the plan needs a connection.

Once approved, the work is:

- `handbook-offline.ts`, which saves at most 60 items for at most 7 days. It uses the existing
  `onCallHandbookOfflineStorageKey`, so sign-out already wipes it.
- A saved-copy block in `offline.html`, inside the one inline script, with the CSP hash
  recomputed.
- The kit's number rule, used in place of the page's own number rule.
- Changes to `docs/pwa.md` and its tests.

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
