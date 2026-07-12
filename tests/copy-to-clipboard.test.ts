import { afterEach, describe, expect, it, vi } from "vitest";

import { copyTextToClipboard } from "@/lib/copy-to-clipboard";

type FakeTextArea = {
  value: string;
  setAttribute: () => void;
  select: () => void;
  style: Record<string, string>;
};

function stubDocument(execCommand: undefined | ((command: string) => boolean)) {
  const fakeDocument = {
    createElement: (): FakeTextArea => ({
      value: "",
      setAttribute: () => undefined,
      select: () => undefined,
      style: {},
    }),
    body: {
      appendChild: () => undefined,
      removeChild: () => undefined,
    },
    execCommand,
  };
  vi.stubGlobal("document", fakeDocument);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("copyTextToClipboard", () => {
  it("resolves via the async Clipboard API when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await expect(copyTextToClipboard("hello")).resolves.toBeUndefined();
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("falls back to execCommand and resolves when it reports success", async () => {
    vi.stubGlobal("navigator", {});
    const execCommand = vi.fn().mockReturnValue(true);
    stubDocument(execCommand);
    await expect(copyTextToClipboard("hello")).resolves.toBeUndefined();
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("rejects when the clipboard API is blocked and execCommand is unavailable", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("blocked")) } });
    stubDocument(undefined);
    await expect(copyTextToClipboard("hello")).rejects.toThrow("copy command rejected");
  });

  it("rejects when execCommand reports failure", async () => {
    vi.stubGlobal("navigator", {});
    stubDocument(() => false);
    await expect(copyTextToClipboard("hello")).rejects.toThrow("copy command rejected");
  });
});
