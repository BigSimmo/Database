import { describe, expect, it } from "vitest";

import {
  defaultFormSlug,
  formRecords,
  formStaticParams,
  getFormRecord,
  searchFormRecords,
} from "@/lib/forms";

describe("psychiatry form records", () => {
  it("keeps the forms catalogue limited to psychiatry form workflows", () => {
    expect(formRecords.map((form) => form.slug)).toEqual([
      "transport-crisis-form",
      "extension-transport-order",
      "detention-examination-movement",
      "transfer-order",
    ]);

    const catalogueText = JSON.stringify(formRecords).toLowerCase();

    expect(catalogueText).toContain("psychiatry");
    expect(catalogueText).toContain("transport");
    expect(catalogueText).toContain("detention");
    expect(catalogueText).toContain("transfer");
    expect(catalogueText).toContain("mental health act");
    expect(catalogueText).not.toContain("placeholder");
    expect(catalogueText).not.toContain(".example");
    expect(catalogueText).not.toContain("13yarn");
    expect(catalogueText).not.toContain("medicare mental health");
  });

  it("normalizes form lookup and static params", () => {
    expect(defaultFormSlug()).toBe("transport-crisis-form");
    expect(getFormRecord(" TRANSPORT-CRISIS-FORM ")?.title).toBe("Transport order");
    expect(getFormRecord("13yarn")).toBeNull();
    expect(formStaticParams()).toEqual(formRecords.map((form) => ({ slug: form.slug })));
  });

  it("searches forms independently from service records", () => {
    expect(searchFormRecords("transport forms")[0]?.service.slug).toBe("transport-crisis-form");
    expect(searchFormRecords("extension transport")[0]?.service.slug).toBe("extension-transport-order");
    expect(searchFormRecords("detention movement")[0]?.service.slug).toBe("detention-examination-movement");
    expect(searchFormRecords("transfer order")[0]?.service.slug).toBe("transfer-order");
    expect(searchFormRecords("13YARN")).toHaveLength(0);
    expect(searchFormRecords("services")).toHaveLength(0);
    expect(searchFormRecords("forms")[0]?.reasons).toContain("psychiatry forms catalogue");
  });
});
