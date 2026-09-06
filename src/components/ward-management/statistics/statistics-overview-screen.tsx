"use client";

import { StatisticsSectionFrame } from "@/components/ward-management/statistics/statistics-section-frame";
import { statisticsSectionById } from "@/components/ward-management/statistics/statistics-sections";
import { WardPanel } from "@/components/ward-management/ward-panel";

import styles from "./statistics-sections.module.css";

/**
 * ACROSS ALL SERVICES — the whole-of-prototype and Western Australia section, and it is a skeleton.
 *
 * ⚠️ **THERE IS NO FIGURE ON THIS PAGE, AND NO SHAPE WHERE ONE WOULD GO.** No nought, no dash, no
 * grey block waiting to fill in. The statistics home page's whole character is that it never shows
 * a number it cannot honestly support, and a placeholder is the one thing that breaks that quietly:
 * a nought standing in for an unwritten derivation is indistinguishable, on screen, from a nought
 * that was measured. Everything this section will hold is said in a sentence instead.
 *
 * ⚠️ **The section reads its own name and description from `statistics-sections.ts`**, the same
 * module the hub index reads. A heading typed in here would be a second copy of a fact that already
 * exists, and the day somebody renames the section on the hub this page would go on advertising the
 * old name with nothing failing.
 *
 * **Why it is worth shipping empty.** The route exists, it is reachable, it carries the disclaimer
 * and it says exactly what is missing. That is a truthful page. The alternative — holding the route
 * back until a figure exists — leaves the hub with a section it cannot link to, and leaves the
 * honesty argument to be re-made from scratch by whoever writes the first aggregate.
 */
export function StatisticsOverviewScreen() {
  // `statisticsSectionById` returns `undefined` for an unknown id, so this cannot silently resolve
  // to a different section. The non-null assertion is avoided in favour of a thrown error: this id
  // is a literal in this file and in `statistics-sections.ts`, so a miss means the two have been
  // edited apart, and failing loudly at render is the only way that shows up at all.
  const section = statisticsSectionById("overview");
  if (!section) throw new Error("statistics-sections.ts no longer defines the 'overview' section");

  return (
    <StatisticsSectionFrame
      section={section}
      subtitle="What this section is for, and what has not been built in it yet."
      testId="ward-statistics-overview-screen"
    >
      <WardPanel title="What this section will hold" testId="ward-statistics-overview-scope">
        <div className={styles.panelBody}>
          <p className={styles.body}>{section.description}</p>
          <p className={styles.body}>
            Figures here are about the network rather than about any one ward: how many people the prototype is moving
            through beds, how long they are waiting, where they are coming from, and how any of that differs between
            health services and across Western Australia. None of them is about a person.
          </p>
        </div>
      </WardPanel>

      <WardPanel title="Nothing here is built yet" testId="ward-statistics-overview-not-built">
        <div className={styles.panelBody}>
          {/*
           * ⚠️ **A SENTENCE WAS DELETED FROM THIS PARAGRAPH ON 2026-09-01 AND MAY NOT COME BACK.** It told the
           * reader this page could not be reached from the statistics hub, and that the linking index was work
           * still to be done. It is described here rather than quoted back word for word, so the retired
           * wording exists nowhere in the tree and no scan can mistake this record for a relapse.
           *
           * It was TRUE the day it was written and FALSE within the same session, when the hub index landed: `STATISTICS_SECTIONS` in `statistics-sections.ts` makes `STATISTICS_OVERVIEW_HREF` its first
           * entry, and `statistics-screen.tsx` renders every entry as a `<Link>` inside its index `<nav>`. So a
           * reader who arrived here by clicking that link was being told the navigation they had just used does
           * not exist — on a page whose whole character is that it never says anything it cannot support.
           *
           * **There is no corrected wording, which is why this is a deletion and not a rewrite.** The absence the
           * sentence described no longer obtains, so the conclusion falls with the reason.
           * `tests/ward-statistics-sections.dom.test.tsx` asserts the old wording cannot return.
           *
           * ⚠️ **AND THE SHAPE IS NOT CONFINED TO THIS FILE.** A "not built yet" note is a claim with an expiry
           * date, and nothing connects it to the work that expires it. A note of that shape belongs beside a test
           * that goes red the day the gap closes — the pattern `tests/ward-community-index.dom.test.tsx` uses —
           * or it does not belong in rendered prose at all.
           */}
          <p className={styles.notBuilt} data-testid="ward-statistics-overview-not-built-body">
            <strong>
              No whole-of-prototype figure has been derived, so this page shows none — not a nought, and not a dash
              standing where a number will go.
            </strong>{" "}
            This is a skeleton: the route, the account of what belongs here, and the disclaimer that has to travel with
            it. A figure that looks measured is worse than a blank on this screen, because nobody re-checks a number
            that renders.
          </p>

          <p className={styles.body}>
            Each figure added here will arrive the way the ones on the statistics home page did: computed from the
            prototype&apos;s own state on every render, stated with the population it was measured over, and accompanied
            by whatever it could not measure and why. A measure that cannot be supported by the model will be said to be
            unsupported rather than approximated.
          </p>

          {/*
           * ⚠️ **THIS NAMED NEITHER THE FIGURE NOR THE FIELDS UNTIL FIX ROUND 1**, and a sentence about
           * "one figure recorded in two places that mean different things" is true of almost any
           * codebase — which is what makes it worthless. The home page's own withheld figure names
           * both records and says exactly why one of them cannot answer the question; a page that
           * gestures at that standard instead of meeting it is claiming a rigour it is not applying.
           */}
          <p className={styles.note} data-testid="ward-statistics-overview-precedent">
            {/*
             * ⚠️ FIELD NAMES REMOVED 2026-09-06 ON THE OWNER'S RULING. The identifiers, so the claim stays
             * checkable by whoever needs them:
             *
             *     the referral-side record   ReferralAddressing   its only unit field   acceptedUnitId
             *     the department-side list   Movement.declines
             *
             * The distinction the paragraph turns on is unchanged, and it is the one that matters: the
             * referral record's only unit field is written when a ward ACCEPTS, so an acceptance can name
             * a ward and a decline cannot. `statistics-claims-register.ts` holds both as claims with
             * their evidence in `ward-model.ts`, so they go red if either record changes shape —
             * whatever this page happens to call them.
             */}
            Adding one is not just arithmetic. Whether a whole-of-state figure can be published at all depends on what
            the record holds, and there is already a worked example: the statistics home page shows{" "}
            <strong>no declines-per-ward figure</strong>, which is the statistic the owner named first. The model holds
            declines in two places that mean different things, and only one can name a ward. A decline against a
            referral is recorded on the referral itself, and the one place a ward can be named on that record is filled
            in only when a ward ACCEPTS — so an acceptance names a ward and a decline cannot. The other list belongs to
            a patient&apos;s movement through an emergency department: it does name the ward, but it describes a ward
            refusing somebody already inside a department, which is a different fact. Choosing between them would decide
            what the published number means, which is the owner&apos;s decision. Every aggregate proposed here has to
            answer that same question before it appears.
          </p>
        </div>
      </WardPanel>
    </StatisticsSectionFrame>
  );
}
