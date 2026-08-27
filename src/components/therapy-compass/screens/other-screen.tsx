"use client";

import { useMemo } from "react";
import { ExternalLink, ShieldCheck, TriangleAlert } from "lucide-react";

import { cardSurface } from "@/components/card-recipes";
import { PageHeader } from "@/components/ui/page-header";
import { cn, pageContainer } from "@/components/ui-primitives";
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
      <section className={cn(pageContainer, "my-10 max-w-[720px]")}>
        <PageHeader
          title={b.otherLabel}
          icon={ShieldCheck}
          description="This surface uses the same Therapy shell. Pick a tool from the top navigation to keep exploring the clinical workspace."
          actions={
            <>
              <Button variant="primary" onClick={b.goHome}>
                Go to Home
              </Button>
              <Button variant="secondary" onClick={b.goSearch}>
                Search therapies
              </Button>
            </>
          }
        />
      </section>
    );
  }

  if (b.loading) return <LoadingState label="Loading review queue…" />;

  return (
    <section data-screen-label="Review Queue" className={pageContainer}>
      <PageHeader
        className="mb-5.5"
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
            className={cn(
              cardSurface,
              "grid grid-cols-1 sm:grid-cols-[minmax(200px,_1.4fr)_repeat(3,_minmax(110px,_1fr))_auto] gap-5 items-center py-4 px-5",
            )}
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
