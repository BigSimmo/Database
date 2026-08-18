"use client";

import {
  Ban,
  CalendarDays,
  CircleOff,
  ClipboardList,
  FileCheck2,
  Link2,
  PauseCircle,
  Search,
  ShieldAlert,
  UserRoundSearch,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Sheet } from "@/components/ui/sheet";

import { syntheticPlannedContacts } from "./fixtures";
import { OverlaySpecimens } from "./overlay-specimens";
import { DefinitionRow, OperationalStatus } from "./mockup-primitives";

const boundaryRecords = [
  {
    title: "Duplicate referral blocked",
    detail: "Link SYN-REFERRAL-003 to the active episode; a second active plan cannot be created.",
    status: "Link referral to active episode",
    icon: Link2,
  },
  {
    title: "Readmission pause",
    detail: "Future contacts pause from the source event. A later discharge needs a new linked referral.",
    status: "Paused by source event",
    icon: PauseCircle,
  },
  {
    title: "Recorded death — irreversible cancellation",
    detail: "All unsent contacts are cancelled. Correction is an incident; any future plan needs a new referral.",
    status: "Cancelled irreversibly",
    icon: CircleOff,
  },
  {
    title: "Wrong-recipient incident",
    detail: "Pause the entire pilot, preserve evidence and follow the joint incident restart authority.",
    status: "Pilot stop",
    icon: ShieldAlert,
  },
  {
    title: "Contact changed",
    detail: "Pause future contacts for coordinator review; never silently switch the destination.",
    status: "Review required",
    icon: Ban,
  },
] as const;

type ContactDetailState = "Scheduled" | "Processing" | "Sent" | "Delivered" | "Named exception";

const contactDetailStates: Record<
  ContactDetailState,
  { tone: "neutral" | "warning" | "info" | "success" | "danger"; detail: string; evidence: string }
> = {
  Scheduled: {
    tone: "neutral",
    detail: "Saturday 22 August 2026 at 10:00 am AWST. A coordinator may move it only within this scheduled day.",
    evidence: "No transport attempt exists. Date changes require a reason and team-lead approval.",
  },
  Processing: {
    tone: "warning",
    detail: "Provider-neutral processing began at 2:00:03 pm AWST. It is too late to change or cancel this contact.",
    evidence: "Await a signed transport event. Do not infer receipt, safety, wellbeing or response.",
  },
  Sent: {
    tone: "info",
    detail: "Accepted for transport at 2:00:08 pm AWST. Sent is not a delivery receipt.",
    evidence: "No resend occurs while status is uncertain. Retain event and webhook evidence.",
  },
  Delivered: {
    tone: "success",
    detail: "Transport receipt recorded at 2:00:14 pm AWST. Delivered means transport receipt only.",
    evidence: "It does not show that the message was read, helped, or reflected the patient’s state.",
  },
  "Named exception": {
    tone: "danger",
    detail: "Not delivered after three attempts in the original window. Future contacts are paused.",
    evidence: "Create a same-day operational task. No automatic clinical follow-up or late resend.",
  },
};

const perthDateFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Perth",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const planOfflineReason = "Unavailable while offline — reconnect before changing this plan.";
const planOfflineTransitionNotice =
  "Connectivity was lost. The open plan decision closed without recording a change. Reconnect to continue.";

function OfflinePlanDecisionReason({ offline }: { offline: boolean }) {
  return offline ? (
    <p
      id="caring-contact-plan-decision-offline-reason"
      className="mt-3 text-sm font-semibold text-[color:var(--warning)]"
    >
      {planOfflineReason}
    </p>
  ) : null;
}

function PlanAndContactDetail({ offline }: { offline: boolean }) {
  const [contactState, setContactState] = useState<ContactDetailState>("Scheduled");
  const [coordinator, setCoordinator] = useState("Alex Example");
  const [reassignmentOpen, setReassignmentOpen] = useState(false);
  const [reassignmentAuthenticated, setReassignmentAuthenticated] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [withdrawalOpen, setWithdrawalOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [compact, setCompact] = useState(true);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionRecorded, setCorrectionRecorded] = useState(false);
  const [actionNotice, setActionNotice] = useState("");
  const reassignmentRef = useRef<HTMLButtonElement>(null);
  const pauseRef = useRef<HTMLButtonElement>(null);
  const withdrawalRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const correctionRef = useRef<HTMLButtonElement>(null);
  const selectedContact = contactDetailStates[contactState];

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setCompact(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!offline) return;
    const closeDesktopWithdrawal = withdrawalOpen && !compact;
    if (!pauseOpen && !cancelOpen && !closeDesktopWithdrawal) return;
    setPauseOpen(false);
    setCancelOpen(false);
    if (closeDesktopWithdrawal) setWithdrawalOpen(false);
    setActionNotice(planOfflineTransitionNotice);
  }, [cancelOpen, compact, offline, pauseOpen, withdrawalOpen]);

  const offlineMutationProps = (reasonId = "caring-contact-plan-offline-reason") =>
    offline
      ? {
          "aria-disabled": true as const,
          "aria-describedby": reasonId,
          "data-mutates-state": "true",
          title: "Unavailable while offline — reconnect to continue",
        }
      : { "data-mutates-state": "true" };

  const commitPlanMutation = (mutation: () => void) => {
    if (offline) {
      setActionNotice(planOfflineTransitionNotice);
      return false;
    }
    mutation();
    return true;
  };

  return (
    <section
      className="space-y-[var(--gap-section)] rounded-[var(--radius-xl)] border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface-raised)] p-[var(--pad-panel)] shadow-[var(--rule-accent)]"
      data-testid="caring-contact-plan-contact-detail"
    >
      <div className="flex items-start gap-[var(--gap-inline)]">
        <FileCheck2 aria-hidden="true" className="mt-1 size-icon-lg shrink-0 text-[color:var(--clinical-accent)]" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[var(--tracking-eyebrow)] text-[color:var(--clinical-accent)]">
            Full detail compositions
          </p>
          <h3 className="mt-2 text-2xl font-semibold">Active plan and contact record</h3>
          <p className="mt-2 text-sm text-[color:var(--text-muted)]">
            Synthetic plan SYN-EPISODE-001 · complete identity, governance, schedule and audit context.
          </p>
        </div>
      </div>

      <div className="grid min-w-0 gap-[var(--gap-block)] lg:grid-cols-2">
        <section className="min-w-0 border-t border-[color:var(--border)] pt-[var(--gap-stack)]">
          <h4 className="text-lg font-semibold">Plan identity and ownership</h4>
          <dl className="mt-2 text-sm">
            <DefinitionRow term="Identity">Rowan Sample · SYN-PATIENT-002 · born 3 November 1987</DefinitionRow>
            <DefinitionRow term="Status">
              <OperationalStatus tone="success">Active</OperationalStatus>
            </DefinitionRow>
            <DefinitionRow term="Owning team">Example Aftercare Team</DefinitionRow>
            <DefinitionRow term="Coordinator">Coordinator: {coordinator}</DefinitionRow>
            <DefinitionRow term="Accepted handover">
              15 August 2026 at 9:35 am AWST · referring-team history retained
            </DefinitionRow>
          </dl>
        </section>
        <section className="min-w-0 border-t border-[color:var(--border)] pt-[var(--gap-stack)]">
          <h4 className="text-lg font-semibold">Frozen governed versions</h4>
          <dl className="mt-2 text-sm">
            <DefinitionRow term="Pathway">Example twelve-month pathway · SYN-v0.3 · locally approved</DefinitionRow>
            <DefinitionRow term="Template">Example first contact · SYN-copy-v1.0 · frozen snapshot</DefinitionRow>
            <DefinitionRow term="Sender">Example Aftercare Team · non-receiving sender</DefinitionRow>
            <DefinitionRow term="Segments">GSM-7 · 272 septets · 2 of 2 SMS segments</DefinitionRow>
          </dl>
        </section>
      </div>

      <section className="min-w-0 border-t border-[color:var(--border)] pt-[var(--gap-stack)]">
        <div className="flex items-start gap-2">
          <CalendarDays
            aria-hidden="true"
            className="mt-0.5 size-icon-md shrink-0 text-[color:var(--clinical-accent)]"
          />
          <div>
            <h4 className="text-lg font-semibold">Future schedule</h4>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              Original discharge-anchored calendar; pauses skip without catch-up.
            </p>
          </div>
        </div>
        <ol className="mt-[var(--gap-stack)] grid min-w-0 gap-2 md:grid-cols-3">
          {syntheticPlannedContacts.slice(1, 4).map((contact) => (
            <li
              key={contact.id}
              className="rounded-[var(--radius-md)] border border-[color:var(--border)] p-[var(--pad-card)] text-sm"
            >
              <span className="block font-semibold">{contact.cadenceLabel}</span>
              <time className="mt-1 block text-[color:var(--text-muted)]" dateTime={contact.scheduledAt}>
                {perthDateFormatter.format(new Date(contact.scheduledAt))}
              </time>
              <span className="mt-1 block text-[color:var(--text-muted)]">{contact.windowLabel}</span>
              <span className="mt-1 block text-[color:var(--text-muted)]">
                {contact.id} · {contact.transportState}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="min-w-0 border-t border-[color:var(--border)] pt-[var(--gap-stack)]">
        <div className="flex items-start gap-2">
          <ClipboardList
            aria-hidden="true"
            className="mt-0.5 size-icon-md shrink-0 text-[color:var(--clinical-accent)]"
          />
          <div>
            <h4 className="text-lg font-semibold">Audit history</h4>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              9:35 am · Taylor Fiction accepted referral · 9:42 am · Alex Example claimed coordination · frozen versions
              recorded.
            </p>
          </div>
        </div>
      </section>

      <section className="min-w-0 border-t border-[color:var(--border)] pt-[var(--gap-stack)]">
        <h4 className="text-lg font-semibold">Plan actions</h4>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            ref={reassignmentRef}
            variant="primary"
            {...offlineMutationProps()}
            onClick={() => {
              commitPlanMutation(() => {
                setReassignmentAuthenticated(false);
                setReassignmentOpen(true);
              });
            }}
          >
            Reassign plan
          </Button>
          <Button
            ref={pauseRef}
            variant="secondary"
            {...offlineMutationProps()}
            onClick={() => {
              commitPlanMutation(() => setPauseOpen(true));
            }}
          >
            Pause plan
          </Button>
          <Button
            ref={withdrawalRef}
            variant="secondary"
            {...offlineMutationProps()}
            onClick={() => {
              commitPlanMutation(() => setWithdrawalOpen(true));
            }}
          >
            Record withdrawal
          </Button>
          <Button
            ref={cancelRef}
            variant="secondary"
            {...offlineMutationProps()}
            onClick={() => {
              commitPlanMutation(() => setCancelOpen(true));
            }}
          >
            Cancel plan
          </Button>
        </div>
        {offline ? (
          <p id="caring-contact-plan-offline-reason" className="mt-2 text-sm font-medium text-[color:var(--warning)]">
            {planOfflineReason}
          </p>
        ) : null}
        {actionNotice ? (
          <p
            role="status"
            data-testid="plan-offline-transition-notice"
            className="mt-2 text-sm text-[color:var(--text-muted)]"
          >
            {actionNotice}
          </p>
        ) : null}
      </section>

      <section className="grid min-w-0 gap-[var(--gap-block)] lg:grid-cols-2">
        <div className="rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--surface-inset)] p-[var(--pad-card)]">
          <h4 className="font-semibold">Terminal plan — read only</h4>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            Withdrawn 4 September 2026 at 11:12 am AWST · unsent contacts cancelled · immutable history retained.
          </p>
          <Button
            variant="secondary"
            aria-disabled="true"
            onClick={(event) => event.preventDefault()}
            className="mt-3"
            title="Terminal plans are read only"
          >
            Edit terminal plan unavailable
          </Button>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] p-[var(--pad-card)]">
          <h4 className="font-semibold">Partial source data</h4>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            Patient-controlled and suitable-for-discreet-SMS evidence: Not supplied. Activation remains unavailable.
          </p>
          <p className="mt-2 text-sm font-medium">
            Remedy: referring team supplies the source flag; Callback does not infer it.
          </p>
        </div>
      </section>

      <section className="rounded-[var(--radius-lg)] border border-[color:var(--danger-border)] bg-[color:var(--surface-inset)] p-[var(--pad-card)]">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h4 className="font-semibold">Corrected-death governance</h4>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              Recorded death irreversibly cancelled unsent contacts. A correction is an incident, not an undo or
              reinstatement.
            </p>
          </div>
          <Button
            ref={correctionRef}
            variant="secondary"
            {...offlineMutationProps()}
            onClick={() => {
              commitPlanMutation(() => setCorrectionOpen(true));
            }}
          >
            Review correction governance
          </Button>
        </div>
        <p className="mt-2 text-sm font-medium">
          {correctionRecorded
            ? "Correction incident recorded in audit. Existing plan remains cancelled; any future plan requires a new referral and approved restart path."
            : "No correction incident recorded. Existing plan remains cancelled and read only."}
        </p>
      </section>

      <section className="min-w-0 border-t border-[color:var(--border)] pt-[var(--gap-stack)]">
        <h4 className="text-lg font-semibold">Contact detail</h4>
        <p className="mt-1 text-sm text-[color:var(--text-muted)]">
          General transport-state composition for contact SYN-CONTACT-02.
        </p>
        <div
          className="mt-[var(--gap-stack)] flex min-w-0 gap-2 overflow-x-auto pb-1"
          role="group"
          aria-label="Contact detail states"
        >
          {(Object.keys(contactDetailStates) as ContactDetailState[]).map((state) => (
            <button
              key={state}
              type="button"
              aria-pressed={contactState === state}
              onClick={() => setContactState(state)}
              className={`min-h-tap shrink-0 rounded-[var(--radius-md)] border px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] ${contactState === state ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]" : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]"}`}
            >
              {state}
            </button>
          ))}
        </div>
        <article className="mt-[var(--gap-stack)] rounded-[var(--radius-lg)] border border-[color:var(--border)] p-[var(--pad-card)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h5 className="font-semibold">Contact 2 of 10</h5>
            <OperationalStatus tone={selectedContact.tone}>{contactState}</OperationalStatus>
          </div>
          <p className="mt-2 text-sm text-[color:var(--text-muted)]">{selectedContact.detail}</p>
          <p className="mt-2 text-sm font-medium">{selectedContact.evidence}</p>
        </article>
      </section>

      <ConfirmDialog
        open={pauseOpen}
        onCancel={() => setPauseOpen(false)}
        onConfirm={() => {
          commitPlanMutation(() => {
            setActionNotice(
              "Pause decision recorded for this synthetic review; contacts inside the pause are skipped.",
            );
            setPauseOpen(false);
          });
        }}
        title="Pause caring-contact plan"
        description="Pause is reversible, but the original discharge-anchored calendar is never rebased. Contacts inside the pause are permanently skipped."
        confirmLabel="Pause future contacts"
        cancelLabel="Keep plan active"
        tone="danger"
      />

      <Sheet
        open={withdrawalOpen && compact}
        onClose={() => setWithdrawalOpen(false)}
        title="Record patient-requested withdrawal"
        description="Withdrawal immediately cancels every unsent contact and has no undo."
        returnFocusRef={withdrawalRef}
        mobilePlacement="fullscreen"
        testId="plan-withdrawal-fullscreen-stage"
        footer={
          <div className="flex justify-end">
            <Button
              variant="danger"
              {...offlineMutationProps("caring-contact-plan-decision-offline-reason")}
              onClick={() => {
                commitPlanMutation(() => {
                  setActionNotice(
                    "Fresh authentication requested; no withdrawal mutation was recorded by this prototype.",
                  );
                  setWithdrawalOpen(false);
                });
              }}
            >
              Continue to fresh authentication
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm text-[color:var(--text-muted)]">
          <p>Fresh authentication is required before mutation.</p>
          <p>After authentication, recheck identity and the patient-requested withdrawal source before recording it.</p>
          <p>The terminal record and immutable history remain visible; there is no undo control.</p>
          <OfflinePlanDecisionReason offline={offline} />
        </div>
      </Sheet>

      <ConfirmDialog
        open={withdrawalOpen && !compact}
        onCancel={() => setWithdrawalOpen(false)}
        onConfirm={() => {
          commitPlanMutation(() => {
            setActionNotice("Fresh authentication requested; no withdrawal mutation was recorded by this prototype.");
            setWithdrawalOpen(false);
          });
        }}
        title="Record patient-requested withdrawal"
        description="Fresh authentication is required before mutation. After authentication, recheck identity and the patient-requested withdrawal source. The terminal record has no undo."
        confirmLabel="Continue to fresh authentication"
        cancelLabel="Keep plan active"
        tone="danger"
      />

      <ConfirmDialog
        open={cancelOpen}
        onCancel={() => setCancelOpen(false)}
        onConfirm={() => {
          commitPlanMutation(() => {
            setActionNotice("Authorised cancellation decision recorded for this synthetic review.");
            setCancelOpen(false);
          });
        }}
        title="Cancel caring-contact plan"
        description="Cancel every future contact for the recorded authorised reason and preserve the complete immutable audit history."
        confirmLabel="Cancel future contacts"
        cancelLabel="Keep plan active"
        tone="danger"
      />

      <Sheet
        open={reassignmentOpen}
        onClose={() => setReassignmentOpen(false)}
        title="Reassign active plan"
        description="Change coordination ownership while retaining handover and audit history."
        returnFocusRef={reassignmentRef}
        mobilePlacement="fullscreen"
        footer={
          <div className="flex justify-end">
            <Button
              variant="primary"
              {...offlineMutationProps("caring-contact-plan-decision-offline-reason")}
              onClick={() => {
                commitPlanMutation(() => {
                  if (!reassignmentAuthenticated) {
                    setReassignmentAuthenticated(true);
                    return;
                  }
                  setCoordinator("Sam Sample");
                  setActionNotice("Reassignment recorded after fresh authentication in this synthetic workflow.");
                  setReassignmentOpen(false);
                });
              }}
            >
              {reassignmentAuthenticated
                ? "Confirm reassignment after fresh authentication"
                : "Continue to fresh authentication"}
            </Button>
          </div>
        }
      >
        <dl className="text-sm">
          <DefinitionRow term="Current coordinator">Alex Example</DefinitionRow>
          <DefinitionRow term="New coordinator">Sam Sample · team lead</DefinitionRow>
          <DefinitionRow term="Audit effect">Record actor, time, previous and new coordinator</DefinitionRow>
          <DefinitionRow term="Protected mutation">Fresh authentication is required before mutation</DefinitionRow>
          <DefinitionRow term="Clinical boundary">
            Assignment identifies coordination; it does not independently transfer duty of care
          </DefinitionRow>
        </dl>
        {reassignmentAuthenticated ? (
          <p className="mt-3 rounded-[var(--radius-md)] border border-[color:var(--success-border)] bg-[color:var(--success-soft)] p-3 text-sm font-semibold">
            Fresh authentication confirmed for this synthetic decision. Recheck the new coordinator before confirming.
          </p>
        ) : null}
        <OfflinePlanDecisionReason offline={offline} />
      </Sheet>

      <Sheet
        open={correctionOpen}
        onClose={() => setCorrectionOpen(false)}
        title="Recorded-death correction governance"
        description="A source correction is an incident and cannot reinstate the cancelled plan."
        returnFocusRef={correctionRef}
        mobilePlacement="fullscreen"
        footer={
          <div className="flex justify-end">
            <Button
              variant="danger"
              {...offlineMutationProps("caring-contact-plan-decision-offline-reason")}
              onClick={() => {
                commitPlanMutation(() => {
                  setCorrectionRecorded(true);
                  setCorrectionOpen(false);
                });
              }}
            >
              Record correction incident
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm text-[color:var(--text-muted)]">
          <p>Preserve the original source event, irreversible cancellation and every audit entry.</p>
          <p>Reconcile the correction through the incident lead, privacy/security owner and clinical programme lead.</p>
          <p>Any future caring-contact plan needs a new referral. There is no reinstate or undo control.</p>
          <OfflinePlanDecisionReason offline={offline} />
        </div>
      </Sheet>
    </section>
  );
}

export function PatientBoundaryScreens({ onBack }: { onBack: () => void }) {
  const [emptySearch, setEmptySearch] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const handleOffline = () => setOffline(true);
    const handleOnline = () => setOffline(false);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return (
    <section
      className="min-w-0 space-y-[var(--gap-section)] pb-24 md:pb-0"
      data-testid="caring-contact-patient-boundaries"
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-[var(--gap-stack)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[var(--tracking-eyebrow)] text-[color:var(--clinical-accent)]">
            Patient and episode boundaries
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight" data-caring-contact-stage-heading tabIndex={-1}>
            Boundary and lifecycle specimens
          </h2>
          <p className="mt-2 max-w-[var(--measure)] text-sm text-[color:var(--text-muted)]">
            Search is limited to the active pilot team’s referrals and Callback episodes. No shared Clinical KB search,
            recent-search or analytics path is used.
          </p>
        </div>
        <Button variant="secondary" onClick={onBack}>
          Return to activation workflow
        </Button>
      </div>

      <section className="min-w-0 rounded-[var(--radius-xl)] border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-[var(--pad-panel)]">
        <div className="flex items-start gap-[var(--gap-inline)]">
          <UserRoundSearch
            aria-hidden="true"
            className="mt-1 size-icon-lg shrink-0 text-[color:var(--clinical-accent)]"
          />
          <div>
            <h3 className="text-xl font-semibold">Pilot-team patient search</h3>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              Identity-forward results are followed by a separate assurance step.
            </p>
          </div>
        </div>
        <label className="mt-[var(--gap-block)] block text-sm font-medium" htmlFor="fictional-pilot-search">
          Search name, fictional identifier or date of birth
        </label>
        <div className="mt-2 flex min-w-0 gap-2">
          <span className="relative min-w-0 flex-1">
            <Search
              aria-hidden="true"
              className="absolute left-3 top-1/2 size-icon-md -translate-y-1/2 text-[color:var(--text-muted)]"
            />
            <input
              id="fictional-pilot-search"
              value={emptySearch ? "No-match example" : "Rowan"}
              readOnly
              className="min-h-tap w-full rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-inset)] pl-10 pr-3 text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            />
          </span>
          <Button variant="secondary" onClick={() => setEmptySearch((value) => !value)}>
            {emptySearch ? "Show result" : "Show empty"}
          </Button>
        </div>
        {emptySearch ? (
          <div className="mt-[var(--gap-stack)] rounded-[var(--radius-md)] border border-dashed border-[color:var(--border-strong)] p-[var(--pad-card)]">
            <h4 className="font-semibold">No pilot-team records found</h4>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              Check the fictional details or return to the referring service; do not broaden into global search.
            </p>
          </div>
        ) : (
          <article className="mt-[var(--gap-stack)] grid min-w-0 gap-2 border-t border-[color:var(--border)] pt-[var(--gap-stack)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <h4 className="font-semibold">Rowan Sample</h4>
              <p className="mt-1 break-words text-sm text-[color:var(--text-muted)]">
                SYN-PATIENT-002 · born 3 November 1987 · active pilot team
              </p>
            </div>
            <OperationalStatus tone="info">Identity assurance required</OperationalStatus>
          </article>
        )}
      </section>

      <section className="min-w-0 rounded-[var(--radius-xl)] border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-[var(--pad-panel)]">
        <h3 className="text-xl font-semibold">Boundary states</h3>
        <div className="mt-[var(--gap-block)] divide-y divide-[color:var(--border)]">
          {boundaryRecords.map(({ title, detail, status, icon: Icon }) => (
            <article
              key={title}
              className="grid min-w-0 gap-2 py-[var(--gap-stack)] first:pt-0 last:pb-0 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start"
            >
              <Icon
                aria-hidden="true"
                className="mt-0.5 size-icon-md text-[color:var(--warning)] forced-colors:text-[CanvasText]"
              />
              <div className="min-w-0">
                <h4 className="font-semibold">{title}</h4>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">{detail}</p>
              </div>
              <OperationalStatus tone="warning">{status}</OperationalStatus>
            </article>
          ))}
        </div>
      </section>

      <section className="grid min-w-0 gap-[var(--gap-block)] lg:grid-cols-2">
        <div className="rounded-[var(--radius-xl)] border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-[var(--pad-panel)]">
          <h3 className="text-lg font-semibold">Pause plan</h3>
          <p className="mt-2 text-sm text-[color:var(--text-muted)]">
            Reversible. Preserve the calendar, permanently skip contacts inside the pause and resume at the next future
            contact.
          </p>
        </div>
        <div className="rounded-[var(--radius-xl)] border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-[var(--pad-panel)]">
          <h3 className="text-lg font-semibold">Record withdrawal</h3>
          <p className="mt-2 text-sm text-[color:var(--text-muted)]">
            Patient preference. Immediately cancel unsent contacts; no approval is required and history is immutable.
          </p>
        </div>
        <div className="rounded-[var(--radius-xl)] border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-[var(--pad-panel)]">
          <h3 className="text-lg font-semibold">Cancel plan</h3>
          <p className="mt-2 text-sm text-[color:var(--text-muted)]">
            A distinct authorised operational action with a recorded reason and audit event.
          </p>
        </div>
        <div className="rounded-[var(--radius-xl)] border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-[var(--pad-panel)]">
          <h3 className="text-lg font-semibold">Plan and contact detail</h3>
          <p className="mt-2 text-sm text-[color:var(--text-muted)]">
            Open the complete plan, terminal, partial-data, corrected-death, reassignment and contact-state
            compositions.
          </p>
          <Button variant="primary" onClick={() => setDetailsOpen((open) => !open)} className="mt-3">
            {detailsOpen ? "Close full plan and contact detail" : "Open full plan and contact detail"}
          </Button>
        </div>
      </section>

      {detailsOpen ? <PlanAndContactDetail offline={offline} /> : null}

      <OverlaySpecimens offline={offline} onOfflineChange={setOffline} />
    </section>
  );
}
