"use client";

import { createBrowserStore } from "@/lib/client-store-factory";
import { PRIVACY_SECTIONS, type PrivacySectionId } from "@/lib/privacy-page-content";

/**
 * `/privacy#retention` as an external store rather than a mount effect.
 *
 * The URL fragment is a browser value this page reads and writes, so it follows
 * the same `createBrowserStore` shape as the theme and last-mode preferences:
 * the server snapshot is `null`, hydration is deterministic, and no `setState`
 * runs inside an effect to bootstrap it.
 *
 * `history.replaceState` does not emit `hashchange`, so writes announce
 * themselves on a private event — the pattern `use-last-app-mode.ts` uses.
 * `replaceState`, not `pushState`: the fragment is a bookmark for the reader,
 * and Back should leave the page rather than walk ten section anchors.
 */

const changeEvent = "clinical-kb-privacy-hash-change";

function isPrivacySectionId(value: string): value is PrivacySectionId {
  return PRIVACY_SECTIONS.some((section) => section.id === value);
}

function getSnapshot(): PrivacySectionId | null {
  const raw = window.location.hash.replace("#", "");
  return raw && isPrivacySectionId(raw) ? raw : null;
}

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  window.addEventListener(changeEvent, onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener(changeEvent, onChange);
  };
}

export const usePrivacyHashSection = createBrowserStore<PrivacySectionId | null>(subscribe, getSnapshot, null);

export function writePrivacyHashSection(id: PrivacySectionId | null) {
  if (typeof window === "undefined") return;
  const target = id ? `#${id}` : `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, "", target);
  window.dispatchEvent(new Event(changeEvent));
}
