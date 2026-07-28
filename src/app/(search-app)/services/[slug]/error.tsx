"use client";

import { RouteErrorBoundary } from "@/components/route-error-boundary";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteErrorBoundary
      error={error}
      reset={reset}
      title="Failed to load service record"
      description="An unexpected error occurred while fetching this clinical service record."
      logLabel="Unhandled runtime error captured in services segment:"
    />
  );
}
