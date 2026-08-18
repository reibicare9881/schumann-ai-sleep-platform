begin;

select plan(18);

select has_table('public', 'reibi_analytics_settings', 'analytics settings table exists');
select has_table('public', 'reibi_generated_reports', 'generated reports table exists');
select has_column('public', 'profiles', 'research_opt_in', 'profiles has explicit research consent');

select is(
  has_table_privilege('anon', 'public.reibi_generated_reports', 'SELECT'), false,
  'anonymous browser role cannot read generated reports'
);
select is(
  has_table_privilege('authenticated', 'public.reibi_generated_reports', 'SELECT'), false,
  'authenticated browser role cannot read generated reports directly'
);
select is(
  has_table_privilege('authenticated', 'public.reibi_analytics_settings', 'UPDATE'), false,
  'authenticated browser role cannot update ROI settings directly'
);
select is(
  has_function_privilege('authenticated', 'public.reibi_org_health_snapshot(text,date,date,text)', 'EXECUTE'), false,
  'authenticated browser role cannot execute organization aggregate directly'
);
select is(
  has_function_privilege('authenticated', 'public.reibi_cross_org_health_snapshot(date,date)', 'EXECUTE'), false,
  'authenticated browser role cannot execute cross-organization aggregate directly'
);

insert into public.organizations (org_code, org_name, member_pin, dept_pin, admin_pin)
values ('BATCH-E-TEST', 'Batch E Test Organization', 'x', 'x', 'x');

insert into public.profiles (id, full_name, system_role, org_code, department)
select ('10000000-0000-0000-0000-00000000000' || n)::uuid,
       'Batch E User ' || n, 'member', 'BATCH-E-TEST', 'D1'
from generate_series(1, 5) as n;

insert into public.sleep_reports
  (id, user_id, org_code, platform, created_at, sleep_score, sleep_level, pain_score, pain_level, work_score,
   consent_org_aggregate)
select ('20000000-0000-0000-0000-00000000000' || n)::uuid,
       ('10000000-0000-0000-0000-00000000000' || n)::uuid,
       'BATCH-E-TEST', 'sleep', '2026-08-01'::timestamptz,
       n * 10, case when n <= 2 then 'green' else 'orange' end,
       n * 5, case when n <= 3 then 'green' else 'red' end, n * 3, true
from generate_series(1, 4) as n;

select is(
  (public.reibi_org_health_snapshot('BATCH-E-TEST', null, null, null)->>'suppressed')::boolean,
  true,
  'organization health is suppressed below k=5'
);

insert into public.sleep_reports
  (id, user_id, org_code, platform, created_at, sleep_score, sleep_level, pain_score, pain_level, work_score,
   consent_org_aggregate)
values (
  '20000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000005',
  'BATCH-E-TEST', 'sleep', '2026-08-01', 50, 'red', 25, 'red', 15, true
);

select is(
  (public.reibi_org_health_snapshot('BATCH-E-TEST', null, null, null)->>'suppressed')::boolean,
  false,
  'organization health is released at k=5'
);
select is(
  (public.reibi_org_health_snapshot('BATCH-E-TEST', null, null, null)->'metrics'->'sleep'->>'average_score')::numeric,
  30.0,
  'released sleep average uses latest report per person'
);
select is(
  (public.reibi_org_health_snapshot('BATCH-E-TEST', null, null, null)->'metrics'->'sleep'->>'red')::integer,
  1,
  'released sleep distribution is calculated correctly'
);

insert into public.reibi_health_assessments
  (profile_id, artifact_user_key, org_code, assessment_type, score, level_code, assessed_at,
   consent_org_aggregate)
values (
  '10000000-0000-0000-0000-000000000001', 'batch-e-user-1',
  'BATCH-E-TEST', 'phq4', 8, 'orange', '2026-08-01', true
);

select is(
  (public.reibi_org_health_snapshot('BATCH-E-TEST', null, null, null)->'metrics'->'assessments'->>'phq4_sample_size')::integer,
  1,
  'assessment subgroup sample size is retained for suppression status'
);
select is(
  public.reibi_org_health_snapshot('BATCH-E-TEST', null, null, null)->'metrics'->'assessments'->>'phq4_average',
  null,
  'assessment average remains suppressed when its subgroup is below k=5'
);

update public.profiles set research_opt_in = true
where id in (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000004'
);

select is(
  (public.reibi_cross_org_health_snapshot(null, null)->>'organization_count')::integer,
  0,
  'cross-organization analytics excludes an opted-in group below k=5'
);

update public.profiles set research_opt_in = true
where id = '10000000-0000-0000-0000-000000000005';

select is(
  (public.reibi_cross_org_health_snapshot(null, null)->>'organization_count')::integer,
  1,
  'cross-organization analytics includes a fully opted-in group at k=5'
);
select is(
  (public.reibi_cross_org_health_snapshot(null, null)->'organizations'->0->>'report_sample_size')::integer,
  5,
  'cross-organization output reports the eligible report subgroup size'
);

select is(
  (select relrowsecurity from pg_class where oid = 'public.reibi_generated_reports'::regclass),
  true,
  'generated reports enforce RLS as defense in depth'
);

select * from finish();
rollback;
