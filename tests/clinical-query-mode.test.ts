import { describe, expect, it } from "vitest";
import {
  clinicalModePrompt,
  queryClassForClinicalMode,
  queryForClinicalMode,
} from "../src/lib/clinical-query-mode";

describe("clinical query modes", () => {
  it("maps explicit modes to retrieval query classes", () => {
    expect(queryClassForClinicalMode("monitoring_schedule")).toBe("medication_dose_risk");
    expect(queryClassForClinicalMode("dose_threshold_lookup")).toBe("medication_dose_risk");
    expect(queryClassForClinicalMode("escalation_criteria")).toBe("table_threshold");
    expect(queryClassForClinicalMode("required_documentation")).toBe("document_lookup");
    expect(queryClassForClinicalMode("compare_guidance")).toBe("comparison");
    expect(queryClassForClinicalMode("auto")).toBeNull();
  });

  it("adds a focused prompt only for non-auto modes", () => {
    expect(clinicalModePrompt("auto")).toBe("");
    expect(queryForClinicalMode("lithium", "auto")).toBe("lithium");
    expect(queryForClinicalMode("lithium", "dose_threshold_lookup")).toContain("Prioritize medication, dose");
  });
});
