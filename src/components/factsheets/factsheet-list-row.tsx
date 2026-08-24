import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { categoryTheme, type Factsheet } from "@/components/factsheets/factsheets-data";
import { factsheetGlyph } from "@/components/factsheets/factsheets-icons";

export function FactsheetListRow({ sheet }: { sheet: Factsheet }) {
  const theme = categoryTheme(sheet.category);
  return (
    <Link
      href={`/factsheets/${sheet.slug}`}
      data-testid="factsheets-result"
      className="group flex items-start gap-3.5 border-b border-[color:var(--border)] px-4 py-4 transition last:border-b-0 hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)]"
    >
      <span
        className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg"
        style={{ backgroundColor: theme.soft, color: theme.accent }}
      >
        {factsheetGlyph(sheet.icon, "h-5 w-5")}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-base-minus font-bold text-[color:var(--text-heading)] group-hover:text-[color:var(--clinical-accent)]">
            {sheet.title}
            {sheet.brand ? <span className="font-medium text-[color:var(--text-muted)]"> {sheet.brand}</span> : null}
          </span>
          <span
            className="rounded-md px-2 py-0.5 text-2xs font-bold"
            style={{ backgroundColor: theme.soft, color: theme.accent }}
          >
            {sheet.category}
          </span>
        </span>
        <span className="mt-1 block max-w-2xl text-pretty text-sm-minus leading-5 text-[color:var(--text-muted)]">
          {sheet.summary}
        </span>
        <span className="mt-2 block text-xs font-bold text-[color:var(--text-muted)]">
          {sheet.audience} · {sheet.readTime}
        </span>
      </span>
      <ChevronRight
        className="h-5 w-5 shrink-0 self-center text-[color:var(--decoration-soft)] transition group-hover:text-[color:var(--clinical-accent)]"
        aria-hidden="true"
      />
    </Link>
  );
}
