import { loadEnvConfig } from "@next/env";
import { findOwnerIdByEmail, loadAdminClient } from "./eval-utils";
import { assessClinicalImageUse } from "@/lib/image-filtering";

loadEnvConfig(process.cwd());

type Args = {
  ownerEmail?: string;
  allOwners: boolean;
  document?: string;
  limit: number;
  failOnMissed: boolean;
};

function parseArgs(): Args {
  const args: Args = {
    ownerEmail: process.env.RAG_EVAL_OWNER_EMAIL,
    allOwners: !process.env.RAG_EVAL_OWNER_EMAIL,
    limit: 200,
    failOnMissed: false,
  };
  const tokens = process.argv.slice(2);
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const value = tokens[index + 1];
    if (token === "--owner-email") {
      args.ownerEmail = value;
      args.allOwners = false;
      index += 1;
    } else if (token === "--all-owners") {
      args.allOwners = true;
    } else if (token === "--document") {
      args.document = value;
      index += 1;
    } else if (token === "--limit") {
      args.limit = Math.max(1, Math.min(Number(value) || 200, 1000));
      index += 1;
    } else if (token === "--fail-on-missed") {
      args.failOnMissed = true;
    }
  }
  return args;
}

function textSuggestsTable(text: string) {
  return /\b(table\s+\d+[a-z]?|appendix\s+\d+[a-z]?|roles?\s+and\s+responsibilities|score\b.*\bmanagement|observation|medication|dose|frequency)\b/i.test(
    text,
  );
}

function compactTitle(title: string) {
  return title.length > 72 ? `${title.slice(0, 69).trim()}...` : title;
}

async function main() {
  const args = parseArgs();
  if (!args.ownerEmail && !args.allOwners) throw new Error('Provide --owner-email "you@example.com" or --all-owners.');

  const supabase = await loadAdminClient();
  const ownerId = args.ownerEmail && !args.allOwners ? await findOwnerIdByEmail(supabase, args.ownerEmail) : undefined;

  let documentQuery = supabase
    .from("documents")
    .select("id,title,file_name,status,page_count,image_count")
    .order("created_at", { ascending: true })
    .limit(args.limit);
  if (ownerId) documentQuery = documentQuery.eq("owner_id", ownerId);
  if (args.document) {
    documentQuery = documentQuery.or(
      `id.eq.${args.document},file_name.ilike.%${args.document}%,title.ilike.%${args.document}%`,
    );
  }

  const { data: documents, error: documentsError } = await documentQuery;
  if (documentsError) throw new Error(documentsError.message);
  const documentIds = (documents ?? []).map((document) => document.id as string);
  if (documentIds.length === 0) {
    console.log("No documents matched the audit filters.");
    return;
  }

  const [imagesResult, pagesResult] = await Promise.all([
    supabase
      .from("document_images")
      .select("document_id,source_kind,searchable,image_type,clinical_relevance_score,metadata")
      .in("document_id", documentIds)
      .neq("image_type", "logo_decorative"),
    supabase.from("document_pages").select("document_id,page_number,text").in("document_id", documentIds),
  ]);
  if (imagesResult.error) throw new Error(imagesResult.error.message);
  if (pagesResult.error) throw new Error(pagesResult.error.message);

  const counts = new Map<
    string,
    { tables: number; clinicalTables: number; adminTables: number; searchableAdminTables: number; images: number }
  >();
  for (const documentId of documentIds) {
    counts.set(documentId, { tables: 0, clinicalTables: 0, adminTables: 0, searchableAdminTables: 0, images: 0 });
  }
  for (const image of imagesResult.data ?? []) {
    const documentId = String(image.document_id);
    const current = counts.get(documentId) ?? {
      tables: 0,
      clinicalTables: 0,
      adminTables: 0,
      searchableAdminTables: 0,
      images: 0,
    };
    const metadata =
      image.metadata && typeof image.metadata === "object" ? (image.metadata as Record<string, unknown>) : {};
    const useClass = String(
      metadata.clinical_use_class ??
        assessClinicalImageUse({
          imageType: image.image_type,
          searchable: image.searchable,
          clinicalRelevanceScore: image.clinical_relevance_score,
          sourceKind: image.source_kind,
          tableRole: typeof metadata.table_role === "string" ? metadata.table_role : null,
          tableText:
            typeof metadata.table_text === "string"
              ? metadata.table_text
              : typeof metadata.table_text_snippet === "string"
                ? metadata.table_text_snippet
                : null,
        }).clinical_use_class,
    );
    if (image.searchable !== false) current.images += 1;
    if (image.source_kind === "table_crop") {
      current.tables += 1;
      if (useClass === "clinical_evidence" && image.searchable !== false) current.clinicalTables += 1;
      if (["administrative", "reference"].includes(useClass)) current.adminTables += 1;
      if (["administrative", "reference"].includes(useClass) && image.searchable !== false) {
        current.searchableAdminTables += 1;
      }
    }
    counts.set(documentId, current);
  }

  const tableMarkerPages = new Map<string, Set<number>>();
  for (const page of pagesResult.data ?? []) {
    if (!textSuggestsTable(String(page.text ?? ""))) continue;
    const documentId = String(page.document_id);
    const pages = tableMarkerPages.get(documentId) ?? new Set<number>();
    const pageNumber = Number(page.page_number);
    if (Number.isFinite(pageNumber)) pages.add(pageNumber);
    tableMarkerPages.set(documentId, pages);
  }

  const possibleMisses: string[] = [];
  const searchableAdminIssues: string[] = [];
  console.log(`Table audit for ${documents?.length ?? 0} documents`);
  for (const document of documents ?? []) {
    const documentCounts = counts.get(document.id) ?? {
      tables: 0,
      clinicalTables: 0,
      adminTables: 0,
      searchableAdminTables: 0,
      images: 0,
    };
    const markerPages = Array.from(tableMarkerPages.get(document.id) ?? []).sort((a, b) => a - b);
    if (markerPages.length > 0 && documentCounts.tables === 0) {
      possibleMisses.push(`${document.file_name}: table-like text on pages ${markerPages.slice(0, 8).join(", ")}`);
    }
    if (documentCounts.searchableAdminTables > 0) {
      searchableAdminIssues.push(
        `${document.file_name}: searchable admin/reference tables=${documentCounts.searchableAdminTables}`,
      );
    }
    console.log(
      [
        compactTitle(document.file_name ?? document.title ?? document.id),
        `status=${document.status}`,
        `pages=${document.page_count ?? 0}`,
        `tables=${documentCounts.tables}`,
        `clinicalTables=${documentCounts.clinicalTables}`,
        `adminReferenceTables=${documentCounts.adminTables}`,
        `searchableAdminReference=${documentCounts.searchableAdminTables}`,
        `searchableImages=${documentCounts.images}`,
        markerPages.length ? `tableTextPages=${markerPages.slice(0, 8).join(",")}` : "tableTextPages=none",
      ].join(" | "),
    );
  }

  console.log(`Possible missed table documents: ${possibleMisses.length}`);
  for (const item of possibleMisses.slice(0, 20)) console.log(`- ${item}`);
  console.log(`Searchable admin/reference table issues: ${searchableAdminIssues.length}`);
  for (const item of searchableAdminIssues.slice(0, 20)) console.log(`- ${item}`);
  if (searchableAdminIssues.length > 0) {
    throw new Error("Table audit found admin/reference tables still marked searchable.");
  }
  if (args.failOnMissed && possibleMisses.length > 0) {
    throw new Error("Table audit found documents with table-like text but no retained table crops.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
