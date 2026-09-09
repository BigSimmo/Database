alter table public.rag_answer_feedback
  drop constraint if exists rag_answer_feedback_feedback_category_check;

alter table public.rag_answer_feedback
  add constraint rag_answer_feedback_feedback_category_check
  check (
    feedback_category in (
      'verified',
      'needs_correction',
      'source_insufficient',
      'wrong_source',
      'missing_source',
      'unsupported_answer',
      'numeric_error',
      'outdated_guidance',
      'wrong_mode',
      'missed_source',
      'unsupported_conclusion',
      'important_information_missing',
      'source_conflict',
      'outdated_source',
      'presentation_problem'
    )
  );
