"use client";

import type { LucideIcon } from "lucide-react";
import { useState } from "react";

import { AccountSetupDialog } from "@/components/clinical-dashboard/account-setup-dialog";
import { EmptyState } from "@/components/primitive-recipes/feedback";
import { Button } from "@/components/ui/button";

export interface OnCallSignedOutProps {
  icon: LucideIcon;
  testId: string;
}

/**
 * What a signed-out reader sees in place of an On Call list.
 *
 * Shared entries are readable by signed-in users only (owner decision,
 * 2026-09-26), so the server answers a signed-out caller with an empty list.
 * Drawn as that section's ordinary empty state, it read as though the hub had
 * been wiped; this says why it is empty and offers the way in.
 */
export function OnCallSignedOut({ icon, testId }: OnCallSignedOutProps) {
  const [signInOpen, setSignInOpen] = useState(false);
  return (
    <>
      <EmptyState
        icon={icon}
        title="Sign in to see your hospital's On Call numbers"
        body="On Call entries are shared with signed-in users only."
        actions={
          <Button variant="primary" onClick={() => setSignInOpen(true)}>
            Sign in
          </Button>
        }
        testId={testId}
      />
      <AccountSetupDialog open={signInOpen} onClose={() => setSignInOpen(false)} />
    </>
  );
}
