"use client";

import { Clock3, FileText, ListChecks, ShieldAlert, Sparkles, Tag, Target, Users } from "lucide-react";
import { useMemo, useState } from "react";
import {
  buildSmartDocumentTags,
  groupSmartDocumentTagsFromTags,
  type SmartDocumentTag,
  type SmartDocumentTagGroup,
} from "@/lib/document-tags";
import type { DocumentLabel } from "@/lib/types";
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

const groupTone: Record<SmartDocumentTagGroup, string> = {
  Site: "border-[color:var(--border-lux)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
  Medication: "border-[color:var(--primary)]/30 bg-[color:var(--primary-soft)]/45 text-[color:var(--primary)]",
  Risk: "border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)]/50 text-[color:var(--warning)]",
  Workflow: "border-[color:var(--info)]/30 bg-[color:var(--info-soft)]/50 text-[color:var(--info)]",
  Topic: "border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)]",
  Population: "border-[color:var(--success)]/25 bg-[color:var(--success-soft)]/40 text-[color:var(--success)]",
  Setting: "border-[color:var(--border-lux)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
  Service: "border-[color:var(--primary)]/20 bg-[color:var(--surface-raised)] text-[color:var(--primary)]",
  "Document type": "border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)]",
  "Clinical action": "border-[color:var(--info)]/30 bg-[color:var(--info-soft)]/50 text-[color:var(--info)]",
  "Care phase": "border-[color:var(--success)]/25 bg-[color:var(--success-soft)]/40 text-[color:var(--success)]",
  "Document intent": "border-[color:var(--primary)]/20 bg-[color:var(--surface-raised)] text-[color:var(--primary)]",
  "Content feature": "border-[color:var(--border-lux)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
  Manual: "border-[color:var(--primary)]/35 bg-[color:var(--primary-soft)] text-[color:var(--primary)]",
};

function confidenceTitle(tag: SmartDocumentTag) {
  return `${tag.group}: ${tag.source} tag, ${Math.round(tag.confidence * 100)}% confidence`;
}

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
  const tagClassName = cn(
    "inline-flex max-w-full items-center gap-1 rounded-md border font-semibold shadow-[var(--shadow-inset)]",
    compact ? "min-h-6 px-2 text-3xs" : "min-h-7 px-2 text-2xs",
    groupTone[tag.group],
    tag.queryMatched && "ring-2 ring-[color:var(--focus)]/25",
    selected && "ring-2 ring-[color:var(--primary)]/35",
    onTagClick &&
      "cursor-pointer transition hover:-translate-y-0.5 hover:border-[color:var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--focus)]/40",
  );
  const content = (
    <>
      <Icon className={cn("shrink-0", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
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
              <h3 className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                <Icon className="h-3.5 w-3.5 text-[color:var(--primary)]" />
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
              "w-fit rounded-md border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
              compact ? "min-h-6 px-2 text-3xs" : "min-h-7 px-2 text-2xs",
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
            "inline-flex items-center rounded-md border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
            compact ? "min-h-6 px-2 text-3xs" : "min-h-7 px-2 text-2xs",
          )}
          aria-label={`Show ${hiddenCount} more document tags`}
        >
          +{hiddenCount} more
        </button>
      ) : hiddenCount > 0 ? (
        <span
          className={cn(
            "inline-flex items-center rounded-md border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]",
            compact ? "min-h-6 px-2 text-3xs" : "min-h-7 px-2 text-2xs",
          )}
        >
          +{hiddenCount}
        </span>
      ) : null}
    </div>
  );
}
