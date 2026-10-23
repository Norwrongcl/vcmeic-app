SET search_path=vcm,pg_catalog;
CREATE TABLE login_limits(key text PRIMARY KEY, window_started_at timestamptz NOT NULL DEFAULT now(), attempts int NOT NULL CHECK(attempts>0));
GRANT SELECT,INSERT,UPDATE ON login_limits TO vcm_runtime;
GRANT SELECT ON users,service_credentials TO vcm_runtime;
GRANT SELECT,INSERT,UPDATE ON sessions TO vcm_runtime;
REVOKE INSERT,UPDATE ON principals,principal_roles,service_credentials,users FROM vcm_runtime;
GRANT USAGE ON SCHEMA vcm_meta TO vcm_runtime;
GRANT SELECT ON vcm_meta.schema_migrations TO vcm_runtime;
