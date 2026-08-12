begin;

select plan(8);

select ok(
  public.reibi_next_document_no('quote', '新簽報價') ~ '^QT-[0-9]{4}-[0-9]{6}$',
  'quote document numbers use the expected concurrency-safe format'
);

select ok(
  public.reibi_next_document_no('contract', '續約合約') ~ '^CT-RN-[0-9]{4}-[0-9]{6}$',
  'contract document type selects the expected prefix'
);

select ok(
  public.reibi_next_document_no('work_order', null) ~ '^WO-D-[0-9]{4}-[0-9]{6}$',
  'work order document numbers use the expected prefix'
);

select is(
  has_function_privilege('anon', 'public.reibi_next_document_no(text,text)', 'EXECUTE'),
  false,
  'browser anon role cannot generate document numbers'
);

insert into public.reibi_enterprises (org_code, org_name)
values ('BATCH-B-TEST', 'Batch B Test Enterprise');

insert into public.reibi_quotes (
  doc_no, doc_type, status, enterprise_id, client_name,
  total_year_fee, total_contract_fee, config
)
select
  'QT-BATCH-B-TEST', '新簽報價', '已確認', id, org_name,
  600000, 1800000, '{"dItems":{"poster":true}}'::jsonb
from public.reibi_enterprises
where org_code = 'BATCH-B-TEST';

select lives_ok(
  $$select public.reibi_convert_quote_to_contract(
      (select id from public.reibi_enterprises where org_code = 'BATCH-B-TEST'),
      (select id from public.reibi_quotes where doc_no = 'QT-BATCH-B-TEST'),
      '企業合約',
      'pgTAP',
      '{"execution":{"signed":false}}'::jsonb
    )$$,
  'confirmed quote converts atomically'
);

select is(
  (select count(*)::integer from public.reibi_contracts where from_quote_no = 'QT-BATCH-B-TEST'),
  1,
  'conversion creates exactly one contract'
);

select is(
  (select status from public.reibi_quotes where doc_no = 'QT-BATCH-B-TEST'),
  '已轉合約',
  'conversion updates quote lifecycle status'
);

select throws_ok(
  $$select public.reibi_convert_quote_to_contract(
      (select id from public.reibi_enterprises where org_code = 'BATCH-B-TEST'),
      (select id from public.reibi_quotes where doc_no = 'QT-BATCH-B-TEST'),
      '企業合約',
      'pgTAP',
      '{}'::jsonb
    )$$,
  '23514',
  'only confirmed quotes can be converted',
  'the same quote cannot be converted twice'
);

select * from finish();
rollback;
