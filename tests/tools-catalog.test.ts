import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isCaringContactsToolListed,
  rankToolRecords,
  toolCatalogRecordById,
  toolCatalogRecords,
  toolCatalogRecordsForSession,
} from "../src/lib/tools-catalog";
import { isCaringContactsDemoEnabled } from "../src/lib/caring-contacts-server/session";
import { appModeHomeHref, type AppModeId } from "../src/lib/app-modes";
import { smartSearchExpansions } from "../src/lib/smart-search-intent";
import { tools as mockupToolFixtures } from "../src/components/tools-page-mockups/tool-fixtures";

// `session.ts` is server-only and reads the demo role cookie; the catalogue test only needs
// its production-lock predicate, so the cookie store is stubbed the way its own suite does.
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => undefined, set: () => undefined })),
}));

describe("tools catalog", () => {
  it("has unique ids and the launcher staples", () => {
    const ids = toolCatalogRecords.map((tool) => tool.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const staple of [
      "clinical-kb-search",
      "documents",
      "medication-prescribing",
      "services",
      "forms",
      "calculators",
      "source-catalogue",
    ]) {
      expect(ids).toContain(staple);
    }
  });

  it("exposes Sources as a ready source-backed reference tool", () => {
    expect(toolCatalogRecordById("source-catalogue")).toMatchObject({
      title: "Sources",
      href: "/sources",
      area: "reference",
      status: "ready",
      sourceBacked: true,
    });
  });

  it("links shared-home tools directly to their canonical mode homes", () => {
    const sharedHomeTools = [
      ["differentials", "differentials"],
      ["clinical-dictionary", "dictionary"],
      ["services", "services"],
      ["forms", "forms"],
      ["calculators", "calculators"],
    ] as const satisfies readonly (readonly [Parameters<typeof toolCatalogRecordById>[0], AppModeId])[];

    for (const [toolId, modeId] of sharedHomeTools) {
      expect(toolCatalogRecordById(toolId).href).toBe(appModeHomeHref(modeId));
      expect(toolCatalogRecordById(toolId).href).toBe(`/?mode=${modeId}`);
    }
  });

  // Ward Flow is deliberately absent from this catalogue — see
  // tests/ward-flow-sandbox.test.ts, which asserts no entry's href starts with
  // "/ward-management" or "/mockups/ward-flow" (the old and new sandbox paths).
  // A test here asserting it WAS reachable would fight that guard directly.

  it("ranks title matches above keyword-only matches", () => {
    const matches = rankToolRecords("forms");
    expect(matches[0].tool.id).toBe("forms");
    expect(matches[0].reasons).toContain("title");
  });

  it("keeps the Differentials tool ahead of a generic Compare keyword match", () => {
    const matches = rankToolRecords("Compare");
    expect(matches[0]?.tool.id).toBe("differentials");
  });

  it("finds tools through keywords", () => {
    const matches = rankToolRecords("contraindications");
    expect(matches.some((match) => match.tool.id === "risk-safety")).toBe(true);
  });

  it("ranks Smart medication-interaction intent and exact Forms queries ahead of other tools", () => {
    const expansions = smartSearchExpansions("tools", "where can I check medication interactions?");
    expect(rankToolRecords("where can I check medication interactions?", 5, expansions)[0]?.tool.id).toBe(
      "medication-prescribing",
    );
    expect(rankToolRecords("Forms")[0]?.tool.id).toBe("forms");
  });

  it("returns nothing for an empty query", () => {
    expect(rankToolRecords("")).toEqual([]);
  });

  it("hides Saved workflows from guest sessions in ranking and catalog helpers", () => {
    const guestCatalog = toolCatalogRecordsForSession({ authenticated: false, demoMode: false });
    expect(guestCatalog.some((tool) => tool.id === "favourites")).toBe(false);
    // Omitting session must fail closed (same as explicit guest).
    expect(rankToolRecords("saved workflows", 10, []).map((m) => m.tool.id)).not.toContain("favourites");
    expect(
      rankToolRecords("saved workflows", 10, [], { authenticated: false, demoMode: false }).map((m) => m.tool.id),
    ).not.toContain("favourites");
    expect(
      rankToolRecords("saved workflows", 10, [], { authenticated: true, demoMode: false }).some(
        (match) => match.tool.id === "favourites",
      ),
    ).toBe(true);
    expect(
      toolCatalogRecordsForSession({ authenticated: true, demoMode: false }).some((tool) => tool.id === "favourites"),
    ).toBe(true);
  });

  it("excludes Favourites from guest Smart ranking", () => {
    const query = "where are my saved workflows?";
    expect(
      rankToolRecords(query, 10, smartSearchExpansions("tools", query), {
        authenticated: false,
        demoMode: false,
      }).map((match) => match.tool.id),
    ).not.toContain("favourites");
  });

  it("keeps the mockup fixtures derived from catalog identity fields", () => {
    for (const fixture of mockupToolFixtures) {
      const record = toolCatalogRecordById(fixture.id);
      expect(record.id).toBe(fixture.id);
      expect(fixture.href).toBe(record.href);
      expect(fixture.sourceBacked).toBe(record.sourceBacked);
    }
  });
});

describe("the Caring Contacts card follows the workspace's production lock", () => {
  const allSessions = [
    { authenticated: false, demoMode: false },
    { authenticated: true, demoMode: false },
    { authenticated: true, demoMode: true },
  ] as const;
  const caringContactsListed = (session: (typeof allSessions)[number]) =>
    toolCatalogRecordsForSession(session).some((tool) => tool.id === "caring-contacts");

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is offered outside production, whatever the flags say", () => {
    for (const environment of ["development", "test"]) {
      vi.stubEnv("NODE_ENV", environment);
      vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "");
      vi.stubEnv("PLAYWRIGHT_OFFLINE_MODE", "");
      expect(isCaringContactsToolListed()).toBe(true);
      for (const session of allSessions) expect(caringContactsListed(session)).toBe(true);
    }
  });

  it("is hidden from every production session, so the launcher never offers a card whose route is a 404", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "");
    vi.stubEnv("PLAYWRIGHT_OFFLINE_MODE", "");
    expect(isCaringContactsToolListed()).toBe(false);
    for (const session of allSessions) {
      expect(caringContactsListed(session)).toBe(false);
      expect(rankToolRecords("caring contacts", 10, [], session).map((match) => match.tool.id)).not.toContain(
        "caring-contacts",
      );
    }
    // The record itself stays in the catalogue: the mockup fixtures and the category
    // identity registry still resolve it, and the workspace journey still reaches it.
    expect(toolCatalogRecordById("caring-contacts").href).toBe("/caring-contacts");
  });

  it("keeps the isolated Playwright production server's entry point", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    vi.stubEnv("PLAYWRIGHT_OFFLINE_MODE", "true");
    expect(isCaringContactsToolListed()).toBe(true);
    for (const session of allSessions) expect(caringContactsListed(session)).toBe(true);
  });

  it("agrees with isCaringContactsDemoEnabled in every environment a server can actually start in", () => {
    // The catalogue is rendered by client components, so it can only read what the client
    // bundle inlines: NODE_ENV and NEXT_PUBLIC_DEMO_MODE. PLAYWRIGHT_OFFLINE_MODE never reaches
    // the browser. The one combination the two predicates could disagree on -- production with
    // NEXT_PUBLIC_DEMO_MODE=true but no Playwright offline flag -- is a process
    // `src/instrumentation.ts` refuses to start, pinned below, so no server ever serves it.
    const instrumentation = readFileSync(path.join(process.cwd(), "src/instrumentation.ts"), "utf8");
    expect(instrumentation).toContain("demo mode is enabled in a production build");

    for (const environment of ["development", "test", "production"]) {
      for (const offline of [undefined, "true"]) {
        for (const demo of [undefined, "true"]) {
          const refusedByInstrumentation = environment === "production" && demo === "true" && offline !== "true";
          if (refusedByInstrumentation) continue;
          vi.stubEnv("NODE_ENV", environment);
          vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", demo ?? "");
          vi.stubEnv("PLAYWRIGHT_OFFLINE_MODE", offline ?? "");
          const runtime = { PLAYWRIGHT_OFFLINE_MODE: offline, NEXT_PUBLIC_DEMO_MODE: demo };
          const enabled = isCaringContactsDemoEnabled(environment, runtime);
          expect(isCaringContactsToolListed(), `${environment} offline=${offline} demo=${demo}`).toBe(enabled);
          for (const session of allSessions) expect(caringContactsListed(session)).toBe(enabled);
        }
      }
    }
  });
});
