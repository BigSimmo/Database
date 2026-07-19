import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { isAdministratorAppMetadata } from "@/lib/authorization";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("public content and account authorization model", () => {
  it("trusts only the immutable administrator app-metadata claim", () => {
    expect(isAdministratorAppMetadata({ site_role: "administrator" })).toBe(true);
    expect(isAdministratorAppMetadata({ site_role: "user" })).toBe(false);
    expect(isAdministratorAppMetadata({ role: "administrator" })).toBe(false);
    expect(isAdministratorAppMetadata(null)).toBe(false);
  });

  it("requires administrator authorization before any upload work", () => {
    const uploadRoute = source("src/app/api/upload/route.ts");
    const authCheck = uploadRoute.indexOf("requireAuthenticatedUser(request, adminSupabase, { administrator: true })");
    const formRead = uploadRoute.indexOf("request.formData()");
    const storageWrite = uploadRoute.indexOf(".upload(storagePath, buffer");

    expect(authCheck).toBeGreaterThan(-1);
    expect(authCheck).toBeLessThan(formRead);
    expect(authCheck).toBeLessThan(storageWrite);
    expect(uploadRoute).not.toContain("publicUploadsEnabled");
    expect(uploadRoute).not.toContain("PUBLIC_WORKSPACE_OWNER_ID");
  });

  it("keeps administrator assignment behind an explicit provider-mutation gate", () => {
    const script = source("scripts/set-site-administrator.ts");
    expect(script).toContain('process.env.ALLOW_SUPABASE_ADMIN_MUTATION !== "true"');
    expect(script).toContain('app_metadata: { ...matchedUser.app_metadata, site_role: "administrator" }');
  });

  it("stores favourites and preferences as owner-scoped RLS data", () => {
    const migration = source("supabase/migrations/20260719064735_user_account_data_and_admin_uploads.sql");
    expect(migration).toContain("create table if not exists public.user_favourites");
    expect(migration).toContain("create table if not exists public.user_preferences");
    expect(migration).toContain("references auth.users(id) on delete cascade");
    expect(migration).toContain("alter table public.user_favourites enable row level security");
    expect(migration).toContain("alter table public.user_preferences enable row level security");
    expect(migration).toContain("revoke all on table public.user_favourites from public, anon, authenticated");
    expect(migration).not.toMatch(/grant [^;]* on table public\.user_(?:favourites|preferences) to authenticated/);
    expect(migration.match(/\(select auth\.uid\(\)\) = user_id/g)?.length).toBeGreaterThanOrEqual(7);
    expect(migration).toContain("revoke insert, update, delete on table storage.objects from anon, authenticated");
  });

  it("keeps public document reads separate from administrator mutations", () => {
    const documentRoute = source("src/app/api/documents/[id]/route.ts");
    const tableFactsRoute = source("src/app/api/documents/[id]/table-facts/route.ts");
    const documentViewer = source("src/components/DocumentViewer.tsx");
    expect(documentRoute).toContain("loadAuthorizedDocumentDetail({ request, rawId, query: detailQuery })");
    expect(documentRoute.match(/administrator: true/g)?.length).toBe(2);
    expect(tableFactsRoute).toContain("enforceDocumentReadRateLimit(request, supabase)");
    expect(tableFactsRoute).toContain("withOwnerReadScope(");
    expect(tableFactsRoute.match(/administrator: true/g)?.length).toBe(1);
    expect(documentViewer).toContain("isAdministratorUser(session?.user)");
    expect(documentViewer).toContain("{canUseAdministrativeApis ? (");
    expect(documentViewer).toContain("canManage={canUseAdministrativeApis}");
    expect(documentViewer).toContain("canReview={canUseAdministrativeApis}");
  });

  it("does not turn an ordinary signed-in setup-status request into a server error", () => {
    const setupStatusRoute = source("src/app/api/setup-status/route.ts");
    expect(setupStatusRoute).toContain("error instanceof PublicApiError && error.status === 403");
    expect(setupStatusRoute).toContain("non-administrator credentials receive the same");
  });

  it("does not load or display administrative dashboard surfaces for ordinary accounts", () => {
    const dashboard = source("src/components/ClinicalDashboard.tsx");
    expect(dashboard).toContain("if (!canUseAdministrativeApis)");
    expect(dashboard).toContain(
      'canUseAdministrativeApis && (uploadDrawerOpen || (documentsDrawerOpen && documentsDrawerMode === "admin"))',
    );
    expect(dashboard).toContain(
      'const documentsDrawerIsAdmin = documentsDrawerMode === "admin" && canUseAdministrativeApis;',
    );
  });

  it("checks favourite save results explicitly instead of relying on object truthiness", () => {
    const serviceDetail = source("src/components/services/service-detail-page.tsx");
    const formDetail = source("src/components/forms/form-detail-page.tsx");
    const differentialDetail = source("src/components/differentials/differential-detail-page.tsx");

    for (const detailSource of [serviceDetail, formDetail, differentialDetail]) {
      expect(detailSource).toContain("result.success");
      expect(detailSource).not.toMatch(/if\s*\(\s*!\s*\(\s*await accountData\.setFavourite/);
    }
  });
});
