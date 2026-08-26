# Task: a patient's name must never reach the caseload URL (Ruling [111])

Branch `claude/browser-test-gate-handoff-d5c1db`, worktree
`.claude/worktrees/browser-test-gate-handoff-d5c1db`. Nothing pushed, no PR, no subagents, no
network command.

## The defect, as it stood

`patientsDirectoryHref` in `src/components/caring-contacts/workspace/patients-directory.tsx` built
`?q=<search text>`, the caseload search box was a `method="get"` form posting to that parameter, and
`matchesFilter` in the same file matched the query against the patient's **name**. Typing a name
therefore produced `/caring-contacts/patients?q=Jordan%20Nguyen`, which reaches the browser history
of a possibly-shared ward computer and the access log of every proxy in between.

Ruling [111], quoted verbatim from `src/lib/caring-contacts-routes.ts`: _"a query string is logged
by every proxy between here and the browser. Nothing about a patient may travel here, including as a
draft key."_

## The ruling implemented

Confidentiality outranks payload size. Ruling 13 (client payload held to a rounding error) is a
performance preference; Ruling [111] is a patient-confidentiality contract. `origin/main` reached
the same split independently. Adopted.

## What changed

**`src/components/caring-contacts/workspace/patients-directory.tsx` — now the SERVER half.** It
reads, narrows each `PlanRecord` + name projection to a `PatientsDirectoryRow`, filters by the
non-identifying plan state, and hands the result over. It computes `awstCalendarDay`, the suppressed
and absorbed contact counts, and the name map — so the raw `PlanRecord` (pathway, team, contact
schedule, discharge instant) never crosses the boundary. `mayViewPlans === false` hands over **no
rows at all**: the capability is answered on the server side, so a role that may not see the caseload
does not receive it in a payload it merely declines to render.

**`src/components/caring-contacts/workspace/patients-directory-client.tsx` — ADOPTED, not deleted.**
The file the catch-up merge carried in was `origin/main`'s snapshot and was **stale relative to this
trunk** in two ways that adopting it verbatim would have regressed:

- it used `UnavailableDestination` for the row's detail control, which Task 6 had already replaced
  with `<Link href={patientRoute(row.patientId)}>` once that route existed (Rulings 52/89/97);
- it had no `mayViewPatientNames` prop and no `NamesNotShownNotice`, so the "your role may not see
  names, stated once above the list" behaviour would have disappeared.

So main's **approach** was adopted and this trunk's **behaviour** was preserved inside it. The island
holds the typed text in `useState`, matches it against name + patient id + plan id + referral id, and
serializes it into nothing at all.

It stays on the client-component allowlist in `tests/caring-contacts-explained-automation.dom.test.tsx`
because it is now a real, rendered client component and that check asserts exact set equality — the
"unadopted" comment is gone and replaced with the real justification, so the allowlist describes
reality. Deleting the file was the other permitted outcome and was rejected: adopting it is what the
defect required.

**`src/lib/caring-contacts/patients-directory-filter.ts`** — main's module is now the one in use. Its
comment already read _"Parse only non-identifying state from the URL; patient-name search stays in
browser memory."_ That is now true of the code that runs: the page imports this parser, and the
duplicate `parsePatientsDirectoryFilter`/`PatientsDirectoryFilter` that carried a `query` field is
gone. The comment was expanded to say that the absence of `q` is the contract rather than an
omission, and that a stale `?q=` on an old bookmark is **ignored rather than honoured**.

**`src/app/caring-contacts/patients/page.tsx`** — imports the parser from the sealed lib module. The
"FILTERING IS A URL" note is now "THE PLAN-STATE FILTER IS A URL; THE NAME SEARCH IS NOT".

### The identifier search — what I concluded

The brief allowed the identifier search to stay server-side. **It did not.** One control feeds both
halves, exactly as the approved design shows ("Name or synthetic ID"), and splitting it would have
put two search boxes on one caseload — giving a coordinator a way to type a name into the
server-backed one. A synthetic patient/plan/referral id is not a name and would have been safe to
leave on the server; the reason it moved is that keeping one box is the only way to guarantee a name
never reaches the server as a query parameter on its way to matching an identifier. That is the
brief's own warning, and splitting the controls is what would have triggered it.

### The cost, stated on screen rather than hidden

A reload now keeps the plan-state filter and clears the typed name, and the URL no longer reproduces
the filtered view. Nothing compensates for that — the name is not in a hash, a fragment, an encoded
parameter, or a hash **of** a name, because a hash of a name is still a name-derived identifier in a
log.

Spec 4.4 applies, so the screen says it, in place, wired to the input with `aria-describedby`:

> This search stays in this browser tab. Reloading the page, or opening its web address anywhere
> else, clears what you typed here and keeps the plan-state filter above, because the plan state is
> in the web address and what you type here never is: a patient's name is never put into a web
> address, browser history or server log.

The empty state's "Show every plan" remedy is now **one** control for **two** filters that live in
two different places: a `<Link>` to the bare patients route (drops the state from the address) with
an `onClick` that clears the typed search (drops the name from this tab). A `<Link>` alone would have
navigated and left the name still filtering the list it arrived at — a remedy that does not keep its
promise.

## Verification

`npm run test:cc-guards` only, plus `typecheck` and uncached lint. **No full `npm run test`, no
Playwright** — three implementers are live.

| Gate                                               | Decisive line                                                         |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| `npm run typecheck` (`GATE_RECEIPTS=refresh`)      | `[gate-receipts] recorded a pass for "typecheck:internal"`, no errors |
| `npx eslint` on the 6 changed files, cache wiped   | `files linted: 6 / errors: 0 / warnings: 0`                           |
| `npm run test:cc-guards` (`GATE_RECEIPTS=refresh`) | `Test Files 18 passed (18)` / `Tests 401 passed (401)`                |

Lint was run with `node_modules/.cache/eslint` removed and via `npx eslint` (no cache), and the count
is printed explicitly because a silent ESLint pass is indistinguishable from a run that examined
nothing.

**Correction (round 2).** Round 1 of this report claimed "all three were re-run on the final tree".
That was accurate for `test:cc-guards` and not for `typecheck`: the reviewer recomputed the tree's
gate-receipt signature as `08f4bcf5…`, which the `test:cc-guards` receipt carries, while the
`typecheck` receipt carried `80c53421…` — one edit earlier. The only delta was this report's
markdown, which `typecheck` does not read, so the substance was fine and **the sentence was not**.
The claim is corrected here rather than the gate; round 2's own re-verify is recorded at the end of
this file. `typecheck` also refused once with `DATABASE_HEAVY_RUN_ADMISSION_BUSY` (owner worktree
`D:\Worktrees\Database\cc-plan-detail`) — a refusal, not a failure — and was retried until it ran.
No lease was broken at any point in this task.

### Mutation ledger

Every attempt itemised, greens included. Each row predicted its failure message before the run and
the prediction is compared. `git diff --quiet` was asserted clean before and after every mutation,
and every mutation was applied by exact-string replacement with an in-process presence check (never
through a shell — an argv containing `{`, `"` or `$` is not the string you sent on this machine).

| id     | mutation                                                                            | predicted                                                        | observed                                                                                                                            | verdict                                       |
| ------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **M1** | put the name back in a URL: state chip href gains `&q=${encodeURIComponent(query)}` | address loop reddens naming form `Jordan%20Nguyen`               | `AssertionError: an address on this screen carries "Jordan%20Nguyen": expected '/caring-contacts/patients?state=draft…'` — 1 failed | RED as predicted                              |
| **M2** | `matchesQuery` drops `row.patientName` from the haystack                            | the name search finds nothing; `getAllByRole("listitem")` throws | `TestingLibraryElementError: Unable to find an accessible element with the role "listitem"` — 3 failed                              | RED as predicted                              |
| **M3** | remove `aria-describedby` from the search input                                     | `expected null not to be null`                                   | `AssertionError: expected null not to be null` — 1 failed                                                                           | RED as predicted                              |
| **M4** | parser reads `q` back into the filter object                                        | state assertion passes, then `JSON.stringify` contains the name  | `expected '{"state":"active","query":"Jordan Ngu…' not to contain 'Jordan Nguyen'`, failing at line 191 after line 189 passed       | RED as predicted                              |
| **M5** | server wrapper stops filtering by plan state                                        | `expected … to have a length of 1 but got 2`                     | exactly that, plus 4 siblings across 2 files — 5 failed                                                                             | RED as predicted                              |
| **M6** | search `<div role="search">` becomes a `<form>` (fields keep no `name`)             | address collector catches the unnamed field's value              | `an address on this screen carries "Jordan Nguyen": expected '=Jordan Nguyen' not to contain…` — 2 failed                           | RED as predicted                              |
| **M7** | add a field-less `<form method="get" action={patients}>`                            | address loop passes; the `form` null-check reddens               | `AssertionError: expected <form …></form> to be null` — 2 failed                                                                    | RED as predicted                              |
| **M8** | `patientsDirectoryHref` drops `encodeURIComponent` around the plan state            | GREEN — no plan state contains a character needing encoding      | `Test Files 18 passed (18)` / `Tests 401 passed (401)`                                                                              | GREEN as predicted — over-sensitivity control |

**M7 exists because I suspected `expect(container.querySelector("form")).toBeNull()` was redundant.**
M6 showed it firing behind a sibling that reddens first, which proves nothing about it. M7 is the
case that separates them: a form with no fields carries no name into the collector, so the loop
passes and only the form check catches it. The hypothesis was wrong and the check stays.

**Lock refusals encountered and retried, never forced:** the first attempts at M2, M4 and M5 came
back with an exit code and **no summary line**. The raw output shows
`Error: Database focused-test capacity is full (current owner PID 67148, worktree
D:\Worktrees\Database\cc-schedule)`. That is neither a pass nor a failure; each was retried until it
ran. No lease was broken. This is also why the driver keeps raw output: an exit code alone would have
read as "1 failed".

**One honest gap in the driver:** M3's replacement text is the empty string, so its in-process
presence check was vacuously true. The red proves presence by itself (a mutation that never reached
disk cannot make its own target assertion fail), so this cost nothing here — but the driver would not
have caught a delete-mutation that silently failed to apply and then went green.

## What `tests/ui-caring-contacts-workspace.spec.ts` needs — you run this gate

I did not run any Playwright gate and did not change that file. What it needs:

1. **Should still pass unchanged.** Its patients-directory tests exercise the empty caseload ("No
   patients yet") and its colours. That path renders the same `ListEmptyState` from the same
   wording, and the route still serves 200. The one new thing on the page is a hydrated search box
   and a paragraph of text above the empty state; no assertion in that file reads either.
2. **Worth adding — the browser-level counterpart of the load-bearing proof.** Type a patient's name
   into the caseload search box and assert `page.url()` is unchanged, then reload and assert the box
   is empty while the `state` chip's `aria-current` survives. That is the §4.4 claim proven where a
   coordinator actually experiences it, and it is the assertion that would catch a future
   re-introduction of a GET form in a real browser rather than in jsdom.
3. **Caveat on the positive control for (2).** As seeded, that spec's caseload is empty, so a typed
   name would match nothing and the URL assertion would have no positive control — it would prove
   "the URL did not change" over a screen with no rows. To make it load-bearing the spec needs a
   seeded plan with a name, so the typed name can be shown to filter the list before the URL is
   asserted clean. Without that seed, add it as (2) but read it as a weaker check than the jsdom one.

## Not verified

- **No browser was opened.** Forced-colors and 320px were reasoned about, not observed: the new note
  is a token-coloured `<p>` with no border or background of its own, the search row is `flex-col`
  below `sm` with `min-w-0`, and every control kept `min-h-tap` (`--spacing-tap: 3rem` = 48px, never
  `min-h-11`). That is a reading of the classes, not a screenshot.
- **No full `npm run test`**, so cross-file breakage outside the 18 cc-guard files is unproven. The
  page test (`caring-contacts-patients-page.dom.test.tsx`) is inside the gate and passed.
- **No production build.** Two Server/Client defects in this repo have passed typecheck and the unit
  suite before a build caught them; this change adds a Server → Client boundary, which is exactly
  that class. Every prop crossing it is a string, number, boolean or an array of plain objects of
  those, and no function or `Date` crosses — but that is inspection, not a build.

## Concerns

1. **The Server/Client boundary is unproven by a build.** See above. Worth a `npm run build` before
   merge, at the merge point where the heavy lease is free.
2. **`main`'s island was stale and adopting it verbatim would have been a silent regression** — the
   row's `<Link>` and the `mayViewPatientNames` notice. If any other file the catch-up merge carried
   in is being treated as "main's newer version", it deserves the same check rather than the
   assumption.
3. **The `?q=` a coordinator has bookmarked is now silently ignored.** That is the conservative
   direction and I believe it is right, but it is a behaviour change nothing tells the user about: an
   old bookmark opens an unfiltered caseload rather than an error. If that matters, it is a wording
   decision for the owner, not something I should draft.
4. **The whole-tree `npm run format` was not run**, per the gate restriction. The pre-commit hook ran
   documentation synchronisation and reported the tree synchronized; formatting of the changed files
   has not been checked against the repository-wide Prettier pass.
