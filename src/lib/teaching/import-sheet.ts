import {
  IMPORT_MAX_FILE_BYTES,
  IMPORT_MAX_ROWS,
  IMPORT_TEMPLATE_HEADERS,
  importSeriesSchema,
  type ImportPreview,
  type SheetRow,
} from "@/lib/teaching/depth-model";
import { plainTeachingIssue, type GroupRow, type SeriesInput } from "@/lib/teaching/model";

/*
 * A term of sessions from the template (spec §9). Master plan R25: the browser reads the file with
 * `parseCsv` or `readXlsxRows` and sends only the rows; the server runs `previewRows` against the
 * organiser's groups, and the commit is one all-or-nothing call. No file is sent or stored. The
 * template has no presenter or patient-related column. Client-safe: exceljs and jszip load on demand.
 */
export type { SheetRow };
type Header = (typeof IMPORT_TEMPLATE_HEADERS)[number];
const COLUMN: Record<string, Header> = {
  title: "title",
  kind: "kind",
  repeat: "repeat",
  firstDate: "first_date",
  endDate: "end_date",
  startTime: "start_time",
  minutes: "minutes",
  venue: "venue",
  joinUrl: "join_link",
  groupIds: "groups",
};
/** Columns past this are never read; the template has ten. Matches `sheetRowSchema`. */
const MAX_COLUMNS = 30;
const MAX_ARCHIVE_ENTRIES = 1_000;
const MAX_EXPANDED_BYTES = 32 * 1024 * 1024;
export const IMPORT_UNREADABLE_MESSAGE = "This file couldn't be read. Save it from the template as .xlsx or .csv.";
export const IMPORT_TOO_LARGE_MESSAGE = "Use a file under 1 MB.";

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

function cellText(value: unknown): string {
  if (value instanceof Date) {
    const iso = value.toISOString();
    return value.getUTCFullYear() < 1901 ? iso.slice(11, 16) : iso.slice(0, 10); // Excel keeps a time as 30 Dec 1899
  }
  if (value && typeof value === "object") {
    if ("error" in value) return "";
    if ("hyperlink" in value) return String((value as { hyperlink: unknown }).hyperlink ?? "");
    if ("result" in value) return cellText((value as { result: unknown }).result);
    if ("richText" in value)
      return (value as { richText: { text: string }[] }).richText.map((part) => part.text).join("");
  }
  return value === null || value === undefined ? "" : String(value);
}

/**
 * The same archive budget document ingestion uses (`assertOoxmlArchiveBudget`), with limits sized for
 * a timetable, so a crafted file is refused before it is expanded.
 */
async function assertSmallWorkbook(bytes: Uint8Array): Promise<void> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(bytes).catch(() => {
    throw new Error(IMPORT_UNREADABLE_MESSAGE);
  });
  const entries = Object.values(zip.files);
  const expanded = entries.reduce((total, file) => {
    const data = (file as unknown as { _data?: { uncompressedSize?: number } })._data;
    return total + Math.max(0, Number(data?.uncompressedSize ?? 0));
  }, 0);
  if (entries.length > MAX_ARCHIVE_ENTRIES || expanded > MAX_EXPANDED_BYTES) throw new Error(IMPORT_UNREADABLE_MESSAGE);
}

/** The first sheet of an .xlsx the doctor chose, read on the device. Errors carry plain words. */
export async function readXlsxRows(data: ArrayBuffer | Uint8Array): Promise<SheetRow[]> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.byteLength > IMPORT_MAX_FILE_BYTES) throw new Error(IMPORT_TOO_LARGE_MESSAGE);
  await assertSmallWorkbook(bytes);
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch {
    throw new Error(IMPORT_UNREADABLE_MESSAGE);
  }
  const rows: SheetRow[] = [];
  workbook.worksheets[0]?.eachRow({ includeEmpty: false }, (row, line) => {
    const values = Array.isArray(row.values) ? row.values.slice(1, MAX_COLUMNS + 1) : [];
    rows.push({ line, cells: Array.from(values, cellText) });
  });
  return rows;
}

export function previewRows(table: readonly SheetRow[], groups: readonly GroupRow[]): ImportPreview {
  const [head, ...body] = table;
  const headers = (head?.cells ?? []).map((cell) => cell.trim().toLowerCase());
  const missing = IMPORT_TEMPLATE_HEADERS.filter((name) => !headers.includes(name));
  const refuse = (message: string): ImportPreview => ({
    rows: [{ line: head?.line ?? 1, title: "", errors: [message] }],
    ready: null,
  });
  if (!head || missing.length > 0) return refuse(`The first row must name these columns: ${missing.join(", ")}.`);
  if (body.length === 0) return refuse("Add at least one session under the headings.");
  if (body.length > IMPORT_MAX_ROWS) return refuse(`Import at most ${IMPORT_MAX_ROWS} rows at a time.`);

  const groupIds = new Map(groups.map((group) => [group.name.trim().toLowerCase(), group.groupId]));
  const seen = new Map<string, number>();
  const ready: SeriesInput[] = [];
  const rows = body.map(({ line, cells }) => {
    const get = (name: Header) => (cells[headers.indexOf(name)] ?? "").trim();
    const errors: string[] = [];
    const ids = get("groups")
      .split(";")
      .map((name) => name.trim())
      .filter(Boolean)
      .flatMap((name) => {
        const found = groupIds.get(name.toLowerCase());
        if (!found) errors.push(`groups: No group called "${name}". Add it in Organise first.`);
        return found ? [found] : [];
      });
    const candidate = {
      title: get("title"),
      kind: get("kind"),
      repeat: get("repeat"),
      firstDate: get("first_date"),
      endDate: get("end_date") || get("first_date"),
      startTime: get("start_time"),
      minutes: Number(get("minutes")),
      venue: get("venue") || null,
      joinUrl: get("join_link") || null,
      groupIds: ids,
    };
    const parsed = importSeriesSchema.safeParse(candidate);
    if (!parsed.success)
      for (const issue of parsed.error.issues)
        errors.push(`${COLUMN[String(issue.path[0])] ?? "row"}: ${plainTeachingIssue([issue])}`);
    const key = `${candidate.title.toLowerCase()}|${candidate.firstDate}|${candidate.startTime}`;
    const earlier = seen.get(key);
    if (earlier) errors.push(`Same session as line ${earlier}.`);
    else seen.set(key, line);
    if (parsed.success && errors.length === 0) ready.push(parsed.data);
    return { line, title: candidate.title, errors };
  });
  return { rows, ready: rows.every((row) => row.errors.length === 0) ? ready : null };
}
