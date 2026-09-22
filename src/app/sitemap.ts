import type { MetadataRoute } from "next";

import { appModeDefinitions, type AppModeId } from "@/lib/app-modes";
import { resolveMetadataBase } from "@/lib/metadata-base";
import { publicKnowledgeToolCatalogIds } from "@/lib/tools-catalog";

/**
 * A single fixed last-modified date for every public entry. The public surface is
 * a small set of static landing pages whose content changes with catalogue and
 * release work, not per-route churn, so one recent date is honest for all of them
 * and does not fabricate a per-route change cadence.
 */
const LAST_MODIFIED = "2026-09-23";

/**
 * Maps each public-knowledge tool id (`publicKnowledgeToolCatalogIds`) to the
 * `AppModeId` whose canonical home href (`appModeDefinitions[].href`) is its
 * public landing page.
 *
 * `safety-plan` is deliberately absent: its route holds identifier-free working
 * content that lives in the current browser tab and is not a public landing page,
 * so it is never advertised for indexing.
 */
const PUBLIC_TOOL_MODE_IDS: Partial<Record<(typeof publicKnowledgeToolCatalogIds)[number], AppModeId>> = {
  differentials: "differentials",
  "clinical-dictionary": "dictionary",
  "medication-prescribing": "prescribing",
  services: "services",
  forms: "forms",
  calculators: "calculators",
};

/**
 * Canonical public home hrefs, read from `appModeDefinitions` rather than
 * hand-written here, so a mode whose canonical path changes keeps its sitemap
 * entry in step. The shared home (`/`) is prepended by `sitemap()` itself.
 */
function publicHomeHrefs(): string[] {
  const hrefs: string[] = [];
  for (const toolId of publicKnowledgeToolCatalogIds) {
    const modeId = PUBLIC_TOOL_MODE_IDS[toolId];
    if (!modeId) continue;
    const mode = appModeDefinitions.find((candidate) => candidate.id === modeId);
    if (mode && "href" in mode && mode.href) hrefs.push(mode.href);
  }
  return hrefs;
}

/**
 * Resolves the canonical origin the same way generated app metadata does:
 * `NEXT_PUBLIC_SITE_URL`, then `RAILWAY_PUBLIC_DOMAIN`. The request host is
 * deliberately not consulted, so the sitemap is never emitted against an
 * arbitrary or attacker-controlled origin.
 */
function publicOrigin(): string | undefined {
  return resolveMetadataBase(new Headers(), {
    configuredSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    trustedDeploymentDomain: process.env.RAILWAY_PUBLIC_DOMAIN,
  })?.origin;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = publicOrigin();
  // Fail conservative: without a trusted canonical origin there is nothing safe to
  // advertise, so emit an empty urlset rather than fabricated absolute URLs.
  if (!origin) return [];

  return ["/", ...publicHomeHrefs()].map((href) => ({
    url: `${origin}${href}`,
    lastModified: LAST_MODIFIED,
    changeFrequency: href === "/" ? "weekly" : "monthly",
    priority: href === "/" ? 1 : 0.8,
  }));
}
