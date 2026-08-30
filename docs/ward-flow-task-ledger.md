# Ward Flow — the task ledger

**Every outstanding Ward Flow task, in one place. Merged 2026-08-30 from four documents.**

## ⚠️ WHAT THIS IS NOT — read this before editing anything

**This file is ONLY for the Ward Flow prototype.**

| File                                            | What it is                                                                                    | Touch it here?                     |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------- |
| **`docs/ward-flow-task-ledger.md`** — this file | **Ward Flow tasks**                                                                           | **yes**                            |
| `docs/outstanding-issues.md`                    | **the REPOSITORY's ledger** — 529 rows, its own `/issues` system, its own reconcile interlock | **NEVER from Ward Flow work**      |
| `claude/Ward-design:docs/ward-flow-ledger.md`   | **the DECISIONS register** — what was decided and by whom                                     | **no** — cite it, never restate it |

> **The owner flagged this explicitly.** Confusing the Ward Flow task list with the repository's
> outstanding-issues ledger would put prototype tasks into a system that has 529 rows, a serialized
> reconcile branch, and nothing to do with this project.

**Merged from:** `ward-flow-remaining-work.md` (the running record and the reasoning — still the place
to read WHY), `ward-flow-hubs-and-patient-plan.md`, `ward-flow-roadmap.md`, the 17-task plan
(`docs/superpowers/plans/2026-08-29-ward-flow-truthfulness-and-demo-fixes.md`), and
`ward-flow-phase-9-decisions.md`. **Those keep their detail; this holds the list.**

---

## ⚠️ A DECISION RECORDED WITHOUT ITS EVIDENCE, AND THIS ONE IS MINE

**This ledger says, of the ward page becoming the ward hub:**

> **"The ward page already holds the sections. WHAT IT LACKS IS THAT THEY ARE CORRECT."**

⚠️ **IT NEVER SAYS WHICH SECTIONS, OR HOW THEY ARE WRONG.** **Ward Board looked: there is no written
hub spec, and every `hub` document under `docs/superpowers/specs` is the unrelated developer hub.**

> ⚠️ **So the single most load-bearing task in phase 1 — the one described here as the flow's last
> missing link and the only stopped item that is not polish — is DEFINED BY A CLAIM WITH NO LIST
> UNDER IT.**

**The DECISION is written up carefully, with its argument: upgrade the page rather than build a third
place showing referrals incoming to a ward.** ⚠️ **The FINDING that motivated it is not written up
at all.**

**Ward Board's verdict, and it is exact:**

> ⚠️ **"A decision recorded without its evidence is exactly the shape you have been cataloguing all
> night — and this one is yours."**

**THE RULE: when a decision rests on a finding, the finding goes in the record beside it.** **A
decision survives on its argument; the next person cannot ACT on it without the evidence, and cannot
tell a real finding from an impression.**

### ⚠️ WORSE THAN A MISSING LIST: THE LIST WAS NEVER MADE, AND I NAMED A SOURCE FOR IT

**Ward Board asked Ward Verifier for the list, on MY attribution that Verifier had assessed those
surfaces.** ⚠️ **VERIFIER NEVER ASSESSED THEM.** **Its answer, first-hand:**

> **"My record does not hold the list because the list was never made. This session walked three
> screens tonight — the coordinator hub, the ED screen, and governance — and none of them is the
> ward page."**

**So the record did not merely omit the evidence. IT NAMED A SOURCE WHO HAS NONE**, and sent another
session to collect from them.

> ⚠️ **AND VERIFIER NAMED THE REAL COST, WHICH IS NOT THE WASTED ERRAND:** *"If the ledger says I
> assessed those surfaces, then my FIRST look at them will be received as an independent SECOND
> look."* ✅ **A false attribution does not just fail to supply evidence — it manufactures
> corroboration that was never performed.**

✅ **Ward Board's condition on the request was right and stands for whoever does make the list: do
NOT derive it from the current file.** ⚠️ **A page reading correctly today is not evidence it read
correctly when it was assessed** — **though in this case there was no earlier reading to be
inconsistent with, which is the whole finding.**

**THE ATTRIBUTION IS RETRACTED. The claim that the ward page's sections "are not correct" now has NO
source at all, and is demoted from a finding to an impression until somebody looks.**

### ⚠️ AND A SECOND THING WARD BOARD IS RIGHT ABOUT: IT DID NOT RESTART ON MY RELAY

**I told it *"the owner has restarted you — his word, just now."* It did not act on it.** **He had five
ward chats open and *"restart ward chat"* names none of them** — **and, more to the point, he had
paused it DIRECTLY, so the release had to come directly too.** **It asked him; he said go.**

> ✅ **A peer cannot release a hold placed by the owner.** **One sentence, against the cost of five
> sessions each deciding a relayed instruction was meant for them.**

✅ **AND THE DISTINCTION IT DREW IS THE USEFUL PART: it DID act on my message for the MERGE.** **A pure
fast-forward, zero divergence, pre-announced — no resolution step, so nothing to get wrong.**

> **THE SAFE PREPARATION DID NOT NEED HIS WORD; THE BUILDING DID.** ⚠️ **Waiting on authority is not
> the same as doing nothing, and a session that stops entirely while blocked is over-applying the
> rule.**

### ⚠️ A GAP IN `FD-23` THAT THE CONSERVATIVE READING DOES NOT CLOSE FOR FREE

**`FD-23` forbids a ward-facing surface naming the OTHER WARDS a patient was referred to.** ⚠️ **It
does not say whether a ward may know that others EXIST.**

**Ward Board is building the strict version and flagged it rather than deciding it — and recorded the
cost, which is the part that matters:**

> ⚠️ **A ward that cannot tell a SOLE referral from a PARALLEL one may hold a bed somebody else is
> waiting for.**

**⚠️ *"When in doubt, hide it"* reads as safe, and on this page it has a CLINICAL COST.** **With Ward
Decisions to rule; recorded either way.**

## ✅ SYNC POINT — 2026-08-30, everything answered and everything measured

**Every session was sent the SAME facts at this point. If a later reader finds two sessions
disagreeing about any line below, this is the version they were all given.**

### ✅ ANSWERED BY THE OWNER, ALL FIRST-HAND

| Question | Answer | Where it landed |
| --- | --- | --- |
| **Build the community hub, or keep it parked?** | ✅ **BUILD** — said first-hand in BOTH the orchestrator's chat and Ward Referrals' own | Ward Referrals, building now |
| **Record the SUBURB, or the ARRIVAL TIME?** | ✅ **BOTH** — *"Yes to both"* | Ward Core, the model |
| **The governance median: suppress, or keep disclosing?** | ✅ **SUPPRESS below a stated minimum** — the floor is ADDED beneath the disclosure rule, which stands | Ward Core, `ward-derivations.ts` |
| **Which facts travel with a referral?** | ✅ **DISSOLVED** — the two patient-shaped urgent reasons became setting-shaped, so nothing sensitive travels at all | ✅ **LANDED `a195e6157`** |

⚠️ **THE AMBIGUITY THAT NEARLY COST THE KEYSTONE, AND HOW IT ENDED:** *"2. Yes record"* arrived
against a bare number while TWO numbered lists were live in his chat — it fitted Ward Core's SUBURB
item and the orchestrator's ARRIVAL item equally. **Nobody built on it. Ward Core asked him
directly.** ✅ **He answered BOTH, so it dissolved rather than resolving in somebody's favour** —
**and the two readings were ADDITIVE, which is the only reason the wrong guess would have been cheap.**

### ✅ WHO IS BUILDING WHAT — measured, branches named

```
Ward Core        claude/ward-flow-phases-6-7-design    the transport rename landed 179de5bdf
                                                        next: the referral arrival + suburb + movement link
                                                              the governance median floor
Ward Referrals   claude/ward-flow-wave1-referral-corrections   the COMMUNITY HUB, unblocked first-hand
Ward Board       claude/ward-flow-print-fixes           the WARD'S OWN VIEW of a referral
                                                        - the flow's last missing link
Ward Verifier    claude/ward-flow-setup-967aa0-wf       the reword LANDED; the audit rows
Ward Decisions   claude/Ward-design                     the transport spec landed 8b7e1b797
                                                        left: the ward forms, capacity
```

### ⚠️ STILL WITH THE OWNER — nothing blocking anybody

**The catchment suburb mapping and its eight disagreements · the real transport providers · the real
community teams · the ten urgent-mark reasons in HIS words (the SHAPE is settled, the wording is not)
· a page reload wipes a demonstration · three escalation questions from a cut phase.**

### ⚠️ THE FIVE STANDING TRAPS EVERY SESSION WAS GIVEN AT THIS POINT

1. **A numbered list is an ADDRESS. Whoever is SECOND into a chat names the SUBJECT, never the
   number.** *(Three sessions broke this inside one exchange, each having just stated it.)*
2. **Label every relayed instruction FIRST-HAND or RELAYED, in those words.** ⚠️ **A relay arrives
   carrying no position in the owner's sequence, so a stale permission and a current one are
   identical on arrival.**
3. **Verify the COMMITTED BLOB, never the working tree.** **A tree check passes in the worst case.**
4. **Whatever renders a duration must read the SAME CLOCK as the data it compares against.**
   ⚠️ **Three screens got that wrong in one evening and every one showed a believable number in a
   believable order.**
5. **A suburb is NOT an address (`PD-3`), and `FD-13` permits exactly ONE story field, on a
   referral.** ⚠️ **The second matters most where a handover note will feel obviously necessary.**

---

## ✅ WHERE EVERYTHING ACTUALLY STANDS — measured 2026-08-30, branches named

**Measured, not recalled. Every tip below was read with `git rev-parse`, and the branch is named
because an observation without its branch has now misled this project twice in one night.**

⚠️ **THE SHAS BELOW GO STALE WITHIN MINUTES AND THAT IS FINE — THEY ARE AN OBSERVATION, NOT A
POINTER.** **Do not trust them; re-measure.** The whole table regenerates in one command:

```bash
for b in claude/ward-flow-phases-6-7-design claude/ward-flow-wave1-referral-corrections \
         claude/Ward-design claude/ward-flow-setup-967aa0-wf claude/ward-flow-print-fixes \
         claude/Wardquestions ; do
  printf '%-46s %s  behind %s / ahead %s\n' "$b" "$(git rev-parse --short $b)" \
    "$(git rev-list --count $b..claude/ward-flow-phases-6-7-design)" \
    "$(git rev-list --count claude/ward-flow-phases-6-7-design..$b)"
done
```

**The ROLES and the OWNERSHIP in the table are the durable part. The SHAs are a timestamp.**

| Branch | Tip | Session | State |
| --- | --- | --- | --- |
| `claude/ward-flow-phases-6-7-design` | `74253c367` | **Ward Core** | **the working line.** Building the patient screen |
| `claude/ward-flow-wave1-referral-corrections` | `521888a23` | **Ward Referrals** | ⚠️ **THE CRITICAL PATH.** The referral screen |
| `claude/Ward-design` | `adee2f494` | **Ward Decisions** | designs. Network diagram + header done |
| `claude/ward-flow-setup-967aa0-wf` | `6065987b2` | **Ward Verifier** | audit + the test wrapper |
| `claude/ward-flow-print-fixes` | `09b4a9e87` | **Ward Board** | ⚠️ **PAUSED BY THE OWNER.** Clean, nothing in progress |
| `claude/Wardquestions` | `d74a38700` | **Ward Orchestrator** | plan, rules, safety, custody |

### ⚠️ A MEDIAN COMPUTED FROM ONE OBSERVATION, ON THE GOVERNANCE SCREEN

**Found by walking the running app. Verified in code, not inferred from the screen.**

```
/mockups/ward-flow/governance

  Median time, referral to a ward accepting
  30 min          from 1 of 27 recorded acceptances

ward-derivations.ts:1072   value: median(acceptanceDurations)   <- no minimum-sample threshold
```

⚠️ **THE COMPONENT'S OWN DOC COMMENT NAMES THIS EXACT CASE:** *"a median of one, rendered bare, is a
guess wearing the clothes of a measurement, and this board's rule is to say nothing rather than
guess."*

**So it is NOT an oversight. Somebody saw it and chose disclosure — printing the basis in the same
breath — and the disclosure is genuinely there and honest.**

> ⚠️ **CORRECTED: THE RULE DOES NOT SAY SUPPRESS. I RELAYED A MISREADING AND THE OWNER NEARLY RULED
> ON IT.**

**The comment quoted above is a FRAGMENT. The whole sentence:**

> *"a measure computed from a thin sample **must say so in the same breath as the figure**, not in a
> tooltip or a footnote — a median of one, **rendered bare**, is a guess wearing the clothes of a
> measurement, and this board's rule is to say nothing rather than guess."*

⚠️ ***"Say nothing rather than guess" attaches to "rendered BARE".*** **The clause before it is the
actual instruction — disclose in the same breath, not in a tooltip — and it names itself a repair
somebody already made.** ✅ **The code does exactly what the sentence tells it to:
`EffectivenessValue` renders `from {sampleSize} of {population}` beside every figure, and renders
*"Not enough data to compute"* only when the value is genuinely `undefined`.**

> ✅ **THERE IS ONE RULE, IT SAYS DISCLOSE, AND THE CODE IMPLEMENTS IT.**

⚠️ **AND THE FRAMING CHANGES THE ANSWER, WHICH IS WHY IT HAD TO BE CORRECTED BEFORE HE RULED:**

```
what I asked   "your code disagrees with its own rule, shall I fix it?"   -> anybody says yes
the real one   "somebody chose disclosure over suppression, do you agree?" -> a real question
```

**Same shape as the `/patients` and `/people` near-miss: a deliberate decision with its reasoning
attached is indistinguishable from drift until you READ THE FILE.** ⚠️ **There the comment stopped a
false finding. Here the comment was read as the OPPOSITE of what it says — and a session acting on it
would have "fixed" a repair somebody deliberately made, replacing an honest disclosure with a
suppression its author had already considered and rejected.**

**✅ What survives unchanged: the figures are exact.** Verified: `value: 30, sampleSize: 1,
population: 27`.

**AND THE SUBSTANTIVE QUESTION IS STILL REAL AND STILL HIS:** *should a figure labelled **Median** be
printed at all from one observation, even with its basis beside it?* ⚠️ **A fresh product judgement
on a governance surface, NOT the correction of a contradiction.**

**Both views on the record, because he should hear the counter-argument and not only the lean:**
**disclosure beside the figure is defensible; suppression is safer; and the deciding fact is that the
label says *Median*, which a clinician reads as a typical case regardless of what sits next to it.**
**Two sessions lean to suppression.**

**Why it is not a style question: this is the GOVERNANCE screen — the one surface whose whole purpose
is to be trusted about its own limits — and the number is labelled *Median*.** ⚠️ **A psychiatrist
reading *"30 min"* reads a typical case.**

**RECOMMENDED, NOT DONE:** suppress below a stated minimum (`n < 5` → *"Not enough data to compute"*,
**which the component already renders**) rather than publish a median of one with a caveat.
✅ **Deliberately not changed — it is a product decision on a governance surface, and the session that
found it did not write the rule the change would overturn.**

### ⚠️ AND ONE MISSING TIMESTAMP IS PRODUCING BOTH VISIBLE PROBLEMS

**26 of 27 acceptances have NO COMPUTABLE DURATION AT ALL.** **That is the same root as the ED hub's
`Not recorded` on every row: `Referral` has no arrival instant and nothing links it to a `Movement`.**

> ✅ **So the owner's timestamp question is worth more than it looked. It is not a nicety on one
> screen — it is the single missing fact behind a governance median built on n=1 AND a hub that
> cannot show a waiting time at all.**

**Both surfaces are currently HONEST about it, which is why neither is urgent. Neither is fixable
without him.**

### ⚠️ THE COMMUNITY HUB IS PARKED — and the reason is PEER INSTRUCTIONS, NOT A RELAY

**Corrected 2026-08-30 after Ward Referrals ruled it out on the grounds that the build permission was
a relay. It was not — it was typed by the owner into the orchestrator session:**

```
to Ward Referrals, first-hand:  "I park community hub"
                                "leave the community team part now as future work"
to the orchestrator, first-hand: "Build community hub. I give permission."
```

⚠️ **TWO FIRST-HAND INSTRUCTIONS, TO TWO SESSIONS, THAT NOBODY CAN ORDER.** **First-hand-to-me does
not beat first-hand-to-you; it only makes them PEERS.**

> ✅ **AND THE OUTCOME IS UNCHANGED: PARKED.** **A peer instruction you cannot date against is no
> more actionable than a relay.** **The correction is to the REASON, not to the ruling** — which
> matters, because a later reader who discovers the permission was first-hand would otherwise treat
> the park as somebody having been misinformed.

**⚠️ AND THE CONVENTION THAT CAME OUT OF IT IS NOW STANDING: every instruction relayed between
sessions is labelled FIRST-HAND or RELAYED, in those words.** **Ward Referrals asked it of me and was
right to — a relay arrives carrying no position in the owner's sequence, so a stale permission and a
current one are IDENTICAL ON ARRIVAL.** **It costs three words and it is the difference between a
fact and a proposal.**

### ✅ THE ED PSYCHIATRY HUB IS BUILT — phase 1 item 4

**`26c14daae`, `d7b248226`, `6a677e86f` on `claude/ward-flow-wave1-referral-corrections`.** Typecheck
0 over 5733 files; 23 handed in / 23 ran / 522 passed; both ward-referral journeys green.

⚠️ **AND IT DELIBERATELY SHOWS NO WAITING TIME, WHICH IS THE FINDING:** **`Referral` has no arrival
instant and nothing links it to a `Movement`, so the referral clock the spec says must STOP ON
ARRIVAL cannot be stopped.**

> ⚠️ **A clock that should stop and cannot RUNS FOREVER AND STILL LOOKS PLAUSIBLE.**

**Every row says the time is NOT RECORDED, with the reason in prose** — **rather than shipping a
figure that was roughly right.** **The ruling reverses the moment the owner answers, and it is on his
list.**

⚠️ **THE SPEC POINTER WAS ALSO WRONG AND IT WOULD HAVE CAUSED REAL DAMAGE.** I pointed four sessions
at `0f8964c39`, **which is superseded.** **The current spec is `daa75ad26`.** **The old one requires a
guard asserting no action is ever rendered on a medical notification — resting on `FD-3`, WHICH THE
OWNER REPLACED.** **Every referral is declinable and the built reducer already implements that.**
**A session reading the old spec builds the forbidden guard CONFIDENTLY.**

### ✅ PHASE 1 MEASURED ITEM BY ITEM — four of nine done, one paused, four to go

**Measured against the SOURCE on each item's own branch, not against commit subjects.**

| #   | Item                                          | Branch                                        | State |
| --- | ----------------------------------------------- | ----------------------------------------------- | ----- |
| 1   | **The urgent flag**                           | working line, board, referrals — `bc7cb70fb`  | ✅ |
| 2   | **`FD-23` screen boundary**                   | referrals                                     | ✅ |
| 3   | **The referral screen** — *"the referrer chooses where to refer, and is shown why"* | referrals — `521888a23` | ✅ |
| 4   | **The ED Psychiatry Hub**                     | —                                             | not started |
| 5   | **The ward page becomes the ward hub**        | board                                         | ⚠️ **PAUSED by the owner** |
| 6   | **The patient screen**                        | working line — `da8faea5e`                    | ✅ |
| 7   | **The patient polish**                        | —                                             | next |
| 8   | **The coordinator hub**                       | —                                             | not built |
| 9   | **The community hub**                         | —                                             | not built |

⚠️ **Item 5 is the only stopped item that is not polish — it is the flow's last missing link, the
ward's own view of a referral.**

### ⚠️ AND THE FIRST PASS OF THIS TABLE GOT ITEM 1 WRONG, BY MEASURING A DIFFERENT ITEM

**I checked for `URGENT_MARK_REASONS` and reported the urgent flag as not landed.** ⚠️ **That symbol
belongs to a LATER, SEPARATE piece of work — the ten placeholder reasons — which lives on Ward
Verifier's branch alone.** **The FLAG landed hours earlier at `bc7cb70fb` and is on three branches.**

> ⚠️ **I asked about the flag and measured the reasons. Two things with adjacent names are not one
> thing** — the same shape as counting a comment instead of a definition, and as `ward` matching
> `forward`.

**And a second half worth keeping: for items 3 and 4 the FILES already existed** —
`src/app/mockups/ward-flow/referrals/*` and `src/components/ward-management/ed/*` were both there
before any of tonight's work. ⚠️ **A file existing is not the feature existing.** **The honest check
was `git log <base>..<branch> -- <paths>`, which showed real new work on the referral screen and NONE
on the ED hub.**

### ✅ THE PATIENT SCREEN HAS LANDED — `da8faea5e` on `claude/ward-flow-phases-6-7-design`

**Phase 1 item 6, and it closes phase 0 item `0.6` with it. Verified in the source, not taken from
the commit message:**

```
src/app/mockups/ward-flow/people/[patientId]/page.tsx    new route
src/components/ward-management/patients/person-screen.tsx  133 lines
tests/ward-person-screen.dom.test.tsx                    152 lines
docs/site-map.md                                         updated in the SAME commit
```

✅ **`patient-search.tsx` now renders each person as a `<Link href="/mockups/ward-flow/people/{id}">`.**
⚠️ **The tiles that silently absorbed a click for the whole of last night now go somewhere** — and
they were only ever going to be closed this way, because **`Patient` holds identity and nothing
linked a patient to a movement.** **`0.6` was never a separate item; it was a symptom of this one.**

**And the repository's own new-route checklist was followed inside the commit rather than after it:
the site map moved with the route.**

**Also landed since: an ED referral saying WHICH department and WHY (`df96f26e1`); the ED arm
typechecking (`3c5e694cf`, and its message is the finding — *"which the test suite could never have
told me"*); and the transport-cancel permission fix (`64c434355`).**

### ✅ LANDED ON THE WORKING LINE TONIGHT

```
74253c367  the out-of-area board stops counting days across two clocks
93827a799  Ward Board's five commits, including the ED default that read the frozen seed
69a5fde4d  the clock offset is applied once because there is no way to apply it twice
e6234a059  the numbered stage cells do what their numbering promises
9daa1e419  the strip above the queue counts the same people the queue does
1fcca3498  Ward Verifier's seven corrections, and the test runner that refuses a lost file
```

**Elsewhere:** `FD-23` guarded at the screen boundary; the nine `D9` cut stamps; the frozen date; ten
placeholder urgent reasons (**his request, marked as placeholders**); four design specs.

### PHASE BY PHASE

- ✅ **PHASE 0 — COMPLETE.** Eight of nine closed; **`0.6` is not a separate item and never should have
  been** — the search tiles have nowhere to point until the patient screen exists, because **`Patient`
  holds identity only and nothing links a patient to a movement.**
- **PHASE 1 — the flow.** ✅ urgent flag, ✅ `FD-23`. **In flight:** the referral screen. **Next:** the
  ED hub, the patient screen, the polish, the coordinator hub, the community hub. ⚠️ **The ward page
  becoming the ward hub is PAUSED — it is the flow's last missing link and the only stopped item that
  is not polish.**
- **PHASE 2 — truthfulness.** ✅ the ED panels, ✅ the stage strip, ✅ the `D9` stamps. **Remaining are
  Ward Board's and paused**, except the 24 audit rows (Ward Verifier).
- **PHASE 3.** ✅ the transport design. **The screen and the timeline are Ward Core's.**
- **PHASE 4 — design.** ✅ the network diagram, ✅ the header. **Three specs to write; five of six
  builders paused.**

### ⚠️ WITH THE OWNER — nothing here blocks anybody

**Clinical / product:** the catchment suburb mapping, its three internal oddities and five
contradictions · the real transport provider list · the real community team list · **the ten urgent-mark
reasons, which are his to choose** · **which FACTS travel with a referral** (the disclosure question)
· **`HD-Q1`: `/transport`, *"Live tracker"* and `live-tracker.tsx` are three names for one page, and a
header cannot be designed without choosing one.**

**Operational:** **a page reload wipes a demonstration** — `D9-8` is cut; he has been told and asked
whether he wants it back · ⚠️ **~48 resident sessions and the machine has hit its commit limit; closing
old sessions is his action and cannot be done by anybody being more careful.**

---

## THE COMPLETION PLAN — ordered, 2026-08-30

**Ordered by what unblocks what, and by what the demonstration actually needs.**

> **The single most useful fact: the ED-to-ward flow is nearly complete, and MOST OF WHAT REMAINS IS
> NOT ON THAT PATH.** A referral can be raised, a patient exists, search finds them, a ward accepts, a
> bed is taken, the patient arrives and survives arrival, the board shows them, they are discharged.
> **The one missing link is the hubs — the screens where a ward SEES the referral.**

### ✅ TWO OWNER RULINGS ON URGENCY — `4be0ca1ba`, and one is a NEW constraint

**1. Urgency is the PRIMARY sort. The wait orders WITHIN a tier. A long wait NEVER lifts somebody
above a more urgent person.** His words: *"Ok I agree with that rule."*

✅ **This closes the oldest open question in the project, and the built model is already right** —
`ward-priority.ts` orders by urgency tier with an operational score **blind to urgency** inside it.
**Nothing needs re-ordering.** ⚠️ **And the refusal is now the OWNER'S, not a session's, which matters:
a session-made refusal is reversible by a session and his is not.**

**2. ⚠️ NEW: *"patients must met a certain high threshold to be marked as urgent."***

**That is not in `D9-1` and it is the safeguard the decision was missing.** **A tier that outranks
everything and is easy to apply INFLATES until it means nothing** — at which point the wait ordering
underneath it stops mattering too, **and `D9-1`'s whole first half is dead.** He closed that himself.

> ⚠️ **HOW THE THRESHOLD IS EXPRESSED IS NOT DECIDED AND MUST NOT BE GUESSED. Two standing refusals
> meet exactly here:**
>
> - ***"Nothing predicts, scores, ranks or recommends a person"*** — **a numeric threshold the
>   software applies breaches this.**
> - ***"No figure, timeframe or threshold from the Mental Health Act, anywhere"*** — **a sourced
>   clinical one breaches this** unless it has a named accountable owner and a real source, **which no
>   session can supply.**

**RECOMMENDED, NOT DECIDED** — Ward Verifier's, and it is right: **a short fixed list of stated
reasons a human picks from, with who marked it and when, recorded and visible. A human DECLARING
urgency against criteria; never software COMPUTING it.** **The shape already used for decline reasons,
and exactly what `D9-2` does for escalation.** **It satisfies both refusals without needing a number
anybody has to source.**

⚠️ **THE TRAP: the tempting implementation is a score, or a set of conditions the system evaluates,
because *"high threshold"* SOUNDS numeric. That is the one shape both refusals forbid, and it will
look entirely reasonable in review.**

⚠️ **AND THE SECOND HALF, WHICH IS WARD CORE'S AND IS THE PART THAT ACTUALLY BLOCKS: THE CHOICE OF
THE REASONS THEMSELVES IS THE OWNER'S.** Exactly as `DECLINE_REASONS` and `OVERRIDE_REASONS` were.

> **Inventing five plausible criteria for marking a psychiatric patient urgent is PRECISELY the act
> both refusals exist to prevent. It would look completely reasonable in review, and it would be a
> session deciding clinical criteria.**

**So the SHAPE is agreed and the CONTENT is his. Blocked part, not blocked task** — the constraint is
being carried in prose beside `ward-priority.ts`, **where a maintainer of the live flag meets it
without going to a cut decision.**

⚠️ **AND A PLACEMENT PROBLEM WORTH MORE THAN THE RULING: it is stamped at `D9-1`, which is CUT —
while the urgent flag it constrains is LIVE, landed at `bc7cb70fb`.** **A maintainer of the live flag
will not go looking in a cut decision.** **`PROC-17` says record at the decision; this is its mirror
— when a ruling on a CUT decision constrains a BUILT feature, it must ALSO live where the feature is.**

### ✅ THE WARD HUB IS THE WARD PAGE, UPGRADED — Ward Board, and the argument is not aesthetic

**The ward page already holds the sections:** bed capacity; **incoming referrals awaiting an answer**
(an inbox); **accepted, held or en route here** (an inbox); **withdrawn** (an outbox of a kind).
**What it lacks is that they are CORRECT.**

> ⚠️ **A separate ward hub would be the THIRD place on this prototype showing referrals incoming to a
> ward** — the ward page, the board's *"Coming in"* panel, and the new hub. **The owner objected to
> exactly that duplication an hour ago and had a whole section folded away for it.**

**Smaller change, no new route to wire, and no third surface for a reader to reconcile against two
others.**

### ⚠️ BLOCKED PART — TWO ADDRESSING MODELS ARE LIVE AT ONCE

```
Movement.referredUnitIds   75 uses in src   <- what the ward page's inbox reads
Referral.destinations      25 uses, populated (8 in the seed)   <- expresses FD-21
wardAddressings()/wardAddressing()   called by exactly TWO screens
```

✅ **ANSWERED BY WARD CORE, and it also corrected the frame I passed on. STAY ON `referredUnitIds`.**
**The migration is not imminent and is not starting.** `referredUnitIds` is read by **10 files**, two
of which settle it: **`ward-flow-reducer.ts` writes it and `ward-movements.ts` authors the seed** —
**so it is the shape the state machine and the fixture are both built on, not a display convention.**

> ⚠️ **THE CORRECTION, and it is the useful half: the two models are NOT rival spellings of one
> fact.** **`referredUnitIds` says WHICH WARDS a movement is addressed to. `Referral.destinations`
> expresses `FD-21` — a referral addressed to a ward, an ED **or** a community team, each with its own
> state.** **A ward inbox only ever asks the first question.**
>
> **So after the migration the inbox's query does not change SHAPE, only where it reads the ward list
> FROM. That is an EDIT, not a rebuild** — **the opposite of the band problem.** ⚠️ **I relayed
> "a wrong shape is a rebuild" without testing it against the model. Ward Core tested it.**

⚠️ **THE BOUNDARY THAT WOULD CHANGE THE ANSWER, drawn so Board need not ask again: if the hub must
show a patient referred to an ED or a community team as well as to wards, it CANNOT use
`referredUnitIds` — that field cannot represent a non-ward destination at all, and the hub would be
SILENTLY INCOMPLETE rather than merely old.**

⚠️ **AND `FD-23` BINDS THE HUB WHICHEVER FIELD IT READS: a ward-facing surface may not reveal where
else a patient has been referred.** **The coordinator hub is where the whole picture is correct — that
is the point of it.**

✅ **Board built item 11 while blocked. That is the reporting rule working: the blocked PART named,
the task continuing.**

### ✅ THE ORDER, PERFECTED 2026-08-30 05:30 — owner away six hours

> **"Utilise the most logical and safest order, ensure now that all appropriate safety checks are in
> and all lessons from Verifier chat as well… Please run autonomous for the next 6 hours."**

**The reorder is one change: A NEW PHASE 0 IN FRONT OF EVERYTHING — every place a screen currently
asserts something FALSE.** Nothing else moves.

**Why in front, and why it costs almost nothing:** these are eight small defects, and **they are the
only items where the cost of waiting is that somebody reads a wrong number and believes it.** They
are also **distributed** — Ward Referrals has NONE, so the referral screen and the ED hub proceed
uninterrupted, **and the ED-to-ward flow is not stalled by this.**

⚠️ **The safety checks for all of it are `docs/ward-flow-safety-checklist.md`. Read section A before
believing any check, and section E before writing any figure.**

### PHASE 0 — THE TRUTH DEFECTS. A screen that asserts a false thing is the one failure this prototype cannot carry

### ⚠️ RE-MEASURED AT `1fcca3498`, 2026-08-30 — FIVE OF THE NINE WERE STALE OR WRONG

**I queued nine defects. Four had already been fixed before the message reached the builder, and one
was a reasoned refusal I had read as an omission. Measured, not assumed:**

| #   | Measured status                                                                                                | Live? |
| --- | ---------------------------------------------------------------------------------------------------------------- | ----- |
| 0.1 | ✅ **FIXED.** `TRANSPORT_PROVIDERS = ["Ambulance service", "Patient transport service", "Ward escort"]`; the two real names survive only in the comment recording their removal | no |
| 0.2 | ✅ **FIXED, and better than the remedy I specified.** `openQueue` is ONE array the count and the list both read, pinned by `tests/ward-network-queue-count.dom.test.tsx` | no |
| 0.3 | ✅ **The SENTENCE fixed at `ab52ba369`** — board branch, ahead of the working line. ⚠️ **The architecture is not fixed and is not queued** — see below | partly |
| 0.4 | ✅ **FIXED at `8ff7ec313`.** `DEMONSTRATION_DAY_LABEL` + `JURISDICTION_LABEL` in `ward-sites.ts`, wording changed to *"Scenario set on…"* | no |
| 0.5 | **LIVE.** `<span className={styles.pipelineStage}>` at `ward-management-network.tsx:665`                        | **yes** |
| 0.6 | **LIVE.** `PeopleSection` renders `<li>`/`<span>`; no link, no button                                            | **yes** |
| 0.7 | ⚠️ **NOT A DEFECT — a REASONED REFUSAL, and the reason is right.** Widening the form type would disturb `tests/ward-legal-figure-guard.test.ts`, **the Mental Health Act figure guard the owner said must never be disturbed.** Nothing writes a bad code today; the only populated value comes from the seed | **no — withdrawn** |
| 0.8 | **LIVE.** `enRouteAt?`, `collectedAt?`, `arrivedAt?`, `cancelledAt?` are still independent optionals              | **yes** |
| 0.9 | **LIVE.** No already-shifted marker in `ward-reanchor.ts`; the hazard is DOCUMENTED at `ward-board.tsx:888` and not fixed | **yes** |

> ⚠️ **THE CAUSE IS STRUCTURAL AND IT IS MINE. A finding ages between the moment it is measured and
> the moment it reaches the person who can act on it** — Ward Verifier measures the running app, I
> relay, the builder has often already fixed it. **I relayed nine without re-measuring one.**
>
> **THE RULE: every relayed finding carries the SHA it was measured at, and is RE-MEASURED before it
> is queued.** **Ward Core did that unprompted on `TR-F2` and was right to.**

**`0.7` is the more interesting correction, because nothing was wrong with the code.** ⚠️ **A refusal
carrying its reason in a comment reads exactly like an oversight to anybody scanning for defects.**
The remedy is the one this project already uses — **the reason lives where the thing would have been**
— and it worked: the reader who needed it found it. **What failed is that I did not read it.**

### ⚠️ 0.3's REAL SHAPE — flagged, deliberately NOT queued

**The board and the ward are not one dataset at two clocks. THEY ARE TWO DATASETS.** `ward-board.tsx`
makes **zero** `useWardFlow` calls: `now = WARD_ADMISSIONS_ANCHOR`, admissions straight from the seed
module, **bed releases synthesised** with `derivedBedReleases`, no leave beds modelled.

**So the remedy is admissions entering provider state — architectural, on Ward Core's surface, and it
needs scoping like the per-bed entity.** ⚠️ **It is NOT queued.** **What IS done: the board now says
figures AND times can differ, pinned by a test on the word *"figures"*, so nothing on screen
overstates itself. That is a mitigation, not the fix.**

### ✅ PHASE 0 IS EFFECTIVELY COMPLETE — re-measured at `e6234a059`, 2026-08-30

**Of the nine defects I queued, EIGHT are closed and ONE is live — and it closes with a phase 1 item
anyway.**

| #   | Re-measured                                                                                             | Status |
| --- | --------------------------------------------------------------------------------------------------------- | ------ |
| 0.1 | Two real organisations — gone. `TRANSPORT_PROVIDERS` is generic                                          | ✅ |
| 0.2 | One `openQueue` array the count and the list both read, test-pinned                                       | ✅ |
| 0.3 | The board's SENTENCE is fixed; the two-datasets architecture is flagged, parked, **not queued**            | ✅ / parked |
| 0.4 | `DEMONSTRATION_DAY_LABEL` + `JURISDICTION_LABEL`, wording changed to *"Scenario set on…"*                  | ✅ |
| 0.5 | ✅ **The strip is now a real control**: `<button type="button">`, `aria-pressed`, an `onClick` stage filter, and a comment explaining why the counts deliberately stay UNFILTERED | ✅ |
| 0.6 | **LIVE.** `PeopleSection` still renders `<li>` with no link or button                                     | **the only one** |
| 0.7 | Never a defect — a reasoned refusal protecting the Mental Health Act figure guard                        | withdrawn |
| 0.8 | ⚠️ **LATENT, NOT LIVE.** See below                                                                     | demoted |
| 0.9 | ⚠️ **LATENT, NOT LIVE.** See below                                                                     | demoted |

### ⚠️ 0.8 AND 0.9 ARE LATENT HAZARDS, AND I QUEUED BOTH AS LIVE DEFECTS

**`TR-F3` — the reducer ALREADY refuses every out-of-order transition. Measured:**

```
MARK_TRANSPORT_EN_ROUTE  requires stage handover_ready AND transport.acceptedAt; refuses if enRouteAt set
PATIENT_COLLECTED        requires stage handover_ready AND transport.enRouteAt
PATIENT_ARRIVED          requires stage moving        AND transport.collectedAt
CANCEL_TRANSPORT         refuses if cancelledAt set, and refuses if arrivedAt set
```

**Nothing can write them out of order. Only the TYPE permits it** — which is what Ward Decisions
actually said (*"nothing writes them out of order today; the shape permits it"*). **A type-level
hardening, not a live defect.**

**`shiftInstants` — EVERY production call applies it to a FRESH `seedWardFlowState()`. Measured, all
three:**

```
ward-flow-provider.tsx:116   shiftInstants(seedWardFlowState(), offset)
ward-flow-reducer.ts:376     shiftInstants(seedWardFlowState(), event.now - state.clockOffsetMinutes - NOW_ANCHOR)
ward-flow-reducer.ts:379     shiftInstants(seedWardFlowState(event.scenario), …same…)
```

**There is no second applier. The reducer even SUBTRACTS the current offset, which is the deliberate
way to compute a fresh absolute one.** ⚠️ **The hazard is that a FUTURE caller could apply it to
already-shifted state — real, worth a marker, and not a defect on screen today.**

> ⚠️ **BOTH ARE WORTH DOING AND NEITHER IS URGENT. Demoted to phase 2 as HARDENING, not deleted** —
> the distinction the cut list exists to preserve.

### ⚠️ AND THE PATTERN IS MINE, STATED PLAINLY

**Nine items queued. Four were already fixed. One was never a defect. TWO MORE were latent hazards
queued as live defects.** ⚠️ **I wrote the rule *"re-measure before queueing"* after finding the
first four — and then committed the same error twice more in the same batch, because I re-measured
whether they were FIXED and never re-measured whether they were as SEVERE as the message implied.**

> **A finding travels with an implied severity, and the severity is the part nobody re-checks.**
> **"Is it still there?" and "is it as bad as I was told?" are two questions, and I only ever asked
> the first.**

**THE REMAINING WORK IS PHASE 1. Nobody should spend an hour on a latent hazard while the flow is
unfinished.**

### ⚠️ MY REMEDY FOR THE STRIP WAS WRONG, AND THE ARGUMENT AGAINST IT IS THE BETTER RULE

**I said: put "Arrived" outside the queue total, and the miscount becomes hard to reintroduce.**

**`isOpen` is `!movement.closure && movement.stage !== "arrived"` — TWO conditions.** A movement that
self-discharges from ED **closes at whatever stage it had reached**, so **closed movements sit inside
stages 1–6, not only in stage 7.** Move "Arrived" out and **stages 1–6 still sum to more than the
queue count, with nothing on screen to explain the gap** — and the strip now **looks** as though it
ought to add up.

> ⚠️ **"A number that visibly does not reconcile is safer than one that INVITES reconciliation and
> fails it."** — Ward Core, and it is now a design rule for every figure on every screen.

**And its method is the point: it measured the fixture before designing the fix rather than assuming
the closed-not-arrived group is empty.**

✅ **MEASURED: 50 total, 43 open, 6 arrived, 1 CLOSED BEFORE ARRIVING.** ⚠️ **The group is not
empty — it has exactly one member, so my remedy would have printed 44 beside 43. Off by one, and
looking as though it ought to reconcile.** **A remedy that is right only while a group happens to be
empty breaks silently on the first case that fills it; here the first case already existed.**

### ⚠️ A SECOND REAL-ORGANISATION QUESTION — THE OWNER'S, and nobody is building anything

**`ward-sites.ts` names real hospitals throughout** — Royal Perth, Sir Charles Gairdner, two St John
of God sites — **and the prototype states bed numbers and referral acceptances for them.**

⚠️ **This is NOT the same defect as `TR-F2` and must not be swept up with it.** The transport fault
was specific: **a screen asserted that a real body had ACTED** — *"St John WA accepted, awaiting
departure"* — **when it has agreed to nothing.** **A site list naming the hospitals a WA bed-flow hub
covers is the PREMISE of the demonstration**, it is documented as deliberate in that file, and the
owner has seen it on every screen since the beginning.

**Renaming the network is a design decision with his name on it. Flagged, nothing built, with him.**

**Ward Referrals has NO phase 0 item and does not stop.** **Ward Board has ONE and it is small.**
**Ward Verifier has ONE, in a file it is already in.** **Ward Core has six, each minutes to an hour**
— and it is the bottleneck, **which is why the nine `D9` stamps moved OFF it to Ward Verifier.**

⚠️ **0.2 and 0.5 belong together.** The fix for the count is **not** to correct the number: **make
stage 7 "Arrived" visibly OUTSIDE the queue total.** **A corrected number is a fact that can drift
back; a structure that separates them is not** — and this defect has now recurred once already, in a
different component, from the Phase 1 audit.

**AFTER PHASE 0, THE ORDER IS UNCHANGED:** phase 1 finishes the flow and the role screens, phase 2
stops the remaining screens saying untrue things, phase 3 shows the journey, phase 4 is the seven
design items. **The definition of done is still the end of phase 2.**

---

### ✅ OWNER, 2026-08-30, SECOND INSTRUCTION — build every role's screen

> **"Please go ahead and complete appropriately all the previous 3 phases. Also… please ensure that
> you build all the different individual screens, I.e transport, wards, ED, Coordinator, Community
> versions. Please also polish the individual patient screen where it shows their details as the
> patient selection."**

**Three things changed, and two of them are not obvious from the sentence:**

1. ✅ **THE COMMUNITY HUB IS CONFIRMED — he settled it himself: "Build community hub. I give
   permission."** He had parked it directly this morning (*"I park community hub"*), and **both halves
   stay on the record**, because a reader who finds only the park reads the build as somebody ignoring
   him. **It is
   built against the ten PLACEHOLDER teams and says so**, because reconciling the 76 clinic strings
   into real teams is still parked and is not a prerequisite for a screen that labels its own data.
2. ⚠️ **A COORDINATOR SCREEN DOES NOT EXIST TODAY.** The coordinator sees the world through the
   board and the shortlist. **"Coordinator version" therefore means deciding what is coordinator-only**
   — and `FD-23` already answers it: **a ward sees one destination; the coordinator sees them all.**
   That, plus the override register, is the screen.
3. **The patient screen gets a POLISH pass as its own row**, not as a quality bar inside task 6.
   **A polish folded into a build is the half that gets dropped when the build runs long.**

**Transport already had a row.** It now has a **screen** as well as a design, and the design is the
gate: **Ward Decisions must land it before Ward Core can build it.**

### PHASE 1 — Finish the flow, and build every role's screen

| #   | Task                                                                                                    | Owner     | State                 |
| --- | ------------------------------------------------------------------------------------------------------- | --------- | --------------------- |
| 1   | **The urgent flag** — additive, tiers untouched, marked provisional                                     | Core      | ✅ landed `bc7cb70fb` |
| 2   | **`FD-23` screen boundary** — transitive import guard                                                  | Referrals | in flight             |
| 3   | **The referral screen** — several destinations in one act, catchment flagged, wait + stats per option   | Referrals | next                  |
| 4   | **ED Psychiatry Hub** — inbox, outbox, and the self-addressed third list                               | Referrals | queued                |
| 5   | ✅ **THE WARD PAGE BECOMES THE WARD HUB** — not a new screen                                              | Board     | ✅ **unblocked, building** |
| 6   | **The patient screen + universal referral button** — four questions, identity inherited                 | Core      | queued                |
| 7   | **The patient screen POLISH** — the detail view as it appears on selection                              | Core      | **new 2026-08-30**    |
| 8   | **The coordinator hub** — sees every destination, and **holds the override register**                   | Core      | **new 2026-08-30**    |
| 9   | **The community hub** — ✅ **CONFIRMED by the owner**, on placeholder teams, labelled                    | Referrals | **new 2026-08-30**    |

**At the end of 9, every role has a screen and the flow is demonstrable end to end.**

### PHASE 2 — Stop the screens saying untrue things. This is the demonstration's whole claim

| #   | Task                                                                       | Owner    |
| --- | -------------------------------------------------------------------------- | -------- |
| 10  | **The 24 audit findings**, incl. the false governance card                  | Verifier |
| 10b | **The nine `D9` cut stamps** — moved OFF Ward Core, which is the bottleneck | Verifier |
| 11  | **The ED panels read live state**                                          | Board    |
| 12  | **Every control works and says it is demo data**                           | Board    |
| 13  | **Every network screen says the network is synthetic**                     | Board    |
| 14  | **The staleness headline** — load-bearing: confidence decays with distance | Board    |

> **The override register has MOVED OUT of this phase** — it is now item 8, inside the coordinator
> hub, because a register with no screen to live on was always going to need one.

### PHASE 3 — The journey shows itself

| #   | Task                                                              | Owner     |
| --- | ------------------------------------------------------------------- | --------- |
| 15  | ~~**Transport — the design**~~ ✅ **LANDED `4dffeef8f`**              | Decisions |
| 16  | **Transport — the screen.** Blocked until 15 lands                 | Core      |
| 17  | **The timeline carries the whole journey**                          | Core      |
| 18  | **Print the day**                                                   | Board     |

### ✅ OWNER, 2026-08-30 — SEVEN DESIGN ITEMS. A NEW PHASE, NOT AN INSERT

> **"add to the patient network diagram on tab 2 and find a way to make it useful while also being
> visually striking… improve the patient movement and patient capacity screens, any design or
> functional improvements… elevate the ward questionnaires they must fill in to be more aesthetic and
> make the transport page more well designed… build a useful header for me as well which is missing."**
> Plus a screenshot of the stage strip: **"correctly wire this up and give it appropriate function."**

⚠️ **FOUR OF THESE SURFACES HAVE NOT BEEN TOUCHED SINCE 2026-08-26.** `movements/page.tsx`,
`capacity/page.tsx` and `transport/page.tsx` are untouched since the original Phase 4 commit
`3ab1f3dcc`. **A design brief written from the code would be a guess** — so **Ward Verifier is looking
at all seven in the browser first**, Ward Decisions writes the design from that report, and the
builders build from the design. **Measure before moving, applied to design.**

| #   | Item                                                                                                      | Phase | Note                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------- |
| 19  | ⚠️ **THE STAGE STRIP IS INERT** — `ward-management-network.tsx:645–654`                                     | **2** | **`<span>`s, not buttons — so the wiring gate never fires. THIRD instance tonight**          |
| 20  | **The patient network diagram (tab 2)** — **give it a USE**, then make it striking                          | 4     | He asked for a use first. A diagram nobody can act on is decoration                         |
| 21  | **The movements screen** — design and function                                                              | 4     | Untouched since 26 Aug                                                                     |
| 22  | **The capacity screen** — design and function                                                               | 4     | Untouched since 26 Aug                                                                     |
| 23  | **The ward questionnaires** — more aesthetic                                                                | 4     | ⚠️ **WHICH SURFACE IS NOT CONFIRMED.** `ward-screen.tsx` or `referrals/` intake — Verifier to identify |
| 24  | **The transport page** — better designed                                                                    | 4     | Untouched since 26 Aug, **and it predates the transport spec `4dffeef8f` entirely**        |
| 25  | ⚠️ **A USEFUL HEADER — "missing"**                                                                        | 4     | **"Missing" may mean absent or present-and-useless. Different work; only visible on screen** |

> ⚠️ **PHASE 4 IS A NEW PHASE AND IS NOT THE CUT PHASE 4.** The cut one was the persuasion batch
> — scenarios, the refusal register, the why-no-bed sheet, the assembled handover — **and it stays cut.**
> **This is the FOURTH same-name collision recorded in one night** (two `Q4`s, two `Phase 9`s, `R31`),
> **so it is named here before anybody trips on it: cite these by ITEM NUMBER, never by phase.**

### ⚠️ THE OWNER HAS PAUSED WARD BOARD — 2026-08-30, mid-session

**He asked for the bed-grid design pass, Ward Board started, and within the same minute he said
*"Hold off for now."* It stopped before touching anything. Its tree is clean at `09b4a9e87`.**

> ⚠️ **IT HOLDS `ward-screen.tsx` AND IS NOT WORKING IN IT. Those are DIFFERENT STATES and the
> difference is the whole point:** a plan routed around an assumption that its five surfaces are in
> progress **is scheduling against work that is not happening, and the first anybody would learn of
> it is a milestone that never arrives.**

**No reason was given and none was asked for** — **following *"hold off"* with a question about
scheduling would have been the session managing its queue rather than doing what he said.** **The
duration is unknown and is not being guessed at.**

**STOPPED, and NOT reassigned:** the ward page becoming the ward hub (item 5), the ED panels' siblings
(items 12–14), print the day (18), **and five of the six phase 4 items** — the network diagram,
movements, capacity, the ward forms, the header.

⚠️ **The files stay with Ward Board and that is deliberate. A paused owner is still an owner, the
pause may be minutes, and handing five surfaces to somebody else and back is more dangerous than an
idle file.**

**THE CRITICAL PATH IS THEREFORE WARD REFERRALS AND WARD CORE**: the referral screen, the ED hub and
the community hub; the patient screen, the polish, the coordinator hub, the timeline, transport.
**The flow's last missing link — the ward's own view — is stopped, and nothing else is.**

### ⚠️ PHASE 4 HAD A DESIGNER AND NO BUILDER — fixed here before it became a discovery

**Ward Decisions designs all six. NOBODY WAS ASSIGNED TO BUILD THEM**, which is the kind of gap that
is invisible until the designs land and everybody assumes somebody else has it.

| #   | Item                          | Designs   | Builds    | Why                                                                 |
| --- | ----------------------------- | --------- | --------- | --------------------------------------------------------------------- |
| 20  | **The network diagram**       | Decisions | **Board** | It owns the statewide/board surfaces                                 |
| 21  | **Movements**                 | Decisions | **Board** | Same family. **Verifier says it needs the LEAST — do not overspend** |
| 22  | **Capacity**                  | Decisions | **Board** | Same family                                                          |
| 23  | **The ward questionnaires**   | Decisions | **Board** | They are on `ward-screen.tsx`, **and the ward page is now Board's**  |
| 24  | **The transport page**        | Decisions | **Core**  | Core owns transport (item 16) and the reducer behind it              |
| 25  | **The header**                | Decisions | **Board** | On every screen; **its third part is the real design question**      |

⚠️ **CORRECTED 2026-08-30: it did NOT assess all seven surfaces.** **It walked THREE screens — the
coordinator hub, the ED screen, and governance.** **The "all seven" is mine and it is false.**

⚠️ **READ THE CORRECTION CAREFULLY, BECAUSE THE OBVIOUS INFERENCE FROM IT IS WRONG:** *"Verifier
did not assess them, so Verifier may build them"* — **that would trade the instrument for an extra
pair of hands, which is a bad trade at any point in this project.** ✅ **Verifier re-derived the
right answer on a sounder basis than mine while correcting me: it assessed the GOVERNANCE screen, so
the governance fix is not its to build, and `ward-derivations.ts` belongs to Ward Core by the same
ruling that put the model and the reducer there.** **It said so BEFORE the work could land on it by
default — which is the harder direction to speak in.**

✅ **THE PRINCIPLE IS UNCHANGED AND IS THE PART TO KEEP: an assessor who also builds stops being one,
and does not notice the moment it happens.** **It binds per surface, on the surfaces it actually
walked — not by a blanket claim about seven.** **If it also builds those, nobody independent verifies
them** — **and its browser is
the only instrument that found the frozen board, the queue miscount, the stale refusal register and
the header claiming to know the date.** **Trading the instrument for an extra pair of hands is a bad
trade at any point in this project.**

**Item 19 sits in phase 2, not phase 4, because it is not a design request.** A strip that looks
clickable and silently absorbs the click **is the same class as the silent search tiles** —
truthfulness, not polish.

**The other six are phase 4 because the definition of done is still the end of phase 2**, and none of
them is on the ED-to-ward path. ⚠️ **They do not displace phases 1–3 unless the owner says so.**

### ⚠️ SIX DEFECTS FOUND AFTER THE PLAN WAS WRITTEN — 2026-08-30 evening

**Three from Ward Verifier walking the running app, three from Ward Decisions reading the model while
designing transport. None of them are in the 24-finding audit.**

| Defect                                                                                                                                     | Owner     | Why it matters                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------ |
| ⚠️ **THE WARD BOARD IS STILL FROZEN and says so on screen** — contradicts `DB-11`                                                            | Board     | **Demonstrated: ward reads `Held 0` / `12:32`, board reads `HELD 1` / `10:42`**       |
| ⚠️ **`TR-F2` — the reducer names TWO REAL ORGANISATIONS on screen**, chosen by nobody                                                       | Core      | *"St John WA accepted, awaiting departure"*. **Synthetic-data breach, live**          |
| **`formRequired: string`** — a bare string naming a legal artefact                                                                           | Core      | **`SELECTABLE_LEGAL_FORMS` already exists.** No Act figure introduced by fixing it    |
| **`TR-F3`** — transport lifecycle instants are independent optionals                                                                          | Core      | `arrivedAt` on a **cancelled** job is representable. Nothing writes it; the shape allows it |
| **A PAGE RELOAD WIPES THE DEMONSTRATION** — the provider resets to seed                                                                       | — **owner** | **A refresh or a new tab during a demonstration loses everything just done**          |
| **Search result tiles absorb the click in silence** — plain text, not buttons                                                                  | Core      | **No gate is broken.** They look activatable, so a clinician will click them          |

> ⚠️ **The board finding is the one no code reading produces.** Ward Verifier had to walk a patient
> through and look at two screens at once — **while the wrapper run was clean: 84 files handed in, 84
> ran, 1249 passed, 0 failed. The tests were green and the screens disagreed.**

**The reload risk is the owner's to know about, not a task:** `D9-8` already lists *"the prototype's
memory"* and it is **cut**. **The demonstration risk is not the same thing as the feature gap** — it is
worth telling him **before** a room rather than during one.

### ⚠️ PHASES 4, 5 AND 6 ARE CUT — owner, 2026-08-30

> **"Cut 4/5/6 please."**

**CUT, not deferred and not forgotten. A decision, with a date, and it is not to be re-added by a
later reader who finds them listed in an older plan.**

**What was cut, so nobody rediscovers it as an oversight:**

**Phase 4 — the persuasion batch:** named scenarios, the refusal register, the _"why can this person
not get a bed"_ sheet, one assembled handover.

**Phase 5 — reach:** a guided tour per role; roles become real or the switcher goes.

**Phase 6 — all nine Phase 9 items:** the prominent wait, declaring escalation, the retrospective, the
ownership clock, notifications, persistent handover flags, role-grouped navigation, the prototype's
memory, waiting-time equity.

> ⚠️ **Phase 9 is nine RECORDED OWNER DECISIONS, cut before being built.** That is its own state —
> **decided, then cut** — and it is neither "not started" nor "rejected". **A later reader finding nine
> decisions with no implementation must not read that as work anybody forgot.**

**Why the cut is sound:** Phases 4 to 6 make the demonstration **argue for itself**. Phases 1 to 3
make it **true and complete**. **The definition of done sits at the end of Phase 2**, and Phase 3
finishes the journey. **Everything cut was polish on a thing that already works.**

**EIGHTEEN ITEMS IN PHASES 1–3, TWO LANDED. PLUS SEVEN DESIGN ITEMS — one in phase 2, six in the NEW phase 4. TWENTY-THREE REMAIN.**

### PARKED OR DEFERRED BY THE OWNER — not in the plan

~~**The community hub**~~ — ✅ **UNPARKED 2026-08-30, now Phase 1 item 9.** · **the per-bed entity**
(a phase, not a rename) · **the tier and scoring change** · **the catchment mapping**, three oddities
and five contradicting suburbs · **three escalation questions** · **reconciling 76 clinic strings into
real teams** — **still parked, and NOT a prerequisite**: the hub ships on the ten placeholder teams
with the placeholder said out loud.

> **Phases 4, 5 and 6 were cut by the owner on 2026-08-30. The definition of done is met at the end of Phase 2; Phase 3 completes the journey.**

---

## BUILDING NOW

- ✅ **The destination union — THREE arms, landed `83a7349f2`.** Psychiatric ward (sex, secure,
  involuntary), **ED**, community team (accepted by a **team**, not a bed)
- ⚠️ **THERE IS NO `medical_ward` ARM, AND ITS ABSENCE IS A DECISION.** Owner 2026-08-30:
  _"Please defer the medical ward for now and just route to ED which also includes medical ward."_
  **A psychiatric ward sending someone for a medical problem addresses the ED.** The deferral and his
  reason are written into `ward-model.ts` **where the arm would be**, so a reader who knows a psych
  ward can refer to a medical ward in real life does not add it as an oversight
- ✅ **`Decline.note` REMOVED** — landed `0e3c7691a` with the type, event, reducer write, the screen that rendered it and six seed notes, guarded and mutation-proved
- **The five-facts guard widened**, with the decisions named — never deleted
- **`REFER_TO_UNITS` guards rewritten** to assert its new meaning as an override, never relaxed
- **The ledger pointer** on the working line

## SETTLED AND NOT STARTED — the referral flow

- **Multi-select destinations in ONE referral** — not repeat referrals
- **The referral tool flags catchment** and shows **estimated wait time and useful stats per option**
- **First acceptance cancels every other referral automatically** — no coordination step
- ⚠️ **WARD BLINDNESS — needs a GUARD, not a note.** No ward-facing surface may show another
  destination's referral for the same patient. **Coordinator may see all of it.** Deliberate, with a
  behavioural reason: so a ward does not take its time on a patient referred elsewhere
- **Out-of-catchment greyed, never locked out.** No beds makes no difference. **A decline does not
  lock a ward out**, and an option to clarify remains
- **A referral may exist for a patient who ALREADY HAS A BED** — outpatient community while an
  inpatient; ED or medical ward from a psych ward
- **A referral ends, for bed placement, at ACCEPTANCE**
- ✅ **Transport arrangement — DESIGNED, `4dffeef8f`, and the owner has since ruled on all of it.**
  **`TR-D5`: the SENDING location ALWAYS organises transport, never the receiving one. `TR-D4`: the
  receiving ward signals readiness, which PROMPTS them — a prompt, not a transfer of responsibility.
  `TR-D6`: cancel belongs to the booking team and the coordinator; the receiving ward may not.** The
  job stays on the sending board **until the patient physically leaves, not until it is booked**
- **`RAISE_REFERRAL` accepts `["ed", "community", "ward"]`**; its `edId` becomes an origin of any kind
- **`ACCEPT_REFERRAL` / `DECLINE_REFERRAL` accept `["ward", "coordinator"]`**
- **A referrer may withdraw** — no event exists

## ⚠⚠ THE BED MODEL IS A NEW ENTITY, NOT A RENAME — re-scoped 2026-08-30

**Verified at `123b0c139`. Three of the four items I wrote here described code that does not exist.**

### There is NO BED in this model

```
Unit      carries COUNTS - beds, empty, allocatable, held, blocked
Admission names a unitId - never a bed
Bed type / bedId          ZERO occurrences anywhere
```

> **So "Bed state: Available | Occupied | Held | Pending" is not renaming `Unit.blocked`. It
> INTRODUCES an entity that does not exist**, makes every one of those counts derived from it, and
> gives an admission a bed to attach to.

**That is the largest model change proposed all night, and I filed it under "rename".** It is a
**phase**, and it needs scoping as one before anybody starts.

**The owner should know the size before it begins** — he described it as a split of two jobs, which it
is; **what he could not know is that one half has no entity behind it.**

### `beingPrepared` does not exist — I invented the name

**The field is `preparing: boolean` plus `preparationNote`** (`ward-model.ts:486`). **Zero occurrences
of `beingPrepared` in `src`.** Second time tonight I have put an invented symbol into an instruction;
the first reached another session's code.

### `predicted` → `expected` — provenance IS establishable, and it is the owner's own words

**Ward Core was right to refuse it on a task-list line with no traceable decision.** The provenance is
his message, verbatim:

> **"Bed state — Available, Occupied, Held, Pending (with reason) / Discharge — Expected, Confirmed,
> Discharged (with a blocked flag and reason)… Please implement this for me."**

**Recorded here so it stops being a bare task line.** ⚠️ **But it belongs in the DECISION REGISTER, not
in a task ledger** — that is the fourth time tonight a ruling has lived only in a chat thread.

### What survives unchanged

- **Bed state, discharge stages and `Pending`'s reasons are the owner's design and are right.**
- **`blocked` leaving the bed side, so the name collision disappears — unchanged.**
- **A bed is taken at ACCEPTANCE — unchanged.**

## SETTLED AND NOT STARTED — screens

- **The coordinator override register.** What was overridden, whose decision, when, why — and
  ⚠️ **visible to the party overridden.** An override only the overrider sees is an audit trail, not
  accountability
- **The override reason actually recorded** — today it is collected, validated and discarded, while a
  governance screen says otherwise
- **The individual patient screen** — subject is a person, not a movement
- **The universal referral button** on that screen — four questions, identity inherited
- **The ED hub** — spec written (`91bc7ebd8`), released to a builder only after the destination model
  lands
- **The ward hub**
- ✅ **THE COMMUNITY HUB IS UNPARKED — owner, 2026-08-30, later the same day.** He parked it directly
  (*"I park community hub"*), then asked for **"Community versions"** among the screens to build.
  **The later instruction wins, and the reversal is recorded rather than smoothed over**, because a
  reader who finds only the park will read the build as a mistake. **It ships on the TEN PLACEHOLDER
  TEAMS, saying so on the screen** — reconciling the 76 clinic strings into real teams stays parked and
  is not a gate. **What was already true and made this cheap: a community team is a PEER in
  `ReferralDestination`, accepted by a team rather than a bed, with none of the ward criteria. The
  model was ready; only the screens are new**
- **Sex-acceptance numbers derived** from bed allocation later, with the ward able to notify a change

## ✅ THREE OWNER RULINGS — ALL THREE NOW BUILT

**This section was headed *"approved, not built"* for a day after the last of them landed. Corrected
2026-08-30 by an adversarial sweep of this file, not by anybody noticing.**

- ✅ **The handover page goes LIVE** — landed. **Ward Verifier confirmed the freeze existed in the
  code at `123b0c139^`** (a lazy `useState` initialiser) and is gone. ⚠️ **Whether a user could ever
  SEE it drift is unrecoverable now the fix has landed — the boundary is recorded rather than inferred**
- ✅ **`Decline.note` removed** — `0e3c7691a`, with the type, event, reducer write, the screen that
  rendered it and six seed notes. Guarded and mutation-proved
- ✅ **"Remove the away column"** — built at `14ede0c2b` as a LINE under the grid with every away
  person named, and **the owner confirmed that reading as `WB-DB-23`.** ⚠️ **The safe reading was
  right for a measured reason, not a cautious one: of the two people seeded away, ONE has an ordinary
  discharge date and no blocker, so they appear in none of the sheet's four groups — deleting the
  group outright would have removed a named person from a printed handover with nothing to notice
  it.** The overflow measurement is no longer owed

## ⚠️ PHASE 9 — nine decisions, DECIDED THEN CUT

> **These nine are recorded owner decisions that were CUT BEFORE BEING BUILT, 2026-08-30.** The
> decision **stands**; the build **does not**, and its absence is **intended**.

⚠️ **This heading said *"none built"* for hours — in the very document arguing that a cut must be
recorded at the decision rather than in a list of cuts.** **Found by sweeping this file against
itself, not by anybody reading it.** **Ward Verifier is stamping the same status onto each of `D9-1`
… `D9-9` in `docs/ward-flow-phase-9-decisions.md`, which is where a fresh session actually arrives.**

- The wait becomes prominent, ceiling removed, **never outranks urgency**
- Declaring escalation records it and marks the screens
- A retrospective — one person's journey replayed, plus the ward's prediction track record
- An ownership clock, **whose colour threshold is invented and says so**
- Notifications only where someone is waiting on someone else
- Anything flagged at handover **stays flagged until cleared**
- Navigation grouped by role; the coordinator's section grouped by question
- The prototype's memory as its own scoped item
- Waiting-time equity and the out-of-area ledger, designed knowing about each other

**Phase 9 also left four questions with the owner**, none blocking: whether named escalation levels
exist in WA; whether escalation is per site or statewide; **whether a long wait should ever outrank a
more urgent person** (his alone — the only option that changes who gets the next bed); and what a
service actually relaxes when it escalates.

## THE 17-TASK LIST — 2 done, 3 partial, 12 not started

**Done:** the clock is not stuck; the pipeline reaches its end (admit and discharge).

**Partial:** the one freeze still open (morning done, handover ruled not built); remaining demo
defects (1 of 4); every network screen says synthetic (3 surfaces have the full notice).

**Not started:**

- The ED panels read live state instead of fixed numbers
- Every control works against demo data **and says it is demo data**
- The override reason stops being free text
- The audit timeline carries the whole journey
- Named scenarios
- The refusal register
- The staleness headline and the two-sided figure — **now load-bearing**, because discharge dates go
  stale with distance
- Print the day
- One assembled handover
- The "why can this person not get a bed" sheet
- A guided tour for each role
- Roles become real, or the switcher goes

## HOUSEKEEPING

- ⚠️ **CORRECTED AGAIN — "seven unreachable exports" was wrong in BOTH directions, and acting on it
  would have deleted five load-bearing things.** Measured at `123b0c139`: **17 exports** in
  `morning-page.tsx`; **5 imported elsewhere**; **12 never imported** — but **10 of those 12 are
  RENDERED INSIDE THE FILE**, so only the `export` keyword is redundant and deleting the function
  breaks the page. **Genuinely dead: TWO** — `buildFrozenMorning` and `NoHandoverYet`, both residue of
  the freeze `DB-11` removed. **"Exports nobody imports" = 12. "Safe to delete" = 2. Seven is
  neither**, and the row as written left a five-item margin to remove something the page renders.
  **Action: delete those two, drop the redundant `export` keyword on the ten — tidiness, not debris.**
  ⚠️ **Expect `check:dead-code-candidate` to REFUSE `buildFrozenMorning` anyway**, because the gate
  treats a symbol named in a plan with unchecked boxes as in-flight scaffolding, and every ward plan
  is 555 unchecked / 0 checked. **Expectation, not measurement — nobody has run it.**
- **The morning page's comments still describe a freeze it no longer does**, and `FrozenMorning` /
  `buildFrozenMorning` are still defined there
- **`R27`** — unpinned user-facing strings, population uncounted
- **`R37`** — the decisions register is missing from the backup's **plain readable copies**. Owner's
  script; a second git branch does not fix it

## HOUSEKEEPING — added 2026-08-30

- ⚠️ **Read all 35 rows of `EVENT_ROLE` against intent.** The table is now pinned by hand and
  tamper-evident — **but the values were read out of the source, so it proves the mechanism and does
  NOT certify today's permissions are right.** Until somebody reads them, _"nobody can change this
  silently"_ is true and _"this is correct"_ has never been checked. **Good candidate for the owner,
  since intent is his.**

## WITH THE OWNER

- **Which suburbs are in which catchment** — he has given the hospital list, not the mapping
- **Three oddities inside the 2015 document** — `Bentley`/`Mills Street`, `Kwinana` on two rows,
  `Swan Valley` on two rows
- **Five suburbs where his two documents disagree** — Halls Head, Mandurah, Furnissdale, Birchmont,
  Calista
- **Whether a long wait should ever outrank a more urgent person**
- **The real transport provider list** — placeholders until he supplies it
- **The real community team list** — placeholders until he supplies it
- **The reload risk** — a refresh wipes a demonstration. `D9-8` is CUT; **he has been told, and asked
  whether he wants it back**

### ⚠️ A NEW QUESTION FOR THE OWNER, AND IT IS CLINICAL RATHER THAN TECHNICAL

**`FD-23` limits which SERVICE may see a referral. IT SAYS NOTHING ABOUT WHICH FACTS TRAVEL WITH IT.**

**Surfaced by the ten placeholder urgent-mark reasons** (`0db2ea527`, and he asked for them:
*"Just have 10 placeholder urgent reasons for now"*). **Eight of the ten describe what the current
SETTING cannot do** — no psychiatric cover at this site, needs medical care unavailable here, escort
in place and unsustainable. **Two describe the PERSON:**

```
currently_secluded_or_restrained
repeated_attempts_to_leave
```

> **A reason for prioritising a bed is defensible. The same string, RECORDED AND DISPLAYED against a
> NAMED PERSON on a screen many services can see, is a DISCLOSURE** — and *"currently secluded or
> restrained"* is a significant one.

⚠️ **This is not a defect in that list, and the list should not change.** **A reason for urgency
cannot be entirely content-free** — saying why somebody must move first is necessarily closer to the
person than saying why a hold was released, **and the session that wrote them said so in the file
before anybody asked.**

**THE QUESTION IS THE RULE, NOT THE LIST: does a fact recorded to justify a priority travel to every
service that can see the referral, or only to the one deciding?** **It exists whether or not these
particular ten survive**, and it applies to the override reasons and the decline reasons equally.

### ✅ IT IS PROSPECTIVE, NOT LIVE — measured, and the framing changes the question

```
URGENT_MARK_REASONS / UrgentMarkReason   referenced NOWHERE outside ward-change-reasons.ts + its test
givenName / familyName                   rendered by NO surface under ward/ or board/
```

**Today the list is a VOCABULARY WITH NO RENDERER, and no ward-facing screen shows a name at all.
NOTHING IS DISCLOSED TO ANYBODY.**

> ⚠️ **He is choosing what may be BUILT, not repairing something that LEAKED** — **and a question
> framed as a live exposure gets a different, more defensive answer than the same question framed as
> a design choice.** **My first framing was the wrong one and it would have cost him a worse decision.**

### ⚠️ WHY NOTHING CAUGHT IT: NEITHER DECISION IS A PROBLEM ALONE

**The gap was harmless while BOTH held: every reason was operational, AND no name existed anywhere.**
**`PD-1` — the ruling that authorises name, record number and date of birth on the Patient record —
moved one of those conditions ON THE SAME DAY this list arrived.**

> ⚠️ **Each half passes its own review. The combination is the question, and no single review is
> positioned to catch that.** **The same shape as the decline-reason recommendation that contradicted
> `FD-24`: two rows in different sections, neither citing the other.**

### An AVAILABLE SHAPE if he wants reasons scoped by audience — offered, not recommended

**It already exists in this project and does not need inventing.** **`restrictionNotice` in
`ward-screen.tsx` renders a per-unit notice, and the parallel-referral badge already tells a ward THAT
a referral is parallel without naming the other wards.**

> **A fact can be visible to the coordinator and REDUCED TO ITS CONSEQUENCE for the ward** —
> *"needs a level of observation this ward would have to provide"* rather than *"currently secluded or
> restrained"*. **The same move the parallel badge makes, applied to facts instead of destinations.**

⚠️ **Offered as an available shape, NOT a recommendation. Which facts a ward needs in order to answer
a referral SAFELY is a clinical judgement.**

⚠️ **THE OWNER IS A PSYCHIATRIST AND THIS IS SQUARELY HIS.** **Surfaced, not answered, and nothing
is being built either way.**

**Checked and NOT a finding:** `OVERRIDE_REASONS` reads as clinical in places — *"Clinical urgency
outweighs the mismatch"*, *"Closer to the person's home or family"* — **but they are THE OWNER'S OWN
WORDS, recorded as `WB-DB-15` superseded to five, so the operational-and-content-free rule does not
govern them.** **Read before asserting; there is no finding here.**

### ✅ FIVE CLOSED BY THE OWNER BEFORE HE LEFT — `583c48a0b`, 2026-08-30

| Ruling      | What he said                                                                        |
| ----------- | ------------------------------------------------------------------------------------- |
| `CO-Q1`     | ⚠️ **REFUSED — no service-level patterns. Build nothing there**                       |
| `TR-D5`     | **The SENDING location ALWAYS organises transport. Never the receiving one**         |
| `TR-D6`     | **Cancel: the booking team + the coordinator. The receiving ward may NOT**           |
| `FD-30`     | **The REFERRER and the coordinator BOTH see a decline reason**                       |
| `CH-Q1`     | **Community-team derivation approved IN PRINCIPLE, deferred**                        |
| `WB-DB-23`  | ✅ **Away group keeps its patients as a LINE** — the safe reading, confirmed          |

> ⚠️ **`CO-Q1` is a REFUSAL, not an omission.** The data makes it trivial and **the reason it is
> refused is not technical**: it converts oversight into performance monitoring of named services.
> **Easy to add later, hard to un-see once shown.**

> **`TR-D5` answers more than was asked.** The question was whether one movement type raises a
> transport job; **he gave the general rule instead, so there is no movement type for which somebody
> must work out who books.** ⚠️ ***"Always"* is load-bearing: a future case that feels different needs
> its own ruling, not an inference.**

> ⚠️ **`FD-30` overrode a recommendation, and his answer was REQUIRED rather than merely broader.**
> `FD-24` already says a decline does not lock a ward out and an option to clarify remains — **and a
> referrer who does not know WHY cannot clarify anything.** Withholding the reason would have left
> that affordance **present and unusable.**

> **`Q1` — the two-clinician review — CLOSED by him:** *"close this two clinician review for now and
> mark as closed."* ⚠️ **Recorded as a decision to STOP SEEKING the evidence, not the arrival of it.
> His "for now" is kept.** **If any document ever reads as though the bed model is clinically
> validated, this closure has been recorded as its opposite.**

## ⚠️ THE ONE FINDING TONIGHT THAT IS ABOUT A CLINICIAN, NOT ABOUT THE CODE

**Verified in code by me, on `claude/ward-flow-phases-6-7-design`, after Ward Verifier saw it on
screen and Ward Referrals found the third instance.**

```
ward-priority.ts:31-35   1: "most urgent"   2: "urgent"   3: "least urgent"
display surfaces         "Tier 1 · most urgent"          <- spells it out
the three CHOOSERS       1        2        3             <- a naked digit
ed-screen.tsx:138        DEFAULT_DRAFT urgency: 3        <- the ED form opens on LEAST urgent
```

⚠️ **THE NATURAL READING OF A BARE `3` IS "MORE", AND HERE IT MEANS LEAST.** **A clinician raising a
referral for the sickest patient sees `3` already selected, reads it as the top of the scale, and
leaves it** — **filing the LEAST urgent referral for the patient who needs the bed most.**

> ⚠️ **AND THE OWNER'S RULING MADE IT WORSE RATHER THAN BETTER: urgency now OUTRANKS EVERYTHING in
> the queue. So the mistake does not just mis-tag the referral, it SORTS THAT PATIENT TO THE
> BOTTOM** — **and no screen anywhere contradicts it, because every DISPLAY surface faithfully
> renders the tier that was chosen.**

✅ **THE DEFAULT ITSELF IS DEFENSIBLE AND SHOULD NOT BE "FIXED" IN THE SAME BREATH.** **Opening on
the least urgent tier is the conservative non-choice — the software declining to escalate on the
clinician's behalf — and the line directly beneath it says so about the legal form:** *"The clinician
picks one; the software never picks one for them."*

> ✅ **THE DEFECT IS THE LABEL, NOT THE DEFAULT.** ⚠️ **Changing the default to `1` would make the
> software escalate for the clinician, which is a worse property than the one being repaired.**

**THREE call sites, one helper, one commit — `urgencyTierLabel()`, which SEVEN files already use:**

```
ed-screen.tsx:673        the RAISE-REFERRAL form      <- and it has NO data-testid
ed-screen.tsx:903        the urgency-CHANGE picker
shortlist-panel.tsx:649  the urgency-CHANGE picker
referral-intake.tsx:817  ALREADY CORRECT
```

### ⚠️ EVERY OTHER FIELD DEFAULTS TO A WORD. THE ONE THAT DECIDES THE QUEUE DEFAULTS TO A DIGIT

**Ward Verifier reloaded the form and read the defaults as a clinician meets them, untouched:**

```
Cohort        Adult
Security      Open
Sex           Female
Legal status  Voluntary
Legal form    No form
Urgency       3          <- and 3 is "least urgent"
```

⚠️ **READ AS A COLUMN, `3` IS THE ONLY ENTRY THAT CANNOT BE INTERPRETED WITHOUT KNOWING AN
UNWRITTEN CONVENTION** — **and the convention runs OPPOSITE to the everyday one, where a bigger
number means more.**

**Five readable words and one naked digit. The digit is the field that decides queue position.**
✅ **That is a stronger statement of the defect than "the picker lacks labels", because it needs no
argument about what a clinician would infer — the inconsistency is visible in the column itself.**

**Also confirmed live: the urgency select's `data-testid` is `null`.**

### ⚠️ AND THE THIRD ONE WAS INVISIBLE TO EVERY INSTRUMENT

**The raise-referral picker — the one a clinician actually uses at referral time — CARRIES NO
`data-testid`.** ⚠️ **Ward Referrals searched `ed-screen.tsx` for urgency testids, found only the two
change-pickers, and had *"there is no raise-referral urgency picker in this file"* half-written
before checking.** **It measured the LABEL and was about to conclude about the CONTROL.**

> ⚠️ **A CONFIDENT ABSENCE NEARLY REFUTED A TRUE REPORT** — **and only a live walk of the screen
> found it in the first place.** ✅ **The governing failure mode of this project, arriving in the
> place it does the most damage: the one urgency control a clinician uses at referral time is the one
> no test can address.**

**A second finding, small and real. The fix adds the missing `data-testid`.**
