"use client";

import { TriangleAlert, Check, Pencil, Trash2 } from "lucide-react";
import { FormEvent, useRef, useState } from "react";
import {
  AsyncButton,
  cn,
  fieldControlPlain,
  fieldLabel,
  floatingControl,
  primaryControl,
  textMuted,
  toneDanger,
  toolbarButton,
} from "@/components/ui-primitives";
import { Sheet } from "@/components/ui/sheet";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    status: authStatus,
    authorizationHeader,
    registerAuthRequest,
    isAuthEpochCurrent,
    markSessionExpired,
  } = useAuthSession();
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
    const controller = new AbortController();
    const authRequest = registerAuthRequest(controller);
    try {
      const response = await fetch(`/api/documents/${document.id}`, {
        method: "PATCH",
        headers: {
          ...authorizationHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: nextTitle }),
        signal: controller.signal,
      });
      const payload = await readPayload(response);
      if (!isAuthEpochCurrent(authRequest.epoch)) return;
      if (payload.document) onRenamed?.(payload.document as ClinicalDocument);
      setMode(null);
    } catch (renameError) {
      if (!isAuthEpochCurrent(authRequest.epoch) || controller.signal.aborted) return;
      setError(renameError instanceof Error ? renameError.message : "Document rename failed.");
    } finally {
      authRequest.release();
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
    const controller = new AbortController();
    const authRequest = registerAuthRequest(controller);
    try {
      const response = await fetch(`/api/documents/${document.id}`, {
        method: "DELETE",
        headers: authorizationHeader,
        signal: controller.signal,
      });
      const payload = (await readPayload(response)) as DocumentDeleteResult;
      if (!isAuthEpochCurrent(authRequest.epoch)) return;
      onDeleted?.(payload);
      setMode(null);
    } catch (deleteError) {
      if (!isAuthEpochCurrent(authRequest.epoch) || controller.signal.aborted) return;
      setError(deleteError instanceof Error ? deleteError.message : "Document delete failed.");
    } finally {
      authRequest.release();
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
          <Pencil aria-hidden="true" className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={cn(toolbarButton, "text-[color:var(--danger)]")}
          onClick={() => openDialog("delete")}
          disabled={!canManage || pending}
          title="Permanently delete document"
          aria-label={`Permanently delete ${document.title}`}
        >
          <Trash2 aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      <Sheet
        open={mode !== null}
        onClose={closeDialog}
        closeLabel="Close document action"
        initialFocusRef={inputRef}
        title={mode === "delete" ? "Permanently delete document" : "Rename document"}
        description={
          mode === "delete"
            ? "This removes the source, extracted evidence, images, labels, summaries, and related query logs."
            : "The original file name and storage path will stay unchanged."
        }
      >
        {error && (
          <div role="alert" className={cn("mb-4 rounded-lg border p-3 text-sm font-semibold", toneDanger)}>
            {error}
          </div>
        )}

        {mode === "delete" ? (
          <form onSubmit={submitDelete} className="space-y-4">
            <div className={cn("rounded-lg border p-3 text-sm", toneDanger)}>
              <div className="flex items-start gap-2">
                <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="font-semibold">This action cannot be undone.</p>
              </div>
            </div>
            <label className="block">
              <span className={fieldLabel}>Type the current title to confirm</span>
              <input
                ref={inputRef}
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                className={fieldControlPlain}
                disabled={pending}
              />
            </label>
            {/* Deliberately the RAW stored title: the confirmation input is compared
                against document.title verbatim, so the user must see the exact string. */}
            <p className={cn("break-words text-xs font-semibold", textMuted)}>{document.title}</p>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={floatingControl} onClick={closeDialog} disabled={pending}>
                Cancel
              </button>
              <AsyncButton
                type="submit"
                busy={pending}
                busyLabel="Deleting…"
                idleIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
                className={cn(primaryControl, "bg-[color:var(--danger)] hover:bg-[color:var(--danger)]")}
                disabled={deleteConfirmation !== document.title}
              >
                Delete permanently
              </AsyncButton>
            </div>
          </form>
        ) : (
          <form onSubmit={submitRename} className="space-y-4">
            <label className="block">
              <span className={fieldLabel}>Display and search title</span>
              <input
                ref={inputRef}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={180}
                className={fieldControlPlain}
                disabled={pending}
              />
            </label>
            <p className={cn("truncate text-xs", textMuted)}>Original file: {document.file_name}</p>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={floatingControl} onClick={closeDialog} disabled={pending}>
                Cancel
              </button>
              <AsyncButton
                type="submit"
                busy={pending}
                busyLabel="Saving…"
                idleIcon={<Check aria-hidden="true" className="h-4 w-4" />}
                className={primaryControl}
                disabled={!title.trim()}
              >
                Save title
              </AsyncButton>
            </div>
          </form>
        )}
      </Sheet>
    </>
  );
}
