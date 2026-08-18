"use client";

import { BarChart3, BookOpen, ClockAlert, ShieldCheck, Users } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";

import { ComponentStateSpecimens } from "./component-state-specimens";
import { syntheticTeamMembers } from "./fixtures";
import { DefinitionRow, OperationalStatus } from "./mockup-primitives";
import { PATIENT_VISIBLE_NO_REPLY_NOTICE } from "./personalisation-screen";

export function TeamScreen() {
  return (
    <section className="min-w-0 space-y-[var(--gap-section)] pb-24 md:pb-0" data-testid="caring-contact-team-screen">
      <div className="flex items-start gap-[var(--gap-inline)]">
        <Users aria-hidden="true" className="mt-1 size-icon-lg shrink-0 text-[color:var(--clinical-accent)]" />
        <div>
          <h2 className="text-2xl font-semibold">Team ownership and coverage</h2>
          <p className="mt-2 max-w-[var(--measure)] text-sm text-[color:var(--text-muted)]">
            Assignment identifies coordination. It does not erase handover history or independently transfer duty of
            care.
          </p>
        </div>
      </div>
      <div className="grid min-w-0 gap-[var(--gap-block)] lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <section className="rounded-[var(--radius-xl)] border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-[var(--pad-panel)]">
          <h3 className="text-xl font-semibold">Example Aftercare Team</h3>
          <ul className="mt-[var(--gap-block)] divide-y divide-[color:var(--border)]">
            {syntheticTeamMembers.map((member) => (
              <li
                key={member.id}
                className="grid min-w-0 gap-1 py-[var(--gap-stack)] first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto]"
              >
                <span className="font-semibold">{member.displayName}</span>
                <span className="text-sm text-[color:var(--text-muted)]">
                  {member.role} · {member.id}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-[var(--radius-xl)] border border-[color:var(--warning-border)] bg-[color:var(--surface-raised)] p-[var(--pad-panel)] shadow-[var(--rule-warning)]">
          <div className="flex items-start gap-2">
            <ClockAlert aria-hidden="true" className="mt-0.5 size-icon-md shrink-0 text-[color:var(--warning)]" />
            <div>
              <h3 className="font-semibold">Unclaimed work escalation</h3>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                A referral accepted but unclaimed for 60 minutes escalates to the team lead. External alert text
                contains no patient information.
              </p>
            </div>
          </div>
          <p className="mt-[var(--gap-stack)] text-sm font-medium">
            Alert: “Accepted referral remains unclaimed. Open Callback.”
          </p>
        </section>
      </div>
    </section>
  );
}

export function GuidanceScreen() {
  return (
    <section
      className="min-w-0 space-y-[var(--gap-section)] pb-24 md:pb-0"
      data-testid="caring-contact-guidance-screen"
    >
      <div className="flex items-start gap-[var(--gap-inline)]">
        <BookOpen aria-hidden="true" className="mt-1 size-icon-lg shrink-0 text-[color:var(--clinical-accent)]" />
        <div>
          <h2 className="text-2xl font-semibold">Guidance and help</h2>
          <p className="mt-2 max-w-[var(--measure)] text-sm text-[color:var(--text-muted)]">
            Concise operational guidance keeps service boundaries available at the point of work.
          </p>
        </div>
      </div>
      <div className="grid min-w-0 gap-[var(--gap-block)] lg:grid-cols-2">
        <section className="rounded-[var(--radius-xl)] border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-[var(--pad-panel)]">
          <h3 className="text-xl font-semibold">One-way programme boundary</h3>
          <ul className="mt-[var(--gap-stack)] list-disc space-y-2 pl-[var(--gap-block)] text-sm text-[color:var(--text-muted)] marker:text-[color:var(--clinical-accent)]">
            <li>Caring contacts supplement usual care and person-to-person follow-up.</li>
            <li>{PATIENT_VISIBLE_NO_REPLY_NOTICE}.</li>
            <li>Delivered is a transport receipt only; it does not prove the message was read.</li>
            <li>Timing changes, pause and withdrawal use the staffed programme phone.</li>
          </ul>
        </section>
        <section className="rounded-[var(--radius-xl)] border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-[var(--pad-panel)]">
          <h3 className="text-xl font-semibold">Incident and downtime help</h3>
          <ul className="mt-[var(--gap-stack)] list-disc space-y-2 pl-[var(--gap-block)] text-sm text-[color:var(--text-muted)] marker:text-[color:var(--warning)]">
            <li>
              Wrong recipient, duplicate send, unauthorised content or lost audit integrity pauses the entire pilot.
            </li>
            <li>Restart needs joint incident, privacy/security and clinical programme approval.</li>
            <li>Offline operation fails closed with no patient cache, activation or uncertain resend.</li>
          </ul>
        </section>
      </div>
    </section>
  );
}

export function ReportsScreen() {
  const [statesOpen, setStatesOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <section className="min-w-0 space-y-[var(--gap-section)] pb-24 md:pb-0" data-testid="caring-contact-reports-screen">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-[var(--gap-stack)]">
        <div className="flex items-start gap-[var(--gap-inline)]">
          <BarChart3 aria-hidden="true" className="mt-1 size-icon-lg shrink-0 text-[color:var(--clinical-accent)]" />
          <div>
            <h2 className="text-2xl font-semibold">Operational reporting</h2>
            <p className="mt-2 max-w-[var(--measure)] text-sm text-[color:var(--text-muted)]">
              Aggregates support safety, reliability and usability review. They do not rank clinicians or claim
              effectiveness.
            </p>
          </div>
        </div>
        <Button ref={triggerRef} variant="primary" onClick={() => setStatesOpen(true)}>
          Open component and state specimens
        </Button>
      </div>
      <section className="rounded-[var(--radius-xl)] border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-[var(--pad-panel)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xl font-semibold">Pilot operations snapshot</h3>
          <OperationalStatus tone="neutral">Synthetic aggregates</OperationalStatus>
        </div>
        <dl className="mt-[var(--gap-block)] text-sm">
          <DefinitionRow term="Due and dispatched">14 due · 13 dispatched</DefinitionRow>
          <DefinitionRow term="Permanent transport failures">1 named exception</DefinitionRow>
          <DefinitionRow term="Resolution time">Median 38 minutes</DefinitionRow>
          <DefinitionRow term="Approved demographic cell">
            <span className="inline-flex items-center gap-2 font-semibold">
              <ShieldCheck aria-hidden="true" className="size-icon-md shrink-0" /> Suppressed
            </span>
          </DefinitionRow>
        </dl>
        <p className="mt-[var(--gap-stack)] text-sm text-[color:var(--text-muted)]">
          Small cells always render as “Suppressed”, never zero. The threshold is owned by governance and analytics and
          is not invented in this design.
        </p>
      </section>

      <Sheet
        open={statesOpen}
        onClose={() => setStatesOpen(false)}
        title="Component and state specimens"
        description="Reusable interaction, content, system and accessibility states."
        closeLabel="Close component and state specimens"
        returnFocusRef={triggerRef}
        mobilePlacement="fullscreen"
        contentClassName="lg:!max-w-6xl"
      >
        <ComponentStateSpecimens />
      </Sheet>
    </section>
  );
}
