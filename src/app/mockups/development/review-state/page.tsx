import type { Metadata } from "next";

import {
  CARD_CLASS,
  CountTile,
  META_CLASS,
  MONO_CLASS,
  ROW_CLASS,
  SECTION_HEADING_CLASS,
} from "@/components/developer-area/hub/panel-primitives";
import { PanelPageShell } from "@/components/developer-area/hub/panel-page-shell";
import { loadRepoAwarenessSnapshot, resolveRepoFreshness } from "@/lib/developer-area/repo-awareness-snapshot";

export const metadata: Metadata = {
  title: "Review state · Developer · Clinical KB",
  description: "Every immutable review record: which ref was reviewed, at which head, with what outcome.",
};

const DISCLOSURE_CLASS =
  "min-h-12 cursor-pointer text-xs font-bold text-[color:var(--text-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

export default function DeveloperReviewStatePage() {
  const snapshot = loadRepoAwarenessSnapshot();
  const freshness = resolveRepoFreshness(snapshot, new Date());
  const { records, counts } = snapshot.review_state;

  return (
    <PanelPageShell
      testId="developer-review-state"
      title="Review state"
      freshness={freshness}
      freshnessLabel="Repository"
    >
      <div className="grid grid-cols-2 gap-3">
        <CountTile
          testId="developer-review-state-count-records"
          value={counts.records}
          label="review records"
        />
        <CountTile
          testId="developer-review-state-count-refs"
          value={counts.refs}
          label="distinct branches reviewed"
        />
      </div>

      {/*
       * The panel is named for what it has, and says plainly what it has not.
       * A label promising more than its data delivers is the `#338` failure
       * wearing different clothes: "open changes, checks, review state" from
       * "local data; no new permissions" was the original outline's own
       * contradiction, because open pull requests and CI status are not on
       * disk — reading them needs a token, a network call, and an approval
       * boundary this repo deliberately gates. This page answers a narrower,
       * honest question instead: has this ref been reviewed at this exact
       * head, with what outcome. That is history, not live state, and it says
       * so in its own words below rather than leaving a reader to infer it
       * from an absence.
       */}
      <p data-testid="developer-review-state-scope" className={META_CLASS}>
        This is the repository&rsquo;s own review history: which branch was reviewed, at which exact commit, and what
        the reviewer concluded. It does not show which pull requests are open, whether their checks are green, or
        whether a review is outstanding — none of that exists on disk, and reading it would need credentials this
        page deliberately does not have. A branch absent from this list has not been reviewed at any head; it does
        not mean there is no pull request.
      </p>

      <section aria-labelledby="developer-review-state-heading" className="grid gap-3">
        <h2 id="developer-review-state-heading" className={SECTION_HEADING_CLASS}>
          Records · {counts.records}
        </h2>
        <p className={META_CLASS}>
          Newest first. Each record is immutable; a later review of the same branch adds a row rather than replacing
          one. Showing all {counts.records} — nothing here is capped, paginated, or filtered, so a count and its list
          can never disagree.
        </p>
        {/*
         * `record` is `{ date, ref, head, scope, outcome, checks }` — six free-text
         * fields (Ruling R7: review outcomes are prose from many sessions over
         * months, so the page never classifies or buckets `outcome`). Every field
         * of every record is rendered unconditionally below, and nothing here
         * branches on a field's *value* — the only structural choices are which
         * fields get their own line versus a shared row, which is presentation,
         * not a recognised/unrecognised-value distinction. So the "render an
         * unrecognised value under its own heading" rule has nothing to bite on
         * for this page, the same conclusion Task 11 reached for the quarantined
         * test list.
         */}
        <ol data-testid="developer-review-state-records" className="grid gap-3">
          {records.map((record, index) => (
            <li
              // `head` alone is not unique — 21 records in the corpus share a
              // date, ref AND head, because one branch can be reviewed twice at one
              // commit under different scopes. Adding `scope` disambiguates every
              // record today, but nothing structurally guarantees it, so the index
              // carries uniqueness and the fields carry readability.
              key={`${record.date}-${record.ref}-${record.head}-${record.scope}-${index}`}
              className={CARD_CLASS}
            >
              <div className={ROW_CLASS}>
                <span className={META_CLASS}>{record.date}</span>
                <span className="text-sm font-bold text-[color:var(--text-heading)]">{record.ref}</span>
                <span className={MONO_CLASS}>{record.head}</span>
              </div>
              <p className={META_CLASS}>{record.scope}</p>
              <p className="text-sm leading-6 text-[color:var(--text-heading)]">{record.outcome}</p>
              <details>
                <summary className={DISCLOSURE_CLASS}>Checks run</summary>
                <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">{record.checks}</p>
              </details>
            </li>
          ))}
        </ol>
      </section>
    </PanelPageShell>
  );
}
