import type { Instant } from "@/components/ward-management/ward-clock";
import type {
  Cohort,
  HomeRegion,
  Referral,
  ReferralAddressing,
  ReferralAddressingState,
  ReferralDeclineReason,
  ReferralSource,
  ReferralState,
  Sex,
  UrgencyLevel,
  WardAddressing,
} from "@/components/ward-management/ward-model";
import { referralState } from "@/components/ward-management/ward-referrals";

/**
 * FD-23 — WHAT A WARD MAY SEE OF A REFERRAL, AND WHAT IT MAY NOT.
 *
 * **Owner ruling, 2026-08-30: a ward cannot see where else a patient has been referred. The
 * coordinator may see everything.** His reason: so a ward does not spend its time on a patient who
 * is being placed elsewhere. Spec Part 7 (`docs/ward-flow-referral-destination-spec.md`).
 *
 * The rule is **ward-facing only, deliberate, and behavioural rather than cosmetic**, which makes
 * it the single most likely rule in that document to be undone by somebody being helpful — every
 * instinct says a patient's screen shows everything known about that patient.
 *
 * **SO IT IS A PROJECTION, NOT A FIELD A SCREEN DECLINES TO RENDER.** Data that reaches a
 * component can be revealed later by a styling change, a new column or a debug panel. Data a
 * projection never carries cannot be. There is no `hideOtherDestinations` flag anywhere in this
 * module and there must never be one: a flag is a thing that can be passed the other way.
 *
 * **The two projections are two TYPES, not one type with a switch.** `WardScopedReferral` has no
 * `destinations` field at all — the plural does not exist on it, so no amount of later editing in a
 * ward component can reach one. `CoordinatorScopedReferral` carries the whole list. Nothing
 * converts one into the other, and neither takes a role, a scope or a viewer as an argument.
 *
 * **Every field is copied by name, never spread.** `{ ...addressing }` would silently carry a field
 * added to `ReferralAddressing` later — which is precisely how a projection quietly becomes the
 * full record again. Widening a projection has to be typed out here, deliberately, one field at a
 * time, and `tests/ward-referral-visibility.test.ts` holds a field-set allowlist at EVERY level so
 * the typing-out is also a test failure until somebody widens the allowlist too.
 *
 * **THE ONE THING A WARD CAN STILL INFER, recorded rather than papered over.** A ward's own
 * addressing may be in state `"cancelled"`, and FD-22 says a destination is cancelled by somebody
 * else's acceptance — so a ward reading `"cancelled"` can infer that the patient was placed
 * somewhere. That is not a hole in this module: it is the owner's own reason for the rule working
 * as intended ("so a ward does not spend its time on a patient who is being placed elsewhere"), and
 * a ward told nothing at all would keep working the referral. It tells the ward THAT, never WHERE,
 * never by whom, never how many places were tried. Nothing else about the other destinations
 * survives the projection.
 *
 * **What is NOT decided here.** Whether the same rule binds the other destination kinds — whether
 * an emergency department may see that a ward was also asked — is not in the ruling and is not
 * taken by this module. Only the ward-scoped projection exists, because only the ward-facing rule
 * was given. An ED-scoped projection is a product decision, not an implementer's.
 */

/**
 * The ward arm as a ward-scoped projection carries it — the bed criteria the ward is being asked
 * about, and nothing else.
 *
 * Structurally identical to `WardReferralDestination` today and deliberately declared separately
 * rather than aliased to it. An alias would mean a field added to the model's ward arm arrives
 * here automatically; a separate declaration means somebody has to decide.
 */
export type WardScopedDestination = {
  kind: "psychiatric_ward";
  sex: Sex;
  secureBedNeeded: boolean;
  involuntaryBedNeeded: boolean;
};

/**
 * THIS ward's own addressing: what it was asked, what it answered, when, and by which role.
 *
 * Carries no reference of any kind to another destination — not its kind, not its state, not its
 * times, not its count. `state` here is this addressing's own state (`ReferralAddressingState`) and
 * never the referral's derived overall state, which is a fact about all the destinations together
 * and therefore a leak: a referral reads `"accepted"` only because somebody accepted it, and a ward
 * whose own answer was `"declined"` would be reading somebody else's decision.
 */
export type WardScopedAddressing = {
  destination: WardScopedDestination;
  state: ReferralAddressingState;
  /** When THIS ward answered, or when acceptance elsewhere cancelled it. Never another
   *  destination's decision time. */
  decidedAt?: Instant;
  /** A ROLE, never a person — the role that answered on this ward's behalf. */
  decidedBy?: string;
  /** This ward's own decline reason, from `REFERRAL_DECLINE_REASONS`. It is this ward's own words
   *  about its own answer, so it is not a leak even when it reads `referred_elsewhere` — the ward
   *  wrote it. */
  declineReason?: ReferralDeclineReason;
  /** The unit that accepted, when THIS ward accepted. */
  acceptedUnitId?: string;
};

/**
 * A referral as a ward may see it: the person facts every destination shares, the facts about the
 * referral itself, and **one** addressing — its own.
 *
 * The field that is absent is the design. There is no `destinations`, no `destinationCount`, no
 * `otherDestinations`, no `state`. "Referred to 3 places" names nobody and still tells a ward the
 * patient is being worked elsewhere, so the count is as forbidden as the list.
 *
 * `localBedSought` is left off deliberately. It records that a coordinator looked for a bed closer
 * to home — activity on this referral that is not this ward's, and not a fact the ward needs to
 * answer the question it was asked. Adding it is a governance decision, not an implementation one.
 */
export type WardScopedReferral = {
  id: string;
  // Facts about the person, common to every destination.
  ageBand: Cohort;
  homeRegion: HomeRegion;
  // Facts about the referral itself.
  source: ReferralSource;
  raisedAt: Instant;
  urgency: UrgencyLevel;
  originSiteCode: string;
  transportNeeded: boolean;
  /** Singular, and that is the whole rule in one key name. */
  addressing: WardScopedAddressing;
};

/**
 * A referral as the COORDINATOR may see it: everywhere it was sent, what each destination
 * answered, and the referral's overall state.
 *
 * A separate type rather than `WardScopedReferral` with a flag, for the reason this module exists:
 * a flag can be passed the other way by the next person who edits a ward component, and a type
 * cannot.
 *
 * `state` is DERIVED here by calling `referralState`, at the moment of projection, and is never
 * stored on a `Referral` — the model still keeps exactly one home for that fact (the destinations
 * themselves), which is what stops a referral saying "queued" while a destination it holds says
 * "accepted". This is a read of that one home, not a second one.
 */
export type CoordinatorScopedReferral = {
  id: string;
  ageBand: Cohort;
  homeRegion: HomeRegion;
  source: ReferralSource;
  raisedAt: Instant;
  urgency: UrgencyLevel;
  originSiteCode: string;
  transportNeeded: boolean;
  localBedSought?: { at: Instant; by: string };
  /** Every destination this referral was sent to, and what each answered. */
  destinations: ReferralAddressing[];
  /** Derived by `referralState` at projection time — see this type's own doc comment. */
  state: ReferralState;
};

/** The ward addressing on this referral, if it was addressed to a ward at all. At most one exists:
 *  the reducer refuses two destinations of the same kind. */
function wardAddressingOf(referral: Referral): WardAddressing | undefined {
  return referral.destinations.find(
    (addressing): addressing is WardAddressing => addressing.destination.kind === "psychiatric_ward",
  );
}

/**
 * FD-23: the ward-scoped view of one referral, or `undefined` when this referral was never
 * addressed to a ward.
 *
 * `undefined` rather than an empty projection, and it leaks nothing by saying so: a referral not
 * addressed to a ward simply never appears in a ward's list, which is the same thing a ward would
 * see if the referral did not exist. It does not say that the referral exists and is hidden.
 *
 * Every field is written out by name. Read this module's own doc comment before replacing any of
 * it with a spread.
 */
export function wardScopedReferral(referral: Referral): WardScopedReferral | undefined {
  const ward = wardAddressingOf(referral);
  if (!ward) return undefined;
  return {
    id: referral.id,
    ageBand: referral.ageBand,
    homeRegion: referral.homeRegion,
    source: referral.source,
    raisedAt: referral.raisedAt,
    urgency: referral.urgency,
    originSiteCode: referral.originSiteCode,
    transportNeeded: referral.transportNeeded,
    addressing: {
      destination: {
        kind: ward.destination.kind,
        sex: ward.destination.sex,
        secureBedNeeded: ward.destination.secureBedNeeded,
        involuntaryBedNeeded: ward.destination.involuntaryBedNeeded,
      },
      state: ward.state,
      // Spread-with-condition rather than `decidedAt: ward.decidedAt`, so an undecided addressing
      // has NO key rather than a key holding `undefined`. The field-set guard reads
      // `Object.keys`, and a present-but-undefined key would sit inside it unnoticed.
      ...(ward.decidedAt !== undefined ? { decidedAt: ward.decidedAt } : {}),
      ...(ward.decidedBy !== undefined ? { decidedBy: ward.decidedBy } : {}),
      ...(ward.declineReason !== undefined ? { declineReason: ward.declineReason } : {}),
      ...(ward.acceptedUnitId !== undefined ? { acceptedUnitId: ward.acceptedUnitId } : {}),
    },
  };
}

/** Every referral a ward may see, ward-scoped. A referral addressed to no ward is absent from the
 *  list entirely — see `wardScopedReferral` on why that is not itself a signal. */
export function wardScopedReferrals(referrals: Referral[]): WardScopedReferral[] {
  return referrals
    .map((referral) => wardScopedReferral(referral))
    .filter((projection): projection is WardScopedReferral => projection !== undefined);
}

/** FD-23: the coordinator's view — everywhere this referral was sent, and what each said. */
export function coordinatorScopedReferral(referral: Referral): CoordinatorScopedReferral {
  return {
    id: referral.id,
    ageBand: referral.ageBand,
    homeRegion: referral.homeRegion,
    source: referral.source,
    raisedAt: referral.raisedAt,
    urgency: referral.urgency,
    originSiteCode: referral.originSiteCode,
    transportNeeded: referral.transportNeeded,
    ...(referral.localBedSought !== undefined ? { localBedSought: referral.localBedSought } : {}),
    destinations: referral.destinations,
    state: referralState(referral),
  };
}

/** Every referral the coordinator may see. Never filtered — the coordinator may see everything. */
export function coordinatorScopedReferrals(referrals: Referral[]): CoordinatorScopedReferral[] {
  return referrals.map((referral) => coordinatorScopedReferral(referral));
}
