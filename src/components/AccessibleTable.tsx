"use client";

import { cn, textMuted } from "@/components/ui-primitives";

function parseMarkdownTable(markdown?: string | null) {
  if (!markdown) return null;
  const rows = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes("|") && !/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(line))
    .map((line) =>
      line
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.replace(/\\\|/g, "|").trim()),
    )
    .filter((row) => row.some(Boolean));
  return rows.length ? rows : null;
}

export function AccessibleTable({
  caption,
  markdown,
  rows,
  columns,
  compact = false,
}: {
  caption?: string | null;
  markdown?: string | null;
  rows?: string[][] | null;
  columns?: string[] | null;
  compact?: boolean;
}) {
  const parsed = rows?.length ? rows : parseMarkdownTable(markdown);
  if (!parsed?.length) return null;

  const header = columns?.length ? columns : parsed[0];
  const body = columns?.length ? parsed : parsed.slice(1);
  const columnCount = Math.max(header.length, ...body.map((row) => row.length), 1);
  const paddedHeader = [...header, ...Array.from({ length: Math.max(0, columnCount - header.length) }, () => "")];
  const visibleBody = body.slice(0, compact ? 6 : 20);

  return (
    <div className="overflow-x-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]">
      <table className="min-w-full border-collapse text-left text-sm">
        {caption ? (
          <caption className={cn("caption-top px-3 py-2 text-left text-xs font-semibold", textMuted)}>{caption}</caption>
        ) : null}
        <thead>
          <tr className="bg-[color:var(--surface-subtle)]">
            {paddedHeader.map((cell, index) => (
              <th
                key={`${cell || "column"}:${index}`}
                scope="col"
                className="border-b border-[color:var(--border)] px-3 py-2 align-top text-xs font-semibold text-[color:var(--text)]"
              >
                {cell || `Column ${index + 1}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleBody.map((row, rowIndex) => {
            const padded = [...row, ...Array.from({ length: Math.max(0, columnCount - row.length) }, () => "")];
            return (
              <tr key={`${rowIndex}:${padded.join("|")}`} className="border-t border-[color:var(--border)]/70">
                {padded.map((cell, cellIndex) => (
                  <td key={`${rowIndex}:${cellIndex}`} className="px-3 py-2 align-top leading-5 text-[color:var(--text)]">
                    {cell || <span className={textMuted}>-</span>}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {body.length > visibleBody.length ? (
        <p className={cn("border-t border-[color:var(--border)] px-3 py-2 text-xs", textMuted)}>
          Showing {visibleBody.length} of {body.length} rows.
        </p>
      ) : null}
    </div>
  );
}
