import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";

import { describe, expect, it, vi } from "vitest";

const KILL_SWITCH_SOURCE = readFileSync(resolve(process.cwd(), "public/sw-kill-switch.js"), "utf8");
const WORKER_SOURCE = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");

class ExtendableEventHarness {
  private readonly lifetimePromises: Promise<unknown>[] = [];

  waitUntil(promise: Promise<unknown>): void {
    this.lifetimePromises.push(Promise.resolve(promise));
  }

  async settle(): Promise<void> {
    let settledCount = 0;
    while (settledCount < this.lifetimePromises.length) {
      const pending = this.lifetimePromises.slice(settledCount);
      settledCount = this.lifetimePromises.length;
      await Promise.all(pending);
    }
  }
}

function createKillSwitchHarness(seededCacheNames: string[], { keysUnavailable = false } = {}) {
  const listeners = new Map<string, Array<(event: unknown) => void>>();
  const names = new Set(seededCacheNames);
  const deletedNames: string[] = [];
  const openedNames: string[] = [];
  const unregister = vi.fn(async () => true);
  const claimClients = vi.fn(async () => undefined);
  const skipWaiting = vi.fn(async () => undefined);

  const cacheStorage = {
    async delete(name: string): Promise<boolean> {
      deletedNames.push(name);
      return names.delete(name);
    },
    async keys(): Promise<string[]> {
      if (keysUnavailable) throw new Error("CacheStorage unavailable");
      return [...names];
    },
    async open(name: string): Promise<never> {
      openedNames.push(name);
      throw new Error("The retirement worker must never open or write caches.");
    },
  };

  const workerGlobal = {
    addEventListener(type: string, listener: (event: unknown) => void) {
      const registered = listeners.get(type) ?? [];
      registered.push(listener);
      listeners.set(type, registered);
    },
    clients: { claim: claimClients },
    registration: { unregister },
    skipWaiting,
  };

  runInContext(KILL_SWITCH_SOURCE, createContext({ caches: cacheStorage, console, self: workerGlobal }), {
    filename: "public/sw-kill-switch.js",
  });

  return {
    claimClients,
    deletedNames,
    listeners,
    openedNames,
    skipWaiting,
    unregister,
    remainingCacheNames: () => [...names],
    async dispatch(type: string): Promise<void> {
      const event = new ExtendableEventHarness();
      for (const listener of listeners.get(type) ?? []) listener(event);
      await event.settle();
    },
  };
}

describe("PWA retirement kill-switch worker", () => {
  it("targets exactly the cache prefix owned by the production worker", () => {
    const killSwitchPrefix = KILL_SWITCH_SOURCE.match(/const CACHE_PREFIX = "([^"]+)";/)?.[1];
    const workerPrefix = WORKER_SOURCE.match(/const CACHE_PREFIX = "([^"]+)";/)?.[1];

    expect(killSwitchPrefix).toBeTruthy();
    expect(killSwitchPrefix).toBe(workerPrefix);
  });

  it("activates immediately as the documented retirement exception to no-auto-skipWaiting", async () => {
    const harness = createKillSwitchHarness([]);

    await harness.dispatch("install");

    expect(harness.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it("deletes every owned cache generation, including unknown future versions, and leaves foreign caches", async () => {
    const harness = createKillSwitchHarness([
      "clinical-kb-pwa-shell-2026-07-15-v1",
      "clinical-kb-pwa-static-2026-07-15-v1",
      "clinical-kb-pwa-static-2099-12-31-v9",
      "unrelated-application-cache",
    ]);

    await harness.dispatch("activate");

    expect([...harness.deletedNames].sort()).toEqual([
      "clinical-kb-pwa-shell-2026-07-15-v1",
      "clinical-kb-pwa-static-2026-07-15-v1",
      "clinical-kb-pwa-static-2099-12-31-v9",
    ]);
    expect(harness.remainingCacheNames()).toEqual(["unrelated-application-cache"]);
    expect(harness.unregister).toHaveBeenCalledTimes(1);
    expect(harness.claimClients).toHaveBeenCalledTimes(1);
  });

  it("registers no fetch handler and never opens or writes CacheStorage", async () => {
    const harness = createKillSwitchHarness(["clinical-kb-pwa-shell-2026-07-15-v1"]);

    await harness.dispatch("install");
    await harness.dispatch("activate");

    expect(harness.listeners.has("fetch")).toBe(false);
    expect(harness.openedNames).toEqual([]);
  });

  it("still unregisters when CacheStorage enumeration is unavailable", async () => {
    const harness = createKillSwitchHarness(["clinical-kb-pwa-shell-2026-07-15-v1"], { keysUnavailable: true });

    await harness.dispatch("activate");

    expect(harness.deletedNames).toEqual([]);
    expect(harness.unregister).toHaveBeenCalledTimes(1);
  });
});
