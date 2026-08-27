"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
import {
  COHORTS,
  HOME_REGIONS,
  REFERRAL_SOURCES,
  type Cohort,
  type HomeRegion,
  type ReferralSource,
  type Rejection,
  type Sex,
} from "@/components/ward-management/ward-model";
import { wardSites } from "@/components/ward-management/ward-sites";

import styles from "./referrals.module.css";

/**
 * Task 4 (Phase 7, "The front door"): the one intake form every source uses — community, crisis
 * service, police, ambulance and inter-hospital alike raise a referral through this same screen,
 * never a source-specific variant. `ReferralSource` (chosen on the form itself, see below)
 * distinguishes WHERE the request came from; the fixed `"community"` role below is WHO is
 * permitted to raise `RECEIVE_REFERRAL` at all (`ward-flow-events.ts`'s `EVENT_ROLES` table) —
 * the two are independent, exactly like `ed-screen.tsx`'s referral form already treats `role`
 * and the reducer's own subject fields as separate facts.
 *
 * Every picker here is derived directly from the runtime lists `ward-model.ts` exports —
 * `COHORTS`, `HOME_REGIONS`, `REFERRAL_SOURCES` — or, for the origin site, from `wardSites`
 * itself, never a hand-written array in this file. That is the fix for a defect class that has
 * shipped four separate times in this project: a hand-maintained option list a type or fixture
 * change cannot reach, most recently an emergency-department picker that silently omitted a new
 * age band. `Sex` and urgency (`1 | 2 | 3`) are the two exceptions — both are fixed, already-
 * exhaustive literal unions with no runtime array of their own anywhere in `ward-model.ts` (see
 * that file's own comment on `COHORTS` for why: only 3+-value unions get one), so `SEX_OPTIONS`
 * and `URGENCY_OPTIONS` below mirror the exact same fixed literals `ed-screen.tsx` and
 * `shortlist-panel.tsx` already use for the same two types.
 */
const AGE_BAND_OPTIONS: Cohort[] = [...COHORTS];
const HOME_REGION_OPTIONS: HomeRegion[] = [...HOME_REGIONS];
const SOURCE_OPTIONS: ReferralSource[] = [...REFERRAL_SOURCES];
const SEX_OPTIONS: Sex[] = ["Female", "Male"];
const URGENCY_OPTIONS: (1 | 2 | 3)[] = [1, 2, 3];

/** Display labels only — never the picker's own option set, which is always
 *  `SOURCE_OPTIONS.map(...)`. A source missing from this map still renders (as its own raw
 *  value, via the `??` fallback below), it just renders less prettily — so a future
 *  `ReferralSource` this map forgets is never silently dropped from the list, only unlabelled. */
const SOURCE_LABELS: Record<ReferralSource, string> = {
  community: "Community",
  crisis_service: "Crisis service",
  police: "Police",
  ambulance: "Ambulance",
  inter_hospital: "Inter-hospital",
};

type ReferralDraft = {
  ageBand: Cohort;
  sex: Sex;
  homeRegion: HomeRegion;
  secureBedNeeded: boolean;
  involuntaryBedNeeded: boolean;
  source: ReferralSource;
  urgency: 1 | 2 | 3;
  originSiteCode: string;
  transportNeeded: boolean;
};

function initialDraft(): ReferralDraft {
  return {
    ageBand: AGE_BAND_OPTIONS[0],
    sex: SEX_OPTIONS[0],
    homeRegion: HOME_REGION_OPTIONS[0],
    secureBedNeeded: false,
    involuntaryBedNeeded: false,
    source: SOURCE_OPTIONS[0],
    // Neither the most nor the least urgent tier by default — a blank form must never read as
    // an assumption about how urgent this particular request is.
    urgency: 2,
    originSiteCode: wardSites[0]?.code ?? "",
    transportNeeded: false,
  };
}

/**
 * The referral intake form. Phone-first: a police or ambulance officer standing in someone's
 * living room, or a community nurse between visits, is this screen's primary user, not someone
 * at a desk (`referrals.module.css`'s own top comment). Every field is a picker or a toggle —
 * there is no free-text input anywhere on this screen, and there never should be; a field that
 * seems to need one is a finding to report, not a control to add here.
 *
 * `RECEIVE_REFERRAL` can be refused by the reducer (unknown source, an age band outside
 * `COHORTS`, an origin site code that does not resolve, urgency outside 1-3, or a home region
 * outside `HOME_REGIONS` — see `ward-flow-reducer.ts`'s own case). This form's pickers only ever
 * offer values already known to be valid, so a refusal should never happen through ordinary use
 * of this screen — but the reducer validates independently of what any UI sends it, and a
 * refusal is surfaced here (`ward-referral-intake-rejection`) rather than silently swallowed,
 * exactly as the spec's own failure-behaviour rule requires.
 */
export function ReferralIntakeForm() {
  const { now, dispatch, rejections } = useWardFlow();
  const [draft, setDraft] = useState<ReferralDraft>(initialDraft);
  const [lastRejection, setLastRejection] = useState<Rejection | undefined>(undefined);
  const [confirmed, setConfirmed] = useState(false);

  // Tracks how many rejections existed the moment THIS form last submitted, so the effect below
  // can tell "a new rejection appeared because of my own submission" apart from "a rejection
  // already existed before I was mounted" or "some other screen raised one". `checkToken`
  // forces the effect to re-run even on a successful submit, where `rejections` itself never
  // changes reference (RECEIVE_REFERRAL's success branch touches `state.referrals`, not
  // `state.rejections` — see `ward-flow-reducer.ts`) and so would never re-fire this effect on
  // its own.
  const priorRejectionCountRef = useRef(rejections.length);
  const [checkToken, setCheckToken] = useState(0);

  useEffect(() => {
    if (checkToken === 0) return; // Nothing submitted yet — show neither a rejection nor a confirmation.
    if (rejections.length > priorRejectionCountRef.current) {
      const newest = rejections[rejections.length - 1];
      setLastRejection(newest.attempted === "RECEIVE_REFERRAL" ? newest : undefined);
      setConfirmed(false);
    } else {
      setLastRejection(undefined);
      setConfirmed(true);
    }
    priorRejectionCountRef.current = rejections.length;
  }, [rejections, checkToken]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    priorRejectionCountRef.current = rejections.length;
    dispatch({
      type: "RECEIVE_REFERRAL",
      role: "community",
      now,
      ageBand: draft.ageBand,
      sex: draft.sex,
      secureBedNeeded: draft.secureBedNeeded,
      involuntaryBedNeeded: draft.involuntaryBedNeeded,
      homeRegion: draft.homeRegion,
      source: draft.source,
      urgency: draft.urgency,
      originSiteCode: draft.originSiteCode,
      transportNeeded: draft.transportNeeded,
    });
    setCheckToken((token) => token + 1);
  }

  return (
    <div className={styles.screen} data-testid="ward-referral-intake-screen">
      <ClinicalRail />
      <main id="main-content" className={styles.main}>
        <h1 className="sr-only">Raise a referral</h1>

        <div className={styles.governanceBanner} data-testid="ward-referral-intake-governance">
          <span className={styles.prototypeBadge}>Synthetic prototype</span>
          <p>
            This form is <strong>not a medical device</strong>. It records only the five permitted facts about the
            person referred, plus the request itself &mdash; never a name, never free text, and never a figure from the
            Mental Health Act.
          </p>
        </div>

        <header className={styles.pageHeader}>
          <h2 className={styles.pageTitle}>Raise a referral</h2>
          <p className={styles.pageSubtitle}>
            One form for every source &mdash; community, crisis service, police, ambulance or inter-hospital.
          </p>
        </header>

        <form className={styles.form} onSubmit={handleSubmit} data-testid="ward-referral-intake-form">
          <fieldset className={styles.fieldCard}>
            <legend className={styles.fieldLegend}>Age band</legend>
            <select
              data-testid="ward-referral-intake-ageBand"
              className={styles.select}
              value={draft.ageBand}
              onChange={(event) => setDraft((current) => ({ ...current, ageBand: event.target.value as Cohort }))}
            >
              {AGE_BAND_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </fieldset>

          <fieldset className={styles.fieldCard}>
            <legend className={styles.fieldLegend}>Sex</legend>
            <select
              data-testid="ward-referral-intake-sex"
              className={styles.select}
              value={draft.sex}
              onChange={(event) => setDraft((current) => ({ ...current, sex: event.target.value as Sex }))}
            >
              {SEX_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </fieldset>

          <fieldset className={styles.fieldCard}>
            <legend className={styles.fieldLegend}>Home region</legend>
            <select
              data-testid="ward-referral-intake-homeRegion"
              className={styles.select}
              value={draft.homeRegion}
              onChange={(event) =>
                setDraft((current) => ({ ...current, homeRegion: event.target.value as HomeRegion }))
              }
            >
              {HOME_REGION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </fieldset>

          <fieldset className={styles.fieldCard}>
            <legend className={styles.fieldLegend}>Referral source</legend>
            <select
              data-testid="ward-referral-intake-source"
              className={styles.select}
              value={draft.source}
              onChange={(event) =>
                setDraft((current) => ({ ...current, source: event.target.value as ReferralSource }))
              }
            >
              {SOURCE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {SOURCE_LABELS[option] ?? option}
                </option>
              ))}
            </select>
          </fieldset>

          <fieldset className={styles.fieldCard}>
            <legend className={styles.fieldLegend}>Urgency</legend>
            <select
              data-testid="ward-referral-intake-urgency"
              className={styles.select}
              value={draft.urgency}
              onChange={(event) =>
                setDraft((current) => ({ ...current, urgency: Number(event.target.value) as 1 | 2 | 3 }))
              }
            >
              {URGENCY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </fieldset>

          <fieldset className={styles.fieldCard}>
            <legend className={styles.fieldLegend}>Origin site</legend>
            <select
              data-testid="ward-referral-intake-originSiteCode"
              className={styles.select}
              value={draft.originSiteCode}
              onChange={(event) => setDraft((current) => ({ ...current, originSiteCode: event.target.value }))}
            >
              {wardSites.map((site) => (
                <option key={site.code} value={site.code}>
                  {site.name} ({site.code})
                </option>
              ))}
            </select>
          </fieldset>

          <label className={styles.toggleCard}>
            <input
              type="checkbox"
              data-testid="ward-referral-intake-secureBedNeeded"
              checked={draft.secureBedNeeded}
              onChange={(event) => setDraft((current) => ({ ...current, secureBedNeeded: event.target.checked }))}
            />
            Needs a secure bed
          </label>

          <label className={styles.toggleCard}>
            <input
              type="checkbox"
              data-testid="ward-referral-intake-involuntaryBedNeeded"
              checked={draft.involuntaryBedNeeded}
              onChange={(event) => setDraft((current) => ({ ...current, involuntaryBedNeeded: event.target.checked }))}
            />
            Needs a bed that can hold someone involuntarily
          </label>

          <label className={styles.toggleCard}>
            <input
              type="checkbox"
              data-testid="ward-referral-intake-transportNeeded"
              checked={draft.transportNeeded}
              onChange={(event) => setDraft((current) => ({ ...current, transportNeeded: event.target.checked }))}
            />
            Transport needed
          </label>

          {lastRejection ? (
            <p className={styles.rejection} data-testid="ward-referral-intake-rejection" role="alert">
              Referral not sent: {lastRejection.reason}
            </p>
          ) : null}

          {confirmed ? (
            <p className={styles.confirmation} data-testid="ward-referral-intake-confirmation">
              Referral sent. It is now queued for a coordinator to review.
            </p>
          ) : null}

          <button type="submit" className={styles.submit} data-testid="ward-referral-intake-submit">
            Send referral
          </button>
        </form>
      </main>
    </div>
  );
}
