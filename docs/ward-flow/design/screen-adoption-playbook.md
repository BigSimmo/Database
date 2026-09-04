# Adopting the Board design language on a screen

What it actually costs to move one React screen off its own private styling and onto the shared
Ward Board vocabulary, written from doing it to `search` on 2026-09-04 (commit `0a30d5508`).

Read this before you start the second one. Most of it is traps, and every trap below is one that
**passes every gate in the repository** — which is why they are written down rather than left to
be caught.

---

## Before you touch anything: run both contract tests

```bash
npx vitest run tests/ward-design-language-contract.test.ts tests/ward-primitives-shared.test.ts
```

⚠️ **Do this FIRST, not after.** Once you have edited a file, a red you inherited and a red you
caused are indistinguishable, and you will spend the evening proving which is which.

🔴 **AND RUN THEM BY NAME, BECAUSE NO FOCUSED RUN WILL EVER RUN THEM FOR YOU.**
`npm run test:focused` is `vitest related --run`, which selects by the IMPORT GRAPH. **16 of the
ward test files import nothing from `src/` at all** — they read stylesheets off disk with
`readFileSync` — so no change to any source file can ever select them. Counted 2026-09-04, and the
16 include both contract tests and all three print guards:

```
ward-design-language-contract   ward-primitives-shared   ward-token-layer
ward-handover-print             ward-referrals-print     ward-chrome-owner
ward-sidebar-phone-contract     ward-clinical-rail-token-bridge   (+8 more)
```

So an adopter who edits `handover.module.css` and runs a focused suite gets a green that
**structurally omits the only guard on the rule they just touched.** The green is not weak
evidence; it is no evidence.

This is not hypothetical. When `search` was adopted, the design-language contract was **already
red on the tip**, with four stale rows, and had been since the day it was written. The pin was
correct, the pin was well built, and nobody had run it, because nothing anybody was changing was
near that file. A guard that works perfectly still buys nothing if it only ever runs after the
damage.

Write down what you saw. When you finish, the only new reds should be ones you can name.

---

## The order that worked

1. **Read the whole stylesheet first**, including the comments. They carry decisions that no test
   encodes, and at least one of them will stop you deleting something load-bearing.
2. **Adopt the token layer on the root class** — `composes: wardTokens from "../ward-tokens.module.css";`
   — then remap every local token use. Do this before touching components: it is mechanical, it is
   large, and it is much easier to review on its own.
3. **Convert the components** to the shared primitives (`WardPanel` and friends).
4. **Re-point what is left**, including the forced-colors block.
5. **Run the screen's own tests**, then both contract tests, then typecheck.
6. **Remove only your own rows** from the pinned lists, and only the ones your change actually
   freed.

---

## The traps

### Tokens

**`--ward-space-N` is N PIXELS, not N of anything else.** `--ward-space-16` is `1rem`. A screen
with its own `--xx-space-16: 1rem` maps straight across; a screen whose scale counts steps instead
of pixels does not, and you must map by value.

⚠️ **Match by VALUE, never by NAME.** The sharpest instance: statistics declares
`--st-leading-body: 1.45`. The shared layer has `--ward-leading-body`, and it is **1.4**. The
correct target is `--ward-leading-relaxed`, which is 1.45. Fourteen rules use that token. Matching
the two "body" names would have changed the line height of every one of them, and no test in this
repository renders a line box.

⚠️ **Not every `--xx-space-NN` is a spacing step.** `search` had `--ps-space-48`, which looked like
the top of its scale and was in fact `var(--spacing-tap)` — the global tap-target size wearing a
spacing name. Statistics has the same shape as `--st-tap`. Read the declaration; do not infer it
from the name.

⚠️ **THREE PAIRS OF WARD TOKENS LOOK LIKE EXACT SYNONYMS. TWO OF THEM ARE NOT — AND THEY DIVERGE
EXACTLY WHERE A HIGH-CONTRAST USER IS LOOKING.** Counted across `src/components/ward-management/`
on 2026-09-04:

| one                    | the other             | same in normal cascade    | re-aliased inside `forced-colors: active`               |
| ---------------------- | --------------------- | ------------------------- | ------------------------------------------------------- |
| `--ward-border`        | `--ward-divider`      | both `var(--neutral-500)` | **border in 5 files (6 declarations); divider in NONE** |
| `--ward-border-strong` | `--ward-muted`        | both `var(--text-muted)`  | **strong in 3 files; muted in NONE**                    |
| `--ward-space-1`       | `--ward-radius-pixel` | both `0.0625rem`          | neither — this pair is a true synonym                   |

`--ward-divider` is declared **exactly once in all of `src/`** and re-pointed nowhere. So the moment
a user turns on high contrast, the two halves of the first pair stop agreeing — one follows the
screen's override, the other does not.

✅ **AND THE DIVERGENCE COSTS NOTHING ON SCREEN — MEASURED, NOT ARGUED.** This document twice said
the pair diverges "exactly where a high-contrast user is looking". That was a deduction and it was
wrong. `tests/ui-ward-forced-colors.spec.ts` compares a panel's outline (`--ward-border`) against
its header rule (`--ward-divider`) — one element apart, the only place the pair can differ — under
`forced-colors: active`. **They come out the same colour**, because the user agent overrides both
before the token divergence can reach the screen.

**So pick by ROLE, and know exactly what that rule is for: a FUTURE re-point.** A box outline is
`--ward-border`; a line _between rows inside_ a panel is `--ward-divider`. The day somebody changes
one of the pair, the choice you made decides which rules follow. It has no accessibility claim
attached and this document should not have made one.

🔴 **The reference screens were deliberately left carrying the supposed defect, and that is the only
reason we know it is not one.** `search` uses `--ward-divider` on three rules while re-pointing only
`--ward-border`; `statistics` does the same on one. Repairing them on the strength of the deduction
would have destroyed the single instance available to measure, and left everyone believing a defect
had been fixed with nothing left to check it against. **When you are about to repair the only
example of a problem you have inferred but not seen, measure it first.**

⚠️ **A token that is declared nowhere is the only defect here that fails completely silently.**
`search` used `var(--ward-border-subtle, currentColor)`. `--ward-border-subtle` is declared nowhere
in `src/` at all, so every person row in the search results drew its border in the **body text
colour**. An undefined custom property is not a CSS error, not a warning and not a test failure.

And the second failure mode is the dangerous one: with no fallback the element renders
**invisible**; with a `currentColor` fallback it renders at **full text contrast**, which reads as a
design decision rather than a bug. A contrast audit scores it as exemplary.

⚠️ **The gate for that exists and could not reach it.** `ward-design-language-contract.test.ts`
asserts that every `--ward-*` token a module uses is declared — scoped to four modules
(`ward-panel`, `ward-chip`, `ward-figure`, `ward-shared`). The comment above that assertion **named
`--ward-border-subtle` and named `search/search.module.css` as where it was used**. The comment knew
and the assertion could not act, because the one instance anybody had ever found sat outside its
scope. Until that scope is widened, **a green there is not evidence that no undeclared `--ward-*`
token is in use.**

⚠️ **Never write a colour the language does not have.**
`color-mix(in srgb, var(--ward-blue) 50%, transparent)` is a raw colour computation that the
hex sweep cannot see, and it reads as _more_ careful adoption than a hardcoded value, not less.
If you need a tint, ask the design owner for a token. Do not blend one.

⚠️ **And know that this rule forbids something the codebase already does**, so you will meet it as
precedent rather than as a violation: `board.module.css` has 4 `color-mix` calls and
`ward-management-modes.module.css` has 3 (counted 2026-09-04). They are known and parked. Do not
copy them, and do not read them as permission.

### The root background, and the pin that cannot see through a rename

`coveringScreens()` in the contract test matched the token **name** `var(--surface)`. Because
`--ward-canvas` is an alias for `--surface`, renaming the root background to `var(--ward-canvas)`
**freed the pin while the screen went on covering the ground in exactly the same paint.** The
builder then dutifully deletes the now-"stale" row, and the pin is gone for good.

Ward Lead has since rewritten the matcher to catch all seven opaque surface spellings including the
three ward aliases, and that rewrite found two more screens nobody had — their roots are not called
`.screen` **and** they paint `var(--ward-canvas)`, so they were invisible for both reasons at once.

⚠️ **THE ANSWER IS THAT YOUR SCREEN ROOT PAINTS NOTHING. DELETE THE DECLARATION.** The shell owns
the ground. Do not repoint it to `--ward-ground` either — that was tried during the `search`
adoption, it looks exactly like the adoption, and it is the same mistake said in the Board's own
vocabulary: a screen painting the ground at all is a screen covering the shell's.

`tests/ward-shell.dom.test.tsx` settles this outright, and it is worth reading for its shape as
much as its verdict:

```
has exactly one stylesheet painting --ward-ground, and it is the shell's
```

It pins the painters as a **sorted list, not a count** — with a comment saying why: a count
survives the declaration merely MOVING to another file, which is the exact failure it exists to
catch. It caught `search` immediately.

Leave a comment where the declaration was, saying not to reintroduce one **in any spelling**. Five
screens now carry that warning.

### Forced colours

⚠️ **Repoint the `@media (forced-colors: active)` block. Do not delete it.** A screen's block
typically re-points its own local border token to the system `--border`; after adoption it must
re-point `--ward-border` instead. Delete it and the screen silently loses its high-contrast border
colour.

⚠️ **And if the file's border token got SPLIT, the block has to split with it.** A file that used
one `--wf-border` for both outlines and dividers now uses two tokens, so a block re-aliasing one of
them leaves half the borders behind. All four Group B files needed both `--ward-border` and
`--ward-divider` set inside the block.

🔴 **A SCREEN'S PROTECTIONS ARE NOT ALL BLOCKS, AND A "KEEP EVERY BLOCK" RULE LOSES THE REST
SILENTLY.** `officer.module.css`'s only reduced-motion protection is a `composes: descendantKill
from "../ward-reduced-motion.module.css"` line on its root rule — no `@media` anywhere. Adding
`composes: wardTokens` to that rule is exactly the edit that could drop it, and a diff of `@media`
blocks would not notice. 2 of the 11 ward files being adopted carry their reduced-motion protection
this way.

**So the check is: every `forced-colors`, `print`, `prefers-reduced-motion` and `:focus-visible`
block, AND every `composes:` line in the root rule, diffed by name before and after.**

⚠️ **And know what you are adopting into.** Counted 2026-09-04: **28** stylesheets under
`src/components/ward-management/` carry a `forced-colors: active` block. The number carrying one
across the whole new Board layer — `ward-tokens`, `ward-panel`, `ward-chip`, `ward-figure`,
`ward-shared` — is **zero**.

So a screen that adopts the layer and deletes its own override is not inheriting a replacement, it
is losing the behaviour outright. **And no test in this repository renders under forced colours**,
so nothing will say so. (Reported to Ward Lead 2026-09-04; unresolved.)

### Components

**A card inside a panel is a border inside a border.** `search`'s result lists were stacked cards,
each with its own border, radius and background, inside what became a `WardPanel`. That reads as a
level of nesting that is not there. The Board's body pattern is **divided rows**: the list is
`list-style:none; margin:0; padding:0`, each row carries `border-top: 1px solid var(--ward-divider)`
and `padding: var(--ward-space-12) var(--ward-space-16)`, and the first row zeroes its top border
because the panel header already draws that line.

**`WardPanel` has an optional `testId`, and it is not how you find a panel.** `title` is already the
section's accessible name, so `getByRole("region", { name })` reaches every panel without one. The
prop exists **only to preserve a testid contract a screen already had** before it adopted the panel.
A new panel should not grow one; prefer the accessible query, which is the truer assertion.

⚠️ **Visible heading text is a contract before it is a style.** Five tests pin `search`'s headings by
name (`getByRole("heading", { name: "7 matches" })`). `WardPanel` offers `title` and `count` as
separate slots, and splitting `"7 matches"` into `title="Matches"` + `count="7"` is the natural
adoption — **and it is a copy change**. It was passed through as `title` verbatim instead, and the
split handed to the owner as a question. Adoption is not licence to reword the screen.

⚠️ **There is no primitive for an untitled control strip.** `search`'s filter bar is the same card
shape as a panel with no heading, and `WardPanel` always renders a header. Its four values —
border, radius, surface, inset — are now **hand-matched** to `.panel`'s. That is a duplication the
layer does not name: re-point the panel and this rule will not follow, and nothing will report the
divergence. Expect to hit this on any screen with a toolbar.

### Pins that do not mean what their message says

⚠️ **Composing a shared class does NOT clear a duplication pin, and the pin is right.** `search`'s
`.field` now `composes:` the shared one and keeps only the colour and type the shared class does not
carry. The local rule still exists, so the name is still declared in two places. The row was removed,
the pin went red immediately, and the row went back.

That said, note what the word is doing: **"duplicate" is covering two states that differ in what
somebody must DO** — a second independent copy, which wants a merge, and an extension by composition,
which wants nothing at all. Flagged to Ward Lead; unresolved.

⚠️ **A pin telling you two files share a class name is not telling you they share a component.**
Three files declared `.field`. `search`'s is a form-field wrapper (`display:grid; min-width:0;
gap:4px`). Both statistics files' is an **inline monospace badge** (`border-radius; background;
padding; font-family:mono; font-size:3xs`) used only inside `<code>`. The backlog recorded a name
collision **as a duplication**, and adopting the shared class on the strength of that row would have
silently restyled a badge into a flex column — and the pin would have rewarded you by letting the row
go.

**The test that separates a real rename from gaming a pin: WOULD YOU RENAME IT IF THE PIN DID NOT
EXIST?** For the statistics badge the answer is yes — two unrelated components sharing a class name
across files is a genuine hazard that had already cost a wrong row. The pin is not the reason to
rename; it is the thing that found the reason. It was renamed to `.fieldName`, which keeps what it
actually means: the name of a model field.

⚠️ `statistics-sections.module.css` has **the same collision awaiting the same fix**. Its row stays
pinned. Do not rediscover it from scratch.

---

## What the contract tests caught, and what they did not

**Caught, and worth the runtime:**

- The root background pin fired the moment `search`'s root stopped covering the ground, and named
  the exact row to remove.
- The duplication pin caught a row being removed that should not have been — within seconds, with
  the file named.
- `ward-shell.dom.test.tsx` caught the root background being repointed rather than deleted, and
  named both the offending file and the one file allowed to paint the ground.
- Both messages name the file and the offending value, so neither needed investigating.

⚠️ **But that last one was only reached by running the ward suite DISCOVERED FROM DISK** — `ls
tests/ward-*.test.ts tests/ward-*.test.tsx`, 193 files, 2604 tests — rather than a set chosen by
hand. A hand-picked set would have contained the two contract tests and the screen's own tests,
which were all green, and the wrong background would have shipped. **Discover the set; do not name
it.** And refuse a discovery that returns implausibly few files, which is how a silent zero gets
reported as a pass.

**Did not catch, and cannot:**

- The undeclared `--ward-border-subtle`, because it is out of that assertion's scope.
- Any wrong choice between the three synonym token pairs.
- Any wrong line height from a name-matched leading token.
- Anything at all about forced colours.
- Anything about what the screen looks like. Every red in this whole adoption was structural.

⚠️ **The general shape, and it recurred through the whole session: a check's SCOPE does not match
the CLAIM people take it to support.** A pin over four modules does not license a statement about
the repository. Report what you measured and where you looked, never the conclusion it flatters.

---

## The artefact you can search is not the artefact that runs

⚠️ **Three separate times in one evening, a search over `src/` returned a clean, believable and
wrong answer — by three different mechanisms and always the same shape.**

| What was searched                                 | Why the search could not see it                                                              | What it cost                                                          |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `--text-2xl` and its family, "declared nowhere"   | Tailwind 4's `@theme` declares them at BUILD; no source file contains the declaration        | four non-existent defects, nearly relayed with line numbers           |
| `[class*="ward-panel-module"]` as a test selector | CSS-module class names keep the source filename in dev and DROP it in a production build     | a spec that found zero elements on a page that had rendered perfectly |
| a token's declaration reached through `composes:` | `composes` is resolved by the CSS-module compiler, not present as text in the importing file | a token that reads as undeclared and is not                           |

**The rule: before calling something absent, resolve it where it runs.** For a CSS custom property
that means `getComputedStyle` on a live page, not `grep`.

⚠️ **And read it at the right scope.** Checking these tokens at `:root` reported `--ward-border`
unresolved — it is declared on every element carrying `wardTokens`, never on the root. Wrong scope,
believable answer. **Run a positive control (a token you know exists) and a negative control (one
you know does not) through the same probe before trusting either direction.**

**When you ask someone else to search, ask them to name what their method cannot see.** Both
read-only sweeps in this work did that unprompted, and both times the flagged uncertainty — not the
finding — is what mattered.

---

## Then open the screen and MEASURE something

⚠️ **The largest defect in the whole adoption was found this way and by nothing else.** After every
test was green — 15 for the screen, 2604 across the ward suite, both contract tests, typecheck —
the search result rows were **72px tall around a 48px tap target**. The row carried
`padding: 12px 16px` and the link inside it carried `min-height: 48px`, so 24px of every row looked
clickable and was not.

Nothing could have caught it. The row rendered. The text was right. The tap target still met its
own minimum. Every assertion about that list is about its contents.

**So finish an adoption like this:**

1. `npm run ensure`, and use the URL it prints. Never assume a port.
2. Open the screen and get it into its populated state, not just its empty one. The empty state is
   what a DOM test usually renders and it exercises none of the row work.
3. **Measure, do not squint.** `getBoundingClientRect().height` on a row and on the thing inside it.
   If the row is taller than its target, you have dead space. Compute contrast ratios rather than
   judging them by eye.
4. Look in **light and dark**. Dark is a `.dark` class on `<html>`, applied by the theme provider
   from the system preference at load — so set the colour scheme and RELOAD; toggling it after load
   does nothing.
5. Say plainly if it looks right. A verified clean result is worth as much as a defect.

⚠️ **Identifying a primitive's instances on screen is harder than it looks, and the obvious way is
wrong.** `[data-level]` and `[data-kind]` are NOT unique to `WardChip` — nine components across
coordinator, ward and flow-diagram emit `data-level`, and `ed-screen.tsx` puts `data-kind` on its
own paragraphs. Selecting by those attributes produced eight "chips" on a screen that renders none,
and a plausible finding about them that was entirely an artefact of the query. **Select by the
generated CSS-module class** — `[class*="ward-chip-module"]` — which only the primitive can carry.

**What could NOT be observed:** forced colours. The available browser tooling emulates viewport and
colour scheme, not `forced-colors: active`. Nothing in this document is based on seeing a ward
screen in high contrast.

---

## Decisions that were handed back, not made

Adoption produces design questions. Hand them over rather than settling them in a stylesheet:

- Whether `"7 matches"` becomes `title="Matches"` + `count="7"`. **A copy change.**
- Whether `ward-tokens.module.css` should carry a forced-colors block so adopters can delete theirs.
- Whether the untitled control strip should become a primitive.
- Whether `KNOWN_BACKLOG` should distinguish a copy from a composition.

---

## Known debt in the files you are about to adopt

These four are recorded as debt, not as a work list — found while adopting two other screens on
2026-09-04 and deliberately **not** fixed there. The owner's priority is the movement workspace
page, not widening the design infrastructure. Whoever adopts the screen that owns each file below
takes that file's item with it.

### 1. `board.module.css` borrows another screen's spacing scale — the one that will bite

`src/components/ward-management/board/board.module.css` uses **five** `--wd-*` tokens, at lines
1335, 1346 (twice on that line), 1385, 1402 and 1413. `--wd-` is `ward/ward.module.css`'s local
scale, declared on ITS `.screen` class. Board's own scale is `--wb-`. `board.module.css` declares
**zero** `--wd-*` tokens of its own.

Measured on the live page at `/mockups/ward-flow/board/rph-adult-secure`, on the element carrying
`board-module__fePlTG__destinations`:

```
--wd-space-14   (unresolved)
--wd-space-2    (unresolved)
--wb-space-8    .5rem          <- board's own token, two lines away in the same file, resolves
```

⚠️ **The rendered padding of 14px comes entirely from the literal fallback** written beside each
`var()`, not from the token. Nothing renders wrong today. It reads as a copy-paste from
`ward.module.css` where the prefix was never renamed, and it goes stale silently the moment ward's
spacing scale moves — at which point board keeps the old numbers with nothing to report it.

### 2. `ward-sidebar.module.css` carries a partial hand copy of the token layer

It declares **19** `--ward-*` tokens of its own. `ward-tokens.module.css` declares **48**. So
nineteen values will not follow a re-point of the layer, in the one file every screen renders.
Largest of the four, least urgent, no current symptom.

### 3 and 4. Two tokens used exactly once and declared nowhere

- `--ward-surface-hover` — `src/components/ward-management/ward-management-modes.module.css:524`,
  `background: var(--ward-surface-hover, var(--surface-subtle));` in `.summaryLinkCard:hover`.
  Falls back to a real declared token, so the hover state renders the generic subtle tint instead
  of an intentional one.
- `--wd-tap-target` — `src/components/ward-management/ward/ward.module.css:124`,
  `min-height: var(--wd-tap-target, 3rem);` in `.boardLink`. Falls back to a literal `3rem`. That
  same file declares `--wd-space-48: var(--spacing-tap)`, which is almost certainly what was meant.

⚠️ Neither is the dangerous flavour above: a repo-wide sweep found **no** `--ward-*` use anywhere
falling back to `currentColor`. `--ward-border-subtle` was the only one and it was removed on
2026-09-04. Both of these degrade to something reasonable, which is precisely why they have
survived — the screen looks fine and the wiring is dead.

### The line that ties them together

All four are the same shape as the defects the rest of this document is about: **present in the
code, passing every check, and doing nothing.** Two of them are only harmless because somebody
wrote a literal fallback beside the token — the fallback is load-bearing and nobody knows it.

---

## What it actually cost

The whole of `search`, in one commit (`0a30d5508`): **five files, +131 / −85 lines.** Three source
files and two test files; the stylesheet was two-thirds of it.

Roughly five test runs, and **two of them were self-corrections rather than progress**:

1. A pinned row was removed that should not have been. The pin caught it immediately.
2. A comment was written claiming the rule "keeps exactly one declaration" when it keeps three. No
   gate can catch a false comment; it was found by re-reading the rule after writing about it.

Budget for both. The mechanical remapping is fast and safe. **The time goes on the three or four
places where the obvious move is subtly wrong**, and none of those are visible in a diff.

---

## What `search` did NOT exercise

Do not read this playbook as complete. `search` never touched:

- **A table.** Its movements table was left alone entirely, so nothing here says how a table adopts,
  and there is a known unresolved misalignment: table cells inset by `--ward-space-8` sit inside a
  panel whose header insets by `--ward-space-16`.
- **Charts, figures, or `WardFigureStrip`.** Statistics will be the first.
- **`WardChip`,** or any of the semantic colour tokens. Ward Lead's audit found `--ward-divider`
  misused for a chip's outer edge and for a meaning-carrying kind accent, so expect that surface to
  move.
- **Any phone breakpoint beyond the one `@media (max-width: 40rem)` rule it already had.**
- **Dark mode, forced colours, or reduced motion,** in any observed form. Nothing was rendered.
- **A screen with more than one root.** `search` has exactly one root and it is called `.screen`.
  Two of the screens still outstanding do not, which is half the reason they were invisible to the
  pin.

**Nobody has looked at an adopted screen.** Every claim in this document is structural: tests,
tokens and diffs. The visual result of the first adoption is unverified.
