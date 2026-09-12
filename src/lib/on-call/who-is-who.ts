import { type OnCallEntry } from "@/lib/on-call/entry-model";

/**
 * Who's who — what each role does and when to call it, the on-call ladder, and
 * the local acronyms.
 *
 * It is not a seventh section. `section` is a database CHECK constraint, so a
 * new value costs a migration, and a role explainer is genuinely a `contacts`
 * row whose point is the role rather than the number. The discriminator lives in
 * `details.kind`, which is JSONB and therefore free.
 *
 * The cost of that choice is one real hazard: an explainer showing up in the
 * Contacts list, where every row is a thing you ring. `partitionContactsEntries`
 * is the single place that split happens, and `tests/on-call-who-is-who.test.ts`
 * pins it.
 */
export const ROLE_EXPLAINER_KIND = "role-explainer";

/**
 * Whether a `contacts` entry is a role explainer.
 *
 * Section is checked first and is not redundant: `details` is `unknown` on the
 * entry type, every section shares the column, and nothing stops a logistics row
 * carrying a `kind` key. Without the section test such a row would be adopted
 * into Who's who, where its category would read as a role.
 */
export function isRoleExplainerEntry(entry: OnCallEntry): boolean {
  if (entry.section !== "contacts") return false;
  const details = entry.details;
  if (typeof details !== "object" || details === null) return false;
  return (details as { kind?: unknown }).kind === ROLE_EXPLAINER_KIND;
}

/**
 * Split the `contacts` section into the two lists that render it.
 *
 * Entries from other sections are dropped rather than passed through, so a
 * caller cannot accidentally render a logistics row on either page. Callers that
 * want the whole set already have it.
 */
export function partitionContactsEntries(entries: readonly OnCallEntry[]): {
  contacts: OnCallEntry[];
  roleExplainers: OnCallEntry[];
} {
  const contacts: OnCallEntry[] = [];
  const roleExplainers: OnCallEntry[] = [];
  for (const entry of entries) {
    if (entry.section !== "contacts") continue;
    if (isRoleExplainerEntry(entry)) roleExplainers.push(entry);
    else contacts.push(entry);
  }
  return { contacts, roleExplainers };
}
