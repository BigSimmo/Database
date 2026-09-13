# Allocation B, corrected — I counted a proxy and got the wrong three files

**Ward Lead's retraction, 2026-09-02, measured at `cf9d87e1f`. Ward Verifier's adversarial check
refuted two thirds of an allocation I had already sent to two chats.**

## What I claimed, and it was wrong

> _"NINE files dispatch those three events… and three of them — `ward-screen.tsx`,
> `ward-board.tsx`, `out-of-area-board.tsx` — contain ZERO occurrences of 'rejection', against a
> control of 17 files repo-wide that do."_

⚠️ **I grepped for the event NAMES and counted the files that matched. That is a proxy for
"dispatches a placement event", and it is not the thing.** The match set includes the reducer that
handles the events, the module that defines them, and files that dispatch a _different_ event in the
same family.

## What is actually true

| File                                | Reality                                                                                                                                                                      |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `out-of-area/out-of-area-board.tsx` | ⚠️ **Dispatches NOTHING. Zero event types.** Its zero-rejection count is trivially true and proves nothing — a file with no dispatch has no reducer answer to read.          |
| `board/ward-board.tsx`              | Dispatches three events, **none of them placement**: `RECORD_AWAY_AT_EMERGENCY_DEPARTMENT`, `RECORD_LEAVING`, `RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT`. Nothing to guard. |
| `ward/ward-screen.tsx`              | ✅ **CONFIRMED, and worse than I said.**                                                                                                                                     |

**The count does not reproduce either.** Searching the three placement events across `src` returns
**8 files, two of which are the reducer and the event definitions — so roughly four real dispatching
screens.** ⚠️ **A figure published without its definition cannot be checked, and mine could not be.**

## ✅ The one that survives, strengthened

`ward/ward-screen.tsx` dispatches **15 event types, more than any other file**, including
`ACCEPT_IN_PRINCIPLE` and `PULL_PATIENT`. On the whole term family rather than one spelling:

```
rejection 0 · reject 0 · error 0
refus 10 · declin 63 · blocked 47 · unavailable 11 · cannot 6 · fail 3
CONTROL: 'movement' 96 present · 'zzzabsent' 0
```

⚠️ **It is drenched in refusal language and contains not one reference to what the reducer
returned.** That is stronger than a bare zero: the screen is not silent about refusal — **it talks
about refusal constantly, in its own local vocabulary, while never reading the engine's answer.**

## ⚠️ The control I did not run, which is the one that decides it

Mine was _"17 files repo-wide contain the word"_. **That cannot distinguish "this screen ignores
rejections" from "no screen mentions them, because they are handled centrally."** The right control
is comparable dispatchers:

```
shortlist-panel.tsx    7 events · rejection  3
morning-tour.tsx       7 events · rejection 22
ward-screen.tsx       15 events · rejection  0   <- the outlier
CONTROL: exception-drawer.tsx        rejection 15
```

**Zero is not the norm. The finding survives the control that could have killed it** — which is the
only kind worth keeping.

## ⚠️ And the part neither of us had, which is the real defect

**`ExceptionDrawer` — the only surface that renders refusals — is imported in exactly one place:
`coordinator/coordinator-screen.tsx:14`, rendered at `:257`.** It is not global. **It belongs to the
coordinator.**

So when a ward screen dispatches `PULL_PATIENT` and the reducer refuses it, the refusal lands on
`state.rejections` — **and the only surface rendering that list is on a different screen, belonging
to a different role, that the ward user is not looking at.** ⚠️ **The ward user sees nothing. Not a
muted warning, not a stale value. Nothing.**

Paired with Ward Verifier's V9: **on the coordinator's screen the warning exists but reaches the user
only as a hover tip and is never repeated at the moment of committing; on the ward screen there is no
warning surface at all and the refusal has nowhere to appear.** ⚠️ **Under the owner's "keep advising
and let the clinician decide" ruling, one screen advises badly and the other cannot advise at all —
and his ruling was made about the screen that at least has the machinery.**

## Allocation B, as corrected

1. **`ward/ward-screen.tsx` alone.** The other two files need nothing.
2. **Mount a rejection surface the ward role can actually see** — same item, because a screen that
   reads `state.rejections` with nowhere to render them is the same defect one layer along.
3. **V9's commit-moment warning**, which is the coordinator half of the same gap.

⚠️ **A AND B STILL MUST NOT SHIP APART.** A reducer that refuses while the ward screen claims success
is strictly worse than today, and this correction makes that sharper rather than softer: the ward user
has no surface at all on which a refusal could appear.

## What I take from getting it wrong

**Measure the thing, not a proxy** — count dispatch sites, not files matching an event name.
**Publish a figure with its definition** or it cannot be checked, and mine could not be.
**A control must be able to kill the finding.** "17 files somewhere contain the word" could not;
"comparable dispatchers reference rejections and this one does not" can, and did not.
