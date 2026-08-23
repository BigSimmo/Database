import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../scripts/measure-cls-attribution.mjs", import.meta.url), "utf8");
const optionsModuleUrl = new URL("../scripts/lib/cls-attribution-options.mjs", import.meta.url);
const optionsModule = existsSync(optionsModuleUrl)
  ? ((await import(optionsModuleUrl.href)) as {
      browserProfileCellKey?: (profileName: string, route: string) => string;
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
    expect(optionsModule.parseBrowserProfiles?.("desktop-800,desktop-1280,desktop-1440")).toEqual([
      {
        name: "desktop-800",
        width: 800,
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
});

describe("CLS attribution evidence contract", () => {
  it("accepts zero-shift routes only when both observers report successful installation", () => {
    expect(source).toContain("const routesMissingInstrumentation = Object.entries(results)");
    expect(source).toContain("window.__clsObserverReady = true");
    expect(source).toContain("window.__reserveObserverReady = true");
    expect(source).toContain("!result.instrumentation.clsObserverReady");
    expect(source).toContain("!result.instrumentation.reserveObserverReady");
    expect(source).toContain("if (routesMissingInstrumentation.length > 0)");
    expect(source).toContain("Treat those routes as failed evidence");
  });

  it("creates a requested nested evidence directory before writing", () => {
    expect(source).toContain("mkdirSync(path.dirname(outFile), { recursive: true })");
    expect(source.indexOf("mkdirSync(path.dirname(outFile)")).toBeLessThan(source.indexOf("writeFileSync(outFile"));
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
  });

  it("keeps degraded exercises opt-in and waits for loaded assets and observers", () => {
    expect(source).toContain('argv.includes("--exercise-offline")');
    expect(source).toContain('argv.includes("--exercise-api-unavailable")');
    expect(source).toContain("await waitForLoadedAssets(page)");
    expect(source).toContain("window.__clsObserverReady === true");
    expect(source).toContain("window.__reserveObserverReady === true");
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
  });

  it("faults a post-load identity refresh and uses the dashboard focus retry for API-unavailable", () => {
    expect(source).toContain('NEXT_PUBLIC_DEMO_MODE: exerciseApiUnavailable ? "false" : "true"');
    expect(source).toContain('await page.route("**/api/local-project-id**"');
    expect(source).toContain("status: 503");
    expect(source).toContain('await markPhase(page, "api-unavailable")');
    expect(source).toContain('window.dispatchEvent(new Event("focus"))');
    expect(source.indexOf("await waitForLoadedAssets(page)")).toBeLessThan(
      source.lastIndexOf("await exerciseDegradedTransitions({ page, context })"),
    );
  });

  it("tags CLS entries with phases and records responsive geometry and LCP candidate timing", () => {
    expect(source).toContain("window.__clsPhase");
    expect(source).toContain("window.__clsPhases");
    expect(source).toContain("phase: window.__clsPhase");
    expect(source).toContain("modeHomeComposerSlot");
    expect(source).toContain("phoneStickyHeader");
    expect(source).toContain("rootStartState");
    expect(source).toContain("documentsStartState");
    expect(source).toContain("firstPaint");
    expect(source).toContain("settled");
  });
});
