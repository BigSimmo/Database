# Owner decisions — 2026-09-03: the patient link, and legal status on the ward arm

**Recorded by Ward Builder Two, at branch tip `18a85832d`, immediately after the owner answered.**

⚠️ **WHY THIS FILE EXISTS AT ALL.** Twice tonight a decision travelled between agents as a chat
message while the limit that governed it stayed unwritten. The first time, an approval to widen a
privacy rule arrived with the restriction that made it safe attached only to a message between two
chats — **if either chat had been replaced, what survived would have been the permission without the
limit.** This file is written so that cannot happen to these two.

**Both answers were given by the owner directly, to a question this chat put to him, with the
options and their consequences stated. Neither is a relay.** Another chat holding these as
"reported" rather than "given" is correct to confirm them with him rather than take them from here.

---

## Decision 1 — a referral pointing at a person who does not exist

**The question put to him, in full:** today, if someone mistypes the web address, the system
silently creates a referral attached to a person who is not on file. A very similar field elsewhere
in the same code refuses an id that names nothing, and says in its own notes that storing one is a
defect.

**His answer: REFUSE IT, VISIBLY.**

The option he chose said, verbatim:

> If the address names a person who isn't on file, the referral is refused with a message on screen
> rather than saved. Matches how the sibling field already behaves, and the patient list is
> available at that point so it's straightforward to check.

**He was offered, and did not choose:** storing it anyway with the reasoning written down; or
treating a bad id as though no person had been named.

### ⚠️ THE LIMIT, WHICH IS PART OF THE DECISION AND NOT A GLOSS ON IT

**There are THREE states here and the ruling only touches the third:**

| State                           | Behaviour                                                                | Status                                 |
| ------------------------------- | ------------------------------------------------------------------------ | -------------------------------------- |
| `patientId` absent              | Stored as `undefined`. The referral was raised without a person on file. | ⚠️ **A REAL CASE. Must keep working.** |
| `patientId` names a real person | Stored.                                                                  | Unchanged.                             |
| `patientId` names nobody        | **Refused, with a visible rejection.**                                   | ⚠️ **This is what changed.**           |

**A change that made an ABSENT id refuse would break the front door.** Refusing correctly and
refusing too much are indistinguishable in a green test suite, which is why the implementation
carries a second mutation proving an absent id still passes.

**Corroborated, not authorised, by Ward Lead**, which reached the same answer separately and on
principle — there is no clinical situation in which a referral legitimately points at a person who
does not exist. It stated openly that its own attempt to verify the sibling-field comparison had
failed, so its ruling never rested on that measurement.

---

## Decision 2 — legal status on the referral's ward arm

**Background.** The owner had already approved showing a patient's Mental Health Act legal status on
the **ward's arm** of a referral. Building it was stopped before a line was written, because
**nothing in the running app could ever have filled the field in**: the fact lives on
`Movement.legalStatus`, `Patient` carries no legal status, and `RECEIVE_REFERRAL` — the only event
that builds a referral — has no such field to carry one in. It would have passed every gate and
rendered as a blank meaning _"nobody has said"_ when the truth was _"nothing can ever say"_.

**The question was therefore put back to him reframed, and his answer: SHOW THE ONE THAT EXISTS.**

The option he chose said, verbatim:

> Don't create a new field. Connect the ward's arm of the referral to the legal status the emergency
> department already entered, and display that. One place per fact, which is your own rule. It's a
> bigger change than the ruling assumed, so I'd scope it and come back to you before building.

**He was offered, and did not choose:** adding a legal-status control to the referral form, which
would mean a clinician states the same fact twice with nothing to say which copy is right.

### ⚠️ WHAT THIS DOES AND DOES NOT AUTHORISE

- ✅ **Authorised: producing a scope assessment.** That is in progress.
- 🔴 **NOT authorised: building it.** The option he chose says in its own words _"scope it and come
  back to you before building"_. **The scope returns to him before any code is written.**
- 🔴 **NOT authorised: a second control on the referral form.** He was shown that option and did not
  take it.
- ⚠️ **The earlier ward-arm-only restriction still governs.** It was appended to
  `docs/ward-flow/owner-rulings-2026-09-02-staleness-and-legal-status.md` at `bbbc7aa36` after this
  chat found it was missing. This decision changes HOW the fact reaches the ward arm; it does not
  widen WHERE the fact may appear.

### ⚠️ THE SCOPE CAME BACK AND IT CHANGES THE QUESTION — READ THIS BEFORE ACTING ON DECISION 2

**The scope assessment found that "the ward's arm of a referral" names TWO DIFFERENT THINGS in this
codebase, and they are in opposite states.** The decision above was taken without that distinction
being visible, so **it does not yet settle what should be built.**

**Reading (a) — the board a ward already uses to accept or decline.** Legal status is **already on
screen there**, at `ward-screen.tsx:1247`, rendered beside cohort, security and sex. It comes
straight off `Movement.legalStatus`, which is a required field with real writers. **Nothing to
build. It is already correct.**

**Reading (b) — a ward looking at a referral addressed directly to it**, not routed through that
board. That screen does not exist: `wardScopedReferral()`
(`ward-referral-visibility.ts:222-249`) has **zero production importers**, and its own doc comment
says no ward-facing screen can render a referral today even if it tried.

🔴 **AND FOR READING (b) THE JOIN CANNOT DELIVER THE FACT FOR MOST REFERRALS.** The only existing
`Referral`→`Movement` join is `Movement.referralId` (`ward-model.ts:526`), written by exactly one
event, `RAISE_REFERRAL`, and **only for referrals carrying an emergency-department destination**
(`ward-flow-reducer.ts:800-807`). A referral addressed **only** to a psychiatric ward — the ordinary
single-destination bed request — **has no movement at all**, so there is nothing to join to.
**Legal status was never captured anywhere for those referrals.** No join can surface a fact that
was never recorded.

**A copy-through at referral creation is not merely unwanted, it is structurally impossible:** the
front-door referral form never asks for legal status. Neither `referral-intake.tsx` nor
`ward-referrals.ts` mentions it. Legal status is exclusively an ED-intake concept today.

**On privacy: the boundary guard would NOT fire for reading (a)** — `Movement` is not in the
forbidden vocabulary and `ward-screen.tsx` already reads movements legitimately. **It WOULD fire
immediately for a careless build of reading (b)**, because reaching the join needs the whole
`referrals` array in a ward-facing component, which
`tests/ward-referral-screen-boundary.test.ts:63-67` explicitly checks for. A derivation-layer join
inside `ward-referral-visibility.ts` survives the guard, because that module sits outside the
ward-facing subgraph.

**On staleness — a risk that turned out not to exist.** A derivation-layer join reads
`Movement.legalStatus` live at render, so a status amended by `CHANGE_LEGAL_STATUS` after the
referral was raised would show as the **current** one, never a stale one. Safe by construction.
**The risk is not staleness. It is absence.**

### 🔴 WHAT THE OWNER MUST NOW DECIDE — DO NOT BUILD UNTIL HE HAS

1. **Which screen did he mean?** If (a), the answer is "already done" and this closes.
2. **If (b): is a screen that shows a legal status for a minority of referrals and nothing for the
   rest acceptable?** ⚠️ **The clinical hazard is that a blank reads to a ward as "this person has
   no legal status" when the truth is "this fact was never captured here."** Those are different
   things and the screen cannot currently tell them apart.
3. **If that is not acceptable, then building this honestly needs a new capture point** — somewhere
   to record legal status when a referral is addressed straight to a ward. ⚠️ **That is exactly the
   "second control that can disagree with the first" he already declined.** So the honest position
   is that reading (b) may not be buildable within the rule he set, and he should be told that
   rather than shown a half-populated screen.

---

### 🟢 RESOLVED — the owner was asked again, with the two readings set out, and chose (a)

**Asked:** which of the two screens did he mean, given that one already shows the fact and the other
cannot for most referrals. He was shown four options, including building it blank-where-unknown and
adding a capture point.

**His answer: THE ACCEPT/DECLINE BOARD.** The option he chose said, verbatim:

> The screen a ward already uses to accept or decline a patient. Legal status is already displayed
> there, alongside cohort, security and sex. Nothing to build — I close this and tell Ward Lead it's
> already correct.

**So decision 2 is CLOSED and NOTHING IS TO BE BUILT.** `ward-screen.tsx:1247` already satisfies it.

⚠️ **He was offered, and declined, the option that would have shipped a half-populated screen** —
legal status where it happens to exist, blank otherwise. **That option was labelled with its clinical
hazard rather than presented neutrally**, because a blank a ward cannot distinguish from "never
asked" is the harm, not the missing pixels.

⚠️ **AND THE RECORD SHOULD SHOW THAT HIS FIRST ANSWER WAS NOT WRONG — THE QUESTION WAS.** He first
chose "join to the fact that already exists", which was the right principle. It could not be acted
on because "the ward's arm of a referral" named two screens and nobody had noticed. **A decision
taken on an ambiguous premise is not a decision that was made badly; it is one that was asked badly,
and the asking was mine.**

---

## What is NOT decided

- ~~Legal status on the ward arm~~ — **CLOSED above. Nothing to build.**
- **Whether this branch may be pushed.** The standing rule is that Ward Flow is never pushed and
  both branches exist on one disk only. A request to prepare a pull request reached Ward Lead
  through chat; Ward Lead has stopped, checked its own instructions, found the rule, and asked him
  to lift it in writing and name the branch. ⚠️ **Nothing has been pushed. A push is the only action
  taken tonight that none of us could undo.**
- **Whether to fetch the Next 16 trade-offs page** needed to weigh a fix across three components.
  It is not shipped locally, fetching it is provider-backed, and it needs his say-so.
