"use client";

import type { ReactNode } from "react";

import { useTcBindings } from "./bindings";
import { cardPreviewText, prioritiseTherapyTags, summarise } from "./data/select";
import type { Therapy } from "./data/types";
import { accentControl, outlineControl, therapyBtn } from "./controls";
import {
  AlertIcon,
  ChevronRightIcon,
  ClockIcon,
  CrosshairIcon,
  ExternalLinkIcon,
  FileTextIcon,
  HeartIcon,
  ScaleIcon,
} from "./icons";
import { Eyebrow, IconTile, TagRow } from "./ui";

/** Large search-result card with why-matched / avoid / best-fit columns. */
export function ResultCard({ therapy }: { therapy: Therapy }) {
  const b = useTcBindings();
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
    cardPreviewText(therapy.bestUsedFor || therapy.indications, { exclude: therapy.name }) ||
    "Relevant to the current search.";
  const avoidModify =
    summarise(therapy.contraindicationsOrCautions, 1) || "Check source and review status before clinical use.";
  const bestFit =
    cardPreviewText(therapy.targetSymptoms || therapy.patientPopulation || therapy.setting, {
      exclude: therapy.name,
    }) || "See record for population fit.";

  return (
    <article className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]">
      <div className="grid grid-cols-1 items-start gap-3.5 px-4 py-3.5 sm:grid-cols-[minmax(240px,1fr)_minmax(320px,1.35fr)] sm:gap-4 sm:px-5 sm:py-4">
        <div className="flex min-w-0 gap-3">
          <IconTile icon={ScaleIcon} size={38} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <h3 className="m-0 min-w-0 flex-1 text-[color:var(--text-heading)] tracking-display text-base font-semibold leading-snug">
                {therapy.name}
              </h3>
              <button
                type="button"
                className={`${therapyBtn} inline-flex h-tap w-tap shrink-0 cursor-not-allowed items-center justify-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--disabled)] opacity-65`}
                disabled
                title="Favourite saving is not available yet"
                aria-label="Favourite saving is not available yet"
              >
                <HeartIcon size={17} />
              </button>
            </div>
            {subtitle ? (
              <p className="m-0 mt-1 mb-2 line-clamp-2 text-sm-minus leading-snug text-[color:var(--text-muted)]">
                {subtitle}
              </p>
            ) : (
              <div className="mb-2" />
            )}
            <TagRow tags={tags} max={3} wrap={false} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--border)] sm:grid-cols-3">
          <CardCell icon={CrosshairIcon} eyebrow="WHY MATCHED" tone="accent" text={whyMatched} />
          <CardCell icon={AlertIcon} eyebrow="AVOID / MODIFY" tone="warning" text={avoidModify} />
          <CardCell icon={ClockIcon} eyebrow="BEST FIT" tone="muted" text={bestFit} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 px-4 pb-3.5 sm:grid-cols-3 sm:px-5 sm:pb-4">
        <button type="button" className={`${therapyBtn} ${accentControl} w-full`} onClick={() => b.open(therapy.slug)}>
          <ExternalLinkIcon size={16} strokeWidth={1.8} />
          Open record
        </button>
        <button
          type="button"
          className={`${therapyBtn} ${outlineControl} w-full`}
          onClick={() => b.toggleCompare(therapy.slug)}
          aria-pressed={inCompare}
        >
          <ScaleIcon size={16} />
          {inCompare ? "In compare" : "Compare"}
        </button>
        <button
          type="button"
          className={`${therapyBtn} ${outlineControl} w-full`}
          onClick={() => b.openSheet(therapy.slug)}
          disabled={!therapy.patientSheetAvailable}
          title={therapy.patientSheetAvailable ? undefined : "This record has no patient sheet"}
        >
          <FileTextIcon size={16} />
          {therapy.patientSheetAvailable ? "Patient sheet" : "Sheet unavailable"}
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
  icon: (p: { size?: number; strokeWidth?: number }) => ReactNode;
  eyebrow: string;
  tone: "accent" | "warning" | "muted";
  text: string;
}) {
  return (
    <div
      className={`bg-[color:var(--surface)] px-3 py-2.5 [&_p]:m-0 [&_p]:text-sm-minus [&_p]:leading-snug [&_p]:text-[color:var(--text-muted)] ${tone === "accent" ? "text-[color:var(--clinical-accent)]" : tone === "warning" ? "bg-[color:var(--warning-bg)] text-[color:var(--warning-text)] [&_p]:text-[color:var(--warning-text)]" : "text-[color:var(--text-muted)]"}`}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <Icon size={13} strokeWidth={1.9} />
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
      <IconTile icon={ScaleIcon} size={38} variant={active ? "accent" : "soft"} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm-minus font-semibold text-[color:var(--text-heading)]">{therapy.name}</span>
        <span className="mt-0.5 block overflow-hidden text-xs text-ellipsis whitespace-nowrap text-[color:var(--text-muted)]">
          {subtitle ?? therapy.bestUsedFor ?? therapy.category}
        </span>
      </span>
      {trailing ?? (
        <span className="flex-none text-[color:var(--decoration-soft)]">
          {therapy.reviewStatus === "reviewed" ? null : <AlertIcon size={15} strokeWidth={1.8} />}
        </span>
      )}
      <ChevronRightIcon size={15} strokeWidth={1.8} className="flex-none text-[color:var(--decoration-soft)]" />
    </button>
  );
}
