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

// The suite-wide Playwright config blocks service workers (they hijack navigations
// in production builds); this spec is the one place the worker itself is under test.
test.use({ serviceWorkers: "allow" });

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

  test("keeps the install surface polished, reachable, and clear of search at every target width", async ({ page }) => {
    const viewports = [
      { name: "compact phone", width: 320, height: 720 },
      { name: "phone", width: 390, height: 844 },
      { name: "wide phone", width: 639, height: 900 },
      { name: "small tablet", width: 768, height: 1024 },
      { name: "tablet", width: 820, height: 1180 },
      { name: "desktop", width: 1440, height: 1000 },
      { name: "wide desktop", width: 1920, height: 1080 },
    ] as const;

    for (const viewport of viewports) {
      await test.step(viewport.name, async () => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto("/?mode=answer&pwa-dev=0", { waitUntil: "domcontentloaded" });
        await expect(page.locator("header#search").first()).toBeVisible({ timeout: 20_000 });
        await page.waitForFunction(() => document.documentElement.dataset.pwaDisplayMode === "browser");

        await page.evaluate(() => {
          (window as typeof window & { __pwaPromptLayoutShift?: number }).__pwaPromptLayoutShift = 0;
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
              if (!shift.hadRecentInput) {
                (window as typeof window & { __pwaPromptLayoutShift?: number }).__pwaPromptLayoutShift! += shift.value;
              }
            }
          }).observe({ type: "layout-shift" });

          const event = new Event("beforeinstallprompt", { cancelable: true });
          Object.assign(event, {
            prompt: () => Promise.resolve(),
            userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
          });
          window.dispatchEvent(event);
        });

        const install = page.getByRole("region", { name: "Install Clinical KB" });
        await expect(install).toBeVisible();
        await page.evaluate(
          () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
        );
        await expect(install).toContainText("Clinical guidelines on your home screen.");
        await expect(install).toContainText(
          "Open it from your device like an app. Private clinical features still require a connection.",
        );
        await expect(install).toContainText("Free · No app store · Takes a few seconds");
        if (viewport.width < 640) {
          await expect(install.getByText("Quick access · No app store")).toBeVisible();
        } else {
          await expect(install.getByRole("list", { name: "Install benefits" })).toContainText(
            "Quick accessApp-like launchFamiliar workspace",
          );
        }

        const geometry = await install.evaluate((surface) => {
          const rect = surface.getBoundingClientRect();
          const installAction = surface.querySelector<HTMLElement>(".pwa-install-primary")?.getBoundingClientRect();
          const secondaryAction = surface.querySelector<HTMLElement>(".pwa-install-secondary")?.getBoundingClientRect();
          const dismissAction = surface.querySelector<HTMLElement>(".pwa-install-dismiss")?.getBoundingClientRect();
          const visibleSearch = Array.from(
            document.querySelectorAll<HTMLElement>('[data-testid="global-search-input"]'),
          ).find((node) => {
            const candidate = node.getBoundingClientRect();
            return candidate.width > 0 && candidate.height > 0;
          });
          const searchRect =
            visibleSearch?.closest<HTMLElement>(".chat-composer-shell-base")?.getBoundingClientRect() ??
            visibleSearch?.getBoundingClientRect();
          const overlap = searchRect
            ? Math.max(0, Math.min(rect.right, searchRect.right) - Math.max(rect.left, searchRect.left)) *
              Math.max(0, Math.min(rect.bottom, searchRect.bottom) - Math.max(rect.top, searchRect.top))
            : 0;

          return {
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
            installActionHeight: installAction?.height ?? 0,
            secondaryActionHeight: secondaryAction?.height ?? 0,
            dismissActionHeight: dismissAction?.height ?? 0,
            overlap,
            hasInternalScroll: surface.scrollHeight > surface.clientHeight + 1,
            pageScrollWidth: document.documentElement.scrollWidth,
            viewportWidth: window.innerWidth,
            promptLayoutShift:
              (window as typeof window & { __pwaPromptLayoutShift?: number }).__pwaPromptLayoutShift ?? 0,
          };
        });

        expect(geometry.left, `${viewport.name}: left inset`).toBeGreaterThanOrEqual(7);
        expect(geometry.right, `${viewport.name}: right inset`).toBeLessThanOrEqual(viewport.width - 7);
        expect(geometry.top, `${viewport.name}: top clearance`).toBeGreaterThanOrEqual(8);
        expect(geometry.bottom, `${viewport.name}: bottom clearance`).toBeLessThanOrEqual(viewport.height - 8);
        expect(geometry.installActionHeight, `${viewport.name}: Install app target`).toBeGreaterThanOrEqual(48);
        expect(geometry.secondaryActionHeight, `${viewport.name}: Not now target`).toBeGreaterThanOrEqual(48);
        expect(geometry.dismissActionHeight, `${viewport.name}: Dismiss target`).toBeGreaterThanOrEqual(48);
        expect(geometry.overlap, `${viewport.name}: install surface must not overlap search`).toBe(0);
        expect(geometry.promptLayoutShift, `${viewport.name}: prompt must not shift page content`).toBeLessThanOrEqual(
          0.02,
        );
        expect(geometry.hasInternalScroll, `${viewport.name}: complete value proposition should fit`).toBe(false);
        expect(geometry.pageScrollWidth, `${viewport.name}: no horizontal overflow`).toBeLessThanOrEqual(
          geometry.viewportWidth,
        );

        if (viewport.width >= 640) {
          expect(geometry.width, `${viewport.name}: restrained card width`).toBeGreaterThanOrEqual(380);
          expect(geometry.width, `${viewport.name}: restrained card width`).toBeLessThanOrEqual(440);
          expect(geometry.right, `${viewport.name}: right-corner anchor`).toBeGreaterThanOrEqual(viewport.width - 32);
        } else {
          expect(geometry.height, `${viewport.name}: compact phone sheet`).toBeLessThan(viewport.height * 0.7);
        }
      });
    }
  });

  test("keeps constrained install actions reachable in a short phone viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 400 });
    await page.goto("/?mode=answer&pwa-dev=0", { waitUntil: "domcontentloaded" });
    await expect(page.locator("header#search").first()).toBeVisible({ timeout: 20_000 });
    await page.waitForFunction(() => document.documentElement.dataset.pwaDisplayMode === "browser");

    await page.evaluate(() => {
      const event = new Event("beforeinstallprompt", { cancelable: true });
      Object.assign(event, {
        prompt: () => Promise.resolve(),
        userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
      });
      window.dispatchEvent(event);
    });

    const install = page.getByRole("region", { name: "Install Clinical KB" });
    await expect(install).toBeVisible();
    const scrollState = await install.evaluate((surface) => ({
      clientHeight: surface.clientHeight,
      scrollHeight: surface.scrollHeight,
      overflowY: getComputedStyle(surface).overflowY,
    }));
    expect(scrollState.scrollHeight).toBeLessThanOrEqual(scrollState.clientHeight + 1);
    expect(scrollState.overflowY).toMatch(/auto|scroll/);
    await expect(install.getByRole("button", { name: "Install app" })).toBeInViewport();
    await expect(install.getByRole("button", { name: "Not now" })).toBeInViewport();
  });

  test("keeps the install surface clear of the submitted answer composer", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/?mode=answer&q=lithium&run=1&pwa-dev=0", { waitUntil: "domcontentloaded" });
    await expect(page.locator("header#search").first()).toBeVisible({ timeout: 20_000 });
    await page.waitForFunction(() => document.documentElement.dataset.pwaDisplayMode === "browser");

    await page.evaluate(() => {
      const event = new Event("beforeinstallprompt", { cancelable: true });
      Object.assign(event, {
        prompt: () => Promise.resolve(),
        userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
      });
      window.dispatchEvent(event);
    });

    const install = page.getByRole("region", { name: "Install Clinical KB" });
    const composer = page.locator("form.answer-footer-search-edge:visible").first();
    await expect(install).toBeVisible();
    await expect(composer).toBeVisible();

    const overlap = await install.evaluate((surface, selector) => {
      const composerSurface = document.querySelector<HTMLElement>(selector);
      if (!composerSurface) return -1;
      const card = surface.getBoundingClientRect();
      const dock = composerSurface.getBoundingClientRect();
      return (
        Math.max(0, Math.min(card.right, dock.right) - Math.max(card.left, dock.left)) *
        Math.max(0, Math.min(card.bottom, dock.bottom) - Math.max(card.top, dock.top))
      );
    }, "form.answer-footer-search-edge");
    expect(overlap).toBe(0);
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
