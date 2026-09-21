/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getUser: vi.fn(),
  updateUser: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
}));
const auth = vi.hoisted(() => ({
  status: "signed_out",
  session: null as null | { user: { id: string; email?: string } },
  isConfigured: true,
  error: null as string | null,
}));
vi.mock("@/lib/supabase/client", () => ({ useAuthSession: () => ({ ...auth, client: { auth: api } }) }));

import { PasswordRecoveryForm } from "@/components/clinical-dashboard/password-recovery-form";
import {
  PASSWORD_RECOVERY_COOKIE,
  PASSWORD_RECOVERY_STORAGE_KEY,
} from "@/lib/supabase/password-recovery-authorization";

afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  api.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  auth.status = "signed_out";
  auth.session = null;
  auth.error = null;
  api.resetPasswordForEmail.mockResolvedValue({ error: null });
  api.updateUser.mockResolvedValue({ error: null });
  api.getUser.mockResolvedValue({ data: { user: { id: "owner-a" } }, error: null });
  document.cookie = `${PASSWORD_RECOVERY_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  sessionStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
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

  it("refuses credential changes for a plain signed-in session without recovery proof", async () => {
    auth.status = "authenticated";
    auth.session = { user: { id: "owner-a", email: "owner@example.com" } };
    const user = userEvent.setup();
    render(<PasswordRecoveryForm />);
    expect(screen.queryByLabelText(/^New password/)).toBeNull();
    expect(screen.getByText(/only changes a password after you open a recovery link/)).toBeVisible();
    await user.type(screen.getByLabelText(/Email address/), "owner@example.com");
    await user.click(screen.getByRole("button", { name: "Send recovery link" }));
    expect(api.updateUser).not.toHaveBeenCalled();
    expect(api.getUser).not.toHaveBeenCalled();
    expect(api.resetPasswordForEmail).toHaveBeenCalled();
  });

  it.each([null, { id: "owner-b" }])("rejects an absent or different verified user: %s", async (user) => {
    auth.status = "authenticated";
    auth.session = { user: { id: "owner-a" } };
    document.cookie = `${PASSWORD_RECOVERY_COOKIE}=1; Path=/; SameSite=Lax`;
    api.getUser.mockResolvedValue({ data: { user }, error: null });
    render(<PasswordRecoveryForm />);
    await fillNewPassword();
    expect(api.updateUser).not.toHaveBeenCalled();
    expect(screen.getByText(/session could not be verified/)).toBeVisible();
  });

  it("updates only after recovery authorization and checking the signed-in user", async () => {
    auth.status = "authenticated";
    auth.session = { user: { id: "owner-a" } };
    document.cookie = `${PASSWORD_RECOVERY_COOKIE}=1; Path=/; SameSite=Lax`;
    render(<PasswordRecoveryForm />);
    await fillNewPassword();
    expect(api.getUser).toHaveBeenCalledTimes(1);
    expect(api.updateUser).toHaveBeenCalledWith({ password: "replacement-passphrase" });
    expect(screen.getByText("Your password has been updated.")).toBeVisible();
    expect(screen.queryByLabelText(/^New password/)).toBeNull();
    expect(sessionStorage.getItem(PASSWORD_RECOVERY_STORAGE_KEY)).toBeNull();
  });

  it("treats a PASSWORD_RECOVERY auth event as recovery authorization", async () => {
    auth.status = "authenticated";
    auth.session = { user: { id: "owner-a" } };
    let listener: ((event: string) => void) | undefined;
    api.onAuthStateChange.mockImplementation((cb: (event: string) => void) => {
      listener = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    render(<PasswordRecoveryForm />);
    expect(screen.queryByLabelText(/^New password/)).toBeNull();
    listener?.("PASSWORD_RECOVERY");
    expect(await screen.findByLabelText(/^New password/)).toBeVisible();
    await fillNewPassword();
    expect(api.updateUser).toHaveBeenCalledWith({ password: "replacement-passphrase" });
  });
});
