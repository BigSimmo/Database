/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useRosterSettings } from "@/components/roster/use-roster-settings";

describe("useRosterSettings writes", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends overlapping updates one at a time so an older reply cannot overwrite a newer one", async () => {
    let releaseFirst: (response: Response) => void = () => undefined;
    const puts: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (!init?.method) return new Response(JSON.stringify({}), { status: 200 });
        puts.push(String(init.body));
        if (puts.length === 1) return new Promise<Response>((resolve) => (releaseFirst = resolve));
        return new Response(JSON.stringify({ rowName: "Second" }), { status: 200 });
      }),
    );
    const { result } = renderHook(() => useRosterSettings());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    let first!: Promise<string | null>;
    let second!: Promise<string | null>;
    act(() => {
      first = result.current.update({ rowName: "First" });
      second = result.current.update({ rowName: "Second" });
    });
    await waitFor(() => expect(puts).toHaveLength(1));
    await act(async () => {
      releaseFirst(new Response(JSON.stringify({ rowName: "First" }), { status: 200 }));
      await first;
      await second;
    });
    expect(puts).toHaveLength(2);
    expect(result.current.settings.rowName).toBe("Second");
  });
});
