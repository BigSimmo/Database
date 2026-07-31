import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type SourceMetadataInput,
  SourceDesignationBadge,
  SourceProvenance,
  SourceStatusBadge,
} from "@/components/ui-primitives";

// The reported repro: `<SourceProvenance metadata={{ clinical_validation_status: "validated" }} />`
// blanked the page, because an off-vocabulary enum value reached the server logger's
// unguarded `process.env` read. Every badge that normalizes metadata must instead render
// the neutral fallback for an off-vocab value in each of the three enum fields.
// The props are now typed (`SourceMetadataInput`), so this object no longer
// compiles without a cast — which is the point: the compile-time hole that let
// `{ validation_status: … }` through is closed. The cast stays because the values
// still arrive at runtime from Postgres, where nothing enforces the enum, so the
// runtime fallback must keep working regardless of what the type says.
const OFF_VOCAB = {
  document_status: "validated",
  clinical_validation_status: "validated",
  extraction_quality: "excellent",
} as unknown as SourceMetadataInput;

describe("source badges degrade to the neutral fallback for off-vocabulary metadata", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders SourceProvenance without unmounting", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    render(<SourceProvenance metadata={OFF_VOCAB} />);

    expect(screen.getByText("Not locally validated")).toBeVisible();
    expect(screen.getByText("Extraction unknown")).toBeVisible();
    expect(error).not.toHaveBeenCalled();
  });

  it("renders SourceStatusBadge without unmounting", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    render(<SourceStatusBadge metadata={OFF_VOCAB} />);

    expect(screen.getByText("Review status unknown")).toBeVisible();
    expect(error).not.toHaveBeenCalled();
  });

  it("renders SourceDesignationBadge without unmounting", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    render(<SourceDesignationBadge metadata={OFF_VOCAB} />);

    expect(screen.getByText("Unclassified")).toBeVisible();
    expect(error).not.toHaveBeenCalled();
  });

  it("traces the off-vocabulary value exactly once per field", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "development");

    render(<SourceStatusBadge metadata={OFF_VOCAB} />);

    expect(warn).toHaveBeenCalledTimes(3);
    expect(warn.mock.calls[0]?.[0]).toContain("unrecognized document_status");
    vi.unstubAllEnvs();
  });
});
