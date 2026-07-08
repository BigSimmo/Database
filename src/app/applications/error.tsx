"use client";

import { RouteErrorBoundary } from "@/components/route-error-boundary";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteErrorBoundary
      error={error}
      reset={reset}
      title="Failed to load applications"
      description="An unexpected error occurred while loading the applications launcher."
      logLabel="Unhandled runtime error captured in applications segment:"
    />
  );
}
