# Ward Builder Three — everything still outstanding, 2026-09-02

**Identity from git:** `git rev-parse --abbrev-ref HEAD` → **`claude/ward-builder-three`**, HEAD
**`adcd8bcb5`**, working tree clean apart from the five ledger requests queued alongside this file.

**AMENDED after first commit `7f2a93568`:** B1 is **closed and was wrong twice**, C9 now says
**UNOWNED**, and two verified items were added. **Both corrections came from peers and both were
re-measured here before being written.**

**Master line `codex/task-ward-flow-live-state-20260831` measured at `e0cb8f0fe`.** ⚠️ It was
`e38adb2f8` in the brief, `1bbe02d75`, then `86df0da1c`, and now this — **four positions inside one
hour, so every "behind" count below is stale the moment it is read.** `git log --oneline
codex/task-ward-flow-live-state-20260831..HEAD` prints **nothing: I hold no unmerged work.**

---

## A. DECISIONS FOR THE OWNER

1. **Should a bed coordinator see a patient's suburb?** It is in **neither projection's type**, so no
   gate can catch it either way — Ward Builder Two asks this independently, which is why it is first.
2. **The DOM sweep lost 53 of its 61 findings — retire and re-run, or attempt recovery?** Ward
   Builder One says retire; I agree; **the call is yours and the content exists nowhere.**
3. **Are my 131 sweep findings worth triaging at all**, given every one of them is an observation
   whose mechanism has never been executed?
4. **Is `tests/scratch_debug_elig.test.ts` meant to be on the master line?** It arrived at `b02751cc4`
   and reads as scratch.
5. **The two ED browser journeys have never once passed — worth a Playwright window, or drop them?**
6. **Who owns `design-token-contract`, `stale-resume-instructions` and `test-runner-safety`?** ⚠️
   **None of the three is mine** and one has now gone unclaimed repeatedly; **somebody must be told
   to take them or they will simply stay red.**
7. **Policy: when a test's title claims a property its assertions cannot distinguish, is the fix an
   honest rename or a new guard?** Only a mutation separates the two, and I have run none.
8. **Is the sweep programme finished, or does it get a second pass over the families it never read?**
   The `.ts` sweep read no `.dom.test.tsx` and no `ui-*.spec.ts` — **that is where every candidate
   guard was found.**

## B. DEFECTS STILL PRESENT

1. ⚠️ **CLOSED — AND THIS ENTRY WAS WRONG TWICE BEFORE IT WAS CLOSED. CORRECTED 2026-09-02.**
   **`tests/design-token-contract.test.ts`. NOT MINE, and now nobody's: fixed at `1bbe02d75`, an
   ancestor of master.** Re-measured by me on master `e0cb8f0fe`: all six names return **0
   references**, control `--ward-blue` returns 12 in the same command. **Do not send anyone to fix
   this.**
   - **Count was wrong: six properties across ten references, not ten properties.**
     `--clinical-border-subtle`, `--clinical-text-muted`, `--clinical-border`, `--clinical-surface`,
     `--clinical-text`, `--ward-surface` — measured by me on my own tree at `adcd8bcb5` as 1+1+2+2+2+2.
     **A reader of my original line would have hunted four properties that never existed.**
   - **Harm was wrong: I wrote "text the colour of the background" and that cannot happen.** An
     undeclared `var()` with no fallback is invalid at computed-value time, so the declaration
     unsets. **`background` and `border` are not inherited, so they do go — but `color` IS
     inherited, so the text takes the surrounding board's colour and stays readable.**
   - ⚠️ **The real harm is worse and none of the three of us had looked at the element.** The rules
     sat on `.leavingSelect`, `.leavingButton` and `.awayButton` — **verified by me in the TSX at
     `adcd8bcb5`: one `<select>` and two `<button>`s**, production tap targets. Losing the
     declaration strips the browser's own control chrome. **A clinician would have seen plain text
     where a Leaving selector and an Away button should be. Unreadable text looks broken and gets
     reported; an invisible control looks like nothing is there.**
   - **Three passes over one finding: the observation was right every time and the mechanism was
     wrong twice.** Ward Builder Two published the bad harm wording, Ward Verifier corrected it,
     Ward Builder Two withdrew it publicly — **and it still reached my committed record by relay,
     which is the exact failure this record was written to name.**
2. **`tests/ward-release-band-day-boundary.test.ts:34` — `} as unknown as BedRelease`.** The fixture
   supplies 8 fields where the type requires 11: **6 required fields absent, 3 phantom fields that
   are not on the type at all.** ⚠️ **`blocker` is absent and `blockReason` is phantom** — a
   plausible-looking name standing exactly where the real one belongs, **and `blocker` is the field
   the blocked-discharges breakdown counts.** A clinician could see **a patient whose discharge is
   blocked appear in the not-blocked count**, and the test asserting the boundary would still pass,
   because a double cast switches the typechecker off and vitest runs no typechecker at all.
3. **`tests/test-runner-safety.test.ts` fails on an unbounded recursive delete in
   `tests/ward-flow-chat-control.test.ts`.** ⚠️ **NOT MINE** — my sweep read that file (batch 2,
   three findings) but did not create it. **A test that can delete a directory tree without a bound
   is a hazard to the machine, not to the ward board.**
4. **`tests/stale-resume-instructions.test.ts` fails** on `ward-flow-coordination-rules.md` and
   `ward-flow-fold-manifest-2026-08-31.md`. ⚠️ **NOT MINE** — I created neither document. **A chat
   resuming from a stale instruction file does the wrong work confidently.**
5. **The two ED journeys in `tests/ui-ward-roles.spec.ts` are committed, repaired and unproven.**
   Their only run failed for their own reasons — one used a test id missing its `inbox-` segment, the
   other clicked an `aria-disabled` control that Playwright refuses to click and so timed out at 45s
   rather than failing. **Both fixes are folded to master and NEITHER HAS BEEN RUN SINCE.** **Nothing
   currently proves the ED department clock or referral clock displays correctly to a duty doctor.**
6. ⚠️ **A LIMIT ON THE WHOLE SWEEP METHOD, from Ward Lead, and it is the sharpest hit my work has
   taken. A TEST-ONLY MUTATION RUN CANNOT SEE A TYPE-CHANGE FALSIFIER.** Delete one required field
   from the `BedRelease` fixture and **`tsc` gives TS2741 and exits 2, while vitest reports 4 passed
   and exits 0 — both ways.** So **any finding whose falsifying edit is a type change is invisible to
   the mutation protocol I built**, and the protocol would have reported it clean. **My triage plan
   ran vitest and never `tsc`.** ⚠️ **That means "no mutation run" understates the problem for a
   subset of my 131: for those, the mutation I planned could not have decided anything.** **A
   successor must pair every mutation with `npx tsc -p tsconfig.typecheck.json --noEmit`, and read
   both exit codes**, or repeat the exact hole this sweep was written to find.
7. **126 of my 131 sweep findings have had no mutation run against them.** Each names a falsifier,
   and **a falsifier is a mechanism, so by the standard this programme adopted all of them are
   observations with unconfirmed mechanisms — leads, not defects.**
8. **Three `as unknown as WardFlowEvent` casts** (`ward-bed-release-lifecycle.test.ts:339` and `:361`,
   `ward-flow-reducer.test.ts:1354`) **have never been checked against that type's required-field
   list.** Same class as item 2; unchecked, so leads.
9. **Six candidate guards from WF-BUILD3-006 were found by static search only** and no mutation was
   run on any of them. **Leads, not verdicts.**
10. **`docs/ward-flow/wf-build3-004-dom-test-sweep.md` records 61 findings and contains 8.** The
    document itself is a defect: **a count that cannot be checked, triaged or compared.**
11. ⚠️ **`--reporter=basic` does not exist in this vitest: it dies at startup, runs nothing, and
    reports no failures — which is indistinguishable from a clean pass.** Nothing in this repository
    prevents it. **This belongs beside "never read an exit code after a pipe" as a check that cannot
    fail**, and Ward Verifier rates it the most useful operational finding of the night. **Every
    figure in this record was therefore produced with `--reporter=verbose` and a named negative
    control.**
12. ⚠️ **A NEW SPECIES FOR THIS CATALOGUE, and it is the one that cannot be repaired.** The
    pipe-masked exit code, the reporter that dies at startup, a broken `grep -E`, a guessed line
    range — **all of those are defects, and a defect can be fixed.** But **`git add` staging nothing
    and exiting 0 is the tool doing exactly the right thing**, and its success is indistinguishable
    from its failure. **There is nothing to repair; it will be there tomorrow.** The only defence is
    a control on the RESULT rather than on the input: `git diff --cached --name-only | wc -l`.
    ⚠️ **ATTRIBUTION CORRECTED: the phrasing is Ward Builder Two's, not Ward Builder One's.** One
    relayed it to me and I credited the relay; **One corrected me unprompted, which is the only
    reason this line is right.** _A bug in a pattern gets fixed; a correct operation whose success is
    indistinguishable from its failure can only be checked for._ **A false attribution is worse than
    a blank, because it manufactures a second witness who never looked.**
    **One reached the surrounding point while retracting its own generalisation about the cause** —
    it broadcast a single worktree's `.gitignore` to four chats as a property of the tool. **The
    check travelled and held; the explanation did not.** That is the distinction worth keeping:
    **publish the check, not your account of why it is needed.**

## C. ⚠️ BELIEVED BUT NOT VERIFIED — READ THIS SECTION FIRST

**Every line here was true at the commit named and has NOT been re-checked since. Master has moved
at least twice today. Do not act on any of it without re-measuring.**

1. **`Tests 3 failed | 87 passed (90 RAN)`, real exit 1, `--reporter=verbose`** — the three repo-wide
   failures. **True at `adcd8bcb5`, on a tree then 84 behind master.** ⚠️ **Not evidence about
   master.**
2. **`npx tsc -p tsconfig.typecheck.json --noEmit` → real exit 0, zero error lines** — **at
   `e118b7bc3`.** Never re-run since master moved.
3. **My three own test files: 73 individual tests RAN, exit 0**, with a negative control proving a
   silent zero is visible on this runner — **at `e118b7bc3`.**
4. **All four mutation results on the reachability guard and both on the numbering guard** — at
   **`ed701752d`** and **`22d92e318`**. ⚠️ **One of the four was INCONCLUSIVE and still is:** emptying
   the exception map broke the file's parse and vitest reported _"no tests"_ — the fork-failure shape,
   not a negative. **That assertion has never been proved.**
5. **The stripper measurements** — `0.0009` discrimination on hrefs, `0.00025` on characters, 5
   order-sensitive files of 1,283, 93.4% vs 60.7% — **all at `ed701752d`.**
6. **The staleness figures** — 4 stale of 90 `.ts` files, 6 of 56 DOM files, 5 source files — **at
   `97a090ed8`.**
7. **The nine-discrepancy count on the `BedRelease` fixture** — computed by me at **`e118b7bc3`**;
   three chats agree, **and one of the three was wrong first and said so, which is why the agreement
   is worth anything.**
8. **All five of my code commits are folded into master** — `ed701752d`, `22d92e318`, `cdaaa7e88`,
   `9af65681f`, `6ce0af276`, each confirmed with `git merge-base --is-ancestor` — **at `adcd8bcb5`.**
9. ⚠️ **THE REMAINING FAILURES ARE UNOWNED, NOT MERELY NOT-MINE. Corrected 2026-09-02 on Ward
   Verifier's challenge, which I accept.** `git log --diff-filter=A` gives the same git identity for
   every chat, so authorship cannot disambiguate anything. **Three chats have now said "not mine"
   about the same files. Elimination across three chats is not an owner — it is a gap wearing three
   signatures**, the same shape as the withdrawn rate. **Record them as UNOWNED so somebody is
   assigned, rather than as not-mine three times over.**
10. **53 of the 61 DOM findings have no record anywhere**, so they cannot be re-checked by anyone,
    including me.
11. ✅ **VERIFIED 2026-09-02, against a warning that said otherwise: both my sweep documents ARE on
    master.** `wf-build3-005-ts-test-sweep.md` 111,514 bytes and `wf-build3-004-dom-test-sweep.md`
    15,964 bytes at `e0cb8f0fe`, with a non-existent path returning 0 as the control. **Ward Builder
    Two warned they live only on my branch and would never merge; that was true of its documents and
    is not true of mine. I checked rather than acting on it** — the correct response to a warning
    about relaying is not to relay the warning.
12. ⚠️ **Every mis-attribution RATE published last night is withdrawn** — _roughly half_, _12 of 37_,
    _5 of 10_, _32%_, and my own _"ten observed"_. **The only defensible statement is: one chat ran
    mutations on seven findings; three were mis-attributed, one with a stated caveat. Everything else
    in the network is reasoning. Seven is not a replacement rate.**

## D. THINGS THAT WILL BE LOST

0. ✅ **RESCUED 2026-09-02 — and the count in the line below was wrong, which is the point.**
   `.superpowers/` is ignored at `.gitignore:175`, so those files were **not on the branch at all**;
   merging would not have saved them. Both are now committed under
   `docs/ward-flow/rescued/ward-builder-three/` — the triage ledger and **`mutate.mjs`, the working
   mutation harness, which is the only item here that cannot be reconstructed from a commit
   message.** Copies verified **byte-identical by sha256**, and staging verified with **`git diff
--cached --name-only` → 2 files, 245 lines**, because ⚠️ **`git add` is a third member of the
   family this record catalogues: an operation whose silence is indistinguishable from success.**
   Ward Builder One staged a 82-file rescue that moved nothing while every hash matched, defeated by
   a `.gitignore` holding a single `*` that travelled with the payload. **No such file travelled with
   mine — checked, not assumed.**
   ⚠️ **AND THE COUNT: the file holds FIVE numbered rulings, not eight.** The other three below are
   findings recorded under Progress. **I wrote "eight" from memory of what mattered rather than from
   a listing of what exists** — the same error Ward Builder One made at two orders of magnitude, and
   the reason Ward Verifier told me to count before trusting my own record.
   **Not rescued, deliberately: the scratchpad drafts.** Their substance is already in the nine
   corrections committed to my main report, so they are reconstructible; the harness was not.
1. **`.superpowers/sdd/wf-build3-006-triage/progress.md` held five rulings and three Progress
   findings.**
   Substance preserved in the closing report and repeated here so it survives this file alone:
   **mutation agents must run strictly serial** (two agents mutating one checkout cannot attribute a
   red, and a reused build root has previously made mutations fabricate identical failure lists);
   **parallelism goes into read-only prep**, which never produces a verdict; **batch mutations by
   production file**, not one dispatch per finding; **prep agents must search the DOM tests and
   Playwright specs**, the families the sweep never read; **the bed-grid retraction stands** against
   challenge; **fix the ED journey with `click({ force: true })`**, the house pattern, not by
   weakening the assertion; **Ward Verifier's attack-4 cure does not work**, measured; **and its
   attack-5 mechanism was wrong** — the cause was the extractor truncating at a nested backtick.
2. **My scratchpad corrections 7, 8 and 9 in full** — the mechanism-versus-observation rule, the
   pooled-rate retraction, and the cast class. **Substance is in the closing report and in sections B
   and C above; the working detail goes.**
3. **`scratchpad/mutate.mjs`** — the mutation script written because `sed` and `node -e` escaping
   mangled every regex replacement I tried. **The lesson survives here: write a script file, do not
   fight shell quoting.**
4. **The five ledger requests queued beside this file are UNCOMMITTED-ELSEWHERE and unreconciled.**
   `docs/outstanding-issues-inbox/549924e0…`, `75e3b4fa…`, `a247a05f…`, `b156e33e…`, `d1c220b5…`.
   ⚠️ **If this branch is never merged and reconciled, all five vanish and nothing in the ledger
   records any of it.**
5. **The reasoning behind which files I did and did not read.** The sweep documents record findings,
   not the negative space — **and the negative space is the actual finding: a sweep's blind spot is
   set by its brief, and mine was set by a question I chose.**

---

## The one habit I would most want left behind

**Twice tonight I relayed a hazard's REASON without checking it, and both times the reason was the
part that was wrong** — `trial-merge-1130` is checked out nowhere, and the protected-delete override
does work as a command prefix. **A finding that arrives already believed loses its author's caveat at
every hop.** Re-derive, or name whose measurement it was.
