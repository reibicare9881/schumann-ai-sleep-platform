begin;

do $$
begin
  if pg_catalog.has_function_privilege(
    'authenticated',
    'public.reibi_open_enterprise_case(jsonb,jsonb,jsonb,text)',
    'EXECUTE'
  ) then
    raise exception 'authenticated must not execute onboarding transaction';
  end if;
  if not pg_catalog.has_function_privilege(
    'service_role',
    'public.reibi_open_enterprise_case(jsonb,jsonb,jsonb,text)',
    'EXECUTE'
  ) then
    raise exception 'service_role must execute onboarding transaction';
  end if;
end;
$$;

set local role service_role;

select public.reibi_open_enterprise_case(
  '{"org_name":"Migration Test Co","org_alias":"MTST","admin_email":"admin@example.test","member_limit":10,"plan_code":"basic"}'::jsonb,
  '[{"label":"HQ","address":"Taipei"}]'::jsonb,
  '{}'::jsonb,
  'batch-k-test'
);

do $$
begin
  if (select count(*) from public.reibi_enterprises where org_name = 'Migration Test Co') <> 1 then
    raise exception 'enterprise transaction insert failed';
  end if;
  if (select count(*) from public.reibi_onboarding_cases where created_by = 'batch-k-test') <> 1 then
    raise exception 'onboarding case transaction insert failed';
  end if;
  if (select count(*) from public.reibi_enterprise_sites s join public.reibi_enterprises e on e.id = s.enterprise_id where e.org_name = 'Migration Test Co') <> 1 then
    raise exception 'site transaction insert failed';
  end if;
end;
$$;

rollback;
