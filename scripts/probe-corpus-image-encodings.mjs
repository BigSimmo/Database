#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

/**
 * Known image encoding / stream filter patterns in PDFs and document metadata.
 */
const ENCODING_PATTERNS = {
  JBIG2: /\/JBIG2Decode\b|\bimage\/jbig2\b|\bjbig2\b/gi,
  JPX: /\/JPXDecode\b|\bimage\/jpx\b|\bimage\/jp2\b|\bjpeg2000\b|\bjpx\b/gi,
  DCT_JPEG: /\/DCTDecode\b|\bimage\/jpe?g\b|\bjpeg\b|\bjpg\b/gi,
  Flate_PNG: /\/FlateDecode\b|\bimage\/png\b|\bpng\b/gi,
  CCITTFax: /\/CCITTFaxDecode\b|\bimage\/g[34]fax\b|\bccitt\b/gi,
  LZW: /\/LZWDecode\b/gi,
};

const STANDARD_14_FONTS = [
  "Times-Roman",
  "Times-Bold",
  "Times-Italic",
  "Times-BoldItalic",
  "Helvetica",
  "Helvetica-Bold",
  "Helvetica-Oblique",
  "Helvetica-BoldOblique",
  "Courier",
  "Courier-Bold",
  "Courier-Oblique",
  "Courier-BoldOblique",
  "Symbol",
  "ZapfDingbats",
];

/**
 * Scan a string or buffer for encoding patterns and standard-14 fonts.
 */
export function probeContentEncodings(content) {
  const text = typeof content === "string" ? content : content.toString("utf8");
  const encodings = {
    JBIG2: 0,
    JPX: 0,
    DCT_JPEG: 0,
    Flate_PNG: 0,
    CCITTFax: 0,
    LZW: 0,
    other: 0,
  };

  for (const [name, regex] of Object.entries(ENCODING_PATTERNS)) {
    const matches = text.match(regex);
    if (matches) {
      encodings[name] = matches.length;
    }
  }

  let standard14Count = 0;
  for (const fontName of STANDARD_14_FONTS) {
    const regex = new RegExp(`\\b${fontName}\\b`, "g");
    const matches = text.match(regex);
    if (matches) {
      standard14Count += matches.length;
    }
  }

  return {
    encodings,
    hasJbig2: encodings.JBIG2 > 0,
    hasJpx: encodings.JPX > 0,
    standard14Count,
  };
}

/**
 * Recursively find all files in target directories matching extensions.
 */
function findFixtureFiles(dirs, extensions = [".json", ".pdf", ".txt"]) {
  const files = [];

  function traverse(currentDir) {
    if (!existsSync(currentDir)) return;
    const entries = readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && entry.name !== ".git" && entry.name !== ".next") {
          traverse(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  for (const dir of dirs) {
    traverse(dir);
  }
  return files;
}

/**
 * Scan corpus fixture files and compute overall metrics and recommendations.
 */
export function probeCorpusImageEncodings(targetDirs = []) {
  const defaultDirs = [
    path.join(projectRoot, "data"),
    path.join(projectRoot, "scripts", "fixtures"),
    path.join(projectRoot, "tests", "fixtures"),
  ];

  const searchDirs = targetDirs.length > 0 ? targetDirs : defaultDirs;
  const files = findFixtureFiles(searchDirs);

  const aggregateEncodings = {
    JBIG2: 0,
    JPX: 0,
    DCT_JPEG: 0,
    Flate_PNG: 0,
    CCITTFax: 0,
    LZW: 0,
    other: 0,
  };

  let totalStandard14References = 0;
  let totalDocumentsInspected = 0;
  let totalImageStreamsDetected = 0;
  const fileReports = [];

  for (const file of files) {
    try {
      const content = readFileSync(file, "utf8");
      const stat = statSync(file);
      const result = probeContentEncodings(content);

      let documentsCountInFile = 1;
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          documentsCountInFile = parsed.length;
        } else if (parsed && typeof parsed === "object") {
          if (Array.isArray(parsed.documents)) documentsCountInFile = parsed.documents.length;
          else if (Array.isArray(parsed.records)) documentsCountInFile = parsed.records.length;
        }
      } catch {
        // Non-JSON file, count as 1 document
      }

      totalDocumentsInspected += documentsCountInFile;

      let fileImageCount = 0;
      for (const [key, count] of Object.entries(result.encodings)) {
        aggregateEncodings[key] += count;
        fileImageCount += count;
      }
      totalImageStreamsDetected += fileImageCount;
      totalStandard14References += result.standard14Count;

      if (fileImageCount > 0 || result.standard14Count > 0) {
        fileReports.push({
          file: path.relative(projectRoot, file).replace(/\\/g, "/"),
          sizeBytes: stat.size,
          encodings: result.encodings,
          standard14Count: result.standard14Count,
        });
      }
    } catch {
      // Skip unreadable files safely
    }
  }

  const hasJbig2 = aggregateEncodings.JBIG2 > 0;
  const hasJpx = aggregateEncodings.JPX > 0;
  const requiresPdfJsDecoders = hasJbig2 || hasJpx;

  return {
    scannedFilesCount: files.length,
    inspectedDocumentsCount: totalDocumentsInspected,
    detectedImageStreamsCount: totalImageStreamsDetected,
    encodings: aggregateEncodings,
    standard14Fonts: {
      totalReferences: totalStandard14References,
      detected: totalStandard14References > 0,
    },
    findings: {
      hasJbig2,
      hasJpx,
      requiresPdfJsDecoders,
      recommendation: requiresPdfJsDecoders
        ? "JBIG2/JPX image streams detected in corpus. Consider copying pdf.js WASM/decoder assets to public/pdfjs."
        : "No JBIG2/JPX image streams detected in local corpus fixtures. Extra pdf.js decoder WASM assets (~2 MB) are not currently required.",
    },
    details: fileReports,
  };
}

/**
 * Built-in self-test to verify detection logic.
 */
export function runSelfTest() {
  const samplePdfContent = `
    10 0 obj
    << /Type /XObject /Subtype /Image /Filter /JBIG2Decode /Width 800 /Height 600 >>
    stream
    ...
    endstream
    endobj
    11 0 obj
    << /Type /XObject /Subtype /Image /Filter /JPXDecode /Width 1024 /Height 768 >>
    stream
    ...
    endstream
    endobj
    12 0 obj
    << /Type /Font /BaseFont /Helvetica >>
    endobj
  `;

  const probe = probeContentEncodings(samplePdfContent);
  if (!probe.hasJbig2 || probe.encodings.JBIG2 !== 1) {
    throw new Error(`Self-test failed: expected 1 JBIG2 encoding, got ${probe.encodings.JBIG2}`);
  }
  if (!probe.hasJpx || probe.encodings.JPX !== 1) {
    throw new Error(`Self-test failed: expected 1 JPX encoding, got ${probe.encodings.JPX}`);
  }
  if (probe.standard14Count !== 1) {
    throw new Error(`Self-test failed: expected 1 standard-14 font reference, got ${probe.standard14Count}`);
  }

  const cleanSample = `
    {"title": "Standard Guideline", "image_type": "table_crop", "mime_type": "image/png"}
  `;
  const cleanProbe = probeContentEncodings(cleanSample);
  if (cleanProbe.hasJbig2 || cleanProbe.hasJpx) {
    throw new Error("Self-test failed: clean sample erroneously reported JBIG2/JPX");
  }
  if (cleanProbe.encodings.Flate_PNG !== 1) {
    throw new Error(`Self-test failed: expected 1 Flate_PNG, got ${cleanProbe.encodings.Flate_PNG}`);
  }

  return true;
}

// CLI Execution
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: node scripts/probe-corpus-image-encodings.mjs [options]

Options:
  --json          Output results in JSON format
  --self-test     Run internal verification assertions
  --dir <path>    Specify an additional directory to probe
  --help, -h      Show this help message
`);
    process.exit(0);
  }

  if (args.includes("--self-test")) {
    try {
      runSelfTest();
      console.log("probe-corpus-image-encodings self-test PASSED.");
      process.exit(0);
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
  }

  const customDirs = [];
  const dirIndex = args.indexOf("--dir");
  if (dirIndex !== -1 && args[dirIndex + 1]) {
    customDirs.push(path.resolve(process.cwd(), args[dirIndex + 1]));
  }

  const report = probeCorpusImageEncodings(customDirs);

  if (args.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("\n--- Image Encodings & PDF Asset Probe Summary ---");
    console.log(`Scanned files:              ${report.scannedFilesCount}`);
    console.log(`Inspected documents/rows:   ${report.inspectedDocumentsCount}`);
    console.log(`Detected image streams:     ${report.detectedImageStreamsCount}`);
    console.log(`\nEncodings Breakdown:`);
    console.log(`  JBIG2:                    ${report.encodings.JBIG2}`);
    console.log(`  JPX / JPEG2000:           ${report.encodings.JPX}`);
    console.log(`  DCT / JPEG:               ${report.encodings.DCT_JPEG}`);
    console.log(`  Flate / PNG:              ${report.encodings.Flate_PNG}`);
    console.log(`  CCITT Fax:                ${report.encodings.CCITTFax}`);
    console.log(`  LZW:                      ${report.encodings.LZW}`);
    console.log(`\nStandard 14 Font Refs:      ${report.standard14Fonts.totalReferences}`);
    console.log(`\nVerdict:`);
    console.log(`  ${report.findings.recommendation}\n`);
  }
}
