import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { syntheticEdPresentations, syntheticPatients } from "@/components/care-plan/mockups/fixtures";
import {
  CARE_PLAN_BASE,
  CARE_PLAN_ROUTES,
  SYNTHETIC_PATIENT_PARAMS,
  SYNTHETIC_PRESENTATION_PARAMS,
  carePlanRoute,
  isSyntheticPatientId,
  isSyntheticPresentationForPatient,
} from "@/components/care-plan/mockups/routes";
import { DEVELOPER_GATED_PATH_PREFIXES } from "@/lib/developer-area/headers";

const APP_ROOT = "src/app/mockups/care-plan";
const COMPONENT_ROOT = "src/components/care-plan/mockups";

const pageFiles = [
  `${APP_ROOT}/page.tsx`,
  `${APP_ROOT}/patients/page.tsx`,
  `${APP_ROOT}/patients/[patientId]/page.tsx`,
  `${APP_ROOT}/patients/[patientId]/management-plan/page.tsx`,
  `${APP_ROOT}/patients/[patientId]/management-plan/edit/page.tsx`,
  `${APP_ROOT}/patients/[patientId]/management-plan/review/page.tsx`,
  `${APP_ROOT}/patients/[patientId]/management-plan/print/page.tsx`,
  `${APP_ROOT}/patients/[patientId]/patient-plan/page.tsx`,
  `${APP_ROOT}/patients/[patientId]/patient-plan/edit/page.tsx`,
  `${APP_ROOT}/patients/[patientId]/patient-plan/print/page.tsx`,
  `${APP_ROOT}/patients/[patientId]/safety-plan/page.tsx`,
  `${APP_ROOT}/patients/[patientId]/safety-plan/edit/page.tsx`,
  `${APP_ROOT}/patients/[patientId]/safety-plan/print/page.tsx`,
  `${APP_ROOT}/patients/[patientId]/presentations/page.tsx`,
  `${APP_ROOT}/patients/[patientId]/presentations/new/page.tsx`,
  `${APP_ROOT}/patients/[patientId]/presentations/[presentationId]/page.tsx`,
  `${APP_ROOT}/patients/[patientId]/history/page.tsx`,
  `${APP_ROOT}/reviews/page.tsx`,
  `${APP_ROOT}/team/page.tsx`,
  `${APP_ROOT}/governance/page.tsx`,
  `${APP_ROOT}/system-states/page.tsx`,
] as const;

function readNamespaceSources(): { path: string; source: string }[] {
  return [APP_ROOT, COMPONENT_ROOT].flatMap((root) => {
    const absoluteRoot = resolve(process.cwd(), root);
    return readdirSync(absoluteRoot, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(?:ts|tsx|css)$/.test(entry.name))
      .map((entry) => {
        const path = resolve(entry.parentPath, entry.name);
        return { path, source: readFileSync(path, "utf8") };
      });
  });
}

describe("Care Plan route registry", () => {
  it("pins the exact approved URL for every route in the family", () => {
    expect(CARE_PLAN_ROUTES).toEqual({
      home: "/mockups/care-plan",
      patients: "/mockups/care-plan/patients",
      patient: "/mockups/care-plan/patients/SYN-PATIENT-001",
      managementPlan: "/mockups/care-plan/patients/SYN-PATIENT-001/management-plan",
      managementPlanEdit: "/mockups/care-plan/patients/SYN-PATIENT-001/management-plan/edit",
      managementPlanReview: "/mockups/care-plan/patients/SYN-PATIENT-001/management-plan/review",
      managementPlanPrint: "/mockups/care-plan/patients/SYN-PATIENT-001/management-plan/print",
      patientPlan: "/mockups/care-plan/patients/SYN-PATIENT-001/patient-plan",
      patientPlanEdit: "/mockups/care-plan/patients/SYN-PATIENT-001/patient-plan/edit",
      patientPlanPrint: "/mockups/care-plan/patients/SYN-PATIENT-001/patient-plan/print",
      safetyPlan: "/mockups/care-plan/patients/SYN-PATIENT-001/safety-plan",
      safetyPlanEdit: "/mockups/care-plan/patients/SYN-PATIENT-001/safety-plan/edit",
      safetyPlanPrint: "/mockups/care-plan/patients/SYN-PATIENT-001/safety-plan/print",
      presentations: "/mockups/care-plan/patients/SYN-PATIENT-001/presentations",
      newPresentation: "/mockups/care-plan/patients/SYN-PATIENT-001/presentations/new",
      presentation: "/mockups/care-plan/patients/SYN-PATIENT-001/presentations/SYN-PRESENTATION-001",
      history: "/mockups/care-plan/patients/SYN-PATIENT-001/history",
      reviews: "/mockups/care-plan/reviews",
      team: "/mockups/care-plan/team",
      governance: "/mockups/care-plan/governance",
      systemStates: "/mockups/care-plan/system-states",
    });
    expect(CARE_PLAN_BASE).toBe("/mockups/care-plan");
  });

  it("rebuilds every deep route from a patient identifier without a second literal", () => {
    expect(carePlanRoute.patient("SYN-PATIENT-003")).toBe("/mockups/care-plan/patients/SYN-PATIENT-003");
    expect(carePlanRoute.managementPlan("SYN-PATIENT-003")).toBe(
      "/mockups/care-plan/patients/SYN-PATIENT-003/management-plan",
    );
    expect(carePlanRoute.safetyPlan("SYN-PATIENT-003")).toBe("/mockups/care-plan/patients/SYN-PATIENT-003/safety-plan");
    expect(carePlanRoute.presentations("SYN-PATIENT-003")).toBe(
      "/mockups/care-plan/patients/SYN-PATIENT-003/presentations",
    );
    expect(carePlanRoute.presentation("SYN-PATIENT-003", "SYN-PRESENTATION-012")).toBe(
      "/mockups/care-plan/patients/SYN-PATIENT-003/presentations/SYN-PRESENTATION-012",
    );
  });

  it("carries only a named specimen scenario in a query string, never record content", () => {
    expect(carePlanRoute.scenario("overdue-plan")).toBe("/mockups/care-plan/system-states?scenario=overdue-plan");
    expect(carePlanRoute.scenario("offline", CARE_PLAN_ROUTES.reviews)).toBe(
      "/mockups/care-plan/reviews?scenario=offline",
    );
    expect(carePlanRoute.withQuery(CARE_PLAN_ROUTES.reviews, "scenario", "empty")).toBe(
      "/mockups/care-plan/reviews?scenario=empty",
    );
    expect(carePlanRoute.withQuery("/mockups/care-plan/reviews?scenario=empty", "view", "awaiting")).toBe(
      "/mockups/care-plan/reviews?scenario=empty&view=awaiting",
    );
  });
});

describe("Care Plan finite synthetic parameters", () => {
  it("derives the patient parameter list from the fixtures rather than a hand-written copy", () => {
    expect(SYNTHETIC_PATIENT_PARAMS).toEqual(syntheticPatients.map((patient) => ({ patientId: patient.id })));
    expect(SYNTHETIC_PATIENT_PARAMS.length).toBeGreaterThan(0);
    for (const { patientId } of SYNTHETIC_PATIENT_PARAMS) expect(patientId.startsWith("SYN-")).toBe(true);
  });

  it("derives every episode parameter pair from the fixtures", () => {
    expect(SYNTHETIC_PRESENTATION_PARAMS).toEqual(
      syntheticEdPresentations.map((presentation) => ({
        patientId: presentation.patientId,
        presentationId: presentation.id,
      })),
    );
    for (const { patientId, presentationId } of SYNTHETIC_PRESENTATION_PARAMS) {
      expect(patientId.startsWith("SYN-")).toBe(true);
      expect(presentationId.startsWith("SYN-")).toBe(true);
    }
  });

  it("recognises only known synthetic identifiers", () => {
    expect(isSyntheticPatientId("SYN-PATIENT-001")).toBe(true);
    expect(isSyntheticPatientId("SYN-PATIENT-999")).toBe(false);
    expect(isSyntheticPatientId("../../etc/passwd")).toBe(false);
    expect(isSyntheticPresentationForPatient("SYN-PATIENT-001", "SYN-PRESENTATION-001")).toBe(true);
    // Episode 009 belongs to another patient, so this pairing must not resolve.
    expect(isSyntheticPresentationForPatient("SYN-PATIENT-001", "SYN-PRESENTATION-009")).toBe(false);
    expect(isSyntheticPresentationForPatient("SYN-PATIENT-001", "SYN-PRESENTATION-999")).toBe(false);
  });
});

describe("Care Plan route registration", () => {
  it("registers all twenty-one approved pages plus the shared layout, loading and route page", () => {
    for (const file of pageFiles) {
      expect(existsSync(resolve(process.cwd(), file)), `${file} is missing`).toBe(true);
    }
    expect(pageFiles.length).toBe(21);
    for (const file of [`${APP_ROOT}/layout.tsx`, `${APP_ROOT}/loading.tsx`, `${APP_ROOT}/route-page.tsx`]) {
      expect(existsSync(resolve(process.cwd(), file)), `${file} is missing`).toBe(true);
    }
  });

  it("registers no page beyond the twenty-one approved routes", () => {
    const found = readdirSync(resolve(process.cwd(), APP_ROOT), { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name === "page.tsx")
      .map((entry) => resolve(entry.parentPath, entry.name));
    expect(found.length).toBe(pageFiles.length);
  });

  it("validates every dynamic parameter and repeats no synthetic identifier in a page file", () => {
    const dynamicPages = pageFiles.filter((file) => file.includes("["));
    expect(dynamicPages.length).toBe(15);
    for (const file of dynamicPages) {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(source, `${file} must refuse an unknown parameter`).toContain("notFound()");
      expect(source, `${file} must prerender its finite parameter list`).toContain("generateStaticParams");
      expect(source, `${file} must check the parameter against the fixtures`).toMatch(
        /isSyntheticPatientId|isSyntheticPresentationForPatient/,
      );
    }
    for (const file of pageFiles) {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(source, `${file} must not repeat a synthetic identifier`).not.toMatch(/SYN-/);
    }
  });

  it("nests the developer gate outside the prototype provider in the route-family layout", () => {
    const layout = readFileSync(resolve(process.cwd(), `${APP_ROOT}/layout.tsx`), "utf8");
    const gateIndex = layout.indexOf("<DeveloperAreaGate>");
    const boundaryIndex = layout.indexOf("<CarePlanErrorBoundary>");
    const providerIndex = layout.indexOf("<CarePlanPrototypeProvider>");
    expect(gateIndex).toBeGreaterThanOrEqual(0);
    expect(boundaryIndex).toBeGreaterThan(gateIndex);
    expect(providerIndex).toBeGreaterThan(boundaryIndex);
  });

  it("exposes a busy loading fallback that shows no fabricated record content", () => {
    const loading = readFileSync(resolve(process.cwd(), `${APP_ROOT}/loading.tsx`), "utf8");
    expect(loading).toContain('aria-busy="true"');
    expect(loading).not.toMatch(/SYN-PATIENT-|Rowan|Mira|Jordan|Evelyn|Alex Fiction/);
  });

  it("gates only the Care Plan prefix, leaving similarly prefixed paths outside the developer area", () => {
    expect(DEVELOPER_GATED_PATH_PREFIXES).toContain("/mockups/care-plan");
    // Never widened to the whole mockup tree: each entry names one subtree.
    // `tests/proxy.test.ts` proves the look-alike prefixes stay blocked.
    for (const prefix of DEVELOPER_GATED_PATH_PREFIXES) {
      expect(prefix.startsWith("/mockups/"), prefix).toBe(true);
      expect(prefix.slice("/mockups/".length).includes("/"), prefix).toBe(false);
    }
  });

  it("keeps the Care Plan shell independent from the shared mockup search chrome", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/mockups/mockups-layout-client.tsx"), "utf8");
    expect(source).toContain('pathname === "/mockups/care-plan"');
    expect(source).toContain('pathname.startsWith("/mockups/care-plan/")');
    expect(source.match(/!isCarePlanMockup/g)?.length).toBe(2);
  });

  it("links the Care Plan surface from the developer index", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/mockups/development/page.tsx"), "utf8");
    expect(source).toContain("CARE_PLAN_ROUTES");
    for (const entry of ["Patients", "Reviews", "Governance", "System states"]) {
      expect(source).toContain(entry);
    }
  });
});

describe("Care Plan synthetic, memory-only boundary", () => {
  const banned: readonly { label: string; pattern: RegExp }[] = [
    { label: "network fetch", pattern: /\bfetch\s*\(/ },
    { label: "XMLHttpRequest", pattern: /\bXMLHttpRequest\b/ },
    { label: "WebSocket or EventSource", pattern: /\b(?:WebSocket|EventSource)\b/ },
    { label: "browser storage", pattern: /\b(?:localStorage|sessionStorage|indexedDB)\b/ },
    { label: "cookies", pattern: /document\.cookie|\bcookies\s*\(/ },
    { label: "Server Action", pattern: /["']use server["']/ },
    {
      label: "provider or analytics import",
      pattern: /from\s+["'][^"']*(?:openai|supabase|analytics|sentry)[^"']*["']/i,
    },
    { label: "timers", pattern: /\b(?:setTimeout|setInterval|requestIdleCallback)\s*\(/ },
    { label: "randomness", pattern: /Math\.random\s*\(|crypto\.randomUUID\s*\(/ },
    { label: "wall-clock read", pattern: /Date\.now\s*\(|new Date\s*\(\s*\)/ },
    { label: "presentation-count sorting", pattern: /sort[^\n]{0,40}presentation count/i },
    { label: "stigmatising language", pattern: /frequent flyer|high utili[sz]er|problem patient/i },
    { label: "numeric identification threshold", pattern: /identification threshold|threshold\s*[:=]\s*\d/i },
  ];

  it("keeps every new Care Plan source file free of persistence, providers and non-determinism", () => {
    const files = readNamespaceSources();
    expect(files.length).toBeGreaterThan(20);
    for (const { path, source } of files) {
      for (const { label, pattern } of banned) {
        expect(pattern.test(source), `${path} contains ${label}`).toBe(false);
      }
    }
  });

  it("registers no route handler and no production route outside the mockup namespace", () => {
    const handlers = readdirSync(resolve(process.cwd(), APP_ROOT), { recursive: true, withFileTypes: true }).filter(
      (entry) => entry.isFile() && /^route\.(?:ts|tsx|js)$/.test(entry.name),
    );
    expect(handlers).toEqual([]);
    for (const path of ["src/app/care-plan", "src/app/patients", "src/app/reviews", "src/app/governance"]) {
      expect(existsSync(resolve(process.cwd(), path)), `${path} must not exist`).toBe(false);
    }
  });

  it("scopes every Care Plan stylesheet selector below the app root", () => {
    const css = readFileSync(resolve(process.cwd(), `${COMPONENT_ROOT}/care-plan.module.css`), "utf8");
    const selectors = css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      // Drop at-rule headers (`@media …{`) but keep the rules inside them, so a
      // selector that escapes `.appRoot` cannot hide in a media or print block.
      .replace(/@[^{]*\{/g, "")
      .split("}")
      .flatMap((block) => {
        const head = block.split("{")[0]?.trim();
        return head ? [head] : [];
      })
      .filter((head) => head.length > 0 && !head.startsWith("@"))
      .flatMap((head) => head.split(",").map((part) => part.trim()))
      .filter((part) => part.length > 0);
    expect(selectors.length).toBeGreaterThan(5);
    for (const selector of selectors) {
      expect(selector.startsWith(".appRoot"), `${selector} is not scoped below .appRoot`).toBe(true);
    }
  });
});
