-- 單一企業健康彙整改為只納入本人明確同意的評估資料。
--
-- 現況問題：
--   1. reibi_health_assessments.consent_org_aggregate 自 Batch D 建立以來從未被
--      任何程式碼寫入或讀取，是一個死欄位。
--   2. sleep_reports 連這個欄位都沒有。
--   3. reibi_org_health_snapshot 對兩張表都沒有同意過濾，因此員工的睡眠、疼痛、
--      工作影響分數與心理量表結果都會無條件進入企業組織報表。
--
-- 跨企業彙整（reibi_cross_org_health_snapshot）本來就以 profiles.research_opt_in
-- 正確擋住兩張表，本次不更動；這裡補的是單一企業內部那一層。
--
-- 預設 false：沒有明確勾選同意的評估不進入組織彙整。k>=5 的抑制邏輯維持不變，
-- 兩者是獨立的保護，不互相取代。

alter table public.sleep_reports
  add column if not exists consent_org_aggregate boolean not null default false;

comment on column public.sleep_reports.consent_org_aggregate is
  '受測者是否同意本次評估納入所屬企業的組織彙整；預設 false。';

comment on column public.reibi_health_assessments.consent_org_aggregate is
  '受測者是否同意本次評估納入所屬企業的組織彙整；預設 false。';

create index if not exists sleep_reports_org_consent_idx
  on public.sleep_reports (org_code, consent_org_aggregate, created_at desc);

create or replace function public.reibi_org_health_snapshot(
  p_org_code text,
  p_period_start date default null,
  p_period_end date default null,
  p_department_key text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_n integer;
  v_result jsonb;
begin
  with eligible as (
    select sr.user_id as profile_id
    from public.sleep_reports sr
    left join public.profiles p on p.id = sr.user_id
    where sr.org_code = p_org_code
      and sr.consent_org_aggregate
      and (p_period_start is null or sr.created_at >= p_period_start::timestamptz)
      and (p_period_end is null or sr.created_at < (p_period_end + 1)::timestamptz)
      and (p_department_key is null or p.department = p_department_key)
    union
    select ha.profile_id
    from public.reibi_health_assessments ha
    left join public.profiles p on p.id = ha.profile_id
    where ha.org_code = p_org_code and ha.profile_id is not null
      and ha.consent_org_aggregate
      and (p_period_start is null or ha.assessed_at >= p_period_start::timestamptz)
      and (p_period_end is null or ha.assessed_at < (p_period_end + 1)::timestamptz)
      and (p_department_key is null or coalesce(ha.department_key, p.department) = p_department_key)
  )
  select count(distinct profile_id) into v_n from eligible;

  if v_n < 5 then
    return jsonb_build_object(
      'sample_size', v_n, 'suppressed', true, 'metrics', null,
      'period_start', p_period_start, 'period_end', p_period_end,
      'department_key', p_department_key
    );
  end if;

  with latest_reports as (
    select distinct on (sr.user_id)
      sr.user_id, sr.sleep_score, sr.sleep_level, sr.pain_score, sr.pain_level,
      sr.work_score, sr.created_at
    from public.sleep_reports sr
    left join public.profiles p on p.id = sr.user_id
    where sr.org_code = p_org_code
      and sr.consent_org_aggregate
      and (p_period_start is null or sr.created_at >= p_period_start::timestamptz)
      and (p_period_end is null or sr.created_at < (p_period_end + 1)::timestamptz)
      and (p_department_key is null or p.department = p_department_key)
    order by sr.user_id, sr.created_at desc
  ),
  latest_assessments as (
    select distinct on (ha.profile_id, ha.assessment_type)
      ha.profile_id, ha.assessment_type, ha.score, ha.level_code, ha.assessed_at
    from public.reibi_health_assessments ha
    left join public.profiles p on p.id = ha.profile_id
    where ha.org_code = p_org_code and ha.profile_id is not null
      and ha.consent_org_aggregate
      and (p_period_start is null or ha.assessed_at >= p_period_start::timestamptz)
      and (p_period_end is null or ha.assessed_at < (p_period_end + 1)::timestamptz)
      and (p_department_key is null or coalesce(ha.department_key, p.department) = p_department_key)
    order by ha.profile_id, ha.assessment_type, ha.assessed_at desc
  )
  select jsonb_build_object(
    'sample_size', v_n,
    'suppressed', false,
    'period_start', p_period_start,
    'period_end', p_period_end,
    'department_key', p_department_key,
    'metrics', jsonb_build_object(
      'sleep', jsonb_build_object(
        'sample_size', (select count(*) from latest_reports where sleep_score is not null),
        'suppressed', (select count(*) < 5 from latest_reports where sleep_score is not null),
        'average_score', (select case when count(*) >= 5 then round(avg(sleep_score), 1) end from latest_reports where sleep_score is not null),
        'green', (select case when count(*) >= 5 then count(*) filter (where sleep_level = 'green') end from latest_reports where sleep_score is not null),
        'yellow', (select case when count(*) >= 5 then count(*) filter (where sleep_level = 'yellow') end from latest_reports where sleep_score is not null),
        'orange', (select case when count(*) >= 5 then count(*) filter (where sleep_level = 'orange') end from latest_reports where sleep_score is not null),
        'red', (select case when count(*) >= 5 then count(*) filter (where sleep_level = 'red') end from latest_reports where sleep_score is not null)
      ),
      'pain', jsonb_build_object(
        'sample_size', (select count(*) from latest_reports where pain_score is not null),
        'suppressed', (select count(*) < 5 from latest_reports where pain_score is not null),
        'average_score', (select case when count(*) >= 5 then round(avg(pain_score), 1) end from latest_reports where pain_score is not null),
        'green', (select case when count(*) >= 5 then count(*) filter (where pain_level = 'green') end from latest_reports where pain_score is not null),
        'yellow', (select case when count(*) >= 5 then count(*) filter (where pain_level = 'yellow') end from latest_reports where pain_score is not null),
        'orange', (select case when count(*) >= 5 then count(*) filter (where pain_level = 'orange') end from latest_reports where pain_score is not null),
        'red', (select case when count(*) >= 5 then count(*) filter (where pain_level = 'red') end from latest_reports where pain_score is not null)
      ),
      'work', jsonb_build_object(
        'sample_size', (select count(*) from latest_reports where work_score is not null),
        'suppressed', (select count(*) < 5 from latest_reports where work_score is not null),
        'average_score', (select case when count(*) >= 5 then round(avg(work_score), 1) end from latest_reports where work_score is not null)
      ),
      'assessments', jsonb_build_object(
        'phq4_sample_size', (select count(*) from latest_assessments where assessment_type = 'phq4'),
        'phq4_average', (select case when count(*) >= 5 then round(avg(score), 1) end from latest_assessments where assessment_type = 'phq4'),
        'pss4_sample_size', (select count(*) from latest_assessments where assessment_type = 'pss4'),
        'pss4_average', (select case when count(*) >= 5 then round(avg(score), 1) end from latest_assessments where assessment_type = 'pss4'),
        'mind3_sample_size', (select count(*) from latest_assessments where assessment_type = 'mind3'),
        'mind3_average', (select case when count(*) >= 5 then round(avg(score), 1) end from latest_assessments where assessment_type = 'mind3'),
        'overwork_count', (select count(*) from latest_assessments where assessment_type = 'ow'),
        'overwork_high_risk', (select case when count(*) >= 5 then count(*) filter (where level_code in ('orange', 'red')) end from latest_assessments where assessment_type = 'ow'),
        'msk_count', (select count(*) from latest_assessments where assessment_type = 'msk'),
        'bsrs5_count', (select count(*) from latest_assessments where assessment_type = 'bsrs5'),
        'bsrs5_high_risk', (select case when count(*) >= 5 then count(*) filter (where level_code in ('orange', 'red')) end from latest_assessments where assessment_type = 'bsrs5')
      )
    )
  ) into v_result;

  return v_result;
end;
$$;
