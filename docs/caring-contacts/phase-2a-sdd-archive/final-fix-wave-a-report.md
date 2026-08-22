# Final fix wave A — storage and sealed domain

Scope: the storage/sealed-domain half of the final whole-branch review. Seven findings, all fixed.
The surface, migration and gate half was worked concurrently by another agent and is reported
separately in `final-fix-wave-b-report.md`.

Australian English throughout. No prohibited interface wording was introduced; nothing added here
reaches an interface string at all.

---

## Verification summary

| Gate                                               | Result                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `npm run test` (full offline unit suite)           | `Test Files 703 passed \| 2 skipped (705)` / `Tests 7818 passed \| 29 skipped (7847)` |
| `caring-contacts:db:test` (containerised Postgres) | `Test Files 2 passed (2)` / `Tests 174 passed (174)`                                  |
| Caring-contacts domain unit set (20 files)         | `Test Files 20 passed (20)` / `Tests 455 passed (455)`                                |
| `tsc -p tsconfig.json --noEmit`                    | clean for every file in this scope                                                    |
| `npx eslint <changed files>`                       | `0 problems`                                                                          |

Every run above is quoted from its own `Test Files` / `Tests` summary line, not from an exit code.

---

## Finding 1 (CRITICAL) — patient data written in plaintext to the idempotency table

`fingerprintOf` returned a canonical **string**, and both stores inserted it verbatim into
`caring_contacts.idempotency_records.fingerprint`. For `createPlan` that string contained the
patient's name, mobile number, identifiers and cultural identity; for `stopService` and
`resolveDispatchDiscrepancy` it contained the responder's free-text incident note. Because restart
approvals are deliberately service-wide, a TEAM-SOUTH approver's `approveServiceRestart` row stored
TEAM-NORTH's incident note under TEAM-SOUTH's `team_id`.

**Fix.** `src/lib/caring-contacts/fingerprint.ts` now hashes the canonical string with SHA-256
(`node:crypto`) and returns a 64-character hex digest. The canonicalisation is unchanged and is now
a private function, so nothing can obtain the faithful rendering again. The hash lives inside the
shared definition, so both stores changed together and cannot drift.

**Replay semantics verified rather than assumed.** The only comparison either store makes on this
value is `===` — `previous.fingerprint === fingerprint` for a replay, anything else being
`idempotency-key-reused-for-a-different-write` (`runWrite` in both stores). Hashing a canonical
string preserves that exactly. `tests/caring-contacts-fingerprint.test.ts` pins it from both
directions: stability, order independence, `undefined`-dropping and `Date` handling all still
produce equal digests, and method, array order, primitive type, a one-character change in a mobile
number, and `null` versus `undefined` all still produce different ones.

### TDD and mutation evidence

Before the fix (contract-level, new test file):

```
FAIL tests/caring-contacts-fingerprint.test.ts > carries none of its input's text …
AssertionError: expected '{input:{patientDetail:{culturalIdenti…' not to contain 'Jordan'
```

Against Postgres, with `fingerprintOf` temporarily reverted to returning the canonical string:

```
FAIL tests/caring-contacts-postgres-repository.test.ts > no patient detail reaches idempotency_records (postgres only)
     > stores no row containing the patient's name, mobile number, identifiers or cultural identity
AssertionError: expected '[{"fingerprint":"{input:{patientId:st…' not to contain 'Jordan Nguyen'
FAIL … > stores no row containing a responder's free-text incident note
AssertionError: expected '[{"fingerprint":"{input:{note:string:…' not to contain 'Jordan'
Tests  2 failed | 172 passed (174)
```

The mutation reddens at the intended assertion — the string quoted in the failure is the real row
read back out of the table — and the file was restored immediately afterwards.

### The new test, and where it lives

The shared contract's existing assertion ("keeps patient-identifying detail out of plan reads and
the audit trail", `tests/helpers/caring-contacts-repository-contract.ts`) reads the records a store
hands **back**. It cannot read a table. The new half therefore lives in
`tests/caring-contacts-postgres-repository.test.ts` as
`describe("no patient detail reaches idempotency_records (postgres only)")`, reading
`caring_contacts.idempotency_records` as the migration role — the same pattern the existing
first-ever-stop race control uses, and for the same reason. A pointer comment was added beside the
contract assertion naming the table it stops short of and where the other half is.

### What I chose for the `result` narrowing, and why

**I chose not to strip anything from the stored `result`, and to bound it by return type and
document that bound instead.** The reasoning, checked rather than assumed:

- **Patient detail already cannot reach it.** Every write returns a `PlanRecord`, `StoredContact`,
  `Referral`, `PathwayVersion`, `PlanAssignment`, `DispatchRecord`, `ServiceState`,
  `NotificationPreferences`, `TrainingRecord` or `void`. `PlanRecord` deliberately omits
  `patientDetail` — only `StoredPlan` carries it, and it is released through `getEpisode` alone. So
  the escape was entirely in the fingerprint column, which is now closed.
- **The one free-text field that does reach it is `ServiceState.note`, and stripping it from the
  stored result would make a replay untruthful.** A retry of `stopService` by the responder who
  raised the incident must receive the answer the first call gave; a blanked note would then be shown
  as the incident detail to precisely the actor entitled to read it. No existing contract assertion
  pins the note on a replay, so stripping would not have gone red — which makes it more dangerous,
  not less.
- **Re-hydrating the note on replay from `service_stops` was considered and rejected.** A stop can
  be restarted and a new incident raised, at which point the current note is a _different_
  incident's note; a replay of the old key would then return text that was never its answer. That is
  a worse failure than the one it would fix.

The bound is now written down rather than implied: `repository.ts`'s header carries a
"WHAT THE REPLAY RECORD MAY HOLD" note stating that the result is bounded by the declared return
types, that `ServiceState.note` is the deliberate exception and why, and that a future write needing
to return something identifying needs a **narrower return type**, not a filter on the way into
storage. The Postgres row test enforces the patient-detail half of that empirically.

#### A residual this decision does NOT close — and my first reasoning for it was wrong

I originally justified leaving the note in the stored result on the grounds that it was already
service-wide readable anyway: `getServiceState` returns the full stopped state to any actor, and
migration 0003's `service_stops_service_wide` policy makes `service_stops` readable by any
team-scoped session. **That justification stopped being true while I was working.** Wave B's own
finding 1 landed in commit `52c3479dd` and introduced `narrowServiceStateForActor`
(`src/lib/caring-contacts-server/service-state-view.ts`), which gates the note behind
`viewPatientRecord` **for the reporting team**. The surface now deliberately withholds a
TEAM-NORTH note from a TEAM-SOUTH actor.

So this remains open, and it is the highest-value item I am handing back:

> **`approveServiceRestart` stores the reporting team's incident note, at rest, in the approving
> team's own `idempotency_records.result` row.** Restart approvals are service-wide, so a TEAM-SOUTH
> `teamLead` legitimately approves a TEAM-NORTH incident and the store persists the still-stopped
> `ServiceState` — note included — under `team_id = 'TEAM-SOUTH'`. That table's row-level security is
> team-scoped, so a TEAM-SOUTH session can `select result from caring_contacts.idempotency_records`
> and read text `narrowServiceStateForActor` would have withheld from it. `stopService`'s own row is
> **not** affected: it is written under the reporting team's own id.

I did not fix it, deliberately. Every route out needs a decision that spans both halves of this
review: narrowing `approveServiceRestart`'s declared return type (which ripples into the route wave B
has just rewritten), persisting a narrowed result for that one method (which needs an
encode/decode hook on `WriteSpec` in both stores, and a story for what a replay returns), or
accepting the note as at-rest team-scoped data and saying so. Guessing between those would have put
my half and wave B's half in disagreement about who owns the note.

Recommendation: narrow `approveServiceRestart`'s return type. It is the only write with the
cross-team property, the approver's legitimate need is "is the stop still standing, and is my
approval recorded" — which `restartApprovals` and `stopped` already answer — and a narrower return
type is exactly the mechanism `repository.ts`'s new header note now names for this case.

---

## Finding 2 (CRITICAL) — the two stores gave different answers for a malformed coverage window

`applyAssignmentAction` validated only `until > from` — a lexical string compare that
`"cherry" > "banana"` satisfies — while the module's own header declares these are AWST calendar
days and `effectiveResponder` compares them as such. So `{"from":"banana","until":"cherry"}` was
accepted and stored by the in-memory store (where `effectiveResponder` then silently named the wrong
person), and raised against Postgres's `~ '^\d{4}-\d{2}-\d{2}$'` check, escaping as a throw where
this domain's convention is a named refusal.

**Fix.**

- `schedule.ts` now exports `isAwstCalendarDay`, built on the `CALENDAR_DAY_PATTERN` constant and
  `parseCalendarDay` that were already there. It is **stricter** than the SQL regular expression: it
  also rejects `2026-02-30` and `2026-13-01`, so the schema check becomes defence in depth rather
  than the enforcement.
- `assignment.ts` refuses `coverage-window-not-calendar-day`, checked **before** the ordering test,
  and the refusal is documented in the function's refusal list with the reason it must come first.

I did **not** touch the route schema — that is the other agent's file. **It still needs tightening**:
`src/app/api/caring-contacts/assignments/[planId]/route.ts` accepts `from`/`until` as plain strings,
so the domain refusal is currently the only thing standing between a malformed request and the
database check.

No migration was written; none is needed.

### TDD and mutation evidence

Before the fix, eight new unit cases and one new contract case were red, all at the intended
assertion:

```
FAIL tests/caring-contacts-assignment.test.ts > refuses a coverage window that is not an AWST calendar day (pure nonsense)
AssertionError: expected { ok: true, value: { …(4) } } to deeply equal { ok: false, …(1) }
FAIL tests/caring-contacts-repository.test.ts > … > assignment > refuses a coverage window that is not an AWST calendar day, by name in both stores
AssertionError: expected { ok: true, value: { …(4) } } to deeply equal { ok: false, …(1) }
```

The `ok: true` on the left is the defect itself: the in-memory store accepted and stored the
nonsense window. After the fix the contract case passes against **both** stores:

```
✓ |caring-contacts-db| … CaringContactRepository contract (postgres) > assignment
  > refuses a coverage window that is not an AWST calendar day, by name in both stores 223ms
```

A positive control was included so the new refusal is not simply refusing everything: `2024-02-29`
is accepted and `2026-02-29` is refused.

---

## Finding 3 (CRITICAL) — governed clinical message text handed out live

The in-memory store stored `snapshot: input.version.snapshot` — the caller's own object — and both
reads returned `{ ...stored }`, a shallow copy. Every reader therefore held the live governed
message text, rewritable in place with no version bump, no second approval and no audit event. The
Postgres store round-trips through `jsonb` and copies for free, so the two stores genuinely differed
on the one type carrying clinical content.

**Fix.** A `clonePathwayVersion` helper in the in-memory store deep-copies **and freezes** the
version, its approvals and its snapshot. It is applied on the write path (so the caller's own object
is not what gets stored), on the transition result, and on **both** read paths — `getPathwayVersion`
and `listPathwayVersions`. Its comment states the rule the way `cloneAssignment`'s already did.

### TDD evidence

Added to the contract section built for exactly this class ("reads hand back something a caller
cannot rewrite in place"), which previously covered the assignment and the service state and omitted
the one type carrying clinical message content. Red before the fix:

```
FAIL tests/caring-contacts-repository.test.ts > … > reads hand back something a caller cannot rewrite in place
  > returns a pathway version whose governed message text a caller cannot rewrite in place
AssertionError: expected 'Rewritten without approval.' to be 'Checking in.'
```

The test also proves the write path, by mutating the object the caller passed to
`savePathwayVersion` after the call. It passes against Postgres too (where it was already green,
which is the divergence the shared contract exists to expose).

---

## Finding 4 — the role list was hand-written, so every "for every role" claim was unfalsifiable

`ROLES` in `tests/caring-contacts-permissions.test.ts` was a literal array typed
`readonly CaringContactRole[]` — not a tuple — so TypeScript never required it to be exhaustive,
while `ROLE_ACTIONS` is a `Record<CaringContactRole, …>` that **forces** a sixth role into the
production grant table.

**Fix, one line each.** `ROLES` is now `Object.keys(ROLE_ACTIONS)` and `SYSTEM_ROLES` is
`Object.keys(SYSTEM_ROLE_ACTIONS)` — the pattern `permissions.ts` already uses to derive
`ALL_ACTIONS` from its `Record<Union, true>` registry. A small guard test asserts the two lists equal
their tables' keys, so the derivation itself cannot be quietly reverted.

### Mutation evidence, run both ways

With a sixth role added to the union and forced into `ROLE_ACTIONS` (post-fix code):

```
FAIL tests/caring-contacts-permissions.test.ts > rule 6: triggerServiceSafetyStop is unblockable …
  > allows triggerServiceSafetyStop for role sixthRole
FAIL … rule 7a … > still leaves every role holding triggerServiceSafetyStop, which is what keeps a death unblockable
Tests  2 failed | 108 passed (110)
```

The named test reddens, as the review predicted. The control — the **same** mutation with `ROLES`
reverted to the pre-fix hand-written literal:

```
FAIL … > the role lists cannot fall behind the grant tables > derives every role from the grant table itself
Tests  1 failed | 107 passed (108)
```

Both safety-stop tests pass in that run. That is the decisive half: before this fix, a sixth role
holding no safety stop at all was invisible to every "for every role" claim in the file. Both
mutations were reverted immediately.

---

## Finding 5 — the prototype-key lookup bug, third occurrence

`permissions.ts` indexed the frozen object literals `ROLE_ACTIONS` and `SYSTEM_ROLE_ACTIONS` by role
name, so `ROLE_ACTIONS["constructor"]` returned a function and `.includes` on it threw a `TypeError`
rather than returning a refusal. The `?? []` beside one of them looked like a guard and was not: a
function is not nullish.

**Fix.** A single shared helper `grantedActionsFor(table, role)` using `Object.hasOwn`, applied at
both sites, with a comment naming the two earlier occurrences so the third is also the last.

### TDD evidence

```
FAIL tests/caring-contacts-permissions.test.ts > an unknown-shaped role is refused rather than throwing
     > refuses a human role named constructor with action-not-granted
TypeError: ROLE_ACTIONS[role].includes is not a function
FAIL … > refuses a system role named constructor with action-not-granted
TypeError: (SYSTEM_ROLE_ACTIONS[actor.systemRole] ?? []).includes is not a function
FAIL … > refuses a plain unknown role, and still allows a real role alongside it
TypeError: Cannot read properties of undefined (reading 'includes')
```

Seventeen cases in total: all eight inherited keys against both tables, plus a plain unknown role and
a mixed actor holding one bogus and one real role. All now return
`{ allowed: false, reason: "action-not-granted" }`, and the mixed actor is still allowed.

### The audit of the rest of the sealed domain and both stores

I swept every `Record`-typed lookup table in `src/lib/caring-contacts/**` (including `db/`) for the
same shape — a frozen object literal indexed by a key that is not provably a member. Four sites
beyond `permissions.ts`:

1. **`db/postgres-repository.ts` — `RESTART_APPROVAL_REFUSALS[recorded.constraint ?? ""]`. Same
   shape, and FIXED.** The key is a string read off a driver error object, the table is a frozen
   literal typed `Record<string, string>`, and the guard was `if (refusal)` — which treats a function
   as truthy. A constraint named `toString` would have returned a _function_ as the refusal reason
   instead of rethrowing an unrecognised constraint. Now looked up with `Object.hasOwn` and compared
   against `undefined`. **No test was added**, and I want to be explicit about that rather than imply
   coverage: constraint names come from this repo's own migrations, so the defect is unreachable
   without a fake connection pool built solely to inject one, and the fix restores the already
   intended `throw recorded.error` path.

2. **`schedule.ts:153` — `SEND_HOUR_BY_PREFERENCE[preference]`. Already guarded**, with
   `Object.prototype.hasOwnProperty.call`. Worth recording: this is the fourth occurrence of the
   pattern on this branch, and the only one where the guard was applied. The pattern was known; it
   just never travelled.

3. **`service-state.ts:234` — `STOP_REASON_WORDING[state.reason]`. Same shape, NOT fixed, reported
   here.** `applyServiceStop` does not validate `input.reason` against `SERVICE_STOP_REASONS`, so a
   reason of `"constructor"` would reach the banner and render a function's source rather than
   crashing. Today it is gated at two boundaries — the route's schema (the other agent's file) and
   the Postgres `service_stops_reason_is_known` check — but the sealed domain is supposed to own its
   own rules. I stopped rather than fixing it because the fix is a **behaviour change needing a
   design decision**: either `applyServiceStop` gains a new named refusal (which is a new domain
   refusal name, not a lookup hardening), or `describeServiceStop` needs fallback wording, which is a
   product wording decision and would put a new string on a patient-facing surface. Recommendation: a
   named refusal in `applyServiceStop`, matching how every other malformed input in this domain is
   handled.

4. **`notification-preferences.ts:68` — `ALERT_CLASS_LABELS[alertClass]`. Same shape, lower severity,
   NOT fixed, reported here.** An out-of-type alert class would produce a preview body reading
   "… affected by function toString() { … }" rather than throwing. Same design decision as (3) — it
   needs fallback wording — and the same recommendation.

5. `service-state.ts:231` — `APPROVAL_ROLE_WORDING[role]` — is **safe**: the key is iterated from the
   internal frozen `REQUIRED_RESTART_APPROVAL_ROLES` constant, never from data.

---

## Finding 6 — `markRetentionCleared` recorded a clearance that never happened

The write set `retention_state.cleared_at` and touched nothing else: `plans.patient_name`,
`patient_mobile_number`, `patient_identifiers` and the `cultural_identity_reports` row all survived
it, and `getEpisode` returned every one of them afterwards. In the in-memory store the clearance was
a `Set` that was written and never read, so the contract could not compare the two stores on it at
all.

**Fix — Ruling 64, perform the clearance.** In **both** stores, inside the same transaction / staged
commit that records it:

- **Postgres** — an `update caring_contacts.plans set patient_name = '', patient_mobile_number = '',
patient_identifiers = '{}'` plus a `delete from caring_contacts.cultural_identity_reports`. Same
  transaction rather than a later sweep, so a committed clearance record and un-cleared detail cannot
  coexist: if the de-identification fails, the record does not commit either.
- **In-memory** — the stored plan's `patientDetail` is replaced with the cleared value.
- The cleared value is a single shared constant, `CLEARED_PATIENT_DETAIL` in `repository.ts`, so two
  stores cannot clear to two different shapes. `patient_name` and `patient_mobile_number` are
  `not null` in the schema, so the cleared value is the empty string; cultural identity is deleted
  outright, because that table holds nothing but the identity.
- The in-memory `Set` became a `Map<planId, { terminalAt, clearedAt }>`, holding the same two
  instants the `retention_state` row does.

**No migration was required** — this is DML against existing columns.

### One deviation from the brief, stated plainly

The brief asked me to "make the in-memory store's record readable so the contract can compare them".
**I did not widen `CaringContactRepository` to expose the clearance record, and here is why.**
Neither store exposes `retention_state` through the contract today, so making the in-memory record
readable would mean adding a new interface method — which every implementer must then satisfy,
including the full `CaringContactRepository` object literal in `tests/caring-contacts-api-handler.test.ts`
and anything the concurrent agent is building on the server surface. That is a cross-agent design
decision, so I stopped short of it. The comparable evidence that a clearance happened is now the
de-identified episode itself, which **both** stores return identically and which the contract
asserts. The in-memory map mirrors the Postgres row so the two hold the same record; it is documented
as unread rather than left looking accidental.

### TDD evidence

Two new contract cases, both red before the fix and both green against **both** stores after:

```
FAIL tests/caring-contacts-repository.test.ts > … > markRetentionCleared
  > actually removes the identifying detail, rather than only recording that it was cleared
AssertionError: expected 'Jordan Nguyen' to be ''
FAIL … > clears the cultural-identity report too, which lives outside the plan row
AssertionError: expected 'Noongar' to be null
```

```
✓ |caring-contacts-db| … markRetentionCleared > actually removes the identifying detail … 231ms
✓ |caring-contacts-db| … markRetentionCleared > clears the cultural-identity report too … 196ms
```

The first test carries positive controls on all three fields before the clearance, and asserts the
episode is still **there** afterwards — state, pathway version, counts and dates all unchanged — so
it proves de-identification rather than deletion. The second exists because cultural identity is
deliberately held outside the plan row, so a store that de-identified only the plan would leave it
behind.

**No existing assertion was deleted or loosened.** The existing
`expect(cleared).toEqual({ ok: true, value: undefined })` still holds unchanged; the two new cases
are additive and strictly stronger.

---

## Finding 7 — duplicated lists, one of which is an access-control rule

`TERMINAL_PLAN_STATES` was declared three times (`model.ts` privately, and once in each store), and
`DISPATCHED_CONTACT_STATES`, `isTerminalPlan`, `outcomeFor`, `READ_ACTIONS` and
`PATHWAY_VERSION_READ_ACTIONS` twice each — the Postgres copies under a comment saying they were
"kept identical to the in-memory store on purpose", which is a promise rather than a mechanism.
`READ_ACTIONS` is the one that carried real risk: it is the map from read surface to required
capability, so a change to who may read an episode could land in one store only.

**Fix.**

- `model.ts` now **exports** `TERMINAL_PLAN_STATES`, and `DISPATCHED_CONTACT_STATES` moved there
  beside it (the review named it in the same finding).
- `repository.ts` now owns `READ_ACTIONS`, `PATHWAY_VERSION_READ_ACTIONS`, `isTerminalPlan` and
  `outcomeFor`, beside `PlanOutcome`.
- Both stores import all six. Every local copy is gone.

`retention.ts`'s `TERMINAL_EPISODE_STATES` was left alone, as instructed — it is declared over the
parallel `EpisodeState` union and the two were kept separate deliberately. The comment in `model.ts`
explaining that had to be worded **without** the word "retention", because
`tests/caring-contacts-retention.test.ts` enforces that no sibling module in the domain names that
policy module. That guard caught the first wording immediately (`model.ts: mentions "retention"`),
which is the guard working.

---

## Files changed

Sealed domain and stores:

- `src/lib/caring-contacts/fingerprint.ts` — SHA-256 digest; canonicalisation made private
- `src/lib/caring-contacts/schedule.ts` — exports `isAwstCalendarDay`
- `src/lib/caring-contacts/assignment.ts` — `coverage-window-not-calendar-day` refusal
- `src/lib/caring-contacts/permissions.ts` — `grantedActionsFor` own-property lookup at both sites
- `src/lib/caring-contacts/model.ts` — exports `TERMINAL_PLAN_STATES`, `DISPATCHED_CONTACT_STATES`
- `src/lib/caring-contacts/repository.ts` — `READ_ACTIONS`, `PATHWAY_VERSION_READ_ACTIONS`,
  `isTerminalPlan`, `outcomeFor`, `CLEARED_PATIENT_DETAIL`; replay-record bound documented
- `src/lib/caring-contacts/in-memory-repository.ts` — `clonePathwayVersion`; retention clearance
  performed; shared constants imported; retention record is now a `Map`
- `src/lib/caring-contacts/db/postgres-repository.ts` — retention clearance performed;
  `RESTART_APPROVAL_REFUSALS` own-property lookup; shared constants imported

Tests:

- `tests/caring-contacts-fingerprint.test.ts` — **new**
- `tests/caring-contacts-postgres-repository.test.ts` — the `idempotency_records` row assertions
- `tests/helpers/caring-contacts-repository-contract.ts` — calendar-day refusal, pathway-version
  snapshot copy, two retention-clearance cases, pointer comment beside the patient-detail assertion
- `tests/caring-contacts-permissions.test.ts` — derived `ROLES`/`SYSTEM_ROLES`, unknown-role cases,
  derivation guard
- `tests/caring-contacts-assignment.test.ts` — eight calendar-day cases plus a positive control

Docs: this report.

No migration was written. No file owned by the concurrent agent was touched.

---

## Stopped and reported rather than fixed

0. **`approveServiceRestart` leaves the reporting team's incident note at rest in the approving
   team's `idempotency_records.result` row.** This is the one I would action first. Full statement,
   the reason my original justification for it was wrong, and a recommendation, under finding 1.
1. **The assignment route's schema still needs tightening.**
   `src/app/api/caring-contacts/assignments/[planId]/route.ts` accepts `from`/`until` as plain
   strings. The domain now refuses malformed windows by name, so the behaviour is correct, but the
   boundary should reject them before the domain has to.
2. **`STOP_REASON_WORDING` and `ALERT_CLASS_LABELS` carry the same prototype-key shape.** Both need a
   design decision (a new domain refusal, or fallback wording on a patient-facing surface) rather
   than a lookup hardening. Detail and recommendation under finding 5.
3. **The retention clearance record is still not readable through `CaringContactRepository`** in
   either store. Detail and reasoning under finding 6.
