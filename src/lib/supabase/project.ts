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

export type ExpectedSupabaseProject = {
  name: string;
  ref: string;
  url: string;
  region: string;
};

export type SupabaseProjectConfig = {
  NEXT_PUBLIC_SUPABASE_URL?: string | null;
  SUPABASE_PROJECT_REF?: string | null;
  SUPABASE_PROJECT_NAME?: string | null;
  // Staging is declared explicitly, never inferred. Both must be set to enable
  // a second accepted project; the ref must be a valid Supabase ref that is
  // NOT the production or a stale ref (that would be the silent-point-at-prod
  // footgun this guard exists to prevent). See docs/staging-setup.md.
  SUPABASE_STAGING_PROJECT_REF?: string | null;
  SUPABASE_STAGING_PROJECT_NAME?: string | null;
  // Dedicated Caring Contacts sovereign Sydney project. Distinct from PsychSift
  // production and from staging; both vars required. Separation from the
  // clinical KB remains enforced by assertNotClinicalKbProject on the Caring
  // Contacts database URL.
  SUPABASE_CARING_CONTACTS_PROJECT_REF?: string | null;
  SUPABASE_CARING_CONTACTS_PROJECT_NAME?: string | null;
};

export type SupabaseProjectCheckStatus = "ready" | "missing" | "mismatch" | "warning";

type SupabaseProjectCheckOptions = {
  requireMetadata?: boolean;
};

export type SupabaseProjectCheck = {
  status: SupabaseProjectCheckStatus;
  expected: ExpectedSupabaseProject;
  observed: {
    url: string | null;
    urlRef: string | null;
    configuredRef: string | null;
    configuredName: string | null;
    environment: "production" | "staging" | "caring-contacts";
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

const reservedProjectRefs = new Set<string>([
  expectedSupabaseProject.ref,
  ...staleSupabaseProjects.map((project) => project.ref),
]);

/**
 * Resolve an optional staging project declared via env. Returns the project
 * when the declaration is valid, or a problem string when staging vars are
 * partially/incorrectly set (so a broken staging declaration fails loud rather
 * than silently falling through to the production guard).
 */
function resolveStagingProject(config: SupabaseProjectConfig): {
  project: ExpectedSupabaseProject | null;
  problem: string | null;
} {
  const stagingRef = trimmed(config.SUPABASE_STAGING_PROJECT_REF);
  const stagingName = trimmed(config.SUPABASE_STAGING_PROJECT_NAME);
  if (!stagingRef && !stagingName) return { project: null, problem: null };
  if (!stagingRef || !stagingName) {
    return {
      project: null,
      problem: "Set BOTH SUPABASE_STAGING_PROJECT_REF and SUPABASE_STAGING_PROJECT_NAME to enable the staging project.",
    };
  }
  if (!/^[a-z0-9]{20}$/.test(stagingRef)) {
    return { project: null, problem: `SUPABASE_STAGING_PROJECT_REF "${stagingRef}" is not a valid Supabase ref.` };
  }
  if (reservedProjectRefs.has(stagingRef)) {
    return {
      project: null,
      problem: `SUPABASE_STAGING_PROJECT_REF ${stagingRef} collides with the production/stale project; staging must be a distinct project.`,
    };
  }
  return {
    project: { name: stagingName, ref: stagingRef, url: `https://${stagingRef}.supabase.co`, region: "ap-southeast-2" },
    problem: null,
  };
}

/**
 * Resolve an optional Caring Contacts sovereign project declared via env.
 * Same fail-loud partial-declaration rules as staging; must not collide with
 * PsychSift production, stale refs, or an explicitly declared staging ref.
 */
function resolveCaringContactsProject(config: SupabaseProjectConfig): {
  project: ExpectedSupabaseProject | null;
  problem: string | null;
} {
  const ref = trimmed(config.SUPABASE_CARING_CONTACTS_PROJECT_REF);
  const name = trimmed(config.SUPABASE_CARING_CONTACTS_PROJECT_NAME);
  if (!ref && !name) return { project: null, problem: null };
  if (!ref || !name) {
    return {
      project: null,
      problem:
        "Set BOTH SUPABASE_CARING_CONTACTS_PROJECT_REF and SUPABASE_CARING_CONTACTS_PROJECT_NAME to enable the Caring Contacts project.",
    };
  }
  if (!/^[a-z0-9]{20}$/.test(ref)) {
    return {
      project: null,
      problem: `SUPABASE_CARING_CONTACTS_PROJECT_REF "${ref}" is not a valid Supabase ref.`,
    };
  }
  if (reservedProjectRefs.has(ref)) {
    return {
      project: null,
      problem: `SUPABASE_CARING_CONTACTS_PROJECT_REF ${ref} collides with the production/stale project; Caring Contacts must be a distinct project.`,
    };
  }
  const stagingRef = trimmed(config.SUPABASE_STAGING_PROJECT_REF);
  if (stagingRef && stagingRef === ref) {
    return {
      project: null,
      problem:
        "SUPABASE_CARING_CONTACTS_PROJECT_REF collides with SUPABASE_STAGING_PROJECT_REF; Caring Contacts must be a distinct accepted identity.",
    };
  }
  return {
    project: { name, ref, url: `https://${ref}.supabase.co`, region: "ap-southeast-2" },
    problem: null,
  };
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

  const { project: stagingProject, problem: stagingProblem } = resolveStagingProject(config);
  const { project: caringContactsProject, problem: caringContactsProblem } = resolveCaringContactsProject(config);
  // Pick which accepted project this config is targeting. Dedicated Caring
  // Contacts and staging are only matched when the observed ref equals the
  // explicitly-declared ref; everything else resolves to production, so
  // production behavior is unchanged when neither alternate is declared.
  let expected: ExpectedSupabaseProject = expectedSupabaseProject;
  let environment: "production" | "staging" | "caring-contacts" = "production";
  if (caringContactsProject && observedRefs.includes(caringContactsProject.ref)) {
    expected = caringContactsProject;
    environment = "caring-contacts";
  } else if (stagingProject && observedRefs.includes(stagingProject.ref)) {
    expected = stagingProject;
    environment = "staging";
  }

  if (stagingProblem) problems.push(stagingProblem);
  if (caringContactsProblem) problems.push(caringContactsProblem);

  if (!url) {
    return {
      status: "missing",
      expected,
      observed: { url, urlRef, configuredRef, configuredName, environment },
      staleProject,
      problems,
      warnings,
    };
  }

  if (!urlRef) {
    problems.push(`NEXT_PUBLIC_SUPABASE_URL must be a Supabase project URL for ${expected.name}.`);
  } else if (urlRef !== expected.ref) {
    problems.push(
      `NEXT_PUBLIC_SUPABASE_URL points to Supabase ref ${urlRef}; expected ${expected.ref} (${expected.name}).`,
    );
  }

  if (configuredRef && configuredRef !== expected.ref) {
    problems.push(`SUPABASE_PROJECT_REF is ${configuredRef}; expected ${expected.ref} (${expected.name}).`);
  }

  if (configuredName && configuredName !== expected.name) {
    problems.push(`SUPABASE_PROJECT_NAME is "${configuredName}"; expected "${expected.name}".`);
  }

  if (staleProject) {
    problems.unshift(
      `Configured Supabase ref ${staleProject.ref} belongs to the older unused project "${staleProject.name}".`,
    );
  }

  if (options.requireMetadata && urlRef === expected.ref && problems.length === 0) {
    if (!configuredRef) {
      warnings.push(`Set SUPABASE_PROJECT_REF=${expected.ref} in .env.local.`);
    }
    if (!configuredName) {
      warnings.push(`Set SUPABASE_PROJECT_NAME="${expected.name}" in .env.local.`);
    }
  }

  return {
    status: problems.length > 0 ? "mismatch" : warnings.length > 0 ? "warning" : "ready",
    expected,
    observed: { url, urlRef, configuredRef, configuredName, environment },
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

export function assertExpectedSupabaseProjectConfig(config: SupabaseProjectConfig) {
  const check = checkSupabaseProjectConfig(config);
  if (check.status === "mismatch") {
    throw new Error(`Supabase project mismatch: ${formatSupabaseProjectCheck(check)}`);
  }
}
