# Task 16 report — the service-state banner and the explained-automation contract

Branch `claude/suicide-contact-mockup-b5aaa0`, worktree `D:\Worktrees\Database\cc-2a-live`.

---

## 1. What I implemented

**`src/components/caring-contacts/workspace/automated-state.tsx` (new).**
`AutomatedState({ state, because, changedBy })` — a Server Component rendering the state, the
reason and the remedy inside one `role="group"` named by the state. Spec §4.4 requires the reason
and remedy to be reachable _in place_; putting all three in one named region means a screen reader
that reaches the state has already entered the group and therefore reaches both.

The group is named with `aria-label` rather than `aria-labelledby`. That is a deliberate trade:
`aria-labelledby` needs an id, an id needs `useId`, and `useId` is a hook — which would make every
screen that shows an automated state ship a client component and break Ruling 13's client-payload
budget. `aria-label` carries exactly the same visible string, so nothing is lost in the
accessibility tree.

**`src/components/caring-contacts/workspace/service-state-banner.tsx` (new).**
`ServiceStateBanner({ state })` — the pinned signature, unchanged. Returns `null` while running.
While stopped it renders `role="status"` containing:

- the state in words, `Sending stopped`, beside an `aria-hidden` `OctagonX` icon;
- the sentence from the sealed `describeServiceStop`, which supplies the categorised reason in
  plain words ("a message reached the wrong recipient"), the approval count ("0 of 3 restart
  approvals recorded"), and the roles still outstanding — so what stopped sending and what would
  start it again are stated together, in the banner, not behind a hover;
- a control for the service-stop screen.

**`src/components/caring-contacts/workspace/shell.tsx` (modified).** New optional
`serviceState?: ServiceState` prop; the banner renders directly under the sticky header, above the
screen's own content, so a stop is the first thing read on every screen. `SyntheticMarker` and its
pinned wording were not touched.

**`tests/caring-contacts-explained-automation.dom.test.tsx` (new).** Ten tests — the brief's four,
plus six added below.

### Deviations from the brief, and why

1. **The brief's running-state fixture uses a field that does not exist.** The brief writes
   `state={{ stopped: false, teamId: teamId("TEAM-A") }}`. The sealed type's field is
   `reportedByTeamId`, named that way on purpose (it is provenance, and must never be read as
   scoping the stop). I used the domain's own constructor, `runningService(teamId("TEAM-A"))`,
   rather than hand-building a literal. No assertion changed.
2. **The service-stop control is not a `<Link>`.** The instruction said to build the href from
   `caring-contacts-routes.ts`, and also that the destination is unbuilt and must use the
   stated-reason convention. Those two cannot both be satisfied: `CARING_CONTACTS_ROUTES.serviceStop`
   has no page, so a `<Link>` to it is a link into a 404, which Ruling 52 forbids and which the
   shell's existing test would catch. I used `UnavailableDestination`, and named the route constant
   in a comment so the Plan 2B change is a one-line substitution. **Flagging this explicitly** in
   case the intent was the opposite.
3. **`AutomatedState` has no `className` prop.** I kept the exported type byte-for-byte as briefed
   rather than adding even an optional field to a pinned interface. Callers wrap it for placement.
4. **`AutomatedState` is not yet rendered by any screen.** It is a module contract for Tasks 17–18,
   exactly as the brief scopes it. Noted here so a future dead-code sweep does not read "no
   importers" as "debris" — the standing warning in `AGENTS.md`.

---

## 2. TDD evidence

### RED

```
$ node scripts/run-vitest.mjs run tests/caring-contacts-explained-automation.dom.test.tsx --reporter=dot

 FAIL  |jsdom| tests/caring-contacts-explained-automation.dom.test.tsx
Error: Failed to resolve import "@/components/caring-contacts/workspace/automated-state" from
"tests/caring-contacts-explained-automation.dom.test.tsx". Does the file exist?

 Test Files  1 failed (1)
      Tests  no tests
```

Expected failure, for the stated reason: the test file was written before either component existed,
so the suite could not even resolve its imports. The `Test Files` summary line is present, so this
was a real run and not a lock-acquisition failure.

### GREEN

```
$ node scripts/run-vitest.mjs run tests/caring-contacts-explained-automation.dom.test.tsx --reporter=dot

 Test Files  1 passed (1)
      Tests  10 passed (10)
```

### Full suite

```
$ npm run test

 Test Files  699 passed | 2 skipped (701)
      Tests  7750 passed | 29 skipped (7779)
   Duration  210.85s
```

No existing assertion was deleted, loosened, or edited. The shell's existing
`caring-contacts-workspace-shell.dom.test.tsx` — including its exact count of sixteen unavailable
controls — passes unchanged, because it renders the shell without a `serviceState` and the banner
therefore contributes nothing.

### Other gates

```
$ node ./node_modules/typescript/bin/tsc -p tsconfig.json --noEmit      → exit 0, no diagnostics
$ npx eslint <the four changed files>                                    → exit 0, no findings
$ npm run format                                                         → applied; tree clean
$ node scripts/run-vitest.mjs run tests/codebase-index-coverage.test.ts tests/repo-hygiene.test.ts \
    tests/caring-contacts-explained-automation.dom.test.tsx tests/caring-contacts-workspace-shell.dom.test.tsx \
    tests/caring-contact-route-files.test.ts tests/caring-contacts-domain-isolation.test.ts --reporter=dot

 Test Files  6 passed (6)
      Tests  92 passed (92)
```

That last run is the re-check after the `docs/codebase-index.md` rows were added, which happened
after the full `npm run test`. Four attempts were refused first with
`Database focused-test capacity is full (current owner PID 21184, worktree ...\care-plan-impl)` —
an acquisition failure, not a result, so it was retried until a real run happened.

---

## 3. Mutation evidence

### Mutation A — Step 5: `AutomatedState` renders no remedy

**Confirmed first that an assertion reads the value:** the test asserts the region has text content
`"Move the first contact date on the plan."`, which is precisely the `changedBy` prop. Removing the
remedy paragraph therefore removes a string an assertion reads.

Mutation: deleted the remedy `<p>` from `automated-state.tsx`, leaving `{void changedBy}` so the
prop stayed referenced and the failure was about the missing output, not an unused variable.

```
FAIL  ... > never shows a bare automated state without a reason and a remedy
Error: expect(element).toHaveTextContent()
Expected element to have text content:
  Move the first contact date on the plan.
Received:
  SuppressedWhy: Week 1 falls on the first contact day.
 ❯ tests/caring-contacts-explained-automation.dom.test.tsx:54:20

 Tests  2 failed | 8 passed (10)
```

Two tests went red: the brief's first test (line 54) and my tooltip test (line 74).
**Reverted** — the file was restored from a byte copy taken before the mutation, and
`grep -c "What changes it"` returns `1`.

### Mutation B — the sentinel: leak the responder's note

**Confirmed first that an assertion reads the value:** the sentinel test asserts
`container.innerHTML` does not contain `NOTE-LEAK-SENTINEL-9F3C`, and that string is present only
in the fixture's `note`. Rendering the note therefore changes exactly what the assertion reads.

Mutation: in `ServiceStateBanner` — the outer function, where the _whole_ `ServiceState` is in scope
— added `<p>{state.note}</p>` beside the narrowed renderer.

```
FAIL  ... > cannot put the responder's incident note on screen, whatever the note says
AssertionError: expected '<p>NOTE-LEAK-SENTINEL-9F3C Week 3 mes…' not to contain 'NOTE-LEAK-SENTINEL-9F3C'
 ❯ tests/caring-contacts-explained-automation.dom.test.tsx:95:37

FAIL  ... > keeps the note out of the banner on every screen the shell renders
 ❯ tests/caring-contacts-explained-automation.dom.test.tsx:104:37

 Tests  2 failed | 8 passed (10)
```

**Reverted** — restored from a byte copy; `grep -n "state.note"` in the file returns nothing.

**The finding this mutation produced, which is the reason the extra test was worth writing.**
Under this leak the brief's own assertion — `expect(banner.textContent).not.toMatch(/Rowan|Mira|\+61/)`
— **stayed green**. The leaked paragraph sat immediately outside the `role="status"` element, so a
check scoped to the banner's own text content never saw it, even though the patient's name, a second
name and an Australian mobile number were all sitting in the rendered page. The sentinel test, which
scans the whole `container.innerHTML`, caught it in both the component and the shell. The brief's
assertion is not decorative — it does catch an in-banner leak — but on its own it is narrower than
the guarantee Ruling 43 asks for.

I could not construct a mutation that leaks the note _inside_ the `role="status"` region without
also changing a type, which is section 4's point.

---

## 4. How the note is structurally out of the banner's reach

The file has two functions, and the split is the guarantee:

- `ServiceStateBanner({ state }: { state: ServiceState })` — the pinned signature. It contains no
  JSX of its own beyond one element. It reads exactly three fields (`stopped`, `reason`,
  `restartApprovals`) and hands them on.
- `StoppedServiceBanner({ facts }: { facts: ServiceStopBannerFacts })` — every piece of markup lives
  here. `ServiceStopBannerFacts` omits `note` by construction (the sealed domain built it for
  exactly this), so inside this function the note **is not in scope**. A future edit that tries to
  render it is a compile error, not a judgement call.

That is why the parameter type matters more than the markup: a comment asking an editor not to
interpolate a field that is sitting in scope is not a guarantee, and the branch has already ruled
that omission-by-markup is insufficient here (Rulings 43 and 8). The narrowing also matches what the
production data path will actually hand the banner —
`src/lib/caring-contacts-server/service-state-view.ts` builds its banner string from the same
`ServiceStopBannerFacts` shape — so this component asks for nothing that path cannot supply.

**What the sentinel test proves.** `NOTE_SENTINEL` is a string that exists nowhere in the repository
except the fixture's note, so any path from `note` to the DOM — a paragraph, a `title`, an
`aria-label`, a `data-*` attribute — makes it appear. The test scans `container.innerHTML`, not
`textContent`, so an attribute leak is caught as surely as a visible one, and it is asserted twice:
once on the banner alone, once on the whole shell. The brief's `/Rowan|Mira|\+61/` check only catches
the leak it happened to imagine; the next responder's note could name a ward, a message id or a
street, and none of those literals would fire. Both checks are kept.

---

## 5. Status without colour

Three carriers, none of which is colour:

1. **Text.** The banner's first line is the word `Sending stopped`. The second is the full
   `describeServiceStop` sentence: _"All caring-contact sending is stopped for the whole service
   because a message reached the wrong recipient. 0 of 3 restart approvals recorded. Still needed:
   the incident lead, the privacy and security owner and the clinical programme lead, each from a
   different person."_ Read aloud, printed in greyscale, or rendered in forced colours, every fact
   survives.
2. **Icon.** `OctagonX` beside the state word — `aria-hidden="true"`, because it reinforces the text
   rather than replacing it. `AutomatedState` uses `CircleAlert` the same way.
3. **Structure and semantics.** `role="status"` on the banner; `role="group"` named by the state on
   `AutomatedState`; the reason and remedy as their own labelled paragraphs (`Why:` /
   `What changes it:`) rather than as a hover.

Colour is applied on top of that (`--danger-bg` / `--danger-border` / `--danger-text`) with explicit
`forced-colors:` fallbacks, and never carries a fact on its own.

**How I tested it.** One test asserts the banner's `textContent` alone contains both
`"Sending stopped"` and `"stopped for the whole service"` — the strings that survive when styling is
gone — and then walks every `<svg>` in the banner asserting `aria-hidden="true"`, which proves the
icon is decoration on top of the words rather than the carrier of them. A second test walks every
`[title]` in an `AutomatedState` render and asserts the reason and the remedy are _not_ in a
tooltip, then asserts both are in the region's text.

I did **not** run a browser, a greyscale render, or a forced-colors pass. The colour-independence
claim is proved at the DOM level only.

---

## 6. Next.js 16 guides read

- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` — to
  confirm the Server/Client boundary rules before deciding that `AutomatedState` and
  `ServiceStateBanner` stay Server Components and that the banner may compose the existing
  `UnavailableDestination` client component with plain-string props. That decision is what ruled out
  `useId`, and therefore what fixed the `aria-label` naming choice in §1.

Nothing else here is framework-shaped: no route, no `params`/`searchParams`, no caching, no
`error.tsx`/`loading.tsx` change.

---

## 7. Files changed

| File                                                                | Change                                                          |
| ------------------------------------------------------------------- | --------------------------------------------------------------- |
| `src/components/caring-contacts/workspace/service-state-banner.tsx` | new                                                             |
| `src/components/caring-contacts/workspace/automated-state.tsx`      | new                                                             |
| `src/components/caring-contacts/workspace/shell.tsx`                | optional `serviceState` prop; banner mounted under the header   |
| `tests/caring-contacts-explained-automation.dom.test.tsx`           | new — 10 tests                                                  |
| `docs/codebase-index.md`                                            | two rows for the new components (2 insertions, no table reflow) |
| `docs/caring-contacts/phase-2a-sdd-archive/task-16-report.md`       | this report                                                     |

No migration. No mockup file touched. `synthetic-marker.tsx` untouched.

---

## 8. Self-review

- **Repository contracts.** No hex; every colour is a token (`--danger-*`, `--border`,
  `--surface*`, `--text*`). No raw pixel padding, radius, gap or line-height — Tailwind scale steps
  and `var(--radius-*)` only. No `dark:` override. No `z-` class added at all. No `min-h-11`
  anywhere; the banner's control is `min-h-tap`. Every `<button>` is wired through
  `UnavailableDestination` (`aria-disabled` + inert handler + `title` + `sr-only` reason, never
  native `disabled`, never both). Both lucide icons carry `aria-hidden`. No internal `<a href="/…">`.
  `npx eslint` on all four changed files: exit 0.
- **Prohibited vocabulary.** Checked every string I added against the banned list. `Sending stopped`
  and `Service stop` describe the service, not a patient; no transport word is used as a patient
  state; nothing claims replies are monitored. Australian English, sentence case, verb-first reasons.
- **`describeServiceStop` is the only source of the banner's wording.** I did not restate the
  reason-category or approval wording in the component, so the sealed domain stays the one place it
  can change.
- **`role="status"` implies `aria-live="polite"`.** On client-side navigation between workspace
  screens the banner may be re-announced. The brief specifies `role="status"`, and re-announcing a
  service-wide stop is the conservative failure direction, so I left it — flagging it as a known
  behaviour rather than an oversight.
- **`docs/codebase-index.md` was not in the brief's file list.** I added two rows because the index
  already carries the shell, width-state and unavailable-destination rows and would otherwise be
  stale. It is a docs-only addition; say the word and it comes out.
- **Pre-existing failure, not mine.** `node scripts/check-docs-links.mjs` fails on this branch. On
  the stashed clean tree it reports `10 missing path(s) across 2252`; with my change it reports
  `7 missing path(s) across 2254` — my three new files satisfy three references the task briefs
  already made. The remaining seven (e.g. `docs/caring-contacts/phase-2a-visual-differences.md`,
  referenced by the Task 19 brief) are files later tasks have yet to create.
- **`AutomatedState` has no consumer yet.** By design; noted in §1 so it is not mistaken for dead
  code later.

---

## 9. Concerns

1. **The service-stop control is not a link** (§1, deviation 2). If the intent was a real `<Link>`,
   that needs the service-stop page built first, which is out of this task's scope. Please confirm.
2. **Colour independence is proved at the DOM level only.** No browser, greyscale or forced-colors
   render was performed. Task 19's visual pass is where that gets real evidence.
3. **The `serviceState` prop is optional, so a screen can silently omit it.** Spec §4.2 says the
   banner is on _every_ screen; today nothing forces a screen to pass the state, because Phase 2A
   screens are static and do not read the store. Once a screen reads it, this wants a gate — a test
   that every workspace page passes `serviceState` — otherwise §4.2 rests on each page author
   remembering. I did not add that gate, because there is exactly one page and it has no data path
   yet. Worth an `/issues` capture when Task 17 or 18 introduces the first real read.
4. **Two "Service stop" controls appear while stopped** — one in the banner, one in the More panel.
   Both state their own reason and both are legitimate, but a reviewer may prefer one.
