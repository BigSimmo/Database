"use client";

import { Plus } from "lucide-react";
import { usePathname } from "next/navigation";

import { useState } from "react";

import { useAccountData } from "@/components/account-data-provider";
import { inPageAnchor } from "@/components/in-page-nav/in-page-nav-classes";
import { InformationPageHeader, InformationPageShell } from "@/components/information-page-shell";
import { RegistryModeNav } from "@/components/mode-nav/registry-mode-nav";
import { OnCallContactsSection } from "@/components/on-call/on-call-contacts-section";
import { OnCallEducationSection } from "@/components/on-call/on-call-education-section";
import { OnCallLogisticsSection } from "@/components/on-call/on-call-logistics-section";
import { OnCallOrientationSection } from "@/components/on-call/on-call-orientation-section";
import { OnCallPlaybookSection } from "@/components/on-call/on-call-playbook-section";
import { OnCallReferralsSection } from "@/components/on-call/on-call-referrals-section";
import { OnCallWhoIsWhoSection } from "@/components/on-call/on-call-who-is-who-section";
import { OnCallEntryEditor } from "@/components/on-call/on-call-entry-editor";
import {
  ON_CALL_VIEW_ICONS,
  ON_CALL_VIEW_TITLES,
  onCallViewStorageSection,
  type OnCallPageView,
} from "@/components/on-call/on-call-section-identity";
import { OnCallOfflineBanner } from "@/components/on-call/on-call-offline-banner";
import { OnCallPageMenu } from "@/components/on-call/on-call-page-menu";
import { EmptyState } from "@/components/primitive-recipes/feedback";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui-primitives";
import { activeModeSecondaryNavigationId } from "@/lib/mode-secondary-navigation";
import { cacheOnCallEntries, useOnCallEntries } from "@/lib/on-call/entry-store";
import { useOnCallLinkedDocuments } from "@/lib/on-call/linked-documents";
import { type OnCallEntry } from "@/lib/on-call/entry-model";
import { partitionContactsEntries } from "@/lib/on-call/who-is-who";

/**
 * Generic, non-owner-specific framing for each view. Shown to every reader,
 * signed in or not, above the entries.
 */
const ON_CALL_VIEW_DESCRIPTIONS: Record<OnCallPageView, string> = {
  contacts:
    "Filed by role first — an after-hours registrar, Ward 4B — so an entry survives a rotation rather than leaving with the person who held it.",
  playbook:
    "The escalation ladder as plain administrative fact. Clinical guidance appears only as a link to one of your own uploaded documents.",
  referrals:
    "Your own referral list: who a service accepts, exclusions, catchment, hours, how to refer, and the number to ring.",
  orientation: "Manuals held as documents in your corpus, each optionally carrying your own pinned summary above it.",
  education: "The teaching calendar — what, when, who is presenting, and a link to the recording once one exists.",
  logistics: "Parking, after-hours food, call rooms, IT, rostering, payroll and leave.",
  "who-is-who":
    "What each role actually does, and when it is reasonable to call them. The ladder in words, and the acronyms this service uses.",
};

/** What one entry in each view is called, for the add control's label. */
const ON_CALL_ADD_NOUN: Record<OnCallPageView, string> = {
  contacts: "contact",
  playbook: "scenario",
  referrals: "service",
  orientation: "manual",
  education: "session",
  logistics: "note",
  "who-is-who": "role",
};

/**
 * The one module every On Call view route renders, following
 * `src/components/sources/sources-pages.tsx`'s factoring: peer surfaces off one
 * shared shape, so seven pages cannot drift into seven divergent shells.
 *
 * Navigation is the shared `ModeNav` rail, mounted here by the page rather than
 * by the shell. That is deliberate and is the fix for the reason On Call's
 * destinations were deleted once: every route in this mode is an
 * `isInformationPage`, so `PageSecondaryNavigation` returns null before it ever
 * reaches the mode branch and the shell can never draw this mode's bar. A page
 * that owns its own header navigation mounts it itself —
 * `differential-presentation-workflow-page.tsx` does exactly this with the same
 * component — and `hasLocalInformationPageNavigation` then guarantees the shell
 * adds no second bar. Being an information page is also what keeps the search
 * composer off these routes, so the two facts are the same fact.
 *
 * Reading needs no account. `fetchSharedOnCallEntries` has served every
 * non-personal entry to anonymous callers since the 2026-09-04 owner decision,
 * so the page renders the same list for a visitor as for the owner, minus the
 * owner's own personal entries, which the shared read never returns. What an
 * account still buys is writing: the add, edit and verify controls below are the
 * only things gated on `isAuthenticated`, because their routes require one.
 */
export function OnCallSectionPage({ view }: { view: OnCallPageView }) {
  const { isAuthenticated } = useAccountData();
  const pathname = usePathname();
  const [editorState, setEditorState] = useState<{ open: boolean; entry: OnCallEntry | null }>({
    open: false,
    entry: null,
  });
  const title = ON_CALL_VIEW_TITLES[view];
  const Icon = ON_CALL_VIEW_ICONS[view];
  const { entries, loading, isOffline, cachedAt } = useOnCallEntries();
  // Each list component filters `entries` itself — by section, and for the two
  // contacts-backed views by `details.kind` as well — so the page hands over the
  // whole set rather than seven near-identical slices.
  const sectionEntries = entries;
  // Only Playbook and Orientation display linked documents; the hook is cheap
  // and returns an empty map on any failure, so it runs unconditionally rather
  // than behind a check that would break the rules of hooks.
  const linkedDocuments = useOnCallLinkedDocuments();
  // What this page is showing, for the menu's one-line summary. Each list
  // component narrows `entries` itself, and Who's who splits the contacts
  // section in two, so the count is derived the same way rather than guessed
  // from the whole set.
  const visibleCount =
    view === "who-is-who"
      ? partitionContactsEntries(entries).roleExplainers.length
      : view === "contacts"
        ? partitionContactsEntries(entries).contacts.length
        : entries.filter((entry) => entry.section === view).length;

  function upsertCachedEntry(entry: OnCallEntry) {
    const next = entries.some((existing) => existing.id === entry.id)
      ? entries.map((existing) => (existing.id === entry.id ? entry : existing))
      : [...entries, entry];
    cacheOnCallEntries(next);
  }

  function removeCachedEntry(id: string) {
    cacheOnCallEntries(entries.filter((existing) => existing.id !== id));
  }

  // Reading is open to any visitor; writing is not. Each list component drops
  // its own edit and verify affordances when these are undefined, so a
  // signed-out reader is offered nothing the API would answer with a 401.
  const listProps = {
    entries: sectionEntries,
    onEditEntry: isAuthenticated ? (entry: OnCallEntry) => setEditorState({ open: true, entry }) : undefined,
    onVerified: isAuthenticated ? upsertCachedEntry : undefined,
  };

  /**
   * The one place a view id becomes a list component. The switch has no
   * `default`, so `OnCallPageView` gaining a member is a compile error here
   * rather than a page that silently renders nothing — which is exactly how five
   * of the six sections went unmounted in the first place.
   */
  function renderSectionList() {
    switch (view) {
      case "contacts":
        return (
          <OnCallContactsSection
            {...listProps}
            onAddEntry={isAuthenticated ? () => setEditorState({ open: true, entry: null }) : undefined}
          />
        );
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
      case "who-is-who":
        return <OnCallWhoIsWhoSection {...listProps} />;
    }
  }

  return (
    <>
      <RegistryModeNav modeId="on-call" activeId={activeModeSecondaryNavigationId("on-call", pathname)} />
      <OnCallPageMenu view={view} entryCount={visibleCount} />
      <InformationPageShell testId={`on-call-${view}-main`}>
        <section
          id={`on-call-${view}-overview`}
          className={cn(inPageAnchor, "grid gap-2 border-b border-[color:var(--border)] pb-5")}
        >
          <InformationPageHeader
            eyebrow="On Call"
            title={title}
            subtitle={ON_CALL_VIEW_DESCRIPTIONS[view]}
            icon={Icon}
          />
        </section>

        <section
          id={`on-call-${view}-entries`}
          className={cn(inPageAnchor, "grid gap-3")}
          aria-labelledby={`on-call-${view}-entries-heading`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id={`on-call-${view}-entries-heading`} className="text-xl font-semibold">
              {title}
            </h2>
            {/* Contacts carries its own add button inside its list component
                (it also appears in that section's empty state). The others get
                it here, because without one an owner can reach an empty
                Playbook or Logistics page with no way to put anything on it. */}
            {isAuthenticated && view !== "contacts" ? (
              <Button
                variant="secondary"
                size="sm"
                icon={Plus}
                onClick={() => setEditorState({ open: true, entry: null })}
                testId={`on-call-${view}-add`}
              >
                {`Add ${ON_CALL_ADD_NOUN[view]}`}
              </Button>
            ) : null}
          </div>
          {isOffline && cachedAt ? <OnCallOfflineBanner savedAt={cachedAt} /> : null}
          {loading && entries.length === 0 ? (
            // Nothing cached and the first fetch still running. An empty state
            // here would assert the section holds nothing before anything has
            // been read.
            <EmptyState
              icon={Icon}
              title={`Loading ${title.toLowerCase()}`}
              body="Fetching the entries saved to this section."
              testId={`on-call-${view}-loading`}
            />
          ) : (
            renderSectionList()
          )}
        </section>
      </InformationPageShell>
      {/* One editor for every view: its field map is already keyed by section.
          Who's who writes `contacts` rows, so it hands over the storage section
          rather than the view. */}
      <OnCallEntryEditor
        open={editorState.open}
        onClose={() => setEditorState({ open: false, entry: null })}
        section={onCallViewStorageSection(view)}
        entry={editorState.entry}
        onSaved={upsertCachedEntry}
        onDeleted={removeCachedEntry}
      />
    </>
  );
}
