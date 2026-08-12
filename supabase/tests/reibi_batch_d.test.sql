begin;

select plan(16);

select has_table('public', 'reibi_point_ledger', 'point ledger exists');
select has_table('public', 'reibi_action_checkins', 'action check-in table exists');
select has_table('public', 'reibi_vital_profiles', 'vital profile table exists');
select has_table('public', 'reibi_feedback_surveys', 'feedback table exists');
select has_table('public', 'reibi_eap_resources', 'EAP resource table exists');

select is(
  has_table_privilege('anon', 'public.reibi_vital_profiles', 'SELECT'),
  false,
  'browser anon role cannot read vital profiles'
);

select is(
  has_function_privilege('authenticated', 'public.reibi_three_highs_aggregate(text,text)', 'EXECUTE'),
  false,
  'browser authenticated role cannot execute aggregate function directly'
);

insert into public.organizations (org_code, org_name, member_pin, dept_pin, admin_pin)
values ('BATCH-D-TEST', 'Batch D Test Organization', 'x', 'x', 'x');

insert into public.profiles (id, full_name, system_role, org_code, department)
select ('00000000-0000-0000-0000-00000000000' || n)::uuid,
       'Batch D User ' || n, 'member', 'BATCH-D-TEST', 'D1'
from generate_series(1, 5) as n;

select lives_ok(
  $$select public.reibi_adjust_points(
      '00000000-0000-0000-0000-000000000001', 'BATCH-D-TEST',
      'test', 'batch-d-idempotent', 5, '{}'::jsonb, 'pgTAP'
    )$$,
  'point adjustment succeeds'
);

select lives_ok(
  $$select public.reibi_adjust_points(
      '00000000-0000-0000-0000-000000000001', 'BATCH-D-TEST',
      'test', 'batch-d-idempotent', 5, '{}'::jsonb, 'pgTAP'
    )$$,
  'repeating an event key is idempotent'
);

select is(
  public.reibi_point_balance('00000000-0000-0000-0000-000000000001'),
  5,
  'idempotent point adjustment is counted once'
);

select lives_ok(
  $$select public.reibi_checkin_action(
      '00000000-0000-0000-0000-000000000001', 'BATCH-D-TEST',
      'water_8', '每日喝水', date '2026-08-01'
    )$$,
  'first action check-in succeeds'
);

select throws_ok(
  $$select public.reibi_checkin_action(
      '00000000-0000-0000-0000-000000000001', 'BATCH-D-TEST',
      'water_8', '每日喝水', date '2026-08-07'
    )$$,
  'P0001',
  'same action requires a 7-day interval',
  'same action is blocked before seven days'
);

insert into public.reibi_vital_profiles
  (profile_id, org_code, department_key, department_consent, systolic, diastolic, fasting_glucose, ldl, height_cm, weight_kg)
select ('00000000-0000-0000-0000-00000000000' || n)::uuid,
       'BATCH-D-TEST', 'D1', true, 120, 75, 90, 80, 170, 68
from generate_series(1, 4) as n;

select is(
  (public.reibi_three_highs_aggregate('BATCH-D-TEST', 'D1')->>'suppressed')::boolean,
  true,
  'three-highs aggregate is suppressed below k=5'
);

insert into public.reibi_vital_profiles
  (profile_id, org_code, department_key, department_consent, systolic, diastolic, fasting_glucose, ldl, height_cm, weight_kg)
values ('00000000-0000-0000-0000-000000000005', 'BATCH-D-TEST', 'D1', true, 145, 95, 110, 120, 170, 68);

select is(
  (public.reibi_three_highs_aggregate('BATCH-D-TEST', 'D1')->>'suppressed')::boolean,
  false,
  'three-highs aggregate is released at k=5'
);

select is(
  (public.reibi_three_highs_aggregate('BATCH-D-TEST', 'D1')->'metrics'->>'bp_high_risk')::integer,
  1,
  'released aggregate calculates high-risk blood pressure count'
);

select is(
  (select count(*)::integer from public.reibi_eap_resources where org_code is null and is_emergency),
  2,
  'default EAP data contains two emergency contacts'
);

select * from finish();
rollback;
