# Placement test repair report

**Status:** done. **Commit:** `9268bc323cc8a23819aff39b23240493c010aaf0` on
`claude/ward-builder-community-route`.

**Gate:** `npx tsc -p tsconfig.typecheck.json --noEmit` — clean, no output.
`npx vitest run tests/ward-daily-sheet-placement.dom.test.tsx tests/ward-daily-sheet.dom.test.tsx`
— **RAN 49, passed 49** (2 test files).

**Component path** verified with `find`: `src/components/ward-management/board/ward-daily-sheet.tsx`
(the brief's directory hint was correct once checked).

## SHA-256 (component, unchanged file)

Before first mutation: `04eb931a9ee1c2475b16a9225f59c8fb7f4f14ce1e98ee1bfe67d0142692b95e`
After third mutation restored: `04eb931a9ee1c2475b16a9225f59c8fb7f4f14ce1e98ee1bfe67d0142692b95e`
— match. `git status --porcelain` on the component was empty after every restore.

Restore method: `git show HEAD:<path>` captured the exact original bytes once
(text-mode Python round-tripping had silently reintroduced CRLF on the first
restore attempt, which `git diff --shortstat` showed as an empty diff but
`sha256sum` caught as a real mismatch — fixed by copying the `git show` output
back with `cp`, not by re-writing in Python text mode).

## Coverage

The ordering/containment loop runs over **5 group containers** (`ward-daily-sheet-in`,
`-out`, `-stuck`, `-overdue`, `-no-date`), each checked on two axes
(FOLLOWING and NOT CONTAINED_BY) via `expect.soft`. The heading count is pinned
exactly at 5, in the same test as the loop, both queried with throwing
(`getAllBy*`) calls commented as load-bearing.

## Three mandatory mutation proofs (verbatim)

**1. Nest the away line inside the last group's body** (added a transient
`trailingContent` slot to `SheetGroup`, moved the away `<p>` into the last
`SheetGroup` call):

```
AssertionError: expected true to be false // Object.is equality
- Expected: false
+ Received: true
 ❯ assertAfterAndNotNestedIn tests/ward-daily-sheet-placement.dom.test.tsx:54:72
 Tests  1 failed (1)
```

**2. Move the away line above the whole groups block:**

```
AssertionError: expected false to be true // Object.is equality
- Expected: true
+ Received: false
 ❯ assertAfterAndNotNestedIn tests/ward-daily-sheet-placement.dom.test.tsx:53:69
 (5 FOLLOWING failures, one per group container)
 Tests  1 failed (1)
```

**3. Make the component render no group headings** (every `<h3>` → `<div>`,
in `SheetGroup` and both inline "Who came in"/"Who is going" headings):

```
TestingLibraryElementError: Unable to find an accessible element with the role "heading" and level "3"
Here are the accessible roles: ... [full DOM dump with zero heading-role elements] ...
 ❯ Object.getElementError .../@testing-library/dom/dist/config.js:37:19
 ❯ tests/ward-daily-sheet-placement.dom.test.tsx:66:36
 Tests  1 failed (1)
```

Note: with zero headings the throwing `getAllByRole` query fires before the
`toBe(5)` line is reached, so the failure is the query's own exception rather
than a bare numeric diff — but it fails in the exact statement that is the
count pin, and the dumped DOM makes the zero-count visible. This is a stronger
failure than the old floor check, not a weaker one.

## Restructuring

Merged the two `it` blocks into one. The old split put the non-vacuity guard
in a separate test with its own `render()` from the loop it was meant to
protect (fault 3) — sharing nothing but the `describe`. One test, one render,
guard assertions immediately above the loop, is the only structure that
actually links the guard to what it guards.

## What changed, one line each

1. Loop now iterates **group containers** (`data-testid` sections), not headings.
2. Each iteration checks `DOCUMENT_POSITION_FOLLOWING` **and** the absence of
   `DOCUMENT_POSITION_CONTAINED_BY` — a helper `assertAfterAndNotNestedIn`,
   documented with the exact bitmask math (20 = FOLLOWING | CONTAINED_BY for
   a descendant).
3. Heading count pinned `toBe(5)`, not `toBeGreaterThan(0)`.
4. Guard and loop live in one test, guard first.
5. Both throwing queries (`getAllByRole`, `getAllByTestId`) carry a comment on
   the query line stating they are load-bearing and must not become `queryAll*`.
6. `expect.soft` used inside the loop; array length (`groupContainers.length`)
   asserted before the loop.

Only `tests/ward-daily-sheet-placement.dom.test.tsx` was edited.
`tests/ward-daily-sheet.dom.test.tsx` was read only, not modified, and still
passes (ran as part of the 49).
