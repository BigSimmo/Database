"use client";

import Link from "next/link";
import { useState } from "react";

import { useAccountData } from "@/components/account-data-provider";
import { AccountSetupDialog } from "@/components/clinical-dashboard/account-setup-dialog";
import { inPageAnchor } from "@/components/in-page-nav/in-page-nav-classes";
import { InformationPageHeader, InformationPageShell } from "@/components/information-page-shell";
import { OnCallContactsSection } from "@/components/on-call/on-call-contacts-section";
import { OnCallEntryEditor } from "@/components/on-call/on-call-entry-editor";
import {
  ON_CALL_SECTION_ICONS,
  ON_CALL_SECTION_TITLES,
  OnCallNavHeader,
} from "@/components/on-call/on-call-nav-header";
import { OnCallOfflineBanner } from "@/components/on-call/on-call-offline-banner";
import { EmptyState } from "@/components/primitive-recipes/feedback";
import { cn } from "@/components/ui-primitives";
import { cacheOnCallEntries, useOnCallEntries } from "@/lib/on-call/entry-store";
import { type OnCallEntry, type OnCallSection } from "@/lib/on-call/entry-model";

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
 * Contacts is the one section wired to real entries and the add/edit/delete
 * editor (task 11) — it is the section Task 9 built as the template, and the
 * only one the editor is reachable from today. The remaining five keep the
 * placeholder empty state below until they adopt the same wiring in a later
 * pass; nothing here stops that adoption from being a per-section addition.
 */
export function OnCallSectionPage({ section }: { section: OnCallSection }) {
  const { isAuthenticated } = useAccountData();
  const [signInOpen, setSignInOpen] = useState(false);
  const [editorState, setEditorState] = useState<{ open: boolean; entry: OnCallEntry | null }>({
    open: false,
    entry: null,
  });
  const title = ON_CALL_SECTION_TITLES[section];
  const Icon = ON_CALL_SECTION_ICONS[section];
  const isContacts = section === "contacts";

  // Hooks run unconditionally; only the contacts branch below actually reads
  // this. Harmless (and cheap — one fetch, then cache reads) for the other
  // five sections until they adopt it too.
  const { entries, isOffline, cachedAt } = useOnCallEntries();
  const contactEntries = entries.filter((entry) => entry.section === "contacts");

  function upsertCachedEntry(entry: OnCallEntry) {
    const next = entries.some((existing) => existing.id === entry.id)
      ? entries.map((existing) => (existing.id === entry.id ? entry : existing))
      : [...entries, entry];
    cacheOnCallEntries(next);
  }

  function removeCachedEntry(id: string) {
    cacheOnCallEntries(entries.filter((existing) => existing.id !== id));
  }

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
          {isContacts && isAuthenticated ? (
            <>
              {isOffline && cachedAt ? <OnCallOfflineBanner savedAt={cachedAt} /> : null}
              <OnCallContactsSection
                entries={contactEntries}
                onAddEntry={() => setEditorState({ open: true, entry: null })}
                onEditEntry={(entry) => setEditorState({ open: true, entry })}
                onVerified={upsertCachedEntry}
              />
            </>
          ) : isAuthenticated ? (
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
      {isContacts ? (
        <OnCallEntryEditor
          open={editorState.open}
          onClose={() => setEditorState({ open: false, entry: null })}
          section="contacts"
          entry={editorState.entry}
          onSaved={upsertCachedEntry}
          onDeleted={removeCachedEntry}
        />
      ) : null}
    </>
  );
}
