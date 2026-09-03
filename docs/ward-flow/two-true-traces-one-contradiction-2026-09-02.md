# ⚠️ Two chats traced the same code and flatly contradicted each other. Both were right.

**Settled by Ward Lead 2026-09-02 with a control. The entire difference was a commit neither of them
named.**

---

## ⚠️ CORRECTION, ADDED AFTER PUBLICATION. The diagnosis below is WRONG about one of the two chats.

**Ward Verifier read this and corrected it: it traced `claude/ward-builder-three` — the tree WITH the
new front door in it — not master.** So it was not looking at a different checkout. **Its error was
narrower and stranger:**

> ⚠️ **It had established, correctly and in writing one line earlier, that `referralAcceptanceRefusal`
> treats every non-suitability gate as UNBYPASSABLE. It then summarised that as "never refuses".**
> **Those are different claims: _never refuses in a way a reason can answer_ is not _never refuses_.**

**So the register line is not "measured a different tree". It is: it stated a limit naming WHAT it read
and not WHERE, and then over-summarised a correct trace into a stronger sentence than it supported.**

⚠️ **The tree-stamping rule below still stands and Ward Verifier has adopted it** — a path trace needs a
ref stamp as much as a count does, because a function's existence is as tree-dependent as a number.
**But it is the rule this incident RECOMMENDS, not the rule this incident BROKE.** Getting that
backwards would send the next reader looking for a checkout mismatch that was never there.

**The conclusion survives on both trees, for opposite reasons, exactly as recorded below.**

---

## The contradiction

- **Ward Verifier:** _"The staleness refusal NEVER FIRES ANYWHERE."_ Traced `eligibilityRefusal`,
  `referralAcceptanceRefusal`, `SUITABILITY_GATES` and the dropdown. Stated its limit precisely: it
  had run nothing.
- **Ward Builder Three:** _"It fires in exactly one place, and I put it there an hour ago."_ Produced
  a **passing test** asserting the rejection reason contains `failed gate capacity_freshness:`.

**Two careful readers. Two sound methods. Two true results. One flat contradiction.**

## The measurement

```
                              MASTER (ea3aa64fd)   claude/ward-builder-three
capacity_freshness                  0                        3
referralAcceptanceRefusal           0                        3
CONTROL: PULL_PATIENT              12                       13     <- the search works on both trees
git merge-base --is-ancestor 4cdb95e67 HEAD  ->  NO, not folded
```

⚠️ **On master neither the term nor the function exists.** So _"fires nowhere"_ is exactly right about
what is shipped, and _"it fires at the front door"_ is exactly right about the branch — **which is the
one being held, so nobody is looking at it today.**

## ⚠️ The lesson, and it is not "someone was careless"

**A path trace needs its tree stamped as much as a count does.** Everyone here already knows that a
_number_ expires. **Nobody had internalised that the EXISTENCE OF A FUNCTION is equally
tree-dependent** — a trace feels like a statement about the code, and it is a statement about one
checkout of it.

⚠️ **And the stated limits did not help.** Ward Verifier declared exactly what it had read and that it
had run nothing. **That is a better limit than most claims here carry, and it still omitted the only
fact that mattered.** A limit that lists your method but not your tree is not much of a limit.

⚠️ **Ward Lead then relayed the first result to a third chat as established fact**, flagging the
path-tracing half as unrun but not as tree-specific — **so the error propagated with a caveat attached
to the wrong thing.**

## The picture, corrected, and it is worse than either version

```
front door (ACCEPT_REFERRAL)  refuses on a stale count, and says in words that NO reason can override it
placement  (PULL_PATIENT)     never checks staleness at all — with or without a reason
```

⚠️ **The owner's approved reason 3, "The bed information is known to be out of date", is unusable on
BOTH paths, for OPPOSITE reasons.** That is the same fault the whole evening was spent on — two paths
holding opposite policies on one ruling — **reappearing one level down, in the reason vocabulary.**

**Ward Builder Three attributed the front-door half to itself, unprompted:** it classified
`capacity_freshness` as a world fact without knowing reason 3 existed. **And drew the consequence —
if the owner rules that reason 3 answers staleness, its current code is wrong and needs changing,
not extending.** Which is why the commit stays held.

## ⚠️ And an ambiguity in the reason itself, which changes the question

_"The bed information is known to be out of date"_ has **two readings**:

1. **The COUNT is stale — trust me over it.** Answers `capacity_freshness`. **Safe: a named person
   vouching for information, which is what an override reason is.**
2. ⚠️ **The ward looks full but is not.** Answers `allocatable_bed` — **the owner's own red line.
   No reason typed into a form creates a bed.**

⚠️ **Reading 2 is the more natural English, which makes it the one a clinician would pick** — meaning
the one thing the system must never permit. **Asking only "should the system refuse on a stale count"
returns a yes and still leaves the gate unidentified.** Both readings are with the owner.

### ⚠️ And Ward Verifier's sharpening, which is the part that decides it

**Reading 2 is NOT a misreading.** _A count that says zero when a bed exists **IS** out-of-date bed
information._ **It is not a clinician misunderstanding the words — it is the words being literally true
of the forbidden case.**

⚠️ **So this cannot be fixed by explaining the reason better, or by wiring it carefully to one gate.
ONE APPROVED SENTENCE CORRECTLY DESCRIBES TWO OVERRIDES — one permitted, one absolutely not.**

**The consequence:** wire reason 3 to answer staleness while clinicians reasonably read it as _"the
ward is not really full"_, and **the record says something different from what the person meant.**
⚠️ **The override record is the one place anyone would later go to find out what was overridden and
why** — which is Ward Builder Three's own argument for discarding an override that overrode nothing.
**A record that is ambiguous about WHICH rule was bent is the same harm.**

**So the question to the owner is not only whether the system should refuse on a stale count. It is
also: DOES THIS SENTENCE NEED TO BECOME TWO SENTENCES?** ⚠️ That is a wording change to an
owner-approved list, so it is entirely his — **and it is the third time tonight the answer has turned
out to be text rather than code.**

**And no sixth reason is being requested.** He approved these five; asking him to approve what he has
already approved invites a second word for the same thing, and `ward-change-reasons.ts` carries its
own `PLACEHOLDER VALUES` warning about exactly that confusion.
