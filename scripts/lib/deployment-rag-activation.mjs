/** Content-free release proof: configuration/implementation availability, not answer quality. */
export function assessDeployedRagActivation(payload, expectedSha) {
  const failures = [];
  if (!/^[a-f0-9]{40}$/.test(expectedSha ?? "")) failures.push("expected_sha_invalid");
  if (!/^[a-f0-9]{40}$/.test(payload?.deploymentCommitSha ?? "") || payload.deploymentCommitSha !== expectedSha)
    failures.push("serving_sha_mismatch");
  if (payload?.status !== "ok" || payload?.demoMode !== false) failures.push("deployment_not_ready");
  const programme = payload?.ragProgramme;
  if (programme?.retrieval?.mode !== "canary" || programme?.retrieval?.governedRetrievalEnabled !== true)
    failures.push("retrieval_mode_mismatch");
  if (programme?.fullRollout?.generationProviderAvailable !== true) failures.push("generation_provider_unavailable");
  if (programme?.fullRollout?.coverageContractAvailable !== true)
    failures.push("governed_coverage_contract_unavailable");
  if (programme?.configuredMode !== "canary" || programme?.candidatePercentage !== 100)
    failures.push("full_candidate_rollout_unavailable");
  if (
    programme?.components?.adaptiveAnswer !== true ||
    programme?.components?.adaptiveRender !== true ||
    programme?.versions?.adaptiveProducerAvailable !== true ||
    programme?.versions?.adaptiveRendererAvailable !== true
  )
    failures.push("adaptive_contract_unavailable");
  if (
    programme?.audiences?.guests !== "full-rollout" ||
    programme?.audiences?.authenticated !== "owner-cohort-or-full-rollout" ||
    programme?.fullRollout?.eligible !== true ||
    programme?.fullRollout?.adaptiveAnswer !== true ||
    programme?.fullRollout?.adaptiveRender !== true ||
    programme?.fullRollout?.reason !== "enabled"
  )
    failures.push("guest_adaptive_activation_unavailable");
  return { ok: failures.length === 0, check: "deployed-rag-activation", failures };
}

/** Requires operator authorization; never logs URL, token, provider payload or exception text. */
export async function checkDeployedRagActivation(environment, fetchImpl = fetch) {
  const fail = (reason) => ({ ok: false, check: "deployed-rag-activation", failures: [reason] });
  if (!/^[a-f0-9]{40}$/.test(environment.DEPLOY_EXPECTED_SHA ?? "")) return fail("expected_sha_invalid");
  if (!environment.HEALTH_DEEP_PROBE_SECRET?.trim()) return fail("health_token_missing");
  let url;
  try {
    url = new URL(environment.DEPLOY_ACTIVATION_URL);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/")
      return fail("activation_origin_invalid");
  } catch {
    return fail("activation_origin_invalid");
  }
  try {
    const response = await fetchImpl(new URL("/api/health?deep=1", url), {
      headers: { "x-health-deep-token": environment.HEALTH_DEEP_PROBE_SECRET },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return fail("health_http_failure");
    return assessDeployedRagActivation(await response.json(), environment.DEPLOY_EXPECTED_SHA);
  } catch {
    return fail("health_probe_failed");
  }
}
