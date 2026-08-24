import { Info } from "lucide-react";

import { FactsheetsTopicsBrowse } from "@/components/factsheets/factsheets-topics-browse";
import {
  TOPIC_SECTION_PREVIEW_LIMIT,
  factsheetCategories,
  factsheets,
  factsheetsGroupedByCategory,
  type FactsheetCategory,
} from "@/components/factsheets/factsheets-data";

export function FactsheetsTopicsPage({
  selectedTopic,
  previewLimit = TOPIC_SECTION_PREVIEW_LIMIT,
}: {
  selectedTopic?: FactsheetCategory;
  previewLimit?: number;
}) {
  const groups = factsheetsGroupedByCategory();

  return (
    <div
      data-testid="factsheets-topics-page"
      className="mx-auto w-full max-w-reading px-4 py-5 pb-4 sm:px-6 sm:py-8 lg:px-8"
    >
      <header>
        <p className="text-2xs font-bold uppercase tracking-label text-[color:var(--clinical-accent)]">
          Patient information
        </p>
        <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-[color:var(--text-heading)]">Topics</h1>
        <p className="mt-2 text-sm font-medium text-[color:var(--text-muted)]">
          <span className="nums font-bold text-[color:var(--text-heading)]">{factsheetCategories.length}</span> topics ·{" "}
          <span className="nums font-bold text-[color:var(--text-heading)]">{factsheets.length}</span> sheets
        </p>
      </header>

      <FactsheetsTopicsBrowse
        key={selectedTopic ?? "all"}
        groups={groups}
        selectedTopic={selectedTopic}
        previewLimit={previewLimit}
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
