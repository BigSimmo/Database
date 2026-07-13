import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Document Source - Clinical KB" };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function DocumentsSourceRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const input = await searchParams;
  const id = typeof input.id === "string" ? input.id : "";
  if (!uuidPattern.test(id)) redirect("/documents/search");
  const params = new URLSearchParams();
  const page = typeof input.page === "string" ? Number(input.page) : NaN;
  const chunk = typeof input.chunk === "string" ? input.chunk.trim().slice(0, 120) : "";
  if (Number.isInteger(page) && page > 0) params.set("page", String(page));
  if (chunk) params.set("chunk", chunk);
  redirect(`/documents/${id}${params.size ? `?${params.toString()}` : ""}`);
}
