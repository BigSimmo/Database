# Parked debt, 2026-09-04

Everything found tonight that is **real, measured, and deliberately not being fixed now**, because the
owner redirected the work to finishing the movement workspace page. Recorded here rather than in a
chat message, because a finding in a chat message is lost.

Every figure below was measured, and says how. Nothing here is an estimate.

---

## 1. Checks that cannot fail — the largest population, and the least visible

Measured across **193** Ward Flow test files (discovered from disk with a glob, not hand-listed).

### 71 count-shaped assertions over NAMEABLE members

An assertion of the form `expect(xs.length).toBe(N)` over a derived collection **survives a member
being swapped for a different one**, and survives a member moving between files. Comparing a sorted
LIST of names catches both. 71 of the 72 exact-count assertions (N ≥ 2) are over collections whose
members are nameable; the one exception is a SHA-256 length check, which is genuinely just a number.

⚠️ **The two worst are self-aware, which is what makes them worth quoting.**

| Where                              | Assertion                            | Its own comment                                                                 |
| ---------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------- |
| `tests/ward-nav.test.ts:152`       | `wardFlowRoutes.length).toBe(32)`    | admits a route was "swapped for another, same count"                            |
| `tests/ward-landmarks.test.ts:216` | the same `toBe(32)`, hand-duplicated | warns the duplication is "how one gets updated and the other silently does not" |

Both files repeat the pattern one level down on `RENDERABLE_ROUTES.length).toBe(31)`. Also:
`ward-bed-release-lifecycle.test.ts:491` asserts `rejections).toHaveLength(6)` for six distinct
rejected reducer actions without naming which six; and `BED_RELEASE_BLOCKERS.length).toBe(8)` is
pinned in two files as a deliberate tripwire that never checks the eight blocker strings themselves.

**The strong shape already exists in this repository**, which is the frustrating part.
`tests/ward-shell.dom.test.tsx:43` pins the stylesheets that paint `--ward-ground` as a sorted list
with a comment saying exactly why a count would not do. It was written by somebody who had thought
about this, in a neighbouring file, while the integrator reasoned the same property out from scratch.

### 17 of 18 `.every()` assertions have no anti-vacuity floor

`expect(xs.every(p)).toBe(true)` is **vacuously true on an empty array**. Seventeen of the eighteen
direct `.every()` assertions have no non-empty floor on the same collection nearby. 131 explicit
`toBeGreaterThan(0)` floors exist elsewhere in the corpus, so the discipline is known here — it is
just not applied to this shape.

⚠️ **Un-triaged and named rather than guessed:** a further **184** exact-count-of-1 assertions
(`toBe(1)` / `toHaveLength(1)`) are the same shape family, at a scale nobody has classified. The
number is stated; its composition is not known.

### 16 files read source but import nothing from `src/`

`npm run test:focused` is `vitest related --run`, which selects by the **module import graph**. A
test that inspects source with `readFileSync` and imports nothing from `src/` **can never be
selected by a focused run, whatever you change.** Two of these were red on the integration line for
days for exactly this reason.

    ward-chrome-owner · ward-clinical-rail-token-bridge · ward-community-viewer-assumption
    ward-design-language-contract · ward-flow-chat-control · ward-flow-seam
    ward-handover-print · ward-instant-display · ward-management-role
    ward-override-surfaces · ward-primitives-shared · ward-referrals-print
    ward-sidebar-phone-contract · ward-token-layer · ward-transport-page-name
    ward-traps-numbering

⚠️ **Three of those are the print guards**, which is the sharpest case: an adopter editing
`handover.module.css` gets a green focused run that omits the only guard on the rule they just
touched.

**The fix is usually an import, not a better habit** — derive from a runtime `as const` array rather
than a TypeScript type, and the test lands in the graph automatically.

## 2. Print guards cover half the screens that need them

Nine of 42 ward stylesheets have an `@media print` block; **six** put `background: none;
color-scheme: light` on their root. Three tests assert both halves with the harm named in the
failure message — `ward-handover-print`, `ward-morning-print`, `ward-referrals-print`. They are
good tests.

🔴 **`board`, `coordinator` and `ward-management-network` carry the same pattern with no print
test.** And the shell's own block, added tonight, is `@media print { .shell { background:
transparent; } }` — **no `color-scheme: light`**. So the shell does not replace what a screen would
delete, and tonight's near-miss is reachable on six screens.

## 3. Tokens used but never declared

Verified use-count and declaration-count for each, on the live page where it mattered.

| Token                  | Where                                                    | State                                                                                                                                                                                                                                                    |
| ---------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--ward-surface-hover` | `ward-management-modes.module.css:524`                   | 1 use, 0 declarations; falls back to `--surface-subtle`, so the hover tint renders generic rather than intentional                                                                                                                                       |
| `--wd-tap-target`      | `ward/ward.module.css:124`                               | 1 use, 0 declarations; falls back to a literal `3rem`. That file declares `--wd-space-48: var(--spacing-tap)`, almost certainly what was meant                                                                                                           |
| five `--wd-*` tokens   | `board.module.css` lines 1335, 1346 ×2, 1385, 1402, 1413 | declared only by `ward.module.css`. ⚠️ **Checked on the live board page: they do NOT resolve.** The padding comes entirely from literal fallbacks. A copy-paste where the prefix was never renamed; it goes stale silently the moment ward's scale moves |

⚠️ **`ward-sidebar.module.css` declares 19 `--ward-*` tokens of its own**, against the layer's 48. A
partial hand copy of the token layer, in the one file every screen renders — nineteen values that
will not follow a re-point. Biggest of the four and the least urgent.

✅ **No `--ward-*` use anywhere falls back to `currentColor`.** `--ward-border-subtle` was the only
one — it made every person row in the search results draw its border in the body text colour — and
it is fixed.

## 4. The chip guard covers one of two components and one shape of child

`WardChip` throws on an empty chip, which is right: a build-time failure beats a silent exclusion.
But the throw is inside `if (typeof children === "string")`. A `null`, `undefined`, `false`, a
number, or a JSX element child **skips the check entirely and renders a wordless coloured
rectangle**. `WardKindChip` has no check at all — and its `border-left` is the one carrying meaning.

Being fixed as part of the forced-colours work, because under forced colours a wordless chip is not
merely weak, it is invisible.

Separately: `enroute` has a CSS rule and a place in the union with **no call site anywhere**. Left
alone — "nothing uses it" is never sufficient grounds in this repository.

## 5. Open questions from the twelve-screen adoption briefs

Measured: **600 mechanical edits** across `board` (285), `coordinator` (237), `discharges` (46) and
`escalation` (32), of which the overwhelming majority are exact-value substitutions that cannot move
a pixel. **14 DO-NOT-DELETE blocks** across the four. Handed back rather than guessed:

- **Three values have no ward equivalent:** `--wb-leading-figure: 1`, `--co-leading-tight: 1.2`,
  `--co-leading-prose: 1.5`. The last is the known trap, present verbatim.
- ⚠️ **`board`'s six panels deliberately have no `<header>` element, to survive the print reset.**
  `WardPanel` always renders one. So adopting the primitive there would reintroduce the print defect
  unless an explicit restore ships with it. **This is a real conflict between the primitive and a
  working accessibility/print decision, and it is the strongest argument yet that `WardPanel` needs
  a headerless variant.**
- `coordinator`'s `.queueRegion` and `.diagramRegion` have headers carrying an action button;
  `WardPanel` has no slot for one.
- Several `board`/`discharges`/`coordinator` badges do not map onto `WARD_CHIP_LEVELS`.

## 6. Housekeeping

- A stray untracked file `wardfiles_tmp.txt` sits at the worktree root. An agent created it and the
  `protect-ward-flow.sh` hook refuses to delete it, because the worktree's own path
  (`D:/Worktrees/Database/ward-lead`) matches the hook's broad `ward-` pattern. ⚠️ **The hook is
  working correctly and must not be edited.** It is harmless where it is — the root is not a
  pre-commit watched path — and needs one word from the owner before removal.
- `.two_vs_pairbase.txt`, also untracked at the root, is not mine and has not been touched.
- ⚠️ **A shared `/tmp/wardfiles.txt` was silently overwritten mid-task by another concurrent
  agent.** Nothing was lost — the work was regenerated into a session-scoped scratchpad — but it is
  a reminder that `/tmp` is shared across every agent on this machine and the session scratchpad is
  not. Agents should be told to use the scratchpad, not `/tmp`.

---

# Corrections and additions, later the same night

Everything below was measured after the sections above were written. Where it contradicts them, this
part wins. **Every figure names the tree it was measured on**, because two accurate counts disagreed
tonight purely because one was taken on a branch and one on the integration line.

## The synonym pairs: TWO of three diverge, not three

Measured on `bc5e13c78`, every declaration in `src/components/ward-management/`:

| Pair                                     | Verdict                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--ward-border` / `--ward-divider`       | ⚠️ **DIVERGES.** `--ward-divider` is declared exactly once (`ward-tokens.module.css:53`) and re-aliased nowhere; `--ward-border` is re-aliased inside `@media (forced-colors: active)` in three files on this line (`ward-management-modes`, `ward-management`, `ward-sidebar`), and five once the two adopted screens fold in. |
| `--ward-border-strong` / `--ward-muted`  | ⚠️ **DIVERGES**, same mechanism. `--ward-muted` has two base declarations and zero re-aliases.                                                                                                                                                                                                                                  |
| `--ward-space-1` / `--ward-radius-pixel` | ✅ **A TRUE SYNONYM.** Each declared once in `ward-tokens`, re-pointed nowhere.                                                                                                                                                                                                                                                 |

⚠️ **"All three are traps" and "two of three are traps, and here is which" are different
instructions**, and the first gets discounted the moment somebody checks the third and finds it
harmless.

🔴 **And the divergence is the worst possible arrangement:** the pair is interchangeable in the
cascade you can see and different in the one you cannot. You choose in normal colours, where nothing
distinguishes them, and the consequence lands on the reader least able to absorb it and least likely
to report it as a styling bug.

**Two adopted screens already carry the defect on four rules between them, and they are deliberately
NOT being repaired.** They are the only instance we have, in the two places about to be observed
under `forcedColors: "active"`. Fixing them now would destroy the evidence to satisfy a deduction.

## Every row of `KNOWN_HEX_BACKLOG` is stale — all five

Reproducing the test's own scan, comment-stripping included, over all 42 ward stylesheets: **zero
offenders.** Every pinned hex lives in prose — `#ff9ca4` is mid-sentence in a comment; `#2384` is a
PR number. They went stale at one instant, when comment-stripping was added on 2026-09-04, and
nothing said so **because that pin is one-sided.**

⚠️ **Third one-sided pin to hide something in a single night.** `COVERING_THE_GROUND` had four stale
rows and was red for days; `KNOWN_BREAKPOINTS` and `KNOWN_BACKLOG` have no `freed` half at all, so
freeing a file from either leaves a row nothing will ever catch. **The `freed` half is not a
refinement — it is the only thing that makes a shrinking backlog honest.**

## The zero rule, sharpened — and this version replaces the earlier one

⚠️ **The control has to reproduce a count SOMEBODY ELSE MEASURED, not merely any non-zero count.**

"Does this matcher find anything at all" is passed by a subtly narrowed scan — which is exactly how
five stale hex rows survived a careful operator. Reproducing the pin's own five rows could not have.

The underlying defect appeared **four times tonight, in four different agents**: a regex built from a
template literal or `new RegExp("…\s…")` loses its escapes before Node sees it and matches nothing.
Every count comes back `0`, **which is indistinguishable from "this file needs no work"** — and a
zero is what an adopter is hoping for, which is why that shape gets believed. Use `String.raw`.

## Focus-blind tests are a repository pattern, not a Ward Flow habit

Counted over 1,156 test/spec files: **~108 (9%)** name a `src/` path as a string and have no static
import from `src/`, so `vitest related` can never select them when that source changes. **18 inside
`tests/ward-*`, 90 outside** — five times as many elsewhere.

So fixing it in Ward Flow buys Ward Flow. Fixing the class is repository-scale and belongs here, not
in front of the page.

⚠️ **The first pass of that count returned 166 outside, by counting any `readFileSync`** — which
sweeps in tests reading `.github/workflows`, `docs/` and `package.json`, none of which depend on
source at all. Narrowed before reporting. The same unit error, caught this time.

## The 193-file ward suite glob does not include the end-to-end tests

`tests/ward-*.test.ts` + `tests/ward-*.dom.test.tsx` finds 193 files and **excludes the six
`ui-ward-*.spec.ts` Playwright specs — the only tests that render a ward screen end to end.**

⚠️ Every "full ward suite" figure quoted tonight, including mine, was of the 193. An accurate number
reads as a complete one.

## The two red gates, diagnosed

- `ward-override-surfaces` — a pinned line number my own commit `bc5e13c78` moved from 482 to 571.
  ⚠️ Deliberately **not** fixed yet: the page is being rewritten and will move it again. One fix,
  after.
- `ward-flow-chat-control` — `docs/ward-flow/live-state.json` records a checkout that no longer
  exists on disk. 🔴 **That is the worktree-deletion problem surfacing as a red test**, and it is
  worth more than the test. Two worktrees have been destroyed mid-session on this machine. Keep it
  strict rather than loosening it.

## `WardPanel` versus a working print decision

⚠️ **`board`'s six panels deliberately have no `<header>` element, so they survive the print reset.**
`WardPanel` always renders one. Adopting the primitive there reintroduces a defect somebody
specifically prevented — which is the strongest argument yet that the primitive needs a headerless
variant, and the clearest case of a shared component being unable to express a decision a screen had
already got right.

---

# 🔴 A source-text search cannot find a build-time declaration

**This invalidates part of section 3 above and every token sweep run tonight, including mine.**

Tailwind 4's `@theme` declares `--text-2xl`, `--text-3xl`, `--text-4xl`, `--text-base` and their
family **at build time**. No source file contains the declaration, so **no grep over `src/` can ever
find one**, and every such token reads as "declared nowhere".

Four of nine hits in a careful undeclared-token sweep were exactly that — including the
worst-looking one, a `var(--text-2xl)` with **no fallback at all** at `ward-management.module.css`
lines 514 and 542. A `var()` with no fallback is a dropped property rather than a substituted one, so
it would have been the most serious finding of the sweep. It is not a finding. Resolved on a running
page: `--text-2xl` = 1.5rem, `--text-3xl` = 1.875rem, `--text-4xl` = 2.25rem, `--text-base` = 1rem.

⚠️ **The sweep's CAUTION is what saved it** — it flagged that the family might be Tailwind-generated
and outside a source search, rather than asserting nine defects. Had it been confident, four
non-existent defects would have travelled onward with line numbers attached. **A tool that says "I
may not be able to see this" is worth more than one that is right more often.**

⚠️ **And reading tokens at `:root` is the wrong scope for anything the ward layer declares.**
`composes: wardTokens` puts all 48 declarations on every element carrying the class, never on the
root — so a `:root` probe reports `--ward-border` unresolved, which is believable and wrong. Paired
controls settled it: `--ward-border` at a panel resolves to `#667085`; `--ward-tap` at the same panel
does not.

## The real undeclared-token list, after the false positives

Five, **all outside the migrated files, all with a working fallback, none urgent.** Zero
`currentColor` fallbacks anywhere in the tree.

| Token                  | Where                                    | Falls back to           |
| ---------------------- | ---------------------------------------- | ----------------------- |
| `--text-link`          | `ward/ward.module.css:126`               | `var(--text-heading)`   |
| `--focus-ring`         | `board/board.module.css:587, 1048, 1307` | `var(--primary)`        |
| `--success-bg-hover`   | `ward/ward.module.css:646`               | `var(--success-bg)`     |
| `--ward-surface-hover` | `ward-management-modes.module.css:524`   | `var(--surface-subtle)` |
| `--wd-tap-target`      | `ward/ward.module.css:124`               | literal `3rem`          |

🔴 **`--wd-tap-target`: the literal `3rem` beside the `var()` is load-bearing and nobody knows it.**
Measured on the page: the token is unresolved, `min-height` computes to 48px, and the element renders
at 48px. The 48px tap target is held up entirely by a fallback that reads as defensive boilerplate —
and anyone tidying the `var()` to "use the real token" removes the only thing making it work.

## Two more local-but-prefixed tokens, same shape as `--ward-tap` in reverse

`ward-management-modes.module.css:13–14` declares `--ward-stroke-thin` and `--ward-stroke-accent`,
used 4 times in that same file, **absent from `ward-tokens.module.css`** (control: `--ward-canvas`
IS declared there). They carry the `--ward-` prefix, so they look like shared tokens an adopter
should stop declaring locally — **and deleting them orphans four usages**, where an unresolvable
`var()` inside a `border` shorthand renders no border at all, silently.

⚠️ **The `--ward-tap` near-miss was a reference without a declaration; this is a declaration whose
deletion orphans references. Same silent failure, opposite direction, and the prefix is what makes
both plausible to a careful person.**

## A screen's protections are not all blocks

`officer.module.css` and `tracker/live-tracker.module.css` carry their ONLY reduced-motion protection
as `composes: descendantKill from "../ward-reduced-motion.module.css"` in the root rule — not as an
`@media (prefers-reduced-motion)` block. **A block-list diff finds nothing to lose and passes while
it is deleted.** 2 of the 11 adopted files. The check is now "every block AND every `composes:` line
in the root, diffed by name".
