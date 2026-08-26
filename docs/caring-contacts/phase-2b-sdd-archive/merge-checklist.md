# Merge checklist — the controller's own work, owed at the merge point

Four branches merge into the trunk `claude/browser-test-gate-handoff-d5c1db`. The trunk is now **0 behind
`origin/main`** after the catch-up merge, and none of the four is pushed.

## 1. ~~The navigation change~~ — REASSIGNED to Task 19, on the seed/templates branch

**No longer mine.** Task 19 (Guidance and Reports) needs the More panel to carry real links, which is the
same capability Templates needs to be reachable below 768px — and Task 19 is going on
`claude/caring-contacts-demo-seed`, the branch that already lit the Templates `href`. Same file, same
branch, one change, no cross-branch conflict. Its brief now carries the whole scope including the
viewport test. Left below for the reasoning, which still stands.

### Original note

Two separate findings turn out to be the same missing capability:

- **Task 15 found Templates is unreachable below 768px.** The rail is `hidden` on phones,
  `PHONE_DESTINATIONS` filters Templates out (`shell.tsx`: `PRIMARY_DESTINATIONS.filter(d => d.id !==
"templates")` — I read this myself), and `MORE_DESTINATIONS` entries are `{ id, label, reason }` with
  **no `href` field at all**. So a shipped production route has no phone-reachable inbound link.
- **Task 19 (Guidance and Reports) needs exactly that `href` field**, because both live in the More panel.

**Do it once:** give `MORE_DESTINATIONS` optional `href` support, keeping every entry that has no page
working unchanged, and route Templates through the More panel rather than displacing something from the
four-item phone bar. Ruling 89 still binds — a destination is lit only when its page exists.

**The repo-level finding underneath it, worth an `/issues` capture:** `tests/route-reachability.test.ts`
reads the destination **table**, not the viewport, so it passes while a route is unreachable on phones. If
that blindness is confirmed, the orphan-route gate has a hole the whole team relies on it not having.

## 2. The `test:cc-guards` union — and the hole underneath it, which is much larger than two suites

Compute the union **at merge time**; do not carry a number. Verified by dry-run that `package.json` does
**not** conflict — the four branches' additions sit at different positions in the one line — but read the
merged file and count its paths rather than trusting the absence of a conflict marker.

**Suites to ADD to the gate. This has now bitten twice and is not optional:**

- `tests/caring-contacts-overlay-trigger.dom.test.tsx` — its absence caused Task 10 to declare a
  distinction **unprovable offline** that this very suite already proves. A gate that omits a suite does
  not merely skip coverage, **it hides the precedent.**
- `tests/caring-contacts-overlay-host.dom.test.tsx` — both suites exercise
  `openWorkspaceOverlay`/`closeWorkspaceOverlay`, which the privacy work **changed**, so the function's
  existing behavioural suites ran in **neither** the narrowed mutation runs nor the "full" gate.
- `tests/caring-contacts-demo-seed.test.ts` and `tests/caring-contacts-pathway-versions.test.ts` are
  already added on the seed branch.

### The hole, measured

I took every `test:cc-guards` path on all five branches, unioned them, and compared that union against every
Caring Contacts test file that exists on any branch. Excluding the four `tests/helpers/` modules (not suites)
and the two Playwright specs (a different runner), the suites in **no branch's gate at all** are these:

`access-audit`, `api-handler`, `assignment`, `audit`, `contact-rescheduling`, `empty-state`, `fingerprint`,
`hospital-events`, `message-copy`, `message-policy`, `migrations`, `model`, `notification-preferences`,
`page-access-audit`, `permissions`, `postgres-repository`, `referrals`, `repository`, `server-config`,
`server-pool`, `server-store`, `service-state`, `session`, `simulation`, `training`, `width-state`,
`write-serialisation`, plus `caring-contact-linked-routes`, `caring-contact-mockups`,
`caring-contact-product-redesign`, `caring-contact-prototype-state` and `caring-contact-route-files`.

**This is not a coverage nicety. Several of them are the direct behavioural suites for modules this phase
changed.** The worst pairing: `cc-message-name` edited **both** `message-policy.ts` and `message-copy.ts` —
the modules that decide a patient-visible message's wording and its GSM-7 segment budget — and the gate ran
**neither** of their suites. Between them they hold 68 cases importing exactly those two modules.

### What I did about it, and what it proved

Rather than assert the risk, I ran the exposed suites myself, per branch, narrowed:

| Branch            | Suites run                                                                                                  | Result                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `cc-message-name` | `message-policy`, `message-copy`                                                                            | `Test Files 2 passed (2)`, `Tests 68 passed (68)`   |
| `cc-schedule`     | `access-audit`, `page-access-audit`, `contact-rescheduling`, `api-handler`, `route-files`                   | `Test Files 5 passed (5)`, `Tests 56 passed (56)`   |
| `cc-templates`    | `server-store`, `repository`, `server-pool`, `server-config`, `empty-state`, `linked-routes`, `route-files` | `Test Files 7 passed (7)`, `Tests 178 passed (178)` |

**All green.** So the hole is an evidence problem, not — on these three branches — a defect problem. Say it
that way and no stronger: 302 cases that had never run against this phase's changes now have, and none
reddened.

**`cc-plan-detail` is NOT in that table** because Task 11b was live in its worktree when I ran these, and
running a gate against a moving tree proves nothing about either tree. Its exposed suites are
`permissions`, `assignment`, `model` and `service-state` — 11b is building pause, withdrawal and
reassignment, so `permissions` and `assignment` are the two most exposed suites in the whole phase and the
two I have the least evidence about. **Run them the moment that worktree goes idle.**

### The consequence for the owed gates

**`npm run test` at the merge point is not a formality.** It is the first time most of these suites will
have run against this phase's work at all. Budget for it to find something, and do not treat four green
`test:cc-guards` runs as though they were four green full suites — they were never the same gate.

## 2c. Optional hardening — scoped and costed, and it must NOT displace build work

**The arrival-address gap on the three non-Patients workspace routes.** `overlayUrl()` runs in the browser,
so a name already in an address sits in that request's server log until the first overlay interaction
rewrites it. The Patients page's `redirect()`-before-any-read property is not matched there.

Two facts established by review, both of which change its shape:

- **It is cheap to verify, not expensive.** `src/proxy.ts` is the one matching place, and it owns the CSP
  nonce and Supabase session refresh application-wide — but **three dedicated offline suites already cover
  exactly those two concerns**: `tests/proxy.test.ts` (which really does contain both `nonce` and
  `strict-dynamic`), `tests/proxy-auth.test.ts`, and `tests/proxy-session-refresh.test.ts`. **None is named
  in any `package.json` script**, so the cost is **one narrow extra suite selection**, not writing coverage
  from scratch.

  _(The set is named rather than counted deliberately. An earlier draft of this line carried per-file case
  counts relayed from a review; one was wrong — `proxy-session-refresh.test.ts` has 5 `it` blocks, one an
  `it.each` over 6 paths, so no single number describes it. The implementer caught it and declined to plant
  a fresh count while correcting another. That is the rule working.)_

- **It has no known producer.** Every producer was traced: no in-app path has ever written a query
  parameter to those three routes except `plan` and `referral`, both synthetic ids from named builders. The
  only historical producer of a _name_ was the caseload GET form, which posted to `/caring-contacts/patients`
  **only**, and `overlayUrl` preserves the pathname — so the copy could never carry it across routes.
  **Reaching the gap requires a hand-typed or externally supplied URL.**

**Ruling: record, do not build now.** Defence-in-depth against something nothing can currently trigger,
while four build tasks, the merge and the owed gates come first. It is well-scoped enough for one later
sitting. The same reasoning covers the surviving `#<name>` fragment, which is narrower still — history
only, never sent to a server, and nothing in the workspace writes one.

## 2a. TWO implementations of `ExitOnlyOverlayTrigger`, at different paths — caused by a controller error

**Both branches have one, and they will not collide as a merge conflict — they will both survive, silently.**

| Branch                               | Location                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `claude/caring-contacts-plan-detail` | `src/components/caring-contacts/workspace/overlays/exit-only-overlay-trigger.tsx` (its own file) |
| `claude/caring-contacts-demo-seed`   | inside `overlays/overlay-trigger.tsx:167`                                                        |

**Cause:** the controller verified Task 10's trigger existed and then told Task 16 to use it — **on a branch that
does not have it.** Task 16 grepped, found only the brief, correctly reported the absence, and built its own.
Ninth instance of the same error class this session: _a narrowly-verified fact generalised to a scope it was
never checked against._

**Resolution — keep Task 10's file**, because it has more consumers (Task 11a wired three rows through it) and
its own independent review. **But before deleting Task 16's, check the property Task 16 built for and Task 10
may lack:** Task 16's version reads `mutatesState` off the frozen table so that **Task 14's union narrowing
composes rather than collides**. If Task 10's throws on a construction-time check that the narrowed
`NonMutatingOverlayId` makes unreachable — or worse, uncompilable — adopt Task 16's mechanism into the kept file.

**Then re-point every consumer** and confirm no module still exports the name twice.

## 2b. A file two branches both edited — the one conflict that is not trivial

`src/components/caring-contacts/workspace/patient-overview.tsx` is edited on **both**
`cc-plan-detail` (Task 10 built the plan and contact detail into it) and `cc-schedule` (Task 13 moved two
label maps out of it into a new `contact-vocabulary.ts`, claiming **no rendered text changed**).

**The claim is VERIFIED, by me, literally.** At `a0959de6d`, the whole diff to `patient-overview.tsx` is:
two `import` lines changed, and the two maps plus their explanatory comments deleted. **Not one quoted
string was added to that file.** The extracted maps are byte-identical in the new module — same keys, same
order, same strings, including `Delivered (transport receipt)` and the rest of the transport vocabulary. The
two maps Task 13 did NOT move (plan state, episode state) are still in place, unchanged.

What that leaves is the conflict itself, which is still real: Task 10 adds plan and contact detail to the
same file Task 13 shortened. **Resolve Task 10's additions on top of Task 13's extraction, not the other way
round**, and confirm the resulting file imports `CONTACT_STATE_LABELS` and `MESSAGE_TYPE_LABELS` rather than
re-declaring either — a resolution that keeps both sides' text would silently restore a second copy of the
vocabulary, and a second copy is how the two drift apart later.

## 3. The conflict map, dry-run rather than guessed

Every merge below was dry-run with `git merge-tree --write-tree` against the trunk. **This is the real set,
and it is not the set the earlier sections assumed.**

| Merge                     | Conflicts                                                                                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `origin/main` → trunk     | `data/outstanding-issues-snapshot.json`, `data/repo-awareness-snapshot.json`                                                                                                                           |
| `cc-message-name` → trunk | **none — clean**                                                                                                                                                                                       |
| `cc-plan-detail` → trunk  | `tests/caring-contacts-explained-automation.dom.test.tsx`                                                                                                                                              |
| `cc-schedule` → trunk     | `STANDING-DISCIPLINE.md` (add/add), `docs/codebase-index.md`, `docs/design-system/ADOPTION.md`, `adoption-manifest.json`, `tests/design-system-adoption.test.ts`, the same `explained-automation` test |
| `cc-demo-seed` → trunk    | `STANDING-DISCIPLINE.md` (add/add), `task-19-brief.md` (add/add), `docs/codebase-index.md`, `docs/site-map.md`, `ADOPTION.md`, `adoption-manifest.json`, `design-system-adoption.test.ts`              |

**The only source conflict in the whole phase is one array.** Both `cc-plan-detail` and `cc-schedule` add an
entry — with its justification comment — to the client-component allowlist in
`tests/caring-contacts-explained-automation.dom.test.tsx`: `overlays/exit-only-overlay-trigger.tsx` and
`contact-time-adjustment.tsx` respectively. **Keep both entries and both comments.** There is nothing to
adjudicate; they are independent additions that happen to land on the same line.

**Everything else is generated or a doc.** `data/*-snapshot.json`, `docs/site-map.md`,
`docs/design-system/ADOPTION.md`, `adoption-manifest.json` and `design-system-adoption.test.ts` are
**regenerated, not hand-merged** — resolve by taking either side and re-running the generator, then commit
what it produces. Hand-merging a generated file produces a tree that no generator would emit, and the next
run silently reverts it.

`STANDING-DISCIPLINE.md` is add/add because two branches created it independently. **The trunk's
consolidated version is the resolution** — it already carries every rule this session bought, including the
gate-drift rule added after those branches forked.

### Order, and why it is this order

1. **`origin/main` → trunk** (the second catch-up; the trunk is 13 behind again)
2. **`cc-message-name`** — clean, so it costs nothing and shortens the list
3. **`cc-plan-detail`** — one trivial conflict
4. **`cc-schedule`** — and this is where `patient-overview.tsx` finally conflicts
5. **`cc-demo-seed`** — largest doc surface, resolved last against a settled tree

**`patient-overview.tsx` does not appear in the table above, and that is not a reprieve.** The dry-runs are
pairwise against today's trunk, where only one branch has touched the file. The plan-detail-versus-schedule
conflict on it is real and appears at step 4, once step 3 has landed Task 10's additions. §2b still governs
how to resolve it.

## 4. Rulings not yet in the build record

`docs/…/phase-2b-build-record.md` is trunk-owned and was blocked by a live implementer. Land
`scratchpad/rulings-129-130.md` — **note both were rewritten after review falsified their first versions**,
and the rewrite is the version to land.

## 5. Gates owed, and only the controller may run them

Implementers run `test:cc-guards` only, by policy, because concurrent worktrees starved the exclusive heavy
lease and one task's ledger came back ten of twelve unrun. **Still owed, once all four worktrees are idle:**

- the full `npm run test`
- **`npm run build`, and this one is not optional.** The privacy fix split the patients directory into a
  server wrapper plus a client island, and **this repository has already shipped two Server/Client boundary
  defects past typecheck AND the full unit suite** — only a build or a live request catches them. The
  implementer inspected every crossing prop and said so plainly: _inspection, not proof_. Task 13 and
  Task 15 also added client components. Measure on a cold `.next` (`rm -rf .next` first) or
  `check:bundle-budget` reads stale output and reports byte-identical numbers.
- `npm run verify:ui`, and specifically `tests/ui-caring-contacts-workspace.spec.ts` — Task 13 added seven
  unrun tests to it and Task 15 added a route entry with no proof block
- `npm run format` across the tree, **committed** — formatting is in none of `test`, `typecheck` or `lint`,
  and a `prettier --check` already caught two files Task 12 created unformatted

**Browser proof is owed and deliberately unwritten** for Templates and the Schedule screen. Task 15's
warning must be honoured: **do not switch the demo seed on for the Playwright server** to populate those
screens — it would delete the empty-caseload observations other tests depend on.

## 6. Where my own briefs were wrong, so the next one is not

- Task 15's brief said "the message-content column is empty and no row exists anywhere". True of Postgres,
  **false of the demo seed on that very branch**, which writes the approved specimen into
  `snapshot.messageTextByType.standard`. A screen-level "not yet authored" would have been a false
  statement about a seeded record.
- Task 15's brief ordered a new `AccessedObjectType` member on Ruling [46]'s letter. The implementer
  argued the read is byte-identical to one that already exists, so a new member would name a **screen**
  rather than an object and split one askable trail question in two. **SETTLED — Ruling [134], and the
  implementer was right.** I checked it literally: the Templates library and the plan wizard record the
  identical access tuple for the same collection. Nothing to do at the merge; the ruling records why, and
  records the divergence that would later justify a split.

  The generalisable half: **Ruling [46]'s wording said "add a member"; its reasoning said "make the question
  askable".** I applied the wording, the implementer read the reasoning, and when those two point opposite
  ways the reasoning is the ruling. Briefs written from a ruling's sentence rather than its argument will
  keep producing this.

## 2d. The DOM mirror is closer to the route, and still a mirror

Task 14's round 4 put the request body behind **one schema imported by both sides** —
`src/lib/caring-contacts-contact-move-request.ts`, used by the real route and by the DOM mirror the tests
drive. That closes the half that was drifting silently: body shape, and the success envelope, are now pinned
on the real handler.

**What is still NOT pinned, and the implementer named it rather than quietly closing it:** status codes, cache
headers, the demo-mode lock, the denial audit event, and the 413. A mirror that answers `200` where the route
answers `403` is a test passing on a screen a clinician would never see.

**Ruling: this is a contract change, not a Task 14 edit.** Closing the envelope half properly means a shared
response type, which touches every route in the workspace, not the one Task 14 owns. Recorded here so the
merge knows the mirror's exact remaining reach — and so nobody later reads "one schema, both sides" as
meaning the whole response is pinned. It is the request that is.

## 7. The trunk has drifted again

The catch-up merge left the trunk **0 behind `origin/main`**. It is now **13 behind** — `main` moved while
the four branches were building. Nothing is broken by this and nothing is pushed, but the merge point owes a
second catch-up merge, and the first one cost 26 conflicts across 31 commits. **Do the catch-up merge into
the trunk BEFORE merging the four feature branches**, not after: resolving trunk-versus-main conflicts is
cheaper when the trunk does not also carry four branches' worth of new files, and the first catch-up
audit found the merge actually **repaired** a live trunk defect, so it is not a formality.

## 8. Tasks 20 and 21 run AFTER the merge, not before it — Ruling [133]

Both briefs are written and both were queued to run next. **They must not.**

**Task 20 reconciles all twenty-four rows of the frozen interaction matrix.** Run on any one branch, it can
only see that branch's wiring — so it would report as unwired every row another branch wired, and its
deliverable is precisely a table of which rows are wired. A reconciliation run against a partial tree does
not produce a weaker table; it produces a **wrong** one, and a wrong table is worse than none because the
next reader treats it as the answer.

**Task 21 proves responsive and accessibility properties across every screen in the phase.** The screens are
spread across four branches. Same problem, and additionally its per-screen, per-condition table is exactly
the artefact that would have to be redone.

This is the same failure that produced the duplicate `ExitOnlyOverlayTrigger` (§2a): **a fact checked on one
branch, asserted about the tree.** Doing it deliberately, at the scale of twenty-four rows and five
conditions, would be that error industrialised.

**Order: catch-up merge → four feature branches → the owed gates → Task 20 → Task 21.** Tasks 20 and 21 are
also the two tasks whose findings the gates would most want to precede, so running them on the merged tree
costs nothing in sequence and buys a table that is true.

**Cost if wrong:** the merge happens without two more sets of eyes on it. Against that: both tasks are
verification tasks, and verification of the wrong tree is not verification.
