-- Enforce the Artifact's per-layer REIBI retention guard at the database
-- boundary as well as in FastAPI. This prevents privileged maintenance clients
-- from writing a commission override above the configured cap.
create or replace function public.reibi_enforce_commission_retain_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cap numeric(5,2);
begin
  select 100 - min_reibi_retain_percent into v_cap
  from public.reibi_finance_settings where id = 1;
  if new.commission_a_percent > v_cap
     or new.commission_b_percent > v_cap
     or new.commission_c_percent > v_cap then
    raise exception '經銷商單層分潤比例不可超過 %', v_cap;
  end if;
  return new;
end;
$$;

create trigger reibi_distributors_commission_guard
before insert or update of commission_a_percent, commission_b_percent, commission_c_percent
on public.reibi_distributors
for each row execute function public.reibi_enforce_commission_retain_guard();

revoke all on function public.reibi_enforce_commission_retain_guard()
  from public, anon, authenticated;
