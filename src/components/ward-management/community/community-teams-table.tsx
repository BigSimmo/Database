// src/components/ward-management/community/community-teams-table.tsx
import { S2015_CATCHMENT_ROWS, parseFollowUpClinicSet } from "@/components/ward-management/ward-catchment";
import { WardPanel } from "@/components/ward-management/ward-panel";

import styles from "./community-teams-table.module.css";

/**
 * The same normalisation `communityTeamOptions()` (`referral-destination-options.ts`) uses to merge
 * spelling variants of one clinic into one team — case, whitespace and punctuation folded to a
 * single space. Duplicated rather than imported: that function's own key builder is unexported, and
 * `tests/ward-community-team-count.test.ts` already establishes the pattern this repository uses for
 * checking a derived count — a second, independent derivation over the same source rows, rather than
 * trusting the production function not to have silently narrowed.
 */
function communityTeamKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Every distinct community team the source catchment table names, mapped to how many suburbs route
 * to it — keyed the same way `communityTeamOptions()` merges spellings, so a name from that list
 * resolves to the right count here.
 *
 * ⚠️ **THERE IS NO "16 TEAMS" ANYWHERE IN THIS REPOSITORY.** The approved design prototype
 * (`docs/ward-flow/design/prototypes/community-home.html`) states "16 teams... 537 suburbs" as real
 * data, and it measures wrong against this checkout: the only real, derivable team list is every
 * distinct follow-up clinic `S2015_CATCHMENT_ROWS` names, which is **65** today (confirmed against
 * `communityTeamOptions()`'s own count, the same number `tests/ward-community-team-count.test.ts`
 * derives independently), not 16. The prototype's 16 is a curated metro/south-west subset with no
 * documented selection rule anywhere in `docs/ward-flow-catchment-data.md` — dropping the other 49
 * (mostly WACHS regional teams: Geraldton, Kalgoorlie, Narrogin, Broome and the rest) to match it
 * would be inventing an editorial decision this repository has never made. So every team the source
 * table names is counted and listed, and the real, current count is what renders — 65, not 16.
 */
export function suburbCountsByTeam(): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const row of S2015_CATCHMENT_ROWS) {
    for (const clinic of parseFollowUpClinicSet(row.followUpClinicVerbatim)) {
      const key = communityTeamKey(clinic);
      if (key === "") continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

/** The count for one team name, using the same key `suburbCountsByTeam` builds. `0` only if the
 *  name genuinely names no suburb — every name drawn from `communityTeamOptions()` has at least
 *  one, since that is how the name was derived in the first place. */
export function suburbCountForTeam(teamName: string, counts: ReadonlyMap<string, number>): number {
  return counts.get(communityTeamKey(teamName)) ?? 0;
}

/**
 * One row's already-known facts. `waitingCount` is a plain number, never a referral — see
 * `community-figures.tsx`'s doc comment on why a component reachable from more than one role may
 * only carry primitives, never referral-shaped data.
 */
export type CommunityTeamRow = {
  readonly teamId: string;
  readonly teamName: string;
  readonly suburbCount: number;
  readonly waitingCount: number;
};

/**
 * The all-teams table — the filter. One row per real community team, each an "Open hub" control
 * away from that team's own scope.
 *
 * A zero `waitingCount` renders as the word **"none"**, never the digit `0` — *"a nought reads as a
 * measurement; 'none' reads as a state,"* the same distinction `ward-chip.tsx` holds for coloured
 * state generally.
 */
export function CommunityTeamsTable({
  rows,
  onOpenTeam,
}: {
  rows: readonly CommunityTeamRow[];
  onOpenTeam: (teamId: string) => void;
}) {
  return (
    <WardPanel title="All community teams" count={`${rows.length} teams`}>
      <div className={styles.tableWrap}>
        <table className={styles.teams}>
          <caption>
            Every community team the source catchment table names, ordered as supplied. Suburb counts are real, drawn
            from the catchment table; waiting counts are each team&apos;s own live state.
          </caption>
          <thead>
            <tr>
              <th scope="col">Team</th>
              <th scope="col">Suburbs</th>
              <th scope="col">Waiting</th>
              <th scope="col">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.teamId}>
                <td>{row.teamName}</td>
                <td className={styles.n}>{row.suburbCount}</td>
                <td className={styles.n}>
                  {row.waitingCount === 0 ? <span className={styles.zero}>none</span> : row.waitingCount}
                </td>
                <td>
                  <button type="button" className={styles.open} onClick={() => onOpenTeam(row.teamId)}>
                    Open hub
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </WardPanel>
  );
}
