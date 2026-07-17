import { afterEach, describe, expect, it, vi } from "vitest";

async function loadCacheModule() {
  return import("../src/lib/owner-catalogue-cache");
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

afterEach(async () => {
  vi.useRealTimers();
  const { clearOwnerCatalogueCache } = await loadCacheModule();
  clearOwnerCatalogueCache();
});

describe("owner catalogue cache", () => {
  it("reuses a successful catalogue across warm query prefixes", async () => {
    const { loadOwnerCatalogue } = await loadCacheModule();
    const load = vi.fn(async () => [{ slug: "clozapine" }]);
    const args = { ownerId: "owner-a", kind: "medication" as const, limit: 500, load };

    const first = await loadOwnerCatalogue(args);
    const warmerPrefix = await loadOwnerCatalogue(args);

    expect(warmerPrefix).toBe(first);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("coalesces concurrent same-key cold loads", async () => {
    const { loadOwnerCatalogue } = await loadCacheModule();
    const pending = deferred<Array<{ slug: string }>>();
    const load = vi.fn(async () => pending.promise);
    const args = { ownerId: "owner-concurrent", kind: "service" as const, limit: 500, load };

    const first = loadOwnerCatalogue(args);
    const second = loadOwnerCatalogue(args);
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(1);

    const catalogue = [{ slug: "crisis-service" }];
    pending.resolve(catalogue);
    const [firstValue, secondValue] = await Promise.all([first, second]);
    expect(firstValue).toBe(secondValue);
    expect(firstValue).toEqual(catalogue);
  });

  it("does not cache a failed shared load and retries after every waiter rejects", async () => {
    const { loadOwnerCatalogue } = await loadCacheModule();
    const pending = deferred<Array<{ slug: string }>>();
    const load = vi
      .fn<(signal: AbortSignal) => Promise<Array<{ slug: string }>>>()
      .mockImplementationOnce(async () => pending.promise)
      .mockResolvedValueOnce([{ slug: "recovered-service" }]);
    const args = { ownerId: "owner-shared-failure", kind: "service" as const, limit: 500, load };

    const first = loadOwnerCatalogue(args);
    const second = loadOwnerCatalogue(args);
    await Promise.resolve();
    pending.reject(new Error("shared load failed"));
    const outcomes = await Promise.allSettled([first, second]);
    expect(outcomes.map((outcome) => outcome.status)).toEqual(["rejected", "rejected"]);

    await expect(loadOwnerCatalogue(args)).resolves.toEqual([{ slug: "recovered-service" }]);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("lets an active waiter complete when a coalesced caller aborts", async () => {
    const { loadOwnerCatalogue } = await loadCacheModule();
    const pending = deferred<Array<{ slug: string }>>();
    let sharedSignal: AbortSignal | undefined;
    const load = vi.fn(async (signal: AbortSignal) => {
      sharedSignal = signal;
      return pending.promise;
    });
    const firstController = new AbortController();
    const secondController = new AbortController();
    const args = { ownerId: "owner-partial-abort", kind: "medication" as const, limit: 500, load };

    const abortedCaller = loadOwnerCatalogue({ ...args, signal: firstController.signal });
    const activeCaller = loadOwnerCatalogue({ ...args, signal: secondController.signal });
    await Promise.resolve();
    firstController.abort(new DOMException("superseded", "AbortError"));
    await expect(abortedCaller).rejects.toMatchObject({ name: "AbortError" });
    expect(sharedSignal?.aborted).toBe(false);

    const catalogue = [{ slug: "clozapine" }];
    pending.resolve(catalogue);
    await expect(activeCaller).resolves.toEqual(catalogue);
    await expect(loadOwnerCatalogue(args)).resolves.toEqual(catalogue);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not start or populate a flight for an already-aborted caller", async () => {
    const { loadOwnerCatalogue } = await loadCacheModule();
    const controller = new AbortController();
    controller.abort(new DOMException("already superseded", "AbortError"));
    const load = vi.fn(async () => [{ slug: "must-not-cache" }]);
    const args = { ownerId: "owner-pre-aborted", kind: "form" as const, limit: 500, load };

    await expect(loadOwnerCatalogue({ ...args, signal: controller.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(load).not.toHaveBeenCalled();

    await expect(loadOwnerCatalogue(args)).resolves.toEqual([{ slug: "must-not-cache" }]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("expires values after five seconds and retains at most 128 keys", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T00:00:00Z"));
    const { loadOwnerCatalogue } = await loadCacheModule();
    const expiringLoad = vi.fn(async () => [{ slug: "clozapine" }]);

    await loadOwnerCatalogue({ ownerId: "owner-expiring", kind: "medication", limit: 500, load: expiringLoad });
    vi.advanceTimersByTime(4_999);
    await loadOwnerCatalogue({ ownerId: "owner-expiring", kind: "medication", limit: 500, load: expiringLoad });
    vi.advanceTimersByTime(2);
    await loadOwnerCatalogue({ ownerId: "owner-expiring", kind: "medication", limit: 500, load: expiringLoad });
    expect(expiringLoad).toHaveBeenCalledTimes(2);

    const loads = Array.from({ length: 129 }, () => vi.fn(async () => [{ ok: true }]));
    for (let index = 0; index < loads.length; index += 1) {
      await loadOwnerCatalogue({
        ownerId: `owner-${index}`,
        kind: "service",
        limit: 500,
        load: loads[index],
      });
    }
    await loadOwnerCatalogue({ ownerId: "owner-0", kind: "service", limit: 500, load: loads[0] });
    expect(loads[0]).toHaveBeenCalledTimes(2);
  });

  it("never caches failed or aborted loads", async () => {
    const { loadOwnerCatalogue } = await loadCacheModule();
    const failedLoad = vi
      .fn<() => Promise<Array<{ slug: string }>>>()
      .mockRejectedValueOnce(new Error("load failed"))
      .mockResolvedValueOnce([{ slug: "clozapine" }]);
    const failedArgs = { ownerId: "owner-failed", kind: "medication" as const, limit: 500, load: failedLoad };

    await expect(loadOwnerCatalogue(failedArgs)).rejects.toThrow("load failed");
    await expect(loadOwnerCatalogue(failedArgs)).resolves.toEqual([{ slug: "clozapine" }]);
    expect(failedLoad).toHaveBeenCalledTimes(2);

    const controller = new AbortController();
    const abortedLoad = vi.fn(async () => {
      controller.abort(new DOMException("superseded", "AbortError"));
      return [{ slug: "acamprosate" }];
    });
    const abortedArgs = {
      ownerId: "owner-aborted",
      kind: "medication" as const,
      limit: 500,
      signal: controller.signal,
      load: abortedLoad,
    };

    await expect(loadOwnerCatalogue(abortedArgs)).rejects.toMatchObject({ name: "AbortError" });
    const retry = new AbortController();
    await loadOwnerCatalogue({ ...abortedArgs, signal: retry.signal });
    expect(abortedLoad).toHaveBeenCalledTimes(2);
  });

  it("invalidates only the mutated owner and catalogue kind across limits", async () => {
    const { invalidateOwnerCatalogueCache, loadOwnerCatalogue } = await loadCacheModule();
    const ownerMedication = vi.fn(async () => [{ slug: "clozapine" }]);
    const ownerService = vi.fn(async () => [{ slug: "crisis-service" }]);
    const otherMedication = vi.fn(async () => [{ slug: "lithium" }]);

    await loadOwnerCatalogue({ ownerId: "owner-a", kind: "medication", limit: 500, load: ownerMedication });
    await loadOwnerCatalogue({ ownerId: "owner-a", kind: "medication", limit: 100, load: ownerMedication });
    await loadOwnerCatalogue({ ownerId: "owner-a", kind: "service", limit: 500, load: ownerService });
    await loadOwnerCatalogue({ ownerId: "owner-b", kind: "medication", limit: 500, load: otherMedication });

    invalidateOwnerCatalogueCache({ ownerId: "owner-a", kind: "medication" });

    await loadOwnerCatalogue({ ownerId: "owner-a", kind: "medication", limit: 500, load: ownerMedication });
    await loadOwnerCatalogue({ ownerId: "owner-a", kind: "medication", limit: 100, load: ownerMedication });
    await loadOwnerCatalogue({ ownerId: "owner-a", kind: "service", limit: 500, load: ownerService });
    await loadOwnerCatalogue({ ownerId: "owner-b", kind: "medication", limit: 500, load: otherMedication });

    expect(ownerMedication).toHaveBeenCalledTimes(4);
    expect(ownerService).toHaveBeenCalledTimes(1);
    expect(otherMedication).toHaveBeenCalledTimes(1);
  });

  it("preserves the seeding flight while invalidating other medication loads", async () => {
    const { invalidateOwnerCatalogueCache, loadOwnerCatalogue } = await loadCacheModule();
    const load = vi.fn(async (signal: AbortSignal) => {
      invalidateOwnerCatalogueCache({ ownerId: "owner-a", kind: "medication", preserveSignal: signal });
      return [{ slug: "clozapine" }];
    });

    await expect(loadOwnerCatalogue({ ownerId: "owner-a", kind: "medication", limit: 500, load })).resolves.toEqual([
      { slug: "clozapine" },
    ]);
    await loadOwnerCatalogue({ ownerId: "owner-a", kind: "medication", limit: 500, load });

    expect(load).toHaveBeenCalledTimes(1);
  });
});
