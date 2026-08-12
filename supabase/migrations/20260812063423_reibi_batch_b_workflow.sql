-- Batch B: concurrency-safe document numbers and atomic quote conversion.
-- These helpers are intentionally callable only by the backend service role.

create sequence if not exists public.reibi_quote_doc_seq;
create sequence if not exists public.reibi_contract_doc_seq;
create sequence if not exists public.reibi_work_order_doc_seq;

revoke all on sequence public.reibi_quote_doc_seq from public, anon, authenticated;
revoke all on sequence public.reibi_contract_doc_seq from public, anon, authenticated;
revoke all on sequence public.reibi_work_order_doc_seq from public, anon, authenticated;
grant usage, select on sequence public.reibi_quote_doc_seq to service_role;
grant usage, select on sequence public.reibi_contract_doc_seq to service_role;
grant usage, select on sequence public.reibi_work_order_doc_seq to service_role;

create or replace function public.reibi_next_document_no(
  p_kind text,
  p_doc_type text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefix text;
  v_sequence bigint;
begin
  case p_kind
    when 'quote' then
      v_prefix := case p_doc_type
        when '經銷商報價' then 'QT-P'
        when '升級報價' then 'QT-UP'
        when '續約報價' then 'QT-RN'
        else 'QT'
      end;
      v_sequence := nextval('public.reibi_quote_doc_seq'::regclass);
    when 'contract' then
      v_prefix := case p_doc_type
        when '經銷商合約' then 'CT-P'
        when '續約合約' then 'CT-RN'
        when '補充合約' then 'CT-AD'
        else 'CT'
      end;
      v_sequence := nextval('public.reibi_contract_doc_seq'::regclass);
    when 'work_order' then
      v_prefix := 'WO-D';
      v_sequence := nextval('public.reibi_work_order_doc_seq'::regclass);
    else
      raise exception using errcode = '22023', message = 'unsupported REIBI document kind';
  end case;

  return v_prefix || '-' || to_char(pg_catalog.clock_timestamp(), 'YYMM') || '-' ||
    lpad(v_sequence::text, 6, '0');
end;
$$;

revoke all on function public.reibi_next_document_no(text, text) from public, anon, authenticated;
grant execute on function public.reibi_next_document_no(text, text) to service_role;

create or replace function public.reibi_convert_quote_to_contract(
  p_enterprise_id bigint,
  p_quote_id bigint,
  p_contract_type text,
  p_created_by text,
  p_terms jsonb default '{}'::jsonb
)
returns public.reibi_contracts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.reibi_quotes%rowtype;
  v_contract public.reibi_contracts%rowtype;
  v_doc_no text;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  select *
    into v_quote
    from public.reibi_quotes
   where id = p_quote_id
     and enterprise_id = p_enterprise_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'quote not found in enterprise';
  end if;

  if v_quote.status not in ('已確認', 'confirmed') then
    raise exception using errcode = '23514', message = 'only confirmed quotes can be converted';
  end if;

  if v_quote.linked_contract_no is not null or exists (
    select 1 from public.reibi_contracts where quote_id = v_quote.id
  ) then
    raise exception using errcode = '23505', message = 'quote has already been converted';
  end if;

  v_doc_no := public.reibi_next_document_no('contract', p_contract_type);

  insert into public.reibi_contracts (
    doc_no, contract_type, status, quote_id, enterprise_id, from_quote_no,
    client_name, contract_start, contract_end, total_year_fee,
    total_contract_fee, terms, source_payload, created_by, created_at, updated_at
  ) values (
    v_doc_no, p_contract_type, '草稿(合約)', v_quote.id, v_quote.enterprise_id,
    v_quote.doc_no, v_quote.client_name, v_quote.contract_start, v_quote.contract_end,
    v_quote.total_year_fee, v_quote.total_contract_fee,
    pg_catalog.jsonb_build_object(
      'quote_snapshot', pg_catalog.to_jsonb(v_quote),
      'contract_terms', coalesce(p_terms, '{}'::jsonb),
      'snapshot_created_at', v_now
    ),
    '{}'::jsonb, p_created_by, v_now, v_now
  )
  returning * into v_contract;

  update public.reibi_quotes
     set status = '已轉合約',
         linked_contract_no = v_doc_no,
         versions = coalesce(versions, '[]'::jsonb) || pg_catalog.jsonb_build_array(
           pg_catalog.jsonb_build_object(
             'savedAt', v_now,
             'status', '已轉合約',
             'by', p_created_by,
             'linkedContractNo', v_doc_no
           )
         ),
         updated_at = v_now
   where id = v_quote.id;

  return v_contract;
end;
$$;

revoke all on function public.reibi_convert_quote_to_contract(bigint, bigint, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.reibi_convert_quote_to_contract(bigint, bigint, text, text, jsonb)
  to service_role;
