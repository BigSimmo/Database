"use client";

import Link from "next/link";
import { useState } from "react";
import { Phone } from "lucide-react";

import { useAccountData } from "@/components/account-data-provider";
import { AccountSetupDialog } from "@/components/clinical-dashboard/account-setup-dialog";
import { InformationPageHeader, InformationPageShell } from "@/components/information-page-shell";
import { ON_CALL_SECTION_TITLES, OnCallCardNavHeader } from "@/components/on-call/on-call-nav-header";
import { OnCallOfflineBanner } from "@/components/on-call/on-call-offline-banner";
import { EmptyState } from "@/components/primitive-recipes/feedback";
import { PrintOutput, PrintSection } from "@/components/ui/print-output";
import { selectCardEntries } from "@/lib/on-call/card-selection";
import { useOnCallEntries } from "@/lib/on-call/entry-store";
import { ON_CALL_SECTIONS, type OnCallEntry } from "@/lib/on-call/entry-model";

/**
 * Numbers a card entry might carry, read loosely across every section's
 * `details` shape rather than one per-section schema. The card exists to be
 * carried, not to reproduce each section's own layout, so any entry — a
 * contact, a referral service, a logistics line — surfaces whichever of these
 * fields it has.
 */
const CARD_NUMBER_FIELDS: ReadonlyArray<{ label: string; key: string }> = [
  { label: "Direct", key: "phone" },
  { label: "After hours", key: "afterHoursPhone" },
  { label: "Pager", key: "pager" },
  { label: "Fax", key: "fax" },
];

function cardEntryNumbers(details: unknown): Array<{ label: string; value: string }> {
  if (typeof details !== "object" || details === null) return [];
  const record = details as Record<string, unknown>;
  return CARD_NUMBER_FIELDS.flatMap(({ label, key }) => {
    const value = record[key];
    return typeof value === "string" && value.trim().length > 0 ? [{ label, value }] : [];
  });
}

function telHref(raw: string): string | undefined {
  const compact = raw.replace(/[^\d+]/g, "");
  return compact.length > 0 ? `tel:${compact}` : undefined;
}

function sortCardEntries(entries: OnCallEntry[]): OnCallEntry[] {
  return [...entries].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
}

/**
 * Formats the moment printed as a caller-supplied string: `PrintOutput`
 * deliberately reads no clock of its own (see its own docs), so this page —
 * which is live data, not a deterministic prototype — reads the clock itself,
 * once, at render time.
 */
function formatPrintedAt(now: Date): string {
  const formatted = new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Australia/Perth",
    timeZoneName: "short",
  }).format(now);
  return `Printed ${formatted}`;
}

/**
 * The printable essentials card (Task 13): a one-page, print-styled summary
 * of whichever entries an owner has explicitly flagged `includeOnCard` —
 * "the thing a junior doctor actually carries in a lanyard pocket." Selection
 * runs through `selectCardEntries`, so a personal number or a number nobody
 * has confirmed in over a year can never reach the page regardless of the
 * flag (`src/lib/on-call/card-selection.ts`).
 *
 * The print action lives in the header's actions sheet, following
 * `DictionaryTermPage`'s "Print entry" row — the one place every converted
 * information page keeps its print control. The header itself is
 * `OnCallCardNavHeader`, in the mode's `*-nav-header.tsx` sibling: that file
 * is where this mode registers its claim on the phone header's addon slot,
 * and `tests/mode-nav-addon-slot.dom.test.tsx` holds it to one claimant.
 */
export function OnCallCard({ now = new Date() }: { now?: Date } = {}) {
  const { isAuthenticated } = useAccountData();
  const [signInOpen, setSignInOpen] = useState(false);
  const { entries, isOffline, cachedAt } = useOnCallEntries();

  const cardEntries = selectCardEntries(entries, now);
  const groups = ON_CALL_SECTIONS.map((section) => ({
    section,
    entries: sortCardEntries(cardEntries.filter((entry) => entry.section === section)),
  })).filter((group) => group.entries.length > 0);

  return (
    <>
      <OnCallCardNavHeader />
      <InformationPageShell testId="on-call-card-main" width="narrow">
        <InformationPageHeader
          eyebrow="On Call"
          title="Essentials card"
          subtitle="Only entries flagged for the card, with personal numbers and anything overdue for checking left off. Confirm against the live On Call sections before relying on a printed copy."
        />

        {isOffline && cachedAt ? <OnCallOfflineBanner savedAt={cachedAt} /> : null}

        {!isAuthenticated ? (
          <EmptyState
            icon={Phone}
            title="Essentials card"
            body="Sign in to see the numbers flagged for your card."
            actions={
              <button
                type="button"
                onClick={() => setSignInOpen(true)}
                className="inline-flex min-h-tap items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-sm font-bold text-[color:var(--clinical-accent)]"
              >
                Sign in
              </button>
            }
            testId="on-call-card-signed-out"
          />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={Phone}
            title="Nothing is flagged for the card yet"
            body="Open a contact, playbook step, referral, or logistics entry and flag it for the card to have it appear here. Personal numbers and anything overdue for checking are never included."
            actions={
              <Link
                href="/on-call/contacts"
                className="inline-flex min-h-tap items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-sm font-bold text-[color:var(--clinical-accent)]"
              >
                Go to contacts
              </Link>
            }
            testId="on-call-card-empty"
          />
        ) : (
          <PrintOutput
            testId="on-call-card-output"
            monochrome
            confidential
            printedAt={formatPrintedAt(now)}
            provenance="PsychSift On Call — essentials card. Confirm against the live app before relying on a printed copy; paper cannot show its own age."
          >
            <div className="grid gap-5">
              {groups.map((group) => (
                <PrintSection
                  key={group.section}
                  testId={`on-call-card-group-${group.section}`}
                  className="border-b border-[color:var(--border)] pb-4 last:border-b-0"
                >
                  <h2 className="text-xs font-extrabold uppercase tracking-kicker text-[color:var(--text-muted)]">
                    {ON_CALL_SECTION_TITLES[group.section]}
                  </h2>
                  <ul className="mt-2 grid gap-3">
                    {group.entries.map((entry) => {
                      const numbers = cardEntryNumbers(entry.details);
                      return (
                        <li key={entry.id} data-testid={`on-call-card-entry-${entry.slug}`}>
                          <p className="text-sm font-bold text-[color:var(--text-heading)]">{entry.title}</p>
                          {entry.subtitle ? (
                            <p className="text-xs text-[color:var(--text-muted)]">{entry.subtitle}</p>
                          ) : null}
                          {numbers.length > 0 ? (
                            <ul className="mt-1 grid gap-0.5">
                              {numbers.map((number) => {
                                const href = telHref(number.value);
                                const label = `${number.label}: ${number.value}`;
                                return (
                                  <li key={number.label} className="text-sm text-[color:var(--text)]">
                                    {href ? (
                                      <a href={href} className="hover:underline">
                                        {label}
                                      </a>
                                    ) : (
                                      label
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <p className="mt-1 text-sm text-[color:var(--text-muted)]">No number on file</p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </PrintSection>
              ))}
            </div>
          </PrintOutput>
        )}
      </InformationPageShell>
      <AccountSetupDialog open={signInOpen} onClose={() => setSignInOpen(false)} />
    </>
  );
}
