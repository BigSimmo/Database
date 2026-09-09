import Link from "next/link";
import { FileQuestion } from "lucide-react";

/**
 * Shared in-app `not-found.tsx` panel. Route segments keep the thin default
 * export Next.js requires and pass their own copy and return link, so every
 * missing-record page stays visually identical.
 */
export function RouteNotFoundPanel({
  title,
  description,
  returnHref,
  returnLabel,
}: {
  title: string;
  description: string;
  returnHref: string;
  returnLabel: string;
}) {
  return (
    <div
      data-route-recovery="true"
      className="flex min-h-[min(30rem,62dvh)] items-start justify-center px-4 py-5 sm:items-center sm:py-8"
    >
      <div
        role="status"
        className="w-full max-w-md rounded-lg border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-inset)] p-4 text-sm shadow-[var(--shadow-inset)] sm:p-5"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[color:var(--surface)] text-[color:var(--text-muted)]">
            <FileQuestion className="size-icon-md sm:size-icon-lg" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-[color:var(--text)]">{title}</h1>
            <p className="mt-1 leading-6 text-[color:var(--text-muted)]">{description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={returnHref}
                className="text-sm font-medium text-[color:var(--clinical-accent)] hover:underline"
              >
                {returnLabel}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
