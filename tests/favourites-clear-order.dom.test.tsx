/** @vitest-environment jsdom */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AccountDataProvider, useAccountData } from "@/components/account-data-provider";

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

type MockResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<Record<string, unknown>>;
};

function deferredResponse() {
  let resolve!: (response: MockResponse) => void;
  const promise = new Promise<MockResponse>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

function Probe() {
  const { clearFavourites, isSaved, ready, setFavourite } = useAccountData();
  return (
    <div>
      <span data-testid="account-ready">{ready ? "ready" : "loading"}</span>
      <span data-testid="therapy-saved">{isSaved("therapy", "cbt") ? "saved" : "not saved"}</span>
      <button type="button" onClick={() => void setFavourite("therapy", "cbt", true)}>
        Save therapy
      </button>
      <button type="button" onClick={() => void clearFavourites()}>
        Clear favourites
      </button>
    </div>
  );
}

describe("favourites clear ordering", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    authSession.status = "authenticated";
    authSession.authEpoch += 1;
    authSession.markSessionExpired.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("waits for an earlier PUT before issuing clear-all DELETE", async () => {
    const put = deferredResponse();
    const methods: string[] = [];
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const method = (init?.method ?? "GET").toUpperCase();
      methods.push(method);
      if (method === "GET") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ favourites: [] }),
        });
      }
      if (method === "PUT") return put.promise;
      if (method === "DELETE") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({}),
        });
      }
      throw new Error(`Unexpected fetch method: ${method}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AccountDataProvider>
        <Probe />
      </AccountDataProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("account-ready")).toHaveTextContent("ready"));
    fireEvent.click(screen.getByRole("button", { name: "Save therapy" }));
    await waitFor(() => expect(methods).toEqual(["GET", "PUT"]));

    fireEvent.click(screen.getByRole("button", { name: "Clear favourites" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(methods).toEqual(["GET", "PUT"]);

    await act(async () => {
      put.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    await waitFor(() => expect(methods).toEqual(["GET", "PUT", "DELETE"]));
    await waitFor(() => expect(screen.getByTestId("therapy-saved")).toHaveTextContent("not saved"));
  });

  it("rolls a post-clear failed save back to the empty server state", async () => {
    const clear = deferredResponse();
    const put = deferredResponse();
    const methods: string[] = [];
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const method = (init?.method ?? "GET").toUpperCase();
      methods.push(method);
      if (method === "GET") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ favourites: [{ contentType: "therapy", contentKey: "cbt" }] }),
        });
      }
      if (method === "DELETE") return clear.promise;
      if (method === "PUT") return put.promise;
      throw new Error(`Unexpected fetch method: ${method}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AccountDataProvider>
        <Probe />
      </AccountDataProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("therapy-saved")).toHaveTextContent("saved"));
    fireEvent.click(screen.getByRole("button", { name: "Clear favourites" }));
    await waitFor(() => expect(methods).toEqual(["GET", "DELETE"]));

    fireEvent.click(screen.getByRole("button", { name: "Save therapy" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(methods).toEqual(["GET", "DELETE"]);

    await act(async () => {
      clear.resolve({ ok: true, status: 200, json: async () => ({}) });
    });
    await waitFor(() => expect(methods).toEqual(["GET", "DELETE", "PUT"]));

    await act(async () => {
      put.resolve({
        ok: false,
        status: 503,
        json: async () => ({ message: "Saved items could not be updated." }),
      });
    });
    await waitFor(() => expect(screen.getByTestId("therapy-saved")).toHaveTextContent("not saved"));
  });
});
