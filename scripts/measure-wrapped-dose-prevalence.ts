import { loadEnvConfig } from "@next/env";
import { loadAdminClient } from "./eval-utils";

// Must run before any import of @/lib/env (transitively via @/lib/chunking),
// which snapshots process.env at module load. countWrappedDoseUnitLines is
// therefore imported dynamically inside main(), after this call — the same
// deferral loadAdminClient uses for the admin client.
loadEnvConfig(process.cwd());

// Measures how many indexed pages carry a dose whose unit the pre-fix chunker
// deleted as short-line extraction debris ("12.5\nmg" -> the "mg" line dropped,
// indexing a unitless "12.5"). See the fix in src/lib/chunking.ts (PR #334).
//
// document_pages.text stores the RAW extracted page text (worker/main.ts writes
// cleanString(page.text), which only strips null bytes — removePageNoise runs
// later, inside buildChunks). So the wrapped unit is still present here and
// countWrappedDoseUnitLines reports exactly what the old chunker would have
// deleted from the corresponding chunk. This is an accurate, read-only measure
// that needs no PDF re-extraction and no re-index.
//
// Read-only: SELECTs document_pages/documents only; never writes. Usage:
//   tsx scripts/measure-wrapped-dose-prevalence.ts [--limit N] [--top N] [--json]

type PageRow = {
  document_id: string;
  page_number: number | null;
  text: string | null;
};

type Args = { limit: number; top: number; json: boolean };

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const numberAfter = (flag: string, fallback: number) => {
    const index = argv.indexOf(flag);
    if (index === -1) return fallback;
    const parsed = Number.parseInt(argv[index + 1] ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  return {
    limit: numberAfter("--limit", Number.POSITIVE_INFINITY),
    top: numberAfter("--top", 15),
    json: argv.includes("--json"),
  };
}

async function main() {
  const args = parseArgs();
  const { countWrappedDoseUnitLines } = await import("@/lib/chunking");
  const supabase = await loadAdminClient();

  const pageSize = 1000;
  let offset = 0;
  let pagesScanned = 0;
  let pagesAffected = 0;
  let wrappedUnitTotal = 0;
  const perDocument = new Map<string, number>();

  for (;;) {
    if (pagesScanned >= args.limit) break;
    const { data, error } = await supabase
      .from("document_pages")
      .select("document_id,page_number,text")
      .order("document_id", { ascending: true })
      .order("page_number", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`document_pages read failed: ${error.message}`);

    const rows = (data ?? []) as PageRow[];
    if (rows.length === 0) break;

    for (const row of rows) {
      if (pagesScanned >= args.limit) break;
      pagesScanned += 1;
      const count = countWrappedDoseUnitLines(row.text ?? "");
      if (count > 0) {
        pagesAffected += 1;
        wrappedUnitTotal += count;
        perDocument.set(row.document_id, (perDocument.get(row.document_id) ?? 0) + count);
      }
    }

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  const affectedDocIds = [...perDocument.keys()];
  const titles = new Map<string, string>();
  for (let index = 0; index < affectedDocIds.length; index += 500) {
    const batch = affectedDocIds.slice(index, index + 500);
    const { data, error } = await supabase.from("documents").select("id,title,file_name").in("id", batch);
    if (error) throw new Error(`documents read failed: ${error.message}`);
    for (const doc of data ?? []) {
      titles.set(doc.id as string, (doc.title as string) || (doc.file_name as string) || (doc.id as string));
    }
  }

  const topDocuments = [...perDocument.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, args.top)
    .map(([id, count]) => ({ id, title: titles.get(id) ?? id, wrappedUnits: count }));

  const summary = {
    pagesScanned,
    pagesAffected,
    documentsAffected: perDocument.size,
    wrappedUnitTotal,
    pageAffectedRate: pagesScanned > 0 ? Number((pagesAffected / pagesScanned).toFixed(4)) : 0,
    topDocuments,
  };

  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(`Wrapped dose-unit prevalence (read-only, live corpus)`);
  console.log(`  pages scanned:        ${summary.pagesScanned}`);
  console.log(`  pages affected:       ${summary.pagesAffected} (${(summary.pageAffectedRate * 100).toFixed(2)}%)`);
  console.log(`  documents affected:   ${summary.documentsAffected}`);
  console.log(`  wrapped units total:  ${summary.wrappedUnitTotal}`);
  if (topDocuments.length > 0) {
    console.log(`  most affected documents:`);
    for (const doc of topDocuments) {
      console.log(`    ${String(doc.wrappedUnits).padStart(4)}  ${doc.title}`);
    }
  }
  if (summary.wrappedUnitTotal === 0) {
    console.log(`\nNo stripped dose units found — a re-index would not recover any dose units.`);
  } else {
    console.log(
      `\n${summary.wrappedUnitTotal} dose unit(s) across ${summary.documentsAffected} document(s) are indexed unitless; a re-index would recover them.`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
