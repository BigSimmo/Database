import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDocumentViewDensity } from "@/components/document-viewer/use-document-view-density";

describe("useDocumentViewDensity", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to condensed view and restores the locally saved choice", async () => {
    const first = renderHook(() => useDocumentViewDensity());
    expect(first.result.current[0]).toBe(true);

    act(() => first.result.current[1](false));
    expect(first.result.current[0]).toBe(false);
    expect(window.localStorage.getItem("clinical-kb:document-view-density")).toBe("full");
    first.unmount();

    const restored = renderHook(() => useDocumentViewDensity());
    await waitFor(() => expect(restored.result.current[0]).toBe(false));
  });

  it("keeps the toggle usable when localStorage persistence fails", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    const hook = renderHook(() => useDocumentViewDensity());
    expect(hook.result.current[0]).toBe(true);

    act(() => hook.result.current[1](false));
    expect(hook.result.current[0]).toBe(false);

    act(() => hook.result.current[1](true));
    expect(hook.result.current[0]).toBe(true);

    setItem.mockRestore();
  });
});
