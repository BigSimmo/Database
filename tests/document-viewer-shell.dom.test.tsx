import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// DocumentViewer resolves a four-way shell state (loading / ready / auth-required
// / error) that decides whether a source document is shown at all. The
// auth-required branch is the private-document gate: an unauthenticated reader
// must get the sign-in shell, never document content. The state is prop-drivable
// via initialDetail / initialError, so these tests pin it without a network.

const { push, authorizationHeader, registerAuthRequest, isAuthEpochCurrent, markSessionExpired } = vi.hoisted(() => ({
  push: vi.fn(),
  authorizationHeader: {},
  registerAuthRequest: vi.fn(() => ({ epoch: 1, release: vi.fn() })),
  isAuthEpochCurrent: vi.fn(() => true),
  markSessionExpired: vi.fn(),
}));
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
    authorizationHeader,
    registerAuthRequest,
    isAuthEpochCurrent,
    markSessionExpired,
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
  vi.unstubAllGlobals();
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
    expect(actionsButtons).toHaveLength(2);
    expect(actionsButtons[0]).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Add this document to scope" })).toBeNull();
    fireEvent.click(actionsButtons[0]);
    expect(await screen.findByText("clozapine-titration.pdf")).toBeVisible();
    expect(actionsButtons[0]).toHaveAttribute("aria-expanded", "true");

    // Close the sheet before teardown so focus-restore timers settle while jsdom
    // is still alive (avoids an unhandled post-test `document` ReferenceError
    // under the coverage worker pool).
    fireEvent.click(screen.getByRole("button", { name: "Close document actions" }));
    expect(screen.queryByText("clozapine-titration.pdf")).toBeNull();

    // A supplied payload must resolve to the ready shell — neither failure shell.
    expect(screen.queryByText("Source unavailable")).toBeNull();
    expect(screen.queryByText("Sign in required")).toBeNull();
  });

  it("requires two characters and ignores an aborted search response after the query changes", async () => {
    const pendingSearches: Array<{
      url: string;
      resolve: (response: Response) => void;
    }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (!url.includes("/api/documents/doc-1/search?")) {
          return Promise.resolve(new Response(JSON.stringify({ error: "Unexpected request" }), { status: 404 }));
        }
        return new Promise<Response>((resolve) => pendingSearches.push({ url, resolve }));
      }),
    );

    render(<DocumentViewer documentId="doc-1" initialPage={1} initialDetail={detailPayload()} />);
    const composerSearch = await screen.findByRole("textbox", { name: "Search within this document" });

    fireEvent.change(composerSearch, { target: { value: "r" } });
    expect(await screen.findByText("Enter at least 2 characters to search all indexed passages.")).toBeVisible();
    expect(pendingSearches).toHaveLength(0);

    fireEvent.change(composerSearch, { target: { value: "first query" } });
    await waitFor(() => expect(pendingSearches).toHaveLength(1));
    fireEvent.change(composerSearch, { target: { value: "second query" } });
    await waitFor(() => expect(pendingSearches).toHaveLength(2));

    pendingSearches[1]?.resolve(
      Response.json({
        query: "second query",
        results: [
          {
            id: "second-hit",
            page_number: 2,
            chunk_index: 1,
            section_heading: "Second result",
            snippet: "Second query current result",
            matched_terms: ["second", "query"],
            image_ids: [],
            score: 2,
          },
        ],
      }),
    );
    const indexedTextPanel = screen.getByTestId("source-chunk-indexed-text-panel");
    await waitFor(() => expect(indexedTextPanel).toHaveTextContent("Second query current result"));

    pendingSearches[0]?.resolve(
      Response.json({
        query: "first query",
        results: [
          {
            id: "first-hit",
            page_number: 1,
            chunk_index: 0,
            section_heading: "Stale result",
            snippet: "First query stale result",
            matched_terms: ["first", "query"],
            image_ids: [],
            score: 3,
          },
        ],
      }),
    );
    await waitFor(() => {
      expect(indexedTextPanel).not.toHaveTextContent("First query stale result");
      expect(indexedTextPanel).toHaveTextContent("Second query current result");
    });
  });
});
