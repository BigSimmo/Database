/** Copies text to the clipboard, falling back to the legacy hidden-textarea
 *  selection path when the async Clipboard API is unavailable or blocked
 *  (restricted browser contexts, older engines). Throws when both paths fail
 *  so callers can surface a copy-failed state. */
export async function copyTextToClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall through to the legacy selection path for restricted browser contexts.
    }
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  try {
    const copied = document.execCommand?.("copy");
    if (copied === false) throw new Error("copy command rejected");
  } finally {
    document.body.removeChild(textArea);
  }
}
