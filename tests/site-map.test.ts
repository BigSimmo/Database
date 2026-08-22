import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { appModeDefinitions, appModeHomeHref } from "@/lib/app-modes";
import { tools } from "@/components/tools-page-mockups/tool-fixtures";
import { differentialRecords } from "@/lib/differentials";
import { dsmDiagnoses } from "@/lib/dsm";
import { formulationMechanisms } from "@/lib/formulation";
import { formRecords } from "@/lib/forms";
import { serviceRecords } from "@/lib/services";
import { specifierRecords } from "@/lib/specifiers";
import { therapySlugs } from "@/lib/therapies";
import { factsheetSlugs } from "@/components/factsheets/factsheets-data";
import { dictionaryEntries, dictionaryTopics } from "@/lib/dictionary-data";
import { collectSiteMapData, renderSiteMap } from "../scripts/generate-site-map";
import { sourceFrom, sourceSegment } from "./helpers/source-contract";

const siteMapPath = path.join(process.cwd(), "docs", "site-map.md");
const siteMap = readFileSync(siteMapPath, "utf8");

const staticKnownRoutes = new Set([
  "/formulation/builder",
  "/formulation/compare",
  "/formulation/map",
  "/specifiers/builder",
  "/specifiers/compare",
  "/specifiers/map",
  "/dictionary/browse",
  "/dictionary/compare",
  "/dictionary/search",
  "/dictionary/sources",
  "/dictionary/topics",
  "/therapy-compass/compare",
  "/therapy-compass/pathways",
  "/therapy-compass/recommend",
  "/therapy-compass/review",
  "/therapy-compass/search",
  "/documents/search",
  "/documents/source",
  "/documents/source/evidence",
  "/factsheets/search",
]);

const acceptedDynamicPatterns = [
  /^\/documents\/[^/?#]+(?:[?#].*)?$/,
  /^\/services\/[^/?#]+(?:[?#].*)?$/,
  /^\/forms\/[^/?#]+(?:[?#].*)?$/,
  /^\/differentials\/diagnoses\/[^/?#]+(?:[?#].*)?$/,
  /^\/differentials\/presentations\/[^/?#]+(?:[?#].*)?$/,
  /^\/dsm\/diagnoses\/[^/?#]+(?:[?#].*)?$/,
  /^\/medications\/[^/?#]+(?:[?#].*)?$/,
  /^\/factsheets\/[^/?#]+(?:[?#].*)?$/,
  /^\/dictionary\/[^/?#]+(?:[?#].*)?$/,
  /^\/dictionary\/topics\/[^/?#]+(?:[?#].*)?$/,
  /^\/formulation\/[^/?#]+(?:[?#].*)?$/,
  /^\/specifiers\/[^/?#]+(?:[?#].*)?$/,
  /^\/therapy-compass\/[^/?#]+(?:[?#].*)?$/,
  /^\/ward-management\/patients\/[^/?#]+(?:[?#].*)?$/,
];

function pathOnly(href: string) {
  return href.split(/[?#]/)[0] || "/";
}

function routePatternForHref(href: string) {
  const pathname = pathOnly(href);
  if (staticKnownRoutes.has(pathname)) return pathname;
  if (/^\/therapy-compass\/[^/?#]+\/brief(?:[?#].*)?$/.test(href)) return "/therapy-compass/[slug]/brief";
  if (/^\/therapy-compass\/[^/?#]+\/sheet(?:[?#].*)?$/.test(href)) return "/therapy-compass/[slug]/sheet";
  if (/^\/dsm\/diagnoses\/[^/?#]+\/differentials(?:[?#].*)?$/.test(href)) return "/dsm/diagnoses/[slug]/differentials";
  if (/^\/dictionary\/topics\/[^/?#]+(?:[?#].*)?$/.test(href)) return "/dictionary/topics/[slug]";

  if (acceptedDynamicPatterns.some((pattern) => pattern.test(href))) {
    if (pathname.startsWith("/documents/")) return "/documents/[id]";
    if (pathname.startsWith("/services/")) return "/services/[slug]";
    if (pathname.startsWith("/forms/")) return "/forms/[slug]";
    if (pathname.startsWith("/differentials/diagnoses/")) return "/differentials/diagnoses/[slug]";
    if (pathname.startsWith("/differentials/presentations/")) return "/differentials/presentations/[slug]";
    if (pathname.startsWith("/dsm/diagnoses/")) return "/dsm/diagnoses/[slug]";
    if (pathname.startsWith("/medications/")) return "/medications/[slug]";
    if (pathname.startsWith("/factsheets/")) return "/factsheets/[slug]";
    if (pathname.startsWith("/dictionary/topics/")) return "/dictionary/topics/[slug]";
    if (pathname.startsWith("/dictionary/")) return "/dictionary/[slug]";
    if (pathname.startsWith("/formulation/")) return "/formulation/[slug]";
    if (pathname.startsWith("/specifiers/")) return "/specifiers/[slug]";
    if (pathname.startsWith("/therapy-compass/")) return "/therapy-compass/[slug]";
    if (pathname.startsWith("/ward-management/patients/")) return "/ward-management/patients/[patientId]";
  }
  return pathname;
}

function expectDocumentedRoute(route: string) {
  expect(siteMap, `Expected ${route} to be documented in docs/site-map.md`).toContain(`\`${route}\``);
}

function expectDocumentedHref(href: string) {
  expectDocumentedRoute(routePatternForHref(href));
}

describe("tracked sitemap", () => {
  it("matches the generated sitemap output", async () => {
    expect(siteMap).toBe(await renderSiteMap());
  });

  it("documents every app page, public route handler, and API route", () => {
    const data = collectSiteMapData();

    for (const pageRoute of data.pageRoutes) expectDocumentedRoute(pageRoute.route);
    for (const routeHandler of data.publicRouteHandlers) expectDocumentedRoute(routeHandler.route);
    for (const apiRoute of data.apiRoutes) expectDocumentedRoute(apiRoute.route);
    for (const redirect of data.redirects) expectDocumentedRoute(redirect.route);
  });

  it("keeps public redirect handlers out of API routes and records their redirects", () => {
    const data = collectSiteMapData();
    const productSection = sourceSegment(siteMap, "## Main product routes", "## Mode/query routes", {
      label: "site-map main product routes section",
    });
    const apiSection = sourceSegment(siteMap, "## API routes", "## Redirects", {
      label: "site-map API routes section",
    });
    const expectedProductHandlers = [
      ["/applications", "src/app/applications/route.ts", "/tools"],
      // `/differentials/compare` and `/medications` are deliberately absent:
      // compare is a real page that conditionally redirects same-presentation
      // selections, and medications is a real Medication mode home.
    ] as const;
    const redirectSection = sourceFrom(siteMap, "## Redirects", {
      label: "site-map Redirects section",
    });

    expect(data.apiRoutes.every((route) => route.route === "/api" || route.route.startsWith("/api/"))).toBe(true);
    expect(data.publicRouteHandlers.some((route) => route.route === "/auth/callback")).toBe(true);
    expect(data.publicRouteHandlers).toContainEqual({
      route: "/icons/[variant]",
      file: "src/app/icons/[variant]/route.tsx",
    });
    expect(apiSection).not.toContain("`/icons/[variant]`");

    for (const [route, file, target] of expectedProductHandlers) {
      expect(data.publicRouteHandlers).toContainEqual({ route, file });
      expect(data.apiRoutes).not.toContainEqual({ route, file });
      expect(data.redirects).toContainEqual({ route, file, target });
      expect(redirectSection).toContain(`\`${route}\``);
      expect(apiSection).not.toContain(`\`${route}\``);
      expect(productSection).not.toContain(`\`${route}\``);
    }
  });

  it("documents seeded dynamic slugs", () => {
    for (const service of serviceRecords) expectDocumentedRoute(service.slug);
    for (const form of formRecords) expectDocumentedRoute(form.slug);
    for (const record of differentialRecords) expectDocumentedRoute(record.slug);
    for (const record of dsmDiagnoses) expectDocumentedRoute(record.slug);
    for (const mechanism of formulationMechanisms) expectDocumentedRoute(mechanism.id);
    for (const specifier of specifierRecords) expectDocumentedRoute(specifier.slug);
    for (const slug of therapySlugs()) expectDocumentedRoute(slug);
    for (const slug of factsheetSlugs()) expectDocumentedRoute(slug);
    for (const entry of dictionaryEntries) expectDocumentedRoute(entry.slug);
    for (const topic of dictionaryTopics) expectDocumentedRoute(topic.slug);
    expectDocumentedRoute("acamprosate");
  });

  it("documents core navigation href targets", () => {
    for (const mode of appModeDefinitions) {
      expectDocumentedHref(("href" in mode ? mode.href : undefined) ?? appModeHomeHref(mode.id));
    }

    for (const tool of tools) expectDocumentedHref(tool.href);

    for (const href of [
      "/?mode=answer",
      "/?mode=documents",
      "/?mode=prescribing",
      "/?mode=tools",
      "/services",
      "/forms",
      "/favourites",
      "/differentials",
      "/dsm",
      "/dsm/search",
      "/dsm/compare",
      "/dsm/diagnoses/major-depressive-disorder",
      "/medications/acamprosate",
      "/differentials/diagnoses/delirium",
    ]) {
      expectDocumentedHref(href);
    }
  });

  it("documents known intentional caveats and compatibility routes", () => {
    expect(siteMap).toContain("development-only");
    expect(siteMap).toContain("legacy compatibility route");
    expect(siteMap).toContain("Live user registries may contain additional service or form slugs");
    expect(siteMap).toContain("individual document IDs are private runtime data");
  });
});
