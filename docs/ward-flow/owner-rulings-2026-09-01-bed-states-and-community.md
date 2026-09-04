# Owner rulings, 2026-09-01 — bed states, coordinator scope, community referrals

Five questions, five answers, recorded the same evening. Where the answer was "yes to your
recommendation" the recommendation is written out in full below, because a bare "yes" in a
transcript is not a ruling anybody can act on six weeks from now.

---

## 1. A bed being cleaned does NOT reduce the ward's free-bed figure

**Ruled: yes.** The figure does not move while a bed is being made ready.

**⚠️ This settles a contradiction, and the losing side is the six-state list, not the ruling.** The
six states (Open, Pending, Pulled, Held, Occupied, Closed) treat Open and Pending as mutually
exclusive, which requires the free-bed figure to fall the moment cleaning starts. The owner's
reason for the opposite: **the ward has not changed what it can staff, so its figures should not
lurch as cleaning starts and stops.** Only the _pull_ is refused — a patient cannot be pulled into a
bed that is not ready, and that refusal is already built
(`ward-flow-reducer.ts`, `bedsPendingPreparation`).

**So "Open" is a count of beds the ward can staff and offer, and "Pending" sits beside it as its own
figure rather than being carved out of it.** They are not two slices of one total. Anything that
presents them as a partition of the ward's beds is wrong.

## 2. "Not flagged in the coordinators screen" — scope deferred until the surfaces are listed

**Ruled: yes, wait for the list.** Ward Builder Two is enumerating every place on the coordinator's
screen where a referral, or a figure derived from referrals, reaches the reader. The owner decides
with that list in front of him. **Nothing changes behaviour until he does.**

The reason the scope is open at all: the question put to him was about the **bed-matching queue**,
and he answered about **the coordinator's screen**. A referral can be absent from the queue and still
appear in a count, a recent-decisions list or a side panel.

## 3. ⚠️ A community referral is only for a patient about to be discharged, and they are Voluntary or on a Community Treatment Order

**Ruled, verbatim:** _"A community referral is only for a patient who is about to be discharged. They
will either be voluntary or on a community treatment order. Otherwise continue with your
recommendation."_

Two separate things follow, and only the first is new information.

**(a) Legal status IS knowable for a community referral, and it is one of exactly two values.**
Voluntary, or a Community Treatment Order.

**⚠️ THE MODEL CANNOT EXPRESS THE SECOND ONE.** `LegalStatus` (`ward-model.ts:117`) holds exactly
four values — `Voluntary`, `Referred for psychiatric examination`, `Detained awaiting examination`,
`Involuntary inpatient` — and a Community Treatment Order is none of them. The phrase exists in the
codebase only as an **examination outcome** (`community_order`, `ward-model.ts:520`), which is the
result of an ED examination and closes the movement without an inpatient bed. That is a different
fact from a person's standing legal status, and using one for the other would be wrong.

So this ruling requires a fifth `LegalStatus` member. It is a clinical model change, not a rename.

**⚠️ AND IT CARRIES A QUESTION THE RULING DOES NOT ANSWER.**
`requiresAuthorisedDestination(status)` in `ward-eligibility.ts` decides, from legal status alone,
whether a person may only go to an authorised destination. A CTO patient lives in the community by
definition, so the clinically obvious answer is _no_ — but "clinically obvious" is exactly how an
invented rule gets built, and this one is about where a person is legally permitted to be. **Put it
to the owner before wiring it.**

**(b) Observation needs stay unknown.** "Otherwise continue with your recommendation" — the system
does not know whether a person needs close observation when a referral arrives, so the field stays
blank until a ward assesses. It is never inferred from anything else.

## 4. Community teams are not grouped, because nothing honest can group them

**Ruled: yes, flat alphabetical, and do not add a field for now.**

A flat alphabetical list of all 65 teams, with a sentence on the page saying it is alphabetical
because the record holds a name and nothing else to group by.

**This corrects advice given earlier the same evening.** Ward Lead recommended grouping by health
service "exactly as the 23 wards already are". That is not possible: `CommunityTeam` is
`{ id, name }` and nothing more, its missing `region` field is documented as deliberate enforcement
(`community-derivations.ts:49-51`), the region-keyed table in `ward-teams.ts` is explicitly barred to
that code, and the id is derived from the name rather than authored. Grouping would mean either
reading a forbidden table or inventing a category — **and an invented category reads to a coordinator
as a real one.**

Revisit only when the placeholder team names are replaced with real ones, and only by giving
`CommunityTeam` a real field.

## 5. The box currently called "Held" becomes "Closed"

**Ruled: yes, Closed.**

It counts beds a ward is not offering — physically empty, deliberately unavailable. "Closed" says
that. This frees **"Pulled"** for what the owner defined it as: a bed allocated to a named patient
who has not yet arrived.

`Unit.held` therefore gets renamed as part of the bed-states work, and not before — the rename was
deliberately kept out of the hold→pull rename earlier the same day for that reason.

---

# Addendum, same evening — three further rulings

## 6. A Community Treatment Order carries no destination restriction, but it carries a phone call

**Ruled, verbatim:** _"No restriction.... but referral made as usual. Note, it must be discussed via
phone with another consultant, just add this somewhere if the patient is on a CTO"_

**(a) `requiresAuthorisedDestination` does not fire for a CTO.** The referral is made exactly as any
other. So the fifth `LegalStatus` member behaves like `Voluntary` for destination purposes.

**(b) ⚠️ A NEW REQUIREMENT, AND IT IS THE FIRST OF ITS KIND IN THIS MODEL: a CTO referral must be
discussed by telephone with another consultant.** Nothing in Ward Flow currently records a
conversation between two people. Every existing requirement is about a form, a state or a figure.

**This is a requirement about a HUMAN ACT, and it must not be modelled as a checkbox that pretends to
know the call happened.** The honest shape is a stated requirement the referrer sees, and — if
anything is stored at all — a record that somebody _asserted_ the discussion took place, attributed
and timestamped, never inferred. **Do not add a boolean called `consultantDiscussed` that defaults to
`false` and is set by the form's submit handler; that is the fifteen-fields defect with a new name.**

Where it lands is a design decision that has not been taken. The owner's words are _"just add this
somewhere"_, which is permission to place it, not a specification of the record.

## 7. Fix three of the fifteen fields, in the stated order

**Ruled: yes.** In order: the away-at-emergency-department badge that can never be cleared; the
`Movement.blocker` line that is written once and never updated; the urgent flag that nobody can set.
These are the three a coordinator would act on wrongly.

## 8. A journey never STARTS at a community team — but a community team can refer a patient IN

**Ruled: yes to dropping community-origin journeys** — every journey begins at an emergency
department, and the model's requirement that `Movement.originEdId` names a real ED is therefore
correct as built, not a limitation to remove.

**⚠️ AND THE OWNER ASKED THE FOLLOW-UP HIMSELF:** _"but a patient can be referred from the community
team. They are referred in.. so what should happen then?"_

The shape that follows from his existing rulings — recorded as the recommendation put to him, not as
a decision he has made:

1. **The community team raises a referral addressed to an emergency department.** This already exists
   in the model: `RECEIVE_REFERRAL` is role-gated to `["community"]`, and `RF-009` is exactly this
   record — an ED-only referral, purpose `psychiatric_review`. **⚠️ `FD-3` originally ruled that a
   referral to an ED is a NOTIFICATION, not a request — no acceptance affordance, nobody declines an
   ED — and THE OWNER SUPERSEDED IT ON 2026-08-30: every referral is declinable, and no code path may
   render a referral with no decline affordance.** The ED inbox's Decline control is built and
   dispatches as `"ed"` (`b41b1d815`), so this referral arrives declinable like every other one.
   **Nothing here licenses un-wiring it.**
2. **The patient physically attends that emergency department.**
3. **The ED doctor decides whether psychiatric admission is needed and raises the referral to
   psychiatry.** That act — not the community team's — is what starts the bed-seeking journey. This
   matches his earlier ruling: _"These patients will come to ED and if it is for psychiatry then ED
   medical doctors will refer to psychiatry."_

**So the community team's referral and the resulting journey are two linked records, not one — and
the link does not exist.** Nothing connects the referral that brought the patient to the ED with the
journey the ED subsequently starts. That is the front-door link (`Movement.referralId`), and it is
the same missing piece that has blocked three other queued items.

**The open question this leaves, which is his:** should the emergency department SEE the community
team's referral before the patient arrives — a heads-up on the ED screen — or is it only a record
that becomes visible once the journey exists?

---

# Addendum two — four more rulings, and one clinical fact that outranks the ruling it came with

## 9. The out-of-area board is NOT part of the coordinator's screen

**Ruled: yes, it is separate — leave it alone.** It answers a different question (who is being treated
far from home) rather than showing a coordinator what to work on.

**The ruling is correct and it was also moot, which is worth recording.** The question was put to him
on the strength of a claim that the out-of-area board consumes `recentlyDecidedReferrals`. It does
not: `out-of-area-board.tsx:12` imports `outOfAreaLedger` and a type, nothing else, and the only
occurrence of `recentlyDecidedReferrals` in that file is the doc comment at :29-31 saying _"it answers
a different question and must never be reached for here"_. **A grep matched the prohibition and it was
read as the call.** So the answer could not have changed the build either way.

## 10. ⚠️ A referral asking for BOTH a community team and a ward bed should never exist

**The recommendation put to him** was that such a referral still shows on the coordinator's screen,
because it is asking for a bed and hiding it would make a live bed request vanish. **He approved
it — and then said the thing that matters more:**

> _"Although.... a community referral would never be requested if a patient is needing a bed as
> community referral is for discharge"_

**That is a clinical fact about the world, and it outranks the display rule it arrived beside.** The
display rule is still right and still gets built — a referral that asks for a bed stays visible — but
the case it handles should not be reachable in the first place.

**And the model currently produces it.** `RF-007` (`ward-movements.ts:1301`) carries a
`community_team` destination in state `queued` **and** a `psychiatric_ward` destination in state
`accepted`, simultaneously. `referral-intake.tsx`'s destination-kind selector is a multi-select, so it
is reproducible at runtime and not merely a bad fixture.

**⚠️ Open decision, and it is the difference between two defensible readings of his sentence:**
_"clinicians would never do this"_ is not the same instruction as _"the app must refuse it"_. The
recommendation put to him is the second — a form that permits a combination that cannot happen will
eventually produce one, and a seeded example of it is already teaching the wrong shape. That means:
refuse it in `RECEIVE_REFERRAL`, stop the intake form offering both together, and correct `RF-007`.
**Not started until he confirms**, because correcting `RF-007` changes seeded state that other tests
and screens read.

## 11. An emergency department sees a community team's referral before the patient arrives

**Ruled: yes.** A heads-up on the ED screen, not merely a record that appears once the patient is
there. Knowing somebody is on their way is the whole point of one — **the ruling stands on that alone.**

**⚠️ THE RATIONALE PRINTED HERE UNTIL 2026-09-01 WAS FALSE, THOUGH THE RULING ABOVE IS NOT.** It cited
`FD-3` — _"a referral to an ED is a notification nobody declines"_ — which the owner had already
SUPERSEDED on 2026-08-30: **every referral is declinable, and no code path may render a referral with
no decline affordance.** `b41b1d815` then wired a working Decline onto the ED inbox, dispatching as
`"ed"`. **So a heads-up is not a read-only one, and read as current the old rationale was an
instruction to remove a control the owner asked for.**

## 12. The unclaimed branch is not Ward Flow, and nothing is deleted

**Ruled: leave it.** `claude/ward-builder-setup-5d5c92`, tip `058abf5e5`, is
_"Answer page: status chips above the answer, thumb verdicts below it (#2484)"_ — a different
project's work on a main-based lineage, and `git merge-base --is-ancestor` confirms it is not an
ancestor of the Ward Flow master line. The name is a coincidence. **Established by reading git rather
than by asking him**, and recorded here so nobody spends the question again.

---

# Addendum three — the community-plus-ward combination, and what is still unruled

## 13. The app must refuse a referral asking for both a community team and a ward bed

**Ruled: yes** — confirming ruling 10's recommendation. And separately, verbatim:

> _"No... i already noted that a community referral is never going to happen when a ward needs a
> referral."_

He notes he had already said it. `{psychiatric_ward, community_team}` **does not occur clinically.**

**⚠️ AND THE PRODUCT MANUFACTURES IT IN TWO CLICKS.** `referral-intake.tsx:184-189` builds
destinations from **one independent checkbox per kind**, walked over `REFERRAL_DESTINATION_KINDS`.
Nothing in the form or in `RECEIVE_REFERRAL` forbids ticking community and ward together. So this is
not a bad fixture the seed happens to contain — it is a shape the product creates on demand.

**The fix goes at the point of creation, not in every reader.** Ward Builder Two is the first
consumer that has had to decide what `{ward, community}` means; every later reader would face the
same decision and they would not all decide alike. One rule where the referral is made costs less
than a decision in every screen that reads one.

**Scope: the intake form stops offering both together, `RECEIVE_REFERRAL` refuses the combination,
and `RF-007` is corrected. Ward Lead owns all three** — they are outside both builders' paths.

## 14. ⚠️ RF-007 must be SPLIT, not trimmed

`RF-007` (`ward-movements.ts:1301`) carries `community_team "Inner City Clinic"` in state `queued`
alongside `psychiatric_ward` in state `accepted` with `acceptedUnitId "bty-youth"` — exactly the
combination ruling 13 forbids. It is committed, it renders today, and it is **the community hub's
only fixture**: its own comment says it exists because _"the community hub cannot be built against an
empty list"_.

**Do not delete the ward arm.** That arm is load-bearing for something else — the comment records it
as the seed's **only successful youth match** at `bty-youth`, added precisely because RF-001 is
unmatchable everywhere and nothing otherwise demonstrated the age dimension working. Deleting the arm
silently drops that coverage, and nothing would fail.

**Split it into two referrals**: one ward-only that keeps the youth match, one community-only that
feeds the hub. Both purposes preserved, the impossible shape gone — and the community-only one then
becomes a genuine fixture for the coordinator-visibility rule, which currently has none.

**Not while Ward Builder Two is mid-build.** A fixture moving under an implementer is worse than the
defect it fixes.

## 15. The new-referral form is NOT part of the coordinator's screen

**Ruled: yes, out of scope.** `waitFigure` (`referral-destination-options.ts:303-309`) filters at
addressing level and renders _"N referral(s) to this kind of destination are waiting for an answer"_
beside each destination checkbox on `/mockups/ward-flow/referrals/new`. Community is one of those
kinds, so the count includes community referrals — and it stays.

**Recorded as a decision considered and made, not as a surface nobody looked at.** That distinction is
the whole reason it was raised: an omission and a decision look identical six weeks later.

## 16. ⚠️ STILL UNRULED — a referral addressed to both an emergency department and a community team

**`{emergency_department, community_team}` has NOT been ruled on.** Ruling 13's sentence covers the
ward case only.

Under the `every` rule such a referral stays visible on the coordinator's screen, and that is probably
right by the DIRECTION criterion — an ED arm is upstream of the bed decision. **But that is an
inference, not a ruling**, and it is recorded here so the code's handling of it is not mistaken for a
settled decision by whoever reads it next.

---

# Addendum four — the destination table is complete

## 17. A referral naming both an emergency department and a community team stays visible

**Ruled, verbatim:** _"yes keep them visible in reference to question 1"_ — the question being whether
a coordinator should still see someone waiting for a psychiatric review in an emergency department
when a community team has also been asked to pick them up.

**So `{emergency_department, community_team}` stays.** It was recorded as unruled in addendum three
(§16); it is a ruling now, and nothing should still label it "assumed".

## 18. ⚠️ Every destination combination is now decided — the first time this table has been complete

| Combination                                    | Coordinator's screen                                     | Why                                                                                   |
| ---------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `{ward}`                                       | stays                                                    | upstream of the bed decision                                                          |
| `{emergency_department}`                       | stays                                                    | upstream — `RF-009`, ruled                                                            |
| `{community_team}`                             | **OUT**                                                  | downstream — the patient is leaving                                                   |
| `{ward, community_team}`                       | **RULED not to occur — ⚠️ THE REFUSAL IS NOT YET BUILT** | to be refused at the intake form                                                      |
| `{emergency_department, community_team}`       | stays                                                    | the upstream arm dominates                                                            |
| `{ward, emergency_department}`                 | stays                                                    | upstream                                                                              |
| `{ward, emergency_department, community_team}` | **RULED not to occur — ⚠️ THE REFUSAL IS NOT YET BUILT** | contains `{ward, community_team}`, which is itself only ruled out and not yet refused |

**⚠️ "RULED NOT TO OCCUR" MEANS CANNOT BE CREATED ONCE THE REFUSAL IS BUILT — NOT "DOES NOT EXIST",
AND NOT "CANNOT BE CREATED TODAY".** `RF-007` carries
`{ward, community_team}` today, and every referral raised before the intake refusal keeps whatever
shape it was given. **Data that predates a rule is an ordinary and permanent category**, not a
transitional curiosity, which is why the visibility rule must still handle the pair after the
refusal lands and why the guard test still earns its place. Ward Builder Two caught this reading;
the table above is about creation, and nothing in it is a claim about what the data holds.

**⚠️ Note what the last two rulings did to the `every` predicate.** With `{ward, community_team}`
refused at intake, the only mixed combination that can still exist is `{emergency_department,
community_team}` — and it stays. So `every(kind === "community_team")` gives the correct answer on
**every combination the product can now produce.** Not by luck and not as a heuristic: the reachable
space has been narrowed to exactly where the predicate is right.

**⚠️ AND THAT IS PRECISELY WHY IT IS DANGEROUS.** The predicate says _"all community"_; the principle
is _"all downstream"_. Those coincide only because `community_team` is currently the only downstream
kind. **A fourth destination kind that is downstream would break the rule silently**, and this table
is the thing that would have to be re-derived — by somebody who has no reason to know it exists.

**The fix is exhaustive classification with a `never` arm**: classify each destination kind as
upstream or downstream in one place, and let the compiler refuse a new kind until somebody says which
it is. That converts "re-derive this table" from a hope into a build error. Not built yet; recorded
here so it is not lost.

## 19. What ruling 17 does NOT settle

It is about a referral that names both destinations. **It says nothing about what the community hub
shows**, and nothing about a patient's community follow-up being visible on the community side. He
has ruled on one screen, and the ruling should not travel further than he sent it.

---

# Addendum five — the consultant discussion is STATED, never recorded

## 20. The CTO phone discussion is a requirement shown, not a fact stored

**Ruled: state it, do not record it.**

The referral form tells whoever raises it that a Community Treatment Order referral must be discussed
by telephone with another consultant. **The app never claims to know whether that call happened.**

**⚠️ The reason, and it is why a tickbox is refused rather than deferred.** The moment there is a
`consultantDiscussed` boolean, the screen shows _"discussed: yes"_ for patients where nobody made the
call — and it looks exactly as authoritative as a fact the app genuinely knows. That is the
fifteen-fields defect being created fresh rather than inherited, on the one requirement in this model
that is about a clinician's professional obligation.

**If it is ever recorded, the honest shape is an ASSERTION, not a state**: a named person saying, at a
named time, that they had the conversation — attributed, timestamped, never defaulted, never inferred
from anything else, and never set as a side effect of submitting a form. That is a larger piece of
work and it is worth doing properly rather than approximating.

## 21. The unclaimed branch was retired, with containment proved rather than assumed

`claude/ward-builder-setup-5d5c92` (tip `058abf5e5`) retired on 2026-09-01 on the owner's direct
instruction in the Ward Lead session.

**Nothing was lost, and the proof is one line rather than a count:** the branch tip and
`merge-base(origin/main, branch)` were the _same commit_, `058abf5e5` — the direct statement that the
branch was wholly contained in `origin/main`. Confirmed still reachable on `origin/main` afterwards.
It was Answer Page work (#2484); the "ward-builder" in the name was a worktree-naming coincidence.

**Three process notes worth keeping.**

**(a) `git branch -d` refused, and that refusal was not a warning about this branch.** `-d` checks
containment against the _current_ branch, and the Ward Flow master line is 185 commits behind
`origin/main`, so a commit wholly contained in `origin/main` still looks unmerged from here. The
force form was used with containment independently proved. **A safe-form refusal that is an artefact
of where you are standing is not evidence about the thing you are acting on.**

**(b) ⚠️ The request first arrived RELAYED, from a chat that had been blocked twice and asked Ward
Lead to run it instead. That was refused.** Not on the merits — every figure checked out — but
because an action that can be re-issued to whichever chat has not hit the block yet is not blocked at
all. It proceeded only after the owner gave the instruction directly in this session. This is the one
category where an altered relay cannot be recovered by noticing later.

**(c) The protection hook matches the COMMAND TEXT, not the action.** It fired on a `cat >>` that
merely _described_ what had happened, because the prose contained the words. Third time today. The
workaround is to write the prose through a file rather than inline — never to edit or disable the
hook, and never to soften the wording to slip past it.

---

# Addendum six — patient search is exempt

## 22. A patient with a community referral still appears when searched for by name

**Ruled: yes, they still show up in search.**

**⚠️ This is a NARROWING of ruling 2 ("the whole screen"), and it is the only one.** Patient search
sits on the coordinator's screen and the literal wording covers it. It is exempt anyway, on the
owner's word, and the reason is the distinction the wording could not carry:

**A queue is scanned; a search is interrogated with a name already in mind.** Suppressing from a
work list removes noise. **Suppressing from a search withholds the answer to a question somebody
explicitly asked** — a coordinator who types a name and gets nothing back concludes that person is
not in the system, when they are, with a live community referral. That is a person made invisible by
a rule whose whole purpose was tidying a bed queue.

**It is also the only reading consistent with ruling 15**, which exempted the intake form's wait
figure because it is _context for the person filling the form in, not a patient placed in front of
them as work_. A search result is that same category. Applying the rule to search but not to the
intake figure would leave a boundary nobody could explain.

**And `searchPatients`' existing queued-only filter is answering a different question.** Its own
comment says it exists so there is no _"search hit for somebody who is no longer in the system"_ — it
filters for **staleness**, not for relevance to bed-matching. Wiring the direction rule into it would
change what the filter is FOR, not merely what it matches.

**Concretely: `ward-derivations.ts:892` stays exactly as it is.** The projection is not wired there,
and the call-site work covers the referral board, the network screen and the morning rollup count
only. Recorded so that a later reader does not "finish the job" by wiring the one call site that was
deliberately left.

**Credit where it belongs:** Ward Builder Two raised this against its own rule, and flagged that the
literal ruling covered it rather than quietly exempting it.

---

# Addendum seven — what "every ward said no" counts

## 23. "Every ward said no" means every ward that was ASKED

**Ruled: every ward that was asked.**

Not every ward that could have taken the patient. The two are very different events and a coordinator
would read the same number for both.

**⚠️ THE WORDING ON SCREEN IS PART OF THE RULING, NOT A PRESENTATION CHOICE.** `PARALLEL_REFERRAL_CAP`
is 3, so **a referral declined by three wards and never sent to the other twenty is the NORMAL case**
— not a patient the state refused. A figure labelled _"referrals nobody would take"_ over a count of
_"referrals every ward we asked declined"_ is the stronger claim wearing the weaker claim's data, and
it is the sort of number that gets quoted outside the room it was computed in.

**So the label carries the qualifier: every ward that was asked.** The figure must never be presented
as "nobody in the state would take them" — that is a different and bigger measure, and it would need
the model to know which wards were eligible but never approached, which it does not.

**Why the owner's choice is also the only honest one available:** it is the only version the app can
count today. The other would be a proxy wearing the name of the thing.

---

# Addendum eight — the rename, and follow-up after discharge

## 24. The in-flight record is renamed to BED REQUEST

**Ruled: yes, rename it.**

Two different records are both called a _referral_:

- **`Referral`** — the front-door record. Somebody asks. It states criteria and names no ward.
- **the in-flight record** — a patient put forward to particular wards for a bed
  (`Movement.referredUnitIds`, rendered as _"Parallel referral: <ward>"_). It names wards.

**⚠️ This has already cost real time and produced a wrong result that looked right.** A chat spent an
hour applying the coordinator-screen ruling to the wrong one of the two, and every step of it read as
correct — because `coordinator/**` renders the in-flight record, and the ruling was about the
front-door one. Two records, one word, and nothing to tell them apart at a glance.

**The in-flight one becomes a BED REQUEST.** It is the more accurate name of the two: it is a request
for a bed, addressed to named wards, which is exactly what the front-door referral is not.

**⚠️ DO IT BEFORE ANY STATISTICS FIGURE CARRIES THE WORD.** A figure labelled _"referrals"_ that
silently counts one of the two is the number that gets quoted outside the room it was computed in.
Renaming is cheap now and expensive the moment a figure is named after it.

### ⚠️ How this rename must be done, because two renames have already gone wrong today

- **A half-landed rename passes the entire suite.** Rename the union member and leave one stale
  `case` and the branch returns `undefined`, the expectation map keyed by the old name also returns
  `undefined`, and `undefined === undefined` passes. **Only `tsc` sees it.** Run the typecheck
  separately and report its exit code; vitest runs no typecheck.
- **`tests/ward-*` excludes every browser test.** The hold→pull rename shipped with the screen saying
  one thing and its Playwright test asserting another — invisible to 1,696 passing tests and a clean
  typecheck. **Grep `tests/ui-*.spec.ts` for every rendered string that changes.**
- **Prefer an exhaustive `switch` with no `default`** over a lookup keyed by name, wherever the
  rename touches a fixed set. That converts a half-landed rename from a silent pass into a compile
  error — which is exactly how the `left` → `departed` collision was caught.

## 25. Follow-up may be recorded AFTER discharge, not only at it

**Ruled: yes, after discharge as well.**

**The reason it matters, and it is not convenience.** The community team's page lists people who have
**already** been discharged. If follow-up could only be recorded at the moment of discharge, every
patient discharged before the feature existed could never gain a record — so that page would show
_"not recorded"_ permanently, for a population that never shrinks. The third state would be a verdict
on the past rather than something anyone could act on.

It also matches practice: follow-up is often arranged after somebody leaves, not in the same
conversation.

**So the writer event targets an admission, not a discharge moment**, and a record can be added or
revised later. **The three outcomes stand** — `arranged`, `not_arranged`, and **nothing recorded** —
and the third must stay distinguishable from the second. `not_arranged` means somebody looked;
`null` means nobody has.
