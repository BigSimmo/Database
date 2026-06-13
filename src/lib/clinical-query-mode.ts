import { z } from "zod";
import type { RagQueryClass, SmartRagApiPlan } from "@/lib/types";

export const clinicalQueryModes = [
  "auto",
  "monitoring_schedule",
  "dose_threshold_lookup",
  "contraindications_cautions",
  "escalation_criteria",
  "required_documentation",
  "compare_guidance",
] as const;

export type ClinicalQueryMode = (typeof clinicalQueryModes)[number];

export const clinicalQueryModeSchema = z.enum(clinicalQueryModes).default("auto");

export const clinicalQueryModeLabels: Record<ClinicalQueryMode, string> = {
  auto: "Auto",
  monitoring_schedule: "Monitoring schedule",
  dose_threshold_lookup: "Dose / threshold",
  contraindications_cautions: "Contraindications",
  escalation_criteria: "Escalation criteria",
  required_documentation: "Required documentation",
  compare_guidance: "Compare guidance",
};

export function queryClassForClinicalMode(mode: ClinicalQueryMode): RagQueryClass | null {
  switch (mode) {
    case "monitoring_schedule":
    case "dose_threshold_lookup":
    case "contraindications_cautions":
      return "medication_dose_risk";
    case "escalation_criteria":
      return "table_threshold";
    case "required_documentation":
      return "document_lookup";
    case "compare_guidance":
      return "comparison";
    default:
      return null;
  }
}

export function preferredResponseModeForClinicalMode(
  mode: ClinicalQueryMode,
): SmartRagApiPlan["responseMode"] | undefined {
  if (mode === "required_documentation") return "document_lookup";
  if (mode === "compare_guidance") return "multi_document_synthesis";
  return undefined;
}

export function clinicalModePrompt(mode: ClinicalQueryMode) {
  switch (mode) {
    case "monitoring_schedule":
      return "Prioritize monitoring schedule, baseline checks, repeat timing, and review ownership.";
    case "dose_threshold_lookup":
      return "Prioritize medication, dose, route, threshold, maximum/minimum values, and action points.";
    case "contraindications_cautions":
      return "Prioritize contraindications, cautions, exclusions, interactions, toxicity, and safety-net warnings.";
    case "escalation_criteria":
      return "Prioritize escalation triggers, urgent review criteria, red flags, and senior/specialist review.";
    case "required_documentation":
      return "Prioritize required forms, documentation, checklist items, responsibilities, and source document links.";
    case "compare_guidance":
      return "Compare relevant documents by clinical theme, merge overlap, and call out conflicts or gaps.";
    default:
      return "";
  }
}

export function queryForClinicalMode(query: string, mode: ClinicalQueryMode) {
  const prompt = clinicalModePrompt(mode);
  return prompt ? `${query}\n\nClinical query mode: ${clinicalQueryModeLabels[mode]}. ${prompt}` : query;
}
