"use client";

import { ArrowLeft, CalendarDays, ClipboardCheck, UserRoundCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

import { ContinuityThreadSpecimen } from "./continuity-thread-specimen";
import {
  ROWAN_SELECTED_SENDING_PREFERENCE,
  syntheticAuditEvents,
  syntheticEpisodes,
  syntheticPatients,
  syntheticReferrals,
} from "./fixtures";
import { DefinitionRow, OperationalStatus } from "./mockup-primitives";

export function PatientOverviewScreen({ onBack }: { onBack: () => void }) {
  const patient = syntheticPatients[1];
  const referral = syntheticReferrals[1];
  const episode = syntheticEpisodes[0];
  const auditEvent = syntheticAuditEvents[0];

  return (
    <section
      className="min-w-0 space-y-[var(--gap-section)] pb-24 md:pb-0"
      data-testid="caring-contact-screen-patient-overview"
    >
      <div className="min-w-0 rounded-[var(--radius-xl)] border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface-raised)] p-[var(--pad-panel)] shadow-[var(--rule-accent)]">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-[var(--gap-stack)]">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[var(--tracking-eyebrow)] text-[color:var(--clinical-accent)]">
              Fictional patient record
            </p>
            <h2
              className="mt-2 break-words text-2xl font-semibold tracking-tight"
              data-caring-contact-stage-heading
              tabIndex={-1}
            >
              Patient overview
            </h2>
            <p className="mt-2 break-words text-lg font-semibold">
              {patient.fullName} · {patient.id}
            </p>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              Date of birth 3 Nov 1987 · active fictional episode {episode.id}
            </p>
          </div>
          <OperationalStatus tone="success">Active plan</OperationalStatus>
        </div>
        <dl className="mt-[var(--gap-block)] text-sm">
          <DefinitionRow term="Owner">
            Example Aftercare Team · referral accepted from {referral.referringTeam}
          </DefinitionRow>
          <DefinitionRow term="Coordinator">Alex Example · explicitly assigned</DefinitionRow>
          <DefinitionRow term="Agreement">Agreement confirmed: Yes · imported source evidence</DefinitionRow>
          <DefinitionRow term="Mobile suitability">
            Patient-controlled and suitable for discreet SMS · imported from {patient.mobileSource}
          </DefinitionRow>
          <DefinitionRow term="Selected sending preference">
            {ROWAN_SELECTED_SENDING_PREFERENCE.windowLabel} · all 10 planned contacts
          </DefinitionRow>
        </dl>
        <div className="mt-[var(--gap-block)]">
          <Button variant="secondary" icon={ArrowLeft} onClick={onBack}>
            Back to review and activation
          </Button>
        </div>
      </div>

      <ContinuityThreadSpecimen />

      <section className="min-w-0 rounded-[var(--radius-xl)] border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-[var(--pad-panel)]">
        <div className="flex items-start gap-[var(--gap-inline)]">
          <CalendarDays aria-hidden="true" className="mt-1 size-icon-lg shrink-0 text-[color:var(--clinical-accent)]" />
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Chronology</h2>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              Ordered operational history; transport entries do not imply receipt, safety or wellbeing.
            </p>
          </div>
        </div>
        <ol
          aria-label="Patient episode chronology"
          className="mt-[var(--gap-block)] divide-y divide-[color:var(--border)]"
        >
          <li className="flex min-w-0 gap-[var(--gap-inline)] py-[var(--gap-stack)] first:pt-0">
            <UserRoundCheck
              aria-hidden="true"
              className="mt-0.5 size-icon-md shrink-0 text-[color:var(--clinical-accent)]"
            />
            <div className="min-w-0">
              <p className="font-semibold">Referral accepted</p>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                15 Aug 2026, 9:35 am AWST · {auditEvent.action} · Taylor Fiction
              </p>
            </div>
          </li>
          <li className="flex min-w-0 gap-[var(--gap-inline)] py-[var(--gap-stack)] last:pb-0">
            <ClipboardCheck
              aria-hidden="true"
              className="mt-0.5 size-icon-md shrink-0 text-[color:var(--clinical-accent)]"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">Transport receipt recorded</p>
                <OperationalStatus tone="success">Delivered</OperationalStatus>
              </div>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                15 Aug 2026, 10:00 am AWST · system event only; it does not show that the message was read.
              </p>
            </div>
          </li>
        </ol>
      </section>
    </section>
  );
}
