"use client";

import { Check, Copy } from "lucide-react";
import { useRef, useState } from "react";

import { cn, codeText, metadataPill } from "@/components/ui-primitives";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";

/**
 * The ICD-10 code chip, made copyable.
 *
 * The code is the one string on this page that gets retyped into a coding field
 * or a discharge summary, and it was rendered as plain text, so it had to be
 * selected by hand from a chip sized for reading rather than selecting. This
 * keeps the chip's appearance and adds the one action it was missing.
 *
 * Deliberately a button rather than a click handler on the chip: it is an
 * action, so it needs a role, a focusable target, and an accessible name that
 * says what it does rather than just reading the code aloud.
 */

const COPY_RESET_MS = 2000;

export function DsmCodeCopy({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  async function copy() {
    try {
      await copyTextToClipboard(code);
      setCopied(true);
    } catch {
      // A failed copy must not claim success. The code stays visible and
      // selectable, which is exactly the fallback that existed before.
      setCopied(false);
      return;
    }
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), COPY_RESET_MS);
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={copied ? `Copied ICD-10 code ${code}` : `Copy ICD-10 code ${code}`}
      data-testid="dsm-icd-copy"
      // The TAP AREA lives here and the chip recipe stays on the span below.
      // Stacking `min-h-tap` onto `metadataPill` competes with the chip's own
      // height utility, which `check:design-system-contract` rejects — correctly,
      // since two recipes fighting over one element is how chip sizing drifts.
      className="group inline-flex min-h-tap items-center"
    >
      <span
        className={cn(
          metadataPill,
          codeText,
          "inline-flex items-center gap-1.5 transition-colors group-hover:text-[color:var(--clinical-accent)]",
        )}
      >
        {code}
        {copied ? (
          <Check className="h-3.5 w-3.5 text-[color:var(--clinical-accent)]" aria-hidden />
        ) : (
          <Copy className="h-3.5 w-3.5 text-[color:var(--decoration-soft)]" aria-hidden />
        )}
      </span>
      <span role="status" className="sr-only">
        {copied ? "Code copied to the clipboard." : ""}
      </span>
    </button>
  );
}
