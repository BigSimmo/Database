import type { Metadata } from "next";

import { WardMovementNotFound, WardPatientWorkspace } from "@/components/ward-management/ward-management-console";
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
 * CHECKED and then asserted. That is why the cast below sits AFTER the `startsWith` guard and
 * nowhere else.
 *
 * ⚠️ **THE WRONG-SHAPED CASE USED TO CAST TOO, AND IT LIED.** `MovementId` is the template literal
 * type `` `WF-${string}` ``, so the bare string `"WF-"` satisfies it — and this route passed
 * exactly that as a sentinel, which the workspace's not-found sentence then quoted. `/movements/
 * PT-004` rendered *No synthetic movement matches “WF-”*: an id the user never typed, quoted back
 * at them, well-typed enough that `tsc` had nothing to say and asserted by no test. It now renders
 * the not-found screen directly with the text that was actually requested, and says the true
 * thing about it — that it is not a movement id at all, which is a different fact from there being
 * no such movement.
 */
export default async function WardMovementPage({ params }: { params: Promise<{ movementId: string }> }) {
  const { movementId } = await params;
  const id = decodeURIComponent(movementId);
  if (!id.startsWith("WF-")) {
    return <WardMovementNotFound requestedId={id} reason="not-a-movement-id" />;
  }
  return <WardPatientWorkspace movementId={id as MovementId} />;
}
