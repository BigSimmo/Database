import { expect, test, type BrowserContext, type Page } from "playwright/test";

const PWA_ENTRY = "/?pwa-dev=1";
const WORKER_PATH = "/sw.js";
const PWA_CACHE_PREFIX = "clinical-kb-pwa-";

type ManifestIcon = {
  src: string;
  type: string;
  sizes: string;
  purpose?: string;
};

type IconProbe = {
  src: string;
  status: number;
  mime: string;
  width: number | null;
  height: number | null;
  hasPngSignature: boolean | null;
};

async function openControlledPwa(page: Page) {
  await page.goto(PWA_ENTRY, { waitUntil: "load" });

  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration("/");
          return registration?.active?.state ?? "missing";
        }),
      { message: "the root-scope PWA worker should activate", timeout: 30_000 },
    )
    .toBe("activated");

  // A controlled navigation gives Chromium a stable point at which to evaluate
  // the matching worker and avoids asserting transient installability errors.
  await page.reload({ waitUntil: "load" });
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? ""), {
      message: "the page should be controlled by the PWA worker",
      timeout: 15_000,
    })
    .toMatch(/\/sw\.js$/);
}

async function probeManifestIcons(page: Page, icons: ManifestIcon[]): Promise<IconProbe[]> {
  return page.evaluate(async (manifestIcons) => {
    const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];

    return Promise.all(
      manifestIcons.map(async (icon) => {
        const response = await fetch(new URL(icon.src, window.location.origin), {
          cache: "no-store",
          credentials: "omit",
        });
        const body = await response.arrayBuffer();
        const bytes = new Uint8Array(body);
        const mime = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
        let width: number | null = null;
        let height: number | null = null;
        let hasPngSignature: boolean | null = null;

        if (mime === "image/png") {
          hasPngSignature = pngSignature.every((byte, index) => bytes[index] === byte);
          if (hasPngSignature && bytes.length >= 24) {
            const view = new DataView(body);
            width = view.getUint32(16);
            height = view.getUint32(20);
          }
        } else if (mime === "image/svg+xml") {
          const svg = new TextDecoder().decode(bytes);
          const viewBox = svg.match(/viewBox=["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)\s*["']/i);
          width = viewBox ? Number(viewBox[1]) : null;
          height = viewBox ? Number(viewBox[2]) : null;
        }

        return {
          src: icon.src,
          status: response.status,
          mime,
          width,
          height,
          hasPngSignature,
        };
      }),
    );
  }, icons);
}

async function clearPwaBrowserState(context: BrowserContext, page: Page) {
  await context.setOffline(false);
  if (page.isClosed() || !page.url().startsWith("http")) return;

  await page.evaluate(async (cachePrefix) => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations
        .filter((registration) => registration.active?.scriptURL.endsWith("/sw.js"))
        .map((registration) => registration.unregister()),
    );
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.filter((cacheName) => cacheName.startsWith(cachePrefix)).map((cacheName) => caches.delete(cacheName)),
    );
  }, PWA_CACHE_PREFIX);
}

function isAllowedPublicCachePath(pathname: string) {
  return (
    pathname === "/offline.html" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/icon.svg" ||
    pathname === "/apple-icon" ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/_next/static/")
  );
}

test.describe("Clinical KB PWA", () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ browserName, context }) => {
    test.skip(browserName !== "chromium", "The installability protocol and focused PWA gate are Chromium-only.");

    // This gate validates the public application shell only. Block every local
    // API and provider request so browser QA cannot consume credentials, touch
    // live data, or make a clinical workflow look available offline.
    await context.route("**/api/**", (route) => route.abort("blockedbyclient"));
    await context.route(/^https:\/\/[^/]*\.supabase\.co\//i, (route) => route.abort("blockedbyclient"));
    await context.route(/^https:\/\/api\.openai\.com\//i, (route) => route.abort("blockedbyclient"));
  });

  test.afterEach(async ({ browserName, context, page }) => {
    if (browserName === "chromium") await clearPwaBrowserState(context, page);
  });

  test("has a browser-valid manifest, installable icons, and a root worker", async ({ context, page }) => {
    await openControlledPwa(page);

    const session = await context.newCDPSession(page);
    const appManifest = await session.send("Page.getAppManifest");
    expect(new URL(appManifest.url).pathname).toBe("/manifest.webmanifest");
    expect(appManifest.errors, JSON.stringify(appManifest.errors)).toEqual([]);
    expect(appManifest.data).toBeTruthy();

    const manifest = JSON.parse(appManifest.data ?? "{}") as {
      id?: string;
      start_url?: string;
      scope?: string;
      display?: string;
      icons?: ManifestIcon[];
    };
    expect(manifest).toMatchObject({ id: "/", start_url: "/", scope: "/", display: "standalone" });

    const icons = manifest.icons ?? [];
    expect(icons.length).toBeGreaterThanOrEqual(5);
    const probes = await probeManifestIcons(page, icons);
    const probesBySource = new Map(probes.map((probe) => [probe.src, probe]));

    for (const icon of icons) {
      const probe = probesBySource.get(icon.src);
      if (!probe) throw new Error(`Manifest icon was not probed: ${icon.src}`);

      expect(probe.status, icon.src).toBe(200);
      expect(probe.mime, icon.src).toBe(icon.type);
      expect(probe.width, icon.src).toBeGreaterThan(0);
      expect(probe.height, icon.src).toBeGreaterThan(0);

      if (icon.sizes !== "any") {
        const size = icon.sizes.match(/^(\d+)x(\d+)$/);
        expect(size, `${icon.src} should declare concrete dimensions`).not.toBeNull();
        expect(probe.width, icon.src).toBe(Number(size?.[1]));
        expect(probe.height, icon.src).toBe(Number(size?.[2]));
        expect(probe.hasPngSignature, icon.src).toBe(true);
      }
    }

    const workerResponse = await context.request.get(new URL(WORKER_PATH, page.url()).toString());
    expect(workerResponse.status()).toBe(200);
    const workerHeaders = workerResponse.headers();
    expect(workerHeaders["content-type"]).toMatch(/^application\/javascript\b/i);
    expect(workerHeaders["cache-control"]).toContain("no-cache");
    expect(workerHeaders["cache-control"]).toContain("no-store");
    expect(workerHeaders["service-worker-allowed"]).toBe("/");
    expect(workerHeaders["cross-origin-resource-policy"]).toBe("same-origin");
    expect(workerHeaders["content-security-policy"]).toContain("default-src 'self'");
    expect(workerHeaders["content-security-policy"]).toContain("script-src 'self'");
    expect(workerHeaders["set-cookie"]).toBeUndefined();

    const manifestResponse = await context.request.get(new URL("/manifest.webmanifest", page.url()).toString());
    expect(manifestResponse.status()).toBe(200);
    expect(manifestResponse.headers()["content-type"]).toMatch(/^application\/manifest\+json\b/i);
    expect(manifestResponse.headers()["cache-control"]).toContain("must-revalidate");
    expect(manifestResponse.headers()["set-cookie"]).toBeUndefined();

    const offlineDocumentResponse = await context.request.get(new URL("/offline.html", page.url()).toString());
    expect(offlineDocumentResponse.status()).toBe(200);
    expect(offlineDocumentResponse.headers()["content-security-policy"]).toContain("default-src 'none'");
    expect(offlineDocumentResponse.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    expect(offlineDocumentResponse.headers()["set-cookie"]).toBeUndefined();

    const svgIconResponse = await context.request.get(new URL("/icon.svg", page.url()).toString());
    expect(svgIconResponse.status()).toBe(200);
    expect(svgIconResponse.headers()["content-type"]).toMatch(/^image\/svg\+xml\b/i);
    expect(svgIconResponse.headers()["set-cookie"]).toBeUndefined();

    const workerState = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration("/");
      return {
        origin: window.location.origin,
        scope: registration?.scope ?? null,
        scriptURL: registration?.active?.scriptURL ?? null,
        activeState: registration?.active?.state ?? null,
        updateViaCache: registration?.updateViaCache ?? null,
        controllerURL: navigator.serviceWorker.controller?.scriptURL ?? null,
      };
    });
    expect(workerState).toEqual({
      origin: workerState.origin,
      scope: `${workerState.origin}/`,
      scriptURL: `${workerState.origin}/sw.js`,
      activeState: "activated",
      updateViaCache: "none",
      controllerURL: `${workerState.origin}/sw.js`,
    });

    await expect
      .poll(
        async () => {
          const { installabilityErrors } = await session.send("Page.getInstallabilityErrors");
          return installabilityErrors.map((error) => error.errorId);
        },
        {
          message: "Chromium should report no stable installability errors after the root worker controls the page",
          timeout: 15_000,
        },
      )
      .toEqual([]);
  });

  test("serves a cold offline fallback, recovers online, and keeps private URLs out of CacheStorage", async ({
    context,
    page,
  }) => {
    await openControlledPwa(page);

    await context.setOffline(true);
    const coldPath = `/pwa-offline-cold-${Date.now()}`;
    const offlineResponse = await page.goto(coldPath, { waitUntil: "domcontentloaded" });
    expect(offlineResponse?.status()).toBe(200);
    expect(offlineResponse?.fromServiceWorker()).toBe(true);
    await expect(page).toHaveURL(new RegExp(`${coldPath}$`));
    await expect(page.getByRole("heading", { name: "Clinical KB is offline" })).toBeVisible();
    await expect(page.getByText("does not store or replay clinical queries", { exact: false })).toBeVisible();

    await context.setOffline(false);
    await Promise.all([
      page.waitForURL((url) => url.pathname === "/" && url.search === "", { waitUntil: "domcontentloaded" }),
      page.getByRole("link", { name: "Try again" }).click(),
    ]);
    await expect(page).toHaveTitle("Clinical KB");
    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Clinical KB is offline" })).toHaveCount(0);

    const privateProbePath = `/api/pwa-private-probe-${Date.now()}`;
    await context.route(`**${privateProbePath}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Cache-Control": "private, no-store" },
        body: JSON.stringify({ private: true }),
      }),
    );
    const privateProbe = await page.evaluate(async (path) => {
      const response = await fetch(path, { credentials: "include" });
      return { status: response.status, body: await response.json() };
    }, privateProbePath);
    expect(privateProbe).toEqual({ status: 200, body: { private: true } });
    const privateProbeUrl = new URL(privateProbePath, page.url()).href;

    const inventory = await page.evaluate(async () => {
      const entries: Array<{ cacheName: string; url: string }> = [];
      for (const cacheName of await caches.keys()) {
        const cache = await caches.open(cacheName);
        for (const request of await cache.keys()) entries.push({ cacheName, url: request.url });
      }
      return entries;
    });

    expect(inventory.length).toBeGreaterThan(0);
    expect(inventory.map((entry) => entry.url)).not.toContain(privateProbeUrl);
    const origin = new URL(page.url()).origin;
    const sensitivePath = /\/(?:api|auth|login|account|documents?|search|answers?|uploads?)(?:\/|$)/i;
    for (const entry of inventory) {
      const cachedUrl = new URL(entry.url);
      expect(entry.cacheName).toMatch(new RegExp(`^${PWA_CACHE_PREFIX}`));
      expect(cachedUrl.origin, entry.url).toBe(origin);
      expect(cachedUrl.search, entry.url).toBe("");
      expect(cachedUrl.pathname, entry.url).not.toMatch(sensitivePath);
      expect(isAllowedPublicCachePath(cachedUrl.pathname), entry.url).toBe(true);
    }
  });
});
