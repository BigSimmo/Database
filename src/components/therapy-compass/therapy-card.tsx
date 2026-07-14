"use client";

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
import { s } from "./style-utils";
import { Eyebrow, IconTile, TagRow } from "./ui";

/** Large search-result card with why-matched / avoid / best-fit columns. */
export function ResultCard({ therapy }: { therapy: Therapy }) {
  const b = useTcBindings();
  const inCompare = b.isInCompare(therapy.slug);
  return (
    <article
      style={s(
        `background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-soft);overflow:hidden;`,
      )}
    >
      <div
        style={s(
          `display:grid;grid-template-columns:minmax(280px,1fr) minmax(400px,1.35fr) auto;gap:22px;padding:20px 22px;align-items:start;`,
        )}
      >
        <div style={s(`display:flex;gap:15px;min-width:0;`)}>
          <IconTile icon={ScaleIcon} />
          <div style={s(`min-width:0;`)}>
            <h3
              style={s(
                `margin:0 0 5px;font-size:16.5px;font-weight:650;color:var(--text-heading);letter-spacing:-0.01em;`,
              )}
            >
              {therapy.name}
            </h3>
            <p style={s(`margin:0 0 11px;font-size:13.5px;line-height:1.5;color:var(--text-muted);`)}>
              {summarise(therapy.clinicalSummary, 1) || therapy.bestUsedFor || therapy.category}
            </p>
            <TagRow tags={therapy.tags.length ? therapy.tags : [therapy.category]} max={4} />
          </div>
        </div>

        <div
          style={s(
            `display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--border);border:1px solid var(--border);border-radius:12px;overflow:hidden;`,
          )}
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

        <div style={s(`display:flex;gap:4px;`)}>
          <button
            type="button"
            className="tc-btn"
            title="Favourite"
            style={s(
              `display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--text-soft);cursor:pointer;`,
            )}
          >
            <HeartIcon size={17} />
          </button>
        </div>
      </div>
      <div style={s(`display:flex;gap:10px;padding:0 22px 20px;flex-wrap:wrap;`)}>
        <button
          type="button"
          className="tc-btn"
          onClick={() => b.open(therapy.slug)}
          style={s(accentControl + "flex:1;min-width:150px;height:44px;")}
        >
          <ExternalLinkIcon size={16} strokeWidth={1.8} />
          Open record
        </button>
        <button
          type="button"
          className="tc-btn"
          onClick={() => b.toggleCompare(therapy.slug)}
          style={s(
            outlineControl +
              `height:44px;${inCompare ? "border-color:var(--clinical-accent);color:var(--clinical-accent-hover);" : ""}`,
          )}
        >
          <ScaleIcon size={16} />
          {inCompare ? "In compare" : "Compare"}
        </button>
        <button
          type="button"
          className="tc-btn"
          onClick={() => b.openSheet(therapy.slug)}
          style={s(outlineControl + "height:44px;")}
        >
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
  icon: (p: { size?: number; strokeWidth?: number }) => React.ReactNode;
  eyebrow: string;
  tone: "accent" | "warning" | "muted";
  text: string;
}) {
  const bg = tone === "warning" ? "var(--warning-bg)" : "var(--surface)";
  const color =
    tone === "accent" ? "var(--clinical-accent)" : tone === "warning" ? "var(--warning-text)" : "var(--text-soft)";
  const body = tone === "warning" ? "var(--warning-text)" : "var(--text-muted)";
  return (
    <div style={s(`padding:12px 13px;background:${bg};`)}>
      <div style={s(`display:flex;align-items:center;gap:6px;margin-bottom:7px;color:${color};`)}>
        <Icon size={13} strokeWidth={1.9} />
        <Eyebrow color={color}>{eyebrow}</Eyebrow>
      </div>
      <p style={s(`margin:0;font-size:12.5px;line-height:1.45;color:${body};`)}>{text}</p>
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
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="tc-btn tc-row"
      onClick={onClick}
      style={s(
        `display:flex;align-items:center;gap:14px;width:100%;padding:14px 16px;border:1px solid ${active ? "var(--clinical-accent-border)" : "var(--border)"};border-radius:12px;background:${active ? "var(--clinical-accent-soft)" : "var(--surface)"};text-align:left;cursor:pointer;`,
      )}
    >
      <IconTile icon={ScaleIcon} size={38} variant={active ? "accent" : "soft"} />
      <span style={s(`flex:1;min-width:0;`)}>
        <span style={s(`display:block;font-size:13.5px;font-weight:650;color:var(--text-heading);`)}>
          {therapy.name}
        </span>
        <span
          style={s(
            `display:block;font-size:12px;color:var(--text-muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`,
          )}
        >
          {subtitle ?? therapy.bestUsedFor ?? therapy.category}
        </span>
      </span>
      {trailing ?? (
        <span style={s(`color:var(--text-soft);flex:none;`)}>
          {therapy.reviewStatus === "reviewed" ? null : <AlertIcon size={15} strokeWidth={1.8} />}
        </span>
      )}
      <ChevronRightIcon size={15} strokeWidth={1.8} style={s(`color:var(--text-soft);flex:none;`)} />
    </button>
  );
}
