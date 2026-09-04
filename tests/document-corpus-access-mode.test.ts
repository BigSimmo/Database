import { readdirSync, readFileSync } from "node:fs";
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
// The alignment migration REPLACES the whole switch, so its version has to sort after
// every other migration that replaces it -- 20260902110200 (#ZBAC9D) above all, which
// landed on main after this work started. Ordered the other way, merging would apply the
// alignment first and let the later version overwrite every child-owner statement in it,
// which is a fix that reaches the live database as a no-op.
const CHILD_OWNER_MIGRATION_FILE = "20260904090000_align_corpus_flip_retrieval_scoped_child_owners.sql";
const QUARANTINE_MIGRATION_FILE = "20260902110200_quarantine_ownerless_unpublished_on_private_rollback.sql";
// The #ZBAC9D private-branch quarantine condition, as the alignment migration must carry
// it forward: documents_ownerless_requires_publication_marker (20260902110500) aborts the
// whole return-to-private call without it.
const QUARANTINE_CONDITION =
  "status = case when existing_owner.id is null and not ( snapshot.owner_id is null and " +
  "snapshot.public_corpus_present and snapshot.public_corpus_value = 'true'::jsonb ) then 'failed' else d.status end";
const childOwnerMigration = readFileSync(
  new URL(`../supabase/migrations/${CHILD_OWNER_MIGRATION_FILE}`, import.meta.url),
  "utf8",
).replace(/\s+/g, " ");
const childOwnerGuardMigration = readFileSync(
  new URL("../supabase/migrations/20260904090100_validate_corpus_flip_child_owner_alignment.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");
const childOwnerFunction = childOwnerMigration.slice(
  childOwnerMigration.indexOf("create or replace function public.set_document_corpus_access_mode(p_mode text)"),
  childOwnerMigration.indexOf("comment on function public.set_document_corpus_access_mode(text)"),
);
const schemaSql = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");

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
    expect(effectiveMigration).toContain(
      "status = case when snapshot.owner_id is not null and existing_owner.id is null then 'failed' else d.status end",
    );
    expect(effectiveMigration).toContain("when snapshot.public_corpus_present then pg_catalog.jsonb_set");
    expect(effectiveMigration).toContain("else coalesce(d.metadata, '{}'::jsonb) - 'public_corpus'");
  });

  // The 20260826090000 switch body predates the retrieval-scope correction below.
  // Its pin is kept verbatim: that version rewrote no derived artifact at all.
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

describe("corpus flip aligns the retrieval-scoped derived owners", () => {
  // public.document_labels, public.document_summaries and public.document_table_facts
  // are the only three derived tables whose OWN owner_id is passed to
  // public.retrieval_owner_matches (supabase/schema.sql, get_related_document_metadata
  // and match_document_table_facts_text) — the same three 20260901120000 lists beside
  // public.documents. Leaving them owned while the parent document is published strips
  // labels, summaries and table facts from public retrieval for exactly the documents
  // the switch just published. Every other derived table is filtered through its parent
  // document's owner and must still stay untouched.
  const retrievalScopedTables = ["document_labels", "document_summaries", "document_table_facts"];
  const parentScopedTables = [
    "document_sections",
    "document_memory_cards",
    "document_embedding_fields",
    "document_index_quality",
    "document_index_units",
    "document_chunks",
    "document_pages",
    "document_images",
  ];

  it("publishes the retrieval-scoped derived owners in the same transaction as the documents", () => {
    for (const table of retrievalScopedTables) {
      expect(childOwnerMigration).toContain(`update public.${table}`);
    }
    expect(childOwnerMigration).toContain(
      "update public.document_labels l set owner_id = null, updated_at = now() from public.document_corpus_access_snapshots snapshot where snapshot.activation_id = v_activation_id and snapshot.document_id = l.document_id and l.owner_id = snapshot.owner_id",
    );
    expect(childOwnerMigration).toContain(
      "update public.document_summaries s set owner_id = null, updated_at = now() from public.document_corpus_access_snapshots snapshot where snapshot.activation_id = v_activation_id and snapshot.document_id = s.document_id and s.owner_id = snapshot.owner_id",
    );
    expect(childOwnerMigration).toContain(
      "update public.document_table_facts f set owner_id = null from public.document_corpus_access_snapshots snapshot where snapshot.activation_id = v_activation_id and snapshot.document_id = f.document_id and f.owner_id = snapshot.owner_id",
    );
  });

  it("still leaves every parent-scoped derived table untouched", () => {
    for (const table of parentScopedTables) {
      expect(childOwnerMigration).not.toContain(`update public.${table}`);
    }
  });

  it("restores the derived owners only for owners that still exist", () => {
    for (const alias of ["l", "s", "f"]) {
      expect(childOwnerMigration).toContain(
        `join auth.users existing_owner on existing_owner.id = snapshot.owner_id where snapshot.activation_id = v_activation_id and snapshot.document_id = ${alias}.document_id and ${alias}.owner_id is null`,
      );
    }
    expect(childOwnerMigration).toContain("set owner_id = existing_owner.id, updated_at = now()");
    // A deleted snapshot owner cannot be restored (owner_id references auth.users
    // ON DELETE RESTRICT); those rows stay ownerless beside their quarantined,
    // status = 'failed' document rather than being handed to a live account.
    expect(childOwnerMigration).not.toContain("set owner_id = snapshot.owner_id");
  });

  it("bounds the added work with an executable ceiling rather than an inert setting", () => {
    // PostgreSQL arms the statement-timeout timer once, when the top-level
    // statement starts, so a function-level `set statement_timeout` never
    // re-arms it for the call it is attached to: it would read as a
    // rollback-on-timeout safeguard while doing nothing at all. lock_timeout is
    // different -- it is re-read at every lock wait -- and stays pinned. The
    // real ceiling is therefore executable SQL, pinned here statement by
    // statement.
    expect(childOwnerMigration).toContain("security definer set search_path = '' set lock_timeout = '15s' as $$");
    expect(childOwnerFunction).not.toContain("statement_timeout");
    expect(childOwnerFunction).toContain("v_max_child_rows constant integer := 200000;");
    // Each branch probes its candidate child rows through a subquery that stops
    // at the ceiling, and refuses before touching a row.
    expect(childOwnerFunction.match(/limit v_max_child_rows \+ 1/g)?.length).toBe(2);
    expect(childOwnerFunction.match(/if v_child_row_probe > v_max_child_rows then/g)?.length).toBe(2);
    // Each of the six updates then adds its real row_count, and the branch
    // raises -- rolling the whole flip back -- if a concurrent insert pushed the
    // total past the ceiling.
    expect(childOwnerFunction.match(/get diagnostics v_updated = row_count;/g)?.length).toBe(6);
    expect(childOwnerFunction.match(/if v_child_rows > v_max_child_rows then/g)?.length).toBe(2);
    expect(childOwnerFunction.match(/using errcode = '54000'/g)?.length).toBe(4);
    expect(childOwnerMigration).toContain("publish in batches through public.publish_approved_documents instead");
  });

  it("carries the #ZBAC9D quarantine widening forward rather than reverting it", () => {
    // This migration replaces the whole function, so whatever it does NOT say is dropped.
    // 20260902110200 widened the private-branch quarantine from "the owner was deleted" to
    // "the row lands ownerless without a true publication marker", and 20260902110500 then
    // made that load-bearing: without it the return-to-private call aborts on
    // documents_ownerless_requires_publication_marker. Both the body and the guard beside
    // it pin the condition, so a rebase cannot silently reinstate the narrower test.
    expect(CHILD_OWNER_MIGRATION_FILE > QUARANTINE_MIGRATION_FILE).toBe(true);
    expect(childOwnerFunction).toContain(QUARANTINE_CONDITION);
    expect(childOwnerFunction).not.toContain(
      "status = case when snapshot.owner_id is not null and existing_owner.id is null then 'failed'",
    );
    expect(childOwnerGuardMigration).toContain(QUARANTINE_CONDITION.replace(/'/g, "''"));
  });

  it("corrects the header rationale that called derived owners irrelevant to visibility", () => {
    expect(childOwnerMigration).toContain("retrieval_owner_matches");
    expect(childOwnerMigration).toContain("20260825025717");
  });

  it("ships a fail-fast validation guard that never rebuilds the function it checks", () => {
    expect(childOwnerGuardMigration).toContain("set local lock_timeout");
    expect(childOwnerGuardMigration).toContain("set local statement_timeout");
    expect(childOwnerGuardMigration).toContain("to_regprocedure");
    expect(childOwnerGuardMigration).toContain("raise exception");
    expect(childOwnerGuardMigration.match(/raise exception/g)?.length).toBe(1);
    expect(childOwnerGuardMigration).not.toContain("create or replace function");
    expect(childOwnerGuardMigration).not.toContain("create index");
    for (const table of retrievalScopedTables) {
      expect(childOwnerGuardMigration).toContain(table);
    }
    // The guard asserts the executable ceiling, not the comment that describes
    // it, and rejects a function-level statement_timeout being reintroduced as a
    // safeguard it cannot be.
    for (const fragment of [
      "v_max_child_rows constant integer := 200000",
      "limit v_max_child_rows + 1",
      "if v_child_row_probe > v_max_child_rows then",
      "get diagnostics v_updated = row_count",
      "if v_child_rows > v_max_child_rows then",
    ]) {
      expect(childOwnerGuardMigration).toContain(fragment);
    }
    expect(childOwnerGuardMigration).toContain(
      "statement_timeout is set on the function, where it cannot bound the running call",
    );
  });
});

describe("supabase/schema.sql mirrors the migrated corpus access switch", () => {
  // supabase/schema.sql is the source the hosted schema is rebuilt from, and
  // check:drift compares the live pg_get_functiondef hash against a manifest
  // generated by replaying it. A migration that replaces this function while
  // schema.sql keeps an older body is therefore live-vs-repo drift by
  // construction: the PR passes (the manifest still matches its own schema.sql)
  // and the post-merge live-drift run goes red.
  const migrationsDirectory = new URL("../supabase/migrations/", import.meta.url);
  const switchHead = "create or replace function public.set_document_corpus_access_mode(p_mode text)";
  const switchTail = "grant execute on function public.set_document_corpus_access_mode(text) to service_role;";

  const switchDefinition = (source: string, label: string) => {
    const start = source.indexOf(switchHead);
    expect(start, `${label} does not define public.set_document_corpus_access_mode`).toBeGreaterThanOrEqual(0);
    const end = source.indexOf(switchTail, start);
    expect(end, `${label} does not close the switch with its service_role grant`).toBeGreaterThan(start);
    return source
      .slice(start, end + switchTail.length)
      .replace(/\s+/g, " ")
      .trim();
  };

  const replacements = readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith(".sql"))
    .filter((file) => readFileSync(new URL(file, migrationsDirectory), "utf8").includes(switchHead))
    .sort();

  it("tracks every migration that replaces the switch, newest last", () => {
    expect(replacements.length).toBeGreaterThan(0);
    expect(replacements).toContain(QUARANTINE_MIGRATION_FILE);
    expect(replacements.at(-1)).toBe(CHILD_OWNER_MIGRATION_FILE);
  });

  it("carries the newest migrated body, comment and grants verbatim", () => {
    const newest = replacements.at(-1) as string;
    const migrated = readFileSync(new URL(newest, migrationsDirectory), "utf8");
    expect(
      switchDefinition(schemaSql, "supabase/schema.sql"),
      `supabase/schema.sql mirrors a superseded version of public.set_document_corpus_access_mode. Copy the definition from supabase/migrations/${newest} and regenerate supabase/drift-manifest.json (npm run drift:manifest, requires Docker).`,
    ).toBe(switchDefinition(migrated, newest));
  });
});
