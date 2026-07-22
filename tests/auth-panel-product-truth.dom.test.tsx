/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
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

  it("disables Apple while leaving configured OAuth providers available", () => {
    render(<AuthPanel />);

    const apple = screen.getByRole("button", { name: "Apple sign-in unavailable" });
    expect(apple).toBeDisabled();
    expect(apple).toHaveAttribute("title", "Apple sign-in is unavailable. Continue with email, Google, or Microsoft.");
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Continue with Microsoft" })).toBeEnabled();
  });
});
