import type { Metadata } from "next";

import { DoctorComplianceMockups } from "@/components/doctor-compliance-mockups";

export const metadata: Metadata = {
  title: "Doctor compliance mockups - PsychSift",
  description:
    "Six boards for a personal requirements tracker: sorted by what happens if something lapses, and phrased as a record rather than a verdict.",
};

export default function DoctorComplianceMockupRoute() {
  return <DoctorComplianceMockups />;
}
