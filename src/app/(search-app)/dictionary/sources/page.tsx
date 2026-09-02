import { redirect } from "next/navigation";

export default async function DictionarySourcesRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const incoming = await searchParams;
  const destination = new URLSearchParams();
  for (const [key, value] of Object.entries(incoming)) {
    if (key === "usedBy" || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) destination.append(key, item);
  }
  destination.set("usedBy", "dictionary");
  redirect(`/sources?${destination.toString()}`);
}
