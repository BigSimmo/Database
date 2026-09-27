import { describe, expect, it } from "vitest";
import { searchEntries, type SearchEntry } from "@/lib/first-nations/search";

const entries: SearchEntry[] = [
  {
    id: "a",
    title: "Aboriginal Interpreting WA",
    detail: "Book 24 h ahead",
    href: "/first-nations/contacts",
    number: "1800 000 012",
  },
  { id: "b", title: "Allow silence", detail: "A pause can mean thinking", href: "/first-nations/talking#yarning" },
  { id: "c", title: "Book an interpreter early", detail: "Language", href: "/first-nations/talking#language" },
];

describe("searchEntries", () => {
  it("returns nothing for an empty query", () => {
    expect(searchEntries(entries, "   ")).toEqual([]);
  });
  it("needs every word to match and ranks title matches first", () => {
    expect(searchEntries(entries, "interpret").map((e) => e.id)).toEqual(["a", "c"]);
    expect(searchEntries(entries, "pause thinking").map((e) => e.id)).toEqual(["b"]);
  });
  it("finds a number by its digits", () => {
    expect(searchEntries(entries, "000 012").map((e) => e.id)).toEqual(["a"]);
  });
  it("respects the limit", () => {
    expect(searchEntries(entries, "a", 1)).toHaveLength(1);
  });
});
