/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authSession = vi.hoisted(() => ({
  status: "signed_out" as const,
  error: null,
  notice: null,
  isConfigured: true,
  signInWithEmail: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
  session: null,
}));

vi.mock("@/lib/supabase/client", () => ({
  AUTH_EMAIL_STORAGE_KEY: "clinical-kb-auth-email",
  useAuthSession: () => authSession,
}));

import { AuthPanel } from "@/components/clinical-dashboard/auth-panel";

describe("AuthPanel product truth", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("distinguishes account-synced data from browser-session recents", () => {
    render(<AuthPanel />);

    expect(screen.getByText(/Save favourites and clinical defaults across signed-in devices/i)).toBeVisible();
    expect(screen.getByText("Saved favourites")).toBeVisible();
    expect(screen.getByText("Local recents")).toBeVisible();
    expect(screen.getByText(/Recent searches stay in this browser session/i)).toBeVisible();
    expect(screen.queryByText("Source history")).toBeNull();
    expect(screen.queryByText("Saved sources")).toBeNull();
  });

  it("wires Apple alongside the other configured OAuth providers", async () => {
    const user = userEvent.setup();
    render(<AuthPanel />);

    const apple = screen.getByRole("button", { name: "Continue with Apple" });
    expect(apple).toBeEnabled();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Continue with Microsoft" })).toBeEnabled();
    expect(screen.queryByText(/Apple sign-in is unavailable/i)).toBeNull();

    await user.click(apple);
    expect(authSession.signInWithOAuth).toHaveBeenCalledWith("apple");
  });
});
