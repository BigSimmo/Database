import { describe, expect, it } from "vitest";

import { isRoleExplainerEntry, partitionContactsEntries, ROLE_EXPLAINER_KIND } from "@/lib/on-call/who-is-who";
import { onCallDetailsSchemaFor, type OnCallEntry } from "@/lib/on-call/entry-model";

/**
 * Who's who reuses the `contacts` section rather than adding a seventh one,
 * because the section list is a database CHECK constraint and a role explainer
 * is a contact whose point is the role rather than the number. The discriminator
 * lives in `details.kind`, which is JSONB — so this costs no migration.
 *
 * The whole risk of that choice is a role explainer leaking into the Contacts
 * list, where it would read as a number to ring. These tests are the guard.
 */

function contactEntry(overrides: Partial<OnCallEntry> & { details: unknown }): OnCallEntry {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    section: "contacts",
    slug: "entry",
    title: "Entry",
    subtitle: null,
    body: null,
    linkedDocumentIds: [],
    tags: [],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: null,
    ...overrides,
  };
}

describe("contacts details schema", () => {
  const schema = onCallDetailsSchemaFor("contacts");

  it("accepts a role explainer", () => {
    const parsed = schema.safeParse({ role: "Registrar on call", kind: ROLE_EXPLAINER_KIND });
    expect(parsed.success).toBe(true);
  });

  it("still accepts an ordinary contact with no kind", () => {
    expect(schema.safeParse({ role: "Ward 4B", extension: "5210" }).success).toBe(true);
  });

  it("rejects a kind it does not know, rather than treating it as an ordinary contact", () => {
    // `.strict()` rejects unknown KEYS; this pins that an unknown VALUE is
    // rejected too. Silently falling back to "ordinary contact" would put an
    // explainer in the dialling list, which is the one outcome this split exists
    // to prevent.
    expect(schema.safeParse({ role: "Registrar", kind: "explainer" }).success).toBe(false);
  });
});

describe("isRoleExplainerEntry", () => {
  it("is true for a contacts entry flagged as a role explainer", () => {
    expect(isRoleExplainerEntry(contactEntry({ details: { role: "Registrar", kind: ROLE_EXPLAINER_KIND } }))).toBe(
      true,
    );
  });

  it("is false for an ordinary contact", () => {
    expect(isRoleExplainerEntry(contactEntry({ details: { role: "Ward 4B", extension: "5210" } }))).toBe(false);
  });

  it("is false for a non-contacts entry that happens to carry the same key", () => {
    // `details` is unvalidated `unknown` on the entry type, and every section
    // shares the column. A logistics row carrying `kind` must not become a role
    // explainer.
    expect(
      isRoleExplainerEntry(
        contactEntry({ section: "logistics", details: { category: "Parking", kind: ROLE_EXPLAINER_KIND } }),
      ),
    ).toBe(false);
  });

  it("is false when details is not an object at all", () => {
    expect(isRoleExplainerEntry(contactEntry({ details: null }))).toBe(false);
    expect(isRoleExplainerEntry(contactEntry({ details: "role-explainer" }))).toBe(false);
  });
});

describe("partitionContactsEntries", () => {
  const ordinary = contactEntry({ id: "00000000-0000-4000-8000-00000000000a", details: { role: "Ward 4B" } });
  const explainer = contactEntry({
    id: "00000000-0000-4000-8000-00000000000b",
    details: { role: "Registrar on call", kind: ROLE_EXPLAINER_KIND },
  });
  const otherSection = contactEntry({
    id: "00000000-0000-4000-8000-00000000000c",
    section: "logistics",
    details: { category: "Parking" },
  });

  it("keeps role explainers out of the contacts list", () => {
    const { contacts } = partitionContactsEntries([ordinary, explainer]);
    expect(contacts.map((entry) => entry.id)).toEqual([ordinary.id]);
  });

  it("collects the role explainers", () => {
    const { roleExplainers } = partitionContactsEntries([ordinary, explainer]);
    expect(roleExplainers.map((entry) => entry.id)).toEqual([explainer.id]);
  });

  it("ignores entries from other sections entirely", () => {
    const { contacts, roleExplainers } = partitionContactsEntries([ordinary, explainer, otherSection]);
    expect(contacts).not.toContain(otherSection);
    expect(roleExplainers).not.toContain(otherSection);
  });
});
