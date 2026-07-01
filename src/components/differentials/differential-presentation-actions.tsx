"use client";

import { useState } from "react";
import { ClipboardCopy } from "lucide-react";

import { cn } from "@/components/ui-primitives";

export function CopyAfterReviewButton({
  text,
  className,
  label = "Copy after review",
}: {
  text: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copyText}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[color:var(--clinical-chat-teal)]/28 bg-[color:var(--clinical-chat-teal)] px-4 text-sm font-bold text-white shadow-[var(--shadow-soft)] hover:bg-[color:var(--primary-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
        className,
      )}
    >
      <ClipboardCopy className="h-4 w-4" aria-hidden />
      {copied ? "Copied" : label}
    </button>
  );
}
