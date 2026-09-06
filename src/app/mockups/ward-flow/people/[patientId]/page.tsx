import type { Metadata } from "next";

import { WardMovementNotFound } from "@/components/ward-management/ward-management-console";
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
 * A URL segment is always just text, so the shape is CHECKED before it is asserted.
 *
 * 🔴 THIS ROUTE CARRIED THE SAME WELL-TYPED LIE ITS TWIN DID, AND THE COMMENT ABOVE IT VOUCHED FOR
 * THE TWIN. `PatientId` is the template literal `` `PT-${string}` ``, so the bare string `"PT-"`
 * satisfies it, and any unrecognised id was cast to that sentinel and handed to `PersonScreen`.
 * The old comment said the guard was "the same guard the movement route carries" — and the movement
 * route stopped carrying it when its own sentinel was removed hours earlier. ⚠️ **A comment whose
 * justification is a sibling file decays silently the moment the sibling changes, and nothing local
 * ever fails.**
 *
 * `PersonScreen` never quoted the sentinel, so unlike the movements route no id the user never
 * typed reached the screen. What it did instead was collapse two different answers into one:
 * `/people/WF-013` — the mirror mistake, and the likely one between sibling routes — was told no
 * such PERSON exists, when WF-013 is not a person id at all and its movement page is one click
 * away. That is the same defect as the twin's with the roles swapped.
 *
 * Both routes now name what the id actually is and point at the screen that holds it. The right
 * long-term shape is one place that owns id ownership and both routes call it, rather than two
 * routes each citing the other; recorded as owed rather than built here.
 */
export default async function WardPersonPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  const id = decodeURIComponent(patientId);
  if (!id.startsWith("PT-")) {
    return <WardMovementNotFound requestedId={id} reason="not-a-person-id" />;
  }
  return <PersonScreen patientId={id as PatientId} />;
}
