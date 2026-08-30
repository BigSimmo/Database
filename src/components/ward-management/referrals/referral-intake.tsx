"use client";

import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";

import { destinationOptions, suburbOptions } from "@/components/ward-management/referrals/referral-destination-options";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
import {
  COHORTS,
  HOME_REGIONS,
  PARALLEL_REFERRAL_CAP,
  REFERRAL_DESTINATION_KINDS,
  REFERRAL_SOURCES,
  SEXES,
  SUBURB_UNKNOWN_REASONS,
  suburbUnknownLabels,
  URGENCY_LEVELS,
  type Cohort,
  type HomeRegion,
  type ReferralDestination,
  type ReferralDestinationKind,
  type ReferralSource,
  type ReferralSuburb,
  type Rejection,
  type SuburbUnknownReason,
  type Sex,
  type ReferralPurpose,
  type UrgencyLevel,
  type WardReferralDestination,
} from "@/components/ward-management/ward-model";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { allEmergencyDepartments, wardSites } from "@/components/ward-management/ward-sites";

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
/** Every suburb the catchment sources name, derived from the exported rows — see
 *  `suburbOptions`' own comment for why a hand-written list is not an option here. */
const SUBURB_OPTIONS: readonly string[] = suburbOptions();
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
 * the unanswered sentinel, Send would go inert on that value and the reducer would never be
 * reached, so that proof would be destroyed.
 *
 * **Corrected 2026-08-30 (R2 review finding M1).** Commit `78133a738` overstated this in three
 * places, here included: it said the test would have gone on PASSING while the proof was
 * destroyed. It would not. That test ends by asserting `rejection-count` reads `"1"`, and with an
 * inert Send nothing dispatches, so the count stays `"0"` and the test goes red either way. What
 * the pre-click "Send is available" assertion added in that commit actually buys is a LEGIBLE
 * failure — "Send went inert, so this test never reaches the reducer" — in place of a misleading
 * one about rejection counts. That is worth keeping, and it is a smaller claim than was made.
 *
 * With the sentinel distinct from `""`, an origin site of `""` remains an ANSWER — an invalid one
 * the reducer is left to refuse, exactly as before — and it stays unreachable by ordinary use of
 * this screen, because no option on this form carries it.
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
  // FD-21: the destinations are a LIST, and an empty one is the same fact every sentinel above
  // states — nobody has answered yet. Handled here rather than by a second special case in
  // `unansweredFieldNames`, so the destination question is checked by the same rule as the other
  // nine rather than by a branch beside it that could disagree with them.
  if (Array.isArray(value)) return value.length === 0;
  return value === UNANSWERED_VALUE;
}

/**
 * THE PURPOSE EVERY EMERGENCY-DEPARTMENT DESTINATION THIS FORM RAISES CARRIES, AND WHY IT IS A
 * CONSTANT RATHER THAN AN ELEVENTH QUESTION.
 *
 * `REFERRAL_PURPOSES` has three members and this form can honestly produce exactly one of them.
 * The spec's own table fixes the purpose from WHO is referring, not from what they pick:
 *
 *   community → ED            `bed`                 ← this form, every source it offers
 *   ED psychiatry → itself    `psychiatric_review`  ← `FD-16`'s self-addressed inbox
 *   ward → ED                 `medical_assessment`
 *
 * ⚠️ **A CLINICIAN PICKING THE PURPOSE IS A CLINICIAN ABLE TO PICK THE WRONG ONE**, and the wrong
 * one here is not a cosmetic error: `psychiatric_review` is the value an ED psychiatry inbox
 * selects on, so an external referrer who chose it would post themselves into another team's
 * worklist. The three flows are already distinguishable by who is raising them, so nothing is lost
 * by deriving it and a whole class of mis-addressing is closed.
 *
 * **THIS FORM IS THE COMMUNITY FRONT DOOR AND CANNOT BE ANYTHING ELSE.** It dispatches
 * `RECEIVE_REFERRAL`, whose `EVENT_ROLE` entry is `["community"]`, and every value in
 * `REFERRAL_SOURCES` it offers (community, crisis service, police, ambulance, inter-hospital) is an
 * external referrer asking for a bed. So `bed` is not this form's default — it is the only purpose
 * it can truthfully mean. The other two rows above have no producer anywhere in `src/` today; that
 * is a reported gap, not something to close by widening this picker.
 */
const INTAKE_REFERRAL_PURPOSE: ReferralPurpose = "bed";

/**
 * The destinations this referral is addressed to, built from the kinds the referrer ticked — or
 * `undefined` while a chosen destination still has an unanswered question of its own.
 *
 * BUILT BY WALKING `REFERRAL_DESTINATION_KINDS`, never the selection array, and that is what makes
 * two of one kind unreachable rather than merely unlikely. The reducer REFUSES a repeated kind
 * rather than de-duplicating it — silently collapsing a double selection would make the cap count
 * something other than what the referrer chose — so the screen must never be able to produce one,
 * and one checkbox per kind plus this walk is what guarantees it structurally.
 *
 * The per-arm answers are attached to the arm that has them and to nothing else: the bed criteria
 * reach only the ward, and `edId` reaches only the emergency department. That is the destination
 * union's whole point, and this is the one place on this screen it is spent.
 *
 * ⚠️ **AN UNANSWERED `edId` RETURNS `undefined` — IT NEVER BECOMES A PLACEHOLDER.** An `edId: ""`,
 * or a first-department default, would compile and would send: the reducer validates the referral's
 * source, home region, age band, urgency and origin site, but it does **not** validate `edId` or
 * `purpose` at all, so a stub department queues silently and reads as an answer somebody gave. This
 * is the same refusal `answeredDraft` makes for every other question, applied to a question that
 * only exists once a particular destination is chosen.
 */
function destinationsFor(
  kinds: readonly ReferralDestinationKind[],
  ward: WardReferralDestination,
  edId: string | typeof UNANSWERED_VALUE,
): ReferralDestination[] | undefined {
  const chosen = REFERRAL_DESTINATION_KINDS.filter((kind) => kinds.includes(kind));
  const destinations: ReferralDestination[] = [];
  for (const kind of chosen) {
    switch (kind) {
      case "psychiatric_ward":
        destinations.push(ward);
        break;
      case "emergency_department":
        if (edId === UNANSWERED_VALUE) return undefined;
        destinations.push({ kind, edId, purpose: INTAKE_REFERRAL_PURPOSE });
        break;
      case "community_team":
        destinations.push({ kind });
        break;
    }
  }
  return destinations;
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
  /**
   * The patient's suburb, as the picker holds it: a raw `string`, because a `<select>` value is one.
   *
   * ⚠️ **IT IS RECORDED ON THE REFERRAL** (`CM-4`, 2026-08-30) — `Referral.suburb` exists, so this
   * answer no longer stops at this screen, and it IS in `REQUIRED_FIELDS`. The note beside the
   * control says so; it used to say the opposite, truthfully, and the day the model widened was the
   * day that sentence turned into a false reassurance.
   *
   * ⚠️ **A RAW STRING HERE IS NOT THE MODEL'S SHAPE.** The referral holds `ReferralSuburb`, a
   * union with an `unknown` arm, and `answeredDraft` is the one place that widens this string into
   * it — the picker offers the `SUBURB_UNKNOWN_REASONS` codes as option values alongside the real
   * suburb names, and the codes are lower_snake where the table's names are title-case places, so
   * the two can never collide.
   *
   * Deriving it from `homeRegion` instead was considered and refused: ten broad WA regions cannot
   * produce a 537-suburb catchment answer, and mapping one onto the other would invent an
   * administrative fact — the defect `HOME_REGIONS`' own doc comment records this project already
   * paying for once.
   */
  suburb: string;
  /**
   * Everywhere this referral is addressed, chosen in ONE act (FD-21) — never one destination at a
   * time and never a repeat referral. An empty list is the unanswered state; see `isUnanswered`.
   */
  destinationKinds: ReferralDestinationKind[];
  /**
   * WHICH emergency department, once one has been chosen as a destination. One of
   * `allEmergencyDepartments()`' ids, never anything else.
   *
   * ⚠️ **NO DEFAULT, AND NEVER THE FIRST DEPARTMENT IN THE LIST.** Every ED destination names which
   * department (`ReferralDestination`'s own comment: "Required on every ED destination, whoever
   * sent it and whyever"), and a form that guesses is a form that quietly addresses a request to
   * the wrong hospital. It starts unanswered like every other question on this form, and
   * `answeredDraft` refuses to send while an ED is ticked and this is still the sentinel.
   *
   * It is conditionally required rather than always required, which is a real difference from the
   * ten questions above it: nobody should have to name a department to raise a ward-only referral.
   * `REQUIRED_FIELDS`' `appliesWhen` below is where that is expressed.
   */
  edId: string | typeof UNANSWERED_VALUE;
  /** Widened exactly as the two need questions above were, and for the same reason: a bare
   *  `boolean` has no room for "nobody has answered this yet", so the type itself would go on
   *  forcing an answer nobody gave. See `REQUIRED_FIELDS` below for the ruling that authorised
   *  the extra tap. */
  transportNeeded: boolean | typeof UNANSWERED_VALUE;
};

/** The fields exactly as `RECEIVE_REFERRAL` takes them, once every question has an answer. */
type AnsweredDraft = {
  ageBand: Cohort;
  sex: Sex;
  homeRegion: HomeRegion;
  /** ⚠️ ADDED BY WARD CORE, 2026-08-30, and it is a decision on this form rather than only a
   *  field: `Referral.suburb` is required, so the suburb becomes a required ANSWER and Send
   *  stays inert until it is given. Made in this shape because it is the shape every other
   *  question here already uses; if the referral surface wants it optional, this is the line to
   *  change and the reducer check to revisit — not something to work around at the dispatch.
   *
   *  ⚠️ **"Not known" is one of the answers**, and it is not the same as unanswered. See
   *  `ReferralSuburb`: a required picker with no honest option is what makes a clinician choose a
   *  plausible nearby suburb to get past the form. */
  suburb: ReferralSuburb;
  secureBedNeeded: boolean;
  involuntaryBedNeeded: boolean;
  source: ReferralSource;
  urgency: UrgencyLevel;
  originSiteCode: string;
  transportNeeded: boolean;
  /**
   * The destinations already BUILT, not the kinds still to be assembled from.
   *
   * This carried `destinationKinds` until the ED arm gained `edId` and `purpose`. Assembly then
   * needed a narrowed `edId`, and the only place holding one is `answeredDraft` — the single gate
   * every unanswered value is stopped at. Building them there rather than at the dispatch keeps
   * that gate the ONE place a sentinel can escape from, instead of adding a second narrowing beside
   * it that could disagree with it.
   */
  destinations: ReferralDestination[];
};

/**
 * Every question Send waits on, in the order the form asks them, with the name the unavailability
 * note calls each one.
 *
 * `transportNeeded` used to be deliberately absent, and this paragraph used to say why: it is a
 * fact about the REFERRAL rather than about the person, an unticked box there reads as "no
 * transport arranged" rather than as a clinical claim about someone, and making it a third yes/no
 * group would cost a tap the work was "not authorised to spend". It was recorded as a residual
 * rather than quietly folded in.
 *
 * SUPERSEDED, owner ruling 2026-08-30: **"Take all recommendations"** — including that transport
 * should start unanswered. The authorisation the paragraph above was waiting on now exists, so
 * the residual is closed and `transportNeeded` is the ninth question Send waits on. The reasoning
 * is kept rather than deleted because it is still true about the SIZE of the cost (one more tap
 * on a phone form a police officer fills in standing up); what changed is that the owner decided
 * the cost was worth paying. An untouched checkbox sent `false`, and a ward reads `false` as "no
 * transport needed" and plans around it — an answer nobody chose, which is the same defect R2.1
 * removed everywhere else on this form.
 *
 * The two need questions are named by short field names rather than by their full on-screen
 * wording on purpose: that wording ("Needs a secure bed" …) is a clinical rule with its own test,
 * and repeating it inside this sentence would put the same clinical phrase on the screen twice.
 */
const REQUIRED_FIELDS: readonly {
  readonly key: keyof ReferralDraft;
  readonly name: string;
  /**
   * When this question applies at all. Absent means always, which is true of the ten below it.
   *
   * ⚠️ **ADDED FOR ONE QUESTION AND IT MUST NOT BECOME A HABIT.** A conditionally-required field is
   * a field that can be silently switched off by a predicate nobody re-reads, which is the same
   * shape as a guard that inspects nothing. It earns its place here because "which emergency
   * department" is genuinely not a question a ward-only referral has — asking it would be asking
   * for an answer with nothing to attach to — rather than because answering it is inconvenient.
   */
  readonly appliesWhen?: (draft: ReferralDraft) => boolean;
}[] = [
  { key: "ageBand", name: "Age band" },
  { key: "sex", name: "Sex" },
  { key: "homeRegion", name: "Home region" },
  // 2026-08-30. The suburb became a required ANSWER when `Referral` gained a place to put it —
  // until then this control read the catchment for the picker below and was dropped. Placed beside
  // `homeRegion` because they are the two facts about where a person is from, and NEITHER is
  // derived from the other (see `Referral.suburb`).
  { key: "suburb", name: "Suburb" },
  { key: "source", name: "Referral source" },
  { key: "urgency", name: "Urgency" },
  { key: "originSiteCode", name: "Origin site" },
  { key: "secureBedNeeded", name: "Secure bed needed" },
  { key: "involuntaryBedNeeded", name: "Involuntary bed needed" },
  { key: "transportNeeded", name: "Transport needed" },
  // FD-21, last because it is the question every answer above it informs: the picker shows what
  // each destination looks like for THIS request, so a clinician chooses knowing it.
  { key: "destinationKinds", name: "Destination" },
  // Eleventh, and the only one that does not always apply: it exists solely to complete an
  // emergency-department destination, so it is asked once one is ticked and not before. Placed
  // after "Destination" because that is the answer that raises it.
  {
    key: "edId",
    name: "Emergency department",
    appliesWhen: (draft) => draft.destinationKinds.includes("emergency_department"),
  },
];

/**
 * Every name this form's unavailability note is allowed to use, in the order it asks them — the
 * VOCABULARY, not the list shown on any particular render.
 *
 * Since one question is conditional, this is deliberately a superset of what the note says at any
 * moment: "Emergency department" is a name the note may use, and does use exactly when an ED is
 * chosen. `unansweredFieldNames` below is what a given draft actually shows.
 */
export const REQUIRED_FIELD_NAMES: readonly string[] = REQUIRED_FIELDS.map((field) => field.name);

/** The questions THIS draft is still waiting on: applicable, and unanswered. Both halves matter —
 *  naming a question that does not apply is as misleading as hiding one that does. */
function unansweredFieldNames(draft: ReferralDraft): string[] {
  return REQUIRED_FIELDS.filter((field) => field.appliesWhen?.(draft) ?? true)
    .filter((field) => isUnanswered(draft[field.key]))
    .map((field) => field.name);
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
  const {
    ageBand,
    sex,
    homeRegion,
    secureBedNeeded,
    involuntaryBedNeeded,
    source,
    urgency,
    originSiteCode,
    transportNeeded,
    destinationKinds,
    edId,
    suburb,
  } = draft;
  if (ageBand === UNANSWERED_VALUE || sex === UNANSWERED_VALUE || homeRegion === UNANSWERED_VALUE) return undefined;
  // The suburb now REACHES the record (`CM-4`), so it is answered like every other fact rather
  // than read on this screen and dropped. The note beside the control says so as of 2026-08-30;
  // it said the opposite for the hour between the model widening and this screen catching up.
  if (suburb === UNANSWERED_VALUE) return undefined;
  // The picker offers the named suburbs AND the "not known" answers, so the raw value is widened
  // here into the union the model holds. Reason CODES cannot collide with a suburb name: the
  // catchment table's names are title-case places and the codes are lower_snake.
  const suburbAnswer: ReferralSuburb = (SUBURB_UNKNOWN_REASONS as readonly string[]).includes(suburb)
    ? { kind: "unknown", reason: suburb as SuburbUnknownReason }
    : { kind: "named", name: suburb };
  // FD-21. An empty list is refused BY THE REDUCER too ("needs at least one destination"); it is
  // stopped here as well so the form never sends an event it already knows will be refused, in the
  // same shape every other unanswered question is stopped.
  if (destinationKinds.length === 0) return undefined;
  if (source === UNANSWERED_VALUE || urgency === UNANSWERED_VALUE || originSiteCode === UNANSWERED_VALUE) {
    return undefined;
  }
  if (secureBedNeeded === UNANSWERED_VALUE || involuntaryBedNeeded === UNANSWERED_VALUE) return undefined;
  // Owner ruling 2026-08-30 ("Take all recommendations"). The narrowing is what stops the
  // sentinel escaping: `transportNeeded` was read straight off `draft` here and passed through
  // untouched, which is exactly how a value nobody chose used to reach `RECEIVE_REFERRAL`.
  if (transportNeeded === UNANSWERED_VALUE) return undefined;
  // The destinations are ASSEMBLED HERE, at the gate, rather than at the dispatch below. An
  // emergency department with no department named comes back `undefined` and Send stays
  // unavailable, exactly as an unanswered age band does — see `destinationsFor` on why a
  // placeholder `edId` would be worse than the refusal.
  const destinations = destinationsFor(
    destinationKinds,
    { kind: "psychiatric_ward", sex, secureBedNeeded, involuntaryBedNeeded },
    edId,
  );
  if (destinations === undefined) return undefined;
  return {
    suburb: suburbAnswer,
    ageBand,
    sex,
    homeRegion,
    secureBedNeeded,
    involuntaryBedNeeded,
    source,
    urgency,
    originSiteCode,
    transportNeeded,
    destinations,
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
    suburb: UNANSWERED_VALUE,
    // FD-21: nothing is chosen for the clinician. Not even where the catchment table routes
    // cleanly — the table SUGGESTS, in words, and a suggestion that pre-ticks itself is a value
    // nobody chose reaching the reducer, which is the whole defect R2.1 removed from this form.
    destinationKinds: [],
    // No department is chosen for the clinician either, and the reducer would not catch it if one
    // were: it validates five fields on this event and `edId` is not among them.
    edId: UNANSWERED_VALUE,
    // Owner ruling 2026-08-30 ("Take all recommendations"): transport starts unanswered too. It
    // was the last control on this form still sending an answer nobody chose — an untouched form
    // asserted "no transport needed", and a ward reads that and plans around it.
    transportNeeded: UNANSWERED_VALUE,
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
  const { now, dispatch, rejections, units, referrals } = useWardFlow();
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
      /*
       * Phase R2 review finding I2, owner ruling 2026-08-30: the next referral starts unanswered.
       *
       * Without this the draft survives the send, so referral #2 in a session arrives carrying
       * the PREVIOUS PATIENT'S age band, sex, home region and both need answers, with Send
       * already available — one tap away from raising a referral in which five facts belong to
       * somebody else. That is strictly worse than the defaults R2.1 removed, because the values
       * are not merely fabricated, they look like answers a clinician chose.
       *
       * The reset lives in the SUCCESS branch of this effect, not in `handleSubmit`, and that
       * placement is the whole point: `handleSubmit` does not yet know whether the reducer
       * accepted the event. Resetting there would wipe a clinician's eight answers on a REFUSAL,
       * which is the one moment they most need them kept so the refusal can be corrected and
       * re-sent.
       *
       * The confirmation above stays on screen beside the blank form: "sent" and "here is the
       * next one" are both true, and the alternative — clearing the confirmation too — would
       * leave a clinician with no evidence the send happened at all.
       */
      setDraft(initialDraft());
    }
    priorRejectionCountRef.current = rejections.length;
  }, [rejections, checkToken]);

  // Phase R2.1. The outstanding questions, recomputed on every render from the draft itself
  // rather than tracked in a second piece of state that could disagree with it.
  const outstanding = unansweredFieldNames(draft);
  const answered = answeredDraft(draft);

  /**
   * The bed criteria, or `null` while any of the three questions that make them up is unanswered.
   *
   * **This is the narrowing that keeps `referralEligibility` in the ward arm.** The picker below is
   * handed a `WardReferralDestination | null`, never the draft, so the bed questions cannot reach
   * an emergency department or a community team even by accident: those arms have no such fields,
   * so the question cannot be spelled for them.
   */
  const wardNeed: WardReferralDestination | null =
    draft.sex !== UNANSWERED_VALUE &&
    draft.secureBedNeeded !== UNANSWERED_VALUE &&
    draft.involuntaryBedNeeded !== UNANSWERED_VALUE
      ? {
          kind: "psychiatric_ward",
          sex: draft.sex,
          secureBedNeeded: draft.secureBedNeeded,
          involuntaryBedNeeded: draft.involuntaryBedNeeded,
        }
      : null;

  // Recomputed on every render from the draft and live reducer state, never held in a second piece
  // of state that could disagree with either — the same discipline `outstanding` above holds to.
  const options = destinationOptions({
    // No place, no catchment — and that is a fact rather than a gap. `catchmentSuburbOf` holds
    // the same rule for the model side, so the screen and the record cannot disagree about when a
    // catchment can be read.
    suburb:
      draft.suburb === UNANSWERED_VALUE || (SUBURB_UNKNOWN_REASONS as readonly string[]).includes(draft.suburb)
        ? null
        : draft.suburb,
    ward: wardNeed,
    ageBand: draft.ageBand === UNANSWERED_VALUE ? null : draft.ageBand,
    units,
    referrals,
    now,
  });

  function toggleDestination(kind: ReferralDestinationKind) {
    setDraft((current) => {
      const removing = current.destinationKinds.includes(kind);
      return {
        ...current,
        destinationKinds: removing
          ? current.destinationKinds.filter((chosen) => chosen !== kind)
          : [...current.destinationKinds, kind],
        // Un-ticking the emergency department discards which one, so re-ticking it asks again.
        // Keeping it would leave an answer about a destination the clinician removed sitting
        // invisibly in the draft, ready to be sent by a later tick they never connected it to —
        // the same defect as the previous patient's answers surviving a send.
        edId: removing && kind === "emergency_department" ? UNANSWERED_VALUE : current.edId,
      };
    });
  }

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
      suburb: answered.suburb,
      // FD-21, and the day the comment that stood here was written for. It said "one destination
      // for now ... the day the form offers the choice nothing below it has to move", and nothing
      // below it moved: the event already took a list, the reducer already refused an empty one,
      // a fourth, and a repeated kind. This is the form catching up with the model.
      //
      // Built by `answeredDraft` rather than here: assembling an ED arm needs a narrowed `edId`,
      // and narrowing at two sites is how two sites come to disagree about what "answered" means.
      destinations: answered.destinations,
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

          {/*
           * The suburb, and the sentence beside it that says what becomes of the answer.
           *
           * ⚠️ **THIS NOTE HAS BEEN FALSE ONCE ALREADY, IN THE OTHER DIRECTION.** Until
           * 2026-08-30 `Referral` carried `homeRegion` and nothing finer, so the answer was read
           * for the destination picker below and then dropped — and the note said so, because a
           * control that quietly discards its answer is the "pretends to record" pattern the
           * destination spec refuses in as many words. `Referral.suburb` exists now (`CM-4`), so
           * that sentence became a FALSE REASSURANCE about what the record holds: worse than a
           * missing one, because a clinician who read it would believe the answer went nowhere.
           *
           * The note therefore says the opposite, and `tests/ward-referral-suburb-pin.test.ts`
           * pins it against `Referral.suburb`'s continued existence, so removing the field turns
           * this sentence red rather than quietly false a second time.
           *
           * ⚠️ **A SUBURB IS NOT AN ADDRESS (`PD-3`).** No street, number or postcode belongs
           * beside this picker, however natural it feels: `address` is UNRULED and the guard stays
           * closed on it. A ruling permitting a suburb is not a ruling permitting the category.
           */}
          <div className={styles.fieldCard}>
            <label className={styles.fieldLegend} htmlFor="ward-referral-intake-suburb">
              Suburb
            </label>
            <select
              id="ward-referral-intake-suburb"
              data-testid="ward-referral-intake-suburb"
              className={styles.select}
              value={draft.suburb}
              onChange={(event) => setDraft((current) => ({ ...current, suburb: event.target.value }))}
            >
              <option value={UNANSWERED_VALUE}>{UNANSWERED_OPTION_LABEL}</option>
              {/*
                ⚠️ THE HONEST ANSWER, OFFERED FIRST AMONG THE REAL ONES.
                Without it a patient of no fixed abode cannot be referred, and the way past a
                required picker with no true option is to choose a plausible nearby suburb — which
                puts an invented place into the one field built to resolve against a real table.
                See `ReferralSuburb`; whether "not known" and "no fixed abode" are one answer or
                two is a clinical question on the owner's queue, and a second member appears here
                automatically rather than needing this list edited again.
              */}
              {SUBURB_UNKNOWN_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {suburbUnknownLabels[reason]}
                </option>
              ))}
              {SUBURB_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <p className={styles.fieldNote} data-testid="ward-referral-intake-suburb-note">
              Recorded on the referral, and used here to read the catchment for each destination below. If it is not
              known, the list has an answer for that — the referral can still be sent.
            </p>
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

          {/*
           * Owner ruling 2026-08-30: **"Take all recommendations"** — including that transport
           * should start unanswered.
           *
           * This was a checkbox until that ruling, and an untouched checkbox is not an open
           * question: it sent `false`, which a ward reads as the definite statement that this
           * request needs no transport and plans around. It is now the same yes/no group as the
           * two need questions above — the same `.choiceCard` fieldset, the same radio pair, the
           * same "neither answer selected until a clinician picks one" — because a control with
           * two states cannot express three, and the third state is the whole point.
           *
           * The legend is unchanged from the old checkbox's label. It already described the
           * REQUEST rather than the person, which is why this field needed no rewording when the
           * two above did.
           */}
          {/*
           * "Needs transport", not "Transport needed", and the change is one word of wording with
           * a reason. `REQUIRED_FIELDS` calls this question "Transport needed", so the old legend
           * put the identical phrase on a blank form twice — once as the question and once as its
           * name in the outstanding-questions note underneath. This file already held the rule
           * that fixes it: the two need questions above are named by SHORT FIELD NAMES in that
           * note precisely so their on-screen wording is not repeated inside it. The legend now
           * reads in the same shape as the two it sits beside ("Needs a secure bed", "Needs a bed
           * that can hold someone involuntarily"), which makes the trio consistent and leaves the
           * phrase on screen once. The meaning is untouched: it described the REQUEST before and
           * it describes the request now.
           */}
          <fieldset className={styles.choiceCard} data-testid="ward-referral-intake-transportNeeded">
            <legend className={styles.fieldLegend}>Needs transport</legend>
            <div className={styles.choiceRow}>
              <label className={styles.choiceOption}>
                <input
                  type="radio"
                  name="ward-referral-intake-transportNeeded"
                  data-testid="ward-referral-intake-transportNeeded-yes"
                  checked={draft.transportNeeded === true}
                  onChange={() => setDraft((current) => ({ ...current, transportNeeded: true }))}
                />
                Yes
              </label>
              <label className={styles.choiceOption}>
                <input
                  type="radio"
                  name="ward-referral-intake-transportNeeded"
                  data-testid="ward-referral-intake-transportNeeded-no"
                  checked={draft.transportNeeded === false}
                  onChange={() => setDraft((current) => ({ ...current, transportNeeded: false }))}
                />
                No
              </label>
            </div>
          </fieldset>

          {/*
           * WHERE TO REFER — several destinations chosen in ONE act (FD-21), up to the cap.
           *
           * Checkboxes rather than a multi-select, and one per kind rather than a list a clinician
           * adds to: a repeated kind is then unreachable rather than merely unlikely, which matters
           * because the reducer REFUSES a repeat rather than de-duplicating it.
           *
           * **NOTHING HERE IS REMOVED, DISABLED OR RANKED.** An option the catchment table cannot
           * place is greyed (`data-outside-catchment`) and stays fully operable — the owner's rule
           * is that choosing one is allowed, being a deliberate step the clinician takes. A ward
           * with no free bed is offered exactly like any other, because a ward with no bed today is
           * still the right place to ask. And the order is catchment then name, never anything
           * derived from the person: nothing on this screen ranks a patient.
           *
           * Each option's facts are announced with its control through `aria-describedby`, so what
           * a sighted clinician reads beside the box is what a screen-reader user hears with it.
           */}
          <fieldset className={styles.choiceCard} data-testid="ward-referral-intake-destinations">
            <legend className={styles.fieldLegend}>
              Where to refer &mdash; choose up to {PARALLEL_REFERRAL_CAP}, in one act
            </legend>
            <ul className={styles.destinationList}>
              {options.map((option) => (
                <li
                  key={option.kind}
                  className={styles.destinationOption}
                  data-testid={`ward-referral-intake-destination-option-${option.kind}`}
                  data-outside-catchment={option.catchment.outsideTheTable ? "true" : undefined}
                >
                  <label className={styles.destinationName}>
                    <input
                      type="checkbox"
                      data-testid={`ward-referral-intake-destination-${option.kind}`}
                      checked={draft.destinationKinds.includes(option.kind)}
                      aria-describedby={`ward-referral-intake-destination-facts-${option.kind}`}
                      onChange={() => toggleDestination(option.kind)}
                    />
                    {option.label}
                  </label>
                  <div id={`ward-referral-intake-destination-facts-${option.kind}`}>
                    <p className={styles.destinationNote}>{option.catchment.sentence}</p>
                    {option.suggested ? (
                      <p className={styles.destinationNote}>
                        Suggested by the catchment table. Nothing is chosen for you.
                      </p>
                    ) : null}
                    <ul className={styles.destinationFacts}>
                      {option.figures.map((figure) => (
                        <li key={figure} className={styles.destinationFact}>
                          {figure}
                        </li>
                      ))}
                      {option.reasons.map((reason) => (
                        <li key={reason} className={styles.destinationFact}>
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ul>
          </fieldset>

          {/*
           * WHICH emergency department — asked only once one is chosen, because until then it is a
           * question with nothing to attach to.
           *
           * ⚠️ **THE LEADING OPTION IS A PROMPT, NOT A DEPARTMENT**, exactly like every other picker
           * on this form. A first-department default would be the single most dangerous default on
           * this screen: `RECEIVE_REFERRAL` membership-checks the source, home region, age band,
           * urgency and origin site, and checks `edId` against **nothing at all** — so a department
           * nobody chose does not bounce, it queues, at a real hospital, looking like an answer.
           *
           * Derived from `allEmergencyDepartments()`, never hand-listed. That is the same defect
           * class as `ed-screen.tsx`'s hand-written `COHORT_OPTIONS`, which silently omitted
           * `"Youth"` and could never have failed to compile when the union widened.
           */}
          {draft.destinationKinds.includes("emergency_department") ? (
            <div className={styles.fieldCard}>
              <label className={styles.fieldLegend} htmlFor="ward-referral-intake-edId">
                Which emergency department
              </label>
              <select
                id="ward-referral-intake-edId"
                data-testid="ward-referral-intake-edId"
                className={styles.select}
                value={draft.edId}
                onChange={(event) => setDraft((current) => ({ ...current, edId: event.target.value }))}
              >
                <option value={UNANSWERED_VALUE}>{UNANSWERED_OPTION_LABEL}</option>
                {allEmergencyDepartments().map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

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
