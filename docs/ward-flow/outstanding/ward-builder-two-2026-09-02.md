# Ward Builder Two — outstanding items, 2026-09-02

**Branch `claude/ward-builder-two`, tip `38f90d138`, tree clean. FULLY FOLDED** —
`git log --oneline codex/task-ward-flow-live-state-20260831..HEAD` prints nothing, and
`git merge-base --is-ancestor HEAD <master>` returns true. **Nothing of mine is outstanding as code
or as paperwork.**

⚠️ **The instruction's master tip `e38adb2f8` is nine minutes stale.** Measured here: master is
**`1bbe02d75`** (12:01), and `e38adb2f8` (11:52) is its ancestor. My tip is folded on both.

---

## A. DECISIONS FOR THE OWNER

1. **`specialling` on the ED referral form still pre-selects "no".** Ruling 1 has landed and the
   reducer now enforces one-to-one capacity, so this default feeds a decision, not a display.
2. **Four controls pre-select the data-provenance reason** — `ed-screen.tsx:630`, `:848`,
   `shortlist-panel.tsx:257`, `:285`. Should they start unset?
3. **Should a coordinator see a patient's `suburb`?** Raised by Ward Builder Three too; duplicated
   here deliberately.
4. **Should the referral board show an ED referral's `purpose`?** Ward Verifier argues it is a safety
   rule, not presentation.
5. **Add a multi-destination referral to the seed?** Without one, owner ruling 6 cannot be seen on the
   running app at all. Fixture decision, deliberately not taken by me.
6. **How long should the "recently answered" list be?** It is uncapped, so "recently" decays with use.
7. **Can an emergency department ever _accept_ a referral?** Nothing produces that state today, so one
   branch of the ruling-8 wording has no reachable input and no test.
8. **Who owns `tests/ward-screen-fd23-leaks.dom.test.tsx`?** Asked eight times. Not mine — I read its
   imports directly. Not Ward Builder One's. By elimination, Ward Lead's.

---

## B. DEFECTS STILL PRESENT

1. **`ward-referrals.ts:110` — `referralDestinationLabel` discards `purpose`.** A coordinator reading
   the board sees **"Also refused — Emergency department: No suitable bed"** for a referral that never
   asked for a bed. **The reason text asserts a request that was not made.**
2. **`ed-screen.tsx:630`/`:848`, `shortlist-panel.tsx:257`/`:285` — provenance reason pre-selected.**
   A clinician correcting a mistyped legal status, who never touches that control, **files the
   correction as a fresh report from the treating team. The record then says the treating team stated
   something it never stated.**
3. **`ed-screen.tsx` — `specialling` defaults to `false`.** A referral is raised recording that a
   patient needs no one-to-one nursing when nobody said so, **and the reducer now uses that to decide
   whether a ward has capacity.**
4. ✅ **Finding 7.4 (`tests/ward-referral-matching.test.ts`) — CONFIRMED BY MUTATION at master
   `ebd1c25ac`. Promoted from lead. This is the only mutation-observed finding I hold.**

   ⚠️ **First, the sweep undersold the guard and I nearly dismissed it on that.** D15 is not a naive
   regex check: `collectModuleGraph` follows every local import **transitively** from
   `ward-eligibility.ts` and `ward-referrals.ts`, comments are stripped by a scanner that tracks
   regex literals, and it carries a non-vacuity floor.

   **The hole is exact: `collectModuleGraph` walks `importStatementsOf(source)` and nothing else. It
   never considers `export … from`.** A re-export is not an import, so a passthrough module is
   entered, found to hold no import statements, and the walk stops — never reaching what it
   re-exports.

   **The mutation, an ordinary refactor idiom rather than a contrivance:**

   ```ts
   // release-passthrough.ts
   export { releaseBand as bandFor } from "./ward-bed-availability";
   // ward-eligibility.ts
   import { bandFor } from "./release-passthrough";
   export const MUTATION_PROBE_BAND = bandFor; // a real consumer, not dead code
   ```

   **The rename completes it** — the identifier check scans import-statement text, and `bandFor` is
   not in `BED_RELEASE_IDENTIFIER`.

   **Result — nothing anywhere catches it:**

   ```
   ward-referral-matching.test.ts   Test Files 1 passed (1)     Tests 35 passed (35)      exit 0
   tsc -p tsconfig.typecheck.json   exit 0, 0 error TS lines
   WHOLE WARD SUITE (from disk)     Test Files 151 passed (151) Tests 2196 passed (2196)  exit 0
   ```

   ⚠️ **151 discovered from disk with a refusal below 100, so not a silent zero. Paired with `tsc`
   because a vitest-only run cannot see a type-change falsifier — neither saw this one.**
   **Restored: `sha256sum -c` OK, 0 residue, `i/lf w/lf`.**

   **What it means:** moving the release model behind a passthrough — a routine tidy-up — silently
   removes the D15 separation with every gate green. **Smallest fix: follow `export … from`
   specifiers in `collectModuleGraph`, and include re-export statements in the identifier scan.**
   ⚠️ **NOT written and NOT tested by me. `tests/` is Ward Lead's.**

### CLOSED since my last report — verified, not assumed

**The ten undeclared `var()` references are FIXED at `1bbe02d75`.** All six names return **0**
occurrences on the master tip (control: `var(--wb-tap)` returns 3 in the same command, so the search
discriminates). The replacements — `--border`, `--border-strong`, `--surface`, `--text`,
`--text-muted`, `--ward-canvas` — are each declared 4–7 times (control: a fabricated token returns 0).
**The defect was closed, not moved.**

✅ **The scope question is now ANSWERED, and I verified it myself rather than accepting the answer.**
`--surface` (`globals.css:357`), `--text` (`:366`) and `--border-strong` (`:375`) are declared on
**`:root`**, and `globals.css` is imported by the **root layout** at `src/app/layout.tsx:14`. `:root`
is the document element and custom properties inherit, so they reach these rules from the top of the
document regardless of CSS-module class scoping. Found by Ward Verifier; read by me at the enclosing
selector rather than inferred from the line.

⚠️ **Mechanism determined, render not observed** — `:root` + inheritance + a root-layout import is as
strong as a static answer gets and is still not a screenshot.

⚠️ **BUT THAT ANSWER DOES NOT COVER ALL SIX, AND THE GAP IS REAL.** Ward Builder One doubted the
scope on different grounds and it was right to: **`--ward-canvas` is NOT on `:root`.** It is declared
on **two class scopes** — `.patientWorkspace` (`ward-management.module.css:5`) and `.clinicalRail`
(`:70`) — and a token declared on an ancestor that does not contain the element is still undeclared
where it is used. Ward Verifier's `:root` answer covers `--surface`, `--text` and `--border-strong`;
it does not cover this one, and I closed the whole finding on it.

✅ **Resolved by determining the nesting, which neither chat had done.** The two sites the fix
repointed — `.blockerInput` (`:927`) and `.blockerButton:disabled` (`:949`) — render in
`ward-management-console.tsx` at lines 472/551/561/582, inside the `.patientWorkspace` div opened at
line 221. Evidence: **no intervening `return (`** between 221 and 472, **net `<div>` depth +1** across
that range (12 opens, 11 closes), and deeper indentation on the controls. **So the declaring scope
does contain them and the fix holds.**

✅ **And the answer is better founded than the nesting read alone — a structural fact I verified
after Ward Verifier pointed at it.** `--ward-canvas` **never crosses a module boundary**: every module
that uses it also declares it, on its own root container.

```
ward-management.module.css        uses  8   declarations 2
ward-management-modes.module.css  uses 12   declarations 1
ward-sidebar.module.css           uses  3   declarations 1
board/board.module.css            uses  0   declarations 0
CONTRAST — a :root token, used where it is never declared:
ward-management.module.css        var(--surface) uses 2  declarations 0
board/board.module.css            var(--surface) uses 6  declarations 0
```

**So there are two conventions in this codebase, and the failure surface for the per-module one is
narrow:** not _"does some ancestor somewhere provide it"_ but _"does this module's own root container
wrap this module's own controls"_ — which is exactly what the JSX read answers. **Ward Verifier also
enumerated the render sites to look for a fifth outside `.patientWorkspace`; there is none.**

⚠️ **Still a static reading of JSX nesting, not a rendered DOM. Nobody has opened the board.**

### ⚠️ THE FORCED-COLORS RESIDUAL IS WITHDRAWN — observation true, mechanism false

I recorded it as OPEN and said _"reasoned about by nobody"_. **Both halves were wrong.** Refuted by
Ward Builder Three, relayed by Ward Builder One, and **verified here by reading the block rather than
accepting either.**

The observation is true: `globals.css:4388` opens `@media (forced-colors: active)` on `:root, .dark`
and remaps `--surface` → `Canvas` (`:4393`), `--text` → `CanvasText` (`:4397`), `--border-strong` →
`ButtonText` (`:4403`). ⚠️ **My own note was imprecise too — I wrote `--text-muted` where it is
`--border-strong`, because I read a 10-line window that missed the `@media` at 4388 and the `:root,`
at 4389.**

**But that mapping is the block working, not failing.** Our three controls resolve to **CanvasText on
Canvas with a ButtonText border** — the correct native high-contrast pairing. **And the block's own
comment at `:4410` reasons about precisely the hazard I raised**, unprompted and before any of us:

> _"Chromium paints a Canvas backplate behind every glyph run in forced-colors mode, so label/glyph
> tokens must never resolve to the Canvas/ButtonFace family — Canvas-on-Canvas glyphs vanish and
> solid buttons render blank label boxes."_

**That is my worry, stated more precisely than I stated it, by the author of the thing I was worried
about.** _"Reasoned about by nobody"_ was a claim about the world made from my own not having looked.

**No residual remains on this finding beyond the un-opened board.**

⚠️ **Corrections to my own earlier statement of this, both verified here:**

- **It is THREE controls, not two.** `.awayButton` is used at `ward-board.tsx:1461` **and** `:1478`;
  `.leavingSelect` at `:1398`. Control: a fabricated class name returns nothing.
- ⚠️ **New residual, nobody has looked:** the forced-colors block around `globals.css:4393`
  redefines `--surface`, `--text` and `--text-muted` to `Canvas`/`CanvasText`. **What that does to a
  control that also sets its own background has not been reasoned about by anyone**, and it should be
  before this is called finished.

---

## C. BELIEVED BUT NOT VERIFIED — read this first

1. **All 24 triage verdicts** in `docs/ward-flow/triage/wf-build2-006-batch-{a,b,c}.md`. Reached by
   reading code and tracing paths at **`5c1dc6080`**. ⚠️ **No mutation run on any of them. Leads, not
   verdicts.** ⚠️ **Batch B's own title says "mutation-verified" and that is false.**
2. **`Test Files 6 passed (6)` / `Tests 267 passed (267)`, tsc exit 0** — measured on a trial merge of
   **`c60a26d03` with `268fcd6a8`**. Master is now `1bbe02d75`. **Not re-run.**
3. **Ruling 10 is blocked** because my projection holds zero references to `Movement` /
   `referredUnitIds` — measured at **`5c1dc6080`**, not since.
4. **The pre-selected-default sweep: 115 controls enumerated, 9 read in full, ~106 pattern-matched,
   39 uncovered by two of four idiom searches.** At **`5c1dc6080`**. ⚠️ **A pattern scan is not a
   sweep — treat the ~106 as unswept.** Only the 9 were read.
5. **The changed proof standard** (a mutation must leave every earlier assertion passing). Two guards
   were rebuilt for it — `c5f697b6b`, `2d075bcf0`. **The rest of my branch has never been audited
   against it.**
6. **The two corrections in the close-down notice** — that `trial-merge-1130` is checked out nowhere,
   and that the protected-delete override works as a command prefix. **Received, not verified by me.**
7. ⚠️ **Messaging to Ward Lead: record it as _"traffic never observed to arrive, cause unproven"_** —
   never as a general failure and never as its opposite. The address is right (`git worktree list`
   confirms it), sends return success, and a forced turn produced nothing, so the queue explanation is
   dead too. Ward Verifier's lead is that delivery may depend on both sessions sharing a permission
   class. **Hypothesis, not proof.** Three of us have now been wrong on this in both directions.
8. **My own scratch branch `trial-merge-1120` still exists.** The protection hook refused its removal
   and **I did not bypass it.** It holds nothing unique.

---

## D. THINGS THAT WOULD BE LOST — substance recorded here

1. **The WF-BUILD2-006 triage — RESCUED at `38f90d138`.** 1,853 lines, 24 findings with executable
   mutation specifications and predicted red files, moved out of git-ignored `.superpowers/`
   (`.gitignore:175`) to `docs/ward-flow/triage/`. Each file carries a banner recording that nothing is
   mutation-observed and that batch B's title is false.
2. **NOT rescued, deliberately: the SDD ledger** `.superpowers/sdd/ward-rulings-6-7-8/` (291 lines plus
   review packages). Its rulings and evidence are already in the commit messages of the work it
   governed, which is folded. **Nothing in it is unique.**
3. ⚠️ **The method lessons, which live only in my context and in commit messages. Their substance:**
   - **A control that shares no mechanism with the failing search is decoration.** Mine proved `grep`
     started, not that my pattern could match — twelve confident noughts from `\Q…\E` inside `grep -E`,
     which would have closed a real clinical-surface defect as a false positive.
   - **A mechanism is not confirmed until you have looked at what it applies to.** Two chats spent an
     hour reasoning about a CSS property; the selector that changed the answer was two lines above it.
   - **A finding is ready to send when the mechanism is confirmed, not when the observation is.** Four
     times today my observation was right and my mechanism wrong — and the mechanism is the half that
     decides what somebody does.
   - **An unchecked premise that three chats hold looks exactly like a corroborated one, and the
     corroboration is an artefact of the relay.** I then relayed a withdrawn figure inside the very
     commit that stated this.
   - **A tally carrying its method cannot be quoted as a rate; a percentage always can.** Four
     versions of one triage rate were published and withdrawn across three chats.
   - **The premise most worth checking is the one you are leaning on, and leaning on it is what makes
     it invisible.**
   - ⚠️ **THE SENTENCE THAT SUBSUMES ALL FOUR SHAPES, and Ward Verifier's clause is the one that
     makes it actionable:** _the check ran, returned cleanly, and answered something adjacent —_ **and
     nobody said where it stopped.** The adjacency is only invisible because the boundary went
     unstated. **Every one of these becomes detectable the moment the reporter says what their check
     did NOT cover.**
   - ⚠️ **A FIFTH SPECIES, AND THE SENTENCE ABOVE DOES NOT COVER IT.** The other four were a check
     whose _scope_ was narrower than its use. This one is not narrow at all. `SendMessage` returns
     **"accepted for delivery"** — exact, complete, correctly reported. **Four chats summed it into a
     delivery count, then into evidence of readership, and concluded Ward Lead was not reading.**
     Nothing about the result was wrong: **we changed what it meant by counting it.** The tool never
     claimed readership; we inferred it from acceptance. **The falsifier nobody ran: our work was
     being folded the whole time** — five of Ward Builder Three's commits and six of mine were already
     ancestors of master while we were describing the channel as dead. **The silence was doing the
     arguing.**
     **Detection rule: before summing a result, say what one instance of it asserts.** A count
     inherits the meaning of its unit, and no amount of scope-stating catches a unit misread.
   - ⚠️ **Both of tonight's stale-position errors were caught by a peer's offhand remark, not by
     either chat reviewing its own document.** Mine was **repeating a reading** — "seven unmerged"
     across three messages without re-measuring, while master moved six times in two hours. Ward
     Builder Three's was **a number outrunning its own measurement** — true when taken, false within
     minutes because it kept committing. **Different causes, identical effect on a reader, and neither
     was self-caught.** ⚠️ **Mine was in the report about my own position, which is the one number a
     handover exists to state.**
     ⚠️ **I first framed the `:root` case as "a correct answer to a narrower question, nobody
     misstated anything". Ward Verifier rejected that as too generous to itself**, and it is right:
     it knew the finding spanned two files, had listed all ten references itself, checked one file and
     reported as though it had checked the finding. **Not an innocent scope mismatch — an unstated
     boundary on its own work**, the same defect as its truncated type read and Ward Builder One's
     session-scoped commit count. **Three chats, one shape.**

4. ⚠️ **ONE DURABLE CHECK, worth more than any of the lessons above because it is executable.**
   **After any `git add`, run `git diff --cached --name-only | wc -l`.** Ward Builder One staged 81
   rescued files, every verification it ran passed — file count, aggregate `sha256`, CR-byte
   comparison, `git add` exiting 0 — and **nothing was staged.** Only that one command caught it.
   It is cause-agnostic: it catches a nested ignore file, a root ignore rule, a wrong path, or a
   pattern that matched nothing.

   **Why this one outranks the other three shapes:** a broken `grep` pattern and an unstated set
   boundary are **defects, and a defect can be fixed**. `git add` staging nothing is **the tool
   behaving exactly correctly**, and its success is indistinguishable from its failure. **That will
   still be true tomorrow, so it can only ever be checked for.**

   ⚠️ **The cause is per-worktree, not a property of the tool.** Ward Builder One's SDD workspace
   carries its own two-byte `.gitignore` containing `*`, created 2026-09-01 19:32; **mine has none**
   (control: `find` sees dotfiles there, and returns exactly one elsewhere). **Its first message
   generalised from that single instance to four chats and it corrected itself within the hour.**
   My own exposure came from the repo-root rule `.gitignore:175` instead. **The check survives the
   difference; the explanation did not.**
