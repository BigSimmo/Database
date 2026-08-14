import { describe, expect, it } from "vitest";

import { prefetchEmbedding } from "@/lib/rag/rag-embedding-prefetch";

describe("prefetchEmbedding", () => {
  it("forwards the caller signal to the warm embedding flight", async () => {
    const controller = new AbortController();
    const cancellation = new Error("cancelled");
    let receivedSignal: AbortSignal | undefined;

    const { promise } = prefetchEmbedding(
      true,
      "query",
      ({ signal }) => {
        receivedSignal = signal;
        return new Promise<never>((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
      },
      { signal: controller.signal },
    );

    expect(receivedSignal).toBe(controller.signal);
    controller.abort(cancellation);
    await expect(promise).rejects.toBe(cancellation);
  });
});
