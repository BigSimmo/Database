# Six reds in a builder worktree where the handover documents one

**Measured 2026-09-05 by Ward Builder One, in `D:/Worktrees/Database/ward-builder-community-route`.**

    my branch    claude/ward-builder-community-route   f8347a23f182ec8f2abe050804430eedbad09013
    master line  codex/task-ward-flow-live-state-20260831  2fa5f0b69f68f4c2431a20073e00e2259a4734a2

## What a full ward run reports here

    Test Files  6 failed | 258 passed (264)
    Tests       6 failed | 3288 passed | 2 expected fail (3296)

**The population was discovered from disk**, by the union command the handover specifies (the
`tests/ward-*` glob plus files IMPORTING ward code, minus `tests/ui-*`) — 264 files here, against
the 265 the handover records at the master tip. The two `expected fail` tripwires are the two the
handover names, reported separately as it says they are.

## 🔴 THE HANDOVER'S "ONE DELIBERATE RED" IS TRUE OF THE MASTER LINE AND OF NOTHING ELSE

`WARD-LEAD-HANDOVER-2026-09-05.md` §2 says _"it is the only expected red in the suite. **Any other
red is a real failure**"_, and a builder reading that in a builder worktree meets five more.

**All five are this branch being behind master. None is a defect introduced here, and none needs
fixing here — every one is already fixed on the master line.** Verified by comparing blobs, not by
running master's suite, which lives in another chat's worktree:

| red                                                                               | what differs                                                                                                | evidence                                                                                 |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `ward-shell.dom.test.tsx` — a second stylesheet paints `--ward-ground`            | the GUARD moved: master's copy carries a sticky-occluder exemption written 2026-09-05                       | test blob differs; `community/community-index.module.css` differs too                    |
| `ward-management.test.ts` — `/mockups/ward-flow/transport` missing from the nav   | the GUARD moved: master's copy records MERGE 03 folding transport out of the nav                            | test blob differs; master's copy names MERGE 03 in a comment, mine still lists the route |
| `ward-sidebar-phone-contract.test.ts` — three shells do not reserve the phone bar | the SUBJECT moved: master's `capacity/capacity.module.css` carries the `padding-top` reserve, mine does not | the test blob is IDENTICAL on both; only the stylesheet differs                          |
| `ward-table-min-width.test.ts` — two stylesheets declare an unpinned threshold    | the GUARD moved: master's pin map already lists `capacity/` and `community/`                                | 2 matches at master, 0 here                                                              |
| `ward-table-phone-swap.test.ts` — boards with two layouts and no swap rule        | the GUARD moved                                                                                             | test blob differs                                                                        |

`ward-mode-workspace-reachability.test.ts` is the sixth, and it is the documented one. Its printed
list here is the same four modes across seven files the handover records.

## Why this is worth a file rather than a line in a report

**A builder who takes "any other red is a real failure" literally will fix five things the master
line has already fixed** — and duplicated work of that kind produces no merge conflict and fails no
test, so nothing downstream would report it. That is the shape this project has already been caught
by; it is recorded in the handover's own §7.

**The fix is not to soften the handover's sentence, which is correct where it was measured.** It is
that a red count belongs to a REF, and a builder branch is a different ref from the line the count
was taken on. **A red count quoted without its ref is unusable, exactly as the handover already says
of file counts and ratios.**

⚠️ **AND THE NUMBER HERE WILL DRIFT AGAIN THE MOMENT MASTER MOVES.** Six is this branch against that
master tip, on 2026-09-05. Whoever reads this later should re-run rather than believe it; what does
not expire is the METHOD — for each red, compare the guard blob and the subject blob against master
before concluding anything about it.

---

## 🔴 CORRECTION, SAME DAY: THE POPULATION FIGURE ABOVE CAME FROM A STALE COMMAND

**Every count of files in this document was produced by the discovery command pasted into my
prompt, and that command is the retired one.** Ward Lead caught it, first mis-diagnosed it, then
corrected itself; the second message is the right one and this is what it establishes.

    the authority        docs/ward-flow/NEW-CHAT-PROMPTS-2026-09-05.md, lines 75-92
    the retired rule     union of the ward-* glob and files IMPORTING ward code
    the current rule     union of the ward-* glob and files whose ward reference sits on a line
                         that is NOT A COMMENT

The two differ because a file can exercise ward code without importing it — `proxy.test.ts` asserts
a ward route redirect in running code and imports nothing ward — and a name-matching import filter
cannot see that.

**Re-derived here with the authoritative command: 274 files on this branch**, against the 266 this
document originally reported. **The eight it missed are:**

    dependency-drift-check    design-system-adoption    developer-hub-panels
    mockup-retirement         playwright-exit-code-contract
    proxy                     stale-resume-instructions  viewport-fill-contract

⚠️ **They were then RUN, because a corrected denominator is not a result.** All eight pass — 199
tests, 8 files, zero failures — so **the conclusion of this document is unchanged and the failing
set is still the same six by name.** Two of the eight (`design-system-adoption`,
`viewport-fill-contract`) are exactly the kind my statistics-screen changes could have broken, and
neither had been run when this document was first written.

**What was actually wrong was never the arithmetic.** It was quoting a population as _"discovered
from disk"_ when the command that discovered it had been replaced, and the replacement lives in a
file this document did not read. **A discovery command is itself a measurement with a ref**, which
is the same lesson this document is about, one level up.

## 🔴 AND A SECOND ONE: FOUR TYPECHECK ERRORS I NEVER SAW, BECAUSE I GREPPED MY OWN GATE

`npm run typecheck` on this branch reports **four** errors, in
`ward-community-gateway.dom`, `ward-handover.dom`, `ward-morning-page.dom` and
`ward-movements-derivations`.

⚠️ **I ran tsc repeatedly through the session and saw none of them, because every run was piped
through `grep -i statistics` to scope it to my own work.** The greps returned nothing and I read
that as clean. **A narrower check's silence is not the wider check's silence** — and unlike the test
suite, tsc is not run by vitest at all, so nothing else was going to surface these.

**None of the four is this branch's to fix**, measured the way ownership is actually decided —
`git rev-list <master>..<branch> -- <path>`, not a blob comparison, which cannot tell ahead from
behind:

    every one of the four   0 commits unique to this branch, master ahead by 1-2

One (`ward-movements-derivations`) is provably fixed on master, in `3b38aeb3a`. **For the other
three I have not run tsc against master's blobs and am asserting nothing about their state there** —
two of them come from Ward Verifier's own commit and Verifier reports fixing them on its own arm
branch, which is unfolded.

### `ward-community-gateway.dom` RESOLVED — Ward Verifier ran what I would not assert, and I checked it

Verifier ran the typecheck on master, which is the thing my refusal above left open, and reported
the two blobs differ by **exactly one line**. Re-measured here rather than taken:

    diff <(git show HEAD:<path>) <(git show <master>:<path>)   ->   212c212, and nothing else
    mine     fireEvent.click(screen.getByRole("button", { name: enabledLetter, exact: true }));
    master   fireEvent.click(screen.getByRole("button", { name: enabledLetter }));

`exact:` begins at column 71 — the TS2769 to the character. And it is a real error rather than a
tooling quirk: `ByRoleOptions` in the installed `@testing-library/dom` declares `suggest`, `hidden`,
`selected`, `busy` and the rest, and **no `exact`** — that option belongs to the ByText family. Fixed
on master by `9e220f4a8`; this branch is two commits behind on that path with none of its own.

⚠️ **AND THE OPTION WAS INERT, WHICH IS THE PART THAT SHOULD HAVE BEEN CAUGHT BY SOMETHING.** An
option the query does not accept is an extra property on a plain object: it changed no behaviour and
failed no test. **The typecheck was the only thing in this repository that could ever have said so —
and it was the check whose output I was filtering.**

### The rule, sharpened by Ward Verifier, and its version is better than mine

> **Scope a gate by what you RUN, never by what you READ.** `tsc -p <a narrower tsconfig>` is a
> scoped check whose silence means something. `tsc | grep mine` is a full check with the answer
> thrown away.

Verifier's counterpart evidence is what makes it more than a slogan: it ran the unfiltered typecheck
three times tonight and got 3, then 1, then 0. **That sequence is only legible because nothing was
filtered.** A run scoped by grep would have shown zero at every step, and two of the three errors
were Verifier's own — a filter on its own topic would have hidden exactly those.

### 🔴 THE POSITIVE CONTROL: THE RULE ALREADY WORKED ONCE TONIGHT, ON THIS EXACT LINE

Found by Ward Verifier and verified here against the commit object, because a finding that
corroborates the lesson you are already drawing is the one that gets checked last. The body of
`9e220f4a8` — Ward Builder Three's — ends:

> Unrelated: `tests/ward-community-gateway.dom.test.tsx` passed `exact: true` to `getByRole`, which
> is not an option on that query and was a committed typecheck error on this branch. Removed; ByRole
> already matches a string accessible name in full.

**So the same defect, on the same line of the same file, was caught by an unfiltered typecheck and
missed by a filtered one — by two chats, hours apart.** That is not an argument for the rule. It is
the experiment, with both arms, already run. And it answers the question the rule leaves open:
_"the typecheck is the only witness"_ invites _"then was anyone watching?"_ — yes, once, and the
watching worked. What failed was not the gate but the scoping of its output. Builder Three also
labelled it **"Unrelated"**, so it could not hide inside a feature commit.

⚠️ **THE QUOTE ABOVE CARRIES ONE CLAUSE THE RELAYED VERSION DROPPED**, restored from the commit
object: _"Removed; ByRole already matches a string accessible name in full."_ Nothing turned on it —
it supports the point rather than qualifying it — but a quote is either the words or it is a
paraphrase.

**And the option was not merely ignored — it asked for the behaviour the query already performs.**
Read out of the installed `@testing-library/dom`, not recalled:

    dist/queries/role.js     `exact` appears ZERO times in the whole file (273 lines)
    dist/queries/role.js:173 the accessible name goes through `matches(...)`, never `fuzzyMatches`
    dist/matches.js:31       `matches` ends `normalizedText === String(matcher)` — full equality

So there was no runtime difference available for any assertion to detect, in either direction.

⚠️ **MY FIRST ATTEMPT TO CHECK THAT REPORTED THE CLAIM UNCONFIRMED, AND MY GREP WAS THE DEFECT.** I
searched for `matches(` and found nothing, because the compiled call reads `(0, _allUtils.matches)(`.
**A detector's silence was not evidence — inside the very finding about a detector's silence not
being evidence.** Caught only because the claim was worth a second look rather than a shrug.

### THE SAME MECHANISM RAN FOUR TIMES TONIGHT, AT FOUR LEVELS

Ward Verifier hit the identical grep failure while gathering the evidence above, and says it
recovered **by accident**: its command happened to carry a loose pattern alongside the tight one, and
it read the pattern that produced output. So:

    1  my typecheck, filtered by grep            four errors invisible for a whole session
    2  Verifier's typecheck, unfiltered          3 -> 1 -> 0, legible only because unfiltered
    3  my grep of the evidence for 1 and 2       returned empty; nearly reported as unconfirmed
    4  Verifier's grep of the same evidence      returned empty; masked by a looser pattern beside it

**Mine was caught by a decision — check a corroborating claim hardest. Verifier's was caught by luck,
which is worse, because nothing in it would catch the next one.**

**THE CHEAP FORM OF THE RULE, WHICH IS VERIFIER'S AND IS BETTER THAN "THE RE-CHECK NEEDS ITS OWN
CONTROL":**

> **When a search returns empty, widen the pattern once before believing the absence.** An empty
> result is a claim about the DETECTOR at least as much as about the subject — and on compiled or
> minified sources a precise pattern is the wrong tool by default.

**It is demonstrable in two commands, on the file this whole thread is about:**

    grep -cE 'matches\(' node_modules/@testing-library/dom/dist/queries/role.js   ->  0
    grep -cE 'matches'   node_modules/@testing-library/dom/dist/queries/role.js   ->  3

The compiled call reads `(0, _allUtils.matches)(`, so the tight pattern cannot match it. **Zero and
three, same file, same run, one character of difference in the pattern.**

### AND THE TRUNCATION CHANGED A SEMICOLON TO A FULL STOP

Verifier's own correction, and it is the sharpest detail in the exchange. Its shortened quote did not
merely stop early — it ended _"Removed."_ where the commit says _"Removed;"_. **The punctuation is
what makes a truncation read as a finished sentence rather than as a fragment**, so nothing prompts
the reader to look for the rest. Verifier also reports the full clause was on its screen at the time,
in its own grep output, and it quoted past it: not a relay error, a trim.

⚠️ **Our line numbers for that quote disagree — Verifier read 43-45, I read 45-47 — and neither is
wrong.** Different commands number a commit body from different starting points. Nothing depends on
it here, and it is the same shape as every other disagreement this project has had about a count:
**establish the unit before comparing the number.**

### 🔴 THE WARNING IS INVERSELY CORRELATED WITH HARM — AND, FOR IMPORTED CODE, ONCE-ONLY

Ward Verifier's finding, re-run here from a probe written to a FILE (a heredoc collapses backslashes
before the interpreter sees them, which measures the shell instead).

⚠️ **READ THE CONDITIONS OFF THE TABLE BEFORE RE-RUNNING IT, BECAUSE THE "warns?" COLUMN IS NOT
INTERPRETER-INDEPENDENT.** Ward Verifier flagged this and it applies to this table as much as to its
own: **the column below was taken on `python3` (3.14.4) under DEFAULT filters, in a subprocess.**

- Re-run it on `python` here (3.11.15) under default filters and **every row reads silent** — that is
  item 3 below, not a contradiction of the table.
- Re-run it under `-W always` on 3.11 and **the four `preserved` rows read WARNED again**, because
  forcing the filter measures _does the warning exist_, not _will you see it_.

⚠️ **AND THE THREE `DESTROYED` ROWS NEVER WARN, ON ANY INTERPRETER, UNDER ANY FILTER — measured, and
I nearly published the opposite.** A first draft of this paragraph said all seven read WARNED under
`-W always`. Running it returned **four**, on both 3.11 and 3.14: only `\(`, `\d`, `\s`, `\w` warn,
because `\b`, `\n` and `\t` are VALID escapes and there is nothing for Python to warn about.
**Had the draft been right, the anti-correlation finding would have collapsed** — a forced filter
would have shown the warning covering the harmful rows after all. It does not. The silence on those
three is structural, not a filter setting.

**Both instruments are correct about different questions, and a reader who conflates them will
conclude that item 3 is refuted by the artefact printed above it.** The bytes column, by contrast, is
the same on all three interpreters — see item 5.

The measurement below:

    typed   warns?   bytes      verdict
    \(      WARNED   5c 28      preserved
    \d      WARNED   5c 64      preserved
    \s      WARNED   5c 73      preserved
    \w      WARNED   5c 77      preserved
    \b      silent   08         DESTROYED
    \n      silent   0a         DESTROYED
    \t      silent   09         DESTROYED

**Python warns on precisely the escapes it PRESERVES and is silent on precisely the ones it
DESTROYS.** So `\(` — the one that made me reach for `cat -A` — was never at risk, and `\b`, the
exact escape in this repository's recorded 0x08 incident, would have passed without a word.

**MY OWN ADDITION, MEASURED HERE, AND IT IS WORSE STILL: THE WARNING DOES NOT REPEAT.**
`SyntaxWarning` is emitted at COMPILE time, so a cached `.pyc` skips it entirely:

    run directly, `python3 probe.py`      run 1: 4 warnings    run 2: 4 warnings
    imported by another module            run 1: 4 warnings    run 2: 0 warnings

A `__main__` script never gets a `.pyc` and so warns every time. **An imported helper warns once,
ever** — and the second reader, on a clean run, sees silence and reads it as fixed.

**Together those two facts finish the argument: the warning cannot be the trigger for checking.** It
fires on the harmless half, and on the half where it fires it may already have stopped firing.
`cat -A` (or a hexdump) goes on ANYTHING carrying a backslash that is meant to be re-run later,
unconditionally.

⚠️ **AND MY FIRST ATTEMPT TO REPRODUCE THE WARNING COLUMN RETURNED EMPTY — MY PATTERN AGAIN.** I
grepped for `invalid escape sequence "` where the message reads `"\(" is an invalid escape
sequence.` — the quoted part comes BEFORE the phrase, not after. Widening the pattern, which is the
rule this section is about, produced all four. **I record it flatly rather than as a flourish,
because a finding that confirms the theme you are already writing is the one most likely to be
counted twice.** It is the same mechanism, and I checked it was real before adding it.

### 🔴 AND THE TABLE ABOVE DESTROYED ITS OWN ROWS, IN THE COMMIT THAT ADDED IT

Recorded because it is the finding rather than an embarrassment beside it. I wrote that table
through a shell heredoc into Python — **immediately after Ward Verifier told me a heredoc had eaten
its backslashes twice while it was measuring backslashes.** The doubled backslashes collapsed before
Python saw them, so the source carried single ones, and the three rows the table exists to warn
about were compiled away:

    row \b   became a literal 0x08, printing as an invisible column
    row \n   became a real newline, splitting the table with a blank line
    row \t   became a real tab, silently changing the alignment

**The four rows that survived are exactly the four Python warns about.** So the document said
"these three are destroyed" while demonstrating it on itself, and it still rendered as a table — a
reader skimming it sees a slightly ragged column, not a corrupted record.

⚠️ **It was caught by `cat -A`, which is the rule this section argues for, applied to this section.**
The `SyntaxWarning` fired four times during that commit and every one was for a row that came out
FINE. Nothing warned about the three that did not.

**The repair could not be written the same way either.** It is a script whose every backslash is
built from `chr(92)`, with no string literal containing one, and it verifies afterwards that no
control character survives anywhere in the file. **A repair typed as text would have reproduced the
defect it repairs** — which is the whole of what this thread found, arriving one last time:
_the medium you write a demonstration in is part of the demonstration._

### CLOSING ACTION: EVERY FILE THIS SESSION TOUCHED, SWEPT — AND THE SWEEP HAS A CONTROL

Ward Verifier reports the same collapse happening in ITS notes, in the paragraph warning about it,
and caught by the empty-grep rule from two messages earlier. That prompted the check I had not done:
**I patched two TEST files through the same heredocs, and those carry regular expressions.** A
document that renders oddly is recoverable; a regex with a 0x08 in it is a guard that silently stops
matching.

All twelve files changed between this session's first commit and its last were scanned for
BACKSPACE, TAB, VTAB, FORMFEED and CR:

    files checked   12   (2 test files, 3 stylesheets, 5 screens, 2 documents)
    verdict         no control characters in any of them

⚠️ **AND THE SCAN HAS A POSITIVE CONTROL, because a clean sweep is worth nothing without proof it
could have failed.** A copy of `ward-bar-fill-only-edges.test.ts` with a single 0x08 seeded into it
was flagged `BACKSPACE 0x08` while the real file read clean, in the same run. Without that pair, a
scanner with a broken predicate and a genuinely clean tree are the same output.

⚠️ **ONE LAST UNIT DISAGREEMENT, LEFT ON THE RECORD RATHER THAN RECONCILED.** Verifier counts seven
instances; I counted eight. Neither is wrong — it merges two of my greps into one row and I split
its heredoc collapses. **The tally was never the finding, and a thread this long is exactly where a
number starts being repeated instead of measured.** The finding is the mechanism, and it is
Verifier's sentence: _the medium you write a demonstration in is part of the demonstration._

### 🔴 THE WARNING IS DEAD AS A TRIGGER, FIVE WAYS — AND THREE PYTHONS ON THIS MACHINE DISAGREE

Ward Verifier found the last of these and it closes the argument rather than extending it: **we got
opposite answers on the same machine because we typed different words.** Re-measured here.

    word typed   resolves to                                              version
    python       ...\AppData\Local\hermes\hermes-agent\venv\Scripts\python.exe    3.11.15
    python3      ...\AppData\Local\Python\pythoncore-3.14-64\python.exe                 3.14.4
    py           ...\AppData\Local\Programs\Python\Python314\python.exe              3.14.7

⚠️ **The bare word `python` here answers to another tool's virtualenv, not to this project's
interpreter.** Same probe file, same directory, default filters, direct run:

    python3   ->  4 x SyntaxWarning:      "\(" is an invalid escape sequence. …
    py        ->  4 x SyntaxWarning       (same text)
    python    ->  NOTHING AT ALL

On 3.11 it is a `DeprecationWarning`, which is **hidden by default** — so on the interpreter an agent
reaches for by typing `python`, the warning never fires once, on a cold cache, on a direct run. I
reported "warns once"; Verifier would have reported "never warns"; both correct, same machine.

**AND THE MESSAGE TEXT MOVES BETWEEN VERSIONS, WHICH EXPLAINS MY FAILED GREP PROPERLY:**

    3.14   SyntaxWarning:       "\(" is an invalid escape sequence.     escape BEFORE, double quotes
    3.11   DeprecationWarning:  invalid escape sequence '\('        escape AFTER,  single quotes

Category, word order and quote character all change. **A pattern tuned on one interpreter returns
empty on the other, and empty reads as clean** — our own rule, one level up. So no grep pattern for
this belongs in a document: it is wrong for somebody's interpreter by construction.

🔴 **THE FACT THAT SETTLES IT, AND NEITHER OF US HAD CHECKED IT: THE DESTRUCTION IS IDENTICAL ACROSS
BOTH VERSIONS.** Byte for byte, 3.11.15 and 3.14.4 both preserve \( \d \s \w and both turn
\b into 0x08, \n into 0x0a and \t into 0x09. **The harm is constant and only the signal varies** —
which is the worst arrangement available, and the whole case in one line.

**So, five ways over:**

1. it fires on exactly the escapes Python **preserves** and is silent on exactly the ones it
   **destroys** — anti-correlated with harm;
2. on an imported module it fires **once ever**, then the `.pyc` silences it;
3. on 3.11 it is a `DeprecationWarning` and **never fires at all** by default;
4. its **text changes between versions**, so it cannot be reliably detected even when it does fire;
5. and the **damage it fails to report is identical on every version**.

**`cat -A` (or a hexdump) unconditionally, on anything carrying a backslash that is meant to be
re-run — never prompted by a warning.** That is the rule, and items 1 to 5 are why it is a rule
rather than a habit.

### THE SWEEP ABOVE HAD A HOLE, AND WARD VERIFIER'S METHOD IS THE BETTER ONE

Verifier swept its own six committed files and stated its method: **read BYTES, not decoded text —
a decoder can normalise something a byte scan catches.** That is a real defect in the sweep recorded
above, which did `raw.decode("utf8", errors="replace")` first. **Any INVALID byte sequence becomes
U+FFFD — ordinal 65533, not below 32 — so a whole class of corruption was invisible to it.**

⚠️ **It would still have caught a bare 0x08, because that is valid UTF-8 and decodes to U+0008.** So
the earlier verdict was not wrong. But _it happened to catch the case I was looking for_ is not the
same claim as _the scanner was sound_, and this thread is entirely about the difference.

Re-run over raw bytes, for NUL, BACKSPACE, TAB, VTAB, FORMFEED, CR and ESC, plus a strict UTF-8
decode:

    CONTROL   a copy seeded with one 0x08 AND one invalid byte  ->  BACKSPACE x1, UNDECODABLE
    result    12 files: clean as bytes, and valid UTF-8 throughout

**The control now proves both classes live before any verdict is printed** — the script exits
non-zero rather than reporting, if either arm fails. The first version proved only one.

### THE TALLY, CLOSED BY AGREEING NOT TO HAVE ONE

Verifier declines to adopt either count and so do I. Seven and eight are a unit disagreement — it
merged two greps, I split two heredoc collapses — and it is the **fourth** of the night between us,
after the master tip taking three values, our commit line numbers differing by two, and `grep -c`
counting lines rather than occurrences. **None of the four changed a conclusion.**

> **A count nobody can reproduce is a proxy for a mechanism anyone can.**

Both numbers stay on the record with their units. The mechanism carries it.
**One limit Verifier states and I am keeping:** _"no gate here catches it"_, not _"nothing could"_.
TS2769 is an overload error needing type information; nothing in `verify:cheap` runs a type-aware
lint rule that would surface an excess property. Whether such a rule exists was not checked by
either of us.

⚠️ **A TIP QUOTED WITHOUT A TIMESTAMP IS THE OTHER HALF OF THIS EXCHANGE.** The master tip read
`ae41ca860` for Verifier, `2160ddd1e` when I re-read it, and `6ea45dc7a` when I checked this finding
— three values inside one conversation. Nothing in either conclusion depended on it, and that is
luck rather than method.
