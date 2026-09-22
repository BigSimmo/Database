"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, buttonFaceClass } from "@/components/ui/button";
import { InlineNotice, cn, textMuted } from "@/components/ui-primitives";
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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
    void load();
    return () => {
      loadAbort.current?.abort();
      uploadAbort.current?.abort();
    };
  }, [load]);
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

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
      className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-8 sm:px-6"
      data-testid="cme-evidence-panel"
      aria-labelledby="cme-evidence-heading"
    >
      <div>
        <h2 id="cme-evidence-heading" className="text-lg font-semibold text-[color:var(--text)]">
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
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="min-w-0 flex-1 break-words">
                <p className="font-medium">{item.fileName}</p>
                <p className={cn(textMuted, "text-sm")}>
                  {item.kind} · {Math.ceil(item.byteSize / 1024)} KB
                </p>
              </div>
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
            </li>
          ))}
        </ul>
      ) : !error ? (
        <p className={textMuted}>{demoMode ? "Demo evidence is not stored." : "No evidence attached yet."}</p>
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
