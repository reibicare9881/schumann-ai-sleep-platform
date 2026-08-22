begin;

select plan(23);

select has_table('public', 'reibi_announcements', 'announcements table exists');
select has_table('public', 'reibi_announcement_registrations', 'announcement registrations table exists');
select has_table('public', 'reibi_access_requests', 'access requests table exists');
select has_column('public', 'reibi_remittances', 'ocr_status', 'remittances track OCR status');
select has_column('public', 'reibi_message_logs', 'delivery_mode', 'message logs track delivery mode');
select has_column('public', 'appointments', 'service_site_id', 'appointments support a service site');
select has_index('public', 'reibi_access_requests', 'reibi_access_requests_enterprise_id_idx', 'access request enterprise foreign key is indexed');
select has_index('public', 'reibi_access_requests', 'reibi_access_requests_requester_profile_id_idx', 'access request requester foreign key is indexed');

select is(has_table_privilege('anon', 'public.reibi_announcements', 'SELECT'), false, 'anon cannot read announcements directly');
select is(has_table_privilege('authenticated', 'public.reibi_announcements', 'SELECT'), false, 'authenticated cannot read announcements directly');
select is(has_table_privilege('authenticated', 'public.reibi_access_requests', 'INSERT'), false, 'authenticated cannot bypass FastAPI for access requests');
select is(has_function_privilege('authenticated', 'public.reibi_replace_departments(bigint,jsonb)', 'EXECUTE'), false, 'authenticated cannot replace departments');
select is(has_function_privilege('authenticated', 'public.reibi_register_announcement(bigint,uuid)', 'EXECUTE'), false, 'authenticated cannot invoke registration RPC directly');
select is((select relrowsecurity from pg_class where oid = 'public.reibi_announcements'::regclass), true, 'announcements enforce RLS');
select is((select relrowsecurity from pg_class where oid = 'public.reibi_access_requests'::regclass), true, 'access requests enforce RLS');

insert into public.organizations (org_code, org_name, member_pin, dept_pin, admin_pin)
values ('BATCH-F-TEST', 'Batch F Test', 'disabled', 'disabled', 'disabled');
insert into public.reibi_enterprises (org_code, org_name) values ('BATCH-F-TEST', 'Batch F Test') returning id \gset enterprise_

select is(
  public.reibi_replace_departments(
    :enterprise_id,
    '[{"name":"總公司","level":1,"parent_name":null,"declared_count":10,"sort_order":0},{"name":"人資部","level":2,"parent_name":"總公司","declared_count":5,"sort_order":1}]'::jsonb
  ), 2, 'department import inserts every row atomically'
);
select is((select count(*)::integer from public.reibi_departments where enterprise_id = :enterprise_id), 2, 'department import row count is correct');
select is((select hierarchy_level::integer from public.reibi_departments where enterprise_id = :enterprise_id and name = '人資部'), 2, 'department level is preserved');
select ok((select parent_id is not null from public.reibi_departments where enterprise_id = :enterprise_id and name = '人資部'), 'department parent is resolved by name');
select throws_ok(
  format('select public.reibi_replace_departments(%s, %L::jsonb)', :enterprise_id,
    '[{"name":"孤兒","level":2,"parent_name":"不存在","declared_count":0,"sort_order":0}]'),
  'P0001', 'parent department not found: 不存在', 'invalid import is rejected'
);
select is((select count(*)::integer from public.reibi_departments where enterprise_id = :enterprise_id), 2, 'failed import rolls back and keeps original departments');

insert into public.profiles (id, full_name, system_role, org_code)
values ('f0000000-0000-0000-0000-000000000001', 'Batch F User', 'member', 'BATCH-F-TEST');
insert into public.reibi_announcements (enterprise_id, title, body, quota, status)
values (:enterprise_id, '測試公告', '測試內容', 1, 'published') returning id \gset announcement_

select lives_ok(
  format('select public.reibi_register_announcement(%s, %L::uuid)', :announcement_id, 'f0000000-0000-0000-0000-000000000001'),
  'first registration succeeds'
);
select is((select status from public.reibi_announcement_registrations where announcement_id = :announcement_id), 'registered', 'registration status is recorded');

select * from finish();
rollback;
