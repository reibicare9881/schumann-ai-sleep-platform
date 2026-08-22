-- Keep the REIBI enterprise authority and the legacy platform organization
-- identity scope in sync. Legacy PIN columns remain NOT NULL, but new Auth-
-- based organizations receive independent random bcrypt hashes whose source
-- values are never returned or stored. They therefore cannot act as shared
-- credentials.

create or replace function public.reibi_sync_platform_organization()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.enterprise_type <> 'enterprise' then
    return new;
  end if;

  insert into public.organizations (
    org_code,
    org_name,
    member_pin,
    dept_pin,
    admin_pin
  ) values (
    new.org_code,
    new.org_name,
    extensions.crypt(pg_catalog.gen_random_uuid()::text, extensions.gen_salt('bf', 12)),
    extensions.crypt(pg_catalog.gen_random_uuid()::text, extensions.gen_salt('bf', 12)),
    extensions.crypt(pg_catalog.gen_random_uuid()::text, extensions.gen_salt('bf', 12))
  )
  on conflict (org_code) do update
    set org_name = excluded.org_name;

  return new;
end;
$$;

revoke all on function public.reibi_sync_platform_organization()
  from public, anon, authenticated;

drop trigger if exists reibi_enterprises_sync_platform_org
  on public.reibi_enterprises;

create trigger reibi_enterprises_sync_platform_org
after insert or update of org_name
on public.reibi_enterprises
for each row
execute function public.reibi_sync_platform_organization();

-- Backfill enterprises created before the trigger existed. Existing platform
-- organizations retain their current PIN hashes; only their display name is
-- aligned with the authoritative REIBI enterprise row.
insert into public.organizations (
  org_code,
  org_name,
  member_pin,
  dept_pin,
  admin_pin
)
select
  enterprise.org_code,
  enterprise.org_name,
  extensions.crypt(pg_catalog.gen_random_uuid()::text, extensions.gen_salt('bf', 12)),
  extensions.crypt(pg_catalog.gen_random_uuid()::text, extensions.gen_salt('bf', 12)),
  extensions.crypt(pg_catalog.gen_random_uuid()::text, extensions.gen_salt('bf', 12))
from public.reibi_enterprises as enterprise
where enterprise.enterprise_type = 'enterprise'
on conflict (org_code) do update
  set org_name = excluded.org_name;
