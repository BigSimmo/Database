# OUTSTANDING — Ward Builder One (`claude/ward-builder-community-route`)

**Measured at HEAD `fb17db7b1`.** Nothing outstanding as code: `git log e38adb2f8..HEAD` is empty, and
`git merge-base --is-ancestor fb17db7b1 e38adb2f8` returns 0 — **with a control, the reverse direction
returning 1, so the check can tell the two apart.** Both the master tip `e38adb2f8` and the branch ref
`1bbe02d75` contain my work.

---

## ⚠️ STATUS UPDATE — Ward Lead answered, and most of section A is now closed

**Ward Lead's reply reached me and I acknowledged it with the token `DELIVERY-TOKEN-Q4X9` at
`72f1ef085`.** The items below are superseded; **they are struck through in place rather than
deleted, because a successor needs to know a question was asked and answered, not find no trace of
it.** Ward Lead's commits are named so each can be checked rather than believed.

- ~~**A2 `--clinical-border-subtle` needs an invented value**~~ — ✅ **WITHDRAWN. It needed none.**
  ⚠️ **Nine other `border-top` dividers in the same file already use `var(--wb-hairline) solid
var(--border)`; line 2103 was the sole outlier.** Fixed at `1bbe02d75`. **I asked the owner to
  invent a colour when the answer was nine lines away in the same file: I searched for a
  _declaration_ of the token, found none, and never looked at what its siblings did.**
  **This is the same shape as my forced-colors error in B1/B2 — I found the thing I was looking for
  and stopped at finding it.** Two instances, three hours apart, neither noticed at the time.
- ~~**A3 mark `Wardquestions` / `Ward-design` live**~~ — ✅ **Done at `365ba8462`, against a control.**
- ~~**A4 who owns `ward-screen-fd23-leaks.dom.test.tsx`**~~ — ✅ **ANSWERED: it is Ward Lead's.**
  ⚠️ **That question took nine asks between two chats and the answer was one line. Worth carrying
  forward as process, not trivia: an unowned file needs an owner NAMED, not disclaimers COLLECTED.
  Four correct disclaimers left it exactly as stranded as no answer would have.**
- ~~**A7 shall I take the three repository failures**~~ — ✅ **All three CLOSED and none was mine:**
  `1bbe02d75`, `365ba8462`, `0b6942f55`.
- **STILL OPEN: A1 (cross-page inference), A5 (is the register per-figure), A6 (`specialling`
  unset-able on the ED form), A8 (the past-tense discharge wording).**
- ✅ **The 81 rescued scratch files are folded and safe** — confirmed by Ward Lead.
- ⚠️ **STILL STANDING AGAINST BOTH OUR NAMES: nobody has opened the rendered board.** Containment
  for the CSS fix is a static reading of JSX nesting, not a rendered DOM. **It is the last thing
  between that work and being genuinely finished.**

---

## A. DECISIONS FOR THE OWNER

1. **Cross-page inference on the community hub** — 65 team pages each name who was referred to that team; anyone opening two pages learns a person was referred to both, which the software never displays. A community-team viewer scope has never been defined. **Not answerable by any search over source.**
2. **`--clinical-border-subtle` has no analog anywhere in the repository** — every other missing token maps to an existing one; this one needs a value invented, and I would not invent it.
3. **Should `claude/Wardquestions` and `claude/Ward-design` be marked "still live"?** Both are unmerged (`merge-base --is-ancestor` exit 1). `Wardquestions` holds the orchestrator handover and ten ward documents existing nowhere else — **marking it merged would be worse than the present silence.**
4. **Who owns `tests/ward-screen-fd23-leaks.dom.test.tsx`?** Eight asks between me and Ward Builder Two, unanswered. It has the same `allUnits()`-only blind spot at line 214 I closed at `64b4c1388`.
5. **Does the claims register cover every figure?** Figure 3 shipped without an entry while its siblings have one — parity follow-up, or a ruling that the register is not per-figure.
6. **`specialling` is unset-able on the ED referral form** — ruling 1 landed and the reducer now enforces one-to-one capacity, so it feeds a **gate**, not a display.
7. **Should I take the three repository-wide failures?** None is mine; I am idle; all three have exact catchers. I have touched no file outside my scope awaiting this.
8. **Community hub says "Expected discharge was 1 week ago"** — past tense substituting for the banned word. Implementer's choice, never ruled on.

---

## B. DEFECTS STILL PRESENT

1. ✅ **CLOSED — was: `board/board.module.css`**, where `.awayButton` (a `<button>`) and `.leavingSelect` (a `<select>`), both `min-height: 3rem` tap targets, set `background` and `border` from undeclared tokens, so **a clinician saw an "Away" button and a "Leaving" selector with no background or border, no longer looking like controls** — an invisible affordance, which invites no bug report the way broken text would. **Fixed by Ward Builder Two at `1bbe02d75`. Verified by me at master `e0cb8f0fe`: all six names return 0 references with `--ward-blue` returning 28 as a control in the same command.** Independently re-measured by Ward Builder Three.
2. ✅ **CLOSED — was: `ward-management.module.css`**, `--ward-surface` undeclared on `.blockerInput` and `.blockerButton:disabled`. Same fix, same verification.
   **ONE RESIDUAL SURVIVES THE FIX: containment was established by reading JSX nesting statically** — net `<div>` depth +1 across `ward-management-console.tsx` 221–471 with no intervening `return (` — **not from a rendered DOM. Nobody has opened the board.**
   ⚠️ **I RAISED A SECOND RESIDUAL AND IT WAS WRONG. WITHDRAWN — do not carry it.** I recorded `globals.css:4388` redefining `--surface`/`--text`/`--text-muted` to `Canvas`/`CanvasText` under forced colours as a second, independent route to the same failure. **Ward Builder Three refuted it by measurement and I verified the refutation myself at `ed904f8d2`: the same block sets `--border: ButtonBorder` and `--border-strong: ButtonText`** (control: 40 custom-property declarations in that range). **The observation was true — those tokens ARE redefined. The mechanism was the opposite of the defect.** The original fault was that _nothing declared the properties at all_, so the declaration was invalid at computed-value time and dropped; here they **are** declared, deliberately, with system colours. **That is the correct forced-colors mapping, and `ButtonBorder` is exactly what keeps a `<select>` and a `<button>` looking like controls in that mode. It is the fix for my worry, not a second instance of it.**
   ⚠️ **Third time today a finding has been observation-true and mechanism-false, and the first time it was mine. A pattern that names a real thing still has to be read for what it means.**
3. ✅ **CLOSED — was: `tests/ward-release-band-day-boundary.test.ts:34`**, `as unknown as BedRelease` hiding 3 phantom and 6 absent required fields. **Nothing was lost on screen; what was lost was the guarantee** — every test using that helper exercised a shape the model does not define, and `blocker`, the field the blocked-discharges figure counts, was among the absent. **Fixed at master `ed904f8d2`, which additionally establishes what none of the three chats that found it had worked out: `blocked`/`blockReason` are the pre-2026-08-28 shape from when `blocked` was a fourth STATE, so the file was banding discharges on a record where a block could neither be set nor read.** `releaseBand` is what a ward reads to plan a bed.
   ⚠️ **Verified by me at `ed904f8d2` with the comment-hit filter Ward Builder Two supplied: `git grep 'as unknown as BedRelease'` still returns 1, and that single survivor is inside the comment documenting the fix (line 25, `* NO CAST. This literal was …`).** **The pattern matches; the match is prose.** Control: plain `BedRelease` references return 78.
4. **`docs/ward-flow-coordination-rules.md` and `docs/ward-flow-fold-manifest-2026-08-31.md`** — instruct a session onto branches without saying whether they are live. **A successor redoes settled work, or avoids a branch that still holds the only copy of ten documents.**
5. **`tests/ward-flow-chat-control.test.ts`** — an unbounded recursive delete with no retry guard, on a machine that has been losing shell commands all session.
6. **Figure 3 has no claims-register entry** — **a false explanation printed beside that figure would go undetected**, where the same error beside its siblings goes red.

---

## C. BELIEVED BUT NOT VERIFIED — read this first

1. **All 34 statistics pages cold-start reachable** — ⚠️ **I cannot name the commit.** Established several merges ago and never re-measured. **That I cannot date it is itself the finding.**
2. **The FD-23 sweep of community and statistics found one direct read**, a boolean predicate structurally unable to leak — **last true at `f8cd8d17b`**, long superseded.
3. **A self-defeating-guards sweep returned four negatives of UNDETERMINED METHOD** — its transcript was 0 bytes, so read-versus-pattern-matched cannot be established, and **the wrong method produces an identical report.** Do not treat those 14 files as clean.
4. **`BedRelease.waitingOn` is never read back, and `dischargeConfirmedAt` has no runtime writer** — **UNVERIFIED LEADS** from an audit whose parent died before synthesising its children. **Two other findings from that same run were false and I withdrew both.**
5. **`2baf11a0f`'s "every pin fired" is FALSE** — an aborting loop demonstrates at most one assertion per run; roughly 46 of 63 were never exercised.
6. **My triage rate is withdrawn in every form** — the 5-of-10 and the 12-of-37 aggregate alike. Only _"triage before allocating, because a meaningful fraction are not gaps"_ survives, because it never depended on a rate.
7. **The nine `BedRelease` discrepancies** — measured by me at `041ab1de4` and independently re-derived by Ward Verifier **at `268fcd6a8`**, reaching the same 3 + 6. **Verified, unusually for this list.**
8. **The CSS harm description in B1/B2** — I read the selectors and declarations at `fb17db7b1`, **but I have never opened the rendered board.** `background` and `border` falling away is certain; **legibility and actual appearance are not, and need the running app.**
9. **That `color` falls back to the inherited value rather than to nothing** — asserted from knowledge of the invalid-at-computed-value-time rule, **not from a specification anyone opened.** It corrects an earlier, more alarming claim, so it is the safer error but still unchecked.
10. **Twenty-eight commits touched the two CSS files and 27 have no overlap with my scope** — a **pattern scan over commit file-lists, not a sweep.** Measured at `fb17db7b1`.

---

## D. THINGS THAT WOULD BE LOST — substance moved here

1. ⚠️ **CORRECTED AT `cfee6c5d9` — THIS ENTRY WAS WRONG BY TWO ORDERS OF MAGNITUDE.** I wrote that one diagnostic file was at risk. **`.superpowers/sdd` held 82 files and 9,491 lines**: eleven rulings whose reasoning exists nowhere else, `wf-build-006-triage-report.md` (reported by Ward Verifier as the network's **only** mutation-observed sample of the 131 sweep findings), the two ruling-verification notes, and `audit-self-defeating-guards.md` — the 0-byte-transcript sweep caveated in C3. **All 81 substantive files are now in git at `docs/ward-flow/sdd-rescued/`.** Ward Verifier caught this by reading this record rather than believing it.
   ⚠️ **THE TRAP, which cost the first attempt and which two other chats were exposed to: the SDD workspace contains its own `.gitignore` holding a single `*`, and that rule travels with any copy.** The rescue copied 82 files, verified them byte-identical by aggregate sha256 with the CR count unchanged, and then `git add` staged **zero**, printed nothing and exited 0. **Every check passed; only `git diff --cached --name-only | wc -l` returning 0 caught it.** `git add` is another operation whose silence is not evidence. **Remedy: `git add -f`, excluding that `.gitignore` so it is not re-armed inside the repo; verify with `git log --stat`, never with the absence of a complaint.**
   **The diagnostic's own finding stands:** nine of the ten bad token references have a real declared token they should have used. Also in the closing report `fb17db7b1` §5 and in B1–B2 above.
2. **The cast-search refinement, which exists only in chat messages** — ⚠️ **search by TARGET TYPE, not by the operator.** `as unknown as` appears **228 times** across `tests/` at `268fcd6a8` (Ward Verifier's count, control run both ways) and almost all are legitimate: you cannot hand-build a `Request` or an `IntersectionObserver`. **The dangerous subset is a double cast onto a repo-defined domain model.** Searching by operator returns 228 and buries the one that matters.
3. **Filter comment lines from that search** — Ward Builder Two's tree-wide run returned two hits, the second inside a block comment documenting a mutation. **It caught this only because the line began with `*`, and would otherwise have sent me a false finding built on my own true one.**
4. **The CRLF trap** — a Python text-mode write converted 2,721 line endings; `git diff` reported no change and only the hash caught it. **Verify a restore by hash, never by diff; `git ls-files --eol` after any scripted write.** Also in the handover `041ab1de4` §6.
5. **The reporter trap** — `--reporter=basic` does not exist in this vitest; it dies at startup, runs nothing, and reports no failures. **Also in the closing report `fb17db7b1` §6.**
6. **The merge hazard** — two chats fixed one defect with different comments, git merged both cleanly, producing `TS1117`. **A clean merge is not evidence two branches did different things.** Fixed at `6702ba7e2`.
7. **My own method error, worth more than the result it nearly spoiled** — I disclaimed three failures on "my eleven commits" without saying those were one session's. **A count with an unstated boundary silently answers a narrower question than it appears to.**
