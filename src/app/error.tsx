"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { primaryControl } from "@/components/ui-primitives";
import { cn } from "@/components/ui-primitives";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Unhandled runtime error captured by boundary:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[color:var(--surface-lux)] px-4 font-sans text-[color:var(--text)] select-none">
      <div className="w-full max-w-md rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-6 shadow-[var(--shadow-elevated)] text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--danger-soft)] text-[color:var(--danger)]">
          <AlertTriangle className="h-6 w-6" />
        </div>

        <h1 className="mt-4 text-lg font-semibold tracking-tight text-[color:var(--text-heading)]">
          Something went wrong
        </h1>

        <p className="mt-2 text-sm text-[color:var(--text-muted)] leading-relaxed">
          An unexpected error occurred in the application shell. You can try to reset the current view or refresh the
          browser.
        </p>

        {error.digest && (
          <div className="mt-4 rounded-lg bg-[color:var(--surface-subtle)] p-2 text-xs font-mono text-[color:var(--text-muted)]">
            Digest: {error.digest}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className={cn(primaryControl, "flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium")}
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-medium text-[color:var(--text)] transition hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  );
}
