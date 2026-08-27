export type ScrollSurfaceTarget = number | "end";

export function ownsVerticalScroll(element: HTMLElement) {
  const overflowY = window.getComputedStyle(element).overflowY;
  return overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
}

function clampScrollOffset(scroller: Element, target: ScrollSurfaceTarget) {
  const maxOffset = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  if (target === "end") return maxOffset;
  return Math.min(Math.max(0, target), maxOffset);
}

export function scrollSurface(
  element: HTMLElement | null,
  target: ScrollSurfaceTarget,
  behavior: ScrollBehavior = "auto",
) {
  if (!element) return;
  if (ownsVerticalScroll(element)) {
    element.scrollTo({ top: clampScrollOffset(element, target), behavior });
    return;
  }
  const scrollingElement = document.scrollingElement ?? document.documentElement;
  window.scrollTo({ top: clampScrollOffset(scrollingElement, target), behavior });
}
