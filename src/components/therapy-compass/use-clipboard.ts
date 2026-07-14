"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Write text to the clipboard, guarded for SSR / unavailable API. Returns whether the write was attempted. */
export function copyText(text: string): boolean {
  if (typeof navigator === "undefined" || !navigator.clipboard || !text) return false;
  void navigator.clipboard.writeText(text);
  return true;
}

/**
 * Clipboard copy with transient "copied" feedback. `copied` holds the key of the
 * most recently copied item (or null) and resets after `resetMs`, so a caller can
 * flip a single button's label/icon without tracking its own timer.
 */
export function useClipboard(resetMs = 1400) {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(
    (text: string, key = "default") => {
      if (!copyText(text)) return;
      setCopied(key);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(null), resetMs);
    },
    [resetMs],
  );

  return { copied, copy };
}
