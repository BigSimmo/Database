import { Info } from "lucide-react";

import { FactsheetsTopicsBrowse } from "@/components/factsheets/factsheets-topics-browse";
import {
  TOPIC_CHIP_OVERFLOW_AFTER,
  TOPIC_SECTION_PREVIEW_LIMIT,
  factsheets,
  factsheetsGroupedByCategory,
  type FactsheetCategory,
} from "@/components/factsheets/factsheets-data";

export function FactsheetsTopicsPage({
  selectedTopic,
  previewLimit = TOPIC_SECTION_PREVIEW_LIMIT,
  chipOverflowAfter = TOPIC_CHIP_OVERFLOW_AFTER,
}: {
  selectedTopic?: FactsheetCategory;
  previewLimit?: number;
  chipOverflowAfter?: number;
}) {
  const groups = factsheetsGroupedByCategory();
  const visibleGroups = selectedTopic ? groups.filter((group) => group.category === selectedTopic) : groups;
  const sheetCount = selectedTopic
    ? (groups.find((group) => group.category === selectedTopic)?.sheets.length ?? 0)
    : factsheets.length;

  return (
    <div
      data-testid="factsheets-topics-page"
      className="mx-auto w-full max-w-[64rem] px-4 py-5 pb-4 sm:px-6 sm:py-8 lg:px-8"
    >
      <header>
        <p className="text-2xs font-bold uppercase tracking-label text-[color:var(--clinical-accent)]">
          Patient information
        </p>
        <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-[color:var(--text-heading)]">Topics</h1>
        <p className="mt-2 text-sm font-medium text-[color:var(--text-muted)]">
          <span className="nums font-bold text-[color:var(--text-heading)]">{sheetCount}</span>{" "}
          {sheetCount === 1 ? "sheet" : "sheets"}
          {selectedTopic ? ` in ${selectedTopic}` : " organised by topic"}
        </p>
      </header>

      <FactsheetsTopicsBrowse
        groups={groups}
        visibleGroups={visibleGroups}
        selectedTopic={selectedTopic}
        previewLimit={previewLimit}
        chipOverflowAfter={chipOverflowAfter}
      />

      <aside className="mt-5 flex gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--info)]" aria-hidden="true" />
        <p className="text-sm-minus leading-5 text-[color:var(--text-muted)]">
          <strong className="font-bold text-[color:var(--text-heading)]">Content status:</strong> These sheets are dated
          demonstration content with public source links. Connect only governance-approved patient information before
          publication.
        </p>
      </aside>
    </div>
  );
}
