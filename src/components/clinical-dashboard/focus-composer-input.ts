import type { RefObject } from "react";

/** Focus the dashboard composer, optionally pinning the element across remounts. */
export function focusComposerInput(composerInputRef: RefObject<HTMLInputElement | null>, retainTarget = false) {
  const requestedInput = retainTarget ? composerInputRef.current : null;
  const focusBoundInput = () => {
    const input = retainTarget ? requestedInput : composerInputRef.current;
    if (input?.isConnected && composerInputRef.current === input) {
      input.focus({ preventScroll: true });
    }
  };
  window.requestAnimationFrame(() => {
    focusBoundInput();
    window.setTimeout(focusBoundInput, 150);
  });
}
