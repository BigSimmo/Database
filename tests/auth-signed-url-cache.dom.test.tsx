/** @vitest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authApi = vi.hoisted(() => {
  const listeners = new Set<(event: string, session: unknown) => void>();
  const session = {
    access_token: "user-a-token",
    refresh_token: "refresh",
    expires_in: 3600,
    token_type: "bearer",
    user: { id: "user-a" },
  };
  return {
    listeners,
    session,
    signOut: vi.fn(async () => {
      for (const listener of listeners) listener("SIGNED_OUT", null);
      return { error: null };
    }),
    getUser: vi.fn(async () => ({ data: { user: session.user }, error: null })),
    getSession: vi.fn(async () => ({ data: { session }, error: null })),
    onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
      listeners.add(cb);
      return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
    }),
  };
});

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: () => ({
    auth: {
      getUser: authApi.getUser,
      getSession: authApi.getSession,
      signOut: authApi.signOut,
      onAuthStateChange: authApi.onAuthStateChange,
      signInWithOtp: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
    },
  }),
}));

import { useSignedImageUrl } from "@/components/clinical-dashboard/use-signed-image-url";
import { clearSignedUrlCache, getCachedSignedUrl, setCachedSignedUrl } from "@/lib/signed-url-cache";
import { AuthProvider, useAuthSession } from "@/lib/supabase/client";

const ENDPOINT = "/api/images/privacy-repro/signed-url";
const PRIVATE_URL = "https://example.supabase.co/storage/v1/object/sign/private.png?token=user-a";

function AuthActions() {
  const { status, signOut, markSessionExpired } = useAuthSession();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <button type="button" onClick={() => void signOut()}>
        Sign out
      </button>
      <button type="button" onClick={() => markSessionExpired()}>
        Expire session
      </button>
    </div>
  );
}

function SignedImageProbe({ enabled }: { enabled: boolean }) {
  const { url } = useSignedImageUrl(ENDPOINT, enabled);
  return <span data-testid="signed-url">{url ?? ""}</span>;
}

describe("auth lifecycle clears signed URL cache", () => {
  beforeEach(() => {
    clearSignedUrlCache();
    authApi.listeners.clear();
    authApi.signOut.mockClear();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://sjrfecxgysukkwxsowpy.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_privacy_repro_key_123456");
    vi.stubEnv("SUPABASE_PROJECT_REF", "sjrfecxgysukkwxsowpy");
    vi.stubEnv("SUPABASE_PROJECT_NAME", "Clinical KB Database");
  });

  afterEach(() => {
    clearSignedUrlCache();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("signOut drops cached private signed URLs so the next mount refetches", async () => {
    setCachedSignedUrl(ENDPOINT, {
      url: PRIVATE_URL,
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
    expect(getCachedSignedUrl(ENDPOINT)?.url).toBe(PRIVATE_URL);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ url: "/demo-documents/refetched.png" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <AuthProvider>
        <AuthActions />
        <SignedImageProbe enabled />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    // Cache hit: private URL paints without fetch.
    await waitFor(() => expect(screen.getByTestId("signed-url")).toHaveTextContent(PRIVATE_URL));
    expect(fetchMock).not.toHaveBeenCalled();

    // Pause the probe before signOut so an auth-header effect cannot race the
    // clear by refetching and re-seeding the module cache under test.
    rerender(
      <AuthProvider>
        <AuthActions />
        <SignedImageProbe enabled={false} />
      </AuthProvider>,
    );

    screen.getByRole("button", { name: "Sign out" }).click();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("signed_out"));
    expect(getCachedSignedUrl(ENDPOINT)).toBeNull();

    // Re-enable after identity change — must refetch, not reuse user-a URL.
    rerender(
      <AuthProvider>
        <AuthActions />
        <SignedImageProbe enabled />
      </AuthProvider>,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId("signed-url")).toHaveTextContent("/demo-documents/refetched.png"));
    expect(screen.getByTestId("signed-url")).not.toHaveTextContent(PRIVATE_URL);
  });

  it("markSessionExpired clears the signed URL module cache", async () => {
    setCachedSignedUrl(ENDPOINT, {
      url: PRIVATE_URL,
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    });

    render(
      <AuthProvider>
        <AuthActions />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    screen.getByRole("button", { name: "Expire session" }).click();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("expired"));
    expect(getCachedSignedUrl(ENDPOINT)).toBeNull();
  });
});
