"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * COMPONENTS §5. A 13-mode app with no focus management or route announcement
 * strands assistive-technology users on every navigation: the URL changes, the
 * page changes, and the screen reader says nothing while focus sits on a link
 * that no longer exists.
 *
 * One singleton owns every announcement in the product. That is the point — the
 * anti-pattern this replaces is `aria-live` scattered onto visible content
 * nodes, where a streaming answer re-announces its own fragments and a result
 * count is read out through a low-contrast visible node.
 */

type Priority = "polite" | "assertive";

/** Identical messages inside this window are the same event announced twice. */
const dedupeWindowMs = 1_000;
/** Minimum gap between announcements so a queued message cannot cut into the previous sentence. */
const queueGapMs = 150;
/** Clear→set gap so an identical repeat after the dedupe window still mutates the live region. */
const repeatClearMs = 50;

type Listener = (state: { polite: string; assertive: string }) => void;

const store = {
  polite: "",
  assertive: "",
  listeners: new Set<Listener>(),
  queue: [] as Array<{ message: string; priority: Priority }>,
  recent: new Map<string, number>(),
  draining: false,
  timer: null as ReturnType<typeof setTimeout> | null,
  mounted: 0,
};

function emit() {
  const snapshot = { polite: store.polite, assertive: store.assertive };
  for (const listener of store.listeners) listener(snapshot);
}

function setRegion(priority: Priority, message: string) {
  if (priority === "assertive") store.assertive = message;
  else store.polite = message;
}

function currentRegion(priority: Priority) {
  return priority === "assertive" ? store.assertive : store.polite;
}

function drain() {
  const next = store.queue.shift();
  if (!next) {
    store.draining = false;
    return;
  }
  store.draining = true;

  // aria-live announces only when the region's text *changes*. A repeat of the
  // same message after the dedupe window is a new event that announce() let
  // through — clear first so the subsequent set is observable to AT.
  if (currentRegion(next.priority) === next.message) {
    setRegion(next.priority, "");
    emit();
    store.timer = setTimeout(() => {
      setRegion(next.priority, next.message);
      emit();
      store.timer = setTimeout(drain, queueGapMs);
    }, repeatClearMs);
    return;
  }

  setRegion(next.priority, next.message);
  emit();
  store.timer = setTimeout(drain, queueGapMs);
}

/**
 * Announce an outcome. `polite` for results, counts and stage transitions;
 * `assertive` only for loss-of-work risks such as an expiring session, because
 * assertive interrupts whatever the reader is in the middle of.
 */
export function announce(message: string, opts?: { priority?: Priority }) {
  const text = message.trim();
  if (!text) return;
  const priority = opts?.priority ?? "polite";
  const now = Date.now();
  const key = `${priority}:${text}`;

  const last = store.recent.get(key);
  if (last !== undefined && now - last < dedupeWindowMs) return;
  store.recent.set(key, now);
  for (const [entry, at] of store.recent) if (now - at >= dedupeWindowMs) store.recent.delete(entry);

  store.queue.push({ message: text, priority });
  if (!store.draining) drain();
}

/** Test seam: clears the queue, dedupe window and rendered text between cases. */
export function resetAnnouncerForTests() {
  if (store.timer) clearTimeout(store.timer);
  store.timer = null;
  store.queue.length = 0;
  store.recent.clear();
  store.draining = false;
  store.polite = "";
  store.assertive = "";
  store.mounted = 0;
  emit();
}

export function LiveAnnouncer() {
  const [state, setState] = useState({ polite: store.polite, assertive: store.assertive });
  const [suppressed, setSuppressed] = useState(false);

  useEffect(() => {
    store.mounted += 1;
    if (store.mounted > 1) {
      // Two announcers means every message is read twice. Loud in development;
      // in production the duplicate is a true no-op — no listener, no regions.
      if (process.env.NODE_ENV !== "production") {
        throw new Error("LiveAnnouncer is a singleton — mount exactly one instance at the app root.");
      }
      console.warn(JSON.stringify({ level: "warn", message: "live-announcer: duplicate instance mounted" }));
      // Ownership cannot be decided during render without tripping immutability/
      // refs lint; suppress after mount so the duplicate never registers.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- singleton ownership gate
      setSuppressed(true);
      return () => {
        store.mounted = Math.max(0, store.mounted - 1);
      };
    }
    const listener: Listener = (next) => setState(next);
    store.listeners.add(listener);
    listener({ polite: store.polite, assertive: store.assertive });
    return () => {
      store.listeners.delete(listener);
      store.mounted = Math.max(0, store.mounted - 1);
    };
  }, []);

  if (suppressed) return null;

  return (
    <>
      <div data-testid="live-announcer-polite" aria-live="polite" aria-atomic="true" className="sr-only">
        {state.polite}
      </div>
      <div data-testid="live-announcer-assertive" aria-live="assertive" aria-atomic="true" className="sr-only">
        {state.assertive}
      </div>
    </>
  );
}

/**
 * True when the user is inside an overlay or a controlled workflow. Yanking
 * focus to the page `<h1>` while a dialog is open both breaks the focus trap and
 * loses the user's place, so a navigation that happens from inside one keeps
 * its focus deliberately.
 */
function focusIsInControlledWorkflow() {
  const active = document.activeElement;
  if (!active || active === document.body) return false;
  return Boolean(active.closest('[role="dialog"], [role="alertdialog"], [data-preserve-focus="true"]'));
}

export function RouteAnnouncer() {
  const pathname = usePathname();
  const previous = useRef<string | null>(null);

  useEffect(() => {
    // The first render of a route is a load, not a navigation: the browser has
    // already announced the document, and stealing focus on arrival is exactly
    // the behaviour that makes screen-reader users dread SPAs.
    if (previous.current === null) {
      previous.current = pathname;
      return;
    }
    if (previous.current === pathname) return;
    previous.current = pathname;

    if (!focusIsInControlledWorkflow()) {
      const target =
        document.querySelector<HTMLElement>("main h1") ??
        document.querySelector<HTMLElement>("h1") ??
        document.querySelector<HTMLElement>("main");
      if (target) {
        // A heading is not focusable by default; -1 makes it programmatically
        // focusable without adding it to the tab order.
        if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      }
    }

    const title = document.title.trim();
    if (title) announce(title);
  }, [pathname]);

  return null;
}
