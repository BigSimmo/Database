import type { Instant } from "@/components/ward-management/ward-clock";
import type {
  Cohort,
  HomeRegion,
  Referral,
  ReferralAddressing,
  ReferralAddressingState,
  ReferralDeclineReason,
  ReferralDestinationKind,
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
 * ⚠️ ZERO PRODUCTION IMPORTERS IS EXPECTED — this is not orphaned code.
 *
 * No file under `src/` imports this module today, and its only importer anywhere in the repo is
 * `tests/ward-referral-visibility.test.ts`. That absence is correct, not neglect: `Referral` carries
 * no patient link, so no ward-facing screen can render a referral today even if it tried. These
 * functions exist to be ready the day one can.
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

/**
 * FD-23: the coordinator's view — everywhere this referral was sent, and what each said.
 *
 * ⚠️ **THE FIELD SET HERE IS ENFORCED BY `tsc`, NOT BY THE TEST SUITE — measured, not assumed.**
 * Delete a line from the object below and `npx vitest run tests/ward-referral-visibility.test.ts`
 * still reports `Tests 100 passed (100)`; `npx tsc -p tsconfig.typecheck.json --noEmit` exits 2 with
 * `TS2741: Property '…' is missing in type '…' but required in type 'CoordinatorScopedReferral'`.
 * (Mutation run 2026-09-02, `originSiteCode` removed and restored byte-identically.) The same is
 * true of the ward projection: its allowlist test compares two literals both defined in the test
 * file, and its real teeth are the `Required<WardScopedReferral>` annotation. **`vitest.config.mts`
 * carries no `typecheck` block**, so vitest never evaluates either.
 *
 * That is not a hole — `verify:cheap` and CI both run `typecheck`, so nothing merges past it. It is
 * a statement about WHICH gate holds the contract, written here because the fast local loop
 * (`test:focused`, a bare vitest run) is the one people iterate on and the one that cannot see this.
 * **Do not "fix" it by re-asserting the field set at runtime**: this repository's rule is not to buy
 * the same verdict twice, and a duplicate guard would decay independently of the type it copies.
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
