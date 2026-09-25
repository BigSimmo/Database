"use client";

import { useState } from "react";
import Link from "next/link";

import { AccountSetupDialog } from "@/components/clinical-dashboard/account-setup-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui-primitives";

export type CmeLoadState = "ready" | "unconfigured" | "signed-out" | "unavailable";

export function CmeStateNotice({
  state,
  year,
}: {
  readonly state: Exclude<CmeLoadState, "ready">;
  readonly year: number;
}) {
  const [accountOpen, setAccountOpen] = useState(false);
  if (state === "signed-out") {
    return (
      <>
        <EmptyState
          testId="cme-signed-out"
          title="Sign in to open your private CME record."
          body="Your activities and requirements are private to your account. Nothing from another account or the demo is shown here."
          actions={
            <Button variant="primary" onClick={() => setAccountOpen(true)}>
              Sign in
            </Button>
          }
        />
        <AccountSetupDialog open={accountOpen} onClose={() => setAccountOpen(false)} />
      </>
    );
  }
  if (state === "unavailable") {
    return (
      <EmptyState
        testId="cme-unavailable"
        title="Your CME record is temporarily unavailable."
        body="No saved data is being guessed or replaced. Please try again when the connection is restored."
      />
    );
  }
  return (
    <EmptyState
      testId="cme-unconfigured"
      title={`Confirm your ${year} requirements to begin.`}
      body="Review the versioned starting preset, edit it to match your CPD home, then confirm the source and date before the dashboard calculates progress. Any existing log entries remain stored while setup is incomplete."
      actions={
        <Link
          href={`/cme/setup?year=${year}`}
          className="inline-flex min-h-tap items-center justify-center rounded-lg bg-[color:var(--command)] px-5 text-sm font-semibold text-[color:var(--command-contrast)]"
        >
          Review requirements
        </Link>
      }
    />
  );
}
