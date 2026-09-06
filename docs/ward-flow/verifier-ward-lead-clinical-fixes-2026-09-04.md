# Ward Verifier — adversarial review of the six clinical wording fixes + the new guard

Reviewed: `ward-lead-uncommitted-for-review.txt` (876 lines, base `e56378e4f`, uncommitted).
All measurements below were taken at `e56378e4f` by evaluating the real fixture and reducer, not by
reading prose. `ward-management-console.tsx` and `ward-management.module.css` were NOT opened (hard
lock); every question that needed them is named as such and left to you.

**Your six defect reports all check out.** I re-derived each named case rather than taking it:
WF-009 `openedAt=222`, `examination.at=542`, difference **320** — your figure exactly. WF-300
`stage=arrived`, closure `outcome:"arrived"`. WF-007 `stage=arrived`, `blocker="None — handover
complete"`. WF-013 two open referrals, no acceptance. WF-002 one open referral, no acceptance.
WF-008 closed, `did_not_proceed`. Nothing to withdraw.

---

## 1. 🔴 YES — FIX 1 INTRODUCED A NEW FALSE STATEMENT, AND IT IS THE WORST KIND

The new not-found sentence for a wrong-shaped id reads (MEASURED, your diff line 184):

> "{requestedId}" is not a movement id. Movement ids begin with WF-. This screen shows one movement
> at a time; a person is not a movement, **and their record is not reachable from here.**

The last clause is false. MEASURED at `e56378e4f`:

- `src/app/mockups/ward-flow/people/[patientId]/page.tsx` exists and guards `id.startsWith("PT-")`.
- `src/components/ward-management/patients/person-screen.tsx:173` renders
  `<h1>{patientDisplayName(person)}</h1>` — a named individual.
- `src/components/ward-management/search/patient-search.tsx:220` links straight to it:
  `href={"/mockups/ward-flow/people/" + patient.id}`.
- `ward-patients.ts:59` — `export type PatientId = "PT-${string}"` (template literal type).

So the worked example in your own doc comment — `/movements/PT-004` — is a person id whose record
lives at `/mockups/ward-flow/people/PT-004`, one route away, reachable from the search screen the
reader probably arrived from. The page tells them it is not reachable.

This is worse than the defect it replaced. The old bug quoted an id the user never typed; a reader
sees nonsense and looks elsewhere. The new sentence is fluent, specific, authoritative and wrong,
and it **sends a coordinator away from the screen that has what they wanted.** The two routes are
mirror images — one guards `WF-`, the other guards `PT-` — and neither knows the other exists.

**Recommended:** when `requestedId.startsWith("PT-")`, say so and link:
"…that is a person id. Their record is at /mockups/ward-flow/people/PT-004." Keep the flat sentence
only for ids matching neither shape.

**INFERRED, needs your eye:** the same clause also asserts "a person is not a movement", which is
true of the model (`Movement` holds no `PatientId`) — that half stands. It is only the reachability
claim that is false.

---

## 2. 🔴 THE MASTHEAD STILL CARRIES THE EXACT DEFECT D1 FIXED ELEVEN LINES ABOVE IT

Not introduced by these fixes — but on the same page, in the same class, and now more prominent.

The no-destination fallback ends (MEASURED, your diff line ~290):

> "No destination yet, and no ward has been asked."

That is the D1 inference — absence of an entry in `referredUnitIds` read as absence of asking —
which your own new comment eleven lines earlier says you cannot make. MEASURED:

- **18 of 50** movements render that exact sentence today.
- **2 of those 18** (WF-001, WF-019) carry `referralAbsence: {reason:"none_raised"}` — a positive
  record that nobody was asked.
- **16 of 18** carry no such record. The page infers the absence from an empty array.

And it is falsifiable through the live reducer, not just in theory. MEASURED at
`ward-flow-reducer.ts:1233-1250`, `WITHDRAW_REFERRAL` produces exactly: `referredUnitIds: []`,
`withdrawnReferrals: [...withdrawn]`, `closure: {outcome:"did_not_proceed"}`, `declines` untouched,
`acceptedUnitId` untouched. A movement that was referred and then withdrawn lands in precisely the
state the masthead describes as "no ward has been asked" — while `withdrawnReferrals` on the same
record says a ward was asked and the referrer pulled it.

**The model already has the three states you need**: `referralAbsence` is the positive record. The
sentence should distinguish "nobody was asked, and somebody recorded that" from "no referral is
recorded" — the same discipline fix 4 just applied to legal status.

**One correction to your comment while I am here.** It says _"Every no-destination branch the
masthead needs was already written below and simply unreachable."_ MEASURED: of 23 unaccepted
movements, **19 already rendered a no-destination branch before fix 2** (`acceptedUnitId ??
referredUnitIds[0]` was undefined for both). Only **4** were newly routed — WF-002, WF-010, WF-013,
WF-017. That matters because "unreachable until now" reads as "new, therefore reviewed"; in fact 16
pages have been printing an unsupported sentence all along.

**One cheap mutation settles it if you want it settled:** seed a movement with non-empty
`withdrawnReferrals`, empty `referredUnitIds` and `declines`, no `acceptedUnitId`; render its page;
read the masthead.

---

## 3. PRIORITY 2 — I LOOKED FOR THE SURFACE WHERE `undefined` IS WORSE AND DID NOT FIND ONE

Three hypotheses, all killed by measurement. Reporting the negative because a clean sweep here is
itself a coverage claim.

For the four movements fix 2 newly routes to "no destination" (WF-002, WF-010, WF-013, WF-017),
measured against the destination the old fallback would have produced:

1. **`restrictionNotice(patient, destination)` → `none` for all four.** No restriction warning is
   lost. (I expected this to be the finding; it is not.)
2. **`eligibility(patient, destination, now)`** — what disappears was misleading anyway: WF-010,
   WF-013 and WF-017 rendered `eligible=true` about a ward that had **not accepted**; WF-002
   rendered `eligible=false`, i.e. the self-contradiction you already cite. Losing all four is an
   improvement, not a regression.
3. **`candidates = eligibleCandidatesAmong(...).filter(c => c.unit.id !== destination?.id)`** — I
   expected the alternatives panel to start offering a ward already referred to, since the filter
   now excludes nothing. MEASURED: identical lists before and after for all four (3, 3, 3, 3), and
   **0** already-referred wards in either. `eligibleCandidatesAmong` already excludes them.

**The one surface I could not check is `attentionItems({ ..., destination, ... })`** — it is in the
locked file. That is where the residual risk sits, and the exact question is: _does any attention
item exist only when `destination` is truthy, such that the four newly-undefined movements now raise
nothing where they used to raise something?_ Please run that one; I cannot.

---

## 4. 🔴 PRIORITY 3 — THE SEVENTH MUTATION IS A CLASS, NOT A CASE. THREE OF THEM.

**Four of your seven assertions pin the wording of the OLD defect rather than asserting the
property.** Any reword of the false sentence restores the defect and leaves the guard green.

| #   | Mutation                                                                                          | Guard result                                                                            | Population affected       |
| --- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------- |
| M-A | Fix 4 readiness line becomes `"Recorded, and it has stayed the same since this movement opened."` | **GREEN** — the grep is `/has not changed\|and unchanged since/`; neither token appears | **49 of 50** pages        |
| M-B | Fix 5 label becomes `"Patient location"`, still rendering `originEd` unconditionally              | **GREEN** — the grep is the literal `"Where the patient is"`                            | all **7** closed pages    |
| M-C | Fix 6 fallthrough becomes `"No blocker was recorded before this movement closed."`                | **GREEN** — the grep is the literal `"Nothing was recorded as holding this up"`         | the closed sentinel cases |

M-A is the one I would actually bet on happening: it is the most natural rephrasing a future editor
reaches for, it restores a claim about the world on 49 of 50 pages, and nothing goes red.

**The tell is that assertion 3 is different from the other four, and it is the one that would
survive all of this.** It computes `serviceOfUnit` and `serviceOfOrigin` from the sites data and
compares them to what rendered — a property. Assertions 2, 4, 5 and 6 grep for the string the defect
used to print. That is the template: assert the property for each of the other four, not the
sentence.

For fix 4 specifically the property is available and cheap: for every movement with
`statusChanges.length === 0`, the page must not contain any sentence asserting the status _did not
change_ — widen to `/has not changed|unchanged|stayed the same|no change has occurred/` and put
"unrecorded, never unchanged" in the assertion message, so the next editor knows what is being
defended. Still a blocklist, but a much wider one.

---

## 5. ⚠️ ASSERTION 5's FLOOR IS SATISFIED BY MOVEMENTS THAT DO NOT EXERCISE THE BRANCH

This is the shape you asked me to look for, and it is present. MEASURED:

`closedWithARecordedBlocker` (closed, blocker not `""` and not `"No blocker"`) = **3**. The floor
asserts `> 0` and passes. Of those three, walking `blockerReadinessState`:

| Movement | blocker                         | `blockerIsActive` | reaches the guarded fallthrough? |
| -------- | ------------------------------- | ----------------- | -------------------------------- |
| WF-007   | `None — handover complete`      | false             | **YES — the only one**           |
| WF-008   | `Patient declined transfer`     | true              | no — early return                |
| WF-300   | `Awaiting destination response` | true              | no — early return                |

So the floor counts 3 and **exactly 1 discriminates.** `BLOCKERS_MEANING_NOTHING_IS_BLOCKING` is
`["No blocker","None — in transit","None — handover complete","None — the movement did not
proceed","None — cleared"]`; an active blocker returns at the first branch and can never reach the
sentence under test. If WF-007 is ever edited — reopened, or its blocker changed — the floor still
reads 3 and the property becomes untestable **silently**.

**Fix:** floor on the discriminating set — closed movements whose blocker is one of the four
non-`"No blocker"` sentinels — and say in the message that it is currently 1, so a drop to 0 says so
out loud.

**Same weakness, milder, in assertion 3.** Its floor is `crossService.length > 0`. MEASURED: 16
cross-service accepted movements, **13 open and 3 closed** (WF-008, WF-314, WF-321) — so the closed
arm of the masthead ternary _is_ currently covered, and a mutation printing the origin service only
on the `"Was bound for"` path would go red. But that is true by accident of the fixture, not by
construction: the floor would pass just as happily with 16 open and 0 closed, and the closed-arm
coverage would vanish without a word. Floor both halves.

---

## 6. PRIORITY 4 — THE OTHER SIDE OF FIX 5, AND I THINK IT IS THE STRONGER SIDE

You are right that "Where the patient is" was a derivation in a panel promising none. But the
replacement inverts _which_ population gets the wrong sentence, and the new population is larger.

MEASURED, by stage: **38 of 50** movements are at a stage before `moving` — still in the origin ED.
6 are `moving`, 6 are `arrived`.

- **"Where the patient is" → origin ED** was **true on 38** pages, **false on 12** (6 moving, 6 arrived).
- **"Came from" → origin ED** is natural on the 12, and on the **38** it now says a patient departed
  a department she is still sitting in — one line under a masthead that reads _"WF-013 — **in** RPH
  ED"_. The page contradicts its own tense, and the facts panel is the half that is wrong.

So the fix took a false statement off 12 pages and put an odd one on 38. It is still a net
improvement — a tense oddity is not "this patient is somewhere she is not" — but calling it a repair
overstates it, and the scope-cut reading you invited is fair: the derivation was removed, not
repaired, and no row now answers the question a coordinator actually opened the page with.

**Recommended, and it costs one word:** label the row **"Origin department"** (or "Referred from").
That is exactly what `originEdId` is, it claims no tense at all, so it is true on all 50, and it
honours the panel's "nothing here is derived" promise more cleanly than "Came from" does. Then, if
you want the real question answered, it belongs in the narrative above — which, as you say, already
has a tense.

**Note the guard does not defend any of this.** Assertion 6 checks only for the _absence_ of the old
label on closed movements. It never asserts "Came from" is present, never checks the row renders at
all, and never checks it against the record. Deleting the row outright leaves it green.

---

## 7. ⚠️ TWO OF THE FOUR NEW CLOSED BLOCKER ARMS ARE UNREACHABLE BY CONSTRUCTION

MEASURED in `ward-flow-reducer.ts`: exactly three sites set `closure`, and **every one of them
stamps `blocker` in the same object**:

| line        | case                 | blocker written                         |
| ----------- | -------------------- | --------------------------------------- |
| 1014 / 1017 | `RECORD_EXAMINATION` | `"None — the movement did not proceed"` |
| 1242 / 1249 | `WITHDRAW_REFERRAL`  | `"None — the movement did not proceed"` |
| 1627 / 1631 | `PATIENT_ARRIVED`    | `"None — handover complete"`            |

`"None — in transit"` is `STAGE_TRANSITION_BLOCKERS.collected` (`PATIENT_COLLECTED`, not a closure)
and `"None — cleared"` is written only by `CLEAR_MOVEMENT_BLOCKER` (not a closure; corrected
from `CLEAR_BLOCKER`, a case name that does not exist — I took it from an extraction agent without
opening the case label myself). Both are overwritten by
whichever closure follows. **So no closed movement can carry either string**, and the two arms you
added for them are dead. The fixture agrees: `"None — in transit"` appears on 2 OPEN movements and 0
closed; `"None — cleared"` appears nowhere at all.

Not a false statement — but you added them under the reasoning that they "belong in the closed
branch", and for these two the reducer says the opposite. Keeping them is defensible (cheap, and the
seed could author one directly); what is not defensible is leaving them undocumented, because four
arms look like coverage of five states when two of them cannot fire.

---

## 8. THINGS I CHECKED THAT ARE CLEAN

- **"Movement ids begin with WF-"** — MEASURED: 50 movement ids, **0** not beginning `WF-`, **0**
  equal to bare `WF-`. True as written. (The `TR-`/`WR-`/`RF-` ids in the same file are transport,
  bed-release and referral records, not `Movement.id`.)
- **"Recorded."** opening the new legal-status line — MEASURED: `legalStatus` is required on
  `Movement` (`ward-model.ts:686`) and falsy on **0** of 50. True.
- **Fix 3's `destinationService`** — correct, and assertion 3 is the one genuinely property-based
  test in the file.
- **`REFER_TO_UNITS`** — I suspected it could silently empty `referredUnitIds` and had to withdraw
  that: line 1080 is guarded by `if (permitted.length === 0) return withHeldBack;`, and held-back
  wards are recorded as rejections. It cannot produce the empty-but-asked state. Only
  `WITHDRAW_REFERRAL` can.

---

## 9. THE ONE QUESTION I AM LOCKED OUT OF

Fix 3 makes the masthead print the **destination's** service. The "Health service" fact row still
prints `movementHealthService(patient)` — the **origin's**. On the 16 cross-service movements those
two now differ, visibly, on one page. Before fix 3 they agreed and were both wrong; after it they
disagree and one is right. **Unless that row's label says "origin", the page now shows two different
health services with no way to tell which is which** — a new ambiguity created by a correct fix.
Your comment says the row "names the origin department" in its fallback sentence; a fallback only
renders when the value is missing, so it cannot label the value when it is present. Please read that
row's `<dt>` and tell me what it says; I cannot open the file.

---

# CORRECTIONS AND STATUS — appended 2026-09-04, after peer verification

**Read this before acting on anything above.** The review above was made against an uncommitted
working copy that Ward Lead pasted into a text file. The base it diffs against, `e56378e4f`, never
held the new guard at all. Naming a base SHA is not the same as naming the artefact read, and a
reader cannot tell the difference from the report — the point is Ward Builder Three's and it is a
real gap in how I record findings.

## What has since landed (VERIFIED by me at `022d88aff`, committed 08:45:34, 16 min after this report)

- **Finding 1** (the false "not reachable" sentence) — fixed; the screen now detects a `PT-` id and
  links to the person record.
- **Finding 2** (masthead "no ward has been asked") — fixed; now reads `referralAbsence`.
- **Finding 4** — the four wording-pinned assertions rebuilt. M-A and M-B now go red by name.
- **Finding 5** — floor corrected to `reachesTheFallthrough`, currently 1, with the count in the message.
- **Finding 6** — accepted; the row is now labelled "Origin department".
- **Finding 9** (which I was locked out of) — the `<dt>` did read bare "Health service"; now
  "Health service of the origin department".
- **Finding 3** — answered by Ward Lead: in `attentionItems`, `destination` gates no item's
  existence, so nothing is lost on the four newly-undefined movements.

## 🔴 A CORRECTION TO MY OWN FINDING 4 — M-C WAS A BAD MUTATION

MEASURED: four closed movements DO reach that fallthrough — WF-307, WF-314, WF-321, WF-328 — all
carrying blocker `"No blocker"`. So the mutant ran. But for all four the mutated sentence _"No
blocker was recorded before this movement closed."_ is **true**, so it reintroduces no false
statement anywhere, and assertion 5's own filter (`blocker !== "No blocker"`) correctly excludes
them. **The mutation landed on a population disjoint from the defect's population** — which is the
mirror image of the floor error I was reporting in the same document, and I did not apply the rule
to my own mutation before sending it. M-A and M-B were sound.

Note this is a THIRD failure mode, distinct from the two already known: the mutant ran (so it is not
"a green mutation that never executed") and the assertion was right to stay green (so it is not a
hole). Ward Lead's substitute — mutating the arm the fixture actually reaches — is the correct one.

## FINDING 7 RE-PROVEN BY REACHABILITY, NOT BY READING

My original argument read the three closure sites and stopped, which is the same move that produced
a retracted finding elsewhere tonight (a rejection guard read as a postcondition). The question I
had not asked was whether a movement can acquire those sentinels AFTER closing. It cannot:

- `PATIENT_COLLECTED` (the only writer of `"None — in transit"`) — reducer line 1576:
  `if (movement.closure) return reject(..., "cannot collect a patient for a closed movement")`.
- `CLEAR_MOVEMENT_BLOCKER` (the only writer of `"None — cleared"`) — line 1902:
  `if (movement.closure) return reject(..., "cannot clear the blocker on a closed movement")`.

Both orders are closed off. The claim holds — but it was not proven when I made it.
**The event is `CLEAR_MOVEMENT_BLOCKER`; there is no `CLEAR_BLOCKER` case, and several of us wrote
the short name.**

## RESIDUAL: THE REBUILT ASSERTIONS ARE WIDER BLOCKLISTS, NOT PROPERTIES

MEASURED against the patterns as committed at `022d88aff`. `claimsStability` still passes "it is the
same as when this movement opened", "not revised since", "with no alteration since", "recorded once,
at the start, and never since". `claimsPresence` still passes "Where they are", "Present location",
"Currently in", "Ward location", "Patient is in", "Now at". Strictly better than before; same class.
Widening again is not the answer (Ward Lead's own argument at reducer line 1889 applies) — the
assertion messages should say which are properties and which are lists, so a list is not read as a
proof.

## RELAYED, WITH A COUNT THAT DISAGREES

Ward Builder Two found that `declinedByAll` (`ward-derivations.ts`) does not exclude
`acceptedUnitId`, and `ACCEPT_IN_PRINCIPLE` does not close a movement — so a movement declined by
one ward and accepted in principle by another is counted as placement gone wrong. Reachable; not in
the fixture. They measure the shape at 1 on their branch; **I measure 0 at `e56378e4f`**, because
the only movement with the shape (WF-009) is escalated and so is counted in the other bucket. Both
buckets feed `placementGoneWrong`, so the rendered figure is right either way.

---

# NEW FINDING, appended 2026-09-04 — THE MIRROR ROUTE STILL HAS THE SENTINEL

Found by following Ward Builder One's framing (_a component cannot truthfully deny the existence of
a page it has no way to ask about_) back to the sibling route. MEASURED at `e56378e4f`:

`src/app/mockups/ward-flow/people/[patientId]/page.tsx`:

```
return <PersonScreen patientId={id.startsWith("PT-") ? (id as PatientId) : ("PT-" as PatientId)} />;
```

**That is the identical defect Ward Lead just repaired on the movements route, still live on the
people route.** `PatientId` is `` `PT-${string}` `` (`ward-patients.ts:59`), so the bare `"PT-"`
satisfies it and a wrong-shaped id is cast to a sentinel and handed on — the same well-typed lie
that `tsc` cannot see.

**Two differences from the original, one mitigating and one not.**

- Mitigating: `PersonScreen`'s not-found sentence does NOT quote the id
  (`person-screen.tsx:163` — _"No person in this prototype has that record. Nobody has been
  substituted for them"_), so the visible symptom of an id the user never typed does not occur here.
- **Not mitigating:** the two cases are still collapsed into one screen, which is precisely the
  distinction the movements fix was made to draw. `/people/WF-013` — the mirror mistake, and a
  likely one between sibling routes — renders _"No person in this prototype has that record"_ when
  WF-013 is not a person record at all, it is a movement, **and its page exists**. Symmetrically to
  finding 1, nothing tells the reader that.

⚠️ **AND THE COMMENT ABOVE IT NOW ASSERTS A PARITY THAT NO LONGER HOLDS:** _"the shape is CHECKED
before it is asserted — the same guard the movement route carries."_ The movement route does not
carry that guard any more; Ward Lead replaced it. A comment citing a sibling file as its
justification decays silently when that sibling changes, and nothing local ever fails.

This is the case for fixing the id-ownership question once, in a shared resolver both routes call,
rather than twice in two places that each describe the other.

---

# SEPARATE FINDING — THE STATISTICS CLAIMS REGISTER IS COMMENT-SATISFIABLE

Raised as a candidate by Ward Builder Two, who declined to mutate `ward-derivations.ts` while other
sessions were reading it. That was the right call and it was also unnecessary:
`falsifiabilityProblem` in `tests/ward-statistics-claims.test.ts` is a **pure function of a source
string and a claim**, so it can be exercised on synthetic input with no file touched.

Method: `falsifiabilityProblem`, `collapseWhitespace`, `countOccurrences` and `isEntirelyComment`
copied verbatim from `e56378e4f` and run over constructed sources. Control (healthy source) GREEN;
known-bad (comment copy carrying the anchor) RED — so the probe discriminates.

| scenario                                            | result                      |
| --------------------------------------------------- | --------------------------- |
| healthy source, code present — CONTROL              | GREEN                       |
| comment COPY of the evidence beside live code       | **RED** `anchor-ambiguous`  |
| anchor placed outside the evidence                  | **RED** `evidence-survives` |
| **watched code commented out in place, note added** | **GREEN**                   |
| **watched code deleted, doc comment describes it**  | **GREEN**                   |

**Ward Builder Two was right about copies, and structurally so.** A claim can only pass at all when
its anchor lies INSIDE its own evidence — an anchor elsewhere always returns `evidence-survives` —
so a faithful comment copy necessarily duplicates the anchor and trips the count. That is a stronger
result than "it happens to be caught".

🔴 **The hole is the other direction, and it is the realistic trigger.** Comment the line out, or
delete it and leave a comment saying what used to be there, and the guard is GREEN: anchors stays 1
because the only occurrence is now inside the comment, the falsifying edit rewrites the comment, and
the evidence is gone. `isEntirelyComment` does not save it — it tests whether the claim's EVIDENCE
STRING opens as a comment, not whether the match site does, so code-shaped evidence passes it.

The register's own comment should say this, because "comments were considered and it holds" is true
of the copy case and false of the replacement case.

**Method note worth keeping:** before judging a mutation too expensive or too disruptive to run,
check whether the thing under test is a pure function. A surprising amount of guard machinery is,
and then the mutation needs no tree at all.
