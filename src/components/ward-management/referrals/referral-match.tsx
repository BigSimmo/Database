"use client";

import { useEffect, useRef, useState, type Dispatch } from "react";

import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { OVERRIDE_REASONS, type OverrideReason } from "@/components/ward-management/ward-change-reasons";
import { formatInstant, type Instant } from "@/components/ward-management/ward-clock";
import { NOT_RECORDED_LABEL, SYNTHETIC_TRAVEL_TIMES_NOTICE } from "@/components/ward-management/ward-distance";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { wardAddressing } from "@/components/ward-management/ward-eligibility";
import {
  REFERRAL_DECLINE_REASONS,
  type Referral,
  type ReferralDeclineReason,
  type Rejection,
  type Unit,
} from "@/components/ward-management/ward-model";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import {
  candidateAccepts,
  DECLINE_REASON_LABELS,
  groupCandidatesByTravelBand,
  matchReason,
  networkHasCohort,
  referralCandidates,
  TRAVEL_BAND_GROUP_EMPTY_SENTENCE,
  travelBandGroupCounts,
  travelBandGroupCountsSentence,
  travelBandGroupLabel,
  type ReferralCandidate,
  type TravelBandGroup,
  type TravelBandGroupCounts,
  referralPersonFacts,
  referralDestinationLabels,
  referralAddressingStateLabel,
  referralSuburbLabel,
} from "@/components/ward-management/ward-referrals";
import { createBrowserStore } from "@/lib/client-store-factory";

import { referralWaitLine } from "./referral-wait";
import styles from "./referrals.module.css";

/**
 * Phase 8, Task 4. The width at which the band groups start open, matching
 * `referrals.module.css`'s own `--ri-two-col-breakpoint` / `@media (max-width: 40rem)` swap so the
 * screen has ONE breakpoint rather than a second one written here that could drift from it.
 *
 * Owner decision, 2026-08-29: shut by default at phone width, open at desktop width. The binding
 * condition on that decision is why it is safe, and it is a condition on the markup below rather
 * than on this constant: every heading and BOTH of its counts render whether the group is open or
 * shut, including for an empty group, so "there is nothing available within an hour" is answerable
 * without opening anything. Collapsing folds; it does not hide. It was approved INSTEAD of a
 * metro/rural toggle, which was declined precisely because that would have hidden beds.
 */
const BAND_GROUPS_OPEN_MEDIA_QUERY = "(min-width: 40rem)";

/**
 * Whether the band groups start open, tracked live so a rotation or a resize is honoured rather
 * than frozen at mount. On the server there is no `matchMedia` at all and the answer is `false` —
 * the phone default — so nothing width-dependent is guessed where no width is known. The `typeof`
 * guards are for a browser-like environment that lacks the API rather than for jsdom, which this
 * repository's `tests/setup/jsdom.setup.ts` always supplies with a stub (defaulting to "no match",
 * so groups mount shut unless a test installs the matching stub itself). A shut group is the
 * conservative answer in any case: every heading and both counts are inside the `<summary>`, which
 * is the part a closed disclosure still paints.
 */
const useBandGroupsOpenByDefault = createBrowserStore<boolean>(
  (onStoreChange) => {
    if (typeof window.matchMedia !== "function") return () => {};
    const media = window.matchMedia(BAND_GROUPS_OPEN_MEDIA_QUERY);
    media.addEventListener("change", onStoreChange);
    return () => media.removeEventListener("change", onStoreChange);
  },
  () => (typeof window.matchMedia === "function" ? window.matchMedia(BAND_GROUPS_OPEN_MEDIA_QUERY).matches : false),
  false,
);

/**
 * The event types this view's own controls raise, and the one spelling of each in the rejection
 * banner. A refusal the reducer raises for any of them surfaces here rather than being swallowed —
 * including `RECORD_LOCAL_BED_SOUGHT`, whose control this screen owns.
 */
/**
 * ⚠️ THE STATED REASON A CONTROL IS UNAVAILABLE, not a silently grey button. Repo convention: an
 * `aria-disabled` control keeps its tab stop and says why, because a native `disabled` removes the
 * tab stop and the reason is then never reached by anyone moving through the page by keyboard.
 */
/**
 * ⚠️ A WARD MUST STATE WHY IT IS REFUSING A PATIENT. The list had a first member and the control
 * started on it, so a decline nobody thought about was filed as "no suitable bed".
 */
const DECLINE_REASON_UNCHOSEN = "Choose the reason this ward cannot take this referral before declining it.";

const OVERRIDE_REASON_UNCHOSEN = "Choose the reason for accepting despite this ward's assessment before recording it.";

const MATCH_VIEW_DECISION_EVENTS = ["ACCEPT_REFERRAL", "DECLINE_REFERRAL", "RECORD_LOCAL_BED_SOUGHT"] as const;

const REJECTED_DECISION_LABELS: Record<(typeof MATCH_VIEW_DECISION_EVENTS)[number], string> = {
  ACCEPT_REFERRAL: "Acceptance",
  DECLINE_REFERRAL: "Decline",
  RECORD_LOCAL_BED_SOUGHT: "Local bed search",
};

type ReferralMatchViewProps = {
  referral: Referral;
  units: Unit[];
  now: Instant;
  dispatch: Dispatch<WardFlowEvent>;
  rejections: Rejection[];
};

/**
 * Task 5 (Phase 7, "The front door", spec D10): the match view. One referral, every unit in the
 * network — `referralCandidates` (`ward-referrals.ts`) never truncates, sorts or ranks it, so
 * this component must not either. Every unit renders in the exact order `units` arrives in (the
 * site table's own order, the same fixed order the morning page uses) — a table row NEVER moves
 * because it accepts the referral, because that would read as a recommendation, and D10 is
 * explicit that this view shows candidates and a human decides.
 *
 * The parent (`ReferralBoard`) mounts this keyed on `referral.id`, so switching which referral is
 * selected always remounts fresh local state here (the decline-reason draft, the rejection banner)
 * rather than carrying one referral's leftover UI state onto the next.
 */
export function ReferralMatchView({ referral, units, now, dispatch, rejections }: ReferralMatchViewProps) {
  /*
   * EVERY HOOK THIS VIEW HAS IS CALLED HERE, above the not-a-bed-question return below, and none
   * of them may move under it. React identifies a hook by its position in the call order, so a
   * component whose hook COUNT depends on a prop has no stable identity for its own state. While
   * these sat beneath that return, a render for a referral with no ward destination called none of
   * them, and the next render that did reach them was treated as a fresh mount.
   *
   * React raises nothing for that exact shape — an early return above EVERY hook leaves both of
   * its guards asleep, since `current.memoizedState` stays null (so the MOUNT dispatcher is chosen
   * again) and `currentHook` is never set (so `didRenderTooFewHooks` cannot fire). So it failed
   * silently rather than loudly: the decline reason a coordinator had already chosen was discarded,
   * and the media-query subscription was replaced without its predecessor's cleanup ever running.
   * `tests/ward-referral-match-hooks-order.dom.test.tsx` pins both. It stops being silent and
   * becomes React's "Rendered more hooks…" crash the day a second early return lands between two
   * hooks, which is why the lint rule refuses the arrangement rather than the consequence.
   *
   * None of the six needs a value the early return guards. Their arguments are constants
   * (`REFERRAL_DECLINE_REASONS[0]`, `undefined`, `0`) or props that arrive on every render
   * (`rejections`), and the effect reads only `rejections`, `checkToken` and `referral.id` —
   * nothing derived from `ward`. There is therefore no no-ward stand-in value to invent here;
   * everything that IS derived from `ward` stays below, where it runs only once there is one.
   */
  /* Shut on a phone, open at desktop width — read through the repository's own SSR-safe external
   * store rather than by setting state in an effect, so the value is already correct on the first
   * client render and no cascading re-render is needed to reach it. */
  const bandGroupsOpenByDefault = useBandGroupsOpenByDefault();

  /**
   * ⚠️ UNCHOSEN, AND THIS IS THE MOST CONSEQUENTIAL PLACE IN THE APP FOR THAT TO BE TRUE.
   *
   * This was `REFERRAL_DECLINE_REASONS[0]`, which is `"no_suitable_bed"`. So a ward that pressed
   * Decline without touching the control recorded THAT as its clinical reason for refusing a
   * patient — and it is the sentence the coordinator then reads when deciding where to try next.
   * It may be untrue, and it is untrue in the direction that sounds most ordinary, which is why
   * nobody would ever query it.
   *
   * ⚠️ `undefined` IS NOT A SIXTH REASON. There is deliberately no "not stated" option in the
   * list: that would be a value a ward could choose on purpose, which is a different feature
   * nobody has asked for. This is the absence of an answer, and the control refuses to submit
   * until there is one.
   */
  const [declineReason, setDeclineReason] = useState<ReferralDeclineReason | undefined>(undefined);
  const [lastRejection, setLastRejection] = useState<Rejection | undefined>(undefined);
  // Same async-detection pattern as `referral-intake.tsx`'s own `checkToken`/`priorRejectionCountRef`
  // pair (see that file's doc comment for the full reasoning) — `dispatch` never returns whether
  // the reducer accepted or refused an event, so the only way to know is to compare `rejections`
  // before and after, on the next render.
  const priorRejectionCountRef = useRef(rejections.length);
  const [checkToken, setCheckToken] = useState(0);

  useEffect(() => {
    if (checkToken === 0) return;
    if (rejections.length > priorRejectionCountRef.current) {
      const newest = rejections[rejections.length - 1];
      // Scoped to THIS referral's own ACCEPT_REFERRAL/DECLINE_REFERRAL — `Rejection.movementId`
      // carries the referral id for these two event types (see `subjectId` in
      // `ward-flow-reducer.ts`), never a movement id. A rejection some other coordinator action
      // raised elsewhere must never surface here as though it were about this referral.
      const isForThisDecision =
        newest.movementId === referral.id &&
        (MATCH_VIEW_DECISION_EVENTS as readonly string[]).includes(newest.attempted);
      setLastRejection(isForThisDecision ? newest : undefined);
    } else {
      setLastRejection(undefined);
    }
    priorRejectionCountRef.current = rejections.length;
  }, [rejections, checkToken, referral.id]);

  /*
   * This whole view answers one question -- WHICH BED -- and only a psychiatric ward referral has
   * that question. An ED, a medical ward and a community team are answered by a person or a team.
   *
   * Said out loud rather than left as an empty candidate list, because the two render almost
   * identically and mean opposite things: an empty list here reads as "the network has no bed for
   * this person", which for a community referral is not a shortage, it is a category error.
   */
  const ward = wardAddressing(referral);
  if (!ward) {
    return (
      <section className={styles.matchPanel} data-testid="ward-referral-match-not-a-bed-question">
        <p className={styles.matchSummary}>
          {referral.id} was sent to {referralDestinationLabels(referral).join(", ").toLowerCase()} — none of which is
          answered by matching a bed. There is no bed shortlist for this referral.
        </p>
      </section>
    );
  }
  const candidates = referralCandidates(referral, ward.destination, units, now);
  const accepting = candidates.filter(candidateAccepts);
  const hasCohort = networkHasCohort(referral, units);
  /*
   * Phase 8, Task 4. The grouping is asked for ONCE and everything on this screen below reads that
   * one answer — the group headings, their two counts, each row's own band, and the
   * every-candidate-unrecorded sentence. A second lookup into the fixture for any of those is how
   * one screen ends up giving two answers about the same pair, which is the defect Phase 5 shipped.
   */
  const bandGroups = groupCandidatesByTravelBand(referral, candidates);
  const bandGroupCounts = bandGroups.map(travelBandGroupCounts);
  const groupedUnitCount = bandGroupCounts.reduce((total, counts) => total + counts.units, 0);
  const notRecordedIndex = bandGroups.findIndex((group) => group.band === "not_recorded");
  /* Derived from the grouping's OWN output, never from a second read of the travel-band table. */
  const everyCandidateUnrecorded =
    groupedUnitCount > 0 && notRecordedIndex >= 0 && bandGroupCounts[notRecordedIndex].units === groupedUnitCount;

  /**
   * ⚠️ `overrideReason` IS SENT ONLY WHEN A WARD ACTUALLY FAILED A GATE, AND THAT IS A RULE, NOT
   * AN ACCIDENT OF THE CALLERS.
   *
   * The eligible arm below calls this with one argument, so a clean acceptance can never carry a
   * reason. The reducer discards an override that overrode nothing anyway — but relying on it to
   * clean up after this screen would be the wrong shape: a record saying a clinical rule was bent,
   * on an acceptance where none was, is a false entry in the one place anyone would later go
   * looking for the real ones.
   */
  function handleAccept(unitId: string, overrideReason?: OverrideReason) {
    priorRejectionCountRef.current = rejections.length;
    dispatch({
      type: "ACCEPT_REFERRAL",
      role: "coordinator",
      now,
      referralId: referral.id,
      destinationKind: "psychiatric_ward",
      unitId,
      overrideReason,
    });
    setCheckToken((token) => token + 1);
  }

  /*
   * The optional local-bed step (spec D8-6). One control, on this screen, creating a record only
   * when it is taken — never a field on the intake form, because a form field is the one shape
   * guaranteed to read as owed. It is offered on EVERY referral, not only country ones: offering
   * it only on country referrals would assert that looking closer to home first is a country
   * practice, which is precisely the question nobody has answered.
   */
  function handleLocalBedSought() {
    priorRejectionCountRef.current = rejections.length;
    dispatch({ type: "RECORD_LOCAL_BED_SOUGHT", role: "coordinator", now, referralId: referral.id });
    setCheckToken((token) => token + 1);
  }

  function handleDecline() {
    priorRejectionCountRef.current = rejections.length;
    // ⚠️ GUARDED HERE TOO, NOT ONLY ON THE BUTTON. `aria-disabled` keeps the control focusable on
    // purpose, so it can still be activated — and an unstated reason must never reach the record
    // by that route. Belt and braces, because the thing being prevented is a fabricated clinical
    // judgement rather than an inconvenience.
    if (declineReason === undefined) return;
    dispatch({
      type: "DECLINE_REFERRAL",
      role: "coordinator",
      now,
      referralId: referral.id,
      // This screen is the ward shortlist, so the destination declining here is the ward. Named
      // rather than defaulted: the reducer must not have to guess which destination replied.
      destinationKind: "psychiatric_ward",
      reason: declineReason,
    });
    setCheckToken((token) => token + 1);
  }

  // This panel answers "what happened to the WARD ask", not "what happened to the referral" —
  // the ward declining leaves the other destinations live (FD-24), so the referral itself may
  // still be queued while this screen has nothing left to offer.
  if (ward.state !== "queued") {
    const acceptedUnit = units.find((unit) => unit.id === ward.acceptedUnitId);
    return (
      <section className={styles.matchPanel} data-testid="ward-referral-match-panel">
        {/*
         * ⚠️ **THE HEADING CARRIES NO STATE WORD, AND THAT IS DELIBERATE.** It used to render
         * `{referral.id} — {ward.state}`, which put the RAW UNION MEMBER on screen, lowercase and
         * unmapped: a clinician read "RF-006 — cancelled" in an `<h2>`. `.matchHeading` applies no
         * `text-transform`, so that was the literal token. It was a FOURTH spelling of the state
         * word and the only one bypassing `referralAddressingStateLabel`, whose entire purpose is
         * to be the one home — and `cancelled` is the one state whose whole point is that nobody
         * decided it, so a bare token is the worst possible place to lose the sentence.
         * The paragraph below carries the proper wording, from the one home. Do not reintroduce a
         * short state word here: a second, shorter spelling is how the first one got in.
         */}
        <h2 className={styles.matchHeading}>{referral.id}</h2>
        <p data-testid="ward-referral-match-decided">
          {ward.state === "accepted"
            ? acceptedUnit
              ? `Accepted at ${acceptedUnit.name}.`
              : // The board's own spelling of this identical gap (`outcomeDetail`, "Unit not
                // recorded") rather than a second one. The previous text — `Accepted, but no
                // synthetic unit matches "<id>"` — was developer prose on a clinical screen: it
                // named an internal id and the word "synthetic" to somebody deciding about a bed.
                "Accepted — unit not recorded."
            : referralAddressingStateLabel(ward)}
        </p>
      </section>
    );
  }

  return (
    <section className={styles.matchPanel} data-testid="ward-referral-match-panel">
      <h2 className={styles.matchHeading}>{referral.id}</h2>
      {/*
       * M7 (fix round C): the brief says BOTH screens carry the prose banner. `ReferralBoard`'s
       * sits at the top of `<main>`, above two sections and two tables — on a phone a coordinator
       * making the accept decision here has scrolled well past it. This is the screen where the
       * decision is actually taken, so the sentence is repeated where it is read.
       */}
      <p className={styles.matchGovernance} data-testid="ward-referral-match-governance">
        <strong>Not a medical device.</strong> Every unit below is listed in the network&apos;s own fixed order. This
        view places nobody: a coordinator decides every placement, one at a time, and nothing is accepted until they
        record it.
      </p>
      {/*
       * The tier is its OWN element, never a field inside the dot-separated summary line below
       * (review finding I1 / Task 8 finding B). This view used to render a bare `Tier 2` inline
       * while the board row directly above it read "Tier 2 · urgent" — one field, one page, two
       * spellings, the fourth instance on this branch of the project's most expensive defect
       * class. Substituting `urgencyTierLabel` INTO the summary line would have produced
       * "Adult · Female · Tier 2 · urgent · Perth Metropolitan", where "urgent" reads as a fifth
       * dot-separated field; so the layout changed rather than the words, and the tier now sits
       * on its own exactly as it does on the board's card list.
       */}
      <p className={styles.matchTier} data-testid="ward-referral-match-tier" data-tier={referral.urgency}>
        {urgencyTierLabel(referral.urgency)}
      </p>
      <p className={styles.matchSummary} data-testid="ward-referral-match-summary">
        {referralPersonFacts(referral).join(" · ")}
      </p>
      {/*
       * The owner's ruling: the coordinator sees a patient's suburb. Its own line, never folded
       * into `.matchSummary`'s dot-separated run above — that run is shared with the ED screen and
       * the network diagram (`referralPersonFacts`, `ward-referrals.ts`), and this ruling is scoped
       * to the coordinator's own bed-matching decision, not every screen that reads a referral.
       *
       * `PD-3`: a suburb is not an address. This line names the suburb and nothing finer — no
       * street, no postcode — and sits on its own rather than stacked under anything that would
       * read as the first line of one.
       *
       * ⚠️ An unanswered suburb is never rendered as blank. `referralSuburbLabel` (`ward-referrals.ts`)
       * reads `suburbUnknownLabels` — the one home for that wording — so "not known" is stated as a
       * fact a clinician can read, never omitted as though nobody asked. See `ReferralSuburb`'s own
       * doc comment in `ward-model.ts` for why this field is a union at all.
       */}
      <p className={styles.matchSummary} data-testid="ward-referral-match-suburb">
        {referral.suburb.kind === "named" ? `From ${referral.suburb.name}` : referralSuburbLabel(referral.suburb)}
      </p>
      <p className={styles.waitBadge} data-testid="ward-referral-match-wait">
        {referralWaitLine(referral, now)}
      </p>

      {!hasCohort ? (
        <p className={styles.structuralGap} role="alert" data-testid="ward-referral-match-structural-gap">
          No {referral.ageBand.toLowerCase()} unit exists in this network.
        </p>
      ) : accepting.length === 0 ? (
        <p className={styles.noBedAccepts} role="alert" data-testid="ward-referral-match-no-bed">
          No unit accepts this referral right now — every reason is listed below.
        </p>
      ) : null}

      {/*
       * Only when the network runs this age band at all (fix round C, F6 / review finding I3).
       * "right now" asserts temporality — that this may be different at 4pm. When there is no
       * unit of this cohort anywhere it will never be different, and printing "0 of 22 units
       * accept this referral right now" one line under "No youth unit exists in this network"
       * reintroduces the operational statement the structural banner exists to avoid.
       */}
      {hasCohort ? (
        <p data-testid="ward-referral-match-accepting-count">
          {accepting.length} of {candidates.length} units accept this referral right now.
        </p>
      ) : null}

      {/*
       * Every piece of distance wording on this screen sits BELOW the structural-gap banner above.
       * "No youth unit exists in this network" is not a distance problem and must never be dressed
       * as one, so the banner is met first and the bands only afterwards.
       *
       * The one place this screen states that the travel times are invented. It is imported, never
       * retyped, and it renders once — a band shown anywhere without this sentence on the same
       * screen is a defect.
       */}
      <p className={styles.syntheticNotice} data-testid="ward-referral-match-synthetic-notice">
        {SYNTHETIC_TRAVEL_TIMES_NOTICE}
      </p>

      {everyCandidateUnrecorded ? (
        <p className={styles.allNotRecorded} data-testid="ward-referral-match-all-not-recorded">
          <strong>{NOT_RECORDED_LABEL}</strong> — This prototype holds no travel time between this person&apos;s home
          region and these sites. That is a gap in the invented data, not a statement that these beds are far away.
        </p>
      ) : null}

      <div className={styles.matchList} data-testid="ward-referral-match-list">
        {bandGroups.map((group, index) => (
          <BandGroup
            /* Includes the width default, so crossing the breakpoint re-seeds every group's
             * open/shut state by remount. The key never depends on the band or on either count —
             * the collapse state must not vary with which band this is or with what is in it. */
            key={`${group.band}-${bandGroupsOpenByDefault}`}
            group={group}
            counts={bandGroupCounts[index]}
            openByDefault={bandGroupsOpenByDefault}
            onAccept={handleAccept}
          />
        ))}
      </div>

      {/*
       * Rule 3 of the optional step, and the reason this branch has no `else` that renders
       * anything: absence renders as NOTHING AT ALL. No "Not recorded", no empty checkbox, no grey
       * placeholder, no warning icon, no amber row. A referral without the record must look exactly
       * like a referral that never needed one, because it may be one — and no figure anywhere on
       * this screen or any other counts how many referrals lack it.
       */}
      <div className={styles.localBed} data-testid="ward-referral-match-local-bed">
        {referral.localBedSought ? (
          <p className={styles.localBedRecord} data-testid="ward-referral-match-local-bed-sought-record">
            A local bed was sought and none was suitable, at {formatInstant(referral.localBedSought.at)}.
          </p>
        ) : (
          <button
            type="button"
            className={styles.localBedButton}
            data-testid="ward-referral-match-local-bed-sought"
            onClick={handleLocalBedSought}
          >
            Record that a local bed was sought and none was suitable
          </button>
        )}
      </div>

      <div className={styles.declineControls} data-testid="ward-referral-match-decline-controls">
        <label className={styles.fieldLegend} htmlFor="ward-referral-match-decline-reason">
          Decline reason
        </label>
        <select
          id="ward-referral-match-decline-reason"
          data-testid="ward-referral-match-decline-reason"
          className={styles.select}
          value={declineReason ?? ""}
          onChange={(event) => {
            const chosen = event.target.value;
            // Membership, never truthiness — the blank option must resolve to "no answer yet",
            // never to a reason that merely sorts first.
            setDeclineReason(
              REFERRAL_DECLINE_REASONS.includes(chosen as ReferralDeclineReason)
                ? (chosen as ReferralDeclineReason)
                : undefined,
            );
          }}
        >
          <option value="">Choose a reason…</option>
          {REFERRAL_DECLINE_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {DECLINE_REASON_LABELS[reason] ?? reason}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.declineButton}
          data-testid="ward-referral-match-decline"
          aria-disabled={declineReason === undefined ? "true" : undefined}
          aria-describedby={declineReason === undefined ? "ward-referral-match-decline-blocked" : undefined}
          title={declineReason === undefined ? DECLINE_REASON_UNCHOSEN : undefined}
          onClick={declineReason === undefined ? ignoreUnavailableActivation : handleDecline}
        >
          Decline referral
        </button>
        {declineReason === undefined ? (
          <span id="ward-referral-match-decline-blocked" className="sr-only">
            {DECLINE_REASON_UNCHOSEN}
          </span>
        ) : null}
      </div>

      {lastRejection ? (
        <p className={styles.rejection} data-testid="ward-referral-match-rejection" role="alert">
          {REJECTED_DECISION_LABELS[lastRejection.attempted as (typeof MATCH_VIEW_DECISION_EVENTS)[number]]} not
          recorded: {lastRejection.reason}
        </p>
      ) : null}
    </section>
  );
}

/**
 * One band group: its heading, its two counts, and the rows in it.
 *
 * `<details>`/`<summary>` rather than a hand-built disclosure, deliberately. The summary — heading
 * and BOTH counts — is rendered whether the group is open or shut, and it is rendered for an empty
 * group exactly as for a populated one, which is the binding condition the owner attached to
 * collapsing at all. Nothing is omitted, nothing is reordered, and the open/shut state depends only
 * on viewport width: never on which band this is, and never on either count. Making an empty group
 * non-collapsible would be exactly that forbidden dependency, so every group behaves the same.
 *
 * The band is taken from the GROUP this row sits in rather than looked up again per row. A band
 * looked up in two places is a band that can disagree with itself, and here the heading and the
 * rows beneath it would be the two places.
 */
function BandGroup({
  group,
  counts,
  openByDefault,
  onAccept,
}: {
  group: TravelBandGroup;
  counts: TravelBandGroupCounts;
  openByDefault: boolean;
  onAccept: (unitId: string, overrideReason?: OverrideReason) => void;
}) {
  /* Seeded from the width default and then owned by the coordinator's own toggling. The parent
   * REMOUNTS this component when that default changes (see its `key`), which is what re-seeds every
   * group on a rotation or resize — deliberately, rather than by setting state from an effect. */
  const [open, setOpen] = useState(openByDefault);

  const label = travelBandGroupLabel(group.band);
  return (
    <details
      className={styles.bandGroup}
      data-testid={`ward-referral-match-band-group-${group.band}`}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className={styles.bandSummary}>
        <span className={styles.bandLabel}>{label}</span>
        {/* Two positive facts about the beds in this band, from `travelBandGroupCounts` — which
         *  counts the very candidates rendered below, so a heading cannot disagree with its own
         *  rows. Neither figure counts what is missing. The sentence itself is
         *  `travelBandGroupCountsSentence`, shared with the network diagram since Phase 8 Task 8
         *  put band groups on that screen too — one spelling, so the two surfaces cannot drift. */}
        <span className={styles.bandCounts} data-testid={`ward-referral-match-band-counts-${group.band}`}>
          {travelBandGroupCountsSentence(counts)}
        </span>
      </summary>
      {group.candidates.length === 0 ? (
        <p className={styles.bandEmpty} data-testid={`ward-referral-match-band-empty-${group.band}`}>
          {TRAVEL_BAND_GROUP_EMPTY_SENTENCE}
        </p>
      ) : (
        <ul className={styles.bandRows}>
          {group.candidates.map((candidate) => (
            <MatchRow key={candidate.unit.id} candidate={candidate} bandText={label} onAccept={onAccept} />
          ))}
        </ul>
      )}
    </details>
  );
}

function MatchRow({
  candidate,
  bandText,
  onAccept,
}: {
  candidate: ReferralCandidate;
  bandText: string;
  onAccept: (unitId: string, overrideReason?: OverrideReason) => void;
}) {
  const { unit } = candidate;
  // Per row, because only one ward is ever being argued for at a time and a shared draft would
  // carry a reason chosen for one ward onto another.
  const [overrideReason, setOverrideReason] = useState<OverrideReason | undefined>(undefined);
  return (
    <li
      className={candidateAccepts(candidate) ? styles.matchRowAccepts : styles.matchRowDeclines}
      data-testid={`ward-referral-match-row-${unit.id}`}
    >
      <div className={styles.matchRowTop}>
        <span className={styles.matchUnitName}>{unit.name}</span>
        {/* D7: a forensic bed is described so the board is honest about the network — shown with
         *  its own category, never merely absent from the accepting list without saying why. */}
        {unit.forensic ? (
          <span className={styles.forensicBadge} data-testid={`ward-referral-match-forensic-${unit.id}`}>
            Forensic
          </span>
        ) : null}
      </div>
      <p className={styles.matchBand} data-testid={`ward-referral-match-band-${unit.id}`}>
        {bandText}
      </p>
      {candidateAccepts(candidate) ? (
        <div className={styles.matchAcceptRow}>
          <span className={styles.acceptsLabel} data-testid={`ward-referral-match-accepts-${unit.id}`}>
            Accepts this referral
          </span>
          <button
            type="button"
            className={styles.acceptButton}
            data-testid={`ward-referral-match-accept-${unit.id}`}
            onClick={() => onAccept(unit.id)}
          >
            Accept at {unit.name}
          </button>
        </div>
      ) : (
        <div className={styles.matchOverrideRow} data-testid={`ward-referral-match-override-${unit.id}`}>
          {/*
            ⚠️ THE EXPLANATION AND THE CONTROL, TOGETHER. Until now these were the two arms of one
            ternary, so a ward was never shown both: the reason it cannot take this patient was
            stated perfectly, and there was nothing to do about it. The owner's ruling is that the
            system advises and the CLINICIAN decides — "advise loudly" was built; "let the clinician
            decide" was never wired. This is that second half.

            ⚠️ NOT A SECOND WORDING. `matchReason(candidate)` is unchanged and still the only place
            this sentence is spelled. A ward reads the same explanation it always did; what is new
            is sitting underneath it.
          */}
          <p className={styles.matchReasonText} data-testid={`ward-referral-match-reason-${unit.id}`}>
            {matchReason(candidate)}
          </p>
          <label className={styles.matchOverrideLabel} htmlFor={`ward-referral-match-override-reason-${unit.id}`}>
            Accept anyway — record why
          </label>
          {/*
            ⚠️ STARTS UNCHOSEN, AND THE BLANK OPTION IS LOAD-BEARING. A pre-selected first reason
            would file a clinical justification nobody stated, on the record of a placement that
            went against a ward's own assessment — the worst possible field to guess.
          */}
          <select
            id={`ward-referral-match-override-reason-${unit.id}`}
            className={styles.matchOverrideSelect}
            data-testid={`ward-referral-match-override-reason-${unit.id}`}
            value={overrideReason ?? ""}
            onChange={(event) => {
              const chosen = event.target.value;
              // Membership, never truthiness — the reducer refuses an unrecognised string outright,
              // so anything this control cannot vouch for must never leave it.
              setOverrideReason(
                OVERRIDE_REASONS.includes(chosen as OverrideReason) ? (chosen as OverrideReason) : undefined,
              );
            }}
          >
            <option value="">Choose a reason…</option>
            {OVERRIDE_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={styles.matchOverrideButton}
            data-testid={`ward-referral-match-override-accept-${unit.id}`}
            aria-disabled={overrideReason === undefined ? "true" : undefined}
            aria-describedby={
              overrideReason === undefined ? `ward-referral-match-override-blocked-${unit.id}` : undefined
            }
            title={overrideReason === undefined ? OVERRIDE_REASON_UNCHOSEN : undefined}
            onClick={
              overrideReason === undefined ? ignoreUnavailableActivation : () => onAccept(unit.id, overrideReason)
            }
          >
            Accept anyway at {unit.name}
          </button>
          {overrideReason === undefined ? (
            <span id={`ward-referral-match-override-blocked-${unit.id}`} className="sr-only">
              {OVERRIDE_REASON_UNCHOSEN}
            </span>
          ) : null}
        </div>
      )}
    </li>
  );
}
