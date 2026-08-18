"use client";

import type { ReactNode } from "react";
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

import { useTcBindings } from "./bindings";
import { cardPreviewText, prioritiseTherapyTags, summarise } from "./data/select";
import type { Therapy } from "./data/types";
import { accentControl, iconControl, outlineControl, therapyBtn } from "./controls";
import { Eyebrow, IconTile, TagRow } from "./ui";
import { useTherapyFavourite } from "./use-therapy-favourite";

/** Large search-result card with why-matched / avoid / best-fit columns. */
export function ResultCard({ therapy }: { therapy: Therapy }) {
  const b = useTcBindings();
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
      <button
        type="button"
        className={`${iconControl} absolute top-3 right-3 z-[10] sm:top-3.5 sm:right-4`}
        aria-pressed={saved}
        onClick={() => void toggleFavourite()}
        title={saved ? "Remove from favourites" : "Save therapy to favourites"}
        aria-label={saved ? `Remove ${therapy.name} from favourites` : `Save ${therapy.name} to favourites`}
      >
        <Heart
          aria-hidden="true"
          size={17}
          className={saved ? "fill-current text-[color:var(--clinical-accent)]" : undefined}
        />
      </button>
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
        <button
          type="button"
          className={`${therapyBtn} ${accentControl} w-full min-w-0 px-2 text-xs sm:px-[18px] sm:text-sm-minus`}
          onClick={() => b.open(therapy.slug)}
          aria-label="Open record"
        >
          <ExternalLink aria-hidden="true" size={16} strokeWidth={1.8} />
          <span className="max-sm:hidden">Open record</span>
          <span className="sm:hidden">Open</span>
        </button>
        <button
          type="button"
          className={`${therapyBtn} ${outlineControl} w-full min-w-0 px-2 text-xs sm:px-4 sm:text-sm-minus`}
          onClick={() => b.toggleCompare(therapy.slug)}
          aria-pressed={inCompare}
          aria-label={inCompare ? "In compare" : "Compare"}
        >
          <Scale aria-hidden="true" size={16} />
          <span className="max-sm:hidden">{inCompare ? "In compare" : "Compare"}</span>
          <span className="sm:hidden">{inCompare ? "Added" : "Compare"}</span>
        </button>
        <button
          type="button"
          className={`${therapyBtn} ${outlineControl} w-full min-w-0 px-2 text-xs sm:px-4 sm:text-sm-minus`}
          onClick={() => {
            if (!therapy.patientSheetAvailable) return;
            b.openSheet(therapy.slug);
          }}
          aria-disabled={therapy.patientSheetAvailable ? undefined : true}
          title={therapy.patientSheetAvailable ? undefined : "This record has no patient sheet"}
          aria-label={sheetLabel}
        >
          <FileText aria-hidden="true" size={16} />
          <span className="max-sm:hidden">{sheetLabel}</span>
          <span className="sm:hidden">{sheetShort}</span>
        </button>
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
      className={`${therapyBtn} transition-colors duration-[var(--duration-instant)] hover:bg-[color:var(--surface-subtle)] flex w-full items-center gap-3.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3.5 text-left aria-pressed:border-[color:var(--clinical-accent-border)] aria-pressed:bg-[color:var(--clinical-accent-soft)]`}
      onClick={onClick}
      aria-pressed={active}
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
