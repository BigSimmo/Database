"use client";

import type { ReactNode } from "react";

import { useTcBindings } from "./bindings";
import { summarise } from "./data/select";
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
  return (
    <article className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]">
      <div className="grid grid-cols-1 items-start gap-[22px] px-[22px] py-5 sm:grid-cols-[minmax(280px,1fr)_minmax(400px,1.35fr)_auto]">
        <div className="flex min-w-0 gap-[15px]">
          <IconTile icon={ScaleIcon} />
          <div className="min-w-0">
            <h3 className="m-0 mb-[5px] text-[color:var(--text-heading)] tracking-[-0.01em] text-base font-semibold">
              {therapy.name}
            </h3>
            <p className="m-0 mb-[11px] text-sm-minus leading-normal text-[color:var(--text-muted)]">
              {summarise(therapy.clinicalSummary, 1) || therapy.bestUsedFor || therapy.category}
            </p>
            <TagRow tags={therapy.tags.length ? therapy.tags : [therapy.category]} max={4} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--border)] sm:grid-cols-3">
          <CardCell
            icon={CrosshairIcon}
            eyebrow="WHY MATCHED"
            tone="accent"
            text={therapy.bestUsedFor || therapy.indications || "Relevant to the current search."}
          />
          <CardCell
            icon={AlertIcon}
            eyebrow="AVOID / MODIFY"
            tone="warning"
            text={
              summarise(therapy.contraindicationsOrCautions, 1) || "Check source and review status before clinical use."
            }
          />
          <CardCell
            icon={ClockIcon}
            eyebrow="BEST FIT"
            tone="muted"
            text={
              therapy.targetSymptoms || therapy.patientPopulation || therapy.setting || "See record for population fit."
            }
          />
        </div>

        <div className="flex gap-1">
          <button
            type="button"
            className={`${therapyBtn} inline-flex h-tap w-tap cursor-not-allowed items-center justify-center rounded-[9px] border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-soft)] opacity-65`}
            disabled
            title="Favourite saving is not available yet"
            aria-label="Favourite saving is not available yet"
          >
            <HeartIcon size={17} />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2.5 px-[22px] pb-5">
        <button
          type="button"
          className={`${therapyBtn} ${accentControl} min-w-[150px] flex-1`}
          onClick={() => b.open(therapy.slug)}
        >
          <ExternalLinkIcon size={16} strokeWidth={1.8} />
          Open record
        </button>
        <button
          type="button"
          className={`${therapyBtn} ${outlineControl}`}
          onClick={() => b.toggleCompare(therapy.slug)}
          aria-pressed={inCompare}
        >
          <ScaleIcon size={16} />
          {inCompare ? "In compare" : "Compare"}
        </button>
        <button
          type="button"
          className={`${therapyBtn} ${outlineControl}`}
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
      className={`bg-[color:var(--surface)] px-[13px] py-3 [&_p]:m-0 [&_p]:text-sm-minus [&_p]:leading-normal [&_p]:text-[color:var(--text-muted)] ${tone === "accent" ? "text-[color:var(--clinical-accent)]" : tone === "warning" ? "bg-[color:var(--warning-bg)] text-[color:var(--warning-text)] [&_p]:text-[color:var(--warning-text)]" : "text-[color:var(--text-soft)]"}`}
    >
      <div className="mb-[7px] flex items-center gap-1.5">
        <Icon size={13} strokeWidth={1.9} />
        <Eyebrow tone={tone === "muted" ? "neutral" : tone}>{eyebrow}</Eyebrow>
      </div>
      <p>{text}</p>
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
      className={`${therapyBtn} transition-colors duration-100 hover:bg-[color:var(--surface-subtle)] flex w-full items-center gap-3.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3.5 text-left aria-pressed:border-[color:var(--clinical-accent-border)] aria-pressed:bg-[color:var(--clinical-accent-soft)]`}
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
        <span className="flex-none text-[color:var(--text-soft)]">
          {therapy.reviewStatus === "reviewed" ? null : <AlertIcon size={15} strokeWidth={1.8} />}
        </span>
      )}
      <ChevronRightIcon size={15} strokeWidth={1.8} className="flex-none text-[color:var(--text-soft)]" />
    </button>
  );
}
