"use client";

import { useCallback, useSyncExternalStore } from "react";

import { OverlayHost } from "./overlay-host";

/**
 * The client boundary the overlay host needs, and nothing else.
 *
 * `shell.tsx` is a Server Component, and must stay one: it is handed the whole
 * service-wide safety-stop record, whose incident note is free text a responder
 * typed mid-incident. A `"use client"` boundary serialises its props into the
 * payload the browser can read, so the shell cannot become a client component
 * and cannot pass functions across the boundary either — `OverlayHostProps` takes `onClose` and `onCommit`,
 * and functions are not serialisable (Next 16, "Server and Client Components":
 * props passed to Client Components must be serializable).
 *
 * So this file exists because the framework requires it, not because a design
 * preferred it: it owns the open-overlay state and the two handlers on the client
 * and renders `OverlayHost` with the pinned props unchanged. It receives NO props
 * at all, which is what keeps that record on the server.
 *
 * Rule 7: the open overlay is represented in the URL as `?overlay=<id>`, so the
 * browser's own Back button closes it. That state is read and written with the
 * native History API rather than `useSearchParams`/`useRouter`, for two reasons
 * Next 16 is explicit about:
 *
 *  - `window.history.pushState`/`replaceState` "integrate into the Next.js
 *    Router" and are the documented way to keep a piece of query state
 *    ("Linking and Navigating → Native History API").
 *  - `useSearchParams` makes the whole client subtree up to the nearest
 *    `<Suspense>` boundary client-rendered, and a statically rendered page that
 *    calls it without one fails the production build. Overlay state is transient
 *    interface state that no server render ever reads, so paying that cost —
 *    and adding a Suspense boundary to the shell for it — would buy nothing.
 */

/** The one query parameter that names an open overlay. */
export const WORKSPACE_OVERLAY_PARAM = "overlay";

/**
 * `pushState` fires no event of its own, so the writer below announces its own
 * change. `popstate` covers Back and Forward; nothing else in this workspace
 * writes this parameter.
 */
const OVERLAY_URL_CHANGED_EVENT = "caring-contacts:overlay-url-changed";

function subscribeToOverlayParam(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener(OVERLAY_URL_CHANGED_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener(OVERLAY_URL_CHANGED_EVENT, onStoreChange);
  };
}

function readOverlayParam(): string | null {
  return new URLSearchParams(window.location.search).get(WORKSPACE_OVERLAY_PARAM);
}

/** The server never has a URL to read here, and never renders an overlay. */
function noOverlayParam(): string | null {
  return null;
}

function overlayUrl(id: string | null) {
  const params = new URLSearchParams(window.location.search);
  if (id === null) params.delete(WORKSPACE_OVERLAY_PARAM);
  else params.set(WORKSPACE_OVERLAY_PARAM, id);
  const query = params.toString();
  return `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
}

/**
 * Whether the entry currently on top of the history stack is one this module
 * pushed to open an overlay.
 *
 * Module scope rather than component state on purpose: the fact belongs to the
 * browser's history stack, which outlives any one mount of this component, and
 * there is exactly one overlay host in the workspace.
 */
let pushedOverlayEntry = false;

/**
 * Opening pushes, so Back closes the overlay — that is the browser-history
 * support rule 7 asks for.
 */
export function openWorkspaceOverlay(id: string) {
  window.history.pushState(null, "", overlayUrl(id));
  pushedOverlayEntry = true;
  window.dispatchEvent(new Event(OVERLAY_URL_CHANGED_EVENT));
}

/**
 * Closing UNWINDS the entry opening pushed; it never pushes another.
 *
 * Pushing on close was the first version and it was wrong in two ways at once:
 * the stack became `[page, ?overlay=x, page]`, so pressing Back after dismissing
 * walked forward into the dismissed modal and reopened it, and every open/close
 * cycle grew the stack by two entries with nothing to unwind them.
 *
 * `history.back()` is correct only when this module put that entry there. A
 * deep link — someone arriving on `?overlay=x` directly, or with the workspace
 * as their first entry — has no entry of ours to unwind, and calling `back()`
 * would take them out of the workspace entirely. That case replaces the current
 * entry instead, which still satisfies rule 7's "closing removes the parameter"
 * and leaves the stack exactly as deep as it was.
 */
export function closeWorkspaceOverlay() {
  if (pushedOverlayEntry) {
    pushedOverlayEntry = false;
    // `popstate` fires from the traversal itself, so no announcement is needed
    // — and announcing here would report the pre-traversal URL.
    window.history.back();
    return;
  }
  window.history.replaceState(null, "", overlayUrl(null));
  window.dispatchEvent(new Event(OVERLAY_URL_CHANGED_EVENT));
}

export function WorkspaceOverlays() {
  const openOverlayId = useSyncExternalStore(subscribeToOverlayParam, readOverlayParam, noOverlayParam);

  const close = useCallback(() => {
    closeWorkspaceOverlay();
  }, []);

  /**
   * Confirming an overlay closes it, and records nothing yet.
   *
   * Stated plainly rather than left to look finished: the screens that raise
   * these overlays, and the stores their decisions are written to, are later
   * tasks. Nothing in the workspace opens an overlay yet either — `?overlay=<id>`
   * is reachable only by typing it — so no control in the interface currently
   * advertises an action this does not perform.
   */
  const commit = useCallback(() => {
    closeWorkspaceOverlay();
  }, []);

  return <OverlayHost openOverlayId={openOverlayId} onClose={close} onCommit={commit} blockReason={null} />;
}
