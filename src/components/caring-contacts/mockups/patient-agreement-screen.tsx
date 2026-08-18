"use client";

import { ArrowRight, CheckCircle2, ClipboardCheck, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

import { syntheticPatients, syntheticReferrals, syntheticTeamMembers } from "./fixtures";
import { DefinitionRow, OperationalStatus } from "./mockup-primitives";
import { CompactMessagePreview, MessagePreview } from "./personalisation-screen";

export function PatientAgreementScreen({ onContinue }: { onContinue: () => void }) {
  const patient = syntheticPatients[1];
  const referral = syntheticReferrals[1];
  const coordinator = syntheticTeamMembers[0];

  return (
    <section className="min-w-0 pb-24 md:pb-0" data-testid="caring-contact-screen-patient-agreement">
      <div className="mb-[var(--gap-block)] rounded-[var(--radius-lg)] border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] p-[var(--pad-card)] forced-colors:border-[CanvasText]">
        <p className="text-xs font-semibold uppercase tracking-[var(--tracking-eyebrow)] text-[color:var(--clinical-accent)]">
          Patient identity remains in flow
        </p>
        <p className="mt-1 break-words font-semibold">
          {patient.fullName} · {patient.id} · 3 Nov 1987
        </p>
      </div>

      <div className="grid min-w-0 gap-[var(--gap-block)] lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)]">
        <div className="min-w-0 rounded-[var(--radius-xl)] border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-[var(--pad-panel)]">
          <div className="flex flex-wrap items-start justify-between gap-[var(--gap-stack)]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[var(--tracking-eyebrow)] text-[color:var(--clinical-accent)]">
                Stage 1 of 4
              </p>
              <h2
                className="mt-2 text-2xl font-semibold tracking-tight"
                data-caring-contact-stage-heading
                tabIndex={-1}
              >
                Patient and agreement
              </h2>
              <p className="mt-2 max-w-[var(--measure)] text-sm text-[color:var(--text-muted)]">
                Repeat the imported identity, mobile suitability, agreement and explicit ownership before pathway
                selection.
              </p>
            </div>
            <OperationalStatus tone="success">All four assurances present</OperationalStatus>
          </div>

          <dl className="mt-[var(--gap-block)] text-sm">
            <DefinitionRow term="Identity source">
              {patient.fullName} · {patient.id} · imported referral {referral.id}
            </DefinitionRow>
            <DefinitionRow term="Mobile provenance">
              <span className="break-words">
                {patient.mobile} · Imported from {patient.mobileSource}
              </span>
            </DefinitionRow>
            <DefinitionRow term="Mobile suitability">
              <span className="inline-flex items-start gap-2">
                <CheckCircle2
                  aria-hidden="true"
                  className="mt-0.5 size-icon-md shrink-0 text-[color:var(--success)] forced-colors:text-[CanvasText]"
                />
                Patient-controlled and suitable for discreet SMS
              </span>
            </DefinitionRow>
            <DefinitionRow term="Agreement">
              <span className="font-medium text-[color:var(--text)]">Agreement confirmed: Yes</span> · imported source
              record, not legal or treatment consent
            </DefinitionRow>
            <DefinitionRow term="Ownership">
              <span className="font-medium text-[color:var(--text)]">Owning team: Example Aftercare Team</span> ·
              referral explicitly accepted
            </DefinitionRow>
            <DefinitionRow term="Coordination">
              <span className="font-medium text-[color:var(--text)]">Coordinator: {coordinator.displayName}</span> ·
              explicitly assigned
            </DefinitionRow>
          </dl>

          <div className="mt-[var(--gap-block)] rounded-[var(--radius-lg)] bg-[color:var(--surface-inset)] p-[var(--pad-card)]">
            <p className="flex items-start gap-2 font-semibold">
              <ShieldCheck
                aria-hidden="true"
                className="mt-0.5 size-icon-md shrink-0 text-[color:var(--clinical-accent)]"
              />
              Activation gate
            </p>
            <p className="mt-2 text-sm text-[color:var(--text-muted)]">
              Agreement, patient-controlled mobile, owning team and coordinator are present. Any missing assurance would
              name its remedy and block progression.
            </p>
          </div>

          <div className="mt-[var(--gap-block)] flex flex-col gap-[var(--gap-inline)] sm:flex-row sm:justify-end">
            <CompactMessagePreview stageName="Patient and agreement" />
            <Button variant="primary" trailingIcon={ArrowRight} onClick={onContinue}>
              Continue to pathway selection
            </Button>
          </div>
        </div>

        <aside aria-label="Wide exact message preview" className="hidden min-w-0 lg:block">
          <div className="mb-[var(--gap-stack)] flex items-center gap-2 text-sm font-medium text-[color:var(--text-muted)]">
            <ClipboardCheck aria-hidden="true" className="size-icon-md" /> Live assurance preview
          </div>
          <MessagePreview />
        </aside>
      </div>
    </section>
  );
}
