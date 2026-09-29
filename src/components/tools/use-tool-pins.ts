"use client";

import { useCallback, useMemo } from "react";

import { createBrowserStore } from "@/lib/client-store-factory";
import type { ToolCatalogId } from "@/lib/tools-catalog";
import {
  TOOL_PINS_STORAGE_KEY,
  defaultPinnedToolIds,
  readPinnedToolIds,
  togglePinnedToolId,
} from "@/lib/tools-page-layout";

/**
 * The Tools page's pinned row, remembered per browser. A per-device convenience
 * like the sidebar pins (`use-sidebar-pins.ts`), so it lives in localStorage and
 * falls back to an in-session copy when storage is unavailable.
 */
const changeEvent = "psychsift-tool-pins-change";
const defaultSnapshot = JSON.stringify(defaultPinnedToolIds);

let inMemorySnapshot: string | null = null;

function getSnapshot() {
  if (inMemorySnapshot !== null) return inMemorySnapshot;
  try {
    return JSON.stringify(readPinnedToolIds(window.localStorage.getItem(TOOL_PINS_STORAGE_KEY)));
  } catch {
    return defaultSnapshot;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(changeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(changeEvent, onChange);
  };
}

const useToolPinsStore = createBrowserStore(subscribe, getSnapshot, defaultSnapshot);

export function useToolPins() {
  const snapshot = useToolPinsStore();
  const pinnedToolIds = useMemo(() => readPinnedToolIds(snapshot), [snapshot]);

  const togglePinnedTool = useCallback((id: ToolCatalogId) => {
    const next = JSON.stringify(togglePinnedToolId(readPinnedToolIds(getSnapshot()), id));
    try {
      window.localStorage.setItem(TOOL_PINS_STORAGE_KEY, next);
      inMemorySnapshot = null;
    } catch {
      inMemorySnapshot = next;
    }
    window.dispatchEvent(new Event(changeEvent));
  }, []);

  return { pinnedToolIds, togglePinnedTool };
}
