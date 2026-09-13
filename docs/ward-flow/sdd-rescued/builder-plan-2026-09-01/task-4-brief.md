## Task 4 — Name the invariant holding transport's terminal states apart

**Why.** `ward-model.ts:356-358` declares `collectedAt`, `arrivedAt` and `cancelledAt` as three
independent optionals, so a hand-built object can carry a cancelled job that also arrived. **Nothing
in the reducer can produce one** — `closure` is doing the mutual exclusion, because both terminal
transitions set it and each refuses a movement that already has one.

You measured this and recommended a comment over a refactor. Agreed, and your own argument is why:
**`closure` is a load-bearing invariant that nothing states in the type**, so a future writer adding
a fourth terminal transition would not know to set it.

**Steps.** A comment at `ward-model.ts:356` naming `closure` as the invariant, the reducer lines that
enforce it, and what a fourth terminal transition must do. Documentation only.

**Check.** Typecheck clean.

## Already done — do NOT build these

- **The `ward-sites.ts` warning that the 23 authored `held` values are read by nothing** — landed at
  `30d2fda99`, at both the declaration and the authoring site. It is on your list of five; it is done.
  **This is the seventeenth item today that a plan claimed was outstanding and the code showed was
  finished.**
