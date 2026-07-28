/** @vitest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AccountDataProvider } from "@/components/account-data-provider";
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

describe("favourites account retry", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
});
