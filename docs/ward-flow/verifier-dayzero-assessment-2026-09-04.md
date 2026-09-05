# Ward Verifier — is `dayZero` a defect? 2026-09-04

**All measurement at `fffda3266`.**

**Answer: it is a latent hazard, not a defect today. Nothing currently depends on a calendar date
derived from `dayZero`. But the reason nothing depends on it is worse than the hazard.**

---

## FIRST, A CORRECTION TO MY OWN REPORT

I wrote that `dayZero` **"ignores `initialNow`"**, and Ward Lead is right that this implies a repair
that does not exist. `Instant` is `number` (`ward-clock.ts:22`) — **minutes measured against
`NOW_ANCHOR`, carrying no date at all.** So `dayZero` cannot be derived from `initialNow`; there is
nothing in it to derive from. The other three sites honour the pin by branching on `!== undefined`,
which is a different act from reading its value.

**The accurate statement is: `dayZero` reads the system clock unconditionally, and no pinned date
exists anywhere to read instead.** Any fix must introduce one, which changes what every
date-rendering surface shows in a deterministic render forever.

---

## THE MEASUREMENT WARD LEAD ASKED FOR

**Does anything assert against a calendar date derived from `dayZero`?** Three consumers exist:

| consumer                | renders                                   | asserted anywhere?              |
| ----------------------- | ----------------------------------------- | ------------------------------- |
| `handover-page.tsx:69`  | `formatSheetMoment` — "Thu, 4 Sep, 10:42" | **zero references in `tests/`** |
| `person-screen.tsx:201` | Age in years                              | one test, see below             |
| `ward-clock.ts:95,120`  | `calendarDateOf` / `formatSheetMoment`    | —                               |

`tests/ward-patient-model.test.ts:281-282` does assert exact ages, but it passes **its own explicit
`new Date(2026, 5, 1)`** and never touches `dayZero`. It is therefore independent of the hazard.

**So the answer to the question as put is: nothing. A fixed date would change no current test
output.** On that evidence `dayZero` is a hazard to record, not a defect to repair — and an invented
person whose age advances with the real calendar is arguably right rather than wrong.

---

## 🔴 BUT THE ONE TEST THAT LOOKS LIKE IT GUARDS THE AGE CANNOT FAIL

`tests/ward-person-screen.dom.test.tsx:76-81`:

```ts
// Age is DERIVED and never stored — `patientAgeYears` reads the date of birth. Asserted through
// the same function the screen uses, so a screen that stored or recomputed its own age would
// still have to agree with the one place this project derives it.
const age = patientAgeYears(someone, new Date(`${someone.dateOfBirth.slice(0, 4)}-01-01`));
expect(typeof age).toBe("number");
expect(identity).toHaveTextContent(/\d+\s*(years|year)/i);
```

**`age` is computed and then discarded.** Its only use is `typeof age === "number"`, which is true of
every number. The rendered value is checked against `/\d+\s*(years|year)/i` — **any digits followed
by "years"**. Nothing compares the two. And the date it passes is 1 January of the birth year, so
even if they were compared it would compare against roughly zero.

⚠️ **Its own comment asserts the opposite: _"a screen that … recomputed its own age would still have
to agree with the one place this project derives it."_ Nothing makes it agree.** This is the shape
where a true-sounding comment stands guard over the omission it shares with the code.

### MUTATION PROOF, WITH BOTH SIDES

`ward-patients.ts:76`, `return age;` → `return 999;`. Hash moved
`7f7903aeb…` → `fecf3920d…`, so the mutant provably applied.

```
❯ tests/ward-patient-model.test.ts (7 tests | 1 failed)
    × derives age from the stored date of birth rather than holding both
  AssertionError: on the birthday itself: expected 999 to be 36
  Test Files  1 failed | 1 passed (2)
       Tests  1 failed | 15 passed (16)
```

**The control fired** — `ward-patient-model.test.ts` caught it, which proves the mutant executed.
**`ward-person-screen.dom.test.tsx` stayed green**: the screen rendered **"999 years"** and the test
that claims to assert the age passed.

Restored, and `git hash-object` confirms `7f7903aeb1bf39bc362d1d65e49cf54ca302e47f` — byte-identical.

---

## WHAT THIS MEANS FOR THE DECISION

1. **Do not repair `dayZero` now.** It requires inventing a pinned date, its blast radius is every
   date-rendering surface, and nothing currently depends on it. **Record it.**
2. **Do repair the age assertion**, and that is the cheap one: compare the rendered text to the
   computed value, with a real "today". It costs one line and it converts a test that cannot fail
   into the guard its comment already claims it is.
3. ⚠️ **`dayZero` becomes a live defect the moment anything asserts a date.** Ward Builder Two names
   the Delays view, which is entirely about durations. **The order matters: fix the assertion first,
   because until it can fail, a future `dayZero` repair has nothing to prove it worked.**

**And the general point, which is why this was worth the detour: "nothing depends on it" was true,
and it was true for the wrong reason.** The measurement that answers a hazard question can be
satisfied by a guard that is incapable of depending on anything.
