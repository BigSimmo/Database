import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WARD_DIR = "src/components/ward-management";

/**
 * A bare clock face silently asserts TODAY, and this is the list of places allowed to make that
 * claim.
 *
 * WHY THIS EXISTS. `formatInstant` renders `14:00` whatever day the instant falls on - it wraps with
 * `((instant % 1440) + 1440) % 1440`. The wrap was never the whole defect: the defect is a display
 * making a claim about the day without checking it, so a patient who arrived three days ago reads as
 * this morning. `formatInstantWithDay(instant, now)` says the day out loud whenever it is not today,
 * and history surfaces were moved onto it on 2026-08-30.
 *
 * The sweep changed nothing visible, and that is exactly why this file exists. Every instant in the
 * current fixture falls on the opening day, so `formatInstantWithDay` returns the same bare clock
 * face everywhere and not one test moved. **A sweep no test can see is a sweep that silently
 * un-sweeps**, one helpful edit at a time, and nothing would go red.
 *
 * So the guard is on the CALL SITES rather than on rendered output: every remaining bare
 * `formatInstant` argument is named here with the reason it may assert today. A new one fails until
 * somebody decides which it is.
 */
const MAY_ASSERT_TODAY = new Map([
  ["now", "the current instant - today by definition"],
  ["liveNow", "the morning page's live view; the current instant under another name"],
  ["MORNING_HANDOVER_MINUTES", "08:00 of the day being shown, a constant time of day rather than a point in history"],
  ["snapshot.frozenAt", "the handover snapshot is taken and shown within one session"],
  ["confirmedAt", "ward-freshness renders a capacity confirmation beside its own staleness figure"],
  ["unit.allocatable.confirmedAt", "STILL TO SWEEP - a capacity confirmed yesterday would read as this morning"],
  ["detail.allocatable.confirmedAt", "STILL TO SWEEP - same field, network detail panel"],
  ["release.expectedAt", "STILL TO SWEEP - an expected release can fall tomorrow"],
  ["leaveBed.expectedReturn", "STILL TO SWEEP - a return from leave is routinely days away"],
  ["latestRefreshRequest.at", "STILL TO SWEEP - a refresh asked for yesterday reads as this morning"],
  ["legalForm.dueAt", "STILL TO SWEEP - needs `now` threaded into legalFormReadinessLine"],
  ["rejection.at", "STILL TO SWEEP - exception-drawer has no `now` in scope; needs a prop"],
  ["movement.transport.acceptedAt as Instant", "STILL TO SWEEP - transport accepted yesterday reads as today"],
  ["referral.decidedAt", "referral surface, owned by another session - not swept from here by agreement"],
  ["referral.localBedSought.at", "referral surface, owned by another session"],
]);

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...walk(full));
    else found.push(full);
  }
  return found;
}

function bareCallArguments(): string[] {
  const found: string[] = [];
  for (const file of walk(WARD_DIR).filter((name) => /\.tsx?$/.test(name))) {
    if (file.endsWith("ward-clock.ts")) continue;
    for (const match of readFileSync(file, "utf8").matchAll(/(?<!WithDay)\bformatInstant\(([^)]*)\)/g)) {
      found.push(match[1].trim());
    }
  }
  return found;
}

describe("nothing renders a bare clock face unless it is entitled to assert today", () => {
  it("knows what it is scanning, so it cannot pass by finding nothing", () => {
    // The canary. The assertion below passes by finding no unapproved argument, which reads
    // identically to a scan that matched no files or a regex that matched nothing at all.
    expect(bareCallArguments().length).toBeGreaterThan(15);
    expect(MAY_ASSERT_TODAY.size).toBeGreaterThan(10);
  });

  it("names every place still allowed to say a time without saying which day", () => {
    const unapproved = [...new Set(bareCallArguments())].filter((argument) => !MAY_ASSERT_TODAY.has(argument));

    expect(
      unapproved.sort(),
      "a new bare formatInstant call renders a clock face that ASSERTS today without checking. If " +
        "the instant can fall on another day, use formatInstantWithDay(instant, now). If it genuinely " +
        "cannot, add it to MAY_ASSERT_TODAY with the reason - which is a decision rather than a " +
        "formality, because the entries marked STILL TO SWEEP are exactly the ones somebody once " +
        "thought were safe.",
    ).toEqual([]);
  });

  it("keeps the swept surfaces swept, counting calls rather than mentions", () => {
    /*
     * The other direction, and its first draft was itself a check that could barely fail: it asserted
     * the file CONTAINED the string "formatInstantWithDay", which an unused import satisfies. Proved
     * by mutation - reverting the escalation board to a bare clock face left this green, because the
     * import line survived the edit. Counting CALLS is the property; mentioning the helper is not.
     *
     * These five files render history, and every instant in the fixture falls on the opening day, so
     * nothing here would go red from rendered output if a helpful edit put `formatInstant` back.
     */
    const swept = [
      "ward-management-console.tsx",
      "ward-management-modes.tsx",
      "coordinator/shortlist-panel.tsx",
      "escalation/escalation-board.tsx",
      "ward/ward-screen.tsx",
    ];
    for (const file of swept) {
      const source = readFileSync(join(WARD_DIR, file), "utf8");
      // Counted with a plain split rather than a regex: the first attempt at this line carried a
      // literal 0x08 backspace byte where a word boundary was intended, so it matched nothing and
      // reported every swept file as unswept. An escape that silently becomes a control character
      // is invisible in every diff and every review.
      const dayAware = source.split("formatInstantWithDay(").length - 1;
      expect(
        dayAware,
        `${file} renders history and no longer calls formatInstantWithDay. An entry from another ` +
          `day must say so rather than reading as this morning - and an import alone does not count, ` +
          `which is how the first version of this assertion passed a mutation it should have caught.`,
      ).toBeGreaterThan(0);
    }
  });
});
