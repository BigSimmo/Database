/** @vitest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AccountDataProvider, useAccountData } from "@/components/account-data-provider";
import { useSavedRegistryFavourites } from "@/components/clinical-dashboard/use-saved-registry-favourites";

const authSession = vi.hoisted(() => ({
  status: "authenticated" as string,
  authEpoch: 1,
  authorizationHeader: { Authorization: "Bearer test-token" } as Record<string, string>,
  session: { user: { email: "clinician@clinic.example" } },
  isConfigured: true,
  error: null as string | null,
  signInWithEmail: vi.fn(),
  signOut: vi.fn(),
  markSessionExpired: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  useAuthSession: () => authSession,
}));

// The registries are not under test here: an account failure clears every saved
// slug, so both are disabled and the account request is the only recoverable
// part. Stubbing them keeps the assertion on the account path alone.
vi.mock("@/lib/use-registry-records", () => ({
  useRegistryRecords: () => ({ records: [], status: "ready", refetch: () => undefined }),
}));

function Probe() {
  const { items, status, refetch } = useSavedRegistryFavourites();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="count">{items.length}</span>
      <button type="button" onClick={refetch}>
        Retry
      </button>
    </div>
  );
}

function FirstSaveProbe() {
  const { items, status } = useSavedRegistryFavourites();
  const { setFavourite, error, loadError } = useAccountData();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="count">{items.length}</span>
      <span data-testid="load-error">{loadError ?? ""}</span>
      <span data-testid="action-error">{error ?? ""}</span>
      <button
        type="button"
        onClick={() => {
          void setFavourite("differential", "delirium", true);
        }}
      >
        Save
      </button>
    </div>
  );
}

describe("favourites account retry", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Hoisted vi.fn()s keep their call history across restoreAllMocks, so the
    // "not called" assertion below would inherit an earlier test's call.
    authSession.markSessionExpired.mockClear();
    authSession.status = "authenticated";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("recovers after the account request fails once and succeeds on Retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "Saved items could not be loaded." }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ favourites: [{ contentType: "differential", contentKey: "delirium" }] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AccountDataProvider>
        <Probe />
      </AccountDataProvider>,
    );

    // The failed load faults the band and leaves nothing saved to re-request.
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));
    expect(screen.getByTestId("count")).toHaveTextContent("0");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    // Retry must reissue the account request itself — without that the button
    // invokes two disabled registry refetches and the page stays faulted.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    expect(screen.getByTestId("count")).toHaveTextContent("1");
  });

  it("marks the session expired when the account load is rejected as 401", async () => {
    // Retry re-sends the same authorization header, so a rejected token can
    // never be recovered by retrying. The load path has to change the auth
    // state and route the reader to sign in, as the mutation paths already do.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: "Session expired." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AccountDataProvider>
        <Probe />
      </AccountDataProvider>,
    );

    await waitFor(() => expect(authSession.markSessionExpired).toHaveBeenCalled());
  });

  it("does not mark the session expired for a non-auth load failure", async () => {
    // A 503 is exactly what Retry is for; flipping the session on it would send
    // a signed-in reader to a sign-in screen over a transient server fault.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ message: "Saved items could not be loaded." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AccountDataProvider>
        <Probe />
      </AccountDataProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));
    expect(authSession.markSessionExpired).not.toHaveBeenCalled();
  });

  it("keeps a successfully loaded empty library ready after a failed first save", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const method = (init?.method ?? "GET").toUpperCase();
      if (method === "GET") {
        return {
          ok: true,
          json: async () => ({ favourites: [] }),
        };
      }
      if (method === "PUT") {
        return {
          ok: false,
          status: 503,
          json: async () => ({ message: "Saved items could not be updated." }),
        };
      }
      throw new Error(`Unexpected fetch method: ${method}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AccountDataProvider>
        <FirstSaveProbe />
      </AccountDataProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    expect(screen.getByTestId("count")).toHaveTextContent("0");

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByTestId("action-error")).toHaveTextContent("could not be updated"));
    expect(screen.getByTestId("load-error")).toHaveTextContent("");
    expect(screen.getByTestId("status")).toHaveTextContent("ready");
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });
});
