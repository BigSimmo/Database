# The referral front door — design and plan

**The screen where a patient enters the system.** Used by a community mental health clinician
deciding someone needs admission, and by a psychiatric doctor seeing a patient in an emergency
department. It is the first screen in the project's foundation and the one most worth getting right.

## The foundation this serves

> **Owner, 2026-08-29: the core principle is patient flow from the emergency department to the wards.
> Everything is built on it.**

This screen is where that flow starts. **The test for every decision below:** does it help a person
get from an emergency department to a ward, or help someone see why that is not happening?

---

## 1. What the owner corrected, and why it simplifies everything

Two answers from the owner reshaped the model. Both are recorded here because the design that
preceded them was more complicated and wrong.

### An "ED referral" is a psychiatric doctor seeing a patient IN the emergency department

**Ledger `FD-1`.**

Not a department referring outward as a separate front door. **The most common case in the whole
system** is a psychiatrist assessing someone already in an ED and deciding they need a bed.

So there are not four referral types. There is one act — *this person needs to go somewhere* —
raised from two places:

- **From the community**, by a clinician who has decided someone needs admission.
- **From inside an emergency department**, by the psychiatric doctor who has just assessed them.

### A referral to an ED lands on that ED's board, and the referrer can see it there

**Ledger `FD-2`.**

**Owner:** *"if a patient is referred it will show in the ED board of patients for that ED. Referrers
will be able to see the current patient if they have been referred to ED. They then decide if that
patient needs to be on referred to the wards."*

This answers the "what do I get back?" question without building a tracking screen. **The referrer
does not get a receipt — they get their patient, visible, on the board of the place they sent them
to.** The ED then makes the next decision.

**A consequence worth stating.** A referral to an ED is a *notification*, not a request: nobody says
no to an emergency department. A referral to a ward IS a request, and can be declined. **These are
different acts wearing one word**, so the form offers no "will they accept?" affordance on the ED
path — see **FD-3**.

### The resulting shape

```
COMMUNITY CLINICIAN                    PSYCHIATRIC DOCTOR IN AN ED
        |                                        |
        |  destination: ED  (most common)        |
        +--------------> ED patient board <------+  (already there)
        |                        |
        |                        |  assessed: needs a bed
        |  destination: ward     |
        +------------------------+--------> bed request -> coordinator -> ward
```

**One person, one record, one clock**, from the first referral to the bed. The record's destination
changes; it is never replaced by a second record, because two records mean the same person appears
twice on the coordinator's board and the waiting clock restarts — hiding the wait this system exists
to reveal.

**Out of scope, deliberately: the community mental health team as a destination.** Owner's decision.
It is offered and recorded, and says plainly that the path is not built.

---

## 2. What is wrong with the two forms today

Measured by two read-only passes over the built code, not asserted. Every claim below was read from
source.

### The finding that outranks the rest: every field arrives pre-answered

`initialDraft()` seeds all nine fields with valid values. **One tap sends a complete referral** —
Adult · Female · Perth Metropolitan · Community · Tier 2 · Royal Perth · no secure bed · no
involuntary bed · no transport. Every value is a legal member of its list, so the reducer's six
membership checks pass. **The system cannot tell a default from an answer.**

The consequence is the worst shape available. Age band is matched by **plain equality**
(`unit.cohort === referral.ageBand`) — the pattern this project forbids everywhere else — so one
wrong age band **eliminates all 23 units at once**, and the coordinator reads twenty-three
individually plausible per-unit refusals instead of "this question was never answered".

**One field was thought about, and that makes it worse rather than better.** `urgency` carries a
comment in the same function: set to neither the most nor the least urgent tier because *"a blank
form must never read as an assumption about how urgent this particular request is."* Read at both
branch tips 2026-08-29 — the reasoning is exactly right, and it was applied to the one field the
author was looking at. **Age band, sex, home region and origin site all silently take option zero,
and those are four of the five person-facts a referral is allowed to carry.** So the fix is not to
introduce a principle; it is to finish applying one the codebase already states.

And the boundary is undefined: nothing states where Adult ends and Older adult begins. A community
clinician who has known someone for years and an ED doctor reading a triage sheet can both answer
honestly and differently about the same 64-year-old.

### The two forms are different screens asking different questions

Only **sex** and **urgency** appear on both — and urgency renders as worded tiers on one and bare
numbers on the other, defaulting to 2 in one and 3 in the other.

| Only on the community form | Only on the ED form |
| --- | --- |
| Home region · Referral source · Origin site · Needs a secure bed · Needs an involuntary bed · Transport needed | Security · Legal status · Legal form · Specialling required |

**They do not even write the same record.** The community form creates a `Referral`. The ED form
creates a `Movement` — skipping the referral concept entirely. Two front doors, two record types,
never meeting, recording overlapping facts in different words.

### Six defects, each verified

1. **Tapping Send twice creates two referrals** with no visible difference. No draft reset, no
   re-entry guard.
2. **No way to withdraw or amend.** The only exit is a coordinator decline, and none of the six
   decline reasons means "the referrer withdrew it" — so correcting a mistake requires recording a
   false refusal. This project already ruled the identical pattern a defect once, when a coordinator
   had to declare a patient did not need admission in order to release a wrongly held bed.
3. **The ED form silently swallows failures.** It resets and collapses whether the reducer accepted
   or refused. The clinician believes it sent.
4. **A reload loses the referral itself**, not merely the half-filled form — nothing persists.
5. **Three of nine fields are displayed on no screen.** `source`, `originSiteCode` and
   `transportNeeded` are written to the record and rendered nowhere in the application — roughly six
   taps, including a 17-item wheel, for values a referrer never sees again. **This is a reason to ask
   whether the referrer should be asked for them. It is NOT a reason to remove them** — see R3.2;
   `originSiteCode` alone is named in 10 test files and 7 source files.
6. **Two ED option lists are hand-typed** rather than read from the model — the exact pattern that
   previously caused a picker to silently omit an option.

### The phone, computed from the stylesheet

**Tap targets pass and must not be touched** — 48px throughout, correctly above the repo's floor.
What fails:

- **The answer is smaller than the question.** Labels 14px bold; the values a referrer must verify
  before committing are 12px regular. The governance banner is 45 words at 10px — a size
  `globals.css` itself calls unreadable at any density.
- **Send is never on the first screen at any phone size** — roughly 1,124px of content in a 788px
  window; two flicks on a small handset.
- **On success the button moves out from under the thumb**, because the confirmation renders *above*
  it and nothing scrolls.
- **Success is silent to assistive technology.** Failure carries `role="alert"`; success carries no
  role at all.

---

## 3. The design

### Principles for this screen

1. **Nothing is answered for the clinician.** A default is a wrong answer nobody chose.
2. **Destination first.** Where the person is going changes what is worth asking.
3. **The phone is the design target**, for a community clinician away from a desk. The desktop
   follows; the reverse never works.
4. **Every field is read somewhere**, or it does not exist.
5. **The loop closes on this screen** — the referrer leaves knowing what was sent and where to watch
   it.
6. **No free text, no diagnosis, no invented legal figure, no ranking of a person.** Unchanged and
   not negotiable.

### The form, in order

**Step 1 — Where is this person going?** Three choices: *an emergency department* · *a ward* ·
*a community mental health team*. The third records the destination and says the path is not built.
This is the only question with no default, asked first, because everything after it depends on it.

**Step 2 — Who they are.** Age band · sex · home region. Three questions, none pre-answered, each
with an explicit *not known* where not knowing is a real clinical state (home region certainly;
sex → **FD-4**, which leaves that one named and open).

**Step 3 — What they need.** Secure bed · a bed that can hold someone involuntarily · specialling.
The involuntary question gains a third state — *yes / no / not yet known* — because the model's own
comment says the answer is often unknown until examination, and an unticked box currently means "no".

**Step 4 — How urgent.** Worded tiers, identical wording in both entry points, no default.

**Step 5 — Legal status and form.** Optional, last, and only offered when it is knowable. Community
clinicians often know it and currently cannot record it; they sometimes do not, and the form must not
force a guess.

**Nothing is removed.** An earlier draft removed origin site; that was wrong and is corrected in
R3.2. It stays on the record and stays on the form, unanswered by default like everything else —
though "for a clinician in someone's living room the honest answer is none" remains a real problem
with the question, and is a separate decision. **Surfaced rather than removed:** referral source and
transport needed both move onto the queued row on the coordinator's board, where they answer real
questions — a 2am police referral reads differently from a routine community one, and a bed with no
transport is not a completed transfer.

### What the referrer sees as they fill it in

**The matching arithmetic the system already does, applied live.** Not a prediction, not a
recommendation, not a score — the same "N of M units accept this referral right now" sentence the
match view already carries, updating as fields are answered. It is a fact about beds, never a
judgement about the person.

**On the ED destination, ED pressure instead** — how long that department's queue is. Shown, never
recommended. Sending someone to a department without knowing is what this system exists to prevent.

### What happens after Send

1. The form clears and shows **what was sent**, with the referral's identifier.
2. **A link to where it now lives** — the ED's patient board for an ED destination, the referral
   board for a ward.
3. **Announced to assistive technology**, the way failure already is.
4. **The message renders below the button**, so the control does not move out from under the thumb.
5. **Send is inert while a submission is in flight**, so a double tap cannot create two referrals.

---

## 4. Four further decisions, approved on recommendation

**Ledger `FD-3` to `FD-6`; the two owner statements above are `FD-1` and `FD-2`.**
The ledger holds identity and status; the reasoning lives here.

**Approved by the owner 2026-08-29 as "go ahead with other recommendations also".** Recorded as
decisions rather than questions, and flagged here so any one of them can be reversed by saying so —
each is written to be reversible on its own, without disturbing the others.

**FD-3 — A referral to an ED is a notification, not a request.** Nobody declines an emergency
department. So the ED path carries **no acceptance affordance at all** and an ED-destined referral
**does not enter the coordinator's queue** — it lands directly on that ED's patient board, where the
referrer can see it. A queue implies a decision that nobody in the real system makes, and showing one
would teach a visitor something false about how the pathway works.

**What would falsify FD-3, written down so it can be checked rather than defended:** if any emergency
department can refuse a patient, for any reason, the acceptance affordance has to exist and this
decision is wrong. **Neither I nor any other session can settle that — it needs a clinician**, and it
belongs in the deferred clinician check rather than in an argument between agents.

**FD-4 — Sex is not widened inside this work.** It has no honest answer for someone unconscious,
non-communicative, trans or intersex — a case an ED meets often — but `Unit.sexMix` is keyed by it and
the ward bed model depends on it. **The decision is named and left open, deliberately**, rather than
discovered later inside a ward change. The form does not pre-answer it and does not paper over it.

**FD-5 — A referrer can withdraw their own referral.** Correcting a mistake currently requires a
coordinator to record a false decline, because none of the six decline reasons means "the referrer
withdrew it". A withdraw act, raised by the referrer, distinct from a decline, and visible as a
withdrawal on the board. **This is the same fix this project already made** for a bed held wrongly,
where releasing it required declaring the patient did not need admission.

**FD-6 — Persistence stays out of scope here.** A reload loses the referral itself, which is a
prototype-wide gap and not this screen's to close. Recorded so it is not mistaken for an oversight in
this work; it needs its own decision because it affects every screen.

---

## 5. The tasks

Batched by file and by review. **One reviewer per phase**, plus one whole-branch review — per
`PROC-1`. Model tier per task follows the standing rule: the first task of a shape sets the pattern
and takes the stronger model; later instances of that shape follow it.

### Phase R1 — The model can express the journey *(serial, one task)*

**R1.1 — Destination, and one record that continues.** Add the destination to the referral record and
to `RECEIVE_REFERRAL`; make the ED's psychiatric assessment raise a referral rather than a movement,
so both doors produce one record type. Widen the structural privacy test **deliberately**, in the same
change, the way `Referral` was widened before.

**R1.2 — An ED-destined referral lands on that ED's board, not in the coordinator's queue** (FD-3).
The coordinator's queue keeps only ward-destined referrals; the ED board gains referrals inbound to
it, alongside the patients already there. The referrer sees their patient on that board.

*Anticipated: the structural privacy test pins the exact field set and will go red — that is correct
and it must be widened on purpose, never loosened. `RAISE_REFERRAL` currently creates a `Movement`;
changing that touches the coordinator's board, so re-read it. And the reducer's membership checks must
gain the destination, or a referral with no destination becomes legal.*

### Phase R2 — Nothing is answered for the clinician *(START HERE)*

**This runs first, ahead of R1.** Two independent reasons, and it is worth having both. **Value:** it
is the change that alters what a coordinator sees. **Availability:** it is the only phase that is
actually unblocked — `referrals/referral-intake.tsx` has zero commits on either branch since their
merge base, contested by nobody, while R1 touches `ed-screen.tsx` behind a three-deep chain (DB-18,
then `ward-screen.tsx`, then convergence). Verified by the Phase 8 session rather than assumed.

**R1 is plumbing and can follow whenever its chain clears.**

**R2.1 — No defaults, and Send is unavailable with a stated reason until every required field is
answered.** An unanswered sentinel lives in the form's own draft state only; the event, the record and
the reducer are untouched. `aria-disabled` plus an inert handler plus a stated reason naming which
fields remain — never native `disabled`, which removes the tab stop.

**R2.2 — SPLIT, because half of it needs a model decision nobody has made.** Phase 8 found this
before building and the split is its recommendation, adopted.

- **R2.2a, build now — both booleans become unanswered-by-default.** That removes "an unticked box
  reads as a definite no" **with no model change at all**, which is the whole clinical point.
- **R2.2b, named and left open beside FD-4 — a *sending* "not known".** It cannot be built as I wrote
  it: a sent "not known" needs `involuntaryBedNeeded` to stop being a `boolean` (the eligibility gate
  reads it), and needs an eleventh `HOME_REGIONS` member — which `ward-teams.ts` makes a **deliberate
  compile break so that a human decides.** **Neither adds a field, so both pass the letter of "five
  person-facts and nothing else" while failing its intent.** FD-4's reasoning applies to both
  unchanged: name the decision rather than discover it later inside a ward change.

### The trap that would silently destroy the proof refusals surface

**`originSiteCode` must NOT use `""` as its unanswered sentinel.** Found by Phase 8's agent, verified
here. `ward-referral-screens.dom.test.tsx:289` provokes a **genuine reducer refusal** by setting that
select to a value with no matching option, which leaves the DOM's resolved value at `""` — so
`siteByCode("")` resolves to nothing and `RECEIVE_REFERRAL`'s membership check refuses the event.

**If `""` becomes the unanswered sentinel, Send goes inert, the reducer is never reached, and the only
proof that intake refusals surface is destroyed — while the test still passes for a different
reason.** That is the worst available failure: a guard that has quietly stopped guarding and reports
green. **Choose a different sentinel for that field**, and say why in the commit.

*Anticipated, and named because it will look like a failure — all of it verified on
`claude/ward-flow-print-fixes` rather than predicted:*

- **`ward-referral-screens.dom.test.tsx:279`** — *"submits a well-formed referral with no rejection"* —
  clicks submit at line 282 having changed nothing. **It is the clearest statement anywhere of the
  defect: a form that submits successfully with no input.** It goes red, and that is the change
  working.
- **The structural pin is TWO half-pins, and I cited the wrong one.** Phase 8 opened the file after I
  cited `:132` from its title and it relayed my citation without opening it either — both of us
  passing along a claim about a file neither had read.
  - **`:132`** *"renders exactly one control for every field the model permits, and nothing else"* —
    **its title is a stronger claim than its body.** It iterates `EXPECTED_FIELD_TESTIDS` and asserts
    testid uniqueness. **It catches a field REMOVED. It does not catch one added**, which is the
    half its title promises.
  - **`:264`** `expect(screen.getAllByRole("combobox")).toHaveLength(named.length)` — **this is the
    addition pin**, and its own comment says so: *"a seventh picker added later without a name is
    caught rather than simply going unlisted here."*
  - **R2 moves both.** Widen each deliberately and in the direction it guards; never relax either.
- **`tests/ui-ward-referrals.spec.ts`** — the browser journey, which submits the same way.
- **Six option-list tests** (`:159` `:166` `:173` `:180` `:187` `:194`) assert `optionValues(select)`
  equals the runtime array **exactly**, so **any placeholder "unanswered" option reddens all six.**

**So R2's realistic breakage is nine tests, not three.** My original estimate was three; Phase 8
counted. **Anyone expecting three will think something has gone wrong**, and the difference between
"expected red" and "unexpected red" is the whole reason to write the number down.
- **`ward-referral-screens.dom.test.tsx:149`** — *"has no free-text input of any kind anywhere on the
  form"* — must stay green throughout. It is the hardest constraint in the project.

*None of these are wrong today. They are pinned to behaviour being deliberately removed, and the
distinction has to be stated in the commit or the next reader reads a weakened guard.*

### Phase R3 — One form, two entry points *(serial after R1)*

**R3.1 — Merge the two forms.** Destination first, then the five steps. Every option list read from
the model, including the two currently hand-typed. One wording for urgency, one label for age band.
**R3.2 — Fields that earn their taps.** Surface source and transport on the coordinator's queued row,
where a 2am police referral reads differently from a routine community one and a bed with no
transport is not a completed transfer.

**Origin site is NOT removed. My earlier recommendation to remove it was wrong** — found by checking
the plan against the code rather than by anyone objecting to it, and corrected here because the
builder would otherwise have hit it as a red suite. Verified on `claude/ward-flow-print-fixes`:

- **`ward-referral-screens.dom.test.tsx:180`** asserts the form *"offers every real network site as
  an origin option"*, and its siblings name their own purpose as **"the four-time defect class this
  phase keeps hitting"**. Removing the field means deleting a guard that protects a defect which has
  recurred four times. That is the exact resolution shape this project was burned by in the fold —
  removing a field and the assertion requiring it together, leaving a green suite that is wrong.
- **`ward-referral-screens.dom.test.tsx:298`** changes `originSiteCode` to provoke the rejection path;
  the "does not swallow refusals" test is built on it.
- **`ward-board-derivations.ts:109`** writes it.
- **`ward-distance.ts:35`** carries a comment recording that distance is *never* taken from it —
  *"that is the hospital the referral came from"*. Deleting the field orphans a recorded decision and
  the next person re-derives it.

**The real count, measured rather than sampled: `originSiteCode` is named in 10 test files and 7
source files.** I reported two tests. The full set includes `ward-travel-bands`,
`ward-travel-grouping`, `ward-network-referral-placement`, `ward-referral-matching`,
`ward-morning-rollup`, `ward-board-derivations` — and `ward-legal-figure-guard.test.ts`, which is the
Mental Health Act figure guard, the one thing in this project that must never be disturbed casually.

**"Displayed on no screen" is not "safe to remove".** Ten test files going red at once is the only
reason this would have been caught — and being caught loudly by the suite is not the same as being
caught by the plan. It stays, unanswered by default like every other field. Whether the referrer should be asked for it at all is a real question and it is not this
work's to settle.

### Phase R4 — The loop closes *(parallel with R3's second half)*

**R4.1 — Confirmation that shows what was sent, with the identifier and a link to where it now
lives.** Clear the draft. Announce it. Render it below the button.
**R4.2 — Send is inert in flight**, so a double tap cannot duplicate.
**R4.3 — The ED form stops swallowing failures.**
**R4.4 — A referrer can withdraw their own referral** (FD-5), distinct from a coordinator decline and
shown as a withdrawal, so correcting a mistake never requires recording a refusal that did not happen.

**Name collision to avoid: `withdrawnReferrals` is already taken and means something else.** It is a
field on `Movement` (`ward-flow-reducer.ts:487`) recording referrals withdrawn when a patient is
admitted elsewhere — a consequence of an admission, not an act by a referrer. **There is no
referrer-withdraw event in `ward-flow-events.ts`**, so FD-5 is genuinely new; it just must not borrow
that name, or two different things become one word and no test will notice.

### Phase R5 — Live answers while filling *(after R3)*

**R5.1 — ED pressure on the ED destination.** A fact, never a recommendation: sending someone to a
department without knowing its queue is what this system exists to prevent.

**Dropped: the live acceptance count.** It was in an earlier draft of this plan and the Phase 8
session was right to argue it out. **It would be a second surface answering a question the match view
already answers, in wording that can drift** — and this project has treated exactly that as a defect
every other time it has appeared. Introducing one deliberately, for a number that is not needed to
send a referral, is not a trade worth making.

### A claim collision to settle before R1 starts

**`ed-screen.tsx` is wanted by two pieces of work and held by neither.** Phase R1 changes what the ED
screen raises; ward-board decision **WB-DB-18** removes `<ClinicalRail />` from the officer, ED and
ward screens. DB-18's build is deliberately held because it also needs `ward-screen.tsx`, which the
board session has already changed — building two of three would cause exactly the drift its own build
note warns about.

**Order agreed with the Phase 8 session: DB-18 first, R1 follows.** A re-read is cheaper than a
re-decision — R1 absorbing a changed `ed-screen.tsx` costs reading it again, whereas DB-18 absorbing
R1's rewrite of what that screen raises costs re-taking a decision the owner already made.

**And the order has a discharge condition, because otherwise it becomes permanent by accident.**
DB-18 is blocked on `ward-screen.tsx` being uncontested, which resolves only when the board branch
converges with the merged line or the owner decides Ward Flow runs two lines indefinitely — a
decision that is with him now. **If he keeps two lines, DB-18 could sit blocked for some time, and
R1 must not wait on it indefinitely.** Revisit the order at that point rather than honour it past
the point where it costs more than it saves. Read in three days without this paragraph, "DB-18
first" is a rule nobody can discharge.

### Phase R6 — Look at it *(serial, last)*

**R6.1 — Render and look**, at 390 / 820 / 1440 and print. Fix the inverted type scale so the answer
is at least as prominent as the question, and the 10px banner.
**R6.2 — One reliability pass** — focused tests through the work, then the full suite, lint,
typecheck and a production build once.

---

## 5b. Wiring — how the page is actually reached, and what it changes on screen

**Added after the owner asked whether the plan covered building AND wiring. It did not.** Four things
were underspecified; three are answered here and one turns out not to exist. Every claim below was
read from `claude/ward-flow-phases-6-7-design`, not assumed.

### The two entry points are a route and a mount, not two routes

**What exists today:**

- The community form is a **route**: `WARD_REFERRAL_INTAKE_HREF = "/mockups/ward-flow/referrals/new"`,
  declared in `ward-nav.ts` and rendered by one page.
- The ED form is **not a route**. It is an in-place `<section aria-label="Raise a referral">` on the
  ED screen, holding its own `<form data-testid="ward-ed-referral-form">`.

**So the merge is: the ED section mounts the shared component in place, and the community route keeps
rendering it.** One component, two mount points, no navigation change.

**Why in place rather than sending the ED clinician to the route — and it is a clinical reason, not a
technical one.** The ED psychiatrist is looking at their own department's patient list when they
decide someone needs a bed. **Navigating away costs them the list they are reasoning from.** The
community clinician has no such context to lose, which is why a route is right there and wrong here.

**And the fourth gap disappears because of this.** No new page route is created, so the repo's
orphan-route gate, `npm run docs:update` and a reachability assertion are **not triggered at all**.
Had the ED entry been built as a second route, all three would have applied. **Worth stating because
the cheaper design is also the one that avoids a gate, and that is not a coincidence — a second route
to the same form would have been a second place for one fact.**

### What the ED board gains — extend the existing section, never add one

**The section already exists.** `<section aria-label="This department's patients">` on the ED screen,
fed by:

```
movements.filter(m => m.originEdId === thisEdId && !m.closure && m.stage !== "arrived")
```

**R1.2 widens that source to include referrals whose destination is this ED**, so an inbound referral
appears in the department's own list alongside the patients already there. **That is the whole of
FD-2 on screen**, and it is an extension of a list, not a new surface.

**Two things it must not become.** Not a separate "incoming referrals" panel — that re-creates the
inbox this system exists to replace, and puts one person in two places. And not a row that looks
identical to an arrived patient: **a referral inbound to an ED is a person who is coming, not a
person who is here**, and the row must say which.

**And the distinction must live in something a TEST can read, not only in copy a person would
notice.** Phase 8's addition, and it is the difference between a rule and a wish: if "coming" versus
"here" exists only as a sentence in the row, **the next refactor flattens the two rows and every
assertion stays green.** A distinct `data-testid`, a distinct role, an attribute — something an
assertion can bind to. **This branch has hit that defect class thirteen times**; it does not need a
fourteenth in the surface built to be the honest one.

### Where the confirmation link goes

**Both destinations, and both hrefs come from `ward-nav.ts` — never a hardcoded string, never a raw
`<a>`:**

- **Destination ED** → that ED's own screen, where the referrer will now see their patient.
- **Destination ward** → the referral board, where the coordinator's queue holds it.

### The promise in FD-2 currently rests on something that is scheduled to change

**FD-2 says the referrer can see their patient on the destination ED's board. That is true today only
because roles are not real.** Anyone can open any role's screen: the selector changes copy and sort
order, and **no control anywhere is gated on it** — audited 2026-08-29.

**Task 15 makes roles real, and at that moment this promise either survives deliberately or breaks
silently.** A community clinician looking at an ED's patient list is a reasonable thing to allow and a
reasonable thing to forbid, and **nobody has decided which.** It is not this work's decision — but it
must not be discovered by Task 15's author as a surprise. **Phase 8 is carrying it to the owner with
two other questions it already owes him**, so it goes as one ask rather than a fourth.

### And a distinction that may make a restrictive answer cheap

**Phase 8's point, and it is worth stating carefully so it does not quietly rewrite what the owner
said.** These are different claims:

1. **"A referrer sees their patient on the destination ED's board."** — the owner's own words:
   *"referrers will be able to see the current patient if they have been referred to ED."* **This is
   FD-2 as stated, and it is the mechanism he described.**
2. **"A referrer knows where their patient is and what has happened to them."** — the need that
   mechanism serves.

**If the role answer turns out to be "no", the second is still satisfiable** by showing the referrer
their own referral's progress without showing them the destination's list. **That may make a
restrictive answer cheap rather than costly, and it belongs in front of the owner when he decides.**

**But it must be offered to him as a fallback, never adopted as an interpretation.** FD-2 is claim 1
until he says otherwise. **Substituting claim 2 because it is easier to build is exactly the drift
this project's reversal conditions exist to prevent** — a requirement refined away by a later
document, rather than by anyone deciding against it.

## 5c. The universal referral sheet — owner direction, 2026-08-30

**This supersedes parts of §1 and §3 above. Where they disagree, this section wins**, and the
superseded text is left in place as a record of what was believed before rather than back-dated.

### What changed

**1. One sheet for every direction, and the destination depends on where you are.**

```
in the community  ->  refer to an ED        (most common)   or  to a ward
in an ED          ->  refer to a ward       (most common)   or  to a community team
on a ward         ->  refer to a community team            (discharge onward)
```

**CMHT is no longer a deferred destination.** It is the ward's onward referral, which is the
discharge end of the pipeline. **So the sheet closes the loop rather than only opening it.**

**2. The mechanism by which a referrer keeps sight of their patient is SEARCH.** Owner: *"If a
patient has been referred to ED from the community, when I search that patient, there should be some
way of the ED psych to see the patient show up. Then they can on-refer a patient to the wards."*

**This is a materially better answer than the one in §5b**, and it resolves the role question that
was about to go to him. A referred patient becomes **findable by the receiving clinician** — the ED
psychiatrist searches, the patient appears with the referral attached, and the on-referral is raised
from there. **Nobody needs to be given a whole department's list to satisfy it.**

**3. The tentative diagnosis is selected here, and can be updated.** Confirms `FD-7` reaches the
referral. On updating, see the seam note in `docs/ward-flow-mission-and-refusals.md`: **a later
clinician revising it is a second authored fact with its own author and time, not an overwrite** —
that is how "can be updated" is implemented without destroying what the referrer actually asked for.

**4. Free text, to tell the story.** See the governance note below; it is not a small field.

### The field set

**Grouped by the question each group answers. Everything the owner named is here, plus what a bed
request needs to be actionable.** Fields marked **NEW** do not exist yet; the rest exist and move.

**Where is this going**
| Field | Note |
| --- | --- |
| Destination | ED / ward / community team — offered by where the referrer is |

**Who the person is**
| Field | Note |
| --- | --- |
| Age band | exists |
| Sex | exists — `FD-4` (whether it widens) is still open and untouched by this |
| Catchment / home region | exists |
| **Aboriginal or Torres Strait Islander status** | **NEW — owner decision.** Recommended: include. In WA this changes who should be involved in care, not merely a statistic, and a bed system that cannot see it cannot route to it. Needs his word, and "not stated" must be a real option |

**Where they are, and who already holds them**
| Field | Note |
| --- | --- |
| Where the patient is now | ED / ward / community — exists implicitly as origin, made explicit |
| **Active with a community mental health team** | **NEW** — owner named it. Yes / no / not known, and which team when yes |
| **Known to this service before** | **NEW — recommended.** Continuity is a real placement factor and it is one tap |
| **Guardian or substitute decision-maker** | **NEW** — owner named it. None / public guardian / enduring guardian / not known |
| Referring team and role | **never a person's name** — the ward needs to reach the referrer, not identify them |

**Legal**
| Field | Note |
| --- | --- |
| Legal status | exists — voluntary / involuntary |
| Form in place | exists — owner named "forms". **No figure, timeframe or threshold from the Act, anywhere, including in a hint** |

**What the bed must provide**
| Field | Note |
| --- | --- |
| Secure or open | exists |
| Can hold someone involuntarily | exists — becomes three-state per R2.2a |
| **Observation level** | **NEW** — owner named "1:1 or security". General / 1:1 / 2:1. Replaces the existing bare `specialling` boolean, which cannot say how much |
| **Medical care needs** | **NEW — recommended.** The commonest real reason a psychiatric bed is refused. None / monitoring / mobility / delirium risk |
| **Substance withdrawal management** | **NEW — recommended.** Changes which unit can take the person |

**Alerts — ONE multi-select, not eight questions**
| Chip | Note |
| --- | --- |
| Behavioural disturbance | owner named it |
| Absconding risk | recommended — drives secure versus open |
| Risk to others | recommended |
| Risk to self | **owner decision.** Recommended, with care: **a flag is not a ranking**, and observation level is already asked. He has forbidden ranking a person, and this sits closest to that line of anything here |
| Falls risk | recommended |
| Interpreter needed | recommended — plus which language |
| Requires a female-only space | recommended |

**Clinical**
| Field | Note |
| --- | --- |
| Tentative diagnosis | `FD-7` — the existing `TENTATIVE_DIAGNOSIS_BLOCKS`, reused, never a second list |
| Urgency | exists — worded tiers, one wording everywhere |

**The story**
| Field | Note |
| --- | --- |
| **Free text** | **NEW** — owner asked for it. Governance note below |

**Logistics**
| Field | Note |
| --- | --- |
| Transport needed | exists |

### Free text — what it costs and how it is contained

**The owner asked for it and it will be built. This is not a refusal; it is the record of what
changes**, because "no free text" was enforced by a named test and is the field that most changes
what this record is.

**Why the rule existed:** free text is where a name, a date of birth, an address or a clinical
narrative enters a record that has none of those. **Everything else on this sheet is a chosen option
from a fixed list**, which is what makes the privacy claim checkable rather than a promise.

**Five conditions, and none is a hedge:**

1. **It is a STORY field, never a data field. Nothing in it may ever feed matching, eligibility,
   ranking or ordering.** The moment placement depends on prose, the system is deciding on unchecked
   text.
2. **The structural privacy test is widened by exactly ONE entry, deliberately, in the same change**
   — the `FD-7` pattern. It keeps failing for `patientId`, `dob`, `homeAddress` and everything else.
   **Widened, never loosened.**
3. **The screen says what it is** — synthetic in the demo, and in any real use the one field where
   identifying detail can leak.
4. **It is optional and last.** A required story field turns into a form everyone fills with "as
   above".
5. **It is never used to justify a refusal.** A refusal cites a stated reason from the existing list;
   prose is context, not grounds.

### Frictionless, with twenty fields — how

**The tension is real: he asked for every important thing AND for a frictionless sheet.** Four moves
carry it, and none of them hides anything — the standing rule that nothing is behind a click holds.

1. **One multi-select for alerts, not eight yes/no questions.** This is the single biggest saving:
   seven chips, tap the ones that apply, and **the unselected ones are visibly unselected** rather
   than being eight separate unanswered questions blocking Send.
2. **The destination removes fields rather than hiding them.** A referral to a community team does
   not ask what the bed must provide. **Removed because irrelevant, not collapsed behind a control.**
3. **Choices are visible rows, not dropdowns**, wherever the list is short enough. A dropdown is two
   taps and hides its options; a row of three is one tap and shows them.
4. **Send is sticky and names what is still needed** — "3 answers still needed: catchment, legal
   status, urgency" — so the referrer never hunts for what is blocking them. `aria-disabled` plus an
   inert handler plus the stated reason, never native `disabled`.

**What "frictionless" must NOT be taken to mean:** pre-answered. A default is still a wrong answer
nobody chose, and R2.1 has just removed them. **Speed comes from each question being one tap, not
from the form guessing.**

### Owner decisions this raises

**These are ONE decision with two choices inside it, not three separate asks. It goes to him as one
question, from this session.**

**THE GOVERNING ONE — the five-person-facts rule.** He gave the build session this, in his own words
and as an absolute:

> *"A Referral carries exactly five person-facts: age band, sex, home region, secure-bed-needed,
> involuntary-bed-needed. Nothing else, ever. Free text counts as data."*

**The sheet he has now asked for substantially exceeds that**, and free text is only one part of it.
Guardian, active-with-a-community-team, observation level, alerts, tentative diagnosis and
Aboriginal or Torres Strait Islander status are all **facts about a person**. **So the question is
not "may we add free text" — it is whether the five-fact limit still holds at all, and free text is
the most consequential item under it.**

**Recorded this way because asking about free text alone would get a yes and leave the rule silently
exceeded by eight other fields** — a requirement refined away by a later conversation about an
adjacent subject, which is the exact failure this project recorded a rule against on 2026-08-29.

**Why the limit mattered, so he can weigh it rather than just waive it:** every other field is a
chosen option from a fixed list, which is what makes the privacy claim **checkable rather than a
promise**. A longer list of fixed options keeps that property. **Free text is the one item that does
not**, which is why it is a different kind of addition from the other eight.

**TWO INSIDE IT HE SHOULD CHOOSE RATHER THAN INHERIT:**

1. **Aboriginal or Torres Strait Islander status** — recommended include. In WA it changes who should
   be involved in someone's care rather than being a statistic, and a bed system that cannot see it
   cannot route to it. **"Not stated" must be a real option.**
2. **Risk to self as an alert chip** — recommended, and it sits closest to his *"never rank a person"*
   line of anything on the sheet. A flag is not a ranking, and observation level already asks the
   practical question — but it is his to choose.

**NOT open and not touched by any of this:** `FD-4`, whether `sex` widens, remains as it was.

## 6. Verification

- **Mutation-test every rule-bearing test.** Record `git hash-object` before mutating, restore,
  compare, and compare `git status --porcelain` against a pre-mutation snapshot. Never `mutate.sh`.
- **The specific mutation this work needs:** make one field's default reappear, and confirm a test
  goes red naming *which* field was unanswered — not merely that submission succeeded.
- **Run `node scripts/run-vitest.mjs run tests/<file>`**, never `npm run test:focused`, which
  fail-closes on any `tests/` path and escalates to the whole suite on the exclusive lock.
- **Look at the rendered page.** Every defect that has reached a screen in this project was found by
  looking, never by a test. Both entry points, three widths, print.
- **Quote the `N passed` line**, never the exit code.

## 7. What this plan does not do

No free text, in any framing. No diagnosis, no name, no date of birth. No invented Mental Health Act
figure, timeframe or threshold — including in a hint or a placeholder. Nothing that predicts, scores,
ranks or recommends a patient. No reduction of the 48px tap floor. No stepper or wizard — the owner's
own collapse decision was approved only on the condition that nothing is hidden. And no widening of
`sex` inside this work; that is FD-4, and reversing it is his call alone.
