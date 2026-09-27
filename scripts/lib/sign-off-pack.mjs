import { createHash } from "node:crypto";

/**
 * Review packs and the batch sign-off code, shared by `npm run clinical:review` and
 * `npm run therapy:review`.
 *
 * Owner decision, 2026-09-26: the clinical owner may sign a whole set of records with one
 * confirmation, after reading the set in a review pack. What keeps that honest is the
 * sign-off code. It is derived from the exact content pin of every record in the pack, so
 * the batch command recomputes it from the files as they are at signing time: if any record
 * changed after the pack was written, the code no longer matches and nothing is signed. The
 * owner can therefore only batch-sign the text the pack showed them.
 */

/**
 * @param {Array<{ code: string, sha256: string }>} entries every record in the pack, in pack order
 * @returns {string} eight lowercase hex characters
 */
export function signOffPackCode(entries) {
  const hash = createHash("sha256");
  for (const { code, sha256 } of entries) hash.update(`${code}\u0000${sha256}\n`);
  return hash.digest("hex").slice(0, 8);
}

/** Codes named with --exclude, split on commas, trimmed, empty entries dropped. */
export function parseExcludeList(value) {
  if (value === undefined) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const escapeHtml = (value) =>
  String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * A self-contained HTML page: no scripts, no external requests, readable offline.
 *
 * @param {{
 *   title: string,
 *   code: string,
 *   reviewedBy?: string,
 *   intro: string[],
 *   questions: string[],
 *   batchCommand: string,
 *   records: Array<{ code: string, heading: string, sections: Array<{ label: string, text: string }> }>,
 *   generatedAt: string,
 * }} pack
 */
export function renderSignOffPack(pack) {
  const recordHtml = pack.records
    .map(
      (record, index) => `
<article id="${escapeHtml(record.code)}">
  <h2><span class="n">${index + 1}.</span> ${escapeHtml(record.heading)}</h2>
  <p class="code">Code to exclude it: <code>${escapeHtml(record.code)}</code></p>
${record.sections
  .map((section) => `  <section><h3>${escapeHtml(section.label)}</h3><pre>${escapeHtml(section.text)}</pre></section>`)
  .join("\n")}
</article>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(pack.title)}</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.55 system-ui, sans-serif; max-width: 52rem; margin: 0 auto; padding: 1rem; }
  header { border-bottom: 2px solid; padding-bottom: 1rem; margin-bottom: 1.5rem; }
  .signoff { font-size: 1.4rem; font-weight: 700; }
  .signoff code { font-size: 1.6rem; letter-spacing: 0.1em; }
  article { border-top: 1px solid #8884; padding: 1rem 0; }
  h2 { font-size: 1.15rem; margin: 0 0 0.25rem; }
  h3 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; margin: 0.9rem 0 0.2rem; opacity: 0.75; }
  pre { white-space: pre-wrap; font: inherit; margin: 0; }
  .code { margin: 0; font-size: 0.9rem; opacity: 0.8; }
  .n { opacity: 0.6; }
  ol li { margin-bottom: 0.3rem; }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(pack.title)}</h1>
  <p class="signoff">Sign-off code: <code>${escapeHtml(pack.code)}</code></p>
  <p>${pack.records.length} records. Written ${escapeHtml(pack.generatedAt)}.</p>
${pack.intro.map((line) => `  <p>${escapeHtml(line)}</p>`).join("\n")}
  <p>Signing the set answers these for every record you do not exclude:</p>
  <ol>
${pack.questions.map((question) => `    <li>${escapeHtml(question)}</li>`).join("\n")}
  </ol>
  <p>When you have read it all, run this in PowerShell, adding the codes of any records you are not happy with after <code>--exclude</code>, separated by commas (or leave <code>--exclude</code> out):</p>
  <pre><code>${escapeHtml(pack.batchCommand)}</code></pre>
  <p>If anything in this set changes after this page was written, the code stops matching and nothing is signed. Write a fresh pack and read the new one.</p>
</header>
${recordHtml}
</body>
</html>
`;
}
