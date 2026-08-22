# Task 18 report — one renderer, twenty-four overlays

Status: complete. All nine rules of `task-18-brief.md` are implemented, the brief's test file is
green, all four required mutations were proved to redden a real assertion, and the full `npm run test`
suite is green.

---

## 1. What was implemented

### `src/components/caring-contacts/workspace/overlays/overlay-host.tsx` (new, `"use client"`)

The single renderer. It reads the frozen table (`./definitions.ts`) and branches on **modality**,
never on an overlay id — there is no `switch (definition.id)` anywhere in the file. The modality
itself is `widthStateFor(viewportWidth) === "compact" ? phoneModality : desktopModality`, using the
shared `widthStateFor` from Task 15; no second `matchMedia` and no second copy of 768 exists.

Structure:

- `useViewportWidth()` — `useSyncExternalStore` over `window.innerWidth` and the `resize` event. Its
  `getServerSnapshot` returns `null`, because no width (and therefore no modality) is knowable on the
  server; the host renders nothing there and the first client render agrees with it.
- `SHEET_GEOMETRY` — a five-row table mapping each Sheet-borne modality to `placement` /
  `mobilePlacement`. Rule 6 verbatim: `fullscreen` for `full-screen-stage`, right-edge geometry for
  `inspection-drawer`, `bottom` otherwise. `session-gate` also takes `fullscreen`, which additionally
  suppresses the Sheet's drag grip — a grip would advertise a swipe-to-dismiss the gate does not
  honour.
- `dismissesOnEscapeOrBackdrop(dismissal)` — handles the two values the matrix expresses and
  **throws** outside production on anything else, degrading to the conservative (non-dismissible)
  answer in production rather than the permissive branch (Ruling 58).
- `OverlayBody` — the one body every overlay renders, whatever surface carries it. It stamps
  `data-overlay-id`, `data-overlay-modality` and `data-overlay-dismissal` on the
  `data-testid="workspace-overlay-content"` element that Task 19 will assert against.
- `StatusBannerSurface` — `createPortal(…, document.body)` with `role="status"`. Not a dialog, takes
  no focus, traps none (rule 4).
- One `<Sheet>` call site serves the other three modalities. `recovery-only` withholds `onClose` from
  the Sheet (so Escape and the backdrop do nothing) and passes no `title` (so the Sheet renders no
  header and therefore no close control) — rule 5, with the recovery action the only control present.

Rule 8 (`requiresFreshAuthentication`, true for exactly `withdrawal` and `reassignment` in the table)
is a single early return in `activate()`: the first activation sets a checkpoint keyed to the overlay
id and commits nothing; the visible checkpoint note appears; the same button becomes
"Confirm and continue" and the second activation calls `onCommit`.

Rule 9 reads `definition.mutatesState` from the table: `blocked = blockReason !== null &&
definition.mutatesState`. A blocked action gets `aria-disabled="true"`, `aria-describedby` pointing at
a **visible** reason paragraph, and `ignoreUnavailableActivation` as its handler (never native
`disabled` — the two attributes together are a lint error). A read-only overlay is never blocked; its
own action stays live.

### `src/components/caring-contacts/workspace/overlays/workspace-overlays.tsx` (new, `"use client"`)

The server/client boundary — see §2.

### `src/components/caring-contacts/workspace/shell.tsx` (modified)

Mounts `<WorkspaceOverlays />` once at the end of the shell, with no props. Two lines plus a comment;
the shell is otherwise untouched and remains a Server Component.

### `tests/caring-contacts-explained-automation.dom.test.tsx` (modified)

The client-boundary guard, widened under Ruling 59 — see §5.

---

## 2. The shape chosen for the server/client boundary

`shell.tsx` is a Server Component and must stay one, and `OverlayHostProps` takes two function props,
which cannot cross a Server → Client boundary. I took the shape suggested in the task: a small client
wrapper, `WorkspaceOverlays`, that owns the open-overlay state and both handlers and renders
`OverlayHost` with the pinned props **unchanged**. `OverlayHostProps` is exactly as briefed. The shell
change is a mount and nothing else.

`WorkspaceOverlays` takes **no props at all**. That is deliberate and is the first of Ruling 59's
three conditions: with no props there is no route by which a safety-stop record could reach the client
boundary.

**One decision the brief did not cover, and where it departs from the obvious spelling.** Rule 7 puts
overlay state in the URL as `?overlay=<id>`. The obvious implementation is `useSearchParams` +
`useRouter`. I used the **native History API** instead (`window.history.pushState`, plus a `popstate`
subscription through `useSyncExternalStore`), for three reasons:

1. Next 16's "Linking and Navigating → Native History API" states that `pushState`/`replaceState`
   "integrate into the Next.js Router" and documents exactly this use — keeping a piece of query state
   in the URL.
2. `useSearchParams` client-renders the whole subtree up to the nearest `<Suspense>` boundary, and a
   statically rendered page that calls it without one **fails the production build**. That would have
   meant adding a Suspense boundary to the shell to buy nothing: overlay state is transient interface
   state no server render ever reads.
3. `useSearchParams` returns `null` without a router context (verified in
   `node_modules/next/dist/client/components/navigation.js`, line 97 onward). Mounting a
   `useSearchParams` consumer in the shell would have required adding a `next/navigation` mock to
   `tests/caring-contacts-workspace-shell.dom.test.tsx` and
   `tests/caring-contacts-explained-automation.dom.test.tsx` — i.e. editing existing tests to
   accommodate my change. The History API needs no context and left both files' assertions untouched.

`pushState` emits no event of its own, so the writer dispatches a named custom event that the
`useSyncExternalStore` subscription also listens for. `popstate` covers Back and Forward, which is the
browser-history support rule 7 asks for.

---

## 3. TDD evidence

### RED

```
$ node scripts/run-vitest.mjs run tests/caring-contacts-overlay-host.dom.test.tsx --reporter=dot

 FAIL  |jsdom| tests/caring-contacts-overlay-host.dom.test.tsx [ tests/caring-contacts-overlay-host.dom.test.tsx ]
Error: Failed to resolve import "@/components/caring-contacts/workspace/overlays/overlay-host" from "tests/caring-contacts-overlay-host.dom.test.tsx". Does the file exist?

 Test Files  1 failed (1)
      Tests  no tests
```

Expected for that exact reason: the test file was written first and `overlay-host.tsx` did not exist,
so the suite could not even collect. This is the weakest possible red — it proves the test runs
against the module under test and nothing else — which is why the four mutations in §4 are the real
evidence.

### GREEN

```
$ node scripts/run-vitest.mjs run tests/caring-contacts-overlay-host.dom.test.tsx --reporter=dot

 Test Files  1 passed (1)
      Tests  6 passed (6)
```

(Later 7 passed (7), after adding the prohibited-vocabulary test described in §8.)

The first test alone covers 48 renders — 24 overlays at two widths — and 144 assertions, since it
checks id, modality and dismissal on each.

### Full suite

```
$ npm run test

 Test Files  701 passed | 2 skipped (703)
      Tests  7769 passed | 29 skipped (7798)
```

(The first full run had one failure — `tests/design-system-adoption.test.ts` — because
`overlay-host.tsx` imports the shared `Sheet` and the generated adoption manifest had not been
regenerated. Fixed with `npm run design-system:adoption:update`; the diff is two file-list entries and
the `Sheet` usage count 25 → 26.)

---

## 4. Mutation evidence — all four

For each: I first confirmed the mutation changes a value an assertion actually reads, then ran, then
reverted.

### Mutation A — always use `desktopModality`

Changes `data-overlay-modality`, which the first test reads. Confirmed non-vacuous by inspection: 13
of the 24 rows have `phoneModality !== desktopModality` (e.g. `verify-identity` is
`full-screen-stage` on a phone and `dialog` on a desktop).

```
 FAIL  … > renders every one of the 24 overlays with its frozen modality at both widths
Error: verify-identity at 390px: expect(element).toHaveAttribute("data-overlay-modality", "full-screen-stage")
Expected the element to have attribute:  data-overlay-modality="full-screen-stage"
Received:                                data-overlay-modality="dialog"
 ❯ tests/caring-contacts-overlay-host.dom.test.tsx:67:56
```

Reverted; re-ran green.

### Mutation B — commit on the first withdrawal activation

Removed the `return` after `setCheckpoint(…)`, so `onCommit` runs on the first click as well. Changes
`onCommit.mock.calls.length`, which the fresh-auth test reads.

```
 FAIL  … > commits a withdrawal only on the second activation
Number of calls: 1
 ❯ tests/caring-contacts-overlay-host.dom.test.tsx:111:26
    111|     expect(onCommit).not.toHaveBeenCalled();
```

Reverted; re-ran green.

### Mutation C — apply `blockReason` to read-only overlays too

`const blocked = blockReason !== null;` (dropping `&& definition.mutatesState`). Changes the
`aria-disabled` attribute of `message-preview`'s action, which the last test reads.

```
 FAIL  … > blocks a mutating overlay with a named reason but leaves a read-only overlay usable
Expected the element not to have attribute:  aria-disabled
Received:                                    aria-disabled="true"
 ❯ tests/caring-contacts-overlay-host.dom.test.tsx:143:32
    143|     expect(readOnlyAction).not.toHaveAttribute("aria-disabled");
```

Reverted; re-ran green.

> **A decorative assertion, reported rather than substituted.** The brief's own final assertion for
> this case is
> `expect(screen.getByRole("button", { name: /close/i })).not.toHaveAttribute("aria-disabled")`. That
> matches the shared **Sheet's** close button, which this renderer never blocks under any value of
> `blockReason` — so mutation C leaves that line green. It is decorative for the behaviour it is
> written next to. I kept it (it is a real, if weak, check that a read-only overlay still has a way
> out) and **added** two assertions that do bite: the read-only overlay's own action
> (`/back to personalisation/i`) is not `aria-disabled`, and clicking it does reach `onCommit`. Line
> 143 above is one of the added ones — the brief's line 139 stays green under the mutation.

### Mutation D (Ruling 59) — a client component that is not on the allowlist

Created `src/components/caring-contacts/workspace/overlays/guard-probe.tsx` carrying `"use client"`.
This is the stronger version of the required proof: the probe sits in the **subdirectory**, so it also
proves the recursive scan added in §5 works.

```
 FAIL  … > the service-state path stays on the server > keeps every workspace component but the allowlisted client controls a Server Component
AssertionError: A new Client Component appeared under src/components/caring-contacts/workspace/. …
  [
+   "overlays/guard-probe.tsx",
    "overlays/overlay-host.tsx",
    "overlays/workspace-overlays.tsx",
    "unavailable-destination.tsx",
  ]
 ❯ tests/caring-contacts-explained-automation.dom.test.tsx:304:7
```

The probe file was deleted; the guard is green again.

### Extra probe (not required) — is the retained closed Sheet load-bearing?

Replacing the closed-state `<Sheet open={false} …>` with `return null` reddens the focus-return test at
`tests/caring-contacts-overlay-host.dom.test.tsx:87` (`expect(trigger).toHaveFocus()` times out). See
§7 for why the Sheet has to stay mounted.

### Extra probe (not required) — is `returnFocusRef` load-bearing?

Setting `openedFromRef.current = document.body` instead of the captured opener also reddens the same
line. So `returnFocusRef` is genuinely consulted and the captured element is genuinely the opener —
the test is not passing on the Sheet's own `previousActiveElement` fallback.

---

## 5. The client-component allowlist (Ruling 59)

**Added, with the reason recorded beside each entry in the test file:**

```ts
const ALLOWED_CLIENT_COMPONENTS = [
  // A declared-but-unbuilt destination: `aria-disabled` plus an inert click handler, so
  // the stated reason keeps its tab stop. Takes only `id`/`label`/`reason`/`className`.
  "unavailable-destination.tsx",
  // Task 18's one renderer for all 24 overlays. Inherently interactive — it reads the
  // viewport width to choose a modality, traps focus, and runs the fresh-authentication
  // checkpoint. Its `blockReason` prop is a NAMED refusal string, never a state object.
  "overlays/overlay-host.tsx",
  // The client boundary that owns `?overlay=<id>` and the two handlers, because function
  // props cannot cross a Server → Client boundary. It takes no props at all, which is
  // what keeps the service-state record on the server side of this seam.
  "overlays/workspace-overlays.tsx",
];
```

**Condition 1 — no client component receives a `serviceState`-derived prop.** `OverlayHost` takes
`openOverlayId`, `onClose`, `onCommit` and `blockReason`. `WorkspaceOverlays` takes nothing at all, and
the shell renders it as a bare `<WorkspaceOverlays />`. Neither file imports from
`@/lib/caring-contacts/service-state`.

**Condition 2 — the companion check now covers every entry.** It already looped the allowlist, so the
substantive fix was elsewhere: I also strengthened it to assert that each allowlisted path actually
exists _and_ actually carries the `"use client"` directive, so a stale entry cannot silently widen the
list without covering anything.

**A gap this uncovered, and closed.** `workspaceSourceFiles()` used a **non-recursive**
`readdirSync(WORKSPACE_DIR)`, so it scanned only the top level of the workspace directory. Files under
`overlays/` — which is exactly where this task puts two client components — were invisible to it.
Without fixing that, the guard would never have gone red at all and Ruling 59's authorisation would
have been unnecessary. It is now `readdirSync(…, { recursive: true, withFileTypes: true })` with
allowlist entries expressed as `/`-separated paths relative to the workspace directory. That is a
strengthening, not a loosening: the check now covers strictly more files than before.

**Condition 3 — deliberate, with the reason.** Each entry carries its own comment, above.

One consequence of the source-text guard worth recording: the guard fails on the mere _mention_ of
`service-state` or `ServiceState` in an allowlisted file. My first draft of the two docblocks named
both, to explain why the constraint exists, and the guard correctly went red. The explanations now
describe the record ("the service-wide safety-stop record", "its incident note") rather than naming its
module or type, with a note in `overlay-host.tsx` saying why the names are described rather than
written.

No existing assertion was deleted or loosened. One test **title** was reworded from "the one allowed
client control" to "the allowlisted client controls", since there are now three.

---

## 6. How modality was kept out of the components and in the table

- No modality literal is ever assigned in a component. `modalityFor()` returns
  `definition.phoneModality` or `definition.desktopModality`, and that is the only place a modality
  value originates.
- The three data attributes are stamped straight from the definition object, not from anything the
  renderer decided.
- The only place a modality string is _written_ in this file is `SHEET_GEOMETRY`'s keys, which is a
  `Record<SheetModality, …>` — TypeScript rejects a missing or misspelled key, so a new modality in the
  table becomes a compile error here rather than a silent default.
- The mutation-A run above is the behavioural proof: substituting the renderer's own idea of a
  modality for the table's reddens 13 rows by name.
- `mutatesState`, `requiresFreshAuthentication`, `dismissal`, `tone`, `title`, `summary`, `decision`
  and `label` are all read from the table too. Nothing about an individual overlay is hard-coded.

---

## 7. The one design decision that needed a non-obvious shape

`OverlayHost` returns a **mounted but closed** `<Sheet open={false}>` when no overlay is open, rather
than `null`. This is not decoration:

The shared Sheet restores focus from its open-effect cleanup, and that cleanup deliberately returns
early when the component is unmounting (`if (unmountingRef.current) return;` in `sheet.tsx`). React
runs the mount-effect cleanup — which sets that flag — before the open-effect cleanup, so a host that
vanished the instant the overlay closed would drop focus on the floor. Keeping the Sheet mounted costs
no DOM (`Sheet` returns `null` when `open` is false) and is what makes rule 6's focus return work. The
extra probe in §4 proves it.

The opener itself is captured in a `useEffect` on `[openOverlayId]`. That effect runs on commit, and
the Sheet's open-focus controller moves focus inside a `requestAnimationFrame`, so
`document.activeElement` is still the opener when the effect reads it. My first attempt captured it
during render, which `react-hooks/refs` correctly rejects ("Cannot update ref during render"); I moved
it to the effect rather than disabling the rule.

---

## 8. Next.js 16 guides read

- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md` (the "Native
  History API" section)

Nothing in them contradicted the plan, but two points **changed** it:

1. The `useSearchParams` guide is explicit that a statically rendered page calling it outside a
   `<Suspense>` boundary **fails the production build**, and that the hook client-renders everything up
   to the nearest boundary. That, plus the History API section's statement that
   `pushState`/`replaceState` integrate with the router, is why the wrapper uses the History API rather
   than the hook. Had I written this from memory I would have reached for `useSearchParams` first.
2. The server/client guide's "props passed to Client Components need to be serializable" is the exact
   sentence that rules out passing `onClose`/`onCommit` from the server shell, which is what forced the
   wrapper file to exist at all.

I also read `node_modules/next/dist/client/components/navigation.js` to confirm what `useSearchParams`
does without a router context (returns `null` rather than throwing) — relevant because the shell's
existing DOM tests mock no router.

---

## 9. Files changed

| File                                                                            | Change                                                                                  |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/components/caring-contacts/workspace/overlays/overlay-host.tsx`            | new — the one renderer                                                                  |
| `src/components/caring-contacts/workspace/overlays/workspace-overlays.tsx`      | new — the client boundary (URL state + the two handlers)                                |
| `src/components/caring-contacts/workspace/shell.tsx`                            | modified — one import, one mount, one comment                                           |
| `tests/caring-contacts-overlay-host.dom.test.tsx`                               | new — the brief's test file, plus three added assertions and one added test             |
| `tests/caring-contacts-explained-automation.dom.test.tsx`                       | modified — recursive scan, allowlist widened with reasons, companion check strengthened |
| `docs/design-system/adoption-manifest.json`, `docs/design-system/COMPONENTS.md` | regenerated (`npm run design-system:adoption:update`) — `Sheet` gains one consumer      |

Not touched: `docs/caring-contacts/interaction-matrix.md`, `overlays/definitions.ts`,
`src/app/mockups/caring-contacts`, `src/components/caring-contacts/mockups`, any migration.

## 10. Repository contracts checked

- **Button wiring** — the one action button always has an `onClick` (the real action, or
  `ignoreUnavailableActivation` when blocked). `aria-disabled` without native `disabled`; never both.
  `npx eslint` on all five changed files is clean.
- **Tap targets** — every action uses `controlBase` / `primaryControl` / `floatingControl`, all of which
  carry `min-h-tap` (48 px). No `min-h-11` anywhere.
- **Tokens** — every colour, radius, shadow and spacing value is a `var(--…)` token or a Tailwind scale
  class. No hex, no `dark:` override, no raw pixel padding.
- **z-index** — `z-[var(--z-toast)]` on the status banner; the Sheet owns its own `--z-modal` rung.
- **Icons** — this renderer adds no icons of its own.
- **Navigation** — no anchors added.
- **Vocabulary** — Australian English, sentence case. A new test asserts the renderer adds no
  prohibited vocabulary to what it renders (the definition table's own copy is already guarded
  elsewhere; this covers the words the renderer adds on top).

## 11. Verification run

| Command                                                                           | Result                                                                           |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `node scripts/run-vitest.mjs run tests/caring-contacts-overlay-host.dom.test.tsx` | `Test Files 1 passed (1) / Tests 7 passed (7)`                                   |
| `node ./node_modules/typescript/bin/tsc -p tsconfig.json --noEmit`                | clean, no output                                                                 |
| `npx eslint <5 changed files>`                                                    | clean, no output                                                                 |
| `npm run test`                                                                    | `Test Files 701 passed, 2 skipped (703)`; `Tests 7769 passed, 29 skipped (7798)` |
| `npm run format`                                                                  | run; the working tree carries only the files listed in §9                        |

No provider-backed command was run. No push, no PR, no `verify:*`.

---

## 12. Self-review findings

1. **The brief's `/close/i` assertion is decorative for the blocking rule.** Reported in §4 rather than
   substituted, and covered by added assertions.
2. **`returnFocusRef` is not the only thing making focus return work.** The shared Sheet's own
   `previousActiveElement` fallback would resolve to the same element in the common case. I proved the
   ref _is_ consulted first (§4, extra probe), so rule 6 is honoured substantively and not just
   nominally — but a future reader should know the two mechanisms overlap.
3. **The guard I was told would go red would in fact not have.** `readdirSync` was non-recursive, so
   nothing under `overlays/` was ever scanned. Fixed (§5). This is the finding I would most want a
   reviewer to check.
4. **The Sheet header and Escape-dismissal are coupled.** `dismissible` decides both whether the Sheet
   renders a header (and therefore a close button) and whether Escape works. That is exactly right for
   the current table, where the only `recovery-only` rows are the gate and the banner. If a future row
   ever paired `recovery-only` with a sheet modality, it would render with no header at all — probably
   what you would want, but it is a coupling rather than two independent decisions.
5. **The status banner does not keep a Sheet mounted.** Closing a status banner therefore restores no
   focus — correct, since it never took any — but switching directly from a sheet overlay to a banner
   overlay unmounts the Sheet and loses that restore. An edge case no interaction currently produces.
6. **`checkpoint` state is adjusted during render** (`if (checkpoint !== null && checkpoint.id !==
openOverlayId) setCheckpoint(null)`). That is React's documented "adjusting state when a prop
   changes" pattern and lints clean, but it is the one place in the file where render is not pure of
   effect.

## 13. Concerns

1. **Nothing in the workspace opens an overlay yet, and `onCommit` records nothing.** `?overlay=<id>`
   is reachable only by typing it, and the wrapper's `commit` closes the overlay without writing
   anything, because the screens that raise these overlays and the stores their decisions go to are
   later tasks. It is stated in the wrapper's docblock rather than left to look finished. It does mean
   a curious user who typed the URL could press "Pause future contacts" and see only the overlay close.
   If that is unacceptable before triggers exist, the mount can be deferred — but the brief asked for it.
2. **`blockReason` is rendered verbatim.** The prop is documented as "a named permission/connectivity
   refusal", and `permission-unavailable` is a machine-shaped identifier to put in front of a
   clinician. The renderer wraps it in a sentence ("This action is unavailable. The reason given is
   …"), but whoever supplies the value should be supplying human wording, and no test currently forces
   that. Worth a ruling before the first real caller.
3. **The dismissal fallback throws in development and test.** `dismissesOnEscapeOrBackdrop` throws
   during render on an unrecognised value, which crashes the tree in dev — deliberate, and matching the
   shared Sheet's own precedent for the missing-accessible-name case, but it is a render-time throw and
   worth knowing about.
4. **Two tests intermittently time out in this worktree** (`tests/codex-cloud-setup.test.ts`,
   `tests/design-sync-contract.test.ts`). Both passed in the full run reported above.
