"use client";

import { LogIn } from "lucide-react";
import { useState, type ReactNode } from "react";

import { AccountSetupDialog } from "@/components/clinical-dashboard/account-setup-dialog";
import { ModeNotice } from "@/components/mode-kit/notice";
import { Button } from "@/components/ui/button";

/**
 * A signed-out Roster screen: the reason in one line, and the way in. The app
 * has no sign-in page; "Sign in" opens the same account dialog On Call and
 * Teaching use, so the reader never has to go looking for it.
 */
export function RosterSignInNotice({ children, testId }: { readonly children: ReactNode; readonly testId?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="grid gap-2" data-testid={testId}>
      <ModeNotice>{children}</ModeNotice>
      <Button variant="primary" icon={LogIn} onClick={() => setOpen(true)} className="justify-self-start">
        Sign in
      </Button>
      {/* Mounted only once asked for, so a signed-out screen needs nothing from the session until then. */}
      {open ? <AccountSetupDialog open onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
