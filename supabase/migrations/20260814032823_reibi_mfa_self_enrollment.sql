-- Enable MFA only after Supabase has verified the user's TOTP factor. The
-- FastAPI service calls this transaction with service_role after receiving an
-- AAL2 session from challenge_and_verify. Existing application sessions are
-- revoked so the next REIBI login must complete the second factor.

create or replace function public.reibi_enable_mfa(p_target uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_identity public.reibi_internal_users%rowtype;
begin
  select * into v_identity
  from public.reibi_internal_users
  where auth_user_id = p_target
  for update;

  if not found or not v_identity.is_active then
    raise exception 'active identity not found';
  end if;

  update public.reibi_internal_users
  set mfa_required = true,
      updated_at = now(),
      updated_by = p_target
  where auth_user_id = p_target;

  update public.reibi_internal_sessions
  set revoked_at = now(),
      revoked_reason = 'mfa_enabled',
      revoked_by = p_target
  where auth_user_id = p_target
    and revoked_at is null;

  insert into public.reibi_identity_audit (
    actor_auth_user_id, target_auth_user_id, action, changes
  ) values (
    p_target,
    p_target,
    'update',
    jsonb_build_object('mfa_required', true, 'source', 'self_enrollment')
  );
end;
$$;

revoke execute on function public.reibi_enable_mfa(uuid)
from public, anon, authenticated;
grant execute on function public.reibi_enable_mfa(uuid)
to service_role;

comment on function public.reibi_enable_mfa(uuid) is
  'Atomically requires MFA, revokes AAL1 application sessions and records self-enrollment after FastAPI verifies AAL2.';
