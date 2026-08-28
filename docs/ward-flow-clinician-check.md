# How we've modelled a bed coming free — does this match reality?

**One page. No software knowledge needed. Five minutes.**

We're building a prototype that helps a bed coordinator see where there is a bed right now. It
holds no real patient information — everything in it is made up. Before we build the next part on
top of it, we want to know whether the way we've described a bed becoming free actually matches how
it works on a ward.

**You are not being asked to check software.** You are being asked whether three words, and the
order they come in, describe something real.

> **Updated 2026-08-28.** An earlier version of this page described FOUR stages, with "blocked" as
> the third. Two of the three questions below were answered in the meantime — not by a ward
> clinician, but by the psychiatrist who owns the product — and the prototype was changed to match
> before anything else was built on top of it. Those two questions are marked **answered** and left
> in place rather than deleted, so you can see what changed and disagree with it if we got it
> wrong. The rest of the page is still a genuine question.

---

## What we assumed

We assume a bed becomes free by passing through three stages, in this order:

| Stage         | What we mean by it                                                              |
| ------------- | ------------------------------------------------------------------------------- |
| **Predicted** | Someone on the ward thinks this person will probably go home, and roughly when. |
| **Confirmed** | It is now decided. They are going. The bed will come free.                      |
| **Released**  | The person has actually left. The bed is empty and can be filled.               |

Each stage says only **how certain the discharge is**. Separately from the stage, a discharge can
be marked **blocked** — it was going to happen and something is now stopping it, with the hold-up
chosen from a short list. A discharge can be confirmed and blocked at the same time, and when it
is, it still counts as a confirmed discharge; the screen shows how many are stuck beside it.

A bed may also carry a note that it is **being made ready** — cleaned, for instance. That note is
information only. It never stops a bed being offered or counted, because pulling the next patient
takes hours anyway, so the bed is fillable from the moment the person leaves.

Only the ward can move a bed between these stages, mark it blocked, or say it is being made ready.
The bed coordinator can see all of it and change none of it — they can only ask a ward to update
its numbers.

We also assume that a **predicted** bed is never counted as available. A coordinator looking for a
bed today sees only beds that are genuinely empty now, with predictions shown separately alongside.

---

## The three things we think are most likely wrong

**1. Can a bed be confirmed and blocked at the same time? — ANSWERED, and we changed it**

We used to treat these as separate stages, so a bed was in one or the other. That was wrong, and it
was wrong in a way that mattered: marking a confirmed discharge blocked made it disappear from the
ward's confirmed count altogether, so the numbers looked better at the exact moment the ward got
stuck.

"Blocked" is now a flag that sits on top of a predicted or confirmed discharge, not a stage that
replaces it. **Still worth telling us if that is not how it feels on a ward.**

**2. Is "predicted" one thing, or several?**

We've used one word. A charge nurse might distinguish between "we're thinking about it on the ward
round", "the family have been told", and "we're waiting on one thing before we commit" — which
sound like quite different levels of confidence to plan against.

We currently offer two levels of confidence, "likely" and "possible", but only while a discharge is
predicted. Is that the right split, or the wrong axis entirely?

**This is the question we most want answered.** The current thinking is that asking a ward to
estimate a probability is the wrong question — two wards' "likely" do not mean the same thing, so a
coordinator cannot compare them — and that the useful thing to record is **what the discharge is
still waiting on**, chosen from a short list. That list does not exist yet, and nobody will invent
it: it has to come from someone who works on a ward. **What would be on it?** The same list would
name the reasons a discharge is blocked, because they are the same question asked at two moments.

**3. Does a bed ever go backwards? — ANSWERED, and we changed it**

We used to assume the stages ran one way. They now go both ways: a confirmed discharge can return
to merely predicted when the decision is reversed, and the reversal is recorded like any other
change. The old rule never stopped reversals happening — it just meant a ward had to record them
dishonestly.

---

## Other things worth a moment

- **We stop at the end of today.** Anything expected after this evening is deliberately left out of
  every count, and the screen says how many were left out. We took the view that beyond roughly a
  day, a discharge prediction is a guess. Is a day the right horizon, or too short?

- **The board shows who confirmed a number and when** — as a role, never a person's name. Is
  knowing "which ward said this, and how long ago" enough to trust a number, or would you need more?

- **Beds on leave are counted separately** and never mixed into the available figure, because a bed
  someone is coming back to is not a bed you can fill.

---

## What we'd like back

Nothing written. Just, in conversation:

1. Do the three stages, plus a blocked flag, describe something you recognise?
2. **What is on the list?** — the things a discharge waits on, and the things that block one.
   This is the one we cannot answer for ourselves, and nothing further gets built until it exists.
3. Which of the three questions above still has the wrong answer in our version?
4. Is there a stage we've missed entirely?

**Changing this now is cheap.** Everything is invented data and nothing depends on it yet. The next
part of the prototype is built entirely from these numbers, so the cost of getting it wrong rises
sharply once that exists — which is why we're asking first. The 2026-08-28 change above cost about
a day; the same change after two more parts are built on top would not.

---

_This describes a prototype for thinking with. It is not clinical decision support, it contains no
real patient information, and it makes no statement about any legal requirement._
