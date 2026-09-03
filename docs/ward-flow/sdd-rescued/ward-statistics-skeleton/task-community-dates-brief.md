# The community hub shows elapsed time, not calendar dates

**Owner-approved 2026-09-01.** Read
`.superpowers/sdd/ward-statistics-skeleton/recon-community-hub-dates.md` for the quoted evidence
behind every fact below — it was established read-only against `f8cd8d17b`.

## The ruling and its reason

The hub withholds two dates. The original reason — a demonstration clock that did not shift them,
so a shown date could be wrong — **is fixed**. The owner has ruled the information should appear as
**elapsed time** ("left 5 weeks ago"), never as a calendar date ("left 14 August"), because:

- The elapsed form carries the clinical signal. **A discharge with no follow-up arranged is normal
  yesterday and is the case this hub exists to surface at five weeks.** Without a duration the entry
  has no urgency and the page is a list of names.
- It cannot be mistaken for a real record of a real person the way a specific date can.
- It stays correct as the demo clock moves, with nobody maintaining it.

## Established ground — do not re-derive, but DO re-verify before editing

- Fields: `Admission.expectedDischargeAt` and `Admission.leftAt`, both `Instant | null`.
- Withheld in `community-screen.tsx`'s `expectedBackLabel()` and `departureLabel()`.
- `ward-reanchor.ts`'s `INSTANT_FIELDS` names **both**, shifted by the same `anchorOffsetMinutes`
  as `now`. **So the field and the clock agree and an elapsed calculation is sound.** This is the
  load-bearing fact; if it were false the whole change would be wrong.
- **No "N weeks ago" helper exists.** Nearest reusable pieces: `daysInBed`'s day-math, and
  `splitDuration` in `ward-clock.ts`. Its sibling `formatRemaining` is **explicitly barred from this
  screen** — read why before you consider it.

## ⚠️ The two fields are NOT the same shape, and this is the trap

`leftAt` is always past. `expectedDischargeAt` **can be past or future** — `isPastExpectedDischarge`
exists precisely because a person can be overdue. An elapsed renderer applied blindly produces
"left -3 days ago", and the overdue case is the clinically interesting one on this screen.

So: `leftAt` gets a past-only phrasing. `expectedDischargeAt` needs **both** directions, and the
overdue direction must read as overdue rather than as a negative number. Decide the two wordings
deliberately and say in your report what you chose.

## ⚠️ Eight or more pins WILL go red, and that is correct

At least eight assertions across `tests/ward-community-hub.dom.test.tsx` and
`tests/ward-community-corrected-claims.test.ts` pin the current withheld-date wording verbatim.
**They are deliberate tripwires for exactly this change.** Read each one's comment before rewriting
it — several say what should replace them. Rewriting a tripwire is the intended outcome; deleting
one without replacing its guarantee is not.

## Constraints

- **Files:** `community/community-screen.tsx`, `community/community-derivations.ts`,
  `tests/ward-community-*`, and a new helper module if you write one.
- **READ ONLY:** `ward-clock.ts`, `ward-reanchor.ts`, `ward-admissions.ts`, `statistics/**`,
  `ward-daily-sheet.tsx`. Read to verify; never edit.
- **One formatter, not two.** If you write an elapsed helper, it is the only one — a second
  formatter that rounds differently from the first is its own defect. If you can reuse
  `splitDuration`, do.
- **Null is not zero.** A record with no `leftAt` has no elapsed time; it renders the existing
  absence, not "0 days ago". The absence wording already on the screen is correct and stays.
- **No hand-written number in prose.** The numeral guard in `ward-community-corrected-claims.test.ts`
  will catch you, and it caught me in the paragraph telling readers not to do it.
- **Assert the ABSENCE of the old wording**, not only the presence of the new.
- **Round deliberately and pin the rounding.** "5 weeks ago" for 34 days and for 41 days are both
  defensible; what is not defensible is nobody knowing which. Write a test for the boundary.

## Gate

```
npx tsc -p tsconfig.typecheck.json --noEmit
npx vitest run $(ls tests/ward-community*.test.ts tests/ward-community*.test.tsx | tr '\n' ' ')
```

Echo the discovered list. Refuse an empty or under-five discovery. **Report the RAN count, not the
passed count, and state coverage in the RETURN, not only in the report.**
