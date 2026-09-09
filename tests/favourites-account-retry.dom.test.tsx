/** @vitest-environment jsdom */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const testTimestamp = "2026-08-23T00:00:00.000Z";
function snapshot(favourites: Array<{ contentType: string; contentKey: string }> = []) {
  return {
    version: 1,
    favourites: favourites.map((item, index) => ({
      ...item,
      createdAt: testTimestamp,
      setId: null,
      sortOrder: (index + 1) * 10,
      pinnedAt: null,
      lastOpenedAt: null,
    })),
    sets: [],
  };
}

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

function RapidToggleProbe() {
  const { isSaved, ready, setFavourite } = useAccountData();
  return (
    <div>
      <span data-testid="account-ready">{ready ? "ready" : "loading"}</span>
      <span data-testid="therapy-saved">{isSaved("therapy", "cbt") ? "saved" : "not saved"}</span>
      <button type="button" onClick={() => void setFavourite("therapy", "cbt", true)}>
        Save therapy
      </button>
      <button type="button" onClick={() => void setFavourite("therapy", "cbt", false)}>
        Remove therapy
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
      .mockResolvedValueOnce(Response.json({ message: "Saved items could not be loaded." }, { status: 503 }))
      .mockResolvedValue({
        ok: true,
        json: async () => snapshot([{ contentType: "differential", contentKey: "delirium" }]),
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
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ message: "Session expired." }, { status: 401 }));
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
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ message: "Saved items could not be loaded." }, { status: 503 }));
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
          json: async () => snapshot(),
        };
      }
      if (method === "PUT") {
        return Response.json({ message: "Saved items could not be updated." }, { status: 503 });
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

  it("rolls back an optimistic save when a 2xx response violates the shared contract", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const method = (init?.method ?? "GET").toUpperCase();
      if (method === "GET") return { ok: true, status: 200, json: async () => snapshot() };
      if (method === "PUT") return { ok: true, status: 200, json: async () => ({ saved: true }) };
      throw new Error(`Unexpected fetch method: ${method}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AccountDataProvider>
        <FirstSaveProbe />
      </AccountDataProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByTestId("action-error")).toHaveTextContent("response was invalid"));
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });

  it("serializes opposite writes and leaves the final requested state persisted", async () => {
    type PutResponse = {
      ok: boolean;
      status: number;
      json: () => Promise<Record<string, unknown>>;
    };
    const pendingPuts: Array<{
      body: { contentType: string; contentKey: string; saved: boolean };
      resolve: (response: PutResponse) => void;
    }> = [];
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const method = (init?.method ?? "GET").toUpperCase();
      if (method === "GET") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => snapshot(),
        });
      }
      if (method === "PUT") {
        return new Promise<PutResponse>((resolve) => {
          pendingPuts.push({
            body: JSON.parse(String(init?.body)) as { contentType: string; contentKey: string; saved: boolean },
            resolve,
          });
        });
      }
      throw new Error(`Unexpected fetch method: ${method}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AccountDataProvider>
        <RapidToggleProbe />
      </AccountDataProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("account-ready")).toHaveTextContent("ready"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Save therapy" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove therapy" }));

    expect(screen.getByTestId("therapy-saved")).toHaveTextContent("not saved");
    await waitFor(() => expect(pendingPuts).toHaveLength(1));
    expect(pendingPuts[0]?.body.saved).toBe(true);

    await act(async () =>
      pendingPuts[0]?.resolve({ ok: true, status: 200, json: async () => ({ version: 1, saved: true }) }),
    );
    await waitFor(() => expect(pendingPuts).toHaveLength(2));
    expect(pendingPuts[1]?.body.saved).toBe(false);

    await act(async () =>
      pendingPuts[1]?.resolve({ ok: true, status: 200, json: async () => ({ version: 1, saved: false }) }),
    );
    await waitFor(() => expect(screen.getByTestId("therapy-saved")).toHaveTextContent("not saved"));
  });
});
