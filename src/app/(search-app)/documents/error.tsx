"use client";

import { RouteErrorBoundary } from "@/components/route-error-boundary";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteErrorBoundary
      error={error}
      reset={reset}
      title="Failed to load documents"
      description="An unexpected error occurred while loading source documents."
      logLabel="Unhandled runtime error captured in documents segment:"
    />
  );
}
