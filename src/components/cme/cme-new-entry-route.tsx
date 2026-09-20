"use client";

import { useRouter } from "next/navigation";

import { CmeEntryForm, type CmeEntryDraft } from "@/components/cme/cme-entry-form";
import { cn, textMuted } from "@/components/ui-primitives";

/**
 * Reads the message the API actually sent, so the form shows the reason rather
 * than a generic failure. `jsonError` (`@/lib/http`) puts the same text in both
 * `error` and `message`; a response that is not JSON at all falls back to the
 * status line.
 */
async function entrySaveError(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (payload && typeof payload === "object") {
      const { message, error } = payload as { message?: unknown; error?: unknown };
      if (typeof message === "string" && message.trim()) return message;
      if (typeof error === "string" && error.trim()) return error;
    }
  } catch {
    // Not JSON. Fall through to the status line below.
  }
  return `Could not save this entry (${response.status}).`;
}

/**
 * The new-entry screen.
 *
 * The form owns every field, the category split and the Save control; this
 * wrapper owns only the page frame and what "save" means — one POST to
 * `/api/cme/entries`, which is the route that resolves the owner from the
 * session and rejects anything the schema does not accept.
 *
 * The throw on failure is load-bearing rather than lazy: `CmeEntryForm` catches
 * whatever `onSubmit` rejects with and renders it, and it clears the form only
 * when `onSubmit` resolves. Returning quietly on a failed request would empty
 * the form and tell the owner nothing — an activity they typed out, gone, with
 * no record made.
 */
export function CmeNewEntryRoute() {
  const router = useRouter();

  async function saveEntry(entry: CmeEntryDraft) {
    const response = await fetch("/api/cme/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    if (!response.ok) throw new Error(await entrySaveError(response));
    router.push("/cme/log");
    router.refresh();
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <h1 className="text-xl font-semibold text-[color:var(--text)]">Log an activity</h1>
      <p className={cn(textMuted, "mt-1 text-sm")}>
        What it was, when, how long it ran for, and how those hours split across categories. Nothing is recorded until
        you save it.
      </p>

      <div className="mt-6">
        <CmeEntryForm onSubmit={saveEntry} />
      </div>
    </main>
  );
}
