const fs = require("fs");
const lines = fs.readFileSync("tmp_issues.md", "utf8").split(/\r?\n/);
const missing = lines.filter((l) => /^\| #26[0-9] \||^\| #270 \|/.test(l));

let formatted = [];
for (let m of missing) {
  let cells = m
    .split(/(?<!\\)\|/)
    .map((c) => c.trim())
    .filter((c) => c !== "");
  if (cells.length === 7) {
    let id = cells[0];
    let priority = cells[1];
    let type = cells[2];
    let title = cells[3];
    let details = cells[4];
    let source = cells[5];
    let date = cells[6];

    let row = `| ${id} | ${type} | <strong>${priority}</strong><br>Open — revalidate | <strong>Uncategorized</strong><br>${title} | Read protected contracts and confirm behaviour scope. | Estimate before start | Select by changed risk | None identified | Issue is resolved with focused proof recorded. | <details><summary>Evidence</summary><strong>Context:</strong> ${details}<br><strong>Source:</strong> ${source}<br><strong>Added:</strong> ${date}</details> |`;
    formatted.push(row);
  }
}

let target = fs.readFileSync("docs/outstanding-issues.md", "utf8");

// Update the marker
target = target.replace(/<!-- issues:next-id=(\d+) -->/, "<!-- issues:next-id=271 -->");

// Insert the rows AT THE END OF THE TABLE by replacing the blank lines before "## Resolved / archive"
target = target.replace(/\r?\n\r?\n## Resolved \/ archive/, "\n" + formatted.join("\n") + "\n\n## Resolved / archive");

fs.writeFileSync("docs/outstanding-issues.md", target);
console.log("Formatted " + formatted.length + " rows and inserted. Updated marker to 271.");
