# How we've modelled a bed coming free — does this match reality?

**One page. No software knowledge needed. Five minutes.**

We're building a prototype that helps a bed coordinator see where there is a bed right now. It
holds no real patient information — everything in it is made up. Before we build the next part on
top of it, we want to know whether the way we've described a bed becoming free actually matches how
it works on a ward.

**You are not being asked to check software.** You are being asked whether four words, and the
order they come in, describe something real.

---

## What we assumed

We assumed a bed becomes free by passing through four stages, in this order:

| Stage         | What we mean by it                                                              |
| ------------- | ------------------------------------------------------------------------------- |
| **Predicted** | Someone on the ward thinks this person will probably go home, and roughly when. |
| **Confirmed** | It is now decided. They are going. The bed will come free.                      |
| **Blocked**   | It was going to happen, and something is now stopping it.                       |
| **Released**  | The person has actually left. The bed is empty and can be filled.               |

Only the ward can move a bed between these stages. The bed coordinator can see them but cannot
change them — they can only ask a ward to update its numbers.

We also assumed that a **predicted** bed is never counted as available. A coordinator looking for a
bed today sees only beds that are genuinely empty now, with predictions shown separately alongside.

---

## The three things we think are most likely wrong

**1. Can a bed be confirmed and blocked at the same time?**

We've treated these as separate stages, so a bed is in one or the other. But in reality a discharge
might be decided and simultaneously stuck — the decision is made, transport isn't available. Is
"blocked" a stage that replaces "confirmed", or is it a flag that sits on top of it?

**2. Is "predicted" one thing, or several?**

We've used one word. A charge nurse might distinguish between "we're thinking about it on the ward
round", "the family have been told", and "we're waiting on one thing before we commit" — which
sound like quite different levels of confidence to plan against.

We do offer two levels of confidence, "likely" and "possible", but only while a discharge is
predicted. Is that the right split, or the wrong axis entirely?

**3. Does a bed ever go backwards?**

We've assumed the four stages run one way. Does a confirmed discharge ever return to being merely
predicted — the decision is reversed, the person stays? If so, that needs building in.

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

1. Do the four stages describe something you recognise?
2. Which of the three questions above has the wrong answer in our version?
3. Is there a stage we've missed entirely?

**Changing this now is cheap.** Everything is invented data and nothing depends on it yet. The next
part of the prototype is built entirely from these numbers, so the cost of getting it wrong rises
sharply once that exists — which is why we're asking first.

---

_This describes a prototype for thinking with. It is not clinical decision support, it contains no
real patient information, and it makes no statement about any legal requirement._
