begin;

-- 單一企業健康彙整的同意過濾。
--
-- k>=5 抑制與「本人同意」是兩層獨立保護：即使樣本夠大，沒有同意的評估也不該
-- 被計入；即使全部同意，樣本不足 5 仍須抑制。

select plan(13);

-- ── 欄位與預設值 ─────────────────────────────────────────────────────────────
select has_column('public', 'sleep_reports', 'consent_org_aggregate',
  'sleep_reports 具備組織彙整同意欄位');

select col_not_null('public', 'sleep_reports', 'consent_org_aggregate',
  '同意欄位不可為 NULL，避免出現「未知是否同意」的第三種狀態');

select col_default_is('public', 'sleep_reports', 'consent_org_aggregate', 'false',
  '預設不同意：沒有明確勾選就不進組織彙整');

select col_not_null('public', 'reibi_health_assessments', 'consent_org_aggregate',
  'REIBI 量表的同意欄位維持 NOT NULL');

set local role service_role;

-- ── 測試資料：同一企業 6 人，其中 5 人同意 ───────────────────────────────────
insert into public.organizations (org_code, org_name, member_pin, dept_pin, admin_pin)
values ('CONSENTCO', '同意測試公司',
        '$2b$12$consenttestmemberplaceholderhashxxxxxxxxxxxxxxxxxxxxx',
        '$2b$12$consenttestdeptplaceholderhashxxxxxxxxxxxxxxxxxxxxxxx',
        '$2b$12$consenttestadminplaceholderhashxxxxxxxxxxxxxxxxxxxxxx');

insert into public.profiles (id, full_name, org_code, department)
select ('00000000-0000-4000-8000-00000000000' || n)::uuid,
       '測試員工' || n, 'CONSENTCO', '測試部門'
from generate_series(1, 6) as n;

-- 6 人都做了評估，但只有前 5 人同意納入組織彙整
insert into public.sleep_reports
  (id, user_id, org_code, platform, sleep_score, sleep_level,
   pain_score, pain_level, work_score, consent_org_aggregate)
select gen_random_uuid(),
       ('00000000-0000-4000-8000-00000000000' || n)::uuid,
       'CONSENTCO', 'sleep', 5, 'green', 4, 'green', 3,
       n <= 5
from generate_series(1, 6) as n;

-- ── 只有同意者被計入 ─────────────────────────────────────────────────────────
select is(
  (public.reibi_org_health_snapshot('CONSENTCO') -> 'sample_size')::int,
  5,
  '樣本數只計入 5 位同意者，未同意的第 6 人被排除'
);

select is(
  (public.reibi_org_health_snapshot('CONSENTCO') ->> 'suppressed')::boolean,
  false,
  '同意人數達 5 時不抑制'
);

select is(
  (public.reibi_org_health_snapshot('CONSENTCO') #>> '{metrics,sleep,sample_size}')::int,
  5,
  '睡眠指標樣本數同樣只含同意者'
);

-- ── 同意人數不足 5 時仍須抑制 ────────────────────────────────────────────────
update public.sleep_reports
   set consent_org_aggregate = false
 where org_code = 'CONSENTCO'
   and user_id = '00000000-0000-4000-8000-000000000005'::uuid;

select is(
  (public.reibi_org_health_snapshot('CONSENTCO') -> 'sample_size')::int,
  4,
  '撤回一位同意後樣本數降為 4'
);

select is(
  (public.reibi_org_health_snapshot('CONSENTCO') ->> 'suppressed')::boolean,
  true,
  '同意人數不足 5 時抑制，k>=5 保護未被同意機制取代'
);

select is(
  public.reibi_org_health_snapshot('CONSENTCO') -> 'metrics',
  'null'::jsonb,
  '抑制時不回傳任何指標'
);

-- ── 全部撤回同意 ─────────────────────────────────────────────────────────────
update public.sleep_reports set consent_org_aggregate = false where org_code = 'CONSENTCO';

select is(
  (public.reibi_org_health_snapshot('CONSENTCO') -> 'sample_size')::int,
  0,
  '全部撤回同意後組織彙整看不到任何人'
);

-- ── REIBI 量表同樣受同意約束 ─────────────────────────────────────────────────
insert into public.reibi_health_assessments
  (profile_id, org_code, assessment_type, score, level_code, assessed_at, consent_org_aggregate)
select ('00000000-0000-4000-8000-00000000000' || n)::uuid,
       'CONSENTCO', 'phq4', 2, 'green', now(), false
from generate_series(1, 6) as n;

select is(
  (public.reibi_org_health_snapshot('CONSENTCO') -> 'sample_size')::int,
  0,
  '未同意的心理量表也不進組織彙整，與睡眠資料對稱'
);

update public.reibi_health_assessments
   set consent_org_aggregate = true
 where org_code = 'CONSENTCO';

select is(
  (public.reibi_org_health_snapshot('CONSENTCO') -> 'sample_size')::int,
  6,
  '心理量表同意後即納入彙整'
);

reset role;

select * from finish();

rollback;
