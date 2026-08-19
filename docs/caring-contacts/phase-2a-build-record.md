# Caring Contacts Phase 2A — tracked build record

**Why this file exists.** The Phase 2A build ran through a session ledger under `.superpowers/sdd/`,
which is git-ignored scratch. Every ruling taken on the owner's behalf, every deferred finding and the
resume point lived only there and in one conversation. Both are losable — a `git clean -fdx` or deleting
the worktree would destroy them. This is the tracked copy, verbatim, as of head 6bf9f6362 plus the
Task 10 review outcome recorded after it.

The live ledger remains at `.superpowers/sdd/2026-08-19-caring-contact-phase-2a-foundations/progress.md`
and stays authoritative while the plan is running. Re-copy it here at each checkpoint.

---

# SDD ledger — plan: docs/superpowers/plans/2026-08-19-caring-contact-phase-2a-foundations.md

Spec: docs/superpowers/specs/2026-08-19-caring-contact-production-build-design.md (read).
Branch: claude/suicide-contact-mockup-b5aaa0. Plan committed at e68445c38.

## Pre-flight conflict scan

Every pair of tasks sharing a file or an interface, plus each task against itself.

| Rows checked                               | Produces → consumes                                               | Finding                                                                                                                        |
| ------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| T1 → (none in 2A)                          | message copy → screens in Plan 2B                                 | Clean. T1's test imports `calculateGsm7` from `message-policy.ts`, which exists in Phase 1.                                    |
| T2 → T14                                   | `publishPathwayVersion` action name → handler denial test         | Clean; T2 precedes T14.                                                                                                        |
| T2 → T4                                    | `canApproveOwnAuthoredVersion`                                    | Clean — it already exists in Phase 1, so T4 does not depend on T2's edit.                                                      |
| T3 → T10, T11, T16                         | `ServiceState`, `ServiceStopReason`, `ServiceRestartApprovalRole` | Names match at all three consumers.                                                                                            |
| T4 → T10                                   | `PathwayVersion`, `PathwayVersionAction`                          | **Gap:** T4's Consumes list omits `MessageType`, used by `PathwayVersionSnapshot`. Ruling: [1].                                |
| T5 → T10                                   | `ReferralAction`                                                  | **Gap:** T5's Consumes list omits `PlanId`, used by `DuplicateReferralOutcome`. Ruling: [1].                                   |
| T6 → T10, T11                              | `PlanAssignment`, `AssignmentAction`                              | Coverage window type ambiguous: interface says ISO, test uses `"2026-08-20"`. Ruling: [2].                                     |
| T7 → (nothing)                             | `moveContactWithinDay`, `changeContactDate`                       | **Defect:** no storage method persists a rescheduled contact, so Plan 2B's screens would have rules with no path. Ruling: [3]. |
| T8 → T10, T14                              | `AccessRecord`, `AccessKind`, `AccessedObjectType`                | Names match.                                                                                                                   |
| T9 → T10                                   | `NotificationPreferences`, `TrainingRecord`                       | Names match.                                                                                                                   |
| T10 → T11, T14                             | extended `CaringContactRepository`                                | Names match.                                                                                                                   |
| T11 self-check                             | `service_restart_approvals` uniques against repeated stops        | **Defect:** uniques keyed on `team_id` make a second stop unapprovable by anyone who approved the first. Ruling: [4].          |
| T12 → T14                                  | `caringContactsStore()`                                           | Clean.                                                                                                                         |
| T13 → T14                                  | `resolveDemoActor()`                                              | Clean.                                                                                                                         |
| T15 → T16, T18, T19                        | `CaringContactsShell`, `widthStateFor`, route constants           | **Gap:** T16's test passes a `serviceState` prop that T15's shell signature does not declare. Ruling: [5].                     |
| T17 → T18, T19                             | `WORKSPACE_OVERLAY_DEFINITIONS`                                   | Names match; T17 parses the matrix document by column index, which is correct for that table's shape.                          |
| T18 → T19                                  | `data-overlay-id` / `-modality` / `-dismissal`                    | Names match.                                                                                                                   |
| T10 self-check (test vs code it specifies) | `expect(Object.keys(store)).not.toContain("resendContact")`       | **Defect:** asserts the absence of a method nobody wrote — it cannot fail. Ruling: [6].                                        |
| T15 self-check (test vs code it specifies) | `data-internal-link="true"` on internal anchors                   | Artificial but observable in jsdom, where `next/link` renders a bare anchor. Kept. Ruling: [7].                                |
| All tasks vs Global Constraints            | tap floor, tokens, button wiring, migration directory, no push    | No task contradicts a global constraint.                                                                                       |

## Pre-flight rulings

Ruling: [1] T4's and T5's `Consumes` lists gain the omitted imports (`MessageType` from `./model` in T4; `PlanId` from `./ids` in T5). — Why: an implementer reading only its brief would otherwise write an unresolvable type. — Cost if wrong: none; these are the only types those signatures reference.

Ruling: [2] coverage windows are **AWST calendar days** in `YYYY-MM-DD` form, matching `PlannedContact.calendarDay` and T11's `coverage_from text` / `coverage_until text` columns, not full ISO instants. — Why: coverage is rostered by day, and the migration already types the columns as text; making them instants would force a timezone decision the roster does not have. — Cost if wrong: `effectiveResponder` compares days when it needed hours; one comparison and two column types to change.

Ruling: [3] T10's storage contract gains `rescheduleContact(input: { planId: PlanId; contactId: ContactId; expectedContactVersion: number; change: ContactMoveRequest | ContactDateChangeRequest }, context: WriteContext): Promise<TransitionResult<StoredContact>>`, delegating to T7's rules. — Why: T7 builds the rules for moving a contact and changing its date, and without a storage method those rules are unreachable from any screen, which would leave two granted actions as façades in Plan 2B — the exact failure the spec was written to prevent. — Cost if wrong: one unused repository method if the reschedule screens are cut.

Ruling: [4] `service_state` gains a `stop_id uuid` generated at stop time, and `service_restart_approvals` is keyed by it — `UNIQUE (stop_id, role)` and `UNIQUE (stop_id, actor_id)` instead of on `team_id`. — Why: keyed on `team_id`, the rows from a first stop permanently bar their approvers from approving any later stop, so the second incident in a team's life could become unrestartable. Keying by the stop instance keeps "three different people per restart" exactly, without leaking across incidents. — Cost if wrong: one extra column and a different unique key; the three-person rule is unchanged either way.

Ruling: [5] `CaringContactsShell` declares `serviceState: ServiceState` from T15, defaulting to a running service, and T16 mounts the banner using it. — Why: T16 already assumes the prop; declaring it in T15 avoids a signature change mid-plan. — Cost if wrong: one prop moves between two adjacent tasks.

Ruling: [6] T10's `expect(Object.keys(store)).not.toContain("resendContact")` is **replaced** with a behavioural assertion — after `resolveDispatchDiscrepancy` with `unresolvedNoResend`, the contact's state and version are unchanged and no new dispatch row exists. — Why: asserting that a method nobody wrote is absent is exactly the "test that cannot fail" defect Phase 1 found twice; it would pass forever regardless of the implementation. — Cost if wrong: none; the replacement is strictly stronger.

Ruling: [7] T15's `data-internal-link="true"` stamp is kept. — Why: in jsdom `next/link` renders a plain anchor, so the Link-versus-raw-anchor rule is otherwise unobservable at the DOM level, and the repo's own reachability gate works by binding resolution which jsdom cannot reproduce. — Cost if wrong: a cosmetic attribute in production markup.

## Progress

Task 1: complete (commits e68445c..631e699, review clean) — one calculateGsm7 remains; septet pins 252/218 independently re-derived by the reviewer.
Task 1: note — the brief's suggested mutation (9 am-6 pm -> 9 am-7 pm) does not change the septet count; the implementer substituted a real one (removed a space, 252->251) and both pinned tests went red. Later tasks: check that a proposed mutation actually changes the asserted value.
Task 2: complete (commits 631e699..27a7816, review clean) — grant table verified name-by-name; safety stop on all five human roles; publishPathwayVersion on clinicalProgrammeLead only; four denial reasons intact; UNGRANTED_ACTIONS still empty. Full suite 7556 passed.
Task 2: minor (deferred): reviewer judged the brief-supplied cross-team ordering test weak in isolation. Assessed and disagreed — the outsider holds clinicalProgrammeLead, which grants approvePathwayVersion, so without the cross-team check firing first the call would return allowed rather than cross-team-denied. Left as written; noted for the final review.
Task 3: review — spec OK; ONE Important (banner privacy held by construction only, no test) plus three minors. Fix round 1 dispatched.
Task 3: minor (deferred): unreachable "All approvals are in." branch in describeServiceStop — a stopped state can never hold three approvals. Removed in fix round 1 as it sits in the same edit.
Task 3: minor (deferred): actorId() rejects only the empty string — no trim, no canonicalisation — so "DR-A" and "dr-a" are two actors. The module is right to compare identity strictly; the API task must supply canonical, auth-derived ids or the same person could supply two restart approvals. Carry into Task 13/14.
Task 3: minor (deferred): awstIsoTimestamp is now public in clock.ts with no direct test, covered only transitively through audit.ts.
Task 3: Ruling: [8] describeServiceStop takes a narrowed argument ({ reason, restartApprovals }) rather than the whole ServiceState, and gains a test using a note containing a synthetic name and mobile number. — Why: the note is the one field guaranteed to hold whatever a person typed mid-incident, and the banner renders on every screen; holding the property by doc comment alone means one future edit leaks it. The compiler should hold it, not a comment. — Cost if wrong: one signature and one call site.
Task 3: Ruling: [9] ServiceState's teamId is renamed reportedByTeamId, and Tasks 10/11 persist the safety stop as a SINGLETON record (one fixed-key row enforced by the schema), read by every dispatch path regardless of the dispatching team. — Why: spec 4.2 requires a halt "across every patient and team", but a field named teamId makes a per-team table the natural implementation, which would silently leave every other team sending during an incident. — Cost if wrong: if a per-team stop were ever wanted, the singleton row becomes a per-team table and the field returns to its old name.
Task 3: fix round 1/5 (4 addressed, 0 open — banner privacy narrowed and tested, teamId renamed reportedByTeamId, dead branch removed, report line count corrected; commits c976ff9..6434817)
Task 3: complete (commits 27a7816..6434817, review clean) — full caring-contacts suite 317 passed; the note-leak is now blocked twice, by the type and by a test that fires if the type is ever widened back.
Task 3: accepted deviation — describeServiceStop takes a discriminated { stopped: false } | { stopped: true; reason; restartApprovals } rather than the bare narrowed shape. Same guarantee (the note is unreachable) and it keeps the running-service contract under test rather than degrading to null-maps-to-null. Accepted.
Task 3: CARRY INTO TASKS 10 AND 11 — the single-record rule for the safety stop is currently held only by the reportedByTeamId name and a doc comment. Nothing stops the storage task building a per-team table anyway. Ruling: [9] requires the schema itself to enforce one row (fixed-key singleton), and every dispatch path must read it regardless of the dispatching team. This must be a migration constraint and a test, not a convention.

## RESUME POINT
Next task: Task 4 (pathway versions and dual approval). Brief already extracted at task-4-brief.md; task-5-brief.md also extracted.
BASE for Task 4 = 6434817b2. Model guidance from the owner: Sonnet 5 for ordinary tasks; Opus 5 for the service safety stop (done), anything displaying delivery or clinical state, the 24-overlay modality contract (Tasks 17 and 18), and the final whole-branch review. Task 11 (migration plus RLS) is also Opus by the repo's own effort calibration.
Carry into Task 4's dispatch: Ruling: [1] — PathwayVersionSnapshot needs MessageType imported from ./model, which the brief's Consumes list omits.
Carry into Task 5's dispatch: Ruling: [1] — DuplicateReferralOutcome needs PlanId imported from ./ids, which the brief's Consumes list omits.

## Owner decisions closed 2026-08-19 (previously open from Phase 1)
- Patient-visible wording: KEEP AS WRITTEN. Still flagged provisional and not clinically approved; lived-experience and clinical sign-off still required before any real use. No code change — the pinned 252/218 septet strings stand.
- Retention: SEVEN YEARS confirmed. DEFAULT_RETENTION_POLICY already { years: 7 }. No code change.
- Cross-team duplicate prevention: CONFIRMED as built. The partial unique index stays on (patient_id) rather than (team_id, patient_id), accepting that a second team can infer a plan exists elsewhere, because two teams sending two sets of caring contacts is the worse outcome. Phase 1 decision 6 is now the owner's decision, not mine.
Task 4: review — spec OK, implementation correct (all five approval sequences hand-traced; snapshot untouched by every branch; self-approval delegated, not re-implemented). ONE Important: pathway-not-retirable implemented with zero test coverage, and publishedAt/retiredAt values never asserted. The gap is in the brief I wrote, not the implementation. Fix round 1 dispatched.
Task 4: fix round 1/5 (1 addressed, 0 open — all three non-approved states covered with exact refusal objects, publish/retire timestamps asserted against /\+08:00$/, implementation file untouched; commits 33d38ca..9c43268)
Task 4: complete (commits 6434817..9c43268, review clean) — 7 passed.
Task 5+6+7: Ruling: [10] Tasks 5, 6 and 7 are dispatched as ONE batch with three separate commits. — Why: three small independent pure-transition modules in three different new files, each with complete test code in its brief and no interface between them; one dispatch per task would make three agents rebuild the same context, and Phase 1 batched two such tasks for the same reason. — Cost if wrong: one review surface covers three modules, so a finding in any one of them holds up the other two.
Task 5: complete (commit 9634deb, batch review clean) — referrals.
Task 6: complete (commit 9f51d5b, batch review clean) — assignment, reassignment history, coverage.
Task 7: complete (commit 664ec7d, batch review clean) — within-day moves and approved date changes.
Tasks 5-7: all 11 refusal reasons across the three modules now have a test asserting the exact refusal object; the implementer found and closed 5 gaps the briefs had left.
Tasks 5-7: Ruling: [11] The reviewer's one Important finding — Task 7's brief names APPROVED_SEND_WINDOW under Consumes but the module only needs isWithinApprovedSendWindow — is a defect in the brief, not the code. No change. — Why: the module must not re-derive 09:00-18:00, and it does not; adding an unused import to satisfy a list I wrote would be strictly worse than the brief being over-specified. — Cost if wrong: none; the constant remains exported and importable if a later task needs it.
Task 6: minor (deferred): coverage window boundary equality (day == from, day == until) is implemented inclusive on both ends but only interior and after-until dates are asserted. Boundaries are where off-by-one bugs live. FLAG FOR THE FINAL WHOLE-BRANCH REVIEW.
Task 6: minor (deferred): PlanAssignment mixes AWST instant strings (claimedAt, reassignment at) with bare calendar days (coverage from/until). Reviewer confirmed the 10-character calendar-day branch in effectiveResponder is a sound distinction, not a guess, and that a full ISO instant still maps to its true AWST day. Suggested later cleanup: name them claimedAtIso/fromDay or brand the two string shapes. Not blocking.

## OWNER CLARIFICATION 2026-08-19 — the workspace is a standalone application
Caring Contacts does NOT reuse the Clinical KB navigation. It is its own application living inside the
same deployment, and it owns its own sidebar: every one of its headings/destinations goes in ITS side
rail, not in the host app's nav. This confirms the shell design in Task 15 (own rail, own header, own
phone dock, four width states) and means Plan 2B must place all workspace destinations in that rail
rather than registering them as host-app modes. The tools-catalogue entry from Task 15 remains only the
single front-door link into the application; it is not the workspace's navigation.

Task 8: review — CRITICAL. A patient name with no digits in it is NOT caught by
assertAuditEventFreeOfPatientData: AU_MOBILE_NUMBER_PATTERN only matches digit runs, and the
forbidden-field-name list blocks fields literally named name/patientName, not objectId. The brief's own
test passed for the wrong reason — it used "Rowan Sample +61 491 570 156", so the number caught it, not
the name. A clinician searching by name is the common case and would have written that name into the
trail. Tasks 9a and 9b clean.
Task 8: Ruling: [12] The fix is an ALLOWLIST on the shape of an access-event objectId, not a name
heuristic. An access event's objectId must match an identifier shape (no whitespace; only letters,
digits, hyphen, underscore and colon; bounded length) and anything else throws
AuditEventContainsPatientDataError. — Why: a denylist of name shapes cannot be made reliable — "Rowan
Whitlock" and a legitimate free-text id are indistinguishable in general — whereas the set of things
that legitimately identify an object here is small and knowable (SYN-PLAN-001, SYN-CONTACT-004,
demo-coordinator, patientDirectory, a uuid). A search term is not an identifier and must never be
recorded at all: the searched-over surface is the object, never the query. The existing mobile-number
scan stays as well. — Cost if wrong: if a real identifier format later contains a space or another
character, the allowlist widens by one character class in one place.
Task 8: fix round 1/5 (1 addressed, 0 open — objectId allowlist /^[A-Za-z0-9_:-]{1,128}$/ checked first, "Rowan Whitlock" throws, all five legitimate identifier shapes accepted, audit.ts untouched, one error type, allowlist rationale commented; commits 8a5a4aa..3272c87)
Task 8: complete (commits 664ec7d..3272c87, review clean).
Task 9: complete (commits 2074119, 8a5a4aa, review clean) — notification preferences and training separation.

## CHECKPOINT 1 PASSED — end of Group 1, the rules layer is complete
npm run test    -> Test Files 691 passed | 2 skipped (693) / Tests 7604 passed | 29 skipped (7633)  PASS
npm run typecheck -> exit 0, no diagnostics  PASS
npm run lint    -> exit 0, no output  PASS
Note: typecheck first failed with DATABASE_HEAVY_RUN_ADMISSION_BUSY because the exclusive vitest lease
was held by the concurrent full test run; it passed cleanly on rerun. That is the repo's cross-worktree
run coordinator behaving correctly, not a defect.

## RESUME POINT (supersedes the earlier one)
Group 1 (Tasks 1-9, the sealed rules layer) is COMPLETE and reviewed. Next: Task 10 (extend the storage
contract and the in-memory store). Briefs 1-9 extracted; 10 onwards not yet.
BASE for Task 10 = 3272c8701.
Carry into Task 10's dispatch: Ruling: [3] (add rescheduleContact to the contract, delegating to Task 7's
rules), Ruling: [6] (replace the tautological "resendContact absent" assertion with a behavioural one),
Ruling: [9] (the safety stop is a SINGLETON record enforced by the schema, read by every dispatch path
regardless of team — this must be a migration constraint and a test, not a convention).
Carry into Task 11's dispatch: Ruling: [4] (service_state gains stop_id; service_restart_approvals keyed
UNIQUE (stop_id, role) and UNIQUE (stop_id, actor_id), not on team_id) and Ruling: [9].
Carry into Task 13/14's dispatch: the deferred minor that actorId() does not canonicalise, so the API must
supply canonical auth-derived ids or one person could supply two restart approvals.
Carry into Task 15 and all of Plan 2B: the owner's clarification that Caring Contacts is a standalone
application owning its own sidebar; its destinations go in ITS rail, not the host app's nav.
Model guidance: Sonnet 5 for ordinary tasks; Opus 5 for Task 11 (migration + RLS), Tasks 17-18 (the
24-overlay modality contract), anything displaying delivery or clinical state, and the final review.

## Owner-directed actions on the two carried risks, 2026-08-19
Risk 1 (size limit): Ruling: [13] Task 15 gains a hard requirement rather than only a measurement step —
the workspace's client code must sit behind a lazy route boundary from the first commit, so the Clinical KB
dashboard never downloads it and the workspace can never charge its weight to the host app's ceiling. The
measurement at Task 15 step 8 stays, but it now verifies a design that was built to pass rather than
discovering a problem late. — Why: measuring an empty baseline now would tell us almost nothing the
committed baseline does not, whereas the lazy boundary is free to adopt at the start and expensive to
retrofit across twenty screens. — Cost if wrong: if the workspace turns out small enough not to need it,
one dynamic import boundary is redundant but harmless.
Risk 2 (singleton safety stop): recorded in the repository's durable outstanding-work inbox via
npm run issues:add, so the requirement survives even if this session ledger is lost. It remains carried
into Tasks 10 and 11 as Ruling: [9] and Ruling: [4].
Task 10: implemented (commit 6bf9f6362) — storage contract extended with ~20 methods, in-memory store
implements them all, service-stop gate and audit write both inside runWrite so no future method can forget
either. 84 passed. Rulings 3, 6 and 9 all applied: rescheduleContact added; the tautological
"resendContact absent" assertion replaced with a behavioural one (state and version unchanged, no new
dispatch row); the service stop proven service-wide by a cross-team test.
Task 10: NOT YET REVIEWED. Review package not generated. This is the resume point.
Task 10: *** BRANCH IS MID-CHANGE — npm run typecheck IS RED. *** src/lib/caring-contacts/db/postgres-repository.ts
no longer satisfies the extended CaringContactRepository interface: it is missing the ~20 new methods.
This is expected and is exactly what Task 11 fixes. Nothing else is broken; the unit suite is green.
Do not "fix" it by narrowing the interface — implement the methods in Task 11.
Task 10: concern to carry — trainingWorkspaceIsolated was added to REPOSITORY_REFUSALS as instructed but is
unwired and untested, because no method signature in Task 10's scope carries a workspace parameter to gate
on. Either wire it when training-scoped reads arrive in Plan 2B, or remove it. Do not leave a refusal
constant that nothing can ever return.

## RESUME POINT (supersedes all earlier ones)
1. FIRST: review Task 10. BASE = 88e774c95, HEAD = 6bf9f6362. Generate the package with
   scripts/review-package and dispatch a task reviewer. Task 10 is unreviewed.
2. THEN: Task 11 (migration 0003 + Postgres implementation). Use Opus 5 — migration plus row-level
   security is the repo's own xhigh/high effort band. It restores typecheck. It needs Docker for
   npm run caring-contacts:db:test, which is local and offline and needs no provider approval.
   Carry Ruling: [4] (service_state gains stop_id; service_restart_approvals keyed UNIQUE (stop_id, role)
   and UNIQUE (stop_id, actor_id), NOT on team_id) and Ruling: [9] (schema-enforced singleton service stop,
   also recorded durably in docs/outstanding-issues-inbox/ at commit 88e774c95).
3. Then Tasks 12-19. Ruling: [13] — Task 15 must put the workspace behind a lazy route boundary from its
   first commit, not just measure the bundle afterwards.
4. Owner clarification: Caring Contacts is a standalone application owning its own sidebar; all its
   destinations go in ITS rail, never the host app's nav. Applies to Task 15 and all of Plan 2B.

## Session resumed 2026-08-19 (Phase 2A, from the Task 10 review resume point)

Environment: Docker Desktop is now RUNNING and a disposable Postgres 17.11 container `caring-contacts-pg`
is up on 127.0.0.1:54329 (`postgres:17`, password `caring-contacts-local`, `--restart unless-stopped`, NOT
`--rm`). Set `CARING_CONTACTS_DATABASE_URL=postgres://postgres:caring-contacts-local@127.0.0.1:54329/postgres`
for `npm run caring-contacts:db:test`. It is local, offline, disposable, and touches no hosted service.
NOTE: the first attempt used `docker run --rm` and the container was removed when the engine finished
starting, which surfaced as `Connection terminated unexpectedly` and 7 failed / 48 passed on a BASELINE run
that had changed no code. That was environmental, not a schema defect. Re-run the baseline before trusting
any Task 11 red/green.

Task 10: REVIEWED (reviewer: Opus 5, BASE 88e774c95, HEAD 6bf9f6362). Verdict: Needs fixes —
1 Critical, 4 Important, 9 Minor. All 21 interface methods confirmed present in both the interface and the
in-memory store. Rulings 3, 6 and 9 independently confirmed applied and genuinely testable; Mutation A
independently re-traced and confirmed NOT a no-op (exactly the four reported tests read the gate).

Task 10 review findings entering the fix loop:
  C1 savePathwayVersion persists caller-supplied state/approvals/authorId/publishedAt verbatim, so one
     actor holding authorPathwayVersion can save {state:"published", approvals:[]} and publish governed
     clinical message content past the dual-approval control Task 4 built. Governance bypass.
  I2 No test asserts that ANY of the 20 new writes emits an audit event. Mutation B only reddened
     pre-existing plan-write tests, so brief Step 5's proof was never actually obtained for a new method.
  I3 A service-stopped refusal is cached against the idempotency key, so the natural retry after the
     restart is refused forever with a reason that is no longer true.
  I4 getAssignment and getServiceState return live internal references; every other read clones. A caller
     can rewrite plan ownership or an incident note in place with no version bump and no audit event.
  I5 applyAssignment never binds a claim's actorId to the writing actor, so the assignment ledger and the
     audit event can disagree about who owns the work.

Ruling: [14] savePathwayVersion persists AUTHORED CONTENT ONLY and constructs every governance field
server-side — state "draft", approvals [], authorId from the write context, publishedAt/retiredAt/
retirementUrgency null — regardless of what the caller supplied. Every governance transition stays
exclusively in transitionPathwayVersion. — Why: the brief typed the input as the whole PathwayVersion, but
a create method that trusts the caller's own approval state is not a storage decision, it is the removal of
the dual-approval control; the same file already constructs createReferral's state server-side, so this is
the file's own established trust boundary, not a new one. — Cost if wrong: a caller that legitimately
needed to seed a non-draft version must now make the transition calls explicitly, which is one extra call
and the audit trail those transitions produce.

Ruling: [15] A `service-stopped` refusal is NOT written to the idempotency map; every other refusal still
is. — Why: replay caching exists so a retried request returns its original answer, which is right when the
answer is a property of the request, but service-stopped is a property of a global, explicitly reversible
incident state — caching it means the safety stop's own resume path is the thing it permanently breaks.
— Cost if wrong: a replayed write from the stopped window executes after the restart instead of returning
the cached refusal, which is the behaviour the resume path wants anyway.

Ruling: [16] `trainingWorkspaceIsolated` is REMOVED from REPOSITORY_REFUSALS rather than wired.
— Why: the owner's instruction was wire-it-or-remove-it, and wiring it correctly is not the cheap option it
looks like — `workspacesMayShareData` is a BETWEEN-workspaces predicate that returns false for
(training, training), so using it as a self-access gate would refuse every operation of a training store;
the correct gate is a workspace-identity check that does not exist yet and would add a field to the
Read/Write contexts that Tasks 12-14 consume. — Cost if wrong: one constant to re-add in Plan 2B, next to
the gate that can actually return it.

Ruling: [17] `DispatchRecord.expectedStatus` is left unwritten in Task 10 and CARRIED as a requirement on
whichever task builds the dispatch/provider path (Task 12 onward). — Why: reconciliation compares expected
against reported, and nothing currently writes the expected half, so the reconciliation surface can show no
discrepancy at all — a real façade risk of exactly the kind Ruling 3 was made to prevent; but inventing a
setter before the dispatch path exists would be speculative, and the brief names no method that sets it.
— Cost if wrong: if no later task claims it, the reconciliation screen in Plan 2B has a permanently empty
expected column and the gap must be closed there instead.

Task 10 minors (deferred to the final whole-branch review): rescheduleContact's
`contact-move-leaves-scheduled-day` and `contact-date-change-in-the-past` are reachable but untested, and
the report's refusal table overstates that coverage; `retentionCleared` is written and never read;
`listAccessTrail` never exercises a non-zero `offset`; two test titles overclaim what their body asserts
(the "and a blank note" title, and a positive control satisfied by pre-existing plan-write events); the
~10x repeated permission/lookup guard could be one helper and its three action-selecting ternaries fall
through to a default rather than failing to compile on a new variant; malformed date strings in
listDispatches/listAccessTrail yield NaN comparisons and an empty list indistinguishable from "none";
in-memory-repository.ts is now 1201 lines holding eight storage concerns and should split rather than
extend again.
