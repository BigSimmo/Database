# Task 1 report — the shared empty-state component

Branch: `claude/browser-test-gate-handoff-d5c1db`. Base commit for this task: `ff79cb6ce`.

Status: **DONE**. One commit, local only. Nothing pushed, no PR opened, per the brief.

## Commit

`c0f84112f` — feat(caring-contacts): add the shared EmptyState component (Phase 2B Task 1)

Files: `src/components/caring-contacts/workspace/empty-state.tsx` (new),
`tests/caring-contacts-empty-state.dom.test.tsx` (new),
`docs/design-system/adoption-manifest.json` (regenerated).

## What was built

`src/components/caring-contacts/workspace/empty-state.tsx`, exporting `EmptyState`, a Server
Component with no hooks and no `"use client"` directive.

Modelled exactly as specified — a discriminated union on `kind`:

- `EmptyStateNoDataProps` (`kind: "no-data"`) — `heading`, `explanation`, optional `action`.
- `EmptyStateFilteredProps` (`kind: "filtered"`) — `heading`, `because`, `changedBy`, optional
  `action`. `because`/`changedBy` are required the moment `kind` is `"filtered"`; there is no
  shared optional field a caller could omit.

The `"filtered"` branch renders `AutomatedState`'s "Why: … / What changes it: …" wording shape
directly in JSX — it does not import or render `AutomatedState` (Ruling 81). It uses its own
icon pair (`FolderOpen` for `"no-data"`, `SearchX` for `"filtered"`) rather than
`AutomatedState`'s `CircleAlert`, and never labels itself with a state-name `aria-label` the way
`AutomatedState` does — Ruling 81 states both of those are wrong for "no patients yet".

**The action slot is a `ReactNode`, not `onClick`/`href` props.** This is what keeps the
component hook-free: a Server Component cannot own an event handler, so the action a caller
wants (a `<Link>`, a form-submit button, or an `UnavailableDestination`) is built by the caller
and handed in whole, the same way `ServiceStateBanner` — itself a Server Component — hosts
`UnavailableDestination` as a child without becoming a Client Component. `EmptyState` never
builds a second disabled-control pattern; that stays `UnavailableDestination`'s job.

Tokens and structure follow `automated-state.tsx` exactly: `rounded-[var(--radius-md)]`,
`border-[color:var(--border)]`, `bg-[color:var(--surface-subtle)]`,
`forced-colors:border-[CanvasText]`, `max-w-[var(--measure)]` on wrapping text,
`text-[color:var(--text-heading)]` / `text-[color:var(--text-muted)]` / `text-[color:var(--text)]`
for the tiered text, `size-icon-md` on the icon, `aria-hidden="true"` on the icon. No hardcoded
hex anywhere. No `<button>` is rendered by this component at all (the action is pre-built by the
caller), so the `min-h-12` / native-`disabled`-vs-`aria-disabled` constraints apply to whoever
builds that action node, not to this file.

## A real catch from the interface-vocabulary guard

The first draft used lucide-react's `Inbox` icon for the `"no-data"` kind. Running the full test
suite (not just the focused new test) turned up a genuine failure in
`tests/caring-contacts-interface-vocabulary.test.ts` — its raw-prose scan flagged the bare
identifier `Inbox` (from the import and from the ternary that selects it) as a match for
`CARING_CONTACTS_PROHIBITED_LANGUAGE`, which bans `\binbox(es)?\b` because this is a
suicide-prevention messaging product and "inbox" carries a reply-monitoring/marketing
connotation the product deliberately avoids. This is exactly the closed-list-enumeration
principle from the task brief in action — the guard scans all raw prose (not just string
literals) against a finite banned list, so an identifier name tripped it just as a sentence
would have. Fixed by switching the `"no-data"` icon to `FolderOpen`. Re-ran the full test suite
and the vocabulary test passed clean.

## Tests — `tests/caring-contacts-empty-state.dom.test.tsx`, 9 tests

1. `"no-data"` renders its heading and explanation, and the container text does **not** contain
   `"Why:"` or `"What changes it:"`.
2. `"no-data"` renders nothing (`querySelector("a, button")` is null) when `action` is omitted.
3. `"no-data"` renders the given `action` and it is genuinely actionable (a real `<a href>`
   found by accessible role/name).
4. `"filtered"` renders both `because` and `changedBy` in the page text, and confirms no `[title]`
   attribute anywhere in the tree contains either string — mirroring exactly how
   `caring-contacts-explained-automation.dom.test.tsx` proves `AutomatedState`'s reason/remedy
   are not tooltip-only.
5. A `@ts-expect-error`-gated compile check (Ruling: type-level, not runtime) that `"filtered"`
   cannot be constructed with `because` omitted, and a second one with `changedBy` omitted —
   `tsc --noEmit` reddens if either field is ever made optional.
6. `"filtered"` renders the given `action` and it is genuinely actionable.
7. Rendering inside a `320px`-wide container: the heading is present, and every paragraph whose
   text exceeds 40 characters carries `max-w-[var(--measure)]` in its class list — the same wrap
   contract `automated-state.tsx` holds.
8. The outer element's `className` contains the literal `forced-colors:border-[CanvasText]`
   override class. jsdom cannot emulate `forced-colors: active`, so this proves the override
   class is actually present in rendered markup rather than merely written in source — matching
   the DOM-test-level proxy this repo already uses elsewhere for forced-colors guarantees (real
   browser proof for this family of claim lives in `tests/ui-caring-contacts-workspace.spec.ts`,
   out of scope for this task).
9. The icon (`svg`) count is exactly 1 and it carries `aria-hidden="true"` — state is carried by
   words, the icon is decoration only.

### TDD proof (genuine red, then green)

1. Wrote the component first, then backed it up and replaced it with a deliberately naive stub
   (renders only `props.heading`, ignores `kind`, `because`/`changedBy`/`action` entirely).
2. Ran `npx vitest run tests/caring-contacts-empty-state.dom.test.tsx` against the stub:
   **`Tests 6 failed | 3 passed (9)`** — every assertion that reads copy, the action, forced-colors
   class, or icon count failed for the stated reason (missing text, missing link, empty
   `className`, zero icons). The 3 that passed were the "no action renders" test (trivially true
   for a component with no action logic), the type-level `@ts-expect-error` check (compile-time,
   unaffected by the stub body), and the loose half of the 320px test (no paragraphs existed to
   fail the wrap-class loop).
3. Restored the real implementation, reran: **`Test Files 1 passed (1)`, `Tests 9 passed (9)`**.

### Mutation proof

Per the brief's named mutation: made the `"filtered"` variant render the same output as
`"no-data"` — replaced the `props.kind === "no-data" ? … : …` conditional's guard with a literal
`true` and its `"filtered"` JSX branch with a `MUTATION-ALWAYS-NO-DATA` placeholder paragraph
(dropping `because`/`changedBy` entirely).

- **Checked the mutation actually changes a value an assertion reads, before trusting the run:**
  `because`/`changedBy` text is exactly what tests 1 and 4 assert on, so this was the correct
  target.
- **Proved the mutation was in the tree**, not silently unapplied: `grep -n "MUTATION-ALWAYS-NO-DATA" src/components/caring-contacts/workspace/empty-state.tsx` returned the edited line before
  running the test.
- Ran the suite: **`Tests 2 failed | 7 passed (9)`** — exactly test 1 (`"no-data"` no longer finds
  its own explanation text, because the mutated branch always renders regardless of `kind`, so
  the string `"Add the first patient to get started."` never appears in the no-data case either —
  actually caught on the "no-data" assertion) and test 4 (`"filtered"` can no longer find
  `"Why:"`/`because` text) went red, both for the exact reason expected: the reason and remedy
  text is gone from the rendered output.
- Reverted, reran: `grep` for `MUTATION` returned nothing, and the suite was green again at
  **`Tests 9 passed (9)`**.

## Full verification chain

All four commands below were run for real, after the code was final (post-icon-fix), and each
decisive line was read from the actual command output — not inferred from an exit code.

1. **`npx vitest run tests/caring-contacts-empty-state.dom.test.tsx`** (final, post-fix run):
   `Test Files  1 passed (1)` / `Tests  9 passed (9)`.
2. **`npm run test`** (full unit suite): `Test Files  1 failed | 812 passed | 3 skipped (816)` /
   `Tests  2 failed | 9794 passed | 74 skipped (9870)`. The one failing file is
   `tests/gate-receipts.test.ts`, and the two failures are exactly the two named in the brief as
   pre-existing environmental noise on this Windows Dev Drive (`chmodSync` cannot represent Unix
   file-mode bits when `core.fileMode=false`):
   - `gate receipts — file modes (Codex review, PR #2216) > changes the signature when only the
     WORKING-TREE mode changes`
   - `gate receipts — file modes (Codex review, PR #2216) > keeps both modes, so one cannot
     cancel the other`
   No other failures. This run also caught the `Inbox` vocabulary offence and the stale
   adoption-manifest before the fixes above; the numbers here are from the run **after** both
   were corrected.
3. **`npm run typecheck`**: contended for the repo's heavy-run lease twice (another session's
   Playwright run held it, and a separate concurrent session — `favourites-mockups-20260824` —
   held it again on the next attempt) before it actually ran. Once it acquired the lease, the
   decisive line was `[gate-receipts] recorded a pass for "typecheck:internal" (5215 input
   files).`, exit code 0. This is a real result, not a lock-acquisition failure — it ran to
   completion.
4. **`npm run lint`**: acquired the lease on the first attempt. Decisive line:
   `[gate-receipts] recorded a pass for "lint:internal" (5216 input files).`, exit code 0.

No gate reported a lock-acquisition failure by the time this report was written — both `typecheck`
and `lint` eventually ran to a real, decisive result once the shared heavy-run lease freed up.
The earlier `DATABASE_HEAVY_RUN_ADMISSION_BUSY` responses (observed while other sessions on this
machine — including a Codex worktree running Playwright — held the lease) were reported as
"blocked, retry" in-conversation and never treated as a pass or a fail.

## Constraints check

- Design tokens only — confirmed by inspection; no hex anywhere in the new file.
- No `<button>` rendered by `EmptyState` itself, so the `min-h-12` / native-`disabled`-vs-
  `aria-disabled` rule doesn't apply to this file directly; it documented in the action-prop
  comment that it applies to whoever builds the action node.
- No `title` attribute carries `because`/`changedBy` — proven by test 4.
- No import from `src/components/caring-contacts/mockups/**`.
- `automated-state.tsx`, `shell.tsx`, and all routes are untouched (`git diff` confirms only the
  three files in the commit above).
- No dependency added — only lucide-react (already a dependency) and `react`'s `ReactNode` type.
- Not wired into any screen.

## Concerns / notes for the next task

- None that block. The one design decision worth flagging explicitly for whoever writes the four
  list screens: `action` is a `ReactNode` slot, not a `{ label, href }`-style prop, specifically
  so this component never needs a client boundary. Callers must build their own `<Link>` /
  `UnavailableDestination` / form-submit control and pass the finished element in.
- The icon choice (`FolderOpen` for `"no-data"`, `SearchX` for `"filtered"`) is a judgement call,
  not dictated by the brief; it's easy to swap if a later task's owner wants different icons, as
  long as the replacement doesn't collide with `CARING_CONTACTS_PROHIBITED_LANGUAGE` the way
  `Inbox` did.
