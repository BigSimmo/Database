import { describe, expect, it } from "vitest";

/**
 * Helper to escape Markdown table cell content so pipe symbols, newlines, and
 * special characters do not break table layout.
 */
export function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

/**
 * Helper to format a file path as a clickable Markdown link `[label](file:///...)`,
 * percent-encoding the URI and escaping brackets in the label.
 */
export function formatMarkdownFileLink(filePath: string, label?: string): string {
  const displayLabel = (label ?? filePath).replace(/\[/g, "\\[").replace(/\]/g, "\\]");

  // Normalize path separators to forward slashes
  const normalizedPath = filePath.replace(/\\/g, "/");
  const encodedPath = encodeURI(normalizedPath)
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/"/g, "%22")
    .replace(/'/g, "%27");

  const uri = encodedPath.startsWith("file:///") ? encodedPath : `file:///${encodedPath.replace(/^\/+/, "")}`;

  return `[${displayLabel}](${uri})`;
}

/**
 * Helper to format an export manifest table row with safe escaping.
 */
export function formatManifestTableRow(columns: {
  path: string;
  sizeBytes: number;
  digest: string;
  category: string;
  description?: string;
}): string {
  const link = formatMarkdownFileLink(columns.path);
  const escapedLink = link.replace(/\|/g, "\\|");
  const escapedCategory = escapeMarkdownTableCell(columns.category);
  const escapedDesc = escapeMarkdownTableCell(columns.description ?? "");

  return `| ${escapedLink} | ${columns.sizeBytes} | \`${columns.digest}\` | ${escapedCategory} | ${escapedDesc} |`;
}

describe("Export manifest string escaping and link formatting (#KZJD4Q)", () => {
  it("percent-encodes whitespace and special characters in file URLs", () => {
    const link = formatMarkdownFileLink("docs/superpowers/plans/2026-08-23 remediation.md");
    expect(link).toBe(
      "[docs/superpowers/plans/2026-08-23 remediation.md](file:///docs/superpowers/plans/2026-08-23%20remediation.md)",
    );
  });

  it("safely encodes parentheses in file paths to prevent Markdown link parser truncation", () => {
    const link = formatMarkdownFileLink("docs/reports/Clinical Assessment (v2).pdf");
    expect(link).toContain("%28v2%29.pdf");
    expect(link.startsWith("[docs/reports/Clinical Assessment (v2).pdf](file:///")).toBe(true);
    // Ensure the closing parenthesis inside the URL does not terminate the markdown link early
    expect(link.endsWith(")")).toBe(true);
    expect(link).toBe(
      "[docs/reports/Clinical Assessment (v2).pdf](file:///docs/reports/Clinical%20Assessment%20%28v2%29.pdf)",
    );
  });

  it("escapes square brackets in link labels and percent-encodes brackets in URLs", () => {
    const link = formatMarkdownFileLink("src/app/[id]/page.tsx");
    expect(link).toBe("[src/app/\\[id\\]/page.tsx](file:///src/app/%5Bid%5D/page.tsx)");
  });

  it("percent-encodes double and single quotes in file paths", () => {
    const link = formatMarkdownFileLink("data/fixtures/\"quoted\"_'sample'.json");
    expect(link).toContain("%22quoted%22");
    expect(link).toContain("%27sample%27");
  });

  it("escapes pipe characters in Markdown table cells to preserve column structure", () => {
    const unescaped = "Option A | Option B | Option C";
    const escaped = escapeMarkdownTableCell(unescaped);
    expect(escaped).toBe("Option A \\| Option B \\| Option C");
    // Ensure all pipes are escaped so an unescaped split yields 1 item
    expect(escaped.split(/(?<!\\)\|/)).toHaveLength(1);
  });

  it("normalizes newlines inside table cells to prevent broken table rows", () => {
    const multiline = "Line 1\nLine 2\r\nLine 3";
    const escaped = escapeMarkdownTableCell(multiline);
    expect(escaped).toBe("Line 1 Line 2 Line 3");
    expect(escaped).not.toContain("\n");
    expect(escaped).not.toContain("\r");
  });

  it("formats a complete manifest table row with complex characters", () => {
    const row = formatManifestTableRow({
      path: 'docs/superpowers/[spec] (final) "v1".md',
      sizeBytes: 1024,
      digest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      category: "Spec | Design",
      description: "Architecture review (approved)\nReady for deployment",
    });

    expect(row).toContain(
      '[docs/superpowers/\\[spec\\] (final) "v1".md](file:///docs/superpowers/%5Bspec%5D%20%28final%29%20%22v1%22.md)',
    );
    expect(row).toContain("Spec \\| Design");
    expect(row).toContain("Architecture review (approved) Ready for deployment");
    // Verify that the table row has exactly 6 pipe delimiters (5 columns)
    const unescapedPipes = row.match(/(?<!\\)\|/g);
    expect(unescapedPipes).toHaveLength(6);
  });
});
