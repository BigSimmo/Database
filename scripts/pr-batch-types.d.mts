export interface BatchManifest {
  version: number;
  id: string;
  actor: string;
  authorization: string;
  controllerHash: string;
  mergeMethod: string;
  launchedAt: string;
  perPr: number;
  total: number;
  canaryEvidence: Record<string, { head: string; base: string; baseline_run: number; post_run: number }>;
  prs: Array<{ number: number; head: string; headRef: string; dependencies: number[]; exclusion: string | null }>;
}

export interface BatchEntry {
  number: number;
  head: string;
  state: string;
  reason: string | null;
  attempts: number;
  fingerprints: string[];
  updatedAt: string;
  progressAt: string;
  retried: boolean;
  retryCondition?: string;
  mergeCommit?: string;
  mergedAt?: string;
  reruns?: Record<string, string>;
}

export interface BatchOperation {
  id: string;
  kind: "sync" | "repair" | "merge";
  number: number;
  head: string;
  base: string;
  at?: string;
  fingerprint?: string | null;
  runId?: number;
  resultHead?: string;
  recoveryAttempt?: number;
  completed?: boolean;
  outcome?: string;
  verification?: string[];
  effects?: Record<string, { started: string; done: boolean }>;
}

export interface BatchState {
  version: number;
  manifest: BatchManifest;
  manifestDigest: string;
  approvedControllerHash?: string;
  status: string;
  reason: string | null;
  resumedAt: string;
  revision: number;
  repairs: number;
  pass: number;
  active: number | null;
  pending: BatchOperation | null;
  entries: BatchEntry[];
  events: Array<{ revision: number; at: string; kind: string; [key: string]: unknown }>;
}
