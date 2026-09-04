import type { Metadata } from "next";

import { WardPatientWorkspace } from "@/components/ward-management/ward-management-console";
import type { MovementId } from "@/components/ward-management/ward-model";

export const metadata: Metadata = {
  title: "Patient movement workspace - Ward Flow",
  description: "Synthetic patient movement review for the Ward Flow prototype.",
};

/**
 * Nested under the static `/mockups/ward-flow/movements` mode page — Next.js accepts a static
 * `page.tsx` and a dynamic child in the same segment, the same shape already proven elsewhere in
 * this app: `src/app/(search-app)/documents/page.tsx` sits beside `documents/[id]/page.tsx` (and
 * `forms/page.tsx` beside `forms/[slug]/page.tsx`, `mockups/care-plan/patients/page.tsx` beside
 * `patients/[patientId]/page.tsx`), so this is not a new top-level segment. Moved here from the
 * old `patients/[patientId]` address, which shared this workspace's own doc comment's complaint:
 * the folder said `patientId` and the value was always a movement id. The parameter now matches
 * what it holds.
 *
 * A URL segment is always just text, so this is the one place a cast is right: the shape is
 * CHECKED and then asserted. An id that is not a movement id now renders the workspace's own
 * not-found state deliberately, rather than arriving as a `string` nothing had ever validated.
 */
export default async function WardMovementPage({ params }: { params: Promise<{ movementId: string }> }) {
  const { movementId } = await params;
  const id = decodeURIComponent(movementId);
  if (!id.startsWith("WF-")) {
    // Not a movement id at all — most likely a person id, which this screen has never been able to
    // show. Handing it on unchecked is what produced a dead end that looked like a data problem.
    return <WardPatientWorkspace movementId={"WF-" as MovementId} />;
  }
  return <WardPatientWorkspace movementId={id as MovementId} />;
}
