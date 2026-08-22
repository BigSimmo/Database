import { describe, expect, it } from "vitest";
import {
  applyClarificationAnswers,
  clarificationsFor,
  handoffContext,
  identifierShapeWarning,
  projectConfirmedContext,
} from "@/lib/clinical-ask/context";

describe("Clinical Ask confirmed context", () => {
  it("projects only expected clarification answers into confirmed context", () => {
    expect(
      applyClarificationAnswers(
        "services",
        {},
        {
          "services:serviceLocation": "Metro area",
          "services:population": "Adults",
          unexpected: "must not enter context",
        },
      ),
    ).toEqual({ serviceLocation: "Metro area", population: "Adults" });
  });
  it("never treats a suggestion as confirmed context", () => {
    const suggestions = [
      { id: "s1", field: "workingDiagnosis", value: "fictional working diagnosis", status: "suggested" },
    ] as const;
    expect(projectConfirmedContext("specifiers", {}, suggestions)).toEqual({});
  });

  it("reduces a handoff to fields accepted by the target profile", () => {
    expect(
      handoffContext("dsm", "specifiers", {
        workingDiagnosis: "fictional working diagnosis",
        course: "current episode",
        serviceLocation: "Example City",
      }),
    ).toEqual({ workingDiagnosis: "fictional working diagnosis", course: "current episode" });
  });

  it("asks deterministic material clarifications without copying unaccepted context", () => {
    expect(clarificationsFor("forms", { jurisdiction: "Example jurisdiction" }).map(({ id }) => id)).toEqual([
      "forms:clinicalLegalStage",
      "forms:formPurpose",
      "forms:responsibleRole",
    ]);
  });

  it.each([
    ["contact@example.test", true],
    ["DOB: 01/02/1980", true],
    ["MRN: EX-12345", true],
    ["Medicare 1234 56789 0", true],
    ["The fictional presentation lasted 12 days.", false],
    ["Example Community Clinic", false],
  ])("returns only a stable identifier-shape verdict for %s", (text, expected) =>
    expect(identifierShapeWarning(text)).toBe(expected),
  );
});
