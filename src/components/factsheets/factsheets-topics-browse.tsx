"use client";

import Link from "next/link";
import { ChevronDown, LayoutGrid } from "lucide-react";
import { useMemo, useState } from "react";

import { FactsheetListRow } from "@/components/factsheets/factsheet-list-row";
import {
  categoryTheme,
  factsheetTopicQueryValue,
  topicChipOverflow,
  topicSectionId,
  visibleTopicSheets,
  type Factsheet,
  type FactsheetCategory,
} from "@/components/factsheets/factsheets-data";
import { FACTSHEET_CATEGORY_IDENTITY } from "@/lib/category-identity";
import { categoryGlyph } from "@/lib/category-identity-icons";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/components/ui-primitives";

export type FactsheetTopicGroup = { category: FactsheetCategory; sheets: Factsheet[] };

const chipFocus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

function topicHref(category?: FactsheetCategory) {
  if (!category) return "/factsheets/topics";
  return `/factsheets/topics?topic=${factsheetTopicQueryValue(category)}`;
}

export function FactsheetsTopicsBrowse({
  groups,
  visibleGroups,
  selectedTopic,
  previewLimit,
  chipOverflowAfter,
}: {
  groups: FactsheetTopicGroup[];
  visibleGroups: FactsheetTopicGroup[];
  selectedTopic?: FactsheetCategory;
  previewLimit: number;
  chipOverflowAfter: number;
}) {
  const categories = groups.map((group) => group.category);
  const { visible, overflow } = topicChipOverflow(categories, chipOverflowAfter);
  const [moreOpen, setMoreOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    selectedTopic ? { [selectedTopic]: true } : {},
  );

  const overflowSelected = Boolean(selectedTopic && overflow.includes(selectedTopic));

  const chipCounts = useMemo(() => {
    const counts = new Map<FactsheetCategory, number>();
    for (const group of groups) counts.set(group.category, group.sheets.length);
    return counts;
  }, [groups]);

  return (
    <div className="mt-5 sm:mt-6">
      <nav
        data-testid="factsheets-topics-chips"
        aria-label="Factsheet topics"
        className="sticky top-0 z-10 -mx-4 border-b border-[color:var(--border)] bg-[color:var(--surface)]/95 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6"
      >
        <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden">
          <TopicChip href={topicHref()} current={!selectedTopic} label="All topics" />
          {visible.map((category) => (
            <TopicChip
              key={category}
              href={topicHref(category)}
              current={selectedTopic === category}
              label={category}
              count={chipCounts.get(category)}
              accent={categoryTheme(category).accent}
              soft={categoryTheme(category).soft}
            />
          ))}
          {overflow.length > 0 ? (
            <button
              type="button"
              data-testid="factsheets-topics-more"
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              aria-controls="factsheets-topics-more-sheet"
              onClick={() => setMoreOpen(true)}
              className={cn(
                "inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-bold",
                chipFocus,
                overflowSelected
                  ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                  : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:text-[color:var(--text-heading)]",
              )}
            >
              More
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </nav>

      {overflow.length > 0 ? (
        <Sheet
          id="factsheets-topics-more-sheet"
          testId="factsheets-topics-more-sheet"
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          title="More topics"
          description="Jump to a topic that did not fit the index."
          closeLabel="Close more topics"
        >
          <ul className="grid gap-1">
            {overflow.map((category) => {
              const theme = categoryTheme(category);
              const count = chipCounts.get(category) ?? 0;
              const current = selectedTopic === category;
              return (
                <li key={category}>
                  <Link
                    href={topicHref(category)}
                    aria-current={current ? "page" : undefined}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex min-h-12 items-center justify-between gap-3 rounded-xl px-3 text-sm font-bold",
                      chipFocus,
                      current
                        ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                        : "text-[color:var(--text-heading)] hover:bg-[color:var(--surface-subtle)]",
                    )}
                  >
                    <span>{category}</span>
                    <span className="nums text-xs" style={{ color: theme.accent }}>
                      {count}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Sheet>
      ) : null}

      <div className="mt-5 grid gap-4 sm:mt-6 sm:gap-6">
        {visibleGroups.map(({ category, sheets }) => {
          const theme = categoryTheme(category);
          const headingId = topicSectionId(category);
          const isExpanded = Boolean(expanded[category]);
          const shown = visibleTopicSheets(sheets, isExpanded, previewLimit);
          const canCollapse = sheets.length > previewLimit;
          const identity = FACTSHEET_CATEGORY_IDENTITY[category];

          return (
            <section key={category} aria-labelledby={headingId} data-testid={headingId} className="scroll-mt-20">
              <header className="mb-3 flex items-center gap-3">
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
                  style={{ backgroundColor: theme.soft, color: theme.accent }}
                >
                  {categoryGlyph(identity.icon, "h-5 w-5")}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 id={headingId} className="text-lg font-extrabold tracking-tight text-[color:var(--text-heading)]">
                    {category}
                  </h2>
                  <p className="text-xs font-bold" style={{ color: theme.accent }}>
                    <span className="nums">{sheets.length}</span> {sheets.length === 1 ? "sheet" : "sheets"}
                  </p>
                </div>
              </header>
              <div className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]">
                {shown.map((sheet) => (
                  <FactsheetListRow key={sheet.slug} sheet={sheet} />
                ))}
                {canCollapse ? (
                  <button
                    type="button"
                    data-testid={`factsheets-topics-show-all-${factsheetTopicQueryValue(category)}`}
                    aria-expanded={isExpanded}
                    onClick={() =>
                      setExpanded((current) => ({
                        ...current,
                        [category]: !current[category],
                      }))
                    }
                    className={cn(
                      "flex min-h-12 w-full items-center justify-center gap-2 border-t border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 text-sm font-bold text-[color:var(--clinical-accent)] hover:bg-[color:var(--clinical-accent-soft)]",
                      chipFocus,
                    )}
                  >
                    {isExpanded ? `Show fewer in ${category}` : `Show all ${sheets.length} in ${category}`}
                  </button>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TopicChip({
  href,
  current,
  label,
  count,
  accent,
  soft,
}: {
  href: string;
  current: boolean;
  label: string;
  count?: number;
  accent?: string;
  soft?: string;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-bold",
        chipFocus,
        current
          ? "border-transparent text-[color:var(--text-heading)]"
          : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:text-[color:var(--text-heading)]",
      )}
      style={
        current
          ? {
              backgroundColor: soft ?? "var(--clinical-accent-soft)",
              color: accent ?? "var(--clinical-accent)",
              borderColor: "transparent",
            }
          : undefined
      }
    >
      {label === "All topics" ? <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      {label}
      {typeof count === "number" ? <span className="nums text-xs opacity-80">{count}</span> : null}
    </Link>
  );
}
