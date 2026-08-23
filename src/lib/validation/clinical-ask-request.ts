import { z } from "zod";
import { clinicalAskModeIds, type ClinicalAskRequest } from "@/lib/clinical-ask/contracts";

const bounded = z.string().trim().min(1).max(500);
const contextValue = z.union([bounded, z.array(bounded).max(20)]);
const context = z
  .object({
    ageGroup: contextValue.optional(),
    careSetting: contextValue.optional(),
    jurisdiction: contextValue.optional(),
    workingDiagnosis: contextValue.optional(),
    presentationFeatures: contextValue.optional(),
    duration: contextValue.optional(),
    impairment: contextValue.optional(),
    exclusions: contextValue.optional(),
    course: contextValue.optional(),
    serviceLocation: contextValue.optional(),
    eligibilityFacts: contextValue.optional(),
    pathwayStage: contextValue.optional(),
    referralPurpose: contextValue.optional(),
    formPurpose: contextValue.optional(),
    clinicalLegalStage: contextValue.optional(),
    responsibleRole: contextValue.optional(),
    therapyGoals: contextValue.optional(),
    population: contextValue.optional(),
    cautions: contextValue.optional(),
    availabilityConstraints: contextValue.optional(),
    priorResponse: contextValue.optional(),
  })
  .strict();
export const clinicalAskRequestSchema: z.ZodType<ClinicalAskRequest> = z
  .object({
    mode: z.enum(clinicalAskModeIds),
    question: z.string().trim().min(1).max(2_000),
    confirmedContext: context,
    clarificationAnswers: z.record(z.string(), bounded).refine((v) => Object.keys(v).length <= 8),
    priorTurns: z
      .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().trim().min(1).max(2_000) }).strict())
      .max(6),
    allowExternalFallback: z.boolean(),
    inputTransport: z.enum(["typed", "voice"]),
  })
  .strict();
