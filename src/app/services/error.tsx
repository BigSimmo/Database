"use client";

import { RouteErrorBoundary } from "@/components/route-error-boundary";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteErrorBoundary
      error={error}
      reset={reset}
      title="Failed to load services"
      description="An unexpected error occurred while loading clinical services."
      logLabel="Unhandled runtime error captured in services segment:"
    />
  );
}
