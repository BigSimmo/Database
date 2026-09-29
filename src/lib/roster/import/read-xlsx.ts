import "server-only";

import ExcelJS from "exceljs";
import JSZip from "jszip";

import type { RosterGrid } from "@/lib/roster/import/grid";
import { RosterReadError, tableToGrid, type TableCell } from "@/lib/roster/import/table";

const MAX_ROWS = 400;
const MAX_COLUMNS = 120;
/** A roster workbook is small; anything that unpacks past this is refused before Excel parsing starts. */
const MAX_EXPANDED_BYTES = 32 * 1024 * 1024;

async function assertSmallWorkbook(buffer: Buffer): Promise<void> {
  const zip = await JSZip.loadAsync(buffer).catch(() => {
    throw new RosterReadError("unreadable");
  });
  const entries = Object.values(zip.files);
  const expanded = entries.reduce((total, file) => {
    const data = (file as unknown as { _data?: { uncompressedSize?: number } })._data;
    return total + Math.max(0, Number(data?.uncompressedSize ?? 0));
  }, 0);
  if (entries.length > 2_000 || expanded > MAX_EXPANDED_BYTES) throw new RosterReadError("too_big");
}

function cellValue(value: ExcelJS.CellValue): TableCell {
  if (value === null || value === undefined) return null;
  if (value instanceof Date || typeof value === "string" || typeof value === "number") return value;
  if (typeof value === "object" && "result" in value) return cellValue(value.result as ExcelJS.CellValue);
  if (typeof value === "object" && "richText" in value) return value.richText.map((part) => part.text).join("");
  if (typeof value === "object" && "text" in value) return String(value.text);
  return String(value);
}

/**
 * An Excel roster to a grid, on the server, in memory. The first sheet with a
 * date header row wins. The file is never stored or logged: only the grid
 * goes back to the doctor's phone.
 */
export async function readRosterXlsx(buffer: Buffer, today: string): Promise<RosterGrid> {
  await assertSmallWorkbook(buffer);
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch {
    throw new RosterReadError("unreadable");
  }
  let lastError: RosterReadError = new RosterReadError("no_dates");
  for (const sheet of workbook.worksheets) {
    const table: TableCell[][] = [];
    sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      if (rowNumber > MAX_ROWS) return;
      const values = Array.isArray(row.values) ? row.values.slice(1, MAX_COLUMNS + 1) : [];
      table[rowNumber - 1] = values.map((value) => cellValue(value as ExcelJS.CellValue));
    });
    try {
      return tableToGrid(
        Array.from(table, (row) => row ?? []),
        today,
      );
    } catch (error) {
      if (error instanceof RosterReadError) lastError = error;
      else throw error;
    }
  }
  throw lastError;
}
