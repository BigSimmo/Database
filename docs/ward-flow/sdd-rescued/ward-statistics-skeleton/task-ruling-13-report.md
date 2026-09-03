# Task ruling 13 — report

**Status:** DONE. Commit `ba768efcafe5eb9138495c8722e863ef1b6992ae` on branch `claude/ward-builder-community-route`.

**Reader check:** grepped `AWAY_GROUP_PLACEMENT_UNRESOLVED` (identifier and bare string) across
`src/`, `tests/`, `scripts/`, `worker/`. Zero readers found — only the declaration itself (now
deleted) and mentions inside `docs/ward-flow/**` prose. No STOP condition triggered.

**Files changed (exactly two, staged and committed by name, no `git add -A`):**

- `src/components/ward-management/board/ward-daily-sheet.tsx` — deleted `AWAY_GROUP_PLACEMENT_UNRESOLVED`
  and its 16-line comment (component located at this path, not the one named in the task prompt,
  which was slightly stale — actual path confirmed by `find`).
- `tests/ward-daily-sheet-placement.dom.test.tsx` — new file, does not touch
  `tests/ward-daily-sheet.dom.test.tsx`.

**Gate:**

- `npx tsc -p tsconfig.typecheck.json --noEmit` — clean, no output.
- `npx vitest run tests/ward-daily-sheet-placement.dom.test.tsx tests/ward-daily-sheet.dom.test.tsx`
  — **2 test files passed (2), 50 tests RAN, 50 passed.**

**Mandatory red-proof (step 3), verbatim failure output** — captured by temporarily moving the
`<p className={styles.sheetAwayLine}>` block above the `sheetGroups` div and rerunning only the new
file:

```
 ❯ |jsdom| tests/ward-daily-sheet-placement.dom.test.tsx (2 tests | 1 failed) 267ms
     × places the away line after every one of the group headings in the rendered document 41ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  |jsdom| tests/ward-daily-sheet-placement.dom.test.tsx > the daily sheet's away line renders after every group heading > places the away line after every one of the group headings in the rendered document
AssertionError: expected +0 to be truthy

- Expected:
true

+ Received:
0

 ❯ tests/ward-daily-sheet-placement.dom.test.tsx:61:59
     59|       // stuck" / "Who is overdue" / "Nobody has said when they are go…
     60|       const position = heading.compareDocumentPosition(awayLine);
     61|       expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
       |                                                           ^
     62|     }

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)
```

The first test (the non-vacuity guard) still passed in this run, as expected — only the order
assertion went red. The block was then moved back exactly as it was; `git diff` on the component
showed zero lines changed relative to pre-move (before the constant deletion), and the suite went
green again (confirmed above).

**Coverage stated in the return, not only here:** the new file adds two tests — a non-vacuity guard
(away line + at least one heading exist) run before, and the order assertion (away line follows
every group heading via `compareDocumentPosition`) — both proven to distinguish the correct
placement from the wrong one.
