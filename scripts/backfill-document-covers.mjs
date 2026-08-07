#!/usr/bin/env node
/**
 * Backfill first-page cover thumbnails for already-indexed PDF documents.
 *
 * Generates a compact page-1 PNG, uploads it to the image bucket as
 * source_kind=cover_page (searchable=false), and patches documents.metadata.cover_image_id.
 *
 * Safety:
 * - Requires explicit --apply (dry-run by default)
 * - Never marks covers searchable / never attaches them to chunks
 * - Prefers documents that do not already have a cover_page image
 *
 * Usage:
 *   node scripts/backfill-document-covers.mjs
 *   node scripts/backfill-document-covers.mjs --apply --limit 25
 *   node scripts/backfill-document-covers.mjs --apply --document-id <uuid>
 */

import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

async function runPythonCover(pdfPath, outputDir) {
  const script = `
import json, sys
import fitz
sys.path.insert(0, ${JSON.stringify(path.join(process.cwd(), "worker/python"))})
import extract_pdf_assets as extractor
doc = fitz.open(${JSON.stringify(pdfPath)})
budget = extractor.ExtractionBudget()
budget.set_page_count(doc.page_count)
cover = extractor.save_cover_page(doc[0], ${JSON.stringify(outputDir)}, budget, [])
doc.close()
print(json.dumps(cover))
`;
  const scriptPath = path.join(outputDir, "render_cover.py");
  await writeFile(scriptPath, script, "utf8");
  return await new Promise((resolve, reject) => {
    const child = spawn(process.env.PYTHON_BIN || "python3", [scriptPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      if (!settled) {
        settled = true;
        reject(new Error("cover render timed out"));
      }
    }, 60_000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      reject(new Error(`failed to start python: ${error.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      if (code !== 0) {
        reject(new Error(stderr || `python exited ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch {
        reject(new Error(`invalid cover JSON: ${stdout}\n${stderr}`));
      }
    });
  });
}

async function main() {
  const apply = hasFlag("--apply");
  const limit = Number(argValue("--limit") ?? "50");
  const documentId = argValue("--document-id");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const documentBucket = process.env.SUPABASE_DOCUMENT_BUCKET || "clinical-documents";
  const imageBucket = process.env.SUPABASE_IMAGE_BUCKET || "clinical-images";

  // Page through cover rows — PostgREST caps a single select at 1000 by default.
  const coveredIds = new Set();
  for (let from = 0; ; from += 1000) {
    const { data: existingCoverRows, error: existingCoverError } = await supabase
      .from("document_images")
      .select("document_id")
      .eq("source_kind", "cover_page")
      .range(from, from + 999);
    if (existingCoverError) throw new Error(existingCoverError.message);
    for (const row of existingCoverRows ?? []) coveredIds.add(String(row.document_id));
    if (!existingCoverRows?.length || existingCoverRows.length < 1000) break;
  }

  const targetLimit = Number.isFinite(limit) ? limit : 50;
  const candidates = [];
  if (documentId) {
    const { data: documents, error: docsError } = await supabase
      .from("documents")
      .select("id,owner_id,title,file_name,file_type,storage_path,status,metadata")
      .eq("id", documentId)
      .eq("status", "indexed")
      .ilike("file_type", "%pdf%");
    if (docsError) throw new Error(docsError.message);
    for (const doc of documents ?? []) {
      if (doc.storage_path && !coveredIds.has(String(doc.id))) candidates.push(doc);
    }
  } else {
    // Walk the full indexed-PDF set until we fill this batch (or exhaust the corpus).
    for (let from = 0; candidates.length < targetLimit; from += 1000) {
      const { data: documents, error: docsError } = await supabase
        .from("documents")
        .select("id,owner_id,title,file_name,file_type,storage_path,status,metadata")
        .eq("status", "indexed")
        .ilike("file_type", "%pdf%")
        .order("created_at", { ascending: true })
        .range(from, from + 999);
      if (docsError) throw new Error(docsError.message);
      if (!documents?.length) break;
      for (const doc of documents) {
        if (!doc.storage_path || coveredIds.has(String(doc.id))) continue;
        candidates.push(doc);
        if (candidates.length >= targetLimit) break;
      }
      if (documents.length < 1000) break;
    }
  }
  console.log(
    `Found ${candidates.length} uncovered PDF candidate(s) (already covered=${coveredIds.size}). mode=${apply ? "apply" : "dry-run"}`,
  );

  let created = 0;
  let skipped = 0;
  let failed = 0;

  async function patchCoverImageId(targetDocumentId, coverImageId) {
    const { data: fresh, error: freshError } = await supabase
      .from("documents")
      .select("metadata")
      .eq("id", targetDocumentId)
      .single();
    if (freshError) throw new Error(freshError.message);
    const current =
      fresh?.metadata && typeof fresh.metadata === "object" && !Array.isArray(fresh.metadata) ? fresh.metadata : {};
    if (current.cover_image_id === coverImageId) return false;
    const { error: patchError } = await supabase
      .from("documents")
      .update({ metadata: { ...current, cover_image_id: coverImageId } })
      .eq("id", targetDocumentId);
    if (patchError) throw new Error(patchError.message);
    return true;
  }

  for (const doc of candidates) {
    try {
      const { data: existingCovers, error: coverError } = await supabase
        .from("document_images")
        .select("id")
        .eq("document_id", doc.id)
        .eq("source_kind", "cover_page")
        .limit(1);
      if (coverError) throw new Error(coverError.message);
      if (existingCovers?.length) {
        const existingId = existingCovers[0].id;
        if (apply && doc.metadata?.cover_image_id !== existingId) {
          await patchCoverImageId(doc.id, existingId);
          console.log(`recovered cover metadata ${existingId} for ${doc.id}`);
        } else {
          console.log(`skip ${doc.id} already has cover ${existingId}`);
        }
        skipped += 1;
        continue;
      }

      if (!apply) {
        console.log(`dry-run would create cover for ${doc.id} (${doc.title || doc.file_name})`);
        continue;
      }

      const workDir = await mkdtemp(path.join(tmpdir(), "cover-backfill-"));
      try {
        const { data: blob, error: downloadError } = await supabase.storage
          .from(documentBucket)
          .download(doc.storage_path);
        if (downloadError || !blob) throw new Error(downloadError?.message || "download failed");
        const pdfPath = path.join(workDir, "source.pdf");
        await writeFile(pdfPath, Buffer.from(await blob.arrayBuffer()));
        const cover = await runPythonCover(pdfPath, workDir);
        if (!cover?.path) throw new Error("cover render returned empty");

        const bytes = await readFile(cover.path);
        const generationId =
          typeof doc.metadata?.index_generation_id === "string" && doc.metadata.index_generation_id
            ? doc.metadata.index_generation_id
            : randomUUID();
        const imagePrefix = doc.owner_id ? `${doc.owner_id}/images/${doc.id}` : `local/${doc.id}`;
        const imagePath = `${imagePrefix}/${generationId}/cover-page-1.png`;
        const upload = await supabase.storage.from(imageBucket).upload(imagePath, bytes, {
          contentType: "image/png",
          upsert: true,
        });
        if (upload.error) throw new Error(upload.error.message);

        const imageHash = createHash("sha256").update(bytes).digest("hex");
        const { data: inserted, error: insertError } = await supabase
          .from("document_images")
          .insert({
            document_id: doc.id,
            page_number: 1,
            storage_path: imagePath,
            mime_type: "image/png",
            caption: "Document cover page preview.",
            bbox: cover.bbox ?? null,
            image_type: "unclear",
            searchable: false,
            clinical_relevance_score: 0,
            source_kind: "cover_page",
            width: cover.width ?? null,
            height: cover.height ?? null,
            image_hash: imageHash,
            labels: ["cover-page"],
            index_generation_id: generationId,
            metadata: {
              ...(cover.metadata ?? {}),
              source_kind: "cover_page",
              clinical_use_class: "decorative_or_empty",
              index_generation_id: generationId,
              backfill: "document-cover-thumbnails",
            },
          })
          .select("id")
          .single();
        if (insertError) throw new Error(insertError.message);

        await patchCoverImageId(doc.id, inserted.id);

        created += 1;
        console.log(`created cover ${inserted.id} for ${doc.id}`);
      } finally {
        await rm(workDir, { recursive: true, force: true });
      }
    } catch (error) {
      failed += 1;
      console.error(`failed ${doc.id}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(
    JSON.stringify({ mode: apply ? "apply" : "dry-run", created, skipped, failed, scanned: candidates.length }),
  );
  if (!apply) {
    console.log("Re-run with --apply to write covers.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
