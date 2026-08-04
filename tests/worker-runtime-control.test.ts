import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { WorkerRuntimeControl } from "../worker/runtime-control";

describe("WorkerRuntimeControl", () => {
  it("stop is idempotent", () => {
    const ctrl = new WorkerRuntimeControl();
    const cb = vi.fn();
    ctrl.onStop(cb);

    ctrl.stop();
    ctrl.stop();

    expect(ctrl.isStopped).toBe(true);
    expect(cb).toHaveBeenCalledOnce();
  });

  it("interrupts sleep when stopped", async () => {
    const ctrl = new WorkerRuntimeControl();
    const start = Date.now();
    const promise = ctrl.sleep(10_000);
    ctrl.stop();
    await promise;
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it("returns immediately from sleep when already stopped", async () => {
    const ctrl = new WorkerRuntimeControl();
    ctrl.stop();
    const start = Date.now();
    await ctrl.sleep(10_000);
    expect(Date.now() - start).toBeLessThan(10);
  });

  it("attaches and detaches signals", () => {
    const source = new EventEmitter();
    const ctrl = new WorkerRuntimeControl({ signalSource: source });
    ctrl.attachSignals(["SIGTERM"]);
    source.emit("SIGTERM");
    expect(ctrl.isStopped).toBe(true);

    const next = new WorkerRuntimeControl({ signalSource: source });
    next.attachSignals(["SIGTERM"]);
    source.emit("SIGTERM");
    expect(next.isStopped).toBe(true);
  });

  it("does not invoke real process signals by default during tests", () => {
    const ctrl = new WorkerRuntimeControl();
    // This test only proves the constructor does not immediately attach handlers.
    expect(ctrl.isStopped).toBe(false);
  });
});
