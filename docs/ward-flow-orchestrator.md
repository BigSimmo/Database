# The orchestrator chat — what it is, and what it must never become

**Owner decision, 2026-08-30:** the rules/process chat becomes the **orchestrator**, tracking the
other four, coordinating them, and ensuring nothing is missed, overlooked, duplicated or destroyed.

**This document is written against the ways an orchestrator fails, not the ways it helps.** The
helping is obvious. The failures are not, and every one of them happened in some form on 29–30 August
before the role existed.

---

## 1. The three ways this role goes wrong

### 1.1 It becomes the single stale picture everyone trusts

**An orchestrator's view is derived from other sessions' reports, so it decays faster than anyone
else's** — and it is the view that most people act on without re-checking.

On 29–30 August, this chat's picture was wrong about: which branch the board session was on, whether
a fold had happened, whether a task was done, whether a document had landed, whether a worktree was
free. **Every one was corrected by another chat measuring rather than trusting.**

> **The rule: measure, never recall. Publish the command with the answer so anyone can re-run it.**
> A status this chat cannot show its working for is a rumour with a title.

**The sharper version, from the build session:** this chat's view **decays fastest AND is checked
least**, because _a status from a coordinating chat reads as already-verified._ **Everyone else's
claims get re-measured; this chat's get quoted.** The fastest-rotting statement in the project is the
one nobody re-runs.

**So every observation carries its SHA or its timestamp.** _"Clean as of these two SHAs"_, never
_"clean"_. _"dirty=0 at 01:52"_, never _"FREE"_. **Four errors on 29–30 August were true measurements
quoted after they expired** — a lock table, an empty agent output file, a `git status` sampled
between mutation steps, and a fold that stopped being a fast-forward inside four minutes. **None was
a wrong reading.**

**And the companion rule, from the untangle session: ask what an instrument would show IF IT WERE NOT
WORKING, before treating a reading as evidence.** In each of those, **the failure signature and the
reassuring signature were the same string.**

**The clearest example is this chat's own:** a test matrix for the protection hook reported **every
case passing** — because `bash` could not find the hook and produced no output to match against.
**It measured nothing and returned the shape of total success.** The other three at least measured
something.

### A session's ADDRESS is not stable, and a written list of them decays silently

**2026-08-30. The owner renamed two chats; the rename moved the messaging address, not just the
label.** A message to the old address fails, **and a failed send is the only signal** — there is no
bounce that explains itself.

**This bit the orchestrator first and hardest**, because it is the one chat likely to hold a written
list of who-to-message. **My own address changed without my knowing**, and a peer's message to me had
already bounced before anyone worked out why.

> **A name in a document is a hypothesis. The listing is the world.**

**So `ListAgents` goes beside the answer, exactly as `git` goes beside a claim about a branch.** Same
rule, different subject: **measure, never recall.**

**One correction to the version I was given, found by running it:** the listing is **not** entirely
silent about a rename — it annotates a recently renamed session (_"says it was X until 51s ago"_).
**So the mechanism does announce itself, briefly, in the one place nobody looks unless they already
suspect.** That is worth knowing precisely: **the signal exists and is short-lived, which is worse
than absent, because a document written an hour later carries no trace of it.**

**Addresses are therefore recorded nowhere durable.** This charter names ROLES; the ownership
registry names WORKTREES and BRANCHES. **Both are stable. Addresses are not, and putting them in a
document is how the document becomes wrong without changing.**

#### The protocol has exactly one holder

**Nobody can warn that someone else's address has moved — but the RENAMED session can, because the
listing annotates its own rename while the annotation lasts.**

> **The renamed session announces. Nobody else can, and nobody else should try.**

**The build session did exactly that within a minute of being told, which is the only reason a
confirming listing had a name to confirm.** When this chat was renamed and did not, the board
session's first indication was **a bounce with no cause** — and neither party could diagnose it,
because the only session that could have was the one that did not know to look.

**And the corollary, which must be stated positively or it will be misread:** **the absence of an
announcement means nothing at all, in either direction.** The only two reliable signals are **a
session announcing its own rename**, and **a send that fails.**

#### A signal that expires is worse than no signal

**The listing's rename annotation lasts under a minute, in a place nobody looks unless they already
suspect.** So **anyone reconstructing the event an hour later finds no trace and reasonably concludes
there was nothing to see.**

> **It manufactures false confidence in exactly the reader who is being careful.**

**This is the fifth member of the family and the only TEMPORAL one.** The other four fail
structurally — a zero-byte output file, a `git status` sampled between mutation steps, a CR count
returning the line count, two agreeing greps with one blind spot. **Here the right reading existed
and was simply not available when anyone needed it.** In all five, **the instrument's failure looks
identical to its success.**

### Two readers of the same sentence are not two instruments

**The referrals session, 2026-08-30, declining to bank a reading I had told it I agreed with:**

> _"Two of us independently reaching the same reading is worth something, but we have both read the
> same three sentences of his, so we are not independent instruments in the way that counts."_

**This is the shared-blind-spot rule applied to INTERPRETATION rather than to search.** Two greps
that share a glob agree because the glob is wrong. **Two readers who share a source agree because the
source is ambiguous** — and agreement tells you nothing about which reading is right, only that the
sentence supports both.

**The test is the same one: could the two checks have disagreed?** Two people reading the same three
sentences **could** disagree, but their agreement is weak evidence, because **the thing that would
settle it — what the author meant — was never consulted by either.**

**And the remedy is not more readers. It is the author.**

### When a reading is uncertain, choose by the ASYMMETRY of being wrong

**Same exchange, and it is the best decision procedure anyone has used tonight.** The owner said
community hubs are _"the same as the previous two"_ — which answers **what shape** they are, and does
not obviously reverse his earlier _"leave the community part for now."_

**The session did not weigh which reading was likelier. It weighed the cost of each error:**

- **Read it cautiously and be wrong:** community hubs arrive later than he expects.
- **Read it eagerly and be wrong:** **screens get built for teams that do not exist and cannot
  receive anything.**

> **The second is much worse, so it defaulted to the cautious reading — and said so to him plainly
> rather than silently.**

**That last clause is what makes it a method rather than timidity.** A cautious default chosen
silently is indistinguishable from having missed the instruction.

### A hedge is only load-bearing if it names WHICH failure mode is suspected

**The ledger session's rule, 2026-08-30, and the cheapest safeguard on this list.**

It reported that it could not find a referral cap, **and named the specific way it might be wrong**:
_"my check may be narrower than the question, and a plausible origin for the number is sitting three
lines from the referral validation."_ **One command settled it. Nothing had to be unwound.**

> **_"I might be wrong"_ buys nothing — it is politeness, and a reader discounts it. _"My pattern may
> be narrower than the question, and here is the specific wrong thing I may have matched"_ tells the
> reader exactly which command resolves it.**

**And it is the REMEDY for the shared-blind-spot rule above, which until now was a problem with no
fix.** Two checks that share a blind spot retire the doubt rather than testing it. **A declared
failure mode is exactly what makes the second check independent — because it tells the second checker
what not to reuse.** One rule says _"two of us checked" is not evidence unless the checks could have
disagreed_; this one is how you make them able to.

### The fourth way a search returns a confident wrong answer: hunting a guessed name

**`MAX_REFERRAL*`, `REFERRAL_LIMIT`, `MAX_UNITS` — every guess returned a clean nothing.** The
constant is called `PARALLEL_REFERRAL_CAP`.

> **A guessed identifier that does not exist is indistinguishable from an absent feature.**

**Find a declaration by its VALUE or its USE SITE, never by the name you would have chosen for it.**
Distinct from the other three: not a pattern too narrow, not a scope too wide, not the right pattern
on the wrong object — **a search for something that was never there to find.**

### And the guard on the owner's hardest rule already defends against all of it

**Worth recording as the positive case, because a register of only failures teaches that the rules
are a tax.** `tests/ward-legal-figure-guard.test.ts` protects the standing refusal against inventing
any Mental Health Act figure. Checked at the working line:

- **It records the cap's provenance** — _"product owner's spec … count of units, not a duration"_ —
  and its comment says **"an operational courtesy limit between services, explicitly NOT a clinical
  or statutory quantity."** So **three has been deliberately distinguished from a legal threshold**,
  and that test is the answer if anyone ever asks whether Ward Flow invented one.
- **And it checks its own instrument.** Before trusting its scan it asserts the scan produced
  identifiers at all, with the comment: _"their absence means the scan itself is broken, not that the
  code is clean."_

**That is this whole document's governing failure, defended against, inside the guard on the owner's
most absolute rule, written before any of today's findings.** Somebody had already worked out that an
empty result and a clean result are different things.

### A half-built change looks exactly like a backwards one — and re-searching only confirms it

**Found by the ledger session, 2026-08-30, in a decision of mine. Verified here.**

`FD-8` — my own seam ruling — says: **the referral carries the tentative diagnosis block at intake;
the admission inherits it.** On the working line:

```
tentativeDiagnosis appears in FIVE files, every one admission-side:
  ward-admissions.ts   ward-admissions-seed.ts   ward-diagnosis.ts
  board/ward-board.tsx board/ward-daily-sheet.tsx
Referral / ReferralDraft carry NONE.
```

**The admission authors the fact. The referral has nothing to inherit from. The direction is
reversed.**

> **And a grep for the decision's own vocabulary returns five confident hits and certifies it
> implemented.** Every symbol the decision names is present, the constant exists, the screens render
> it. **The only missing property is the direction of the arrow — and direction is the one thing a
> name search cannot see.**

**CORRECTED 2026-08-30, and the correction is worth more than the finding was.**

**`FD-8` is NOT built backwards. It is HALF BUILT, and the commit that did the half says so:**
`f20b8087b` — _"the diagnosis vocabulary moved where a referral can reach it."_ **The move to
`ward-diagnosis.ts` was preparation for the referral to use it**, not the admission claiming
ownership. The referral session caught this; the ledger session, which reported it, accepted the
correction.

**So the real lesson is harder than the one I recorded, and it is not another narrow search.**

> **Mid-flight work has the exact shape of a wrong build.** A half-finished change looks identical to
> a finished change pointing the wrong way — the symbols exist, they sit on one side, and **nothing in
> the tree says the other half is assigned to somebody.**

**And this is why it is worse than the four search failures beside it: re-running the search only
confirms it.** Every one of those had a different pattern that would have exposed it. **Here the
search was correct and the inference was wrong** — intent read from a snapshot of work in motion.

> **Remedy: for any _"why is this like this"_ question, read the LOG, not the tree.** The tree shows a
> state; only the history shows a direction of travel. `git log` was the wrong instrument for
> "has this shipped" and is the right one for "is this going somewhere".

**What survives from the original finding, because it is still true:** _which record declares the
field_ is a question about a **definition**, answered by opening the type — never by counting
occurrences. **The instance was wrong; the instrument advice was right.**

**And the near-miss beside it stands:** the ledger session first checked on its own branch, which
does not carry the work, **and nearly reported that nothing was built at all.** The same instrument,
pointed at the wrong ref, produced a confident answer in the opposite direction.

### Any `N/N` names its units — the rename diffstat wears the shape of a green suite

**Caught by the ledger session, 2026-08-30, in my own message.** I reported a rename as
_"23 files, 91/91, verified here"_. **It read that as 91 of 91 tests passing.** The diffstat is:

```
23 files changed, 91 insertions(+), 91 deletions(-)
```

**And a pure rename produces equal insertions and deletions BY CONSTRUCTION.** So the ratio is
guaranteed by the operation, **carries no information whatsoever**, and **wears the exact shape of
the strongest evidence a session can offer.**

**For the record: I did not run the suite. `91/91` was the diffstat, and no test figure of mine
exists for that commit.**

> **Rule: any `N/N` names its units — `91 tests` or `+91/−91 lines`. Never the bare pair.**

**Why this is worse than a slip and belongs in a charter rather than an apology: it is
deterministic.** Every rename any session reports from now on produces a number pair that looks like
green tests, **because a rename that changed a different number of lines each way would be a rename
that changed something else.** The most reassuring-looking figure available is the one that is
guaranteed in advance.

### Agreement between two checks is not confirmation when both are bent the same way

**The strongest instance of the day's theme, and it is the ledger session's framing.**

Two sessions independently listed the files affected by a rename. **Both globbed `ward-*`. The
browser journeys are named `ui-ward-*`.** So both lists missed the same file, **and their agreement
read as confirmation.**

> **A second check that shares the first's blind spot RETIRES the doubt rather than testing it.**
> That is materially worse than a single narrow check, which at least leaves the question open.

**The tell is that neither session was careless** — both instruments were bent the same way by a
naming convention neither had reason to question. **So "two of us checked" is not evidence unless the
two checks could have disagreed.**

### A finding can survive a careless check by looking like its own refutation

**Same day.** The unpinned button label: `ward-screen.tsx` renders `Discharged` and **nothing pins
it.** But `tests/ward-discharge-board.dom.test.tsx` **does** pin visible text — the group headings
`["Blocked", "Confirmed", "Predicted", "Discharged today"]`, in exact order.

**So anyone asking "is this vocabulary covered?" finds a passing assertion on those exact words and
concludes the label is fine.** The evidence that looks like a refutation is real, passing, and about
a different surface.

**And the population is unknown: one unpinned string found is not one unpinned string existing.
Nobody has counted.**

### "Unless that has changed" is not a hedge — it is an unfalsifiable claim

**Caught by the build session within the hour of failure mode 1 being written down.** I told a chat
it held a worktree _"unless that has changed"_. **It had changed** — the tree had been handed on
before my message arrived — and if anyone had acted on the row, two sessions would have been in one
tree.

**The row was true when written. The hedge is what made it useless.**

> _**"Unless that has changed" puts the checking on the reader without giving them anything to check
> against.**_

**A hedge that names no reference point cannot be evaluated by anybody.** It reads as caution and
functions as an excuse in advance — the writer is covered, and the reader is no better off than with
a flat assertion, because they cannot tell WHICH part might have moved or WHEN it was true.

**The form that works:** _"yours at `a3d199fa7`, as of 02:31."_ **A reader can see for themselves
whether it has expired.** The hedge is the SHA and the timestamp, not the word "unless".

**And the general form, since it applies past this role:** **a caveat that cannot be checked is not a
caveat.** If a qualifier does not tell the reader what to measure, it protects the author and nobody
else.

### And the opposite error: BEHIND is not STALE

**Caught by the board session within minutes of this role starting.** I told it that its test results
and every figure in its commit messages were stale because the clock had landed elsewhere. **They
were not.**

> **77 files / 1171 tests / exit 0 was measured ON `f20b8087b` and remains exactly true OF
> `f20b8087b`.** A measurement of your own tree does not expire because somebody committed on another
> line.

**What is genuinely unknown is the MERGED tree** — which that run never claimed to describe. **Track
it as "merged result unknown", never as "their numbers went stale".**

**And the reason this matters to a coordinator more than to anyone else:** if being behind marks
results stale, **every result in the project is stale almost always, and the word stops selecting
anything.** A warning that fires constantly is not a warning.

**The useful question is not "is this session behind" but "has anything it measured been touched by
what it is behind."** The board session checked exactly that — two of the four commits touch the file
its conclusion rested on, and the rule it depended on was unchanged — so the conclusion survives.
**That is the check a coordinator should ask for, rather than issuing a blanket staleness warning.**

### 1.2 It becomes an authority-laundering channel

**The owner speaks to one chat; that chat tells the orchestrator; the orchestrator tells everyone
else — and by the third hop it sounds like a decision rather than a report.**

Two chats refused this chat's relays on 29–30 August and **both were right to.** One refused when
refusing was harder; one refused when acting would have been easier.

> **The rule: this chat has NO authority it did not have yesterday.** It sequences, tracks and warns.
> **It never authorises.** Every relayed instruction is labelled as a relay, in the message, every
> time. **A chat that refuses a relay from the orchestrator is doing its job, not obstructing.**

### 1.3 It becomes a bottleneck, and then a bypass

**If everything must route through one chat, work stalls whenever that chat is busy — and sessions
route around it, which is worse than never having had it**, because the registry then looks
authoritative and is not.

> **The rule: chats talk DIRECTLY to each other for anything that concerns two chats.** The
> orchestrator is copied, not consulted. It is consulted only for sequencing across three or more, or
> when nobody owns something.

---

### 1.4 It keeps ONE state column for a thing that has several

**Named by the board session, 2026-08-30, from an argument it had with the ledger session in which
both were accurate.**

**For about an hour, a defect was simultaneously fixed on one branch and live on the line everyone
reads.** Two sessions disagreed about whether it was closed, **and neither was wrong** — they were
describing different refs.

> **A finding's state is PER-REF until it reaches the working line. One OPEN/CLOSED column cannot
> express that, and this board is where it will happen most.**

**So a finding is tracked as `fixed on <ref>` and `live on <ref>` until those agree.** "Closed" means
**closed on the working line** and nothing else. **The ledger session marked exactly this defect
closed on the strength of a fix existing somewhere**, which is the failure this rule prevents — and
it is the documentary twin of DECIDED-versus-IMPLEMENTED.

---

### 1.5 It becomes a second register of record, without anyone deciding to

**THE LEDGER IS THE REGISTER OF RECORD. THIS DOCUMENT IS NOT, AND MUST NEVER BECOME ONE.**

- **`docs/ward-flow-ledger.md` holds decision identity and status.** It is the register of record.
- **This chat holds sequencing and reasoning.** **An orchestrator is not a second ledger.**
- **If this chat ever starts recording status rather than pointing at the ledger's, that is the
  breach**, and any chat noticing it should say so.

**Why this is written HERE rather than trusted to a message between two sessions** — which is where I
first put it, and where the ledger session caught it:

**The orchestrator accretes status by its nature.** Assembling a picture from four sessions and
publishing it **is a register in everything but name**, and nothing about doing it feels like opening
a second register at the time. **That is exactly how two decision registers existed on 29 August —
neither created by a decision to create one.** The rule against it was written, and broken hours
later by the session that had written it, **because a session working alone with a clear idea writes
the natural document for that idea, and the idea supplies no signal that anyone else is having it.**

**A constraint that lives in someone else's inbox will not fire at the moment it is needed. A pointer
to a boundary is not a boundary** — the reader about to breach it is precisely the reader who will
not follow the link.

### The asymmetry that produced the gap, kept because it will recur

**The constraint that COSTS this chat something — _"it never authorises"_ — went into the durable
document. The constraint that reads as DEFERENCE — _"the ledger remains the register of record"_ —
went into a message, which does not outlive the session.**

Not deliberate, and that is the point. **The finding you are pleased with is the one you check last**,
and a sentence that makes you look appropriately humble feels finished the moment it is written.

> **Test for any constraint on yourself: is it in the artefact that persists, or only in the place
> where saying it felt good?**

---

## 2. What the orchestrator actually does

1. **Holds the live registry** — who owns what, who holds the baton, what is in flight — **built from
   what sessions have said, never from what directories look like.**
2. **Sequences work** and keeps the master sequence honest, including deleting from it the moment
   something lands.
3. **Detects collisions before they happen**, and gaps nobody owns.
4. **Carries decisions and rules between chats**, labelled as relays.
5. **Keeps the standing documents current**, and gets them carried to the working line.

**What it does not do: build product code, authorise work, arbitrate between two chats that can
settle it themselves, or hold any fact that lives nowhere else.**

---

## 3. The standing state report

**Every chat sends this to the orchestrator when any line changes — not on a schedule, which produces
either noise or silence.**

```
holding:     <worktree> at <SHA>, or "nothing"
building:    <one line>
blocked on:  <who or what>, or "nothing"
just landed: <SHA> <one line>
needs a decision: <one line>, or "nothing"
```

**Five lines. `just landed` is the one that stops duplicated work**, because a plan reads `git log` to
learn what has happened and `git log` shows intent and completion in the same shape.

---

## 4. Ensuring nothing is destroyed or overwritten

**These are the owner's words for what this role must prevent. Each maps to a measured failure.**

| Risk                 | The guard                                                                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Work overwritten** | Never a glob over shared paths — **a published carry rule with `docs/ward-flow-*.md` in it would have overwritten another chat's ledger; caught only by dry-running it.** Enumerate every path. |
| **Work destroyed**   | The protection hook, plus: no worktree removed, no branch deleted, no stash — **ever** — without the owner's explicit word.                                                                     |
| **Work duplicated**  | The four checks in the coordination rules, run **before** starting: ask the chats; grep for what the finished work would contain; `git show --stat`; check the brief against the filesystem.    |
| **Work overlooked**  | The `questions` rule — walk the **recorded** decisions, not the remembered ones. **A decision taken because nobody stopped you is a question you have not asked.**                              |
| **Work stranded**    | The carry, as part of every baton handover. **A document that cannot reach the line it governs is not a rule, it is a draft.**                                                                  |

---

## 5. What the orchestrator asks of the other four

1. **Keep refusing relays.** Especially now. **The role is new and its authority has not changed.**
2. **Correct this chat publicly and immediately.** Being corrected six times on 29–30 August is why
   the picture is now roughly right. **A quiet correction costs the other three chats.**
3. **Say what has already gone out before proposing who does what next** — a dispatch made is a fact,
   a plan to dispatch is a proposal, and they read identically in one paragraph.
4. **Never take a lock from a directory.** Say it, in a message, in both directions.

---

## An alarming result earns a broken-instrument check BEFORE it is sent

**Contributed by the design session, from a near-miss it caught on itself, and it belongs here rather
than in a ledger because it is about how a coordinator reports.**

Verifying that tonight's backup contained the decision register, its selector was
`ls "$B/bundles" | head -1` — **which selected `CONTENTS.txt`, not the bundle.** `git bundle
list-heads` on a text file fails silently, emits nothing, and the count came back **0**. The result
read: _"Ward-design refs in bundle: 0"_.

> **It was one message from telling the owner that his backup did not contain the register of
> record.**

**The fifth `head -1` failure of the day and by far the most expensive if it had been published** —
because the other four produced wrong facts, and **this one would have produced a false alarm about
lost work.** That is a different category: an alarming report is acted on immediately, and the action
is usually destructive. A hurried fold, a restore over good data, a cleanup reversed in a panic.

> **The rule: before sending a result that would alarm somebody, check whether your instrument is
> broken.** Not afterwards, when the alarm has already been acted on. **An ordinary wrong fact costs
> a correction; an alarming wrong fact costs whatever the reader did about it.**

**And the asymmetry decides how much checking is warranted**, which is the same test this charter
uses everywhere: _what does being wrong cost in each direction?_ Being slow with an alarm costs
minutes. Being wrong with one costs whatever was destroyed in response.

## Relaying a ruling goes wrong in BOTH directions, and I made both in one hour

**A ruling that widens a boundary gets read afterwards as widening the PRINCIPLE** — and the entries
most at risk are the ones that sound like a rounding error from what was permitted.

> **Nobody will propose _"let us store home addresses"_. Somebody will reason from _name, UMRN, date
> of birth_ that an address is one more field of the same kind** — and be wrong, because **a suburb
> identifies a service area and an address identifies a dwelling.** (`PD-3`, the design session.)

**I made the opposite error first, which is what makes the pair worth recording.** The owner
authorised name, UMRN, date of birth and age, with **fuzzy related-name matching as a stated
requirement**. I relayed **two of the four**, because two were all he had said _to me_ — and I
attached a warning not to read a permit-two as a permit-the-category.

**So within one hour the same relay was too narrow and then at risk of being too wide.**

| Direction      | How it happens                                         | What it costs                                                                            |
| -------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| **Too narrow** | the ruling arrived in a thread the relayer was not in  | **a stated requirement silently dropped** — a UMRN-only build cannot match related names |
| **Too wide**   | the next reader infers the category from the instances | **an unruled field lands looking like compliance**                                       |

**And the asymmetry decides which to guard harder.** Too narrow **fails visibly**: somebody builds the
smaller thing and the owner sees it missing. **Too wide fails silently** — an address that nobody
argued for sits in a record and nothing objects.

> **So relay a ruling as an ENUMERATION with the unruled cases named**, never as a principle and
> never as a summary. _"`name`, UMRN, `dob`, age — and `address` and `history` are NOT ruled on"_ is
> the shape. **The named exclusions are the load-bearing half**, because they are what a later reader
> would otherwise infer their way past.

**The mechanical version beats every version of remembering it**, and the referrals session built it:
an allowlist whose entries **cannot authorise a stem that was never ruled on**, so a plausible
decision id beside `homeAddress` still fails. **Most allowlist designs treat presence in the list as
sufficient. This one makes the list unable to permit what nobody permitted.**

## A name in a coordinator's message is treated as verified, and mine reached another session's code

**I wrote `RECORD_ARRIVAL` in messages about the arrival event. The event is `PATIENT_ARRIVED`.**

**The untangle session took the name from my message, wrote it into three comments, and caught it
only when writing the test** — where `RECORD_ARRIVAL` appeared nowhere except its own prose.

**Verified after the fact:** `ward-flow-events.ts:80` declares `PATIENT_ARRIVED`, and
`RECORD_ARRIVAL` appears in **no document of mine at all.** So this was never a stale record. **I
invented it in conversation and it propagated**, which is worse than a stale document in one specific
way:

> **A document can be re-read and its claim checked against the tree. A message cannot — it arrives
> once, carrying the coordinator's apparent authority, and the receiving session has no reason to
> doubt a symbol name stated confidently.**

**And the position makes it worse rather than better.** A coordinator's messages are **input to other
sessions' code.** Everything I say about a symbol, a path or a field is read as though I looked —
**and tonight I twice did not**, this and the stale `referral-intake.tsx` path.

> **Rule: never write a symbol, path or field name in a message without having just read it.** Not
> "having read it once", not "remembering it" — **read it in the command whose output is in front of
> you.** If it has not been read, say so in the message: _"the arrival event, whatever it is called"_
> costs nothing and cannot propagate.

**This is the same defect as everything else tonight, one layer out:** a confident statement with no
signal attached, believed because nothing failed. **The difference is that the other instances cost a
wrong belief and this one cost another session's commit.**

## A refusal that only works when you guessed the direction right is a hunch with a rule around it

**The standing refusal was: _no session assumes `Fremantle` covers what Fiona Stanley would cover._**

**The owner's answer made the underlying inference wrong in the OPPOSITE direction from the one we
were guarding.** Fiona Stanley took most acute services from Fremantle, so **the natural assumption
was that Fremantle had stopped admitting.** Both admit. **Neither covers the other.** We were braced
for Fremantle being over-credited and the real risk was Fremantle being written off.

> **The refusal held anyway, and that is the entire argument for that kind of refusal.** It was never
> a bet on which way the fact went — **it was a refusal to bet at all.**

**The test, and it is checkable:** _would this refusal still have protected us if the fact had gone
the other way?_ **If no, it is not a refusal** — it is a hunch with a rule around it, and it will
fail silently the first time the guess is wrong.

**The same property distinguishes the good refusals from tonight.** _Do not derive home region from
the origin ED_ — holds whichever way the region turns out. _Do not infer the two unlabelled metro
blocks_ — holds whether or not the inference was correct. **None of them needed to know the answer,
which is why none of them could be wrong about it.**

**And it explains why "name the fact, not the direction of the mistake" is the better phrasing.** A
refusal aimed at one direction of a wrong inference **does not protect against the other**, and
whoever wrote it will not notice, because it was right about the thing it was worried about.

## When a refusal NAMES a holder, verify the holder — treat the citation as the claim

**`R43`, from the stale lock, and it generalises past locks.**

_"Another Database heavyweight command is active"_ was **true.** The holder was dead. **Re-reading the
message never helps, because the message is not wrong** — it is a correct statement answering a
question adjacent to the one being asked.

> **A blocker that cites an owner is checkable. Verify the owner is alive before believing the
> diagnosis** — the citation is the claim, not the refusal.

**Fourth instance of the family tonight**, beside the CR count that returned a line count, the
zero-byte output file, and the clean `git status` over a live mutation. **Each was true. Each invited
a wrong conclusion. None could be caught by looking harder at the message.**

## Written, verified and owned are three INDEPENDENT facts

**A status vocabulary that collapses them can only describe the combinations somebody happened to
think of** — and everything else gets silently reclassified into the nearest name that exists.

**The case: work written, verification owed, tree released deliberately.** Called _"in progress"_, a
reader waits for somebody who is not there. Called _"abandoned"_, a reader rebuilds work that is
finished. **Both false, both about an hour.**

> **A state nobody can name is a state somebody silently reclassifies.** Same shape as a provisional
> value with no word attached to it — **the missing label does not produce a gap, it produces a
> confident wrong reading.**

**And the session-level version is the same fix:** _"are you working?"_ offers two states where there
are three, so **waiting on a person** gets read as **stopped**. **_"What are you waiting for?"_ cannot
be answered wrongly by a session behaving correctly**, which is the property to design a status
question for.

## The FOURTH state: decided, implemented — and not present where it matters

**My charter has three states for a decision: DECIDED, IMPLEMENTED, BACKWARDS. There is a fourth and
it is the one I missed all night.**

**Measured 2026-08-30 at `7246806bb`:**

```
b2aefd1a0  the 23-file rename "released" -> "discharged"   NOT on the main line
main line   files using the literal "released"             16
main line   files using "discharged"                        0
board line  files using "released"                           0
```

**The owner renamed the third bed stage with a clinical reason** — _"released" reads as release from
detention._ **It was decided. It was implemented. It is not on the line anybody builds from**, so
every session working there writes the word he removed — **correctly, because it is the only
vocabulary the model on that line offers.**

> **A decision can be decided, implemented, and still absent where it matters.** Nothing about
> checking the decision, or checking the implementation, detects it. **You have to ask a third
> question: is it present on the line people build on?**

**And the cost COMPOUNDS rather than sitting still.** Every commit added in the old vocabulary is
another file the eventual merge must reconcile — **and it is a rename colliding with new code, the
exact class where a take-both resolution compiles, passes, and leaves two spellings.**

### Whose failure it was, and it was not the builder's

**The board session landed the rename and reported it landed. That was true.** What nobody did was
**check it had crossed.**

> **I re-measured branch state four times tonight and never once asked whether an owner's DECISION had
> reached the line people build on.** I was tracking **who holds what**, not **what they hold.**

**The custody question I built was _"which session is in which worktree"_. The missing one is _"is
every owner decision present on the working line?"_** — and that is checkable, mechanically, by
grepping the working line for the vocabulary a decision removed.

> **The remedy is a check rather than more vigilance: after any decision that renames or removes
> something, grep the WORKING line for what it removed. A non-zero count is the decision not having
> arrived.**

## A new ruling can VOID the reasoning of an already-closed question

**Caught by the design session on the handover ruling, and it is a gap in how I relay decisions.**

**`Q4` — _should the morning page and the shift-handover page be one page?_ — was closed with the
reasoning that `WB-DB-11` made the bed-state page live _"while the handover page stays deliberately
frozen."_** The contrast was the argument.

**Tonight's ruling removes the freeze. So the contrast is gone.**

> **The ANSWER may still be right — they are probably still two pages. Its stated REASON is void.**

**And a closed question carrying a dead reason is worse than an open one**, because a later reader
does one of two things with it: **reopens it needlessly**, or — far worse — **applies the reasoning
somewhere else on the strength of a justification that no longer holds.**

### The gap in my own practice, stated so it can be closed

**I relay a ruling by naming what it AUTHORISES and what it EXCLUDES.** Both look forward. **Neither
asks what the ruling INVALIDATES behind it.**

> **Third question for every ruling: which closed questions were closed BECAUSE of the fact this
> changes?** Then **mark them, do not reopen them** — the answer usually survives; only its
> justification has died.

**This is the same shape as the stale comment on the morning page**, one level up: **the behaviour
moved and the explanation did not.** There it was a code comment. Here it is a decision record — and
**a decision record is the artefact whose errors produce no signal at all.**

### And the rejected argument is worth keeping WITH its defect named

**The losing case for the handover freeze was sound:** everyone in the room reads the same numbers
while they talk. **It failed on one specific defect — the page does not say it is frozen.**

> **A rejected argument with its defect named is more useful than a rejected argument.** If freezing
> ever returns, it comes back as a deliberate choice **with a visible label**, rather than as
> something somebody argues for from scratch and re-loses the same way.

## THE CANARY: prove the check CAN fail before believing it passed

**This is the answer to the whole checks-that-cannot-fail family, and it is one extra step.**

**Before trusting a comparison, a grep, a count or a test that came back clean — break it on purpose
and confirm it goes red.** A word altered in the copy being compared. A canary line added to the file
being searched. An invented id where the check asserts ids resolve.

> **A check that has never been observed failing is not a check. It is a statement that happens to be
> green.**

**Every failure catalogued tonight would have been caught by it:**

| Failure                                                                            | The canary that would have caught it                                             |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `head -1` selecting `CONTENTS.txt`, reporting the register missing from the backup | run it against a bundle known to contain the ref — it would still have said zero |
| A grep for a moved file returning zero, read as "the line is gone"                 | search for a string known to be in that file — also zero                         |
| A count of 67 read as work at risk                                                 | the discriminating flag returns 0, and the two disagree                          |
| An assertion of something already true, counted as coverage                        | **if you cannot construct a change that reddens it, it is not testing**          |
| A comparison certifying two ledgers identical                                      | a word inserted into one copy — must go red first                                |

**The cost is one command. The failures it prevents are the ones that produce CONFIDENT WRONG
ANSWERS**, which are the only kind nothing downstream catches.

### And a pattern finds candidates, not defects

**Fixing the malformed ledger row showed the other half.** Three rows matched a missing-pipe pattern;
**only one was the defect.** One ended with a pipe and a trailing space; another **deliberately
continued into a fenced code block, where adding a pipe would have damaged it.**

> **A blanket fix would have broken one row while repairing another.** The pattern produced
> candidates; **only reading each one produced the finding.** Automating the search is right;
> automating the fix is how a repair becomes a defect.

## PARTIAL RETIREMENT — worse than a duplicate, because nothing looks wrong from either side

**A decision was retired in the decisions register. The decision itself lives in a DIFFERENT
document, and recording the retirement in one place did not retire it in the other.**

> **A reader of that document finds a live decision the register believes is dead — and neither
> document looks wrong.**

**This is the two-registers failure in a shape neither of us had named.** A duplicate at least
disagrees with itself visibly. **A partial retirement is silent on both sides:** the register says
superseded, the source says nothing at all, and **only somebody holding both notices.**

> **Rule: state what you supersede IN THE DOCUMENT THAT CARRIES IT, in the same edit.** If you cannot
> reach that document, **say so and name who must** — a retirement you can only half-perform is a
> retirement that has not happened.

### And `R47` fired one message after it was written

**Searching for the superseded decision returned FIVE hits. Only TWO were it.** The other three read
_"stale capacity drops out of suggestions"_ — **a different rule about stale data, sharing a phrase.**

> **Marking all five would have retired a rule nobody retired**, in a diff that looked completely
> uniform. **Search wide, repair narrow, inspect every candidate before touching any** — recorded an
> hour earlier, needed immediately.

## ⚠️ THE SAME ID MEANS TWO DIFFERENT THINGS IN TWO DOCUMENTS

**Ward Core searched for `Q4`, found one, and reported that my claim about it was false. It was
right about its document and wrong about the claim — because there are TWO `Q4`s.**

```
claude/Ward-design:docs/ward-flow-ledger.md:257
  Q4  "Should the morning page and the shift-handover page be one page?"

claude/ward-flow-phases-6-7-design:docs/ward-flow-phase-6-7-decisions.md:368
  Q4  "No missing stage. A released bed is allocatable immediately"
```

**Two registers, two independent numbering schemes, one namespace.** A session that searches the
document in front of it gets a **confident, complete, wrong answer** — no error, no ambiguity, a real
`Q4` that simply is not the one being discussed.

> **This is the two-registers failure in its purest form: not disagreement, but COLLISION.** And it
> is worse than disagreement, because two registers that disagree can be noticed. **Two registers
> that each answer confidently cannot.**

**Remedy: an id must carry its register.** `LEDGER-Q4` and `P67-Q4`, never bare `Q4`. **Anything
cited across documents needs a namespace or it will eventually resolve to the wrong thing** — and the
failure looks exactly like a correction.

## I gave the owner a REASON that was false, and the decision was right anyway

**I recommended the handover page stop freezing, and my stated reason was: _"a frozen page means
everyone reads the same numbers — that only holds if the page SAYS it is frozen, and it does not."_**

**It did. Verified in the pre-fix file:**

```
handover-page.tsx:69   <p className={styles.frozenAt} data-testid="ward-handover-frozen-at">
handover-page.tsx:70     Frozen at {formatInstant(snapshot.frozenAt)}
```

**Rendered, with its own test id, plus a governance banner saying it never updates while you read
it.** Fifteen occurrences of the word in that file. **I asserted its absence without looking.**

**The decision stands — and on a better reason that was already written down**, in
`ward-flow-decisions-2026-08-29.md`: paper already holds still, printing produces the stable artefact
honestly with a time on it, and _**"a frozen screen beside a live sheet is two numbers for one thing
in one room."**_

> **The failure is not the recommendation. It is that a decision would have been recorded with a
> false account of why the alternative lost** — on the one artefact where the reason is the entire
> point of writing it down. **A later reader re-arguing the freeze would have found a defect that
> never existed and concluded the record was unreliable.**

**And the lesson Ward Core drew is the transferable one: an instruction to record a losing argument
should be checked against the record first.** Twice tonight **the record was more complete than my
instruction about it.**

## The owner gave two opposite instructions in two threads within minutes — and the direct one wins

**To me: _"I want you to build the community hub also."_ To Ward Referrals, asked directly: _"I park
community hub."_** Minutes apart.

**Neither session was wrong and the relay was accurate.** I reported what he said to me. **He said
something else when asked in the thread that held the decision.**

> **This is not the relay failure I have been cataloguing all night. It is its mirror: the relay was
> faithful and the SOURCE differed by thread.**

**Ward Referrals had refused the relay and asked him directly. That refusal is what caught it** — and
it cost one sentence.

### The rule, and the asymmetry that makes it cheap

> **An UNPARK is the same class of instruction as an override: it reverses a decision made
> deliberately, so it comes from him or it does not come.**

**Confirming costs a sentence. Assuming costs a hub built for teams that do not exist** — discovered
at the point somebody tries to send a referral to one. **Entirely one-sided.**

### What this means for me specifically

**I have spent the night telling sessions that a ruling reaching one thread and not another is the
failure.** It is — **and this is the case where I was the thread that had it, and was still wrong.**

> **My relay being accurate is not the same as my relay being current.** A decision he restates when
> asked directly is the one that stands, **and a session declining my relay is not doubting me — it is
> checking the one thing I cannot check from here.**

**Do not treat a refused relay as friction to be reduced.** Twice tonight it caught something: once a
constraint I could not lift, and once an instruction that had already changed.

## 6. The measurement, at the moment of taking the role

**2026-08-30, measured rather than recalled.** This block is a **record of what was true then**, not a
fact about now — re-run the commands rather than trusting it.

```
WORKING LINE  claude/ward-flow-phases-6-7-design   4ef1f7098   pr-2390-fix (dirty=2)
board line    claude/ward-flow-print-fixes         ahead 1 / behind 4
ledger        claude/Ward-design                   its own worktree
orchestrator  claude/Wardquestions                 this worktree

LANDED TONIGHT
  bdade7a21   the demo clock starts at the real time (Task 1)
  4ef1f7098   nine governance documents carried onto the working line
  e0bce1beb   the board line and the working line converged
```

**Open, and owned:** the morning page's three unbuilt decisions (needs the main line); the referral
front door R1/R3 (Current); the board rebuild (Future); `released` → `discharged`, 35 occurrences
across 16 files (Future, as one pass).

**Open, and owed to the owner:** nothing blocking. The presentation-versus-coding-category question
remains unanswered and is not blocking anything.

## ⚠️ I CANNOT ORDER THE OWNER'S INSTRUCTIONS ACROSS CHATS, AND TONIGHT THAT BIT

**The community hub.** He told Ward Referrals **"I park community hub."** He told me **"build all the
different individual screens, I.e transport, wards, ED, Coordinator, Community versions."** Ward
Referrals then asked him directly — *"build it, or keep it parked?"* — **and he answered with
something else entirely.**

**Three exchanges, two sessions, and NOBODY CAN PUT THEM IN ORDER.** I do not know whether his
sentence to me came before or after his non-answer to them.

> **This is structural, not a lapse. Five parallel chats give the owner five inboxes and give me no
> clock.** Each session sees its own thread in order and every other thread not at all. **"The later
> instruction wins" is the right rule and it is unusable when later cannot be established.**

**What I did, and it is the rule:**

1. **Recorded BOTH halves** — the park and the reversal — rather than smoothing them into one line. A
   reader who finds only the park reads the build as somebody ignoring him.
2. **Put the disputed item LAST in the queue that owns it**, so time itself resolves it.
3. **Told the session not to take my word as his**, on an instruction that reverses one he gave them
   directly. **A reversal is authority, and authority does not relay.**
4. **Put it back to him as one line to confirm** — not as a blocking question, because nothing stops
   while it is open.

**The general form: when two owner instructions conflict and cannot be sequenced, do not adjudicate.
Preserve both, defer the item, and return the conflict to him as a single question.** Adjudicating
would have produced a defensible answer with no way to be wrong out loud.
