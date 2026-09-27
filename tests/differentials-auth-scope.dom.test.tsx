/** @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ identity: "owner-a", epoch: 1, headers: { authorization: "Bearer owner-a" } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/supabase/client", () => ({
  useAuthSession: () => ({
    authorizationHeader: auth.headers,
    authEpoch: auth.epoch,
    session: { user: { id: auth.identity } },
  }),
}));
vi.mock("@/components/clinical-dashboard/differentials-home", () => ({
  DifferentialsHome: ({
    documentMatches,
    evidenceQuery,
    onRunSearch,
  }: {
    documentMatches: unknown[];
    evidenceQuery: string | null;
    onRunSearch: (query: string) => void;
  }) => (
    <div>
      <div data-testid="evidence">{`${evidenceQuery ?? "none"}:${documentMatches.length}`}</div>
      <button onClick={() => onRunSearch("depression")}>Check sources</button>
    </div>
  ),
}));
vi.mock("@/components/mode-home-template", () => ({
  ModeHomeMain: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

import { DifferentialsHomePage } from "@/components/differentials/differentials-home-page";

afterEach(() => {
  vi.unstubAllGlobals();
  auth.identity = "owner-a";
  auth.epoch = 1;
  auth.headers = { authorization: "Bearer owner-a" };
});

it("hides the prior owner's source evidence on the identity-changing render", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ documentMatches: [{ id: "private-owner-a" }] }),
  });
  vi.stubGlobal("fetch", fetchMock);
  const page = render(<DifferentialsHomePage query="depression" autoRunSearch />);
  await waitFor(() => expect(screen.getByTestId("evidence")).toHaveTextContent("depression:1"));

  auth.identity = "owner-b";
  auth.epoch = 2;
  auth.headers = { authorization: "Bearer owner-b" };
  page.rerender(<DifferentialsHomePage query="depression" autoRunSearch />);
  expect(screen.getByTestId("evidence")).toHaveTextContent("none:0");
});

it("aborts a same-query source request when the page unmounts", async () => {
  const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
    () => new Promise<Response>(() => undefined),
  );
  vi.stubGlobal("fetch", fetchMock);
  const page = render(<DifferentialsHomePage query="depression" autoRunSearch />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: "Check sources" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  const sourceSignal = fetchMock.mock.calls[1][1]?.signal as AbortSignal;
  expect(sourceSignal.aborted).toBe(false);
  page.unmount();
  expect(sourceSignal.aborted).toBe(true);
});
