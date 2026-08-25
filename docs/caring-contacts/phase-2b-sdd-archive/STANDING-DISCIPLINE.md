# Standing verification discipline — read once, applies to every Caring Contacts task

Every brief in this programme referenced these rules in full, which cost about forty lines per brief
and drifted between them. They live here now. **A brief that says "the standing discipline applies"
means all of this.** Where a brief contradicts this file, the brief wins — it knows its task.

Every rule below was bought by a real defect in this programme, and the defect is named so you can
tell whether your situation is the one it is about.

## Mutation testing

- **Test-first.** Task 7 skipped it, disclosed it honestly, and it cost exactly one real bug: an
  in-memory fallback unreachable in the exact case its own comment claimed it handled. Nobody had
  written an assertion about that branch, and **mutation testing can only falsify tests that exist.**
- **A mutation proves the assertion it makes fail, not the case it makes red.** A case with N
  assertions needs N mutations, or it needs splitting. Two ways this bites: an assertion behind a
  sibling that fails first is never reached; and an assertion nobody mutated is simply unproven.
- **Check first that the mutation changes a value some assertion reads.** A mutation that leaves every
  asserted value unchanged proves nothing however red the suite goes.
- **Predict each failure message, then compare.** An unexpected number in an assertion error is a
  second defect. One control here fired at `expected 3 to be 1` where 2 was predicted — it was
  counting its own explanatory comment.
- **Itemise every attempt**, including greens and unmatched anchors. **No aggregate total** — the table
  is the evidence, and a total that reconciles invites nobody to check its parts.
- **A mutation that should leave a gate green is evidence too.** Label it; over-sensitivity controls
  belong in the ledger beside the reds.
- **A check you believe is redundant is a hypothesis.** Mutate it before filing it as unnecessary. One
  `not.toContain` loop here was nearly deleted as implied by the assertion above it — which passes,
  because both sides read the same record.
- **A test that installs a double must assert the double was used.** jsdom's storage is a Proxy
  answering from the prototype, so a mock assigned to the instance is never called and the test passes
  inert.
- **Commit each piece before you mutate the file it lives in.** `git checkout --` also discards any
  uncommitted fix in that file.
- **Never `git add -A`, `git add .` or `git commit -a` while a mutation is applied.** This has now
  captured a live mutation into a commit **three times** in this programme — twice by the controller
  sweeping an implementer's uncommitted work, once by an implementer committing its own mutation. The
  worst instance disabled the demo's only entry point by leaving a referral in `awaitingHandover`;
  the full suite caught it. **Stage explicit paths, always.** The two rules are converses and you need
  both: commit before mutating, and never stage by wildcard while mutated.

## Proving a mutation is present

- **Do not run the presence check through a shell.** On this Windows machine the MSYS2 runtime
  re-parses the command line, so an argv element containing `"`, `{`, `?`, `[` or `*` is not the string
  you sent. `grep -c` silently returns 0 for a mutation that is demonstrably present, and **`-F` does
  not fix it** — `-F` governs how grep reads a pattern it has already received. Read the file
  in-process and check the substring there.
- **Treat exit 1 as distinct from a count of 0.** A driver that conflates them cannot tell "no match"
  from "the tool refused to try".
- **A red proves presence by itself** — a mutation that never reached disk cannot make its own target
  assertion fail. **So a presence check is load-bearing only for a GREEN.** Three conditions:
  the failure message names the mutated behaviour; the assertion was green on the same tree
  immediately before; and the worktree is quiet with a deterministic assertion. File-content
  assertions meet the third trivially, async DOM assertions do not.
- **Assert `git diff --quiet` clean on both sides of every mutation.** A concurrent writer in the same
  worktree has voided a whole mutation round here, and this is how you find out rather than absorb it.

## Reporting a gate

- **Never report a gate as passing from an exit code. Paste the `N passed` line.** A refusal arriving
  through a pipe leaves `$?` reading **0** for a gate that never ran, and one wrapper here printed
  `[exited with code 0]` while reporting `1 failed`.
- **No summary line means no run**, whatever the exit code says.
- **Run controls with `GATE_RECEIPTS=refresh`.** A restored tree hits a cached receipt and exits 0 with
  no summary line, which reads exactly like a gate that never ran.
- **`npm run lint` uses a per-file cache.** A file that has not changed is not re-examined — so a
  failure caused by a _different_ file's change stays invisible locally and goes red in CI. If lint
  matters to your claim, clear `node_modules/.cache/eslint` or run `npx eslint <paths>` without it.

## Gates, and the shared machine

- **Run `npm run test:cc-guards` only, including for mutations.** It takes a _focused_ lease and two
  are permitted concurrently across worktrees, so it does not starve.
- **Do not run the full `npm run test`.** The controller runs it once per branch at the merge point,
  when the other worktrees are idle. Its value is catching cross-file breakage, which matters at
  merge rather than per task.

  **Why this rule exists, measured 2026-08-26:** with three implementer worktrees plus another
  session live, the exclusive heavy lease was held continuously and **`run-vitest.mjs` queues rather
  than refusing** — so a suite blocks inside the child process with no refusal to retry around. One
  task's mutation ledger came back **ten of twelve unrun**, and the casualty was the one mutation that
  distinguished a real pair of assertions from an inert one. **An honest unrun row is worth more than
  a forced lease**, and a policy that stops the starvation is worth more than either.

- **A lock refusal is neither a pass nor a failure.** One exclusive heavy job runs at a time across
  **every** worktree of this repository, and other implementers are usually active. Retry; **never
  force past another worktree's lease.** If you believe an orphaned run is your own, prove it from the
  lease record's `worktree` field rather than a live PID — and **evidence adequate for waiting is not
  adequate for breaking a lease.** A foreground run killed at a tool timeout once orphaned the lease
  for 26 minutes and blocked every worktree.

## Writing that does not decay

- **Do not restate a count in prose.** State the invariant. This rule has been broken by every role in
  this programme including the controller, and once inside the very comment written to remove counts.
  A count sitting **directly on top of the list it counts** is acceptable; a count about something
  elsewhere is the decaying form.
- **Name the destination, not the act.** "Recorded on the plan" survives; "stored", "kept" and
  "recorded" alone do not, because this system distinguishes _held in a tab's storage_ from _written
  onto the plan_ while ordinary English does not. One sentence here was wrong twice, in opposite
  directions, before it stuck.
- **When a diff changes what a mechanism does, read every doc comment in the files it touches** and ask
  whether each still describes the code beneath it. A phrase grep is the mechanised subset of that and
  catches only literal repeats; the scope rule found four stale comments where the phrase rule found
  one.
- **A mechanism you have not seen run is a hypothesis. Reporting it as coverage is the failure.**
- **Disclosing a limitation is not discharging it.** A frank paragraph about a gap reads — to its
  author most of all — as though the gap has been handled. It has been described.
- **A `\b` you write can arrive as a literal `0x08` byte**, which renders as nothing and makes a regex
  match nothing while every gate stays green. Prefer `\\b` or an explicit character class.

## Repository constraints that fail the build

- Nothing under `src/lib/caring-contacts/` may import from `@/components`, `@/app`, any `@/lib` module
  outside itself, Supabase, or OpenAI. **A screen must never re-derive a rule a module owns.**
- **The service-state incident `note` must never cross into a Client Component.**
- Every `<button>` does something. A control unavailable for a **stated reason** uses
  `aria-disabled="true"` + an inert handler + `title="… — coming soon"` + an `sr-only` note. Native
  `disabled` is for **transient** inertness only; never both on one control.
- Internal navigation via `<Link>` / `router.push` / server `redirect()` — never a raw `<a href="/…">`,
  **including in tests**, once the route exists.
- Design tokens only, no hardcoded hex. Tap targets `min-h-12` (48px), **never `min-h-11`**, and put
  it on the element **containing** the control — on a wrapper it leaves the row's whitespace dead.
- **Patient-visible copy is frozen.** A screen that hardcodes one is a defect even when the string is
  correct. **You may not draft any patient-visible message wording, ever** — especially a closing
  message, which the owner deferred to a lived-experience representative.
- **The closed transport vocabulary is frozen**: high risk, safe, engagement score, campaign, lead,
  conversion, best match, inbox, conversation, clinical risk, risk score, wellbeing score, and any
  claim that replies are monitored. `Delivered` is a transport receipt, never a patient-state label.
  The scan checks **bare identifiers too**.
- **Never render a raw role identifier to a clinician.** Role wording lives in the sealed domain and is
  resolved server-side. The interface-vocabulary scan currently _rewards_ leaving identifiers on screen
  — it refuses "lead" as a whole word but passes `clinicalProgrammeLead` on a missing word boundary.
  That inversion is filed; do not exploit it.
- **This is Next.js 16.** Read `node_modules/next/dist/docs/` before writing route or boundary code.

## The approved mockups picture a later product

Five values the design shows arriving from a hospital record this system is not connected to: stage
1's identity, stage 3's personalisation, the mobile number, the discharge date, and cultural identity.
**If you find a sixth, report it — do not invent a source for it.** The design is a specification for
the product; the types are a specification for what exists. **Where they disagree, the types win, and
the disagreement is worth recording rather than silently resolving.**

## Reporting

Commit early — before waiting on any gate. Write the full report to your named report file and return
only: status, commit SHAs, a one-line test summary, and your concerns. **Do not push and do not open a
pull request. Do not dispatch subagents.** If the brief is unclear or contradicts the tree, **ask
before implementing rather than guessing** — and if an earlier task's report does not match what it
actually left you, that is a finding, not something to work around silently.
