# DOM vacuity sweep — batch 1 (18 files)

All 18 files read in full, line by line. Per-file verdicts below, findings after.

## Per-file verdicts

1. `tests/ward-bed-release.dom.test.tsx` — clean
2. `tests/ward-board-discharge.dom.test.tsx` — **FINDING-1**
3. `tests/ward-board-live-state.dom.test.tsx` — clean
4. `tests/ward-board-page.dom.test.tsx` — clean
5. `tests/ward-board-people-panel.dom.test.tsx` — **FINDING-2** (worst finding in this batch)
6. `tests/ward-board-selection.dom.test.tsx` — clean
7. `tests/ward-board-triage.dom.test.tsx` — clean
8. `tests/ward-capacity-freshness-source.dom.test.tsx` — clean
9. `tests/ward-capacity-sexmix-release.dom.test.tsx` — clean
10. `tests/ward-capacity-view.dom.test.tsx` — clean
11. `tests/ward-console-controls.dom.test.tsx` — clean
12. `tests/ward-daily-sheet.dom.test.tsx` — clean
13. `tests/ward-discharge-board.dom.test.tsx` — clean
14. `tests/ward-ed-psychiatry-hub.dom.test.tsx` — clean
15. `tests/ward-ed-screen.dom.test.tsx` — clean
16. `tests/ward-ed-transport-booking.dom.test.tsx` — clean
17. `tests/ward-ed-withdraw-referral.dom.test.tsx` — clean
18. `tests/ward-escalation.dom.test.tsx` — clean

Overall: this batch is unusually well-written. Most files carry explicit non-vacuity guards
(`toBeGreaterThan(0)` on the population being iterated, independent per-unit derivations, "both
directions" checks) and several files' own comments document a previously-shipped vacuity defect
and how the current assertion avoids repeating it. Two real findings surfaced anyway.

---

## FINDING-2 (worst) — `tests/ward-board-people-panel.dom.test.tsx`

**Test:** `describe("a person who is away at an emergency department", ...) > it("changes NO bed figure — the ward is holding the bed", ...)` (lines 452–470).

**Assertion verbatim:**

```ts
it("changes NO bed figure — the ward is holding the bed", () => {
  const unitId = awayAdmissions[0].unitId;
  const occupiedHere = admissionsForUnit(wardAdmissions, unitId).filter(bedIsOccupied).length;

  const view = renderWardBoard(unitId);

  const occupantsDrawn = view.getAllByTestId(/^ward-board-person-/u).length;
  expect(occupantsDrawn, "an away person stopped being drawn as an occupant").toBeGreaterThan(0);
  expect(occupiedHere, "the away people are no longer counted in this unit's occupied beds").toBeGreaterThanOrEqual(
    awayAdmissions.filter((a) => a.unitId === unitId).length,
  );
});
```

**Why it is vacuous:** the test's name and the surrounding doc comment (lines 452–459) claim to
prove that marking a patient "away at an ED" does not change any bed/occupancy figure the ward
board renders. But `occupiedHere` is computed **before** `renderWardBoard` is even called, straight
from the raw `wardAdmissions` fixture array — it never touches `view`, never reads the rendered
board, and never looks at any capacity/headline/occupied-count testid. The comparison is then
`occupiedHere >= (away admissions in this unit).length`. Since every away admission is, by
definition and by the fixture-assumption test earlier in the same file (line 407,
`expect(admission.state, ...).toBe("occupied")`), itself one of the occupied admissions counted
into `occupiedHere`, this inequality is true by simple set inclusion for any unit with at least one
away admission — regardless of what the component renders. It is not a property of the rendered
screen at all; it is arithmetic on the fixture.

The only assertion that touches the rendered `view` is `occupantsDrawn > 0`, which merely confirms
some person rows were drawn — it never checks that the ward's own capacity/occupied bed count on
screen is unaffected by the away flag.

**Concrete code change that leaves this test green while breaking the guarded behaviour:** modify
`WardBoard` (or whatever now-live capacity derivation feeds it) so that an admission with
`awayAtEmergencyDepartmentSince !== null` is excluded from the unit's rendered occupied-bed count
(i.e. the exact regression the surrounding comment says would be catastrophic — "a coordinator
would then offer it"). `occupantsDrawn` (person rows in the panel) would likely still be > 0 since
person rows are unrelated to the capacity/occupied figure, and `occupiedHere` is computed from the
raw fixture, never from the screen, so it is completely insensitive to this regression. The test
would stay green while the ward board silently freed a bed that is still occupied by someone
temporarily off-site — the precise clinical-safety property the test's own name and comment claim
to protect.

This is the worst finding in the batch because it guards a clinically load-bearing screen (ward
board bed-availability figures, described elsewhere in the same file and sibling files as the thing
"a coordinator scans" and "a coordinator would then offer" a bed on) and it fails silently in
exactly the shape the task brief warns about: an assertion built from data that never flows through
the render at all.

---

## FINDING-1 — `tests/ward-board-discharge.dom.test.tsx`

**Test:** `describe("recording a departure from the ward board", ...) > it("records the destination the ward chose, not the default", ...)` (lines 168–188).

**Assertion verbatim:**

```ts
it("records the destination the ward chose, not the default", () => {
  const { unitId } = aWardWithAnOccupant();
  renderBoardAt(unitId, OFF_ANCHOR);
  selectAnOccupiedBed();

  const destinations = screen.getByTestId("ward-board-leaving-destination") as HTMLSelectElement;
  fireEvent.change(destinations, { target: { value: "transferred-to-another-psychiatric-ward" } });
  expect(destinations.value).toBe("transferred-to-another-psychiatric-ward");

  fireEvent.click(screen.getByTestId("ward-board-record-leaving-submit"));

  // The bed frees either way — the destination changes what it MEANS statewide, not whether this
  // ward's bed is now empty.
  expect(screen.getByTestId("ward-board-select-hint")).toBeTruthy();
});
```

**Why it is vacuous for the claim in its name:** the test name and its position (grouped with
"records the destination the ward chose, not the default") assert that submitting with a
non-default destination selected causes that destination to actually reach the reducer/model,
rather than the component silently submitting a hardcoded default. But:

- `expect(destinations.value).toBe(...)` only proves the native `<select>` DOM element's own value
  changed after `fireEvent.change` — this is standard jsdom/browser behaviour independent of
  anything the submit handler does with it, and would pass even if the submit handler ignored
  `destinations.value` entirely.
- The only post-submit assertion, `expect(screen.getByTestId("ward-board-select-hint")).toBeTruthy()`,
  merely confirms the detail panel closed — which happens on every successful `RECORD_LEAVING`
  submit in this suite regardless of which destination was recorded (see the sibling test "closes
  the panel, because the person it described has gone", lines 155–166, which asserts the identical
  post-condition after submitting with the untouched default).

**Concrete code change that leaves this test green while breaking the guarded behaviour:** change
the submit handler for "record leaving" to always dispatch the default/first `LEAVING_DESTINATIONS`
value (or any single hardcoded destination) instead of reading the selected `<select>` value. The
select element itself would still report `"transferred-to-another-psychiatric-ward"` from the
`fireEvent.change` (an untouched DOM property), and the panel would still close on submit, so both
assertions stay green while every discharge is silently recorded under the wrong destination
statewide.

This is a real but lower-severity finding than FINDING-2: it concerns which of five discharge
destinations is recorded (a data-correctness/reporting issue), not whether a bed appears
available when it should not be.

---

## Notes on files that looked risky but were not

- `tests/ward-capacity-freshness-source.dom.test.tsx` renders a hardcoded literal "NUM" inside the
  regex `^Confirmed .* NUM ${unit.name}$` (line 74). This traces back to a literal `` `NUM ${unit.name}` ``
  string template in the production source (`ward-management-modes.tsx:556`, `ward-screen.tsx:531`)
  — i.e. the test is correctly pinning exact (if oddly-worded) production text, not exhibiting
  vacuity. Flagged here only for visibility, not as a vacuity finding — it doesn't meet the brief's
  "leaves this test green while breaking behaviour" bar; it's a copy/product question, not a test-
  quality one.
