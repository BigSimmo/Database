import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DocumentSearchResultsPanel } from "@/components/clinical-dashboard/document-search-results";
import { MedicationPrescribingWorkspace } from "@/components/clinical-dashboard/medication-prescribing-workspace";
import { PatientProfileProvider } from "@/components/clinical-dashboard/patient-profile-context";
import { DifferentialStreamWorkspace } from "@/components/differentials/differential-stream-workspace";
import { buildDifferentialStreamModel } from "@/lib/differential-stream";
import type { ClinicalDocument, DocumentMatch } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(window.location.search),
  usePathname: () => window.location.pathname,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/supabase/client", () => ({
  useAuthSession: () => ({
    status: "signed_out",
    session: null,
    isConfigured: true,
    authorizationHeader: () => null,
    registerAuthRequest: vi.fn(),
    isAuthEpochCurrent: () => true,
    markSessionExpired: vi.fn(),
  }),
}));

vi.mock("@/components/clinical-dashboard/universal-search-also-matches", () => ({
  UniversalSearchAlsoMatches: () => null,
}));

type MockMedicationResult = {
  id: string;
  name: string;
  indication: string;
  match: string;
  dose: string;
  ceiling: string;
  action: string;
  actionTone: "danger" | "warning" | "neutral";
  tone: "teal" | "blue" | "slate";
};

type MockMedicationCatalogState = {
  data: null | {
    records: [];
    matches: Array<{
      medication: undefined;
      result: MockMedicationResult;
      score: number;
      reasons: string[];
    }>;
    total: number;
    governance: Record<string, never>;
  };
  loading: boolean;
  error: string | null;
};

const medicationCatalogState = vi.hoisted(() => ({
  current: { data: null, loading: true, error: null } as MockMedicationCatalogState,
}));

vi.mock("@/components/clinical-dashboard/use-medication-catalog", () => ({
  useMedicationCatalog: () => medicationCatalogState.current,
}));

const documentId = "11111111-1111-4111-8111-111111111111";

function documentMatch(): DocumentMatch {
  return {
    document_id: documentId,
    title: "Clozapine Monitoring Protocol",
    file_name: "clozapine-monitoring.pdf",
    labels: [],
    summarySnippet: "Synthetic summary.",
    bestPages: [1],
    bestChunkIds: ["clozapine-chunk"],
    imageCount: 0,
    tableCount: 0,
    matchReason: "Matched indexed passage",
    score: 0.9,
  };
}

function sourceDocument(): ClinicalDocument {
  return {
    id: documentId,
    title: "Clozapine Monitoring Protocol",
    description: null,
    file_name: "clozapine-monitoring.pdf",
    file_type: "application/pdf",
    file_size: 1024,
    storage_path: `documents/${documentId}.pdf`,
    status: "indexed",
    page_count: 2,
    chunk_count: 1,
    image_count: 0,
    error_message: null,
    metadata: {
      document_status: "current",
      clinical_validation_status: "approved",
      extraction_quality: "good",
      jurisdiction: "WA",
    },
    labels: [],
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
  };
}

const documentProps = {
  matches: [documentMatch()],
  recordMatches: [],
  showRecordMatches: false,
  query: "clozapine",
  loading: false,
  documentCount: 42,
  realDataReady: true,
  authUnavailable: false,
  apiUnavailable: false,
  setupWarning: null,
  onScopeDocument: vi.fn(),
  onAnswerFromDocument: vi.fn(),
  onOpenRecentDocuments: vi.fn(),
  onOpenLibrary: vi.fn(),
  onOpenSourcePdf: vi.fn(),
  onTagSearch: vi.fn(),
};

function renderMedicationWorkspace() {
  return render(
    <PatientProfileProvider>
      <MedicationPrescribingWorkspace
        query="clozapine"
        loading={false}
        realDataReady
        authUnavailable={false}
        apiUnavailable={false}
        setupWarning={null}
        onSuggestedSearch={vi.fn()}
        showHome={false}
      />
    </PatientProfileProvider>,
  );
}

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
  medicationCatalogState.current = { data: null, loading: true, error: null };
  vi.clearAllMocks();
});

describe("filter review regressions", () => {
  it("does not derive paginated document retrieval facets before the panel opens", async () => {
    const user = userEvent.setup();
    const source = sourceDocument();
    const metadata = source.metadata;
    let metadataReads = 0;
    Object.defineProperty(source, "metadata", {
      configurable: true,
      get: () => {
        metadataReads += 1;
        return metadata;
      },
    });

    render(<DocumentSearchResultsPanel {...documentProps} recentDocuments={[source]} />);

    expect(metadataReads).toBe(0);
    await user.click(screen.getByTestId("document-filter-trigger-phone"));
    expect(metadataReads).toBeGreaterThan(0);
  });

  it("labels document retrieval projections as loaded-source counts", async () => {
    const user = userEvent.setup();
    render(<DocumentSearchResultsPanel {...documentProps} recentDocuments={[sourceDocument()]} />);

    await user.click(screen.getByTestId("document-filter-trigger-phone"));

    const panel = screen.getByTestId("document-filter-panel");
    expect(within(panel).getByRole("radio", { name: /^Local \(1 loaded source\)$/ })).toBeInTheDocument();
  });

  it("defers differential projections until open and avoids repeated chapter-option scans", async () => {
    const user = userEvent.setup();
    const model = buildDifferentialStreamModel("diagnoses", "");
    const optionValues = [
      ...model.chapters.map((chapter) => `chapter:${chapter.id}`),
      ...model.presentationChapters.map((chapter) => `presentation:${chapter.id}`),
    ];
    const originalHas = Set.prototype.has;
    let optionMembershipChecks = 0;
    const hasSpy = vi.spyOn(Set.prototype, "has").mockImplementation(function (this: Set<unknown>, value: unknown) {
      if (typeof value === "string" && optionValues.includes(value)) optionMembershipChecks += 1;
      return originalHas.call(this, value);
    });

    try {
      render(<DifferentialStreamWorkspace model={model} query="" />);
      expect(optionMembershipChecks).toBe(0);

      await user.click(screen.getByTestId("differentials-stream-filter-trigger"));

      expect(optionMembershipChecks).toBeLessThan(optionValues.length * 8);
    } finally {
      hasSpy.mockRestore();
    }
  });

  it("retains a medication class deep link through initial loading and unrelated filter changes", () => {
    window.history.replaceState(null, "", "/medications/search?class=Other");
    const view = renderMedicationWorkspace();

    expect(new URLSearchParams(window.location.search).get("class")).toBe("Other");

    medicationCatalogState.current = {
      data: {
        records: [],
        matches: [
          {
            medication: undefined,
            result: {
              id: "clozapine",
              name: "Clozapine",
              indication: "Treatment-resistant schizophrenia",
              match: "Exact clinical fit",
              dose: "12.5 mg",
              ceiling: "900 mg",
              action: "Avoid abrupt cessation",
              actionTone: "danger",
              tone: "teal",
            },
            score: 1,
            reasons: [],
          },
        ],
        total: 1,
        governance: {},
      },
      loading: false,
      error: null,
    };
    view.rerender(
      <PatientProfileProvider>
        <MedicationPrescribingWorkspace
          query="clozapine"
          loading={false}
          realDataReady
          authUnavailable={false}
          apiUnavailable={false}
          setupWarning={null}
          onSuggestedSearch={vi.fn()}
          showHome={false}
        />
      </PatientProfileProvider>,
    );

    expect(new URLSearchParams(window.location.search).get("class")).toBe("Other");
    expect(screen.getByRole("button", { name: "Remove Class: Other filter" })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("medication-filter-trigger-desktop"));
    fireEvent.click(screen.getByRole("radio", { name: /^All medications/ }));
    expect(new URLSearchParams(window.location.search).get("class")).toBe("Other");
  });
});
