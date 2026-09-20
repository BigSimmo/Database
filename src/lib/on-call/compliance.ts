import {
  ON_CALL_COMPLIANCE_CONSEQUENCES,
  type OnCallComplianceConsequence,
  type OnCallEntry,
} from "@/lib/on-call/entry-model";

/**
 * Compliance — the requirements a doctor has to keep current for themselves:
 * registration, indemnity, mandatory training, credentialing, CPD.
 *
 * It is not a seventh section. `section` is a database CHECK constraint, so a
 * new value costs a migration, and merging a migration in this repository
 * reaches the live clinical database within seconds. A compliance requirement
 * is genuinely an Admin row whose point is that it expires, so the
 * discriminator lives in `details.kind`, which is JSONB and therefore free.
 * This is the same route Who's who took out of `contacts`.
 *
 * The cost of that choice is one real hazard, and it is the mirror of Who's
 * who's: a compliance requirement showing up in the Admin list, where every row
 * is a form or a process rather than something with an expiry date behind it.
 * `partitionLogisticsEntries` is the single place that split happens.
 *
 * ## What this page may never say
 *
 * Nothing here is checked with an issuing body. The dates are what the holder
 * recorded, so no surface built on these rows may render a verdict —
 * "compliant", "valid", "current to", or a tick that stands for any of them.
 * It reports what was recorded, when, and on whose word, and leaves the
 * judgement to the person reading it. A clinical-governance review rejected an
 * earlier design for exactly this, and the wording is the control.
 */
export const COMPLIANCE_KIND = "compliance";

/**
 * Whether an entry is a compliance requirement.
 *
 * Section is checked first and is not redundant: `details` is `unknown` on the
 * entry type, every section shares the column, and nothing stops a contacts row
 * carrying a `kind` key. Without the section test such a row would be adopted
 * into Compliance, where its role would read as a requirement.
 */
export function isComplianceEntry(entry: OnCallEntry): boolean {
  if (entry.section !== "logistics") return false;
  const details = entry.details;
  if (typeof details !== "object" || details === null) return false;
  return (details as { kind?: unknown }).kind === COMPLIANCE_KIND;
}

/**
 * Split the `logistics` section into the two lists that render it.
 *
 * Entries from other sections are dropped rather than passed through, so a
 * caller cannot accidentally render a contacts row on either page. Callers that
 * want the whole set already have it.
 */
export function partitionLogisticsEntries(entries: readonly OnCallEntry[]): {
  admin: OnCallEntry[];
  compliance: OnCallEntry[];
} {
  const admin: OnCallEntry[] = [];
  const compliance: OnCallEntry[] = [];
  for (const entry of entries) {
    if (entry.section !== "logistics") continue;
    if (isComplianceEntry(entry)) compliance.push(entry);
    else admin.push(entry);
  }
  return { admin, compliance };
}

/** The recorded consequence, or `undefined` when the row carries none. */
export function complianceConsequence(entry: OnCallEntry): OnCallComplianceConsequence | undefined {
  const details = entry.details;
  if (typeof details !== "object" || details === null) return undefined;
  const value = (details as { consequence?: unknown }).consequence;
  return ON_CALL_COMPLIANCE_CONSEQUENCES.find((candidate) => candidate === value);
}

/**
 * Sort key for the Compliance page: worst consequence first, and only then by
 * the date.
 *
 * Sorting by expiry answers "what runs out soonest", which is not the question
 * a person opening this page is asking. A registration lapsing in five weeks
 * stops them working; a training module that lapsed three weeks ago gets them
 * an email. Consequence order puts those the right way round, and the date
 * breaks ties inside a band.
 *
 * A row with no recorded consequence sorts after every row that has one —
 * unknown is not the same as harmless, but it cannot be ranked against a
 * stated cost either, so it goes last rather than being guessed at.
 */
export function complianceSortRank(entry: OnCallEntry): number {
  const consequence = complianceConsequence(entry);
  if (!consequence) return ON_CALL_COMPLIANCE_CONSEQUENCES.length;
  return ON_CALL_COMPLIANCE_CONSEQUENCES.indexOf(consequence);
}

/** The recorded expiry, or `undefined`. Compared as a string, which is safe
 *  because the schema pins the format to `YYYY-MM-DD`. */
export function complianceExpiresOn(entry: OnCallEntry): string | undefined {
  const details = entry.details;
  if (typeof details !== "object" || details === null) return undefined;
  const value = (details as { expiresOn?: unknown }).expiresOn;
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

/**
 * The page's order: consequence band first, then soonest expiry, then title.
 *
 * Title last so the list is stable — two requirements with the same band and
 * no date must not swap places between renders.
 */
export function sortComplianceEntries(entries: readonly OnCallEntry[]): OnCallEntry[] {
  return [...entries].sort((a, b) => {
    const byRank = complianceSortRank(a) - complianceSortRank(b);
    if (byRank !== 0) return byRank;
    const expiryA = complianceExpiresOn(a);
    const expiryB = complianceExpiresOn(b);
    // A row with no date sorts after the dated ones inside its own band: it
    // cannot be shown as more urgent than something with a real deadline.
    if (expiryA !== expiryB) {
      if (!expiryA) return 1;
      if (!expiryB) return -1;
      return expiryA.localeCompare(expiryB);
    }
    return a.title.localeCompare(b.title);
  });
}
