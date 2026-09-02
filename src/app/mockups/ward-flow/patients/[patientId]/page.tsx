import { permanentRedirect } from "next/navigation";

/**
 * A COMPATIBILITY REDIRECT, NOT A SURFACE. `/mockups/ward-flow/patients/[patientId]` was this
 * prototype's movement workspace, and the value in its `patientId` segment was always a MOVEMENT
 * id — the mismatch its two successors were split apart to fix. The workspace now lives at
 * `/mockups/ward-flow/movements/[movementId]`, and the person record, which never had a route of
 * its own, lives at `/mockups/ward-flow/people/[patientId]`.
 *
 * ⚠️ THIS FILE EXISTS BECAUSE DELETING IT WAS THE WRONG SHAPE OF CHANGE, and the gate said so
 * before a human did. `/mockups/ward-flow` is Tier B in `docs/mockup-retirement-policy.md` —
 * live in production behind `DeveloperAreaGate` — so removing one of its routes is a product
 * decision that policy places outside the cleanup gate entirely, with no record that can satisfy
 * it. `check:mockups --diff auto` refused the deletion for exactly that reason, and it was right
 * to: an address that worked yesterday stopped existing, with seven inbound links and a set of
 * documents still naming it.
 *
 * A redirect is the answer that costs nothing and loses nothing. The old address keeps working,
 * every bookmark and document reference still resolves, and the rename is still complete — the
 * name that was wrong is simply no longer the one anything lands on. The policy names
 * compatibility redirects as a legitimate Tier C survivor, so this is an idiom the repository
 * already keeps rather than an exemption invented to get a gate green.
 *
 * Deleting this stub is a product decision for the owner, not cleanup. It is the whole reason the
 * gate refuses.
 */
export default async function WardPatientRedirect({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  const id = decodeURIComponent(patientId);
  // A person id routes to the person; anything else was a movement id, which is what this address
  // has always actually carried. Both destinations validate the shape themselves, so an id that is
  // neither still lands on a screen that says so rather than on a dead end.
  const destination = id.startsWith("PT-")
    ? `/mockups/ward-flow/people/${encodeURIComponent(id)}`
    : `/mockups/ward-flow/movements/${encodeURIComponent(id)}`;
  permanentRedirect(destination);
}
