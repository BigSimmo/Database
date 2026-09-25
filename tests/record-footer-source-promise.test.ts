import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// Medication and therapy detail pages render no source link (#05WXHX), so their
// footers must not tell a clinician to check "the linked source". Restore that
// wording only together with real, governed source links on these pages.
const footers = [
  "src/components/clinical-dashboard/medication-record-page.tsx",
  "src/components/therapy-compass/screens/detail-screen.tsx",
];

describe("record page footers", () => {
  it.each(footers)("%s does not promise a linked source", (file) => {
    const source = readFileSync(file, "utf8");
    const footer = source.match(/<InformationPageFooter[^>]*>([\s\S]*?)<\/InformationPageFooter>/)?.[1] ?? "";
    expect(footer.trim().length).toBeGreaterThan(0);
    expect(footer).not.toMatch(/linked source/i);
  });
});
