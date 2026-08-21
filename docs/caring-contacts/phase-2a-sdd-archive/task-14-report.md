### Task 14 report: route handlers that audit every view

Phase 1 open item 1 — "reads are not audited" — is closed. A read is only observable where it
crosses a boundary, and the boundary now exists.

---

## What I implemented

**`src/lib/caring-contacts-server/handler.ts`** — the two handler factories.

- `readHandler(config)` resolves the demo actor, fetches the memoised store, runs the configured
  read, and then records an access event **on every call, before returning** — `allowed` when
  something was released, `denied` when nothing was, `failed` when the read threw. `recordAccess`
  appears in this file and nowhere else; routes describe what to read and never decide whether the
  read is recorded.
- `writeHandler(config)` parses with Zod, resolves the actor, asks
  `canPerformCaringContactAction`, and returns **403 with the named reason in the body** when the
  capability is refused (`cross-team-denied`, `action-not-granted`, `no-roles`).
- Refusal-to-status map, exactly as specified: `not-found` → 404; `permission-denied` and every
  capability denial → 403; `stale-version`, `duplicate-active-plan`, `plan-already-exists`,
  `idempotency-key-reused-for-a-different-write` → 409; `service-stopped` → 423; everything else → 422. The body is always `{ refusal: string }`.
- Every response carries `Cache-Control: no-store`.

**`src/lib/caring-contacts-server/service-state-view.ts`** — the Ruling 43 narrowing (below).

**Ten route handlers** under `src/app/api/caring-contacts/`: `plans/`, `plans/[planId]/`,
`referrals/`, `service-state/`, `access-trail/`, `assignments/[planId]/`, `dispatches/`,
`notification-preferences/`, `training/`, `pathway-versions/`.

Design points worth naming:

- **No patient data in any URL.** Reads take synthetic identifiers in the path. The access-trail
  query goes in the body of a `POST` because it is the one read whose filters could grow to carry
  free text. The dispatch window uses `?from=&to=` because ISO instants are not patient data.
- **Two deviations from the brief's literal interface**, both forced by shapes the brief could not
  see, both noted here rather than made quietly:
  1. `WriteHandlerConfig.action` accepts `CaringContactAction | ((body) => CaringContactAction)`.
     Four routes need it: a referral transition needs `acceptReferral`,
     `returnReferralForClarification` or `declineReferral` depending on the transition asked for,
     and the store checks exactly that action. A fixed action would have made the boundary
     _stricter_ than the store on some transitions and unable to express others. The brief's own
     literal usage (`action: "publishPathwayVersion"`) still type-checks unchanged.
  2. The Ruling 43 narrowing lives in its own module rather than in `handler.ts`. `handler.ts` is
     generic plumbing; a service-state-specific rule there would be misplaced. It cannot live in
     the route file either — Next 16 type-checks route modules against a known export set, so a
     non-handler export from `route.ts` is a build risk.
- **`idempotencyKey` is required in every write body.** My first pass derived a default from the
  request's identifiers. Self-review killed that: a derived key cannot capture a body that also
  carries free text (an incident note, a decline reason), so two genuinely different writes would
  collide on one key and be refused as replays of each other — returning
  `idempotency-key-reused-for-a-different-write` (409) where the truthful refusal was
  `service-already-stopped` (422). Only the caller knows whether a request is a retry.
- **`withdraw` must state its origin.** Also from self-review: defaulting an absent `origin` to
  `"patient"` would put words in a patient's mouth on a recorded fact. The lifecycle body is now a
  discriminated union, and a withdrawal without an origin is a 400.
- **`savePathwayVersion` is deliberately not exposed.** It takes a whole `PathwayVersion`,
  including its state and its recorded approvals; accepting that shape from the wire would let a
  caller post a version that arrives already approved. Only the governance transitions, which the
  domain checks one at a time, are routed. `approve` and `publish` are attributed to the _acting_
  actor, never to an identifier from the body — the no-self-approval rule is worthless if the
  approver's identity can be chosen in the request.

---

## TDD evidence

### RED

```
$ node scripts/run-vitest.mjs run tests/caring-contacts-api-handler.test.ts --reporter=dot

 FAIL  |node| tests/caring-contacts-api-handler.test.ts [ tests/caring-contacts-api-handler.test.ts ]
Error: Cannot find package '@/lib/caring-contacts-server/handler' imported from D:/Worktrees/Database/cc-2a-live/tests/caring-contacts-api-handler.test.ts
 ❯ tests/caring-contacts-api-handler.test.ts:26:1

 Test Files  1 failed (1)
      Tests  no tests
```

Expected for exactly this reason: the test file was written first, against a `handler.ts` and a
`service-state-view.ts` that did not exist yet. Nothing else could have failed at that point,
because collection never got past the import.

### GREEN

```
$ node scripts/run-vitest.mjs run tests/caring-contacts-api-handler.test.ts --reporter=dot

 Test Files  1 passed (1)
      Tests  19 passed (19)
```

(17 at first green; 19 after self-review added the 422-fallback and read-throws cases.)

---

## Mutation evidence

Each mutation was checked first for whether it changes a value some assertion actually reads —
that is the check that distinguishes a real test from a decorative one. All four did. All four
were reverted; `git status` after the last revert showed no modified tracked files.

### Mutation 1 (from the brief) — remove `recordAccess` from the denied branch

Changed `const recorded = await recordAccessAttempt(...)` to
`const recorded = outcome === "denied" ? true : await recordAccessAttempt(...)`.

Value read by an assertion: yes — the spy array `recorded()` is asserted on directly.

```
 FAIL  ... > records an access event even when the read is denied
AssertionError: expected [] to deep equally contain ObjectContaining {"outcome": "denied"}
 ❯ tests/caring-contacts-api-handler.test.ts:163:24
```

Reverted.

### Mutation 2 (from the brief) — return a bare 403 with no body

Changed the capability-denial branch to `new Response(null, { status: 403, ... })`.

Value read by an assertion: yes — the third test parses the body and compares it to
`{ refusal: "action-not-granted" }`.

```
 FAIL  ... > returns the named denial reason so the interface can explain itself
AssertionError: promise rejected "SyntaxError: Unexpected end of JSON input" instead of resolving
 ❯ tests/caring-contacts-api-handler.test.ts:193:34
```

Reverted.

### Mutation 3 (mine, Ruling 43 half one) — always release the note

Replaced the `decision.allowed ? … : …` conditional in `narrowServiceStateForActor` with the
unconditional visible branch.

Value read by an assertion: yes — three assertions read `view.incidentDetail` and the serialised
response body.

```
 FAIL  ... > withholds the note from an actor whose roles do not include the patient-record capability
AssertionError: expected { visible: true, …(2) } to deeply equal { visible: false, …(1) }
+   "note": "Message for Rowan Mira Delacroix reached +61 491 570 156.",

 FAIL  ... > narrows the note through the service-state route, and still reports the stop
AssertionError: expected '{"stopped":true,"reason":"duplicate-s…' not to match /Rowan|Mira/
```

3 of 19 red. Reverted.

### Mutation 4 (mine, Ruling 43 half two) — hide the whole stop from a foreign team

Added `if (!decision.allowed) return { stopped: false, banner: null };` — the naive "just hide
everything" fix, which satisfies half of the ruling and violates the other half.

Value read by an assertion: yes — the "still tells that actor the service is stopped, why, and
when" test reads `view.reason`, `view.stoppedAt` and `view.banner`, and the route test asserts
`stopped: true`.

```
 FAIL  ... > narrows the note through the service-state route, and still reports the stop
AssertionError: expected { stopped: false, banner: null } to match object { stopped: true, …(2) }
-   "reason": "duplicate-send",
-   "stopped": true,
```

4 of 19 red. Reverted.

This fourth mutation is the one I would not have run if I had only followed the brief, and it is
the one that proves the ruling's second half — "narrow the note, never the fact" — is load-bearing
rather than decorative.

---

## How the Ruling 43 narrowing was implemented

**The shape.** `describeServiceStop` already showed the way: its parameter type
`ServiceStopBannerFacts` omits `note` _by construction_, so the banner cannot interpolate it even
by accident. I did not invent a competing shape; I extended that idea to a response type:

```ts
export type ServiceIncidentDetail =
  { visible: true; stoppedBy: ActorId; note: string } | { visible: false; withheldReason: string };

export type ServiceStateView =
  | { stopped: false; banner: null }
  | { stopped: true; reason; stoppedAt; restartApprovals; banner; incidentDetail: ServiceIncidentDetail };
```

Three deliberate choices in that shape:

1. The withheld case is an explicit discriminated branch, not an omitted or emptied field. That is
   the whole reason the store could not carry this: an empty string or a `null` note reads as "no
   note was written", which is never true — the domain refuses a blank note outright. "No note"
   and "a note you may not see" are different facts.
2. `withheldReason` carries the capability decision's own reason (`cross-team-denied`,
   `no-roles`), so a denial says why, the same principle the write path follows. It is a
   permission reason, never patient data.
3. `stoppedBy` sits inside the visible branch. Who recorded the incident is incident detail; that
   the service is stopped, the reason category, and the timing are service facts and go to
   everyone.

**The decision.** One call to the sealed permission function, with the reporting team as the
resource:

```ts
canPerformCaringContactAction(actor, "viewPatientRecord", { teamId: state.reportedByTeamId });
```

That answers both dimensions at once and reimplements nothing. `canPerformCaringContactAction`
checks team scope first, so a foreign-team actor gets `cross-team-denied`; an in-team actor
without the capability gets `action-not-granted` or `no-roles`. The narrowing module holds no
grant table of its own.

**How both halves were proved.** Four unit tests on the function (foreign team withheld; foreign
team still reads the fact, reason and timing; reporting team reads the note; roleless in-team
actor withheld) plus one end-to-end route test that stops the service _as an actor of another
team_ and then reads `GET /api/caring-contacts/service-state` as the demo actor: body asserted not
to match `/Rowan|Mira/`, and asserted to contain `stopped: true`, `reason: "duplicate-send"` and
`incidentDetail: { visible: false, withheldReason: "cross-team-denied" }`. Mutations 3 and 4 above
confirm both halves can fail.

---

## Next.js 16 guides read

- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`

What they contradicted or changed versus what I would otherwise have written:

- **`context.params` is a Promise** (version history: "`v15.0.0-RC` — `context.params` is now a
  promise"). Untrained instinct is `{ params }: { params: { planId: string } }`; both dynamic
  routes await it.
- **`RouteContext<'/users/[id]'>` is a global helper** — but the docs say it is _generated during
  `next dev`, `next build` or `next typegen`_. I deliberately did **not** use it: these routes are
  brand new, so the generated types do not exist until a build runs, and a plain `tsc --noEmit`
  would have failed on a helper that is not yet emitted. Explicit
  `{ params: Promise<{ planId: string }> }` instead.
- **Route Handlers are not cached by default**, and `GET` caching changed from static to dynamic in
  `v15.0.0-RC`. My prior would have been to add cache-defeating config; none is needed. Every
  handler also calls `cookies()` via `resolveDemoActor`, which the docs confirm terminates
  prerendering. The explicit `no-store` header stays because it is a _response_ contract for the
  client, not a build-time one.
- **`NextRequest` gives `request.nextUrl.searchParams`** — used in the dispatches route rather than
  hand-parsing `new URL(request.url)`.

---

## Checkpoint 3

```
$ npm run test

 Test Files  696 passed | 2 skipped (698)
      Tests  7713 passed | 29 skipped (7742)
```

```
$ node ./node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
tsc exit: 0
diagnostics lines: 0
```

Typecheck coverage was verified rather than assumed: `tsc --noEmit --listFiles` shows 11
`api/caring-contacts` files in the program (the ten new routes plus Task 13's session route), along
with `handler.ts` and `service-state-view.ts`.

One tracked file needed regenerating: `tests/site-map.test.ts` failed on the first full run because
`docs/site-map.md` did not list the ten new API routes. Fixed with `npm run sitemap:update`, which
is a generator — the diff is ten added lines and nothing else. No existing assertion was changed,
loosened or deleted anywhere in this task.

---

## Files changed

Created:

- `src/lib/caring-contacts-server/handler.ts`
- `src/lib/caring-contacts-server/service-state-view.ts`
- `src/app/api/caring-contacts/plans/route.ts`
- `src/app/api/caring-contacts/plans/[planId]/route.ts`
- `src/app/api/caring-contacts/referrals/route.ts`
- `src/app/api/caring-contacts/service-state/route.ts`
- `src/app/api/caring-contacts/access-trail/route.ts`
- `src/app/api/caring-contacts/assignments/[planId]/route.ts`
- `src/app/api/caring-contacts/dispatches/route.ts`
- `src/app/api/caring-contacts/notification-preferences/route.ts`
- `src/app/api/caring-contacts/training/route.ts`
- `src/app/api/caring-contacts/pathway-versions/route.ts`
- `tests/caring-contacts-api-handler.test.ts`
- `docs/caring-contacts/phase-2a-sdd-archive/task-14-report.md` (this file)

Modified:

- `docs/site-map.md` (generated by `npm run sitemap:update`)

Nothing under `src/lib/caring-contacts/` was touched.

---

## Self-review findings (all acted on before commit)

1. **Derived idempotency keys were wrong.** Described above. Now required in every write body.
2. **`withdraw` silently defaulted its origin.** Described above. Now a discriminated union.
3. **`refusalStatus` and `refusalResponse` were exported and used by nobody outside the module.**
   Both are now private. `invalidRequestResponse` stays exported — two routes use it.
4. **Two branches had no test.** The 422 catch-all and the read-throws path were reachable and
   unasserted. Added: `resume` on an already-active plan → 422 `{ refusal: "plan-not-paused" }`,
   and a read that throws → 500 `{ refusal: "read-failed" }` with a `failed` access record.
5. **A stray `void store;`** left over from an earlier draft, and a badly named
   `actorIdFromNothing` helper in the notification-preferences route. Both removed.
6. **Tests verify behaviour, not mocks.** Only two things are replaced: `next/headers` (to set the
   demo-role cookie, the same technique the Task 13 session test uses) and the store _module_, so
   each test gets its own workspace — the production store is memoised at module scope on purpose,
   so sharing it would have coupled every case. The store behind that mock is the **real in-memory
   repository**, held to the same contract as Postgres, and five tests drive the **real route
   modules** end to end rather than the factories. No assertion checks that a mock was called in
   place of checking what happened.
7. **Test output is pristine** — no stderr, no warnings, no console noise from this file.

---

## Concerns

**1. A write denied at the boundary is not audited.** This is the one I most want a second opinion
on. The store's `runWrite` records a `denied` audit event for every refusal it makes, including
permission refusals. `writeHandler` checks the capability _before_ calling the store — which the
brief requires, and which its third test pins (a stub `write` returning `ok` must still produce a 403) — so a write refused at the boundary never reaches the store and produces no audit event at
all.

I considered and rejected two fixes. Calling the store anyway and ignoring its answer is unsafe:
the store accepts an alternative capability for at least one write (a recorded death is reachable
via `triggerServiceSafetyStop`), so a boundary check could deny something the store would allow,
and calling it first would commit a write we then answered 403 to. Recording the denial through
`recordAccess` does not fit either: `AccessedObjectType` has no member for a write target, and
forcing one in would put a wrong `objectType` in the trail, which is worse than the gap.

Closing this properly needs a write-denial path in the sealed audit types, which is out of scope
here. Reads — the thing this task was for — are fully covered.

**2. `AccessedObjectType` does not cover everything the ten routes read.** Notification
preferences and the training record are the acting actor's own settings, not patient data and not
any of `plan | contact | episode | auditTrail | report | patientDirectory`. I recorded them as
`kind: "administrative"`, `objectType: "report"` with an object id naming the record kind, rather
than skipping the audit. It is the least-bad fit, not a good one. Same judgement for
`pathway-versions` (programme content) and `service-state`.

**3. An empty list read is recorded as `allowed`, not `denied`.** The stores answer a read the
actor may not make with an empty array, exactly as they answer a read that legitimately matches
nothing — deliberately, so a cross-team actor cannot tell those apart. The boundary can only
observe that an empty list was released. Single-object reads do not have this problem (`null` is
recorded `denied`). This is a consequence of the store contract's own indistinguishability rule
rather than something this seam could recover, and it is documented in `readHandler`'s doc comment.

**4. A read that throws produces an opaque 500 with no log.** I did not wire a logger into
`caring-contacts-server` — it would be a new dependency for this seam, and the demo runs offline.
Operationally that means a genuine store fault is hard to diagnose. Worth revisiting when the
production shell (Group 4) lands.

**5. Not exercised against Postgres.** Everything here runs against the in-memory store, which is
what `npm run test` collects. The Postgres store is held to the same contract, so I expect no
divergence, but I did not run `caring-contacts:db:test` and would not have without approval.
