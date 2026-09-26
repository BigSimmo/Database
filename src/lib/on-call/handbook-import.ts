import { parseApiErrorResponse } from "@/lib/api-client-error";
import { parseHandbookTitle, type OnCallTeam } from "@/lib/on-call/handbook-title";
import { resolveHandbookPhone, type HandbookDial } from "@/lib/on-call/number-resolver";
import {
  serviceActionSchema,
  type ServiceAction,
  type ServiceContent,
  type ServiceDetail,
  type ServiceEntry,
} from "@/lib/on-call/service-model";

/**
 * Manage service's spreadsheet import (plan Task 4.1, review F4).
 *
 * CSV only, read in the browser with `File.text()`: nothing is uploaded or kept
 * server-side, and no spreadsheet dependency is added (correction C13). Only
 * the rows an editor ticks are sent, each as an ordinary `entry.save` with
 * `publish: false`, so an import only ever makes **drafts**. Publishing is a
 * separate step, at most 20 at a time, after the editor has seen each change.
 *
 * Both runs post one entry at a time, 2 s apart, straight to the service API
 * rather than through the page's `action()`, which reloads after every call and
 * would use up the shared 60-a-minute bucket (correction C14). The panel
 * reloads once at the end.
 *
 * Columns for ladder wait times and after-hours times are hospital-set Stage B
 * fields that do not exist yet: like any other unknown column they are listed
 * as not imported, and their values go nowhere.
 */

export const HANDBOOK_IMPORT_MAX_ROWS = 200;
export const HANDBOOK_IMPORT_SPACING_MS = 2000;
export const HANDBOOK_IMPORT_MAX_RETRIES = 3;
export const HANDBOOK_PUBLISH_BATCH_MAX = 20;
const DEFAULT_RETRY_AFTER_SECONDS = 30;

export type HandbookImportSection = "contacts" | "referrals" | "resources";

/** An entry the row would update: same site, same section, same title (case and spacing ignored). */
export type HandbookImportExisting = {
  readonly id: string;
  readonly revision: number;
  readonly title: string;
  readonly phone: string;
  readonly body: string;
  readonly kind: ServiceContent["kind"];
  readonly sources: ServiceContent["sources"];
  readonly orientationPhase: ServiceContent["orientationPhase"];
};

export type HandbookImportRow = {
  /** 1-based line in the file, for the editor. */
  readonly line: number;
  /** "<Team>: <title>" when a team column is given and the title lacks a prefix. */
  readonly title: string;
  readonly phone: string;
  readonly notes: string;
  readonly team: OnCallTeam | null;
  /** Shown as typed; never used to refuse a row. */
  readonly phoneType: string;
  /** Preview of how the row will dial. */
  readonly dial: HandbookDial;
  /** Set when the row updates an entry: the panel shows old beside new. */
  readonly existing: HandbookImportExisting | null;
  /** Information only. */
  readonly notices: readonly string[];
  /** Only the server's own limits: the message `serviceActionSchema` gives. */
  readonly blocked: string | null;
};

export type HandbookImportParse = {
  readonly rows: readonly HandbookImportRow[];
  /** Headers as typed. Person names are never imported (Stage C, after the owner's go-ahead). */
  readonly ignoredColumns: readonly string[];
  readonly missingTitleColumn: boolean;
  /** More than `HANDBOOK_IMPORT_MAX_ROWS` data rows. */
  readonly truncated: boolean;
};

export const HANDBOOK_IMPORT_NOTICES = {
  text: "Will show as text, not a call button",
  hospitalPhone: "From a hospital phone only",
  update: "Updates an existing entry",
  unchanged: "Same as the saved entry",
} as const;

// ---------------------------------------------------------------------------
// CSV reader

type CsvRecord = { readonly line: number; readonly cells: string[] };

/** A character state machine: BOM, CRLF or LF, quoted commas and newlines, `""` escapes. */
function readCsvRecords(text: string): CsvRecord[] {
  const source = text.startsWith("﻿") ? text.slice(1) : text;
  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let recordLine = 1;
  let touched = false;

  const endRecord = () => {
    cells.push(cell);
    records.push({ line: recordLine, cells });
    cells = [];
    cell = "";
    touched = false;
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!;
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        if (char === "\n") line += 1;
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      touched = true;
    } else if (char === ",") {
      cells.push(cell);
      cell = "";
      touched = true;
    } else if (char === "\r" || char === "\n") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      endRecord();
      line += 1;
      recordLine = line;
    } else {
      cell += char;
      touched = true;
    }
  }
  if (touched || cell || cells.length > 0) endRecord();
  return records;
}

export function readCsv(text: string): string[][] {
  return readCsvRecords(text).map((record) => record.cells);
}

// ---------------------------------------------------------------------------
// Columns

const TITLE_COLUMNS = ["title", "role", "service", "ward", "contact"] as const;
const PHONE_COLUMNS = ["phone", "number", "extension"] as const;
const NOTES_COLUMNS = ["notes", "details"] as const;
const TEAM_COLUMNS = ["team"] as const;
const PHONE_TYPE_COLUMNS = ["phonetype", "type"] as const;
const PERSON_COLUMNS = new Set(["name", "person"]);

/** Headers match without regard to case or spaces. */
function headerKey(header: string): string {
  return header.toLowerCase().replace(/\s+/g, "");
}

function firstColumn(keys: readonly string[], names: readonly string[]): number {
  for (const name of names) {
    const index = keys.indexOf(name);
    if (index !== -1) return index;
  }
  return -1;
}

/** The line under the preview table naming the columns left out. */
export function handbookImportIgnoredLine(ignoredColumns: readonly string[]): string | null {
  if (ignoredColumns.length === 0) return null;
  const people = ignoredColumns.filter((column) => PERSON_COLUMNS.has(headerKey(column)));
  const others = ignoredColumns.filter((column) => !PERSON_COLUMNS.has(headerKey(column)));
  const parts: string[] = [];
  if (people.length > 0) parts.push("Person names are not imported yet.");
  if (others.length > 0) parts.push(`Not imported: ${others.join(", ")}.`);
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Rows

function titleKey(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Non-withdrawn entries at this site in this section, from `content` (the latest revision). */
export function importExistingFrom(
  detail: Pick<ServiceDetail, "entries">,
  siteId: string | null,
  section: HandbookImportSection,
): HandbookImportExisting[] {
  return detail.entries
    .filter(
      (entry) => entry.status !== "withdrawn" && entry.content.siteId === siteId && entry.content.section === section,
    )
    .map((entry) => ({
      id: entry.id,
      revision: entry.revision,
      title: entry.content.title,
      phone: entry.content.phone,
      body: entry.content.body,
      kind: entry.content.kind,
      sources: entry.content.sources,
      orientationPhase: entry.content.orientationPhase,
    }));
}

/** "Medicine" + "Registrar" → "Medicine: Registrar", unless the title already has a prefix. */
function teamTitle(rawTitle: string, rawTeam: string): { title: string; team: OnCallTeam | null } {
  const title = rawTitle.trim();
  const own = parseHandbookTitle(title);
  if (own.prefix || own.team) return { title, team: own.team };
  const team = rawTeam.trim();
  if (!team || !title) return { title, team: null };
  const parsed = parseHandbookTitle(`${team}: ${title}`);
  const prefix = parsed.prefix ?? parsed.team;
  if (!prefix) return { title, team: null };
  return { title: `${prefix}: ${title}`, team: parsed.team };
}

const FIELD_LABELS: Readonly<Record<string, string>> = { title: "Title", phone: "Phone", body: "Notes" };

function blockedReason(payload: unknown): string | null {
  const result = serviceActionSchema.safeParse(payload);
  if (result.success) return null;
  const issue = result.error.issues[0];
  if (!issue) return "The service would not accept this row.";
  const field = typeof issue.path[0] === "string" ? FIELD_LABELS[issue.path[0]] : undefined;
  return field ? `${field}: ${issue.message}` : issue.message;
}

export function parseHandbookImportCsv(
  text: string,
  input: { readonly section: HandbookImportSection; readonly existing: readonly HandbookImportExisting[] },
): HandbookImportParse {
  const records = readCsvRecords(text);
  const header = records[0];
  if (!header) return { rows: [], ignoredColumns: [], missingTitleColumn: true, truncated: false };
  const keys = header.cells.map(headerKey);
  const columns = {
    title: firstColumn(keys, TITLE_COLUMNS),
    phone: firstColumn(keys, PHONE_COLUMNS),
    notes: firstColumn(keys, NOTES_COLUMNS),
    team: firstColumn(keys, TEAM_COLUMNS),
    phoneType: firstColumn(keys, PHONE_TYPE_COLUMNS),
  };
  const used = new Set(Object.values(columns).filter((index) => index !== -1));
  const ignoredColumns = header.cells
    .map((cell, index) => ({ cell: cell.trim(), index }))
    .filter(({ cell, index }) => cell && !used.has(index))
    .map(({ cell }) => cell);
  if (columns.title === -1) return { rows: [], ignoredColumns, missingTitleColumn: true, truncated: false };

  const byTitle = new Map(input.existing.map((item) => [titleKey(item.title), item]));
  const cellAt = (cells: readonly string[], index: number) => (index === -1 ? "" : (cells[index] ?? "").trim());
  const data = records.slice(1).filter((record) => record.cells.some((cell) => cell.trim()));
  const rows = data.slice(0, HANDBOOK_IMPORT_MAX_ROWS).map((record): HandbookImportRow => {
    const { title, team } = teamTitle(cellAt(record.cells, columns.title), cellAt(record.cells, columns.team));
    const phone = cellAt(record.cells, columns.phone);
    const notes = cellAt(record.cells, columns.notes);
    const existing = byTitle.get(titleKey(title)) ?? null;
    const dial = resolveHandbookPhone(phone || existing?.phone || "", "hospital");
    const notices: string[] = [];
    if (dial.kind === "text") notices.push(HANDBOOK_IMPORT_NOTICES.text);
    if (dial.route === "hospital-phone") notices.push(HANDBOOK_IMPORT_NOTICES.hospitalPhone);
    if (existing) {
      const unchanged = (!phone || phone === existing.phone) && (!notes || notes === existing.body);
      notices.push(unchanged ? HANDBOOK_IMPORT_NOTICES.unchanged : HANDBOOK_IMPORT_NOTICES.update);
    }
    const row: HandbookImportRow = {
      line: record.line,
      title,
      phone,
      notes,
      team,
      phoneType: cellAt(record.cells, columns.phoneType),
      dial,
      existing,
      notices,
      blocked: null,
    };
    return { ...row, blocked: blockedReason(toEntrySave(row, { siteId: null, section: input.section })) };
  });
  return {
    rows,
    ignoredColumns,
    missingTitleColumn: false,
    truncated: data.length > HANDBOOK_IMPORT_MAX_ROWS,
  };
}

type EntrySave = Extract<ServiceAction, { action: "entry.save" }>;

/**
 * Always a draft (`publish: false`). A new row is operational with no sources:
 * clinical and legal content needs a source and a second reviewer, so it goes
 * through the normal editor. An update keeps the entry's title, kind, sources
 * and orientation phase, so a reviewed entry is never downgraded; it keeps the
 * body unless the row has notes, and the number unless the row has one.
 */
export function toEntrySave(
  row: HandbookImportRow,
  input: { readonly siteId: string | null; readonly section: HandbookImportSection },
): EntrySave {
  const existing = row.existing;
  if (existing) {
    return {
      action: "entry.save",
      entryId: existing.id,
      expectedRevision: existing.revision,
      siteId: input.siteId,
      section: input.section,
      kind: existing.kind,
      title: existing.title,
      body: row.notes || existing.body,
      phone: row.phone || existing.phone,
      sources: [...existing.sources],
      orientationPhase: existing.orientationPhase,
      publish: false,
    };
  }
  return {
    action: "entry.save",
    siteId: input.siteId,
    section: input.section,
    kind: "operational",
    title: row.title,
    body: row.notes,
    phone: row.phone,
    sources: [],
    orientationPhase: "first_shift",
    publish: false,
  };
}

// ---------------------------------------------------------------------------
// Spaced posting

type PostOutcome = { readonly ok: true } | { readonly ok: false; readonly message: string };
type Stopped = "session" | "cancelled" | null;

const TOO_MANY = "Too many saves at once. Try again in a minute.";

function realSleep(signal?: AbortSignal): (ms: number) => Promise<void> {
  return (ms) =>
    new Promise((resolve) => {
      if (signal?.aborted) return resolve();
      const timer = setTimeout(done, ms);
      function done() {
        clearTimeout(timer);
        signal?.removeEventListener("abort", done);
        resolve();
      }
      signal?.addEventListener("abort", done, { once: true });
    });
}

function retryAfterMs(response: Response): number {
  const raw = response.headers.get("Retry-After");
  const seconds = raw === null ? Number.NaN : Number(raw.trim());
  return (Number.isFinite(seconds) && seconds >= 0 ? seconds : DEFAULT_RETRY_AFTER_SECONDS) * 1000;
}

async function failureMessage(response: Response): Promise<string> {
  try {
    const error = await parseApiErrorResponse(response);
    return error.message || "This entry could not be saved.";
  } catch {
    return "This entry could not be saved.";
  }
}

function isAbort(cause: unknown): boolean {
  return cause instanceof DOMException && cause.name === "AbortError";
}

/**
 * The one loop both runs share: each payload in turn, 2 s apart. A 429 waits
 * `Retry-After` (default 30 s) and retries that payload at most 3 times, then
 * records it as failed and moves on. A 401 stops the run ("session"); an
 * aborted signal stops it ("cancelled").
 */
async function postSpaced<T>(input: {
  readonly serviceId: string;
  readonly items: readonly T[];
  readonly payload: (item: T) => EntrySave | { readonly refused: string };
  readonly onOutcome: (item: T, outcome: PostOutcome) => void;
  readonly signal?: AbortSignal;
  readonly fetchImpl?: typeof fetch;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly onProgress?: (done: number, total: number) => void;
}): Promise<Stopped> {
  // Read at call time, so a fetch replaced after this module loaded (tests, polyfills) is the one used.
  const fetchImpl: typeof fetch = input.fetchImpl ?? ((url, init) => globalThis.fetch(url, init));
  const sleep = input.sleep ?? realSleep(input.signal);
  const url = `/api/on-call/services/${input.serviceId}`;
  let sent = 0;
  let done = 0;
  for (const item of input.items) {
    if (input.signal?.aborted) return "cancelled";
    const payload = input.payload(item);
    if ("refused" in payload) {
      input.onOutcome(item, { ok: false, message: payload.refused });
      done += 1;
      input.onProgress?.(done, input.items.length);
      continue;
    }
    if (sent > 0) {
      await sleep(HANDBOOK_IMPORT_SPACING_MS);
      if (input.signal?.aborted) return "cancelled";
    }
    sent += 1;
    let outcome: PostOutcome | null = null;
    for (let attempt = 0; outcome === null; attempt += 1) {
      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: input.signal,
        });
      } catch (cause) {
        if (isAbort(cause) || input.signal?.aborted) return "cancelled";
        outcome = { ok: false, message: cause instanceof Error ? cause.message : "This entry could not be saved." };
        break;
      }
      if (response.status === 401) return "session";
      if (response.status === 429) {
        if (attempt >= HANDBOOK_IMPORT_MAX_RETRIES) {
          outcome = { ok: false, message: TOO_MANY };
          break;
        }
        await sleep(retryAfterMs(response));
        if (input.signal?.aborted) return "cancelled";
        continue;
      }
      outcome = response.ok ? { ok: true } : { ok: false, message: await failureMessage(response) };
    }
    input.onOutcome(item, outcome);
    done += 1;
    input.onProgress?.(done, input.items.length);
    if (input.signal?.aborted) return "cancelled";
  }
  return null;
}

export type SaveTickedRowsResult = {
  readonly saved: number;
  readonly failed: readonly { readonly line: number; readonly message: string }[];
  readonly stopped: "session" | "cancelled" | null;
};

export async function saveTickedRows(input: {
  readonly serviceId: string;
  readonly rows: readonly HandbookImportRow[];
  readonly siteId: string | null;
  readonly section: HandbookImportSection;
  readonly signal?: AbortSignal;
  readonly fetchImpl?: typeof fetch;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly onProgress?: (done: number, total: number) => void;
}): Promise<SaveTickedRowsResult> {
  let saved = 0;
  const failed: { line: number; message: string }[] = [];
  const stopped = await postSpaced({
    serviceId: input.serviceId,
    items: input.rows,
    payload: (row) =>
      row.blocked ? { refused: row.blocked } : toEntrySave(row, { siteId: input.siteId, section: input.section }),
    onOutcome: (row, outcome) => {
      if (outcome.ok) saved += 1;
      else failed.push({ line: row.line, message: outcome.message });
    },
    signal: input.signal,
    fetchImpl: input.fetchImpl,
    sleep: input.sleep,
    onProgress: input.onProgress,
  });
  return { saved, failed, stopped };
}

// ---------------------------------------------------------------------------
// Publishing

/** Drafts an editor may publish from the panel: this site, status "draft", kind "operational", oldest update first. */
export function publishableDrafts(detail: Pick<ServiceDetail, "entries">, siteId: string | null): ServiceEntry[] {
  return detail.entries
    .filter(
      (entry) => entry.status === "draft" && entry.content.kind === "operational" && entry.content.siteId === siteId,
    )
    .sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt));
}

/** The draft's own content at its loaded revision, published. */
export function toPublishSave(entry: ServiceEntry): EntrySave {
  return {
    action: "entry.save",
    ...entry.content,
    sources: [...entry.content.sources],
    entryId: entry.id,
    expectedRevision: entry.revision,
    publish: true,
  };
}

export type PublishBatchResult = {
  readonly published: number;
  readonly failed: readonly { readonly entryId: string; readonly message: string }[];
  readonly stopped: "session" | "cancelled" | null;
};

const REVIEW_ONLY = "Clinical and legal entries go through review.";

/** Throws a RangeError above HANDBOOK_PUBLISH_BATCH_MAX. A non-operational entry fails and is not sent. */
export async function publishDraftBatch(input: {
  readonly serviceId: string;
  readonly entries: readonly ServiceEntry[];
  readonly signal?: AbortSignal;
  readonly fetchImpl?: typeof fetch;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly onProgress?: (done: number, total: number) => void;
}): Promise<PublishBatchResult> {
  if (input.entries.length > HANDBOOK_PUBLISH_BATCH_MAX) {
    throw new RangeError(`Publish at most ${HANDBOOK_PUBLISH_BATCH_MAX} at a time.`);
  }
  let published = 0;
  const failed: { entryId: string; message: string }[] = [];
  const stopped = await postSpaced({
    serviceId: input.serviceId,
    items: input.entries,
    payload: (entry) => (entry.content.kind === "operational" ? toPublishSave(entry) : { refused: REVIEW_ONLY }),
    onOutcome: (entry, outcome) => {
      if (outcome.ok) published += 1;
      else failed.push({ entryId: entry.id, message: outcome.message });
    },
    signal: input.signal,
    fetchImpl: input.fetchImpl,
    sleep: input.sleep,
    onProgress: input.onProgress,
  });
  return { published, failed, stopped };
}
