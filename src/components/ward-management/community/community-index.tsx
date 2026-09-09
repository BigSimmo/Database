"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";

import {
  COMMUNITY_TEAM_PAGES,
  communityTeamSlug,
  type CommunityTeam,
} from "@/components/ward-management/community/community-derivations";
import { communityTeamHref } from "@/components/ward-management/community/community-screen";
import {
  communityNameCollisions,
  communityNamesInCollisions,
  type CommunityNameCollision,
} from "@/components/ward-management/community/community-vocabulary";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { createBrowserStore } from "@/lib/client-store-factory";

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
 * reads to a coordinator as a real one. The gateway redesign below breaks this same flat list into
 * letter-headed sections with a jump rail, which is presentation over the alphabet, not a category:
 * every team still reaches the page by name alone, and the letter it lands under is read off that
 * same name rather than assigned by anything this page invented.
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
 * **A client component.** It used to need no hooks; the gateway redesign below added live search,
 * jump-navigation and a localStorage-backed recent list, all of which are hooks, so this boundary is
 * now doing double duty rather than an unused formality. `communityTeamHref` lives in
 * `community-screen.tsx`, which is `"use client"`, and every export of a client module reaches a
 * Server Component as a client *reference* rather than as a callable function. A server component
 * calling it would typecheck, pass every unit test, and throw on the first real request. Reusing the
 * one href builder is a hard requirement of this task, so the boundary moves rather than the builder.
 */

/**
 * THE GATEWAY REDESIGN, 2026-09-05 — approved prototype at
 * `docs/ward-flow/design/prototypes/mockup-community-gateway-v1.html`. This file reproduces that
 * mockup's structure and behaviour in React, over the app's own token layer; it does not change
 * what the mockup decided.
 *
 * ⚠️ **THE ONE RULE THIS FILE MUST NEVER BREAK: THIS PAGE COMPUTES NO "READS ALIKE" GROUPING OF ITS
 * OWN.** The mockup's own vanilla-JS prototype derives near-duplicate names inline, and its own
 * comments record two live bugs that derivation produced — a missing service-word ("clinic",
 * "centre") and a length-gated distance band that silently dropped the very misspelling it existed
 * to catch. Both were found only because a SECOND implementation existed to disagree with. This
 * page is that second implementation's replacement: it reads `communityNameCollisions()`,
 * `communityNamesInCollisions()` and `namesAreNearDuplicates()`-derived groupings from
 * `community-vocabulary.ts` and nothing else. If that shared function ever disagrees with what the
 * mockup shows, the shared function wins — that is the whole point of having one derivation feed
 * every surface, and it is an owner ruling, not a style preference.
 *
 * **What is new here, matched to the mockup:** a live search box with a rendered match count and a
 * "/" shortcut; an A–Z jump rail whose disabled letters say why in words; letter-headed sections of
 * rows in place of the old flat `<ul>` of boxes; a "reads like N others" marker — never "did you
 * mean" — on every row whose name collides, opening a collapsible panel that lists each family side
 * by side; and a "recently opened" strip backed by `localStorage`, wrapped in `try`/`catch` on every
 * read and write because it throws in a private or storage-restricted context.
 *
 * **The marker never implies sameness, and an absent one is stated as not proving uniqueness.**
 * Both are TRUTH rules from the owner, not wording preferences: this page marks a name that reads
 * like another, it never merges, corrects or de-duplicates one, and it says so in words in the
 * provenance copy below.
 *
 * ⚠️ **THE PROVENANCE COPY NAMED `ICC` AS ITS EXAMPLE UNTIL 2026-09-05, AND THE EXAMPLE HAD TO GO
 * BEFORE IT BECAME A LIE.** It read that `ICC` carries no marker because no rule flags an
 * initialism — true of the string rules, and about to be false of the page. The owner confirmed
 * that day that `ICC`, `Inner City`, `Inner City Clinic` and `Inner City (central)` are ONE
 * service across 21 suburbs, so an owner-confirmed alias list will record them as the same. **A
 * screen teaching a reader that `ICC` is unmatched, while it is matched, is worse than the gap it
 * was describing.** The copy now states the MECHANISM — the check compares spellings, so an
 * abbreviation or a renaming is invisible to it — which stays true either side of that landing,
 * and points at the human decision rather than at one name whose status can change underneath it.
 * `tests/ward-community-collision-coverage.test.ts` pins `ICC` as unmatched BY THE RULES, and is
 * meant to go red when the alias list lands: it is the thing that makes whoever lands it come and
 * read this paragraph. Fix the copy, never the pin.
 *
 * **Two counts are rendered here that are not typed anywhere as prose**: the search result line and
 * the two chip counts. Every one of them reads off `allTeams`/`filteredTeams`/the collision map at
 * render time, the same discipline the surrounding doc comment already holds this file to for the
 * team count itself.
 */
export function CommunityIndex({ teams = COMMUNITY_TEAM_PAGES }: { teams?: readonly CommunityTeam[] }) {
  // Sorted here rather than trusted from upstream. `communityTeamOptions()` happens to return its
  // names sorted today, but this page is the surface making the alphabetical CLAIM — in its own
  // copy, on screen — and a claim held somewhere else is a claim that can be withdrawn without
  // anybody editing the page that makes it. The id tie-break keeps the order total: `localeCompare`
  // can rank two distinct names equal, and an unstable order on an index is a team that appears to
  // move between renders.
  const allTeams = useMemo(
    () => [...teams].sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)),
    [teams],
  );

  // One call to the shared derivation, indexed by name for O(1) lookup per row. `communityNameCollisions()`
  // re-derives from the catchment rows on every call (its own doc comment says so), so it is called
  // once here and once below for the family panel's own totals — never re-implemented.
  const collisionByName = useMemo(() => {
    const map = new Map<string, CommunityNameCollision>();
    for (const collision of communityNameCollisions()) {
      for (const entry of collision.names) map.set(entry.name, collision);
    }
    return map;
  }, []);

  // The family panel is deliberately NOT scoped to the `teams` prop: it is the same derivation
  // regardless of which subset of pages a caller happens to be rendering (a test overriding `teams`
  // to `[]` still gets an honest, real family panel rather than an empty one that looks like a
  // measurement of the override).
  const familyGroups = useMemo(() => communityNameCollisions(), []);

  const [query, setQuery] = useState("");
  const [alikeOnly, setAlikeOnly] = useState(false);

  // `useSyncExternalStore` (via `createBrowserStore`, module scope below), not a `useState` fed
  // from an effect: an effect that calls `setState` in its own body — which is exactly what a
  // "load once after mount" effect does — trips `react-hooks/set-state-in-effect`, and rightly so,
  // since it is really a subscription to state that lives outside React. This also renders under
  // `renderToStaticMarkup` in several test files, which never runs effects OR subscribes, so the
  // server snapshot (an empty list) is what those tests see — exactly the honest "nothing opened
  // yet" state a server-rendered first paint should have anyway.
  const recentNames = useRecentTeamNames();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const familyPanelRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "/" && document.activeElement !== searchInputRef.current) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Imperative rather than a controlled `open` state: this only ever needs to force the panel OPEN
  // from a row's marker, never to close it, and a controlled boolean would have to track the
  // reader's own toggle clicks too just to stay in sync with the native element.
  const openFamilyPanel = useCallback(() => {
    const panel = familyPanelRef.current;
    if (!panel) return;
    panel.open = true;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    panel.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }, []);

  // `document.getElementById` rather than a ref map: the set of letters is not fixed (it depends on
  // what the current search leaves visible), so a ref map would have to be rebuilt on every filter
  // change for no benefit over an id lookup that already has to happen at click time regardless.
  const jumpToLetter = useCallback((letter: string) => {
    const heading = document.getElementById(letterHeadingId(letter));
    if (!heading) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    heading.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    heading.focus();
  }, []);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredTeams = useMemo(
    () =>
      allTeams.filter((team) => {
        if (alikeOnly && !collisionByName.has(team.name)) return false;
        if (normalizedQuery && !team.name.toLowerCase().includes(normalizedQuery)) return false;
        return true;
      }),
    [allTeams, alikeOnly, normalizedQuery, collisionByName],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, CommunityTeam[]>();
    for (const team of filteredTeams) {
      const letter = team.name.charAt(0).toUpperCase();
      const bucket = map.get(letter);
      if (bucket) bucket.push(team);
      else map.set(letter, [team]);
    }
    return map;
  }, [filteredTeams]);

  // Scoped to `allTeams`, not to the full real derivation: this is the count the "Names that read
  // alike" CHIP shows, and the chip is a filter over `allTeams`, so its own count should describe
  // what that filter will actually show rather than a figure from a different population.
  const namesInCollisionsAmongAll = useMemo(
    () => allTeams.filter((team) => collisionByName.has(team.name)).length,
    [allTeams, collisionByName],
  );

  return (
    <div className={styles.screen} data-testid="community-index">
      <ClinicalRail />
      <main id="main-content" className={styles.main}>
        {/*
         * ⚠️ THE OWNER ASKED FOR THE WARNING TEXT OFF THE TOP OF THIS PAGE, 2026-09-05, AND NONE OF
         * IT WAS DELETED. A cream banner and three dense paragraphs stood between the heading and
         * the first team, which is what he was looking at. Every sentence still renders, in
         * `<footer>` at the end of this component, under "About this list" — same testids, same
         * words, so the guards that police them are untouched and a reader who wants the caveats
         * still finds them all in one place.
         *
         * **What did NOT move is the not-a-medical-device statement.** It is one quiet line in the
         * header now rather than a filled banner, because burying THAT one at the foot of a
         * clinical page would be trading a real safety statement for tidiness. Removing the colour
         * was the ask; removing the sentence was not.
         */}
        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>All community teams</h1>
          <p className={styles.pageSubtitle}>
            Every community team a referral can name in this prototype. Search for one by name, or browse the list.
          </p>
          <p className={styles.pageSubtitle}>
            The counts on this page are counts of <strong>names</strong>, not of services. Some of these names are the
            same team spelled more than one way, so the number of real services is smaller than the number of entries —
            and this page cannot say how much smaller.
          </p>
          <p className={styles.prototypeNote} data-testid="community-index-governance">
            <span className={styles.prototypeBadge}>Synthetic prototype</span>
            This page is <strong>not a medical device</strong>. Every team listed here comes from one extracted source
            document, no team has agreed to be represented, and nothing on this page has been checked against a real
            service.
          </p>
        </header>

        <div className={styles.toolbar}>
          <div className={styles.searchRow}>
            <div className={styles.searchBox}>
              <label className={styles.searchField}>
                <Search aria-hidden="true" className={styles.searchIcon} />
                <input
                  ref={searchInputRef}
                  type="search"
                  className={styles.searchInput}
                  placeholder={'Search team names — try "wheat", "alma", "goldfield"'}
                  autoComplete="off"
                  aria-label="Search team names"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape" && query) {
                      event.stopPropagation();
                      setQuery("");
                    }
                  }}
                />
              </label>
              {query ? (
                <button
                  type="button"
                  className={styles.clearButton}
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery("");
                    searchInputRef.current?.focus();
                  }}
                >
                  Clear
                </button>
              ) : null}
              <kbd className={styles.kbdHint} aria-hidden="true">
                /
              </kbd>
            </div>

            <div className={styles.chips} role="group" aria-label="Filter the list">
              <button
                type="button"
                className={styles.chip}
                aria-pressed={!alikeOnly}
                onClick={() => setAlikeOnly(false)}
              >
                All names <span className={styles.chipCount}>{allTeams.length}</span>
              </button>
              <button type="button" className={styles.chip} aria-pressed={alikeOnly} onClick={() => setAlikeOnly(true)}>
                Names that read alike <span className={styles.chipCount}>{namesInCollisionsAmongAll}</span>
              </button>
            </div>
          </div>

          <p className={styles.resultLine} aria-live="polite" data-testid="community-gateway-result-line">
            <strong>{filteredTeams.length}</strong> of {allTeams.length} names shown
            {alikeOnly ? " — only entries whose name reads like another" : ""}
            {normalizedQuery ? ` — matching "${query.trim()}"` : ""}
          </p>
        </div>

        <div className={styles.body}>
          <nav className={styles.azRail} aria-label="Jump to letter">
            {ALPHABET.map((letter) => {
              const present = grouped.has(letter);
              return (
                <button
                  key={letter}
                  type="button"
                  className={styles.azRailButton}
                  disabled={!present}
                  aria-label={present ? undefined : `No team starts with ${letter}`}
                  onClick={present ? () => jumpToLetter(letter) : undefined}
                >
                  {letter}
                </button>
              );
            })}
          </nav>

          <div className={styles.content}>
            <section className={styles.recentStrip} aria-label="Recently opened">
              <p className={styles.stripLabel}>Recently opened</p>
              {recentNames.length === 0 ? (
                <p className={styles.recentNone}>Nothing opened yet — teams you visit will appear here.</p>
              ) : (
                <div className={styles.recentRow}>
                  {recentNames.map((name) => {
                    const team = teamRef(name);
                    return (
                      <Link
                        key={team.id}
                        className={styles.recentLink}
                        href={communityTeamHref(team)}
                        data-testid="community-gateway-recent-link"
                        onClick={() => recordVisit(name)}
                      >
                        {name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            <details className={styles.familyPanel} ref={familyPanelRef} data-testid="community-gateway-family-panel">
              <summary className={styles.familySummary}>
                <ChevronRight aria-hidden="true" className={styles.familyCaret} />
                <span>
                  Names that read alike — <strong>{communityNamesInCollisions()}</strong> names in{" "}
                  <strong>{familyGroups.length}</strong> groups
                </span>
                <span className={styles.familyWhy}>Check before you open one</span>
              </summary>
              <div className={styles.familyBody}>
                <p>
                  These entries reduce to the same or nearly the same name once brackets, punctuation and suffixes such
                  as &ldquo;HS&rdquo; are set aside. <strong>They have not been merged.</strong> Each is still its own
                  entry with its own page, exactly as the source document records it — this grouping is only a prompt to
                  check you are opening the one you mean.
                </p>
                {familyGroups.length === 0 ? (
                  <p className={styles.familyEmpty} data-testid="community-gateway-family-empty">
                    No name in this list currently reads like another. That would itself be a change worth noticing,
                    since the source document is known to hold near-duplicate spellings.
                  </p>
                ) : (
                  <div className={styles.familyGrid}>
                    {familyGroups.map((family) => (
                      <FamilyCard key={family.names[0]?.name ?? ""} family={family} onVisit={recordVisit} />
                    ))}
                  </div>
                )}
              </div>
            </details>

            <WardPanel title="Community teams" testId="community-index-teams">
              {allTeams.length === 0 ? (
                /*
                 * An empty SOURCE is rendered as a stated absence, never as an empty list. A blank
                 * list looks exactly like a loaded page for a service with no teams, and nobody
                 * re-checks a blank — so the page has to say which of the two it is. It says only
                 * what is observable: the derivation returned nothing. It does NOT name a cause,
                 * because nothing here can see one. This is deliberately checked BEFORE the search
                 * filter below: a truly empty source and a search that matched nothing are two
                 * different facts and must not share one sentence.
                 */
                <div className={styles.emptyNotice} data-testid="community-index-empty">
                  <p>
                    <strong>This list is empty.</strong> Every team on this page is derived from the vocabulary a
                    referral can name, so an empty list means that derivation returned no teams.
                  </p>
                  <p>
                    It does not mean this prototype has no community teams, and nothing on this page has checked whether
                    any exist. Read it as a page that found nothing, not as a service that has nothing.
                  </p>
                </div>
              ) : filteredTeams.length === 0 ? (
                <SearchEmptyNotice alikeOnly={alikeOnly} query={query.trim()} />
              ) : (
                <div className={styles.letterGroups}>
                  {[...grouped.keys()].sort().map((letter) => (
                    <section key={letter} className={styles.letterSection} aria-labelledby={letterHeadingId(letter)}>
                      <h3 id={letterHeadingId(letter)} tabIndex={-1} className={styles.letterHeading}>
                        {letter}
                      </h3>
                      <ul className={styles.teamList}>
                        {(grouped.get(letter) ?? []).map((team) => (
                          <TeamRow
                            key={team.id}
                            team={team}
                            query={normalizedQuery}
                            collision={collisionByName.get(team.name)}
                            onVisit={recordVisit}
                            onOpenFamilyPanel={openFamilyPanel}
                          />
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </WardPanel>
          </div>
        </div>
        {/*
         * ⚠️ MOVED HERE FROM THE TOP OF THE PAGE, 2026-09-05, AT THE OWNER'S REQUEST. NOT ONE
         * SENTENCE WAS CUT AND NOT ONE TESTID CHANGED — the guards that police this copy read it
         * wherever it sits, and the sentences are the reason this page can be trusted at all.
         * Three dense paragraphs standing between the heading and the first team is what he was
         * objecting to; the caveats themselves were never the problem, their position was.
         *
         * ⚠️ **DO NOT PUT THIS BEHIND A `<details>`.** It is tempting and it is the wrong trade:
         * a caveat a reader must click to discover is one most readers never see, and the middle
         * paragraph is the one that stops this list being read as a caseload. Visible and at the
         * foot is honest; collapsed is not.
         */}
        {/*
         * ⚠️ A `<p>` RATHER THAN AN `<h2>`, AND A TEST IS WHY. This footer first shipped with
         * `<h2>About this list</h2>` and `ward-community-index.dom.test.tsx` went red immediately:
         * this page renders EXACTLY ONE `<h2>`, owned by the panel that holds the list, and the
         * guard exists to stop the index quietly growing a second content section. The guard was
         * right and the markup was wrong. The label stays visible and the landmark is named through
         * `aria-label`, so nothing is lost to a screen reader either.
         */}
        <footer className={styles.aboutList} data-testid="community-index-about" aria-label="About this list">
          <p className={styles.aboutHeading}>About this list</p>
          <p className={styles.provenance} data-testid="community-index-provenance">
            These teams are listed alphabetically because the record holds a team&apos;s name and nothing else to group
            by. The catchment table this list is derived from does link each team to a set of suburbs, but that link is
            not carried on the team itself, so any grouping on this page would be one this prototype invented rather
            than one a team&apos;s own record supports.
          </p>

          <p className={styles.provenance} data-testid="community-index-restraint">
            This is a way in, not a caseload. It shows each team&apos;s name and links to it — no counts of people, no
            discharges and nothing about who a team is following up. A team&apos;s own page answers those questions for
            that team.
          </p>

          <p className={styles.provenance} data-testid="community-index-marker-explanation">
            Some names below carry a marker reading <strong>reads like others</strong>, because the source document
            spells one team more than one way, or holds two different teams under names close enough to confuse.{" "}
            <strong>The marker never means two entries are the same service</strong> — nothing on this page merges,
            corrects or de-duplicates a name, and each stays its own entry with its own page. The reverse is just as
            true and easy to miss: a name with <strong>no</strong> marker is <strong>not a guarantee</strong> it appears
            only once in this list. The check compares <strong>spellings</strong>, so two names for one service are
            invisible to it whenever they are not spelled alike — an abbreviation, or a service renamed rather than
            misspelt. Recognising those takes a person who knows the services, and where somebody has confirmed that two
            names are the same service, that is recorded as their decision and never inferred here.
          </p>
        </footer>
      </main>
    </div>
  );
}

/** How many recently-opened teams the strip remembers. */
const RECENT_LIMIT = 5;

/** The `localStorage` key the "recently opened" strip reads and writes. Namespaced to this
 *  prototype's gateway rather than reusing another Ward Flow key, so the two cannot collide. */
const RECENT_STORAGE_KEY = "ward-community-gateway-recent";

/** Fired after a same-tab write, since the `storage` event browsers dispatch natively only reaches
 *  OTHER tabs, never the tab that made the write — and this strip has to update in the same tab a
 *  reader just clicked a team in. */
const RECENT_CHANGE_EVENT = "ward-community-gateway-recent-change";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/** The id a letter's heading renders under, and the id the jump rail looks up. One function, so
 *  the two never drift apart. */
function letterHeadingId(letter: string): string {
  return `community-gateway-letter-${letter}`;
}

/**
 * A `CommunityTeam` built straight from a name, for the two surfaces (the recent strip, the family
 * panel) that carry only a name and need a link. `id` is recomputed from the name via
 * `communityTeamSlug` — the same function `COMMUNITY_TEAM_PAGES` itself uses — rather than looked
 * up in `allTeams`, which may be a caller-supplied subset that does not contain this name at all.
 */
function teamRef(name: string): CommunityTeam {
  return { id: communityTeamSlug(name), name };
}

/**
 * Every name the "recently opened" strip has stored, oldest read failure absorbed rather than
 * thrown. Wrapped in `try`/`catch`: `localStorage` throws in a private-browsing context in some
 * browsers, and a page that crashed on that would be a strictly worse outcome than a strip that
 * simply remembers nothing this session.
 */
function readRecentTeamNames(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === "string").slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

/** The write half of the pair above — same reason, same shape: a failed write must not crash the
 *  page that just successfully navigated somewhere. */
function writeRecentTeamNames(names: readonly string[]): void {
  try {
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(names));
  } catch {
    // Private browsing or quota exhaustion: the strip will not remember this visit, and nothing
    // else on the page depends on the write having succeeded.
  }
  try {
    window.dispatchEvent(new Event(RECENT_CHANGE_EVENT));
  } catch {
    // No `window` (should not happen — this only ever runs from a click handler) — nothing else
    // depends on the notification having gone out.
  }
}

/** Reads the strip, prepends `teamName`, drops any earlier occurrence of it, and caps the length —
 *  then writes the result straight back. A plain module-level function rather than a hook: nothing
 *  it does depends on this component's own state, so every caller (a team row, a family-panel
 *  link, the recent strip's own links) can reference it directly with a stable identity. */
function recordVisit(teamName: string): void {
  const current = readRecentTeamNames();
  const next = [teamName, ...current.filter((name) => name !== teamName)].slice(0, RECENT_LIMIT);
  writeRecentTeamNames(next);
}

/*
 * The `useSyncExternalStore` plumbing behind `recentNames` in `CommunityIndex` — the same
 * `createBrowserStore` pattern `use-ward-sidebar-collapsed.ts` already uses, and for the same
 * reason: it lets a write to `localStorage` trigger a re-render through a SUBSCRIPTION rather than
 * through `setState` called inside an effect body, which is the pattern
 * `react-hooks/set-state-in-effect` exists to flag — correctly, since state that lives in
 * `localStorage` is exactly the "external system" `useSyncExternalStore` is for.
 *
 * ⚠️ THE SNAPSHOT IS CACHED AGAINST THE RAW STRING, NOT RECOMPUTED ON EVERY CALL. `getSnapshot`
 * must return a referentially STABLE value when nothing has changed, or `useSyncExternalStore`
 * treats every render as a change and loops. Parsing a fresh array from `JSON.parse` on every call
 * would do exactly that, so the last raw string and its parsed array are cached at module scope and
 * only a raw string that has actually changed produces a new array reference.
 */
let cachedRecentRaw: string | null = null;
let cachedRecentNames: readonly string[] = [];
const NO_RECENT_NAMES: readonly string[] = [];

function getRecentNamesSnapshot(): readonly string[] {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw === cachedRecentRaw) return cachedRecentNames;
  cachedRecentRaw = raw;
  cachedRecentNames = readRecentTeamNames();
  return cachedRecentNames;
}

function subscribeToRecentNames(onChange: () => void): () => void {
  // `storage` covers a write from another tab; the custom event covers a write from THIS one,
  // which the native `storage` event deliberately never fires for.
  window.addEventListener("storage", onChange);
  window.addEventListener(RECENT_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(RECENT_CHANGE_EVENT, onChange);
  };
}

const useRecentTeamNames = createBrowserStore(subscribeToRecentNames, getRecentNamesSnapshot, NO_RECENT_NAMES);

/**
 * Highlights every case-insensitive occurrence of `query` inside `name` with a real `<mark>`,
 * exactly like the approved mockup. Returns `name` untouched when there is no query, so a row never
 * pays for a scan it does not need.
 */
function highlightMatches(name: string, query: string): ReactNode {
  if (!query) return name;
  const lower = name.toLowerCase();
  const needle = query.toLowerCase();
  const parts: ReactNode[] = [];
  let from = 0;
  let at = lower.indexOf(needle, from);
  let key = 0;
  while (at !== -1) {
    if (at > from) parts.push(name.slice(from, at));
    parts.push(
      <mark key={`match-${key}`} className={styles.match}>
        {name.slice(at, at + needle.length)}
      </mark>,
    );
    key += 1;
    from = at + needle.length;
    at = lower.indexOf(needle, from);
  }
  if (from < name.length) parts.push(name.slice(from));
  return parts;
}

/**
 * One row: the team's own link, an optional reads-alike marker, and a "go" chevron.
 *
 * ⚠️ **THE MARKER IS A SIBLING OF THE LINK, NEVER A DESCENDANT OF IT.** A `<button>` nested inside
 * an `<a>` is invalid HTML and, worse, fires the anchor's own navigation on top of the button's
 * click — a reader trying to open the comparison panel would be sent straight to the team page
 * instead. `.teamRowLink`'s CSS stretches an `::after` pseudo-element over the whole row so the row
 * keeps its whole-area click behaviour without the marker ever being inside the anchor's own DOM
 * subtree — the same technique the approved mockup documents in its own CSS comments.
 */
function TeamRow({
  team,
  query,
  collision,
  onVisit,
  onOpenFamilyPanel,
}: {
  team: CommunityTeam;
  query: string;
  collision: CommunityNameCollision | undefined;
  onVisit: (name: string) => void;
  onOpenFamilyPanel: () => void;
}) {
  return (
    <li className={styles.teamRow}>
      <Link
        className={styles.teamRowLink}
        href={communityTeamHref(team)}
        data-testid="community-index-link"
        onClick={() => onVisit(team.name)}
      >
        <span className={styles.teamRowName}>{highlightMatches(team.name, query)}</span>
      </Link>
      {collision ? <ReadsAlikeMarker collision={collision} onOpen={onOpenFamilyPanel} /> : null}
      <ChevronRight aria-hidden="true" className={styles.teamRowGo} />
    </li>
  );
}

/**
 * The reads-alike marker itself. A real `<button type="button">`, never a `<span role="button">` —
 * a fake button is invisible to keyboard Tab order and to the accessibility tree's list of
 * activatable controls, which is exactly the gap this whole task exists to close on the rest of the
 * page.
 *
 * ⚠️ **WORDING IS A CLINICAL-SAFETY RULE HERE, NOT A STYLE CHOICE.** "Reads like N others — check
 * you have the right one" states a spelling property and asks for a check. "Did you mean" — or any
 * wording implying sameness — is forbidden: this project has already shipped the harm a merge would
 * cause (see `community-vocabulary.ts`'s own doc comment), and the owner ruled the fix is a visible
 * split a reader is warned about, never an invisible merge nobody is.
 */
function ReadsAlikeMarker({ collision, onOpen }: { collision: CommunityNameCollision; onOpen: () => void }) {
  const others = collision.names.length - 1;
  return (
    <button type="button" className={styles.readsAlike} data-testid="community-gateway-reads-alike" onClick={onOpen}>
      <span className={styles.readsAlikeDot} aria-hidden="true" />
      Reads like {others} {others === 1 ? "other" : "others"} — check you have the right one
    </button>
  );
}

/** One family in the collapsible panel: the lead spelling, a rendered count of the group, and every
 *  member linked to its own page. `teamRef` builds each link independently of `allTeams` — see its
 *  own comment — so this panel is honest even when a caller renders the index over a subset. */
function FamilyCard({ family, onVisit }: { family: CommunityNameCollision; onVisit: (name: string) => void }) {
  const lead = family.names[0]?.name ?? "";
  const total = family.names.length;
  return (
    <div className={styles.familyCard} data-testid="community-gateway-family-card">
      <p className={styles.familyCardLabel}>
        {lead} — {total} {total === 1 ? "entry" : "entries"} read alike
      </p>
      <ul className={styles.familyCardList}>
        {family.names.map((entry) => {
          const team = teamRef(entry.name);
          return (
            <li key={team.id}>
              <Link
                className={styles.familyCardLink}
                href={communityTeamHref(team)}
                data-testid="community-gateway-family-link"
                onClick={() => onVisit(entry.name)}
              >
                {entry.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * The empty state when a search or the "reads alike" filter leaves nothing — distinct from the
 * "the whole derivation is empty" state above, which is a fact about the SOURCE rather than about
 * anything a reader typed. Three variants, matched to the approved mockup: alike-only with a query,
 * alike-only alone, and a plain query. Every variant states the absence in words and offers the
 * next step, never a bare blank.
 */
function SearchEmptyNotice({ alikeOnly, query }: { alikeOnly: boolean; query: string }) {
  if (alikeOnly && query) {
    return (
      <div className={styles.emptyNotice} data-testid="community-gateway-search-empty">
        <p>
          <strong>No name that reads like another contains &ldquo;{query}&rdquo;.</strong>
        </p>
        <p>
          The list is filtered to entries whose name reads like another. A team matching &ldquo;{query}&rdquo; may well
          be in the full list — clear the &ldquo;Names that read alike&rdquo; filter to see it.
        </p>
      </div>
    );
  }
  if (alikeOnly) {
    return (
      <div className={styles.emptyNotice} data-testid="community-gateway-search-empty">
        <p>
          <strong>No name in this list reads like another.</strong>
        </p>
        <p>The spelling check found no near-duplicates at all, which would be a change worth noticing.</p>
      </div>
    );
  }
  return (
    <div className={styles.emptyNotice} data-testid="community-gateway-search-empty">
      <p>
        <strong>No team name contains &ldquo;{query}&rdquo;.</strong>
      </p>
      <p>
        The list holds names as they reach this page, so a team may be recorded under a spelling you would not expect.
        Try a shorter fragment.
      </p>
    </div>
  );
}
