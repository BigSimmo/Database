import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// DocumentViewer resolves a four-way shell state (loading / ready / auth-required
// / error) that decides whether a source document is shown at all. The
// auth-required branch is the private-document gate: an unauthenticated reader
// must get the sign-in shell, never document content. The state is prop-drivable
// via initialDetail / initialError, so these tests pin it without a network.

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/documents/doc-1",
}));

vi.mock("@/lib/supabase/client", () => ({
  useAuthSession: () => ({
    status: "signed_out",
    session: null,
    isConfigured: true,
    authorizationHeader: {},
    registerAuthRequest: () => ({ epoch: 1, release: vi.fn() }),
    isAuthEpochCurrent: () => true,
    markSessionExpired: vi.fn(),
    signInWithEmail: vi.fn(),
    signInWithPassword: vi.fn(),
    signUpWithPassword: vi.fn(),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
  }),
}));

// The preview is next/dynamic-loaded and never mounts synchronously in jsdom;
// it is mocked defensively so a late resolve cannot pull a real canvas into the
// test environment. The shell state, not the raster preview, is under test.
vi.mock("@/components/document-viewer/pdf-canvas-viewer", () => ({
  PdfCanvasViewer: () => null,
  NativePdfEmbed: () => null,
}));

import { DocumentViewer } from "@/components/DocumentViewer";

function detailPayload() {
  return {
    document: {
      id: "doc-1",
      title: "Clozapine titration guideline",
      file_name: "clozapine-titration.pdf",
      file_type: "application/pdf",
      status: "indexed",
      page_count: 4,
      chunk_count: 8,
      image_count: 0,
      updated_at: "2026-01-01T00:00:00.000Z",
      labels: [],
      metadata: {},
      summary: null,
    },
    pages: [],
    images: [],
    tableFacts: [],
    chunks: [],
    demoMode: true,
    assetScope: "public",
    window: { requestedPage: 1, effectivePage: 1, selectedChunkId: null },
  } as never;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("DocumentViewer — shell states", () => {
  it("shows the sign-in shell (never document content) when private access is required", () => {
    render(
      <DocumentViewer documentId="doc-1" initialPage={1} initialError="Sign in to open private source documents." />,
    );

    expect(screen.getByText("Sign in required")).toBeVisible();
    expect(screen.getByText("Sign in to open private source documents.")).toBeVisible();
    // The private-access gate must resolve to its own shell, not the generic
    // failure shell (which would read as "broken" rather than "sign in").
    expect(screen.queryByText("Source unavailable")).toBeNull();
  });

  it("shows the unavailable shell with the failure reason for a generic load error", () => {
    render(<DocumentViewer documentId="doc-1" initialPage={1} initialError="Document could not be loaded." />);

    expect(screen.getByText("Source unavailable")).toBeVisible();
    expect(screen.getByText("Document could not be loaded.")).toBeVisible();
    expect(screen.queryByText("Sign in required")).toBeNull();
  });

  it("shows the ready shell with the document identity when a detail payload is supplied", () => {
    render(<DocumentViewer documentId="doc-1" initialPage={1} initialDetail={detailPayload()} />);

    // The display title is smart-cased, so match on a distinctive word.
    expect(screen.getAllByText(/clozapine/i).length).toBeGreaterThan(0);
    // A supplied payload must resolve to the ready shell — neither failure shell.
    expect(screen.queryByText("Source unavailable")).toBeNull();
    expect(screen.queryByText("Sign in required")).toBeNull();
  });
});
