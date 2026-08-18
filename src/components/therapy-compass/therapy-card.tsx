"use client";

import { useId, type ReactNode } from "react";
import {
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Heart,
  Scale,
  Target,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn, ignoreUnavailableActivation } from "@/components/ui-primitives";

import { useTcBindings } from "./bindings";
import { cardPreviewText, prioritiseTherapyTags, summarise } from "./data/select";
import type { Therapy } from "./data/types";
import { controlPressed, favouritePressed, therapyBtn } from "./controls";
import { Eyebrow, IconTile, TagRow } from "./ui";
import { useTherapyFavourite } from "./use-therapy-favourite";

/**
 * A result list has N cards, so none of their actions is "the" primary action on
 * the surface. All three are `secondary`; the filled `--command` slot that
 * COMPONENTS.md section 9.1 allows once per surface is left for the page, not
 * spent N times over. `size="sm"` keeps the label step the card had while
 * `controlBase` holds the 48px tap floor.
 */
const cardActionButton = "min-w-0 px-2 text-xs sm:px-4 sm:text-sm-minus";

/** Large search-result card with why-matched / avoid / best-fit columns. */
export function ResultCard({ therapy }: { therapy: Therapy }) {
  const b = useTcBindings();
  const sheetUnavailableId = useId();
  const { notice, saved, toggleFavourite } = useTherapyFavourite(therapy.slug);
  const inCompare = b.isInCompare(therapy.slug);
  const subtitle =
    cardPreviewText(therapy.clinicalSummary, { exclude: therapy.name }) ||
    cardPreviewText(therapy.bestUsedFor, { exclude: therapy.name }) ||
    "";
  const tags = prioritiseTherapyTags(therapy.tags.length ? therapy.tags : [therapy.category], {
    query: b.search.query,
    activeTags: b.search.tags,
  });
  const whyMatched =
    cardPreviewText(therapy.bestUsedFor, { exclude: therapy.name }) ||
    cardPreviewText(therapy.indications, { exclude: therapy.name }) ||
    "Relevant to the current search.";
  const avoidModify =
    summarise(therapy.contraindicationsOrCautions, 1) || "Check source and review status before clinical use.";
  const bestFit =
    cardPreviewText(therapy.targetSymptoms, { exclude: therapy.name }) ||
    cardPreviewText(therapy.patientPopulation, { exclude: therapy.name }) ||
    cardPreviewText(therapy.setting, { exclude: therapy.name }) ||
    "See record for population fit.";

  const sheetLabel = therapy.patientSheetAvailable ? "Patient sheet" : "Sheet unavailable";
  const sheetShort = therapy.patientSheetAvailable ? "Sheet" : "No sheet";

  return (
    <article
      data-therapy-result-card
      className="relative overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]"
    >
      {/*
        Icon-only action. The accessible name is the `sr-only` label rather than an
        `aria-label`, because `Button` already renders its children into the one
        labelling slot — and `gap-0 px-0` collapses the label row so the face stays
        the square `w-tap` the card corner reserves.
      */}
      <Button
        variant="toolbar"
        icon={Heart}
        className={cn("absolute top-3 right-3 z-[10] w-tap gap-0 px-0 sm:top-3.5 sm:right-4", favouritePressed)}
        aria-pressed={saved}
        onClick={() => void toggleFavourite()}
        title={saved ? "Remove from favourites" : "Save therapy to favourites"}
      >
        <span className="sr-only">
          {saved ? `Remove ${therapy.name} from favourites` : `Save ${therapy.name} to favourites`}
        </span>
      </Button>
      <div className="grid grid-cols-1 items-start gap-3 px-4 pt-3.5 md:grid-cols-[minmax(240px,1fr)_minmax(320px,1.35fr)] md:gap-4 md:px-5 md:py-4 md:pr-[calc(1rem+var(--spacing-tap)+0.75rem)]">
        <div data-therapy-result-copy className="min-w-0 pr-[calc(var(--spacing-tap)+0.5rem)] md:pr-0">
          <h3 className="m-0 text-base font-semibold leading-snug tracking-display text-[color:var(--text-heading)]">
            {therapy.name}
          </h3>
          {subtitle ? (
            <p className="m-0 mt-1 mb-2 line-clamp-2 text-sm-minus leading-snug text-[color:var(--text-muted)]">
              {subtitle}
            </p>
          ) : (
            <div className="mb-2" />
          )}
          <TagRow tags={tags} max={3} wrap={false} />
        </div>

        <div
          data-therapy-result-evidence
          className="-mx-4 grid grid-cols-1 gap-px overflow-hidden border-y border-[color:var(--border)] bg-[color:var(--border)] sm:mx-0 sm:grid-cols-3 sm:rounded-lg sm:border"
        >
          <CardCell icon={Target} eyebrow="WHY MATCHED" tone="accent" text={whyMatched} />
          <CardCell icon={TriangleAlert} eyebrow="AVOID / MODIFY" tone="warning" text={avoidModify} />
          <CardCell icon={Clock} eyebrow="BEST FIT" tone="muted" text={bestFit} />
        </div>
      </div>
      {notice ? (
        <p
          role="status"
          aria-live="polite"
          className="mx-4 mb-0 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 text-xs font-semibold text-[color:var(--text-muted)] sm:mx-5"
        >
          {notice}
        </p>
      ) : null}
      <div data-therapy-result-actions className="grid grid-cols-3 gap-2 px-4 py-3.5 sm:px-5 sm:pb-4 md:pt-0">
        <Button
          variant="secondary"
          size="sm"
          block
          className={cardActionButton}
          icon={ExternalLink}
          onClick={() => b.open(therapy.slug)}
          aria-label="Open record"
        >
          <span className="max-sm:hidden">Open record</span>
          <span className="sm:hidden">Open</span>
        </Button>
        <Button
          variant="secondary"
          size="sm"
          block
          className={cn(cardActionButton, controlPressed)}
          icon={Scale}
          onClick={() => b.toggleCompare(therapy.slug)}
          aria-pressed={inCompare}
          aria-label={inCompare ? "In compare" : "Compare"}
        >
          <span className="max-sm:hidden">{inCompare ? "In compare" : "Compare"}</span>
          <span className="sm:hidden">{inCompare ? "Added" : "Compare"}</span>
        </Button>
        <Button
          variant="secondary"
          size="sm"
          block
          className={cardActionButton}
          icon={FileText}
          onClick={therapy.patientSheetAvailable ? () => b.openSheet(therapy.slug) : ignoreUnavailableActivation}
          aria-disabled={therapy.patientSheetAvailable ? undefined : true}
          aria-describedby={therapy.patientSheetAvailable ? undefined : sheetUnavailableId}
          title={therapy.patientSheetAvailable ? undefined : "This record has no patient sheet"}
          aria-label={sheetLabel}
        >
          <span className="max-sm:hidden">{sheetLabel}</span>
          <span className="sm:hidden">{sheetShort}</span>
        </Button>
        {therapy.patientSheetAvailable ? null : (
          <span id={sheetUnavailableId} className="sr-only">
            This record has no patient sheet.
          </span>
        )}
      </div>
    </article>
  );
}

function CardCell({
  icon: Icon,
  eyebrow,
  tone,
  text,
}: {
  icon: LucideIcon;
  eyebrow: string;
  tone: "accent" | "warning" | "muted";
  text: string;
}) {
  return (
    <div
      className={`bg-[color:var(--surface)] px-3 py-2.5 [&_p]:m-0 [&_p]:text-sm-minus [&_p]:leading-snug [&_p]:text-[color:var(--text-muted)] ${tone === "accent" ? "text-[color:var(--clinical-accent)]" : tone === "warning" ? "bg-[color:var(--warning-bg)] text-[color:var(--warning-text)] [&_p]:text-[color:var(--warning-text)]" : "text-[color:var(--text-muted)]"}`}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <Icon size={13} strokeWidth={1.9} aria-hidden="true" />
        <Eyebrow tone={tone === "muted" ? "neutral" : tone}>{eyebrow}</Eyebrow>
      </div>
      <p className="line-clamp-2">{text}</p>
    </div>
  );
}

/** Compact tappable therapy row for lists (home, related, pickers). */
export function TherapyListItem({
  therapy,
  onClick,
  active = false,
  subtitle,
  trailing,
}: {
  therapy: Therapy;
  onClick: () => void;
  active?: boolean;
  subtitle?: string;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`${therapyBtn} transition-colors duration-[var(--duration-instant)] hover:bg-[color:var(--surface-subtle)] flex w-full items-center gap-3.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3.5 text-left aria-[current=true]:border-[color:var(--clinical-accent-border)] aria-[current=true]:bg-[color:var(--clinical-accent-soft)]`}
      onClick={onClick}
      aria-current={active ? "true" : undefined}
    >
      <IconTile icon={Scale} size={38} variant={active ? "accent" : "soft"} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm-minus font-semibold text-[color:var(--text-heading)]">{therapy.name}</span>
        <span className="mt-0.5 block overflow-hidden text-xs text-ellipsis whitespace-nowrap text-[color:var(--text-muted)]">
          {subtitle ?? therapy.bestUsedFor ?? therapy.category}
        </span>
      </span>
      {trailing ?? (
        <span className="flex-none text-[color:var(--decoration-soft)]">
          {therapy.reviewStatus === "reviewed" ? null : (
            <TriangleAlert aria-hidden="true" size={15} strokeWidth={1.8} />
          )}
        </span>
      )}
      <ChevronRight
        aria-hidden="true"
        size={15}
        strokeWidth={1.8}
        className="flex-none text-[color:var(--decoration-soft)]"
      />
    </button>
  );
}
