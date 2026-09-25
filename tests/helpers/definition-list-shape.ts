import { expect } from "vitest";

/**
 * #Q80S8B: HTML lets a `<dl>` wrap each term/definition group in ONE `<div>`, and
 * that div may hold only `<dt>` and `<dd>`. A second wrapper (dl > div > div > dt)
 * or a stray decoration beside the pair breaks the association, so a screen reader
 * reads paired data as prose (axe `definition-list` / `dlitem`).
 */
export function expectWellFormedDefinitionLists(root: ParentNode) {
  const lists = Array.from(root.querySelectorAll("dl"));
  expect(lists.length).toBeGreaterThan(0);
  for (const list of lists) {
    for (const child of Array.from(list.children)) {
      if (child.tagName === "DT" || child.tagName === "DD") continue;
      expect(child.tagName, `dl child <${child.tagName.toLowerCase()}>`).toBe("DIV");
      const groupChildren = Array.from(child.children).map((node) => node.tagName.toLowerCase());
      expect(
        groupChildren.every((tag) => tag === "dt" || tag === "dd"),
        `dl > div holds <${groupChildren.join(">, <")}>`,
      ).toBe(true);
      expect(groupChildren).toContain("dt");
      expect(groupChildren).toContain("dd");
    }
  }
  for (const item of Array.from(root.querySelectorAll("dt, dd"))) {
    const parent = item.parentElement;
    const owner = parent?.tagName === "DL" ? parent : parent?.parentElement;
    expect(owner?.tagName, `<${item.tagName.toLowerCase()}> outside a dl group`).toBe("DL");
  }
}
