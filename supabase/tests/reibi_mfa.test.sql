begin;

select plan(8);

select has_function('public', 'reibi_enable_mfa', 'MFA enable transaction exists');
select is(
  has_function_privilege('authenticated', 'public.reibi_enable_mfa(uuid)', 'EXECUTE'),
  false,
  'authenticated cannot enable MFA through the internal RPC'
);
select is(
  has_function_privilege('service_role', 'public.reibi_enable_mfa(uuid)', 'EXECUTE'),
  true,
  'service role can enable MFA after backend verification'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data
) values (
  '73000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'mfa-self@example.test', 'not-used',
  now(), '{}'::jsonb, '{}'::jsonb
);
insert into public.reibi_internal_users (
  auth_user_id, email, display_name, internal_role, mfa_required
) values (
  '73000000-0000-0000-0000-000000000001',
  'mfa-self@example.test', 'MFA Self Test', 'reibi_super', false
);
insert into public.reibi_internal_sessions (id, auth_user_id, expires_at)
values (
  '73100000-0000-0000-0000-000000000001',
  '73000000-0000-0000-0000-000000000001',
  now() + interval '30 minutes'
);

select lives_ok(
  $$select public.reibi_enable_mfa('73000000-0000-0000-0000-000000000001')$$,
  'verified identity can enable MFA atomically'
);
select is(
  (select mfa_required from public.reibi_internal_users where email = 'mfa-self@example.test'),
  true,
  'identity requires MFA after completion'
);
select is(
  (select revoked_reason from public.reibi_internal_sessions where id = '73100000-0000-0000-0000-000000000001'),
  'mfa_enabled',
  'existing application sessions are revoked'
);
select is(
  (select action from public.reibi_identity_audit where target_auth_user_id = '73000000-0000-0000-0000-000000000001' order by id desc limit 1),
  'update',
  'MFA enablement is audited'
);
select is(
  (select changes ->> 'source' from public.reibi_identity_audit where target_auth_user_id = '73000000-0000-0000-0000-000000000001' order by id desc limit 1),
  'self_enrollment',
  'audit identifies self enrollment'
);

select * from finish();
rollback;
