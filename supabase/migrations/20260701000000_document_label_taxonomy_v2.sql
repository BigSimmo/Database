-- Expand document labels for smart search scope and normalize the known ECT duplicate.

alter table public.document_labels
  drop constraint if exists document_labels_label_type_check;

alter table public.document_labels
  add constraint document_labels_label_type_check
  check (label_type in (
    'site',
    'topic',
    'document_type',
    'medication',
    'risk',
    'setting',
    'workflow',
    'population',
    'service',
    'clinical_action',
    'care_phase',
    'document_intent',
    'content_feature',
    'custom'
  ));

delete from public.document_labels duplicate
using public.document_labels canonical
where duplicate.label_type = 'topic'
  and canonical.label_type = 'topic'
  and duplicate.label = 'electroconvulsive therapy'
  and canonical.label = 'electroconvulsive-therapy'
  and duplicate.document_id = canonical.document_id
  and duplicate.source = canonical.source
  and duplicate.id <> canonical.id;

update public.document_labels
set label = 'electroconvulsive-therapy'
where label_type = 'topic'
  and label = 'electroconvulsive therapy';
