import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CmeTeachingPrompt } from "@/components/cme/cme-teaching-prompt";

afterEach(() => vi.unstubAllGlobals());

async function renderPrompt() {
  await act(async () => {
    render(<CmeTeachingPrompt />);
  });
}

describe("Teaching handoff on CPD Today", () => {
  it("links only a positive owner-scoped count to the Teaching weekly review", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 2 }) });
    vi.stubGlobal("fetch", fetchMock);

    await renderPrompt();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/teaching?view=unlogged-count",
      expect.objectContaining({ method: "GET", credentials: "same-origin", signal: expect.any(AbortSignal) }),
    );
    const prompt = screen.getByTestId("cme-teaching-prompt");
    expect(prompt).toHaveTextContent("Next to log: Teaching");
    expect(prompt).toHaveTextContent("2 teaching sessions to review in Teaching");
    expect(screen.getByRole("link", { name: "Review & log" })).toHaveAttribute("href", "/teaching/review");
  });

  it.each([
    { name: "missing endpoint", response: { ok: false, status: 404 } },
    { name: "server error", response: { ok: false, status: 500 } },
    { name: "zero", response: { ok: true, json: async () => ({ count: 0 }) } },
    { name: "negative", response: { ok: true, json: async () => ({ count: -1 }) } },
    { name: "fraction", response: { ok: true, json: async () => ({ count: 1.5 }) } },
    { name: "string", response: { ok: true, json: async () => ({ count: "2" }) } },
    { name: "invalid body", response: { ok: true, json: async () => ({ total: 2 }) } },
  ])("hides when the Teaching count is $name", async ({ response }) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await renderPrompt();
    expect(screen.queryByTestId("cme-teaching-prompt")).toBeNull();
  });

  it("hides on network failure", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
    await renderPrompt();
    expect(screen.queryByTestId("cme-teaching-prompt")).toBeNull();
  });
});
