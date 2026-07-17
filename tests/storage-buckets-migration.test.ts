import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Guards supabase/migrations/20260717130000_create_storage_buckets.sql, the
// schema-drift fix that adds the clinical-documents / clinical-images bucket
// inserts to the migration chain. Before this migration, a database built by
// replaying migrations (rather than applying supabase/schema.sql directly) had
// storage.objects RLS policies (20260527000000_bulk_ingestion.sql) referencing
// buckets that were never created, so uploads failed on a fresh replay.

const root = join(__dirname, "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const migration = read("supabase/migrations/20260717130000_create_storage_buckets.sql");
const schema = read("supabase/schema.sql");
const bulkIngestionMigration = read("supabase/migrations/20260527000000_bulk_ingestion.sql");

// Matches each `insert into storage.buckets (...) values (...) on conflict ...;`
// statement verbatim, including internal whitespace/newlines.
const BUCKET_INSERT_RE =
  /insert into storage\.buckets \(id, name, public, file_size_limit, allowed_mime_types\)[\s\S]*?on conflict \(id\) do update set public = false;/g;

function extractBucketInserts(text: string): string[] {
  return [...text.matchAll(BUCKET_INSERT_RE)].map((m) => m[0]);
}

describe("supabase/migrations/20260717130000_create_storage_buckets.sql", () => {
  it("contains exactly two idempotent bucket inserts", () => {
    const inserts = extractBucketInserts(migration);
    expect(inserts).toHaveLength(2);
    for (const insert of inserts) {
      expect(insert).toContain("on conflict (id) do update set public = false;");
    }
  });

  it("creates the clinical-documents bucket as private with the documented size limit and mime types", () => {
    expect(migration).toContain("'clinical-documents',\n  'clinical-documents',\n  false,\n  157286400,");
    expect(migration).toContain("'application/pdf'");
    expect(migration).toContain(
      "'application/vnd.openxmlformats-officedocument.wordprocessingml.document'",
    );
    expect(migration).toContain(
      "'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'",
    );
    expect(migration).toContain("'text/plain'");
  });

  it("creates the clinical-images bucket as private with the documented size limit and mime types", () => {
    expect(migration).toContain("'clinical-images',\n  'clinical-images',\n  false,\n  52428800,");
    expect(migration).toContain("array['image/png', 'image/jpeg', 'image/webp']");
  });

  it("never marks either bucket as public", () => {
    expect(migration).not.toMatch(/'clinical-documents'[\s\S]{0,60}true/);
    expect(migration).not.toMatch(/'clinical-images'[\s\S]{0,60}true/);
    // Both on-conflict clauses re-affirm private, not a no-op.
    expect(migration).not.toContain("on conflict (id) do nothing");
  });

  it("uses id === name for both buckets, matching storage.objects policy bucket_id literals", () => {
    for (const insert of extractBucketInserts(migration)) {
      const [, id, name] = insert.match(/values \(\s*'([^']+)',\s*'([^']+)',/) ?? [];
      expect(id).toBeTruthy();
      expect(name).toBe(id);
    }
  });

  it("mirrors schema.sql's bucket inserts byte-for-byte (the drift this migration fixes)", () => {
    const migrationInserts = extractBucketInserts(migration);
    const schemaInserts = extractBucketInserts(schema);
    expect(migrationInserts).toHaveLength(2);
    expect(schemaInserts.length).toBeGreaterThanOrEqual(2);
    // schema.sql may contain other storage.buckets statements added later;
    // every insert this migration makes must appear verbatim in schema.sql.
    for (const insert of migrationInserts) {
      expect(schemaInserts).toContain(insert);
    }
  });

  it("creates buckets for every bucket_id referenced by storage.objects RLS policies in the bulk-ingestion migration", () => {
    const referencedBucketIds = [
      ...bulkIngestionMigration.matchAll(/bucket_id = '([^']+)'/g),
    ].map((m) => m[1]);
    expect(referencedBucketIds.sort()).toEqual(["clinical-documents", "clinical-images"]);

    const createdBucketIds = extractBucketInserts(migration).map((insert) => {
      const match = insert.match(/values \(\s*'([^']+)'/);
      return match?.[1];
    });
    for (const bucketId of referencedBucketIds) {
      expect(createdBucketIds).toContain(bucketId);
    }
  });

  it("is idempotent: re-applying against a bucket that already exists only reaffirms public = false", () => {
    // Regression guard for the "existing database" half of the migration's
    // stated behaviour: the on-conflict clause must target exactly `public`,
    // not silently overwrite file_size_limit or allowed_mime_types.
    for (const insert of extractBucketInserts(migration)) {
      const conflictClause = insert.slice(insert.indexOf("on conflict"));
      expect(conflictClause).toBe("on conflict (id) do update set public = false;");
    }
  });
});