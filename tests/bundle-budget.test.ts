import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  compareToBudget,
  EXIT_FAILSAFE_MS,
  exitProcess,
  findFixtureSnapshotsInChunks,
  initialDashboardChunkNames,
  measureChunkPaths,
  measureChunks,
} from "../scripts/check-bundle-budget.mjs";

const buf = (n: number) => Buffer.alloc(n, "a"); // highly compressible; gzip < raw

describe("measureChunks", () => {
  it("sums raw and gzip bytes and ranks the largest", () => {
    const m = measureChunks([
      { name: "a.js", buffer: buf(1000) },
      { name: "b.js", buffer: buf(4000) },
    ]);
    expect(m.files).toBe(2);
    expect(m.totalRawBytes).toBe(5000);
    expect(m.totalGzipBytes).toBeGreaterThan(0);
    expect(m.totalGzipBytes).toBeLessThan(m.totalRawBytes);
    expect(m.largest[0].name).toBe("b.js");
  });
});

describe("measureChunkPaths", () => {
  it("streams paths without requiring callers to retain buffers", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "bundle-budget-paths-"));
    try {
      const a = path.join(dir, "a.js");
      const b = path.join(dir, "b.js");
      writeFileSync(a, buf(1000));
      writeFileSync(b, buf(4000));
      const m = measureChunkPaths([a, b]);
      expect(m.files).toBe(2);
      expect(m.totalRawBytes).toBe(5000);
      expect(m.largest[0].name.endsWith("b.js")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("exitProcess", () => {
  it("exits immediately when stdout write buffer is empty", () => {
    const exitImpl = vi.fn();
    const stdout = {
      write: vi.fn(() => true),
      once: vi.fn(),
    };
    const setTimer = vi.fn(() => ({ unref: vi.fn() }));
    exitProcess(0, {
      exitImpl,
      stdout,
      setTimer: setTimer as unknown as typeof setTimeout,
    });
    expect(exitImpl).toHaveBeenCalledWith(0);
    expect(stdout.once).not.toHaveBeenCalled();
    expect(setTimer).toHaveBeenCalled();
  });

  it("forces exit via failsafe when stdout drain never fires", () => {
    vi.useFakeTimers();
    try {
      const exitImpl = vi.fn();
      const stdout = {
        write: vi.fn(() => false),
        once: vi.fn(),
      };
      exitProcess(0, { exitImpl, stdout, setTimer: setTimeout, failsafeMs: EXIT_FAILSAFE_MS });
      expect(exitImpl).not.toHaveBeenCalled();
      vi.advanceTimersByTime(EXIT_FAILSAFE_MS);
      expect(exitImpl).toHaveBeenCalledWith(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("check-bundle-budget CLI exit", () => {
  it("terminates within a deadline after printing success", async () => {
    const sandbox = mkdtempSync(path.join(tmpdir(), "bundle-budget-cli-"));
    const chunksDir = path.join(sandbox, ".next", "static", "chunks");
    mkdirSync(chunksDir, { recursive: true });
    writeFileSync(path.join(chunksDir, "main.js"), "console.log('ok')");
    writeFileSync(
      path.join(sandbox, ".next", "app-build-manifest.json"),
      JSON.stringify({
        rootMainFiles: ["static/chunks/main.js"],
        pages: { "/layout": [], "/page": [] },
      }),
    );
    writeFileSync(
      path.join(sandbox, "bundle-budget.json"),
      // Baseline well above the tiny fixture chunk so the CLI takes the success path.
      JSON.stringify({ enforce: true, tolerancePct: 10, totalGzipBytes: 100_000 }),
    );

    const script = path.join(process.cwd(), "scripts/check-bundle-budget.mjs");
    const started = Date.now();
    const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
      const child = spawn(process.execPath, [script], {
        cwd: sandbox,
        env: { ...process.env, NODE_OPTIONS: "", BUNDLE_BUDGET_ROOT: sandbox },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });
      const killTimer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`CLI hung after success (stdout=${JSON.stringify(stdout)} stderr=${JSON.stringify(stderr)})`));
      }, 5_000);
      child.on("error", (error) => {
        clearTimeout(killTimer);
        reject(error);
      });
      child.on("close", (code) => {
        clearTimeout(killTimer);
        resolve({ code, stdout, stderr });
      });
    });

    try {
      expect(
        { code: result.code, stdout: result.stdout, stderr: result.stderr },
        "CLI should exit 0 after printing done",
      ).toMatchObject({ code: 0 });
      expect(result.stdout).toContain("[bundle-budget] done.");
      expect(Date.now() - started).toBeLessThan(5_000);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });
});

describe("compareToBudget", () => {
  it("warns when there is no baseline", () => {
    const v = compareToBudget({ totalGzipBytes: 1000 }, { enforce: true, tolerancePct: 10, totalGzipBytes: null });
    expect(v.status).toBe("warn");
    expect(v.reason).toMatch(/no baseline/);
  });

  it("passes within tolerance", () => {
    const v = compareToBudget({ totalGzipBytes: 1050 }, { enforce: true, tolerancePct: 10, totalGzipBytes: 1000 });
    expect(v.status).toBe("ok");
    expect(v.overPct).toBeCloseTo(5, 5);
  });

  it("fails over tolerance when enforcing", () => {
    const v = compareToBudget({ totalGzipBytes: 1200 }, { enforce: true, tolerancePct: 10, totalGzipBytes: 1000 });
    expect(v.status).toBe("fail");
    expect(v.overPct).toBeCloseTo(20, 5);
  });

  it("only warns over tolerance when not enforcing", () => {
    const v = compareToBudget({ totalGzipBytes: 1200 }, { enforce: false, tolerancePct: 10, totalGzipBytes: 1000 });
    expect(v.status).toBe("warn");
  });

  it("treats exactly-at-tolerance as ok", () => {
    const v = compareToBudget({ totalGzipBytes: 1100 }, { enforce: true, tolerancePct: 10, totalGzipBytes: 1000 });
    expect(v.status).toBe("ok");
  });
});

describe("initial dashboard fixture boundary", () => {
  it("resolves root layout, page, and shared chunks without dynamic route chunks", () => {
    expect(
      initialDashboardChunkNames({
        rootMainFiles: ["static/chunks/main.js"],
        pages: {
          "/layout": ["static/chunks/layout.js", "static/css/layout.css"],
          "/page": ["static/chunks/page.js"],
          "/documents/[id]/page": ["static/chunks/document-viewer.js"],
        },
      }),
    ).toEqual(["main.js", "layout.js", "page.js"]);
  });

  it("resolves Next 16 root-page chunks from the client-reference manifest", () => {
    expect(
      initialDashboardChunkNames(
        {
          rootMainFiles: ["static/chunks/main-app.js"],
          pages: { "/_app": [] },
        },
        {
          clientModules: {
            home: { chunks: ["1234", "static/chunks/1234-home.js"] },
            lazy: { chunks: [] },
          },
        },
      ),
    ).toEqual(["main-app.js", "1234-home.js"]);
  });

  it("detects complete fixture marker groups in initial chunks", () => {
    const violations = findFixtureSnapshotsInChunks([
      {
        name: "page.js",
        buffer: Buffer.from("transport-crisis-form extension-transport-order detention-examination-movement"),
      },
    ]);
    expect(violations).toEqual(["forms fixture catalogue"]);
  });

  it("does not flag an isolated UI string as a serialized fixture", () => {
    expect(
      findFixtureSnapshotsInChunks([{ name: "page.js", buffer: Buffer.from("Try first episode psychosis") }]),
    ).toEqual([]);
  });
});
