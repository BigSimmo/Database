import { describe, expect, it } from "vitest";
import { isMissingRetrievalRpcError } from "../src/lib/retrieval-rpc-rollout";

describe("missing retrieval RPC classification", () => {
  it.each(["42883", "PGRST202"])("recognises missing-function code %s", (code) => {
    expect(isMissingRetrievalRpcError({ code, message: "missing" })).toBe(true);
  });

  it.each([
    "function public.search_v2(uuid) does not exist",
    "Could not find the function public.search_v2(owner_filter) in the schema cache",
    "Schema cache function search_v2 not found",
  ])("recognises narrow missing-function message: %s", (message) => {
    expect(isMissingRetrievalRpcError({ message })).toBe(true);
  });

  it.each([
    { code: "42501", message: "permission denied for function search_v2" },
    { code: "57014", message: "query canceled" },
    { message: "database connection unavailable" },
  ])("does not swallow permission/runtime errors", (error) => {
    expect(isMissingRetrievalRpcError(error)).toBe(false);
  });
});
