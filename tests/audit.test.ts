import { describe, expect, it, vi } from "vitest";
import { writeAuditLog } from "../src/lib/audit";

function mockClient(insert: (values: Record<string, unknown>) => Promise<{ error: { message: string } | null }>) {
  const insertSpy = vi.fn(insert);
  const from = vi.fn(() => ({ insert: insertSpy }));
  return { from, insertSpy };
}

describe("writeAuditLog", () => {
  it("inserts a normalized audit row into audit_logs", async () => {
    const client = mockClient(async () => ({ error: null }));

    await writeAuditLog(client, {
      ownerId: "owner-1",
      action: "document_upload",
      resourceType: "document",
      resourceId: "doc-1",
      metadata: { fileType: "application/pdf" },
    });

    expect(client.from).toHaveBeenCalledWith("audit_logs");
    expect(client.insertSpy).toHaveBeenCalledWith({
      owner_id: "owner-1",
      action: "document_upload",
      resource_type: "document",
      resource_id: "doc-1",
      metadata: { fileType: "application/pdf" },
    });
  });

  it("defaults optional fields", async () => {
    const client = mockClient(async () => ({ error: null }));

    await writeAuditLog(client, { ownerId: "owner-1", action: "document_delete" });

    expect(client.insertSpy).toHaveBeenCalledWith({
      owner_id: "owner-1",
      action: "document_delete",
      resource_type: null,
      resource_id: null,
      metadata: {},
    });
  });

  it("drops user-controlled document text from indefinitely retained audit metadata", async () => {
    const client = mockClient(async () => ({ error: null }));

    await writeAuditLog(client, {
      ownerId: "owner-1",
      action: "document_upload",
      resourceId: "doc-1",
      metadata: {
        fileName: "Jane Doe MRN 123456.pdf",
        contentHash: "content-derived-identifier",
        fileType: "application/pdf",
        fileSize: 1234,
        nested: { title: "Patient Jane Doe" },
      },
    });

    expect(client.insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { fileType: "application/pdf", fileSize: 1234 } }),
    );
    expect(JSON.stringify(client.insertSpy.mock.calls[0]?.[0])).not.toContain("Jane Doe");
    expect(JSON.stringify(client.insertSpy.mock.calls[0]?.[0])).not.toContain("content-derived-identifier");
  });

  it("does not retain previous or replacement titles for rename events", async () => {
    const client = mockClient(async () => ({ error: null }));

    await writeAuditLog(client, {
      ownerId: "owner-1",
      action: "document_rename",
      resourceId: "doc-1",
      metadata: { previousTitle: "Jane Doe", newTitle: "Patient Smith" },
    });

    expect(client.insertSpy).toHaveBeenCalledWith(expect.objectContaining({ metadata: {} }));
  });

  it("retains numeric storageRemoved counts from document deletes", async () => {
    const client = mockClient(async () => ({ error: null }));

    await writeAuditLog(client, {
      ownerId: "owner-1",
      action: "document_delete",
      resourceId: "doc-1",
      metadata: {
        storageRemoved: 2,
        title: "Jane Doe MRN 123456.pdf",
      },
    });

    expect(client.insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { storageRemoved: 2 } }),
    );
    expect(JSON.stringify(client.insertSpy.mock.calls[0]?.[0])).not.toContain("Jane Doe");
  });

  it("retains boolean storageRemoved flags from legacy delete callers", async () => {
    const client = mockClient(async () => ({ error: null }));

    await writeAuditLog(client, {
      ownerId: "owner-1",
      action: "document_delete",
      resourceId: "doc-1",
      metadata: { storageRemoved: true },
    });

    expect(client.insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { storageRemoved: true } }),
    );
  });

  it("does not throw when the insert returns an error", async () => {
    const client = mockClient(async () => ({ error: { message: "insert failed" } }));
    await expect(writeAuditLog(client, { ownerId: "o", action: "document_rename" })).resolves.toBeUndefined();
  });

  it("does not throw when the insert rejects", async () => {
    const client = mockClient(async () => {
      throw new Error("connection lost");
    });
    await expect(writeAuditLog(client, { ownerId: "o", action: "document_label_change" })).resolves.toBeUndefined();
  });
});
