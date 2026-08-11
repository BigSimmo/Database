export function authorizationIdentity(headers: Readonly<Record<string, string>>): string {
  return headers.authorization ?? headers.Authorization ?? "";
}
