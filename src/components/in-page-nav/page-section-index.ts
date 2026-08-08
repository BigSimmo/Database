import type { DocumentSection } from "@/components/document-viewer/section-index";

/**
 * A navigable section on a mode information page, for the default in-page
 * navigation template in `docs/search-chrome-behaviour.md`.
 *
 * This is `DocumentSection` with the document-specific fields made optional.
 * Documents earn a `detail` ("84 pages", "12 images") and a content-derived
 * `weight` from the indexed payload; a service record's Referral section has no
 * comparable magnitude to report, and inventing one ("5 fields") would be noise
 * dressed as information. `InPageNavHeader` fills the gaps — measured weights,
 * empty detail — so the shared primitives keep taking `DocumentSection` and
 * `section-index.ts` needs no change.
 */
export type PageSection = {
  /** Matches the section's DOM anchor id. */
  id: string;
  label: string;
  icon: DocumentSection["icon"];
  /**
   * Anchor candidates when the same section renders once per breakpoint (a
   * phone copy and a desktop copy). The first *displayed* one wins. Defaults to
   * `[id]`.
   */
  targetIds?: readonly string[];
  /** Stable URL fragment when the rendered target differs across breakpoints. */
  fragmentId?: string;
  /** Right-side text in the section sheet row. Omitted means no magnitude to report. */
  detail?: string;
  /**
   * Share of the page this section holds, already normalised. Omit to have the
   * header measure it from the rendered heights — a page whose sections are
   * discrete panels rather than scroll positions (tabs) should pass explicit
   * weights instead, because there is nothing on screen to measure.
   */
  weight?: number;
  /** Renders as an exclusive-accordion `<details>`; drives the trailing chevron. */
  collapsible?: boolean;
  pending?: boolean;
};

/**
 * Projects page sections onto the `DocumentSection` shape the shared track and
 * list already render.
 *
 * Weight precedence is deliberate: an explicit weight always wins, because a
 * page that computed one knows something measurement cannot see. Measured
 * weights come next. Equal shares are the floor, which is what server rendering
 * and the first client frame get.
 */
export function toDocumentSections(
  sections: readonly PageSection[],
  measuredWeights?: ReadonlyMap<string, number>,
): DocumentSection[] {
  const equalShare = sections.length > 0 ? 1 / sections.length : 1;

  return sections.map((section) => ({
    id: section.id,
    label: section.label,
    icon: section.icon,
    detail: section.detail ?? "",
    weight: section.weight ?? measuredWeights?.get(section.id) ?? equalShare,
    collapsible: section.collapsible ?? false,
    pending: section.pending,
  }));
}

/** The anchor candidates for a section, in preference order. */
export function sectionTargetIds(section: PageSection): readonly string[] {
  return section.targetIds?.length ? section.targetIds : [section.id];
}
