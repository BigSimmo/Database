import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  clientChunkNamesFromManifestSource,
  clientRouteAndChunkNamesFromManifestSource,
  compareToBudget,
  EXIT_FAILSAFE_MS,
  exitProcess,
  findFixtureSnapshotsInChunks,
  gzipBytesOf,
  initialDashboardChunkNames,
  measureChunkPaths,
  measureChunks,
  measureBudgetRoutes,
  MOCKUP_ROUTE_SEGMENT,
  normalizeManifestRoute,
  partitionRouteClientChunks,
  resolveBaselineCommitDistance,
  resolveBaselineSource,
  STALE_BASELINE_COMMIT_DISTANCE_THRESHOLD,
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
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
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
      rmSync(sandbox, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
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
      rmSync(sandbox, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
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
      rmSync(sandbox, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("fails closed when a discovered route manifest cannot be decoded", async () => {
    const sandbox = makeSandbox();
    const appDir = path.join(sandbox, ".next", "server", "app");
    mkdirSync(path.join(appDir, MOCKUP_ROUTE_SEGMENT, "demo"), { recursive: true });
    writeFileSync(
      path.join(appDir, MOCKUP_ROUTE_SEGMENT, "demo", "page_client-reference-manifest.js"),
      'globalThis.__RSC_MANIFEST["/mockups/demo"]={truncated',
    );
    const result = await runCli(sandbox);
    try {
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("could not be decoded");
    } finally {
      rmSync(sandbox, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
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

  it("triggers a drift warning when growth exceeds warnTolerancePct while within tolerance", () => {
    const v = compareToBudget(
      { totalGzipBytes: 1060 },
      { enforce: true, tolerancePct: 10, warnTolerancePct: 5, totalGzipBytes: 1000 },
    );
    expect(v.status).toBe("warn");
    expect(v.isDriftWarning).toBe(true);
    expect(v.overPct).toBeCloseTo(6, 5);
    expect(v.reason).toContain("drift warning > 5%");
  });

  it("treats exactly-at-tolerance as ok", () => {
    const v = compareToBudget({ totalGzipBytes: 1100 }, { enforce: true, tolerancePct: 10, totalGzipBytes: 1000 });
    expect(v.status).toBe("ok");
  });

  it("treats an unchanged zero baseline as within tolerance", () => {
    // `--update` can record mockups.gzipBytes: 0; (0-0)/0 must not become NaN fail.
    const v = compareToBudget({ totalGzipBytes: 0 }, { enforce: true, tolerancePct: 25, totalGzipBytes: 0 });
    expect(v.status).toBe("ok");
    expect(v.overPct).toBe(0);
    expect(v.reason).toBe("within tolerance");
  });

  it("treats any growth from a zero baseline as over tolerance", () => {
    const v = compareToBudget({ totalGzipBytes: 40 }, { enforce: true, tolerancePct: 25, totalGzipBytes: 0 });
    expect(v.status).toBe("fail");
    expect(v.overPct).toBe(Number.POSITIVE_INFINITY);
    expect(v.reason).toContain("+∞%");
  });
});

describe("bundle baseline provenance", () => {
  const gitHead = "A".repeat(40);

  it("prefers an explicit measurement source and normalizes it", () => {
    const readHead = vi.fn(() => "b".repeat(40));
    expect(resolveBaselineSource({ BUNDLE_BUDGET_SOURCE_SHA: gitHead }, readHead)).toBe(gitHead.toLowerCase());
    expect(readHead).not.toHaveBeenCalled();
  });

  it("falls back to the current Git head and rejects malformed candidates", () => {
    expect(resolveBaselineSource({ GITHUB_SHA: "not-a-sha" }, () => "b".repeat(40))).toBe("b".repeat(40));
    expect(resolveBaselineSource({}, () => "still-not-a-sha")).toBeNull();
  });

  it("resolves baseline commit distance using git rev-list", () => {
    const mockExec = vi.fn(() => "15\n");
    const count = resolveBaselineCommitDistance(gitHead, process.cwd(), mockExec as unknown as typeof execFileSync);
    expect(count).toBe(15);
    expect(mockExec).toHaveBeenCalledWith(
      "git",
      ["-C", process.cwd(), "rev-list", "--count", `${gitHead.toLowerCase()}..HEAD`],
      expect.any(Object),
    );
  });

  it("returns null for malformed or absent baseline commit SHA", () => {
    expect(resolveBaselineCommitDistance(null)).toBeNull();
    expect(resolveBaselineCommitDistance("not-a-sha")).toBeNull();
  });

  it("defines a default stale baseline commit distance threshold", () => {
    expect(STALE_BASELINE_COMMIT_DISTANCE_THRESHOLD).toBe(50);
  });
});

describe("committed route bundle budgets", () => {
  it("covers the same five journeys as Lighthouse with enforced numeric baselines", () => {
    const bundle = JSON.parse(readFileSync(path.resolve("bundle-budget.json"), "utf8"));
    const lighthouse = JSON.parse(readFileSync(path.resolve("lighthouse-budget.json"), "utf8"));

    expect(Object.keys(bundle.routes)).toEqual(lighthouse.routes);
    for (const routeBudget of Object.values(bundle.routes) as Array<{ gzipBytes: unknown; tolerancePct: unknown }>) {
      expect(routeBudget.gzipBytes).toEqual(expect.any(Number));
      expect(routeBudget.tolerancePct).toBe(10);
    }
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
      // `partitionRouteClientChunks` correctly uses the host path separator.
      // The fixture map is deliberately repository-style POSIX paths, so make
      // the fake filesystem accept Windows paths as well.
      const normalizedDir = dir.replaceAll("\\", "/");
      const prefix = normalizedDir.endsWith("/") ? normalizedDir : `${normalizedDir}/`;
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
    return { readDir, readFile: (p: string) => files[p.replaceAll("\\", "/")] };
  }

  it("parses chunk names out of a route client-reference manifest", () => {
    const names = clientChunkNamesFromManifestSource(manifest("/page", ["a.js", "b.js"]));
    expect(names).toBeInstanceOf(Set);
    expect([...(names ?? [])]).toEqual(["a.js", "b.js"]);
  });

  it("normalizes route groups and page manifest keys", () => {
    expect(normalizeManifestRoute("/page")).toBe("/");
    expect(normalizeManifestRoute("/(search-app)/documents/search/page")).toBe("/documents/search");
    expect(clientRouteAndChunkNamesFromManifestSource(manifest("/forms/page", ["forms.js"]))?.route).toBe("/forms");
  });

  it("returns null rather than an empty set on an unparseable manifest", () => {
    // Empty set means "decoded, no client chunks"; null is the fail-closed signal.
    expect(clientChunkNamesFromManifestSource("module.exports = {}")).toBeNull();
    expect(clientChunkNamesFromManifestSource('globalThis.__RSC_MANIFEST["/x"]={oops;')).toBeNull();
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
    expect(result.unparseable).toEqual([]);
    expect([...result.routeChunks.get("/")!]).toEqual(["shared.js"]);
  });

  it("measures shared and route-local chunks for every configured route", () => {
    const measured = [
      { name: "shared.js", gzipBytes: 100 },
      { name: "root.js", gzipBytes: 40 },
      { name: "forms.js", gzipBytes: 60 },
    ];
    const routeChunks = new Map([
      ["/", new Set(["shared.js", "root.js"])],
      ["/forms", new Set(["shared.js", "forms.js"])],
    ]);
    const result = measureBudgetRoutes(measured, routeChunks, {
      "/": { gzipBytes: 140 },
      "/forms": { gzipBytes: 160 },
    });

    expect(result.missing).toEqual([]);
    expect(result.measured).toEqual({
      "/": { gzipBytes: 140, chunks: 2 },
      "/forms": { gzipBytes: 160, chunks: 2 },
    });
  });

  it("fails closed when a configured route has no manifest", () => {
    const result = measureBudgetRoutes([], new Map([["/", new Set()]]), {
      "/": { gzipBytes: 0 },
      "/missing": { gzipBytes: 0 },
    });
    expect(result.missing).toEqual(["/missing"]);
  });

  it("treats nested mockup routes as scratch and API route manifests as production", () => {
    const { readDir, readFile } = fakeTree({
      "app/api/answer/route_client-reference-manifest.js": manifest("/api/answer", ["api.js"]),
      [`app/${MOCKUP_ROUTE_SEGMENT}/a/b/page_client-reference-manifest.js`]: manifest("/mockups/a/b", ["deep.js"]),
    });
    const result = partitionRouteClientChunks("app", { readDir, readFile });
    expect([...result.mockupExclusive]).toEqual(["deep.js"]);
    expect(result.mockupRouteCount).toBe(1);
    expect(result.unparseable).toEqual([]);
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

  it("surfaces a malformed mockup manifest instead of counting it as resolved", () => {
    // Counting before parse let one valid root + one truncated mockup exit 0
    // while the mockup budget silently measured nothing.
    const { readDir, readFile } = fakeTree({
      "app/page_client-reference-manifest.js": manifest("/page", ["main.js"]),
      [`app/${MOCKUP_ROUTE_SEGMENT}/demo/page_client-reference-manifest.js`]:
        'globalThis.__RSC_MANIFEST["/mockups/demo"]={truncated',
    });
    const result = partitionRouteClientChunks("app", { readDir, readFile });
    expect(result.unparseable).toEqual([`app/${MOCKUP_ROUTE_SEGMENT}/demo/page_client-reference-manifest.js`]);
    expect(result.routeCount).toBe(1);
    expect(result.mockupRouteCount).toBe(0);
    expect([...result.mockupExclusive]).toEqual([]);
  });

  it("surfaces a malformed production manifest so shared chunks cannot drift to scratch", () => {
    // Asymmetric case: production fails to parse, mockup still parses. Without
    // fail-closed attribution, `shared.js` would only appear in mockupChunks and
    // be subtracted from the production budget.
    const { readDir, readFile } = fakeTree({
      "app/page_client-reference-manifest.js": 'globalThis.__RSC_MANIFEST["/page"]={truncated',
      [`app/${MOCKUP_ROUTE_SEGMENT}/demo/page_client-reference-manifest.js`]: manifest("/mockups/demo", [
        "shared.js",
        "scratch.js",
      ]),
    });
    const result = partitionRouteClientChunks("app", { readDir, readFile });
    expect(result.unparseable).toEqual(["app/page_client-reference-manifest.js"]);
    expect(result.routeCount).toBe(1);
    expect(result.mockupRouteCount).toBe(1);
    // Caller must fail before trusting mockupExclusive; do not compute budgets from this.
    expect(result.unparseable.length).toBeGreaterThan(0);
  });
});
