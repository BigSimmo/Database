"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { TextField } from "@/components/ui/text-field";
import { useRosterRead } from "@/components/roster/use-roster-team";
import { parseRosterMakerChange } from "@/lib/roster/maker/parse";
import {
  rosterDraftOperationSchema,
  rosterDraftSchema,
  type RosterDraft,
  type RosterDraftOperation,
} from "@/lib/roster/maker/model";
import {
  addDaysToDate,
  formatPerthDay,
  perthDateOf,
  perthTimeOf,
  perthWallToIso,
} from "@/lib/roster/shifts/perth-time";
import type { RosterOverview, RosterPerson, RosterShiftCode } from "@/lib/roster/team/model";
import { RosterDraftUpload } from "./roster-draft-upload";
import { RosterStaffingPanel } from "./roster-staffing-panel";
import { RosterDraftPublication } from "./roster-draft-publication";

type Assignment = RosterDraft["assignments"][number];
type Editor = {
  personId: string;
  date: string;
  assignmentId: string;
  code: string;
  siteId: string;
  siteChanged: boolean;
};
type Proposal = {
  operation: RosterDraftOperation;
  person: string;
  date: string;
  before: string;
  after: string;
  code: string;
  source: "grid" | "typed";
};
type Status = "idle" | "busy" | "saved" | "conflict" | "error";
const control = "min-h-12 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-2";
const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const nameOf = (person: RosterPerson) => person.rosterName || person.displayName || "Unnamed team member";
const urlFor = (serviceId: string, draftId?: string) =>
  `/api/roster/team/${encodeURIComponent(serviceId)}/draft${draftId ? `?draftId=${encodeURIComponent(draftId)}` : ""}`;
const errorMessage = (value: unknown, fallback: string) =>
  value && typeof value === "object" && "message" in value && typeof value.message === "string"
    ? value.message
    : fallback;
function isDraftChoice(value: unknown): value is { id: string; periodStart: string; periodEnd: string } {
  return (
    !!value &&
    typeof value === "object" &&
    "id" in value &&
    typeof value.id === "string" &&
    "periodStart" in value &&
    typeof value.periodStart === "string" &&
    "periodEnd" in value &&
    typeof value.periodEnd === "string"
  );
}
type AuditRow = {
  user_id: string | null;
  roster_name: string | null;
  site_id: string | null;
  starts_at: string;
  shift_code: string;
};
function auditRow(value: unknown): AuditRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.starts_at !== "string" ||
    !Number.isFinite(Date.parse(row.starts_at)) ||
    typeof row.shift_code !== "string"
  )
    return null;
  return {
    user_id: typeof row.user_id === "string" ? row.user_id : null,
    roster_name: typeof row.roster_name === "string" ? row.roster_name : null,
    site_id: typeof row.site_id === "string" ? row.site_id : null,
    starts_at: row.starts_at,
    shift_code: row.shift_code,
  };
}
function changeSummary(
  change: RosterDraft["changes"][number],
  people: RosterPerson[],
  overview: RosterOverview,
): string {
  const detail = change.change;
  const verb =
    detail.op === "add" ? "Added" : detail.op === "update" ? "Changed" : detail.op === "remove" ? "Removed" : "Edited";
  // Old history has only the requested operation. A current assignment is not
  // evidence of what a removed or later-edited duty looked like at this change.
  if (!("before" in detail) || !("after" in detail))
    return `${verb} draft shift · details unavailable for older change`;
  const before = auditRow(detail.before);
  const after = auditRow(detail.after);
  if ((detail.before !== null && !before) || (detail.after !== null && !after) || (!before && !after))
    return `${verb} draft shift · details unavailable`;
  const row = after ?? before!;
  const person = people.find((item) => item.userId === row.user_id);
  const subject = person ? nameOf(person) : row.roster_name ? `Named: ${row.roster_name}` : "unfilled shift";
  const date = formatPerthDay(perthDateOf(row.starts_at));
  const beforeShift = before ? `${before.shift_code} · ${siteLabel(before.site_id, overview)}` : "No shift";
  const afterShift = after ? `${after.shift_code} · ${siteLabel(after.site_id, overview)}` : "No shift";
  return `${verb} ${subject} · ${date} · ${beforeShift} → ${afterShift}`;
}
function rowLabel(row: Assignment | null): string {
  if (!row) return "No shift";
  return `${row.shiftCode} ${perthTimeOf(row.startsAt)}–${perthTimeOf(row.endsAt)}${perthDateOf(row.startsAt) !== perthDateOf(row.endsAt) ? " +1" : ""}`;
}
function codeLabel(code: RosterShiftCode): string {
  if (code.kind === "off") return "OFF · no rostered duty";
  return `${code.code} ${code.starts ?? "?"}–${code.ends ?? "?"}${code.starts && code.ends && code.ends <= code.starts ? " +1" : ""}`;
}
function siteLabel(siteId: string | null, overview: RosterOverview): string {
  return siteId ? (overview.sites.find((site) => site.id === siteId)?.name ?? "Unknown site") : "Site not specified";
}
function codeRow(person: RosterPerson, code: RosterShiftCode, date: string, siteId: string | null) {
  if (code.kind === "off" || !code.starts || !code.ends) return null;
  const startsAt = perthWallToIso(date, code.starts);
  const endsAt = perthWallToIso(code.ends <= code.starts ? addDaysToDate(date, 1) : date, code.ends);
  if (!startsAt || !endsAt) return null;
  return {
    userId: person.userId,
    rosterName: null,
    siteId,
    startsAt,
    endsAt,
    shiftCode: code.code,
    kind: code.kind,
    grade: person.grade,
  };
}

export function RosterMakerTab({ serviceId, overview }: { serviceId: string; overview: RosterOverview }) {
  const manager = overview.me.role === "manager";
  const peopleRead = useRosterRead(manager ? serviceId : null, "people");
  const makerRead = useRosterRead(manager ? serviceId : null, "maker");
  const today = perthDateOf(new Date());
  const [periodStart, setPeriodStart] = useState(overview.latestPublication?.periodStart ?? today);
  const [periodEnd, setPeriodEnd] = useState(overview.latestPublication?.periodEnd ?? addDaysToDate(today, 6));
  const [snapshot, setSnapshot] = useState<RosterDraft | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [windowStart, setWindowStart] = useState("");
  const [phonePerson, setPhonePerson] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [review, setReview] = useState(false);
  const [typed, setTyped] = useState("");
  const [typedError, setTypedError] = useState("");
  const [conflictFresh, setConflictFresh] = useState(false);
  const alive = useRef(true);
  const serial = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());
  const editReturn = useRef<HTMLButtonElement | null>(null);
  const codeRef = useRef<HTMLSelectElement | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      serial.current++;
      controller.current?.abort();
    };
  }, []);
  const people = peopleRead.data?.people ?? [];
  const codes = makerRead.data?.codes ?? [];
  const existingDrafts = (makerRead.data?.drafts ?? []).filter(isDraftChoice);
  const start = snapshot?.draft.periodStart ?? periodStart;
  const end = snapshot?.draft.periodEnd ?? periodEnd;
  const visibleStart = windowStart >= start && windowStart <= end ? windowStart : start;
  const days: string[] = [];
  if (validDate(visibleStart) && validDate(end))
    for (let date = visibleStart; date <= end && days.length < 7; date = addDaysToDate(date, 1)) days.push(date);
  const mobilePerson = people.find((person) => person.userId === phonePerson) ?? people[0];
  const busy = status === "busy";
  const assignmentsByCell = useMemo(() => {
    const cells = new Map<string, Assignment[]>();
    for (const row of snapshot?.assignments ?? []) {
      if (!row.userId) continue;
      const key = `${row.userId}:${perthDateOf(row.startsAt)}`;
      const rows = cells.get(key) ?? [];
      rows.push(row);
      cells.set(key, rows);
    }
    return cells;
  }, [snapshot]);
  const forCell = (userId: string, date: string) => assignmentsByCell.get(`${userId}:${date}`) ?? [];
  function begin() {
    controller.current?.abort();
    controller.current = new AbortController();
    return { n: ++serial.current, signal: controller.current.signal };
  }
  function current(n: number) {
    return alive.current && serial.current === n;
  }
  function receive(body: unknown, n: number) {
    const parsed = rosterDraftSchema.safeParse(body);
    if (!parsed.success) {
      if (current(n)) {
        setStatus("error");
        setMessage("The draft response could not be read. Reload before editing.");
      }
      return false;
    }
    if (current(n)) setSnapshot(parsed.data);
    return true;
  }
  async function post(
    body: object,
  ): Promise<{ ok: boolean; conflict: boolean; statusCode: number; body: unknown; n: number } | null> {
    const { n, signal } = begin();
    setStatus("busy");
    try {
      const response = await fetch(urlFor(serviceId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        signal,
        body: JSON.stringify(body),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!current(n)) return null;
      return { ok: response.ok, conflict: response.status === 409, statusCode: response.status, body: payload, n };
    } catch {
      if (current(n) && !signal.aborted) {
        setStatus("conflict");
        setConflictFresh(false);
        setMessage("Save outcome is uncertain. Reload the current draft before trying again.");
      }
      return null;
    }
  }
  async function openDraft() {
    if (busy) return;
    if (!validDate(periodStart) || !validDate(periodEnd) || periodEnd < periodStart) {
      setStatus("error");
      setMessage("Choose a valid start and end date in order.");
      return;
    }
    setMessage("Opening draft…");
    const result = await post({ action: "draft.open", periodStart, periodEnd });
    if (!result) return;
    if (!result.ok) {
      setStatus("error");
      setMessage(errorMessage(result.body, "The draft could not be opened."));
      return;
    }
    if (receive(result.body, result.n)) {
      setWindowStart(periodStart);
      setEditor(null);
      setProposal(null);
      setReview(false);
      setStatus("saved");
      setMessage("Draft opened. Published duties are unchanged.");
    }
  }
  async function reload(conflict = false, uncertain = false, draftId?: string) {
    const id = draftId ?? snapshot?.draft.id;
    if (!id) return;
    const { n, signal } = begin();
    setStatus("busy");
    try {
      const response = await fetch(urlFor(serviceId, id), { cache: "no-store", signal });
      const body: unknown = await response.json().catch(() => null);
      if (!current(n)) return;
      if (!response.ok || !receive(body, n))
        throw new Error(errorMessage(body, "The current draft could not be loaded."));
      if (draftId) {
        const selected = rosterDraftSchema.parse(body);
        setPeriodStart(selected.draft.periodStart);
        setPeriodEnd(selected.draft.periodEnd);
        setWindowStart(selected.draft.periodStart);
        setEditor(null);
        setProposal(null);
        setReview(false);
      }
      setStatus(conflict ? "conflict" : "saved");
      setConflictFresh(conflict);
      setMessage(
        conflict
          ? uncertain
            ? "Save outcome was uncertain. Review your proposal against the current draft before applying again."
            : "Draft changed. Review your proposed change against the current draft."
          : "Current draft loaded.",
      );
    } catch {
      if (!current(n) || signal.aborted) return;
      setStatus(conflict ? "conflict" : "error");
      setConflictFresh(false);
      setMessage(
        conflict
          ? "Draft changed. Current draft is unavailable; reload before reviewing."
          : "The current draft could not be loaded.",
      );
    }
  }
  function startEdit(personId: string, date: string, button: HTMLButtonElement) {
    if (!snapshot || busy) return;
    const first = forCell(personId, date)[0];
    editReturn.current = button;
    setEditor({
      personId,
      date,
      assignmentId: first?.id ?? "",
      code: first?.shiftCode ?? "",
      siteId: first?.siteId ?? "",
      siteChanged: false,
    });
    setProposal(null);
    setReview(false);
  }
  function closeEdit() {
    setEditor(null);
    setProposal(null);
    setReview(false);
    editReturn.current?.focus();
  }
  function buildManual(value: Editor): Proposal | null {
    const person = people.find((entry) => entry.userId === value.personId);
    const code = codes.find((entry) => entry.code === value.code);
    if (!person || !code || !snapshot) return null;
    const before = snapshot.assignments.find((row) => row.id === value.assignmentId) ?? null;
    if (code.kind === "off" && !before) {
      setMessage("OFF leaves an empty day unchanged.");
      return null;
    }
    if (code.kind !== "off" && !before && overview.sites.length && !value.siteId) {
      setMessage("Choose a site for the shift.");
      return null;
    }
    const intendedSiteId = before && !value.siteChanged ? before.siteId : value.siteId || null;
    const row = codeRow(person, code, value.date, intendedSiteId);
    if (code.kind !== "off" && !row) {
      setMessage("This code needs valid start and end times.");
      return null;
    }
    if (
      before &&
      row &&
      before.shiftCode === row.shiftCode &&
      before.startsAt === row.startsAt &&
      before.endsAt === row.endsAt &&
      before.siteId === intendedSiteId
    ) {
      setMessage("The current draft already has that shift. Nothing needs applying.");
      return null;
    }
    if (
      !before &&
      row &&
      snapshot.assignments.some(
        (existing) =>
          existing.userId === row.userId &&
          existing.startsAt === row.startsAt &&
          existing.endsAt === row.endsAt &&
          existing.shiftCode === row.shiftCode &&
          existing.siteId === row.siteId,
      )
    ) {
      setMessage("The current draft already has that shift. Nothing needs applying.");
      return null;
    }
    const operation: RosterDraftOperation = before
      ? code.kind === "off"
        ? { op: "remove", id: before.id }
        : {
            op: "update",
            id: before.id,
            row: {
              startsAt: row!.startsAt,
              endsAt: row!.endsAt,
              shiftCode: row!.shiftCode,
              kind: row!.kind,
              ...(value.siteChanged ? { siteId: intendedSiteId } : {}),
            },
          }
      : { op: "add", row: row! };
    return {
      operation,
      person: nameOf(person),
      date: value.date,
      before: `${rowLabel(before)} · ${siteLabel(before?.siteId ?? null, overview)}`,
      after:
        code.kind === "off" ? "OFF · no rostered duty" : `${codeLabel(code)} · ${siteLabel(intendedSiteId, overview)}`,
      code: code.code,
      source: "grid",
    };
  }
  function reviewManual() {
    if (!editor) return;
    const next = buildManual(editor);
    if (next) {
      setProposal(next);
      setReview(true);
      setStatus("idle");
      setMessage("");
    }
  }
  function reviewTyped() {
    if (!snapshot) return;
    const result = parseRosterMakerChange(typed, {
      people: people
        .filter((person) => person.rosterName)
        .map((person) => ({ userId: person.userId, name: person.rosterName!, grade: person.grade })),
      codes: codes.map((code) => ({ code: code.code, kind: code.kind, starts: code.starts, ends: code.ends })),
      assignments: snapshot.assignments,
      periodStart: snapshot.draft.periodStart,
      periodEnd: snapshot.draft.periodEnd,
    });
    if (result.status === "refused") {
      setTypedError(result.message);
      setReview(false);
      return;
    }
    const operation = rosterDraftOperationSchema.safeParse(result.operation);
    if (!operation.success) {
      setTypedError("This instruction needs manual review before it can change the draft.");
      setReview(false);
      return;
    }
    setTypedError("");
    const before = result.before
      ? `${result.before.shiftCode} ${perthTimeOf(result.before.startsAt)}–${perthTimeOf(result.before.endsAt)}`
      : "No shift";
    const after = result.after
      ? `${result.after.shiftCode} ${perthTimeOf(result.after.startsAt)}–${perthTimeOf(result.after.endsAt)}`
      : "OFF · no rostered duty";
    setProposal({
      operation: operation.data,
      person: result.person.name,
      date: result.date,
      before,
      after,
      code: result.after?.shiftCode ?? "OFF",
      source: "typed",
    });
    setReview(true);
    setStatus("idle");
    setMessage("");
  }
  async function apply() {
    if (!snapshot || !proposal || !review || busy) return;
    setMessage("Saving draft change…");
    const result = await post({
      action: "draft.change",
      draftId: snapshot.draft.id,
      expectedVersion: snapshot.draft.version,
      source: proposal.source,
      ops: [proposal.operation],
    });
    if (!result) {
      if (alive.current) {
        setReview(false);
        void reload(true, true);
      }
      return;
    }
    if (result.conflict || result.statusCode >= 500) {
      setReview(false);
      setStatus("conflict");
      setConflictFresh(false);
      setMessage(
        result.conflict
          ? "Draft changed. Review your proposed change against the current draft."
          : "Save outcome is uncertain. Reload the current draft before trying again.",
      );
      void reload(true, !result.conflict);
      return;
    }
    if (!result.ok) {
      setReview(false);
      setStatus("error");
      setMessage(errorMessage(result.body, "The change could not be saved."));
      return;
    }
    if (receive(result.body, result.n)) {
      setStatus("saved");
      setMessage("Saved to draft. Published duties are unchanged.");
      setEditor(null);
      setProposal(null);
      setReview(false);
      if (proposal.source === "typed") setTyped("");
    }
  }
  async function undo(changeId: string) {
    if (!snapshot || busy || status === "conflict") return;
    setMessage("Undoing draft change…");
    const result = await post({
      action: "draft.undo",
      draftId: snapshot.draft.id,
      expectedVersion: snapshot.draft.version,
      changeId,
    });
    if (!result) {
      if (alive.current) void reload(true, true);
      return;
    }
    if (result.conflict || result.statusCode >= 500) {
      setStatus("conflict");
      setConflictFresh(false);
      setMessage(
        result.conflict
          ? "Draft changed before Undo. Check the current draft."
          : "Undo outcome is uncertain. Reload the current draft.",
      );
      void reload(true, !result.conflict);
      return;
    }
    if (!result.ok) {
      setStatus("error");
      setMessage(errorMessage(result.body, "Undo could not be saved."));
      return;
    }
    if (receive(result.body, result.n)) {
      setStatus("saved");
      setMessage("Change undone in draft. Published duties are unchanged.");
    }
  }
  function navigate(event: KeyboardEvent<HTMLButtonElement>, person: number, date: number) {
    const change =
      event.key === "ArrowRight"
        ? [0, 1]
        : event.key === "ArrowLeft"
          ? [0, -1]
          : event.key === "ArrowDown"
            ? [1, 0]
            : event.key === "ArrowUp"
              ? [-1, 0]
              : null;
    if (!change) return;
    event.preventDefault();
    cellRefs.current
      .get(
        `${Math.max(0, Math.min(people.length - 1, person + change[0]!))}:${Math.max(0, Math.min(days.length - 1, date + change[1]!))}`,
      )
      ?.focus();
  }
  if (!manager) return <p>Only your team&apos;s roster manager can see this page.</p>;
  const editPerson = people.find((person) => person.userId === editor?.personId);
  const editRows = editor ? forCell(editor.personId, editor.date) : [];
  return (
    <section aria-label="Draft roster" className="grid gap-5">
      <header>
        <h2 className="text-lg font-semibold">Make a roster draft</h2>
        <p className="text-sm text-[color:var(--text-muted)]">
          Changes here stay in the draft. Doctors keep seeing the published roster.
        </p>
      </header>
      <div className="grid gap-3 rounded-xl border border-[color:var(--border)] p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <TextField
          label="Period starts"
          type="date"
          value={periodStart}
          onChange={(event) => setPeriodStart(event.target.value)}
        />
        <TextField
          label="Period ends"
          type="date"
          value={periodEnd}
          onChange={(event) => setPeriodEnd(event.target.value)}
        />
        <Button variant="primary" disabled={busy} onClick={() => void openDraft()}>
          Open draft
        </Button>
      </div>
      {existingDrafts.length ? (
        <label className="grid gap-1 text-sm">
          Existing draft period
          <select
            className={control}
            value={snapshot?.draft.id ?? ""}
            disabled={busy}
            onChange={(event) => {
              if (event.target.value) void reload(false, false, event.target.value);
            }}
          >
            <option value="">Choose a saved draft</option>
            {existingDrafts.map((draft) => (
              <option key={draft.id} value={draft.id}>
                {draft.periodStart} to {draft.periodEnd}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {peopleRead.status === "error" ||
      makerRead.status === "error" ||
      peopleRead.status === "unavailable" ||
      makerRead.status === "unavailable" ? (
        <div role="alert">
          <p>{peopleRead.message ?? makerRead.message ?? "Team details are unavailable."}</p>
          <Button
            onClick={() => {
              peopleRead.reload();
              makerRead.reload();
            }}
          >
            Try again
          </Button>
        </div>
      ) : null}
      {message ? <p role={status === "error" || status === "conflict" ? "alert" : "status"}>{message}</p> : null}
      {snapshot ? (
        <>
          <div className="grid gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-4">
            <p className="font-medium">
              Draft v{snapshot.draft.version} · {formatPerthDay(snapshot.draft.periodStart)}–
              {formatPerthDay(snapshot.draft.periodEnd)}
            </p>
            <p className="text-sm">
              {snapshot.draft.basedOnPublicationId
                ? `Started from publication ${snapshot.draft.basedOnPublicationId}.`
                : "Started without a published roster for this period."}{" "}
              Not published.
            </p>
            <Button disabled={busy} onClick={() => void reload()}>
              Reload current draft
            </Button>
          </div>
          {status === "conflict" && proposal ? (
            <div className="grid gap-2 rounded-xl border border-[color:var(--warning)] p-4">
              <p>
                Proposed {proposal.code} for {proposal.person} on {formatPerthDay(proposal.date)} is still here.
              </p>
              <Button
                disabled={busy || !conflictFresh}
                onClick={proposal.source === "typed" ? reviewTyped : reviewManual}
              >
                Review against current draft
              </Button>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={visibleStart <= start} onClick={() => setWindowStart(addDaysToDate(visibleStart, -7))}>
              Previous dates
            </Button>
            <span>{days.length ? `${formatPerthDay(days[0]!)}–${formatPerthDay(days.at(-1)!)}` : "No dates"}</span>
            <Button
              disabled={!days.length || days.at(-1)! >= end}
              onClick={() => setWindowStart(addDaysToDate(visibleStart, 7))}
            >
              Next dates
            </Button>
          </div>
          <div className="hidden overflow-x-auto rounded-xl border border-[color:var(--border)] md:block">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <thead>
                <tr>
                  <th className="p-2">Person</th>
                  {days.map((date) => (
                    <th className="p-2" key={date}>
                      {formatPerthDay(date)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {people.map((person, pi) => (
                  <tr className="border-t border-[color:var(--border)]" key={person.userId}>
                    <th className="p-2">{nameOf(person)}</th>
                    {days.map((date, di) => {
                      const rows = forCell(person.userId, date);
                      return (
                        <td className="p-1" key={date}>
                          <button
                            type="button"
                            ref={(node) => {
                              if (node) cellRefs.current.set(`${pi}:${di}`, node);
                              else cellRefs.current.delete(`${pi}:${di}`);
                            }}
                            className={`${control} w-full text-left`}
                            disabled={busy}
                            aria-label={`Edit ${nameOf(person)} ${formatPerthDay(date)}: ${rows.length ? rows.map((row) => row.shiftCode).join(", ") : "no shift"}`}
                            onKeyDown={(event) => navigate(event, pi, di)}
                            onClick={(event) => startEdit(person.userId, date, event.currentTarget)}
                          >
                            {rows.length ? rows.map((row) => row.shiftCode).join(" · ") : "—"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-2 md:hidden">
            <label className="grid gap-1">
              Person
              <select
                className={control}
                value={mobilePerson?.userId ?? ""}
                onChange={(event) => setPhonePerson(event.target.value)}
              >
                {people.map((person) => (
                  <option key={person.userId} value={person.userId}>
                    {nameOf(person)}
                  </option>
                ))}
              </select>
            </label>
            {mobilePerson ? (
              days.map((date) => (
                <button
                  type="button"
                  key={date}
                  className={`${control} text-left`}
                  disabled={busy}
                  aria-label={`Edit ${nameOf(mobilePerson)} ${formatPerthDay(date)}: ${
                    forCell(mobilePerson.userId, date)
                      .map((row) => row.shiftCode)
                      .join(", ") || "no shift"
                  }`}
                  onClick={(event) => startEdit(mobilePerson.userId, date, event.currentTarget)}
                >
                  <span className="block font-medium">{formatPerthDay(date)}</span>
                  <span>
                    {forCell(mobilePerson.userId, date).map(rowLabel).join(" · ") || "No shift · tap to edit"}
                  </span>
                </button>
              ))
            ) : (
              <p>No team members loaded.</p>
            )}
          </div>
          {snapshot.assignments.some((row) => !row.userId) ? (
            <section className="grid gap-2 rounded-xl border border-[color:var(--border)] p-4">
              <h3 className="font-medium">Other draft rows</h3>
              <p className="text-sm">Unfilled shifts and named people are distinct from linked team members.</p>
              {snapshot.assignments
                .filter((row) => !row.userId)
                .map((row) => (
                  <p key={row.id}>
                    {row.rosterName ? `Named: ${row.rosterName}` : "Unfilled shift"} ·{" "}
                    {formatPerthDay(perthDateOf(row.startsAt))} · {rowLabel(row)}
                  </p>
                ))}
            </section>
          ) : null}
          <section className="grid gap-2 rounded-xl border border-[color:var(--border)] p-4">
            <h3 className="font-medium">Describe one change</h3>
            <p className="text-sm">Use an exact name, date and code: Set Alex Example on 2026-10-01 to N.</p>
            <label className="grid gap-1">
              Change instruction
              <textarea
                className={`${control} min-h-24`}
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
              />
            </label>
            {typedError ? <p role="alert">{typedError}</p> : null}
            <Button disabled={busy || !typed.trim()} onClick={reviewTyped}>
              Review typed change
            </Button>
          </section>
          <section className="grid gap-2 rounded-xl border border-[color:var(--border)] p-4">
            <h3 className="font-medium">Recent draft changes</h3>
            {snapshot.changes.length ? (
              <ul className="grid gap-2">
                {snapshot.changes.map((change) => (
                  <li
                    className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--border)] pt-2"
                    key={change.id}
                  >
                    <span className="grid text-sm">
                      <span>
                        {changeSummary(change, people, overview)}
                        {change.undoneAt ? " · Undone" : ""}
                      </span>
                      <span className="text-[color:var(--text-muted)]">
                        {people.find((person) => person.userId === change.actorId)?.displayName ?? "Team manager"} ·{" "}
                        {change.source} · {new Date(change.at).toLocaleString("en-AU", { timeZone: "Australia/Perth" })}
                      </span>
                    </span>
                    {change.canUndo ? (
                      <Button
                        disabled={busy || status === "conflict"}
                        aria-label={`Undo change ${change.id}`}
                        onClick={() => void undo(change.id)}
                      >
                        Undo
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No draft changes yet.</p>
            )}
          </section>
          <RosterDraftUpload
            key={`upload:${snapshot.draft.id}:${snapshot.draft.version}`}
            serviceId={serviceId}
            snapshot={snapshot}
            overview={overview}
            people={people}
            codes={codes}
            disabled={busy || status === "conflict"}
            onSaved={(draft) => {
              setSnapshot((currentDraft) =>
                currentDraft?.draft.id === draft.draft.id && currentDraft.draft.version <= draft.draft.version
                  ? draft
                  : currentDraft,
              );
              setStatus("saved");
              setMessage("Reviewed upload saved to draft.");
            }}
          />
          <RosterStaffingPanel
            key={`staffing:${snapshot.draft.id}`}
            serviceId={serviceId}
            overview={overview}
            snapshot={snapshot}
          />
          <RosterDraftPublication
            key={`publication:${snapshot.draft.id}:${snapshot.draft.version}`}
            serviceId={serviceId}
            snapshot={snapshot}
            overview={overview}
            people={people}
            disabled={busy || status === "conflict"}
            onPublished={(confirmation) => {
              makerRead.reload();
              void reload().then(() => {
                if (confirmation) setMessage(confirmation);
              });
            }}
          />
        </>
      ) : null}
      <Sheet
        open={!!editor && !!editPerson && !review && status !== "conflict"}
        onClose={closeEdit}
        title="Edit draft shift"
        mobilePlacement="bottom"
        initialFocusRef={codeRef}
        returnFocusRef={editReturn}
      >
        {editor && editPerson ? (
          <div className="grid gap-3">
            <h3 className="font-semibold">
              {nameOf(editPerson)} · {formatPerthDay(editor.date)}
            </h3>
            {editRows.length > 1 ? (
              <label className="grid gap-1">
                Which shift
                <select
                  className={control}
                  value={editor.assignmentId}
                  onChange={(event) => {
                    const row = editRows.find((item) => item.id === event.target.value);
                    setEditor({
                      ...editor,
                      assignmentId: row?.id ?? "",
                      code: row?.shiftCode ?? "",
                      siteId: row?.siteId ?? "",
                      siteChanged: false,
                    });
                  }}
                >
                  {editRows.map((row) => (
                    <option key={row.id} value={row.id}>
                      {rowLabel(row)}
                    </option>
                  ))}
                  <option value="">Add another shift</option>
                </select>
              </label>
            ) : null}
            <p>Current: {rowLabel(editRows.find((row) => row.id === editor.assignmentId) ?? null)}</p>
            <label className="grid gap-1">
              Shift code
              <select
                ref={codeRef}
                className={control}
                value={editor.code}
                onChange={(event) => setEditor({ ...editor, code: event.target.value })}
              >
                <option value="">Choose a code</option>
                {codes.map((code) => (
                  <option key={code.code} value={code.code}>
                    {codeLabel(code)}
                  </option>
                ))}
              </select>
            </label>
            {overview.sites.length && editor.code !== "OFF" ? (
              <label className="grid gap-1">
                Site
                <select
                  className={control}
                  value={editor.siteId}
                  onChange={(event) => setEditor({ ...editor, siteId: event.target.value, siteChanged: true })}
                >
                  <option value="">Site not specified</option>
                  {overview.sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <p className="text-sm">OFF removes the selected duty; times come from the selected code.</p>
            <div className="flex justify-end gap-2">
              <Button onClick={closeEdit}>Cancel</Button>
              <Button variant="primary" disabled={!editor.code || busy} onClick={reviewManual}>
                Review change
              </Button>
            </div>
          </div>
        ) : null}
      </Sheet>
      <Sheet
        open={review && !!proposal}
        onClose={() => setReview(false)}
        title="Review draft change"
        mobilePlacement="bottom"
        returnFocusRef={editReturn}
      >
        {proposal ? (
          <div className="grid gap-3">
            <h3 className="font-semibold">
              Review {proposal.person} · {formatPerthDay(proposal.date)}
            </h3>
            <p>Before · {proposal.before}</p>
            <p>After · {proposal.after}</p>
            <p className="text-sm">Apply changes this draft only. Published duties stay as they are.</p>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setReview(false)}>Edit</Button>
              <Button variant="primary" disabled={busy} onClick={() => void apply()}>
                Apply to draft
              </Button>
            </div>
          </div>
        ) : null}
      </Sheet>
    </section>
  );
}
