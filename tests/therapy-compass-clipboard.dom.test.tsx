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

describe("copyText record safety", () => {
  // The Therapy corpus carries 1,956 arrows across body/patientExplanation/
  // deliverySteps/briefVersion. Copy is the boundary where that text stops being
  // a web page and becomes note content, so it is sanitised here rather than by
  // rewriting the reviewed source records.
  it("spells out arrows and typographic characters before writing", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setWriteText(writeText);

    await copyText(
      "Build engagement \u2192 set goals \u2192 review; \u2265 4 sessions \u2014 \u201Cas tolerated\u201D",
    );

    expect(writeText).toHaveBeenCalledWith(
      'Build engagement leading to set goals leading to review, at least 4 sessions - "as tolerated"',
    );
  });

  it("leaves plain clinical text unchanged", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setWriteText(writeText);

    await copyText("Behavioural activation, then graded exposure");

    expect(writeText).toHaveBeenCalledWith("Behavioural activation, then graded exposure");
  });
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

  it("ignores a stale out-of-order completion and keeps the most recent copy's key", async () => {
    const resolvers: Array<() => void> = [];
    setWriteText(vi.fn().mockImplementation(() => new Promise<void>((resolve) => resolvers.push(resolve))));
    const { result } = renderHook(() => useClipboard());

    act(() => result.current.copy("first", "k-first"));
    act(() => result.current.copy("second", "k-second"));
    expect(resolvers).toHaveLength(2);

    // The most recent (second) write resolves first — its key wins.
    await act(async () => {
      resolvers[1]();
      await Promise.resolve();
    });
    expect(result.current.copied).toBe("k-second");

    // The stale (first) write resolves later — it must NOT overwrite the newer feedback.
    await act(async () => {
      resolvers[0]();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.copied).toBe("k-second");
  });
});
