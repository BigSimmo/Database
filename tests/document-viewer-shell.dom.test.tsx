import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// DocumentViewer resolves a four-way shell state (loading / ready / auth-required
// / error) that decides whether a source document is shown at all. The
// auth-required branch is the private-document gate: an unauthenticated reader
// must get the sign-in shell, never document content. The state is prop-drivable
// via initialDetail / initialError, so these tests pin it without a network.

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
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

// Every document request is gated on a local-project identity probe
// (/api/local-project-id). No server answers it in a unit run, and when the
// probe fails the viewer replaces the error under test with its own
// "unsafe local project" message — which is exactly why this file passed on a
// workstation with the dev server up and failed in CI. Stub it as a safe local
// origin so the shell state, not the environment, decides the outcome.
vi.mock("@/lib/local-project-identity", () => ({
  readLocalProjectIdentity: async () => ({ localServer: { safeLocalOrigin: true } }),
  unsafeLocalProjectMessage: () => "This local server does not belong to this project.",
}));

// The preview is next/dynamic-loaded and never mounts synchronously in jsdom;
// it is mocked defensively so a late resolve cannot pull a real canvas into the
// test environment. The shell state, not the raster preview, is under test.
vi.mock("@/components/document-viewer/pdf-canvas-viewer", () => ({
  PdfCanvasViewer: () => null,
  NativePdfEmbed: () => null,
}));

import { DocumentViewer } from "@/components/DocumentViewer";
import type { DocumentDetailPayload } from "@/lib/document-detail-contract";

function detailPayload() {
  return {
    document: {
      id: "doc-1",
      title: "Clozapine titration guideline",
      description: null,
      file_name: "clozapine-titration.pdf",
      file_type: "application/pdf",
      file_size: 204800,
      storage_path: "documents/doc-1/clozapine-titration.pdf",
      status: "indexed",
      page_count: 4,
      chunk_count: 8,
      image_count: 0,
      error_message: null,
      updated_at: "2026-01-01T00:00:00.000Z",
      created_at: "2026-01-01T00:00:00.000Z",
      labels: [],
      metadata: {},
      summary: null,
    },
    pages: [],
    images: [],
    tableFacts: [],
    chunks: [],
    demoMode: true,
    assetScope: "document",
    window: {
      requestedPage: 1,
      effectivePage: 1,
      selectedChunkId: null,
      pages: { from: 1, to: 4, limit: 4, total: 4, hasBefore: false, hasAfter: false },
      chunks: { offset: 0, limit: 8, total: 8, hasBefore: false, hasAfter: false, selectedChunkId: null },
    },
    pageWindow: { from: 1, to: 4, limit: 4, total: 4, hasBefore: false, hasAfter: false },
    chunkWindow: { offset: 0, limit: 8, total: 8, hasBefore: false, hasAfter: false, selectedChunkId: null },
  } satisfies DocumentDetailPayload;
}

// In demo / local-no-auth mode every document is public, so the private-access
// gate is deliberately inert and the sign-in shell can never render. Whichever
// of those a runner happens to export would silently turn the gate assertion
// into a no-op, so pin both off — this test is about the gate, not the mode.
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
  vi.stubEnv("NEXT_PUBLIC_LOCAL_NO_AUTH", "false");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("DocumentViewer — shell states", () => {
  it("shows the sign-in shell (never document content) when private access is required", async () => {
    render(
      <DocumentViewer documentId="doc-1" initialPage={1} initialError="Sign in to open private source documents." />,
    );

    expect(await screen.findByText("Sign in required")).toBeVisible();
    expect(screen.getByText("Sign in to open private source documents.")).toBeVisible();
    // The private-access gate must resolve to its own shell, not the generic
    // failure shell (which would read as "broken" rather than "sign in").
    expect(screen.queryByText("Source unavailable")).toBeNull();
  });

  it("shows the unavailable shell with the failure reason for a generic load error", async () => {
    render(<DocumentViewer documentId="doc-1" initialPage={1} initialError="Document could not be loaded." />);

    expect(await screen.findByText("Source unavailable")).toBeVisible();
    expect(screen.getByText("Document could not be loaded.")).toBeVisible();
    expect(screen.queryByText("Sign in required")).toBeNull();
  });

  it("shows the ready shell with the document identity when a detail payload is supplied", async () => {
    render(<DocumentViewer documentId="doc-1" initialPage={1} initialDetail={detailPayload()} />);

    // The display title is smart-cased from "Clozapine titration guideline" and
    // rendered in the header h1. The exact filename is visible only inside the
    // document actions sheet, opened by the "Open document actions" button.
    const heading = await screen.findByRole("heading", { level: 1, name: "Clozapine Titration Guideline" });
    expect(heading).toBeVisible();

    // Open the document actions sheet and verify the exact filename is visible.
    // There are two "Open document actions" buttons (header and floating composer);
    // click the first one (header button) to open the actions sheet.
    const actionsButtons = screen.getAllByRole("button", { name: "Open document actions" });
    fireEvent.click(actionsButtons[0]);
    expect(await screen.findByText("clozapine-titration.pdf")).toBeVisible();

    // A supplied payload must resolve to the ready shell — neither failure shell.
    expect(screen.queryByText("Source unavailable")).toBeNull();
    expect(screen.queryByText("Sign in required")).toBeNull();
  });
});
