import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// The checkbox tick and the radio dot are nested inside the input's sibling box,
// so a `peer-checked:` variant on them never matches (Tailwind's peer variants
// only reach siblings). Both rendered blank when checked until 2026-10-01; the
// wrapper's `:has(:checked)` is what actually reaches them.
const source = readFileSync(join(process.cwd(), "src/components/ui/choice.tsx"), "utf8");

describe("choice indicator visibility", () => {
  it("never reveals a nested indicator with peer-checked", () => {
    expect(source).not.toMatch(/opacity-0 peer-checked:opacity-100/);
  });

  it("reveals the tick and the dot from the wrapper's checked state", () => {
    expect(source.match(/group-has-checked\/choice:opacity-100/g)).toHaveLength(2);
    expect(source.match(/className="group\/choice relative/g)).toHaveLength(2);
  });
});
