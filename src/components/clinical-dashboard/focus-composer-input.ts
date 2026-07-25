import type { RefObject } from "react";

let pendingRafId: number | null = null;
let pendingTimeoutId: number | null = null;

/** Focus the dashboard composer, optionally pinning the element across remounts. */
export function focusComposerInput(composerInputRef: RefObject<HTMLInputElement | null>, retainTarget = false) {
  // Cancel any previous pending focus request before scheduling a new one.
  if (pendingRafId !== null) window.cancelAnimationFrame(pendingRafId);
  if (pendingTimeoutId !== null) window.clearTimeout(pendingTimeoutId);
  pendingRafId = null;
  pendingTimeoutId = null;

  const requestedInput = retainTarget ? composerInputRef.current : null;
  const focusBoundInput = () => {
    // Abort if focus has already intentionally moved elsewhere.
    const activeElement = document.activeElement;
    if (activeElement && activeElement !== document.body && activeElement !== composerInputRef.current) {
      return;
    }
    const input = retainTarget ? requestedInput : composerInputRef.current;
    if (input?.isConnected && composerInputRef.current === input) {
      input.focus({ preventScroll: true });
    }
  };

  pendingRafId = window.requestAnimationFrame(() => {
    pendingRafId = null;
    focusBoundInput();
    pendingTimeoutId = window.setTimeout(() => {
      pendingTimeoutId = null;
      focusBoundInput();
    }, 150);
  });

  return () => {
    if (pendingRafId !== null) window.cancelAnimationFrame(pendingRafId);
    if (pendingTimeoutId !== null) window.clearTimeout(pendingTimeoutId);
    pendingRafId = null;
    pendingTimeoutId = null;
  };
}
