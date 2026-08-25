"use client";

import { CircleAlert, ClipboardCheck, FileCheck2, IdCard, ShieldCheck, Trash2, UserRoundCheck } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { ListEmptyState } from "../list-empty-state";
import { UnavailableDestination } from "../unavailable-destination";
import {
  clearPlanDraft,
  emptyPlanDraft,
  planDraftStorageAvailable,
  readPlanDraft,
  writePlanDraft,
  type PlanDraft,
} from "./plan-draft";
import {
  PLAN_WIZARD_STAGES,
  PLAN_WIZARD_STAGE_DEFINITIONS,
  nextPlanWizardStage,
  planWizardStageImplementation,
  previousPlanWizardStage,
  type PlanWizardStage,
} from "./stages";
import { StatedReason } from "./stated-reason";

/**
 * Putting a discharged patient onto a caring-contact plan: agreement, pathway, personalisation,
 * review and activation.
 *
 * THE FIRST DELIBERATE CLIENT COMPONENT IN THIS WORKSPACE (Ruling [109])
 * ---------------------------------------------------------------------
 * Every other screen here is a Server Component and works with JavaScript turned off; Tasks 5 and
 * 6 both reached a full filter-and-search screen with no client boundary at all. This one cannot,
 * and the reason is an owner decision rather than convenience: a half-finished sign-up must
 * survive a page refresh, which neither a Server Component nor a URL parameter can do. And a URL
 * parameter is independently forbidden for this data — `src/app/api/caring-contacts/plans/route.ts`
 * records why in the code, and stage 3 is where the patient's name and mobile number arrive.
 *
 * Ruling 13 holds this workspace's client payload to a rounding error, not to zero, and the
 * licence is for this route only. The page above stays a Server Component: it makes the audited
 * reads, fails closed on every bad outcome, and loads this behind the same lazy `dynamic()`
 * boundary the workspace's other routes use, so nothing here enters another route's chunk.
 *
 * THE SERVICE STATE NEVER CROSSES THIS BOUNDARY, and that constraint is absolute. `ServiceState`
 * carries a free-text incident `note` that the server surface gates behind `viewPatientRecord`;
 * this component takes no service state, no note, and nothing derived from either. The safety
 * banner is the shell's, rendered on the server, above this. `tests/caring-contacts-new-plan-page.dom.test.tsx`
 * pins that the page hands this component no such prop, because "the wizard is exactly where it
 * would be easiest to leak" is a prediction, not a guarantee.
 *
 * WHAT IS BUILT HERE AND WHAT IS NOT
 * ---------------------------------
 * Task 7 builds the shell that carries all four stages, plus stages 1 and 2. Stages 3 and 4 are an
 * explicit, typed extension point: the stepper names them, the forward control from stage 2 states
 * that the next one is not built rather than advancing into an empty room (Ruling 52), and
 * `stages.ts` records exactly what Tasks 8 and 9 change.
 *
 * NO OVERLAY IS WIRED HERE. The approved mockup opens several from these stages — identity
 * review, changing the patient, previewing the pathway. Task 11 owns this group's overlay wiring;
 * the seams are named in the Task 7 report rather than half-built here.
 */
export type PlanWizardPathwayOption = {
  id: string;
  /** The pathway's own cadence wording, taken from its frozen snapshot. Never written here. */
  cadenceLabels: readonly string[];
  /** Which approval seats are recorded against this version. Governance provenance, not a tally. */
  approvedByRoles: readonly string[];
  /** AWST instant this version was published, or null. */
  publishedAt: string | null;
};

export type PlanWizardProps = {
  /** The accepted referral this sign-up is for. Validated by the page before it reaches here. */
  referralId: string;
  /** The synthetic patient identifier the referral names. Never a patient's name. */
  patientId: string;
  /** The team that accepted the referral. */
  teamId: string;
  /** Who is acting. Read from the session, not from the referral. */
  actorId: string;
  actorRoles: readonly string[];
  /**
   * The pathway version the referral already names, or null (Ruling [113]). An accepted referral
   * can carry a pathway chosen by whoever accepted it, and stage 2 says so rather than presenting
   * an empty choice as though nothing had been decided.
   */
  referralPathwayVersionId: string | null;
  /** The approved versions this actor may choose between. Read on the server. */
  pathwayOptions: readonly PlanWizardPathwayOption[];
};

const panelClass =
  "min-w-0 rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--surface)] p-4 sm:p-5";

const primaryControlClass =
  "inline-flex min-h-tap min-w-0 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] px-4 text-sm font-semibold text-[color:var(--clinical-accent-contrast)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:border-[color:var(--border)] disabled:bg-[color:var(--surface-subtle)] disabled:text-[color:var(--text-muted)] forced-colors:border-[CanvasText]";

const secondaryControlClass =
  "inline-flex min-h-tap min-w-0 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 text-sm font-semibold text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] forced-colors:border-[CanvasText]";

const optionClass =
  "flex min-h-tap w-full min-w-0 items-start gap-3 border-t border-[color:var(--border)] px-4 py-3 text-left first:border-t-0 focus-within:outline focus-within:outline-2 focus-within:outline-offset-[-0.125rem] focus-within:outline-[color:var(--focus)]";

const mutedTextClass = "max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text-muted)]";

const headingClass = "text-sm font-semibold text-[color:var(--text-heading)]";

/** One fact, with where it came from. The source line is the whole point — see Ruling [112]. */
function SourcedFact({ icon, label, value, source }: { icon: ReactNode; label: string; value: string; source: string }) {
  return (
    <div className="flex min-w-0 items-start gap-3 border-t border-[color:var(--border)] py-3 first:border-t-0 first:pt-0">
      <span className="mt-0.5 shrink-0 text-[color:var(--text-muted)]">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-[color:var(--text-muted)]">{label}</p>
        <p className="mt-0.5 break-words text-sm font-semibold text-[color:var(--text-heading)]">{value}</p>
        <p className="mt-0.5 text-xs leading-5 text-[color:var(--text-muted)]">{source}</p>
      </div>
    </div>
  );
}

export function PlanWizard({
  referralId,
  patientId,
  teamId,
  actorId,
  actorRoles,
  referralPathwayVersionId,
  pathwayOptions,
}: PlanWizardProps) {
  // The draft starts empty on both the server render and the first client render, and is only
  // replaced once from storage after mount. Reading storage during render would make the two
  // renders disagree, and the disagreement would be about a patient's details.
  const [draft, setDraft] = useState<PlanDraft>(() => emptyPlanDraft(referralId, referralPathwayVersionId));
  const [storage, setStorage] = useState<"pending" | "held" | "refused">("pending");
  const [discarded, setDiscarded] = useState(false);

  useEffect(() => {
    const restored = readPlanDraft(referralId);
    if (restored !== null) setDraft(restored);
    setStorage(planDraftStorageAvailable() ? "held" : "refused");
  }, [referralId]);

  /** Every change goes through here, so nothing can update the screen without updating the draft. */
  function update(change: (current: PlanDraft) => PlanDraft) {
    setDiscarded(false);
    setDraft((current) => {
      const next = change(current);
      setStorage(writePlanDraft(next) ? "held" : "refused");
      return next;
    });
  }

  function discard() {
    clearPlanDraft();
    setDraft(emptyPlanDraft(referralId, referralPathwayVersionId));
    setDiscarded(true);
  }

  const stage = draft.stage;
  const implementation = planWizardStageImplementation(stage);
  const body = stageBody();

  return (
    <div className="flex min-w-0 flex-col gap-5" data-testid="caring-contacts-plan-wizard">
      <Stepper active={stage} />
      <DraftNotice storage={storage} discarded={discarded} onDiscard={discard} />
      {implementation.kind === "not-built" ? (
        <UnbuiltStagePanel stage={stage} reason={implementation.reason} onBack={goBack} />
      ) : (
        assertBuiltStageHasABody(body, stage)
      )}
    </div>
  );

  function goTo(next: PlanWizardStage) {
    update((current) => ({ ...current, stage: next }));
  }

  function goBack() {
    const previous = previousPlanWizardStage(stage);
    if (previous !== null) goTo(previous);
  }

  /**
   * The body for the current stage, or null where this task built none.
   *
   * The `never` default is what makes the stage set exhaustive: a stage added to the union and
   * left out of this switch does not compile. `assertBuiltStageHasABody` closes the other half —
   * a stage whose table entry says "built" while this switch still returns null.
   */
  function stageBody(): ReactNode | null {
    switch (stage) {
      case "agreement":
        return (
          <AgreementStage
            referralId={referralId}
            patientId={patientId}
            teamId={teamId}
            actorId={actorId}
            actorRoles={actorRoles}
            assurances={draft.assurances}
            onAssuranceChange={(change) =>
              update((current) => ({ ...current, assurances: { ...current.assurances, ...change } }))
            }
            onContinue={() => goTo("pathway")}
          />
        );
      case "pathway":
        return (
          <PathwayStage
            options={pathwayOptions}
            chosen={draft.pathwayVersionId}
            referralPathwayVersionId={referralPathwayVersionId}
            onChoose={(id) => update((current) => ({ ...current, pathwayVersionId: id }))}
            onBack={goBack}
            onContinue={() => goTo("personalisation")}
          />
        );
      case "personalisation":
      case "review":
        // Task 7 built no body for these. The panel above states it; this returns nothing rather
        // than a placeholder that would have to be found and deleted later.
        return null;
      default: {
        const unrendered: never = stage;
        return unrendered;
      }
    }
  }
}

/**
 * Fails loudly when a stage claims to be built and has no body.
 *
 * The `never` default in `stageBody` catches a stage nobody handled. It cannot catch the opposite
 * mistake, which is the one Tasks 8 and 9 can actually make: flipping an entry in
 * `planWizardStageImplementation` to `built` and not writing the body. That would render a stepper,
 * a notice, and an empty column where a clinician expects a patient's details — so it throws, and
 * `error.tsx` says nothing was sent and nothing was changed, both of which are true.
 */
function assertBuiltStageHasABody(body: ReactNode | null, stage: PlanWizardStage): ReactNode {
  if (body === null) {
    throw new Error(`caring-contacts plan wizard: stage "${stage}" is marked built but this component renders no body for it.`);
  }
  return body;
}

function Stepper({ active }: { active: PlanWizardStage }) {
  return (
    <nav aria-label="Sign-up stages">
      <ol className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
        {PLAN_WIZARD_STAGES.map((stage) => {
          const definition = PLAN_WIZARD_STAGE_DEFINITIONS[stage];
          const implementation = planWizardStageImplementation(stage);
          const current = stage === active;
          return (
            <li
              key={stage}
              aria-current={current ? "step" : undefined}
              className={`flex min-w-0 items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-sm ${
                current
                  ? "border-[color:var(--clinical-accent)] font-semibold text-[color:var(--text-heading)]"
                  : "border-[color:var(--border)] text-[color:var(--text-muted)]"
              } forced-colors:border-[CanvasText]`}
            >
              <span className="min-w-0 truncate">{definition.label}</span>
              {implementation.kind === "not-built" ? (
                <span className="shrink-0 text-xs text-[color:var(--text-muted)]">not built yet</span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * What is being kept on this computer, said in plain words and in place (Ruling [110]).
 *
 * This is the system doing something the clinician did not ask for, which is exactly the contract
 * spec §4.4 sets: the surface stating the state also states why, and what would change it. A
 * notice reachable only by hovering has not been stated, so this is text in the flow of the page,
 * and the control that acts on it is beside the words that describe it.
 *
 * The wording follows what actually happened rather than what was intended. `"pending"` is the
 * server render and the first client render, before this browser has been asked; `"refused"` is a
 * browser that would not keep anything, where a notice promising the page will remember would be
 * false.
 */
function DraftNotice({
  storage,
  discarded,
  onDiscard,
}: {
  storage: "pending" | "held" | "refused";
  discarded: boolean;
  onDiscard: () => void;
}) {
  const heading = storage === "refused" ? "Nothing is being kept on this computer" : "Kept on this computer until you close the tab";
  const because =
    storage === "refused"
      ? "This browser would not let the page keep anything, so nothing you enter here is written down."
      : "So that reloading the page does not lose a part-finished sign-up, what you enter here is written to this computer's storage for this tab only. It is not sent anywhere, and nothing is sent to any number from this screen.";
  const changedBy =
    storage === "refused"
      ? "Nothing. Reloading or closing the tab loses what you have entered, so finish this sign-up in one sitting."
      : "Closing this tab removes it. Discard draft, below, removes it now — use it if you are stepping away from a shared computer.";

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <StatedReason
        heading={heading}
        because={because}
        changedBy={changedBy}
        icon={<CircleAlert aria-hidden="true" className="size-icon-md shrink-0" />}
      />
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <button type="button" onClick={onDiscard} className={secondaryControlClass}>
          <Trash2 aria-hidden="true" className="size-icon-md shrink-0" />
          <span className="truncate">Discard draft</span>
        </button>
        <p role="status" className="min-w-0 text-sm text-[color:var(--text-muted)]">
          {discarded ? "The draft was discarded. Nothing from it is left on this computer." : ""}
        </p>
      </div>
    </div>
  );
}

/**
 * A stage this task did not build.
 *
 * Ruling 52: an unbuilt destination is an unavailable control with a stated reason, never a dead
 * end — so the way back is a real control, not a promise.
 */
function UnbuiltStagePanel({
  stage,
  reason,
  onBack,
}: {
  stage: PlanWizardStage;
  reason: string;
  onBack: () => void;
}) {
  const definition = PLAN_WIZARD_STAGE_DEFINITIONS[stage];
  return (
    <section aria-label={definition.label} className={panelClass}>
      <ListEmptyState
        kind="no-data"
        heading={`${definition.label} is not built yet`}
        explanation={reason}
        action={
          <button type="button" onClick={onBack} className={secondaryControlClass}>
            <span className="truncate">Back</span>
          </button>
        }
      />
    </section>
  );
}

/**
 * Stage 1 — what this team is working from, and what the coordinator confirms.
 *
 * RULING [112], AND IT IS THE WHOLE SHAPE OF THIS STAGE. The approved mockup renders an identity
 * row (`patient.fullName · patient.id`) and a mobile-suitability row, both sourced "Imported
 * referral record". Neither is reproducible: `Referral` in `src/lib/caring-contacts/model.ts` is
 * exactly `id`, `teamId`, `patientId`, `state` and `pathwayVersionId`, and there is no patient name
 * and no mobile number on a referral anywhere in this domain. Those arrive in
 * `createPlanSchema.patientDetail`, typed by the clinician at stage 3.
 *
 * So this screen separates the two things the mockup blended, and labels each with where it came
 * from. An interface that presents a clinician's own tick as an imported record is lying about
 * provenance, on a screen whose entire purpose is assurance.
 *
 * THE CONFIRMATIONS ARE NOT RECORDED, AND THE SCREEN SAYS SO. There is no field for either of them
 * on a plan, so they live only in the draft, and the draft is not durable. That is reported rather
 * than papered over: see `docs/caring-contacts/phase-2b-sdd-archive/task-7-report.md`.
 */
function AgreementStage({
  referralId,
  patientId,
  teamId,
  actorId,
  actorRoles,
  assurances,
  onAssuranceChange,
  onContinue,
}: {
  referralId: string;
  patientId: string;
  teamId: string;
  actorId: string;
  actorRoles: readonly string[];
  assurances: { patientAgreed: boolean; mobileIsPatientControlled: boolean };
  onAssuranceChange: (change: Partial<{ patientAgreed: boolean; mobileIsPatientControlled: boolean }>) => void;
  onContinue: () => void;
}) {
  const complete = assurances.patientAgreed && assurances.mobileIsPatientControlled;
  return (
    <section aria-label="Agreement" className="flex min-w-0 flex-col gap-5">
      <div className={panelClass}>
        <h2 className={headingClass}>Read from the referral</h2>
        <p className={`mt-1 ${mutedTextClass}`}>
          Everything in this list was read from the referral record or from the session you are
          acting in. Nothing in it was typed on this screen.
        </p>
        <div className="mt-3 min-w-0">
          <SourcedFact
            icon={<IdCard aria-hidden="true" className="size-icon-md" />}
            label="Referral"
            value={referralId}
            source="Read from the referral record"
          />
          <SourcedFact
            icon={<IdCard aria-hidden="true" className="size-icon-md" />}
            label="Patient identifier"
            value={patientId}
            source="Read from the referral record. A referral carries no name and no mobile number; those are entered at personalisation."
          />
          <SourcedFact
            icon={<ShieldCheck aria-hidden="true" className="size-icon-md" />}
            label="Owning team"
            value={teamId}
            source="Read from the referral record, which this team accepted"
          />
          <SourcedFact
            icon={<UserRoundCheck aria-hidden="true" className="size-icon-md" />}
            label="Acting as"
            value={`${actorId} (${actorRoles.join(", ")})`}
            source="Read from the session you are signed in with, not from the referral"
          />
        </div>
      </div>

      <div className={panelClass}>
        <h2 className={headingClass}>Confirmed by you</h2>
        <p className={`mt-1 ${mutedTextClass}`}>
          These are your own confirmations, not imported facts, and the difference matters: nothing
          in this domain records either of them. They are held only while this sign-up is open, and
          the plan that is created carries no field for them.
        </p>
        <fieldset className="mt-3 min-w-0 border-0 p-0">
          <legend className="sr-only">Assurances you are confirming</legend>
          <label className="flex min-h-tap min-w-0 items-start gap-3 py-2">
            <input
              type="checkbox"
              checked={assurances.patientAgreed}
              onChange={(event) => onAssuranceChange({ patientAgreed: event.target.checked })}
              className="mt-1 size-5 shrink-0 accent-[color:var(--clinical-accent)]"
            />
            <span className={mutedTextClass}>
              The patient agreed to receive caring contacts. This is not consent to treatment and
              not a legal consent.
            </span>
          </label>
          <label className="flex min-h-tap min-w-0 items-start gap-3 py-2">
            <input
              type="checkbox"
              checked={assurances.mobileIsPatientControlled}
              onChange={(event) => onAssuranceChange({ mobileIsPatientControlled: event.target.checked })}
              className="mt-1 size-5 shrink-0 accent-[color:var(--clinical-accent)]"
            />
            <span className={mutedTextClass}>
              The mobile number this plan will use is the patient&rsquo;s own, and they are content
              to receive discreet text messages on it.
            </span>
          </label>
        </fieldset>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <p role="status" className={mutedTextClass}>
          {complete
            ? "Both confirmations are recorded for this sign-up. A pathway can be chosen."
            : "A pathway cannot be chosen until both confirmations above are ticked."}
        </p>
        <div className="flex min-w-0 flex-wrap gap-3">
          <button type="button" disabled={!complete} onClick={onContinue} className={primaryControlClass}>
            <ClipboardCheck aria-hidden="true" className="size-icon-md shrink-0" />
            <span className="truncate">Continue to pathway</span>
          </button>
        </div>
      </div>
    </section>
  );
}

/**
 * Stage 2 — which governed pathway version this plan runs.
 *
 * RULING [113]. `transitionReferral`'s `accept` action carries a `pathwayVersionId` and
 * `Referral.pathwayVersionId` holds it, so an accepted referral can already name a pathway, chosen
 * by whoever accepted it. This stage shows that as the existing decision and says where it came
 * from, rather than presenting an empty choice as though nothing had been decided — and choosing
 * something else reads as changing an earlier decision, because that is what it is. Spec §4.4
 * again: where something has already been decided, the surface stating it also states why and what
 * would change it.
 *
 * If the referral names none, this is an ordinary first choice and says nothing about a decision
 * that was never made.
 *
 * NO MESSAGE TEXT IS RENDERED HERE. Patient-visible copy is frozen and belongs to the sealed
 * domain's `message-copy`; the cadence wording below comes from the version's own frozen snapshot,
 * so nothing on this screen is a literal a screen author chose. The preview the mockup opens from
 * this stage is an overlay, and Task 11 owns this group's overlay wiring.
 */
function PathwayStage({
  options,
  chosen,
  referralPathwayVersionId,
  onChoose,
  onBack,
  onContinue,
}: {
  options: readonly PlanWizardPathwayOption[];
  chosen: string | null;
  referralPathwayVersionId: string | null;
  onChoose: (id: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const namedIsChoosable =
    referralPathwayVersionId !== null && options.some((option) => option.id === referralPathwayVersionId);
  const changedFromReferral =
    referralPathwayVersionId !== null && chosen !== null && chosen !== referralPathwayVersionId;

  return (
    <section aria-label="Pathway" className="flex min-w-0 flex-col gap-5">
      {referralPathwayVersionId === null ? null : namedIsChoosable ? (
        <StatedReason
          heading={changedFromReferral ? "You are changing an earlier decision" : "Already decided when the referral was accepted"}
          because={`Accepting this referral named ${referralPathwayVersionId} as the pathway to run, so the choice was made before this screen was opened. It travels on the referral record.`}
          changedBy={
            changedFromReferral
              ? `Choosing ${referralPathwayVersionId} again returns to what was decided when the referral was accepted.`
              : "Choosing a different version below changes what was decided when the referral was accepted."
          }
          icon={<FileCheck2 aria-hidden="true" className="size-icon-md shrink-0" />}
        />
      ) : (
        <StatedReason
          heading="The pathway named on the referral cannot be used"
          because={`Accepting this referral named ${referralPathwayVersionId}, and that version is not one this team can start a plan on now — a version that is still being written, still in review, or retired is not offered here.`}
          changedBy="Choosing one of the approved versions below replaces it. If none is listed, a version has to be approved before any plan can start."
          icon={<CircleAlert aria-hidden="true" className="size-icon-md shrink-0" />}
        />
      )}

      {options.length === 0 ? (
        <ListEmptyState
          kind="no-data"
          heading="No approved pathway yet"
          explanation="A plan can only run a pathway version that two different people have approved. Nothing this team may read has reached that point, so there is nothing to choose between here."
        />
      ) : (
        <div className={panelClass}>
          <fieldset className="min-w-0 border-0 p-0">
            <legend className={headingClass}>Choose a governed pathway version</legend>
            <p className={`mt-1 ${mutedTextClass}`}>
              Every version listed has been approved by two different people. Nothing here is ranked
              or recommended, and the order carries no meaning.
            </p>
            <div className="mt-3 min-w-0 rounded-[var(--radius-md)] border border-[color:var(--border)]">
              {options.map((option) => (
                <label key={option.id} className={optionClass}>
                  <input
                    type="radio"
                    name="caring-contacts-pathway-version"
                    value={option.id}
                    checked={chosen === option.id}
                    onChange={() => onChoose(option.id)}
                    className="mt-1 size-5 shrink-0 accent-[color:var(--clinical-accent)]"
                  />
                  <span className="min-w-0">
                    <span className="block break-words text-sm font-semibold text-[color:var(--text-heading)]">
                      {option.id}
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-[color:var(--text-muted)]">
                      {option.cadenceLabels.join(" · ")}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-[color:var(--text-muted)]">
                      Approved by {option.approvedByRoles.join(" and ")}
                      {option.publishedAt === null ? ", not yet published" : `, published ${option.publishedAt}`}
                      {option.id === referralPathwayVersionId ? ". Named on the referral." : ""}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      )}

      <div className="flex min-w-0 flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button type="button" onClick={onBack} className={secondaryControlClass}>
          <span className="truncate">Back to agreement</span>
        </button>
        <ForwardControl from="pathway" ready={chosen !== null} onContinue={onContinue} />
      </div>
    </section>
  );
}

/**
 * The control that moves to the next stage, or states that the next stage is not built.
 *
 * THE EXTENSION POINT, and the reason it is one control rather than two. Task 8 flips
 * `personalisation` to `built` in `stages.ts` and writes its body; this control then becomes a real
 * Continue with no edit here, because it asks the same table the stepper reads. A hand-written
 * "coming soon" button at each call site is the version of this that Task 8 could half-change.
 *
 * `UnavailableDestination` carries `aria-disabled` plus an inert handler rather than the native
 * `disabled` attribute, because `disabled` removes the tab stop and the stated reason could then
 * never be reached by keyboard. `ready` is a different thing entirely — a control awaiting validity
 * is TRANSIENTLY inert, which is what native `disabled` is for — and the two are never combined.
 */
function ForwardControl({
  from,
  ready,
  onContinue,
}: {
  from: PlanWizardStage;
  ready: boolean;
  onContinue: () => void;
}) {
  const next = nextPlanWizardStage(from);
  if (next === null) return null;
  const definition = PLAN_WIZARD_STAGE_DEFINITIONS[next];
  const implementation = planWizardStageImplementation(next);

  if (implementation.kind === "not-built") {
    return (
      <UnavailableDestination
        id={`plan-wizard-${next}`}
        label={definition.label}
        reason={implementation.reason}
        className={secondaryControlClass}
      />
    );
  }

  return (
    <button type="button" disabled={!ready} onClick={onContinue} className={primaryControlClass}>
      <span className="truncate">Continue to {definition.label.toLowerCase()}</span>
    </button>
  );
}
