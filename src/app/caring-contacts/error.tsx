"use client";

import { RouteErrorBoundary } from "@/components/route-error-boundary";

export default function CaringContactsErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorBoundary
      error={error}
      reset={reset}
      title="The Caring Contacts workspace could not be shown"
      description="Nothing was sent and nothing was changed. You can try to reset this view or refresh the browser."
      logLabel="Unhandled runtime error captured by the Caring Contacts boundary:"
      showReload
      minHeightClass="min-h-dvh"
    />
  );
}
