"use client";

import { RouteErrorBoundary } from "@/components/route-error-boundary";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteErrorBoundary
      error={error}
      reset={reset}
      title="Failed to load form record"
      description="An unexpected error occurred while fetching this psychiatry form and workflow details."
      logLabel="Unhandled runtime error captured in forms segment:"
    />
  );
}
