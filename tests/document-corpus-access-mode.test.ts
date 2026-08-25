import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const installMigration = readFileSync(
  new URL("../supabase/migrations/20260825025032_reversible_document_corpus_access_mode.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");
const recordedScopeMigration = readFileSync(
  new URL("../supabase/migrations/20260825025717_scope_document_corpus_access_mode_to_documents.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");
const hardeningMigration = readFileSync(
  new URL("../supabase/migrations/20260825030411_harden_document_corpus_access_state.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");
const effectiveMigration = readFileSync(
  new URL("../supabase/migrations/20260826090000_fail_closed_deleted_document_owner_rollback.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");

describe("document corpus access mode migration", () => {
  it("keeps the visibility switch and its snapshots service-role-only", () => {
    expect(installMigration).toContain("alter table public.document_corpus_access_state enable row level security");
    expect(installMigration).toContain("alter table public.document_corpus_access_snapshots enable row level security");
    expect(hardeningMigration).toContain(
      "revoke all on table public.document_corpus_access_state from public, anon, authenticated, service_role",
    );
    expect(hardeningMigration).toContain(
      "revoke all on table public.document_corpus_access_snapshots from public, anon, authenticated, service_role",
    );
    expect(effectiveMigration).toContain(
      "revoke all on function public.set_document_corpus_access_mode(text) from public, anon, authenticated",
    );
    expect(effectiveMigration).toContain(
      "grant execute on function public.set_document_corpus_access_mode(text) to service_role",
    );
    expect(effectiveMigration).toContain("security definer set search_path = '' set lock_timeout = '15s'");
  });

  it("indexes snapshot cleanup by document id", () => {
    expect(hardeningMigration).toContain(
      "create index if not exists document_corpus_access_snapshots_document_id_idx on public.document_corpus_access_snapshots (document_id)",
    );
  });

  it("captures owner and exact public marker state before publishing", () => {
    expect(installMigration).toContain("public_corpus_present boolean not null");
    expect(installMigration).toContain("public_corpus_value jsonb");
    expect(effectiveMigration).toContain("coalesce(d.metadata, '{}'::jsonb) ? 'public_corpus'");
    expect(effectiveMigration).toContain("coalesce(d.metadata, '{}'::jsonb)->'public_corpus'");
    expect(effectiveMigration).toContain("owner_id = null");
    expect(effectiveMigration).toContain(
      "metadata = pg_catalog.jsonb_set(coalesce(d.metadata, '{}'::jsonb), '{public_corpus}', 'true'::jsonb, true)",
    );
  });

  it("uses a new forward migration after the recorded hosted function version", () => {
    expect(recordedScopeMigration).toContain("set owner_id = snapshot.owner_id");
    expect(recordedScopeMigration).not.toContain("left join auth.users existing_owner");
    expect(effectiveMigration).not.toContain("set owner_id = snapshot.owner_id");
  });

  it("restores surviving owners and fails closed when the snapshotted owner was deleted", () => {
    expect(effectiveMigration).toContain("set owner_id = existing_owner.id");
    expect(effectiveMigration).toContain(
      "left join auth.users existing_owner on existing_owner.id = snapshot.owner_id",
    );
    expect(effectiveMigration).toContain(
      "when snapshot.owner_id is not null and existing_owner.id is null then coalesce(d.metadata, '{}'::jsonb) - 'public_corpus'",
    );
    expect(effectiveMigration).toContain("when snapshot.public_corpus_present then pg_catalog.jsonb_set");
    expect(effectiveMigration).toContain("else coalesce(d.metadata, '{}'::jsonb) - 'public_corpus'");
  });

  it("does not rewrite high-volume derived artifacts at the authorization boundary", () => {
    for (const table of [
      "document_labels",
      "document_summaries",
      "document_sections",
      "document_memory_cards",
      "document_table_facts",
      "document_embedding_fields",
      "document_index_quality",
      "document_index_units",
    ]) {
      expect(effectiveMigration).not.toContain(`update public.${table}`);
    }
  });

  it("serializes the switch and confines the approval-trigger bypass to the function transaction", () => {
    expect(effectiveMigration).toContain(
      "pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('document-corpus-access-mode', 0))",
    );
    expect(effectiveMigration).toContain(
      "execute 'alter table public.documents disable trigger documents_require_publication_approval'",
    );
    expect(effectiveMigration).toContain(
      "execute 'alter table public.documents enable trigger documents_require_publication_approval'",
    );
  });
});
