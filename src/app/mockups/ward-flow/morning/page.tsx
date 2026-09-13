import { redirect } from "next/navigation";

/**
 * MERGE 02 (owner-approved 2026-09-05, `docs/superpowers/specs/2026-09-05-ward-flow-merges-1-3-design-lock.md`
 * §2) folded the morning bed state board into the Capacity screen — the same figures, on the same
 * frozen-versus-live axis, without a second board asking the same "what does the network look like
 * right now" question a second way. This route stays as a bookmark/deep-link backstop so an
 * existing link to the morning board does not 404, matching the precedent already set by
 * `queue/page.tsx` (MERGE 01) and `constellation/page.tsx`.
 *
 * The design lock's redirect table names the target as `/mockups/ward-flow/capacity?as-at=morning`,
 * carrying the frozen-to-08:00 intent forward as a query parameter. `CapacityScreen` does not read
 * that parameter yet — no "as-at" behaviour has been built — so this redirects to the bare path
 * rather than inventing a query-parameter behaviour nobody has implemented. Wiring `?as-at=morning`
 * up is separate follow-on work.
 */
export default function WardMorningRedirect() {
  redirect("/mockups/ward-flow/capacity");
}
