"use client";

import Link from "next/link";
import { useState } from "react";

import { useAccountData } from "@/components/account-data-provider";
import { AccountSetupDialog } from "@/components/clinical-dashboard/account-setup-dialog";
import { inPageAnchor } from "@/components/in-page-nav/in-page-nav-classes";
import { InformationPageHeader, InformationPageShell } from "@/components/information-page-shell";
import {
  ON_CALL_SECTION_ICONS,
  ON_CALL_SECTION_TITLES,
  OnCallNavHeader,
} from "@/components/on-call/on-call-nav-header";
import { EmptyState } from "@/components/primitive-recipes/feedback";
import { cn } from "@/components/ui-primitives";
import { type OnCallSection } from "@/lib/on-call/entry-model";

/**
 * Generic, non-owner-specific framing for each section. Shown regardless of
 * sign-in state — this is the "generic section name" half of the signed-out
 * contract (docs/superpowers/specs/2026-09-04-on-call-mode-design.md §2), never
 * the owner's own entries.
 */
const ON_CALL_SECTION_DESCRIPTIONS: Record<OnCallSection, string> = {
  contacts:
    "Filed by role first — an after-hours registrar, Ward 4B — so an entry survives a rotation rather than leaving with the person who held it.",
  playbook:
    "The escalation ladder as plain administrative fact. Clinical guidance appears only as a link to one of your own uploaded documents.",
  referrals:
    "Your own referral list: who a service accepts, exclusions, catchment, hours, how to refer, and the number to ring.",
  orientation: "Manuals held as documents in your corpus, each optionally carrying your own pinned summary above it.",
  education: "The teaching calendar — what, when, who is presenting, and a link to the recording once one exists.",
  logistics: "Parking, after-hours food, call rooms, IT, rostering, payroll and leave.",
};

const ON_CALL_SIGNED_OUT_BODY: Record<OnCallSection, string> = {
  contacts: "Sign in to see your on-call contacts.",
  playbook: "Sign in to see your escalation playbook.",
  referrals: "Sign in to see your referral list.",
  orientation: "Sign in to see your orientation manuals.",
  education: "Sign in to see your teaching calendar.",
  logistics: "Sign in to see your logistics notes.",
};

/**
 * The one module all six on-call section routes render, following
 * `src/components/sources/sources-pages.tsx`'s factoring: peer surfaces off one
 * shared shape, so six sections cannot drift into six divergent shells.
 *
 * Entries are not wired yet — a later task adds the client store that reads and
 * writes `on_call_entries`. Until then every section renders the same real
 * empty state: signed in shows a genuine next step (search across the hub),
 * signed out shows the section's generic name and a sign-in action, and
 * neither state can leak entry content that does not exist yet.
 */
export function OnCallSectionPage({ section }: { section: OnCallSection }) {
  const { isAuthenticated } = useAccountData();
  const [signInOpen, setSignInOpen] = useState(false);
  const title = ON_CALL_SECTION_TITLES[section];
  const Icon = ON_CALL_SECTION_ICONS[section];

  return (
    <>
      <OnCallNavHeader section={section} />
      <InformationPageShell testId={`on-call-${section}-main`}>
        <section
          id={`on-call-${section}-overview`}
          className={cn(inPageAnchor, "grid gap-2 border-b border-[color:var(--border)] pb-5")}
        >
          <InformationPageHeader
            eyebrow="On Call"
            title={title}
            subtitle={ON_CALL_SECTION_DESCRIPTIONS[section]}
            icon={Icon}
          />
        </section>

        <section
          id={`on-call-${section}-entries`}
          className={cn(inPageAnchor, "grid gap-3")}
          aria-labelledby={`on-call-${section}-entries-heading`}
        >
          <h2 id={`on-call-${section}-entries-heading`} className="text-xl font-semibold">
            {title}
          </h2>
          {isAuthenticated ? (
            <EmptyState
              icon={Icon}
              title={`No ${title.toLowerCase()} entries yet`}
              body="Entries you add will appear here. In the meantime, search across every On Call section."
              actions={
                <Link
                  href="/on-call/search"
                  className="inline-flex min-h-tap items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-sm font-bold text-[color:var(--clinical-accent)]"
                >
                  Search On Call
                </Link>
              }
              testId={`on-call-${section}-empty`}
            />
          ) : (
            <EmptyState
              icon={Icon}
              title={title}
              body={ON_CALL_SIGNED_OUT_BODY[section]}
              actions={
                <button
                  type="button"
                  onClick={() => setSignInOpen(true)}
                  className="inline-flex min-h-tap items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-sm font-bold text-[color:var(--clinical-accent)]"
                >
                  Sign in
                </button>
              }
              testId={`on-call-${section}-signed-out`}
            />
          )}
        </section>
      </InformationPageShell>
      <AccountSetupDialog open={signInOpen} onClose={() => setSignInOpen(false)} />
    </>
  );
}
