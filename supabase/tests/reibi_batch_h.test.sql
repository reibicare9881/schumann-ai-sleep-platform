begin;

select plan(32);

select has_table('public', 'reibi_identity_audit', 'identity administration audit exists');
select has_column('public', 'reibi_internal_users', 'profile_id', 'identity links the platform profile');
select has_column('public', 'reibi_internal_users', 'org_code', 'identity stores an organization scope');
select has_column('public', 'reibi_internal_users', 'department_id', 'identity stores a department scope');
select has_column('public', 'reibi_internal_users', 'distributor_id', 'identity stores a distributor scope');
select has_column('public', 'reibi_internal_users', 'permission_overrides', 'identity supports explicit permission additions');
select has_column('public', 'reibi_internal_sessions', 'revoked_by', 'session revocation records the actor');
select has_index('public', 'reibi_internal_users', 'reibi_internal_users_org_role_active_idx', 'organization role lookup is indexed');
select has_index('public', 'reibi_internal_users', 'reibi_internal_users_department_idx', 'department foreign key is indexed');
select has_index('public', 'reibi_internal_users', 'reibi_internal_users_distributor_role_uidx', 'partner role binding is unique');
select is(has_table_privilege('anon', 'public.reibi_identity_audit', 'SELECT'), false, 'anon cannot inspect identity audit');
select is(has_table_privilege('authenticated', 'public.reibi_identity_audit', 'INSERT'), false, 'authenticated cannot forge identity audit');
select is((select relrowsecurity from pg_class where oid = 'public.reibi_identity_audit'::regclass), true, 'identity audit enforces RLS');
select has_function('public', 'reibi_admin_update_identity', 'atomic identity update function exists');
select is(has_function_privilege('authenticated', 'public.reibi_admin_update_identity(uuid,uuid,text,text,text,bigint,bigint,bigint,boolean,boolean,text)', 'EXECUTE'), false, 'authenticated cannot call identity update RPC');
select is(has_function_privilege('service_role', 'public.reibi_admin_update_identity(uuid,uuid,text,text,text,bigint,bigint,bigint,boolean,boolean,text)', 'EXECUTE'), true, 'service role can call identity update RPC');

insert into public.organizations (org_code, org_name, member_pin, dept_pin, admin_pin)
values ('IAMTEST', 'IAM Test Organization', 'x', 'x', 'x');
insert into public.reibi_enterprises (org_code, org_name, status)
values ('IAMTEST', 'IAM Test Organization', 'active');
insert into public.reibi_departments (enterprise_id, artifact_key, name, hierarchy_level)
select id, 'iam-dept', 'Health', 1 from public.reibi_enterprises where org_code = 'IAMTEST';

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('72000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'member-h@example.test', 'not-used', now(), '{}'::jsonb, '{}'::jsonb),
  ('72000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'finance-h@example.test', 'not-used', now(), '{}'::jsonb, '{}'::jsonb),
  ('72000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'invalid-h@example.test', 'not-used', now(), '{}'::jsonb, '{}'::jsonb);
insert into public.profiles (id, full_name, system_role, org_code, department)
values ('72000000-0000-0000-0000-000000000001', 'Member H', 'member', 'IAMTEST', 'Health');

insert into public.reibi_internal_users (
  auth_user_id, email, display_name, internal_role, profile_id, org_code, department_id
)
select
  '72000000-0000-0000-0000-000000000001', 'member-h@example.test', 'Member H', 'member',
  '72000000-0000-0000-0000-000000000001', 'IAMTEST', id
from public.reibi_departments where artifact_key = 'iam-dept';

insert into public.reibi_internal_users (auth_user_id, email, display_name, internal_role, mfa_required)
values ('72000000-0000-0000-0000-000000000002', 'finance-h@example.test', 'Finance H', 'reibi_finance', true);

select is((select internal_role from public.reibi_internal_users where email = 'member-h@example.test'), 'member', 'organization member role is accepted');
select is((select org_code from public.reibi_internal_users where email = 'member-h@example.test'), 'IAMTEST', 'organization scope is stored');
select ok((select department_id is not null from public.reibi_internal_users where email = 'member-h@example.test'), 'required department scope is stored');
select is((select internal_role from public.reibi_internal_users where email = 'finance-h@example.test'), 'reibi_finance', 'L5 finance role is accepted');
select is((select mfa_required from public.reibi_internal_users where email = 'finance-h@example.test'), true, 'MFA requirement is stored');

select throws_ok(
  $$insert into public.reibi_internal_users (auth_user_id, email, display_name, internal_role, org_code)
    values ('72000000-0000-0000-0000-000000000003', 'invalid-h@example.test', 'Invalid H', 'member', 'IAMTEST')$$,
  '23514', null, 'department-required roles cannot omit department'
);
select throws_ok(
  $$update public.reibi_internal_users set internal_role = 'invented_role'
    where auth_user_id = '72000000-0000-0000-0000-000000000002'$$,
  '23514', null, 'unknown roles are rejected'
);
select throws_ok(
  $$update public.reibi_internal_users set permission_overrides = '{}'::jsonb
    where auth_user_id = '72000000-0000-0000-0000-000000000002'$$,
  '23514', null, 'permission overrides must be an array'
);

insert into public.reibi_internal_sessions (id, auth_user_id, expires_at)
values ('72100000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', now() + interval '30 minutes');
select lives_ok(
  $$select public.reibi_admin_update_identity(
    '72000000-0000-0000-0000-000000000001',
    '72000000-0000-0000-0000-000000000002',
    'Department Head H',
    'dept_head',
    'IAMTEST',
    (select id from public.reibi_departments where artifact_key = 'iam-dept'),
    null, null, false, true, 'update'
  )$$,
  'identity update transaction succeeds for a same-realm role change'
);
select is((select internal_role from public.reibi_internal_users where email = 'member-h@example.test'), 'dept_head', 'identity role changes atomically');
select is((select system_role from public.profiles where id = '72000000-0000-0000-0000-000000000001'), 'dept_head', 'linked profile role changes atomically');
select ok((select revoked_at is not null from public.reibi_internal_sessions where id = '72100000-0000-0000-0000-000000000001'), 'role change revokes active sessions');
select is((select action from public.reibi_identity_audit order by id desc limit 1), 'update', 'transaction records identity audit');

insert into public.reibi_identity_audit (actor_auth_user_id, target_auth_user_id, action, changes)
values (
  '72000000-0000-0000-0000-000000000002',
  '72000000-0000-0000-0000-000000000001',
  'update',
  '{"role":"member"}'::jsonb
);
select is((select action from public.reibi_identity_audit order by id desc limit 1), 'update', 'identity changes are audited');
select throws_ok(
  $$insert into public.reibi_identity_audit (action, changes) values ('unknown', '{}'::jsonb)$$,
  '23514', null, 'unknown audit actions are rejected'
);
select throws_ok(
  $$insert into public.reibi_identity_audit (action, changes) values ('update', '[]'::jsonb)$$,
  '23514', null, 'audit changes must be an object'
);

select * from finish();
rollback;
