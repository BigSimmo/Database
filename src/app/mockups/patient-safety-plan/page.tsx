import type { Metadata } from "next";

import { PatientSafetyPlanMockup } from "@/components/patient-safety-plan-mockup";

export const metadata: Metadata = {
  title: "Safety Plan Generator Mockup - Clinical KB",
  description:
    "Clinician-facing patient safety-plan generator mockup: build the Stanley-Brown six steps with a live patient copy to print or share.",
};

export default function PatientSafetyPlanMockupRoute() {
  return <PatientSafetyPlanMockup />;
}
