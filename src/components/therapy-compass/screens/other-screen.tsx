"use client";

import { useMemo } from "react";

import { useTcBindings } from "../bindings";
import { commandControl, outlineControl } from "../controls";
import { AlertIcon, ExternalLinkIcon, ShieldCheckIcon } from "../icons";
import { LoadingState, Meter } from "../ui";

export function OtherScreen() {
  const b = useTcBindings();
  const isReview = b.screen === "review";

  const queue = useMemo(
    () =>
      [...b.unreviewedTherapies].sort((a, c) => (a.reviewCompleteness ?? 0) - (c.reviewCompleteness ?? 0)).slice(0, 24),
    [b.unreviewedTherapies],
  );

  if (!isReview) {
    return (
      <section className="tc-screens-other-screen-001">
        <span className="tc-screens-other-screen-002">
          <ShieldCheckIcon size={30} strokeWidth={1.6} />
        </span>
        <h1 className="tc-screens-other-screen-003">{b.otherLabel}</h1>
        <p className="tc-screens-other-screen-004">
          This surface uses the same Therapy shell. Pick a tool from the top navigation to keep exploring the clinical
          workspace.
        </p>
        <div className="tc-screens-other-screen-005">
          <button type="button" className={`tc-btn ${commandControl}`} onClick={b.goHome}>
            Go to Home
          </button>
          <button type="button" className={`tc-btn ${outlineControl}`} onClick={b.goSearch}>
            Search therapies
          </button>
        </div>
      </section>
    );
  }

  if (b.loading) return <LoadingState label="Loading review queue…" />;

  return (
    <section data-screen-label="Review Queue" className="tc-screens-other-screen-006">
      <div className="tc-screens-other-screen-007">
        <div>
          <h1 className="tc-screens-other-screen-008">Review Queue</h1>
          <p className="tc-screens-other-screen-009">
            Records awaiting source and clinical review, lowest review-completeness first.
          </p>
        </div>
        <span className="tc-screens-other-screen-010">
          <AlertIcon size={16} strokeWidth={1.8} />
          {b.reviewCount} to review
        </span>
      </div>

      <div className="tc-screens-other-screen-011">
        {queue.map((t) => (
          <div key={t.slug} className="tc-stack-sm tc-screens-other-screen-012">
            <div className="tc-screens-other-screen-013">
              <div className="tc-screens-other-screen-014">{t.name}</div>
              <div className="tc-screens-other-screen-015">{t.category}</div>
            </div>
            <Meter value={t.sourceCompleteness} label="Source" />
            <Meter value={t.indexCompleteness} label="Index" />
            <Meter value={t.reviewCompleteness} label="Review" />
            <button type="button" className={`tc-btn ${outlineControl}`} onClick={() => b.open(t.slug)}>
              <ExternalLinkIcon size={15} strokeWidth={1.7} />
              Open
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
