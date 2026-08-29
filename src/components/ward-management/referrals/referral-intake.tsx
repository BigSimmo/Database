"use client";

import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";

import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
import {
  COHORTS,
  HOME_REGIONS,
  REFERRAL_SOURCES,
  SEXES,
  URGENCY_LEVELS,
  type Cohort,
  type HomeRegion,
  type ReferralSource,
  type Rejection,
  type Sex,
  type UrgencyLevel,
} from "@/components/ward-management/ward-model";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
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
 * `COHORTS`, `HOME_REGIONS`, `REFERRAL_SOURCES`, `SEXES`, `URGENCY_LEVELS` — or, for the origin
 * site, from `wardSites` itself, never a hand-written array in this file. That is the fix for a
 * defect class that has shipped four separate times in this project: a hand-maintained option
 * list a type or fixture change cannot reach, most recently an emergency-department picker that
 * silently omitted a new age band. `Sex` and urgency used to be the two exceptions — fixed,
 * already-exhaustive literal unions with no runtime array of their own anywhere in
 * `ward-model.ts` — until Phase 7 Task 5 added `SEXES` and `URGENCY_LEVELS` there for exactly
 * this reason (see that file's own comment on `SEXES`); `SEX_OPTIONS` and `URGENCY_OPTIONS`
 * below now derive from them like every other picker on this form.
 */
const AGE_BAND_OPTIONS: Cohort[] = [...COHORTS];
const HOME_REGION_OPTIONS: HomeRegion[] = [...HOME_REGIONS];
const SOURCE_OPTIONS: ReferralSource[] = [...REFERRAL_SOURCES];
const SEX_OPTIONS: Sex[] = [...SEXES];
const URGENCY_OPTIONS: UrgencyLevel[] = [...URGENCY_LEVELS];

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

/**
 * Phase R2.1: the one value that means "nobody has answered this question yet".
 *
 * It lives in THIS FORM'S OWN DRAFT STATE AND NOWHERE ELSE. It is never dispatched, never
 * reaches `RECEIVE_REFERRAL`, never reaches the reducer and never reaches a `Referral` — the
 * form cannot be sent while any field still holds it (see `answeredDraft` below, and the inert
 * Send at the bottom of this file). So `Referral` is unchanged, the event is unchanged and the
 * reducer is unchanged: this is a fact about a half-filled form, not a new clinical state.
 *
 * **Why not the empty string, which would have been the obvious choice.** `""` is already
 * load-bearing for the origin-site picker. `tests/ward-referral-screens.dom.test.tsx` provokes a
 * GENUINE reducer refusal — the repository's only proof that an intake refusal reaches the screen
 * rather than being swallowed — by setting that select to a code no option carries, which leaves
 * the DOM's own resolved value at `""` (no matching option -> selectedIndex -1 -> value ""), so
 * `siteByCode("")` resolves to nothing and `RECEIVE_REFERRAL` refuses the event. Had `""` become
 * the unanswered sentinel, Send would go inert on that value, the reducer would never be reached,
 * and that proof would be destroyed **while the test still passed for a different reason**. With
 * the sentinel distinct from `""`, an origin site of `""` remains an ANSWER — an invalid one the
 * reducer is left to refuse, exactly as before — and it stays unreachable by ordinary use of this
 * screen, because no option on this form carries it.
 *
 * The value is deliberately not a member of `COHORTS`, `SEXES`, `HOME_REGIONS`,
 * `REFERRAL_SOURCES`, `URGENCY_LEVELS` or any site code — asserted, not assumed, in that suite.
 */
export const UNANSWERED_VALUE = "not-answered";

/** The leading option every picker carries while it is unanswered. Worded as a PROMPT, never as
 *  a state: a "Not known" reading here would look like a sendable answer, and a sending "not
 *  known" is deliberately NOT part of this work — it needs a model decision nobody has taken
 *  (`involuntaryBedNeeded` would have to stop being a `boolean`, which the eligibility gate
 *  reads, and `HOME_REGIONS` would have to gain an eleventh member that `ward-teams.ts` makes a
 *  compile break on purpose so that a human decides). */
export const UNANSWERED_OPTION_LABEL = "Choose one";

/** The id `aria-describedby` on Send points at while Send is unavailable. */
const UNAVAILABLE_REASON_ID = "ward-referral-intake-unavailable-reason";

function isUnanswered(value: unknown): boolean {
  return value === UNANSWERED_VALUE;
}

type ReferralDraft = {
  ageBand: Cohort | typeof UNANSWERED_VALUE;
  sex: Sex | typeof UNANSWERED_VALUE;
  homeRegion: HomeRegion | typeof UNANSWERED_VALUE;
  secureBedNeeded: boolean | typeof UNANSWERED_VALUE;
  involuntaryBedNeeded: boolean | typeof UNANSWERED_VALUE;
  source: ReferralSource | typeof UNANSWERED_VALUE;
  urgency: UrgencyLevel | typeof UNANSWERED_VALUE;
  /** Already a `string`, so the sentinel needs no widening here — but see `UNANSWERED_VALUE`'s
   *  own comment for why that sentinel must not be `""`. */
  originSiteCode: string;
  transportNeeded: boolean;
};

/** The nine fields exactly as `RECEIVE_REFERRAL` takes them, once every question has an answer. */
type AnsweredDraft = {
  ageBand: Cohort;
  sex: Sex;
  homeRegion: HomeRegion;
  secureBedNeeded: boolean;
  involuntaryBedNeeded: boolean;
  source: ReferralSource;
  urgency: UrgencyLevel;
  originSiteCode: string;
  transportNeeded: boolean;
};

/**
 * Every question Send waits on, in the order the form asks them, with the name the unavailability
 * note calls each one.
 *
 * `transportNeeded` is deliberately absent. It is a fact about the REFERRAL rather than about the
 * person; an unticked box there reads as "no transport arranged" rather than as a clinical claim
 * about someone, and making it a third yes/no group would cost a tap this work is not authorised
 * to spend. Recorded as a residual rather than quietly folded in here.
 *
 * The two need questions are named by short field names rather than by their full on-screen
 * wording on purpose: that wording ("Needs a secure bed" …) is a clinical rule with its own test,
 * and repeating it inside this sentence would put the same clinical phrase on the screen twice.
 */
const REQUIRED_FIELDS: readonly { readonly key: keyof ReferralDraft; readonly name: string }[] = [
  { key: "ageBand", name: "Age band" },
  { key: "sex", name: "Sex" },
  { key: "homeRegion", name: "Home region" },
  { key: "source", name: "Referral source" },
  { key: "urgency", name: "Urgency" },
  { key: "originSiteCode", name: "Origin site" },
  { key: "secureBedNeeded", name: "Secure bed needed" },
  { key: "involuntaryBedNeeded", name: "Involuntary bed needed" },
];

/** The same names, in the same order, for the suite that pins what the note may say. */
export const REQUIRED_FIELD_NAMES: readonly string[] = REQUIRED_FIELDS.map((field) => field.name);

function unansweredFieldNames(draft: ReferralDraft): string[] {
  return REQUIRED_FIELDS.filter((field) => isUnanswered(draft[field.key])).map((field) => field.name);
}

/**
 * The draft as `RECEIVE_REFERRAL` would take it, or `undefined` while any question is unanswered.
 *
 * This is the single place the sentinel is stopped from escaping the form, and there is
 * deliberately no branch mapping an unanswered value onto a default on the way out. Mapping an
 * unanswered `involuntaryBedNeeded` onto `false` would be the very defect this task removes,
 * moved one layer down where nobody looks: `false` means "impose no legal-status constraint",
 * which is a definite clinical answer nobody gave.
 */
function answeredDraft(draft: ReferralDraft): AnsweredDraft | undefined {
  const { ageBand, sex, homeRegion, secureBedNeeded, involuntaryBedNeeded, source, urgency, originSiteCode } = draft;
  if (ageBand === UNANSWERED_VALUE || sex === UNANSWERED_VALUE || homeRegion === UNANSWERED_VALUE) return undefined;
  if (source === UNANSWERED_VALUE || urgency === UNANSWERED_VALUE || originSiteCode === UNANSWERED_VALUE) {
    return undefined;
  }
  if (secureBedNeeded === UNANSWERED_VALUE || involuntaryBedNeeded === UNANSWERED_VALUE) return undefined;
  return {
    ageBand,
    sex,
    homeRegion,
    secureBedNeeded,
    involuntaryBedNeeded,
    source,
    urgency,
    originSiteCode,
    transportNeeded: draft.transportNeeded,
  };
}

/**
 * Phase R2.1. Every field arrives UNANSWERED.
 *
 * What this replaces: this function used to return all nine fields fully answered — age band,
 * sex, home region and referral source each took option zero, and both need toggles took `false`.
 * One tap then sent a complete-looking referral in which nothing downstream could tell a default
 * from an answer, and a wrong age band eliminates every unit in the network through a plain
 * equality gate — so a coordinator read a screenful of individually plausible refusals instead of
 * "this was never answered". `urgency` was the one field somebody had thought about, and its old
 * comment ("a blank form must never read as an assumption about how urgent this particular
 * request is") was already the argument for every other field on the form.
 *
 * The two need toggles matter most: an untouched checkbox sent `false`, which is not "unknown" —
 * it is the definite clinical claim that this person does not need a secure bed and does not need
 * a bed that can hold them involuntarily. They are now yes/no questions with no answer until one
 * is chosen, which needs no model change at all: what reaches the reducer is still a `boolean`,
 * it is simply a boolean somebody picked.
 */
function initialDraft(): ReferralDraft {
  return {
    ageBand: UNANSWERED_VALUE,
    sex: UNANSWERED_VALUE,
    homeRegion: UNANSWERED_VALUE,
    secureBedNeeded: UNANSWERED_VALUE,
    involuntaryBedNeeded: UNANSWERED_VALUE,
    source: UNANSWERED_VALUE,
    urgency: UNANSWERED_VALUE,
    originSiteCode: UNANSWERED_VALUE,
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
 * Every picker carries a real accessible NAME (review finding I4). Each field used to be a
 * `<fieldset>` with a `<legend>`, which names the fieldset's own `group` role and NOT the
 * `<select>` inside it — so all six controls announced as unnamed combo boxes on the one screen
 * a police or ambulance officer fills in on a phone (spec D12), carrying the five permitted facts
 * about a person. They are now `<label htmlFor>` + `<select id>`, which is what the house pattern
 * already does: `ed-screen.tsx`'s own referral form wraps each `<select>` in a `<label>`, and
 * `referral-match.tsx`'s decline picker uses this exact `.fieldLegend` label shape. No CSS
 * changed — `.fieldCard` and `.fieldLegend` are class selectors, so they style a `<div>` and a
 * `<label>` identically. Tap targets are untouched: every `.select` stays `--ri-space-48` (48px).
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

  // Phase R2.1. The outstanding questions, recomputed on every render from the draft itself
  // rather than tracked in a second piece of state that could disagree with it.
  const outstanding = unansweredFieldNames(draft);
  const answered = answeredDraft(draft);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // The keyboard route to the same guard the inert Send below enforces for a tap: implicit
    // submission never reaches a dispatch while a question is unanswered either.
    if (!answered) return;
    priorRejectionCountRef.current = rejections.length;
    dispatch({
      type: "RECEIVE_REFERRAL",
      role: "community",
      now,
      ageBand: answered.ageBand,
      sex: answered.sex,
      secureBedNeeded: answered.secureBedNeeded,
      involuntaryBedNeeded: answered.involuntaryBedNeeded,
      homeRegion: answered.homeRegion,
      source: answered.source,
      urgency: answered.urgency,
      originSiteCode: answered.originSiteCode,
      transportNeeded: answered.transportNeeded,
    });
    setCheckToken((token) => token + 1);
  }

  /**
   * The inert activation for an unavailable Send (`docs/wiring-conventions.md`'s stated-reason
   * shape). `aria-disabled` — unlike the native attribute — does not block activation, so without
   * this the control would stay fully operable; and the native attribute is wrong here because it
   * removes the tab stop, which is exactly where the reason below the button is announced from.
   */
  function ignoreUnavailableActivation(event: MouseEvent<HTMLButtonElement>) {
    if (answered) return;
    event.preventDefault();
  }

  return (
    <div className={styles.screen} data-testid="ward-referral-intake-screen">
      <ClinicalRail />
      <main id="main-content" className={styles.main}>
        <div className={styles.governanceBanner} data-testid="ward-referral-intake-governance">
          <span className={styles.prototypeBadge}>Synthetic prototype</span>
          <p>
            This form is <strong>not a medical device</strong>. It records only the five permitted facts about the
            person referred, plus the request itself &mdash; never a name, never free text, and never a figure from the
            Mental Health Act.
          </p>
        </div>

        <header className={styles.pageHeader}>
          {/*
           * Review finding M6: this screen used to carry an `sr-only` <h1> at the top of <main>
           * AND this visible heading with identical text, so a screen-reader user heard the same
           * phrase twice at two levels. The VISIBLE heading is the <h1> — one heading, seen and
           * heard alike, and the landmark contract (exactly one <h1> per route,
           * `tests/ward-landmarks.test.ts`) is satisfied by the heading a sighted user reads
           * rather than by a duplicate nobody can see.
           */}
          <h1 className={styles.pageTitle}>Raise a referral</h1>
          <p className={styles.pageSubtitle}>
            One form for every source &mdash; community, crisis service, police, ambulance or inter-hospital.
          </p>
        </header>

        <form className={styles.form} onSubmit={handleSubmit} data-testid="ward-referral-intake-form">
          <div className={styles.fieldCard}>
            <label className={styles.fieldLegend} htmlFor="ward-referral-intake-ageBand">
              Age band
            </label>
            <select
              id="ward-referral-intake-ageBand"
              data-testid="ward-referral-intake-ageBand"
              className={styles.select}
              value={draft.ageBand}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  ageBand: event.target.value as Cohort | typeof UNANSWERED_VALUE,
                }))
              }
            >
              {/* The unanswered state is a real leading option rather than a select with no
                  option selected, so a clinician on a phone sees a prompt instead of a blank
                  control — and so the state a screen reader announces is the state the form is
                  actually in. Its presence and its position are pinned by the suite. */}
              <option value={UNANSWERED_VALUE}>{UNANSWERED_OPTION_LABEL}</option>
              {AGE_BAND_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.fieldCard}>
            <label className={styles.fieldLegend} htmlFor="ward-referral-intake-sex">
              Sex
            </label>
            <select
              id="ward-referral-intake-sex"
              data-testid="ward-referral-intake-sex"
              className={styles.select}
              value={draft.sex}
              onChange={(event) =>
                setDraft((current) => ({ ...current, sex: event.target.value as Sex | typeof UNANSWERED_VALUE }))
              }
            >
              <option value={UNANSWERED_VALUE}>{UNANSWERED_OPTION_LABEL}</option>
              {SEX_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.fieldCard}>
            <label className={styles.fieldLegend} htmlFor="ward-referral-intake-homeRegion">
              Home region
            </label>
            <select
              id="ward-referral-intake-homeRegion"
              data-testid="ward-referral-intake-homeRegion"
              className={styles.select}
              value={draft.homeRegion}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  homeRegion: event.target.value as HomeRegion | typeof UNANSWERED_VALUE,
                }))
              }
            >
              <option value={UNANSWERED_VALUE}>{UNANSWERED_OPTION_LABEL}</option>
              {HOME_REGION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.fieldCard}>
            <label className={styles.fieldLegend} htmlFor="ward-referral-intake-source">
              Referral source
            </label>
            <select
              id="ward-referral-intake-source"
              data-testid="ward-referral-intake-source"
              className={styles.select}
              value={draft.source}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  source: event.target.value as ReferralSource | typeof UNANSWERED_VALUE,
                }))
              }
            >
              <option value={UNANSWERED_VALUE}>{UNANSWERED_OPTION_LABEL}</option>
              {SOURCE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {SOURCE_LABELS[option] ?? option}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.fieldCard}>
            <label className={styles.fieldLegend} htmlFor="ward-referral-intake-urgency">
              Urgency
            </label>
            <select
              id="ward-referral-intake-urgency"
              data-testid="ward-referral-intake-urgency"
              className={styles.select}
              value={draft.urgency}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  urgency:
                    event.target.value === UNANSWERED_VALUE
                      ? UNANSWERED_VALUE
                      : (Number(event.target.value) as UrgencyLevel),
                }))
              }
            >
              {/* The option TEXT carries the tier's direction; the option VALUE stays the bare
                  tier, so `Referral["urgency"]` and every test reading option values are
                  unchanged. Phase 7 Task 8: this select used to render "1", "2", "3" while the
                  referral board rendered "Tier 2 · urgent" for the very same field — and this is
                  the one screen where a human, possibly a police officer on a phone, CHOOSES the
                  value rather than reading it back. */}
              {/* R2.1: the tier no longer arrives pre-chosen. `Number("not-answered")` is NaN, so
                  the sentinel is carried through the change handler above as itself rather than
                  being coerced into a number nothing would recognise. */}
              <option value={UNANSWERED_VALUE}>{UNANSWERED_OPTION_LABEL}</option>
              {URGENCY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {urgencyTierLabel(option)}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.fieldCard}>
            <label className={styles.fieldLegend} htmlFor="ward-referral-intake-originSiteCode">
              Origin site
            </label>
            <select
              id="ward-referral-intake-originSiteCode"
              data-testid="ward-referral-intake-originSiteCode"
              className={styles.select}
              value={draft.originSiteCode}
              onChange={(event) => setDraft((current) => ({ ...current, originSiteCode: event.target.value }))}
            >
              {/* See `UNANSWERED_VALUE`'s own comment: this picker is exactly why the sentinel is
                  not `""`. An origin site of `""` stays a (bad) ANSWER the reducer refuses, which
                  is the only refusal path this screen has any proof of. */}
              <option value={UNANSWERED_VALUE}>{UNANSWERED_OPTION_LABEL}</option>
              {wardSites.map((site) => (
                <option key={site.code} value={site.code}>
                  {site.name} ({site.code})
                </option>
              ))}
            </select>
          </div>

          {/*
           * Phase R2.1. These two used to be checkboxes, and an untouched checkbox is not a
           * question left open — it is a definite clinical "no" that nobody chose. They are now
           * yes/no groups with neither answer selected until a clinician picks one.
           *
           * A radio pair rather than a third and fourth `<select>`, for two reasons. Clinically it
           * is the cheaper control: one tap answers it where a picker costs two, and this form has
           * to stay quicker to complete than what it replaces or the wards will not adopt it.
           * Structurally it keeps the form at six comboboxes, which is what the accessible-name
           * test counts — the FIELD SET has not grown, only the shape of two controls already here.
           *
           * The legends carry the wording rule unchanged: the requirement attaches to the REQUEST
           * ("needs a bed that can hold someone involuntarily"), never to the person ("is
           * involuntary"). That is a clinical rule with its own assertion, not incidental
           * phrasing, so it is carried over verbatim rather than reworded for the new shape.
           */}
          <fieldset className={styles.choiceCard} data-testid="ward-referral-intake-secureBedNeeded">
            <legend className={styles.fieldLegend}>Needs a secure bed</legend>
            <div className={styles.choiceRow}>
              <label className={styles.choiceOption}>
                <input
                  type="radio"
                  name="ward-referral-intake-secureBedNeeded"
                  data-testid="ward-referral-intake-secureBedNeeded-yes"
                  checked={draft.secureBedNeeded === true}
                  onChange={() => setDraft((current) => ({ ...current, secureBedNeeded: true }))}
                />
                Yes
              </label>
              <label className={styles.choiceOption}>
                <input
                  type="radio"
                  name="ward-referral-intake-secureBedNeeded"
                  data-testid="ward-referral-intake-secureBedNeeded-no"
                  checked={draft.secureBedNeeded === false}
                  onChange={() => setDraft((current) => ({ ...current, secureBedNeeded: false }))}
                />
                No
              </label>
            </div>
          </fieldset>

          <fieldset className={styles.choiceCard} data-testid="ward-referral-intake-involuntaryBedNeeded">
            <legend className={styles.fieldLegend}>Needs a bed that can hold someone involuntarily</legend>
            <div className={styles.choiceRow}>
              <label className={styles.choiceOption}>
                <input
                  type="radio"
                  name="ward-referral-intake-involuntaryBedNeeded"
                  data-testid="ward-referral-intake-involuntaryBedNeeded-yes"
                  checked={draft.involuntaryBedNeeded === true}
                  onChange={() => setDraft((current) => ({ ...current, involuntaryBedNeeded: true }))}
                />
                Yes
              </label>
              <label className={styles.choiceOption}>
                <input
                  type="radio"
                  name="ward-referral-intake-involuntaryBedNeeded"
                  data-testid="ward-referral-intake-involuntaryBedNeeded-no"
                  checked={draft.involuntaryBedNeeded === false}
                  onChange={() => setDraft((current) => ({ ...current, involuntaryBedNeeded: false }))}
                />
                No
              </label>
            </div>
          </fieldset>

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

          {/*
           * Phase R2.1. Send is UNAVAILABLE, with the outstanding questions named, until every
           * one of them has an answer.
           *
           * `aria-disabled="true"` plus an inert handler, never the native `disabled`
           * (`docs/wiring-conventions.md`): the native attribute removes the tab stop, so a
           * keyboard or screen-reader user could never land on the control and the reason
           * `aria-describedby` points at would never be announced. The two attributes together
           * are the shape `require-button-wiring` fails, because the native one wins on focus and
           * the aria one then buys nothing.
           *
           * The note renders BELOW the button and disappears as the last question is answered, so
           * the control never moves out from under a thumb that is already reaching for it.
           */}
          <button
            type="submit"
            className={styles.submit}
            data-testid="ward-referral-intake-submit"
            aria-disabled={answered ? undefined : "true"}
            aria-describedby={answered ? undefined : UNAVAILABLE_REASON_ID}
            onClick={ignoreUnavailableActivation}
          >
            Send referral
          </button>

          {answered ? null : (
            <p
              className={styles.unavailableReason}
              id={UNAVAILABLE_REASON_ID}
              data-testid="ward-referral-intake-unavailable"
            >
              Not yet answered: {outstanding.join(", ")}. Send stays unavailable until each has an answer.
            </p>
          )}
        </form>
      </main>
    </div>
  );
}
