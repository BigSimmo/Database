import { countDates, parseHeaderDates, type RosterGrid } from "@/lib/roster/import/grid";

/** A cell as a spreadsheet or PDF gives it to us. */
export type TableCell = string | Date | number | null | undefined;

/** Why a file couldn't become a roster, in words the import screen shows as is. */
export class RosterReadError extends Error {
  constructor(readonly reason: "no_dates" | "no_names" | "scanned" | "too_big" | "unreadable") {
    super(reason);
  }
}

const HEADER_SEARCH_ROWS = 15;
const MIN_DATE_COLUMNS = 3;

function text(cell: TableCell): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) return "";
  return String(cell).trim();
}

function looksLikeName(cell: TableCell): boolean {
  const value = text(cell);
  return value.length >= 3 && /[a-z]{2,}/i.test(value) && !/^\d/.test(value);
}

/** A blank name may be a vacancy, but totals and empty layout rows are not. */
function looksLikeShiftCell(cell: TableCell): boolean {
  const value = text(cell).toUpperCase();
  if (!value || ["OFF", "-", "–", "—", "/", "TOTAL", "SUM", "HOURS", "DATE", "NAME"].includes(value)) return false;
  if (/^\d{1,2}:?\d{2}\s*(?:[-–]|TO)\s*\d{1,2}:?\d{2}$/.test(value)) return true;
  return value.length <= 12 && /^[A-Z][A-Z0-9 /+_-]*$/.test(value);
}

/**
 * Rows and columns to a roster grid. The header row is the first of the top
 * rows with at least three dates in it; the names are the column, left of the
 * first date, holding the most name-like text (a grade or ward column sits
 * beside it on many rosters). A blank name is retained only when a dated cell
 * looks like a shift, so Roster can offer it as an open shift.
 */
export function tableToGrid(table: readonly (readonly TableCell[])[], today: string): RosterGrid {
  const headerIndex = table
    .slice(0, HEADER_SEARCH_ROWS)
    .findIndex(
      (row) => countDates(row.map((cell) => (typeof cell === "number" ? String(cell) : cell))) >= MIN_DATE_COLUMNS,
    );
  if (headerIndex < 0) throw new RosterReadError("no_dates");
  const header = table[headerIndex]!.map((cell) => (typeof cell === "number" ? String(cell) : cell));
  const dates = parseHeaderDates(header, today);
  const firstDate = dates.findIndex((date) => date !== null);
  const body = table.slice(headerIndex + 1);

  let nameColumn = -1;
  let best = 0;
  for (let column = 0; column < firstDate; column += 1) {
    const score = body.filter((row) => looksLikeName(row[column])).length;
    if (score > best) {
      best = score;
      nameColumn = column;
    }
  }
  if (nameColumn < 0) throw new RosterReadError("no_names");

  const rows = body.flatMap((row) => {
    const name = text(row[nameColumn]);
    if (!looksLikeName(name)) {
      if (name || !dates.some((date, column) => date && looksLikeShiftCell(row[column]))) return [];
    }
    return [{ name, cells: dates.map((_, column) => text(row[column])) }];
  });
  if (rows.length === 0) throw new RosterReadError("no_names");
  return { dates, rows };
}
