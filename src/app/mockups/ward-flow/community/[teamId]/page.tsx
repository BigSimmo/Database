import type { Metadata } from "next";

import { CommunityScreen } from "@/components/ward-management/community/community-screen";

export const metadata: Metadata = {
  title: "Community team — Ward Flow",
  description: "Synthetic single-team community mental health view for the Ward Flow prototype.",
};

/**
 * The route that makes the community hub reachable. It supplies the team id and nothing else.
 *
 * ⚠️ **It must never pass `admissions` or `referrals`.** `CommunityScreen` accepts both as optional
 * overrides so a test can render populations the seed cannot produce, and both fall back to
 * `useWardFlow()`. A route that passed either would pin the screen to a fixture and quietly
 * override live state — the same class of defect as a duration computed from a re-anchored clock
 * against a frozen seed, which inflated every wait on two screens in this project.
 *
 * ⚠️ **An unknown team id is the screen's decision, not this route's.** `communityTeamById` returns
 * nothing for an id it does not hold and the screen renders its own not-found state, which says in
 * plain words that it never falls back to a different team. This route therefore does no lookup and
 * no validation: showing one area's patients under another area's name is the worst answer
 * available here, and the only way to guarantee it cannot happen is to leave the resolution in the
 * one place that refuses it.
 *
 * The id is decoded because a team id reaches this file percent-encoded in the URL, and
 * `communityTeamHref` in `community-screen.tsx` is the single place the outgoing link is built.
 */
export default async function CommunityTeamPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  return <CommunityScreen teamId={decodeURIComponent(teamId)} />;
}
