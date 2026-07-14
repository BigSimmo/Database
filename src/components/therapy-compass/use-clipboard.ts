"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Write text to the clipboard, guarded for SSR / unavailable API. Resolves to
 * whether the write actually succeeded: a rejected write (permission denied,
 * lost focus, a blocked user gesture) resolves to `false` instead of throwing,
 * so callers never signal success for a copy that didn't happen and no unhandled
 * promise rejection escapes.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard || !text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clipboard copy with transient "copied" feedback. `copied` holds the key of the
 * most recently copied item (or null) and resets after `resetMs`, so a caller can
 * flip a single button's label/icon without tracking its own timer. The key is
 * set only once the write actually succeeds, and never after the component has
 * unmounted.
 */
export function useClipboard(resetMs = 1400) {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copy = useCallback(
    (text: string, key = "default") => {
      void copyText(text).then((ok) => {
        if (!ok || !mounted.current) return;
        setCopied(key);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(null), resetMs);
      });
    },
    [resetMs],
  );

  return { copied, copy };
}
