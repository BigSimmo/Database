"use client";

import { ArrowLeft, ArrowRight, CalendarRange, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { syntheticPathways, syntheticPatients } from "./fixtures";
import { DefinitionRow, OperationalStatus } from "./mockup-primitives";
import { CompactMessagePreview, MessagePreview, PATIENT_VISIBLE_NO_REPLY_NOTICE } from "./personalisation-screen";

export function PathwaySelectionScreen({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  const patient = syntheticPatients[1];
  const pathway = syntheticPathways[0];

  return (
    <section className="min-w-0 pb-24 md:pb-0" data-testid="caring-contact-screen-pathway-selection">
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
          <p className="text-xs font-semibold uppercase tracking-[var(--tracking-eyebrow)] text-[color:var(--clinical-accent)]">
            Stage 2 of 4
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight" data-caring-contact-stage-heading tabIndex={-1}>
            Pathway selection
          </h2>
          <p className="mt-2 max-w-[var(--measure)] text-sm text-[color:var(--text-muted)]">
            Select a locally governed version without ranking or implying clinical effectiveness.
          </p>

          <article className="mt-[var(--gap-block)] rounded-[var(--radius-lg)] border-2 border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] p-[var(--pad-card)] forced-colors:border-[Highlight]">
            <div className="flex flex-wrap items-start justify-between gap-[var(--gap-stack)]">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <CalendarRange
                    aria-hidden="true"
                    className="size-icon-lg shrink-0 text-[color:var(--clinical-accent)]"
                  />
                  <h3 className="text-lg font-semibold">{pathway.name}</h3>
                </div>
                <p className="mt-2 text-sm text-[color:var(--text-muted)]">Version {pathway.version}</p>
              </div>
              <OperationalStatus tone="info">Selected</OperationalStatus>
            </div>
            <dl className="mt-[var(--gap-block)] text-sm">
              <DefinitionRow term="Governance">
                <span className="font-medium text-[color:var(--text)]">{pathway.governanceLabel}</span>
              </DefinitionRow>
              <DefinitionRow term="Duration">{pathway.duration} · 10 contacts</DefinitionRow>
              <DefinitionRow term="Cadence">Day 1, week 1, then months 1, 2, 3, 4, 6, 8, 10 and 12</DefinitionRow>
              <DefinitionRow term="Sender">{pathway.senderLabel} · neutral, non-receiving sender</DefinitionRow>
              <DefinitionRow term="Boundary">
                One-way caring contacts supplement usual care. {PATIENT_VISIBLE_NO_REPLY_NOTICE}.
              </DefinitionRow>
              <DefinitionRow term="Approval ownership">
                <span className="font-medium text-[color:var(--text)]">Two-person approval complete</span>
                <span className="mt-1 block">{pathway.approvalEvidence?.clinicalProgrammeLead}</span>
                <span className="mt-1 block">{pathway.approvalEvidence?.livedExperienceContentReviewer}</span>
              </DefinitionRow>
            </dl>
            <p className="mt-[var(--gap-stack)] flex items-start gap-2 text-sm font-medium">
              <CheckCircle2
                aria-hidden="true"
                className="mt-0.5 size-icon-md shrink-0 text-[color:var(--clinical-accent)] forced-colors:text-[CanvasText]"
              />
              Current fictional version selected; no “best” or recommended ranking is used.
            </p>
          </article>

          <div className="mt-[var(--gap-block)] flex flex-col-reverse gap-[var(--gap-inline)] sm:flex-row sm:justify-between">
            <Button variant="secondary" icon={ArrowLeft} onClick={onBack}>
              Back to patient and agreement
            </Button>
            <div className="flex flex-col gap-[var(--gap-inline)] sm:flex-row">
              <CompactMessagePreview stageName="Pathway selection" />
              <Button variant="primary" trailingIcon={ArrowRight} onClick={onContinue}>
                Continue to personalisation
              </Button>
            </div>
          </div>
        </div>

        <aside aria-label="Wide exact message preview" className="hidden min-w-0 lg:block">
          <MessagePreview />
        </aside>
      </div>
    </section>
  );
}
