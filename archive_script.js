const fs = require("fs");
let content = fs.readFileSync("docs/outstanding-issues.md", "utf8");
let lines = content.split("\n");
let newLines = [];
let archiveLines = [];

for (let line of lines) {
  if (line.startsWith("| #151 |")) {
    archiveLines.push(
      "| #151 | issue | `gh pr checks` cannot read CI, but the Actions API can | RESOLVED 2026-08-08: Documented the Actions API method in AGENTS.md per #187. | 2026-08-08 |",
    );
  } else if (line.startsWith("| #154 |")) {
    archiveLines.push(
      '| #154 | rec | Row ids are not stable identifiers for "did my change land" | RESOLVED 2026-08-08: Documented confirmation by content rather than ID in AGENTS.md per #187. | 2026-08-08 |',
    );
  } else if (line.startsWith("| #187 |")) {
    archiveLines.push(
      "| #187 | rec | Archive process-lesson rows #151 and #154 once a durable one-line note exists outside the ledger | RESOLVED 2026-08-08: Archived #151 and #154 and documented in AGENTS.md. | 2026-08-08 |",
    );
  } else {
    newLines.push(line);
    if (line.startsWith("| --- | --- | --- | --- | --- |")) {
      for (let al of archiveLines) {
        newLines.push(al);
      }
      archiveLines = [];
    }
  }
}
fs.writeFileSync("docs/outstanding-issues.md", newLines.join("\n"));
