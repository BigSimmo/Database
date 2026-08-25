# Ward Flow sidebar — adopt the repository's house sidebar pattern

**Goal:** Give Ward Flow the same sidebar *approach and structure* the clinical
application already uses, tailored to Ward Flow's own tokens, style and
destinations.

**Why now:** Ward Flow's rail has exactly one state. `ward-management.module.css`
contains four `@media` queries and not one of them is a width rule that touches
the rail, so a 390px phone renders the full 4.5rem desktop icon column — 18% of
the viewport — on every screen. Nine of the ten Ward Flow shells are a bare
`rail | main` two-column grid with no header of any kind, so a phone user gets a
squeezed column of unlabelled icons and nothing else.

## The house pattern being adopted

Read from `src/components/clinical-dashboard/ClinicalSidebar.tsx` and
`use-sidebar-collapsed.ts`:

1. **One content component, two hosts.** `ClinicalSidebarContent` renders the
   labelled navigation once; the expanded desktop panel and the mobile drawer
   both mount it. Nothing is written twice.
2. **Three breakpoints, three shapes.** Phone: no rail at all — a `Sheet` drawer
   opened from the app header. Tablet (`md`): icon rail only, with a static brand
   mark and no expand control, because the expanded panel does not exist below
   `lg`. Desktop (`lg`): icon rail *or* a 20rem labelled panel, chosen by the
   user.
3. **The choice persists.** `useSidebarCollapsed` is an external store over
   `localStorage`, collapsed by default, with an in-memory fallback when storage
   writes fail.
4. **The brand mark is the toggle.** Hovering it swaps the logo for
   `PanelLeftOpen`; it is a plain static mark on tablet where there is nothing to
   expand into.
5. **Navigating closes the drawer.** `onNavigate={() => onOpenChange(false)}`.

## Tailoring for Ward Flow

- Ward Flow's panel is **17rem**, not 20rem — its longest label is much shorter
  than a recent-query line, and its shells are dense operational boards that want
  the width back.
- Ward Flow has no header on nine of its ten shells, so the phone drawer's
  trigger has nowhere to live. The sidebar therefore **brings its own phone
  header**: a fixed 3.5rem bar carrying the brand mark, the words "Ward Flow",
  and the menu button. That is a genuine improvement, not just a port — those
  nine screens currently have no phone chrome whatsoever.
- The rail track becomes an `auto` grid track in all ten shells, so the sidebar's
  own width is what decides the column. One rule, one place, three states.

## Global constraints

- Synthetic data only; sex is the only permitted patient attribute. No nav label
  may name a real person, place-identifying address, or clinical narrative.
- No figure or requirement from the Mental Health Act, quoted, paraphrased or
  inferred.
- Local and offline checks only. No provider-backed command.
- Every Ward Flow route stays inside the sandbox: the developer hub is the only
  outbound link, and the brand mark points at Ward Flow's own home.

## Tasks

### Task 1 — Make the nav data the single source for all three groups

`ward-nav.ts` currently sources the six Ward-Flow-specific destinations. The
eight mode views are still eight hand-written `<Link>` blocks inside
`WardModeNavigation`, read back by `tests/ward-management.test.ts` through a
regex over that function's own source text. A labelled panel and drawer cannot
render from that without becoming a second hand-maintained list — which is the
exact defect `ward-nav.ts` was created to end.

- Move `WardMode` and the eight views into `ward-nav.ts` as `WARD_VIEWS`.
- Re-export `WardMode` from `ward-management-navigation.tsx` so no call site changes.
- Render `WardModeNavigation` from `WARD_VIEWS`.
- Point `wardModeHrefs()` at `WARD_VIEWS` instead of a source-text regex.
- The two-way route test keeps enforcing that every href is a real route and
  every static route is listed or exempted with a reason.

### Task 2 — Persisted collapse state

`use-ward-sidebar-collapsed.ts`, mirroring the clinical hook's structure
(external store, `localStorage`, in-memory fallback, collapsed by default) under
Ward Flow's own key `ward-flow-sidebar-collapsed`. A separate key, not the
clinical one: the sandbox does not share state with the application.

### Task 3 — The shared labelled content

`ward-sidebar-content.tsx` — brand row, three labelled groups (Views, Role
screens, Boards), then the footer controls that already exist and are reused
unchanged: `WardRoleSwitcher`, `WardDemoControls`, the developer-hub exit, and
the guest mark. Mounted by both the desktop panel and the phone drawer.

### Task 4 — Compose the three states

`ClinicalRail` becomes the composer: phone bar + drawer, icon rail, expanded
panel. Every one of the ten call sites keeps its current single
`<ClinicalRail />` element.

### Task 5 — Shell grids and phone reserve

All ten shells: rail track `4.5rem` → `auto`; phone `padding-top: 3.5rem` for the
fixed bar; the two shells with their own sticky headers get `top: 3.5rem`.

### Task 6 — Tests

Sidebar-state tests (phone hides the rail and shows the bar; the drawer opens,
lists every destination and closes on navigate; the desktop toggle persists), and
re-run the ward Chromium journeys plus phone screenshots. Screenshots are not
optional here: every defect found in this area so far was invisible to structural
checks.
