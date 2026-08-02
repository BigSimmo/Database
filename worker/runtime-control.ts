import { EventEmitter } from "node:events";

type SignalName = "SIGTERM" | "SIGINT";

export type WorkerRuntimeControlOptions = {
  /** Optional signal source for testing. Defaults to `process`. */
  signalSource?: Pick<EventEmitter, "on" | "off">;
};

export class WorkerAbortError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number = 1) {
    super(message);
    this.name = "WorkerAbortError";
    this.exitCode = exitCode;
  }
}

export class WorkerRuntimeControl {
  #stopped = false;
  #stopPromise: Promise<void>;
  #resolveStop!: () => void;
  #cleanup: (() => void)[] = [];
  #signalSource?: Pick<EventEmitter, "on" | "off">;
  #attached = false;

  constructor(options: WorkerRuntimeControlOptions = {}) {
    this.#signalSource = options.signalSource;
    this.#stopPromise = new Promise((resolve) => {
      this.#resolveStop = resolve;
    });
  }

  get isStopped(): boolean {
    return this.#stopped;
  }

  stop(): void {
    if (this.#stopped) return;
    this.#stopped = true;
    this.#resolveStop();
    for (const cb of this.#cleanup) {
      try {
        cb();
      } catch {
        /* non-fatal */
      }
    }
    this.#cleanup.length = 0;
  }

  onStop(cb: () => void): () => void {
    this.#cleanup.push(cb);
    return () => {
      const index = this.#cleanup.indexOf(cb);
      if (index >= 0) this.#cleanup.splice(index, 1);
    };
  }

  sleep(ms: number): Promise<void> {
    if (this.#stopped) return Promise.resolve();
    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve();
      }, ms);

      const stopUnsub = this.onStop(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      });

      // Self-cleanup once the promise settles to avoid leaking cleanup entries.
      Promise.race([new Promise<void>((r) => setTimeout(r, ms)), this.#stopPromise]).then(() => {
        stopUnsub();
      });
    });
  }

  attachSignals(signals: SignalName[] = ["SIGTERM", "SIGINT"]): void {
    if (this.#attached) return;
    this.#attached = true;
    const source = this.#signalSource ?? process;

    const handler = () => this.stop();
    for (const signal of signals) {
      source.on(signal, handler);
    }

    // Store the detach logic so tests can explicitly call detachSignals.
    this.#cleanup.push(() => {
      for (const signal of signals) {
        source.off(signal, handler);
      }
    });
  }

  detachSignals(): void {
    if (!this.#attached) return;
    this.#attached = false;
    this.stop();
  }
}
