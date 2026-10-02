"use client";

import { CloudOff, RotateCw } from "lucide-react";

import { EmptyState } from "@/components/primitive-recipes/feedback";
import { Button } from "@/components/ui/button";

/**
 * Admin's own "could not load" state (Today, New job, Help, Your Admin
 * records). The same behaviour as On Call's `OnCallLoadFailed` — never an
 * empty page when the server did not answer — in Admin's words: a doctor on
 * an Admin page is looking for their records, not their "On Call entries".
 * Admin is online only and keeps none of your records on the device (spec, "Offline"); the one thing it stores is pinned row ids (`src/lib/admin/pins.ts`).
 */
export function AdminLoadFailed({
  reason,
  onRetry,
  testId,
}: {
  readonly reason: "offline" | "failed" | null;
  readonly onRetry: () => void;
  readonly testId: string;
}) {
  return (
    <EmptyState
      icon={CloudOff}
      title="Couldn't load your Admin records"
      body={
        reason === "offline"
          ? "You appear to be offline, and Admin keeps none of your records on this device. Try again once you have signal."
          : "The server did not answer. Nothing has been lost; try again in a moment."
      }
      actions={
        <Button type="button" variant="secondary" icon={RotateCw} onClick={onRetry}>
          Try again
        </Button>
      }
      testId={testId}
    />
  );
}
