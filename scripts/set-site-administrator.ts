import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd());

  if (process.env.ALLOW_SUPABASE_ADMIN_MUTATION !== "true") {
    throw new Error(
      "Refusing to change Supabase Auth. Re-run only after approval with ALLOW_SUPABASE_ADMIN_MUTATION=true.",
    );
  }

  const emailFlagIndex = process.argv.findIndex((argument) => argument === "--email");
  const inlineEmail = process.argv.find((argument) => argument.startsWith("--email="))?.slice("--email=".length);
  const requestedEmail = (inlineEmail ?? (emailFlagIndex >= 0 ? process.argv[emailFlagIndex + 1] : ""))
    ?.trim()
    .toLowerCase();

  if (!requestedEmail || !requestedEmail.includes("@")) {
    throw new Error("Usage: npm run auth:set-administrator -- --email user@example.com");
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  let matchedUser: Awaited<ReturnType<typeof supabase.auth.admin.listUsers>>["data"]["users"][number] | null = null;

  for (let page = 1; page <= 100 && !matchedUser; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    matchedUser = data.users.find((user) => user.email?.trim().toLowerCase() === requestedEmail) ?? null;
    if (data.users.length < 1000) break;
  }

  if (!matchedUser) throw new Error("No Supabase Auth user matched the supplied email address.");

  const { error } = await supabase.auth.admin.updateUserById(matchedUser.id, {
    app_metadata: { ...matchedUser.app_metadata, site_role: "administrator" },
  });
  if (error) throw error;

  console.log("Administrator claim updated. Sign out and sign in again before using administration tools.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Administrator claim update failed.");
  process.exitCode = 1;
});
