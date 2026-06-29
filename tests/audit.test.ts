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
