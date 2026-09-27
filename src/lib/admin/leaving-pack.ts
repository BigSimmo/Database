import { adminPlacementForEntry, isAdminWorkforceExplainer } from "@/lib/admin/placement";
import { formatDateEcho, formatRecordedDate, formatUpdatedMonth } from "@/lib/admin/renewal-dates";
import { complianceExpiryHistory } from "@/lib/admin/renewals";
import {
  ADMIN_REQUIREMENTS_CATALOGUE,
  catalogueItemForEntry,
  requirementChecklistRowsForJob,
  requirementsNotForThisJob,
} from "@/lib/admin/requirements";
import { perthCalendarDate } from "@/lib/cme/cpd-year";
import {
  complianceExpiresOn,
  entryNotForThisJob,
  partitionLogisticsEntries,
  sortComplianceEntries,
} from "@/lib/on-call/compliance";
import type { OnCallEntry } from "@/lib/on-call/entry-model";

export type LeavingPackRecord = Omit<OnCallEntry, "isOwn">;
export type LeavingPack = {
  version: 1;
  exportedAt: string;
  note: string;
  renewals: LeavingPackRecord[];
  adminEntries: LeavingPackRecord[];
  contacts: LeavingPackRecord[];
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to drop it from `record`
const strip = ({ isOwn: _isOwn, ...record }: OnCallEntry): LeavingPackRecord => record;

/**
 * Spec: "Doctors can download all their own Admin records." Shared rows are other
 * doctors' records and never go in. Update 2 adds service ticks, pay and leave here.
 */
export function buildLeavingPack(input: { ownEntries: readonly OnCallEntry[]; now: Date }): LeavingPack {
  const { admin, compliance } = partitionLogisticsEntries(input.ownEntries);
  return {
    version: 1,
    exportedAt: input.now.toISOString(),
    note: "Your own Admin records as you entered them. Nothing here was checked with an issuer.",
    renewals: compliance.map(strip),
    adminEntries: admin.map(strip),
    contacts: input.ownEntries.filter(isAdminWorkforceExplainer).map(strip),
  };
}

export function leavingPackFileName(now: Date): string {
  return `admin-leaving-pack-${perthCalendarDate(now)}.json`;
}

export interface AdminRecordsRow {
  readonly key: string;
  readonly title: string;
  /** Plain lines under the title, exactly as the page shows them and Copy writes them. */
  readonly lines: readonly string[];
}

export interface AdminRecordsSection {
  readonly label: "Renewals" | "Not recorded yet" | "Not for this job" | "New job" | "Admin" | "Contacts";
  readonly rows: readonly AdminRecordsRow[];
}

function detailText(entry: OnCallEntry, key: string): string | null {
  const details = entry.details;
  const value = typeof details === "object" && details !== null ? (details as Record<string, unknown>)[key] : undefined;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function renewalRow(entry: OnCallEntry): AdminRecordsRow {
  const issuer = detailText(entry, "issuingBody");
  const expiresOn = complianceExpiresOn(entry);
  const history = complianceExpiryHistory(entry);
  const proofNote = detailText(entry, "proofNote");
  const lines = [
    expiresOn
      ? `Recorded as expiring ${formatRecordedDate(expiresOn)}`
      : catalogueItemForEntry(entry)
        ? "Recorded, no end date"
        : "No date recorded",
    ...(history.length > 0 ? [`Recorded before: ${history.map(formatRecordedDate).join(", ")}`] : []),
    ...(issuer ? [`Issued by ${issuer}`] : []),
    ...(proofNote ? [`Where your proof is: ${proofNote}`] : []),
  ];
  return { key: entry.id, title: entry.title, lines };
}

/** Keep the actual saved fields alongside each Admin row in both Print and Copy. */
function adminEntryLines(entry: OnCallEntry): string[] {
  const fields = [
    ...(entry.subtitle ? [entry.subtitle] : []),
    ...(entry.body ? [entry.body] : []),
    ...(["location", "hours", "phone", "url"] as const).flatMap((key) => {
      const value = detailText(entry, key);
      return value ? [`${key[0].toUpperCase()}${key.slice(1)}: ${value}`] : [];
    }),
  ];
  return fields;
}

/**
 * "Your Admin records" (spec item 26 and the design): every recorded renewal
 * with its date and earlier dates, what is not recorded yet, what is not for
 * this job, the New job ticks, the other Admin rows and Admin's contacts.
 * Own rows only. The page renders these sections and Copy writes the same
 * lines (`adminRecordsText`), so the two can never disagree. Empty sections
 * are left out.
 */
export function adminRecordsSections(ownEntries: readonly OnCallEntry[]): AdminRecordsSection[] {
  const { admin, compliance } = partitionLogisticsEntries(ownEntries);
  const renewals = sortComplianceEntries(compliance.filter((entry) => !entryNotForThisJob(entry))).map(renewalRow);
  const notRecorded = requirementChecklistRowsForJob(ADMIN_REQUIREMENTS_CATALOGUE, ownEntries)
    .filter((row) => row.state === "not-recorded")
    .map((row) => row.item)
    .sort((a, b) => ADMIN_REQUIREMENTS_CATALOGUE.indexOf(a) - ADMIN_REQUIREMENTS_CATALOGUE.indexOf(b))
    .map((item) => ({ key: item.id, title: item.title, lines: [] }));
  const notForThisJob = requirementsNotForThisJob(ADMIN_REQUIREMENTS_CATALOGUE, ownEntries).map(({ item }) => ({
    key: item.id,
    title: item.title,
    lines: [],
  }));
  const newJob = admin
    .filter((entry) => adminPlacementForEntry(entry) === "new-job")
    .map((entry) => ({
      key: entry.id,
      title: entry.title,
      lines: [
        (entry.details as { done?: unknown } | null)?.done === true ? "Ticked" : "Not ticked",
        ...adminEntryLines(entry),
      ],
    }));
  const otherAdmin = admin
    .filter((entry) => adminPlacementForEntry(entry) !== "new-job")
    .map((entry) => ({
      key: entry.id,
      title: entry.title,
      lines: [
        ...(entry.lastVerifiedAt ? [`Updated ${formatUpdatedMonth(entry.lastVerifiedAt)}`] : []),
        ...adminEntryLines(entry),
      ],
    }));
  const contacts = ownEntries.filter(isAdminWorkforceExplainer).map((entry) => {
    const role = detailText(entry, "role");
    return { key: entry.id, title: entry.title, lines: [...(role ? [role] : []), ...adminEntryLines(entry)] };
  });
  const sections: AdminRecordsSection[] = [
    { label: "Renewals", rows: renewals },
    { label: "Not recorded yet", rows: notRecorded },
    { label: "Not for this job", rows: notForThisJob },
    { label: "New job", rows: newJob },
    { label: "Admin", rows: otherAdmin },
    { label: "Contacts", rows: contacts },
  ];
  return sections.filter((section) => section.rows.length > 0);
}

/** The plain text Copy writes: the page's own sections, dates and all. */
export function adminRecordsText(sections: readonly AdminRecordsSection[], now: Date): string {
  const lines = [
    "Your Admin records",
    `As you recorded them · ${formatDateEcho(perthCalendarDate(now))}`,
    "Your own Admin records as you entered them. Nothing here was checked with an issuer.",
  ];
  for (const section of sections) {
    lines.push("", section.label);
    for (const row of section.rows) {
      lines.push(`- ${row.title}`, ...row.lines.map((line) => `  ${line}`));
    }
  }
  return lines.join("\n");
}
