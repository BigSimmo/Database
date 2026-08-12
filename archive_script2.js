const fs = require("fs");
let content = fs.readFileSync("docs/outstanding-issues.md", "utf8");
let lines = content.split("\n");
let newLines = [];
let archiveLines = [];

for (let line of lines) {
  if (line.startsWith("| #232 |")) {
    archiveLines.push(
      "| #232 | issue | The PR-J clinical governance review record describes a head that was never merged | RESOLVED 2026-08-08: Appended superseding record for PR-J (PR #1595) against the merged head 590eb6cfb using npm run ledger:append. | 2026-08-08 |",
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
