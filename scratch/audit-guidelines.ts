import { loadEnvConfig } from "@next/env";
import * as fs from "fs";
import * as path from "path";

loadEnvConfig(process.cwd());

function getFilesRecursively(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(filePath));
    } else {
      if (/\.(pdf|docx|doc)$/i.test(file)) {
        results.push(filePath);
      }
    }
  }
  return results;
}

async function main() {
  const { createAdminClient } = await import("../src/lib/supabase/admin");
  const supabase = createAdminClient();
  
  // 1. Scan the local directory
  const rootDir = "C:\\Users\\joshs\\OneDrive\\Medicine\\Guidelines";
  console.log(`Scanning local files in ${rootDir}...`);
  const localFiles = getFilesRecursively(rootDir);
  console.log(`Found ${localFiles.length} local guideline files (PDF/DOC/DOCX).`);
  
  // 2. Fetch all documents from the database
  console.log("Fetching documents from Supabase...");
  const { data: dbDocs, error } = await supabase
    .from("documents")
    .select("id, title, status, metadata");
    
  if (error) {
    console.error("Error fetching database documents:", error);
    return;
  }
  
  console.log(`Found ${dbDocs?.length || 0} documents in Supabase.`);
  
  // Create a map of lowercased source path -> db doc
  const dbDocsByPath = new Map<string, typeof dbDocs[number]>();
  for (const doc of dbDocs || []) {
    const meta = doc.metadata && typeof doc.metadata === "object" ? (doc.metadata as any) : {};
    if (meta.source_path) {
      dbDocsByPath.set(meta.source_path.toLowerCase(), doc);
    }
  }
  
  // 3. Match them up
  const categories = ["BMJ", "EMHS", "KEMH", "NMHS", "PHC", "RKPG", "SMHS"];
  const stats: Record<string, { total: number; indexed: number; processing: number; queued: number; missing: number; missingFiles: string[] }> = {};
  
  for (const cat of categories) {
    stats[cat] = { total: 0, indexed: 0, processing: 0, queued: 0, missing: 0, missingFiles: [] };
  }
  
  for (const file of localFiles) {
    // Determine category from path
    const relative = path.relative(rootDir, file);
    const topFolder = relative.split(path.sep)[0];
    
    if (stats[topFolder]) {
      stats[topFolder].total++;
      const matched = dbDocsByPath.get(file.toLowerCase());
      if (matched) {
        if (matched.status === "indexed") {
          stats[topFolder].indexed++;
        } else if (matched.status === "processing") {
          stats[topFolder].processing++;
        } else if (matched.status === "queued") {
          stats[topFolder].queued++;
        } else {
          stats[topFolder].missing++;
          stats[topFolder].missingFiles.push(relative);
        }
      } else {
        stats[topFolder].missing++;
        stats[topFolder].missingFiles.push(relative);
      }
    }
  }
  
  console.log("=== Auditing Summary by Directory ===");
  for (const [cat, info] of Object.entries(stats)) {
    console.log(`\nDirectory: ${cat}`);
    console.log(`  Total Local Files: ${info.total}`);
    console.log(`  Indexed (Done):    ${info.indexed}`);
    console.log(`  Processing:        ${info.processing}`);
    console.log(`  Queued:            ${info.queued}`);
    console.log(`  Not in Database:   ${info.missing}`);
    if (info.missing > 0 && info.missing <= 5) {
      console.log(`  Missing files:`, info.missingFiles);
    } else if (info.missing > 5) {
      console.log(`  Missing files (first 5):`, info.missingFiles.slice(0, 5));
    }
  }
}

main().catch(console.error);
