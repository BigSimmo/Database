import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { cn } from "@/components/ui-primitives";
import {
  ANSWER_SAFETY_OBLIGATION,
  ANSWER_SAFETY_PRIVACY_LINK,
  ANSWER_SAFETY_VERIFY,
} from "@/lib/ui-copy";

/**
 * Consolidated Answer-mode trust strip (#165 / #166).
 *
 * Replaces the thin APP-5-only `PrivacyInputNotice` on Answer composers with one
 * block that keeps the pinned privacy obligation + /privacy link and adds the
 * missing verify-before-use caveat. Documents/calculators composers stay on
 * `PrivacyInputNotice`.
 *
 * densities:
 * - `card` — mode-home hero (warning-tinted obligation row + quiet verify row)
 * - `bar`  — docked/result composers (one compact row; wraps on narrow phones)
 */
export function AnswerSafetyNotice({
  density,
  className,
  id,
  testId,
}: {
  density: "card" | "bar";
  className?: string;
  id?: string;
  testId?: string;
}) {
  if (density === "card") {
    return (
      <div
        role="note"
        id={id}
        data-testid={testId}
        data-density="card"
        className={cn(
          "relative z-[5] w-full overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]",
          className,
        )}
      >
        <div className="flex items-start gap-2 border-b border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-3 py-2">
          <ShieldAlert className="mt-px h-4 w-4 shrink-0 text-[color:var(--warning-text)]" aria-hidden />
          <p className="min-w-0 flex-1 text-xs font-semibold leading-5 text-[color:var(--warning-text)]">
            {ANSWER_SAFETY_OBLIGATION}
          </p>
        </div>
        <div className="grid gap-1 px-3 py-2">
          <p className="text-2xs leading-4 text-[color:var(--text-muted)]">
            {ANSWER_SAFETY_VERIFY}{" "}
            <Link
              href="/privacy"
              className="inline-flex min-h-tap items-center whitespace-nowrap rounded-sm font-semibold text-[color:var(--clinical-accent)] underline decoration-[color:var(--border-strong)] underline-offset-2 transition-colors hover:decoration-current focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:min-h-0"
            >
              {ANSWER_SAFETY_PRIVACY_LINK}
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <p
      role="note"
      id={id}
      data-testid={testId}
      data-density="bar"
      className={cn(
        "relative z-[5] flex w-full min-w-0 flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-center text-2xs leading-4 text-[color:var(--text-muted)]",
        className,
      )}
    >
      <ShieldAlert className="h-3 w-3 shrink-0 text-[color:var(--warning)]" aria-hidden />
      <span className="font-medium text-[color:var(--text-heading)]">{ANSWER_SAFETY_OBLIGATION}</span>
      <span className="text-[color:var(--border-strong)]" aria-hidden>
        |
      </span>
      <span>{ANSWER_SAFETY_VERIFY}</span>
      <Link
        href="/privacy"
        className="inline-flex min-h-tap items-center rounded-sm font-medium underline decoration-[color:var(--border-strong)] underline-offset-2 transition-colors hover:text-[color:var(--clinical-accent)] hover:decoration-current focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:min-h-0"
      >
        {ANSWER_SAFETY_PRIVACY_LINK}
      </Link>
    </p>
  );
}
