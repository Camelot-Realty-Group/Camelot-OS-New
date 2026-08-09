-- Replace the permissive Content Engine policies introduced by migration 012.
-- Content and lead records are internal Camelot operating data.

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'content_campaigns', 'content_items', 'content_approvals', 'content_sources',
    'content_assets', 'content_leads', 'content_conversions', 'content_runs'
  ] LOOP
    -- Some production projects predate the Content Engine migration. Keep this
    -- hardening migration safe and idempotent in those environments.
    IF to_regclass('public.' || quote_ident(table_name)) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM anon', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO authenticated', table_name);
    EXECUTE format('DROP POLICY IF EXISTS "App access %s" ON %I', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated team access %s" ON %I', table_name, table_name);
    EXECUTE format(
      'CREATE POLICY "Authenticated team access %s" ON %I FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)',
      table_name,
      table_name
    );
  END LOOP;
END $$;
