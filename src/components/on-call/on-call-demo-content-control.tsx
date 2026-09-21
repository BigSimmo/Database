"use client";

import { LoaderCircle, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { focusRing } from "@/components/card-recipes";
import { cn, textMuted } from "@/components/ui-primitives";
import { clearOnCallEntryCache } from "@/lib/on-call/entry-cache-keys";

/**
 * Load the example On Call corpus into this account, and take it out again.
 *
 * On Call ships empty because every row in it is the owner's own information.
 * That is right, and it means a reader cannot see what any of these pages look
 * like in use without first filling them one entry at a time. This is the way
 * in and the way back out; `src/app/api/on-call/demo-content/route.ts` is the
 * half that writes.
 *
 * ## Why this asks the server what is loaded, instead of reading the page
 *
 * The obvious shortcut is to look at the entries already on screen and check
 * for the `demo-` prefix. That is wrong here, and the reason is the same
 * sharing rule this control exists to warn about: `fetchSharedOnCallEntries`
 * returns every non-personal row across EVERY account, so another account's
 * example rows are on this reader's page too. Inferring from them would offer
 * Remove to someone who owns none of them — and `DELETE`, correctly scoped to
 * the caller, would then remove nothing and leave the same button sitting
 * there. `GET` answers the question that actually matters, "how much of this
 * is MINE", because it filters on `owner_id`.
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
/** What this ACCOUNT holds, or `null` while that is still unknown. */
export type OnCallDemoContentState = { loaded: number; total: number } | null;

/**
 * Ask the owner-scoped endpoint how much of the corpus this account holds.
 *
 * Separate from the control because the caller has to gate a labelled
 * `HomeModule` on the same answer. A module that renders while its only child
 * is still deciding shows a heading with nothing under it — which is exactly
 * the defect this component already had once, and the reason the answer is
 * returned to the caller rather than kept private here.
 */
export function useOnCallDemoContentState(signedOut: boolean, demoMode: boolean): OnCallDemoContentState {
  const [state, setState] = useState<OnCallDemoContentState>(null);
  const unavailable = signedOut || demoMode;

  useEffect(() => {
    // Adding needs an account, exactly as the surrounding empty state already
    // says, and demo mode serves this corpus from memory where the route
    // refuses to write. Both would be buttons whose only outcome is an error,
    // so neither asks the server anything.
    if (unavailable) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/on-call/demo-content", { headers: { accept: "application/json" } });
        if (!response.ok) return;
        const body: unknown = await response.json();
        if (cancelled || typeof body !== "object" || body === null) return;
        const { loaded, total } = body as { loaded?: unknown; total?: unknown };
        if (typeof loaded === "number" && typeof total === "number") setState({ loaded, total });
      } catch {
        // Offline or a server error: stay silent and render nothing. This is a
        // convenience control, and a failed count is not worth an error banner
        // on a page the reader opened to read numbers off.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [unavailable]);

  return unavailable ? null : state;
}

export function OnCallDemoContentControl({ state }: { state: OnCallDemoContentState }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state === null) return null;

  const { loaded, total } = state;
  const loading = loaded === 0;

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/on-call/demo-content", {
        method: loading ? "POST" : "DELETE",
        headers: { accept: "application/json" },
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const partial =
          typeof body === "object" && body !== null && (body as { removed?: unknown }).removed
            ? (body as { removed?: unknown }).removed
            : 0;
        setError(
          loading
            ? "That did not load. Nothing was added — try again."
            : typeof partial === "number" && partial > 0
              ? `That did not finish. ${partial} example ${partial === 1 ? "entry" : "entries"} were removed before it stopped — press Remove again to clear the rest.`
              : "That did not remove. Nothing was deleted — try again.",
        );
        return;
      }
      // Clear the cached copy BEFORE reloading, or the reload shows the old
      // answer. `useOnCallEntries` returns `cached?.entries` ahead of the
      // fetched result, and deliberately refuses to let an empty response
      // overwrite a non-empty cache — a rule that protects a shift when a
      // session expires, and would here make a successful removal look like it
      // did nothing at all: the same ninety-four rows, the same Remove button.
      clearOnCallEntryCache();
      // A full reload rather than a local state nudge. Every page of this mode
      // reads the same cached entry store, and this action changes all of them
      // at once. A reload is the only refresh that cannot leave one page
      // showing the old answer, and this is a deliberate, rare action where a
      // moment's wait costs nothing.
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
          // The design system's disabled treatment for a borderless text
          // control, as `ui/segmented-control.tsx` uses it. Not
          // `disabled:opacity-60`: opacity fades the whole control including
          // its focus ring, and it is a raw value rather than the `--disabled`
          // token, which is what `check:design-system-contract` ratchets down.
          "disabled:cursor-not-allowed disabled:text-[color:var(--disabled)]",
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
          {total} example entries, every number an obvious placeholder. Most of them are shared rather than private, so
          while they are loaded anyone who opens this site can read them. Removing them is one tap.
        </p>
      ) : (
        <p className={cn("text-xs", textMuted)}>
          Takes out only the {loaded} example {loaded === 1 ? "entry" : "entries"} in your account. Anything you have
          written yourself stays.
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
