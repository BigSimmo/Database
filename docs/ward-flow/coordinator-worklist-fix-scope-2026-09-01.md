# What `1b86cee6e` closes, what it does not, and what nobody can see yet

Written 2026-09-01 by Ward Builder Two, before the branch was folded, because the commit subject
overclaims and `git log` is where subjects get read.

## The subject overclaims

> `fix(ward-flow): an accepted community arm was hiding a bed request nobody had answered`

Unqualified, that reads as _the vanishing-patient class is closed_. **It is not. Only its
unreachable half is.** The commit body and the in-code comment both say so, but several paragraphs
down, and a reader who stops at the subject gets a stronger impression than the truth. The subject is
left as it stands rather than amended — rewriting a subject to look better in hindsight is a worse
habit than a subject that overclaims, and this file is the correction.

## ⚠️ First, the fact that reframes everything below

**No production code consumes `coordinatorWorksReferral` or `coordinatorWorklistReferrals`.** Verified
at `d79420fbf` against `HEAD` rather than the working tree, with a positive control:

    git grep -l "coordinatorWorksReferral" HEAD
    → src/components/ward-management/ward-referral-visibility.ts   (its own definition)
    → tests/ward-referral-screen-boundary.test.ts
    → tests/ward-referral-visibility.test.ts

The control: `git grep -c "referralQueueOrder" HEAD -- src` finds five production files, so the search
mechanism works and the absence is real rather than a broken query.

**So neither the defect nor its fix is visible to any user today.** No screen asks this predicate which
referrals are coordinator work; the referral board renders `referralQueueOrder` instead. Everything
below is a statement about the model layer, and becomes user-facing only when the coordinator work
list is wired to `coordinatorWorklistReferrals` — which is half two of `WF-BUILD2-001` and still
awaiting the owner's ruling on scope.

**This is recorded because it was got wrong in this session.** The reachable defect below was reported
to the owner and to two other chats as something that happens today. It does not. It is real, it is
reachable in the model, and it will be user-visible the moment the screen is wired — but "a patient
vanishes from the coordinator's board" was a claim about a board nobody has built yet.

## What the fix closes

`coordinatorWorksReferral` branch 2 previously let a single accepted arm decide alone. With one
accepted `community_team` arm — a discharge follow-up, which points downstream — the predicate
answered "not coordinator work" and returned `false` **even when a `psychiatric_ward` or
`emergency_department` arm was still `queued`**. Branch 2 now reads the queued arms first.

**That shape cannot be produced by the reducer.** `ACCEPT_REFERRAL` cancels every still-queued
destination when any arm accepts, and its single exemption is keyed on the CANDIDATE's kind
(`candidate.destination.kind === "community_team"`), not the accepter's — so a community acceptance
still cancels a queued ward or ED arm on the way past. The shape reaches the predicate only from a
hand-written fixture, a hand-built object, or legacy data.

So the fix is **defensive**: correct, tested, and guarding a door currently locked from the other side.

## What it does NOT close — reachable in the model today

A **coordinator** may accept a community arm. `answerableBy` (`ward-flow-reducer.ts`, ~`:2013`) maps
only `ward` and `ed`, so `ownKind` is `undefined` for the coordinator and the guard
`if (ownKind !== undefined && …)` passes rather than refusing. **That exemption is deliberate and
ruled** — `CO-D2`, recorded 2026-08-30 — not an oversight. The comment eleven lines above the map says
so and gives the parallel that the coordinator may likewise cancel a transport it did not book.

Accepting the community arm then cancels the queued ED arm. The referral becomes
`{ED: cancelled, community: accepted}`: one accepted arm pointing downstream, and **no queued arms at
all**. Branch 2's new queued-arm read finds nothing live, so the referral is not coordinator work.

Once the work list is wired, that is a patient physically in an emergency department, waiting for a
psychiatric review, dropping off the coordinator's list because a community team accepted their
discharge follow-up — with no record of anyone having refused the review.

⚠️ **Three individually correct rules compose into it.** The coordinator may answer any arm (`CO-D2`);
the first acceptance cancels the siblings (FD-22); a referral with nothing arriving still live is not
coordinator work (the direction criterion, owner, 2026-09-01). No single rule is wrong, which is why
no single file looks guilty.

## Where the remaining fix goes — and where it must not

- **Not in this predicate.** Hiding a referral whose only live arm points downstream IS the ruling.
  Special-casing a `cancelled` arriving arm back into visibility would resurrect exactly the class the
  direction criterion was written to remove.
- **Not in the role map**, without reopening `CO-D2`.
- **In `ACCEPT_REFERRAL`'s cancellation**, which is Ward Lead's file and is owner question 7.

The proposal on the table (Ward Verifier, 2026-09-01) is that **an acceptance of a `leaving`
destination should cancel nothing** — the symmetric half of the ruling that already protects a
community arm from being cancelled by somebody else's acceptance. Its stated reason is symmetric and
the code is not: _"FD-22 is about destinations racing for the same placement; a follow-up team is not
in that race."_ A team not in the race cannot be knocked out of it, and cannot win it either.

## ⚠️ The sequencing, which is load-bearing

Verified by Ward Lead on both trees, 2026-09-01, side by side rather than reasoned about:

- **Symmetry fix WITHOUT this commit** → the ED arm survives as `queued` beside the accepted community
  arm, branch 2's old precedence answers from the accepted leaving arm alone, and the referral is
  hidden. **A correct change introducing a defect**, in a change made specifically to prevent that
  defect.
- **This commit first** → branch 2 sees the live arriving arm and the referral stays. Nothing extra to
  build.

**So this branch folds before any symmetry change.** On the day that change lands, the shape this
commit guards stops being unreachable and becomes what the reducer produces — the fix stops being
defensive and becomes the thing keeping the patient on the board.

That same day retires the seeded-data guard in `tests/ward-referral-visibility.test.ts`, which forbids
a pairing that will have become legitimate. Both deletion triggers are named at the guard itself
rather than left to be discovered when it goes red for the right reason.

## How this was found, which is the transferable part

The sequencing was not found by analysis. It was found because the symmetry argument **removed a
decision from the owner's queue**, and trap 5 in `docs/ward-flow/traps/silent-transforms.md` says that
is the shape which gets checked least. The check it prescribes took one question: _what happens to my
branch under the new reducer?_ Nobody had asked it, including me, until the relief was the tell.

The no-consumer fact above was found the same way — by asking what a behaviour change could possibly
affect, and discovering the answer was nothing yet.
