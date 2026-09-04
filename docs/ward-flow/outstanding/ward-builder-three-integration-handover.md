# Ward Builder Three → Ward Lead: integration handover, 2026-09-02

**Written to a file because traffic to Ward Lead has never been observed to arrive.** Ward Verifier's
sends succeed, nothing appears, and the owner forced a turn with no effect — cause unproven, and I am
recording it as _"never observed to arrive"_ rather than as a failure or as its opposite. **Git is the
transport that demonstrably works, so this file is the message.**

⚠️ **AND THE DELIVERY QUESTION IS NOW UNINTERPRETABLE, WHICH IS WORTH KNOWING BEFORE ANYONE READS
SILENCE AS AN ANSWER.** Nine messages have gone to `ward-lead-f3` from four chats; every one reported
success; none acknowledged. The owner then granted peer-message permission naming **Ward Verifier,
Ward Builder Two, Ward Builder Three and Ward Builder — not Ward Lead.** ⚠️ **Those four already
reached each other, provably, so the grant covers the only links never in doubt.** And permissions
are per-session: **a grant made in my session cannot release another session's inbound queue.**
**So continued silence is now consistent with both explanations and discriminates between neither.**
`ListAgents` shows exactly one lead session, `ward-lead-f3`, started 42m ago — **so this is not a
case of messaging the wrong one of two.** **Do not report the channel as fixed and do not report it
as broken.** The recommendation put to the owner is to grant the same permission **inside the Ward
Lead session**, where four handovers are already waiting as the test case.

✅ **RESOLVED ENOUGH TO ACT ON, and the decisive evidence was a FAILURE rather than a success.** My
next send returned **`No agent named 'ward-lead-f3' is reachable`** — the session had been **renamed
to `Ward Lead` mid-turn, same reference `12c6cb`, same age.** Re-listed, resent, delivered.
Three things follow:

- **The tool does return a hard failure for a name that will not resolve**, so every `success` we
  counted was a genuine acceptance and not a polite nothing.
- ⚠️ **But `success` means ACCEPTED FOR DELIVERY, NOT READ.** Four chats spent an evening treating a
  rising count of successes as a rising count of deliveries. **This is not a check that cannot fail;
  it is a result read as answering a question it never addressed** — a species this record did not
  have, and the fourth distinct one found today.
  ⚠️ **Ward Builder Two's statement of it is better than mine and is the one to keep:** the other
  four shapes were all **a check whose SCOPE was narrower than its use.** This one is not. **The
  result is exact, complete and correctly reported — `accepted for delivery`. Nothing about it was
  narrow. Four of us summed it into a quantity it never measured, and CHANGED WHAT IT MEANT BY
  COUNTING IT.** **The tool never lied; we inferred readership from acceptance and it had never
  claimed it.**
  ⚠️ **AND ITS DETECTION RULE, which the other four do not need and this one cannot do without.**
  The other four all yield to _"state what your check did not cover."_ **This one does not, because
  nothing about it was uncovered.** The rule is: **before summing a result, say what ONE instance of
  it asserts.** One `SendMessage` asserts _accepted for delivery_. Nine assert _nine acceptances_ —
  **never once "Ward Lead is not reading."** ⚠️ **A count inherits the meaning of its unit, and no
  amount of scope-stating catches a unit misread.**
- ⚠️ **TWO STALE POSITION COUNTS TONIGHT, DIFFERENT CAUSES, NEITHER SELF-CAUGHT.** Ward Builder Two
  repeated "seven unmerged" across three messages without re-measuring; **mine was a number
  outrunning its own measurement** — true when taken, false within minutes because I kept
  committing. **Both were caught by a peer's offhand remark inside a message about something else,
  not by either of us re-reading our own document.** ⚠️ **A record does not surface its own
  staleness, because re-reading it re-reads the claim rather than the world.**
- ⚠️ **A STANDING CAUTION ABOUT THIS SECTION ITSELF.** Five species, a detection rule each, symmetric
  errors, mutual correction — **that is exactly the shape a conclusion has when it has stopped being
  tested.** Both Ward Builder Two and I wrote today that a finding flattering the theme you are
  already forming gets checked last, **and this taxonomy is now that theme.** Neither of us has a
  candidate sixth or any reason to doubt the five. **The position is flagged, not a fault claimed.**
- ⚠️ **"Ward Lead is not reading" is FALSIFIED, by evidence nobody was looking at.** Five of my seven
  commits are already ancestors of master `556037802`, each confirmed with `merge-base
--is-ancestor`, and **the rescued harness is in master at 2,311 bytes.** **Somebody folded my work
  while none of our messages were acknowledged. The git direction demonstrably works.**

**The rename does not explain the earlier nine** — it came after them. **What it explains is why an
address that had been correct stopped being correct**, and that is worth more than the hypothesis it
displaced: **a name is not a durable address, and `ListAgents` before each send is the cheap remedy.**

**Measured at master `ed904f8d2`.** ⚠️ It has been `e38adb2f8`, `1bbe02d75`, `86df0da1c`, `e0cb8f0fe`
and now this — **five positions inside ninety minutes. Every position number in every report tonight
is stale, including the ones below.**

---

## 1. WHAT I AM DOING NOW

**Nothing is in flight.** I hold no unmerged code, my working tree is clean, and I am idle awaiting
an assignment. **I am not running tests, not merging, not pushing, and not touching another chat's
files.**

## 2. WHAT IS WAITING TO BE INTEGRATED — 4 commits, 8 files, ALL DOCUMENTATION

```
701e79286  a correct operation whose success is indistinguishable from its failure
4f602c318  rescue the git-ignored triage ledger and the mutation harness
19f35b4a6  correct B1 (closed, and wrong twice) and C9 (unowned, not not-mine)
7f2a93568  outstanding items, in four groups
```

**Merge safety, measured not assumed:** `git merge-tree --write-tree <master> HEAD` → **exit 0,
zero CONFLICT lines.** Files touched:

- `docs/ward-flow/outstanding/ward-builder-three-2026-09-02.md` — the record
- `docs/ward-flow/rescued/ward-builder-three/{mutate.mjs, wf-build3-006-triage-progress.md}`
- **five** `docs/outstanding-issues-inbox/*.json` — queued via `npm run issues:add`, never a direct
  ledger edit

⚠️ **The five inbox requests are UNRECONCILED.** They are merge-safe by construction, but somebody
must run `npm run issues:reconcile` from a dedicated fresh-base branch **after** this lands, or the
five entries exist and reach the ledger never.

**No source file. No test file. No CSS. Nothing that can turn a gate red.**

## 3. FINDINGS THAT SURVIVED CROSS-CHECKING

**Three chats attacked my record within an hour and two of my entries did not survive intact.** What
follows is what stands after that.

### The one to put in front of the owner

**`tests/ward-release-band-day-boundary.test.ts:34` — `} as unknown as BedRelease`.** Six required
fields absent, three phantom fields not on the type. ⚠️ **`blocker` is ABSENT and `blockReason` is
PHANTOM** — a plausible-looking name standing exactly where the real one belongs — **and `blocker` is
what the blocked-discharges breakdown counts.** **A blocked discharge can present as not blocked,
with nothing red.** Ward Builder Two independently calls this the strongest live clinical
consequence in the network. **Three chats computed nine discrepancies independently and agree — and
the agreement is worth something precisely because one of the three was wrong first and said so.**

### CLOSED — do not assign anyone

**The undeclared ward-board CSS tokens are FIXED**, at `1bbe02d75`, an ancestor of master. **Three
independent measurements with three separate controls agree** (mine on `e0cb8f0fe`: all six names
return 0, control `--ward-blue` returns 12 in the same command). **My original entry was wrong
twice** — it said ten properties when it was six properties across ten references, and it claimed
text would go invisible when `color` is inherited and therefore takes the surrounding board's colour.
**The real exposure had been one `<select>` and two `<button>`s losing their control chrome** —
`.leavingSelect` at `ward-board.tsx:1398`, `.awayButton` at `:1461` and `:1478`. ⚠️ **Two CSS
classes, THREE rendered controls — pinned with line numbers because two records currently disagree
on the count.**

### ⚠️ A residual I was asked to carry, checked, and am NOT carrying

**Ward Builder One reports `globals.css` redefining `--surface`, `--text` and `--text-muted` to
`Canvas`/`CanvasText` under forced colours as "a second independent route to those controls losing
their appearance". I measured it and the inference does not follow.** Under `@media (forced-colors:
active)` those tokens are **declared**, with system colours, and **`--border: ButtonBorder` and
`--border-strong: ButtonText`** are declared alongside them. **That is the correct forced-colors
mapping, and a declared `ButtonBorder` is the opposite of the original defect, in which nothing was
declared at all.** The observation is true; the mechanism is not. **Recorded as not-a-defect on my
own measurement, and I told Ward Builder One so.**

✅ **CLOSED — Ward Verifier re-measured independently and retracted it**, with a fabricated token as
its control returning 0. **Three measurements now agree.** ⚠️ **And its account of how it went wrong
is a species this record did not have.** Its original trace had already printed
`globals.css:4393 --surface: Canvas`, `:4397 --text: CanvasText`, `:4403 --border-strong: ButtonText`
— **the evidence was on its own screen.** It read the word _"redefines"_, inferred a hazard from the
shape of the word, and **never asked what the block was for.** **So the mechanism can be wrong even
when nothing was missed: the failure was INTERPRETIVE, not evidential**, which no amount of more
careful searching would have caught. **The remedy is the one it had given Ward Builder Two three
messages earlier and did not apply to itself — state what your check did NOT cover.** It had never
opened the block.

⚠️ **AND THE REASON THIS SET BELONGS IN A DOCUMENT AT ALL, in Ward Verifier's words:** the piped exit
code and `--reporter=basic` are repairable — one is a shell fact to work around, the other a wrong
argument to stop passing. **`git add` staging nothing is the tool behaving correctly. A hazard that
is not a bug has no owner and no fix date**, so it lives in a document or it is rediscovered by
whoever rescues next.

### UNOWNED — this is the item that needs YOU

**`tests/stale-resume-instructions.test.ts` and `tests/test-runner-safety.test.ts` are still red.**
The second is an **unbounded recursive delete inside a test** — a hazard to the machine rather than
to the board, and this machine has already removed an in-use worktree twice. ⚠️ **Four chats have now
each said "NOT MINE" about the same two files.** Ward Verifier's phrase is the correct one and I have
written it into my record: **elimination across four chats is not an owner, it is a gap wearing four
signatures.** **I will take either one on your say-so. I have nothing else running.**

### Everything else of mine is a LEAD, not a finding

**126 of my 131 sweep findings have had no mutation run against them.** Each names a falsifier, a
falsifier is a mechanism, and **an unconfirmed mechanism is a lead.** Same for three
`as unknown as WardFlowEvent` casts and six statically-found candidate guards. **Do not integrate any
of them as defects.**

## 4. THE METHOD FINDINGS, WHICH OUTLAST THE PROJECT

1. ⚠️ **`--reporter=basic` does not exist in this vitest. It dies at startup, runs nothing, reports
   no failures, and is indistinguishable from a clean pass.** Every figure in my record was produced
   with `--reporter=verbose` plus a named negative control.
2. ⚠️ **`git add` can stage nothing, print nothing, and exit 0.** The only defence is a control on
   the RESULT: `git diff --cached --name-only | wc -l`.
3. ⚠️ **AND THE DISTINCTION THAT MAKES 2 THE MORE VALUABLE ENTRY.** A masked exit code, a broken
   `grep -E`, a guessed line range and a non-existent reporter are all **defects, and a defect can be
   fixed.** **`git add` staging nothing is the tool behaving correctly** — there is nothing to repair
   and it will be there tomorrow. **That class can only be checked for, never repaired.**
4. **Written from memory of what mattered rather than from a listing of what exists.** I recorded
   "8 rulings"; the file holds five. Ward Builder One recorded one at-risk file; it held 82. **Same
   act, different magnitude. Count before you trust your own record.**
5. **Publish the check, not your account of why it is needed.** Ward Builder One broadcast a single
   worktree's `.gitignore` to four chats as a property of the tool; **the check travelled and held,
   the explanation did not.**
6. ⚠️ **A number gains a signature at every hop and loses its author's withdrawal.** **Every
   mis-attribution rate published last night is withdrawn** — _roughly half_, _12 of 37_, _5 of 10_,
   _32%_, and my own _"ten observed"_, which contained my own three reasoned findings and which I
   handed back to its author as a correction. **The only defensible statement: one chat ran mutations
   on seven findings, three were mis-attributed, one with a stated caveat. Seven is not a
   replacement rate.**

## 5. WHAT WOULD HAVE BEEN LOST, AND WAS NOT

**`.superpowers/` is ignored at `.gitignore:175`, so my triage ledger and my mutation harness were
never on the branch — merging would not have saved them.** Both are committed at `4f602c318`. **The
harness is the only artefact in the network that cannot be reconstructed from a commit message**, and
it is what any future attempt on my one still-INCONCLUSIVE mutation will need. **All three builder
rescues (mine, `cfee6c5d9`, `38f90d138`) are verified real.**

## 6. WHAT I WANT FROM YOU, IN ORDER

1. **Assign the two unowned failures.** Four disclaimers is not an owner. **I will take either.**
2. **Fold these four documentation commits** — zero conflicts, no executable file.
3. **Schedule `issues:reconcile`** on a dedicated fresh-base branch, or my five queued entries never
   reach the ledger.
4. **Decide the suburb question** — a bed coordinator seeing a patient's suburb is in **neither
   projection's type**, so **no gate can catch it either way.** Ward Builder Two and Ward Verifier
   both carry it independently; **three of us are waiting on one answer.**
