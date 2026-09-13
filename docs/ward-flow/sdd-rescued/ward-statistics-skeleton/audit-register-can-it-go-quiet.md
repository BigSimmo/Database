# Can the statistics claims register go quiet? — disappearance-route audit

**Files read:** `src/components/ward-management/statistics/statistics-claims-register.ts` (2042
lines, `MODEL_CLAIMS` = 85 entries, `UNEVIDENCED_CLAIMS` = 13 entries, `REGISTERED_SURFACES` = 9
entries), `tests/ward-statistics-claims.test.ts` (695 lines). Read only; nothing edited, nothing
run.

## The load-bearing guard

Before any iteration, the very first `it` in the file pins all three collection sizes as **exact**
values, not floors:

```ts
const EXPECTED_MODEL_CLAIMS = 85;
const EXPECTED_UNEVIDENCED_CLAIMS = 13;
const EXPECTED_REGISTERED_SURFACES = 9;
...
expect(MODEL_CLAIMS.length, "...").toBe(EXPECTED_MODEL_CLAIMS);
expect(UNEVIDENCED_CLAIMS.length, "...").toBe(EXPECTED_UNEVIDENCED_CLAIMS);
expect(REGISTERED_SURFACES.length, "...").toBe(EXPECTED_REGISTERED_SURFACES);
```

This is `.toBe`, not `.toBeGreaterThan`/`.toBeGreaterThanOrEqual`. It runs unconditionally, first,
regardless of what any later `for (const claim of ...)` loop finds. The file's own comment (lines
14–20) records that this used to be `>= 40` against 74 claims — a floor — and was deliberately
replaced after the same failure mode being audited here.

## The eight scenarios

1. **`sourceFile` emptied to zero bytes.** RED. `countOccurrences("", evidence)` = 0 →
   `if (occurrences === 0) { problems.push("ITS EVIDENCE IS GONE...") }` in "finds every claim's
   evidence in its source file, exactly once" (line 591). Also RED earlier via `falsifiabilityProblem`
   returning `"anchor-missing"`.

2. **`sourceFile` deleted entirely.** RED. `readRepoFile` calls `readFileSync` with no try/catch;
   the ENOENT throw is uncaught inside the `it("makes every claim falsifiable...")` callback (which
   calls `readRepoFile(claim.sourceFile)` at line 551, executed before the dedicated disk check),
   so Vitest fails that test on the exception. The later, cleaner check also fires independently:
   `expect(existsSync(...), "...is not on disk...").toBe(true)` (line 568–572).

3. **`MODEL_CLAIMS` emptied to `[]`.** RED, immediately. `expect(MODEL_CLAIMS.length, ...).toBe(85)`
   — 0 ≠ 85. Exact pin, not a floor of zero.

4. **A single claim deleted (84 of 85).** RED. Same assertion, 84 ≠ 85. The exact pin catches a
   single missing entry, not only a wholesale emptying.

5. **`REGISTERED_SURFACES` emptied.** RED overall: `expect(REGISTERED_SURFACES.length, ...).toBe(9)`
   fails at 0 ≠ 9, in the same first test, before any loop runs. Note the secondary guard,
   `it("leaves no registered surface with nothing recorded against it")`, _is_ vacuous in isolation —
   `REGISTERED_SURFACES.filter(...)` over `[]` yields `[]`, and `expect([]).toEqual([])` passes doing
   nothing. That loop-only check would go quiet on its own; the exact-count test upstream is what
   actually prevents silence here.

6. **`UNEVIDENCED_CLAIMS` emptied.** RED, same mechanism: `expect(UNEVIDENCED_CLAIMS.length, ...).toBe(13)`,
   0 ≠ 13. `it("gives every unpinnable claim a distinct id...")` is likewise vacuous in isolation
   (`for (const claim of UNEVIDENCED_CLAIMS)` over `[]` runs zero times) but is preempted by the count.

7. **A `falsifiedBy.find` stops appearing.** RED, and named. `falsifiabilityProblem` distinguishes
   this case explicitly: `if (anchors === 0) return "anchor-missing";` (line 205) — it does **not**
   fall through to a generic "expected absent" failure. The reported message leads with
   `name(claim)` (id + claim text + surface) and the curated explanation "ITS FALSIFYING EDIT NO
   LONGER APPLIES..." (line 528), plus the cited fragment and the edit pair.

8. **Claim discovery.** Direct iteration: `for (const claim of MODEL_CLAIMS)` / `UNEVIDENCED_CLAIMS`
   /`REGISTERED_SURFACES`, no dynamic lookup. In isolation these loops are the classic empty-loop
   silent-pass shape — but scenario 3/5/6's exact-count test runs first in file order and fails
   before any of them would matter, so the shape is preempted, not absent.

## Count-pinning assertions found

| Assertion                                          | Kind  | Value                                              |
| -------------------------------------------------- | ----- | -------------------------------------------------- |
| `MODEL_CLAIMS.length`                              | exact | 85                                                 |
| `UNEVIDENCED_CLAIMS.length`                        | exact | 13                                                 |
| `REGISTERED_SURFACES.length`                       | exact | 9                                                  |
| `evidence`/`rendered` fragment length              | floor | ≥12 chars (string quality, not a collection count) |
| `claim.claim` text length                          | floor | >20 chars                                          |
| `falsifiedBy.change` / unevidenced `reason` length | floor | >40 chars                                          |

No collection-size assertion anywhere in the file uses a floor (e.g. `toBeGreaterThan(0)`); the
only floors present bound string length, not non-emptiness.

## Verdict

**0 of 8 scenarios go quiet.** Every disappearance route lands on the exact, unconditional count
pin in the register's first test (`MODEL_CLAIMS`/`UNEVIDENCED_CLAIMS`/`REGISTERED_SURFACES` each
`.toBe(...)` an exact literal, run before any iteration), which the file's own history says
replaced a floor precisely to close this class of failure — so no fixture-emptying route here
reproduces the sibling guard's silent pass. Two loop-only checks (surface coverage,
unevidenced-claim shape) are individually vacuous over an empty input, but neither is the only line
of defense: the exact count catches the emptying first in every case examined.
