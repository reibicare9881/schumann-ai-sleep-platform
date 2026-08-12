-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

DROP EXTENSION pg_net;

DROP EXTENSION pg_graphql;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;

CREATE FUNCTION public.rls_auto_enable()
  RETURNS event_trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog'
  AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

GRANT ALL ON FUNCTION public.rls_auto_enable() TO anon;

GRANT ALL ON FUNCTION public.rls_auto_enable() TO authenticated;

GRANT ALL ON FUNCTION public.rls_auto_enable() TO service_role;

CREATE TABLE public.analysis_records (
  id                       uuid                     DEFAULT gen_random_uuid() NOT NULL,
  user_id                  uuid                     NOT NULL,
  assessment_round         smallint,
  name_extracted           text,
  gender_extracted         text,
  age_extracted            integer,
  occupation_extracted     text,
  experience_date          date,
  subjective_conditions    text,
  experience_time_sec      integer,
  hr_pre                   integer,
  hr_post                  integer,
  hr_lowest                integer,
  hr_conclusion            text,
  sdnn_pre                 real,
  sdnn_post                real,
  sdnn_lowest_trend        text,
  sdnn_conclusion          text,
  unity_index              real,
  balance_count            integer,
  lf_hf_value              real,
  lf_hf_conclusion         text,
  lf_hf_trend              text,
  yin_yang                 text,
  flower_colors            text,
  flower_brightness_detail text,
  flower_brightness        text,
  flower_shape             text,
  flower_extent            text,
  scatter_plot_analysis    text,
  sleep_quality_score      integer,
  ai_summary               text,
  report_url               text,
  created_at               timestamp with time zone DEFAULT now()
);

ALTER TABLE public.analysis_records
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.analysis_records
  ADD CONSTRAINT analysis_records_pkey PRIMARY KEY (id);

GRANT ALL ON public.analysis_records TO anon;

GRANT ALL ON public.analysis_records TO authenticated;

GRANT ALL ON public.analysis_records TO service_role;

CREATE POLICY "Users can access their own AI records" ON public.analysis_records
  USING ((auth.uid() = user_id));

CREATE TABLE public.appointments (
  id               uuid                     DEFAULT gen_random_uuid() NOT NULL,
  user_id          uuid                     NOT NULL,
  activity_type    text,
  item_name        text,
  status           text                     DEFAULT 'pending'::text,
  execution_date   date,
  created_at       timestamp with time zone DEFAULT now(),
  service_type     text,
  appointment_time text,
  org_code         text
);

ALTER TABLE public.appointments
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);

GRANT ALL ON public.appointments TO anon;

GRANT ALL ON public.appointments TO authenticated;

GRANT ALL ON public.appointments TO service_role;

CREATE POLICY "Users can access their own activities" ON public.appointments
  USING ((auth.uid() = user_id));

CREATE TABLE public.audit_logs (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  user_id      uuid,
  org_code     text,
  action       text                     NOT NULL,
  detail       text,
  role_at_time text,
  created_at   timestamp with time zone DEFAULT now()
);

ALTER TABLE public.audit_logs
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);

GRANT ALL ON public.audit_logs TO anon;

GRANT ALL ON public.audit_logs TO authenticated;

GRANT ALL ON public.audit_logs TO service_role;

CREATE TABLE public.organizations (
  org_code         text                     NOT NULL,
  org_name         text                     NOT NULL,
  member_pin       text                     NOT NULL,
  dept_pin         text                     NOT NULL,
  admin_pin        text                     NOT NULL,
  base_budget      numeric                  DEFAULT 100000,
  activation_pct   numeric                  DEFAULT 80,
  value_multiplier numeric                  DEFAULT 1.5,
  sick_days        numeric                  DEFAULT 3,
  daily_salary     numeric                  DEFAULT 3000,
  ins_saving       numeric                  DEFAULT 15000,
  impl_cost        numeric                  DEFAULT 80000,
  eff_gain         numeric                  DEFAULT 5,
  created_at       timestamp with time zone DEFAULT now(),
  prod_gain        numeric                  DEFAULT 200000
);

ALTER TABLE public.organizations
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_pkey PRIMARY KEY (org_code);

GRANT ALL ON public.organizations TO anon;

GRANT ALL ON public.organizations TO authenticated;

GRANT ALL ON public.organizations TO service_role;

CREATE TABLE public.profiles (
  id                uuid                     NOT NULL,
  full_name         text,
  gender            text,
  birth_date        date,
  occupation        text,
  user_type         text                     DEFAULT 'individual'::text,
  organization_name text,
  created_at        timestamp with time zone DEFAULT now(),
  system_role       text                     DEFAULT 'individual'::text,
  org_code          text,
  department        text
);

ALTER TABLE public.profiles
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_org_code_fkey FOREIGN KEY (org_code) REFERENCES public.organizations(org_code) ON DELETE SET NULL;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

ALTER TABLE public.analysis_records
  ADD CONSTRAINT analysis_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.appointments
  ADD CONSTRAINT promotion_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

GRANT ALL ON public.profiles TO anon;

GRANT ALL ON public.profiles TO authenticated;

GRANT ALL ON public.profiles TO service_role;

CREATE POLICY "Users can access their own data" ON public.profiles
  USING ((auth.uid() = id));

CREATE TABLE public.sleep_reports (
  id           uuid                     NOT NULL,
  user_id      uuid                     NOT NULL,
  org_code     text,
  platform     text,
  created_at   timestamp with time zone DEFAULT now(),
  profile      jsonb,
  sleep_score  integer,
  sleep_level  text,
  pain_score   integer,
  pain_level   text,
  work_score   integer,
  status       text,
  recs         jsonb,
  sleep_scores jsonb                    DEFAULT '{}'::jsonb,
  pain_scores  jsonb                    DEFAULT '{}'::jsonb,
  work_scores  jsonb                    DEFAULT '{}'::jsonb
);

ALTER TABLE public.sleep_reports
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sleep_reports
  ADD CONSTRAINT sleep_reports_pkey PRIMARY KEY (id);

GRANT ALL ON public.sleep_reports TO anon;

GRANT ALL ON public.sleep_reports TO authenticated;

GRANT ALL ON public.sleep_reports TO service_role;

CREATE EVENT TRIGGER ensure_rls
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION public.rls_auto_enable();
