import type { SheetRow } from "@/lib/teaching/depth-model";

/*
 * The browser half of the term import's file reading: CSV only, with no library, so the Import
 * screen never loads exceljs. An .xlsx is read on the server (`import-sheet-reader.ts`).
 */

/** Columns past this are never read; the template has ten. Matches `sheetRowSchema`. */
export const MAX_COLUMNS = 30;

/** RFC 4180 (quotes, doubled quotes, CRLF or LF). Blank rows are skipped; line numbers stay true. */
export function parseCsv(text: string): SheetRow[] {
  const rows: SheetRow[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let start = 1;
  const end = () => {
    cells.push(cell);
    if (cells.some((value) => value.trim() !== "")) rows.push({ line: start, cells: cells.slice(0, MAX_COLUMNS) });
    cells = [];
    cell = "";
  };
  const body = text.replace(/^﻿/, "");
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else {
        if (ch === "\n") line += 1;
        cell += ch;
      }
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      cells.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && body[i + 1] === "\n") i += 1;
      end();
      line += 1;
      start = line;
    } else cell += ch;
  }
  end();
  return rows;
}
