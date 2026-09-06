// src/components/ward-management/community/community-team-hub.tsx
import { communityTeamOptions } from "@/components/ward-management/referrals/referral-destination-options";
import { WardChip, type WardChipLevel } from "@/components/ward-management/ward-chip";
import type { Instant } from "@/components/ward-management/ward-clock";
import { splitDuration } from "@/components/ward-management/ward-clock";
import type { CommunityScopedReferral } from "@/components/ward-management/ward-referral-visibility";

import styles from "./community-team-hub.module.css";

/**
 * The team a URL segment names. Deliberately a LOCAL, duplicated slug function rather than an
 * import of `communityTeamSlug`/`communityTeamById` from `community-derivations.ts`.
 *
 * That file also exports `admissionBelongsToTeam`, which takes a `referrals: readonly Referral[]`
 * parameter, and its own top-level `import type { Referral }` would be dragged into THIS module's
 * transitive graph the moment anything here imports the file at all — regardless of which named
 * export is actually used. `tests/ward-referral-screen-boundary.test.ts` walks the whole module
 * graph, not just the identifiers a file happens to reference, so importing from that file would
 * put a `Referral`-naming import inside the guarded set this component now belongs to. Three lines
 * of duplicated, independently-testable slug logic keep this file's own dependency graph free of
 * anything reached only for a predicate elsewhere — the same "duplicate the small derivation"
 * discipline `tests/ward-community-team-count.test.ts` already uses for `communityTeamKey`.
 */
function teamSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function teamNameForId(teamId: string): string | null {
  return communityTeamOptions().find((name) => teamSlug(name) === teamId) ?? null;
}

const STATE_CHIP_LEVEL: Record<CommunityScopedReferral["addressing"]["state"], WardChipLevel> = {
  queued: "routine",
  accepted: "accepted",
  declined: "stalled",
  cancelled: "cancelled",
};

const STATE_WORDS: Record<CommunityScopedReferral["addressing"]["state"], string> = {
  queued: "Awaiting first contact",
  accepted: "Accepted",
  declined: "Declined",
  cancelled: "Cancelled — somebody else has accepted this referral",
};

/**
 * THE COMMUNITY ROLE'S OWN LANDING FOR ONE TEAM.
 *
 * Owner ruling, 2026-09-04: community becomes its own first-class role, and a community team may
 * NOT see that a patient was referred anywhere else — the same restriction FD-23 (2026-08-30)
 * already gives a ward. This component takes ONLY `CommunityScopedReferral[]` — the projection with
 * no `destinations` field — and must never import `Referral`, `ReferralAddressing`,
 * `CoordinatorScopedReferral`, `coordinatorScopedReferral(s)`, `coordinatorWorklistReferrals`, or
 * any function that returns the full record. `tests/ward-referral-screen-boundary.test.ts` checks
 * this file by name (`WARD_FACING`); `tests/ward-community-viewer-assumption.test.ts` pins the
 * projection's own shape.
 *
 * ⚠️ **DELIBERATELY NOT `useWardFlow()`, EVEN THOUGH EVERY OTHER SCREEN CALLS IT.** The boundary
 * guard's own vector-3 check forbids a ward/community-only module from destructuring `referrals`
 * off that context at all — the RAW array, whatever is done with it afterwards — because that read
 * is invisible to every import-graph check and is the "no import graph can see this one" vector its
 * own comment names. So the projection happens OUTSIDE this component (in whatever calls it, which
 * is free to see the full record because it is not itself ward/community-facing), and this file
 * receives an already-narrowed `readonly CommunityScopedReferral[]` as a plain prop. That also means
 * `now` — this screen's only other input — arrives the same way, as an `Instant`, not from context.
 *
 * NOT a variant of `community-home.tsx`'s drill-down into the same team. The two can render the
 * same team at the same moment and are not the same screen — see the build plan's Task 3b and
 * `community-home.tsx`'s own doc comment for why the visual resemblance is exactly the reason the
 * two must never share a component or a data type. Its own addressing may read "cancelled" — so a
 * team can infer THAT the patient went somewhere, never where, never to whom, never how many places
 * were tried. That is the owner's stated intent, not a hole in this component.
 */
export function CommunityTeamHub({
  teamId,
  referrals,
  now,
}: {
  teamId: string;
  referrals: readonly CommunityScopedReferral[];
  now: Instant;
}) {
  const teamName = teamNameForId(teamId);
  const forThisTeam =
    teamName === null ? [] : referrals.filter((referral) => referral.addressing.destination.teamName === teamName);

  if (teamName === null) {
    return (
      <main className={styles.hub}>
        <h1>Unknown team</h1>
        <p>No community team matches this id.</p>
      </main>
    );
  }

  return (
    <main className={styles.hub}>
      <h1>{teamName}</h1>
      <p className={styles.covers}>
        This team&apos;s own referrals — never another team&apos;s, and never where else a patient may also have been
        referred.
      </p>
      <ul className={styles.rows}>
        {forThisTeam.length === 0 ? (
          <li>Nothing is currently referred to this team.</li>
        ) : (
          forThisTeam.map((referral) => (
            <li key={referral.id}>
              <span className={styles.id}>{referral.id}</span>
              <WardChip level={STATE_CHIP_LEVEL[referral.addressing.state]}>
                {STATE_WORDS[referral.addressing.state]}
              </WardChip>
              {referral.addressing.state === "queued" ? (
                <span className={styles.wait}>{splitDuration(Math.max(now - referral.raisedAt, 0))} waiting</span>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </main>
  );
}
