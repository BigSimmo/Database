import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { categoryTheme, factsheetDetailHref, type Factsheet } from "@/components/factsheets/factsheets-data";
import { factsheetGlyph } from "@/components/factsheets/factsheets-icons";
import { cn } from "@/components/ui-primitives";

export function FactsheetListRow({ sheet, compact = false }: { sheet: Factsheet; compact?: boolean }) {
  const theme = categoryTheme(sheet.category);
  return (
    <Link
      href={factsheetDetailHref(sheet.slug)}
      data-testid="factsheets-result"
      className={cn(
        "group flex items-start gap-3.5 border-b border-[color:var(--border)] transition last:border-b-0 hover:bg-[color:var(--surface-subtle)] focus-ring-contained",
        compact ? "px-3.5 py-3" : "px-4 py-4",
      )}
    >
      <span
        className={cn("mt-0.5 grid shrink-0 place-items-center rounded-lg", compact ? "h-9 w-9" : "h-10 w-10")}
        style={{ backgroundColor: theme.soft, color: theme.accent }}
      >
        {factsheetGlyph(sheet.icon, compact ? "h-4 w-4" : "h-5 w-5")}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-base-minus font-bold text-[color:var(--text-heading)] group-hover:text-[color:var(--clinical-accent)]">
            {sheet.title}
            {sheet.brand ? <span className="font-medium text-[color:var(--text-muted)]"> {sheet.brand}</span> : null}
          </span>
          {compact ? null : (
            <span
              className="rounded-md px-2 py-0.5 text-2xs font-bold"
              style={{ backgroundColor: theme.soft, color: theme.accent }}
            >
              {sheet.category}
            </span>
          )}
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
