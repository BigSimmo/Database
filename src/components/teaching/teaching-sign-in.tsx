"use client";

import { useState } from "react";

import { AccountSetupDialog } from "@/components/clinical-dashboard/account-setup-dialog";
import { TeachingStateNotice } from "@/components/teaching/teaching-states";

/** The signed-out module: Sign in opens the app's own sign-in dialog; the demo waits for "Open the demo". */
export function TeachingSignInNotice({ onOpenDemo }: { onOpenDemo?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TeachingStateNotice state="signed-out" onSignIn={() => setOpen(true)} onOpenDemo={onOpenDemo} />
      <AccountSetupDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
