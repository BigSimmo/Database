"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { fetchRosterRead } from "@/components/roster/use-roster-team";
import type { RosterGrid } from "@/lib/roster/import/grid";
import { RosterReadError, tableToGrid } from "@/lib/roster/import/table";
import { buildRosterDraftWorkbook } from "@/lib/roster/maker/draft-export";
import { rosterDraftSchema, type RosterDraft } from "@/lib/roster/maker/model";
import { parseUploadCsv, previewDraftUpload, type UploadChoice } from "@/lib/roster/maker/upload";
import { perthDateOf } from "@/lib/roster/shifts/perth-time";
import {
  rosterAssignmentSchema,
  rosterChangesSchema,
  type RosterAssignment,
  type RosterChanges,
  type RosterOverview,
  type RosterPerson,
  type RosterShiftCode,
} from "@/lib/roster/team/model";

type Loaded = { grid: RosterGrid; live: RosterAssignment[]; changes: RosterChanges; draftId: string; version: number };
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const previewSchema = z.object({ assignments: z.array(rosterAssignmentSchema), changes: rosterChangesSchema });

export function RosterDraftUpload({
  serviceId,
  snapshot,
  overview,
  people,
  codes,
  onSaved,
  disabled = false,
}: {
  serviceId: string;
  snapshot: RosterDraft;
  overview: RosterOverview;
  people: RosterPerson[];
  codes: RosterShiftCode[];
  onSaved: (draft: RosterDraft) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [choices, setChoices] = useState<Record<number, UploadChoice>>({});
  const [decisions, setDecisions] = useState<Record<string, "keep" | "file">>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const [exporting, setExporting] = useState(false);
  const [reloadRequired, setReloadRequired] = useState(false);
  const mounted = useRef(false);
  const generation = useRef(0);
  const selectedDraft = useRef({ id: snapshot.draft.id, version: snapshot.draft.version });
  selectedDraft.current = { id: snapshot.draft.id, version: snapshot.draft.version };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
    };
  }, []);

  useEffect(() => {
    generation.current += 1;
    setLoaded(null);
    setChoices({});
    setDecisions({});
    setMessage("");
    setReloadRequired(false);
    setBusy(false);
  }, [snapshot.draft.id, snapshot.draft.version, serviceId]);

  const current = loaded?.draftId === snapshot.draft.id && loaded.version === snapshot.draft.version ? loaded : null;
  const preview = useMemo(
    () =>
      current
        ? previewDraftUpload({
            grid: current.grid,
            draft: snapshot,
            live: current.live,
            changes: current.changes,
            people,
            codes,
            choices,
          })
        : null,
    [current, snapshot, people, codes, choices],
  );
  const unresolved = preview?.differences.filter((item) => item.reason && !decisions[item.key]).length ?? 0;
  const operations =
    preview?.differences
      .filter((item) => !item.reason || decisions[item.key] === "file")
      .map((item) => item.operation) ?? [];

  async function readFile(file: File) {
    if (reloadRequired) return;
    const task = ++generation.current;
    setLoaded(null);
    setChoices({});
    setDecisions({});
    setMessage("");
    setFileName(file.name);
    if (file.size > MAX_FILE_BYTES) {
      setMessage("Use a file smaller than 2 MB.");
      return;
    }
    if (!/\.(csv|xlsx|pdf)$/i.test(file.name)) {
      setMessage("Choose a CSV, Excel or text PDF roster.");
      return;
    }
    if (overview.me.role !== "manager") {
      setMessage("Only a current roster manager can update a draft.");
      return;
    }
    setBusy(true);
    try {
      const fresh = await fetchRosterRead(serviceId, "overview");
      if (!fresh.ok || fresh.data.me.role !== "manager")
        throw new Error("Your manager access could not be confirmed. Reload the team.");
      if ((fresh.data.latestPublication?.id ?? null) !== snapshot.draft.basedOnPublicationId)
        throw new Error(
          "A newer roster was published after this draft was opened. Open a fresh draft before uploading.",
        );
      let grid: RosterGrid;
      if (/\.csv$/i.test(file.name))
        grid = tableToGrid(parseUploadCsv(await file.text()), perthDateOf(new Date().toISOString()));
      else {
        const form = new FormData();
        form.set("file", file);
        const response = await fetch("/api/roster/read-file", { method: "POST", body: form, cache: "no-store" });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error("This file could not be read. Use a text PDF or Excel roster.");
        const candidate = (payload as { grid?: RosterGrid } | null)?.grid;
        if (!candidate || !Array.isArray(candidate.dates) || !Array.isArray(candidate.rows))
          throw new Error("The file did not contain a readable roster.");
        grid = candidate;
      }
      if (!grid.dates.some((date) => date && date >= snapshot.draft.periodStart && date <= snapshot.draft.periodEnd))
        throw new Error("The file has no dates in this draft's period.");
      const query = new URLSearchParams({ from: snapshot.draft.periodStart, to: snapshot.draft.periodEnd });
      const response = await fetch(`/api/roster/team/${encodeURIComponent(serviceId)}/publish?${query}`, {
        cache: "no-store",
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error("The current published roster could not be checked. Try again.");
      const parsed = previewSchema.safeParse(payload);
      if (!parsed.success) throw new Error("The current published roster could not be checked. Try again.");
      if (
        mounted.current &&
        generation.current === task &&
        selectedDraft.current.id === snapshot.draft.id &&
        selectedDraft.current.version === snapshot.draft.version
      ) {
        setLoaded({
          grid,
          ...parsed.data,
          live: parsed.data.assignments,
          draftId: snapshot.draft.id,
          version: snapshot.draft.version,
        });
        setMessage("Review each proposed change before applying it.");
      }
    } catch (error) {
      if (mounted.current && generation.current === task)
        setMessage(
          error instanceof RosterReadError
            ? "The file has no readable dates or names. Scanned PDFs are unsupported."
            : error instanceof Error
              ? error.message
              : "The upload could not be read.",
        );
    } finally {
      if (mounted.current && generation.current === task) setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function apply() {
    const projected =
      snapshot.assignments.length +
      operations.filter((op) => op.op === "add").length -
      operations.filter((op) => op.op === "remove").length;
    if (
      !current ||
      !preview ||
      preview.errors.length ||
      unresolved ||
      !operations.length ||
      operations.length > 500 ||
      projected > 5000 ||
      busy ||
      disabled ||
      reloadRequired
    )
      return;
    const task = ++generation.current;
    const submitted = { id: snapshot.draft.id, version: snapshot.draft.version };
    setBusy(true);
    setMessage("Applying reviewed changes…");
    try {
      const response = await fetch(`/api/roster/team/${encodeURIComponent(serviceId)}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          action: "draft.change",
          draftId: snapshot.draft.id,
          expectedVersion: snapshot.draft.version,
          source: "upload",
          ops: operations,
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          response.status === 409
            ? "The draft changed while you reviewed the file. Reload it before reviewing again."
            : "The save could not be confirmed. Reload the current draft before reviewing again.",
        );
      const result = rosterDraftSchema.safeParse(payload);
      if (!result.success)
        throw new Error("The save could not be confirmed. Reload the current draft before reviewing again.");
      if (
        mounted.current &&
        generation.current === task &&
        selectedDraft.current.id === submitted.id &&
        selectedDraft.current.version === submitted.version
      ) {
        setLoaded(null);
        onSaved(result.data);
        setMessage(`${operations.length} reviewed changes saved to draft v${result.data.draft.version}.`);
      }
    } catch (error) {
      if (
        mounted.current &&
        generation.current === task &&
        selectedDraft.current.id === submitted.id &&
        selectedDraft.current.version === submitted.version
      ) {
        setLoaded(null);
        setReloadRequired(true);
        setMessage(
          error instanceof Error
            ? error.message
            : "The save could not be confirmed. Reload the current draft before reviewing again.",
        );
      }
    } finally {
      if (mounted.current && generation.current === task) setBusy(false);
    }
  }

  async function reloadCurrent() {
    if (!reloadRequired || busy) return;
    const task = ++generation.current;
    const id = snapshot.draft.id;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/roster/team/${encodeURIComponent(serviceId)}/draft?draftId=${encodeURIComponent(id)}`,
        { cache: "no-store" },
      );
      const payload: unknown = await response.json().catch(() => null);
      const parsed = rosterDraftSchema.safeParse(payload);
      if (!response.ok || !parsed.success)
        throw new Error("The current draft is still unavailable. Try reloading again.");
      if (mounted.current && generation.current === task && selectedDraft.current.id === id) {
        setLoaded(null);
        setReloadRequired(false);
        onSaved(parsed.data);
        setMessage(`Current draft v${parsed.data.draft.version} loaded. Choose the file again for a fresh review.`);
      }
    } catch (error) {
      if (mounted.current && generation.current === task)
        setMessage(error instanceof Error ? error.message : "The current draft is unavailable.");
    } finally {
      if (mounted.current && generation.current === task) setBusy(false);
    }
  }

  async function exportDraft() {
    if (busy || exporting || disabled) return;
    setExporting(true);
    try {
      const bytes = await buildRosterDraftWorkbook(snapshot, people);
      const blob = new Blob([bytes as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `DRAFT-roster-${snapshot.draft.periodStart}-to-${snapshot.draft.periodEnd}-v${snapshot.draft.version}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage(`Draft v${snapshot.draft.version} exported as Excel.`);
    } catch {
      setMessage("The draft Excel file could not be created.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <section
      className="grid gap-3 rounded-xl border border-[color:var(--border)] p-4"
      aria-label="Update draft from roster file"
    >
      <div>
        <h3 className="font-semibold">Upload changes to this draft</h3>
        <p className="text-sm text-[color:var(--text-muted)]">
          CSV, Excel or text PDF. Files are read for this review; only structured changes are saved. Scanned PDFs are
          unsupported.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center rounded-lg border border-[color:var(--border)] px-3 py-2">
          Choose roster file
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.pdf"
            className="sr-only"
            disabled={busy || disabled || reloadRequired}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void readFile(file);
            }}
          />
        </label>
        <Button
          type="button"
          variant="secondary"
          disabled={busy || exporting || disabled}
          onClick={() => void exportDraft()}
        >
          {exporting ? "Creating Excel…" : "Export draft Excel"}
        </Button>
        {reloadRequired && (
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void reloadCurrent()}>
            Reload current draft
          </Button>
        )}
      </div>
      <p role="status" aria-live="polite" className="text-sm">
        {busy ? "Working… " : ""}
        {message}
      </p>
      {preview && (
        <div className="grid gap-3">
          <p className="text-sm">
            {fileName} · {preview.differences.length} proposed changes · {preview.vacancies.length} TBA vacancies
          </p>
          {current?.grid.rows.map((row, index) => {
            if (!row.name.trim() || /^TBA$/i.test(row.name.trim())) return null;
            const unresolvedRow = preview.errors.some((error) => error.startsWith(`Choose who row ${index + 1} `));
            if (!unresolvedRow && !choices[index]) return null;
            return (
              <label key={index} className="grid gap-1 text-sm">
                Row {index + 1}: {row.name}
                <select
                  className="min-h-11 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-2"
                  value={
                    choices[index]?.kind === "person"
                      ? choices[index].userId
                      : choices[index]?.kind === "named"
                        ? "named"
                        : ""
                  }
                  onChange={(event) =>
                    setChoices((old) => {
                      const next = { ...old };
                      if (!event.target.value) delete next[index];
                      else
                        next[index] =
                          event.target.value === "named"
                            ? { kind: "named" }
                            : { kind: "person", userId: event.target.value };
                      return next;
                    })
                  }
                >
                  <option value="">Choose a person or named row</option>
                  {people.map((person) => (
                    <option key={person.userId} value={person.userId}>
                      {person.rosterName || person.displayName || person.userId}
                    </option>
                  ))}
                  <option value="named">Keep as separate named row</option>
                </select>
              </label>
            );
          })}
          {preview.errors.length > 0 && (
            <div role="alert" className="text-sm text-[color:var(--danger)]">
              {preview.errors.map((error, index) => (
                <p key={index}>{error}</p>
              ))}
            </div>
          )}
          {preview.vacancies.length > 0 && (
            <details>
              <summary>Unfilled TBA shifts ({preview.vacancies.length})</summary>
              <ul className="list-disc pl-5 text-sm">
                {preview.vacancies.map((value, index) => (
                  <li key={index}>{value}</li>
                ))}
              </ul>
            </details>
          )}
          {preview.differences.length > 0 && (
            <ul className="grid gap-2" aria-label="Proposed draft changes">
              {preview.differences.map((item) => (
                <li key={item.key} className="rounded-lg border border-[color:var(--border)] p-3 text-sm">
                  <p className="font-medium">
                    {item.person} · {item.date}
                  </p>
                  <p>
                    {item.before} → {item.after}
                  </p>
                  {item.reason && (
                    <label className="mt-2 grid gap-1">
                      {item.reason} Choose what to keep:
                      <select
                        className="min-h-11 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-2"
                        value={decisions[item.key] ?? ""}
                        onChange={(event) =>
                          setDecisions((old) => ({ ...old, [item.key]: event.target.value as "keep" | "file" }))
                        }
                      >
                        <option value="">Review this conflict</option>
                        <option value="keep">Keep current draft duty</option>
                        <option value="file">Use uploaded duty instead</option>
                      </select>
                    </label>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Button
            type="button"
            variant="primary"
            disabled={
              busy ||
              disabled ||
              reloadRequired ||
              preview.errors.length > 0 ||
              unresolved > 0 ||
              operations.length === 0 ||
              operations.length > 500 ||
              snapshot.assignments.length +
                operations.filter((op) => op.op === "add").length -
                operations.filter((op) => op.op === "remove").length >
                5000
            }
            onClick={() => void apply()}
          >
            Apply {operations.length} reviewed changes
          </Button>
          {unresolved > 0 && (
            <p className="text-sm">
              Review {unresolved} protected {unresolved === 1 ? "duty" : "duties"} before applying.
            </p>
          )}
          {operations.length === 0 && preview.errors.length === 0 && unresolved === 0 && (
            <p className="text-sm">No changes to apply. The current draft stays as it is.</p>
          )}
        </div>
      )}
    </section>
  );
}
