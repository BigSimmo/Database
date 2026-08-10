"use client";

import type { ReactNode } from "react";

import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { useTcBindings } from "./bindings";
import { summarise } from "./data/select";
import type { Therapy } from "./data/types";
import { accentControl, iconControl, outlineControl, therapyBtn } from "./controls";
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
    <article
      data-therapy-result-card
      className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-4 px-4 pt-4 sm:gap-x-4 sm:px-5 sm:pt-5 lg:grid-cols-[minmax(280px,1fr)_minmax(400px,1.35fr)_auto] lg:gap-[22px] lg:px-[22px]">
        <div data-therapy-result-copy className="min-w-0">
          <h3 className="m-0 mb-[5px] text-base font-semibold tracking-display text-[color:var(--text-heading)]">
            {therapy.name}
          </h3>
          <p className="m-0 mb-3 text-sm-minus leading-normal text-[color:var(--text-muted)]">
            {summarise(therapy.clinicalSummary, 1) || therapy.bestUsedFor || therapy.category}
          </p>
          <TagRow tags={therapy.tags.length ? therapy.tags : [therapy.category]} max={4} />
        </div>

        <div
          data-therapy-result-evidence
          className="col-span-2 -mx-4 grid grid-cols-1 gap-px overflow-hidden border-y border-[color:var(--border)] bg-[color:var(--border)] sm:mx-0 sm:grid-cols-3 sm:rounded-lg sm:border lg:col-span-1"
        >
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

        <div className="col-start-2 row-start-1 flex gap-1 lg:col-start-auto lg:row-start-auto">
          <button
            type="button"
            className={iconControl}
            aria-disabled="true"
            onClick={ignoreUnavailableActivation}
            title="Favourite saving is not available yet"
            aria-label="Favourite saving is not available yet"
          >
            <HeartIcon size={17} />
          </button>
        </div>
      </div>
      <div
        data-therapy-result-actions
        className="grid grid-cols-3 gap-2 px-4 py-4 sm:flex sm:flex-wrap sm:gap-2.5 sm:px-5 sm:pb-5 lg:px-[22px]"
      >
        <button
          type="button"
          className={`${accentControl} w-full min-w-0 max-sm:gap-1.5 max-sm:px-1.5 max-sm:text-xs sm:min-w-[150px] sm:flex-1`}
          onClick={() => b.open(therapy.slug)}
        >
          <ExternalLinkIcon size={16} strokeWidth={1.8} />
          <span className="sm:hidden">Open</span>
          <span className="max-sm:hidden">Open record</span>
        </button>
        <button
          type="button"
          className={`${outlineControl} w-full min-w-0 max-sm:gap-1.5 max-sm:px-1.5 max-sm:text-xs`}
          onClick={() => b.toggleCompare(therapy.slug)}
          aria-pressed={inCompare}
        >
          <ScaleIcon size={16} />
          {inCompare ? "In compare" : "Compare"}
        </button>
        <button
          type="button"
          className={`${outlineControl} w-full min-w-0 max-sm:gap-1.5 max-sm:px-1.5 max-sm:text-xs`}
          onClick={() => {
            if (!therapy.patientSheetAvailable) return;
            b.openSheet(therapy.slug);
          }}
          aria-disabled={therapy.patientSheetAvailable ? undefined : true}
          title={therapy.patientSheetAvailable ? undefined : "This record has no patient sheet"}
        >
          <FileTextIcon size={16} />
          <span className="sm:hidden">{therapy.patientSheetAvailable ? "Sheet" : "No sheet"}</span>
          <span className="max-sm:hidden">{therapy.patientSheetAvailable ? "Patient sheet" : "Sheet unavailable"}</span>
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
      className={`bg-[color:var(--surface)] px-4 py-3.5 sm:px-3 sm:py-3 lg:px-[13px] [&_p]:m-0 [&_p]:text-sm-minus [&_p]:leading-normal [&_p]:text-[color:var(--text-muted)] ${tone === "accent" ? "text-[color:var(--clinical-accent)]" : tone === "warning" ? "bg-[color:var(--warning-bg)] text-[color:var(--warning-text)] [&_p]:text-[color:var(--warning-text)]" : "text-[color:var(--text-muted)]"}`}
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
