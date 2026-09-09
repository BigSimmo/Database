# Ward Flow merges 1–3 — design lock

**Status:** LOCKED 2026-09-05 by owner instruction ("lock in the design for the first three merges,
leave the ward one"). Merge 4 — the ward page — is explicitly **out of scope** and unchanged.

**Supersedes nothing.** This is the first written lock of a design that until now existed only as an
HTML mockup (`ward-flow-merges.html`, published artifact `37942435-ae66-41d1-a587-8e189f8fe8e5`,
third edition) and its inspiration (`mockupwardhomev3.html`, the ward home board).

---

## 1. What is being folded, measured against the real navigation

`src/components/ward-management/ward-nav.ts` is the single source of every Ward Flow destination:
`WARD_VIEWS` (8) + `WARD_NAV` (15) = **23 destinations**. Verified by reading that file on
2026-09-05 at `a3e406627`, not recalled.

| Merge | Folds                                 | From             | Into                     |
| ----- | ------------------------------------- | ---------------- | ------------------------ |
| 01    | `queue` + `exceptions` + `escalation` | 2 views, 1 board | **Delays** (one view)    |
| 02    | `capacity` + `morning`                | 1 view, 1 board  | **Capacity** (one view)  |
| 03    | `movements` + `transport`             | 2 views          | **Movements** (one view) |

After all three: `WARD_VIEWS` 8 − 3 + 1 = **6**; `WARD_NAV` 15 − 2 = **13**; total **19**.

> ⚠️ **The mockup's headline "23 → 18" counts merge 4 as well.** With merge 4 out of scope the
> arithmetic for this work is **23 → 19**. Any copy shipped under this lock must say 19, and the
> published artifact's own correction note ("23 → 18") is correct only for all four merges.

**`transport/officer` survives untouched.** It is a nested route under `/transport` and does not
require a parent page. It stays in `WARD_NAV` as its own entry. It is a different person doing four
things on a phone; folding it in would ruin the one screen that must work one-handed.

---

## 2. Folded routes redirect; they are never deleted

The repository already has an idiom for a folded destination — `/mockups/ward-flow/constellation` is
a 307 redirect to `/network`, recorded in `WARD_NAV_INTENTIONALLY_UNLISTED` with its reason. **That
idiom is adopted here rather than invented over.**

| Old route                       | Becomes                                           |
| ------------------------------- | ------------------------------------------------- |
| `/mockups/ward-flow/queue`      | 307 → `/mockups/ward-flow/delays`                 |
| `/mockups/ward-flow/exceptions` | 307 → `/mockups/ward-flow/delays`                 |
| `/mockups/ward-flow/escalation` | 307 → `/mockups/ward-flow/delays`                 |
| `/mockups/ward-flow/morning`    | 307 → `/mockups/ward-flow/capacity?as-at=morning` |
| `/mockups/ward-flow/transport`  | 307 → `/mockups/ward-flow/movements`              |

Each redirect route is added to `WARD_NAV_INTENTIONALLY_UNLISTED` with a one-line reason, because
`tests/ward-nav.test.ts` requires every static route under `src/app/mockups/ward-flow/` to be in a
nav array **or** in that map. A route in neither is what defect D8 was.

---

## 3. The token map — what the mockup asked for, and what is actually available

The mockup is standalone HTML with its own `:root`. The app has a scoped layer,
`src/components/ward-management/ward-tokens.module.css`, whose own header states the rule: **every
value resolves through a PsychSift token; a raw hex here is the start of a fork.**
`tests/ward-design-language-contract.test.ts` enforces it.

| Mockup token                                | Locked as                                                         | Note                                                                 |
| ------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| `--ground`                                  | `--ward-ground`                                                   | already declared, and **consumed by nothing** until this work        |
| `--surface`                                 | `--ward-canvas`                                                   |                                                                      |
| `--surface-2`                               | `--ward-subtle`                                                   |                                                                      |
| `--sunken`                                  | `--ward-chrome`                                                   |                                                                      |
| `--ink` / `--ink-2` / `--muted` / `--faint` | `--ward-heading` / `--ward-text` / `--ward-muted`                 | the mockup's four text weights collapse to three; there is no fourth |
| `--rule` / `--rule-2`                       | `--ward-border` / `--ward-border-strong`                          |                                                                      |
| `--accent` and washes                       | `--ward-blue` / `--ward-blue-soft` / `--ward-blue-border`         |                                                                      |
| `--good` / `--signal` / `--crit`            | `--ward-success` / `--ward-warning` / `--ward-danger` (+ `-soft`) |                                                                      |
| `--cool` (teal)                             | **dropped** → `--ward-blue`                                       | see deviation 2                                                      |

### Three deviations from the mockup, each deliberate

1. **Typefaces stay Geist and Geist Mono.** The mockup uses Archivo and JetBrains Mono. The contract
   test forbids any `font-family` outside the token layer, and adding two webfonts to a production
   app for a sandbox prototype costs bytes and layout shift for no clinical benefit. **The roles
   survive intact and they are what mattered:** sans for prose, mono with
   `font-variant-numeric: tabular-nums` for every figure a reader compares down a column.

2. **The teal fifth hue is dropped.** No `--ward-*` teal exists. Adding a sixth hue to a page whose
   governing rule is _colour only reinforces a word already there_ is cost without benefit.
   "Planned" and "expected" use `--ward-blue`.

3. **Panels are flat with a visible border on a visible ground — no shadow, no soft corners.** The
   ward layer declares no shadow token and only `--ward-radius-pixel` (0.0625rem). That geometry was
   settled by the design-foundation work completed 2026-09-04 and is not this work's to reopen. The
   mockup's pale-rule-plus-elevation approach is specifically **not** adopted: the token file records
   that the pale rule measured 1.11:1 on the ward ground and was replaced across 27 stylesheets for
   being invisible. Separation here comes from the ground, which is what `--ward-ground` was
   declared for.

---

## 4. The component inventory — what exists, what is new

**Four primitives already exist and are reused unchanged.** No new versions of them.

| Primitive                        | File                 | Does                                                                                  |
| -------------------------------- | -------------------- | ------------------------------------------------------------------------------------- |
| `WardPanel`                      | `ward-panel.tsx`     | bordered section, header, optional count and blurb                                    |
| `WardChip`                       | `ward-chip.tsx`      | state word; levels `urgent \| routine \| stalled \| accepted \| enroute \| cancelled` |
| `WardFigure` / `WardFigureStrip` | `ward-figure.tsx`    | the KPI strip                                                                         |
| `WardFreshness`                  | `ward-freshness.tsx` | "confirmed at", and its staleness                                                     |

**Four primitives are new**, because the same shapes are currently re-invented per screen. Measured
across the 41 Ward Flow stylesheets on 2026-09-05: **813 distinct classes, of which 53 end in `Row`
and 26 end in `Note`.** That is the modularity case, and it is counted rather than asserted.

| New primitive                             | File                                  | Replaces                                                     |
| ----------------------------------------- | ------------------------------------- | ------------------------------------------------------------ |
| `WardBar`                                 | `ward-bar.tsx` + `.module.css`        | the distribution bar and its key — used by all three screens |
| `WardRecordRow`                           | `ward-record-row.tsx` + `.module.css` | the ~53 `*Row` classes, for these three screens only         |
| `WardGroupHeading`                        | in `ward-record-row.tsx`              | the ~10 `*Group*` heading variants                           |
| `WardFilters` (pills) and `WardSegmented` | `ward-controls.tsx` + `.module.css`   | `.filters`, `.queueFilter*`, and the hand-rolled toggles     |

`WardRecordRow` carries the mockup's `note-box` as a `reason` slot, so the ~26 `*Note` classes have
one home for these screens.

**Nothing outside merges 1–3 is migrated onto the new primitives in this work.** The other screens
are a real adoption backlog and are somebody else's task.

---

## 5. Behaviour that is locked, and is clinical rather than cosmetic

These come from the mockup and the ward home board and must survive implementation:

1. **State is a word before it is a colour.** No row, tile or chip may carry meaning in colour
   alone. Every coloured edge has a `WardChip` beside it saying the same thing.
2. **Absence is stated, never blank.** "no bed held today", "no override recorded", "none" — a zero
   keeps its place in a key so the absence is readable rather than invisible.
3. **Group headings count people, not rows.** A patient carries several delays at once; the row sits
   under the longest-running one and the rest appear as chips beside it. Counting rows would
   double-count the sickest people on the page.
4. **Sorted by wait, longest first — except an expiring legal authority**, which outranks everything.
5. **Every refusal is overridable and the override is recorded.** No screen here may present a
   refusal as a block. (`ward-flow-coordinator-overrides-everything`.)
6. **Staleness is shown as age, never as withdrawal.** A figure nobody has refreshed is still the
   best figure anyone has, and it stays on screen, marked.
7. **A locked ward and a ward that may lawfully detain are different facts**, and no screen may
   merge them. Pinned by `tests/ward-locked-not-authorised.test.ts`.
8. **A count that is shown must be honest about its denominator.** Where a list shows 9 of 43, it
   says so.

---

## 6. Layout, locked

- **Ground visible.** None of the three screen roots may declare `background: var(--surface)`.
  `tests/ward-design-language-contract.test.ts` keeps a `COVERING_THE_GROUND` list and checks it in
  **both** directions, so `escalation/escalation.module.css` and `tracker/live-tracker.module.css`
  must be removed from it as those screens go.
- **Breakpoints.** No new value. `64rem` is already in the pinned set; the new stylesheets use it.
  Each new `file: value` pair is a new entry in `KNOWN_BREAKPOINTS` and must be added deliberately.
- **Panel-and-ground, not a card grid.** Each screen is: sticky screen header → figure strip →
  panels on the ground. Two-column split (`minmax(0,1fr) 19rem`) above 64rem, one column below.
- **Density.** Body 0.875rem; figures 1.875rem; row minimum height 2.375rem; panel padding
  `--ward-space-16`. The owner's standing instruction is that nothing may "seem too large".

---

## 7. Out of scope, stated so it is not quietly absorbed

- **Merge 4, the ward page.** Untouched. `/ward/[unitId]` and `/board/[unitId]` both stay.
- **Migrating other screens onto the new primitives.** They stay as they are.
- **A radius or shadow scale for the ward layer.** A separate decision for the whole layer.
- **The referring clinician's name and number.** The field does not exist in the model; adding it is
  a proposal in the mockup's footnote, not part of this lock.
- **`TransportView` in `ward-management-modes.tsx`.** It is unreachable today — no route renders
  `WardModeWorkspace mode="transport"` — and deleting it follows
  `docs/agents/dead-code-deletion.md`, which this work does not run.

---

## 8. Known blocker, diagnosed

`tests/ward-derivations.test.ts` is **red on this branch before any of this work begins**: measured
2026-09-05, 1 failed / 24 passed, `buildActionInbox` returns 5 items where the test expects 4.

**Cause, established rather than guessed.** Commit `be5327210` changed `fallbackUnitId` in
`ward-movements.ts` from `unit.security === security` to a bed-designation question. That changed
the size and order of the candidate pool, so generated movement **WF-318** now lands on
`sjgs-adult-secure` — a unit with `authorised: false` — while carrying a legal status that requires
an authorised destination. `buildActionInbox` correctly reports it as _"Accepted destination no
longer lawful"_.

**Two separate defects, and both are fixed in Task 1.**

- The **test** enumerates four of `buildActionInbox`'s five categories and its own name says "the
  four categories". It could only ever pass while the fifth category was empty — it is blind to the
  category by construction, not by accident.
- The **generator** picks a destination for an involuntary movement without ever asking whether that
  unit may lawfully detain. `fallbackUnitId` has never filtered on `authorised`; it simply happened
  not to land on one. That is the same class of defect as `f08548f1b`: invented data producing a
  wrong clinical state.

Fixing only the generator would make the test green while leaving it blind. Fixing only the test
would leave a patient in the fixture accepted at a ward that cannot lawfully hold them.
