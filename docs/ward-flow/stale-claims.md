# Everything you are told is slightly out of date, and that is not a fault to fix

Written 2026-09-01 by Ward Builder, after three chats spent an afternoon correcting each other about
claims that were all true when made. Nobody was careless. **The corrections cost more than the errors
did.**

## The mechanism

A claim is made in two steps: you **read** something, then you **write** a message about it. Those
steps are seconds to minutes apart.

Meanwhile the other chats are committing. On the afternoon this note describes, three commits landed
**2m44s** and **1m07s** apart. The gap between reading and reporting was routinely **longer than the
gap between changes**.

So the ordinary case — not the failure case, the ordinary one — is:

> A chat reads correctly, reports accurately, and by the time the message is read the thing it
> describes has been superseded.

Both parties then look wrong to each other and neither is. On the day this happened in both
directions inside ten minutes: Lead reported "adopted exactly as proposed" while a correction was in
flight; Builder reported a commit's contents while a fix was in flight. Lead then corrected Builder,
and **the correction was itself wrong** — it inferred read time from message-arrival time, which are
different things.

## The fix, which is one line of discipline

**Name the version your claim is about, inside the claim.**

    ✅ "At 41cfe3927 the decay clause counts self-verified units."
    ❌ "The decay clause counts self-verified units."

The first cannot go stale — it stays true forever and the reader can see what it describes. The
second silently becomes false and takes the reader with it. Same for measurements: _"12 typecheck
errors at 634232c83"_, not _"12 typecheck errors"_.

**And before concluding what has shipped, compare the SHA you read against the current tip.**

## ⚠️ The wrong reaction — and it is the tempting one

The instinct after a day like this is **check more, and check again before speaking**. Do not. It
makes the problem worse, and the reason is arithmetic rather than attitude:

**Verification takes time, and the gap that causes staleness IS time.** Every extra check you run
between reading and reporting widens the very window that made your claim stale. A re-verified report
is a _later_ report about the _same_ moment. You have paid for accuracy and bought delay.

**You cannot verify your way out of this.** No amount of checking makes a claim current — only a
timestamp makes it interpretable.

1. **Do not re-run a check to make a report feel current.** It does not become current; it becomes
   slower. Report what you measured, and say when.
2. **Do not demand a correction when someone's claim has merely aged.** Re-read at the tip yourself.
   A stale claim is the expected output of a working system, not a defect in the person who sent it.
3. **Do not write a rule against it.** Staleness is structural. A rule cannot remove it and will only
   add ceremony, which adds delay, which widens the gap.

## When staleness actually matters — the only test worth applying

Ask one question: **would acting on this claim be hard to undo?**

- **No** → proceed on the stale claim. Re-reading costs more than being briefly wrong. Most reports
  are this: someone else's error count, an in-progress state, a branch tip you are not about to write
  to.
- **Yes** → re-read at the tip first, and only the specific thing you are about to act on. Merging,
  deleting, overwriting, publishing, or telling the owner something is done.

**That is the whole threshold.** It is not a judgement about how careful to be; it is a question about
reversibility, and it has an answer.

## What actually caught things on the day

Not extra testing. Three checks failed to catch a defective clause because each compared the artifact
to a _description_ of what it should be — and the description was the thing that was wrong. What
caught it was one chat **running the rule's state machine** instead of reading its intent.

**Read the artifact, not the report about the artifact — then say which version you read.** Both
halves. The first without the second is how a correct reading becomes a wrong claim.
