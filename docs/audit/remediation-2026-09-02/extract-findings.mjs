// Extract each finding's text (H/M blocks in §6/§7, L blocks in Appendix C) from the merged audit
// report into SP/remediation/findings/<id>.md so agents receive exact text without reading 790 KB.
import fs from "node:fs";
import path from "node:path";
const SP = "/tmp/claude-0/-home-user-Database/f185f405-83e6-51c4-90c5-be0b0f107617/scratchpad";
const report = fs.readFileSync("/home/user/Database/docs/audit/full-repository-audit-2026-09-02.md", "utf8");
const out = path.join(SP, "remediation/findings");
fs.mkdirSync(out, { recursive: true });
const lines = report.split("\n");
const blocks = {};
// High/Medium: "### H1 · ..." until next "### " or "## "
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^### ([HM]\d+) · /);
  if (!m) continue;
  let j = i + 1;
  while (j < lines.length && !/^### /.test(lines[j]) && !/^## /.test(lines[j])) j++;
  blocks[m[1]] = lines.slice(i, j).join("\n").trim();
}
// Low: in Appendix C, "**L12 · title** — ..." until next "**L\d+ ·" or "## "
const appC = lines.findIndex((l) => l.startsWith("## Appendix C"));
for (let i = appC; i < lines.length; i++) {
  const m = lines[i].match(/^\*\*(L\d+) · /);
  if (!m) continue;
  let j = i + 1;
  while (j < lines.length && !/^\*\*L\d+ · /.test(lines[j]) && !/^## /.test(lines[j])) j++;
  blocks[m[1]] = lines.slice(i, j).join("\n").trim();
}
// §14 items keyed by their leading number, for package guidance
const s14 = lines.findIndex((l) => l.startsWith("## 14. "));
const s15 = lines.findIndex((l) => l.startsWith("## 15. "));
const fixOrder = lines.slice(s14, s15).join("\n");
fs.writeFileSync(path.join(out, "_fix-order.md"), fixOrder);
const s12 = lines.findIndex((l) => l.startsWith("## 12. "));
const s13 = lines.findIndex((l) => l.startsWith("## 13. "));
fs.writeFileSync(path.join(out, "_never-touch.md"), lines.slice(s12, s13).join("\n"));
for (const [id, text] of Object.entries(blocks)) fs.writeFileSync(path.join(out, `${id}.md`), text + "\n");
console.log(`extracted ${Object.keys(blocks).length} findings; ids: ${Object.keys(blocks).filter((k) => /^[HM]/.test(k)).join(",")}`);
