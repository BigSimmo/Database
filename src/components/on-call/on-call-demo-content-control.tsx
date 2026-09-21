"use client";

import { LoaderCircle, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";

import { focusRing } from "@/components/card-recipes";
import { cn, textMuted } from "@/components/ui-primitives";

/**
 * Load the example On Call corpus into this account, and take it out again.
 *
 * On Call ships empty because every row in it is the owner's own information.
 * That is right, and it means a reader cannot see what any of these pages look
 * like in use without first filling them one entry at a time. This is the way
 * in and the way back out; `src/app/api/on-call/demo-content/route.ts` is the
 * half that writes.
 *
 * ## The sentence under the load button is not decoration
 *
 * The shared read selects `is_personal = false` across every account, so most
 * of the example rows are readable by anyone who opens the site for as long as
 * they are loaded. The alternative — forcing every loaded row private — was
 * rejected: it would hide the shared/private distinction, which is one of the
 * things this corpus is loaded to show, and would put a "Private" pill on
 * every row of every page. So the consequence is stated at the control that
 * causes it, in the words a reader would use, rather than designed away.
 */
export function OnCallDemoContentControl({
  mode,
  signedOut,
  demoMode,
}: {
  mode: "load" | "remove";
  signedOut: boolean;
  demoMode: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Adding needs an account, exactly as the surrounding empty state already
  // says. Rendering a button that can only fail is worse than rendering none —
  // which is the same reason demo mode renders nothing here: that corpus is
  // served from memory and the route refuses to write in it, so both controls
  // would be buttons whose only outcome is an error.
  if (signedOut || demoMode) return null;

  const loading = mode === "load";

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/on-call/demo-content", {
        method: loading ? "POST" : "DELETE",
        headers: { accept: "application/json" },
      });
      if (!response.ok) {
        setError(
          loading
            ? "That did not load. Nothing was added — try again."
            : "That did not remove. Nothing was deleted — try again.",
        );
        return;
      }
      // A full reload rather than a local state nudge. Every page of this mode
      // reads the same cached entry store, and this action changes all of them
      // at once — ninety-four rows across eight pages. A reload is the only
      // refresh that cannot leave one page showing the old answer, and this is
      // a deliberate, rare action where a moment's wait costs nothing.
      window.location.reload();
    } catch {
      setError("That did not reach the server. Nothing changed — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const Icon = loading ? Sparkles : Trash2;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        data-testid={loading ? "on-call-demo-content-load" : "on-call-demo-content-remove"}
        className={cn(
          "inline-flex min-h-tap items-center gap-1.5 self-start rounded-sm px-1.5 text-sm font-semibold",
          "text-[color:var(--text-heading)] transition-colors motion-reduce:transition-none hover:text-[color:var(--command)]",
          "disabled:opacity-60",
          focusRing,
        )}
      >
        {busy ? (
          <LoaderCircle aria-hidden="true" className="size-icon-xs animate-spin motion-reduce:animate-none" />
        ) : (
          <Icon aria-hidden="true" className="size-icon-xs" />
        )}
        {loading
          ? busy
            ? "Loading example content…"
            : "Load example content"
          : busy
            ? "Removing example content…"
            : "Remove example content"}
      </button>

      {loading ? (
        <p className={cn("text-xs", textMuted)}>
          Ninety-four example entries, every number an obvious placeholder. Most of them are shared rather than private,
          so while they are loaded anyone who opens this site can read them. Removing them is one tap.
        </p>
      ) : (
        <p className={cn("text-xs", textMuted)}>
          Takes out only the example entries. Anything you have written yourself stays.
        </p>
      )}

      {error ? (
        <p role="status" className={cn("text-xs", "text-[color:var(--danger)]")}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
