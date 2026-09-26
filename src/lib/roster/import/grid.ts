import type { OnCallShiftInput } from "@/lib/roster/shifts/model";
import { perthWallToIso, addDaysToDate } from "@/lib/roster/shifts/perth-time";
import { inferShiftKind, SHIFT_KIND_LABEL, type ShiftKind } from "@/lib/roster/shift-kind";

/**
 * A hospital roster as people print it: one row per doctor, one column per
 * day, a short code in each cell. Excel, PDF and grid-shaped CSV files are all
 * read into this one shape first, so "which row is you", unknown codes and the
 * change preview are written once.
 */

export type RosterGrid = {
  /** One Perth date per column, `YYYY-MM-DD`, or null for a column that is not a day. */
  readonly dates: readonly (string | null)[];
  readonly rows: readonly { readonly name: string; readonly cells: readonly string[] }[];
};

/** What a code means for this doctor at this workplace. Times are Perth `HH:MM`. */
export type CodeMeaning =
  { readonly kind: "off" } | { readonly kind: ShiftKind; readonly start: string; readonly end: string };
/** Keys are normalised codes (see `normaliseCode`). */
export type CodeMap = Readonly<Record<string, CodeMeaning>>;

export type RosterShiftDraft = OnCallShiftInput & { readonly kind: ShiftKind };

export type GridRowResult = {
  readonly shifts: RosterShiftDraft[];
  /** Codes this doctor has not told us about yet, most used first. Save waits until each is chosen. */
  readonly unknown: { readonly code: string; readonly days: number }[];
};

const OFF_CODES = new Set(["", "OFF", "-", "–", "—", "/"]);
const TIME_RANGE = /^(\d{1,2}):?(\d{2})\s*[-–to]+\s*(\d{1,2}):?(\d{2})$/i;

export function normaliseCode(cell: string): string {
  return cell.replace(/\s+/g, " ").trim().toUpperCase();
}

function hhmm(hours: string, minutes: string): string | null {
  const h = Number(hours);
  const m = Number(minutes);
  if (h > 24 || m > 59 || (h === 24 && m > 0)) return null;
  return `${String(h % 24).padStart(2, "0")}:${minutes}`;
}

/** Start and end on a Perth date; an end at or before the start is the next day. */
function shiftOn(date: string, start: string, end: string): { startsAt: string; endsAt: string } | null {
  const startsAt = perthWallToIso(date, start);
  const sameDay = perthWallToIso(date, end);
  if (!startsAt || !sameDay) return null;
  const endsAt = end > start ? sameDay : perthWallToIso(addDaysToDate(date, 1), end);
  return endsAt ? { startsAt, endsAt } : null;
}

/**
 * The shifts in one doctor's row. A cell holding times ("08:00-16:30" or
 * "0800-1630") needs no code; an empty or "OFF" cell is a day off; anything
 * else is looked up in the doctor's code map, and if it isn't there it is
 * listed as unknown rather than guessed.
 */
export function gridRowToShifts(grid: RosterGrid, rowIndex: number, codes: CodeMap): GridRowResult {
  const row = grid.rows[rowIndex];
  if (!row) return { shifts: [], unknown: [] };
  const shifts: RosterShiftDraft[] = [];
  const unknown = new Map<string, number>();
  grid.dates.forEach((date, column) => {
    if (!date) return;
    const code = normaliseCode(row.cells[column] ?? "");
    if (OFF_CODES.has(code)) return;
    const range = TIME_RANGE.exec(code);
    if (range) {
      const start = hhmm(range[1]!, range[2]!);
      const end = hhmm(range[3]!, range[4]!);
      const times = start && end ? shiftOn(date, start, end) : null;
      if (times) {
        const kind = inferShiftKind({ ...times, title: "" });
        shifts.push({ ...times, kind, title: SHIFT_KIND_LABEL[kind], location: null, sourceUid: null });
        return;
      }
    }
    const meaning = codes[code];
    if (!meaning) {
      unknown.set(code, (unknown.get(code) ?? 0) + 1);
      return;
    }
    if (meaning.kind === "off") return;
    const times = shiftOn(date, meaning.start, meaning.end);
    if (!times) return;
    shifts.push({
      ...times,
      kind: meaning.kind,
      title: SHIFT_KIND_LABEL[meaning.kind],
      location: null,
      sourceUid: null,
    });
  });
  const list = [...unknown].map(([code, days]) => ({ code, days }));
  list.sort((a, b) => b.days - a.days || a.code.localeCompare(b.code));
  return { shifts, unknown: list };
}

function nameKey(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/^(dr|doctor)\.?\s+/, "")
    .replace(/[^a-z,\s'-]/g, "")
    .trim();
  const comma = cleaned.indexOf(",");
  const ordered = comma > 0 ? `${cleaned.slice(comma + 1)} ${cleaned.slice(0, comma)}` : cleaned;
  return ordered.replace(/[,'-]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * The row the doctor chose last time, found again by name: case, "Dr",
 * punctuation and "Surname, First" order don't matter. Null when no row, or
 * more than one row, matches, so the doctor is asked rather than guessed for.
 */
export function findRememberedRow(grid: RosterGrid, rememberedName: string | null): number | null {
  if (!rememberedName) return null;
  const key = nameKey(rememberedName);
  if (!key) return null;
  const matches = grid.rows.flatMap((row, index) => (nameKey(row.name) === key ? [index] : []));
  return matches.length === 1 ? matches[0]! : null;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

type DayMonth = { day: number; month: number; year: number | null };

function readHeader(value: string | Date | null | undefined): DayMonth | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return { day: value.getUTCDate(), month: value.getUTCMonth() + 1, year: value.getUTCFullYear() };
  }
  if (typeof value !== "string") return null;
  const text = value
    .trim()
    .toLowerCase()
    .replace(/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*[\s,]*/, "");
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match) return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  match = /^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2}|\d{4}))?$/.exec(text);
  if (match) {
    const year = match[3] ? Number(match[3].length === 2 ? `20${match[3]}` : match[3]) : null;
    return { day: Number(match[1]), month: Number(match[2]), year };
  }
  match = /^(\d{1,2})[\s-]*([a-z]{3})[a-z]*\.?(?:[\s-]+(\d{4}))?$/.exec(text);
  if (match && MONTHS.includes(match[2]!)) {
    return { day: Number(match[1]), month: MONTHS.indexOf(match[2]!) + 1, year: match[3] ? Number(match[3]) : null };
  }
  return null;
}

function isoDate(year: number, month: number, day: number): string | null {
  const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return perthWallToIso(date, "00:00") ? date : null;
}

/**
 * Column headers to Perth dates. Dates are Australian day-first. A header
 * without a year takes the year that puts the first date nearest to today,
 * then each later column rolls into the next year when the months wrap
 * (a December to January roster). Anything that isn't a date is null.
 */
export function parseHeaderDates(
  headers: readonly (string | Date | null | undefined)[],
  today: string,
): (string | null)[] {
  const todayYear = Number(today.slice(0, 4));
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  let previous: string | null = null;
  return headers.map((header) => {
    const read = readHeader(header);
    if (!read || read.month < 1 || read.month > 12) return null;
    let year = read.year;
    if (year === null) {
      if (previous) {
        year = Number(previous.slice(0, 4));
        const candidate = isoDate(year, read.month, read.day);
        if (candidate && candidate < previous) year += 1;
      } else {
        const options = [todayYear - 1, todayYear, todayYear + 1].flatMap((option) => {
          const date = isoDate(option, read.month, read.day);
          return date ? [{ option, distance: Math.abs(Date.parse(`${date}T00:00:00Z`) - todayMs) }] : [];
        });
        options.sort((a, b) => a.distance - b.distance);
        year = options[0]?.option ?? todayYear;
      }
    }
    const date = isoDate(year, read.month, read.day);
    if (date) previous = date;
    return date;
  });
}

/** How many columns of a header row are dates. The readers use it to find the header row. */
export function countDates(headers: readonly (string | Date | null | undefined)[]): number {
  return headers.filter((header) => readHeader(header) !== null).length;
}
