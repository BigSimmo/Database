import { describe, expect, it } from "vitest";

import { adminFreeTextProblem } from "@/lib/on-call/free-text-guard";

describe("the server refuses patient identifiers in Admin's free text (spec review 11)", () => {
  it("accepts a note that says where the proof is", () => {
    expect(
      adminFreeTextProblem({
        section: "logistics",
        title: "Registration",
        details: { category: "Registration", proofNote: "Email from Ahpra, 3 Oct" },
      }),
    ).toBeNull();
    expect(adminFreeTextProblem({ section: "logistics", title: "Pay", details: { category: "Pay" } })).toBeNull();
  });

  it("refuses a note that looks like a record number, a date of birth or an email address", () => {
    for (const proofNote of ["MRN: 1234567", "DOB: 01/02/1990", "jane.citizen@example.com"]) {
      expect(
        adminFreeTextProblem({
          section: "logistics",
          title: "Registration",
          details: { category: "Registration", proofNote },
        }),
      ).toBe("Keep patient details out of Admin records. Say where your proof is, for example: email from Ahpra.");
    }
  });

  it("refuses identifiers in Quick Add names and Help title, subtitle and body", () => {
    for (const field of ["title", "subtitle", "body"] as const) {
      expect(
        adminFreeTextProblem({
          section: "logistics",
          title: "Guide",
          details: { category: "Pay" },
          [field]: "MRN: 1234567",
        }),
      ).not.toBeNull();
    }
    expect(
      adminFreeTextProblem({ section: "contacts", title: "Workforce", details: { role: "MRN: 1234567" } }),
    ).not.toBeNull();
  });
});
