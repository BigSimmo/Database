"use client";

import { InformationPageFooter, InformationPageShell } from "@/components/information-page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/components/ui-primitives";
import { therapyScreenHref } from "@/lib/therapy-compass-navigation";

import { useTcBindings } from "../bindings";
import { heroCard } from "../controls";
import { cardPreviewText } from "../data/select";
import { TherapyKeyFacts } from "../record/key-facts";
import { RelatedTherapies } from "../record/related-therapies";
import { TherapyCompareAction } from "../record/compare-action";
import { TherapySaveNotice } from "../record/save-notice";
import { TherapyRecordSections } from "../record/record-sections";
import { TherapySourceProvenance } from "../record/source-provenance";
import { TherapyRecordNavHeader } from "../therapy-record-nav-header";
import { LoadingState, StatusBadge, TagRow } from "../ui";
import { useTherapyFavourite } from "../use-therapy-favourite";

/**
 * One therapy record.
 *
 * The page is a single reading column at every width. It used to be a two-column
 * grid whose right rail carried "At a glance" and the provenance card: on a
 * phone that rail stacked underneath everything, so the highest-yield facts on
 * the record landed below the fold and below four buttons. Those facts are now
 * the strip directly under the title, the navigation is in the header, and what
 * is left in the column is the record itself, in reading order.
 */
export function DetailScreen() {
  const b = useTcBindings();
  const t = b.selectedTherapy;
  const favourite = useTherapyFavourite(t?.slug ?? null);
  if (!t) return <LoadingState />;

  const { notice, saved, toggleFavourite } = favourite;
  const summary = cardPreviewText(t.clinicalSummary, { exclude: t.name, maxSentences: 3 }) || t.clinicalSummary;

  return (
    <>
      <TherapyRecordNavHeader
        therapy={t}
        active="overview"
        backHref={b.workspaceHref(therapyScreenHref("search"))}
        backLabel="Therapy search"
        testIdPrefix="therapy-detail"
        saved={saved}
        onToggleSave={() => void toggleFavourite()}
      />
      <InformationPageShell testId="therapy-detail-page" gap={false}>
        <section data-screen-label="Detail" className="flex flex-col gap-3">
          <TherapySaveNotice notice={notice} />

          <div className={cn(heroCard, "px-4 py-4 sm:px-5 sm:py-5")}>
            <PageHeader
              title={t.name}
              // The category always leads. It used to be replaced by "Also
              // known as …" for any record carrying an alias, which quietly
              // cost every one of those records the one line that says what
              // family of therapy this is — the more useful orienting fact of
              // the two. The aliases keep their place, one line further down.
              eyebrow={t.category}
              description={summary}
              meta={
                <div className="flex flex-col gap-2">
                  {t.aliases.length ? (
                    <p className="m-0 text-xs text-[color:var(--text-muted)]">Also known as {t.aliases.join(", ")}</p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={t.reviewStatus} />
                    <TagRow tags={t.tags.length ? t.tags : [t.category]} max={4} />
                  </div>
                </div>
              }
            />
          </div>

          <TherapyCompareAction therapy={t} />
          <TherapyKeyFacts therapy={t} />
          <TherapyRecordSections therapy={t} />
          <RelatedTherapies related={b.relatedForSelected} onOpen={(slug) => b.open(slug)} />
          <TherapySourceProvenance therapy={t} />
        </section>
        <InformationPageFooter className="mt-4">
          Decision support — verify the record and linked source before clinical use.
        </InformationPageFooter>
      </InformationPageShell>
    </>
  );
}
