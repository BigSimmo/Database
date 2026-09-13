## Task 2 — The form name is written twice

**Why.** `"Form 1A"` is a literal at `ward-movements.ts:152` and `:479`. Revising what that form is
called is two edits. The owner's standing rule is one place per fact.

⚠️ **DO NOT TIGHTEN `TransportJob.formRequired`'s TYPE.** Deriving a union from
`SELECTABLE_LEGAL_FORMS` needs `as const` on that array, which is pinned in roughly fifteen places by
`tests/ward-legal-figure-guard.test.ts` — the Mental Health Act figure guard. **Widening the type is
a deliberate change with a clinical guard in front of it; de-duplicating a literal is not.** You
established this yourself; it stands.

**Steps.** Export one constant beside the two writes and reference it twice. Nothing else.

**Check.** Typecheck clean, and `grep -c '"Form 1A"' src/components/ward-management/ward-movements.ts`
returns 1.
