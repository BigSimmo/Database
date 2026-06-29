import { logger } from "@/lib/logger";

// Append-only audit trail for sensitive operations. Rows are written via the service
// role into public.audit_logs (RLS-enabled, service-role-only). Writes are best-effort:
// failing to record an audit row must never break or roll back the operation it
// describes, so failures are logged, not thrown.

export type AuditAction =
  | "document_upload"
  | "document_delete"
  | "document_rename"
  | "document_label_change";

export type AuditLogEntry = {
  ownerId: string;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
};

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
      metadata: entry.metadata ?? {},
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
