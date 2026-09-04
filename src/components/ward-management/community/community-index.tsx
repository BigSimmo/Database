"use client";

import Link from "next/link";

import { COMMUNITY_TEAM_PAGES, type CommunityTeam } from "@/components/ward-management/community/community-derivations";
import { communityTeamHref } from "@/components/ward-management/community/community-screen";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";

import styles from "./community-index.module.css";

/**
 * THE COMMUNITY TEAM INDEX — the front door to `community/[teamId]`.
 *
 * **Why it exists.** That dynamic route serves one page per team in `COMMUNITY_TEAM_PAGES`, and
 * before this page existed **nothing linked to it from anywhere a person could get to**.
 * `community-screen.tsx` renders an "Other community teams" switcher that links every team but the
 * one you are looking at, which only helped somebody already standing on a team page — and the way
 * onto a team page was to type its address. Every one of those pages had a single entry condition,
 * and that condition was knowing a URL. This page is what closes that.
 *
 * ⚠️ **NO COUNT OF TEAMS IS WRITTEN INTO THIS COMMENT, AND THAT IS DELIBERATE.** An earlier draft
 * named the size of the derived list, in words, more than once. It was true the day it was written,
 * it is a property of the seed rather than of this page, and nothing would have gone red when the
 * seed changed — the exact class of sentence `statistics-derivations.ts` records as having falsified
 * itself silently four times on one paragraph. The list is derived, so the derivation is the only
 * honest answer to "how many"; a count that is RENDERED from live state is fine, and a count typed
 * into prose is the defect. `tests/ward-community-index.test.ts` scans this comment for a numeral
 * or a spelled-out count and records why the size pin belongs to the fixture's own suite, not here.
 *
 * ⚠️ **THE INDEX'S OWN REACHABILITY IS THE POINT, NOT A DETAIL.** An index that links every derived
 * team confers none of that reachability on any of them unless the index is itself reachable.
 * Reachability is transitive: a page that is not itself reachable passes none of it on to what it
 * links. This page's own reachability is no longer in question — it is registered in `ward-nav.ts`'s
 * `WARD_NAV` list under the id "community", and the root rail renders that entry.
 * `tests/ward-community-index.dom.test.tsx` proves it, as an ordinary passing assertion now rather
 * than the inverted `it.fails` tripwire it started life as; that test's own comment records why the
 * response to a tripwire going red is to delete the `.fails`, and never to bring it back.
 *
 * ⚠️ **ONE FLAT, ALPHABETICAL LIST. THE ABSENCE OF GROUPING IS ENFORCED BY THE TYPE, AND THE PAGE
 * SAYS SO OUT LOUD.** `CommunityTeam` is `{ id, name }` and nothing else, and
 * `community-derivations.ts` records that the missing `region` field is "enforcement rather than
 * tidying: a screen cannot fall back to region-derived membership if no team here knows a region".
 * The region-keyed `COMMUNITY_TEAMS` table in `ward-teams.ts` is deliberately not read by this hub,
 * for the same reason, and is not read here either. `id` is a slug derived from `name`, so it is not
 * an independent field to group on. That leaves exactly two ways to render a grouped index: read a
 * table this code is barred from, or invent a category — and an invented category on this prototype
 * reads to a coordinator as a real one.
 *
 * So the page states, in its own copy rather than only in this comment, that the teams are listed
 * alphabetically **because the record holds a name and nothing else to group by**. That sentence is
 * the honest version of the grouping that was asked for. Two chats recommended grouping by health
 * service before anybody read the type; the sentence is the record of what reading it settled.
 *
 * **Deliberately not a second caseload board.** No count of people, no discharges, no waiting
 * figure, nothing this page renders answers a question a team's own page already answers. That is
 * `ward-index.tsx`'s ruling applied here verbatim: "Two surfaces answering one question in wording
 * that can drift is this project's most reliable defect." A team's name and a link cannot drift
 * against a figure, because neither is a figure.
 *
 * **Enumerated, never listed.** The teams come from `COMMUNITY_TEAM_PAGES`, which derives from the
 * referral picker's own vocabulary — a team reaches this page by appearing in the catchment source
 * and by nothing else. A hand-written list of teams here would be a second home for that vocabulary
 * and would silently disagree with it the first time the source document is replaced.
 *
 * **A client component**, and not for a hook — this file uses none. `communityTeamHref` lives in
 * `community-screen.tsx`, which is `"use client"`, and every export of a client module reaches a
 * Server Component as a client *reference* rather than as a callable function. A server component
 * calling it would typecheck, pass every unit test, and throw on the first real request. Reusing the
 * one href builder is a hard requirement of this task, so the boundary moves rather than the builder.
 */
export function CommunityIndex({ teams = COMMUNITY_TEAM_PAGES }: { teams?: readonly CommunityTeam[] }) {
  // Sorted here rather than trusted from upstream. `communityTeamOptions()` happens to return its
  // names sorted today, but this page is the surface making the alphabetical CLAIM — in its own
  // copy, on screen — and a claim held somewhere else is a claim that can be withdrawn without
  // anybody editing the page that makes it. The id tie-break keeps the order total: `localeCompare`
  // can rank two distinct names equal, and an unstable order on an index is a team that appears to
  // move between renders.
  const ordered = [...teams].sort(
    (left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
  );

  return (
    <div className={styles.screen} data-testid="community-index">
      <ClinicalRail />
      <main id="main-content" className={styles.main}>
        <div className={styles.governanceBanner} data-testid="community-index-governance">
          <span className={styles.prototypeBadge}>Synthetic prototype</span>
          <p>
            This page is <strong>not a medical device</strong>. Every team listed here comes from one extracted source
            document, no team has agreed to be represented, and nothing on this page has been checked against a real
            service.
          </p>
        </div>

        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>All community teams</h1>
          <p className={styles.pageSubtitle}>
            Every community team a referral can name in this prototype, listed alphabetically.
          </p>
        </header>

        {/*
         * The two sentences this page exists to say, on the page rather than only in the source.
         * The first is the missing grouping, stated as the fact that produced it. The second is what
         * this list is not — a reader arriving at a list of every community team reasonably expects
         * it to tell them how busy each one is, and saying plainly that it does not is cheaper than
         * having them infer a caseload from an absence of numbers.
         */}
        <p className={styles.provenance} data-testid="community-index-provenance">
          These teams are listed alphabetically because the record holds a team&apos;s name and nothing else to group
          by. There is no region, service or catchment on a team here, so any grouping on this page would be one this
          prototype invented rather than one the record supports.
        </p>

        <p className={styles.provenance} data-testid="community-index-restraint">
          This is a way in, not a caseload. It shows each team&apos;s name and links to it — no counts of people, no
          discharges and nothing about who a team is following up. A team&apos;s own page answers those questions for
          that team.
        </p>

        <section className={styles.section} data-testid="community-index-teams">
          <h2 className={styles.sectionHeading}>Community teams</h2>
          {ordered.length === 0 ? (
            /*
             * An empty list is rendered as a stated absence, never as an empty list. A blank list
             * looks exactly like a loaded page for a service with no teams, and nobody re-checks a
             * blank — so the page has to say which of the two it is. It says only what is
             * observable: the derivation returned nothing. It does NOT name a cause, because
             * nothing here can see one.
             */
            <div className={styles.emptyNotice} data-testid="community-index-empty">
              <p>
                <strong>This list is empty.</strong> Every team on this page is derived from the vocabulary a referral
                can name, so an empty list means that derivation returned no teams.
              </p>
              <p>
                It does not mean this prototype has no community teams, and nothing on this page has checked whether any
                exist. Read it as a page that found nothing, not as a service that has nothing.
              </p>
            </div>
          ) : (
            <ul className={styles.teamList}>
              {ordered.map((team) => (
                <CommunityTeamLink key={team.id} team={team} />
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

/**
 * One team, one link. `<Link>` and never a raw anchor — internal navigation in this repository goes
 * through the router.
 *
 * The href comes from `communityTeamHref` in `community-screen.tsx` rather than from a second
 * builder written here. One route, one place that names it: a second builder is how an index and a
 * team switcher come to point at two different URL shapes, and the failure would be a 404 on this
 * page while every test that iterates the list stays green.
 *
 * Nothing but the name is rendered. `id` is a slug of the name, so showing it would be the same fact
 * twice in two spellings, and there is no third field on the record to show.
 */
function CommunityTeamLink({ team }: { team: CommunityTeam }) {
  return (
    <li className={styles.teamItem}>
      <Link className={styles.teamLink} href={communityTeamHref(team)} data-testid="community-index-link">
        <span className={styles.teamName}>{team.name}</span>
      </Link>
    </li>
  );
}
