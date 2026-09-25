# WA Psychiatry Build: Fast-Lane Implementation Plan (v2)

> **For agentic workers:** the controller (main session) runs this plan. Each builder is a subagent working in its own git worktree on files no other builder touches. Builders never push, never open PRs and never dispatch subagents. After approval, copy this file to `docs/superpowers/plans/2026-09-25-wa-psychiatry-build.md` during integration.

## In plain English (for Josh)

Everything is built **at the same time, by about 10 builders**, then combined into **one pull request** that GitHub tests **once**. Version 1 of this plan built things in waves, with eight pull requests, a reviewer after every task, and an extra wait for your approvals. Almost all of its time was waiting. This version cuts that waiting out.

**Estimated time: about 2½ hours** from your approval to the pull request merging itself. That is an estimate, not a measurement.

**You can start signing off the 54 forms in about 20 minutes, while the rest is being built.** The sign-off tool is finished first. You need a terminal on your own computer for it; the how-to guide gives the exact commands.

**Approving this plan also confirms two things you'd otherwise be asked about later:**

1. **These seven crisis numbers go into the safety plan:**
   - 000
   - MHERL Metro 1300 555 788
   - MHERL Peel 1800 676 822
   - RuralLink 1800 552 002
   - Lifeline 13 11 14
   - Suicide Call Back Service 1300 659 467
   - 13YARN 13 92 76

   The first four were checked on 20 August 2026; the builder rechecks the last three on each service's own website.

2. **The offline privacy decision.** The offline page may hold only public, non-patient information: the crisis numbers above, and Act deadlines you have signed off, shown as quotes. Each item shows its source and the date it was checked. Nothing else is stored on the device: no searches, answers, documents or patient data.

**The safety rules stay exactly as they were:**

- Every Act time limit must match the Act word for word, or the build fails.
- New wording arrives marked "drafted".
- No agent can sign anything off.
- One clinical-safety review covers the whole change.
- No calls to paid services.

---

## Context

This implements the WA review's recommendations: the safety fixes, the sign-off tool, the Act timeline, Act coverage, WA prescribing and clozapine, country and Aboriginal coverage, and the offline pack. It sits inside existing modes, per the 2026-08-23 trust-first product rule. Version 2 was prompted by the owner asking for a major speed-up. The build work was about an hour; the rest was waiting on merge gates, a serial research gate, 8 CI runs (Production UI is 83–89% of CI wall clock, about 40 min per run), per-task review loops and 8 serial local full gates.

## What changed from v1, and why

| v1                                         | v2                                                                         | Time saved                        |
| ------------------------------------------ | -------------------------------------------------------------------------- | --------------------------------- |
| 3 waves, each waiting for PRs to merge     | Everything in parallel on one integration branch                           | Hours, or a day if main CI is red |
| 8 PRs, so 8 CI runs                        | 1 PR, 1 CI run                                                             | ~5 h of CI                        |
| One source-research task gating Wave 2     | Each builder sources its own topic; register fragments merged once         | ~1 h                              |
| Reviewer and up to 5 fix rounds per task   | 2 reviewers (clinical, code) over the combined diff, 1 fix pass            | ~1–2 h                            |
| `verify:pr-local` ×8, serialised           | ×1, run while the reviewers read                                           | ~1–2 h                            |
| Test-first for wording edits               | Test-first only for logic (timeline, routing, sign-off, offline generator) | ~30 min                           |
| Offline pack waits for a separate approval | Approved by approving this plan                                            | A human wait                      |
| Crisis numbers confirmed later             | Confirmed by approving this plan                                           | A human wait                      |
| Sign-off after everything lands            | Sign-off tool first; Josh signs during the build                           | Josh's hours overlap the build    |
| Opus for most builders                     | Sonnet except the timeline, sign-off and Act-sections builders             | Faster turns                      |

## Rulings made while rewriting (each would otherwise cause rework)

- **Interpreter and Aboriginal-liaison notes go in a new `data/forms-cultural-notes.json`**, not `data/forms-catalog.json`. The sign-off tool pins form content, so editing `forms-catalog.json` would silently invalidate Josh's sign-offs as he makes them. _Cost if wrong:_ the notes render from a second file (a small UI join).
- **The pregabalin fix moves from Task 1 to Task 6a,** so only one builder writes each medication record. _Cost if wrong:_ none; it's the same edit.
- **Task 6a and Task 6b both edit `data/medications-snapshot.json`,** but in disjoint records: 6b writes only inside the clozapine record, and 6a never touches it. Only 6a edits `tabSectionTypes`. _Cost if wrong:_ a JSON merge conflict at integration, resolved by hand.
- **Old Task 4 (the central research task) is dropped.** Its work is distributed to the builders. The crisis-line sources go to Task 1.

## Global constraints (every builder inherits these)

- **No agent ever records a sign-off.** `reviewedBy` and `reviewedAt` are written only by the owner running the sign-off CLI.
- **No statutory figure or clinical threshold from memory.** Every duration must be a verbatim substring of pinned Act text (`data/mha-2014-sections.source.json`) or of a registered source.
- **Every new clinical claim cites a source,** captured via `.claude/skills/sources/SKILL.md` (WA-first ladder, publisher metadata from the page, never from memory, and rejections recorded). **Builders do not edit `src/data/source-acquisitions.json`.** Each writes its entries, in the register's exact schema (`src/lib/sources/acquisition-ledger.ts`), to `/home/user/Database/.superpowers/sdd/plan/sources-<task>.json`. Nothing is marked adopted or attested. The Rockingham Peel clozapine guideline is rejected (#7VQ5RC).
- The "name instruments, never score them; defer thresholds to local protocol" rule stands. The Act timeline is the owner-approved exception, for statutory durations only, as quotes. **No dose calculators.**
- **Nothing touches** `supabase/`, the RAG ranking surfaces (`ragRankingPatterns` in `scripts/pr-policy.mjs`) or `src/lib/catalog-search.ts`. **No provider calls.** Public official web pages may be fetched.
- **One writer per file** (see the ownership table). Never `git add -A` or `git stash`.
- **Builders run only:** `npm run test:focused -- --files <comma list>` and their named domain check, then `npm run format`, then commit. The machine lock allows at most 2 concurrent focused runs; retry after 60 s if refused. **No** `verify:*`, browsers or `docs:update`. Generated docs are rebuilt once at integration. If the pre-commit hook regenerates docs, commit its output; clashes are resolved at integration by regenerating.
- **UI:** design tokens (no hex), `min-h-12` tap targets, every button wired, `<Link>` for internal navigation.
- **Commit trailer:**
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01RUxCKkmEUbdp17G5ArAnir`
  No model names anywhere else.

## Builder roster and file ownership

All builders start at the same time. Each has its own worktree (`git worktree add -b claude/sweet-carson-e7ur0s-<slug> .claude/worktrees/<slug> origin/main`, then `node scripts/setup-codex-worktree.mjs`, which copies dependencies and takes about 10 s).

| #   | Builder                                                | Model  | Worktree                                                                    | Owns                                                                                                                                                                                                                                            |
| --- | ------------------------------------------------------ | ------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Safety fixes                                           | Sonnet | `wa-safety` (resume; WIP commit `283ebf04a`)                                | `src/lib/crisis-contacts.ts`, `patient-safety-plan.tsx`, care-plan `fixtures.ts`/`types.ts`, `tools-catalog.ts`, their tests, `sources-t1.json`                                                                                                 |
| 2   | Services routing + Best fit                            | Sonnet | `wa-routing` (resume; WIP `e3c7e5023`)                                      | `service-urgent-routing.ts`, `service-best-fit.ts`, `services-navigator-page.tsx`, their tests                                                                                                                                                  |
| 3   | Sign-off tool **(first priority)**                     | Opus   | `wa-signoff` (resume; `7c877e6c1`, `6f60cfd9b`)                             | `scripts/review-clinical-record.mjs`, `scripts/lib/clinical-record-review-contract.mjs`, the review-sheet builder, the `--check` pin in `build-mha-act-sections.mjs`, `docs/clinical-sign-off-how-to.md`, the `package.json` script line, tests |
| 5a  | Act sections + "Act and Standards" page                | Opus   | `wa-act`                                                                    | `forms-act-section-cues.json` (or a supplemental list), `mha-2014-sections*.json`, `src/app/(search-app)/forms/act/**`, a new component, `sources-t5a.json`                                                                                     |
| 5c  | Chief Psychiatrist Standards data                      | Sonnet | `wa-standards`                                                              | `data/chief-psychiatrist-standards.json` only, `sources-t5c.json`                                                                                                                                                                               |
| 5b  | MHA quoted timeline                                    | Opus   | `wa-timeline`                                                               | `data/mha-timeframes.json`, `src/lib/mha-timeline.ts`, `mha-timeline-panel.tsx`, `form-detail-page.tsx`, the hazard-doc entry, tests                                                                                                            |
| 6a  | WA prescribing + pregabalin/alprazolam                 | Sonnet | `wa-prescribing`                                                            | `wa` sections in non-clozapine records of `medications-snapshot.json`, `medication-nav-header.tsx`, tests, `sources-t6a.json`                                                                                                                   |
| 6b  | Clozapine reference                                    | Sonnet | `wa-clozapine`                                                              | the clozapine record in `medications-snapshot.json` only, `sources-t6b.json`                                                                                                                                                                    |
| 7a  | Country / Aboriginal / specialty services              | Sonnet | `wa-services`                                                               | `src/lib/services-canonical-data/part-08.ts`, a validity test, `sources-t7a.json`                                                                                                                                                               |
| 7b  | Translated factsheet links + interpreter/liaison notes | Sonnet | `wa-cultural`                                                               | `factsheets-data.ts`, `data/forms-cultural-notes.json`, a small render hook in `form-priority-facts-section.tsx`, tests, `sources-t7b.json`                                                                                                     |
| 8   | Offline pocket pack                                    | Sonnet | `wa-offline` (based on the `wa-safety` WIP commit for `WA_CRISIS_CONTACTS`) | `public/offline.html`, `public/sw.js` `CACHE_VERSION`, `docs/pwa.md` decision record, a generator script, tests                                                                                                                                 |

**Shared-interface contracts** (fixed now, so builders don't wait on each other):

- `WA_CRISIS_CONTACTS`: an array of `PublicCrisisContact` `{id, name, telephoneDisplay, telephoneUri, coverage, availability, isEmergencyService, caveat, sourceUrl, verifiedOn}`, exported from `src/lib/crisis-contacts.ts`. It exists in WIP commit `283ebf04a`.
- `data/mha-timeframes.json`: `{exportMetadata, entries:[{id, formCodes[], trigger, section, quote, duration:{value, unit:"hours"|"days"}, anchor, status:"drafted"|"reviewed", reviewedBy, reviewedAt, reviewedContentSha256}]}`. Task 8 includes only `reviewed` entries (initially none) and must handle a missing file.
- `data/chief-psychiatrist-standards.json`: `{exportMetadata{sourceIds[]}, standards:[{id, title, summary, sourceId, sourceUrl, status:"drafted", reviewedBy:null, reviewedAt:null}]}`. The Task 5a page renders it if present.
- `data/forms-cultural-notes.json`: `{notes:[{formCode, kind:"interpreter"|"aboriginal-liaison", text, sourceId, status:"drafted"}]}`.

## Task specs (unchanged in substance from v1; condensed)

- **Task 1:**
  - Finish `WA_CRISIS_CONTACTS`: add Lifeline, SCBS and 13YARN with provider `sourceUrl` and `verifiedOn: "2026-09-25"`, and re-export them from the care-plan fixtures.
  - The safety plan renders all seven numbers from the module, both on screen and in copied text, and a DOM test pins them.
  - Remove the CSSRS mention from `tools-catalog.ts:321,339`.
  - `npm run issues:done` for #SZA102 (fixed on main by `7cdc3bcaf`).
- **Task 2:**
  - Add the intents `aboriginal_crisis`, `aod_urgent`, `family_violence`, `sexual_assault` and `regional_daytime` (place → WACHS region → `SVC-REG-*` record; RuralLink stays second when the time is unknown; after-hours goes to RuralLink only; no record for a region means existing behaviour).
  - Extend `REGIONAL_WA`.
  - Show "Best fit" only when every non-stopword query token matches (`service-best-fit.ts`); ranking is untouched.
  - Use table-driven tests.
- **Task 3:**
  - Finish the CLI with the kinds `form | section | timeframe` (skip `timeframe` if its file is absent).
  - Report-only by default. `--write` needs a TTY, one record per confirmation, no batch mode.
  - **Walk mode:** `--write --walk` steps through the queue in the recommended order (3C, 10B, 10E, 11B, 11E, 6C, then the rest), with one screen per record and **3 questions**: the text matches the source, the clinical meaning is correct, and it is safe to show as reviewed. There is still a separate typed confirmation per record.
  - A `reviewedContentSha256` pin; the `--check` scripts fail on an edit after sign-off.
  - `docs/clinical-sign-off-how-to.md`: plain English, exact commands, and how to commit and push his sign-offs from his own computer.
- **Task 5a:**
  - Add the Act sections for s 25 criteria, Tribunal review, MHAS notification, personal support persons, ECT approval and CTO criteria/duration to the cited list, located by reading the Act's contents on legislation.wa.gov.au.
  - Run `build-mha-act-sections.mjs --refresh`, then `--draft`.
  - Write summaries strictly from the stored text, marked drafted.
  - Build the "Act and Standards" page at `/forms/act`, linked from the forms home, with a reachability assertion.
  - Checks: `check:mha-act-sections` and `check:forms-review-sheet`.
- **Task 5c:** drafted summaries of the 8 Chief Psychiatrist Standards, including Clinical Risk Assessment and Management, taken only from the Office of the Chief Psychiatrist's published text.
- **Task 5b:**
  - Contract test: each `quote` is verbatim in its pinned section text and contains its duration literally, and an invented entry fails.
  - Engine test: AWST arithmetic, including month-end and 29 February; drafted entries return quote-only.
  - The panel shows the quote, a section link and, for reviewed entries only, a Perth time, with the fixed note "Reference only — check against the Act and your service's procedure."
  - Reuse the helpers in `src/lib/caring-contacts/clock.ts`.
- **Task 6a:**
  - Add a `wa` "WA prescribing" section (stimulant authorisation, S8 prescribing and ScriptCheckWA, SMF restrictions) to the stimulant, benzodiazepine, opioid-substitution and gabapentinoid records.
  - Delete the pregabalin "now Schedule 8" clause (summary Bottom Line plus quick Best Uses).
  - Replace or delete the unsourced alprazolam "S8 permit" pearl.
  - Add `"wa"` to `tabSectionTypes`.
  - Test: every `wa` row cites a source id present in a `sources-*.json` fragment, and the section renders.
- **Task 6b:** a clozapine `wa` reference block with a quoted titration table, restart-after-missed-doses steps and a myocarditis monitoring timetable, each row naming its source. No arithmetic. Rockingham Peel is excluded.
- **Task 7a:** new records only where a source was found: KEMH Mother Baby Unit, PCH Eating Disorders, Legal Yarn, Aboriginal MH liaison, TIS National, and missing WACHS services. Status follows verification.
- **Task 7b:**
  - Add `translatedResources?: {language, title, url}[]` to factsheets, linking official translated material only, and extend `GOVERNED_SOURCE_HOSTS`.
  - Interpreter and liaison notes for forms 1A, 3A–3C, 4A and 6A go in `forms-cultural-notes.json`, rendered drafted.
- **Task 8:**
  - A generator builds the offline block from `WA_CRISIS_CONTACTS` plus reviewed timeframes only.
  - Bump `CACHE_VERSION`.
  - Write the decision record in `docs/pwa.md` (text from the plain-English section above).
  - Test: the numbers equal the module and the verified dates are shown. `test:e2e:pwa` is left to CI.

## Run order (controller)

1. **Minute 0.** Create 7 new worktrees (the 3 existing ones are resumed). Dispatch all 10 builders in one message.
2. **About minute 20: Task 3 lands first.** A quick focused review by one Sonnet reviewer, then push `claude/sweet-carson-e7ur0s-signoff` so Josh can start signing. His sign-offs touch only `data/forms-content-review.json`, which no builder writes.
3. **As each builder finishes:** read its short report and note concerns in the ledger. No per-task review loop.
4. **Integration** (one Sonnet integrator agent, in the main checkout on `claude/sweet-carson-e7ur0s`):
   - Merge `origin/main`, then every builder branch, then Josh's signoff branch if he has pushed.
   - Append all `sources-*.json` fragments to `src/data/source-acquisitions.json`.
   - Run `npm run docs:update` once, then `npm run format`, then commit.
   - Run `check:source-acquisitions`, `check:mha-act-sections` and `check:forms-review-sheet`.
5. **Run these in parallel:**
   - `clinical-governance-reviewer` (Opus) over the full diff
   - a code reviewer (Opus) over the full diff
   - `npm run verify:pr-local` (once)
6. **One fix agent** with all findings, then a focused re-check of the touched tests only.
7. **Push** `claude/sweet-carson-e7ur0s`, open **one PR** (template sections, the Clinical Governance Preflight, `RAG impact: no retrieval behaviour change — no ranking surface touched`, the policy body checked offline), and arm squash auto-merge.
8. **If CI is red:** one diagnosis-and-fix push, assembled fully before pushing (never mid-run).

## Josh's steps

1. **Approve this plan.** This also confirms the seven crisis numbers and the offline decision above.
2. **About 20 minutes in:** follow the how-to guide to sign off forms on your computer, starting with 3C, 10B, 10E, 11B, 11E and 6C.
3. **Later, when convenient:**
   - Publish the services catalogue in the app. Only you can.
   - Decide what to do about the Rockingham Peel clozapine document.

## Verification

- Builders: focused tests (logic test-first) plus the named domain checks.
- Integration: the source, Act and forms-sheet checks, and one `verify:pr-local`, reporting the decisive line.
- GitHub: one full CI run, including the full browser suite, which is not run locally ("browser proof left to CI").
- After merge, spot-check psychiatry.tools:
  - the safety plan shows the WA lines
  - Form 1A shows its timeline as quotes with no times
  - a morning "Kununurra crisis" search routes to WACHS
  - the clozapine reference renders
  - `/forms/act` loads
  - the offline page shows the numbers with their dates
