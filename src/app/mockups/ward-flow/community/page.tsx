import type { Metadata } from "next";

import { CommunityIndex } from "@/components/ward-management/community/community-index";

export const metadata: Metadata = {
  title: "All community teams — Ward Flow",
  description:
    "Synthetic community team index for the Ward Flow prototype — every team a referral can name, listed alphabetically, each linking to its own team page.",
};

/**
 * The index route for the community hub, sitting directly above `community/[teamId]`.
 *
 * The URL is the parent of the team pages on purpose: the front door to a set of pages belongs at
 * the path those pages hang off, so a coordinator who deletes a team id from the address bar arrives
 * at the list rather than at a 404.
 *
 * It takes no params and passes no props. `CommunityIndex` accepts an optional `teams` override as a
 * testing seam — the empty list is a state the derived source cannot produce — and a route that
 * passed it would pin the page to a fixture, the same class of defect `community/[teamId]/page.tsx`
 * records for `admissions` and `referrals`.
 *
 * **This route is registered in `ward-nav.ts`'s `WARD_NAV` list, under the id "community", and the
 * root rail links it** — the condition this page exists to remove is closed, not open.
 * `tests/ward-community-index.dom.test.tsx` asserts the root rail links this index as an ordinary
 * passing assertion; it started life as an `it.fails` tripwire and was flipped once the nav entry
 * landed, and that test's own comment records why the response to a tripwire going red is never to
 * restore it.
 */
export default function CommunityIndexPage() {
  return <CommunityIndex />;
}
