import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Instant } from "@/components/ward-management/ward-clock";
import { BED_RELEASE_BLOCKERS, type BedReleaseBlocker } from "@/components/ward-management/ward-change-reasons";
import { handoverSnapshot, isOpen } from "@/components/ward-management/ward-derivations";
import type { BedRelease, DeclineReason, Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import { DECLINE_REASONS } from "@/components/ward-management/ward-model";

/**
 * THE ARITHMETIC BEHIND THE COORDINATOR STATISTICS SCREEN — and nothing else.
 *
 * Every function here is pure: collections in, numbers out. No React, no clock, no I/O, and above
 * all **no substituted value**. This is the module behind the one screen whose entire purpose is
 * being believed, so the standing rule is narrower than "be careful":
 *
 * ⚠️ **NOTHING HERE EVER RETURNS A NUMBER IT DID NOT MEASURE.** No default, no fallback, no
 * interpolation, no "reasonable" zero standing in for an absence. An average with nothing to
 * average is `null`, never `0` — the same discipline `ward-statistics.ts` already documents at
 * length, held here for the same reason: a ward with no measured arrivals does not have an average
 * transport delay of nought minutes, it has no average at all, and the two claims are different.
 *
 * ⚠️ **A COUNT OF ZERO IS A REAL ANSWER AND IS TYPED AS ONE.** Every `number` field below is a
 * genuine count where `0` is true and correct; every `number | null` field is an average or an
 * extreme where `null` means "nothing to measure". The two are separated in the TYPE so a screen
 * cannot render one as the other by accident — which is the single most likely way this page could
 * lie, because "no ward declined" and "declines cannot be counted" look identical once they have
 * both been flattened to a dash.
 *
 * ⚠️ **NO FIGURE HERE IS COMPARED AGAINST A TARGET, A THRESHOLD OR A BENCHMARK.** There is no
 * "good", no "breach", no ranking of one ward against another, and nothing here may acquire one:
 * a target on this screen would be a number nobody agreed to, rendered where it is believed
 * hardest.
 */

/**
 * Where an admission sits in the bed lifecycle, named by what has HAPPENED rather than by the
 * state's own word.
 *
 * ⚠️ **THIS TYPE AND `admissionStagePosition` BELOW ARE THE ONLY PLACE IN THIS FEATURE WHERE AN
 * `AdmissionState` VALUE IS READ.** `"left"` HAS BEEN renamed to `"departed"` — it landed in the
 * merge of 2026-09-01 — and the rename is the whole argument for routing every read through one
 * exhaustive switch: it was one line here and a compile error everywhere it was missed, rather
 * than a comparison that silently stops matching and quietly turns a count into a smaller, still
 * plausible one. A `case` for a member that no longer exists fails `tsc`; a stray
 * `admission.state === "left"` in a component would not.
 */
export type AdmissionStagePosition = "no-bed-yet" | "bed-given-not-arrived" | "in-the-bed" | "ended";

/**
 * The single site where an `AdmissionState` value appears in this feature. Exhaustive over the
 * union deliberately: a member added, removed or renamed must be decided here, by hand, once.
 *
 * ⚠️ **THE `default:` ARM IS NOT DEFENSIVE PADDING — IT IS THE ONLY THING THAT FAILS DURING A
 * HALF-LANDED RENAME.** Without it this function returns `undefined` for an unrecognised member,
 * and an adversarial check proved the whole suite stays green on exactly that: rename `"left"` to
 * `"departed"` in `ADMISSION_STATES` and the seed, leave the stale `case "left"` here, and the
 * member-driven test compares `undefined` against `EXPECTED["departed"]`, which is ALSO
 * `undefined`. Twelve mutations, this one survived. The cost is not abstract — seeded departed
 * admissions carry both instants, so they would stay in the average and stop counting as ended,
 * and the page would render "0 of the measured admissions have since ended", inverting the one
 * caveat that stops a historical figure being read as tonight's ward.
 *
 * `tsc` does catch it. **Vitest does not run `tsc`**, and the suite is what people run, so the
 * type error alone is not enough: this arm makes the same mistake throw where the tests can see it.
 */
export function admissionStagePosition(admission: Admission): AdmissionStagePosition {
  switch (admission.state) {
    case "waitlisted":
      return "no-bed-yet";
    case "pulled":
      return "bed-given-not-arrived";
    case "occupied":
      return "in-the-bed";
    case "departed":
      return "ended";
    default: {
      // `never` here is the compile-time half: a widened or renamed union stops being assignable
      // and `tsc` fails on this line. The throw beneath it is the runtime half, for every reader
      // who runs the suite rather than the typechecker.
      const unhandled: never = admission.state;
      throw new Error(
        `admissionStagePosition: no stage position for admission state ${JSON.stringify(unhandled)} — ` +
          `add its case here rather than letting the figure quietly change meaning.`,
      );
    }
  }
}

/**
 * How long it took between a ward giving a bed away and the person physically arriving in it.
 *
 * A CLINICIAN'S question, not a policy maker's: it is time a named person spent waiting somewhere
 * else — usually an emergency department — while a bed already assigned to them stood empty.
 */
export type PullToArrival = {
  /**
   * How many admissions carry BOTH a `pulledAt` and an `arrivedAt`. The population the average is
   * computed over, rendered beside it so a mean of one is never read as a mean of many. A count:
   * `0` is a true answer and means no admission has both instants, not that the figure is
   * unavailable.
   */
  measuredCount: number;
  /**
   * The mean gap in minutes, or `null` when `measuredCount` is nought. **Never `0` for an empty
   * population** — see this module's doc comment.
   */
  averageMinutes: number | null;
  /** The smallest measured gap, or `null` when there is none. */
  shortestMinutes: number | null;
  /** The largest measured gap, or `null` when there is none. */
  longestMinutes: number | null;
  /**
   * How many of the measured admissions have since ended. Reported because this figure is
   * deliberately HISTORICAL — a completed pull-to-arrival gap is a fact whatever became of the
   * admission afterwards — and a reader who assumed it described tonight's ward would be reading a
   * different statistic from the one computed.
   */
  endedCount: number;
  /**
   * Beds given away where the person has not arrived yet. They contribute NOTHING to the average,
   * on purpose: their gap is still running, so it is not yet a measured fact. Counted and shown
   * rather than dropped silently, because a figure that quietly excludes the people currently
   * waiting longest is the flattering half of the truth.
   */
  awaitingArrivalCount: number;
  /**
   * Admissions carrying BOTH instants where the arrival is EARLIER than the pull — a record that
   * cannot be true, since a bed cannot be given away after the person is already in it. Excluded
   * from every figure above and counted here instead. A count: `0` is a true answer.
   *
   * ⚠️ **THIS IS WHY THERE IS NO `Math.max(0, …)` IN THIS MODULE.** Ward Lead ruled on 2026-09-01
   * that clamping is the defect: it does not make a bad number safe, it makes it invisible,
   * converting "this record cannot be true" into "this patient waited no time at all" — which is
   * then averaged in as a real measurement of no wait, on the screen least likely to be re-checked.
   *
   * ⚠️ **THIS PARAGRAPH DESCRIBED A DIVERGENCE FROM `averageEmptyBedMinutes` UNTIL THE MERGE OF
   * 2026-09-01, AND THAT DIVERGENCE NO LONGER EXISTS.** It said that function "measures the same
   * two instants and clamps a negative gap to nought", which was true when this module was
   * written; `ward-statistics.ts` has since had the clamp removed under the same ruling and now
   * returns `null` for a negative gap. The two modules agree. The claims register caught this
   * rather than a reader, which is the whole of what it is for — the arithmetic here never moved,
   * only a sentence about somebody else's file, which is exactly the kind of claim that goes false
   * with nothing red beside it.
   */
  incoherentCount: number;
};

/**
 * `pulledAt` -> `arrivedAt`, and ONLY those two instants.
 *
 * ⚠️ Takes no `now`, and must never be given one. `pulledAt` -> `now` would keep growing after the
 * person had already arrived, overstating the figure by however long ago they got there; that exact
 * substitution is documented as a live trap in `ward-statistics.ts` and is impossible here because
 * the clock is not in scope.
 *
 * ⚠️ **A NEGATIVE GAP IS EXCLUDED AND COUNTED, NEVER CLAMPED.** See `incoherentCount` above for the
 * ruling. An arrival before the pull is a record that cannot be true; `Math.max(0, …)` would fold
 * it into the average as a genuine measurement of no wait at all, which is both wrong and
 * undetectable.
 *
 * Non-finite instants are skipped rather than coerced — no answer, never a substituted one.
 */
export function pullToArrival(admissions: Admission[]): PullToArrival {
  const gaps: number[] = [];
  let endedCount = 0;
  let awaitingArrivalCount = 0;
  let incoherentCount = 0;

  for (const admission of admissions) {
    if (admissionStagePosition(admission) === "bed-given-not-arrived") awaitingArrivalCount += 1;

    const { pulledAt, arrivedAt } = admission;
    if (pulledAt === null || arrivedAt === null) continue;
    if (!Number.isFinite(pulledAt) || !Number.isFinite(arrivedAt)) continue;

    const gap = arrivedAt - pulledAt;
    if (gap < 0) {
      incoherentCount += 1;
      continue;
    }

    gaps.push(gap);
    if (admissionStagePosition(admission) === "ended") endedCount += 1;
  }

  if (gaps.length === 0) {
    return {
      measuredCount: 0,
      averageMinutes: null,
      shortestMinutes: null,
      longestMinutes: null,
      endedCount: 0,
      awaitingArrivalCount,
      incoherentCount,
    };
  }

  const total = gaps.reduce((sum, gap) => sum + gap, 0);
  return {
    measuredCount: gaps.length,
    averageMinutes: total / gaps.length,
    shortestMinutes: Math.min(...gaps),
    longestMinutes: Math.max(...gaps),
    endedCount,
    awaitingArrivalCount,
    incoherentCount,
  };
}

/**
 * WHETHER THE JOIN FROM AN ADMISSION BACK TO THE REFERRAL IT CAME FROM CAN CARRY A DURATION.
 *
 * ⚠️ **THIS IS NOT A DURATION AND MUST NEVER BECOME ONE.** It measures the join, not the wait.
 * Nothing here subtracts a referral instant from an admission instant, and nothing may be added
 * that does, until the pairs below are established as the same person — which they currently are
 * not, in a way this function exists to keep visible.
 *
 * ⚠️ **A MATCHING ID IS NOT EVIDENCE THAT TWO RECORDS ARE THE TWO ENDS OF ONE WAIT.** An exact
 * match establishes that an admission names a referral on record and nothing further. It does not
 * establish that the referral is the request that PRODUCED the bed: a referral raised about
 * somebody already in the bed matches just as well, carries just as good an instant, and dates the
 * wrong event. The only discriminator available to arithmetic is whether the referral was raised
 * before the person arrived — a necessary condition and nowhere near a sufficient one — which is
 * why `chronologicallyCoherentCount` is reported on its own rather than used as a licence to
 * average.
 *
 * ⚠️ **THIS COMMENT DESCRIBED THE FIXTURE UNTIL 2026-09-01, AND THAT IS THE DEFECT RATHER THAN THE
 * WORDING.** It asserted a count of accidental id collisions, how they arose, and that arrivals
 * preceded referrals by weeks. Each was a fact about seed data, each was wrong or became wrong, and
 * nothing went red for any of them — a fixture is not a contract. The refusal was correct every
 * time it was misexplained, which is exactly what makes this class of defect survive a green suite.
 * So nothing here states what the seed contains: the counts below are measurements, the screen
 * RENDERS them rather than writing them into prose, and both stay true across the next fixture
 * change.
 *
 * An implementation that took an absolute value, or clamped a negative gap at nought, would turn
 * the wrong event into a confident average on the one screen where a plausible figure is never
 * re-checked. That is why this function returns counts and no duration at all.
 */
export type ReferralToBedJoin = {
  /** Admissions carrying a referral id at all — `referralId` is nullable and a real `null` means
   *  the admission came from a movement rather than a referral. A count. */
  withReferralIdCount: number;
  /** Of those, how many ids match a referral by exact equality. A count: `0` is a true answer, and
   *  so is a number larger than nought — matching is not the same as joining correctly. */
  joinedCount: number;
  /**
   * Of the matched pairs, how many could carry a duration at all: the admission has an
   * `arrivedAt`, and that arrival is not EARLIER than the referral was raised. A pair failing this
   * puts the person in the bed before the referral existed, so whatever that referral is, it is not
   * the request that got them there and the interval between the two is not a wait.
   *
   * ⚠️ **PASSING IT PROVES FAR LESS THAN FAILING IT DISPROVES.** This is a necessary condition, not
   * a sufficient one: a coherent pair may still be two unrelated events in the right order. It is
   * counted, and it licenses no average.
   *
   * A count. `0` alongside a non-nought `joinedCount` is the precise, measured statement that ids
   * matched and not one pair could carry a duration.
   */
  chronologicallyCoherentCount: number;
  /** How many referrals were searched. Rendered so a `joinedCount` of nought can be told apart
   *  from a search that ran against an empty list. A count. */
  referralsSearchedCount: number;
};

/**
 * Matches on referral id exactly. No prefix stripping, no normalisation, no near-match: an id that
 * does not match is not a referral this admission came from, and a fuzzy join here would invent a
 * pairing out of two records nobody linked.
 */
export function referralToBedJoin(admissions: Admission[], referrals: Referral[]): ReferralToBedJoin {
  const referralsById = new Map(referrals.map((referral) => [referral.id, referral]));
  let withReferralIdCount = 0;
  let joinedCount = 0;
  let chronologicallyCoherentCount = 0;

  for (const admission of admissions) {
    const referralId = admission.referralId;
    if (referralId === null) continue;
    withReferralIdCount += 1;

    const referral = referralsById.get(referralId);
    if (referral === undefined) continue;
    joinedCount += 1;

    const { arrivedAt } = admission;
    if (arrivedAt === null || !Number.isFinite(arrivedAt) || !Number.isFinite(referral.raisedAt)) continue;
    if (arrivedAt >= referral.raisedAt) chronologicallyCoherentCount += 1;
  }

  return {
    withReferralIdCount,
    joinedCount,
    chronologicallyCoherentCount,
    referralsSearchedCount: referrals.length,
  };
}

/**
 * How many beds a ward has marked as BEING MADE READY right now.
 *
 * The whole of what the record holds about bed readiness, and the reason the screen can time
 * nothing here. `BedRelease.preparing` is a boolean, and this comment said until 2026-09-01 that
 * nothing marks when preparation began — which was FALSE. `SET_BED_PREPARATION` writes
 * `confirmedAt: event.now` on the same object it writes `preparing` to, so an instant is stamped
 * every time the flag moves.
 *
 * **No duration is recoverable for a stronger reason: `confirmedAt` is a single SHARED provenance
 * field.** `CONFIRM_BED_RELEASE`, `BLOCK_BED_RELEASE`, `CLEAR_BED_RELEASE_BLOCK`, `RELEASE_BED` and
 * `SET_BED_PREPARATION` itself all overwrite it, so the start of preparation is destroyed by the
 * act that ends it and a start and an end can never both exist on the record. There is no pair of
 * instants to subtract, rather than a pair nobody filled in. A count: `0` truly means no bed is
 * being prepared.
 *
 * ⚠️ **A PREPARING BED SHOULD BE AN ALREADY-FREE BED, NEVER AN ANTICIPATED ONE, and no caller may
 * describe it as "expected".** `expected` is a member of `BED_RELEASE_STATES` and means the
 * discharge has not happened yet; the `FLAG_BED_RELEASE` case in `ward-flow-reducer.ts` writes
 * `preparing: false` with the reason in terms — "A bed nobody has yet left is not being made ready.
 * Preparation only ever begins after `RELEASE_BED`" — and the seed's only `preparing: true` record
 * carries `state: "discharged"` (pinned in `tests/ward-statistics-derivations.test.ts`). Calling a
 * preparing bed an expected one inverts a capacity fact: it tells a coordinator the bed is not yet
 * available when it already is.
 *
 * ⚠️ **BUT NOTHING ENFORCES THAT, so no caller may state it flat either.** `SET_BED_PREPARATION`
 * carries a unit guard and a note-membership check and **no state guard**: nothing in the reducer
 * stops a future caller setting `preparing` on an `"expected"` release. It holds today because of
 * who calls it — `ward-screen.tsx` offers the control on discharged releases only — not because of
 * what the reducer allows.
 *
 * ⚠️ **NO STATE FILTER HERE, and that is a choice rather than an omission.** Filtering to
 * `"discharged"` would silently drop such a record from the count and hide that defect; the same
 * reasoning that keeps the clamp out of `pullToArrival` keeps the filter out of this. The flag is
 * the fact, and it is counted. If the invariant needs enforcing, it is enforced in the reducer, not
 * concealed in a statistic.
 *
 * ⚠️ **REDUCER CASES ARE NAMED, NEVER CITED BY LINE.** Two line numbers stood here until
 * 2026-09-01 and one of them (`ward-flow-reducer.ts:1135` for `FLAG_BED_RELEASE`, whose case is at
 * `:1075`) had already drifted onto the comment inside the case rather than the case itself. That
 * file belongs to another chat and moves without anything here failing, so a name that `tsc` and
 * grep can both find beats a number that neither checks.
 */
export function bedsBeingPrepared(bedReleases: BedRelease[]): number {
  return bedReleases.filter((release) => release.preparing).length;
}

/**
 * MOVEMENTS WITH A REFUSAL ON RECORD AND NOTHING CURRENTLY PENDING — rendered under the heading
 * "Referrals where every ward asked SO FAR has refused".
 *
 * ⚠️ **"SO FAR" IS PART OF THE NAME AND MUST APPEAR IN EVERY SPELLING OF THIS FIGURE** — heading,
 * blurb, notes, `data-testid`, commit message, and this comment. A page that qualifies the title
 * and drops the qualifier in a summary line reintroduces the whole defect at exactly the point
 * most likely to be quoted, and a second spelling of one fact is how that happens without anything
 * going red.
 *
 * ⚠️ **THIS IS NOT "REFERRALS NOBODY WOULD TAKE", AND IT MUST NEVER BE NAMED THAT.** The model
 * holds no closure marker, no exhaustion flag and no cap-reached state on a `Movement`. What it
 * holds is a list of units currently deciding (`referredUnitIds`) and a list of units that have
 * refused (`declines`), and the only question arithmetic can answer is whether the first list is
 * empty while the second is not. That is a statement about ONE INSTANT — the instant this render
 * happened — and it is satisfied equally by a movement nobody will ever take and by a movement a
 * coordinator is about to refer onward in the next thirty seconds. `case "DECLINE"` removes the
 * unit from `referredUnitIds`, appends to `declines` and leaves the movement in
 * `destination_review`, which is a member of `REFERRABLE_MOVEMENT_STAGES` — so referring onward
 * again is not merely unblocked, it is the ordinary next act.
 *
 * `PARALLEL_REFERRAL_CAP` is what makes the difference material rather than pedantic: a movement can
 * be live at only that many wards at once, so a movement all of whose referrals have come back
 * declined has been put to AT MOST that many wards out of a network of many, and the rest have not
 * been asked.
 *
 * ⚠️ **THAT IS A CEILING AND MAY NEVER BE RESTATED AS A TYPICAL FIGURE.** Until 2026-09-01 this
 * said a movement had USUALLY been put to the cap's worth of wards — a claim about the
 * distribution, and nothing measures the distribution. `handoverSnapshot` selects on an empty `referredUnitIds` beside a non-empty
 * `declines`, which a movement with a single decline satisfies exactly as one that reached the cap
 * does. The cap bounds the figure from above and establishes nothing about the mode. The constant's
 * value was typed out beside it as well, which is a second copy of a fact `ward-model.ts` already
 * owns and goes stale silently the day the cap moves.
 *
 * ⚠️ **THE CONDITION IS NOT RE-DERIVED HERE.** `handoverSnapshot` (`ward-derivations.ts`) already
 * defines it, the handover screen already renders it, and a second copy in this file would be a
 * second definition of one fact — free to drift, with nothing red while it did. This function
 * calls that derivation and counts what it classified. Its output shape is what constrains this
 * one, which is the intended direction of the dependency.
 *
 * ⚠️ **AND THAT REUSE COSTS SOMETHING, WHICH IS WHY `escalatedCount` IS RETURNED BESIDE IT.** The
 * shared derivation classifies escalation FIRST: a movement carrying a recorded `escalation` is
 * listed as `"escalated"` and is filtered out of the declined-by-all group whether or not it also
 * satisfies the condition. So `count` is a FLOOR, not the whole of "refused and nothing pending",
 * and an escalated movement satisfying the condition is invisible to it. Returning the escalated
 * count alongside is what keeps that subtraction on the page rather than inside this function —
 * the same reasoning that renders `incoherentCount` instead of dropping the record silently.
 *
 * ⚠️ **`escalation` IS NOT USED HERE AS A TERMINAL MARKER, and no caller may treat it as one.** It
 * is a manual, unvalidated field — `RECORD_ESCALATION` checks only that the movement is not closed
 * — so it records that somebody formed an opinion, never that the network was in fact exhausted.
 * It appears in this result only to disclose what the shared derivation removed from `count`.
 *
 * ⚠️ **`now` IS TAKEN AND IS NOT PART OF THE ANSWER.** `handoverSnapshot`'s signature requires it
 * for its own other sections; the scoping this count depends on is `isOpen`, which reads `closure`
 * and `stage` and no clock, and the declined-by-all filter reads two array lengths.
 * `tests/ward-statistics-derivations.test.ts` pins that two different clocks give one answer, so
 * this paragraph cannot quietly stop being true.
 *
 * Every field is a COUNT: `0` is a true and correct answer and means the population is empty, not
 * that the figure is unavailable.
 */
export type RefusedAndNothingPending = {
  /**
   * Open movements the shared derivation classes `"declined_by_all"`: at least one unit has
   * refused, and no unit is currently holding a live referral. A floor — see `escalatedCount`.
   */
  count: number;
  /**
   * Open movements it classes `"escalated"` instead. These are excluded from `count` by that
   * derivation's escalation-first rule, whether or not they meet the same condition, so this is
   * the size of what `count` cannot see rather than a second figure about escalation.
   */
  escalatedCount: number;
  /** How many open movements were examined at all — the denominator `count` sits inside. */
  openMovementCount: number;
};

export function refusedAndNothingPending(movements: Movement[], units: Unit[], now: Instant): RefusedAndNothingPending {
  const snapshot = handoverSnapshot(movements, units, now);
  return {
    count: snapshot.placementGoneWrong.filter((entry) => entry.kind === "declined_by_all").length,
    escalatedCount: snapshot.placementGoneWrong.filter((entry) => entry.kind === "escalated").length,
    openMovementCount: movements.filter(isOpen).length,
  };
}

/**
 * HOW MANY DECLINES EACH REASON ACCOUNTS FOR, ACROSS EVERY MOVEMENT GIVEN.
 *
 * ⚠️ **THE ROWS ARE GENERATED FROM `DECLINE_REASONS`, NEVER WRITTEN OUT.** A hand-written list of
 * reasons is a second copy of a vocabulary that already exists, and the failure it produces is
 * silent in both directions: a reason added to the model and not to the table is a bucket of
 * declines that vanishes, and a reason removed from the model and left in the table is a row that
 * can never be anything but empty. A hand-written table checked by a hand-written test proves only
 * that one author agreed with themselves.
 *
 * ⚠️ **THIS IS `DECLINE_REASONS` (a ward refusing a MOVEMENT), NOT `REFERRAL_DECLINE_REASONS` (a
 * destination refusing a REFERRAL). THE TWO LISTS MUST NEVER BE MERGED OR SUMMED.** They are
 * different lengths, different members and different subjects, and `DECLINE_REASON_LABELS`
 * (`ward-referrals.ts`) is keyed by the REFERRAL list — so it is not a label table for these
 * members, and reaching for it here would label a value from one vocabulary using the other's map.
 *
 * ⚠️ **EVERY MEMBER GETS A ROW, INCLUDING THE ONES AT NOUGHT — and the first draft of this module
 * had it the other way round, so the reasoning is recorded rather than assumed.** A nought here is
 * ambiguous in no direction at all: the category exists, the scan ran, nobody used it. An OMITTED
 * row is ambiguous in three — the reason does not exist, or nobody used it, or this page does not
 * track it — and a reader cannot tell which. Worse, an omitted row is what a BROKEN GENERATOR also
 * produces: a mapping bug or a mistyped filter yields output identical to "nobody gave this
 * reason", and nothing goes red. A rendered nought is evidence the derivation ran over that
 * member; an absence is evidence of nothing. It also makes the generated-from-the-vocabulary claim
 * checkable by inspection — the vocabulary's member count and the row count are the same number,
 * and a reader can count them.
 *
 * ⚠️ **THIS DOES NOT BREAK "NULL IS NEVER ZERO", AND THE DISTINCTION IS THE WHOLE OF WHY.** That
 * rule is about an AVERAGE: a ward with no discharges has no average length of stay, and rendering
 * nought would assert every discharge was instantaneous. `ward-statistics.ts` documents the
 * exemption in the repository's own words — count-based figures "are genuine counts, so `0` is a
 * true and correct answer for them when there is no data". A decline count is a genuine count.
 * That is why `count` below is `number` and not `number | null`: the type is where the two kinds of
 * figure are held apart, exactly as this module's own header requires.
 *
 * ⚠️ **AND THE RULE IS "EVERY MEMBER OF A SMALL CLOSED VOCABULARY", NOT "EVERY EMPTY CATEGORY".**
 * Seven rows a reader can count is a table; seventy rows of which sixty-three are nought is a page
 * nobody reads, and burying the seven that happened is its own way of hiding them. A vocabulary
 * that grows past what fits on a screen needs a different answer — a stated total, the members that
 * occur, and an explicit count of the members that do not — decided then, not inherited from here.
 * `vocabularySize` is returned so a consumer can state the denominator either way, computed from
 * the list rather than typed.
 *
 * ⚠️ **THE ORDER IS THE VOCABULARY'S OWN, NOT A RANKING.** Sorting by count would put the
 * most-common reason at the top, which is a league table of refusals in everything but name, and
 * this page has no ranking anywhere by a standing rule.
 *
 * ⚠️ **EVERY MOVEMENT GIVEN IS COUNTED, OPEN OR CLOSED.** A decline is a thing that happened and
 * stays true after the movement it was made against reaches a bed; filtering to open movements
 * would make this a picture of tonight while reading like a history. The consumer says which it is.
 *
 * ⚠️ **A REASON OUTSIDE THE VOCABULARY THROWS RATHER THAN BEING DROPPED**, for the same reason
 * `admissionStagePosition`'s `default:` arm throws. `DeclineReason` makes it impossible at compile
 * time; the seed is data and `tsc` is not what most people run, so a record carrying an unknown
 * reason must fail loudly rather than quietly shrink a total that still looks plausible.
 */
export type DeclineReasonTally = {
  reason: DeclineReason;
  /**
   * How many declines on record give this reason. A COUNT, and typed `number` rather than
   * `number | null` deliberately: `0` is a true and correct answer meaning the scan ran over this
   * member and found none, which is a different statement from an average that does not exist.
   */
  count: number;
};

export type DeclinesByReason = {
  /**
   * One row per member of `DECLINE_REASONS`, in the vocabulary's own order, including members at
   * nought. Always exactly `vocabularySize` long. See the doc comment above for why the empties
   * are rendered rather than dropped.
   */
  tallies: DeclineReasonTally[];
  /** Every decline counted, across every movement given. A count. */
  totalCount: number;
  /** How many of the movements given carry at least one decline. A count. */
  movementsWithDeclinesCount: number;
  /** How many movements were examined. A count, rendered so a nought total can be told apart from
   *  a scan that ran against an empty collection. */
  movementCount: number;
  /** How many members `DECLINE_REASONS` holds, measured from the list rather than typed. */
  vocabularySize: number;
};

export function declinesByReason(movements: Movement[]): DeclinesByReason {
  const counts = new Map<DeclineReason, number>(DECLINE_REASONS.map((reason) => [reason, 0]));
  let totalCount = 0;
  let movementsWithDeclinesCount = 0;

  for (const movement of movements) {
    if (movement.declines.length > 0) movementsWithDeclinesCount += 1;
    for (const decline of movement.declines) {
      const seen = counts.get(decline.reason);
      if (seen === undefined) {
        throw new Error(
          `declinesByReason: movement ${movement.id} carries a decline reason ${JSON.stringify(decline.reason)} ` +
            `that is not a member of DECLINE_REASONS — add it to the vocabulary rather than letting this total ` +
            `quietly shrink.`,
        );
      }
      counts.set(decline.reason, seen + 1);
      totalCount += 1;
    }
  }

  return {
    // Mapped over the vocabulary itself, with no filter of any kind: the row set IS the member
    // list, so a row can neither be missing nor invented, and the two lengths agree by
    // construction rather than by a test remembering to check.
    tallies: DECLINE_REASONS.map((reason) => ({ reason, count: counts.get(reason) ?? 0 })),
    totalCount,
    movementsWithDeclinesCount,
    movementCount: movements.length,
    vocabularySize: DECLINE_REASONS.length,
  };
}

/**
 * HOW MANY BLOCKED DISCHARGES EACH BLOCKER ACCOUNTS FOR, ACROSS EVERY ADMISSION STILL ON THE WARD.
 *
 * ⚠️ **THIS READS `Admission.blockReason`, A `BedReleaseBlocker | null` — NOT `Movement.blocker`.**
 * `Movement.blocker` is free prose about a referral struggling to find a placement, gated through
 * `hasActiveBlocker` in `ward-priority.ts`; a deferral commit named that function as the reason this
 * figure had not been built, and that was a wrong diagnosis — `hasActiveBlocker` never touches this
 * field and needs no repair for this figure to exist. `ward-model.ts` states the same warning from
 * the other field's own doc comment: "`Movement.blocker` — the free-prose one. NOT `BedRelease.blocker`,
 * the `BedReleaseBlocker` enum that shares the name. Nothing here applies to that field." `blockReason`
 * is a closed enum chosen from `BED_RELEASE_BLOCKERS`, so reading it needs no predicate at all — `!==
 * null` is the whole test, exactly as `readyToLeaveCannot` (`ward-statistics.ts`) already does it.
 *
 * ⚠️ **`BedRelease.blocker` IS DELIBERATELY NOT READ HERE.** It is a second field carrying the same
 * vocabulary about a different record — a `BedRelease` has no `admissionId`, so there is no join back
 * to a specific admission that would let the two be combined without risking a double count of one
 * discharge. `Admission.blockReason` is the field `readyToLeaveCannot` already trusts for this exact
 * fact, and this figure trusts the same one rather than inventing a merge nobody asked for.
 *
 * ⚠️ **SCOPED TO ADMISSIONS STILL ON THE WARD, NEVER TO THE FULL HISTORY — the same scoping
 * `wardStatistics` already applies to `readyToLeaveCannot`, for the reason quoted from that file
 * rather than re-derived here:** "`blockReason` describes what is currently holding a bed up.
 * Someone who has already left is no longer being held from leaving, whatever the record still
 * says." A departed admission is excluded through `admissionStagePosition` above — the one place
 * this module reads `AdmissionState` — never through a second direct comparison against
 * `admission.state`.
 *
 * ⚠️ **ROWS ARE GENERATED FROM `BED_RELEASE_BLOCKERS`, NEVER WRITTEN OUT**, for the same reason
 * `declinesByReason` above holds to: a hand-written table checked by a hand-written test proves only
 * that one author agreed with themselves. Every member gets a row, including the ones at nought — an
 * omitted row is indistinguishable from a broken generator, and a rendered nought is evidence the scan
 * ran over that member.
 *
 * ⚠️ **`count` IS A GENUINE COUNT, TYPED `number`, NEVER `number | null`.** A blocker with no blocked
 * admissions against it is a true nought, not an absence. There is no averaging or rate anywhere in
 * this figure's natural shape and nothing here may acquire one: no instant on the record marks when a
 * block began, only `confirmedAt` — a single shared provenance field several other acts overwrite —
 * the same reasoning `bedsBeingPrepared` above documents for why no duration is recoverable from it.
 *
 * ⚠️ **THE ORDER IS THE VOCABULARY'S OWN, NOT A RANKING.** No figure on this page sorts a blocker to
 * the top for being common.
 *
 * ⚠️ **A BLOCKER OUTSIDE THE VOCABULARY THROWS RATHER THAN BEING DROPPED**, matching
 * `declinesByReason`'s own reasoning: `BedReleaseBlocker` makes it impossible at compile time, the
 * seed is data and `tsc` is not what most people run, so an admission carrying an unknown blocker must
 * fail loudly rather than quietly shrink a total that still looks plausible.
 */
export type BlockedDischargeReasonTally = {
  reason: BedReleaseBlocker;
  /**
   * How many admissions still on the ward carry this blocker. A COUNT: `0` is a true and correct
   * answer meaning the scan ran over this member and found none, which is a different statement from
   * an average that does not exist.
   */
  count: number;
};

export type BlockedDischargesByReason = {
  /**
   * One row per member of `BED_RELEASE_BLOCKERS`, in the vocabulary's own order, including members at
   * nought. Always exactly `vocabularySize` long.
   */
  tallies: BlockedDischargeReasonTally[];
  /** Every blocked admission counted, across every admission examined. A count. */
  totalCount: number;
  /**
   * How many admissions were examined — everyone still on the ward, blocked or not. A count,
   * rendered so a nought total can be told apart from a scan that ran against an empty population.
   */
  admissionCount: number;
  /** How many members `BED_RELEASE_BLOCKERS` holds, measured from the list rather than typed. */
  vocabularySize: number;
};

export function blockedDischargesByReason(admissions: Admission[]): BlockedDischargesByReason {
  const counts = new Map<BedReleaseBlocker, number>(BED_RELEASE_BLOCKERS.map((reason) => [reason, 0]));
  let totalCount = 0;
  let admissionCount = 0;

  for (const admission of admissions) {
    // Departed admissions are no longer holding a bed up — see the doc comment above. Routed
    // through `admissionStagePosition`, the one place this module reads `AdmissionState`.
    if (admissionStagePosition(admission) === "ended") continue;

    admissionCount += 1;
    const { blockReason } = admission;
    if (blockReason === null) continue;

    const seen = counts.get(blockReason);
    if (seen === undefined) {
      throw new Error(
        `blockedDischargesByReason: admission ${admission.id} carries a block reason ${JSON.stringify(blockReason)} ` +
          `that is not a member of BED_RELEASE_BLOCKERS — add it to the vocabulary rather than letting this total ` +
          `quietly shrink.`,
      );
    }
    counts.set(blockReason, seen + 1);
    totalCount += 1;
  }

  return {
    // Mapped over the vocabulary itself, with no filter of any kind: the row set IS the member
    // list, so a row can neither be missing nor invented, and the two lengths agree by
    // construction rather than by a test remembering to check.
    tallies: BED_RELEASE_BLOCKERS.map((reason) => ({ reason, count: counts.get(reason) ?? 0 })),
    totalCount,
    admissionCount,
    vocabularySize: BED_RELEASE_BLOCKERS.length,
  };
}
