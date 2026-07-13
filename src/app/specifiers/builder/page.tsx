import { SpecifierBuilderPage } from "@/components/specifiers/specifier-builder-page";

type BuilderRouteProps = {
  searchParams?: Promise<{ specifier?: string | string[] }>;
};

export default async function SpecifierBuilderRoute({ searchParams }: BuilderRouteProps) {
  const params = searchParams ? await searchParams : {};
  const initialSpecifiers = Array.isArray(params.specifier)
    ? Array.from(new Set(params.specifier))
    : params.specifier
      ? [params.specifier]
      : [];

  return <SpecifierBuilderPage initialSpecifiers={initialSpecifiers} />;
}
