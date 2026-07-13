-- DOMAIN 1 privacy minimisation. This migration is safe to replay locally but
-- must not be applied to a live project without explicit operator approval.
-- Historical answer prose may echo identifying details from clinical queries;
-- telemetry remains useful through hashes and structured metadata going forward.
update public.rag_queries
set
  metadata = jsonb_set(
    coalesce(metadata, '{}'::jsonb),
    '{historical_answer_text_removed}',
    'true'::jsonb,
    true
  ),
  answer = null
where answer is not null;
