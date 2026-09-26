import { describe, expect, it } from "vitest";

import { adminFreeTextProblem } from "@/lib/on-call/free-text-guard";

describe("the server refuses patient identifiers in Admin's free text (spec review 11)", () => {
  it("accepts a note that says where the proof is", () => {
    expect(adminFreeTextProblem({ category: "Registration", proofNote: "Email from Ahpra, 3 Oct" })).toBeNull();
    expect(adminFreeTextProblem({ category: "Pay" })).toBeNull();
  });

  it("refuses a note that looks like a record number, a date of birth or an email address", () => {
    for (const proofNote of ["MRN: 1234567", "DOB: 01/02/1990", "jane.citizen@example.com"]) {
      expect(adminFreeTextProblem({ category: "Registration", proofNote })).toBe(
        "Keep patient details out of this note. Say where your proof is, for example: email from Ahpra.",
      );
    }
  });
});
