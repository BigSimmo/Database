// Token problems the caller can fix by signing in again. Anything else (JWKS timeout,
// unreachable or malformed key set) is an identity-provider outage, not a bad credential.
const CREDENTIAL_FAILURES = new Set([
  "ERR_JOSE_ALG_NOT_ALLOWED",
  "ERR_JOSE_NOT_SUPPORTED",
  "ERR_JWKS_MULTIPLE_MATCHING_KEYS",
  "ERR_JWKS_NO_MATCHING_KEY",
  "ERR_JWS_INVALID",
  "ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
  "ERR_JWT_CLAIM_VALIDATION_FAILED",
  "ERR_JWT_EXPIRED",
  "ERR_JWT_INVALID",
]);

export class VerifierUnavailableError extends Error {}

export async function createAuthenticator(config, dependencies = {}) {
  const { createRemoteJWKSet, jwtVerify } = dependencies.jose ?? (await import("jose"));
  const issuer = `https://login.microsoftonline.com/${config.tenant}/v2.0`;
  const keys =
    dependencies.keys ??
    createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${config.tenant}/discovery/v2.0/keys`), {
      timeoutDuration: 5000,
      cooldownDuration: 30_000,
    });
  return async (authorization) => {
    if (!/^Bearer [^\s]+$/.test(authorization ?? "") || authorization.length > 16_384) throw new Error("Unauthorised");
    let payload;
    try {
      ({ payload } = await jwtVerify(authorization.slice(7), keys, {
        issuer,
        audience: config.audience,
        algorithms: ["RS256"],
        requiredClaims: ["exp", "iat", "oid", "tid"],
        clockTolerance: 5,
      }));
    } catch (error) {
      if (CREDENTIAL_FAILURES.has(error?.code)) throw new Error("Unauthorised");
      throw new VerifierUnavailableError("Token verifier unavailable");
    }
    if (
      payload.tid !== config.tenant ||
      payload.oid !== config.allowedObjectId ||
      typeof payload.scp !== "string" ||
      !payload.scp.split(" ").includes("WardFlow.Access")
    )
      throw new Error("Unauthorised");
    return payload.oid;
  };
}
