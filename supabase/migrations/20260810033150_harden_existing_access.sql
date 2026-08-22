-- The application accesses Supabase only through the FastAPI backend with the
-- service-role key. Disable direct Data API access for browser-facing roles.

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON ROUTINES FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public
  FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA public
  FROM PUBLIC, anon, authenticated;

-- This SECURITY DEFINER function exists only as an event-trigger handler and
-- must not be callable through PostgREST RPC, including by service_role.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()
  FROM PUBLIC, anon, authenticated, service_role;

-- Keep ownership policies as defense in depth. Scope them to authenticated
-- users, cache auth.uid() once per statement, and make write checks explicit.
DROP POLICY IF EXISTS "Users can access their own AI records"
  ON public.analysis_records;

CREATE POLICY "Users can access their own AI records"
  ON public.analysis_records
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can access their own activities"
  ON public.appointments;

CREATE POLICY "Users can access their own activities"
  ON public.appointments
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can access their own data"
  ON public.profiles;

CREATE POLICY "Users can access their own data"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);
