# The undeclared-token defect, RENDERED — the only sighting there will ever be

**Observed 2026-09-02 by Ward Builder Three, by accident, on a worktree 136 commits behind master.**
⚠️ **It cannot be reproduced: the fix landed at `1bbe02d75` and the broken code is no longer on any
branch anyone runs.** Ward Lead asked for it to be committed because it is evidence that no longer
exists in the codebase.

## Why it matters

**The defect was found by reasoning, argued about by four chats, fixed by reasoning, and closed by a
token gate.** Every report of it — including mine — said plainly that **nobody had opened the board
while it was broken.** Ward Builder Two, Ward Verifier and Ward Builder One each predicted the same
consequence from the CSS rules alone. **None of us had seen it.**

## The prediction, as it stood before this

> _An undeclared custom property with no fallback is invalid at computed-value time, so the
> declaration unsets. `background` and `border` are not inherited, so both go. The rules sit on one
> `<select>` and two `<button>`s, so the browser's own control chrome is lost too — **a clinician
> would see plain text where a Leaving selector and an Away button should be.**_

## What was actually on the screen

**Measured with `getComputedStyle` on the live rendered DOM at `http://localhost:3899`, board
`rph-adult-secure`, bed 1's detail panel open — not read from the stylesheet:**

```
.leavingSelect   border-top/right/bottom/left : 0px none      background: rgba(0, 0, 0, 0)
.awayButton      border-top/right/bottom/left : 0px none      background: rgba(0, 0, 0, 0)
                 color: rgb(27, 37, 51)  ← ordinary body-text colour
                 box-shadow: none        outline: 3px none    min-height: 48px
both themes: identical, light and with .dark applied
CONTROL, same script: black-on-white 21.000 · white-on-white 1.000
```

**A transparent, borderless `<select>` and `<button>`, in body-text colour, on a white panel.**
⚠️ **The prediction was exact, including the part nobody could check — that the controls keep their
48px tap target and their pointer cursor while looking like a paragraph.** A control that is
invisible is worse than one that is illegible: **unreadable text gets reported, and nothing that
looks like nothing ever does.**

## ⚠️ How it was nearly thrown away

**I was minutes from reporting that Ward Builder One's contrast figures were wrong**, because mine
disagreed with them completely. **They were not wrong. I was measuring code that had been fixed
hours earlier.** What caught it was noticing the CSS still named `--clinical-border` and
`--clinical-surface`, then checking `git merge-base --is-ancestor 1bbe02d75 HEAD` — **which said no.**

**The lesson is a check none of us was running.** All session I reported my position as _"N unmerged
commits"_, from `git log <master>..HEAD`. **That is the AHEAD question.** Nobody asked the other one:

```bash
git log --oneline HEAD..<master> | wc -l     # 136
```

⚠️ **Every rule this programme wrote today — name the reporter, demand a RAN count, name which
assertion fired, state what your check did not cover — would have passed this measurement through
untouched, because not one of them asks WHICH TREE.**

## Standing

**Confirmed after merging master:** the controls use `--border-strong`, and Ward Builder One's
figures are exact — **1.397:1 light and 2.218:1 dark**, independently re-derived from the rendered
page. **Its measurement was right, its token choice was right, and the contradiction was entirely
mine.**

---

## ⚠️ TWO CORRECTIONS TO THIS FILE, both from peers, both re-measured here

### 1. The dark-mode anomaly was MY measurement, not a token bug — resolved

**I recorded that in dark the `awayButton`'s fill measured white while the `leavingSelect`'s went
dark, though both declare `background: var(--surface)`, and I left it "unexplained".** ⚠️ **Ward
Builder One supplied the hypothesis: the page stays light until RELOADED while `matchMedia` already
reports dark, so setting `.dark` without a reload leaves a half-applied theme.**

**Tested — `.dark` set, then `location.reload()`, then measured:**

```
                 BEFORE (no reload)          AFTER (reloaded)
leavingSelect    8.454  fill #12161a         8.454  fill rgb(18,22,26)
awayButton       6.150  fill WHITE  ⚠️        8.454  fill rgb(18,22,26)
CONTROL black-on-white 21.000, same script
```

**Both controls are identical at 8.454:1 in dark and both fills are the dark surface.** ✅ **The
anomaly is gone, there is no second token bug, and my earlier dark figure of 6.150 for `awayButton`
is superseded by 8.454.** **A half-applied theme is a measurement artefact that looks exactly like a
CSS defect.**

### 2. ⚠️ "How far behind am I" is a PROXY. "Has the thing I measured moved" is the MEASUREMENT

**Ward Verifier's correction, and it is better than the instruction I sent to four chats.**

**I told everyone to run `git log --oneline HEAD..<master> | wc -l`. That count decays continuously
— I merged and was 12 behind within the hour — and it cannot tell you whether anything you care
about moved.** A hundred commits that never touch your file leave your reading exact; one that does
invalidates it.

```bash
git diff --quiet <ref-you-read-at> <master> -- <path>    # exit 0 = unchanged, 1 = moved
```

**Verified against my own case, with a control in the same command:**

```
my pre-merge HEAD 4b942b082 vs master a08d42502
  ⚠️ CHANGED   board.module.css        <- the file I was measuring. Would have caught me at once.
  ⚠️ CHANGED   ward-flow-reducer.ts
  CONTROL: master vs itself, same file  -> UNCHANGED, so the check discriminates
  the count I told everyone to run, at that moment: 151
```

⚠️ **The count told me "151", which is alarming but not actionable. The file check would have said
"the exact file you are measuring has moved", which is.** **The count is a smoke alarm; the file
check is looking at the stove.** ⚠️ **And it decays on a far slower clock — only when someone
touches that file — which is a clock you can actually reason about.**

**Ward Verifier's own numbers make the point: 426 behind at its pin, and that number means nothing,
because it never reads its working tree — it reads `git show <master-ref>:<path>`. Four of its seven
source findings are byte-exact at the current tip; three moved BECAUSE THEY WERE FIXED.** **Staleness
caused by your own finding landing is not a defect in the finding.**

---

## ⚠️ THE DISAGREEMENT WAS THE DETECTOR — and agreement would have hidden it

**Ward Builder One's observation about the dark-mode artefact, and it inverts the thing this whole
programme has been treating as reassurance.**

**Both of us measured the board's controls through a half-applied theme at some point** — `.dark` set
without a reload, so `matchMedia` reports dark while the page is still painted light. **Neither of us
noticed. What surfaced it was that our numbers DISAGREED**, which sent me back to re-measure with a
reload and find that the anomaly was mine.

> ⚠️ **Two independent measurements agreeing would have hidden it.**

**That is the uncomfortable inversion.** Independent agreement has been treated all day as the
strongest signal available — three chats computing nine discrepancies, three measurements of the
same contrast ratio, two counts of the same defect. **But independence of AUTHOR is not independence
of METHOD.** Two chats driving the same page through the same tool, both setting a class without a
reload, are not two witnesses. **They are one instrument used twice, and its agreement is a property
of the instrument rather than of the thing measured.**

**The generalisation, stated so it survives:** ⚠️ **agreement between measurements that share an
apparatus is not corroboration. Ask what the two measurements share before counting them as two.**

**And the practical consequence, which is the part I would act on:** when two chats agree, the cheap
test is not a third agreeing measurement — **it is one measurement taken a different way.** A reload
instead of a class toggle. A rendered read instead of a stylesheet read. A `tsc` run beside a
`vitest` run. **The disagreement is what carries information; the agreement mostly carries the
apparatus.**

---

## ✅ ITEM 7 CLOSED: dark mode verified through the app's OWN mechanism, 2026-09-02

**Owner's instruction was _"treat as unchecked and you review it or add to task list"_. Reviewed, and
it now passes on the real path rather than a simulated one.**

⚠️ **What was wrong with the earlier check, and it was mine.** I had switched dark mode by adding a
`.dark` class to the document. **That is not how this application does it.** `src/lib/theme.ts`
stores a preference under `clinical-kb-theme` and a boot script applies the class **at page load** —
so setting the class by hand produces a **half-applied theme**: `matchMedia` reports dark while parts
of the page are still painted light. **That is what produced the unexplained white fill I could not
account for.** Ward Builder One supplied the hypothesis; this run confirms it.

**The real path, taken this time:** set `clinical-kb-theme` to `dark` **through the app's own
storage key**, reload, let the boot script run, then measure.

```
stored preference: "dark"    dark class after reload: TRUE (applied by the app, not by me)
--surface resolves to #12161a
leavingSelect   border rgb(168,178,189) on fill rgb(18,22,26)   8.454   PASS
awayButton      border rgb(168,178,189) on fill rgb(18,22,26)   8.454   PASS
leavingButton   border == its own fill                          1.000   see below
CONTROL, same script: black on white 21.000
```

**Both controls the fix targeted clear 3:1 with room, and their fills are now identical to each
other** — the inconsistency in the earlier reading is gone, and there was never a second token bug.

**`leavingButton` reads 1.000 against its own fill and that is not a defect:** it is a solid blue
block whose boundary against the panel behind it is what a viewer sees. **It was deliberately not
touched, for the reason recorded earlier — tuning that number would be fixing the wrong thing.**

⚠️ **Side effect undone, and stated because it was a change to a real browser's stored state:** the
theme preference was **absent** before this check and I set it. **It has been removed and confirmed
`null` again.**

### What this still does NOT cover

**One ward, one bed, one viewport, one browser.** **Forced-colors remains unobserved by anyone.** And
⚠️ **nobody has still LOOKED at these controls** — the pane returns a blank image for that region on
two chats' attempts, so this is measurement from the rendered page, not sight. **The owner has said
he will open the board himself, and that remains the only route to closing it.**
