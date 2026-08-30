import type { Metadata } from "next";

import { PersonScreen } from "@/components/ward-management/patients/person-screen";

/**
 * `/people/[patientId]`, deliberately NOT `/patients/[patientId]`.
 *
 * That route already exists and looks a `Movement` up by id — all seven of its inbound links pass
 * a movement id, several through a variable called `patient`, which is where the confusion lives.
 * Renaming it would move seven links and a document title for a prototype whose owner has not been
 * asked; giving the person their own path costs nothing and leaves the misnaming visible rather
 * than half-corrected.
 */
export const metadata: Metadata = {
  title: "Person - Ward Flow",
  description: "Synthetic person record for the Ward Flow prototype.",
};

export default async function WardPersonPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  return <PersonScreen patientId={decodeURIComponent(patientId)} />;
}
