"use client";

import { ArrowRight, CalendarClock, CheckCircle2, Clock3, FileWarning, History } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { announce } from "@/components/ui/live-announcer";

import { syntheticAuditEvents, syntheticPatients, syntheticReferrals } from "./fixtures";
import { OperationalStatus } from "./mockup-primitives";

const sendingWindows = [
  { name: "Morning", label: "Morning 10:00 am AWST", count: "2 scheduled" },
  { name: "Afternoon", label: "Afternoon 2:00 pm AWST", count: "3 scheduled" },
  { name: "Early evening", label: "Early evening 5:00 pm AWST", count: "1 scheduled" },
] as const;

export function TodayScreen() {
  const pendingReferral = syntheticReferrals[0];
  const patient = syntheticPatients.find(({ id }) => id === pendingReferral.patientId)!;
  const auditEvent = syntheticAuditEvents[0];
  const [announcement, setAnnouncement] = useState("");

  function reviewFictionalReferral() {
    const outcome = "Fictional referral assurance selected for review.";
    setAnnouncement(outcome);
    announce(outcome, { eventId: "caring-contact:referral-review" });
  }

  return (
    <div className="space-y-[var(--gap-section)] pb-24 md:pb-0" data-testid="caring-contact-screen-today">
      <section className="min-w-0 rounded-[var(--radius-xl)] border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface-raised)] p-[var(--pad-panel)] shadow-[var(--rule-accent)]">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-[var(--gap-stack)]">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[var(--tracking-eyebrow)] text-[color:var(--clinical-accent)]">
              First actionable region
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">Referrals to review</h2>
            <p className="mt-2 max-w-[var(--measure)] text-sm text-[color:var(--text-muted)]">
              Ordered by time to the first eligible sending window after discharge, never by inferred patient state.
            </p>
          </div>
          <OperationalStatus tone="warning">1 awaiting review</OperationalStatus>
        </div>

        <article
          className="mt-[var(--gap-block)] grid min-w-0 gap-[var(--gap-stack)] border-t border-[color:var(--border)] pt-[var(--gap-block)] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
          data-testid={`pending-referral-${pendingReferral.id}`}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-[var(--gap-tight)]">
              <h3 className="text-lg font-semibold text-[color:var(--text)]">{patient.fullName}</h3>
              <OperationalStatus tone="warning">{pendingReferral.handoverState}</OperationalStatus>
            </div>
            <p className="mt-1 break-words text-sm text-[color:var(--text-muted)]">
              {patient.id} · discharged 15 Aug 2026 at 8:10 am · first eligible window 10:00 am AWST
            </p>
            <p className="mt-2 text-sm font-medium text-[color:var(--text)]">
              {pendingReferral.referringTeam} remains responsible until explicit acceptance.
            </p>
          </div>
          <Button variant="primary" trailingIcon={ArrowRight} onClick={reviewFictionalReferral}>
            Review fictional referral
          </Button>
        </article>
        {announcement ? (
          <p className="mt-[var(--gap-stack)] text-sm font-medium text-[color:var(--clinical-accent)]">
            {announcement}
          </p>
        ) : null}
      </section>

      <section className="min-w-0 rounded-[var(--radius-xl)] border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-[var(--pad-panel)]">
        <div className="flex flex-wrap items-start justify-between gap-[var(--gap-stack)]">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Needs action</h2>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              Observable operational conditions with a named remedy and owner.
            </p>
          </div>
          <FileWarning
            aria-hidden="true"
            className="size-icon-lg text-[color:var(--warning)] forced-colors:text-[CanvasText]"
          />
        </div>
        <article className="mt-[var(--gap-block)] min-w-0 border-t border-[color:var(--border)] pt-[var(--gap-block)]">
          <div className="flex flex-wrap items-center justify-between gap-[var(--gap-tight)]">
            <h3 className="font-semibold">Template approval owner not recorded</h3>
            <OperationalStatus tone="warning">Approval evidence missing</OperationalStatus>
          </div>
          <p className="mt-2 text-sm text-[color:var(--text-muted)]">
            Record the local approval owner before this template version can be selected.
          </p>
          <p className="mt-1 text-sm font-medium">Owner: Sam Sample, team lead</p>
        </article>
      </section>

      <section className="min-w-0 rounded-[var(--radius-xl)] border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-[var(--pad-panel)]">
        <div className="flex items-start gap-[var(--gap-inline)]">
          <CalendarClock
            aria-hidden="true"
            className="mt-1 size-icon-lg shrink-0 text-[color:var(--clinical-accent)]"
          />
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Today&apos;s sending windows</h2>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">Routine windows use Australia/Perth time.</p>
          </div>
        </div>
        <div className="mt-[var(--gap-block)] grid min-w-0 gap-[var(--gap-stack)] lg:grid-cols-3">
          {sendingWindows.map((window) => (
            <article
              key={window.name}
              className="min-w-0 border-t border-[color:var(--border)] pt-[var(--gap-stack)] lg:border-l lg:border-t-0 lg:pl-[var(--gap-stack)] lg:pt-0 first:lg:border-l-0 first:lg:pl-0"
            >
              <p className="text-xs font-semibold uppercase tracking-[var(--tracking-eyebrow)] text-[color:var(--text-muted)]">
                {window.name}
              </p>
              <p className="mt-2 break-words font-semibold tabular-nums">{window.label}</p>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">{window.count}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="min-w-0 rounded-[var(--radius-xl)] border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-[var(--pad-panel)]">
        <div className="flex items-start gap-[var(--gap-inline)]">
          <History aria-hidden="true" className="mt-1 size-icon-lg shrink-0 text-[color:var(--clinical-accent)]" />
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Recent activity</h2>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              Exact operational actions without message or clinical detail.
            </p>
          </div>
        </div>
        <div className="mt-[var(--gap-block)] flex min-w-0 items-start gap-[var(--gap-inline)] border-t border-[color:var(--border)] pt-[var(--gap-stack)]">
          <CheckCircle2
            aria-hidden="true"
            className="mt-0.5 size-icon-md shrink-0 text-[color:var(--success)] forced-colors:text-[CanvasText]"
          />
          <p className="min-w-0 text-sm">
            <span className="font-semibold">Rowan Sample</span> · {auditEvent.action} · Taylor Fiction · 9:35 am AWST
          </p>
        </div>
      </section>

      <section className="min-w-0 border-t border-[color:var(--border)] pt-[var(--gap-block)]">
        <div className="flex items-center gap-[var(--gap-inline)]">
          <Clock3 aria-hidden="true" className="size-icon-md text-[color:var(--text-muted)]" />
          <h2 className="text-base font-semibold">Quiet metrics</h2>
        </div>
        <dl className="mt-[var(--gap-stack)] grid min-w-0 gap-[var(--gap-inline)] sm:grid-cols-3">
          <div>
            <dt className="text-xs text-[color:var(--text-muted)]">Active fictional plans</dt>
            <dd className="mt-1 text-lg font-semibold">14</dd>
          </div>
          <div>
            <dt className="text-xs text-[color:var(--text-muted)]">Due today</dt>
            <dd className="mt-1 text-lg font-semibold">6</dd>
          </div>
          <div>
            <dt className="text-xs text-[color:var(--text-muted)]">Named exceptions</dt>
            <dd className="mt-1 text-lg font-semibold">1</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
