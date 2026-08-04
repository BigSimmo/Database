export type ScrollSurfaceTarget = number | "end";

export function ownsVerticalScroll(element: HTMLElement) {
  const overflowY = window.getComputedStyle(element).overflowY;
  return overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
}

export function scrollSurface(
  element: HTMLElement | null,
  target: ScrollSurfaceTarget,
  behavior: ScrollBehavior = "auto",
) {
  if (!element) return;
  if (ownsVerticalScroll(element)) {
    element.scrollTo({ top: target === "end" ? element.scrollHeight : target, behavior });
    return;
  }
  const scrollingElement = document.scrollingElement ?? document.documentElement;
  window.scrollTo({ top: target === "end" ? scrollingElement.scrollHeight : target, behavior });
}
