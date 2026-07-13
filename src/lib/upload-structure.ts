import JSZip from "jszip";

import { PublicApiError } from "@/lib/http";

// Structural admission checks for uploaded binary documents (2026-07-13
// audit, finding 10). assertFileContentSignature() only proves the first four
// bytes: any ZIP passed as DOCX/XLSX and any byte stream starting "%PDF" was
// accepted. These checks reject mislabeled archives, macro-enabled OOXML,
// external-content relationships, zip bombs, and truncated PDFs before the
// file is persisted or handed to the extraction workers.

export const maxOoxmlEntries = 2_000;
// OOXML XML parts compress ~10-30x; archive bombs run into the thousands.
export const maxOoxmlCompressionRatio = 150;
export const maxOoxmlDecompressedBytes = 512 * 1024 * 1024;

const docxMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const xlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const ooxmlRequiredPart: Record<string, { part: string; label: string }> = {
  [docxMime]: { part: "word/document.xml", label: "DOCX" },
  [xlsxMime]: { part: "xl/workbook.xml", label: "XLSX" },
};

function rejectUpload(reason: string): never {
  throw new PublicApiError(`File failed structural validation: ${reason}`, 400, {
    code: "invalid_file_structure",
  });
}

function hasUnsafeEntryPath(name: string) {
  return name.startsWith("/") || name.includes("\\") || name.split("/").includes("..");
}

// Relationships with TargetMode="External" are how OOXML pulls remote or
// out-of-package content. Plain hyperlinks are legitimate in clinical
// documents; everything else (attached templates, OLE objects, remote
// images/frames) is rejected.
function hasDangerousExternalRelationship(relsXml: string) {
  const relationshipTags = relsXml.match(/<Relationship\b[^>]*>/g) ?? [];
  return relationshipTags.some((tag) => {
    if (!/TargetMode\s*=\s*"External"/i.test(tag)) return false;
    const type = tag.match(/Type\s*=\s*"([^"]*)"/i)?.[1] ?? "";
    return !/\/hyperlink$/i.test(type);
  });
}

async function assertOoxmlStructure(fileType: string, content: Uint8Array) {
  const { part: requiredPart, label } = ooxmlRequiredPart[fileType];

  const zip = await JSZip.loadAsync(content).catch(() => {
    rejectUpload(`the ${label} archive is corrupt or not a readable ZIP package`);
  });

  const entryNames = Object.keys(zip.files);
  if (entryNames.length > maxOoxmlEntries) {
    rejectUpload(`the ${label} archive contains ${entryNames.length} entries (limit ${maxOoxmlEntries})`);
  }
  for (const name of entryNames) {
    if (hasUnsafeEntryPath(name)) {
      rejectUpload(`the ${label} archive contains an unsafe entry path`);
    }
    if (/(^|\/)vbaProject\.bin$/i.test(name)) {
      rejectUpload(`macro-enabled ${label} content is not supported`);
    }
  }

  // Zip-bomb guard: JSZip records each entry's declared decompressed size at
  // load time. Enforce both an absolute cap and a ratio against the upload.
  let declaredDecompressedBytes = 0;
  for (const entry of Object.values(zip.files)) {
    const size = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
    if (typeof size === "number" && Number.isFinite(size) && size > 0) {
      declaredDecompressedBytes += size;
    }
  }
  if (declaredDecompressedBytes > maxOoxmlDecompressedBytes) {
    rejectUpload(`the ${label} archive would decompress to more than ${maxOoxmlDecompressedBytes} bytes`);
  }
  if (content.byteLength > 0 && declaredDecompressedBytes / content.byteLength > maxOoxmlCompressionRatio) {
    rejectUpload(`the ${label} archive's compression ratio exceeds ${maxOoxmlCompressionRatio}:1`);
  }

  const contentTypesEntry = zip.file("[Content_Types].xml");
  if (!contentTypesEntry) {
    rejectUpload(`the ${label} package is missing [Content_Types].xml`);
  }
  const contentTypesXml = await contentTypesEntry.async("text").catch(() => {
    rejectUpload(`the ${label} package's [Content_Types].xml is unreadable`);
  });
  if (/macroenabled/i.test(contentTypesXml)) {
    rejectUpload(`macro-enabled ${label} content is not supported`);
  }
  if (!zip.file(requiredPart)) {
    rejectUpload(`the ${label} package is missing ${requiredPart}`);
  }

  const relsEntries = entryNames.filter((name) => /(^|\/)_rels\/[^/]*\.rels$/i.test(name));
  for (const name of relsEntries) {
    const relsXml = await zip
      .file(name)!
      .async("text")
      .catch(() => {
        rejectUpload(`the ${label} package's relationship part ${name} is unreadable`);
      });
    if (hasDangerousExternalRelationship(relsXml)) {
      rejectUpload(`the ${label} package references external content (only plain hyperlinks are allowed)`);
    }
  }
}

function assertPdfStructure(content: Uint8Array) {
  // assertFileContentSignature already proved the %PDF header. A valid PDF
  // ends with an %%EOF marker (possibly followed by a few stray bytes); its
  // absence means a truncated or corrupt file that would fail parsing later
  // and can smuggle non-PDF payloads past the header check.
  const tail = Buffer.from(content.subarray(Math.max(0, content.byteLength - 8192))).toString("latin1");
  if (!tail.includes("%%EOF")) {
    rejectUpload("the PDF is truncated or corrupt (missing %%EOF trailer)");
  }
}

// The declared MIME type has already passed assertAllowedFile and
// assertFileContentSignature; this inspects actual document structure.
export async function assertUploadStructure(fileType: string, content: Uint8Array): Promise<void> {
  if (fileType === docxMime || fileType === xlsxMime) {
    await assertOoxmlStructure(fileType, content);
    return;
  }
  if (fileType === "application/pdf") {
    assertPdfStructure(content);
  }
  // text/plain has no binary structure to validate.
}
