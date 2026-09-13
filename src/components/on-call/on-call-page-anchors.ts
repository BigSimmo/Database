/**
 * The DOM anchor a group on an On Call page carries, so the in-page header can
 * jump to it.
 *
 * One function rather than a literal per section, because the header's declared
 * section ids and the rendered `id` attributes have to be the same string or the
 * jump silently lands nowhere. `tests/in-page-nav-route-sections.dom.test.tsx`
 * asserts anchors against rendered DOM for exactly this reason — never by
 * grepping for `id=`.
 */
export function onCallGroupAnchorId(slug: string): string {
  return `on-call-group-${slug}`;
}

/** A group heading turned into a stable, lowercase anchor fragment. */
export function onCallGroupSlug(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "group";
}
