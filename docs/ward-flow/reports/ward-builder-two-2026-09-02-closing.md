# Ward Builder Two — closing report, 2026-09-02

**Branch `claude/ward-builder-two`** (`git rev-parse --abbrev-ref HEAD`). **Tree clean.**

⚠️ **Correction to the close-down instruction, measured not recalled.** It says _"all four branches
are folded… nothing printed = you are fully merged."_ Run at master `9043e852a`:

```
git log --oneline codex/task-ward-flow-live-state-20260831..HEAD
  a90cca4f5  831541b11  79f3b9afb  f23c06859  ce8e821c6  1f757d173
```

**Six commits print. I am not fully merged.** All six are **report files only — no source file, no
test file.** My _work_ is folded (`015804867`); my _paperwork_ is not. Ward Lead should fold or
discard these six deliberately rather than on the assumption that nothing is outstanding.

---

## 1. Since my last report — by commit

| Commit                                   | What                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `1f757d173`                              | The consolidation report: merge verdict, pins, contradictions.                                                                                                                                                                                                                                                                                                                                                                       |
| `ce8e821c6`                              | ⚠️ That verdict went stale in **ten minutes** — I was folded at `015804867` while writing it. Evidence marked as standing, counts as history.                                                                                                                                                                                                                                                                                        |
| `f23c06859`                              | ⚠️ **I attached a false mechanism to a true observation, aimed at the owner.** I called a pre-selected `LEGAL_STATUS_CHANGE_REASONS[0]` _"software choosing a reason for a liberty decision"_ — read from the variable's name. Its two members are `recorded_by_treating_team` and `correcting_an_error`, and the list's own doc comment forbids exactly what I described. Caught by Ward Verifier; verified by me before accepting. |
| `79f3b9afb`                              | Landed the triage tally, which until then existed only in a chat message.                                                                                                                                                                                                                                                                                                                                                            |
| `831541b11`                              | ⚠️ **I relayed a withdrawn number inside the very commit that stated the rule against relaying.**                                                                                                                                                                                                                                                                                                                                    |
| `a90cca4f5`                              | ⚠️ Removed the one rate I had left standing after writing that none survived.                                                                                                                                                                                                                                                                                                                                                        |
| _(this file + `docs/ward-flow/triage/`)_ | The closing report and the rescued scratch below.                                                                                                                                                                                                                                                                                                                                                                                    |

**Every one of these is a correction to my own work. No source file has changed since the fold.**

---

## 2. Uncommitted or half-done

**Nothing uncommitted. Tree clean, verified with `git status --short`.**

### ⚠️ Rescued from git-ignored scratch in this commit

`.superpowers/` is ignored (`.gitignore:175`), so the whole WF-BUILD2-006 triage would have been
lost. **Preserved to `docs/ward-flow/triage/wf-build2-006-batch-{a,b,c}.md`** — 1,853 lines, 24
findings with executable mutation specifications and predicted red files.

**Each carries a banner rather than a quiet edit**, recording three things:

- ⚠️ **No mutation has been run on any of the 24.** They are leads, not verdicts.
- ⚠️ **Batch B's own title claims "mutation-verified at HEAD". That is false**, and the title is left
  as written — a document that silently corrects itself hides that the claim was made.
- The "11 files changed since `b5205b45a`" staleness aggregate is **void**: that commit is not an
  ancestor of this branch, so the figure is a diff between divergent tips. Per-finding staleness
  verdicts were re-derived from HEAD and stand.

**Still git-ignored and NOT rescued, deliberately:** the SDD ledger for rulings 6/7/8
(`.superpowers/sdd/ward-rulings-6-7-8/`, 291 lines plus review packages). Its rulings and evidence are
already in the commit messages of the work it governed, which is folded. **Nothing in it is unique.**

**WF-BUILD2-006 itself: NOT STARTED. No mutation run.**

---

## 3. Questions for the owner — everything I still hold

1. **Should the referral form stop pre-selecting "no one-to-one nursing"?** I fixed five clinical
   fields at `26228864a` and left this one because ruling 1 was open. **It has landed, and the reducer
   now enforces one-to-one capacity — so this default now feeds a decision rather than a display.**
2. **Four controls pre-select the data-provenance reason** (`ed-screen.tsx:630`, `:848`,
   `shortlist-panel.tsx:257`, `:285`). A clinician correcting a mistyped legal status who never
   touches the control **records the correction as a fresh report from the treating team.** Audit
   trail, not liberty — see the correction in §1.
3. **Should a coordinator see a patient's suburb?** Raised by two other chats as well.
4. **Should the referral board show what an ED referral is asking for?** Verified myself:
   `referralDestinationLabel` (`ward-referrals.ts:110`) receives the whole destination, `purpose`
   included, and returns the kind alone — so the board reads _"Also refused — Emergency department:
   No suitable bed"_ where no bed was requested.
5. **The demo data cannot show ruling 6 at all** — all ten seeded referrals go to one destination.
   The constructor for the two-armed shape already exists
   (`tests/ward-community-referral-survives.test.ts:40`) and is test-local. **Add one to the seed?**
6. **The "recently answered" list is uncapped**, so "recently" decays with use. How many rows?
7. **Can an ED ever _accept_ a referral?** Nothing produces that state today, so one branch of the
   new wording has no reachable input and no test.

---

## 4. Believed but NOT re-checked

- **`Test Files 6 passed (6)` / `Tests 267 passed (267)`, tsc exit 0** — measured on a trial merge of
  my tip with the master line, at **`c60a26d03` merged with `268fcd6a8`**. **Not re-run at
  `9043e852a`.** Master has moved since.
- **The 24 triage verdicts**, all at **`5c1dc6080`**, all by reading. **None mutation-observed.**
- **Ruling 10 is blocked** because my projection holds zero references to `Movement` /
  `referredUnitIds` — measured at **`5c1dc6080`**, not since.
- **The pre-selected-default sweep's coverage** (115 enumerated, 9 read in full, ~106
  pattern-matched) — at **`5c1dc6080`**. ⚠️ **A pattern scan is not a sweep, so the ~106 are
  unswept.**
- **The changed proof standard.** Two guards rebuilt for it (`c5f697b6b`, `2d075bcf0`). **I have not
  audited the rest of my branch against it.**

---

## 5. The three repository-wide failures — explicitly

### `tests/design-token-contract.test.ts` — **NOT MINE**

`board/board.module.css` last touched `80d76c478` (09-01 19:38); `ward-management.module.css` last
touched `96bd7aa18` (09-01 19:56). **Both before my window opened at 20:55, and neither appears in any
of my 44 commits** — checked with `git show --numstat` over every one. **Control: the same query on
`ward-eligibility.ts`, which I did author in, returns 2.** Ward Builder One establishes both commits
predate all five current branches, so **no current builder owns them.**

**Diagnosed anyway, since nobody owns it:** six property names, **ten references** — not ten
properties; anyone told ten will hunt four that do not exist. `var(<name>,` returns 0, so **no
fallback anywhere**; `<name>:` returns 0 declarations under `src/`.

⚠️ **My statement of the harm was wrong twice and this is the corrected version.** The rules sit on
`.leavingSelect` (a `<select>`) and `.awayButton` (a `<button>`), both `min-height: 3rem` production
tap targets. An undeclared `var()` with no fallback makes the declaration invalid at computed-value
time, so — **certain:** `background` → transparent, `border` shorthand → gone, and the browser's own
control chrome is lost too, because the author declaration wins the cascade _before_ going invalid.
**Not certain:** `color` is an **inherited** property, so it takes the parent's colour, **not
nothing**. **So the harm is two interactive controls that stop looking like controls, not unreadable
text.** Legibility depends on the rendered board and **cannot be settled from CSS — somebody must
open it.**

### `tests/stale-resume-instructions.test.ts` — **NOT MINE**

`docs/ward-flow-coordination-rules.md` and `docs/ward-flow-fold-manifest-2026-08-31.md`: **0 commits
by me, ever.**

### `tests/test-runner-safety.test.ts` — **NOT MINE**

`tests/ward-flow-chat-control.test.ts`: **0 commits by me, ever.**

---

## 6. The two corrections in the instruction — carried, not re-derived

I have **not** verified either myself and am recording them as received: `trial-merge-1130` is
checked out nowhere, and the protected-delete override **does** work as a command prefix. ⚠️ **My own
scratch branch `trial-merge-1120` still exists** — the protection hook refused its removal earlier and
**I did not bypass it.** It holds nothing unique. I am not sweeping it now: the instruction says do not
delete any branch.

---

## 7. What I would want a successor to read first

**Not the findings — the method that kept breaking them.** Four times today a claim of mine was
correct in substance and wrong in mechanism, and each time the mechanism was the half that would have
changed what somebody did:

- a rate that was reasoning wearing a decimal point;
- a relayed number quoted inside the rule against relaying;
- a liberty defect that was an audit-trail defect;
- unreadable text that was an invisible button.

**Each survived a check I had actually run.** The searches were real; their scope was wrong. **A
control that shares no mechanism with the failing search is decoration** — mine proved that `grep`
started, not that my pattern could match. And **a mechanism is not confirmed until you have looked at
what it applies to**: the selector was two lines above the declaration two chats spent an hour
reasoning about.

**Every one was caught by another chat opening the file instead of accepting my summary of it.**
