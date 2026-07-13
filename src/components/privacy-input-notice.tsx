import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { cn, textMuted } from "@/components/ui-primitives";

export function PrivacyInputNotice({ className }: { className?: string }) {
  return (
    <p
      role="note"
      className={cn(
        "relative z-10 flex w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs leading-5",
        textMuted,
        className,
      )}
    >
      <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-[color:var(--warning)]" aria-hidden />
      <span>Do not enter patient-identifiable information.</span>
      <Link
        href="/privacy"
        className="rounded-sm font-semibold text-[color:var(--clinical-accent)] underline decoration-[color:var(--clinical-accent)]/40 underline-offset-2 hover:decoration-current focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
      >
        Privacy and data processing
      </Link>
    </p>
  );
}
