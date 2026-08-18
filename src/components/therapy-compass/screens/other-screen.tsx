"use client";

import { useMemo } from "react";
import { ExternalLink, ShieldCheck, TriangleAlert } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { pageContainer } from "@/components/ui-primitives";
import { Button } from "@/components/ui/button";

import { useTcBindings } from "../bindings";
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
      <section className="max-w-[720px] my-[60px] mx-auto text-center">
        <span className="inline-flex items-center justify-center w-[64px] h-[64px] rounded-xl bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] mb-5">
          <ShieldCheck aria-hidden="true" size={30} strokeWidth={1.6} />
        </span>
        <h1 className="mt-0 mx-0 mb-2 text-2xl font-semibold text-[color:var(--text-heading)]">{b.otherLabel}</h1>
        <p className="mt-0 mx-0 mb-[22px] text-sm text-[color:var(--text-muted)]">
          This surface uses the same Therapy shell. Pick a tool from the top navigation to keep exploring the clinical
          workspace.
        </p>
        <div className="flex gap-2.5 justify-center flex-wrap">
          <Button variant="primary" onClick={b.goHome}>
            Go to Home
          </Button>
          <Button variant="secondary" onClick={b.goSearch}>
            Search therapies
          </Button>
        </div>
      </section>
    );
  }

  if (b.loading) return <LoadingState label="Loading review queue…" />;

  return (
    <section data-screen-label="Review Queue" className={pageContainer}>
      <PageHeader
        className="mb-[22px]"
        title="Review Queue"
        description="Records awaiting source and clinical review, lowest review-completeness first."
        // A count, not a control: `meta` is the documented slot for status
        // chips and counts, so it renders under the description rather than in
        // the actions column it used to share with nothing else.
        meta={
          <span className="inline-flex items-center gap-2 h-[40px] py-0 px-3.5 border border-[color:var(--warning-border)] rounded-lg bg-[color:var(--warning-bg)] text-[color:var(--warning-text)] text-sm-minus font-semibold">
            <TriangleAlert aria-hidden="true" size={16} strokeWidth={1.8} />
            {b.reviewCount} to review
          </span>
        }
      />

      <div className="flex flex-col gap-3">
        {queue.map((t) => (
          <div
            key={t.slug}
            className="grid grid-cols-1 sm:grid-cols-[minmax(200px,_1.4fr)_repeat(3,_minmax(110px,_1fr))_auto] gap-5 items-center bg-[color:var(--surface)] border border-[color:var(--border)] rounded-lg shadow-[var(--e1)] py-4 px-5"
          >
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[color:var(--text-heading)]">{t.name}</div>
              <div className="text-xs text-[color:var(--text-muted)] mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap">
                {t.category}
              </div>
            </div>
            <Meter value={t.sourceCompleteness} label="Source" />
            <Meter value={t.indexCompleteness} label="Index" />
            <Meter value={t.reviewCompleteness} label="Review" />
            <Button variant="secondary" icon={ExternalLink} onClick={() => b.open(t.slug)}>
              Open
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
