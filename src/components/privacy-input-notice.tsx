import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { cn, textMuted } from "@/components/ui-primitives";
import type { AppModeId } from "@/lib/app-modes";

// Compact APP-5 privacy notice shown beside clinical input controls (query
// composer, document upload). Deliberately one quiet 11px line — the wording
// and the /privacy link are governance copy (PIA-5) and must stay intact.
export function PrivacyInputNotice({
  className,
  id,
  testId,
  returnMode,
}: {
  className?: string;
  id?: string;
  testId?: string;
  returnMode?: AppModeId;
}) {
  const privacyHref = returnMode ? `/privacy?from=${returnMode}` : "/privacy";

  return (
    <p
      role="note"
      id={id}
      data-testid={testId}
      className={cn(
        // z sits above the composer dock backdrop (z-0) but below the command
        // surface (z-10) so the suggestions dropdown can cover the notice.
        "relative z-[5] flex w-full min-w-0 flex-wrap items-center gap-x-1 gap-y-0 text-2xs leading-4",
        textMuted,
        className,
      )}
    >
      <ShieldAlert className="h-3 w-3 shrink-0 text-[color:var(--warning)]" aria-hidden />
      <span>Do not enter patient-identifiable information.</span>
      <Link
        href={privacyHref}
        className="inline-flex min-h-tap items-center rounded-sm font-medium underline decoration-[color:var(--border-strong)] underline-offset-2 transition-colors hover:text-[color:var(--clinical-accent)] hover:decoration-current focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:min-h-0"
      >
        Privacy and data processing
      </Link>
    </p>
  );
}
