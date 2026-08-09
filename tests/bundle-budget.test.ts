import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  clientChunkNamesFromManifestSource,
  compareToBudget,
  EXIT_FAILSAFE_MS,
  exitProcess,
  findFixtureSnapshotsInChunks,
  gzipBytesOf,
  initialDashboardChunkNames,
  measureChunkPaths,
  measureChunks,
  MOCKUP_ROUTE_SEGMENT,
  partitionRouteClientChunks,
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
  /** Minimal build tree: one chunk, a build manifest, and one production route. */
  function makeSandbox({ withRouteManifests = true } = {}) {
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
    if (withRouteManifests) {
      const appDir = path.join(sandbox, ".next", "server", "app");
      mkdirSync(appDir, { recursive: true });
      writeFileSync(
        path.join(appDir, "page_client-reference-manifest.js"),
        `globalThis.__RSC_MANIFEST["/page"]=${JSON.stringify({
          clientModules: { mod: { chunks: ["static/chunks/main.js"] } },
        })};`,
      );
    }
    writeFileSync(
      path.join(sandbox, "bundle-budget.json"),
      // Baselines well above the tiny fixture chunk so the CLI takes the success path.
      JSON.stringify({
        enforce: true,
        production: { gzipBytes: 100_000, tolerancePct: 10 },
        mockups: { gzipBytes: 100_000, tolerancePct: 25 },
      }),
    );
    return sandbox;
  }

  function runCli(sandbox: string) {
    const script = path.join(process.cwd(), "scripts/check-bundle-budget.mjs");
    return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
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
        reject(new Error(`CLI hung (stdout=${JSON.stringify(stdout)} stderr=${JSON.stringify(stderr)})`));
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
  }

  it("terminates within a deadline after printing done", async () => {
    const sandbox = makeSandbox();
    const started = Date.now();
    const result = await runCli(sandbox);
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

  it("names both budgets so neither number reads as the other", async () => {
    // The reconciliation of `#013`/`#252` is only real if the output says which
    // question each number answers.
    const sandbox = makeSandbox();
    const result = await runCli(sandbox);
    try {
      expect(result.stdout).toContain("production (what users download");
      expect(result.stdout).toContain(`${MOCKUP_ROUTE_SEGMENT} (design scratch, 404s in production`);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it("fails closed when chunks cannot be attributed to routes", async () => {
    // Without attribution the two buckets silently collapse into one, which is
    // the ambiguity this gate exists to remove.
    const sandbox = makeSandbox({ withRouteManifests: false });
    const result = await runCli(sandbox);
    try {
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("cannot separate production weight");
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

describe("production vs mockup chunk attribution", () => {
  const manifest = (route: string, chunks: string[]) =>
    `globalThis.__RSC_MANIFEST[${JSON.stringify(route)}]=${JSON.stringify({
      clientModules: Object.fromEntries(chunks.map((c, i) => [`mod${i}`, { chunks: [`static/chunks/${c}`] }])),
    })};`;

  /** Build an injectable fake of `.next/server/app` from a path -> contents map. */
  function fakeTree(files: Record<string, string>) {
    const readDir = (dir: string) => {
      const prefix = dir.endsWith("/") ? dir : `${dir}/`;
      const names = new Set<string>();
      const out: { name: string; isDirectory: () => boolean; isFile: () => boolean }[] = [];
      for (const full of Object.keys(files)) {
        if (!full.startsWith(prefix)) continue;
        const rest = full.slice(prefix.length);
        const slash = rest.indexOf("/");
        const name = slash < 0 ? rest : rest.slice(0, slash);
        if (names.has(name)) continue;
        names.add(name);
        out.push({ name, isDirectory: () => slash >= 0, isFile: () => slash < 0 });
      }
      return out;
    };
    return { readDir, readFile: (p: string) => files[p] };
  }

  it("parses chunk names out of a route client-reference manifest", () => {
    expect([...clientChunkNamesFromManifestSource(manifest("/page", ["a.js", "b.js"]))]).toEqual(["a.js", "b.js"]);
  });

  it("returns nothing rather than throwing on an unparseable manifest", () => {
    expect([...clientChunkNamesFromManifestSource("module.exports = {}")]).toEqual([]);
    expect([...clientChunkNamesFromManifestSource('globalThis.__RSC_MANIFEST["/x"]={oops;')]).toEqual([]);
  });

  it("charges a chunk shared with a production route to production, not to scratch", () => {
    // `shared.js` is reached by both, so it would be built with or without the
    // mockup — only `scratch.js` is design-scratch weight.
    const { readDir, readFile } = fakeTree({
      "app/page_client-reference-manifest.js": manifest("/page", ["shared.js"]),
      [`app/${MOCKUP_ROUTE_SEGMENT}/demo/page_client-reference-manifest.js`]: manifest("/mockups/demo", [
        "shared.js",
        "scratch.js",
      ]),
    });
    const result = partitionRouteClientChunks("app", { readDir, readFile });
    expect([...result.mockupExclusive]).toEqual(["scratch.js"]);
    expect(result.routeCount).toBe(2);
    expect(result.mockupRouteCount).toBe(1);
  });

  it("treats nested mockup routes as scratch and API route manifests as production", () => {
    const { readDir, readFile } = fakeTree({
      "app/api/answer/route_client-reference-manifest.js": manifest("/api/answer", ["api.js"]),
      [`app/${MOCKUP_ROUTE_SEGMENT}/a/b/page_client-reference-manifest.js`]: manifest("/mockups/a/b", ["deep.js"]),
    });
    const result = partitionRouteClientChunks("app", { readDir, readFile });
    expect([...result.mockupExclusive]).toEqual(["deep.js"]);
    expect(result.mockupRouteCount).toBe(1);
  });

  it("leaves chunks no route claims on the production side", () => {
    // Framework/polyfill/runtime chunks appear in no manifest. They must not
    // drift into the scratch bucket, which would understate production weight.
    const { readDir, readFile } = fakeTree({
      [`app/${MOCKUP_ROUTE_SEGMENT}/demo/page_client-reference-manifest.js`]: manifest("/mockups/demo", ["scratch.js"]),
    });
    const { mockupExclusive } = partitionRouteClientChunks("app", { readDir, readFile });
    const measured = [
      { name: "framework.js", gzipBytes: 100 },
      { name: "scratch.js", gzipBytes: 40 },
    ];
    expect(gzipBytesOf(measured, mockupExclusive)).toBe(40);
    const total = measured.reduce((sum, f) => sum + f.gzipBytes, 0);
    expect(total - gzipBytesOf(measured, mockupExclusive)).toBe(100);
  });

  it("reports no routes when the manifest tree is empty, so the caller can fail closed", () => {
    const { readDir, readFile } = fakeTree({});
    expect(partitionRouteClientChunks("app", { readDir, readFile }).routeCount).toBe(0);
  });
});
