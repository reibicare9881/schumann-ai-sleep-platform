-- Batch H hardening: update identity scope, linked profile, session revocation
-- and audit as one database transaction.

create or replace function public.reibi_admin_update_identity(
  p_target uuid,
  p_actor uuid,
  p_display_name text,
  p_internal_role text,
  p_org_code text,
  p_department_id bigint,
  p_staff_id bigint,
  p_distributor_id bigint,
  p_mfa_required boolean,
  p_is_active boolean,
  p_action text
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_before public.reibi_internal_users%rowtype;
  v_department_name text;
  v_scope_changed boolean;
begin
  select * into v_before
  from public.reibi_internal_users
  where auth_user_id = p_target
  for update;

  if not found then
    raise exception 'identity not found';
  end if;
  if p_actor is null or not exists (
    select 1 from public.reibi_internal_users
    where auth_user_id = p_actor and is_active
  ) then
    raise exception 'active actor identity is required';
  end if;

  if p_department_id is not null then
    select name into v_department_name
    from public.reibi_departments
    where id = p_department_id;
  end if;

  v_scope_changed :=
    v_before.internal_role is distinct from p_internal_role
    or v_before.org_code is distinct from p_org_code
    or v_before.department_id is distinct from p_department_id
    or v_before.distributor_id is distinct from p_distributor_id
    or v_before.is_active is distinct from p_is_active;

  update public.reibi_internal_users
  set display_name = p_display_name,
      internal_role = p_internal_role,
      org_code = p_org_code,
      department_id = p_department_id,
      staff_id = p_staff_id,
      distributor_id = p_distributor_id,
      mfa_required = p_mfa_required,
      is_active = p_is_active,
      deactivated_at = case
        when p_is_active then null
        when v_before.is_active then now()
        else v_before.deactivated_at
      end,
      updated_by = p_actor
  where auth_user_id = p_target;

  if v_before.profile_id is not null then
    update public.profiles
    set full_name = p_display_name,
        system_role = p_internal_role,
        org_code = p_org_code,
        department = v_department_name
    where id = v_before.profile_id;
  end if;

  if v_scope_changed then
    update public.reibi_internal_sessions
    set revoked_at = now(),
        revoked_reason = 'identity_changed',
        revoked_by = p_actor
    where auth_user_id = p_target and revoked_at is null;
  end if;

  insert into public.reibi_identity_audit (
    actor_auth_user_id, target_auth_user_id, action, changes
  ) values (
    p_actor,
    p_target,
    p_action,
    jsonb_build_object(
      'display_name', p_display_name,
      'role', p_internal_role,
      'org_code', p_org_code,
      'department_id', p_department_id,
      'staff_id', p_staff_id,
      'distributor_id', p_distributor_id,
      'mfa_required', p_mfa_required,
      'is_active', p_is_active
    )
  );
end;
$$;

revoke execute on function public.reibi_admin_update_identity(
  uuid, uuid, text, text, text, bigint, bigint, bigint, boolean, boolean, text
) from public, anon, authenticated;
grant execute on function public.reibi_admin_update_identity(
  uuid, uuid, text, text, text, bigint, bigint, bigint, boolean, boolean, text
) to service_role;

comment on function public.reibi_admin_update_identity(
  uuid, uuid, text, text, text, bigint, bigint, bigint, boolean, boolean, text
) is 'Atomically updates a trusted identity, linked profile, active sessions and audit record.';
