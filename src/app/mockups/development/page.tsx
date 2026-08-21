import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FlaskConical, ShieldAlert } from "lucide-react";

import { CARE_PLAN_ROUTES } from "@/components/care-plan/mockups/routes";
import { CARING_CONTACT_MOCKUP_ROUTES } from "@/components/caring-contacts/mockups/routes";

export const metadata: Metadata = {
  title: "Development · Clinical KB",
  description: "In-progress surfaces, reachable only to a signed-in developer account in a production deploy.",
};

// The index of what is being built. This page and the two prototypes it links
// to require a signed-in administrator account in production
// (`DeveloperAreaGate`, applied in the `development`, `caring-contacts` and
// `care-plan` layouts) — everywhere else /mockups/** stays 404'd, unchanged.
//
// Ward Flow is listed here as a convenience bookmark only: `/ward-management`
// is an already-merged, normal, publicly reachable route (see
// `src/lib/tools-catalog.ts`), not a mockup, and carries none of this page's
// gating.
const DEVELOPMENT_SURFACES = [
  {
    id: "care-plan",
    name: "Care Plan",
    summary:
      "Linked prototype of continuity planning for recurrent emergency presentations: the Management Plan and its versions, the patient edition, the Personal Safety Plan, the presentation timeline, and the review queues. Fully synthetic and memory-only — nothing is saved.",
    href: CARE_PLAN_ROUTES.home,
    status: "Synthetic prototype",
    entries: [
      { label: "Patients", href: CARE_PLAN_ROUTES.patients },
      { label: "Reviews", href: CARE_PLAN_ROUTES.reviews },
      { label: "Governance", href: CARE_PLAN_ROUTES.governance },
      { label: "System states", href: CARE_PLAN_ROUTES.systemStates },
    ],
  },
  {
    id: "caring-contacts",
    name: "Caring Contact",
    summary:
      "Linked prototype of the one-way caring-contacts coordination workflow: 13 routes, the activation flow, and the offline, permission, session-expiry, conflict and recovery states.",
    href: CARING_CONTACT_MOCKUP_ROUTES.today,
    status: "Synthetic prototype",
    entries: [
      { label: "Today", href: CARING_CONTACT_MOCKUP_ROUTES.today },
      { label: "Patients", href: CARING_CONTACT_MOCKUP_ROUTES.patients },
      { label: "Schedule", href: CARING_CONTACT_MOCKUP_ROUTES.schedule },
      { label: "Templates", href: CARING_CONTACT_MOCKUP_ROUTES.templates },
      { label: "System states", href: CARING_CONTACT_MOCKUP_ROUTES.systemStates },
    ],
  },
  {
    id: "ward-management",
    name: "Ward Flow",
    summary:
      "Coordinate synthetic psychiatry demand, bed capacity, referrals, and patient movement across WA: priority queue, ward capacity, explainable destination matches, and owned movement actions.",
    href: "/ward-management",
    status: "Live route",
    entries: [
      { label: "Queue", href: "/ward-management/queue" },
      { label: "Capacity", href: "/ward-management/capacity" },
      { label: "Transport", href: "/ward-management/transport" },
      { label: "Movements", href: "/ward-management/movements" },
    ],
  },
] as const;

export default function DevelopmentIndexPage() {
  return (
    <main className="mx-auto grid w-full max-w-[64rem] gap-6 px-4 py-8 sm:px-6" data-testid="development-index">
      <header className="grid gap-2">
        <p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-[color:var(--clinical-accent)]">
          <FlaskConical aria-hidden="true" className="size-icon-sm" />
          Development
        </p>
        <h1 className="text-2xl font-extrabold text-[color:var(--text-heading)] sm:text-3xl">In-progress surfaces</h1>
        <p className="max-w-3xl text-sm leading-6 text-[color:var(--text-muted)]">
          Work being built, reachable from Settings while it is in development. These routes are not part of the
          clinical product, and a production deploy 404s them unless it explicitly opts in.
        </p>
      </header>

      <p className="flex items-start gap-2 rounded-xl border border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)] px-4 py-3 text-sm leading-6 text-[color:var(--text)]">
        <ShieldAlert aria-hidden="true" className="mt-0.5 size-icon-sm shrink-0 text-[color:var(--warning)]" />
        <span>
          <strong className="font-extrabold text-[color:var(--text-heading)]">Synthetic data only.</strong> No patient,
          message, schedule or team record on these surfaces is real, and nothing here is validated clinical decision
          support.
        </span>
      </p>

      <ul className="grid gap-4">
        {DEVELOPMENT_SURFACES.map((surface) => (
          <li
            key={surface.id}
            className="grid gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow-inset)]"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="text-lg font-extrabold text-[color:var(--text-heading)]">{surface.name}</h2>
              <span className="rounded-full border border-[color:var(--border)] px-2 py-0.5 text-xs font-bold text-[color:var(--text-muted)]">
                {surface.status}
              </span>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-[color:var(--text-muted)]">{surface.summary}</p>

            <Link
              href={surface.href}
              className="inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-lg bg-[color:var(--command)] px-4 text-sm font-extrabold text-[color:var(--command-contrast)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:w-auto"
              data-testid={`development-open-${surface.id}`}
            >
              Open {surface.name} prototype
              <ArrowRight aria-hidden="true" className="size-icon-sm" />
            </Link>

            <div className="flex flex-wrap gap-2 border-t border-[color:var(--border)] pt-3">
              {surface.entries.map((entry) => (
                <Link
                  key={entry.href}
                  href={entry.href}
                  className="inline-flex min-h-tap items-center rounded-lg border border-[color:var(--border)] px-3 text-xs font-bold text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                >
                  {entry.label}
                </Link>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
