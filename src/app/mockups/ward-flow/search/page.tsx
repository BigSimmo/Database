import type { Metadata } from "next";

import { PatientSearchPage } from "@/components/ward-management/search/patient-search";

export const metadata: Metadata = {
  title: "Patient search — Ward Flow",
  description: "Synthetic prototype: find an open Ward Flow movement by id, department, destination, stage or owner.",
};

export default function WardPatientSearchPage() {
  return <PatientSearchPage />;
}
