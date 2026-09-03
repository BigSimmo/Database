# WF-BUILD3-001 — a route nothing can link must fail a test, not wait to be noticed

**Assigned to:** Ward Builder Three — `claude/ward-builder-three`, worktree `D:/Worktrees/Database/ward-builder-three`
**Assigned by:** Ward Lead, 2026-09-01, from `cd0e7d585`
**Status:** open

---

## Why this exists

**Twice today a page shipped that nothing could link to, and both times a person found it, not a check.**

`/mockups/ward-flow/statistics/ward/[unitId]` and `/statistics/ed/[edId]` were reported as referenced
by **nothing** in the source — while the comparisons page linked every ward and every emergency
department, with a DOM test pinning both sets exactly. **Both facts were true.**
`tests/ward-nav.test.ts` establishes reachability by reading source TEXT for an href, and the builder
composed its path from a constant:

```ts
return `${STATISTICS_HOME_HREF}/ward/${encodeURIComponent(unitId)}`;
```

So the string `/mockups/ward-flow/statistics/ward/` **appeared nowhere in the repository** and no scan
could see it. It was fixed by hand, twice, in two files.

⚠️ **AND THE FIX IS CURRENTLY HELD UP BY A COINCIDENCE, NOT BY A RULE.** Ward Verifier swept every
dynamic route prefix: none is invisible today — **but `statistics-sections.ts` still composes
`STATISTICS_OVERVIEW_HREF` and `STATISTICS_COMPARE_HREF` from `STATISTICS_HOME_HREF`, and those two
routes are visible ONLY because `ward-nav.ts` independently writes the same paths as literals.**
Remove those two nav entries and both routes go invisible with no test failing.

**Composing from a constant is the tidier style and the neighbours do it. The next builder written
will be invisible again.**

## What to build

**A test that walks every dynamic route directory under `src/app/mockups/ward-flow/` and asserts that
its literal prefix appears in source text under `src/`.**

⚠️ **AND IT MUST BE MEANINGFUL ON AN UNREGISTERED BRANCH.** Ward Builder One's branch sat all
afternoon with the statistics routes present and the registration absent — routes invisible with
nothing yet to delete. **That window is the state this test really catches, not a deletion**, and the
failure message must tell the two apart: _this route was never registered_ versus _somebody removed
its literal_.

## ⚠️ Eight ways this ships checking nothing. Ward Verifier wrote these before the test existed; three are blocking.

**F1 — BLOCKING. The discovery step returns nothing and the loop passes vacuously.** Wrong path, a
renamed directory, a different cwd under a different runner, case sensitivity — the `for` body never
runs and the test is green forever. **This is the single most likely way it dies.** Pin the discovered
count: **eight dynamic routes today.** Assert the number and name it, so a discovery that silently
returns three is red rather than reassuring.

**F2 — BLOCKING. The literal is found in text that makes nothing reachable** — a comment, a doc
string, a dead constant, or the route's own declaring file. ⚠️ **The pathological version: the comment
explaining WHY the prefix must be written out itself contains the prefix, and satisfies the test that
comment exists to serve.** Not live today, and one ordinary helpful edit away. **Exclude comment text,
and exclude the file that declares the route.**

⚠️ **This is not hypothetical. It has two instances today, in opposite directions.** A grep matched
`recentlyDecidedReferrals` inside a doc comment saying _"must never be reached for here"_ and it was
reported as a call — by the same session that had written F2 as a hypothetical **sixty minutes
earlier**. **Knowing the trap did not prevent it. Build the exclusion into the tool.**

**F8 — BLOCKING. The cheapest way to make it green is a lie.** "This string must appear somewhere" is
satisfied by a constant in a dead file. **A test whose cheapest fix is dishonest trains people to
satisfy it dishonestly, and is worse than no test.** The failure message must state the actual
requirement — _the href builder must write the prefix in full_ — and name the builder. **Say what you
want, not what you measure.**

**F3** — prefix presence is weaker than href construction. The literal existing says nothing about
whether anything builds a complete href with a real id. A dead constant passes.

**F4 — put this in the test's own header, in these words.** ⚠️ **This test asserts what the SCAN needs
in order to be trustworthy. It asserts nothing about whether a person can reach the page.** A route
can pass it and be genuinely unreachable (literal written, never rendered), and fail it while being
genuinely reachable (composed, rendered everywhere) — **which was the original defect exactly.**
Without that sentence it becomes the second false-comfort claim in the same file, and the first cost a
day.

**F5 — path separators.** A directory walk on Windows yields backslashes. A search string joined with
the OS separator gives `\mockups\ward-flow\…` and matches nothing. **Assert the constructed string
starts with `/` and contains no backslash.** Ward Verifier could not build this case on demand and
records it as unproven — assert the shape directly rather than trusting a test of it.

**F6 — the prefix derivation is itself untested.** For `/statistics/ward/[unitId]` the prefix is the
path up to the first dynamic segment. Catch-alls (`[...slug]`), optional catch-alls (`[[...slug]]`)
and two dynamic segments in one path all derive differently. **Unit-test the derivation function
directly, including a catch-all that does not exist in the tree today** — a helper exercised only
through eight happy cases is wrong the first time the ninth differs.

**F7 — a route with no static prefix cannot satisfy it.** A dynamic directory nested directly inside
another has no literal to write. **Ship the documented allowlist WITH the test, empty, with the rule
for adding to it** — so the narrow escape exists before anyone needs the wide one. A wholesale
silence is how this class of guard dies.

## One question Ward Lead has not settled, and it is yours to argue

Derive the route set **independently** of `tests/ward-nav.test.ts`, or reuse the set it already
computes? Reuse means one derivation; but a bug in it blinds both tests **in the same direction**, and
two agreeing checks with one blind spot is a failure this project has already had.

**Ward Verifier's position, which Ward Lead endorses:** independence is a property of the SOURCE, not
of the code. Two walks of the same tree with the same helper are one derivation written twice. Genuine
independence means **one set from the filesystem and one from the declared registry** — and comparing
those catches two things neither test alone can see: a route on disk nothing declares, and a
declaration for a route that no longer exists.

**If you add that comparison: diff the NAMES, never the sizes.** `expect(a.size).toBe(b.size)` passes
for a swap; two counts agreeing while both are wrong about which file is a failure this project has
already had. Print the symmetric difference — _on disk but not declared: X; declared but not on disk:
Y_. **And name the legitimate red in the test:** _"this usually means you added a route and have not
registered it — register it, do not add it to the allowlist."_

## Constraints

- **You own `tests/` files you create, and nothing else.** ⚠️ **If the test goes red on a real route,
  do NOT fix the route.** Report it. Ward Lead owns `ward-nav.ts` and the registration.
- **Never `git add -A`.** `git status`, then stage by name.
- **Commit each coherent step.** This machine has crashed twice today.
- **You never merge, rebase, push, or touch another branch.**

## How to check

- `npx tsc -p tsconfig.typecheck.json --noEmit` — report the exit code. **Vitest runs no typecheck.**
- ⚠️ **Report the number of tests that RAN, not the number that passed.** A vitest run that dies at
  startup produces output indistinguishable from a clean pass — _"0 failed"_ and _"0 ran"_ look the
  same in a summary line.
- Discover the suite from disk: `ls tests/ward-*.test.ts tests/ward-*.test.tsx | wc -l` ≥ **100**.
- **Never pipe a run through `tail`.**
- ⚠️ **A leading `/` in a search argument is silently rewritten on this machine** — drop it, and prove
  any absence against a known-positive control.

## Falsifier

Discovery can return empty and pass; or a comment satisfies it; or the cheapest way to green is a
dead constant; or the derivation is untested against a catch-all; or the header does not say what the
test does NOT prove.

## Before you commit

**Ward Verifier has seven deliberately-broken trees already built for this** — vacuous discovery,
comment-only, dead-constant, self-declaring, catch-all, and no-static-prefix. **Send it the test
before committing and it will run them.** Reading a test says what it intends; running it against a
world where the property is false says whether it can tell.
