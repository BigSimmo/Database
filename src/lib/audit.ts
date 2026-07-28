import { logger } from "@/lib/logger";

// Append-only audit trail for sensitive operations. Rows are written via the service
// role into public.audit_logs (RLS-enabled, service-role-only). Writes are best-effort:
// failing to record an audit row must never break or roll back the operation it
// describes, so failures are logged, not thrown.

export type AuditAction = "document_upload" | "document_delete" | "document_rename" | "document_label_change";

export type AuditLogEntry = {
  ownerId: string;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Audit rows are retained indefinitely, so their metadata must be an operational
 * event summary rather than a second copy of document metadata. In particular,
 * upload filenames and rename/delete titles are user-controlled and can contain
 * patient identifiers. Keep this allowlist at the durable-write boundary so a
 * future caller cannot accidentally reintroduce free text into `audit_logs`.
 */
function minimumAuditMetadata(entry: AuditLogEntry): Record<string, boolean | number | string> {
  const metadata = entry.metadata ?? {};

  switch (entry.action) {
    case "document_upload": {
      const fileType = typeof metadata.fileType === "string" ? metadata.fileType : undefined;
      const fileSize =
        typeof metadata.fileSize === "number" && Number.isFinite(metadata.fileSize) ? metadata.fileSize : undefined;
      return {
        ...(fileType ? { fileType } : {}),
        ...(fileSize !== undefined ? { fileSize } : {}),
      };
    }
    case "document_delete": {
      // DELETE routes pass a removed-object count; older callers may pass a boolean.
      const storageRemoved = metadata.storageRemoved;
      if (typeof storageRemoved === "number" && Number.isFinite(storageRemoved)) {
        return { storageRemoved };
      }
      if (typeof storageRemoved === "boolean") {
        return { storageRemoved };
      }
      return {};
    }
    case "document_rename":
      return {};
    case "document_label_change": {
      const operation = metadata.operation;
      const documentId = metadata.documentId;
      const allowedOperation =
        operation === "create" ||
        operation === "edit" ||
        operation === "approve" ||
        operation === "hide" ||
        operation === "restore" ||
        operation === "delete"
          ? operation
          : undefined;
      const allowedDocumentId =
        typeof documentId === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(documentId)
          ? documentId
          : undefined;
      return {
        ...(allowedOperation ? { operation: allowedOperation } : {}),
        ...(allowedDocumentId ? { documentId: allowedDocumentId } : {}),
      };
    }
  }
}

// Minimal structural type so we do not couple to the full Supabase client type.
type AuditInsertClient = {
  from: (table: string) => {
    insert: (values: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>;
  };
};

export async function writeAuditLog(supabase: AuditInsertClient, entry: AuditLogEntry): Promise<void> {
  try {
    const { error } = await supabase.from("audit_logs").insert({
      owner_id: entry.ownerId,
      action: entry.action,
      resource_type: entry.resourceType ?? null,
      resource_id: entry.resourceId ?? null,
      metadata: minimumAuditMetadata(entry),
    });
    if (error) {
      logger.error("Audit log write failed", { action: entry.action, message: error.message });
    }
  } catch (error) {
    logger.error("Audit log write threw", {
      action: entry.action,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
