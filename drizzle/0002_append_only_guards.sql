-- Ledger integrity: transactions and audit records are immutable once written.
-- Corrections must be made with a reversing transaction (transactions.reverses_id).
CREATE OR REPLACE FUNCTION reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER transactions_append_only
  BEFORE UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();
--> statement-breakpoint
CREATE TRIGGER transactions_no_truncate
  BEFORE TRUNCATE ON transactions
  FOR EACH STATEMENT EXECUTE FUNCTION reject_mutation();
--> statement-breakpoint
CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();
--> statement-breakpoint
CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION reject_mutation();
--> statement-breakpoint
-- Keep assets.updated_at and the optimistic-concurrency version honest on every update.
CREATE OR REPLACE FUNCTION assets_touch() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER assets_touch
  BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION assets_touch();
