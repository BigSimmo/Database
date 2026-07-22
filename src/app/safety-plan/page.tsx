import type { Metadata } from "next";

import { PatientSafetyPlan } from "@/components/patient-safety-plan";

export const metadata: Metadata = {
  title: "Safety plan generator - Clinical KB",
  description:
    "Build a patient safety plan with the Stanley-Brown six steps and a live patient copy to print, save as PDF, or hand over.",
};

export default function SafetyPlanPage() {
  return <PatientSafetyPlan />;
}
