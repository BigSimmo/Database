"use client";

import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { appModeHomeHref } from "@/lib/app-modes";

export default function NotFound() {
  return (
    <div className="flex h-[400px] items-center justify-center px-4">
      <div
        role="status"
        className="w-full max-w-md rounded-lg border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-inset)] p-4 text-sm shadow-[var(--shadow-inset)] sm:p-5"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[color:var(--surface)] text-[color:var(--text-muted)]">
            <FileQuestion className="size-icon-md sm:size-icon-lg" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-[color:var(--text)]">Differential Not Found</h1>
            <p className="mt-1 leading-6 text-[color:var(--text-muted)]">
              The requested differential diagnosis could not be found or has been deleted.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={appModeHomeHref("differentials")}
                className="text-sm font-medium text-[color:var(--clinical-accent)] hover:underline"
              >
                Return to differentials
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
