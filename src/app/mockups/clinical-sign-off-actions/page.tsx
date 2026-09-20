import type { Metadata } from "next";

import { ClinicalSignOffActionsMockups } from "@/components/clinical-sign-off-actions-mockups";

export const metadata: Metadata = {
  title: "Clinical sign-off actions mockups - PsychSift",
  description:
    "Four boards for the action the read-only sign-off queue does not have: one record attested, a safe batch rule, seven vocabularies under one action, and what signing unlocks.",
};

export default function ClinicalSignOffActionsMockupRoute() {
  return <ClinicalSignOffActionsMockups />;
}
