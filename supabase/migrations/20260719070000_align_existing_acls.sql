-- Align existing tables' and functions' ACLs with the postgres default privileges.
-- This revokes legacy/excess permissions on already-created objects to resolve schema drift.

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Align base tables
  FOR r IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM public, anon, authenticated, service_role', r.table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role', r.table_name);
  END LOOP;
END;
$$;

-- Align prevent_source_review_event_mutation function execute privilege
REVOKE EXECUTE ON FUNCTION public.prevent_source_review_event_mutation() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_source_review_event_mutation() TO service_role;
