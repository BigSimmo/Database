# Verify ruling 13 — away-group placement

File: `src/components/ward-management/board/ward-daily-sheet.tsx`
Test (being rewritten concurrently by another agent — read only, not final): `tests/ward-daily-sheet.dom.test.tsx`

## 1. What reads `AWAY_GROUP_PLACEMENT_UNRESOLVED`?

Nothing. Repo-wide search (`src/`, `tests/`, `scripts/`, `worker/`) for both the bare
identifier and the string literal `"AWAY_GROUP_PLACEMENT_UNRESOLVED"` returns exactly one
hit, the definition itself:

```
src/components/ward-management/board/ward-daily-sheet.tsx:78:export const AWAY_GROUP_PLACEMENT_UNRESOLVED =
```

No import, no reference, no dynamic string lookup anywhere. It is exported but has zero
consumers. Classification: **definition only, dead**.

## 2. Does the named test assert the placement?

No. `tests/ward-daily-sheet.dom.test.tsx` never mentions the constant. The test the comment
implicitly means — `"renders one daily sheet, with D19's four groups in D19's order"`
(line 58) — asserts the h3 headings inside the sheet equal exactly:

```
["Who came in", "Who is going", "Who is stuck", "Who is overdue",
 "Nobody has said when they are going"]
```

"Away"/"Off the ward" is **not in that list**, and the test's own trailing comment says why:
`// "Who is off the ward" was briefly a sixth heading here. The owner removed the column on
2026-08-30 and it is now a LINE under the grid, not a group — see the off-the-ward test
below.` No test anywhere in the file compares DOM order/position of the away line against
the other groups (checked for `getAllByTestId`, `compareDocumentPosition`, `nextSibling`,
etc. — none found). Existing away-line tests (lines 150, 200-201, 234-237) assert only
presence and text content, never position.

## 3. What actually determines the order?

Not `dailySheetGroups()`. That function just returns a plain object bag:

```js
export function dailySheetGroups(people) {
  return {
    heldUp: people.filter(...),
    overdue: people.filter(...),
    noDate: people.filter(...),
    awayFromWard: people.filter(...),
  };
}
```

Nothing iterates its keys — `WardDailySheet` (the render function) accesses `groups.heldUp`,
`groups.overdue`, `groups.noDate`, `groups.awayFromWard` individually by name, so this
object's field order is inert for rendering.

The real control is the **static JSX layout order in `WardDailySheet`**. `groups.heldUp`,
`groups.overdue`, `groups.noDate` are rendered via `<SheetGroup>` inside
`<div className={styles.sheetGroups}>` (lines 341-433). Immediately after that div closes,
a separate, unconditional `<p className={styles.sheetAwayLine}>` block (lines 452-459) prints
`groups.awayFromWard` as one line — physically after the grid, so it already renders last.
This is documented in the code itself, right above it: `/* OFF THE WARD — A LINE, NOT A
COLUMN. Owner, 2026-08-30: "Remove the away column." ... it stops being a sixth grid cell
and becomes one sentence under the grid. */`

**The precise edit**, if the away line ever needed to move: reposition the `<p
className={styles.sheetAwayLine}>…</p>` JSX block in `WardDailySheet`
(`ward-daily-sheet.tsx`, currently lines 452-459) relative to the `<div
className={styles.sheetGroups}>` block (lines 341-433) — moving it before that div would put
it first, moving/leaving it after keeps it last. Editing `AWAY_GROUP_PLACEMENT_UNRESOLVED` or
`dailySheetGroups()`'s field order changes nothing observable.

Given the owner's ruling (away last, after current occupants), **the code already matches
it** — the away line already renders after the three groups.

## 4. Where "away" comes from

`Admission.awayAtEmergencyDepartmentSince: Instant | null` in
`src/components/ward-management/ward-admissions.ts:375` (also listed at line 474 in a
field-selection set). `ward-board.tsx` derives from it: `awayAtEd: admission.awayAtEmergencyDepartmentSince
!== null` (line 200) and an hours figure at lines 348-350. That hours figure is passed into
the sheet as `DailySheetPerson.awayAtEdHours`, which `dailySheetGroups()` filters on
(`person.awayAtEdHours !== null`) to build `awayFromWard`.

## 5. Is group order asserted anywhere?

No. Only the five D19 group **headings'** order is pinned (test in §2), and the away line is
explicitly excluded from that assertion because it is not a heading. No test pins the away
line's position relative to the grid. If a future edit moved the away line before the grid
instead of after it, nothing in the suite would fail. The ruling would land with nothing
keeping it landed.

## 6. Other stale comments in this file

`AWAY_GROUP_PLACEMENT_UNRESOLVED`'s own 16-line comment block (lines 62-80) is itself the
main defect: it describes away as a live "fifth group"/"fifth column" question ("a fifth
column makes that worse... It was still built") and claims the named test asserts the
placement. Both are false as of the 2026-08-30 change documented ~370 lines further down in
the same file — away was demoted from column to a single `<p>` line, and the heading-order
test was updated to explicitly stop expecting it as a group. The constant and its comment
were never updated or removed after that change landed, leaving a comment that both
misdescribes the current structure (grid column vs. line) and points at a non-existent
assertion. No other comment/code mismatch of this kind was found elsewhere in the file on
this pass; the "OFF THE WARD — A LINE, NOT A COLUMN" comment block (lines 435-451) is
accurate and matches its code.

## Caveat

`tests/ward-daily-sheet.dom.test.tsx` was being actively rewritten by another agent while
this was read. Findings about §1/§2/§5 (constant unread, no order assertion) are structural
(grep + static read of `ward-daily-sheet.tsx`) and independent of that file's churn, but the
exact test names/line numbers quoted from `tests/ward-daily-sheet.dom.test.tsx` may shift
under the concurrent edit — re-check before relying on line numbers from that file.
