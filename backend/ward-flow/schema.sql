BEGIN;
SELECT pg_advisory_xact_lock(782321);
DO $$
DECLARE mapped_oid text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wardflow_backend') THEN
    PERFORM pg_catalog.pgaadauth_create_principal_with_oid(
      'wardflow_backend', '4c3c6f2d-fa50-4b56-94e3-c05f30b67914', 'service', false, false
    );
  END IF;
  SELECT objectid INTO mapped_oid FROM pg_catalog.pgaadauth_list_principals(false)
    WHERE rolename = 'wardflow_backend';
  IF mapped_oid IS DISTINCT FROM '4c3c6f2d-fa50-4b56-94e3-c05f30b67914' THEN
    RAISE EXCEPTION 'Ward Flow backend identity mismatch';
  END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS ward_flow;
CREATE TABLE IF NOT EXISTS ward_flow.schema_version (
  version integer PRIMARY KEY CHECK (version = 1)
);
INSERT INTO ward_flow.schema_version (version) VALUES (1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS ward_flow.demo_sessions (
  owner_id uuid NOT NULL,
  session_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, session_id),
  CHECK (octet_length(payload::text) <= 2097152)
);
REVOKE ALL ON SCHEMA ward_flow FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA ward_flow FROM PUBLIC;
GRANT USAGE ON SCHEMA ward_flow TO wardflow_backend;
GRANT SELECT ON ward_flow.schema_version TO wardflow_backend;
GRANT SELECT, INSERT, UPDATE ON ward_flow.demo_sessions TO wardflow_backend;
COMMIT;
