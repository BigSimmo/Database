import { Info } from "lucide-react";

import { FactsheetListRow } from "@/components/factsheets/factsheet-list-row";
import { categoryTheme, factsheets, factsheetsGroupedByCategory } from "@/components/factsheets/factsheets-data";

function topicSectionId(category: string) {
  return `factsheet-topic-${category.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
}

export function FactsheetsTopicsPage() {
  const groups = factsheetsGroupedByCategory();
  const sheetCount = factsheets.length;

  return (
    <div
      data-testid="factsheets-topics-page"
      className="mx-auto w-full max-w-[64rem] px-4 py-6 pb-4 sm:px-6 sm:py-8 lg:px-8"
    >
      <header>
        <p className="text-2xs font-bold uppercase tracking-label text-[color:var(--clinical-accent)]">
          Patient information
        </p>
        <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-[color:var(--text-heading)]">Topics</h1>
        <p className="mt-2 text-sm font-medium text-[color:var(--text-muted)]">
          <span className="nums font-bold text-[color:var(--text-heading)]">{sheetCount}</span>{" "}
          {sheetCount === 1 ? "sheet" : "sheets"} organised by topic
        </p>
      </header>

      <div className="mt-6 grid gap-6">
        {groups.map(({ category, sheets }) => {
          const theme = categoryTheme(category);
          const headingId = topicSectionId(category);
          return (
            <section key={category} aria-labelledby={headingId} data-testid={headingId}>
              <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <h2 id={headingId} className="text-lg font-extrabold tracking-tight text-[color:var(--text-heading)]">
                  {category}
                </h2>
                <p className="text-xs font-bold" style={{ color: theme.accent }}>
                  <span className="nums">{sheets.length}</span> {sheets.length === 1 ? "sheet" : "sheets"}
                </p>
              </header>
              <div className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]">
                {sheets.map((sheet) => (
                  <FactsheetListRow key={sheet.slug} sheet={sheet} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

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
