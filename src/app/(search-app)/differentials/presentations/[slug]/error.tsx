"use client";

import { RouteErrorBoundary } from "@/components/route-error-boundary";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteErrorBoundary
      error={error}
      reset={reset}
      title="Failed to load presentation workflow"
      description="An unexpected error occurred while fetching the differential presentation workflow details."
      logLabel="Unhandled runtime error captured in differentials presentations segment:"
    />
  );
}
