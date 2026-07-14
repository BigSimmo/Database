import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { copyText, useClipboard } from "@/components/therapy-compass/use-clipboard";

// The clipboard helper must only report success when the browser actually
// accepts the write. A rejected `writeText` (permission denied, lost focus,
// blocked gesture) must resolve to `false` without throwing, so callers never
// flip to "Copied" for a copy that didn't happen.

const originalClipboard = Object.getOwnPropertyDescriptor(globalThis.navigator, "clipboard");

function setWriteText(writeText: ((text: string) => Promise<void>) | null) {
  Object.defineProperty(globalThis.navigator, "clipboard", {
    value: writeText ? { writeText } : undefined,
    configurable: true,
    writable: true,
  });
}

// Let the two-microtask copyText().then() chain settle inside act().
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  if (originalClipboard) {
    Object.defineProperty(globalThis.navigator, "clipboard", originalClipboard);
  } else {
    setWriteText(null);
  }
});

describe("copyText", () => {
  it("resolves true and writes when the clipboard accepts the text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setWriteText(writeText);
    await expect(copyText("hello")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("resolves false — never throws — when the write rejects", async () => {
    setWriteText(vi.fn().mockRejectedValue(new Error("NotAllowedError")));
    await expect(copyText("hello")).resolves.toBe(false);
  });

  it("resolves false for empty text without touching the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setWriteText(writeText);
    await expect(copyText("")).resolves.toBe(false);
    expect(writeText).not.toHaveBeenCalled();
  });
});

describe("useClipboard", () => {
  it("sets copied to the key only after a successful write", async () => {
    setWriteText(vi.fn().mockResolvedValue(undefined));
    const { result } = renderHook(() => useClipboard());
    expect(result.current.copied).toBeNull();
    act(() => result.current.copy("hello", "step-1"));
    await settle();
    expect(result.current.copied).toBe("step-1");
  });

  it("leaves copied unset when the write rejects", async () => {
    setWriteText(vi.fn().mockRejectedValue(new Error("NotAllowedError")));
    const { result } = renderHook(() => useClipboard());
    act(() => result.current.copy("hello", "step-1"));
    await settle();
    expect(result.current.copied).toBeNull();
  });
});
