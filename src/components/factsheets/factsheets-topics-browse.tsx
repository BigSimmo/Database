"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

import { FactsheetListRow } from "@/components/factsheets/factsheet-list-row";
import {
  categoryTheme,
  factsheetTopicQueryValue,
  topicSectionId,
  visibleTopicSheets,
  type Factsheet,
  type FactsheetCategory,
} from "@/components/factsheets/factsheets-data";
import { FACTSHEET_CATEGORY_IDENTITY } from "@/lib/category-identity";
import { categoryGlyph } from "@/lib/category-identity-icons";
import { interactiveRowBase } from "@/components/ui/interactive-row";
import { cn } from "@/components/ui-primitives";

export type FactsheetTopicGroup = { category: FactsheetCategory; sheets: Factsheet[] };

export function FactsheetsTopicsBrowse({
  groups,
  selectedTopic,
  previewLimit,
}: {
  groups: FactsheetTopicGroup[];
  selectedTopic?: FactsheetCategory;
  previewLimit: number;
}) {
  const [openTopic, setOpenTopic] = useState<FactsheetCategory | undefined>(selectedTopic);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOpenTopic(selectedTopic);
  }, [selectedTopic]);

  return (
    <ul
      data-testid="factsheets-topics-directory"
      className="mt-5 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)] sm:mt-6"
    >
      {groups.map(({ category, sheets }) => {
        const isOpen = openTopic === category;
        const headingId = topicSectionId(category);
        const panelId = `${headingId}-panel`;
        const slug = factsheetTopicQueryValue(category);
        const theme = categoryTheme(category);
        const identity = FACTSHEET_CATEGORY_IDENTITY[category];
        const shown = visibleTopicSheets(sheets, Boolean(expanded[category]), previewLimit);
        const canCollapse = sheets.length > previewLimit;

        return (
          <li key={category} className="border-b border-[color:var(--border)] last:border-b-0">
            <h2 id={headingId} className="m-0">
              <button
                type="button"
                data-testid={`factsheets-topics-topic-${slug}`}
                aria-expanded={isOpen}
                aria-controls={isOpen ? panelId : undefined}
                onClick={() => setOpenTopic((current) => (current === category ? undefined : category))}
                className={cn(
                  interactiveRowBase,
                  "w-full gap-3 rounded-none border-0 px-4 py-3",
                  isOpen && "bg-[color:var(--clinical-accent-soft)]",
                )}
              >
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg"
                  style={{ backgroundColor: theme.soft, color: theme.accent }}
                >
                  {categoryGlyph(identity.icon, "h-5 w-5")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base-minus font-bold text-[color:var(--text-heading)]">{category}</span>
                  <span className="block text-xs font-bold" style={{ color: theme.accent }}>
                    <span className="nums">{sheets.length}</span> {sheets.length === 1 ? "sheet" : "sheets"}
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-[color:var(--text-muted)] motion-safe:transition-transform",
                    isOpen && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </button>
            </h2>
            {isOpen ? (
              <div
                id={panelId}
                role="region"
                aria-labelledby={headingId}
                data-testid={headingId}
                className="border-t border-[color:var(--border)]"
              >
                {shown.map((sheet) => (
                  <FactsheetListRow key={sheet.slug} sheet={sheet} compact />
                ))}
                {canCollapse ? (
                  <button
                    type="button"
                    data-testid={`factsheets-topics-show-all-${slug}`}
                    aria-expanded={Boolean(expanded[category])}
                    onClick={() =>
                      setExpanded((current) => ({
                        ...current,
                        [category]: !current[category],
                      }))
                    }
                    className={cn(
                      interactiveRowBase,
                      "w-full justify-center gap-2 rounded-none border-0 bg-[color:var(--surface-subtle)] px-4 text-sm font-bold text-[color:var(--clinical-accent)] hover:bg-[color:var(--clinical-accent-soft)]",
                    )}
                  >
                    {expanded[category] ? `Show fewer in ${category}` : `Show all ${sheets.length} in ${category}`}
                  </button>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
