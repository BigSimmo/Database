import { describe, expect, it } from "vitest";

import {
  CANARY_DISPOSITIONS,
  canaryPublicationMarker,
  classifyCanaryReceipt,
  mayCloseCanaryIncident,
} from "../scripts/lib/eval-canary-disposition.mjs";

const clean = {
  intendedScopeComplete: true,
  blockingFailures: [],
  diagnostics: [],
  unaccountedDiagnostics: [],
  skippedComponents: [],
  evaluatedSha: "1d6ba4fa216447a48116f97ebcb73c1b165ce6c3",
  configurationOverridden: false,
};

describe("classifyCanaryReceipt", () => {
  it("calls a complete, quiet run a clean recovery", () => {
    expect(classifyCanaryReceipt(clean)).toBe(CANARY_DISPOSITIONS.cleanRecovery);
    expect(mayCloseCanaryIncident(classifyCanaryReceipt(clean))).toBe(true);
  });

  it("keeps a green aggregate with a residual diagnostic OUT of clean recovery", () => {
    // Run 34122919100: every aggregate threshold passed while
    // `discharge-documentation` still reported `unexpected route strong`. No
    // threshold reads that — qualityFailureCategory has no route branch — so the
    // job went green and the residual survived by being invisible.
    const disposition = classifyCanaryReceipt({
      ...clean,
      diagnostics: ["discharge-documentation: unexpected route strong"],
      unaccountedDiagnostics: ["discharge-documentation: unexpected route strong"],
    });
    expect(disposition).toBe(CANARY_DISPOSITIONS.passedWithDiagnostics);
    expect(mayCloseCanaryIncident(disposition)).toBe(false);
  });

  it("stays passed_with_diagnostics even once a diagnostic is accounted for", () => {
    // Accounting for it records a decision; it does not make the run clean.
    expect(classifyCanaryReceipt({ ...clean, diagnostics: ["known: tracked in #628"] })).toBe(
      CANARY_DISPOSITIONS.passedWithDiagnostics,
    );
  });

  it("reports a blocking failure as failed whatever else is true", () => {
    expect(classifyCanaryReceipt({ ...clean, blockingFailures: ["citation_failure_rate 0.02 above 0"] })).toBe(
      CANARY_DISPOSITIONS.failed,
    );
    // Even an incomplete run with a blocking failure is failed, not incomplete.
    expect(
      classifyCanaryReceipt({ ...clean, intendedScopeComplete: false, blockingFailures: ["threshold breach"] }),
    ).toBe(CANARY_DISPOSITIONS.failed);
  });
});

describe("a narrowed run cannot close a default-scope incident", () => {
  it("is incomplete when the intended scope did not all run", () => {
    // --limit takes a PREFIX and captured miss-rows are prepended, so a limited
    // run can push registry cases off the end. case_count reads 44 either way.
    const disposition = classifyCanaryReceipt({ ...clean, intendedScopeComplete: false });
    expect(disposition).toBe(CANARY_DISPOSITIONS.incomplete);
    expect(mayCloseCanaryIncident(disposition)).toBe(false);
  });

  it("is incomplete when a gate was skipped, because an empty section reads like a passing one", () => {
    expect(classifyCanaryReceipt({ ...clean, skippedComponents: ["retrieval"] })).toBe(CANARY_DISPOSITIONS.incomplete);
  });

  it("is incomplete under a ranking-configuration override", () => {
    // A run under a custom ranking config measured a different system.
    expect(classifyCanaryReceipt({ ...clean, configurationOverridden: true })).toBe(CANARY_DISPOSITIONS.incomplete);
  });

  it("is incomplete when the evaluated commit was not recorded", () => {
    expect(classifyCanaryReceipt({ ...clean, evaluatedSha: null })).toBe(CANARY_DISPOSITIONS.incomplete);
    expect(classifyCanaryReceipt({ ...clean, evaluatedSha: "" })).toBe(CANARY_DISPOSITIONS.incomplete);
  });

  it("treats a malformed or absent receipt as incomplete, never clean", () => {
    // Absence of evidence is not evidence of a clean run.
    expect(classifyCanaryReceipt(undefined)).toBe(CANARY_DISPOSITIONS.incomplete);
    expect(classifyCanaryReceipt(null)).toBe(CANARY_DISPOSITIONS.incomplete);
    expect(classifyCanaryReceipt("green")).toBe(CANARY_DISPOSITIONS.incomplete);
    expect(classifyCanaryReceipt({})).toBe(CANARY_DISPOSITIONS.incomplete);
  });

  it("ignores blank entries rather than reading them as findings", () => {
    expect(classifyCanaryReceipt({ ...clean, diagnostics: ["", "   "], blockingFailures: [""] })).toBe(
      CANARY_DISPOSITIONS.cleanRecovery,
    );
  });
});

describe("canaryPublicationMarker", () => {
  it("is stable for the same run, attempt, commit and scope", () => {
    const identity = { runId: 34122919100, runAttempt: 1, evaluatedSha: "1d6ba4fa2164", scope: "default" };
    expect(canaryPublicationMarker(identity)).toBe(canaryPublicationMarker(identity));
    expect(canaryPublicationMarker(identity)).toContain("run=34122919100");
  });

  it("differs across attempts and scopes, so a re-run is not mistaken for the first", () => {
    const base = { runId: 1, runAttempt: 1, evaluatedSha: "abc123def456", scope: "default" };
    expect(canaryPublicationMarker({ ...base, runAttempt: 2 })).not.toBe(canaryPublicationMarker(base));
    expect(canaryPublicationMarker({ ...base, scope: "limit-5" })).not.toBe(canaryPublicationMarker(base));
  });

  it("degrades to a usable marker when identity is missing", () => {
    expect(canaryPublicationMarker()).toContain("run=unknown");
  });
});
