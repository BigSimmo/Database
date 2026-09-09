## Task 1 — Move the movement workspace off the `/patients/` address

**Why.** `/mockups/ward-flow/patients/[patientId]` renders `WardPatientWorkspace`, which looks up a
**movement**. Its own page title says "Patient movement workspace". Real people live at
`/mockups/ward-flow/people/[patientId]`. The address claims to be about patients and is not.

Since `b5147b9d0` the identifiers are distinct types — `MovementId` is `` `WF-${string}` ``,
`PatientId` is `` `PT-${string}` `` — so passing the wrong one no longer compiles. **This task fixes
the remaining half: the name a human reads.**

⚠️ **THE TARGET IS NOT `/movements/`.** That path already exists as a live mode page
(`src/app/mockups/ward-flow/movements`). Nest under it as `/mockups/ward-flow/movements/[movementId]`
if the router accepts a static page and a dynamic child in one segment. **If it does not, stop and
hand it back rather than choosing a third name** — the name is the whole point of the task and
picking one alone would be inventing the thing the task exists to fix.

**Files.**

- `src/app/mockups/ward-flow/patients/[patientId]/page.tsx` — the route to move.
- The inbound links. `grep -rn "ward-flow/patients/" src` finds them; the known ones are
  `search/patient-search.tsx`, `tracker/live-tracker.tsx` and three in `ward-management-modes.tsx`.
  **Count them yourself and report the number** — my count of seven is relayed, not measured.
- `tests/ward-nav.test.ts` and `tests/ward-landmarks.test.ts` — both hold route maps naming the old
  path, plus route counts. They will tell you exactly what to change; read their failure messages.

**Steps.** Move the route directory; update every inbound link; update both route-coverage maps;
rename the parameter and any local variable that says `patient` while holding a movement.

**Check.** `npx tsc -p tsconfig.typecheck.json --noEmit` reports zero errors, then
`npx vitest run tests/ward-nav.test.ts tests/ward-landmarks.test.ts tests/ward-patient-page.dom.test.tsx`
passes, then `grep -rn "ward-flow/patients/" src tests` returns nothing.

**Falsifier.** Any reference to the old path survives anywhere in `src` or `tests`; or the route
count assertions were changed without the route map entries being changed; or a third name was
invented because nesting looked awkward.
