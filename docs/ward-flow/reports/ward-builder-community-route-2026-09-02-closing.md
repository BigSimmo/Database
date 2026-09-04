# CLOSING REPORT — Ward Builder One (`claude/ward-builder-community-route`)

**Branch read from git, not recalled:** `claude/ward-builder-community-route`, HEAD `041ab1de4`.

**Fully folded.** `git log --oneline codex/task-ward-flow-live-state-20260831..HEAD` prints nothing.
**I have merged nothing, pushed nothing, and run no Playwright.**

**Gate at `041ab1de4`:**

```
tsc -p tsconfig.typecheck.json --noEmit  → 0 errors, exit 0 (read via PIPESTATUS, not after the pipe)
  control for that nought: --listFiles   → 4600 files processed, so tsc genuinely ran
vitest, 19 files discovered from disk    → 19 files passed, 364 RAN, 364 passed
```

⚠️ **My previous report said 15 files / 305 tests. Both numbers were honest and the set was too
narrow.** The file set is a glob choice, and a wider glob found four more files and 59 more tests.
**A discovered set is only as wide as its pattern — state the pattern, not just the count.**

---

## 1. DONE SINCE THE LAST REPORT, BY COMMIT

- **`989bd2e23`** — re-anchor the register claim `referral-to-bed/a-null-referral-id-means-a-movement`
  after ruling 1 inserted `specialling` mid-citation. **The claim survived; the citation moved.**
  Reading it rather than re-pointing it also found the claim's doc comment naming the **wrong event**
  (`PATIENT_ARRIVED`; the admission is built in `PULL_PATIENT`). Mutation-proved, then hash-verified.
- **`796169a64`** — remove an `as Admission` cast in `tests/ward-statistics-incoherent-gap.test.ts`
  that hid **one phantom field and eight absent required fields**.
- **`6702ba7e2`** — resolve a `TS1117` produced by a **clean** merge: master and I independently added
  the same `specialling: false` line with different comments. Kept master's block.
- **`041ab1de4`** — the handover document.

---

## 2. UNCOMMITTED OR HALF-DONE

**Nothing. Working tree clean, everything folded.**

⚠️ **One artefact will NOT survive, and I have folded its substance into §5 rather than leave it:**
a read-only diagnostic of the three repository failures, written to session scratch outside the
repository. **Its findings are reproduced below so nothing of value lives only in git-ignored scratch.**

---

## 3. QUESTIONS STILL OPEN FOR THE OWNER

1. ⚠️ **Cross-page inference on the community hub.** 65 team pages, each naming who was referred to
   that team, all reachable from one index. **Anyone who opens two pages learns a person was referred
   to both**, without the software ever displaying it. FD-23 governs a _ward-scoped_ viewer; a
   community team page is a viewer scope nobody has defined. **Not answerable by any search over
   source.** Moot only while every seeded referral is single-destination — hand-counted by Ward
   Builder Two, and the fixture has changed three times today.
2. **Does the claims register cover every figure?** Figure 3 shipped without an entry; its siblings
   have them. Either a parity follow-up, or a decision that the register is not per-figure.
3. **`specialling` on the ED referral form** is still unset-able. Ruling 1 has landed and the reducer
   now enforces one-to-one capacity, so it feeds a **gate**, not a display.
4. **Small:** the community hub reads _"Expected discharge was 1 week ago"_ when overdue — past tense
   in place of the banned word. Implementer's choice, not a ruling.
5. **`tests/ward-screen-fd23-leaks.dom.test.tsx` — who owns it?** Eight asks between me and Ward
   Builder Two. Same `allUnits()`-only blind spot at line 214 that I closed at `64b4c1388`; the shape
   is already worked out there. **Ward Builder Two opened it and ruled it outside its own scope.**

---

## 4. BELIEVED BUT NOT RE-CHECKED AT THIS TIP

- **All 34 statistics pages cold-start reachable** — established several merges ago, not since.
- **The FD-23 sweep of community and statistics found one direct read**, a boolean predicate
  structurally unable to leak. **Measured at `f8cd8d17b`, long superseded.**
- ⚠️ **A self-defeating-guards sweep returned four negatives of UNDETERMINED method.** Its transcript
  was 0 bytes, so read-versus-matched cannot be established, and **the wrong method produces an
  identical report.** Do not treat those 14 files as clean.
- **Three of four mutation proofs from the previous session overstate.** `2baf11a0f`'s "every pin
  fired" is false — **an aborting loop demonstrates at most one assertion per run.**
- ⚠️ **`BedRelease.waitingOn` never read back, and `dischargeConfirmedAt` having no runtime writer,
  are UNVERIFIED LEADS** from an audit whose parent died before synthesising its children. **Two other
  findings from that run were false and I withdrew both.**
- ⚠️ **My triage rate is withdrawn in every form** — the 5-of-10 and the 12-of-37 aggregate alike.
  Only the reformulation survives: _triage before allocating, because a meaningful fraction are not
  gaps._

---

## 5. THE THREE REMAINING REPOSITORY FAILURES

**All three reproduce at my HEAD `041ab1de4`:**

```
vitest run tests/design-token-contract.test.ts tests/stale-resume-instructions.test.ts \
           tests/test-runner-safety.test.ts
Test Files  3 failed (3)
     Tests  3 failed | 87 passed (90)      ← 90 RAN
```

### NOT MINE — `tests/design-token-contract.test.ts`

### NOT MINE — `tests/stale-resume-instructions.test.ts`

### NOT MINE — `tests/test-runner-safety.test.ts`

**Stated explicitly, as instructed. None of the three is mine.**

**Evidence — and note the correction to my own method.** I first checked eleven commits: **this
session's only, which I did not say.** Two of my own earlier commits (`ab16d11a9`, the community front
door; `f21ba35aa`, the claims register) sit in the very hour under suspicion. **Re-checked properly:
28 commits have touched those two CSS files, back to `101f02b5c` — the commit that first added Ward
Flow. Twenty-seven have zero overlap with community, statistics or the register; the one that overlaps
is a board commit incidentally touching a statistics file.** Both commits named by other chats are
ancestors of the master line, contained by 37 branches, and predate every current branch.

### ⚠️ WHAT I FOUND ANYWAY — the fix is probably NOT a fallback

**Read from the files, with a control run both ways:**

```
--ward-surface       declarations: 0    CONTROL --ward-border: 3  (same file, lines 8 and 72)
--clinical-surface   declarations: 0    CONTROL --clinical-accent: 3 (globals.css)
--clinical-text      0   --clinical-border 0   --clinical-border-subtle 0   --clinical-text-muted 0
```

**Every missing token is an isolated absentee from a family that otherwise exists.**
`.patientWorkspace` declares the whole `--ward-*` family by aliasing design-system tokens
(`--ward-canvas: var(--surface)`, `--ward-border: var(--border)`, `--ward-muted: var(--text-muted)`) —
**`--ward-surface` is simply not in that list.** Likewise `--clinical-accent` and its `-soft`,
`-border` and `-contrast` siblings all exist, while the five plain `--clinical-*` names never did.

**So these read as references to tokens that were never declared under the names used, not as tokens
awaiting a value.** An independent diagnostic reached the same conclusion: **nine of the ten
references have a real, already-declared token they should have used**; **`--clinical-border-subtle`
has no analog anywhere in the repository and its value is an owner decision — I did not invent one.**

⚠️ **The harm, corrected twice between chats and still worth stating carefully.** The declarations sit
on `.leavingSelect` (a `<select>`) and `.awayButton` (a `<button>`), **both `min-height: 3rem`
production tap targets** — I read the selectors rather than reasoning about the properties alone.
`background` and `border` are non-inherited and fall away; `color` is inherited, so text takes the
parent's colour rather than vanishing. **The result is two interactive controls with no background and
no border — an "Away" button and a "Leaving" selector that no longer look like controls.** An
invisible affordance rather than unreadable text. **Legibility itself needs the rendered board, which
I have not opened.**

**On the other two:** an independent check reports `git merge-base --is-ancestor` **exit 1 for both**
`claude/Wardquestions` and `claude/Ward-design` — **neither is merged, so both are live and the marker
must say exactly that.** ⚠️ **`Wardquestions` holds the orchestrator handover and ten other ward
documents that exist nowhere else; marking it merged would be worse than the present silence.** The
third failure needs one `rmSync` in `tests/ward-flow-chat-control.test.ts` given the retry-bounded
shape **already used earlier in the same file**.

**All three are cheap and all three have exact catchers. I will take them if the owner says so; I have
touched no file outside my scope.**

---

## 6. TWO CORRECTIONS I ACCEPT, AND ONE I ADD

- **`trial-merge-1130` is NOT checked out anywhere.** My handover §11 says it is checked out in the
  master worktree. **That is wrong** — `git worktree list` settles it. I over-read a `git branch`
  marker.
- **The protected-delete override DOES work as a command prefix.** My handover §11 says it does not.
  **That is wrong** — it was used to rename the master worktree at 11:15. My attempt failed for some
  other reason and I generalised from a single failure.

**I have not edited the folded handover.** Amending a delivered document to hide an error is worse than
leaving the error with its correction beside it.

- ⚠️ **ADDED — a reporting rule that cost me a near-miss today.** My first run of the three failing
  tests used `--reporter=basic`. **That reporter does not exist in this vitest.** It died at startup:
  `Error: Failed to load custom Reporter from basic`. **Zero tests ran and zero failures were
  reported.** Had I checked only the exit code, I would have reported three failures as fixed.
  **Name the reporter you used, or use none — a flag that does not exist is silent.**

---

## 7. STATE

**Idle. Nothing uncommitted. Nothing merged, pushed or deleted. Working tree clean at `041ab1de4`.**
