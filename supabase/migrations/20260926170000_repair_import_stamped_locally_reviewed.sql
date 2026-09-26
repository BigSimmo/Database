-- Repair the documents that the 2026-06-30 source-metadata backfill stamped 'locally_reviewed'
-- (scripts/backfill-source-metadata.ts) because the document's own document-control text showed
-- the issuing WA health service had endorsed or approved it. Nobody reviewed them here; the owner
-- confirmed on 2026-09-26 that the stamp came from the import (#JYH1FH, inbox 99f09de5).
--
-- Each repaired document moves to the honest shape PR #3103 taught the app to read: status
-- 'unverified' with clinical_validation_evidence.basis 'wa_document_control_endorsement'. That
-- shape keeps the WA authority tier and claim-evidence eligibility exactly as 'locally_reviewed'
-- gave them, so retrieval ordering does not move; it does not count as reviewed authority for the
-- high-risk trust cap or "Strong support" wording (owner decision 2026-09-26, "No (cautious)").
--
-- The publisher's own evidence (evidence_type, evidence_text) is kept because it is true. Every
-- prior value is saved under metadata.validation_status_repair_2026_09 for an exact rollback.
--
-- Left alone, by design:
--   * any document with a recorded reviewer (a source_review_events review row, the review RPCs'
--     metadata markers, or a free-form reviewer key);
--   * registry records;
--   * public australian_public documents, whose governed metadata is immutable by trigger
--     (guard_australian_source_activation). The governed v3 retrieval RPC serves only those, so no
--     repaired document reaches the path that projects a fixed metadata key list.
-- The update touches neither reindex_requested (the ingestion webhook stays silent) nor owner_id
-- or corpus_scope (visibility is unchanged).
--
-- Fresh replays (CI migration replay, preview branches) hold no such rows and pass as a no-op.
-- On the live database the matched count must equal the owner-approved read-only count exactly,
-- or the migration raises and nothing changes.

set local search_path = public, pg_catalog;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $repair$
declare
  -- The repair_candidates figure from the owner-approved read-only count, taken before merge.
  c_expected constant integer := 1935;
  v_updated integer;
begin
  with targets as (
    select d.id
    from public.documents d
    where d.metadata->>'clinical_validation_status' = 'locally_reviewed'
      and coalesce(d.metadata#>>'{clinical_validation_evidence,basis}', '')
          like 'local WA source with document-control % evidence'
      and coalesce(d.metadata->>'source_kind', '') <> 'registry_record'
      and not (d.owner_id is null and coalesce(d.metadata->>'corpus_scope', '') = 'australian_public')
      and not exists (
        select 1
        from public.source_review_events e
        where e.document_id = d.id
          and e.decision in ('locally_reviewed', 'approved')
      )
      and coalesce(d.metadata->>'provenance_basis', '') <> 'reviewer_verified'
      and coalesce(d.metadata->>'governance_disposition', '') not in ('locally_reviewed', 'approved')
      and nullif(btrim(d.metadata->>'governance_updated_by'), '') is null
      and nullif(btrim(d.metadata->>'reviewed_by'), '') is null
      and nullif(btrim(d.metadata->>'reviewedBy'), '') is null
      and nullif(btrim(d.metadata->>'reviewer'), '') is null
      and nullif(btrim(d.metadata->>'reviewer_id'), '') is null
      and nullif(btrim(d.metadata->>'reviewer_name'), '') is null
      and nullif(btrim(d.metadata#>>'{clinical_validation_evidence,reviewer_id}'), '') is null
      and nullif(btrim(d.metadata#>>'{clinical_validation_evidence,attested_by}'), '') is null
      and not (d.metadata ? 'attestation')
      and not (d.metadata ? 'validation_status_repair_2026_09')
  )
  update public.documents d
  set metadata = d.metadata
      || jsonb_build_object(
           'validation_status_repair_2026_09', jsonb_build_object(
             'prior_clinical_validation_status', d.metadata->'clinical_validation_status',
             'prior_clinical_validation_evidence', d.metadata->'clinical_validation_evidence',
             'repaired_at', now(),
             'reason', 'bulk-import stamp, no recorded reviewer; owner decision 2026-09-26 (#JYH1FH)'
           ),
           'clinical_validation_status', 'unverified',
           'clinical_validation_evidence',
             (d.metadata->'clinical_validation_evidence')
             || jsonb_build_object(
                  'status', 'unverified',
                  'basis', 'wa_document_control_endorsement',
                  'reviewed_here', false,
                  'summary',
                    (d.metadata#>>'{clinical_validation_evidence,basis}')
                    || ' (endorsed by the issuing WA service, not reviewed here)'
                )
         )
  from targets t
  where d.id = t.id;

  get diagnostics v_updated = row_count;

  if v_updated <> 0 and v_updated <> c_expected then
    raise exception 'locally_reviewed repair: matched % rows, owner approved %; aborting with no change',
      v_updated, c_expected;
  end if;

  raise notice 'locally_reviewed repair: repaired % documents', v_updated;
end;
$repair$;
