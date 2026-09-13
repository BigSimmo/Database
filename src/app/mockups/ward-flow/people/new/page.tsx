import type { Metadata } from "next";

import { AddPatientForm } from "@/components/ward-management/patients/add-patient";

export const metadata: Metadata = {
  title: "Add a patient — Ward Flow",
  description: "Synthetic front-door add-patient form for the Ward Flow prototype.",
};

export default function AddPatientPage() {
  return <AddPatientForm />;
}
