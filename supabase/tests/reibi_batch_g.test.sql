begin;

select plan(20);

select has_table('public', 'reibi_internal_users', 'internal user allowlist exists');
select has_table('public', 'reibi_internal_sessions', 'revocable internal sessions exist');
select has_table('public', 'reibi_internal_login_audit', 'internal login audit exists');
select has_column('public', 'reibi_artifact_import_batches', 'schema_version', 'import records envelope schema');
select has_column('public', 'reibi_artifact_import_batches', 'exported_at', 'import records export time');
select has_column('public', 'reibi_artifact_import_batches', 'internal_created_by', 'import records trusted internal actor');
select has_column('public', 'reibi_artifact_import_batches', 'retry_of_batch_id', 'import records retry lineage');
select has_index('public', 'reibi_internal_users', 'reibi_internal_users_email_unique', 'internal email allowlist is unique');
select has_index('public', 'reibi_internal_sessions', 'reibi_internal_sessions_user_active_idx', 'active sessions are indexed');
select has_index('public', 'reibi_artifact_import_batches', 'reibi_artifact_import_completed_hash_unique', 'completed export hashes are idempotent');

select is(has_table_privilege('anon', 'public.reibi_internal_users', 'SELECT'), false, 'anon cannot inspect internal users');
select is(has_table_privilege('authenticated', 'public.reibi_internal_users', 'SELECT'), false, 'authenticated cannot inspect internal users');
select is(has_table_privilege('authenticated', 'public.reibi_internal_sessions', 'INSERT'), false, 'authenticated cannot mint internal sessions');
select is(has_table_privilege('authenticated', 'public.reibi_internal_login_audit', 'SELECT'), false, 'authenticated cannot inspect login audit');
select is((select relrowsecurity from pg_class where oid = 'public.reibi_internal_users'::regclass), true, 'internal users enforce RLS');
select is((select relrowsecurity from pg_class where oid = 'public.reibi_internal_sessions'::regclass), true, 'internal sessions enforce RLS');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values ('70000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'batch-g@example.test', 'not-used', now(), '{}'::jsonb, '{}'::jsonb);
insert into public.reibi_internal_users (auth_user_id, email, display_name)
values ('70000000-0000-0000-0000-000000000001', 'batch-g@example.test', 'Batch G Operator');
insert into public.reibi_internal_sessions (id, auth_user_id, expires_at)
values ('71000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', now() + interval '30 minutes');

select is((select internal_role from public.reibi_internal_users where email = 'batch-g@example.test'), 'reibi_super', 'allowlisted account defaults to reibi_super');
select ok((select expires_at > issued_at from public.reibi_internal_sessions where id = '71000000-0000-0000-0000-000000000001'), 'session expiry follows issuance');

update public.reibi_internal_users set is_active = false, deactivated_at = now() where email = 'batch-g@example.test';
select is((select is_active from public.reibi_internal_users where email = 'batch-g@example.test'), false, 'internal account can be deactivated');

select throws_ok(
  $$update public.reibi_internal_users set email = 'UPPER@example.test' where auth_user_id = '70000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'internal emails must be normalized to lowercase'
);

select * from finish();
rollback;
