"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, buttonFaceClass } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { InlineNotice, cn, eyebrowText, fieldControlPlain, textMuted } from "@/components/ui-primitives";
import {
  CME_EVIDENCE_MAX_BYTES,
  cmeEvidenceKinds,
  cmeEvidenceSchema,
  type CmeEvidence,
  type CmeEvidenceKind,
} from "@/lib/cme/evidence-model";

export function CmeEvidencePanel({
  entryId,
  readOnly = false,
  demoMode = false,
}: {
  entryId: string;
  readOnly?: boolean;
  demoMode?: boolean;
}) {
  const router = useRouter();
  const [result, setResult] = useState<{ entryId: string; files: CmeEvidence[] } | null>(null);
  const [loading, setLoading] = useState(!demoMode);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<CmeEvidenceKind>("certificate");
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const [previewOpened, setPreviewOpened] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const loadAbort = useRef<AbortController | null>(null);
  const uploadAbort = useRef<AbortController | null>(null);
  const files = result?.entryId === entryId ? result.files : [];

  const load = useCallback(async () => {
    loadAbort.current?.abort();
    if (demoMode) {
      setResult({ entryId, files: [] });
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    loadAbort.current = controller;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/cme/entries/${entryId}/evidence`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Evidence could not be loaded.");
      const parsed = cmeEvidenceSchema.array().parse(body.evidence);
      if (!controller.signal.aborted) setResult({ entryId, files: parsed });
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : "Evidence could not be loaded.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [entryId, demoMode]);

  useEffect(() => {
    queueMicrotask(() => void load());
    return () => {
      loadAbort.current?.abort();
      uploadAbort.current?.abort();
    };
  }, [load]);
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function chooseFile(next: File | null) {
    setError(null);
    setNotice(null);
    setPreviewOpened(false);
    setConfirmed(false);
    if (
      next &&
      (!next.size ||
        next.size > CME_EVIDENCE_MAX_BYTES ||
        !["application/pdf", "image/jpeg", "image/png"].includes(next.type))
    ) {
      setFile(null);
      if (input.current) input.current.value = "";
      setError("Choose a PDF, JPEG or PNG no larger than 10 MB.");
      return;
    }
    setFile(next);
  }

  async function upload() {
    if (!file || !confirmed || !previewOpened || readOnly || demoMode || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const controller = new AbortController();
    uploadAbort.current = controller;
    try {
      const data = new FormData();
      data.set("file", file);
      data.set("kind", kind);
      data.set("previewConfirmed", "true");
      data.set("redactionConfirmed", "true");
      const response = await fetch(`/api/cme/entries/${entryId}/evidence`, {
        method: "POST",
        body: data,
        signal: controller.signal,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Evidence upload failed. Your file selection is retained.");
      const saved = cmeEvidenceSchema.parse(body.evidence);
      if (controller.signal.aborted) return;
      setResult((current) => ({
        entryId,
        files: [...(current?.entryId === entryId ? current.files : []).filter((item) => item.id !== saved.id), saved],
      }));
      setFile(null);
      setConfirmed(false);
      setPreviewOpened(false);
      if (input.current) input.current.value = "";
      setNotice(
        body.duplicate
          ? "This file was already attached; no duplicate was created."
          : "Evidence attached to your private activity.",
      );
      router.refresh();
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : "Evidence could not be uploaded. Retry when connected.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return (
    <section
      // Sits inside the entry page's own padded column, so it adds no width
      // or side padding of its own (it used to, doubling the phone gutter).
      className="mt-5 space-y-3"
      data-testid="cme-evidence-panel"
      aria-labelledby="cme-evidence-heading"
    >
      <div>
        <h2 id="cme-evidence-heading" className={eyebrowText}>
          Private evidence
        </h2>
        <p className={cn(textMuted, "mt-1 text-sm")}>
          Certificates, receipts and redacted assessments. Service editors cannot access these files. Reading links are
          kept separately.
        </p>
      </div>
      {loading ? (
        <p role="status" className={textMuted}>
          Loading evidence…
        </p>
      ) : files.length ? (
        <ul className="divide-y divide-[color:var(--border)] rounded-xl border border-[color:var(--border)]">
          {files.map((item) => (
            <EvidenceFileRow
              key={item.id}
              entryId={entryId}
              item={item}
              canRemove={!demoMode}
              onRemoved={(updated) =>
                setResult((current) =>
                  current && current.entryId === entryId
                    ? { entryId, files: current.files.map((f) => (f.id === updated.id ? updated : f)) }
                    : current,
                )
              }
            />
          ))}
        </ul>
      ) : !error ? (
        <p className={cn(textMuted, "text-sm")}>
          {demoMode ? "Demo evidence is not stored." : "No evidence attached yet."}
        </p>
      ) : null}
      {error ? (
        <InlineNotice tone="neutral">
          <span role="alert">{error}</span>
          <Button type="button" variant="ghost" onClick={() => void load()}>
            Refresh evidence
          </Button>
        </InlineNotice>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm">
          {notice}
        </p>
      ) : null}
      {readOnly || demoMode ? (
        <p className={cn(textMuted, "text-sm")}>
          {demoMode
            ? "Sign in to attach evidence to your private activities."
            : "Evidence remains available; new attachments are disabled for archived activities and closed years."}
        </p>
      ) : (
        <details className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <summary className="flex min-h-tap cursor-pointer items-center font-semibold">Attach evidence</summary>
          <div className="mt-3 space-y-4">
            <label className="block text-sm font-medium">
              Type
              <select
                className="mt-1 min-h-tap w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3"
                value={kind}
                onChange={(event) => {
                  setKind(event.target.value as CmeEvidenceKind);
                  setConfirmed(false);
                }}
                disabled={busy}
              >
                {cmeEvidenceKinds.map((item) => (
                  <option key={item} value={item}>
                    {item === "assessment" ? "Redacted assessment" : item[0].toUpperCase() + item.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              File — PDF, JPEG or PNG, up to 10 MB
              <input
                ref={input}
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                disabled={busy}
                onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
                className="mt-1 min-h-tap w-full min-w-0 rounded-lg border border-[color:var(--border)] p-2"
              />
            </label>
            {file && previewUrl ? (
              <div className="space-y-3">
                <p className="break-words text-sm">{file.name}</p>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setPreviewOpened(true)}
                  className={buttonFaceClass({ variant: "secondary" })}
                >
                  Open file preview
                </a>
                <p className={cn(textMuted, "text-sm")}>
                  The preview opens on this device before upload. Remove patient names, dates of birth, record numbers
                  and identifying details, including filenames and metadata. The app does not automatically verify
                  anonymity.
                </p>
                <label className="flex min-h-tap items-start gap-3 py-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    disabled={!previewOpened || busy}
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                  I checked the preview and confirm this file contains no patient-identifying information.
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    busy={busy}
                    busyLabel="Uploading…"
                    disabled={!confirmed || !previewOpened}
                    onClick={() => void upload()}
                  >
                    Upload evidence
                  </Button>
                  <Button type="button" variant="ghost" disabled={busy} onClick={() => chooseFile(null)}>
                    Cancel attachment
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </details>
      )}
    </section>
  );
}

/**
 * One attached file. A file can be removed at any time, including in a closed
 * year or on an archived activity, because the reason to remove one is
 * usually privacy (a certificate still showing a patient identifier). The
 * reason is kept as the record; the stored file is deleted.
 */
function EvidenceFileRow({
  entryId,
  item,
  canRemove,
  onRemoved,
}: {
  entryId: string;
  item: CmeEvidence;
  canRemove: boolean;
  onRemoved: (updated: CmeEvidence) => void;
}) {
  const [removing, setRemoving] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reasonId = `cme-evidence-remove-reason-${item.id}`;
  const reasonValid = reason.trim().length >= 3 && reason.trim().length <= 500;

  if (item.removedAt) {
    return (
      <li className="grid gap-0.5 p-3" data-testid={`cme-evidence-removed-${item.id}`}>
        <p className={cn(textMuted, "text-sm font-medium")}>File removed on {formatRemovedDate(item.removedAt)}</p>
        <p className={cn(textMuted, "break-words text-xs")}>Reason: {item.removalReason}</p>
      </li>
    );
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/cme/entries/${entryId}/evidence/${item.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const body = (await response.json().catch(() => ({}))) as { evidence?: unknown; message?: string };
      if (!response.ok) throw new Error(body.message ?? "The file could not be removed. Try again.");
      onRemoved(cmeEvidenceSchema.parse(body.evidence));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The file could not be removed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="grid gap-2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1 break-words">
          <p className="font-medium">{item.fileName}</p>
          <p className={cn(textMuted, "text-sm")}>
            {cmeEvidenceKindLabel(item.kind)} · {Math.ceil(item.byteSize / 1024)} KB
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            prefetch={false}
            href={`/api/cme/entries/${entryId}/evidence/${item.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonFaceClass({ variant: "toolbar" })}
            aria-label={`Download ${item.fileName}`}
          >
            Download
          </Link>
          {canRemove && !removing ? (
            <Button
              type="button"
              variant="toolbar"
              onClick={() => setRemoving(true)}
              aria-label={`Remove ${item.fileName}`}
            >
              Remove
            </Button>
          ) : null}
        </div>
      </div>
      {removing ? (
        <div
          className="grid gap-2 rounded-lg border border-[color:var(--border)] p-3"
          data-testid={`cme-evidence-remove-${item.id}`}
        >
          <FormField
            label="Why are you removing this file?"
            id={reasonId}
            hint="The file is deleted. The date and your reason are kept on this activity as the record. Don't include patient details in the reason."
          >
            {(field) => (
              <textarea
                id={field.id}
                aria-describedby={field.describedBy}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                rows={2}
                className={cn(fieldControlPlain, "h-auto min-h-16 resize-y py-2 leading-6")}
              />
            )}
          </FormField>
          {error ? (
            <p role="alert" className="text-sm">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="danger"
              disabled={!reasonValid || busy}
              busy={busy}
              busyLabel="Removing…"
              onClick={() => void remove()}
            >
              Remove file
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setRemoving(false);
                setReason("");
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function cmeEvidenceKindLabel(kind: CmeEvidenceKind): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function formatRemovedDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Perth" });
}
