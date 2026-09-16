"use client";

import { Clipboard, ClipboardCheck, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { toolbarButton } from "@/components/ui-primitives";
import { cn } from "@/components/ui-primitives";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";
import { onCallDialableNumber } from "@/lib/on-call/home-modules";

export interface OnCallCopyNumberProps {
  /** The number as the owner typed it — punctuation and all. */
  value: string;
  /**
   * The control's accessible name, and it must NAME THE NUMBER AND THE CONTACT
   * — "Copy After hours number for Ward 4B". The control is icon-only, so this
   * is the only thing a screen-reader user hears; a bare "Copy" repeated down
   * a list of forty contacts identifies nothing.
   */
  label: string;
  /** How long the visible confirmation stays up. Injectable for tests. */
  resetMs?: number;
  testId?: string;
}

type CopyState = "idle" | "copied" | "failed";

/**
 * Copy a contact's number to the clipboard.
 *
 * Why this exists beside a perfectly good `tel:` link: in a hospital the number
 * is as often typed into the digital medical record or a paging system as it is
 * dialled from the handset, and until now the only way to get it out of the app
 * was to read it off the screen and retype it.
 *
 * **Feedback is local, not a toast.** The On Call routes do not mount a
 * `ToastProvider` (nothing in `src/app` does), and `useToast` throws outside one
 * — so this control carries its own inline confirmation rather than depending on
 * a provider that is not there. Adding one to a layout is a different change,
 * owned elsewhere.
 *
 * **A failed copy says so.** `navigator.clipboard` is absent in an insecure
 * context and can reject outright when permission is denied, and a control that
 * silently looks like it worked is how an old number ends up pasted into a
 * progress note. Both paths land in the same visible "Not copied" state, and the
 * announcement reads the digits out so the number is still recoverable.
 */
export function OnCallCopyNumber({
  value,
  label,
  resetMs = 4000,
  testId = "on-call-copy-number",
}: OnCallCopyNumberProps) {
  const [state, setState] = useState<CopyState>("idle");
  const [announcement, setAnnouncement] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // The same string the `tel:` link dials, from the same helper, so the number
  // that is pasted and the number that is rung can never drift apart.
  const dialable = onCallDialableNumber(value);

  const settle = useCallback(
    (next: Exclude<CopyState, "idle">, spoken: string) => {
      if (!mounted.current) return;
      setState(next);
      setAnnouncement(spoken);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (!mounted.current) return;
        setState("idle");
        setAnnouncement("");
      }, resetMs);
    },
    [resetMs],
  );

  const handleCopy = useCallback(() => {
    if (!dialable) return;
    // Never throws and never rejects unhandled: every failure path — no
    // clipboard object, a rejected write, a refused legacy fallback — resolves
    // into the "failed" state instead.
    void copyTextToClipboard(dialable).then(
      () => settle("copied", `${dialable} copied to the clipboard.`),
      () => settle("failed", `Could not copy. The number is ${dialable}.`),
    );
  }, [dialable, settle]);

  // Nothing dialable ("via switchboard") means nothing to copy, and an inert
  // control in a dense row is one more thing to aim at for no benefit.
  if (!dialable) return null;

  const Icon = state === "copied" ? ClipboardCheck : state === "failed" ? TriangleAlert : Clipboard;
  const statusText = state === "copied" ? "Copied" : state === "failed" ? "Not copied" : null;

  return (
    <span className="flex w-tap shrink-0 flex-col items-center gap-0.5">
      <button
        type="button"
        onClick={handleCopy}
        aria-label={label}
        data-testid={testId}
        data-state={state}
        className={cn(toolbarButton, "shrink-0 motion-reduce:transition-none")}
      >
        {/* Decoration beside the accessible name above, in every state. */}
        <Icon aria-hidden="true" className="size-icon-md" />
      </button>
      {/* The outcome in words as well as a changed glyph, so it survives with no
          colour perception at all — and the two states never share an icon. */}
      {statusText ? (
        <span
          data-testid={`${testId}-status`}
          className={cn(
            "text-2xs font-semibold leading-tight",
            state === "failed" ? "text-[color:var(--warning)]" : "text-[color:var(--text-muted)]",
          )}
        >
          {statusText}
        </span>
      ) : null}
      {/* Assistive technology hears the outcome through here rather than through
          the visible glyph swap, which announces nothing at all. */}
      <span data-testid={`${testId}-announcement`} role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </span>
  );
}
