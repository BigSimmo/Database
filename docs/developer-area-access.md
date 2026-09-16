# Developer area access

How the four developer-gated subtrees under `/mockups` are protected, and how to
open them without signing in.

The subtrees are listed once, in `src/lib/developer-area/headers.ts`
(`DEVELOPER_GATED_PATH_PREFIXES`): the Development hub, Care Plan, Caring
Contacts and Ward Flow. Every other `/mockups/**` path 404s in production and is
not covered here.

## Two credentials, either of which opens the area

`DeveloperAreaGate` (`src/components/developer-area/developer-area-gate.tsx`)
admits a request holding **either**:

1. **A signed-in administrator** — a Supabase session whose
   `app_metadata.site_role` is `administrator`, the same claim that gates
   document and corpus management. Signing in is a magic link sent to an email
   address, or Apple/Google/Microsoft. There has never been a password.
2. **A valid passwordless access cookie** — the `?devkey=` link described below.

The cookie is checked first, because it is the expected case on the owner's own
devices and it needs no provider round trip to answer.

Outside production the gate is a no-op, matching every other `/mockups/**`
route. In production it bypasses only under the exact double-flag pairing the
isolated Playwright production build uses; `NEXT_PUBLIC_MOCKUPS_ENABLED=true`
alone must never open it, which was incident `#L30`.

## The passwordless link

**Setup, once per deployment.** Generate a secret and set it as the server-only
Railway variable `DEVELOPER_AREA_ACCESS_KEY` on the `Database` service:

```bash
openssl rand -hex 32
```

Minimum 32 characters, enforced in `src/lib/env.ts` and again in
`resolveDeveloperAccessKey`. A shorter value is treated as unconfigured rather
than accepted, because this secret travels in a URL where it is visible in
browser history and in any screen share. Never name it `NEXT_PUBLIC_…`: Next.js
inlines those into the client bundle, and `check:production-readiness` fails the
release if it finds that name.

**Setup, once per device.** Visit any gated path with the secret attached:

```
https://psychiatry.tools/mockups/development?devkey=<the secret>
```

`src/proxy.ts` verifies it, sets a signed cookie, and redirects to the same URL
without the parameter — so the secret does not stay in the address bar, in the
history entry that gets shared, or in a `Referer` header sent onward. From then
on that browser opens the developer area with no sign-in at all.

**It does not expire in practice.** The cookie is stamped for one year —
deliberately inside the ~400-day ceiling browsers clamp `Set-Cookie` lifetimes
to, so the stated expiry is the real one — and `src/proxy.ts` re-issues it on
every verified visit. A device used at least once a year never needs the link
again.

## What the link does not grant

Reaching the page is all it grants. The panels that read live data check the
administrator claim themselves and degrade to "unavailable" for a link holder:
`resolveHubEnvironmentFacts` (`environment-facts.ts`) and the corpus-health
reader both call `isAdministratorUser` independently of the gate.

That separation is deliberate. The link is a convenience credential that can be
forwarded in a message or copied off a screen; the corpus is the clinical
library. Do not "simplify" those panels by having them trust the cookie.

What a link holder _can_ read is the prototype content and the repository-derived
panels: the task ledger, the hazard notes, review state, routes, documentation
inventory, and the Ward Flow / Care Plan / Caring Contact prototypes. Treat the
link accordingly — it is roughly as sensitive as the internal notes themselves.

## Revoking access

Rotate `DEVELOPER_AREA_ACCESS_KEY` in Railway. Every existing cookie was signed
under the old key, so all of them stop verifying at once, on every device. There
is no per-device revocation, and none is planned for a single-operator
deployment.

To turn the passwordless route off entirely, unset the variable. The
administrator sign-in is then the only way in, exactly as before this existed.

## Why the cookie is not the key

The cookie carries `v1.<issuedAt>.<HMAC-SHA256 over both, keyed by the secret>`,
not the secret. A stolen cookie therefore cannot be turned back into the key, it
cannot be re-dated to extend itself (the signature covers the issue time), and
the server enforces the expiry rather than trusting the browser to drop it.
Every unset, under-strength, malformed, or wrongly-keyed case resolves to "not
granted" and falls through to the sign-in screen.

Implementation: `src/lib/developer-area/link-access.ts`. Tests:
`tests/developer-area-link-access.test.ts` (the credential),
`tests/proxy.test.ts` (the exchange and the renewal),
`tests/developer-area-access.test.ts` and
`tests/developer-area-gate.dom.test.tsx` (the gate).
