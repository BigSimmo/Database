import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DocumentDrawer } from "@/components/clinical-dashboard/document-admin";
import type {
  DocumentDrawerMode,
  DocumentDrawerStatusFilter,
} from "@/components/clinical-dashboard/dashboard-contracts";
import type { ClinicalDocument } from "@/lib/types";

// The per-row DocumentManagementActions is a separate component with its own
// AuthProvider-backed admin check; DocumentDrawer's responsibility is only to
// mount it in the right mode/permission state. Stub it so these tests isolate
// DocumentDrawer's gating from that component's auth internals.
vi.mock("@/components/DocumentManagementActions", () => ({
  DocumentManagementActions: ({ disabled }: { disabled?: boolean }) => (
    <div data-testid="doc-mgmt-actions" data-disabled={disabled ? "true" : "false"} />
  ),
}));

// DocumentDrawer is the destructive, permission-gated document-maintenance surface
// (bulk reindex, bulk metadata, per-document rename/delete). It is fully
// prop-driven — data and every mutation arrive as props — so it can be rendered
// with fixtures and spy callbacks without provider scaffolding. These tests pin
// the two properties that matter most for a destructive admin panel: nothing
// mutating is reachable without `canManageDocuments`, and the actions that ARE
// reachable dispatch the right callback.

function makeDocument(partial: Partial<ClinicalDocument> = {}): ClinicalDocument {
  return {
    id: "doc-1",
    title: "Antipsychotic switching guideline",
    file_name: "antipsychotic-switching.pdf",
    file_type: "application/pdf",
    status: "indexed",
    page_count: 12,
    chunk_count: 40,
    image_count: 2,
    updated_at: "2026-01-01T00:00:00.000Z",
    labels: [],
    metadata: {},
    summary: null,
    ...partial,
  } as unknown as ClinicalDocument;
}

function baseProps() {
  return {
    documents: [makeDocument()],
    pagination: null,
    loadingMoreDocuments: false,
    mode: "admin" as DocumentDrawerMode,
    selectedDocumentIds: [] as string[],
    statusFilter: "all" as DocumentDrawerStatusFilter,
    onToggleScope: vi.fn(),
    onLoadMoreDocuments: vi.fn(),
    onDocumentRenamed: vi.fn(),
    onDocumentDeleted: vi.fn(),
    onBulkReindex: vi.fn(),
    onBulkAssignCollection: vi.fn(),
    onBulkMetadataUpdate: vi.fn(),
    bulkActionStatus: null,
    bulkActionBusy: false,
    canManageDocuments: true,
    onTagSearch: vi.fn(),
    onMutateLabel: vi.fn(async () => true),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DocumentDrawer — permission gating of the destructive surface", () => {
  it("mounts per-document management actions only in admin mode with manage permission", () => {
    const { rerender } = render(<DocumentDrawer {...baseProps()} mode="admin" canManageDocuments />);
    expect(screen.getByTestId("doc-mgmt-actions")).toBeVisible();

    // Same admin mode, but the viewer cannot manage documents → no destructive controls.
    rerender(<DocumentDrawer {...baseProps()} mode="admin" canManageDocuments={false} />);
    expect(screen.queryByTestId("doc-mgmt-actions")).toBeNull();

    // Manage permission but a non-admin browsing mode → still no destructive controls.
    rerender(<DocumentDrawer {...baseProps()} mode="library" canManageDocuments />);
    expect(screen.queryByTestId("doc-mgmt-actions")).toBeNull();
  });

  it("hides the bulk-action panel unless admin mode, permission, and a selection all hold", () => {
    const props = baseProps();
    // Admin + permission but nothing selected → no bulk panel.
    const { rerender } = render(<DocumentDrawer {...props} selectedDocumentIds={[]} />);
    expect(screen.queryByRole("button", { name: "Full reindex" })).toBeNull();

    // Selection present but no manage permission → still no bulk panel.
    rerender(<DocumentDrawer {...props} selectedDocumentIds={["doc-1"]} canManageDocuments={false} />);
    expect(screen.queryByRole("button", { name: "Full reindex" })).toBeNull();

    // Admin + permission + selection → the bulk panel appears.
    rerender(<DocumentDrawer {...props} selectedDocumentIds={["doc-1"]} canManageDocuments />);
    expect(screen.getByRole("button", { name: "Full reindex" })).toBeVisible();
  });
});

describe("DocumentDrawer — bulk actions dispatch the right intent", () => {
  it("routes each reindex button to onBulkReindex with its mode", () => {
    const props = baseProps();
    render(<DocumentDrawer {...props} selectedDocumentIds={["doc-1"]} />);

    fireEvent.click(screen.getByRole("button", { name: "Regenerate summaries" }));
    fireEvent.click(screen.getByRole("button", { name: "Full reindex" }));
    fireEvent.click(screen.getByRole("button", { name: "Retry failed" }));

    expect(props.onBulkReindex.mock.calls.map((call) => call[0])).toEqual(["enrichment", "full", "retry_failed"]);
  });

  it("assigns a collection only once a non-empty name is entered", () => {
    const props = baseProps();
    render(<DocumentDrawer {...props} selectedDocumentIds={["doc-1"]} />);

    const assign = screen.getByRole("button", { name: "Assign collection" });
    expect(assign).toBeDisabled(); // empty draft

    fireEvent.change(screen.getByLabelText("Collection name for selected documents"), {
      target: { value: "Antipsychotics" },
    });
    expect(assign).toBeEnabled();
    fireEvent.click(assign);
    expect(props.onBulkAssignCollection).toHaveBeenCalledWith("Antipsychotics");
  });

  it("disables the bulk actions while a bulk action is in flight", () => {
    const props = baseProps();
    render(<DocumentDrawer {...props} selectedDocumentIds={["doc-1"]} bulkActionBusy />);
    expect(screen.getByRole("button", { name: "Full reindex" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Retry failed" })).toBeDisabled();
  });
});

describe("DocumentDrawer — browsing", () => {
  it("filters the visible documents by the search field", () => {
    const props = baseProps();
    render(
      <DocumentDrawer
        {...props}
        documents={[
          makeDocument({ id: "doc-1", title: "Antipsychotic switching guideline" }),
          makeDocument({ id: "doc-2", title: "Lithium monitoring protocol", file_name: "lithium-monitoring.pdf" }),
        ]}
      />,
    );

    // The display title is smart-cased, so match on a distinctive word.
    expect(screen.getByRole("link", { name: /antipsychotic/i })).toBeVisible();
    expect(screen.getByRole("link", { name: /lithium/i })).toBeVisible();

    fireEvent.change(screen.getByLabelText("Find a document"), { target: { value: "lithium" } });

    expect(screen.queryByRole("link", { name: /antipsychotic/i })).toBeNull();
    expect(screen.getByRole("link", { name: /lithium/i })).toBeVisible();
  });

  it("loads more documents from the paginated footer", () => {
    const props = baseProps();
    render(
      <DocumentDrawer
        {...props}
        pagination={{ limit: 1, offset: 0, total: 2, nextOffset: 1, hasMore: true } as never}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Load more documents" }));
    expect(props.onLoadMoreDocuments).toHaveBeenCalledTimes(1);
  });

  it("toggles a document in and out of the answer scope", () => {
    const props = baseProps();
    const { rerender } = render(<DocumentDrawer {...props} selectedDocumentIds={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Add scope" }));
    expect(props.onToggleScope).toHaveBeenCalledWith("doc-1");

    rerender(<DocumentDrawer {...props} selectedDocumentIds={["doc-1"]} />);
    expect(screen.getByRole("button", { name: "In scope" })).toBeVisible();
  });
});

describe("DocumentDrawer — the refine region", () => {
  // Five label-plus-48px selects cost most of a phone viewport, and this sheet's
  // job is to show sources. They fold away; what is IN FORCE never does.
  it("keeps the refine controls folded until asked, while the group stays reachable", () => {
    render(<DocumentDrawer {...baseProps()} mode="library" />);

    expect(screen.getByRole("group", { name: "Refine sources" })).toBeVisible();
    const refine = screen.getByRole("button", { name: /Refine/ });
    expect(refine).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(refine);
    expect(refine).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Provenance")).toBeVisible();
  });

  it("surfaces an active refinement as a removable chip that survives collapsing the panel", () => {
    render(<DocumentDrawer {...baseProps()} mode="library" />);

    fireEvent.click(screen.getByRole("button", { name: /Refine/ }));
    fireEvent.change(screen.getByLabelText("Provenance"), { target: { value: "official" } });

    // Folded away again, the constraint is still stated — the chips live outside
    // the disclosure precisely so collapsing can never hide one.
    fireEvent.click(screen.getByRole("button", { name: /Refine/ }));
    const remove = screen.getByRole("button", { name: "Remove the provenance filter Official" });
    expect(remove).toBeVisible();

    fireEvent.click(remove);
    expect(screen.queryByRole("button", { name: /^Remove the provenance filter/ })).toBeNull();
  });

  it("separates filtered-to-zero from a query that matched nothing, and offers the way out", () => {
    // The fixture document carries no authority metadata, so it classifies as
    // unclassified and an Official filter excludes it.
    render(<DocumentDrawer {...baseProps()} mode="library" />);

    fireEvent.click(screen.getByRole("button", { name: /Refine/ }));
    fireEvent.change(screen.getByLabelText("Provenance"), { target: { value: "official" } });

    expect(screen.getByText("No documents match these filters")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.queryByText("No documents match these filters")).toBeNull();
    expect(screen.getByRole("link", { name: /Antipsychotic switching/i })).toBeVisible();
  });
});
