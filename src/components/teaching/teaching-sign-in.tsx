"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

import { AccountSetupDialog } from "@/components/clinical-dashboard/account-setup-dialog";
import { TeachingStateNotice } from "@/components/teaching/teaching-states";
import { teachingSampleEntryHref } from "@/lib/teaching/sample-paths";

/*
 * The signed-out module: Sign in opens the app's own sign-in dialog; "Open the
 * demo" enters the Teaching sample, which stays on across every Teaching page
 * and returns the reader to the page they were on.
 */
export function TeachingSignInNotice() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return (
    <>
      <TeachingStateNotice
        state="signed-out"
        onSignIn={() => setOpen(true)}
        demoHref={teachingSampleEntryHref(pathname)}
      />
      <AccountSetupDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
