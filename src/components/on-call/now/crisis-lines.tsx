"use client";

import { LifeBuoy } from "lucide-react";

import { ModeDialRow } from "@/components/mode-kit/dial-row";
import { OnCallGroupedList } from "@/components/on-call/kit/grouped-list";
import { WA_CRISIS_CONTACTS, type PublicCrisisContact } from "@/lib/crisis-contacts";

/**
 * The public crisis lines: 000, MHERL (Perth metropolitan) and Lifeline.
 *
 * They show straight under the state module whenever the hospital's own
 * numbers are not on screen — loading, signed out, offline, failed, or no
 * numbers yet (owner rule: crisis lines in every loading and failure state).
 * They are public numbers from the one verified list (`src/lib/crisis-contacts.ts`),
 * never a hospital's, so nothing here is kept from a hospital handbook.
 */

type CrisisRow = { readonly id: PublicCrisisContact["id"]; readonly label: string; readonly subtitle: string };

const ROWS: readonly CrisisRow[] = [
  { id: "SYN-CRISIS-CONTACT-001", label: "Emergency", subtitle: "Police, fire, ambulance" },
  { id: "SYN-CRISIS-CONTACT-002", label: "MHERL, Perth metro", subtitle: "Mental health triage · 24 hours" },
  { id: "SYN-CRISIS-CONTACT-005", label: "Lifeline", subtitle: "Crisis support · 24 hours" },
];

function contact(id: PublicCrisisContact["id"]): PublicCrisisContact | null {
  return WA_CRISIS_CONTACTS.find((candidate) => candidate.id === id) ?? null;
}

export function NowCrisisLines({ now }: { readonly now?: Date }) {
  return (
    <OnCallGroupedList eyebrow="Crisis lines" headerIcon={LifeBuoy} testId="on-call-now-crisis">
      {ROWS.map((row) => {
        const line = contact(row.id);
        if (!line) return null;
        return (
          <ModeDialRow
            key={row.id}
            label={row.label}
            subtitle={row.subtitle}
            number={{
              display: line.telephoneDisplay,
              tel: `tel:${line.telephoneUri}`,
              copy: line.telephoneUri,
            }}
            source={{ label: line.name, url: line.sourceUrl }}
            checkedAt={line.verifiedOn}
            tone={line.isEmergencyService ? "emergency" : "default"}
            now={now}
            testId={`on-call-now-crisis-${line.telephoneUri}`}
          />
        );
      })}
    </OnCallGroupedList>
  );
}
