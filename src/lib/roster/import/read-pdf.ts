import "server-only";

import { countDates, type RosterGrid } from "@/lib/roster/import/grid";
import { RosterReadError, tableToGrid, type TableCell } from "@/lib/roster/import/table";

const MAX_PAGES = 12;
const LINE_TOLERANCE = 3;

type Word = { readonly text: string; readonly x: number; readonly y: number; readonly width: number };

/** Text runs on one printed line, left to right. */
function linesOf(words: readonly Word[]): Word[][] {
  const lines: Word[][] = [];
  const sorted = [...words].sort((a, b) => b.y - a.y || a.x - b.x);
  for (const word of sorted) {
    const line = lines.at(-1);
    if (line && Math.abs(line[0]!.y - word.y) <= LINE_TOLERANCE) line.push(word);
    else lines.push([word]);
  }
  return lines.map((line) => line.sort((a, b) => a.x - b.x));
}

/**
 * One page's lines to table rows. The header line (the one with the most
 * dates) fixes the day columns by the centre of each date; every other word
 * joins the nearest column. Words left of the days join the column whose
 * header word they start under (name, grade, ward). Weekday words printed above or beside a date are ignored.
 */
function pageTable(words: readonly Word[]): TableCell[][] | null {
  const lines = linesOf(words);
  const header = lines.reduce<Word[] | null>((best, line) => {
    const dates = countDates(line.map((word) => word.text));
    return dates >= 3 && dates > (best ? countDates(best.map((word) => word.text)) : 0) ? line : best;
  }, null);
  if (!header) return null;
  const dateWords = header.filter((word) => countDates([word.text]) === 1);
  const centres = dateWords.map((word) => word.x + word.width / 2);
  const gap = Math.min(...centres.slice(1).map((centre, index) => centre - centres[index]!), 60);
  const firstLeft = centres[0]! - gap / 2;
  // Columns left of the days (name, grade, ward) start where their header word starts.
  const leftHeaders = header.filter((word) => word.x + word.width / 2 < firstLeft);
  const leftStarts = leftHeaders.length > 0 ? leftHeaders.map((word) => word.x) : [0];
  const table: TableCell[][] = [
    [...leftStarts.map((_, index) => leftHeaders[index]?.text ?? ""), ...dateWords.map((word) => word.text)],
  ];
  for (const line of lines.slice(lines.indexOf(header) + 1)) {
    const cells: string[] = new Array(leftStarts.length + centres.length).fill("");
    for (const word of line) {
      const middle = word.x + word.width / 2;
      if (middle < firstLeft) {
        let column = 0;
        leftStarts.forEach((start, index) => {
          if (word.x >= start - LINE_TOLERANCE) column = index;
        });
        cells[column] = `${cells[column]} ${word.text}`.trim();
        continue;
      }
      let nearest = 0;
      centres.forEach((centre, index) => {
        if (Math.abs(centre - middle) < Math.abs(centres[nearest]! - middle)) nearest = index;
      });
      const column = leftStarts.length + nearest;
      if (Math.abs(centres[nearest]! - middle) <= gap / 2) cells[column] = `${cells[column]} ${word.text}`.trim();
    }
    table.push(cells);
  }
  return table;
}

/**
 * A text PDF roster to a grid, on the server, in memory. A scanned PDF has no
 * text to read and says so; reading scans is left off until a health service
 * agrees to it. The file is never stored or logged.
 */
export async function readRosterPdf(buffer: Buffer, today: string): Promise<RosterGrid> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: false });
  let pdf;
  try {
    pdf = await task.promise;
  } catch {
    await task.destroy();
    throw new RosterReadError("unreadable");
  }
  try {
    let sawText = false;
    let lastError = new RosterReadError("no_dates");
    for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, MAX_PAGES); pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const words: Word[] = content.items.flatMap((item) =>
        "str" in item && item.str.trim()
          ? [
              {
                text: item.str.trim(),
                x: item.transform[4] as number,
                y: item.transform[5] as number,
                width: item.width,
              },
            ]
          : [],
      );
      if (words.length > 0) sawText = true;
      const table = pageTable(words);
      if (!table) continue;
      try {
        return tableToGrid(table, today);
      } catch (error) {
        if (error instanceof RosterReadError) lastError = error;
        else throw error;
      }
    }
    throw sawText ? lastError : new RosterReadError("scanned");
  } finally {
    await task.destroy();
  }
}
