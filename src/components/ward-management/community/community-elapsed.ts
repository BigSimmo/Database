/**
 * ONE PHRASE, FOR EVERY DURATION THIS HUB SPEAKS OUT LOUD.
 *
 * Owner-approved 2026-09-01: the community hub states elapsed time rather than a calendar date —
 * "left 5 weeks ago", never "left 14 August" — because the duration carries the clinical signal (a
 * discharge with no follow-up arranged is unremarkable at a day and is the case this hub exists to
 * surface at five weeks), because it cannot be mistaken for a real record of a real person the way a
 * specific date can, and because it stays correct as the demonstration clock moves with nobody
 * maintaining it. See `community-screen.tsx`'s file header for the full ruling.
 *
 * This module holds the ONE unit-rounding rule both withheld dates use. A second formatter that
 * rounds differently from this one would be its own defect — two screens, or two rows on the same
 * screen, disagreeing about how many days make a week is worse than either screen being wrong alone.
 */

/**
 * A whole number of elapsed days, in the coarsest unit a person would actually say out loud: days
 * under a week, whole weeks from a week on.
 *
 * Rounds DOWN, the same discipline `daysInBed` already holds for days — a duration reads as five
 * weeks only once the thirty-fifth day has actually completed, never on the thirty-fourth appearing
 * close enough. So the boundary is exact: six days plus 23 hours is still "6 days"; the moment a
 * seventh full day completes it becomes "1 week", and it stays "4 weeks" for the entire run up to
 * (not including) the twenty-ninth day, which is where "5 weeks" begins.
 *
 * `splitDuration` (`ward-clock.ts`) is not reused here: it has no week unit, and its `d`/`h` shape is
 * built for a stay measured in a single day or two, not a duration this screen expects to run into
 * months. Its day-math IS reused — this function's caller computes the day count with
 * `daysBetween`, the same floor-division `daysInBed` performs, so both figures agree with the rest
 * of the ward board.
 *
 * `days` must be at least 1: a same-day duration reads differently ("earlier today" / "later today")
 * and is decided by the caller, never by this function guessing at a plural.
 */
export function elapsedDaysPhrase(days: number): string {
  if (days < 7) return days === 1 ? "1 day" : `${days} days`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? "1 week" : `${weeks} weeks`;
}
