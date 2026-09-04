# ⚠️ Two hard blocks found, both the omission form, and the engine enforces neither

**Found by Ward Builder Two, 2026-09-02, committed `df84e9153`. Measured in the running app at
`localhost:4215`, not inferred. Evidence class: OBSERVED.**

**The owner's ruling they violate, verbatim, his exclamation mark:**

> _"It will send a refusal.. however... the referral can still be sent if the referrer gives a
> reason. **No referral locations are to be completely blocked !**"_

## The block: `eligibleCandidatesAmong`, `ward-derivations.ts:482`

It does **two separate things**, and both are blocks:

### ⚠️ 1. It filters by cohort BEFORE eligibility is computed

```js
.filter((unit) => unit.cohort === movement.cohort)
```

**A ward of the wrong age group never gets a verdict at all.** It is not shown as unsuitable — **it
is absent.**

⚠️ **AND THAT IS WHY IT CANNOT BE OVERRIDDEN. The override path only exists for things that appear.**
A ward with a verdict of "not eligible" can be overridden with a recorded reason, exactly as the owner
ruled. A ward that was filtered out before the verdict was computed **has no verdict to override, no
control to press, and no name on the screen.** The reason path and the omission path are mutually
exclusive by construction.

### 2. It truncates to three

```js
.slice(0, limit)          // both coordinator surfaces pass PARALLEL_REFERRAL_CAP
```

**Only three wards are ever offered. For an adult patient that leaves 13 of the state's 16 adult
wards unchoosable.**

⚠️ **My reading, flagged as mine and not Ward Builder Two's:** `PARALLEL_REFERRAL_CAP` is a rule about
**how many wards you may refer to AT ONCE**. Applying it to the CANDIDATE LIST conflates _how many you
may pick_ with _how many you may see_. **The cap on simultaneous referrals is legitimate; the cap on
visible destinations is the block.** Those are two different numbers that happen to share a constant.

## ⚠️ The finding that makes this a UI block rather than a rule

`REFER_TO_UNITS` (`ward-flow-reducer.ts:735-757`) checks closure, the parallel cap, the stage, that
the unit exists, and that the override reason is on the list.

⚠️ **IT CHECKS COHORT NOWHERE. The engine would happily refer an adult to a youth ward.**

**So no rule forbids these destinations. The only thing making them unreachable is a list.** That is
the whole finding: **the constraint lives in a `.filter()` nobody would call a policy, and the layer
that is supposed to hold policy has no opinion about it at all.**

## Third finding, same class

**The state's only youth ward can never be reached in the demo, because 0 of the 43 queued patients
are young people.** Control: the same filter found 12 older-adult rows. ⚠️ **A pathway nobody can look
at** — the same shape as the two-armed-referral gap, and it goes to the owner with it.

## What was clean

**The attribute form — `disabled` / `aria-disabled` — is clean.** 13 files matched, 13 opened, search
and sweep the same set, control found a known placeholder at `ward-management-console.tsx:268`. Two
rule-shaped blocks, **each naming its own route in the code**: Refer → Override, Withdraw → the ward's
own Decline. **No permanent attribute-level block anywhere.**

⚠️ **The least interesting result and the most instructive one: the form everybody can grep for was
fine, and the form nobody greps for held both blocks.**

## ⚠️ A control failed and the first number was thrown away

Ward Builder Two's first unit count came from a regex **whose control could not find
`rph-adult-secure` — a ward it had just seen on the screen.** It discarded the figure, wrote a second
parse, controlled that against four known wards, and reported the second one's numbers: **23 wards —
16 Adult, 6 Older adult, 1 Youth.**

**A false zero caught by its own control inside an hour of the rule being written.**

## What is NOT established

⚠️ **Only two surfaces were checked** — the coordinator shortlist and the morning tour. The morning
tour dispatches `REFER_TO_UNITS` with a hardcoded unit id, so it is a scripted demo and not a route
around the block. **If some other screen offers a free unit picker, this is a UI gap rather than a
hard block.** That is the one thing left to falsify and it should be falsified before the fix.
