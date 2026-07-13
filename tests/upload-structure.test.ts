import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { PublicApiError } from "@/lib/http";
import { assertUploadStructure, maxOoxmlEntries } from "@/lib/upload-structure";

const docxMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const xlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const docxContentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const xlsxContentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
</Types>`;

const packageRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

function buildDocxZip(mutate?: (zip: JSZip) => void) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", docxContentTypes);
  zip.file("_rels/.rels", packageRels);
  zip.file("word/document.xml", "<w:document><w:body><w:p/></w:body></w:document>");
  mutate?.(zip);
  return zip;
}

async function toBuffer(zip: JSZip) {
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

async function expectRejection(promise: Promise<void>, messagePart: string) {
  const error = await promise.then(
    () => null,
    (cause) => cause,
  );
  expect(error, `expected structural rejection containing "${messagePart}"`).toBeInstanceOf(PublicApiError);
  expect(String((error as PublicApiError).message)).toContain(messagePart);
}

describe("assertUploadStructure — OOXML", () => {
  it("accepts a well-formed DOCX package", async () => {
    await expect(assertUploadStructure(docxMime, await toBuffer(buildDocxZip()))).resolves.toBeUndefined();
  });

  it("accepts a well-formed XLSX package", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", xlsxContentTypes);
    zip.file("_rels/.rels", packageRels);
    zip.file("xl/workbook.xml", "<workbook/>");
    await expect(assertUploadStructure(xlsxMime, await toBuffer(zip))).resolves.toBeUndefined();
  });

  it("rejects a non-ZIP byte stream", async () => {
    await expectRejection(
      assertUploadStructure(docxMime, Buffer.from("PK not really a zip")),
      "corrupt or not a readable ZIP",
    );
  });

  it("rejects a ZIP that is missing [Content_Types].xml", async () => {
    const zip = new JSZip();
    zip.file("word/document.xml", "<w:document/>");
    await expectRejection(assertUploadStructure(docxMime, await toBuffer(zip)), "missing [Content_Types].xml");
  });

  it("rejects a DOCX without word/document.xml and an XLSX without xl/workbook.xml", async () => {
    const noDocument = new JSZip();
    noDocument.file("[Content_Types].xml", docxContentTypes);
    await expectRejection(assertUploadStructure(docxMime, await toBuffer(noDocument)), "missing word/document.xml");

    const noWorkbook = new JSZip();
    noWorkbook.file("[Content_Types].xml", xlsxContentTypes);
    await expectRejection(assertUploadStructure(xlsxMime, await toBuffer(noWorkbook)), "missing xl/workbook.xml");
  });

  it("rejects macro-enabled content by content type and by vbaProject part", async () => {
    const macroTypes = buildDocxZip((zip) => {
      zip.file(
        "[Content_Types].xml",
        docxContentTypes.replace(
          "wordprocessingml.document.main+xml",
          "wordprocessingml.document.macroEnabled.main+xml",
        ),
      );
    });
    await expectRejection(assertUploadStructure(docxMime, await toBuffer(macroTypes)), "macro-enabled");

    const vbaPart = buildDocxZip((zip) => {
      zip.file("word/vbaProject.bin", Buffer.from([0xd0, 0xcf, 0x11, 0xe0]));
    });
    await expectRejection(assertUploadStructure(docxMime, await toBuffer(vbaPart)), "macro-enabled");
  });

  it("rejects dangerous external relationships but allows plain hyperlinks", async () => {
    const withHyperlink = buildDocxZip((zip) => {
      zip.file(
        "word/_rels/document.xml.rels",
        `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.org/guideline" TargetMode="External"/>
</Relationships>`,
      );
    });
    await expect(assertUploadStructure(docxMime, await toBuffer(withHyperlink))).resolves.toBeUndefined();

    const withRemoteTemplate = buildDocxZip((zip) => {
      zip.file(
        "word/_rels/settings.xml.rels",
        `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/attachedTemplate" Target="https://evil.example/template.dotm" TargetMode="External"/>
</Relationships>`,
      );
    });
    await expectRejection(
      assertUploadStructure(docxMime, await toBuffer(withRemoteTemplate)),
      "references external content",
    );
  });

  it("rejects external relationships with namespace prefixes and single-quoted attributes", async () => {
    // Test namespace-prefixed Relationship element with single-quoted TargetMode
    const withPrefixedTemplate = buildDocxZip((zip) => {
      zip.file(
        "word/_rels/settings.xml.rels",
        `<?xml version="1.0" encoding="UTF-8"?>
<ns:Relationships xmlns:ns="http://schemas.openxmlformats.org/package/2006/relationships">
  <ns:Relationship Id='rId1' Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/attachedTemplate' Target='https://evil.example/template.dotm' TargetMode='External'/>
</ns:Relationships>`,
      );
    });
    await expectRejection(
      assertUploadStructure(docxMime, await toBuffer(withPrefixedTemplate)),
      "references external content",
    );

    // Test mixed single/double quotes with namespace prefix
    const withMixedQuotes = buildDocxZip((zip) => {
      zip.file(
        "word/_rels/settings.xml.rels",
        `<?xml version="1.0" encoding="UTF-8"?>
<r:Relationships xmlns:r="http://schemas.openxmlformats.org/package/2006/relationships">
  <r:Relationship Id="rId1" Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject' Target="https://evil.example/object.bin" TargetMode='External'/>
</r:Relationships>`,
      );
    });
    await expectRejection(
      assertUploadStructure(docxMime, await toBuffer(withMixedQuotes)),
      "references external content",
    );
  });

  it("rejects unsafe entry paths", async () => {
    const traversal = buildDocxZip((zip) => {
      zip.file("word/../../escape.xml", "<x/>");
    });
    await expectRejection(assertUploadStructure(docxMime, await toBuffer(traversal)), "unsafe entry path");
  });

  it("rejects archives with too many entries", async () => {
    const zip = buildDocxZip((bomb) => {
      for (let index = 0; index <= maxOoxmlEntries; index += 1) {
        bomb.file(`word/media/pad-${index}.xml`, "<x/>");
      }
    });
    await expectRejection(assertUploadStructure(docxMime, await toBuffer(zip)), "entries (limit");
  });

  it("rejects high-compression-ratio archives (zip bomb shape)", async () => {
    const zip = buildDocxZip((bomb) => {
      // 24MB of zeros deflates to a few KB — far beyond the allowed ratio.
      bomb.file("word/media/zeros.bin", Buffer.alloc(24 * 1024 * 1024));
    });
    await expectRejection(assertUploadStructure(docxMime, await toBuffer(zip)), "compression ratio");
  });
});

describe("assertUploadStructure — PDF and text", () => {
  it("accepts a PDF with an %%EOF trailer", async () => {
    const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\nstartxref\n9\n%%EOF\n");
    await expect(assertUploadStructure("application/pdf", pdf)).resolves.toBeUndefined();
  });

  it("rejects a truncated PDF without %%EOF", async () => {
    const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n");
    await expectRejection(assertUploadStructure("application/pdf", pdf), "missing %%EOF");
  });

  it("rejects a PDF where %%EOF appears but is followed by non-whitespace content", async () => {
    // Simulate %%EOF appearing inside an incomplete object (non-whitespace after %%EOF)
    const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\nstartxref\n9\n%%EOF\n2 0 obj");
    await expectRejection(assertUploadStructure("application/pdf", pdf), "missing %%EOF");
  });

  it("leaves text uploads untouched", async () => {
    await expect(assertUploadStructure("text/plain", Buffer.from("plain notes"))).resolves.toBeUndefined();
  });
});
