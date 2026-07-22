import { resolve } from "node:path";
import type { Route } from "playwright-core";
import { expect, test, type Page } from "playwright/test";

import { demoDocuments, getDemoDocument, getDemoDocumentPayload } from "../src/lib/demo-data";
import {
  differentialDiagnosesCards,
  getDifferentialDetailContext,
  getDifferentialRecord,
} from "../src/lib/differentials";
import { loadMedicationSnapshot } from "../src/lib/medication-snapshot";

const routeViewports = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "phone", width: 390, height: 844 },
] as const;

const readySetupChecks = [
  { id: "env", label: ".env.local configured", status: "ready", detail: "Local route fixture ready." },
  { id: "project", label: "Clinical KB Database target", status: "ready", detail: "Local route fixture ready." },
  { id: "schema", label: "supabase/schema.sql applied", status: "ready", detail: "Local route fixture ready." },
  { id: "search", label: "Search RPC and vector indexes", status: "ready", detail: "Local route fixture ready." },
  { id: "openai", label: "OpenAI API key available", status: "ready", detail: "Not used by this test." },
  { id: "worker", label: "npm run worker running", status: "unknown", detail: "Not required by this test." },
];

const problemsByPage = new WeakMap<Page, string[]>();

async function blockExternalRequests(page: Page, problems: string[]) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)
    ) {
      problems.push(`external ${route.request().method()} ${url.origin}${url.pathname}`);
      await route.abort("blockedbyclient");
      return;
    }
    await route.fallback();
  });
}

async function fulfillDocumentRequest(route: Route, pathname: string, url: URL) {
  const signedUrlMatch = pathname.match(/^\/api\/documents\/([^/]+)\/signed-url$/);
  if (signedUrlMatch) {
    const document = getDemoDocument(decodeURIComponent(signedUrlMatch[1]));
    if (!document) {
      await route.fulfill({ status: 404, json: { error: "Local demo document not found." } });
      return true;
    }
    await route.fulfill({
      json: { url: document.storage_path, fileType: document.file_type, demoMode: true },
    });
    return true;
  }

  const documentMatch = pathname.match(/^\/api\/documents\/([^/]+)$/);
  if (!documentMatch) return false;
  const payload = getDemoDocumentPayload(
    decodeURIComponent(documentMatch[1]),
    url.searchParams.get("chunk") ?? undefined,
  );
  if (!payload) {
    await route.fulfill({ status: 404, json: { error: "Local demo document not found." } });
    return true;
  }
  await route.fulfill({ json: { ...payload, demoMode: true } });
  return true;
}

async function installOfflineApiFixtures(page: Page, problems: string[]) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const { pathname } = url;

    if (pathname === "/api/local-project-id") {
      await route.fulfill({
        json: {
          appName: "Clinical KB",
          projectId: "route-coverage-fixture",
          identityPath: "/api/local-project-id",
          localServer: { safeLocalOrigin: true },
        },
      });
      return;
    }
    if (pathname === "/api/setup-status") {
      await route.fulfill({ json: { demoMode: true, checks: readySetupChecks } });
      return;
    }
    if (pathname === "/api/medications") {
      const records = loadMedicationSnapshot();
      await route.fulfill({ json: { records, total: records.length, governance: {}, demoMode: true } });
      return;
    }
    if (pathname === "/api/documents") {
      await route.fulfill({
        json: {
          documents: demoDocuments,
          demoMode: true,
          pagination: {
            limit: 150,
            offset: 0,
            total: demoDocuments.length,
            nextOffset: demoDocuments.length,
            hasMore: false,
          },
        },
      });
      return;
    }
    if (/^\/api\/ingestion\/(jobs|batches|quality)$/.test(pathname)) {
      await route.fulfill({ json: { jobs: [], batches: [], items: [], demoMode: true } });
      return;
    }
    if (pathname === "/api/registry/records") {
      await route.fulfill({ json: { records: [], total: 0, governance: {}, demoMode: true } });
      return;
    }
    const differentialMatch = pathname.match(/^\/api\/differentials\/([^/]+)$/);
    if (differentialMatch) {
      const record = getDifferentialRecord(decodeURIComponent(differentialMatch[1]));
      if (!record) {
        await route.fulfill({ status: 404, json: { error: "Local differential fixture not found." } });
        return;
      }
      await route.fulfill({
        json: {
          record,
          detailContext: getDifferentialDetailContext(record),
          governance: { sourceStatus: "current", validationStatus: "approved" },
          demoMode: true,
        },
      });
      return;
    }
    if (await fulfillDocumentRequest(route, pathname, url)) return;

    problems.push(`api ${route.request().method()} ${pathname}`);
    await route.abort("blockedbyclient");
  });
}

async function installTherapyFixtures(page: Page) {
  await page.route("**/therapy-compass-data/*.json", async (route) => {
    const filename = new URL(route.request().url()).pathname.split("/").at(-1) ?? "";
    if (!new Set(["therapies.json", "therapies-index.json", "pathways.json", "reference.json"]).has(filename)) {
      await route.abort("blockedbyclient");
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      path: resolve(process.cwd(), "public", "therapy-compass-data", filename),
    });
  });
}

async function gotoApp(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page
    .locator("#main-content")
    .first()
    .waitFor({ state: "visible", timeout: 20_000 })
    .catch(() => undefined);
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const documentWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
          return documentWidth - document.documentElement.clientWidth;
        }),
      { timeout: 5_000 },
    )
    .toBeLessThanOrEqual(2);
}

async function proveRenderedRoute(
  page: Page,
  path: string,
  assertReady: (page: Page) => Promise<void>,
  provePhoneAction: (page: Page) => Promise<void>,
) {
  for (const viewport of routeViewports) {
    await page.setViewportSize(viewport);
    await gotoApp(page, path);
    await assertReady(page);
    await expectNoHorizontalOverflow(page);
  }
  await provePhoneAction(page);
}

test.describe("previously uncovered production routes", () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    const problems: string[] = [];
    problemsByPage.set(page, problems);
    page.on("pageerror", (error) => problems.push(`pageerror ${error.message}`));
    await blockExternalRequests(page, problems);
    await installOfflineApiFixtures(page, problems);
    await installTherapyFixtures(page);
  });

  test.afterEach(async ({ page }) => {
    expect(
      problemsByPage.get(page) ?? [],
      "route made an unmocked API/external request or raised a page error",
    ).toEqual([]);
  });

  test("Therapy Compass renders responsively and opens its local search", async ({ page }) => {
    await proveRenderedRoute(
      page,
      "/therapy-compass",
      async (currentPage) => {
        await expect(currentPage.getByRole("main")).toBeVisible();
        await expect(currentPage.getByRole("heading", { name: "Therapy mode", level: 1, exact: true })).toBeVisible({
          timeout: 30_000,
        });
      },
      async (currentPage) => {
        const search = currentPage
          .getByRole("region", { name: "Common therapy searches" })
          .getByRole("button", { name: "Anxiety in outpatient care", exact: true });
        await expect(search).toBeEnabled();
        await search.click();
        await expect(currentPage.getByRole("heading", { name: "Therapy Search", level: 1 })).toBeVisible();
      },
    );
  });

  test("DSM home renders responsively and opens comparison", async ({ page }) => {
    await proveRenderedRoute(
      page,
      "/dsm",
      async (currentPage) => {
        await expect(currentPage.getByTestId("dsm-home-main")).toBeVisible();
        await expect(currentPage.getByRole("heading", { name: "DSM-5 Diagnosis", level: 1 })).toBeVisible();
      },
      async (currentPage) => {
        const compare = currentPage.getByTestId("dsm-home-compare");
        await expect(compare).toBeEnabled();
        await compare.click();
        await expect(currentPage).toHaveURL(/\/dsm\/compare$/);
        await expect(currentPage.getByRole("heading", { name: "Compare DSM diagnoses", level: 1 })).toBeVisible();
      },
    );
  });

  test("DSM comparison renders responsively and removes a selected diagnosis", async ({ page }) => {
    await proveRenderedRoute(
      page,
      "/dsm/compare?ids=major-depressive-disorder,bipolar-ii-disorder",
      async (currentPage) => {
        await expect(currentPage.getByTestId("dsm-comparison-page")).toBeVisible();
        await expect(currentPage.getByRole("heading", { name: "Compare DSM diagnoses", level: 1 })).toBeVisible();
      },
      async (currentPage) => {
        const remove = currentPage.getByRole("link", {
          name: "Remove Major depressive disorder from comparison",
        });
        await expect(remove).toBeEnabled();
        await remove.click();
        await expect(currentPage).toHaveURL(/\/dsm\/compare\?ids=bipolar-ii-disorder$/);
        await expect(currentPage.getByRole("heading", { name: "Choose at least two diagnoses" })).toBeVisible();
      },
    );
  });

  test("DSM differential considerations render responsively and change review lens", async ({ page }) => {
    await proveRenderedRoute(
      page,
      "/dsm/diagnoses/major-depressive-disorder/differentials",
      async (currentPage) => {
        await expect(currentPage.getByTestId("dsm-differential-considerations-page")).toBeVisible();
        await expect(currentPage.getByRole("heading", { name: "Major depressive disorder", level: 1 })).toBeVisible();
      },
      async (currentPage) => {
        const medicalLens = currentPage.getByRole("button", { name: /Substance \/ medical/ });
        await expect(medicalLens).toBeEnabled();
        await medicalLens.click();
        await expect(medicalLens).toHaveAttribute("aria-pressed", "true");
      },
    );
  });

  test("Specifier comparison renders responsively and swaps both selections", async ({ page }) => {
    await proveRenderedRoute(
      page,
      "/specifiers/compare?a=with-mixed-features&b=with-anxious-distress",
      async (currentPage) => {
        await expect(currentPage.getByRole("main")).toBeVisible();
        await expect(currentPage.getByRole("heading", { name: "Compare specifiers", level: 1 })).toBeVisible();
      },
      async (currentPage) => {
        const selects = currentPage.locator("select");
        const before = await selects.evaluateAll((items) => items.map((item) => (item as HTMLSelectElement).value));
        const swap = currentPage.getByRole("button", { name: "Swap compared specifiers" });
        await expect(swap).toBeEnabled();
        await swap.click();
        await expect
          .poll(() => selects.evaluateAll((items) => items.map((item) => (item as HTMLSelectElement).value)))
          .toEqual([before[1], before[0]]);
      },
    );
  });

  test("Specifier map renders responsively and changes its selected specifier", async ({ page }) => {
    await proveRenderedRoute(
      page,
      "/specifiers/map?selected=with-anxious-distress",
      async (currentPage) => {
        await expect(currentPage.getByRole("main")).toBeVisible();
        await expect(currentPage.getByRole("heading", { name: "Specifier map", level: 1 })).toBeVisible();
      },
      async (currentPage) => {
        const mixedFeatures = currentPage.getByRole("button", { name: "Mixed features" });
        await expect(mixedFeatures).toBeEnabled();
        await mixedFeatures.click();
        await expect(mixedFeatures).toHaveAttribute("aria-pressed", "true");
        await expect(currentPage.getByRole("heading", { name: "Mixed features", level: 2 })).toBeVisible();
      },
    );
  });

  test("Differential diagnosis stream renders responsively and opens a local entry", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    const action =
      differentialDiagnosesCards.find((card) => !card.href.endsWith("/delirium")) ?? differentialDiagnosesCards[0];
    await proveRenderedRoute(
      page,
      "/differentials/diagnoses?q=delirium",
      async (currentPage) => {
        await expect(currentPage.getByRole("main")).toBeVisible();
        await expect(
          currentPage.getByRole("heading", {
            name: "Compare likely causes side-by-side and check exclusion clues.",
            level: 1,
          }),
        ).toBeVisible();
      },
      async (currentPage) => {
        const entry = currentPage.locator(`a[href="${action.href}"]`).first();
        await expect(entry).toBeVisible();
        await Promise.all([currentPage.waitForURL(new RegExp(`${action.href}$`), { timeout: 30_000 }), entry.click()]);
      },
    );
    expect(consoleErrors, "differential stream and detail should stay console-error free").toEqual([]);
  });

  test("colour-coding reference renders responsively and targets main content from the skip link", async ({ page }) => {
    await proveRenderedRoute(
      page,
      "/reference/colour-coding",
      async (currentPage) => {
        await expect(currentPage.getByRole("main")).toBeVisible();
        await expect(currentPage.getByRole("heading", { name: "Colour coding reference", level: 1 })).toBeVisible();
      },
      async (currentPage) => {
        const skipLink = currentPage.getByRole("link", { name: "Skip to main content" });
        await expect(skipLink).toHaveAttribute("href", "#main-content");
        await expect(skipLink).toBeEnabled();
        await skipLink.focus();
        await expect(skipLink).toBeVisible();
        await skipLink.press("Enter");
        const mainContent = currentPage.locator("#main-content");
        await expect(mainContent).toBeFocused();
        await expect
          .poll(() => mainContent.evaluate((element) => window.getComputedStyle(element).outlineStyle))
          .not.toBe("none");
      },
    );
  });

  test("legacy Applications redirect preserves query parameters at canonical Tools", async ({ page }) => {
    await gotoApp(page, "/applications?source=legacy&tag=one&tag=two");
    const destination = new URL(page.url());
    expect(destination.pathname).toBe("/tools");
    expect(destination.searchParams.get("source")).toBe("legacy");
    expect(destination.searchParams.getAll("tag")).toEqual(["one", "two"]);
    await expect(page.getByRole("heading", { name: "Tools", level: 1 })).toBeVisible();
  });

  test("Medications index redirects exactly to prescribing mode", async ({ page }) => {
    await gotoApp(page, "/medications");
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30_000 }).toBe("/");
    const destination = new URL(page.url());
    expect(destination.pathname).toBe("/");
    expect(destination.searchParams.toString()).toBe("mode=prescribing");
    await expect(page.getByRole("button", { name: "Mode Medication" })).toBeVisible({ timeout: 30_000 });
  });

  test("Document source redirect forwards a valid page and chunk", async ({ page }) => {
    const id = demoDocuments[0].id;
    await gotoApp(page, `/documents/source?id=${id}&page=2&chunk=safety%20plan`);
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 60_000 }).toBe(`/documents/${id}`);
    const destination = new URL(page.url());
    expect(destination.pathname).toBe(`/documents/${id}`);
    expect(destination.searchParams.get("page")).toBe("2");
    expect(destination.searchParams.get("chunk")).toBe("safety plan");
  });

  test("Document source evidence alias preserves invalid-id fallback", async ({ page }) => {
    await gotoApp(page, "/documents/source/evidence?id=not-a-uuid&page=2");
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30_000 }).toBe("/documents/search");
    const destination = new URL(page.url());
    expect(destination.pathname).toBe("/documents/search");
    expect(destination.search).toBe("");
  });
});
