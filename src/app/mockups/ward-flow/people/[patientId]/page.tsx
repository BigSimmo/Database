import type { Metadata } from "next";

import { PersonScreen } from "@/components/ward-management/patients/person-screen";
import type { PatientId } from "@/components/ward-management/ward-patients";

/**
 * `/people/[patientId]`, deliberately NOT `/patients/[patientId]`.
 *
 * That route existed and looked a `Movement` up by id — all seven of its inbound links passed a
 * movement id, several through a variable called `patient`, which is where the confusion lived.
 * Giving the person their own path cost nothing and left the misnaming visible rather than
 * half-corrected, while renaming the movement route was a separate, larger change; it has since
 * moved to `/mockups/ward-flow/movements/[movementId]`, so both screens now have names that match
 * what they show.
 */
export const metadata: Metadata = {
  title: "Person - Ward Flow",
  description: "Synthetic person record for the Ward Flow prototype.",
};

/**
 * A URL segment is always just text, so the shape is CHECKED before it is asserted — the same guard
 * the movement route carries. An id that is not a person id renders the screen’s own not-found
 * state deliberately, rather than arriving unvalidated.
 */
export default async function WardPersonPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  const id = decodeURIComponent(patientId);
  return <PersonScreen patientId={id.startsWith("PT-") ? (id as PatientId) : ("PT-" as PatientId)} />;
}
