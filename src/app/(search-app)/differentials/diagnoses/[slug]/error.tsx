"use client";

import { RouteErrorBoundary } from "@/components/route-error-boundary";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteErrorBoundary
      error={error}
      reset={reset}
      title="Failed to load differential details"
      description="An unexpected error occurred while fetching the differential diagnosis details."
      logLabel="Unhandled runtime error captured in differentials diagnoses segment:"
    />
  );
}
