-- Make public.audit_logs append-only for non-owner clients.
-- Keep INSERT and SELECT for service_role; block UPDATE/DELETE via grants + trigger.
-- Codify prod 20260921065653 (staging applied equivalent earlier as 20260921065428).

REVOKE UPDATE, DELETE ON TABLE public.audit_logs FROM service_role;
REVOKE UPDATE, DELETE ON TABLE public.audit_logs FROM anon, authenticated;

GRANT SELECT, INSERT ON TABLE public.audit_logs TO service_role;

-- Tighten RLS to match append-only intent (was ALL for service_role).
DROP POLICY IF EXISTS "audit logs service role all" ON public.audit_logs;
DROP POLICY IF EXISTS "audit logs service role select" ON public.audit_logs;
DROP POLICY IF EXISTS "audit logs service role insert" ON public.audit_logs;
CREATE POLICY "audit logs service role select"
  ON public.audit_logs
  FOR SELECT
  TO service_role
  USING (true);
CREATE POLICY "audit logs service role insert"
  ON public.audit_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.audit_logs_prevent_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only: % not allowed', TG_OP
    USING ERRCODE = '42501';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_append_only ON public.audit_logs;
CREATE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_logs_prevent_mutation();

REVOKE ALL ON FUNCTION public.audit_logs_prevent_mutation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_logs_prevent_mutation() TO postgres;
