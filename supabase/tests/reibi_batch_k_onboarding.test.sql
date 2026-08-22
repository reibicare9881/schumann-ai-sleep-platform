begin;

-- 這個檔案原本以 `raise exception` 做斷言、沒有 pgTAP plan，pg_prove 因此回報
-- "No plan found in TAP output" 並讓整個 `supabase test db` 以 FAIL 收場，
-- 無法當成驗收關卡使用。改寫成正規 pgTAP，斷言內容維持不變。

select plan(11);

-- 新案開通 transaction 只授權後端 service_role
select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'public.reibi_open_enterprise_case(jsonb,jsonb,jsonb,text)',
    'EXECUTE'
  ),
  'authenticated 不可執行新案開通 transaction'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.reibi_open_enterprise_case(jsonb,jsonb,jsonb,text)',
    'EXECUTE'
  ),
  'anon 不可執行新案開通 transaction'
);

select ok(
  pg_catalog.has_function_privilege(
    'service_role',
    'public.reibi_open_enterprise_case(jsonb,jsonb,jsonb,text)',
    'EXECUTE'
  ),
  'service_role 可執行新案開通 transaction'
);

set local role service_role;

select lives_ok(
  $$select public.reibi_open_enterprise_case(
      '{"org_name":"Migration Test Co","org_alias":"MTST","admin_email":"admin@example.test","member_limit":10,"plan_code":"basic"}'::jsonb,
      '[{"label":"HQ","address":"Taipei"}]'::jsonb,
      '{}'::jsonb,
      'batch-k-test'
    )$$,
  '單一 transaction 建立企業、場域與案件'
);

select is(
  (select count(*) from public.reibi_enterprises where org_name = 'Migration Test Co'),
  1::bigint,
  '企業於 transaction 內建立一筆'
);

select is(
  (select count(*) from public.reibi_onboarding_cases where created_by = 'batch-k-test'),
  1::bigint,
  '開通案件於 transaction 內建立一筆'
);

select is(
  (
    select count(*)
    from public.reibi_enterprise_sites s
    join public.reibi_enterprises e on e.id = s.enterprise_id
    where e.org_name = 'Migration Test Co'
  ),
  1::bigint,
  '場域於同一 transaction 內建立'
);

-- 流水號不寫死：sequence 不隨 rollback 回退，硬編 000001 只在重置後第一次執行成立，
-- 之後每一次重跑都會誤判成同步失敗。改為比對實際產生的 org_code。
select is(
  (
    select count(*)
    from public.organizations o
    join public.reibi_enterprises e on e.org_code = o.org_code
    where e.org_name = 'Migration Test Co'
  ),
  1::bigint,
  '新案企業同步至主平台 organizations'
);

select matches(
  (select org_code from public.reibi_enterprises where org_name = 'Migration Test Co'),
  '^ORG-MTST-[0-9]{2}-[0-9]{6}$',
  '企業代碼採用 ORG-<別名>-<年>-<流水號> 格式'
);

-- 舊版三個 NOT NULL PIN 欄位只保存彼此獨立的隨機 bcrypt placeholder，
-- 明文從未保存，也不恢復共用 PIN。
select ok(
  not exists (
    select 1
    from public.organizations
    where org_code in (
        select org_code from public.reibi_enterprises where org_name = 'Migration Test Co'
      )
      and (
        member_pin !~ '^\$2[aby]\$12\$'
        or dept_pin !~ '^\$2[aby]\$12\$'
        or admin_pin !~ '^\$2[aby]\$12\$'
      )
  ),
  '三個 PIN 欄位都是 cost 12 的 bcrypt 雜湊'
);

select ok(
  not exists (
    select 1
    from public.organizations
    where org_code in (
        select org_code from public.reibi_enterprises where org_name = 'Migration Test Co'
      )
      and (
        member_pin = dept_pin
        or member_pin = admin_pin
        or dept_pin = admin_pin
      )
  ),
  '三個 PIN placeholder 彼此獨立，不是共用 PIN'
);

reset role;

select * from finish();

rollback;
