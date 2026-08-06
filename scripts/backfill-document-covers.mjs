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
 * - Skips documents that already have a cover_page image
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
cover = extractor.save_cover_page(doc[0], ${JSON.stringify(outputDir)}, extractor.ExtractionBudget(), [])
doc.close()
print(json.dumps(cover))
`;
  const scriptPath = path.join(outputDir, "render_cover.py");
  await writeFile(scriptPath, script, "utf8");
  return await new Promise((resolve, reject) => {
    const child = spawn("python3", [scriptPath], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `python exited ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch (error) {
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

  let docsQuery = supabase
    .from("documents")
    .select("id,owner_id,title,file_name,file_type,storage_path,status,metadata")
    .eq("status", "indexed")
    .ilike("file_type", "%pdf%")
    .order("updated_at", { ascending: false })
    .limit(Number.isFinite(limit) ? limit : 50);
  if (documentId) docsQuery = docsQuery.eq("id", documentId);

  const { data: documents, error: docsError } = await docsQuery;
  if (docsError) throw new Error(docsError.message);

  const candidates = (documents ?? []).filter((doc) => doc.storage_path);
  console.log(`Found ${candidates.length} indexed PDF candidate(s). mode=${apply ? "apply" : "dry-run"}`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of candidates) {
    const { data: existingCovers, error: coverError } = await supabase
      .from("document_images")
      .select("id")
      .eq("document_id", doc.id)
      .eq("source_kind", "cover_page")
      .limit(1);
    if (coverError) throw new Error(coverError.message);
    if (existingCovers?.length) {
      skipped += 1;
      console.log(`skip ${doc.id} already has cover ${existingCovers[0].id}`);
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

      const nextMetadata = {
        ...(doc.metadata && typeof doc.metadata === "object" ? doc.metadata : {}),
        cover_image_id: inserted.id,
      };
      const { error: patchError } = await supabase
        .from("documents")
        .update({ metadata: nextMetadata })
        .eq("id", doc.id);
      if (patchError) throw new Error(patchError.message);

      created += 1;
      console.log(`created cover ${inserted.id} for ${doc.id}`);
    } catch (error) {
      failed += 1;
      console.error(`failed ${doc.id}:`, error instanceof Error ? error.message : error);
    } finally {
      await rm(workDir, { recursive: true, force: true });
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
