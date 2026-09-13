# ⚠️ A test was one approval away from being deleted. The premise was wrong by 30 assertions.

**Ward Lead's independent check, 2026-09-02, at `cf9d87e1f`. VERDICT: NOT SAFE TO DELETE.**

## The claim, and what was actually there

The proposal: _"the test at `tests/ui-ward-morning.spec.ts:41` is almost entirely about a removed
feature; its ONE surviving assertion is already covered by an existing DOM test."_

⚠️ **The test has 31 assertions across 125 lines.** The checker flagged that mismatch as a finding in
its own right: whoever formed the claim may have been reading an already-trimmed draft rather than
the file on disk. **That is a pipeline defect, not a carelessness one, and it is worth more than the
individual call it nearly produced.**

## ⚠️ What deletion would have destroyed — each the only proof of its kind in the repository

| Assertion                      | What it proves                                                                               | Why nothing else covers it                                                                                                                                                                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **#28** (`:143`)               | `ward-morning-page` visible after clicking the real **"Morning bed state"** rail link        | ⚠️ `grep -rln "Morning bed state" tests/` returns **only this file**. The only real client-side navigation to the morning page anywhere. **`gotoMorning()` does not substitute — it uses `page.goto()`, a different code path from a `<Link>` click.** |
| **#26 / #30** (`:135`, `:161`) | `ward-queue-view` visible after clicking "Priority queue"                                    | That testid appears nowhere else. The nearest neighbour (`ui-ward-management.spec.ts:86-87`) checks a **different** testid from a **different** route.                                                                                                 |
| **#15/16/18/19/21/22**         | Unit `confirmedToday`/`expectedToday` figures **re-rendering on screen** off a live dispatch | The tour's dom test reads a synthetic `state-probe` attribute; `ward-bed-release-lifecycle.test.ts:323` proves arithmetic on the returned object. ⚠️ **Neither touches the rendered page.**                                                            |
| **#4**                         | Headline visible                                                                             | The one item with a genuine near-equivalent — and even that is a jsdom `toBeInTheDocument()`, weaker than a real-browser `toBeVisible()`.                                                                                                              |

## What IS genuinely dead

The fixed/live toggle (#1-3, #5-8, #10) and the beat labels (#11-14, #17, #20, #23-25). **Confirmed
independently in source, not taken on report:** `ViewControl()` is defined at
`morning-page.tsx:470-499` and **never invoked**; `morning-page.tsx:113-114` reads
_"ONE VIEW, ALWAYS LIVE (WB-DB-11, owner decision)"_.

⚠️ **But the tour is PAUSED, NOT REMOVED** — `morning-page.tsx:122-136` says so explicitly. So those
assertions are **unreachable, not obsolete**, and a comment saying "the tour was removed" would be
false. Whoever un-pauses it needs to know these existed.

## ⚠️ The subtlest case: deleting them would overrule a recorded decision

Assertions #27/#31 (WF-901 absent after navigation) **are** covered at the reducer level by
`ward-morning-tour.dom.test.tsx:297-353` — via a **simulated** `rerender()` unmount. But this file's
own doc comment at `:146-152` says that gap is why it was written:

> _"until now that has only ever been proven with a simulated re-render, never a live navigation.
> This is the Critical defect this phase fixed."_

⚠️ **The author judged the DOM version insufficient and wrote the reason down. A deletion on
"it's covered elsewhere" would silently reverse a decision that was explicitly recorded.**

## The ruling

**REWRITE, DO NOT DELETE.** Strip the toggle and tour assertions; keep #4, #26, #28, #30. ⚠️ **And
rename it** — it stops being "the tour drives the board" and becomes "the morning page renders and
the rail navigates". _A test whose name describes work it no longer does is the next person's stale
finding._

**The figure assertions leave a real coverage hole** and it gets a register row rather than a silent
absorption. **Not rebuilt tonight:** reaching them needs a dispatch past the eligibility gates — the
exact harness Ward Builder Three is about to make refusable — and a harness that silently failed
those gates would assert nothing while looking like coverage.

## Why the absences are trustworthy

The checker ran a **blind whole-directory grep for `ward-morning-headline` FIRST**, found a hit it
did not know existed, then applied the identical technique to every other string. ⚠️ **The NOT
COVERED results rest on a method already proved able to find things** — which is the standard this
project adopted an hour earlier after two searches produced a false zero and a false nine.

## The transferable part

⚠️ **"Nothing else covers it" and "nothing imports it" are the same claim in different clothes, and
this repository has a standing rule that the second is never sufficient.** The rule now reads for
both: **a claim that removes something gets checked by somebody who did not form it.**
