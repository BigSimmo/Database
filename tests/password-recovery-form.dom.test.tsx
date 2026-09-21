/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getUser: vi.fn(), updateUser: vi.fn(), resetPasswordForEmail: vi.fn() }));
const auth = vi.hoisted(() => ({
  status: "signed_out",
  session: null as null | { user: { id: string; email?: string } },
  isConfigured: true,
  error: null as string | null,
}));
vi.mock("@/lib/supabase/client", () => ({ useAuthSession: () => ({ ...auth, client: { auth: api } }) }));

import { PasswordRecoveryForm } from "@/components/clinical-dashboard/password-recovery-form";

afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  auth.status = "signed_out";
  auth.session = null;
  auth.error = null;
  api.resetPasswordForEmail.mockResolvedValue({ error: null });
  api.updateUser.mockResolvedValue({ error: null });
  api.getUser.mockResolvedValue({ data: { user: { id: "owner-a" } }, error: null });
});

async function fillNewPassword() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/^New password/), "replacement-passphrase");
  await user.type(screen.getByLabelText(/Confirm new password/), "replacement-passphrase");
  await user.click(screen.getByRole("button", { name: "Update password" }));
}

describe("password recovery", () => {
  it("requests a PKCE recovery link without revealing account existence", async () => {
    auth.error = "stale callback error";
    const user = userEvent.setup();
    render(<PasswordRecoveryForm />);
    expect(screen.getByText(/sign-in link could not be completed/)).toBeVisible();
    await user.type(screen.getByLabelText(/Email address/), "person@example.com");
    await user.click(screen.getByRole("button", { name: "Send recovery link" }));
    expect(api.resetPasswordForEmail).toHaveBeenCalledWith("person@example.com", {
      redirectTo: `${window.location.origin}/auth/callback?next=%2Fauth%2Freset-password`,
    });
    expect(screen.getByText(/If an account exists/)).toBeVisible();
    expect(screen.queryByText(/sign-in link could not be completed/)).toBeNull();
    expect(api.updateUser).not.toHaveBeenCalled();
  });

  it.each([null, { id: "owner-b" }])("rejects an absent or different verified user: %s", async (user) => {
    auth.status = "authenticated";
    auth.session = { user: { id: "owner-a" } };
    api.getUser.mockResolvedValue({ data: { user }, error: null });
    render(<PasswordRecoveryForm />);
    await fillNewPassword();
    expect(api.updateUser).not.toHaveBeenCalled();
    expect(screen.getByText(/session could not be verified/)).toBeVisible();
  });

  it("updates only after checking the signed-in user", async () => {
    auth.status = "authenticated";
    auth.session = { user: { id: "owner-a" } };
    render(<PasswordRecoveryForm />);
    await fillNewPassword();
    expect(api.getUser).toHaveBeenCalledTimes(1);
    expect(api.updateUser).toHaveBeenCalledWith({ password: "replacement-passphrase" });
    expect(screen.getByText("Your password has been updated.")).toBeVisible();
    expect(screen.queryByLabelText(/^New password/)).toBeNull();
  });
});
