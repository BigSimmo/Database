-- Add first-class document site labels for the organisation badge system.

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
    'custom'
  ));

