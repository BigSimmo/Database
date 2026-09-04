# When to message the coordinator

**Owner's instruction, 2026-08-30:** every session tells the coordinator when it is blocked, when it
finishes something, and when something important happens.

**Written against what actually went wrong on 2026-08-30, not against a guess.** Every trigger below
is a failure that already happened, once, in a single evening.

## The test, so nobody has to judge "important"

> **Would another session build something different if it knew this?**
>
> **Yes → send it. No → don't.**

**"Important" is a judgement and everybody's differs, which is why a rule built on it silently
becomes a rule that nobody applies the same way.** The test above is about consequence, not
significance, and two people asking it about the same fact get the same answer.

## The six triggers

**1. An owner ruling — ALWAYS, and to the ledger as well.**

A ruling that lives in one session's transcript is a ruling every other session will unknowingly
re-open. **Cost on the day: the coordinator put a settled decision back to the owner as an open
question, with the option he had not chosen already recommended** — because his answer lived in a
thread it was not in.

> **Re-opening a settled decision is worse than missing work: missing work looks like a gap, and
> re-opening looks like diligence.** And it does not land randomly — **it drifts toward the cheaper
> build**, which is exactly the shape that needs a signature rather than a silence.

**2. Blocked — and this one has a required shape, because it is the trigger that goes wrong most.**

**Say WHAT is blocking you, named exactly. Never just that you are blocked.**

> _"I am blocked"_ costs a round trip and tells nobody what to do.
> _"Blocked on one field: `Admission` requires `homeRegion`, a movement carries none, none is
> derivable, and I will not derive it from the origin ED because where somebody was admitted from is
> not where they live"_ — **can be acted on the moment it arrives.**

**Five things, every time:**

|                                     |                                                                            |
| ----------------------------------- | -------------------------------------------------------------------------- |
| **1. What you were building**       | so the blocker can be judged against it                                    |
| **2. What stopped you — NAMED**     | the file, the field, the decision, the missing fact. Not the area          |
| **3. Who can unblock it**           | the owner, a named session, or **nobody yet — it needs finding out**       |
| **4. What you are doing meanwhile** | or **"nothing, I am idle"**, which is a fact the coordinator must have     |
| **5. What waiting costs**           | _"three sessions are behind this"_ is different from _"only I am waiting"_ |

**Say it the moment you hit it, not when you give up.** A blocker reported early is a question
somebody else can answer while you keep working. **A blocker reported at the end is an hour nobody
knew was being lost.**

### The mistake this trigger exists to prevent: saying "blocked" when ONE PART is blocked

**Task 17 was reported blocked on the owner. It was not — one FIELD of it was**, and the rest was
most of the work: the record existing at all, the reducer case, the `isOpen` consequence hiding
arrived patients from ten surfaces. **All of it buildable, none of it waiting on anything.**

> **Report the blocked PART, never the blocked TASK.** They are almost never the same size, and the
> difference is usually the difference between a session working and a session idle.

**And where a missing answer is only one field, build the rest and let the type tell you where the
answer lands.** That produces the exact list of places affected — which is worth more to whoever
answers than the question was.

### A blocked session that goes quiet is indistinguishable from one that is working

**This is the governing failure of the whole project, arriving in the coordination layer: an absent
signal reads exactly like a passing one.** Silence from a session looks identical whether it is deep
in a hard problem or has been stuck for an hour on something another session could have answered in
a sentence.

> **So silence is never the report.** If you are blocked and cannot say what on yet, **say that** —
> _"stopped, still working out what is in the way"_ is a real message and a useful one.

### Three kinds of blocked, because they have different remedies

**On a DECISION** — somebody must choose. Send it up **with a recommendation**, never as an open
question, and **check the ledger first in case it is already answered.**

**On another SESSION's work** — message that session **directly** as well as the coordinator, and say
what you would build the moment it lands.

**On a FACT nobody has** — this is the one people sit on, because it does not feel like a blocker,
it feels like not having looked hard enough. **Say it anyway.**

> **The tell, and it is the most useful sentence in this document:** _you go looking for something
> obvious, do not find it, and assume the failure is yours._

**Three of today's largest findings had exactly that shape, and all three nearly went unreported:**

- _"There is no Ward Flow `Patient` type"_ — two sessions were building against one.
- _"Catchment does not exist in the model"_ — ten broad regions where the documents hold a thousand
  suburbs.
- _"The coordinator's override reason is never recorded"_ — while a governance screen said it was.

> **Every one would otherwise have been discovered by somebody mid-build, with the design already
> committed.** The cost of reporting it is a message. The cost of not reporting it is a rebuild.

**And it is why this must be a RULE rather than a courtesy.** A courtesy is exactly what a busy
session skips when it does not want to seem presumptuous. **A rule removes the judgement about
whether it is your place to say it** — which was never the right question, because the finding is
about the work rather than about who owns it.

**3. Finished — because things are waiting that you cannot see.**

Four separate pieces of work unblock the hour Task 17 lands. **A session that finishes quietly leaves
three others idle for no reason.**

**4. A claim on work somebody else might also be doing.**

**Cost on the day: the same small fix was allocated to two sessions.** Neither erred — the claim had
been made **session-to-session**, which the coordinator cannot see. **It was caught only because the
second session declined rather than complying.**

**5. A finding that makes another session's work wrong.**

**Cost on the day, twice.** A patient search was built on a premise that did not hold. And two
sessions were told to add a name to a `Patient` type **that does not exist** — where the only
name-shaped guard sits on `Admission`, so the natural way to comply was the wrong move.

**6. Custody changing hands.**

A baton, a branch moving, a worktree released. **A registry row was 12 hours stale and gave a worktree
to the wrong session.**

## What NOT to send

**Never _"are you done?"_** — it interrupts the thing you are waiting for. Use `notify_when_idle`.

**Never a status update with no consequence.** Progress that changes nobody's work belongs in a
commit message.

**Never ask the coordinator to do something your own session was refused.** Permissions are per
session and routing around one is laundering it.

## Message the affected session TOO, not the coordinator instead

**A coordinator that must be routed through is a bottleneck, and a bottleneck gets bypassed** — after
which it is a stale picture that everyone still trusts. **So: tell the session your finding affects,
directly, and tell the coordinator as well.** The coordinator's job is that nothing is lost, not that
everything passes through it.

## What the coordinator owes back

**A reply that says what changed for you specifically**, not a broadcast. **A correction the moment a
previous instruction is wrong** — including _"stop, I was wrong"_, which happened three times on
2026-08-30 and was worth every interruption.

> **And a result that would ALARM somebody earns a broken-instrument check before it is sent.** An
> ordinary wrong fact costs a correction; an alarming wrong fact costs whatever the reader did about
> it.
