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

**2. Is "predicted" one thing, or several? — WE CHANGED THE AXIS, and the words need your check**

We used to offer two levels of confidence, "likely" and "possible", while a discharge was
predicted. We no longer do. Asking a ward to estimate a probability turned out to be the wrong
question — two wards' "likely" do not mean the same thing, so a coordinator cannot compare them or
add them up. A predicted discharge now records **what it is still waiting on** instead, which is a
fact rather than a judgement.

**The words currently on the screen are these, and they are the thing we most want you to correct.**

_What a predicted discharge is waiting on:_ Awaiting ward round · Awaiting family or carer
agreement · Awaiting accommodation · Awaiting community team acceptance · Nothing outstanding.

_Why a decided discharge is stuck:_ Awaiting clean · Awaiting pharmacy · Awaiting placement
confirmation · Awaiting service coordination · Awaiting accommodation · Awaiting transport ·
Awaiting receiving-service acceptance · Awaiting family or carer arrangement.

_What a bed that is already free is being made ready for:_ Being cleaned · Awaiting maintenance or
repair.

**Read the provenance carefully, because it matters.** These words were **proposed by us and
approved by the product owner. No charge nurse has seen them.** They are an approved proposal, not
a validated vocabulary — which is exactly why they are in front of you now. If a ward says
something different, the ward's words replace ours exactly as spoken.

Two specific things worth your eye. "Nothing outstanding" exists so a ward is never forced to name
an obstacle that does not exist. And "Awaiting family or carer arrangement" was deliberately added
against our own earlier rule that a reason must describe the bed and not the person — because a
discharge nobody can collect is a real reason a bed is not coming free, and excluding it only made
wards record a different reason that was wrong.

**3. Does a bed ever go backwards? — ANSWERED, and we changed it**

We used to assume the stages ran one way. They now go both ways: a confirmed discharge can return
to merely predicted when the decision is reversed, and the reversal is recorded like any other
change. The old rule never stopped reversals happening — it just meant a ward had to record them
dishonestly.

---

## Other things worth a moment

- **We look 24 hours ahead, rolling.** Anything expected beyond that is left out of every count,
  and the screen says how many were left out. This changed on 2026-08-29: we used to stop at the end
  of the evening, which meant the window quietly shrank as the day went on — fourteen hours at the
  morning handover, two by late evening. Since patients move at any hour, that described the clock
  rather than how far ahead anyone can predict. **Is a rolling day the right horizon?**

- **The board shows who confirmed a number and when** — as a role, never a person's name. Is
  knowing "which ward said this, and how long ago" enough to trust a number, or would you need more?

- **Beds on leave are counted separately** and never mixed into the available figure, because a bed
  someone is coming back to is not a bed you can fill.

---

## Three more assumptions, added 2026-08-29

These are newer than the rest of this page and **none has been seen by a ward clinician either.**
They matter because the next part of the prototype — a board showing every bed on a ward — is built
on them.

**4. A bed is gone the moment the ward pulls the patient, not when they arrive.**

We assume that once a ward says "send them", that bed is no longer available to anyone else — even
if the person is still sitting in an emergency department waiting for an ambulance. So the ward's
free-bed count drops at the moment of pulling, and the bed shows as taken but empty, with a clock on
it saying how long it has stood empty.

**Is that right?** And is the gap between pulling someone and them arriving a number worth seeing —
we currently show it as "beds standing empty, longest four hours".

**5. One expected discharge date per patient, set by the ward, drives everything else.**

Rather than a ward flagging beds separately, we assume the ward puts a date against each patient and
everything follows from it — the predicted discharge, the board, the counts. Confirming that someone
is definitely going is a **separate act** from setting the date.

**Is a date the thing a ward would actually keep up to date?** We have assumed one update a day, in
under a minute for a twenty-bed ward, and that the only thing usually changing is who is leaving.

**6. The ward tells us how many of its free beds will take a man, and how many a woman.**

We could not work this out. A ward has one designation, so the system can only ever say "none of
these beds will take a man" — never "one of the three will", which is the situation that actually
matters. So we assume the ward states the two numbers itself, once a day, on the same sheet.

**Is that a fair thing to ask a ward for daily, or is it already written somewhere we should read
instead?**

**Two more lists with the same provenance problem as the ones above** — proposed by us, approved by
the product owner, seen by no charge nurse:

_How long someone has been in a bed, as bands:_ under 2 weeks · 2 weeks to 1 month · 1 to 3 months ·
over 3 months.

_Why a coordinator overrode the suggested bed:_ receiving team agreed despite the mismatch · clinical
urgency outweighs it · bed information known to be out of date · continuity with a previous admission
· closer to home or family. **There is deliberately no "other" option** — the alternative was a free
text box, and we would rather a coordinator picked the nearest reason than have anyone's words end up
in this system.

---

## What we'd like back

Nothing written. Just, in conversation:

1. Do the three stages, plus a blocked flag, describe something you recognise?
2. **Are those the right words?** — the three lists in question 2 above. This is the one we cannot
   answer for ourselves. We have shipped an approved proposal so there is something concrete to
   react to, not because the question is closed. Wrong entries, missing entries and better wording
   all replace ours.
3. Which of the three questions above still has the wrong answer in our version?
4. Is there a stage we've missed entirely?
5. **Is a bed really gone at the moment of pulling?** (question 4 above)
6. **Would a ward keep one discharge date per patient up to date daily?** (question 5)
7. **Is asking a ward for its two sex-acceptance numbers each day reasonable?** (question 6)

**Changing this now is cheap.** Everything is invented data and nothing depends on it yet. The next
part of the prototype is built entirely from these numbers, so the cost of getting it wrong rises
sharply once that exists — which is why we're asking first. The 2026-08-28 change above cost about
a day; the same change after two more parts are built on top would not.

---

_This describes a prototype for thinking with. It is not clinical decision support, it contains no
real patient information, and it makes no statement about any legal requirement._
