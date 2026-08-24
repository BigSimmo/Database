# Task 3 report — the overlay trigger, and the commit contract that shipped with it

**Branch** `claude/browser-test-gate-handoff-d5c1db`, base `f65dd39d3`.
**Status: DONE.** Gates below.

---

## 1. The architectural decision, and what was rejected

This is the part of the task that carried a real choice, so it is first.

### The problem

`WorkspaceOverlays` is mounted **once, by the shell**, as a **sibling** of `children`. A screen's
confirm behaviour therefore has no shared parent with the host and no prop path to it.

A second constraint narrows the space much further than the brief's framing implies, and it is the
one that decided the shape: **the screens are Server Components.** A Server Component cannot pass a
closure to a Client Component at all — props crossing that boundary must be serialisable (Next 16,
"Server and Client Components"). So "the screen's commit handler" can never be an arbitrary
callback the screen wrote. It can only be a serialisable value, or a Server Action reference.

That is why `WorkspaceOverlayCommit` is a **discriminated union of intents**, not a function type:

```ts
export type WorkspaceOverlayCommit =
  | { readonly kind: "record"; readonly record: (overlayId: string) => void }
  | { readonly kind: "unavailable"; readonly reason: string };
```

`record` is a function _position_, satisfied from a Server Component by a Server Action and from a
Client Component by an ordinary function. `unavailable` is plain data. Both are required members of
a required prop — there is no default, no optional prop, and no no-op member.

### The choice: a single-slot handoff, written at the moment of opening

**An overlay opening carries its commit with it.** `openWorkspaceOverlayWithCommit(id, commit)`
stages the commit in a module-scoped slot and then pushes `?overlay=<id>`. `WorkspaceOverlays`
subscribes to that slot with `useSyncExternalStore` — the same mechanism it already uses for the
URL — and uses the staged commit **only while the staged id and the URL's id are the same overlay**.

Both writes are synchronous, so the host's first render carrying the new id already carries its
commit; there is no frame where the overlay is open with nothing staged.

### What was rejected, and why

Each of these is also written into `overlay-commits.ts` itself, not only here.

**A React context provider — rejected as structurally impossible, not merely costly.** Two
independent reasons, either sufficient: the screen is a Server Component, so it cannot render a
provider or hold context state at all; and `WorkspaceOverlays` is a _sibling_ of `children` in the
shell, so a provider rendered inside a screen would not contain the host even if a screen could
render one. Making context work would mean a new client boundary wrapping the whole workspace —
against Ruling 13, which holds this route's client payload to a rounding error — **and the trigger
would still have to write the commit into it on activation**, which is this module's job with more
payload attached.

**A per-screen host — rejected.** It duplicates the renderer the shell deliberately mounts once.
The shell's own comment gives the reason: the interaction matrix is a workspace-wide contract, and
a screen that forgot to mount the host would lose the session gate and the offline notice with it.
Two hosts would also mean two subscribers to one `?overlay=` parameter both rendering the same
overlay, and `tests/ui-caring-contacts-workspace.spec.ts` asserts single occupancy of the overlay
content node (`toHaveCount(1)`) throughout.

**A registry keyed by overlay id, written on mount — rejected, and this is the one worth reading.**
It is the obvious way to close the "a second registration silently overwrites the first" hole the
brief named, and I built the argument for it before finding what kills it: **a list screen may
render ten `Pause` triggers, one per row.** All ten would claim the same key, and every resolution
is worse than not having the problem — throw on the second registration and a legitimate screen
cannot be built; last-write-wins and the silent-overwrite failure is back unchanged; compare
handlers by identity and an inline arrow re-registers on every render. Staging at the **moment of
activation** has no conflict to resolve at all, because exactly one control was activated.

### The cost this design carries, stated rather than hidden

Module-scoped mutable state is invisible coupling: nothing in a screen's source shows that
activating a trigger writes into a module. Two things pay that back, and both are load-bearing:

1. **The identity check** (`commitForOpenOverlay`). A commit staged for one overlay is never
   offered to a different one, so a stale slot cannot be mistaken for a wired control.
2. **`commitUnavailableReasonFor` is total.** Every state of the slot maps to an answer and two of
   the three are a refusal in plain words.

### The decision with the largest blast radius — flagged deliberately

Point 2 has a consequence beyond what the brief asked for, and a reviewer should look at it
directly rather than take it as incidental.

**An overlay open with nothing staged for it now refuses its own action, with a stated reason.**
That covers a typed or pasted `?overlay=<id>`, a forward traversal into an overlay whose commit was
spent, and any slot/URL mismatch. Because no screen renders a trigger yet, **this is currently the
behaviour of all 24 overlays in the shipped workspace** — every deep-linked overlay's confirm
control is now `aria-disabled="true"` with `NO_STAGED_COMMIT_REASON` rendered as reachable text.

I judged this required rather than optional. The clause that made a record-nothing `commit`
acceptable was _"nothing in the workspace opens an overlay yet … so no control in the interface
currently advertises an action this does not perform."_ A deep-linked overlay's confirm button is
such a control, and it does not stop being one because the overlay was reached by URL rather than
by a click. Leaving it live would have meant writing a fresh justification for the exact defect
Ruling 87 exists to prevent.

The conservative direction was also checked: refusing degrades to _stating what cannot be done_,
never to silently doing nothing.

**If the owner disagrees, the reversal is two lines** — make `WorkspaceOverlays` pass
`commitUnavailableReason={commit === null ? null : commitUnavailableReasonFor(commit)}` — and the
covering test ("refuses an overlay reached by address rather than from a control") names it.

---

## 2. What was built

| File                                                                       | What                                                                                                                                                                    |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/caring-contacts/workspace/overlays/overlay-commits.ts`     | **New.** `WorkspaceOverlayCommit`, the single-slot handoff store, `commitForOpenOverlay`, the total `commitUnavailableReasonFor`, and the rejected-alternatives record. |
| `src/components/caring-contacts/workspace/overlays/overlay-trigger.tsx`    | **New.** `WorkspaceOverlayTrigger` — the client control, with `commit` required.                                                                                        |
| `src/components/caring-contacts/workspace/overlays/workspace-overlays.tsx` | `openWorkspaceOverlayWithCommit`; the record-nothing `commit` replaced by `recordDecision`; the slot subscription; `commitUnavailableReason` passed to the host.        |
| `src/components/caring-contacts/workspace/overlays/overlay-host.tsx`       | New **required** prop `commitUnavailableReason: string \| null`, folded into the existing refusal path.                                                                 |
| `tests/caring-contacts-overlay-trigger.dom.test.tsx`                       | **New.** 12 tests.                                                                                                                                                      |
| `tests/caring-contacts-overlay-host.dom.test.tsx`                          | 11 existing `OverlayHost` call sites given `commitUnavailableReason={null}`. **No assertion changed, weakened or removed.**                                             |
| `tests/caring-contacts-explained-automation.dom.test.tsx`                  | `overlays/overlay-trigger.tsx` added to `ALLOWED_CLIENT_COMPONENTS` with its three-condition justification.                                                             |

`definitions.ts` and `docs/caring-contacts/interaction-matrix.md` are untouched, as required.

### The type-level requirement, and its exact signature

```ts
export type WorkspaceOverlayTriggerProps = {
  overlayId: string;
  commit: WorkspaceOverlayCommit; // required — no default, no no-op member
  children: ReactNode;
  className?: string;
};
```

This repo already has a pattern for proving a required prop (`caring-contacts-empty-state`,
`caring-contacts-explained-automation`), so it is proved rather than asserted: a `@ts-expect-error`
render in the test file, which **fails `tsc --noEmit`** the moment the error stops being raised.
Mutation M1 below shows it doing exactly that.

### Two behaviours worth naming

**An unknown overlay id throws at render, in every environment.** `overlayDefinition` returns null
for an id no row carries, so without the throw the trigger becomes a button that opens an empty
overlay — the silent form of the defect the whole contract forbids. The throw lands on
`src/app/caring-contacts/error.tsx`, which says plainly that nothing was sent and nothing was
changed. This follows `blockReasonWording`'s existing every-environment policy rather than
inventing a second one. At render, not on click, so a mistyped id cannot ship waiting for a
clinician to find it.

**The trigger itself is always live, even when its commit is `unavailable`.** The `aria-disabled`
shape belongs on the _overlay's confirm control_, which is what the commit handler backs. Opening a
decision surface that then states in plain words what cannot be recorded yet tells the clinician
more than a dead button on the screen behind it. A screen with no overlay to raise at all should
still render `UnavailableDestination`.

### Constraints held

- **Incident `note` boundary:** `overlay-commits.ts` and `overlay-trigger.tsx` name neither the
  service-state module nor its type, and the allowlist's companion guard walks the whole module
  graph reachable from the trigger and proves it. The trigger's props are an id, a class name,
  children, and an intent union — no state object.
- **Tap target:** `min-h-tap` (`--spacing-tap`, 3rem = 48px), the design system's one knob. Never
  `min-h-11`. Pinned by its own test.
- **Never both `disabled` and `aria-disabled`:** the refused action carries `aria-disabled="true"`
  only; asserted directly.
- **Design tokens only**, no hex; the reason is reachable via `aria-describedby`, never a `title`.
- **No import from `mockups/**`.**

---

## 3. Mutation proof

Every mutation was applied with a script that **asserts the original text exists before replacing
it**, and the mutated line was grepped out of the file and printed before the gate ran. Each was
reverted with `git checkout --` before the next.

| #   | Mutation (file, exact change)                                                                                 | Result                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | `overlay-trigger.tsx`: `commit: WorkspaceOverlayCommit` → `commit?: WorkspaceOverlayCommit`                   | `tsc` red: `tests/caring-contacts-overlay-trigger.dom.test.tsx(107,7): error TS2578: Unused '@ts-expect-error' directive.` plus `TS2345` at the call site. Baseline `tsc` on the same tree: exit 0, no output. |
| M2  | `overlay-trigger.tsx`: `if (overlayDefinition(overlayId) === null)` → `if (false as boolean)`                 | `Tests 1 failed \| 11 passed (12)` — "fails loudly for an id the frozen table does not carry".                                                                                                                 |
| M3  | `workspace-overlays.tsx`: `stageWorkspaceOverlayCommit(id, commit);` → `void commit;`                         | `Tests 4 failed \| 8 passed (12)` — the record path, the checkpoint path, and both unavailable paths.                                                                                                          |
| M4  | `overlay-commits.ts`: `if (commit === null) return NO_STAGED_COMMIT_REASON;` → `return null;`                 | `Tests 2 failed \| 10 passed (12)` — "refuses an overlay reached by address" and the totality test.                                                                                                            |
| M5  | `overlay-host.tsx`: refusal ternary's else branch `commitUnavailableReason` → `null`                          | `Tests 3 failed \| 23 passed (26)` — the unavailable shape, the read-only row, and the by-address refusal.                                                                                                     |
| M6  | `overlay-commits.ts`: `return slot.overlayId === openOverlayId ? slot.commit : null;` → `return slot.commit;` | `Tests 1 failed \| 11 passed (12)` — "never offers one overlay's staged commit to another".                                                                                                                    |

**A lock incident during M4, reported because it is exactly the trap the brief names.** The first
M4 run produced **no summary line at all** — the run had not happened. The output was
`Error: Database focused-test capacity is full (current owner PID 73752, worktree
D:\Worktrees\Database\dev-hub-phase-1)`. My first attempt filtered that away with `grep -E "FAIL|Tests "`
and would have shown a clean-looking empty result. It was retried on a bounded loop and acquired
the lease on the second attempt; the row above is the real run.

---

## 4. Gates

All four gates ran for real — each one carries its own summary line, and none is quoted from an
exit code.

**Full unit suite** — `npm run test`, after a ~5 minute wait for the exclusive heavy-run lease:

```
 Test Files  1 failed | 813 passed | 3 skipped (817)
      Tests  2 failed | 9808 passed | 74 skipped (9884)
   Duration  373.61s
```

The two failures are **exactly** the known environmental pair the brief names — both in
`tests/gate-receipts.test.ts > gate receipts — file modes (Codex review, PR #2216)`, both failing at
`chmodSync` because this Windows drive cannot represent Unix file modes:

```
AssertionError: expected '266c7353fd49d41fab93e1b15cba66ec148f4…' not to be '266c7353fd49d41fab93e1b15cba66ec148f4…'
AssertionError: expected 2 to be 3
```

**No others.** Nothing in the caring-contacts surface, nothing in the design-system adoption
manifest, nothing in route reachability, and nothing in the interface-vocabulary scan.

**Typecheck** — `npm run typecheck`, a fresh run through the heavy-run wrapper, no errors emitted:

```
> node ./node_modules/typescript/bin/tsc -p tsconfig.typecheck.json --noEmit …
[gate-receipts] recorded a pass for "typecheck:internal" (5222 input files).
```

**Lint** — `npm run lint`, `--max-warnings 0`, no errors emitted:

```
> eslint src tests scripts worker supabase playwright … --max-warnings 0 …
[gate-receipts] recorded a pass for "lint:internal" (5222 input files).
```

**Format** — `prettier --write` on all seven changed files before the second commit.

### The gate that did NOT run

**`npm run verify:ui` / `tests/ui-caring-contacts-workspace.spec.ts` was not run.** It needs a dev
server and the exclusive Playwright lease, and it is outside the gates the brief listed. Two things
in it were read closely instead:

- _"returns focus to the control an overlay was opened from"_ — **unaffected**. It stands its opener
  in with the shell's `New plan` control and pushes the parameter itself via `page.evaluate`. That
  control is untouched, the host's `openedFromRef` capture is untouched, and the Sheet's focus
  return is untouched. Escape still closes a dismissible overlay whether or not its action is
  refused.
- _the 24-overlay matrix test_ — **the one place my change is visible to it**. Every deep-linked
  overlay now renders one extra short refusal paragraph. The assertions it could touch are
  `toBeInViewport({ ratio: 1 })` on the action and `expectFullyOnScreen`'s bottom-edge bound, both
  against a 900px-tall viewport. Overlay content is a heading, a summary line and an action row, so
  one added sentence has a wide margin — but I have **not** measured it, and say so plainly rather
  than implying I did.

---

## 5. Concerns

1. **The deep-link refusal is the decision to review first.** It is written up in §1 under "the
   decision with the largest blast radius". I believe it is required by Ruling 87 rather than
   optional, but it changes what all 24 overlays do today, and it is the one judgement here I would
   want an owner to agree with rather than inherit. The reversal is two lines and the covering test
   names it.

2. **The Playwright spec was not run** (above). Low risk, unmeasured, and I would rather it were
   measured before this is treated as proven in a browser.

3. **A failed asynchronous record has no policy yet, deliberately.** `record` is typed
   `(overlayId: string) => void`, which accepts a Server Action (TypeScript's `void`-return rule),
   and the host does not await it. What a failed write should do to the interface — hold the overlay
   open, say what was not written, offer a retry — needs a real store and a real screen to answer,
   and neither exists. Inventing that now would be behaviour nobody reviewed against a live surface.
   **The task that introduces the first store must decide it**, and the comment on `record` says so.
   This is a stated gap, not an oversight.

4. **The `record` variant has no production consumer yet.** Every Phase 2B screen will pass
   `{ kind: "unavailable", reason }` until the stores exist. `record` is covered by DOM tests with a
   spy, including through the fresh-authentication checkpoint, but it has never run against a real
   Server Action across a real Server → Client boundary. The assignability claim is a TypeScript
   fact I am confident in; the end-to-end behaviour is untested and should not be described as
   proven.

5. **Module-scoped state is still module-scoped state.** The identity check and the total refusal
   function bound its failure modes, but a screen's source does not show that activating a trigger
   writes into a module. If a reviewer prefers the coupling to be visible in the tree, the honest
   alternative is to move the host into a client boundary wrapping the whole workspace and use
   context — which costs Ruling 13's payload budget. I judged that trade the wrong way round; it is
   a legitimate place to disagree.

6. **Nothing renders a trigger yet.** Task 3 ships the control and the contract; no screen uses
   either. The first screen to adopt it is where the ergonomics get tested, and it may find the
   `commit` prop wants to travel differently (per row, per action) than a single prop allows.
