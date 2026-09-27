"use client";

import { useRef, useState } from "react";
import { withUnit } from "@/components/teaching/teaching-number";
import { ModeNotice } from "@/components/mode-kit/notice";
import { TeachingAccountPage, TeachingDepthPage } from "@/components/teaching/teaching-depth-page";
import { useTeachingResource } from "@/components/teaching/use-teaching-resource";
import { Button } from "@/components/ui/button";
import { teachingErrorMessage, teachingPost, teachingUpload } from "@/lib/teaching/client";
import { DEMO_TEACHING_SERVICE_ID } from "@/lib/teaching/demo-programme";
import {
  IMPORT_MAX_FILE_BYTES,
  IMPORT_TEMPLATE_HEADERS,
  teachingDepthUrl,
  type ImportCommitted,
  type ImportPreview,
  type SheetRow,
} from "@/lib/teaching/depth-model";
import { parseCsv } from "@/lib/teaching/import-csv";
import { previewRows } from "@/lib/teaching/import-sheet";
import type { TeamSummary } from "@/lib/teaching/model";

const TEACHING_IMPORT_READ_URL = "/api/teaching/import/read";

function formWith(file: File): FormData {
  const form = new FormData();
  form.append("file", file);
  return form;
}

function ImportPage({ demoMode }: { demoMode: boolean }) {
  const resource = useTeachingResource<{ teams: TeamSummary[] }>(demoMode ? null : "/api/teaching?view=week");
  const teams = demoMode
    ? [{ id: DEMO_TEACHING_SERVICE_ID, name: "Demo health service", role: "organiser" }]
    : (resource.data?.teams ?? []).filter((team) => ["organiser", "admin"].includes(team.role));
  const [serviceId, setServiceId] = useState("");
  const service = teams.some((team) => team.id === serviceId) ? serviceId : teams[0]?.id;
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sequence = useRef(0);
  return (
    <TeachingDepthPage
      title="Import a timetable"
      demoMode={demoMode}
      resource={resource}
      ready={demoMode || resource.status === "ready"}
    >
      <p>
        Use a service timetable only: no patient details, attendance, passcodes or slides. The file is read on this
        device; only timetable rows are sent for preview.
      </p>
      <a
        className="inline-flex min-h-12 items-center underline"
        href={`data:text/csv;charset=utf-8,${encodeURIComponent(IMPORT_TEMPLATE_HEADERS.join(",") + "\r\n")}`}
        download="teaching-template.csv"
      >
        Download CSV template
      </a>
      {teams.length === 0 ? (
        <ModeNotice>Only a service organiser or admin can import its timetable.</ModeNotice>
      ) : (
        <>
          <label className="grid gap-1">
            Service
            <select
              className="min-h-12 bg-[color:var(--surface)]"
              disabled={busy}
              value={service}
              onChange={(event) => {
                sequence.current++;
                setServiceId(event.target.value);
                setPreview(null);
                setResult(null);
                setError(null);
              }}
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            Choose CSV or XLSX (up to 1 MB)
            <input
              type="file"
              accept=".csv,.xlsx"
              disabled={busy}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                const current = ++sequence.current;
                setPreview(null);
                setError(null);
                setResult(null);
                if (!file || !service) return;
                if (file.size > IMPORT_MAX_FILE_BYTES) {
                  setError("Use a file no larger than 1 MB.");
                  return;
                }
                setBusy(true);
                try {
                  // An .xlsx is read on the server so exceljs never ships to the browser; CSV stays local.
                  const rows = /\.xlsx$/i.test(file.name)
                    ? (await teachingUpload<{ rows: SheetRow[] }>(TEACHING_IMPORT_READ_URL, formWith(file))).rows
                    : /\.csv$/i.test(file.name)
                      ? parseCsv(await file.text())
                      : null;
                  if (!rows) throw new Error("Choose a CSV or XLSX file.");
                  const next = demoMode
                    ? previewRows(rows, [])
                    : await teachingPost<ImportPreview>(teachingDepthUrl(service), { action: "import.preview", rows });
                  if (current === sequence.current) setPreview(next);
                } catch (cause) {
                  if (current === sequence.current)
                    setError(
                      cause instanceof Error && !("code" in cause) ? cause.message : teachingErrorMessage(cause),
                    );
                } finally {
                  if (current === sequence.current) setBusy(false);
                }
              }}
            />
          </label>
          {busy ? <p role="status">Working…</p> : null}
          {preview ? (
            <section className="grid gap-2">
              <h2 className="font-medium">Preview — nothing imported yet</h2>
              {preview.rows.map((row) => (
                <div key={row.line}>
                  <p>
                    Line {row.line}: {row.title}
                  </p>
                  {row.errors.map((message) => (
                    <p key={message} role="alert">
                      {message}
                    </p>
                  ))}
                </div>
              ))}
              <p>
                Import adds new series. Presenters must be assigned in Organise afterwards. Check dates and Perth times
                before importing.
              </p>
              <Button
                type="button"
                variant="primary"
                disabled={busy || !preview.ready?.length}
                onClick={async () => {
                  if (!preview.ready?.length || !service || busy) return;
                  if (demoMode) {
                    setResult("Demo preview only. No programme was changed.");
                    return;
                  }
                  setBusy(true);
                  setError(null);
                  try {
                    const saved = await teachingPost<ImportCommitted>(teachingDepthUrl(service), {
                      action: "import.commit",
                      rows: preview.ready,
                    });
                    setResult(`Imported ${saved.series} series and ${withUnit(saved.occurrences, "sessions")}.`);
                    setPreview(null);
                  } catch {
                    setPreview(null);
                    setError(
                      "The import outcome could not be confirmed. Check Organise before importing again to avoid duplicate series.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Import these sessions
              </Button>
            </section>
          ) : null}
        </>
      )}
      {error ? <p role="alert">{error}</p> : null}
      {result ? <p role="status">{result}</p> : null}
    </TeachingDepthPage>
  );
}
export function TeachingImport(props: { demoMode: boolean }) {
  return <TeachingAccountPage component={ImportPage} {...props} />;
}
