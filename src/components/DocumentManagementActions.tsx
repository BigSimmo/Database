"use client";

import { AlertTriangle, Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { FormEvent, useId, useState } from "react";
import {
  cn,
  fieldControlPlain,
  fieldLabel,
  floatingControl,
  primaryControl,
  textMuted,
  toneDanger,
  toolbarButton,
} from "@/components/ui-primitives";
import { useAuthSession } from "@/lib/supabase/client";
import type { ClinicalDocument } from "@/lib/types";

type ManagedDocument = Pick<ClinicalDocument, "id" | "title" | "file_name">;

export type DocumentDeleteResult = {
  deleted: true;
  documentId: string;
  storageRemoved: number;
  storageWarnings: string[];
};

type DialogMode = "rename" | "delete" | null;

export function DocumentManagementActions({
  document,
  disabled = false,
  className,
  onRenamed,
  onDeleted,
}: {
  document: ManagedDocument;
  disabled?: boolean;
  className?: string;
  onRenamed?: (document: ClinicalDocument) => void;
  onDeleted?: (result: DocumentDeleteResult) => void;
}) {
  const titleId = useId();
  const { status: authStatus, authorizationHeader, markSessionExpired } = useAuthSession();
  const [mode, setMode] = useState<DialogMode>(null);
  const [title, setTitle] = useState(document.title);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const canManage = !disabled && authStatus === "authenticated";

  function resetDialogState() {
    setTitle(document.title);
    setDeleteConfirmation("");
    setError(null);
  }

  function openDialog(nextMode: Exclude<DialogMode, null>) {
    resetDialogState();
    setMode(nextMode);
  }

  function closeDialog() {
    if (pending) return;
    setMode(null);
    resetDialogState();
  }

  async function readPayload(response: Response) {
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (response.status === 401) markSessionExpired();
    if (!response.ok) {
      const message = typeof payload.error === "string" ? payload.error : "Document action failed.";
      throw new Error(message);
    }
    return payload;
  }

  async function submitRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle) {
      setError("Enter a document title.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/documents/${document.id}`, {
        method: "PATCH",
        headers: {
          ...authorizationHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: nextTitle }),
      });
      const payload = await readPayload(response);
      if (payload.document) onRenamed?.(payload.document as ClinicalDocument);
      setMode(null);
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : "Document rename failed.");
    } finally {
      setPending(false);
    }
  }

  async function submitDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (deleteConfirmation !== document.title) {
      setError("Type the current document title to confirm permanent deletion.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/documents/${document.id}`, {
        method: "DELETE",
        headers: authorizationHeader,
      });
      const payload = (await readPayload(response)) as DocumentDeleteResult;
      onDeleted?.(payload);
      setMode(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Document delete failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className={cn("flex items-center gap-2", className)}>
        <button
          type="button"
          className={toolbarButton}
          onClick={() => openDialog("rename")}
          disabled={!canManage || pending}
          title="Rename document"
          aria-label={`Rename ${document.title}`}
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={cn(toolbarButton, "text-[color:var(--danger)]")}
          onClick={() => openDialog("delete")}
          disabled={!canManage || pending}
          title="Permanently delete document"
          aria-label={`Permanently delete ${document.title}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {mode && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/55 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <div className="w-full max-w-lg rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-lux)] sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id={titleId} className="text-base font-semibold text-[color:var(--text-heading)]">
                  {mode === "rename" ? "Rename document" : "Permanently delete document"}
                </h2>
                <p className={cn("mt-1 text-sm leading-6", textMuted)}>
                  {mode === "rename"
                    ? "The original file name and storage path will stay unchanged."
                    : "This removes the source, extracted evidence, images, labels, summaries, and related query logs."}
                </p>
              </div>
              <button
                type="button"
                className={toolbarButton}
                onClick={closeDialog}
                disabled={pending}
                aria-label="Close document action"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && <div className={cn("mt-4 rounded-lg border p-3 text-sm font-semibold", toneDanger)}>{error}</div>}

            {mode === "rename" ? (
              <form onSubmit={submitRename} className="mt-4 space-y-4">
                <label className="block">
                  <span className={fieldLabel}>Display and search title</span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={180}
                    className={fieldControlPlain}
                    disabled={pending}
                    autoFocus
                  />
                </label>
                <p className={cn("truncate text-xs", textMuted)}>Original file: {document.file_name}</p>
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" className={floatingControl} onClick={closeDialog} disabled={pending}>
                    Cancel
                  </button>
                  <button type="submit" className={primaryControl} disabled={pending || !title.trim()}>
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Save title
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={submitDelete} className="mt-4 space-y-4">
                <div className={cn("rounded-lg border p-3 text-sm", toneDanger)}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p className="font-semibold">This action cannot be undone.</p>
                  </div>
                </div>
                <label className="block">
                  <span className={fieldLabel}>Type the current title to confirm</span>
                  <input
                    value={deleteConfirmation}
                    onChange={(event) => setDeleteConfirmation(event.target.value)}
                    className={fieldControlPlain}
                    disabled={pending}
                    autoFocus
                  />
                </label>
                <p className={cn("break-words text-xs font-semibold", textMuted)}>{document.title}</p>
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" className={floatingControl} onClick={closeDialog} disabled={pending}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={cn(primaryControl, "bg-[color:var(--danger)] hover:bg-[color:var(--danger)]")}
                    disabled={pending || deleteConfirmation !== document.title}
                  >
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Delete permanently
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
