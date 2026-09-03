# Ward Flow — THE plan

**Measured 2026-09-01 at `ed17e803d` on `codex/task-ward-flow-live-state-20260831`.** Every state
below was read from the code, not carried forward from an older document.

> ## ⚠️ THIS FILE SUPERSEDES EVERY OTHER PLAN OR TASK LIST IN THIS PROJECT
>
> There were four. `docs/ward-flow-task-ledger.md`, `docs/ward-flow-remaining-work.md`,
> `docs/ward-flow-roadmap.md` and `docs/ward-flow-complete-ledger.md` all carried task state, and on
> 2026-09-01 an audit found them contradicting each other and the code in twenty-seven places —
> including one file holding **two nine-item tables with the same date and conflicting states for the
> same items.**
>
> **Read those files for WHY a thing is the way it is. Never take a task, a state or a count from
> them.** This is the only list. Where it and any of them disagree, this one is right and the other
> is stale.

## The three rulings in force

From `docs/ward-flow-owner-rulings-2026-09-01.md`, quoted verbatim there:

1. **The latest decision wins, wherever it is written.** Date beats document type. A specification is
   not senior to a ruling made after it. This replaced the old rule that a spec outranks the ledger —
   which had the owner's newest decisions being outranked by documents nobody amends.
2. **The repository is treated as PRIVATE.** ⚠️ This is a **working assumption, not a measured
   fact.** Nobody has verified or changed the remote's visibility and no chat may — that is provider
   access and needs the owner's say-so on the day. If this ever appears anywhere without the word
   _assumed_, correct it on sight.
3. **Confidence-decay is crossed off.** It was never outstanding work: the owner had already deleted
   the concept, because confidence asks a ward to estimate a probability and two wards do not mean
   the same thing by one.

## What the demonstration can do today

The emergency-department-to-ward journey runs end to end. A referral is raised to several
destinations at once, a patient exists and is searchable, a ward accepts, a bed is held, the patient
arrives and appears on the board, **and now leaves again**.

Landed 2026-09-01, in order:

| What                                                                                             | Commit      |
| ------------------------------------------------------------------------------------------------ | ----------- |
| The community hub has a reachable address                                                        | `634232c83` |
| The typecheck gate reads green again — 12 errors to 0                                            | `2df9551a5` |
| **The ward board reads live state, like every other screen**                                     | `eec6e08fa` |
| **A patient can be discharged** — model, guards and all                                          | `76b936a5f` |
| **A ward can discharge somebody from the board** — the first control on it that changes anything | `0e0c5a9a0` |
| 23 inert held-bed figures marked where they are authored                                         | `30d2fda99` |
| **A referrer can withdraw a referral**                                                           | `ed17e803d` |

## What was REMOVED from the plan, and why

Recorded so nobody re-adds them as oversights.

| Item                                                  | Why it is gone                                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Confidence-decay staleness headline                   | Owner deleted the concept. Ruling 3 above.                                                  |
| The inert stage strip                                 | **Already fixed** 2026-08-30 — it has an `onClick`, `aria-pressed`, and filters the queue.  |
| Search results that swallow clicks                    | **Already fixed** 2026-08-30 — they are links inside their list items.                      |
| A real ambulance service named on screen              | Owner descoped: names and placeholders are his to change later.                             |
| Synthetic-data labels and wording                     | Same. **Raise an untrue thing only when it is likely to break behaviour.**                  |
| First acceptance auto-cancelling other referrals      | **Already built** — reducer withdraws every other referred unit on acceptance.              |
| The cross-destination ward-blindness guard            | **Already built**, and it is a real guard rather than a note.                               |
| Transport lifecycle instants as independent optionals | Representable but unreachable — `closure` enforces the exclusion on every path. Left alone. |

## What remains, in order, with estimates

Estimates are working time, and their confidence differs — said per row rather than implied.

### Now — in flight 2026-09-01

| #   | Work                                                                                                                                                                                                                                                                                                           | Who     | Est  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---- |
| 1   | **Render the override register.** A coordinator can overrule a bed gate and nobody can see it happened. Both derivations exist and are tested; nothing calls them. Two views — the coordinator sees all, a ward sees only overrides against it (owner decision **OD-3**, filtered at source, never at render). | Lead    | 1–2h |
| 2   | **The referral withdrawal screen.** The model can withdraw since `ed17e803d`; nothing can raise it.                                                                                                                                                                                                            | Builder | 1–2h |

### Next — small, each closes something visible

| #   | Work                                                                                                                                                | Est                      | Note                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------- |
| 3   | **Was the transport ruling ever built?** The owner ruled a community team CAN arrange transport, not merely see it. Unverified in either direction. | 30m                      | Before item 9 — building a transport screen on an unbuilt transport rule is the wrong order |
| 4   | **A way in to the community hub.** Nothing links to it; 65 team pages reachable only by typing a URL.                                               | 30m                      |                                                                                             |
| 5   | **The 24 audit findings** — triage first, then fix.                                                                                                 | 20m triage, then unknown | ⚠️ Softest number here. Five items from these same documents turned out already built today |
| 6   | **Rename the `/patients/` route**, which renders a MOVEMENT workspace.                                                                              | **20m**                  | Re-estimated down from 1h — see the ruling below                                            |
| 7   | **The form name written twice** → one place.                                                                                                        | 10m                      |                                                                                             |
| 8   | **Comment the invariant** keeping transport terminal states exclusive.                                                                              | 10m                      |                                                                                             |

⚠️ **RULING — the rename must NOT target `/movements/`.** That path is already a live mode page. The
workspace is about ONE movement, so it nests as `/movements/[movementId]` under the existing
collection, or takes another name if the router objects. Decided at implementation time. Found by the
pre-flight scan of this plan, not during implementation.

⚠️ **RULING — the one-hour estimate for item 6 was padding.** It assumed hand-updating the site map,
the reachability assertion and the docs entry. All three are automated: the pre-commit hook
regenerates the site map itself, the route-coverage tests name the exact entries to add, and since
`b5147b9d0` the compiler finds every wrong identifier because `MovementId` and `PatientId` are
distinct types. **Twenty minutes.**

### Then — the journey shows itself. The definition of done sits at the end of this.

| #   | Work                                                                                                    | Est  |
| --- | ------------------------------------------------------------------------------------------------------- | ---- |
| 9   | **The transport screen.** Rules decided (`TR-D4`, `TR-D5`, `TR-D6`); the screen predates them entirely. | 4–6h |
| 10  | **The timeline carries the whole journey.**                                                             | 2–3h |
| 11  | **Print the day.**                                                                                      | 2–3h |

### Then — the design items

| #     | Work                                                                                                                                | Est    |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 12    | **Look at them in a browser first.** Four have not been touched since 2026-08-26; a brief written from the code would be a guess.   | 1h     |
| 13–17 | Network diagram (**give it a use first**), movements screen, capacity screen, ward questionnaires, transport page, a useful header. | 10–15h |

⚠️ **Five design items, not seven.** The stage strip is DONE — it has a click handler and filters the
queue as of 2026-08-30 — and the transport page overlaps item 9.

**Roughly 25–37 hours remain; 15–21 to the definition of done.** Estimates from item 9 upward are
judgement rather than measurement: nobody has opened those screens today.

## ⚠️ Do NOT delete these, whatever a reachability scan says

`ward-referral-visibility.ts` exports four projection functions — `wardScopedReferral`,
`wardScopedReferrals`, `coordinatorScopedReferral`, `coordinatorScopedReferrals` — and **every caller
is a test.** No production file imports the module.

That is legitimate and recorded: `Referral` carries no patient link, so a ward-facing screen could
not show referrals even if it wanted to. The boundary is enforced by a **static contract test** that
tells the next author to route through those functions. **Delete them and the test names a function
that does not exist, and the FD-23 protection evaporates at exactly the moment somebody finally
builds a ward-facing referral surface.**

This is the shape `AGENTS.md` warns about — a module contract whose consumer has not been written
yet is indistinguishable from debris under a reachability scan, and this repository has already
walked back a sweep seven times for it. Run `npm run check:dead-code-candidate` before removing any
exported symbol.

## Held for the owner — no chat decides these

- **Two independent clinician checks** of the bed-release model.
- **Confirmation of the six urgency reasons.** They went in on a chat's own recommendation, which is
  the weakest kind of decision.
- **The free-text override-reason box**, answered two different ways and still shipping as it was.
- **Whether a referrer should give a reason when withdrawing.** The flow is built; the vocabulary is
  deliberately not. The reasons a referrer would give — improved, went home, went elsewhere, died —
  are clinical facts about a person, and adding a member to `WITHDRAWAL_REASONS` is a governance
  decision by that file's own rule.
- **Whether held beds should be authored or derived.** 23 values are authored in `ward-sites.ts` and
  read by nothing; every "Held" figure on screen is derived. Typing real numbers there changes
  nothing, with no symptom to notice.

## Two contradictions the "latest wins" ruling cannot settle

Both sides carry the same date, so the rule has nothing to separate them.

1. **`WB-DB-10` keeps the frozen on-screen view; `WB-DB-11` deletes it.** Both 2026-08-29, neither
   marks the other. _Partly overtaken by events:_ the ward board was made live on 2026-09-01 by the
   owner's own decision, so `WB-DB-11` has effectively won on the board. The morning page still
   carries a comment claiming it freezes, and does not.
2. **The two nine-item Phase 1 tables**, both 2026-08-30, in one file. Being resolved by measuring
   the code rather than by choosing a table — see the section below.

---

## Phase 1, measured item by item — this settles the two conflicting tables

Measured by Ward Builder at `ed17e803d`, from the code, first-hand. **Neither of the two 2026-08-30
tables is used; both are superseded by this.** Seven of nine are built, one is genuinely partial,
one is undefined.

| #   | Item                                        | State                           | Evidence                                                                                                                                                                                                    |
| --- | ------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The urgent flag                             | **BUILT**                       | `ward-model.ts:74` — and it is a **three-tier level, not a boolean**. A table calling it a flag describes something that does not exist.                                                                    |
| 2   | The `FD-23` screen boundary guard           | **BUILT**                       | `ward-referral-visibility.ts`, enforced by a static contract test. ⚠️ See the do-not-delete section above.                                                                                                  |
| 3   | Referral to several destinations in one act | **BUILT**                       | `referrals/new/page.tsx`, `referral-intake.tsx:128`; per-destination decline handled without closing the referral.                                                                                          |
| 4   | ED psychiatry hub                           | **BUILT**                       | `ed/[edId]/page.tsx`; inbox, outbox, governance and a working referral form. Reads live state.                                                                                                              |
| 5   | The ward page as the ward hub               | **BUILT**                       | `ward/[unitId]/page.tsx`; states capacity, accepts a restatement, flags releases, shows governance.                                                                                                         |
| 6   | Patient screen + universal referral button  | **BUILT, deliberately partial** | `person-screen.tsx:111`. The button navigates; the referral is **not joined to the person**, because `Referral` carries no patient link — and the screen says so on itself. Not a gap to close by accident. |
| 7   | Patient screen polish                       | **UNDEFINED**                   | See below.                                                                                                                                                                                                  |
| 8   | Coordinator hub / override register         | **PARTIAL**                     | See below.                                                                                                                                                                                                  |
| 9   | The community hub                           | **BUILT**                       | Route, live render, and both the found and not-found paths confirmed by real requests.                                                                                                                      |

### Item 8 is the write half without the read half, and it is small

A coordinator **can** override — `shortlist-panel.tsx` carries the control, the event carries the
reason, the reducer validates it by membership and stores it on `Movement.overrides`. The register
**can** be derived — `allOverrides()` and `overridesAgainstUnit()` in `ward-derivations.ts`, fully
covered by `tests/ward-override-register.test.ts`.

⚠️ **Nothing renders it.** Every caller of both functions is a test, and the only override test id in
the repository is the control that _creates_ one. `ward-flow-events.ts:46` says the register exists
to make those decisions accountable — **an accountability record with no reader does not do that.**

**This is a rendering job, not a modelling one**: the derivation and its tests already exist. It is
the highest-value small item on the list.

### Item 7 is STRUCK, and my first reading of it was wrong

⚠️ **CORRECTION, same day.** This section first said there were "two patient screens, both live, and
somebody must say which survives", and estimated hours to consolidate them. **That was wrong and it
was the dangerous kind of wrong** — acting on it would have merged two screens that do different
jobs, and the person screen is the one bound hardest by `FD-23`.

They are not duplicates:

- `/mockups/ward-flow/people/[patientId]` renders **PersonScreen — a genuine PERSON**: name, record
  number, date of birth, age derived from it. It exists because clicking a person in search results
  did nothing; the tile had nowhere to point.
- `/mockups/ward-flow/patients/[patientId]` renders **WardPatientWorkspace — a MOVEMENT**, looked up
  by movement id. It is about REQUESTS, not people, despite its name.

The mistake came from reading the route table and the component names and inferring duplication,
without reading what each component does. **The real defect is a route that CLAIMS to be about
patients and is not**, with a parameter named `patientId` carrying a movement id — a label lying
about its contents, which is the fourth instance of that shape in one day and had already misled a
reader.

**"Patient screen polish" is struck from the plan** — removed rather than defined. Nothing in the
code suggests an unfinished patient screen: PersonScreen shows exactly what `PD-1` permits and
states on itself that address and narrative history stay denied, because silence is not permission.
If something specific is missing later it returns as its own named item.

**What replaced it is the rename**, now item 3 above. All seven inbound links already pass a movement
id, so it is a rename plus link updates rather than a behaviour change.

---

## Measured 2026-09-01 — the transport ruling is NOT BUILT, and the reason is deeper than a role list

The owner overruled a recommendation of mine on 2026-08-31: I had said a community team may SEE
transport but not ARRANGE it. He answered _"Yes community can as they will sometimes send patients to
ED via WAPOL or St John's etc."_ — and the ruling document records that my recommendation **rested on
a factual error, not a judgement difference**: I had treated a community team as neither the sending
ward nor the ED and therefore not a sending location. It is one.

**Verified today at `4e3d038f7` by an independent read. Nothing of it was built. Three separate
blockers, and only the first was the one I expected.**

1. **The role table excludes it.** `ward-flow-events.ts:637` — `BOOK_TRANSPORT: ["ed", "ward"]`. The
   reducer enforces this, so a community booking is refused. **And it is pinned:**
   `tests/ward-event-permissions.test.ts:66` asserts that table equals those lists exactly, so adding
   `community` turns a test red. This is not an oversight nobody noticed; it is held in place.
2. **The community hub has no control and could not have one.** Zero `dispatch` calls, zero buttons,
   zero occurrences of the word "transport" anywhere under `community/`. It does not even take
   `dispatch` from the provider. It is a pure read surface.
3. ⚠️ **THE MODEL CANNOT REPRESENT A COMMUNITY-ORIGIN MOVE AT ALL.** `ward-flow-reducer.ts:441-444`
   refuses any origin id that is not a hospital emergency department, `Movement.originEdId` is
   required, and there is no community-service registry in the model. **This is the real cost. The
   first two are edits; this is a change to what a movement is.**

`TR-D5` — the sending location always organises transport, never the receiving one — is recorded as
DECIDED, NOT BUILT and its own text anticipated exactly this case. **The code does not express
`TR-D5` as a general rule anywhere; it assumes the sender is a ward or an ED.**

**Adjacent, same shape, found in passing:** `BOOK_TRANSPORT` permits `ward`, and the only booking
control in the whole app is on the ED screen. **A ward is a permitted role with no control today** —
so this is two half-builds, not one.

**What this does to the estimate.** The queued transport screen was 4–6h on the assumption that
booking already worked and needed a surface. It does not. Community-origin movement is a model
change with a clinical shape, and it belongs to the owner to confirm before anybody builds it — he
described the real-world case, but not what a community-origin movement record should contain in
place of an emergency department.

---

## The "24 audit findings" — triaged 2026-09-01, and the list does not exist

**There is no document in this repository that enumerates 24 audit findings.** Searched the whole
checkout, the control plane and its evidence tree, every ward branch, and a pickaxe sweep of all refs.
The phrase appears three times and always as a one-line task row citing no report — including in this
plan, where its own author already flagged it as _"softest number here"_.

Triaged the nearest equivalents instead: a 17-row truthfulness table, a 6-row defect table, and one
governance item. **That those total 24 is a coincidence I cannot rule in or out, and the ledger says
the six are explicitly not part of the 24 — so do not record this as the recovered list.**

| Verdict                   | Count                                        |
| ------------------------- | -------------------------------------------- |
| **STALE — already built** | **14**                                       |
| REAL, fast                | 4 (two of them found in passing, on no list) |
| REAL, slow                | 6                                            |
| Descoped by owner ruling  | 4                                            |
| Needs an owner ruling     | 1                                            |

**Fourteen of twenty-four were already built.** The clock, the ED panels, both frozen pages, the
override textarea, the false governance card, the empty ward link, the refusal register, the assembled
handover, role gating, the vanishing patient, the frozen board, the two named real organisations, the
inert search tiles, and the one-observation median. Added to the five found already-built this
morning, **that is nineteen items in one day that a plan called outstanding and the code had done.**

### ⚠️ The two that matter, because they are the kind the owner said he cares about

Both are controls that **say an action happened when nothing was recorded** — not cosmetic, not
naming, not a label. They tell a user something untrue about what the app just did.

1. **Two confirm buttons flip a local flag and relabel themselves.** `"Review & confirm"` becomes
   `"Destination confirmed"`, `roleTaskLabel[role]` becomes `"Match confirmed"`. Neither dispatches
   anything. Navigate away and the confirmation never existed.
   `ward-management-console.tsx:241-246`, `ward-management-modes.tsx:296-299`.
2. **The priority-queue shortlist rows are inert.** Each is a `<button>` with `aria-pressed`, and the
   parent passes `onSelectId={() => undefined}` — so the highlight never moves and the confirm button
   underneath always names the pre-computed destination whatever you pressed.
   `ward-management-modes.tsx:376` and `:243-252`.

The fast, honest fix for (1) is the repository's own placeholder pattern — `aria-disabled`, an inert
handler, and a "coming soon" title — so the button stops claiming a result. **What those buttons
should actually dispatch is a design decision the code cannot settle, and it is the owner's.**

---

## Correction — `fa616d1c9` contains work its message does not describe

That commit's message describes the community-referral removal and the event-permissions pin. **It
also contains the fix to the two buttons that claimed an action had happened when nothing had been
recorded**, in `ward-management-console.tsx` and `ward-management-modes.tsx`.

**What happened, because the mechanism will catch the next person too.** The button fix was staged and
committed first, on its own message. The pre-commit hook refused it — _"Documentation inputs have
unstaged or untracked changes"_ — because two other files of mine were still unstaged under the same
directories. **The refusal left those two files STAGED.** The next commit then swept them up under the
second message, and the shell's own `echo "--- commit A ok ---"` printed regardless, because it was
sequenced with `&&` after a command the hook had already allowed to fail quietly.

⚠️ **So a blocked commit does not leave the tree as it was — it leaves your work staged and waiting to
be absorbed by whatever commits next.** That is the trap, and it is invisible unless you re-read the
log rather than the echoes.

Not rewritten with `--amend`: a commit that exists is a commit other chats may already have read, and
the correction is cheaper than the risk. The reasoning for the button change is in full in the source
comments beside both controls, so nothing is lost but the message.
