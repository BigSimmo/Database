import type { Instant } from "@/components/ward-management/ward-clock";
import type {
  Cohort,
  HomeRegion,
  Referral,
  ReferralAddressing,
  ReferralAddressingState,
  ReferralDeclineReason,
  ReferralDestination,
  ReferralDestinationKind,
  ReferralPurpose,
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
 * **The projections are separate TYPES, not one type with a switch.** `WardScopedReferral` and
 * `CommunityScopedReferral` have no `destinations` field at all — the plural does not exist on
 * either, so no amount of later editing in a ward or community component can reach one.
 * `CoordinatorScopedReferral` carries the whole list. Nothing converts one into another, no
 * converter exists between them, and none of them takes a role, a scope or a viewer as an argument.
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
 * ---
 *
 * **COMMUNITY IS NOW DECIDED — owner ruling, 2026-09-04.** A community team becomes a first-class
 * role with its own page, alongside ED, coordinator and the wards, and **a community team may NOT
 * see that the same patient was referred anywhere else. The same restriction as a ward.** His
 * reasoning is the ward reasoning, in his own words: so a team does not spend its time on a patient
 * being placed elsewhere; and information never sent cannot leak later.
 *
 * So `CommunityScopedReferral` exists below, built exactly as `WardScopedReferral` is — a THIRD
 * type with no `destinations` field, its own projection function taking no role, scope or viewer
 * argument, every field copied by name, and its own field-set allowlists at every level in
 * `tests/ward-referral-visibility.test.ts`. **There is no shared helper between the two and there
 * must never be one**: a function both a community screen and a ward screen reach is, in FD-23's
 * own words, shared infrastructure by construction — the exemption arriving by the front door.
 *
 * **The identical inference is available to a community team, and it is the same non-hole.** A
 * community team's own addressing can read `"cancelled"`, so it can infer THAT the patient went
 * somewhere — never where, never to whom, never how many places were tried. That is the ward
 * position word for word, and it is the owner's intent rather than a leak. (It is reachable only
 * where a community arm is cancelled at all; `ACCEPT_REFERRAL` exempts a `community_team` candidate
 * from cancellation today, so the state is rarer for a community team than for a ward. The rule is
 * written for the state, not for how often it occurs.)
 *
 * ---
 *
 * **AND THE EMERGENCY DEPARTMENT IS NOW DECIDED — owner ruling R-2026-09-04-B**
 * (`docs/ward-flow/owner-rulings-2026-09-04.md`). Asked whether an ED may see that a patient was
 * also referred to a ward, the owner answered *"Yes can see."* So the ED seat is **coordinator-like
 * for destination visibility, and the opposite of the ward and community seats**, which are both
 * restricted. `EdScopedReferral` below is that seat, and it carries the destination list.
 *
 * **ALL THREE DESTINATION KINDS ARE NOW RULED. Nothing about who may see a referral's destinations
 * is open any more:** ward RESTRICTED (2026-08-30), community RESTRICTED (2026-09-04), emergency
 * department UNRESTRICTED (2026-09-04). A paragraph stood here for five days saying the ED question
 * was a product decision nobody had taken and that adding a projection on the pattern below would be
 * taking it. It has been taken, by the owner, and the paragraph is replaced rather than deleted so
 * that a reader who remembers it can see what happened to it.
 *
 * ⚠️ **"MAY SEE THE DESTINATIONS" IS NOT "MAY SEE EVERYTHING", AND THE RULING SAYS SO IN TERMS.** It
 * widens WHAT the ED seat may carry and changes NOTHING about why the seat is a projection at all:
 * data that reaches a component can be revealed later by a styling change, a new column or a debug
 * panel. So the ED seat is a FOURTH TYPE built exactly like the other three — every field copied by
 * name, no role/scope/viewer argument, no converter to or from any other projection — and it is
 * deliberately **not** the coordinator projection under another name. It carries each destination's
 * KIND and STATE, and nothing else about an arm that is not its own. What it omits and why is
 * written on `EdScopedDestinationSummary` and `EdScopedReferral` below; the short form is that an ED
 * is one party to a referral that may also see where else the patient was sent, and a coordinator
 * is the seat that sees everything.
 *
 * ⚠️ **THE EXISTING ONE-BIT DISCLOSURE THROUGH `referralPersonFacts` IS SANCTIONED, NOT A DEFECT —
 * SAID HERE BECAUSE SOMEBODY WILL OTHERWISE FIND IT AND FILE IT.** `referralPersonFacts`
 * (`ward-referrals.ts`) returns a patient's sex only when a WARD arm exists, because that is the
 * only arm that holds it. An ED screen rendering those facts therefore already tells the department
 * THAT a ward was asked — one bit, in shipped code, before any of this was built. The owner was told
 * that when he was asked, and the ruling records it: a "no" would have been an instruction to change
 * shipped behaviour, and he said yes. **No fix is scheduled for it and none should be opened.**
 */

/**
 * ⚠️ FEW PRODUCTION IMPORTERS IS EXPECTED — this is not orphaned code.
 *
 * ⚠️ **THIS BLOCK CARRIED TWO CLAIMS THAT WERE TRUE WHEN WRITTEN AND ARE NOT TRUE NOW. Both are
 * corrected in place rather than deleted, because both were load-bearing for the argument that a
 * thin importer list here is correct rather than neglect.**
 *
 *   - **It said no file under `src/` imports this module.** It does now:
 *     `community/community-home.tsx` imports `coordinatorScopedReferrals`, and
 *     `community/community-team-hub.tsx` imports the `CommunityScopedReferral` type. The seats are
 *     starting to be built, which is what these functions were written for.
 *   - **It said `Referral` carries no patient link, so no ward-facing screen could render a referral
 *     even if it tried.** `Referral.patientId` has existed since the owner's 2026-09-02 ruling
 *     (*"Yes to the referral remembering its patient"*) — optional, an id and nothing else, and read
 *     by nothing yet. The old sentence describes a constraint the model no longer has, and a reader
 *     meeting it would take it as current.
 *
 * The reason a short importer list is still correct is simply that most seats have no screen yet.
 * The surfaces that render referrals today — the coordinator board, the match view, the network
 * diagram and the ED screen — read the `Referral` record directly and are not ward-facing. These
 * functions exist so that each seat has somewhere to route through the day it is built, and the ED
 * seat below is the newest example: it is written ahead of the screen that will adopt it.
 *
 * ⚠️ **This paragraph used to list WHICH exports that test called, and which had no caller at all.
 * It was false by the time anyone read it** — the list was written when there were four exports and
 * the file now has more, and the function it named as having no caller acquired one in the very
 * change that added the work-list rule. It sat outside every diff, so nothing brought a reader to
 * it. Say WHY a thing is here, which stays true; do not say HOW MANY there are or WHICH ones, which
 * does not. The seed's own `RF-007` comment records the identical failure.
 *
 * `tests/ward-referral-screen-boundary.test.ts` is a static contract test that depends on these
 * names without importing them — its guidance text tells a ward-facing component to route through
 * `wardScopedReferral()` / `wardScopedReferrals()` instead of the full `Referral` record, and its
 * forbidden-vocabulary check names `coordinatorScopedReferral` / `coordinatorScopedReferrals`
 * explicitly. Delete the functions below because "nothing imports them", and that test starts
 * naming functions that no longer exist. The FD-23 boundary this file encodes (see the doc comment
 * above) then has nothing left telling the next author to come here instead of reading
 * `Referral.destinations` straight off the model — at the exact moment somebody finally builds a
 * ward-facing referral surface and has the most reason to get it wrong.
 *
 * Before removing any exported symbol below, run `npm run check:dead-code-candidate` — it exists
 * for exactly this shape, a written contract with no consumer yet, and is built to refuse the
 * removal.
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
 * The community arm as a community-scoped projection carries it — the team that was asked, and
 * nothing else.
 *
 * Structurally identical to the model's `community_team` arm today and deliberately declared
 * separately rather than aliased to it, for the reason `WardScopedDestination` is: an alias would
 * mean a field added to the model's community arm arrives here automatically; a separate
 * declaration means somebody has to decide.
 *
 * And it is deliberately NOT `WardScopedDestination` with a different `kind`, nor a union with it.
 * Two types, no converter — see this module's header on why a function both a ward screen and a
 * community screen reach is the FD-23 exemption arriving by the front door.
 */
export type CommunityScopedDestination = {
  kind: "community_team";
  teamName: string;
};

/**
 * THIS community team's own addressing: what it was asked, what it answered, when, and by which
 * role.
 *
 * Carries no reference of any kind to another destination — not its kind, not its state, not its
 * times, not its count. `state` here is this addressing's own state (`ReferralAddressingState`) and
 * never the referral's derived overall state, which is a fact about all the destinations together
 * and therefore a leak: a referral reads `"accepted"` only because somebody accepted it, and a
 * community team whose own answer was `"declined"` would be reading somebody else's decision.
 *
 * ⚠️ **`acceptedUnitId` is on the ward projection and deliberately NOT here.** `ReferralAddressing`
 * says in terms that it is "Only ever set on a `psychiatric_ward` addressing — the other three are
 * answered by a person or a team, and have no unit to name." A community team is not a unit. A key
 * nothing can ever write is not harmless: it passes every gate, renders as a legitimate empty state,
 * and invites the next author to find something to put in it. `acceptOverrideReason` is absent for
 * the same reason it is absent from the ward projection — the acceptance gates it records are bed
 * gates.
 */
export type CommunityScopedAddressing = {
  destination: CommunityScopedDestination;
  /** When THIS team answered, or when acceptance elsewhere cancelled it. Never another
   *  destination's decision time. */
  state: ReferralAddressingState;
  decidedAt?: Instant;
  /** A ROLE, never a person — the role that answered on this team's behalf. */
  decidedBy?: string;
  /** This team's own decline reason, from `REFERRAL_DECLINE_REASONS`. It is this team's own words
   *  about its own answer, so it is not a leak even when it reads `referred_elsewhere` — the team
   *  wrote it. */
  declineReason?: ReferralDeclineReason;
};

/**
 * A referral as a COMMUNITY TEAM may see it: the person facts every destination shares, the facts
 * about the referral itself, and **one** addressing — its own.
 *
 * Owner ruling 2026-09-04, and the field that is absent is the design, exactly as it is on the ward
 * projection. There is no `destinations`, no `destinationCount`, no `otherDestinations`, no `state`.
 * "Referred to 3 places" names nobody and still tells a team the patient is being worked elsewhere,
 * so the count is as forbidden as the list.
 *
 * `localBedSought` is left off for the ward projection's reason and one more: it records a
 * coordinator hunting a BED, which is the arriving side of a question this team is downstream of.
 * `suburb` is off both scoped projections — see the owner's 2026-09-02 ruling, recorded in the test
 * file's own guard.
 */
export type CommunityScopedReferral = {
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
  addressing: CommunityScopedAddressing;
};

/**
 * THIS emergency department's own arm — which department, and why it was asked.
 *
 * Structurally identical to the model's `emergency_department` arm today and deliberately declared
 * separately rather than aliased to it, for the reason `WardScopedDestination` and
 * `CommunityScopedDestination` are: an alias would mean a field added to the model's ED arm arrives
 * here automatically; a separate declaration means somebody has to decide.
 *
 * ⚠️ **`purpose` IS CARRIED AND IT IS NOT OPTIONAL DECORATION.** `FD-18`: a ward→ED medical
 * notification and ED psychiatry's own review request carry the same `edId` and differ only in
 * `purpose`. A seat that could not see why it was asked would answer a medical notification with a
 * psychiatric-review affordance — the exact confusion `REFERRAL_PURPOSES` exists to prevent.
 */
export type EdScopedDestination = {
  kind: "emergency_department";
  edId: string;
  purpose: ReferralPurpose;
};

/**
 * THIS department's own addressing: what it was asked, what it answered, when, and by which role.
 *
 * The same field set as `CommunityScopedAddressing`, and separately declared for the same reason the
 * community one is separately declared from the ward one: two lists that agree today and one shared
 * constant are different things, and only the second makes widening one widen the other.
 *
 * ⚠️ **`acceptedUnitId` IS DELIBERATELY ABSENT**, exactly as it is from the community projection.
 * `ReferralAddressing` says it is "Only ever set on a `psychiatric_ward` addressing — the other three
 * are answered by a person or a team, and have no unit to name." A department is not a unit. A key
 * nothing can ever write passes every gate, renders as a legitimate empty state, and invites the next
 * author to find something to put in it. `acceptOverrideReason` is absent for the reason it is absent
 * from both other scoped projections — the acceptance gates it records are BED gates.
 *
 * ⚠️ **`state` HERE IS THIS ADDRESSING'S OWN STATE and never the referral's derived overall state.**
 * That distinction is weaker for this seat than for the other two — an ED may now see every arm's
 * state anyway — but it is kept, because the derived state is a fact about all the destinations
 * TOGETHER and this key would then mean something different from the identically-named key on the
 * other three projections.
 */
export type EdScopedAddressing = {
  destination: EdScopedDestination;
  state: ReferralAddressingState;
  /** When THIS department answered, or when acceptance elsewhere cancelled it. */
  decidedAt?: Instant;
  /** A ROLE, never a person — the role that answered on this department's behalf. */
  decidedBy?: string;
  /** This department's own decline reason, from `REFERRAL_DECLINE_REASONS`. Its own words about its
   *  own answer. */
  declineReason?: ReferralDeclineReason;
};

/**
 * ONE DESTINATION THIS REFERRAL WAS SENT TO, AS AN EMERGENCY DEPARTMENT MAY SEE IT — and this type
 * is where owner ruling R-2026-09-04-B is actually spent, so it is where the omissions are argued.
 *
 * The ruling: *"Yes can see."* Its interpretation, recorded in
 * `docs/ward-flow/owner-rulings-2026-09-04.md` so the owner can correct it rather than discover it,
 * is that an ED-facing screen may see **which destinations were asked and the state of those arms**.
 *
 * ⚠️ **SO IT IS TWO FIELDS, AND EVERY OTHER FIELD OF A `ReferralAddressing` IS LEFT OFF ON PURPOSE.**
 * The coordinator seat hands `ReferralAddressing[]` over whole because its answer is "everything";
 * this seat's answer is not "everything", and handing the arms over whole is the single easiest way
 * to turn one into the other. Each omission below is a question the ruling does not answer, and the
 * rule this module works to is that an unobvious inclusion is excluded and reported:
 *
 *   - **`declineReason`** — another ward's clinical reason for saying no. "The state of those arms"
 *     is `declined`; WHY it declined is that ward's own words about its own answer, and the ward
 *     projection's comment says exactly that about the same field.
 *   - **`decidedBy`** — the role that answered elsewhere. Naming who decided is not naming what was
 *     decided.
 *   - **`decidedAt`** — when somebody else answered. A timeline of another destination's decisions is
 *     a different disclosure from the destination list, and nothing in the ruling reaches it.
 *   - **`acceptedUnitId`** — WHICH unit took the patient. The ruling grants which destinations were
 *     ASKED; the receiving unit is a further fact and this seat is not the coordinator.
 *   - **`acceptOverrideReason`** — a clinical override recorded against a bed gate. Off all four
 *     projections.
 *   - **the arm's own criteria** — a ward arm's `sex`, `secureBedNeeded` and `involuntaryBedNeeded`,
 *     and a community arm's `teamName`. These say what was asked OF that destination, not that it was
 *     asked. ⚠️ `sex` is the one worth naming: it already reaches an ED screen through
 *     `referralPersonFacts`, so leaving it off here takes nothing away from a department that has it
 *     — which makes the conservative choice the free one, and it should stay the choice even if that
 *     stops being true.
 *
 * **A ward arm names no ward, and that is the model rather than an omission.** `ReferralDestination`'s
 * `psychiatric_ward` arm carries bed criteria and no ward identity — a bed is matched to a unit at
 * acceptance, not chosen at referral — so `kind` genuinely is the whole of "which" for that arm. The
 * owner's phrasing ("which ward or wards were asked") is honoured by this as fully as the model can
 * honour it.
 */
export type EdScopedDestinationSummary = {
  kind: ReferralDestinationKind;
  state: ReferralAddressingState;
};

/**
 * A referral as an EMERGENCY DEPARTMENT may see it: the person facts every destination shares, the
 * facts about the referral itself, **one** addressing — its own — and, new under owner ruling
 * R-2026-09-04-B, **the destination list**.
 *
 * ⚠️ **THE PLURAL IS PRESENT HERE AND FORBIDDEN ON THE OTHER TWO SCOPED SEATS. THAT IS THE RULING,
 * AND IT IS THE WHOLE DIFFERENCE.** A ward and a community team have no `destinations` key at all,
 * so no later edit in one of their components can reach one. An ED has one, and what it holds is
 * `EdScopedDestinationSummary` — kind and state — never `ReferralAddressing`.
 *
 * **`destinations` lists EVERY arm, this department's own included.** An "others" list would have to
 * decide what "other" means from a seat, would report a count one short of the referral's real one,
 * and would be a second concept to keep in step with the first. The department's own arm appearing
 * twice — once in full as `addressing`, once as a two-field summary — is redundant and harmless;
 * inventing an exclusion rule is neither.
 *
 * **What this seat does NOT carry, each one a decision rather than an oversight:**
 *
 *   - **`state`, the referral's derived overall state.** The coordinator has it. The ruling grants
 *     the state of the ARMS, which `destinations` carries; a single collapsed verdict over all of
 *     them is a further fact nobody asked for. It is also the field most likely to be wanted next,
 *     which is exactly why it should be added by a ruling and not by an implementer.
 *   - **`localBedSought`.** It records a coordinator hunting a bed closer to home — activity on this
 *     referral that is not this department's, and not something the ruling reaches. Left off the ward
 *     and community seats for the same reason.
 *   - **`patientId`, `suburb`, `triagedAt`, `medicalClearance`.** None of the four is on any scoped
 *     projection. ⚠️ **`triagedAt` is the one a reader will want to argue about**: it is the start of
 *     the department clock (`P9-D2`) and an ED screen has an obvious use for it. That is a reason to
 *     ASK for it, not a reason to include it under a ruling about destinations. `suburb` is refused
 *     to a ward outright by the owner's 2026-09-02 ruling and is unruled elsewhere.
 */
export type EdScopedReferral = {
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
  /** Singular — this department's own arm, in full. */
  addressing: EdScopedAddressing;
  /** Plural, and the ruling in one key name: every destination this referral was sent to, as a kind
   *  and a state. Never `ReferralAddressing` — see `EdScopedDestinationSummary`. */
  destinations: EdScopedDestinationSummary[];
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

/** One addressing whose destination is a community team. Declared locally rather than in the model
 *  because nothing outside this module needs it, and a `CommunityAddressing` sitting beside
 *  `WardAddressing` in `ward-model.ts` would be one import away from a screen reading the arm
 *  straight off the record — the thing this module exists to stop. */
type CommunityArmAddressing = ReferralAddressing & {
  destination: Extract<ReferralDestination, { kind: "community_team" }>;
};

/** The community addressing on this referral, if it was addressed to a community team at all. At
 *  most one exists: the reducer refuses two destinations of the same kind.
 *
 *  A private twin of `wardAddressingOf` and NOT a shared kind-parameterised finder. A single
 *  `addressingOf(referral, kind)` reached by both projections would be a module both roles reach —
 *  shared infrastructure by construction, which is precisely the exemption FD-23's guard cannot
 *  see through. The duplication is nine lines and it is the point. */
function communityAddressingOf(referral: Referral): CommunityArmAddressing | undefined {
  return referral.destinations.find(
    (addressing): addressing is CommunityArmAddressing => addressing.destination.kind === "community_team",
  );
}

/**
 * FD-23 (owner ruling 2026-09-04): the community-scoped view of one referral, or `undefined` when
 * this referral was never addressed to a community team.
 *
 * `undefined` rather than an empty projection, and it leaks nothing by saying so: a referral not
 * addressed to a community team simply never appears in that team's list, which is the same thing
 * the team would see if the referral did not exist. It does not say that the referral exists and is
 * hidden.
 *
 * Takes no role, no scope and no viewer, exactly like the other two. Every field is written out by
 * name. Read this module's own doc comment before replacing any of it with a spread.
 */
export function communityScopedReferral(referral: Referral): CommunityScopedReferral | undefined {
  const community = communityAddressingOf(referral);
  if (!community) return undefined;
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
        kind: community.destination.kind,
        teamName: community.destination.teamName,
      },
      state: community.state,
      // Spread-with-condition rather than `decidedAt: community.decidedAt`, so an undecided
      // addressing has NO key rather than a key holding `undefined`. The field-set guard reads
      // `Object.keys`, and a present-but-undefined key would sit inside it unnoticed.
      ...(community.decidedAt !== undefined ? { decidedAt: community.decidedAt } : {}),
      ...(community.decidedBy !== undefined ? { decidedBy: community.decidedBy } : {}),
      ...(community.declineReason !== undefined ? { declineReason: community.declineReason } : {}),
    },
  };
}

/** Every referral a community team may see, community-scoped. A referral addressed to no community
 *  team is absent from the list entirely — see `communityScopedReferral` on why that is not itself
 *  a signal. A deliberate twin of `wardScopedReferrals`, never a shared generic. */
export function communityScopedReferrals(referrals: Referral[]): CommunityScopedReferral[] {
  return referrals
    .map((referral) => communityScopedReferral(referral))
    .filter((projection): projection is CommunityScopedReferral => projection !== undefined);
}

/** One addressing whose destination is an emergency department. Declared locally rather than in the
 *  model for the reason `CommunityArmAddressing` is: an `EdAddressing` sitting beside `WardAddressing`
 *  in `ward-model.ts` would be one import away from a screen reading the arm straight off the record,
 *  which is the thing this module exists to stop. */
type EdArmAddressing = ReferralAddressing & {
  destination: Extract<ReferralDestination, { kind: "emergency_department" }>;
};

/** The emergency-department addressing on this referral, if it was addressed to one at all. At most
 *  one exists: the reducer refuses two destinations of the same kind.
 *
 *  A private twin of `wardAddressingOf` and `communityAddressingOf`, and NOT a shared
 *  kind-parameterised finder — see `communityAddressingOf` on why the duplication is the point.
 *
 *  ⚠️ **IT TAKES NO `edId`, AND THAT IS THE NO-VIEWER-ARGUMENT RULE RATHER THAN AN OVERSIGHT.**
 *  `edReferralsFor` (`ward-referrals.ts`) does take one, because its job is to select which referrals
 *  belong on one department's worklist. This function's job is to project ONE referral, and a
 *  referral has at most one ED arm, so the kind alone finds it. A department id here would be a
 *  viewer argument in a module whose header forbids them. */
function edAddressingOf(referral: Referral): EdArmAddressing | undefined {
  return referral.destinations.find(
    (addressing): addressing is EdArmAddressing => addressing.destination.kind === "emergency_department",
  );
}

/**
 * Owner ruling R-2026-09-04-B: the ED-scoped view of one referral, or `undefined` when this referral
 * was never addressed to an emergency department.
 *
 * `undefined` rather than an empty projection, and it leaks nothing by saying so: a referral not
 * addressed to a department simply never appears in that department's list, which is the same thing
 * it would see if the referral did not exist.
 *
 * Takes no role, no scope and no viewer, exactly like the other three. Every field is written out by
 * name — including every field of every destination summary. Read this module's own doc comment
 * before replacing any of it with a spread, and `EdScopedDestinationSummary` before adding a field
 * to one.
 */
export function edScopedReferral(referral: Referral): EdScopedReferral | undefined {
  const ed = edAddressingOf(referral);
  if (!ed) return undefined;
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
        kind: ed.destination.kind,
        edId: ed.destination.edId,
        purpose: ed.destination.purpose,
      },
      state: ed.state,
      // Spread-with-condition rather than `decidedAt: ed.decidedAt`, so an undecided addressing has
      // NO key rather than a key holding `undefined`. The field-set guard reads `Object.keys`, and a
      // present-but-undefined key would sit inside it unnoticed.
      ...(ed.decidedAt !== undefined ? { decidedAt: ed.decidedAt } : {}),
      ...(ed.decidedBy !== undefined ? { decidedBy: ed.decidedBy } : {}),
      ...(ed.declineReason !== undefined ? { declineReason: ed.declineReason } : {}),
    },
    // ⚠️ TWO FIELDS, BY NAME, PER ARM. `referral.destinations.map((a) => a)` or `{ ...addressing }`
    // here hands over every arm's decline reason, decider, decision time and accepting unit — the
    // coordinator seat's answer pasted into a seat the owner did not give it to.
    destinations: referral.destinations.map((addressing) => ({
      kind: addressing.destination.kind,
      state: addressing.state,
    })),
  };
}

/** Every referral an emergency department may see, ED-scoped. A referral addressed to no department
 *  is absent from the list entirely — see `edScopedReferral` on why that is not itself a signal. A
 *  deliberate twin of `wardScopedReferrals` and `communityScopedReferrals`, never a shared generic.
 *
 *  ⚠️ It does NOT narrow to one department. `edReferralsFor` / `edAnsweredReferralsFor`
 *  (`ward-referrals.ts`) are where a screen picks its own department's work; this answers only what
 *  each referral looks like from an ED seat. Two questions, two functions, and no flag. */
export function edScopedReferrals(referrals: Referral[]): EdScopedReferral[] {
  return referrals
    .map((referral) => edScopedReferral(referral))
    .filter((projection): projection is EdScopedReferral => projection !== undefined);
}

/**
 * FD-23: the coordinator's view — everywhere this referral was sent, and what each said.
 *
 * ⚠️ **`tsc` CATCHES A FIELD REMOVED FROM THE OBJECT BELOW. IT DOES NOT CATCH A FIELD ADDED BY A
 * SPREAD — AND AN EARLIER VERSION OF THIS PARAGRAPH SAID IT DID.** Both halves are measured.
 *
 *   - **REMOVED — `tsc` holds it, the suite does not.** Delete a line from the object below and
 *     `npx vitest run tests/ward-referral-visibility.test.ts` still passes; `npx tsc -p
 *     tsconfig.typecheck.json --noEmit` exits 2 with `TS2741: Property '…' is missing in type '…'
 *     but required in type 'CoordinatorScopedReferral'`. (Mutation run 2026-09-02, `originSiteCode`
 *     removed and restored byte-identically.)
 *   - **ADDED — `tsc` holds NOTHING.** Put `...referral` at the top of the object below, leaving
 *     every by-name line in place, and the projection silently gains `patientId`, `suburb` and
 *     `triagedAt` while `tsc` exits **0**. TypeScript's excess-property check does not reach
 *     properties arriving through a spread, so an object literal assigned to a declared type
 *     accepts extra ones in this position. (Mutation run 2026-09-04; before the guard described
 *     below existed it also left all 116 tests in that file passing.)
 *
 * ⚠️ **THE OLD CLAIM WAS LOAD-BEARING, WHICH IS WHY IT IS CORRECTED HERE RATHER THAN QUIETLY
 * DELETED.** It said the field set was enforced by `tsc`, full stop. A reviewer reads that and
 * stops looking — and that is exactly what happened, for two days, until somebody ran the addition
 * mutation. **`vitest.config.mts` carries no `typecheck` block**, so vitest never evaluates the
 * type either.
 *
 * **The addition half is now held at runtime by `tests/ward-referral-visibility.test.ts`**, in a
 * root field-set allowlist for this projection built the way the ward and community ones are: a
 * hand-built referral carrying `patientId`, `suburb`, `triagedAt` and `medicalClearance`, the real
 * projection run over it, and a positive control proving the check finds the fields that ARE
 * legitimately there. **That is not the same verdict `tsc` gives, so it is not buying one twice** —
 * `tsc` holds the removal half and can hold nothing else. What it asserts is structural only: the
 * object carries exactly the set this type declares. **It rules on nothing about what a coordinator
 * MAY see.** FD-23's answer for this seat is still "everything"; widening the seat simply has to be
 * an edit to the type and the allowlist together, which a reviewer sees, rather than a spread that
 * does it on somebody's behalf. `destinations` is handed over whole and its contents are
 * deliberately unguarded. The ward projection's allowlist test likewise compares two literals both
 * defined in the test file, with its real teeth in the `Required<WardScopedReferral>` annotation —
 * and its root has its own spread guard, measured red.
 *
 * ⚠️ **What NEITHER gate can catch is a field missing from the TYPE.** `suburb` is on `Referral` and
 * on neither projection, so there is nothing for `tsc` to require — and `coordinatorScopedReferrals`
 * below says "the coordinator may see everything", which this object does not do. It is recorded
 * here because a type-completeness gap looks nothing like an enforcement gap and the two were
 * conflated once already. (Found by Ward Builder Three, 2026-09-02.)
 *
 * ✅ **ANSWERED — the owner ruled on 2026-09-02 that a coordinator is NOT shown a patient's suburb.**
 * Until that ruling the field's absence was an accident that happened to agree with good practice:
 * nothing recorded the intent, so the next person widening this type would have added it without
 * meeting a single objection.
 *
 * **The ruling is held by `tests/ward-referral-visibility.test.ts`, in a guard that asserts the
 * absence of that ONE NAMED FIELD and deliberately does not re-assert the field set** — which is
 * why it does not contradict the paragraph above. Re-asserting the list would buy a verdict `tsc`
 * already gives. This is the opposite case: **a type states what IS present and cannot state what
 * must NEVER be, so `tsc` cannot fail on a field nobody wrote.** Proved rather than assumed —
 * adding `suburb` to both this type and the projection leaves `tsc` at exit 0 while that guard goes
 * red. **There is no second verdict here, only a first one.**
 */
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

/**
 * Which way a destination points relative to the bed decision.
 *
 * `"arriving"` — upstream of it: the patient is coming to the bed question and somebody has to
 * answer it. `"leaving"` — downstream of it: the bed question is behind them.
 */
export type ReferralDirection = "arriving" | "leaving";

/**
 * The direction of one destination KIND — the owner's own criterion, 2026-09-01, made a function.
 *
 * A psychiatric ward is a bed request. An emergency department is somebody sitting in a department
 * waiting on a psychiatry decision — still upstream, even when the referral asks for no bed at all
 * (`RF-009`, purpose `psychiatric_review`). A community team is discharge planning: the patient is
 * leaving, and the owner's words are that a community referral "is for discharge".
 *
 * **Exhaustive by `switch` with NO `default` arm, deliberately.** The rule below reads today as
 * "all community", but the PRINCIPLE is "all downstream" — `community_team` merely happens to be
 * the only downstream kind the model has. A fourth kind added later would silently inherit
 * whatever a `default` returned and nothing would go red; without one, it does not compile until
 * somebody decides which way it points. Same discipline, and the same reason, as
 * `referralDestinationKindLabel` in `ward-referrals.ts`. A comment claiming community is the only
 * downstream kind would decay; this switch is what actually holds it.
 */
export function referralDestinationDirection(kind: ReferralDestinationKind): ReferralDirection {
  switch (kind) {
    case "psychiatric_ward":
      return "arriving";
    case "emergency_department":
      return "arriving";
    case "community_team":
      return "leaving";
  }
}

/**
 * WHETHER THIS REFERRAL IS THE COORDINATOR'S WORK — the owner's ruling of 2026-09-01, verbatim:
 * *"Any referrals to community Do NOT need to be flagged in the coordinators screen."*
 *
 * His reason: a community referral is **discharge planning**. The patient is leaving. It is not a
 * rival bed offer and it is not part of bed-matching.
 *
 * ⚠️ **THE CRITERION IS DIRECTION, AND IT IS NOT "ASKS FOR NO BED".** He gave the general rule in
 * the same breath: a referral is the coordinator's work while the patient is ARRIVING at the bed
 * question, and stops being it once they have PASSED it. The seed holds the case that separates the
 * two — `RF-009` is a single emergency-department destination, purpose `psychiatric_review`, asking
 * for **no ward bed at all**, and **the owner ruled it STAYS VISIBLE**. A rule keyed on "asks for
 * no bed" gives the wrong answer there while giving the right one for community, which is exactly
 * how a right rule with a wrong justification gets misapplied by the next reader.
 *
 * ⚠️ **IT READS THE LIVE ARMS, NOT MERELY THE KINDS, and that is a defect this function was
 * rewritten to close.** A ward arm DECLINED with a community arm still QUEUED has no bed question
 * left to answer: every ward that could have taken the patient has said no, and the only live arm
 * is the community follow-up. `referralState` still reads `"queued"` there (one decline is not a
 * declined referral, FD-24), so a kind-only rule leaves the row in the bed-matching queue presented
 * as somebody awaiting a bed — the very class the ruling exists to remove. Declines are
 * per-addressing, so a user reaches that state in two clicks, and no seeded referral has it.
 *
 * ⚠️ **THE RULE LIVES IN ONE PROJECTION RATHER THAN IN THE QUEUE ORDERING, AND SOMEBODY HAS
 * ALREADY TRIED IT THE OTHER WAY.** Commit `fa616d1c9` ("the nine community referrals asked for no
 * bed and sat in the bed queue", 2026-09-01) records narrowing the queue predicate being falsified
 * before it was written: that filter and `recentlyDecidedReferrals` are **exact complements**, so
 * narrowing one leaves community-only referrals in NEITHER list — live referrals vanishing off the
 * coordinator's board entirely, worse than the ordering it set out to fix. The same commit records
 * why marking them `accepted` instead also failed: an accepted referral must carry an
 * `acceptedUnitId` that resolves to a real unit and passes eligibility, **and a community team is
 * not a unit**. The model is ward-bed-shaped throughout and has no home yet for a community-team
 * outcome — which is why this is a display-side projection and never a state change.
 *
 * **It is the display-side counterpart of a rule the reducer already holds.** `ACCEPT_REFERRAL`
 * (`ward-flow-reducer.ts`) never cancels a community destination when another arm accepts, on the
 * owner's ruling that a community referral does not COMPETE with a bed. Same fact, two surfaces:
 * one keeps the follow-up alive, this one keeps it out of the bed-matching work.
 *
 * **The combinations, and who decided each.** `{ED, community}` stays visible — **ruled by the
 * owner, 2026-09-01: "yes keep them visible"**, asked about someone awaiting psychiatric review in
 * a department who also has a community team asked to pick them up. `{ward, community}` is to be
 * **refused at the intake form**, also his ruling — but a refusal at creation does nothing about
 * referrals that already exist, and the seeded `RF-007` carries the shape today. So after that
 * refusal lands, the only mixed combination the product can still create is `{ED, community}`, and
 * it stays visible. The table is decided rather than lucky.
 *
 * **`coordinatorScopedReferral` and `coordinatorScopedReferrals` are untouched by all of this, and
 * that is deliberate.** FD-23 (2026-08-30) answers *which FIELDS a viewer may see of a referral*,
 * and its answer for the coordinator is "everything" — see this module's header on how easily that
 * ruling is undone by somebody being helpful. This one answers *which REFERRALS are the
 * coordinator's work*. Two questions, two functions, and no flag: a flag is a thing that can be
 * passed the other way.
 */
export function coordinatorWorksReferral(referral: Referral): boolean {
  // 1. No destinations at all: MALFORMED, not community — the one case where "nothing arriving"
  //    and "is a community referral" come apart. The reducer refuses to create one
  //    (`RECEIVE_REFERRAL needs at least one destination`), so it can only arrive from a fixture or
  //    a bad hand-built object. Hiding a broken record makes it nobody's problem; showing it makes
  //    it somebody's. In a system whose whole purpose is that a waiting person does not vanish,
  //    the conservative failure is to SHOW.
  if (referral.destinations.length === 0) return true;

  // The still-queued arms, read by BOTH branch 2 and branch 3 and therefore computed once, above
  // both. Branch 2 needs it to answer the shape below; branch 3 needs it as its whole subject.
  const queued = referral.destinations.filter((addressing) => addressing.state === "queued");

  // Whether an arriving (ward or ED) arm is still queued — also read by both branch 2's fallback and
  // branch 3's body, and computed once here so the two copies cannot drift apart from each other.
  const arrivingIsStillLive = queued.some(
    (addressing) => referralDestinationDirection(addressing.destination.kind) === "arriving",
  );

  // 2. An accepted arm IS the outcome — UNLESS something arriving is still waiting to be answered.
  //    If the patient was taken by a ward or an emergency department, the referral is this
  //    coordinator's work whatever else it holds. If the only acceptance is a community team, the
  //    referral is finished with the bed question ONLY when no arriving arm is still live.
  //
  //    ⚠️ **WHY THE QUEUED ARMS ARE READ HERE, WHICH IS THE WHOLE POINT OF THIS BRANCH.** An
  //    accepted LEAVING arm must never outrank a live ARRIVING one. `{ward: queued, community:
  //    accepted}` is a bed request nobody has answered sitting beside a discharge-planning arm that
  //    somebody has; the acceptance settles the discharge question and settles NOTHING about the
  //    bed. Answering from the accepted arm alone hid that patient — a silent removal from the
  //    coordinator's board with no row, no badge and no error to notice it by, and the only thing
  //    that could ever have caught it was a person reading this file.
  //
  //    ⚠️ **DO NOT "SIMPLIFY" THIS BACK TO `return direction(accepted[0]) === "arriving"`.** It
  //    looks like dead weight because branch 3 already returns `arrivingIsStillLive` and branch 4
  //    ends in `some(arriving)` over the whole record — but neither of them runs when an arm is
  //    accepted, so nothing downstream covers this. Make that edit and `{ward: queued, community:
  //    accepted}` and `{ED: queued, community: accepted}` vanish from the work list again: a person
  //    waiting on a bed, or sitting in a department waiting on a psychiatric decision, dropped
  //    because a community team said yes to the discharge arm. Rows of the generated table in
  //    `tests/ward-referral-visibility.test.ts` go red on that edit, and they are the reason to leave
  //    it alone.
  //
  //    ⚠️ **WHAT THIS DOES NOT CHANGE, because both are ruled verdicts.** Case B (`{ward: declined,
  //    community: accepted}`) reaches this branch with `queued` empty, so it is still hidden exactly
  //    as before. A community-only referral is untouched too, but not always by THIS branch: only in
  //    the accepted state does it reach here at all, and then with `queued` empty; in the queued or
  //    declined state it has no accepted arm and never enters branch 2 at all. ⚠️ **And the two are
  //    not decided in the same place — an earlier version of this comment said branch 3 handled
  //    both, which is wrong for one of them.** Queued goes to branch 3 (`queued` is `[C]`, so the
  //    guard fires and `some(arriving)` answers false). Declined goes to branch 4, because `queued`
  //    is empty and branch 3's guard never fires at all. Same verdict, different branch; naming the
  //    wrong one is the exact defect class this paragraph was rewritten to close. The branch answers
  //    a strictly narrower question than it used to, never a different one.
  //
  //    ⚠️ **REACHABILITY, STATED HONESTLY RATHER THAN OVERSOLD.** The reducer cannot produce an
  //    accepted leaving arm beside a queued arriving one: `ACCEPT_REFERRAL` cancels every
  //    still-queued destination when any arm accepts, and its ONE exemption is keyed on the
  //    CANDIDATE's kind (`candidate.destination.kind === "community_team"`), not the accepter's — so
  //    a community acceptance still cancels a queued ward or ED arm. That is why the seeded-data
  //    guard in the test holds. The shape reaches this function from a fixture, a hand-built object
  //    or legacy data, exactly like branch 1's malformed referral and the two-accepted case below,
  //    and it gets the same answer they get: SHOW. (It also means this fix does not close the
  //    related reducer question — whether a community acceptance should be cancelling a live
  //    psychiatric-review arm at all. That is a decision about `ACCEPT_REFERRAL`, not about this
  //    predicate, and nothing here should be read as having settled it.)
  //
  //    ⚠️ FILTERED AND COUNTED RATHER THAN `find`-ed, so the answer never depends on array order. A
  //    `find` would answer quietly from whichever arm happened to be first in the array, and a
  //    fixture reorder could flip the verdict with nothing to show for it.
  //
  //    ⚠️ **TWO ACCEPTED ARMS IS A REAL DEFECT AND THIS IS STILL NOT THE PLACE TO BE LOUD.** Two
  //    places believing they have taken the same person is serious. But this predicate is consulted
  //    DURING RENDER, and **throwing from it trades a whole board for one row**: every other waiting
  //    patient disappears in order to announce that one record is contradictory. That trade is wrong
  //    at any blast radius — behind an error boundary it costs a panel instead of a page, and a panel
  //    of missing patients is still a worse failure than one visible row a coordinator can question.
  //    (Boundaries exist now — `src/app/mockups/ward-flow/error.tsx` and its nearer sibling
  //    `src/app/mockups/ward-flow/statistics/error.tsx` — but neither shrinks the blast radius this
  //    argument describes. Both render inside `ward-flow/layout.tsx`, so both replace the entire
  //    page, navigation rail included: the statistics boundary's own doc comment says plainly "It
  //    does NOT keep more of the screen alive than the parent would" and that reasoning about a
  //    nearer boundary "'fails smaller' on screen is reasoning about a layout this route tree does
  //    not have." Neither boundary reaches `WardFlowProvider`'s seeding in `ward-flow/layout.tsx` or
  //    the module-scope throw in `ward-movements.ts` either — both are recorded as open gaps in
  //    `ward-flow/error.tsx`'s own doc comment. That is supporting detail, not the reason: even a
  //    boundary that caught everything would still trade a panel of missing patients for one row
  //    nobody can act on, which is the wrong trade regardless.)
  //
  //    So it SHOWS the row, for the same reason branch 1 shows a malformed referral: a visible row
  //    with a confused destination is something a coordinator can see and question; a blank board is
  //    not. The invariant is pinned where loudness is safe — `tests/ward-referral-visibility.test.ts`
  //    asserts through the reducer that this state cannot be produced at all (`ACCEPT_REFERRAL`
  //    refuses when `referralState(referral)` is already `"accepted"`, and refuses again when the
  //    addressing is not `queued`). A data-integrity check, not a render predicate, is where a defect
  //    like this belongs.
  const accepted = referral.destinations.filter((addressing) => addressing.state === "accepted");
  if (accepted.length > 1) return true;
  if (accepted.length === 1) {
    if (referralDestinationDirection(accepted[0].destination.kind) === "arriving") return true;
    // The one acceptance points downstream, so it decides only if nothing upstream is still live.
    return arrivingIsStillLive;
  }

  // 3. Otherwise the live arms are the queued ones, and a DECLINED arm's kind stops mattering once
  //    it is declined.
  //
  //    ⚠️ **DO NOT DELETE THIS BRANCH AS REDUNDANT WITH BRANCH 4 — THAT IS THE TRAP.** Both branches
  //    answer "is anything still arriving" (this one via `arrivingIsStillLive`, branch 4 via
  //    `destinations.some(arriving)` over the whole record), but they differ on exactly one shape: a
  //    DECLINED arriving arm with every still-queued arm downstream. **Delete this branch and that
  //    patient becomes visible again**, sitting in the bed-matching queue when the only live thing
  //    about them is a discharge follow-up — the precise class the owner's ruling exists to remove.
  //    Everywhere else the two branches agree, so a reader who checks a few cases will conclude this
  //    one is dead code. It is not: the difference is the whole point.
  //
  //    `queued` and `arrivingIsStillLive` are declared above branch 2, which also reads them. Reached
  //    only with NO accepted arm.
  if (queued.length > 0) {
    return arrivingIsStillLive;
  }

  // 4. Nothing live — every arm has answered. Decide on the whole record.
  //
  //    ⚠️ **DELETE THIS BRANCH (falling back to "no live arriving arm, so hide") AND A DECIDED BED
  //    REFERRAL DISAPPEARS THE MOMENT ITS LAST WARD SAYS NO** — off the recently-decided side of the
  //    coordinator's board and out of view entirely, at the moment somebody most needs to see that
  //    every ward has refused. Reading the whole record here is also what keeps a referral that was
  //    only ever addressed to a community team hidden in every state it can reach.
  //
  //    This is the branch that makes a `{ward, community}` referral RETURN to the work list once the
  //    community arm declines too. That return is ruled (owner, 2026-09-01): the rule stands and the
  //    SCREEN carries the reason, because a patient nobody has taken genuinely is back in play. The
  //    three-state walk is written out in `tests/ward-referral-visibility.test.ts`.
  //
  //    ⚠️ REACHED AS *ALL DECLINED*, AND — ON REDUCER-PRODUCED DATA — AS NOTHING ELSE. `cancelled`
  //    is written in exactly one place in the whole codebase, inside `ACCEPT_REFERRAL`, on the arms
  //    that did NOT accept; the arm that did is set to `accepted` in the same reduction. So a
  //    cancelled arm always travels with an accepted one, branch 2 answers first, and this branch
  //    never sees it. A referral holding `declined` and `cancelled` with nothing accepted can only
  //    come from a hand-built object. Said explicitly because a comment claiming this branch handles
  //    cancellations would be describing a capability the system does not have.
  return referral.destinations.some(
    (addressing) => referralDestinationDirection(addressing.destination.kind) === "arriving",
  );
}

/**
 * The coordinator's WORK LIST: every referral that is still the coordinator's work, each through
 * the FD-23 coordinator projection unchanged.
 *
 * Two questions answered in order and kept apart — `coordinatorWorksReferral` decides WHICH
 * referrals appear, `coordinatorScopedReferral` decides WHAT each one carries. Nothing here
 * re-implements the projection, and nothing here filters fields.
 */
export function coordinatorWorklistReferrals(referrals: Referral[]): CoordinatorScopedReferral[] {
  return referrals
    .filter((referral) => coordinatorWorksReferral(referral))
    .map((referral) => coordinatorScopedReferral(referral));
}
