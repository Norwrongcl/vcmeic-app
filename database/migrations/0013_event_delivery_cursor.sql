SET search_path=vcm,pg_catalog;
CREATE TABLE event_deliveries(cursor bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,outbox_sequence bigint NOT NULL UNIQUE REFERENCES outbox_events(sequence),created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX event_deliveries_retention_idx ON event_deliveries(created_at,cursor);
CREATE TRIGGER delivery_immutable BEFORE UPDATE OR DELETE ON event_deliveries FOR EACH ROW EXECUTE FUNCTION immutable_row();
GRANT SELECT,INSERT ON event_deliveries TO vcm_runtime;
GRANT USAGE,SELECT ON SEQUENCE event_deliveries_cursor_seq TO vcm_runtime;
