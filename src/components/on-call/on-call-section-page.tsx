"use client";

import { Plus } from "lucide-react";

import { useState } from "react";

import { useAccountData } from "@/components/account-data-provider";
import { AccountSetupDialog } from "@/components/clinical-dashboard/account-setup-dialog";
import { inPageAnchor } from "@/components/in-page-nav/in-page-nav-classes";
import { InformationPageHeader, InformationPageShell } from "@/components/information-page-shell";
import { OnCallContactsSection } from "@/components/on-call/on-call-contacts-section";
import { OnCallEducationSection } from "@/components/on-call/on-call-education-section";
import { OnCallLogisticsSection } from "@/components/on-call/on-call-logistics-section";
import { OnCallOrientationSection } from "@/components/on-call/on-call-orientation-section";
import { OnCallPlaybookSection } from "@/components/on-call/on-call-playbook-section";
import { OnCallReferralsSection } from "@/components/on-call/on-call-referrals-section";
import { OnCallEntryEditor } from "@/components/on-call/on-call-entry-editor";
import {
  ON_CALL_SECTION_ICONS,
  ON_CALL_SECTION_TITLES,
  OnCallNavHeader,
} from "@/components/on-call/on-call-nav-header";
import { OnCallOfflineBanner } from "@/components/on-call/on-call-offline-banner";
import { EmptyState } from "@/components/primitive-recipes/feedback";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui-primitives";
import { cacheOnCallEntries, useOnCallEntries } from "@/lib/on-call/entry-store";
import { useOnCallLinkedDocuments } from "@/lib/on-call/linked-documents";
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

/** What one entry in each section is called, for the add control's label. */
const ON_CALL_ADD_NOUN: Record<OnCallSection, string> = {
  contacts: "contact",
  playbook: "scenario",
  referrals: "service",
  orientation: "manual",
  education: "session",
  logistics: "note",
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
 * All six sections render their own entries through their own list component
 * and share one editor, which already carries per-section fields.
 *
 * They did not, briefly: only Contacts was wired, so the other five list
 * components were reachable from their tests and from nothing else, and five
 * of the mode's six pages said "no entries yet" no matter what the owner had
 * saved — including the Playbook, whose "no local guideline" safety state was
 * therefore unreachable. Adding a seventh section means adding one arm to
 * `renderSectionList` and one entry to the editor's field map, and nothing
 * else.
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
  const { entries, loading, isOffline, cachedAt } = useOnCallEntries();
  // Each list component filters `entries` to its own section itself, so the
  // page hands over the whole set rather than six near-identical slices.
  const sectionEntries = entries.filter((entry) => entry.section === section);
  // Only Playbook and Orientation display linked documents; the hook is cheap
  // and returns an empty map on any failure, so it runs unconditionally rather
  // than behind a section check that would break the rules of hooks.
  const linkedDocuments = useOnCallLinkedDocuments();

  function upsertCachedEntry(entry: OnCallEntry) {
    const next = entries.some((existing) => existing.id === entry.id)
      ? entries.map((existing) => (existing.id === entry.id ? entry : existing))
      : [...entries, entry];
    cacheOnCallEntries(next);
  }

  function removeCachedEntry(id: string) {
    cacheOnCallEntries(entries.filter((existing) => existing.id !== id));
  }

  const listProps = {
    entries: sectionEntries,
    onEditEntry: (entry: OnCallEntry) => setEditorState({ open: true, entry }),
    onVerified: upsertCachedEntry,
  };

  /**
   * The one place a section id becomes a list component. The switch has no
   * `default`, so `OnCallSection` gaining a seventh member is a compile error
   * here rather than a page that silently renders nothing — which is exactly
   * how five of these six went unmounted in the first place.
   */
  function renderSectionList() {
    switch (section) {
      case "contacts":
        return <OnCallContactsSection {...listProps} onAddEntry={() => setEditorState({ open: true, entry: null })} />;
      case "playbook":
        return <OnCallPlaybookSection {...listProps} documents={linkedDocuments} />;
      case "referrals":
        return <OnCallReferralsSection {...listProps} />;
      case "orientation":
        return <OnCallOrientationSection {...listProps} documents={linkedDocuments} />;
      case "education":
        return <OnCallEducationSection {...listProps} />;
      case "logistics":
        return <OnCallLogisticsSection {...listProps} />;
    }
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id={`on-call-${section}-entries-heading`} className="text-xl font-semibold">
              {title}
            </h2>
            {/* Contacts carries its own add button inside its list component
                (it also appears in that section's empty state). The other five
                get it here, because without one an owner can reach an empty
                Playbook or Logistics page with no way to put anything on it. */}
            {isAuthenticated && section !== "contacts" ? (
              <Button
                variant="secondary"
                size="sm"
                icon={Plus}
                onClick={() => setEditorState({ open: true, entry: null })}
                testId={`on-call-${section}-add`}
              >
                {`Add ${ON_CALL_ADD_NOUN[section]}`}
              </Button>
            ) : null}
          </div>
          {isAuthenticated ? (
            <>
              {isOffline && cachedAt ? <OnCallOfflineBanner savedAt={cachedAt} /> : null}
              {loading && sectionEntries.length === 0 ? (
                // Nothing cached and the first fetch still running. An empty
                // state here would assert the owner has no entries before
                // anything has been read.
                <EmptyState
                  icon={Icon}
                  title={`Loading your ${title.toLowerCase()}`}
                  body="Fetching the entries you have saved."
                  testId={`on-call-${section}-loading`}
                />
              ) : (
                renderSectionList()
              )}
            </>
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
      {/* One editor for every section: its field map is already keyed by
          section, so there is nothing per-section to add here. */}
      <OnCallEntryEditor
        open={editorState.open}
        onClose={() => setEditorState({ open: false, entry: null })}
        section={section}
        entry={editorState.entry}
        onSaved={upsertCachedEntry}
        onDeleted={removeCachedEntry}
      />
    </>
  );
}
