"use client";

import type { ReactNode } from "react";

import { useTcBindings } from "./bindings";
import { summarise } from "./data/select";
import type { Therapy } from "./data/types";
import { accentControl, outlineControl } from "./controls";
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
    <article className="tc-therapy-card-001">
      <div className="tc-stack-sm tc-therapy-card-002">
        <div className="tc-therapy-card-003">
          <IconTile icon={ScaleIcon} />
          <div className="tc-therapy-card-004">
            <h3 className="tc-therapy-card-005">{therapy.name}</h3>
            <p className="tc-therapy-card-006">
              {summarise(therapy.clinicalSummary, 1) || therapy.bestUsedFor || therapy.category}
            </p>
            <TagRow tags={therapy.tags.length ? therapy.tags : [therapy.category]} max={4} />
          </div>
        </div>

        <div className="tc-stack-sm tc-therapy-card-007">
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

        <div className="tc-therapy-card-008">
          <button
            type="button"
            className="tc-btn tc-therapy-card-009"
            disabled
            title="Favourite saving is not available yet"
            aria-label="Favourite saving is not available yet"
          >
            <HeartIcon size={17} />
          </button>
        </div>
      </div>
      <div className="tc-therapy-card-010">
        <button
          type="button"
          className={`tc-btn ${accentControl} tc-flex-control`}
          onClick={() => b.open(therapy.slug)}
        >
          <ExternalLinkIcon size={16} strokeWidth={1.8} />
          Open record
        </button>
        <button
          type="button"
          className={`tc-btn ${outlineControl}${inCompare ? " tc-is-selected" : ""}`}
          onClick={() => b.toggleCompare(therapy.slug)}
          aria-pressed={inCompare}
        >
          <ScaleIcon size={16} />
          {inCompare ? "In compare" : "Compare"}
        </button>
        <button type="button" className={`tc-btn ${outlineControl}`} onClick={() => b.openSheet(therapy.slug)}>
          <FileTextIcon size={16} />
          Patient sheet
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
    <div className={`tc-card-cell tc-card-cell-${tone}`}>
      <div className="tc-card-cell-heading">
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
      className={`tc-btn tc-row tc-therapy-list-item${active ? " tc-is-active" : ""}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <IconTile icon={ScaleIcon} size={38} variant={active ? "accent" : "soft"} />
      <span className="tc-therapy-card-011">
        <span className="tc-therapy-card-012">{therapy.name}</span>
        <span className="tc-therapy-card-013">{subtitle ?? therapy.bestUsedFor ?? therapy.category}</span>
      </span>
      {trailing ?? (
        <span className="tc-therapy-card-014">
          {therapy.reviewStatus === "reviewed" ? null : <AlertIcon size={15} strokeWidth={1.8} />}
        </span>
      )}
      <ChevronRightIcon size={15} strokeWidth={1.8} className="tc-therapy-card-015" />
    </button>
  );
}
