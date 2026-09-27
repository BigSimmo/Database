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
    const { payload } = await jwtVerify(authorization.slice(7), keys, {
      issuer,
      audience: config.audience,
      algorithms: ["RS256"],
      requiredClaims: ["exp", "iat", "oid", "tid"],
      clockTolerance: 5,
    });
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
