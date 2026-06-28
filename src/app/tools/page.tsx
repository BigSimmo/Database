import { permanentRedirect } from "next/navigation";

export default async function ToolsCompatibilityRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (typeof value === "string") {
      params.set(key, value);
    }
  }

  const query = params.toString();
  permanentRedirect(`/applications${query ? `?${query}` : ""}`);
}
