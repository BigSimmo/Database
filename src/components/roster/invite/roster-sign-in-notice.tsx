"use client";

import { LogIn } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { AccountSetupDialog } from "@/components/clinical-dashboard/account-setup-dialog";
import { ModeNotice } from "@/components/mode-kit/notice";
import { Button } from "@/components/ui/button";
import { useAuthSession } from "@/lib/supabase/client";

/** The session when an `AuthProvider` is mounted; null in a bare render (unit tests). */
function useAuthSessionIfAvailable() {
  try {
    return useAuthSession();
  } catch (error) {
    if (error instanceof Error && error.message === "useAuthSession must be used within AuthProvider.") return null;
    throw error;
  }
}

function reloadPage() {
  window.location.reload();
}

/**
 * A signed-out Roster screen: the reason in one line, and the way in. The app
 * has no sign-in page; "Sign in" opens the same account dialog On Call and
 * Teaching use, so the reader never has to go looking for it.
 *
 * The Roster reads (shifts, teams, settings, swaps) fetch once on mount and
 * keep their signed-out answer, so a sign-in started here reloads the page
 * once the session turns authenticated; otherwise the screen would stay on
 * this notice until the reader reloaded it themselves.
 */
export function RosterSignInNotice({
  children,
  testId,
  onSignedIn = reloadPage,
}: {
  readonly children: ReactNode;
  readonly testId?: string;
  /** Runs once when a sign-in started from this notice succeeds. */
  readonly onSignedIn?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [askedWhileSignedOut, setAskedWhileSignedOut] = useState(false);
  const signedIn = useAuthSessionIfAvailable()?.status === "authenticated";
  useEffect(() => {
    if (askedWhileSignedOut && signedIn) onSignedIn();
  }, [askedWhileSignedOut, signedIn, onSignedIn]);
  return (
    <div className="grid gap-2" data-testid={testId}>
      <ModeNotice>{children}</ModeNotice>
      <Button
        variant="primary"
        icon={LogIn}
        onClick={() => {
          setOpen(true);
          if (!signedIn) setAskedWhileSignedOut(true);
        }}
        className="justify-self-start"
      >
        Sign in
      </Button>
      {/* Mounted only once asked for, so a signed-out screen needs nothing from the session until then. */}
      {open ? <AccountSetupDialog open onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
