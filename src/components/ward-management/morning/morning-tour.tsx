"use client";

import { useEffect, useRef, useState } from "react";

import type { Instant } from "@/components/ward-management/ward-clock";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { Rejection } from "@/components/ward-management/ward-model";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";

import type { MorningView } from "./morning-page";
import styles from "./morning-tour.module.css";

/**
 * Task 3 (Phase 6): the sixty-second self-driving guided tour. It exists so the product owner
 * can hand a colleague a link instead of narrating over their shoulder — which is exactly why it
 * has to be honest: every dispatch below is a REAL event through the SAME `EVENT_ROLE` gate every
 * screen uses, never a scripted animation standing in for the product. See this file's own
 * `tourBeatEvents` for the five beats and the controller ruling (R4) that their roles are not
 * negotiable.
 *
 * Deterministic synthetic identifiers the tour drives against. All three exist on every tour run
 * because beat 0 always dispatches `RESET_SCENARIO`, and `seedWardFlowState()`'s own default
 * argument is `"standard"` regardless of whatever scenario was active before Start was pressed
 * (ward-flow-reducer.ts's own doc comment on that default is explicit that this is deliberate,
 * not an oversight) — so a coordinator who had switched to the scarce-beds scenario before
 * starting the tour still gets the same, reproducible five beats.
 */
const TOUR_ED_ID = "scgh-ed";
const TOUR_UNIT_ID = "scgh-adult-open";
/** WR-002 in the seeded fixture (`ward-movements.ts`): a `predicted` release at the very unit the
 *  tour refers its patient to, so beat 3's two dispatches read as one story rather than two
 *  unrelated ones — the ward about to receive a referral is also the ward whose bed is freeing
 *  up. */
const TOUR_RELEASE_ID = "WR-002";
/** WF-901 — the id `nextReferralId` in the reducer produces from a freshly reset
 *  `referralSequence` of 0 (`RAISE_REFERRAL`'s own case increments it to 1 before formatting).
 *  Real and deterministic, not guessed: the very first referral raised after a reset is always
 *  exactly this id, the same discipline `nextReferralId`'s own doc comment states (no
 *  `Math.random()`). */
const TOUR_MOVEMENT_ID = "WF-901";

/** The last beat index (spec's table runs 0..4 inclusive — five states, five transitions between
 *  them, which is what makes the whole tour ~60 seconds at `TOUR_BEAT_INTERVAL_MS` each). */
const LAST_BEAT = 4;

/** Exported so a test can drive beat timing without duplicating this number, and so the "sixty
 *  seconds" in the Start button's own label stays true: five transitions (0→1, 1→2, 2→3, 3→4,
 *  4→finish) at this interval sum to exactly sixty seconds. */
export const TOUR_BEAT_INTERVAL_MS = 12_000;

/**
 * The five beats' real reducer events, as pure data — pulled out of the component so a test can
 * assert every event's `role` against `ward-flow-events.ts`'s own `EVENT_ROLE` table directly,
 * without rendering anything or waiting on a timer. Exported for exactly that static check; nothing
 * else should call this to add a beat — a beat that cannot be expressed with an existing event is
 * a finding about the model, not a reason to extend this function (spec, hard requirement).
 *
 * Beat 4 dispatches nothing: the live board simply re-renders against the shared state the first
 * four beats already changed (spec table row 4, "none — the live board re-renders").
 */
export function tourBeatEvents(beat: number, now: Instant): WardFlowEvent[] {
  switch (beat) {
    case 0:
      return [{ type: "RESET_SCENARIO", role: "demo", now }];
    case 1:
      return [
        {
          type: "RAISE_REFERRAL",
          role: "ed",
          now,
          edId: TOUR_ED_ID,
          draft: {
            cohort: "Adult",
            security: "Open",
            sex: "Female",
            specialling: false,
            // The most conservative draft available, touching nothing legal-adjacent (brief).
            legalStatus: "Voluntary",
            urgency: 2,
            // A first-class "no form" choice, not a missing value — see `ReferralDraft`'s own
            // doc comment on `legalFormCode`.
            legalFormCode: null,
          },
        },
      ];
    case 2:
      return [
        {
          type: "REFER_TO_UNITS",
          role: "coordinator",
          now,
          movementId: TOUR_MOVEMENT_ID,
          unitIds: [TOUR_UNIT_ID],
        },
      ];
    case 3:
      return [
        { type: "ACCEPT_IN_PRINCIPLE", role: "ward", now, movementId: TOUR_MOVEMENT_ID, unitId: TOUR_UNIT_ID },
        { type: "CONFIRM_BED_RELEASE", role: "ward", now, releaseId: TOUR_RELEASE_ID, actingUnitId: TOUR_UNIT_ID },
      ];
    default:
      return [];
  }
}

const BEAT_CAPTIONS: Record<number, { heading: string; body: string }> = {
  0: {
    heading: "Resetting the demo",
    body: "Starting from a clean, invented scenario. Nothing on this screen is a record of a real patient, ward or hospital.",
  },
  1: {
    heading: "A patient is waiting",
    body: "An invented patient has just been referred from the emergency department and is waiting for a bed. Every figure here is invented.",
  },
  2: {
    heading: "A coordinator finds a bed",
    body: "A bed coordinator refers the invented patient to a ward with capacity. Every figure here is invented.",
  },
  3: {
    heading: "The ward confirms",
    body: "The ward accepts the referral in principle, and separately confirms that a predicted bed is now ready to release. Every figure here is invented.",
  },
  4: {
    heading: "The board updates",
    body: "The board above reflects the change immediately — the same figures a coordinator would see. Every figure here is invented.",
  },
};

type TourPhase = "idle" | "running" | "refused";

/**
 * Task 3. Mounted by `MorningPage` alongside `MorningBody`, given the same `setView` setter
 * `MorningBody` already receives, so it can switch the page to the live view at Start without
 * reaching back into `MorningPage`'s own state (see that file's own doc comment on `MorningBody`).
 *
 * Tour progress — which beat, running or not — lives ENTIRELY in this component's own `useState`
 * calls and never enters the reducer's shared `WardFlowState` (spec D11): that is what keeps this
 * file cheap to change if the four-stage bed model is ever revised. The events it dispatches are
 * shared state, exactly like every other screen's; the fact that a tour is driving them is not.
 */
export function MorningTour({ onChangeView }: { onChangeView: (view: MorningView) => void }) {
  const { dispatch, rejections, now } = useWardFlow();

  const [phase, setPhase] = useState<TourPhase>("idle");
  const [beat, setBeat] = useState(0);
  const [rejection, setRejection] = useState<Rejection | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Refs, not state: each is read at the moment a scheduled callback actually fires, which is
  // deliberately NOT the render that scheduled it — `now` and `reducedMotion` may have moved on
  // by then, and a stale closure over old state would either mislabel an event's `now` or ignore
  // a reduced-motion preference the visitor changed mid-tour.
  const nowRef = useRef(now);
  nowRef.current = now;
  const reducedMotionRef = useRef(false);
  const phaseRef = useRef<TourPhase>("idle");
  phaseRef.current = phase;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSeenRejectionCountRef = useRef(rejections.length);

  // Detect `window.matchMedia`, guarded for absence (spec). Mirrors the addEventListener/
  // addListener fallback every other ward-flow CSS-adjacent media-query consumer in this codebase
  // already carries, rather than assuming only the modern API exists.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = query.matches;
    setReducedMotion(query.matches);
    const listener = (event: MediaQueryListEvent) => {
      reducedMotionRef.current = event.matches;
      setReducedMotion(event.matches);
    };
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", listener);
    } else if (typeof query.addListener === "function") {
      query.addListener(listener);
    }
    return () => {
      if (typeof query.removeEventListener === "function") {
        query.removeEventListener("change", listener);
      } else if (typeof query.removeListener === "function") {
        query.removeListener(listener);
      }
    };
  }, []);

  // Never leave a pending advance running after this component unmounts.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  /**
   * `rejections` is shared reducer state (never the tour's own copy — spec D11), so this is how
   * the tour learns one of ITS OWN dispatches was refused: it compares the count already seen
   * against the live count on every render, rather than assuming the newest entry belongs to it.
   * While the tour is running nothing else in this isolated demo flow appends to `rejections`, so
   * any growth observed here is the beat that was just attempted. Hard requirement: stop AT that
   * beat, never advance past it — this effect cancels the pending auto-advance the instant it
   * fires, which is what makes that true even under the timed (non-reduced-motion) path.
   */
  useEffect(() => {
    if (rejections.length > lastSeenRejectionCountRef.current && phaseRef.current === "running") {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setRejection(rejections[rejections.length - 1]);
      setPhase("refused");
    }
    lastSeenRejectionCountRef.current = rejections.length;
  }, [rejections]);

  function runBeat(n: number) {
    for (const event of tourBeatEvents(n, nowRef.current)) dispatch(event);
    setBeat(n);
    // Reduced motion: no timed transitions at all (spec D12) — the Next control drives every
    // step instead, including the final one into `finish()`.
    if (reducedMotionRef.current) return;
    timerRef.current = setTimeout(
      () => {
        if (n >= LAST_BEAT) finish();
        else runBeat(n + 1);
      },
      TOUR_BEAT_INTERVAL_MS,
    );
  }

  function finish() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // Hard requirement: the tour ends by resetting, so it never leaves the demo half-finished for
    // whoever opens the app next.
    dispatch({ type: "RESET_SCENARIO", role: "demo", now: nowRef.current });
    setPhase("idle");
    setBeat(0);
    setRejection(null);
  }

  function handleStart() {
    // `RESET_SCENARIO` (dispatched by beat 0 below) always empties `rejections`, so the baseline
    // for "did OUR next dispatch just get refused" is always zero from here.
    lastSeenRejectionCountRef.current = 0;
    setRejection(null);
    // The fixed view is a frozen snapshot and would never show beat 4's board updating (ruling
    // R1) — switching to the live view is itself part of the demonstration.
    onChangeView("live");
    setPhase("running");
    runBeat(0);
  }

  /** Real control, real handler, takes effect at the current beat rather than at the end: this
   *  cancels whatever timer is pending BEFORE anything else, so a click here can never race a
   *  scheduled auto-advance that is about to fire. */
  function handleStop() {
    finish();
  }

  function handleNext() {
    if (beat >= LAST_BEAT) finish();
    else runBeat(beat + 1);
  }

  if (phase === "idle") {
    return (
      <div className={styles.tour}>
        <button
          type="button"
          className={styles.startButton}
          data-testid="ward-morning-tour-start"
          onClick={handleStart}
        >
          Start 60-second guided tour
        </button>
      </div>
    );
  }

  const caption = phase === "refused" ? null : BEAT_CAPTIONS[beat];

  return (
    <div className={styles.tour} data-testid="ward-morning-tour" data-phase={phase}>
      <div className={styles.header}>
        <span className={styles.beat} data-testid="ward-morning-tour-beat">
          Beat {beat} of {LAST_BEAT}
        </span>
        <button type="button" className={styles.stopButton} data-testid="ward-morning-tour-stop" onClick={handleStop}>
          Stop tour
        </button>
      </div>
      <div
        className={phase === "refused" ? `${styles.caption} ${styles.captionRefused}` : styles.caption}
        data-testid="ward-morning-tour-caption"
        aria-live="polite"
      >
        {phase === "refused" && rejection ? (
          <>
            <p className={styles.captionHeading}>The model refused this step</p>
            <p>{rejection.reason}</p>
            <p>Every figure in this tour is invented. Press Stop to reset the demo data.</p>
          </>
        ) : (
          caption && (
            <>
              <p className={styles.captionHeading}>{caption.heading}</p>
              <p>{caption.body}</p>
            </>
          )
        )}
      </div>
      {reducedMotion && phase === "running" && (
        <button type="button" className={styles.nextButton} data-testid="ward-morning-tour-next" onClick={handleNext}>
          Next
        </button>
      )}
    </div>
  );
}
