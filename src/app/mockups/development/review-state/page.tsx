import type { Metadata } from "next";

import { CountTile, META_CLASS, PanelSection } from "@/components/developer-area/hub/panel-primitives";
import { PanelPageShell } from "@/components/developer-area/hub/panel-page-shell";
import { ReviewStateTable } from "@/components/developer-area/hub/review-state-table";
import { loadRepoAwarenessSnapshot, resolveRepoFreshness } from "@/lib/developer-area/repo-awareness-snapshot";

export const metadata: Metadata = {
  title: "Review state · Developer · Clinical KB",
  description: "Every immutable review record: which ref was reviewed, at which head, with what outcome.",
};

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
        <CountTile testId="developer-review-state-count-records" value={counts.records} label="review records" />
        <CountTile testId="developer-review-state-count-refs" value={counts.refs} label="distinct recorded refs" />
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
        This is the repository&rsquo;s own review history: which recorded ref was reviewed, at which exact commit, and
        what the reviewer concluded. It does not show which pull requests are open, whether their checks are green, or
        whether a review is outstanding — none of that exists on disk, and reading it would need credentials this page
        deliberately does not have. A ref absent from this list has not been reviewed at any head; it does not mean
        there is no pull request.
      </p>

      <PanelSection headingId="developer-review-state-heading" heading={`Records · ${counts.records}`}>
        <p className={META_CLASS}>
          Newest first. Each record is immutable; a later review of the same recorded ref adds a row rather than
          replacing one. Paginated at 50 records per page for responsive rendering.
        </p>
        <ReviewStateTable records={records} />
      </PanelSection>
    </PanelPageShell>
  );
}
