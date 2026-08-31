"use client";

import { Clock3, FileText, ListChecks, ShieldAlert, Sparkles, Tag, Target, Users } from "lucide-react";
import { useMemo, useState } from "react";
import {
  buildSmartDocumentTags,
  groupSmartDocumentTagsFromTags,
  type SmartDocumentTag,
  type SmartDocumentTagGroup,
} from "@/lib/document-tags";
import { documentTagGroupTone } from "@/lib/document-summary-badges";
import type { DocumentLabel } from "@/lib/types";
import { clinicalBadgeToneClass } from "@/components/clinical-dashboard/clinical-badge";
import { cn } from "@/components/ui-primitives";

type DocumentTagCloudProps = {
  labels?: Array<Pick<DocumentLabel, "label" | "label_type" | "source" | "confidence" | "metadata">> | null;
  query?: string;
  limit?: number;
  compact?: boolean;
  expandable?: boolean;
  className?: string;
  onTagClick?: (tag: SmartDocumentTag) => void;
  selectedTagKeys?: Iterable<string>;
  grouped?: boolean;
};

const groupIcon: Record<SmartDocumentTagGroup, typeof Tag> = {
  Site: FileText,
  Medication: Target,
  Risk: ShieldAlert,
  Workflow: ListChecks,
  Topic: Tag,
  Population: Users,
  Setting: FileText,
  Service: Sparkles,
  "Document type": FileText,
  "Clinical action": ListChecks,
  "Care phase": Clock3,
  "Document intent": Sparkles,
  "Content feature": FileText,
  Manual: Sparkles,
};

// Chip colours come from the canonical semantic-tone system (see
// /reference/colour-coding) via the shared group→tone map, so document tag
// chips read the same as every other clinical badge in the app.
function groupToneClass(group: SmartDocumentTagGroup): string {
  return clinicalBadgeToneClass(documentTagGroupTone[group]);
}

function confidenceTitle(tag: SmartDocumentTag) {
  return `${tag.group}: ${tag.source} tag, ${Math.round(tag.confidence * 100)}% confidence`;
}

/**
 * Renders a document tag with group-specific styling and optional search interaction.
 *
 * @param tag - The document tag to display.
 * @param compact - Whether to use compact sizing.
 * @param selected - Whether to indicate the tag as selected.
 * @param onTagClick - Optional callback invoked when the tag is clicked.
 * @returns The rendered document tag chip.
 */
function DocumentTagChip({
  tag,
  compact,
  selected,
  onTagClick,
}: {
  tag: SmartDocumentTag;
  compact: boolean;
  selected: boolean;
  onTagClick?: (tag: SmartDocumentTag) => void;
}) {
  const Icon = groupIcon[tag.group];
  // Compact-meta visual density (filter chips, not primary CTAs). ::before
  // expands the hit toward the 48px tap floor without painting a 48px chip.
  // Ring/border stay for Agent 4.
  //
  // MEASURED 2026-08-29: it does not reach the floor, and it overshoots the row
  // gap. The insets resolve against the padding box, so the 1px border costs 1px
  // per side and the real hit area is 46px (compact) / 50px (default), not 48/52.
  // Worse, in `flex flex-wrap gap-1.5` the 11px expansion overruns the 6px row
  // gap by 5px, so a tap on the bottom 5.5px of a chip (23% of the compact chip)
  // activates the chip on the row BELOW. Do not widen the inset to compensate —
  // that makes the theft worse (7.5px at `-inset-y-3.5`). See
  // `docs/design-system/sweep-fix-tap-floors-round-2.md` §8.
  //
  // Not counted by `interactiveTapFloorDeclarations`: the gate reads `className`
  // JSX attributes and this one is an identifier (`tagClassName`), which it
  // cannot resolve. Verified, not assumed.
  const tagClassName = cn(
    "relative inline-flex max-w-full items-center gap-1 rounded-md border font-semibold shadow-[var(--shadow-inset)] before:absolute before:-inset-y-3 before:-inset-x-1 before:content-['']",
    compact ? "min-h-6 px-2 text-2xs" : "min-h-7 px-2 text-2xs",
    groupToneClass(tag.group),
    tag.queryMatched && "ring-2 ring-[color:var(--focus)]/25",
    selected && "ring-2 ring-[color:var(--primary)]/35",
    onTagClick && "cursor-pointer transition hover:-translate-y-0.5 hover:border-[color:var(--border-strong)]",
  );
  const content = (
    <>
      <Icon aria-hidden="true" className={cn("shrink-0", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
      <span className="max-w-[18ch] truncate whitespace-nowrap sm:max-w-[32ch]">{tag.label}</span>
    </>
  );

  return onTagClick ? (
    <button
      key={tag.key}
      type="button"
      title={`${confidenceTitle(tag)}. Search this tag.`}
      aria-pressed={selected}
      onClick={() => onTagClick(tag)}
      className={tagClassName}
    >
      {content}
    </button>
  ) : (
    <span key={tag.key} title={confidenceTitle(tag)} className={tagClassName}>
      {content}
    </span>
  );
}

export function DocumentTagCloud({
  labels,
  query,
  limit = 6,
  compact = false,
  expandable = true,
  className,
  onTagClick,
  selectedTagKeys,
  grouped = false,
}: DocumentTagCloudProps) {
  const tags = useMemo(() => buildSmartDocumentTags(labels, { query, includeManualGroup: true }), [labels, query]);
  const groupedTags = useMemo(() => groupSmartDocumentTagsFromTags(tags), [tags]);
  const selected = useMemo(() => new Set(selectedTagKeys ?? []), [selectedTagKeys]);
  const [expanded, setExpanded] = useState(false);
  if (tags.length === 0) return null;

  const visible = expanded ? tags : tags.slice(0, limit);
  const hiddenCount = Math.max(0, tags.length - visible.length);
  const visibleKeys = new Set(visible.map((tag) => tag.key));

  if (grouped) {
    return (
      <div className={cn("grid gap-3", className)}>
        {groupedTags.map(({ group, tags: groupTags }) => {
          const visibleGroupTags = expanded ? groupTags : groupTags.filter((tag) => visibleKeys.has(tag.key));
          if (visibleGroupTags.length === 0) return null;
          const Icon = groupIcon[group];
          return (
            <section key={group} className="min-w-0">
              <h3 className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-eyebrow text-[color:var(--text-muted)]">
                <Icon aria-hidden="true" className="h-3.5 w-3.5 text-[color:var(--primary)]" />
                {group}
              </h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {visibleGroupTags.map((tag) => (
                  <DocumentTagChip
                    key={tag.key}
                    tag={tag}
                    compact={compact}
                    selected={selected.has(tag.key)}
                    onTagClick={onTagClick}
                  />
                ))}
              </div>
            </section>
          );
        })}
        {hiddenCount > 0 && expandable ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className={cn(
              // Compact-meta show-more, not a primary CTA. `relative` + the absolute
              // `::before` expands the hit area, but NOT by the 12px `-inset-y-3` names.
              // An absolutely positioned child resolves against its containing block's
              // PADDING box, and this chip has a 1px border, so each side gains 11px, not
              // 12. Measured in the running app on 2026-08-29 (real element with identical
              // insets, `getBoundingClientRect`): 50px effective on this branch, and 46px
              // on the `compact` branch — which is 2px UNDER the 48px tap floor. Paper
              // arithmetic said 52/48 and was wrong by a border width on both.
              // KNOWN GATE DEBT, deliberately not excluded. `interactiveTapFloorDeclarations`
              // counts these two because it reads the declared `min-h-*` and cannot see a
              // pseudo-element, and the 2026-08-29 round-2 sweep decided against teaching it
              // the `before:-inset-y-*` idiom. Two things a class string cannot show made a
              // strict rule impossible: the border width above, and ancestor clipping — an
              // `overflow-hidden` ancestor removes the expanded region from hit testing
              // entirely (measured: 0px expansion), which is why the sibling disclosure in
              // `answer-content.tsx` could not use this idiom at all. A rule doing
              // `min-h + 2 × inset` would have scored the compact branch a passing 48 when
              // it is really 46, i.e. it would have excluded a true violation.
              // RESIDUAL for the owner. Widening to `before:-inset-y-3.5` was proposed and
              // then MEASURED AND REJECTED on 2026-08-29: it does reach 50px, but these
              // chips sit in `flex flex-wrap gap-1.5` (6px rows) and the expansion already
              // overruns that gap. Today a tap on the bottom 5.5px of a chip — 23% of the
              // compact chip's height — activates the chip on the row BELOW it. Widening
              // takes that to 7.5px (31%). Do not widen the inset.
              // The conflict is structural: a 6px row gap allows 3px of expansion per side
              // before neighbours start stealing taps, and reaching 48px from a 24px chip
              // needs 12px. The `::before` idiom cannot deliver a compliant, non-overlapping
              // target in a wrapped row at this gap. The coherent remedy is real height —
              // `min-h-compact-meta` (40px, the owner's compact-role floor) with the
              // `::before` dropped entirely — which costs row pitch and is a design call.
              "relative w-fit rounded-md border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)] before:absolute before:-inset-y-3 before:-inset-x-1 before:content-['']",
              compact ? "min-h-6 px-2 text-2xs" : "min-h-7 px-2 text-2xs",
            )}
            aria-label={`Show ${hiddenCount} more document tags`}
          >
            +{hiddenCount} more
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {visible.map((tag) => (
        <DocumentTagChip
          key={tag.key}
          tag={tag}
          compact={compact}
          selected={selected.has(tag.key)}
          onTagClick={onTagClick}
        />
      ))}
      {hiddenCount > 0 && expandable ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className={cn(
            // Compact-meta show-more, not a primary CTA. `relative` + the absolute
            // `::before` expands the hit area, but NOT by the 12px `-inset-y-3` names.
            // An absolutely positioned child resolves against its containing block's
            // PADDING box, and this chip has a 1px border, so each side gains 11px, not
            // 12. Measured in the running app on 2026-08-29 (real element with identical
            // insets, `getBoundingClientRect`): 50px effective on this branch, and 46px
            // on the `compact` branch — which is 2px UNDER the 48px tap floor. Paper
            // arithmetic said 52/48 and was wrong by a border width on both.
            // KNOWN GATE DEBT, deliberately not excluded. `interactiveTapFloorDeclarations`
            // counts these two because it reads the declared `min-h-*` and cannot see a
            // pseudo-element, and the 2026-08-29 round-2 sweep decided against teaching it
            // the `before:-inset-y-*` idiom. Two things a class string cannot show made a
            // strict rule impossible: the border width above, and ancestor clipping — an
            // `overflow-hidden` ancestor removes the expanded region from hit testing
            // entirely (measured: 0px expansion), which is why the sibling disclosure in
            // `answer-content.tsx` could not use this idiom at all. A rule doing
            // `min-h + 2 × inset` would have scored the compact branch a passing 48 when
            // it is really 46, i.e. it would have excluded a true violation.
            // RESIDUAL for the owner. Widening to `before:-inset-y-3.5` was proposed and
            // then MEASURED AND REJECTED on 2026-08-29: it does reach 50px, but these
            // chips sit in `flex flex-wrap gap-1.5` (6px rows) and the expansion already
            // overruns that gap. Today a tap on the bottom 5.5px of a chip — 23% of the
            // compact chip's height — activates the chip on the row BELOW it. Widening
            // takes that to 7.5px (31%). Do not widen the inset.
            // The conflict is structural: a 6px row gap allows 3px of expansion per side
            // before neighbours start stealing taps, and reaching 48px from a 24px chip
            // needs 12px. The `::before` idiom cannot deliver a compliant, non-overlapping
            // target in a wrapped row at this gap. The coherent remedy is real height —
            // `min-h-compact-meta` (40px, the owner's compact-role floor) with the
            // `::before` dropped entirely — which costs row pitch and is a design call.
            "relative inline-flex items-center rounded-md border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)] before:absolute before:-inset-y-3 before:-inset-x-1 before:content-['']",
            compact ? "min-h-6 px-2 text-2xs" : "min-h-7 px-2 text-2xs",
          )}
          aria-label={`Show ${hiddenCount} more document tags`}
        >
          +{hiddenCount} more
        </button>
      ) : hiddenCount > 0 ? (
        <span
          className={cn(
            "inline-flex items-center rounded-md border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]",
            compact ? "min-h-6 px-2 text-2xs" : "min-h-7 px-2 text-2xs",
          )}
        >
          +{hiddenCount}
        </span>
      ) : null}
    </div>
  );
}
