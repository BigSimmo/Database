import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SpecifierSafetyNote } from "@/components/specifiers/specifier-ui";
import { SPECIFIERS_SAFETY_NOTE } from "@/lib/specifiers-governance";

describe("SpecifierSafetyNote", () => {
  it("renders the runtime aide-memoire governance copy", () => {
    render(<SpecifierSafetyNote />);
    expect(screen.getByText(SPECIFIERS_SAFETY_NOTE)).toBeTruthy();
  });
});
