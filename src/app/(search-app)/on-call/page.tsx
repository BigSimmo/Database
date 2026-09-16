import type { Metadata } from "next";

import { OnCallHome } from "@/components/on-call/on-call-home";

export const metadata: Metadata = {
  title: "On Call | PsychSift",
  description: "Tonight's numbers, escalation, teaching and logistics, in one place.",
};

/**
 * The On Call mode home.
 *
 * This route used to be a redirect stub forwarding to the shared home at
 * `/?mode=on-call`, which every consolidated mode does. On Call left that map:
 * the shared home is a search home, and this mode declares no search surface —
 * so the redirect was sending readers to the one page in the mode that shows a
 * composer. `/tools`, `/favourites` and `/medications` are absent from the same
 * map for the same class of reason: each is its mode's only functional surface.
 */
export default function OnCallHomeRoute() {
  return <OnCallHome />;
}
