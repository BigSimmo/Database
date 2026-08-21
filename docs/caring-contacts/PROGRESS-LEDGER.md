# Caring Contacts — master progress ledger

**One place to see everything built so far, across every session.** It is an index and status record, not
a second copy of the detail: each row points at the file that holds the reasoning. Where this file and a
detailed record disagree, **the detailed record wins** — this one is a summary and can go stale.

Last updated at head `495ae3f3a`, 2026-08-22. Branch `claude/suicide-contact-mockup-b5aaa0`, pushed.

---

## 1. What this is

A suicide-prevention **caring contacts** workspace: patients discharged from hospital receive a fixed
schedule of brief, non-demanding messages. It lives inside the Clinical KB deployment but is a
**standalone application owning its own sidebar** — its destinations never go in the host app's nav.

**Synthetic, non-clinical prototype.** No real patient data. No message is ever sent to any number, real
or test. No SMS provider. No migration ever runs against the Clinical KB Supabase project
`sjrfecxgysukkwxsowpy`. Patient-visible copy is **PROVISIONAL and not clinically approved** — lived
experience and clinical sign-off are required before any real use.

## 2. Programme shape

| Phase | Deliverable                                                                  | State                                 |
| ----- | ---------------------------------------------------------------------------- | ------------------------------------- |
| 1     | The rules and the database                                                   | **Complete**, 2026-08-19              |
| 2A    | Foundations — sealed domain, storage, data path, shell, overlays             | **In progress** — 11 of 19 tasks done |
| 2B    | The working clinician-facing screens                                         | Not started; needs its own plan       |
| 3     | Demonstrable — demo clock, synthetic caseload, training mode, record summary | Not started                           |

## 3. Session history

| #   | Session             | What it did                                                                                                       | Transcript                                     |
| --- | ------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1   | Phase 1 + early 2A  | Built the sealed domain and database. 13 owner-behalf decisions. Phase 1 gate passed.                             | `D:\Repos\caring-contacts-handoff-2026-08-20\` |
| 2   | Phase 2A controller | Plan written; Tasks 1-10 and 11a built and reviewed. Rulings 1-31. Died on an account limit mid-fix-round-2.      | same bundle                                    |
| 3   | Phase 2A recovery   | Verified the abandoned commit, re-reviewed it, Rulings 32-34, survived a worktree deletion, rebuilt and re-proved | `D:\Repos\caring-contacts-handoff-2026-08-21\` |

## 4. Task status — Phase 2A (19 tasks, 5 groups)

| Task | What it is                                       | State                                                  |
| ---- | ------------------------------------------------ | ------------------------------------------------------ |
| 1    | Patient-visible copy into the sealed domain      | Complete, reviewed clean                               |
| 2    | Roles and actions                                | Complete, reviewed clean                               |
| 3    | Service safety stop                              | Complete, 1 fix round                                  |
| 4    | Pathway versions and dual approval               | Complete, 1 fix round                                  |
| 5    | Referrals                                        | Complete (batched 5-7)                                 |
| 6    | Plan ownership, reassignment, coverage           | Complete (batched 5-7)                                 |
| 7    | Moving a contact / changing its date             | Complete (batched 5-7)                                 |
| 8    | Auditing a view, not only a write                | Complete, 1 fix round (a CRITICAL finding)             |
| 9    | Notification preferences and training            | Complete, reviewed clean                               |
| —    | **Checkpoint 1**                                 | **PASSED** — 7,604 tests, typecheck and lint green     |
| 10   | Storage contract + in-memory store (~21 methods) | Complete, 1 fix round (7 findings), 101 tests          |
| 11a  | Migration 0003 + row-level security              | Complete, **3 fix rounds**, 96 database tests          |
| 11b  | Shared-contract move + 22 Postgres methods       | Complete, 2 fix rounds, review clean — typecheck GREEN |
| —    | **Checkpoint 2**                                 | **PASSED** — see the build record                      |
| 12   | Database config that can never hit Clinical KB   | **IN PROGRESS** — batched with 13                      |
| 13   | Demo role switcher                               | **IN PROGRESS** — batched with 12                      |
| 14   | Route handlers that audit every view             | Not started                                            |
| 15   | Route group, four width states, inbound link     | Not started — lazy route boundary required (Ruling 13) |
| 16   | Service-state banner                             | Not started                                            |
| 17   | The frozen 24-row overlay definition table       | Not started — Opus work                                |
| 18   | One renderer, twenty-four overlays               | Not started — Opus work                                |
| 19   | Browser proof at six widths                      | Not started                                            |
| —    | Final whole-branch review                        | Pending — Opus work                                    |

## 5. Verification evidence, as recorded

| Gate                         | Result                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| Phase 1 gate                 | 7,531 tests / 682 files; tsc silent; lint 0 warnings; 55 database tests              |
| Phase 2A Checkpoint 1        | 7,604 tests passed; typecheck and lint green                                         |
| Task 10                      | 101 tests (up from 84)                                                               |
| Task 11a, through 3 rounds   | 55 → 71 → 87 → 93 → **96 passed**                                                    |
| Task 11b, through 2 rounds   | 96 → 159 → 162 → **163 passed** database; full suite **7671 passed, 0 failed**       |
| Current known-red (expected) | **NONE.** Task 11b closed both. `tsc --noEmit` produces no output; the full suite is |
|                              | green. This is the first point in Phase 2A with no expected failure at all.          |

**Deliberate-breakage discipline.** Passing tests are never taken as proof. Across the programme, mutation
has caught: a contact dispatched after a recorded death; ten dispatches across nine days; a fourth retry;
a re-sent undelivered contact; a cross-team row leak; a duplicate active plan; a bypassed audit trigger; a
committed cross-team write; and a silently rewritable safety incident. **Four tests have been found unable
to fail and rewritten.**

## 6. Decisions taken on the owner's behalf

**Phase 1 — 13 numbered decisions**, each with why and cost-if-wrong: `phase-1-handoff.md` §"Decisions".

**Phase 2A — 34 numbered rulings**, each with why and cost-if-wrong: `phase-2a-build-record.md`. The ones
that bind unwritten work:

| Ruling      | Substance                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| 9 / 19 / 20 | The safety stop is a schema-enforced **singleton**, read by every dispatch path regardless of team         |
| 4 / 28      | Restart approvals key to the **incident**, never the team; incidents are immutable history rows            |
| 25 / 27     | Composite **same-team foreign keys** — a bare key silently permits cross-team links (caught a real defect) |
| 23 / 24     | Task 11 split; new methods' tests move into the **shared contract** both stores run                        |
| 13          | The workspace sits behind a **lazy route boundary** from its first commit (Task 15)                        |
| 26          | The retention scan narrows to its own title, with a **stronger** compensating assertion                    |
| 30 / 32     | Incident rows are **enforced immutable**; `restarted_at` is **write-once**                                 |
| 33          | The immutability guard is an **allowlist**, not a blocklist, so future columns are covered                 |
| 34          | DELETE deliberately **not** blocked — see the owner decision below                                         |

**Owner decisions, confirmed directly:**

- Patient-visible wording: **keep as written**, still flagged provisional.
- Retention: **seven years**.
- Cross-team duplicate prevention: **confirmed as built**, accepting the inference it permits.
- Caring Contacts is a **standalone application owning its own sidebar** (binds Task 15 and all of 2B).
- **2026-08-21 — patient case notes stay an available capability and the record is KEPT**, built brief and
  lightweight now to be extended later. So `service_stops.note` needs no purge path at this stage; it keeps
  its patient-data classification, and if DELETE is ever blocked a removal path must land in the same
  change. Tracked at `docs/outstanding-issues-inbox/049e0356-b6ad-4382-8f34-958d2681c60e.json`.

## 7. Carried risks and deferred findings

For the **final whole-branch review** — full text in `phase-2a-build-record.md`:

1. **`savePathwayVersion` stores the authored message snapshot BY REFERENCE** — a caller retaining the
   input could mutate stored clinical message content with no version bump and no audit event. The
   highest-value deferred item. The Postgres store will not inherit it, so after 11b the two stores differ.
2. Coverage-window boundary equality is implemented inclusive but only interior dates are asserted.
3. The singleton conversion is not data-migration-safe for a table already holding per-team rows.
4. The old→new migration upgrade path is exercised by no test.
5. `actorId()` does not canonicalise, so the API must supply canonical auth-derived ids (Tasks 13/14).
6. Phase 1 open items 1-6 in `phase-1-handoff.md` — chiefly that **reads are not yet audited** (Task 14).

## 8. Where every record lives

| Record                       | Path                                                           |
| ---------------------------- | -------------------------------------------------------------- |
| **This summary**             | `docs/caring-contacts/PROGRESS-LEDGER.md`                      |
| **The Phase 2A ledger**      | `docs/caring-contacts/phase-2a-build-record.md` ← the detail   |
| Phase 1 record               | `docs/caring-contacts/phase-1-handoff.md`                      |
| Session entry point          | `docs/caring-contacts/phase-2a-handoff.md`                     |
| Ready-to-paste next prompt   | `docs/caring-contacts/phase-2a-continuation-prompt.md`         |
| Task briefs and reports (22) | `docs/caring-contacts/phase-2a-sdd-archive/`                   |
| The plan / the spec          | `docs/superpowers/plans/` and `docs/superpowers/specs/`        |
| Frozen 24-row overlay table  | `docs/caring-contacts/interaction-matrix.md`                   |
| Raw chat transcripts         | `D:\Repos\caring-contacts-handoff-2026-08-20\` and `-08-21\`   |
| Superpowers working mirror   | `.superpowers/sdd/2026-08-19-…/` — **generated, not a source** |

**Do not read** `phase-2a-sdd-archive/00-live-ledger-verbatim.md` as current — it is frozen at Ruling 29
and carries a warning header.

## 9. Durability — read this

**The branch is pushed.** `origin/claude/suicide-contact-mockup-b5aaa0` on github.com/BigSimmo/Database
holds every commit. That is the source of truth. No directory on this workstation is.

This is not a precaution, it is a lesson already paid for. On 2026-08-21 **four** working directories were
destroyed by another process on this machine — under `.claude\worktrees\` and under `D:\Worktrees\`,
including the one holding this work, and one through an explicit `git worktree lock`. The `.git` pointer
file is removed first, so git silently resolves to the main checkout on the wrong branch; the tracked files
follow. There is no warning and the cause is not identified. **Relocating is not protection.**

The last of those four cost nothing, because by then the branch had been pushed. The three before it cost
uncommitted work and, once, an entire git-ignored session ledger.

**Three rules follow:**

1. **Push after every task.** A pushed branch is the only thing that has ever survived here. While
   typecheck is knowingly red, that needs `SKIP_STATIC_GUARD=1 git push` — the red is documented and
   expected, and pushing a feature branch triggers no CI.
2. Anything needed to resume must be a **tracked file**, never git-ignored scratch. The
   `.superpowers/sdd/` workspace is therefore regenerated from tracked records by
   `node scripts/rebuild-caring-contacts-sdd-workspace.mjs`, needs no dependencies, and is disposable.
3. Commit early and often; local commits cost nothing and are what survived each time.

Off-machine copies of the chat transcripts live in `D:\Repos\caring-contacts-handoff-2026-08-20\` and
`D:\Repos\caring-contacts-handoff-2026-08-21\`. Those are on the same workstation and are **not**
protected by the push — copy them elsewhere if they matter.
