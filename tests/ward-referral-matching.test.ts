// tests/ward-referral-matching.test.ts
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { referralEligibility } from "../src/components/ward-management/ward-eligibility";
import { referralCandidates } from "../src/components/ward-management/ward-referrals";
import type { Referral, Unit } from "../src/components/ward-management/ward-model";

const NOW = 10 * 60 + 42;

function unit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: "u-test",
    siteCode: "RPH",
    name: "Test Unit",
    cohort: "Adult",
    security: "Open",
    authorised: true,
    beds: 20,
    empty: { value: 3, source: "feed", confirmedAt: NOW - 2, staleAfterMinutes: 15 },
    allocatable: { value: 2, source: "ward", confirmedAt: NOW - 10, staleAfterMinutes: 120 },
    held: 0,
    blocked: 0,
    sexMix: { Female: 10, Male: 8 },
    speciallingCapacity: 1,
    sexDesignation: "Undesignated",
    forensic: false,
    ...overrides,
  };
}

function referral(overrides: Partial<Referral> = {}): Referral {
  return {
    id: "RF-TEST",
    ageBand: "Adult",
    sex: "Female",
    secureBedNeeded: false,
    involuntaryBedNeeded: false,
    homeRegion: "Perth Metropolitan",
    source: "community",
    raisedAt: NOW - 30,
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: false,
    state: "queued",
    ...overrides,
  };
}

function gate(verdict: ReturnType<typeof referralEligibility>, name: string) {
  return verdict.gates.find((g) => g.gate === name);
}

describe("age", () => {
  it("accepts a referral whose age band matches the unit's cohort", () => {
    const verdict = referralEligibility(referral({ ageBand: "Older adult" }), unit({ cohort: "Older adult" }), NOW);
    expect(gate(verdict, "age")?.pass).toBe(true);
  });

  it("rejects a referral whose age band does not match the unit's cohort", () => {
    const verdict = referralEligibility(referral({ ageBand: "Youth" }), unit({ cohort: "Adult" }), NOW);
    expect(gate(verdict, "age")?.pass).toBe(false);
  });

  it("gives the age gate a different detail string on pass than on fail", () => {
    const passing = referralEligibility(referral({ ageBand: "Adult" }), unit({ cohort: "Adult" }), NOW);
    const failing = referralEligibility(referral({ ageBand: "Youth" }), unit({ cohort: "Adult" }), NOW);
    expect(gate(passing, "age")?.detail).not.toBe(gate(failing, "age")?.detail);
  });
});

describe("legal_status", () => {
  // D3 rule 2 / spec's second most important test: a referral that does NOT need an involuntary
  // bed is accepted by ANY bed, authorised or not — this is the "not needed" half of the
  // accepts-rule, and it is what makes the rule an accepts-rule rather than an equality. Mutating
  // the gate to strict equality (`unit.authorised === referral.involuntaryBedNeeded`) breaks
  // exactly this case, because an authorised unit would then wrongly refuse a referral that
  // doesn't need one.
  it("a referral that does not need an involuntary bed is accepted by an authorised unit", () => {
    const verdict = referralEligibility(referral({ involuntaryBedNeeded: false }), unit({ authorised: true }), NOW);
    expect(gate(verdict, "legal_status")?.pass).toBe(true);
  });

  it("a referral that does not need an involuntary bed is also accepted by an unauthorised (voluntary-only) unit", () => {
    const verdict = referralEligibility(referral({ involuntaryBedNeeded: false }), unit({ authorised: false }), NOW);
    expect(gate(verdict, "legal_status")?.pass).toBe(true);
  });

  // The "needed" half of the accepts-rule: only a bed that can hold someone involuntarily may
  // accept it. This is the case a bare "always pass" gate (the dimension's pre-Phase-7 state) can
  // never catch, because it would pass here too.
  it("a referral that needs an involuntary bed is accepted by an authorised unit", () => {
    const verdict = referralEligibility(referral({ involuntaryBedNeeded: true }), unit({ authorised: true }), NOW);
    expect(gate(verdict, "legal_status")?.pass).toBe(true);
  });

  it("a referral that needs an involuntary bed is refused by an unauthorised (voluntary-only) unit", () => {
    const verdict = referralEligibility(referral({ involuntaryBedNeeded: true }), unit({ authorised: false }), NOW);
    expect(gate(verdict, "legal_status")?.pass).toBe(false);
  });

  it("gives the legal_status gate a different detail string for an authorised unit than an unauthorised one, when a referral needs an involuntary bed", () => {
    const authorised = referralEligibility(referral({ involuntaryBedNeeded: true }), unit({ authorised: true }), NOW);
    const unauthorised = referralEligibility(
      referral({ involuntaryBedNeeded: true }),
      unit({ authorised: false }),
      NOW,
    );
    expect(gate(authorised, "legal_status")?.detail).not.toBe(gate(unauthorised, "legal_status")?.detail);
  });

  // Positive shape, not a denylist of judging fragments — the same fix as the forensic gate's
  // test below (H5): a fragment denylist (`/patient|person|unsuitable|assessed/i`) survives an
  // unbounded number of other ways to phrase the same judgement. The two branches that make a
  // specific judgement about THIS bed also name it, so a coordinator reading the detail knows
  // which unit it is talking about.
  it("neither detail string judges the person — both describe the bed or the requirement", () => {
    const authorised = referralEligibility(referral({ involuntaryBedNeeded: true }), unit({ authorised: true }), NOW);
    const unauthorised = referralEligibility(
      referral({ involuntaryBedNeeded: true }),
      unit({ authorised: false }),
      NOW,
    );
    const notNeeded = referralEligibility(referral({ involuntaryBedNeeded: false }), unit({ authorised: true }), NOW);

    expect(gate(authorised, "legal_status")?.detail).toContain("Test Unit");
    expect(gate(unauthorised, "legal_status")?.detail).toContain("Test Unit");

    for (const detail of [
      gate(authorised, "legal_status")?.detail,
      gate(unauthorised, "legal_status")?.detail,
      gate(notNeeded, "legal_status")?.detail,
    ]) {
      expect(detail).toBeDefined();
      expect(detail?.toLowerCase()).not.toMatch(/\b(referral|patient|they|them|person)\b/);
    }
  });
});

describe("sex_designation", () => {
  // Most beds are undesignated, so a rule of the form `bed.sexDesignation === referral.sex` would
  // exclude every referral from most of the network while looking entirely reasonable in review.
  // This test exists to make that mistake impossible to ship.
  it("an undesignated bed accepts a referral of either sex", () => {
    const bed = unit({ sexDesignation: "Undesignated" });
    for (const sex of ["Female", "Male"] as const) {
      const verdict = referralEligibility(referral({ sex }), bed, NOW);
      expect(gate(verdict, "sex_designation")?.pass).toBe(true);
    }
  });

  it("a Female only bed accepts a female referral and rejects a male referral", () => {
    const bed = unit({ sexDesignation: "Female only" });
    expect(gate(referralEligibility(referral({ sex: "Female" }), bed, NOW), "sex_designation")?.pass).toBe(true);
    expect(gate(referralEligibility(referral({ sex: "Male" }), bed, NOW), "sex_designation")?.pass).toBe(false);
  });

  it("a Male only bed accepts a male referral and rejects a female referral", () => {
    const bed = unit({ sexDesignation: "Male only" });
    expect(gate(referralEligibility(referral({ sex: "Male" }), bed, NOW), "sex_designation")?.pass).toBe(true);
    expect(gate(referralEligibility(referral({ sex: "Female" }), bed, NOW), "sex_designation")?.pass).toBe(false);
  });
});

/**
 * D4: `sex_designation` (a property of the bed) and `sex_mix` (an occupancy fact) answer
 * different questions, neither is derived from the other, and neither replaces the other. These
 * two tests each construct a unit that passes one gate while failing the other, in each
 * direction, so a future collapse of the two gates into one fails here immediately.
 */
describe("sex_designation and sex_mix are independent", () => {
  it("a unit can pass sex_designation while failing sex_mix", () => {
    const bed = unit({
      sexDesignation: "Undesignated",
      sexMix: { Female: 0, Male: 5 },
      allocatable: { value: 1, source: "ward", confirmedAt: NOW - 5, staleAfterMinutes: 60 },
    });
    const verdict = referralEligibility(referral({ sex: "Female" }), bed, NOW);
    expect(gate(verdict, "sex_designation")?.pass).toBe(true);
    expect(gate(verdict, "sex_mix")?.pass).toBe(false);
  });

  it("a unit can fail sex_designation while passing sex_mix", () => {
    const bed = unit({
      sexDesignation: "Female only",
      sexMix: { Female: 0, Male: 5 },
      allocatable: { value: 1, source: "ward", confirmedAt: NOW - 5, staleAfterMinutes: 60 },
    });
    const verdict = referralEligibility(referral({ sex: "Male" }), bed, NOW);
    expect(gate(verdict, "sex_designation")?.pass).toBe(false);
    expect(gate(verdict, "sex_mix")?.pass).toBe(true);
  });
});

describe("forensic", () => {
  it("a forensic bed never accepts a Phase 7 referral", () => {
    const verdict = referralEligibility(referral(), unit({ forensic: true }), NOW);
    expect(gate(verdict, "forensic")?.pass).toBe(false);
  });

  it("a non-forensic bed passes the forensic gate", () => {
    const verdict = referralEligibility(referral(), unit({ forensic: false }), NOW);
    expect(gate(verdict, "forensic")?.pass).toBe(true);
  });

  // A denylist of judging fragments (the pre-fix-round-A version of this test checked only
  // `/unsuitable|assessed|not appropriate/`) survives an unbounded number of other ways to phrase
  // the same judgement — "This referral is not suitable for a forensic bed" contains none of
  // those three fragments. Asserted as the POSITIVE shape instead: the detail names the unit, and
  // contains none of the words that would put the judgement on the person rather than the bed.
  it("the forensic gate's detail names the bed and never judges the person", () => {
    const verdict = referralEligibility(referral(), unit({ forensic: true, name: "Bunbury Adult Secure" }), NOW);
    const detail = gate(verdict, "forensic")?.detail ?? "";
    expect(detail).toContain("Bunbury Adult Secure");
    expect(detail.toLowerCase()).not.toMatch(/\b(referral|patient|they|them|person)\b/);
  });
});

describe("security (secureBedNeeded)", () => {
  it("accepts a secure-bed-needed referral into a Secure unit", () => {
    const verdict = referralEligibility(referral({ secureBedNeeded: true }), unit({ security: "Secure" }), NOW);
    expect(gate(verdict, "security")?.pass).toBe(true);
  });

  it("rejects a secure-bed-needed referral from an Open unit", () => {
    const verdict = referralEligibility(referral({ secureBedNeeded: true }), unit({ security: "Open" }), NOW);
    expect(gate(verdict, "security")?.pass).toBe(false);
  });

  it("accepts a referral not needing a secure bed into an Open unit", () => {
    const verdict = referralEligibility(referral({ secureBedNeeded: false }), unit({ security: "Open" }), NOW);
    expect(gate(verdict, "security")?.pass).toBe(true);
  });
});

describe("reused gates carry over unchanged", () => {
  it("refuses when no same-sex occupants and only one allocatable bed (sex_mix)", () => {
    const bed = unit({
      sexMix: { Female: 0, Male: 4 },
      allocatable: { value: 1, source: "ward", confirmedAt: NOW - 5, staleAfterMinutes: 60 },
    });
    const verdict = referralEligibility(referral({ sex: "Female" }), bed, NOW);
    expect(gate(verdict, "sex_mix")?.pass).toBe(false);
  });

  it("a referral always passes specialling, since it carries no specialling-need fact", () => {
    const verdict = referralEligibility(referral(), unit({ speciallingCapacity: 0 }), NOW);
    expect(gate(verdict, "specialling")?.pass).toBe(true);
  });

  // I1: a referral carries no specialling-need fact at all — nobody entered one and the record
  // does not hold it. The gate's detail must say that about the RECORD, not assert "No
  // specialling required" as though the absence of a fact were itself a clinical finding about
  // the person. "required"/"not required" are the fabricated-certainty words this guards against.
  it("the specialling gate's detail describes what the record holds, not a fabricated clinical fact", () => {
    const verdict = referralEligibility(referral(), unit({ speciallingCapacity: 0 }), NOW);
    const detail = gate(verdict, "specialling")?.detail ?? "";
    expect(detail.toLowerCase()).not.toMatch(/\brequired\b/);
    expect(detail.toLowerCase()).toMatch(/not recorded|no.*fact|unknown/);
  });

  it("drops a unit whose allocatable figure has gone stale rather than showing it hopefully", () => {
    const stale = unit({ allocatable: { value: 4, source: "ward", confirmedAt: NOW - 200, staleAfterMinutes: 120 } });
    const verdict = referralEligibility(referral(), stale, NOW);
    expect(gate(verdict, "capacity_freshness")?.pass).toBe(false);
  });

  it("refuses a unit with zero allocatable beds", () => {
    const empty = unit({ allocatable: { value: 0, source: "ward", confirmedAt: NOW - 5, staleAfterMinutes: 60 } });
    const verdict = referralEligibility(referral(), empty, NOW);
    expect(gate(verdict, "allocatable_bed")?.pass).toBe(false);
  });

  // C2: `allocatable` and `empty` are only documented to agree "in practice" — CONFIRM_CAPACITY
  // can raise `allocatable.value` back above `empty.value` after PATIENT_ARRIVED has already
  // consumed the physically empty beds. This unit constructs exactly that divergence: two
  // allocatable beds on paper, zero beds actually empty. A gate reading `unit.allocatable.value
  // > 0` alone would wrongly pass this unit while the capacity board (which reads
  // `availableNow = Math.min(allocatable, empty)`) correctly says zero — two screens, two
  // answers, from the same state. `availableNow` must be the one the referral-matching gate uses.
  it("refuses a unit whose allocatable figure has not caught up with zero physically empty beds", () => {
    const divergent = unit({
      allocatable: { value: 2, source: "ward", confirmedAt: NOW - 5, staleAfterMinutes: 60 },
      empty: { value: 0, source: "feed", confirmedAt: NOW - 2, staleAfterMinutes: 15 },
    });
    const verdict = referralEligibility(referral(), divergent, NOW);
    expect(gate(verdict, "allocatable_bed")?.pass).toBe(false);
  });

  // I4 (fix round C, F3): the same `allocatable` / `availableNow` divergence C2 closed for
  // `allocatable_bed`, one gate over. A ward confirms 3 allocatable beds and then takes two
  // arrivals — `PATIENT_ARRIVED` decrements `empty` and leaves `allocatable` untouched — so
  // `allocatable: 3, empty: 1` and `availableNow: 1`. `allocatable_bed` correctly passes: there
  // IS one bed. `sex_mix` must fail, because its own user-visible detail says "needs more than
  // one free bed" and there is exactly one; reading `unit.allocatable.value > 1` instead passed
  // it, showing "Accepts this referral" for a lone female referral onto a ward with no other free
  // bed, while the capacity board (reading `availableNow`) said 1 — two screens, two answers,
  // from the same state. `allocatable_bed` is asserted to PASS here so this test can only go red
  // for the reason it names.
  it("refuses on sex_mix when the only free bed is the last one, even though allocatable still reads three", () => {
    const divergent = unit({
      sexMix: { Female: 0, Male: 5 },
      allocatable: { value: 3, source: "ward", confirmedAt: NOW - 5, staleAfterMinutes: 60 },
      empty: { value: 1, source: "feed", confirmedAt: NOW - 2, staleAfterMinutes: 15 },
    });
    const verdict = referralEligibility(referral({ sex: "Female" }), divergent, NOW);
    expect(gate(verdict, "allocatable_bed")?.pass).toBe(true);
    expect(gate(verdict, "sex_mix")?.pass).toBe(false);
    expect(verdict.eligible).toBe(false);
  });

  it("passes every gate for a well-matched referral", () => {
    const verdict = referralEligibility(referral(), unit(), NOW);
    expect(verdict.eligible).toBe(true);
    expect(verdict.gates.every((g) => g.pass)).toBe(true);
  });
});

describe("referralCandidates", () => {
  it("returns every unit, never a truncated list", () => {
    const units = [unit({ id: "u1" }), unit({ id: "u2" }), unit({ id: "u3" })];
    const candidates = referralCandidates(referral(), units, NOW);
    expect(candidates).toHaveLength(units.length);
    expect(candidates.map((c) => c.unit.id)).toEqual(["u1", "u2", "u3"]);
  });

  it("preserves the given order rather than sorting or ranking by suitability", () => {
    const units = [
      unit({ id: "u3", cohort: "Youth" }), // would not match — an ordering that "helpfully"
      unit({ id: "u1", cohort: "Adult" }), // sorted matches first would read as a recommendation
      unit({ id: "u2", cohort: "Adult" }),
    ];
    const candidates = referralCandidates(referral({ ageBand: "Adult" }), units, NOW);
    expect(candidates.map((c) => c.unit.id)).toEqual(["u3", "u1", "u2"]);
  });

  it("pairs each unit with its own verdict", () => {
    const units = [unit({ id: "match", cohort: "Adult" }), unit({ id: "mismatch", cohort: "Youth" })];
    const candidates = referralCandidates(referral({ ageBand: "Adult" }), units, NOW);
    expect(candidates.find((c) => c.unit.id === "match")?.verdict.eligible).toBe(true);
    const mismatchVerdict = candidates.find((c) => c.unit.id === "mismatch")?.verdict;
    expect(mismatchVerdict && gate(mismatchVerdict, "age")?.pass).toBe(false);
  });
});

/**
 * Spec D15 / the fourth most important test: matching must stay independent of the bed-release
 * model — three stages plus a blocked flag since the rework of 2026-08-28, and still unvalidated
 * by any ward clinician. The contract is unchanged by that rework, and deliberately so: the
 * whole point of D15 is that matching does not care what shape the release model is today. A source-text contract rather
 * than a runtime assertion, because the whole point is that no code path reachable from matching
 * reads that model AT ALL — not even one that happens to agree with `unit.allocatable` today.
 *
 * H1 fix (this test was hollow): the identifier pattern used to check only the bare `BedRelease`,
 * `BED_RELEASE_STATES` and `BED_RELEASE_CONFIDENCE_LEVELS` spellings — `\bBedRelease\b` requires
 * a word boundary immediately after "BedRelease", so `BedReleaseState`, `BedReleaseConfidence`,
 * `releaseBand`/`RELEASE_BANDS` and `capacityBreakdown` (which takes `BedRelease[]`) all survived
 * it untouched. The pattern below enumerates every spelling that actually names a piece of the
 * release model, EXACTLY — not a `\bBedRelease\w*\b` wildcard, which would also catch
 * `BedReleaseBlocker`/`BED_RELEASE_BLOCKERS` (`ward-change-reasons.ts`, imported by
 * `ward-model.ts`, which every referral/unit type comes from): a real, necessary, unrelated
 * import that has nothing to do with the release model matching must avoid. Confirmed with
 * `node -e` in isolation before use, not asserted.
 *
 * The two hand-listed file paths were the second hollow half: a third file added to the import
 * chain between `ward-eligibility.ts`/`ward-referrals.ts` and the model it reads was invisible to
 * a test that only ever opened those two exact paths. `collectModuleGraph` below instead starts
 * at those two entry points — legitimately named, since they ARE the matching implementation —
 * and follows every local (`@/…` or `./…`) import transitively, so a new file introduced anywhere
 * in that chain is checked automatically rather than needing to be added to a list by hand.
 *
 * Checked against `import` statements specifically (not the whole file) so this test does not
 * collide with a doc comment that names `BedRelease` in prose, the way the naive whole-file
 * check first written here did — that version failed on this file's OWN explanatory comment
 * about staying independent of the release model, which is exactly the false positive a
 * structural test must not produce.
 */
describe("matching stays independent of the bed-release model", () => {
  const BED_RELEASE_IDENTIFIER =
    /\bBedRelease\b|\bBedReleaseState\b|\bBedReleaseConfidence\b|\bBED_RELEASE_STATES\b|\bBED_RELEASE_CONFIDENCE_LEVELS\b|\breleaseBand\b|\bRELEASE_BANDS\b|\bcapacityBreakdown\b/;

  const SRC_ROOT = resolve(process.cwd(), "src");

  function importStatementsOf(source: string): string[] {
    return source.match(/import\s+[\s\S]*?;/g) ?? [];
  }

  function importsMention(source: string, needle: RegExp) {
    return importStatementsOf(source).some((statement) => needle.test(statement));
  }

  function specifierOf(statement: string): string | null {
    const match = statement.match(/from\s+["']([^"']+)["']/);
    return match ? match[1] : null;
  }

  /** Resolves a `@/…` or relative import specifier to a real file on disk, trying each extension
   *  TypeScript's own resolution would. Returns null for a bare package specifier (react,
   *  vitest, node:fs, …) — those are not part of this project's own module graph. */
  function resolveLocalImport(specifier: string, fromFile: string): string | null {
    let base: string;
    if (specifier.startsWith("@/")) {
      base = resolve(SRC_ROOT, specifier.slice(2));
    } else if (specifier.startsWith(".")) {
      base = resolve(dirname(fromFile), specifier);
    } else {
      return null;
    }
    const candidates = [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
    return candidates.find((candidate) => existsSync(candidate)) ?? null;
  }

  /** Every file transitively reachable from `entryFiles` via local imports, mapped to its own
   *  source text — the module graph the D15 contract must hold across, not just the two files
   *  someone remembered to list by hand. */
  function collectModuleGraph(entryFiles: string[]): Map<string, string> {
    const visited = new Map<string, string>();
    const queue = [...entryFiles];
    while (queue.length > 0) {
      const file = queue.shift()!;
      if (visited.has(file)) continue;
      const source = readFileSync(file, "utf8");
      visited.set(file, source);
      for (const statement of importStatementsOf(source)) {
        const specifier = specifierOf(statement);
        if (!specifier) continue;
        const resolved = resolveLocalImport(specifier, file);
        if (resolved && !visited.has(resolved)) queue.push(resolved);
      }
    }
    return visited;
  }

  it("no file reachable from referral matching's own imports mentions the release model", () => {
    // KNOWN LIMIT, named rather than left implicit (review finding I2, second residual), in the
    // style the legal-figure guard already uses: these two entry points are hand-maintained.
    // They ARE the matching implementation, so a file reached FROM them is covered automatically
    // by the traversal below — but a future matching module imported only by, say,
    // `referral-match.tsx` would sit outside this graph entirely and would need adding here.
    const entryFiles = [
      resolve(process.cwd(), "src/components/ward-management/ward-eligibility.ts"),
      resolve(process.cwd(), "src/components/ward-management/ward-referrals.ts"),
    ];
    const graph = collectModuleGraph(entryFiles);

    // Sanity check on the TRAVERSAL itself, not just the assertion it feeds.
    //
    // Review finding I2: this used to read `expect(graph.size).toBeGreaterThanOrEqual(2)`, and
    // `entryFiles` holds two files that are both seeded unconditionally into the queue and both
    // read successfully — so `graph.size` could never be below 2 and the check could not fail.
    // Forcing `resolveLocalImport` to return `null` (the exact "stopped following imports"
    // mutation its own comment named) collapsed the graph from 5 files to 2 and the test stayed
    // green with zero offenders: precisely the hand-listed-pair state this traversal replaced.
    //
    // The floor below is what the check actually claims — that files are reached TRANSITIVELY,
    // beyond the two entry points. `ward-model.ts` is named because it is reached only through
    // an import chain (neither entry file is it), so a broken resolver cannot produce it; the
    // count is `>=`, never `===`, so adding a legitimate import never turns this red.
    const transitivelyReached = [...graph.keys()].filter((file) => !entryFiles.includes(file));
    expect(transitivelyReached.map((file) => basename(file)).sort()).toContain("ward-model.ts");
    expect(graph.size).toBeGreaterThanOrEqual(5);

    const offenders = [...graph.entries()].filter(([, source]) => importsMention(source, BED_RELEASE_IDENTIFIER));
    expect(offenders.map(([file]) => file)).toEqual([]);
  });
});
