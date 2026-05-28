export const expectedSupabaseProject = {
  name: "Clinical KB Database",
  ref: "sjrfecxgysukkwxsowpy",
  url: "https://sjrfecxgysukkwxsowpy.supabase.co",
  region: "ap-southeast-2",
} as const;

export const staleSupabaseProjects = [
  {
    name: "Database",
    ref: "qjgitjyhxrwxsrydablr",
    url: "https://qjgitjyhxrwxsrydablr.supabase.co",
  },
] as const;

export type SupabaseProjectConfig = {
  NEXT_PUBLIC_SUPABASE_URL?: string | null;
  SUPABASE_PROJECT_REF?: string | null;
  SUPABASE_PROJECT_NAME?: string | null;
};

export type SupabaseProjectCheckStatus = "ready" | "missing" | "mismatch" | "warning";

type SupabaseProjectCheckOptions = {
  requireMetadata?: boolean;
};

export type SupabaseProjectCheck = {
  status: SupabaseProjectCheckStatus;
  expected: typeof expectedSupabaseProject;
  observed: {
    url: string | null;
    urlRef: string | null;
    configuredRef: string | null;
    configuredName: string | null;
  };
  staleProject: (typeof staleSupabaseProjects)[number] | null;
  problems: string[];
  warnings: string[];
};

function trimmed(value: string | null | undefined) {
  const next = value?.trim();
  return next ? next : null;
}

export function extractSupabaseProjectRef(url: string | null | undefined) {
  const value = trimmed(url);
  if (!value) return null;

  try {
    const hostname = new URL(value).hostname.toLowerCase();
    const suffix = ".supabase.co";
    if (!hostname.endsWith(suffix)) return null;
    const ref = hostname.slice(0, -suffix.length);
    return /^[a-z0-9]{20}$/.test(ref) ? ref : null;
  } catch {
    return null;
  }
}

function unique(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export function checkSupabaseProjectConfig(
  config: SupabaseProjectConfig,
  options: SupabaseProjectCheckOptions = {},
): SupabaseProjectCheck {
  const url = trimmed(config.NEXT_PUBLIC_SUPABASE_URL);
  const urlRef = extractSupabaseProjectRef(url);
  const configuredRef = trimmed(config.SUPABASE_PROJECT_REF);
  const configuredName = trimmed(config.SUPABASE_PROJECT_NAME);
  const observedRefs = unique([urlRef, configuredRef]);
  const staleProject = staleSupabaseProjects.find((project) => observedRefs.includes(project.ref)) ?? null;
  const problems: string[] = [];
  const warnings: string[] = [];

  if (!url) {
    return {
      status: "missing",
      expected: expectedSupabaseProject,
      observed: { url, urlRef, configuredRef, configuredName },
      staleProject,
      problems,
      warnings,
    };
  }

  if (!urlRef) {
    problems.push(
      `NEXT_PUBLIC_SUPABASE_URL must be a Supabase project URL for ${expectedSupabaseProject.name}.`,
    );
  } else if (urlRef !== expectedSupabaseProject.ref) {
    problems.push(
      `NEXT_PUBLIC_SUPABASE_URL points to Supabase ref ${urlRef}; expected ${expectedSupabaseProject.ref} (${expectedSupabaseProject.name}).`,
    );
  }

  if (configuredRef && configuredRef !== expectedSupabaseProject.ref) {
    problems.push(
      `SUPABASE_PROJECT_REF is ${configuredRef}; expected ${expectedSupabaseProject.ref} (${expectedSupabaseProject.name}).`,
    );
  }

  if (configuredName && configuredName !== expectedSupabaseProject.name) {
    problems.push(`SUPABASE_PROJECT_NAME is "${configuredName}"; expected "${expectedSupabaseProject.name}".`);
  }

  if (staleProject) {
    problems.unshift(
      `Configured Supabase ref ${staleProject.ref} belongs to the older unused project "${staleProject.name}".`,
    );
  }

  if (options.requireMetadata && urlRef === expectedSupabaseProject.ref && problems.length === 0) {
    if (!configuredRef) {
      warnings.push(`Set SUPABASE_PROJECT_REF=${expectedSupabaseProject.ref} in .env.local.`);
    }
    if (!configuredName) {
      warnings.push(`Set SUPABASE_PROJECT_NAME="${expectedSupabaseProject.name}" in .env.local.`);
    }
  }

  return {
    status: problems.length > 0 ? "mismatch" : warnings.length > 0 ? "warning" : "ready",
    expected: expectedSupabaseProject,
    observed: { url, urlRef, configuredRef, configuredName },
    staleProject,
    problems,
    warnings,
  };
}

export function formatSupabaseProjectCheck(check: SupabaseProjectCheck) {
  if (check.status === "ready") {
    return `Supabase targets ${check.expected.name} (${check.expected.ref}).`;
  }

  if (check.status === "missing") {
    return `Set NEXT_PUBLIC_SUPABASE_URL=${check.expected.url} for ${check.expected.name}.`;
  }

  return [...check.problems, ...check.warnings].join(" ");
}

export function isExpectedSupabaseProjectConfig(config: SupabaseProjectConfig) {
  return checkSupabaseProjectConfig(config).status === "ready";
}

export function assertExpectedSupabaseProjectConfig(config: SupabaseProjectConfig) {
  const check = checkSupabaseProjectConfig(config);
  if (check.status === "mismatch") {
    throw new Error(`Supabase project mismatch: ${formatSupabaseProjectCheck(check)}`);
  }
}
