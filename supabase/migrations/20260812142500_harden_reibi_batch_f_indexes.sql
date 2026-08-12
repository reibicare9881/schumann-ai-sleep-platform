-- Cover Batch F access-request foreign keys used by tenant and requester lookups.
create index reibi_access_requests_enterprise_id_idx
  on public.reibi_access_requests (enterprise_id)
  where enterprise_id is not null;

create index reibi_access_requests_requester_profile_id_idx
  on public.reibi_access_requests (requester_profile_id)
  where requester_profile_id is not null;
