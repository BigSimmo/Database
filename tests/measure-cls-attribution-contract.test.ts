import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../scripts/measure-cls-attribution.mjs", import.meta.url), "utf8");
const optionsModuleUrl = new URL("../scripts/lib/cls-attribution-options.mjs", import.meta.url);
const optionsModule = existsSync(optionsModuleUrl)
  ? ((await import(optionsModuleUrl.href)) as {
      buildClsAttributionOutput?: (
        cells: Array<{ cellKey: string; route: string; result: unknown }>,
        options: { profilesExplicit: boolean; profiles: unknown[] },
      ) => unknown;
      browserProfileCellKey?: (profileName: string, route: string) => string;
      missingReadinessFlags?: (instrumentation: Record<string, boolean>) => string[];
      parseBrowserProfiles?: (value?: string) => Array<{
        name: string;
        width: number;
        height: number;
        dpr: number;
        isMobile: boolean;
        hasTouch: boolean;
      }>;
    })
  : {};

describe("CLS attribution browser profiles", () => {
  it("defaults to the existing Lighthouse-equivalent mobile device", () => {
    expect(optionsModule.parseBrowserProfiles?.()).toEqual([
      {
        name: "mobile-lighthouse",
        width: 412,
        height: 823,
        dpr: 1.75,
        isMobile: true,
        hasTouch: true,
      },
    ]);
  });

  it("parses named mobile and desktop profiles with complete device semantics", () => {
    expect(optionsModule.parseBrowserProfiles?.("mobile-lighthouse,desktop-1350")).toEqual([
      {
        name: "mobile-lighthouse",
        width: 412,
        height: 823,
        dpr: 1.75,
        isMobile: true,
        hasTouch: true,
      },
      {
        name: "desktop-1350",
        width: 1350,
        height: 940,
        dpr: 1,
        isMobile: false,
        hasTouch: false,
      },
    ]);
  });

  it("supports the selected responsive desktop attribution profiles", () => {
    expect(
      optionsModule.parseBrowserProfiles?.(
        "desktop-800,desktop-1024,desktop-1025,desktop-1279,desktop-1280,desktop-1440",
      ),
    ).toEqual([
      {
        name: "desktop-800",
        width: 800,
        height: 900,
        dpr: 1,
        isMobile: false,
        hasTouch: false,
      },
      {
        name: "desktop-1024",
        width: 1024,
        height: 900,
        dpr: 1,
        isMobile: false,
        hasTouch: false,
      },
      {
        name: "desktop-1025",
        width: 1025,
        height: 900,
        dpr: 1,
        isMobile: false,
        hasTouch: false,
      },
      {
        name: "desktop-1279",
        width: 1279,
        height: 900,
        dpr: 1,
        isMobile: false,
        hasTouch: false,
      },
      {
        name: "desktop-1280",
        width: 1280,
        height: 900,
        dpr: 1,
        isMobile: false,
        hasTouch: false,
      },
      {
        name: "desktop-1440",
        width: 1440,
        height: 900,
        dpr: 1,
        isMobile: false,
        hasTouch: false,
      },
    ]);
  });

  it("rejects unknown and duplicate profile names", () => {
    expect(() => optionsModule.parseBrowserProfiles?.("mobile-lighthouse,tablet")).toThrow(/unknown.*tablet/i);
    expect(() => optionsModule.parseBrowserProfiles?.("desktop-1350,desktop-1350")).toThrow(/duplicate.*desktop-1350/i);
  });

  it("builds deterministic profile and route cell keys", () => {
    expect(optionsModule.browserProfileCellKey?.("desktop-1350", "/documents/search")).toBe(
      "desktop-1350::/documents/search",
    );
  });

  it("preserves the legacy route-keyed output when no profile flag is supplied", () => {
    const result = { total: 0.01, instrumentation: { clsObserverReady: true } };
    expect(
      optionsModule.buildClsAttributionOutput?.([{ cellKey: "mobile-lighthouse::/", route: "/", result }], {
        profilesExplicit: false,
        profiles: [{ name: "mobile-lighthouse" }],
      }),
    ).toEqual({ "/": result });
  });

  it("uses a versioned cells collection for explicit multi-profile output", () => {
    const mobile = { total: 0.01 };
    const desktop = { total: 0.02 };
    const profiles = [{ name: "mobile-lighthouse" }, { name: "desktop-1350" }];
    expect(
      optionsModule.buildClsAttributionOutput?.(
        [
          { cellKey: "mobile-lighthouse::/", route: "/", result: mobile },
          { cellKey: "desktop-1350::/", route: "/", result: desktop },
        ],
        { profilesExplicit: true, profiles },
      ),
    ).toEqual({
      schemaVersion: 2,
      profiles,
      cells: {
        "mobile-lighthouse::/": mobile,
        "desktop-1350::/": desktop,
      },
    });
  });

  it("serializes only completed cells and never invents missing matrix results", () => {
    const completed = { total: 0.239 };
    expect(
      optionsModule.buildClsAttributionOutput?.([{ cellKey: "mobile-lighthouse::/", route: "/", result: completed }], {
        profilesExplicit: true,
        profiles: [{ name: "mobile-lighthouse" }, { name: "desktop-1350" }],
      }),
    ).toEqual({
      schemaVersion: 2,
      profiles: [{ name: "mobile-lighthouse" }, { name: "desktop-1350" }],
      cells: { "mobile-lighthouse::/": completed },
    });
  });

  it("represents a current run with no completed cells as an empty collection", () => {
    expect(
      optionsModule.buildClsAttributionOutput?.([], {
        profilesExplicit: true,
        profiles: [{ name: "mobile-lighthouse" }, { name: "desktop-1350" }],
      }),
    ).toEqual({
      schemaVersion: 2,
      profiles: [{ name: "mobile-lighthouse" }, { name: "desktop-1350" }],
      cells: {},
    });
  });

  it("reports exact missing instrumentation flags in stable order", () => {
    expect(
      optionsModule.missingReadinessFlags?.({
        clsObserverReady: false,
        reserveObserverReady: true,
        geometryObserverReady: false,
      }),
    ).toEqual(["clsObserverReady", "geometryObserverReady"]);
  });
});

describe("CLS attribution evidence contract", () => {
  it("accepts zero-shift cells only when every observer reports successful installation", () => {
    expect(source).toContain("const cellsMissingInstrumentation = resultCells");
    expect(source).toContain("window.__clsObserverReady = true");
    expect(source).toContain("window.__reserveObserverReady = true");
    expect(source).toContain("window.__geometryObserverReady = true");
    expect(source).toContain("missingReadinessFlags(result.instrumentation)");
    expect(source).toContain('missing.join(",")');
    expect(source).toContain("if (cellsMissingInstrumentation.length > 0)");
    expect(source).toContain("Treat those cells as failed evidence");
  });

  it("creates a requested nested evidence directory before the atomic temporary write", () => {
    expect(source).toContain("mkdirSync(path.dirname(outFile), { recursive: true })");
    expect(source.indexOf("mkdirSync(path.dirname(outFile)")).toBeLessThan(
      source.indexOf("writeFileSync(temporaryOutFile"),
    );
    expect(source.indexOf("writeFileSync(temporaryOutFile")).toBeLessThan(
      source.indexOf("renameSync(temporaryOutFile, outFile)"),
    );
  });

  it("selects a free managed project port by default", () => {
    expect(source).toContain('import net from "node:net";');
    expect(source).toContain("circularProjectPortRange");
    expect(source).toContain("findFreePort(stableProjectPort(projectRoot))");
    expect(source).toContain("port < projectPortStart");
    expect(source).toContain("port > projectPortEnd");
    expect(source).not.toContain('flag("port", "4611")');
  });

  it("bounds readiness requests and releases the heavy-run lock after cleanup failures", () => {
    expect(source).toContain('import { waitForHttpReadiness } from "./lib/http-readiness.mjs";');
    expect(source).toContain("requestTimeoutMs: 5_000");
    expect(source).toContain("timeoutMs: 120_000");
    expect(source).toMatch(
      /try \{\s+stopOwnedProcessTree\(server\);\s+\} finally \{\s+removePathSync\(absoluteRunRoot, \{ recursive: true \}\);\s+\}/,
    );
    expect(source).toMatch(/\} finally \{\s+lock\.release\(\);\s+\}\s+\}\s*$/);
  });

  it("uses the shared browser-runner safety boundaries", () => {
    expect(source).toContain('acquireHeavyRunLock({ projectRoot, command: "measure-cls-attribution" })');
    expect(source).toContain('import { removePathSync } from "./retryable-fs.mjs";');
    expect(source).toContain("/api/local-project-id");
    expect(source).toContain("payload.projectId === localProjectId(projectRoot)");
    expect(source).toContain('spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"]');
    expect(source).not.toContain("rmSync(");
  });

  it("records complete browser-profile metadata in each stable output cell", () => {
    expect(source).toContain('flag("profiles", undefined)');
    expect(source).toContain("for (const profile of profiles)");
    expect(source).toContain("browserProfileCellKey(profile.name, route)");
    expect(source).toContain("deviceScaleFactor: profile.dpr");
    expect(source).toContain("profile: { ...profile }");
    expect(source).toContain("buildClsAttributionOutput(resultCells");
  });

  it("keeps degraded exercises opt-in and bounds race-proof asset readiness", () => {
    expect(source).toContain('argv.includes("--exercise-offline")');
    expect(source).toContain('argv.includes("--exercise-local-identity-unavailable")');
    expect(source).not.toContain("--exercise-api-unavailable");
    expect(source).toContain("await waitForLoadedAssets(page)");
    expect(source).toContain("window.__clsObserverReady === true");
    expect(source).toContain("window.__reserveObserverReady === true");
    expect(source).toContain("ASSET_READINESS_TIMEOUT_MS");
    expect(source).toContain("if (image.complete) finish()");
    expect(source).toContain("clearTimeout(timeout)");
    expect(source).toContain("Asset readiness timed out");
    expect(source.indexOf("await waitForLoadedAssets(page)")).toBeLessThan(
      source.lastIndexOf("await exerciseDegradedTransitions({ page, context })"),
    );
  });

  it("records offline and reconnecting phases through browser network state", () => {
    expect(source).toContain('await markPhase(page, "healthy")');
    expect(source).toContain('await markPhase(page, "offline")');
    expect(source).toContain("await context.setOffline(true)");
    expect(source).toContain('await markPhase(page, "reconnecting")');
    expect(source).toContain("await context.setOffline(false)");
    expect(source).toContain("navigator.onLine === true");
    expect(source).toContain('await waitForDegradedNotice(page, "absent")');
    expect(source).toContain("await waitForHealthySetupResponse(page)");
  });

  it("faults exactly one post-healthy local identity refresh and removes the route", () => {
    expect(source).toContain('NEXT_PUBLIC_DEMO_MODE: "true"');
    expect(source).not.toContain('NEXT_PUBLIC_DEMO_MODE: exerciseLocalIdentityUnavailable ? "false" : "true"');
    expect(source).toContain('const localIdentityPattern = "**/api/local-project-id**"');
    expect(source).toContain("localIdentityUnavailableInterceptHits += 1");
    expect(source).toContain("{ times: 1 }");
    expect(source).toContain("status: 503");
    expect(source).toContain("localIdentityUnavailableInterceptHits !== 1");
    expect(source).toContain("await page.unroute(localIdentityPattern, unavailableHandler)");
    expect(source).toContain("isLocalIdentityResponse(response, 503)");
    expect(source).toContain('await markPhase(page, "local-identity-unavailable")');
    expect(source).toContain('window.dispatchEvent(new Event("focus"))');
    expect(source).toContain('await waitForDegradedNotice(page, "service-unavailable")');
    expect(source).toContain("localIdentityUnavailable: exerciseLocalIdentityUnavailable");
    expect(source).not.toContain("apiUnavailable: exerciseApiUnavailable");
    expect(source.indexOf("await waitForLoadedAssets(page)")).toBeLessThan(
      source.lastIndexOf("await exerciseDegradedTransitions({ page, context })"),
    );
  });

  it("proves initial health with the expected local identity payload on every exercised route", () => {
    expect(source).toContain("const initialHealthyLocalIdentityResponse = exerciseLocalIdentityUnavailable");
    expect(source).toContain("function waitForHealthyLocalIdentityResponse(page)");
    expect(source).toContain("isLocalIdentityResponse(response, 200) && isThisProject(await response.text())");
    expect(source).toContain("Initial local identity validation failed");
    expect(source).toContain("await initialHealthyLocalIdentityResponse");
    expect(source).not.toContain("const initialHealthySetupResponse = exerciseLocalIdentityUnavailable");
  });

  it("requires a clean degraded-notice baseline before installing the identity fault", () => {
    const exerciseStart = source.indexOf("if (exerciseLocalIdentityUnavailable) {");
    const absenceCheck = source.indexOf("await requireNoDegradedNoticeBeforeIdentityFault(page);", exerciseStart);
    const routeInstall = source.indexOf("await page.route(localIdentityPattern, unavailableHandler", exerciseStart);
    expect(absenceCheck).toBeGreaterThan(exerciseStart);
    expect(absenceCheck).toBeLessThan(routeInstall);
    expect(source).toContain(
      "Cannot exercise local identity outage: degraded notice was present before fault installation.",
    );
  });

  it("atomically checkpoints each completed cell and always closes its browser context", () => {
    expect(source).toContain('import { mkdirSync, renameSync, writeFileSync } from "node:fs"');
    expect(source).toContain("function writeResultsArtifact(resultCells)");
    expect(source).toContain("writeFileSync(temporaryOutFile");
    expect(source).toContain("renameSync(temporaryOutFile, outFile)");
    expect(source).toContain("removePathSync(temporaryOutFile)");
    expect(source.match(/writeResultsArtifact\(resultCells\);/g)).toHaveLength(2);
    expect(source.indexOf("resultCells.push({ cellKey, route, result });")).toBeLessThan(
      source.indexOf(
        "writeResultsArtifact(resultCells);",
        source.indexOf("resultCells.push({ cellKey, route, result });"),
      ),
    );
    expect(source).toContain("} finally {\n        await context.close();\n      }");
  });

  it("invalidates stale output immediately after taking the heavy-run lock", () => {
    const lockAcquired = source.indexOf(
      'const lock = acquireHeavyRunLock({ projectRoot, command: "measure-cls-attribution" });',
    );
    const emptyCheckpoint = source.indexOf("writeResultsArtifact([]);", lockAcquired);
    const buildPreparation = source.indexOf("mkdirSync(absoluteRunRoot, { recursive: true });", lockAcquired);
    expect(emptyCheckpoint).toBeGreaterThan(lockAcquired);
    expect(emptyCheckpoint).toBeLessThan(buildPreparation);
  });

  it("attributes delayed CLS callbacks against unrounded phase boundaries", () => {
    expect(source).toContain("window.__clsPhases");
    expect(source).toContain("t: performance.now()");
    expect(source).toContain("phaseForStartTime(entry.startTime)");
    expect(source).not.toContain('window.__clsPhase = "initial"');
    expect(source).not.toContain('__clsPhases = [{ phase: "initial", t: Math.round');
    expect(source).not.toContain("__clsPhases.push({ phase, t: Math.round");
  });

  it("records separate composer, desktop-header, phone-header, and LCP candidate geometry", () => {
    expect(source).toContain("modeHomeComposerSlot");
    expect(source).toContain("phoneStickyHeader");
    expect(source).toContain("desktopHeaderCollapse");
    expect(source).toContain('[data-testid="universal-header-collapse"]');
    expect(source).toContain("rootStartState");
    expect(source).toContain("documentsStartState");
    expect(source).toContain("firstPaint");
    expect(source).toContain("settled");
  });
});
