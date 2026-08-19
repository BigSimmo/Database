import type { Metadata } from "next";

import { WardPatientWorkspace } from "@/components/ward-management/ward-management-console";

export const metadata: Metadata = {
  title: "Patient movement workspace - Ward Flow",
  description: "Synthetic patient movement review for the Ward Flow prototype.",
};

export default async function WardPatientPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  return <WardPatientWorkspace patientId={decodeURIComponent(patientId)} />;
}
