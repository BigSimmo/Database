# Frontend architecture

## Route ownership

- `GlobalSearchShell` owns shared navigation, responsive chrome and URL-backed mode/query/filter state. `search-route-ownership` is the pure routing boundary that decides whether a submitted search stays in a route-owned workflow or renders `ClinicalDashboard`.
- `ClinicalDashboard` owns submitted Answer, Documents and Prescribing workflows.
- `/documents/search` renders live `/api/search` results for submitted queries; `/documents/[id]` is the canonical viewer.
- `/documents/source*` are compatibility redirects. Fixture document journeys live only below `/mockups/document-search/**`.

## Client state boundaries

- Query mode and non-sensitive filters are validated by `search-navigation-context` and serialized in the URL.
- Selected private document IDs stay in session storage behind a short-lived opaque `scopeRef`; an unavailable reference blocks automatic execution rather than broadening scope.
- `AuthProvider` owns the authentication epoch and abort registry. User-scoped requests capture the epoch and must verify it before committing state.
- `answer-lifecycle` distinguishes loading, streaming, revision, completion, cancellation and failure. Cancelled provisional text is removed and cannot be copied as a final answer.

## Server and safety boundaries

- Pages and layouts remain Server Components unless they require browser state or event handlers.
- Route handlers enforce public/private document scope; client filters are never authorization controls.
- Pre-stream API failures use the public JSON error envelope. SSE error events are reserved for failures after a successful stream begins.
- Production routes must not import fixture/mockup modules. Enforced in CI by the
  `no-restricted-imports` rule in `eslint.config.mjs` (mockup imports are fenced to
  `src/app/mockups/**` and the `*-mockups` sources).
