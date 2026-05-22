import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import PDFDocument from "pdfkit";
import { chromium } from "playwright";

const root = process.cwd();
const outDir = path.join(root, "sample-documents");
const assetDir = path.join(outDir, "_assets");

type Section = {
  heading: string;
  bullets: string[];
};

const disclaimer =
  "Synthetic test document for RAG demonstration only. Not a clinical guideline and not medical advice.";

const lithiumSections: Section[] = [
  {
    heading: "Lithium baseline checklist",
    bullets: [
      "Confirm indication, formulation, target range, recent renal function, thyroid function, calcium, weight, blood pressure, and current interacting medicines.",
      "Record baseline mood symptoms and risk context. For the synthetic Perth clinic workflow, document the monitoring owner and the review interval before prescribing.",
      "Avoid relying on a single serum level without clinical context, hydration status, timing since last dose, and recent medicine changes.",
    ],
  },
  {
    heading: "Monitoring schedule",
    bullets: [
      "In this synthetic protocol, check lithium level 5 to 7 days after initiation or dose change, then repeat until stable.",
      "After stability, the sample schedule uses lithium level every 3 months, renal and thyroid tests every 6 months, and calcium annually.",
      "Escalate review when there is vomiting, diarrhoea, dehydration, acute kidney injury, new NSAID/ACE inhibitor/diuretic exposure, tremor, confusion, or ataxia.",
    ],
  },
];

const clozapineSections: Section[] = [
  {
    heading: "Clozapine safety checkpoints",
    bullets: [
      "This synthetic document emphasises FBC/ANC monitoring, myocarditis symptom screening, metabolic monitoring, constipation prevention, and shared-care communication.",
      "A source answer should mention that fever, chest pain, dyspnoea, tachycardia, marked sedation, seizures, or severe constipation require urgent review.",
      "The test corpus deliberately includes a table image so image captions become searchable evidence.",
    ],
  },
  {
    heading: "High yield monitoring items",
    bullets: [
      "Baseline: FBC/ANC, ECG if indicated, troponin/CRP if local protocol requires, weight, waist, lipids, glucose/HbA1c, smoking status, bowel history, and medicine reconciliation.",
      "Early treatment: weekly blood monitoring in the synthetic example, plus myocarditis and constipation checks during the initiation period.",
      "Ongoing: metabolic review, clozapine level when clinically indicated, adherence review, and rapid source navigation to the prescribing document.",
    ],
  },
];

const acuteRiskSections: Section[] = [
  {
    heading: "Acute risk assessment flow",
    bullets: [
      "The synthetic WA-style triage flow separates immediate safety, mental state, substance use, supports, means restriction, protective factors, and follow-up plan.",
      "Questions about urgent escalation should retrieve the risk flowchart image and the text page describing same-day senior review triggers.",
      "Do not use this sample as a real emergency policy; it exists to test image-aware retrieval and citations.",
    ],
  },
  {
    heading: "Escalation triggers",
    bullets: [
      "Escalate in this test document for current intent, recent attempt, command hallucinations, severe agitation, intoxication with unsafe behaviour, inability to collaborate on safety planning, or absent supervision.",
      "The document viewer should link the answer citation to the page containing these triggers.",
    ],
  },
];

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function renderSvgToPng(svg: string, filePath: string, width: number, height: number) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
    await page.setContent(`<body style="margin:0">${svg}</body>`, { waitUntil: "domcontentloaded" });
    await page.screenshot({ path: filePath, omitBackground: true });
  } finally {
    await browser.close();
  }
}

function monitoringTableSvg() {
  return `
  <svg width="760" height="360" viewBox="0 0 760 360" xmlns="http://www.w3.org/2000/svg">
    <rect width="760" height="360" rx="18" fill="#f8fafc"/>
    <rect x="28" y="26" width="704" height="308" rx="12" fill="#ffffff" stroke="#cbd5e1"/>
    <text x="52" y="64" font-family="Arial" font-size="24" font-weight="700" fill="#0f172a">Synthetic clozapine monitoring table</text>
    <g font-family="Arial" font-size="17" fill="#0f172a">
      <rect x="52" y="94" width="656" height="42" fill="#0f766e" rx="6"/>
      <text x="70" y="121" fill="#ffffff" font-weight="700">Domain</text>
      <text x="248" y="121" fill="#ffffff" font-weight="700">Baseline</text>
      <text x="410" y="121" fill="#ffffff" font-weight="700">Initiation</text>
      <text x="585" y="121" fill="#ffffff" font-weight="700">Ongoing</text>
      ${["FBC / ANC", "Myocarditis", "Metabolic", "Constipation"]
        .map((row, index) => {
          const y = 154 + index * 42;
          const fill = index % 2 === 0 ? "#f1f5f9" : "#ffffff";
          const cells = [
            row,
            index === 0 ? "confirm" : index === 1 ? "symptoms" : index === 2 ? "weight/lipids" : "bowel history",
            index === 0 ? "weekly" : index === 1 ? "CRP/troponin" : index === 2 ? "weight" : "active plan",
            index === 0 ? "per protocol" : index === 1 ? "if symptomatic" : index === 2 ? "scheduled" : "review",
          ];
          return `<rect x="52" y="${y - 26}" width="656" height="42" fill="${fill}"/>
          ${cells.map((cell, cellIndex) => `<text x="${70 + cellIndex * 170}" y="${y}" font-weight="${cellIndex === 0 ? "700" : "400"}">${cell}</text>`).join("")}`;
        })
        .join("")}
    </g>
  </svg>`;
}

function riskFlowSvg() {
  return `
  <svg width="760" height="420" viewBox="0 0 760 420" xmlns="http://www.w3.org/2000/svg">
    <rect width="760" height="420" rx="18" fill="#f8fafc"/>
    <text x="48" y="52" font-family="Arial" font-size="26" font-weight="700" fill="#0f172a">Synthetic acute risk triage flow</text>
    ${[
      ["Immediate safety", 70, 98, "#0f766e"],
      ["Current intent", 292, 98, "#1d4ed8"],
      ["Means restriction", 514, 98, "#7c2d12"],
      ["Protective factors", 180, 238, "#475569"],
      ["Senior review", 410, 238, "#be123c"],
    ]
      .map(
        ([label, x, y, color]) => `
      <rect x="${x}" y="${y}" width="176" height="82" rx="12" fill="${color}" opacity="0.92"/>
      <text x="${Number(x) + 88}" y="${Number(y) + 48}" font-family="Arial" font-size="18" fill="#ffffff" font-weight="700" text-anchor="middle">${label}</text>
    `,
      )
      .join("")}
    <g stroke="#64748b" stroke-width="4" fill="none" marker-end="url(#arrow)">
      <defs><marker id="arrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto"><path d="M2,2 L10,6 L2,10" fill="#64748b"/></marker></defs>
      <path d="M246 139 H292"/>
      <path d="M468 139 H514"/>
      <path d="M158 180 C190 225 205 226 248 238"/>
      <path d="M602 180 C570 225 542 226 498 238"/>
    </g>
    <text x="48" y="370" font-family="Arial" font-size="18" fill="#334155">Use citations to jump from answer to page and chunk. Synthetic test data only.</text>
  </svg>`;
}

function scannedPageSvg() {
  return `
  <svg width="1000" height="1300" viewBox="0 0 1000 1300" xmlns="http://www.w3.org/2000/svg">
    <rect width="1000" height="1300" fill="#fffef8"/>
    <rect x="70" y="70" width="860" height="1160" fill="#ffffff" stroke="#cbd5e1"/>
    <text x="110" y="150" font-family="Arial" font-size="42" font-weight="700" fill="#111827">Synthetic scanned medication handout</text>
    <text x="110" y="210" font-family="Arial" font-size="26" fill="#374151">${disclaimer}</text>
    <text x="110" y="310" font-family="Arial" font-size="32" font-weight="700" fill="#0f766e">OCR target: lithium toxicity safety net</text>
    ${[
      "Ask about vomiting, diarrhoea, dehydration, tremor, confusion, ataxia, and new interacting medicines.",
      "This page is rasterised on purpose so the worker OCR fallback can be tested.",
      "The expected RAG answer should cite this scanned PDF page if OCR dependencies are installed.",
      "Perth clinic workflow: document who checks pathology and who contacts the patient after abnormal results.",
    ]
      .map(
        (line, index) =>
          `<text x="130" y="${390 + index * 72}" font-family="Arial" font-size="29" fill="#111827">${line}</text>`,
      )
      .join("")}
    <rect x="130" y="760" width="740" height="230" fill="#fef3c7" stroke="#f59e0b"/>
    <text x="160" y="825" font-family="Arial" font-size="30" font-weight="700" fill="#92400e">Search phrase</text>
    <text x="160" y="890" font-family="Arial" font-size="29" fill="#111827">What toxicity safety-net symptoms are listed?</text>
    <text x="160" y="955" font-family="Arial" font-size="29" fill="#111827">Expected evidence: scanned medication handout.</text>
  </svg>`;
}

async function createPdf(fileName: string, title: string, sections: Section[], imagePath?: string) {
  const doc = new PDFDocument({ margin: 54, size: "A4", autoFirstPage: true });
  const filePath = path.join(outDir, fileName);
  const stream = createWriteStream(filePath);
  doc.pipe(stream);

  doc.fontSize(20).fillColor("#0f172a").text(title);
  doc.moveDown(0.5).fontSize(9).fillColor("#7c2d12").text(disclaimer);
  doc.moveDown(1);

  for (const section of sections) {
    doc.fontSize(15).fillColor("#0f766e").text(section.heading);
    doc.moveDown(0.35);
    doc.fontSize(11).fillColor("#0f172a");
    for (const bullet of section.bullets) {
      doc.text(`• ${bullet}`, { indent: 12, paragraphGap: 5 });
    }
    doc.moveDown(0.8);
  }

  if (imagePath) {
    doc.addPage();
    doc.fontSize(16).fillColor("#0f172a").text("Embedded image evidence");
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .fillColor("#475569")
      .text(
        "The raster image below should be extracted by the worker, uploaded to Supabase Storage, captioned by the vision model, and inserted into searchable chunk context.",
      );
    doc.moveDown(1);
    doc.image(imagePath, { fit: [480, 280], align: "center" });
  }

  doc.end();
  await new Promise<void>((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

async function createScannedPdf(fileName: string, imagePath: string) {
  const doc = new PDFDocument({ margin: 0, size: "A4" });
  const filePath = path.join(outDir, fileName);
  const stream = createWriteStream(filePath);
  doc.pipe(stream);
  doc.image(imagePath, 0, 0, { fit: [595.28, 841.89], align: "center", valign: "center" });
  doc.end();
  await new Promise<void>((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

async function createDocx(fileName: string, imagePath: string) {
  const zip = new JSZip();
  const paragraphs = [
    "Synthetic ADHD shared-care note",
    disclaimer,
    "This DOCX checks mammoth text extraction and embedded image extraction from word/media.",
    "Key synthetic points: document baseline cardiovascular history, sleep pattern, appetite, weight, blood pressure, pulse, substance use, diversion risk, and follow-up owner.",
    "Medication review questions should retrieve this document when asking about stimulant monitoring or shared-care communication.",
    "Image caption target: a small monitoring timeline is embedded in the DOCX package.",
  ];

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.folder("_rels")!.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  zip
    .folder("word")!
    .folder("_rels")!
    .file(
      "document.xml.rels",
      `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdImage1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/adhd-monitoring.png"/>
</Relationships>`,
    );
  zip.folder("word")!.file(
    "document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${paragraphs.map((text) => `<w:p><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p>`).join("")}
    <w:p><w:r><w:t>Embedded image: synthetic ADHD monitoring timeline.</w:t></w:r></w:p>
  </w:body>
</w:document>`,
  );
  zip
    .folder("word")!
    .folder("media")!
    .file("adhd-monitoring.png", await BunlessRead(imagePath));

  const content = await zip.generateAsync({ type: "nodebuffer" });
  await writeFile(path.join(outDir, fileName), content);
}

async function BunlessRead(filePath: string) {
  const { readFile } = await import("node:fs/promises");
  return readFile(filePath);
}

async function createXlsx(fileName: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Clinical KB sample corpus";
  workbook.created = new Date("2026-05-18T00:00:00+08:00");
  const sheet = workbook.addWorksheet("Metabolic monitoring");
  sheet.columns = [
    { header: "Domain", key: "domain", width: 24 },
    { header: "Baseline", key: "baseline", width: 28 },
    { header: "4 weeks", key: "week4", width: 28 },
    { header: "12 weeks", key: "week12", width: 28 },
    { header: "Ongoing", key: "ongoing", width: 28 },
  ];
  [
    ["Weight/BMI", "Record baseline", "Repeat", "Repeat", "At each review in synthetic schedule"],
    ["Blood pressure", "Record baseline", "Repeat if changed", "Repeat", "Every 6 months synthetic"],
    ["Lipids", "Baseline fasting/nonfasting", "If high risk", "Repeat", "Annual synthetic"],
    ["Glucose/HbA1c", "Baseline", "If symptomatic", "Repeat", "Annual synthetic"],
  ].forEach((row) => sheet.addRow(row));

  const notes = workbook.addWorksheet("RAG test questions");
  notes.addRows([
    ["Synthetic test document for RAG demonstration only. Not medical advice."],
    ["Ask: What metabolic monitoring appears in the spreadsheet?"],
    ["Expected retrieval: Weight/BMI, blood pressure, lipids, glucose/HbA1c."],
  ]);

  await workbook.xlsx.writeFile(path.join(outDir, fileName));
}

async function createTxt(fileName: string) {
  await writeFile(
    path.join(outDir, fileName),
    [
      "Synthetic perinatal psychiatry prescribing note",
      disclaimer,
      "",
      "This TXT file checks plain text ingestion, chunking, and citation links.",
      "Key synthetic retrieval facts:",
      "- Preconception review should document current medicines, previous relapse pattern, patient preferences, sleep protection, and supports.",
      "- Breastfeeding discussion should cite uncertainty, medicine-specific risk/benefit, infant monitoring, and shared decision-making.",
      "- Do not answer as if this is a real guideline. It is a test corpus for the Clinical KB app.",
      "",
      "Suggested question: What shared decision-making items are listed for perinatal prescribing?",
    ].join("\n"),
    "utf8",
  );
}

async function writeManifest() {
  const manifest = {
    generated_at: new Date().toISOString(),
    disclaimer,
    files: [
      {
        file: "synthetic-lithium-monitoring.pdf",
        tests: ["PDF text extraction", "lithium monitoring retrieval", "page citation"],
        question: "What toxicity safety-net symptoms should be reviewed for lithium?",
      },
      {
        file: "synthetic-clozapine-monitoring-with-image.pdf",
        tests: ["PDF text extraction", "PDF image extraction", "vision caption indexing"],
        question: "What clozapine monitoring items are shown in the table image?",
      },
      {
        file: "synthetic-risk-flow-with-image.pdf",
        tests: ["image caption retrieval", "risk escalation answer", "PDF page navigation"],
        question: "When should acute risk be escalated for senior review?",
      },
      {
        file: "synthetic-adhd-shared-care.docx",
        tests: ["DOCX text extraction", "DOCX embedded image extraction"],
        question: "What baseline items are listed for stimulant monitoring?",
      },
      {
        file: "synthetic-metabolic-monitoring.xlsx",
        tests: ["XLSX sheet extraction", "table-like retrieval"],
        question: "What metabolic monitoring appears in the spreadsheet?",
      },
      {
        file: "synthetic-perinatal-prescribing-note.txt",
        tests: ["TXT extraction", "chunking", "citation"],
        question: "What shared decision-making items are listed for perinatal prescribing?",
      },
      {
        file: "synthetic-scanned-lithium-safety-net.pdf",
        tests: ["scanned PDF OCR fallback", "raster page extraction"],
        question: "What toxicity safety-net symptoms are listed in the scanned handout?",
      },
    ],
  };
  await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  await writeFile(
    path.join(outDir, "README.md"),
    `# Synthetic Clinical KB Sample Corpus

These files are synthetic test documents for the Medical RAG Knowledge Base. They are not clinical guidelines and not medical advice.

Upload the files in this folder through the app UI, then run:

\`\`\`bash
npm run worker
\`\`\`

The worker will extract text/images, caption images with OpenAI, create embeddings, and insert pgvector rows.

Good test questions are listed in \`manifest.json\`.
`,
  );
}

async function main() {
  await mkdir(assetDir, { recursive: true });
  const clozapineImage = path.join(assetDir, "clozapine-table.png");
  const riskImage = path.join(assetDir, "risk-flow.png");
  const scannedImage = path.join(assetDir, "scanned-lithium-page.png");
  const adhdImage = path.join(assetDir, "adhd-timeline.png");

  await renderSvgToPng(monitoringTableSvg(), clozapineImage, 760, 360);
  await renderSvgToPng(riskFlowSvg(), riskImage, 760, 420);
  await renderSvgToPng(scannedPageSvg(), scannedImage, 1000, 1300);
  await renderSvgToPng(
    `<svg width="760" height="260" viewBox="0 0 760 260" xmlns="http://www.w3.org/2000/svg">
      <rect width="760" height="260" rx="18" fill="#f8fafc"/>
      <text x="42" y="50" font-family="Arial" font-size="24" font-weight="700" fill="#0f172a">Synthetic ADHD monitoring timeline</text>
      ${["Baseline", "2 weeks", "6 weeks", "Shared care"]
        .map((label, index) => {
          const x = 70 + index * 170;
          return `<circle cx="${x}" cy="135" r="34" fill="#0f766e"/><text x="${x}" y="141" font-family="Arial" font-size="15" fill="#fff" font-weight="700" text-anchor="middle">${label}</text>`;
        })
        .join("")}
      <path d="M104 135 H576" stroke="#64748b" stroke-width="5"/>
      <text x="42" y="220" font-family="Arial" font-size="18" fill="#334155">Track BP, pulse, weight, sleep, appetite, diversion risk, and follow-up owner.</text>
    </svg>`,
    adhdImage,
    760,
    260,
  );

  await createPdf("synthetic-lithium-monitoring.pdf", "Synthetic lithium monitoring protocol", lithiumSections);
  await createPdf(
    "synthetic-clozapine-monitoring-with-image.pdf",
    "Synthetic clozapine monitoring protocol with image evidence",
    clozapineSections,
    clozapineImage,
  );
  await createPdf(
    "synthetic-risk-flow-with-image.pdf",
    "Synthetic acute risk triage flow with image evidence",
    acuteRiskSections,
    riskImage,
  );
  await createScannedPdf("synthetic-scanned-lithium-safety-net.pdf", scannedImage);
  await createDocx("synthetic-adhd-shared-care.docx", adhdImage);
  await createXlsx("synthetic-metabolic-monitoring.xlsx");
  await createTxt("synthetic-perinatal-prescribing-note.txt");
  await writeManifest();

  console.log(`Generated sample corpus in ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
