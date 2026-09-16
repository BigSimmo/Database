import { describe, expect, it } from "vitest";

import { formStaticParams } from "@/lib/forms";
import { formTitleForCode, officialForms } from "@/lib/form-register";
import type { OnCallEntry } from "@/lib/on-call/entry-model";
import { formPageHref, playbookFormReferences } from "@/lib/on-call/playbook-forms";

function scenario(overrides: Partial<OnCallEntry> = {}): OnCallEntry {
  return {
    id: "bbbbbbbb-0000-0000-0000-000000000001",
    section: "playbook",
    slug: "scenario",
    title: "Scenario",
    subtitle: null,
    body: null,
    details: { trigger: "Trigger", escalationSteps: [] },
    linkedDocumentIds: [],
    tags: [],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: null,
    ...overrides,
  } as OnCallEntry;
}

const codes = (entry: OnCallEntry) => playbookFormReferences(entry).map((form) => form.code);

describe("playbookFormReferences — what counts as a reference", () => {
  it("returns nothing when the owner wrote no form code", () => {
    expect(
      playbookFormReferences(
        scenario({
          title: "Acute agitation on the ward",
          body: "Call the registrar first, then the consultant.",
          details: { trigger: "Patient escalating, staff safety at risk", escalationSteps: [] },
          tags: ["Emergency", "After hours"],
        }),
      ),
    ).toEqual([]);
  });

  it("matches the natural spellings a doctor types", () => {
    expect(codes(scenario({ body: "Complete a Form 1A before transport." }))).toEqual(["1A"]);
    expect(codes(scenario({ body: "complete a form 1a." }))).toEqual(["1A"]);
    expect(codes(scenario({ title: "F1A referral pathway" }))).toEqual(["1A"]);
    expect(codes(scenario({ tags: ["form-1a"] }))).toEqual(["1A"]);
    expect(codes(scenario({ details: { trigger: "Referral needed — Form 1A", escalationSteps: [] } }))).toEqual(["1A"]);
  });

  it("carries the register's own code, title, category and page URL", () => {
    expect(playbookFormReferences(scenario({ body: "Form 4A" }))).toEqual([
      {
        code: "4A",
        title: "Transport order",
        category: "Transport and transfer",
        href: "/forms/transport-crisis-form",
      },
    ]);
  });

  it("never states a title of its own — every title is the register's", () => {
    const references = playbookFormReferences(scenario({ body: "Form 1A, Form 3A, Form 4A, Form 10B, Form 13." }));
    expect(references.length).toBe(5);
    for (const reference of references) {
      expect(reference.title).toBe(formTitleForCode(reference.code));
    }
  });

  it("de-duplicates and returns the register's own order", () => {
    // Written 4A-first, and tagged with 1A twice over.
    const entry = scenario({
      title: "Form 4A transport",
      body: "Form 4A, then Form 1A.",
      tags: ["form-1a", "Form 1A"],
    });
    expect(codes(entry)).toEqual(["1A", "4A"]);
  });
});

describe("playbookFormReferences — the ambiguous codes", () => {
  it("does not let a prefix code match its longer siblings", () => {
    expect(codes(scenario({ body: "Form 3A is the detention order." }))).toEqual(["3A"]);
    expect(codes(scenario({ body: "Form 1A referral." }))).toEqual(["1A"]);
  });

  it("reads 'Form 1A attachment' as the attachment, not as Form 1A", () => {
    expect(codes(scenario({ body: "Attach the Form 1A attachment." }))).toEqual(["1A attachment"]);
    expect(codes(scenario({ body: "Form 6B attachment goes to the Chief Psychiatrist." }))).toEqual(["6B attachment"]);
  });

  it("ignores a bare number that is not a form code", () => {
    expect(
      codes(
        scenario({
          title: "Ward 4B nurses' station",
          body: "At step 3, ring 9224 1234. Crisis line is 13 11 14.",
          details: { trigger: "Escalation at step 3", escalationSteps: [] },
          tags: ["Ward 4B"],
        }),
      ),
    ).toEqual([]);
  });

  it("does not read a number that merely follows the word form", () => {
    expect(codes(scenario({ body: "Form after the 3 hour review." }))).toEqual([]);
  });

  it("drops a code the register does not list, and keeps the ones it does", () => {
    // The register is the only source of a form's identity, so a code it does
    // not list has no title, no category and no page to open — it is dropped.
    expect(codes(scenario({ body: "Form 99Z and Form 1A and Form 12." }))).toEqual(["1A"]);
  });
});

describe("formPageHref", () => {
  it("points every official form at a page the Forms mode actually serves", () => {
    const routedSlugs = new Set(formStaticParams().map((param) => param.slug));
    expect(routedSlugs.size).toBe(officialForms.length);
    for (const form of officialForms) {
      const href = formPageHref(form.code);
      expect(href.startsWith("/forms/")).toBe(true);
      expect(routedSlugs.has(href.slice("/forms/".length))).toBe(true);
    }
  });

  it("keeps the legacy slugs those four forms are already served at", () => {
    expect(formPageHref("3A")).toBe("/forms/detention-examination-movement");
    expect(formPageHref("4A")).toBe("/forms/transport-crisis-form");
    expect(formPageHref("1A attachment")).toBe("/forms/form-1a-attachment");
  });
});
