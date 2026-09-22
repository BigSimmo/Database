"use client";

import { LoaderCircle, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { focusRing } from "@/components/card-recipes";
import { cn, textMuted } from "@/components/ui-primitives";
import { DEMO_ON_CALL_ENTRIES } from "@/lib/on-call/demo-entries";
import {
  clearOnCallEntryCache,
  isOnCallDemoPreviewActive,
  onCallEntryCacheChangedEvent,
  setOnCallDemoPreviewActive,
} from "@/lib/on-call/entry-cache-keys";
import { cacheOnCallEntries } from "@/lib/on-call/entry-store";
import { createBrowserStore } from "@/lib/client-store-factory";

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
/**
 * What this reader can do with the example corpus.
 *
 * `account` is the signed-in case: the numbers come from the owner-scoped
 * endpoint and the buttons write to the database. `preview` is the signed-out
 * case: nothing is written anywhere but this device's own cache, so it needs
 * no account, publishes nothing, and is undone by one tap.
 */
export type OnCallDemoContentState =
  { mode: "account"; loaded: number; total: number } | { mode: "preview"; previewing: boolean; total: number } | null;

/**
 * Ask the owner-scoped endpoint how much of the corpus this account holds.
 *
 * Separate from the control because the caller has to gate a labelled
 * `HomeModule` on the same answer. A module that renders while its only child
 * is still deciding shows a heading with nothing under it — which is exactly
 * the defect this component already had once, and the reason the answer is
 * returned to the caller rather than kept private here.
 */
/**
 * The preview marker, read as browser state rather than copied into React
 * state by an effect.
 *
 * `createBrowserStore` is how the entry cache itself is read two modules away,
 * and it is the right shape here for the same reasons: it returns the server
 * snapshot during render on the server, so there is no hydration mismatch from
 * touching `localStorage`, and it re-renders every mounted control when the
 * flag changes instead of leaving a second copy to drift.
 *
 * It rides `onCallEntryCacheChangedEvent` because the flag and the cache are
 * written together and are meaningless apart — clearing the cache on sign-out
 * clears the flag in the same call.
 */
const useOnCallDemoPreviewFlag = createBrowserStore(
  (onChange) => {
    window.addEventListener(onCallEntryCacheChangedEvent, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(onCallEntryCacheChangedEvent, onChange);
      window.removeEventListener("storage", onChange);
    };
  },
  () => isOnCallDemoPreviewActive(),
  false,
);

export function useOnCallDemoContentState(signedOut: boolean, demoMode: boolean): OnCallDemoContentState {
  const [state, setState] = useState<OnCallDemoContentState>(null);
  const previewing = useOnCallDemoPreviewFlag();

  useEffect(() => {
    // Demo mode already IS this corpus, served from memory, and the route
    // refuses to write in it. Every button here would be one whose only
    // outcome is an error, so it asks nothing and offers nothing.
    if (demoMode) return;

    // Signed out needs no server at all, so it is answered below without
    // asking one — see the return.
    if (signedOut) return;

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/on-call/demo-content", { headers: { accept: "application/json" } });
        if (!response.ok) return;
        const body: unknown = await response.json();
        if (cancelled || typeof body !== "object" || body === null) return;
        const { loaded, total } = body as { loaded?: unknown; total?: unknown };
        if (typeof loaded === "number" && typeof total === "number") setState({ mode: "account", loaded, total });
      } catch {
        // Offline or a server error: stay silent and render nothing. This is a
        // convenience control, and a failed count is not worth an error banner
        // on a page the reader opened to read numbers off.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signedOut, demoMode]);

  if (demoMode) return null;
  // Signed out: adding to an account requires an account; looking at the design
  // does not, and that is the whole point of the preview.
  if (signedOut) return { mode: "preview", previewing, total: DEMO_ON_CALL_ENTRIES.length };
  return state;
}

/**
 * The signed-out half: fill this device's cache with the example corpus so the
 * pages can be read in use, and empty it again.
 *
 * Nothing here reaches the server. That is not a limitation worked around, it
 * is the better answer to the question the reader is actually asking — "what
 * does a filled hub look like" — because loading into an account publishes the
 * non-personal rows to every visitor of this site, and a preview publishes
 * nothing to anyone. It also needs no account, which is the whole reason this
 * branch exists.
 *
 * The cache write is picked up by `useOnCallEntries` through
 * `onCallEntryCacheChangedEvent`, so the page fills in place with no reload.
 * The signed-out fetch that follows returns the shared rows and cannot erase
 * this: the store deliberately refuses to let an empty response overwrite a
 * non-empty cache.
 */
function OnCallDemoPreviewControl({ state }: { state: { mode: "preview"; previewing: boolean; total: number } }) {
  const { previewing: active, total } = state;

  function toggle() {
    if (active) {
      // Order matters: the flag first, then the cache clear, because clearing
      // the cache is what notifies every mounted control to re-read the flag.
      setOnCallDemoPreviewActive(false);
      clearOnCallEntryCache();
      return;
    }
    setOnCallDemoPreviewActive(true);
    cacheOnCallEntries([...DEMO_ON_CALL_ENTRIES]);
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={toggle}
        data-testid={active ? "on-call-demo-preview-clear" : "on-call-demo-preview-start"}
        className={cn(
          "inline-flex min-h-tap items-center gap-1.5 self-start rounded-sm px-1.5 text-sm font-semibold",
          "text-[color:var(--text-heading)] transition-colors motion-reduce:transition-none hover:text-[color:var(--command)]",
          focusRing,
        )}
      >
        {active ? (
          <Trash2 aria-hidden="true" className="size-icon-xs" />
        ) : (
          <Sparkles aria-hidden="true" className="size-icon-xs" />
        )}
        {active ? "Clear the example preview" : "Preview with example content"}
      </button>

      <p className={cn("text-xs", textMuted)}>
        {active
          ? "Showing " +
            total +
            " example entries on this device only. Clearing takes them away and leaves the real hub as it was."
          : "Fills every page with " +
            total +
            " example entries so you can see the design in use. It stays on this device, nothing is saved to the site, and nobody else can see it."}
      </p>
    </div>
  );
}

export function OnCallDemoContentControl({ state }: { state: OnCallDemoContentState }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state === null) return null;

  if (state.mode === "preview") return <OnCallDemoPreviewControl state={state} />;

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
        const apiMessage =
          typeof body === "object" && body !== null && typeof (body as { message?: unknown }).message === "string"
            ? (body as { message: string }).message.trim()
            : typeof body === "object" && body !== null && typeof (body as { error?: unknown }).error === "string"
              ? (body as { error: string }).error.trim()
              : "";
        setError(
          loading
            ? "That did not load. Nothing was added — try again."
            : apiMessage && /removed|Press Remove again/i.test(apiMessage)
              ? apiMessage
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
