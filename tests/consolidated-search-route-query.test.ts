import { describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: navigation.redirect,
}));

import DifferentialsSearchRoute from "@/app/(search-app)/differentials/search/page";
import FormulationSearchRoute from "@/app/(search-app)/formulation/search/page";
import SpecifiersSearchRoute from "@/app/(search-app)/specifiers/search/page";
import { DifferentialsHomePage } from "@/components/differentials/differentials-home-page";
import { FormulationHomePage } from "@/components/formulation/formulation-home-page";
import { SpecifiersHomePage } from "@/components/specifiers/specifiers-home-page";

describe("consolidated search route query compatibility", () => {
  it("falls back to a non-empty legacy query when canonical q is blank", async () => {
    const searchParams = Promise.resolve({ q: "  ", query: " delirium " });

    const differentials = await DifferentialsSearchRoute({ searchParams });
    expect(differentials.type).toBe(DifferentialsHomePage);
    expect(differentials.props).toMatchObject({ query: "delirium", autoRunSearch: true });

    const formulation = await FormulationSearchRoute({ searchParams });
    expect(formulation.type).toBe(FormulationHomePage);
    expect(formulation.props.query).toBe("delirium");

    const specifiers = await SpecifiersSearchRoute({ searchParams });
    expect(specifiers.type).toBe(SpecifiersHomePage);
    expect(specifiers.props.query).toBe("delirium");
  });
});
