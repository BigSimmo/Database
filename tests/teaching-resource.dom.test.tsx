/** @vitest-environment jsdom */

import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => import("./helpers/teaching-auth"));

import { useTeachingResource } from "@/components/teaching/use-teaching-resource";

import { authState } from "./helpers/teaching-auth";
import { apiError, json, serveFetch, useTeachingTestClock } from "./helpers/teaching-fixtures";

// Shared fixture setup, not a component hook; see teaching-modules.dom.test.tsx.
// eslint-disable-next-line react-hooks/rules-of-hooks
useTeachingTestClock();

function Probe({ url }: { url: string | null }) {
  const resource = useTeachingResource<{ count: number }>(url);
  return (
    <div>
      <span data-testid="status">{resource.status}</span>
      <span data-testid="count">{resource.data?.count ?? ""}</span>
      <span data-testid="refreshing">{String(resource.refreshing)}</span>
      <button type="button" onClick={resource.retry}>
        retry
      </button>
    </div>
  );
}

describe("useTeachingResource", () => {
  it("stays idle without a URL, and waits for the session before fetching", () => {
    const fetchMock = serveFetch(() => json(200, { count: 1 }));
    const { rerender } = render(<Probe url={null} />);
    expect(screen.getByTestId("status")).toHaveTextContent("idle");
    authState.status = "loading";
    rerender(<Probe url="/x" />);
    expect(screen.getByTestId("status")).toHaveTextContent("loading");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads, then fetches again on retry", async () => {
    let count = 0;
    serveFetch(() => json(200, { count: ++count }));
    render(<Probe url="/x" />);
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
    act(() => screen.getByRole("button", { name: "retry" }).click());
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("2"));
  });

  it("keeps the last data on screen while a retry of the same read is in flight", async () => {
    let release: (() => void) | null = null;
    let count = 0;
    serveFetch(() => {
      count += 1;
      if (count === 1) return json(200, { count: 1 });
      return new Promise<Response>((resolve) => {
        release = () => resolve(json(200, { count: 2 }));
      });
    });
    render(<Probe url="/x" />);
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
    act(() => screen.getByRole("button", { name: "retry" }).click());
    expect(screen.getByTestId("status")).toHaveTextContent("ready");
    expect(screen.getByTestId("count")).toHaveTextContent("1");
    expect(screen.getByTestId("refreshing")).toHaveTextContent("true");
    await act(async () => release?.());
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("2"));
    expect(screen.getByTestId("refreshing")).toHaveTextContent("false");
  });

  it("never carries data across to another URL or account", async () => {
    serveFetch((url) => (url === "/x" ? json(200, { count: 1 }) : new Promise<Response>(() => {})));
    const { rerender } = render(<Probe url="/x" />);
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
    rerender(<Probe url="/y" />);
    expect(screen.getByTestId("status")).toHaveTextContent("loading");
    expect(screen.getByTestId("count")).toHaveTextContent("");
  });

  it("drops the last data when the account changes, even for the same URL", async () => {
    let count = 0;
    serveFetch(() => (++count === 1 ? json(200, { count: 1 }) : new Promise<Response>(() => {})));
    const { rerender } = render(<Probe url="/x" />);
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
    authState.authEpoch = 2;
    rerender(<Probe url="/x" />);
    expect(screen.getByTestId("status")).toHaveTextContent("loading");
    expect(screen.getByTestId("count")).toHaveTextContent("");
  });

  it("reports signed out on 401 and set-up on teaching_setup_pending", async () => {
    serveFetch((url) => (url === "/a" ? json(401, {}) : apiError(503, "teaching_setup_pending")));
    const { unmount } = render(<Probe url="/a" />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("signed-out"));
    unmount();
    render(<Probe url="/b" />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("setup"));
  });

  it("reports offline when the browser says so", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    render(<Probe url="/c" />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("offline"));
  });
});
