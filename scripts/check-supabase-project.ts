import { loadEnvConfig } from "@next/env";
import { checkSupabaseProjectConfig, formatSupabaseProjectCheck } from "@/lib/supabase/project";

loadEnvConfig(process.cwd());

const check = checkSupabaseProjectConfig(
  {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_PROJECT_REF: process.env.SUPABASE_PROJECT_REF,
    SUPABASE_PROJECT_NAME: process.env.SUPABASE_PROJECT_NAME,
    SUPABASE_STAGING_PROJECT_REF: process.env.SUPABASE_STAGING_PROJECT_REF,
    SUPABASE_STAGING_PROJECT_NAME: process.env.SUPABASE_STAGING_PROJECT_NAME,
  },
  { requireMetadata: true },
);

console.log(
  `Expected Supabase project: ${check.expected.name} (${check.expected.ref}) [${check.observed.environment}]`,
);
console.log(`Expected Supabase URL: ${check.expected.url}`);
console.log(`Configured URL ref: ${check.observed.urlRef ?? "not set or not recognized"}`);
console.log(`Configured SUPABASE_PROJECT_REF: ${check.observed.configuredRef ?? "not set"}`);
console.log(`Configured SUPABASE_PROJECT_NAME: ${check.observed.configuredName ?? "not set"}`);

if (check.status === "missing" || check.status === "mismatch") {
  console.error(formatSupabaseProjectCheck(check));
  process.exit(1);
}

if (check.status === "warning") {
  console.warn(formatSupabaseProjectCheck(check));
  process.exit(0);
}

console.log(formatSupabaseProjectCheck(check));
