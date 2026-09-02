# Fourteen guards that do not guard — mutation-tested, 2026-09-03

**For the owner to prioritise. These are findings, not a work plan, and deliberately not fixes.**

Fifteen weak or missing test guards were confirmed by **running** a mutation against each and
watching nothing fail. One of them — 7.4 — is fixed in the same change as this document, because it
was the same defect as one already fixed hours earlier on a sibling privacy guard. **The other
fourteen are written down and left alone.** Opening fourteen fronts inside a pull request would be
deciding priorities that are the owner's to decide.

---

## How these were established, and why that sentence matters

Each finding began as a **reasoned** lead in `docs/ward-flow/triage/wf-build2-006-batch-{a,b,c}.md` —
read from the code, nothing executed. Those documents carry their own banner saying so. **This
document is what happened when 22 of them were actually run.**

| Verdict                                                                   | Count  |
| ------------------------------------------------------------------------- | ------ |
| **SURVIVED** — the mutation was applied and nothing went red. A real gap. | **15** |
| **EVAPORATED** — something caught it. The lead was wrong.                 | **6**  |
| **VOID** — could not be settled (no edit was ever written for it).        | **1**  |
|                                                                           | **22** |

**Finding 6.1 was excluded before the run**, because it had no written mutation, so it could not be
compared against a written prediction. **23 findings exist in total; 22 were testable.**

⚠️ **Every run reports its test COLLECTION COUNT, not just pass or fail.** A run reporting failure
with `Tests no tests` is a **parse error, not a caught violation**, and the two are indistinguishable
on a summary line. That mistake was made four times across this project in one night, in both
directions — a red that was a crash, and a green whose mutant never executed.

### ⚠️ The six that evaporated are the most useful result here

**Three of the six failed at the same step, and it was not the mechanism — it was the search for what
would catch it.**

- one lead's trace **missed a place-name detector** that checks site names and codes, not unit names;
- one grepped for a literal string and **missed a count-based guard** — a scenario test whose eligible-pair
  count moved 87 → 95;
- one claimed no positive control existed; a DOM test **had one embedded in its harness**, deliberately
  pairing a suburb with a mismatched home region.

> ⚠️ **A literal-string search cannot find a guard that COUNTS, one that pins a PLACE, or one that
> embeds its control inside a fixture. A search that cannot report its own blind spot reads exactly
> like a thorough one.**

That is why _"genuinely unguarded"_ was the wrong phrase in a document where nothing had been run,
and it is why these fourteen say **"this mutation survived"** rather than **"nothing guards this"**.

---

## The two that are about what a clinician READS

**These are different in kind from the twelve below. The rest are about structure — these two are
about the words on a screen.**

### 12.7 — clock wording can be inverted to the opposite clinical meaning, and stay green

**The mutation that survived:** the referral-clock text was changed to state the opposite of the
truth. **7 tests collected, nothing red.**

**Why nothing caught it:** the wording is pinned **only negatively** — the assertions check that it
contains no digit, does not match `arriv`, and is not empty. **Nothing asserts what it must say.** A
sentence implying a patient has already arrived when they have not satisfies every one of those
conditions.

**What a catcher would have to do:** assert the rendered text against the _state it describes_ —
for a patient not yet arrived, the text must positively say so — rather than listing forbidden
substrings. ⚠️ **A denylist can only ever fail the wordings somebody already thought of.**

### 8.1 (legal-figure guard) — a claim written as plain JSX text is invisible to the scanner

**The mutation that survived:** a legal claim was rendered as ordinary JSX text rather than as a
string literal. **52 tests collected, nothing red.**

**Why nothing caught it:** the shared AST literal-extractor never visits `JsxText` nodes. It sees
string literals and template literals only. **So the scanner that exists to stop unauthorised legal
claims reaching a screen cannot see the most natural way of putting text on a screen.**

**What a catcher would have to do:** extend the extractor to `JsxText`, then re-run every existing
legal-figure assertion against the widened corpus — ⚠️ **and expect real failures, because the corpus
it has been checking was never the whole corpus.**

---

## The twelve about structure

### 13.5 — three independent evasions of the ward-only module firewall

Three separate mutations, each surviving with **13 tests collected**: a **dynamic `import()`** call, a
**rest-element destructuring** (`...flow`) of the shared context, and a **union-typed parameter**
(`Referral | undefined`) all reach forbidden material without the guard noticing. Each defeats it by
a different route, so each needs its own catcher.

### 7.4 — _fixed in this change, listed for completeness_

The D15 firewall's import scan never matched `export { X } from "…"`. ⚠️ **The same defect, on a
different privacy guard, as one fixed hours earlier.** Two guards written by different hands failing
on the same statement form is **one wrong assumption about what an import looks like, made twice.**

### 6.9 — an empty-destinations rejection that does not stop

`RECEIVE_REFERRAL`'s rejection for an empty destination list can be made to record the rejection and
then **fall through anyway**, creating a referral with `destinations: []`. **73 collected, nothing
red.** A catcher must assert the state _after_ the rejection, not merely that a rejection was
recorded.

### 8.6 — the producer scan is not comment-stripped

The check that a field is genuinely written can be satisfied by writing `false, // field:
event.field` — the real write commented out beside a hardcoded value. **162 collected, nothing red.**

### 1.5 / 14.4-B — the only "not known" label can be emptied

`suburbUnknownLabels.not_known` is the sole member of its map and nothing distinguishes a real label
from `""`. **17 collected, nothing red.** The test compares the label against itself.

### 6.8 — a shallow clone would alias every referral's destinations

`seedWardFlowState` swapping `structuredClone` for a per-referral spread makes every seeded state
share one `destinations` array. **522 collected, nothing red.** ⚠️ **Latent — nothing exploits it
today**, which is exactly why nothing fails.

### 11.5 — `Math.max` and `Math.min` are indistinguishable in the fixtures

`referralDecidedAt` can swap one for the other and no test notices, because **every fixture referral
has at most one decided destination.** **150 collected, nothing red.** A catcher needs a fixture with
two.

### 8.2 (legal-figure guard) — one word defeats the phrase scan

The "form required" check is a bare lowercase substring match, so **"form is required"** passes.
**7 collected, nothing red.**

### 8.4 — most change-reason labels are guarded only by truthiness

Of thirteen codes, most are checked only for being non-empty, so **two reasons can be worded
identically** and nothing notices. **26 collected, nothing red.**

### 13.7 — three of six role labels have no text pin at all

`officer`, `demo` and `community` decision labels are checked for truthiness only; the other three
have real wording pins elsewhere. **4 collected, nothing red.**

### 8.5 — `URGENT_MARK_REASONS` order is never pinned

Only membership and a sorted-key comparison are checked, so the displayed order can be scrambled.
**11 collected, nothing red.** Five similar lists nearby _do_ pin their order.

### 9.6 — the print-CSS check runs to end-of-file

The test slices from `@media print {` to the end of the stylesheet rather than to the block's real
closing brace, so **any rule added after it is silently swept in.** **6 collected, nothing red.**

---

## One honesty note from the run

A test failed **once** inside a 17-file combined run and **did not reproduce** on re-run, either with
the same two files or alone. ⚠️ **It was counted neither way.** A failure that vanishes on re-run is
precisely the thing that gets quietly recorded as a catch, and it is not evidence in either
direction.

## What is deliberately not here

- **Fixes.** Every finding above is a gap, not a change.
- **A rate.** Numerator and denominator only: **15 of 22**. A percentage would invite comparison
  against a denominator nobody has checked — and the "24 findings" figure everyone repeated for a day
  was itself wrong; there are 23, of which 22 were testable.
