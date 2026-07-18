import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET as redirectApplications, HEAD as headApplications } from "@/app/applications/route";
import { GET as redirectPresentations, HEAD as headPresentations } from "@/app/differentials/presentations/route";
import { GET as redirectMedications, HEAD as headMedications } from "@/app/medications/route";
import { legacyHomeRedirectUrl } from "@/lib/legacy-home-redirect";

function source(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function sourceSegment(contents: string, startMarker: string, endMarker: string) {
  const start = contents.indexOf(startMarker);
  const end = contents.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`Could not locate source segment from ${startMarker} to ${endMarker}.`);
  }
  return contents.slice(start, end);
}

const clinicalDashboardSource = source("src/components/ClinicalDashboard.tsx");
const masterSearchHeaderSource = source("src/components/clinical-dashboard/master-search-header.tsx");

describe("audit navigation and auth regressions", () => {
  it("redirects exact legacy route handlers at request time while retaining useful query state", () => {
    const applications = redirectApplications(
      new NextRequest("https://clinical-kb.test/applications?q=acute+care&tag=one&tag=two"),
    );
    expect(applications.status).toBe(307);
    expect(applications.headers.get("location")).toBe("/tools?q=acute+care&tag=one&tag=two");

    const presentations = redirectPresentations(
      new NextRequest(
        "https://clinical-kb.test/differentials/presentations?query=+acute+confusion+&q=ignored&ids=DELIRIUM,unknown,delirium",
      ),
    );
    expect(presentations.status).toBe(307);
    expect(presentations.headers.get("location")).toBe(
      "/differentials/presentations/acute-confusion-encephalopathy?q=acute+confusion&ids=delirium",
    );

    const medications = redirectMedications(new NextRequest("https://clinical-kb.test/medications?ignored=1"));
    expect(medications.status).toBe(307);
    expect(medications.headers.get("location")).toBe("/?mode=prescribing");

    expect([headApplications, headPresentations, headMedications]).toEqual([
      redirectApplications,
      redirectPresentations,
      redirectMedications,
    ]);
  });

  it("sanitizes root legacy mode aliases before request-time redirects", () => {
    const favourites = legacyHomeRedirectUrl(
      new URL("https://clinical-kb.test/?mode=favourites&q=+lithium+&focus=1&run=0&extra=drop"),
      "GET",
    );
    const differentials = legacyHomeRedirectUrl(
      new URL("https://clinical-kb.test/?mode=differentials&q=acute+confusion&run=1&run=0"),
      "HEAD",
    );
    const specifiers = legacyHomeRedirectUrl(
      new URL("https://clinical-kb.test/?mode=specifiers&focus=1&unexpected=drop"),
      "GET",
    );

    expect(favourites?.toString()).toBe("https://clinical-kb.test/favourites?q=lithium&focus=1");
    expect(differentials?.toString()).toBe("https://clinical-kb.test/differentials?q=acute+confusion&run=1");
    expect(specifiers?.toString()).toBe("https://clinical-kb.test/specifiers?focus=1");
    expect(legacyHomeRedirectUrl(new URL("https://clinical-kb.test/?mode=favourites"), "POST")).toBeNull();
    expect(legacyHomeRedirectUrl(new URL("https://clinical-kb.test/?mode=answer"), "GET")).toBeNull();
    expect(source("src/proxy.ts")).toContain("legacyHomeRedirectUrl(request.nextUrl, request.method)");
  });

  it("closes the master mode menu when focus leaves its wrapper", () => {
    const focusLeaveContract = sourceSegment(
      masterSearchHeaderSource,
      "ref={modeMenuRef}",
      'className={cn("relative z-[60]',
    );

    expect(focusLeaveContract).toContain("onBlur={(event) => {");
    expect(focusLeaveContract).toContain("const nextFocusedElement = event.relatedTarget;");
    expect(focusLeaveContract).toContain("event.currentTarget.contains(nextFocusedElement)");
    expect(focusLeaveContract).toContain("setModeMenuOpen(false);");
  });

  it("gates private polling and mutations on local readiness plus authenticated status", () => {
    const privateCapabilityContract = sourceSegment(
      clinicalDashboardSource,
      "const canUsePrivateApis =",
      "const canRunSearch =",
    );
    expect(privateCapabilityContract).toContain("const canUsePrivateApis =");
    expect(privateCapabilityContract).toContain(
      'localNoAuthMode || localDevCanAttemptPrivateApis || authStatus === "authenticated"',
    );

    const pollingContract = sourceSegment(
      clinicalDashboardSource,
      "if (!nextDemoMode && !canUsePrivateApis) {",
      "const shouldRefreshWorkState =",
    );
    expect(pollingContract).toContain("if (!nextDemoMode && !canUsePrivateApis) {");
    expect(pollingContract).toContain("setDocuments([]);");
    expect(pollingContract).toContain("return;");

    const labelMutationContract = sourceSegment(
      clinicalDashboardSource,
      "const mutateDocumentLabel =",
      "const handleDocumentDeleted =",
    );
    expect(labelMutationContract).toContain("if (!canUsePrivateApis) return false;");

    const uploadMutationContract = sourceSegment(
      clinicalDashboardSource,
      "function openUploadDrawer()",
      "function openEvidenceDrawer()",
    );
    expect(uploadMutationContract).toContain("if (!canUsePrivateApis) {");
  });

  it("keeps the private upload workspace tabs and panels programmatically associated", () => {
    expect(clinicalDashboardSource).toContain('aria-label="Upload and indexing sections"');
    expect(clinicalDashboardSource).toContain('role="tab"');
    expect(clinicalDashboardSource).toContain("aria-selected={active}");
    expect(clinicalDashboardSource).toContain("aria-controls={tab.panelId}");
    expect(clinicalDashboardSource).toContain("tabIndex={active ? 0 : -1}");
    expect(clinicalDashboardSource).toContain('role="tabpanel"');
    for (const tab of ["setup", "upload", "jobs", "quality"]) {
      expect(clinicalDashboardSource).toContain(`aria-labelledby="dashboard-upload-tab-${tab}"`);
    }
    expect(clinicalDashboardSource).toContain('event.key === "ArrowRight"');
    expect(clinicalDashboardSource).toContain('event.key === "ArrowLeft"');
    expect(clinicalDashboardSource).toContain('event.key === "Home"');
    expect(clinicalDashboardSource).toContain('event.key === "End"');
  });

  it("keeps the root dashboard H1 as Clinical Guide", () => {
    expect(clinicalDashboardSource.match(/<h1\b/g)).toHaveLength(1);
    expect(clinicalDashboardSource).toMatch(/<h1 className="sr-only">\s*Clinical Guide\s*<\/h1>/);
  });

  it("leaves favourites universal matches to the favourites hub", () => {
    const universalMatchesContract = sourceSegment(
      clinicalDashboardSource,
      '{showUniversalAlsoMatches && activeModeResultKind === "tools"',
      '{activeModeResultKind === "differentials"',
    );

    expect(universalMatchesContract).toContain("<UniversalSearchAlsoMatches modeId={searchMode}");
    expect(universalMatchesContract).not.toContain('activeModeResultKind === "favourites"');
    expect(source("src/components/clinical-dashboard/favourites-command-library-page.tsx")).toContain(
      '<UniversalSearchAlsoMatches modeId="favourites" query={query} />',
    );
  });
});
