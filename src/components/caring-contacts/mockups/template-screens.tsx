import { CheckCircle2, Clock3, FileText, History, Users } from "lucide-react";

import { syntheticTemplates } from "./fixtures";
import { DefinitionRow, OperationalStatus } from "./mockup-primitives";
import { PATIENT_VISIBLE_NO_REPLY_NOTICE } from "./personalisation-screen";

const retiredTemplate = {
  ...syntheticTemplates[0],
  id: "SYN-TEMPLATE-RETIRED",
  name: "Example retired first contact",
  version: "SYN-copy-v0.9-retired",
  lifecycle: "Retired" as const,
};

export function TemplateScreens() {
  const current = syntheticTemplates[0];
  const pending = syntheticTemplates[1];

  return (
    <section
      className="min-w-0 space-y-[var(--gap-section)] pb-24 md:pb-0"
      data-testid="caring-contact-template-screens"
    >
      <div className="flex items-start gap-[var(--gap-inline)]">
        <FileText aria-hidden="true" className="mt-1 size-icon-lg shrink-0 text-[color:var(--clinical-accent)]" />
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Governed templates and pathways</h2>
          <p className="mt-2 max-w-[var(--measure)] text-sm text-[color:var(--text-muted)]">
            Approved substitutions and variants only. There is no free text, generated authoring or dynamic translation.
          </p>
        </div>
      </div>

      <div className="grid min-w-0 gap-[var(--gap-block)] lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.2fr)]">
        <section className="rounded-[var(--radius-xl)] border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-[var(--pad-panel)]">
          <h3 className="text-xl font-semibold">Version library</h3>
          <div className="mt-[var(--gap-block)] divide-y divide-[color:var(--border)]">
            {[
              { template: current, label: "Current", tone: "success" as const },
              { template: pending, label: "Approval pending", tone: "warning" as const },
              { template: retiredTemplate, label: "Retired", tone: "neutral" as const },
            ].map(({ template, label, tone }) => (
              <article key={template.id} className="py-[var(--gap-stack)] first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-semibold">{template.name}</h4>
                  <OperationalStatus tone={tone}>{label}</OperationalStatus>
                </div>
                <p className="mt-1 break-words text-sm text-[color:var(--text-muted)]">
                  {template.version} · {template.variant} · {template.segmentCount} of 2 SMS segments ·{" "}
                  {template.encoding}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[var(--radius-xl)] border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface-raised)] p-[var(--pad-panel)] shadow-[var(--rule-accent)]">
          <div className="flex flex-wrap items-start justify-between gap-[var(--gap-stack)]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[var(--tracking-eyebrow)] text-[color:var(--clinical-accent)]">
                Template detail
              </p>
              <h3 className="mt-2 text-xl font-semibold">{current.name}</h3>
            </div>
            <OperationalStatus tone="success">Locally approved</OperationalStatus>
          </div>
          <dl className="mt-[var(--gap-block)] text-sm">
            <DefinitionRow term="Version">{current.version}</DefinitionRow>
            <DefinitionRow term="Sender">Example Aftercare Team · non-receiving sender</DefinitionRow>
            <DefinitionRow term="Patient-visible boundary">{PATIENT_VISIBLE_NO_REPLY_NOTICE}</DefinitionRow>
            <DefinitionRow term="Encoding evidence">
              {current.segmentCount} of 2 SMS segments · {current.encoding}
            </DefinitionRow>
          </dl>
          <div className="mt-[var(--gap-block)] border-t border-[color:var(--border)] pt-[var(--gap-stack)]">
            <div className="flex items-start gap-2">
              <Users aria-hidden="true" className="mt-0.5 size-icon-md shrink-0 text-[color:var(--clinical-accent)]" />
              <div>
                <h4 className="font-semibold">Two-person approval</h4>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                  Clinical programme lead and lived-experience/content reviewer are separate named approvers.
                </p>
              </div>
            </div>
            <ul className="mt-[var(--gap-stack)] space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <CheckCircle2 aria-hidden="true" className="mt-0.5 size-icon-md shrink-0 text-[color:var(--success)]" />
                {current.approvalEvidence?.clinicalProgrammeLead}
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 aria-hidden="true" className="mt-0.5 size-icon-md shrink-0 text-[color:var(--success)]" />
                {current.approvalEvidence?.livedExperienceContentReviewer}
              </li>
            </ul>
          </div>
        </section>
      </div>

      <section className="grid min-w-0 gap-[var(--gap-block)] md:grid-cols-2">
        <div className="rounded-[var(--radius-xl)] border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-[var(--pad-panel)]">
          <div className="flex items-start gap-2">
            <Clock3 aria-hidden="true" className="mt-0.5 size-icon-md shrink-0 text-[color:var(--warning)]" />
            <h3 className="font-semibold">Pending version cannot activate</h3>
          </div>
          <p className="mt-2 text-sm text-[color:var(--text-muted)]">
            Remedy: complete both approvals, freeze the exact content snapshot and select the newly approved version.
          </p>
        </div>
        <div className="rounded-[var(--radius-xl)] border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-[var(--pad-panel)]">
          <div className="flex items-start gap-2">
            <History aria-hidden="true" className="mt-0.5 size-icon-md shrink-0 text-[color:var(--text-muted)]" />
            <h3 className="font-semibold">Retired versions remain readable</h3>
          </div>
          <p className="mt-2 text-sm text-[color:var(--text-muted)]">
            Existing audit history keeps the frozen snapshot. New plans must use a current locally approved version.
          </p>
        </div>
      </section>
    </section>
  );
}
