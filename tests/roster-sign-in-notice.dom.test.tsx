import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ status: "signed_out" as string }));

vi.mock("@/lib/supabase/client", () => ({
  useAuthSession: () => ({ status: auth.status }),
}));
vi.mock("@/components/clinical-dashboard/account-setup-dialog", () => ({
  AccountSetupDialog: () => <div role="dialog" aria-label="Continue to your workspace" />,
}));

import { RosterSignInNotice } from "@/components/roster/invite/roster-sign-in-notice";

afterEach(() => {
  cleanup();
  auth.status = "signed_out";
});

describe("RosterSignInNotice", () => {
  it("refreshes the Roster reads once a sign-in started here succeeds", () => {
    const onSignedIn = vi.fn();
    const view = render(<RosterSignInNotice onSignedIn={onSignedIn}>Sign in to see your roster.</RosterSignInNotice>);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onSignedIn).not.toHaveBeenCalled();
    auth.status = "authenticated";
    view.rerender(<RosterSignInNotice onSignedIn={onSignedIn}>Sign in to see your roster.</RosterSignInNotice>);
    expect(onSignedIn).toHaveBeenCalledTimes(1);
  });

  it("does not refresh for a session that was already signed in, or before Sign in is chosen", () => {
    const onSignedIn = vi.fn();
    auth.status = "authenticated";
    render(<RosterSignInNotice onSignedIn={onSignedIn}>Sign in to see your roster.</RosterSignInNotice>);
    expect(onSignedIn).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(onSignedIn).not.toHaveBeenCalled();
  });
});
