// Setup for the vitest `jsdom` project (see vitest.config.mts). Registers the
// jest-dom matchers (toBeInTheDocument, toHaveAttribute, …) on vitest's expect,
// unmounts any React tree rendered by @testing-library/react after each test so
// DOM state never leaks between cases, and polyfills the two browser APIs jsdom
// omits that our components touch (matchMedia, Element.scrollIntoView). Tests
// that care about a specific matchMedia result override window.matchMedia
// themselves; the default here just keeps components that probe it from throwing.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

function installMatchMediaStub(matches = false) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(), // deprecated, kept for older consumers
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeEach(() => {
  installMatchMediaStub(false);
  // jsdom does not implement scrollIntoView; components call it on focus/expand.
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
