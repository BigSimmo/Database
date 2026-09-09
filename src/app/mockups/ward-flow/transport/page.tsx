import { redirect } from "next/navigation";

/**
 * MERGE 03 (owner-approved 2026-09-05, `docs/superpowers/specs/2026-09-05-ward-flow-merges-1-3-design-lock.md`
 * §2) folded the live vehicle tracker into `MovementsScreen` — the same movements, on the same
 * board, without a second view asking "where is everyone right now" a second way. This route
 * stays as a bookmark/deep-link backstop so an existing link to the transport tracker does not
 * 404, matching the precedent already set by `queue/page.tsx` (MERGE 01) and `morning/page.tsx`
 * (MERGE 02).
 *
 * `transport/officer` is a separate, nested route (`transport/officer/page.tsx`) and is
 * unaffected by this redirect — Next.js resolves it as its own page.tsx, not as a child of this
 * one. It is a different person doing four things on a phone; the design lock is explicit that
 * folding it in would ruin the one screen that must work one-handed.
 */
export default function WardTransportRedirect() {
  redirect("/mockups/ward-flow/movements");
}
