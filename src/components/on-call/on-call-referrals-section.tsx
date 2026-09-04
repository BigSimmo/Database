"use client";

import { Phone, Repeat } from "lucide-react";

import { OnCallEntryRow } from "@/components/on-call/on-call-entry-row";
import { OnCallFreshnessBadge } from "@/components/on-call/on-call-freshness-badge";
import { EmptyState } from "@/components/primitive-recipes/feedback";
import { ExternalTextLink } from "@/components/ui/link";
import { Disclosure } from "@/components/ui/disclosure";
import { cn, textMuted } from "@/components/ui-primitives";
import { onCallDetailsSchemaFor, onCallEntryFreshness, type OnCallEntry } from "@/lib/on-call/entry-model";

export interface OnCallReferralsSectionProps {
  entries: readonly OnCallEntry[];
  /** Injectable for deterministic tests; defaults to the real clock. */
  now?: Date;
  testId?: string;
}

interface OnCallReferralsDetails {
  accepts: readonly string[];
  exclusions: readonly string[];
  catchment?: string;
  hours?: string;
  howToRefer?: string;
  phone?: string;
  fax?: string;
  referralFormUrl?: string;
}

function parseReferralsDetails(details: unknown): OnCallReferralsDetails | null {
  const result = onCallDetailsSchemaFor("referrals").safeParse(details);
  return result.success ? (result.data as OnCallReferralsDetails) : null;
}

function telHref(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const compact = raw.replace(/[^\d+]/g, "");
  return compact.length > 0 ? `tel:${compact}` : undefined;
}

/**
 * A labelled fact row — "Hours: 08:00-17:00 Mon-Fri". Plain text, never a
 * colour-coded chip standing alone: the label is always visible and always
 * read out, so the fact survives for a colourblind reader and a screen reader
 * alike.
 */
function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm">
      <span className="font-semibold text-[color:var(--text)]">{label}: </span>
      <span className={textMuted}>{value}</span>
    </p>
  );
}

/**
 * Accepts / does not accept. Rendered as labelled text lines — never a chip
 * whose colour alone carries "accepted" vs "excluded" — because that
 * distinction has to survive with no colour perception at all.
 */
function AcceptanceList({ label, items }: { label: string; items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <p className="text-sm">
      <span className="font-semibold text-[color:var(--text)]">{label}: </span>
      <span className={textMuted}>{items.join(", ")}</span>
    </p>
  );
}

function ReferralPanel({ entry, details }: { entry: OnCallEntry; details: OnCallReferralsDetails }) {
  return (
    <div className="grid gap-2" data-testid={`on-call-referral-panel-${entry.slug}`}>
      <AcceptanceList label="Accepts" items={details.accepts} />
      <AcceptanceList label="Does not accept" items={details.exclusions} />
      {details.catchment ? <FactRow label="Catchment" value={details.catchment} /> : null}
      {details.hours ? <FactRow label="Hours" value={details.hours} /> : null}
      {details.howToRefer ? <FactRow label="How to refer" value={details.howToRefer} /> : null}
      {details.fax ? <FactRow label="Fax" value={details.fax} /> : null}
      {details.phone ? (
        <OnCallEntryRow
          icon={Phone}
          title="Call to refer"
          subtitle={details.phone}
          href={telHref(details.phone)}
          testId={`on-call-referral-phone-${entry.slug}`}
        />
      ) : null}
      {details.referralFormUrl ? (
        <ExternalTextLink href={details.referralFormUrl} className="text-sm">
          Referral form
        </ExternalTextLink>
      ) : null}
    </div>
  );
}

/**
 * The Referrals section: the owner's own referral list, one expandable row
 * per service. Collapsed, the row shows just the service name; expanded, it
 * reveals accepts/exclusions/catchment/hours/how-to-refer/phone — all as
 * labelled text (spec §8.4), never colour-coded chips carrying the
 * accepted/excluded distinction alone.
 */
export function OnCallReferralsSection({
  entries,
  now = new Date(),
  testId = "on-call-referrals-section",
}: OnCallReferralsSectionProps) {
  const referralEntries = entries.filter((entry) => entry.section === "referrals");

  if (referralEntries.length === 0) {
    return (
      <EmptyState
        icon={Repeat}
        title="No referral pathways yet"
        body="Services you add will appear here — who they accept, catchment, hours, and how to refer."
        testId="on-call-referrals-empty"
      />
    );
  }

  const sorted = [...referralEntries].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));

  return (
    <div data-testid={testId} className="grid gap-2">
      {sorted.map((entry) => {
        const details = parseReferralsDetails(entry.details);
        const freshness = onCallEntryFreshness(entry, now);
        return (
          <Disclosure key={entry.id} title={entry.title} description={entry.subtitle ?? undefined}>
            <div className="grid gap-3">
              <OnCallFreshnessBadge freshness={freshness} />
              {details ? (
                <ReferralPanel entry={entry} details={details} />
              ) : (
                <p className={cn("text-sm", textMuted)}>No referral details recorded yet.</p>
              )}
            </div>
          </Disclosure>
        );
      })}
    </div>
  );
}
