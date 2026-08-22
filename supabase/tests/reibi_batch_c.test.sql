begin;

select plan(10);

select is(
  (select min_reibi_retain_percent from public.reibi_finance_settings where id = 1),
  65.00::numeric,
  'REIBI retention guard defaults to 65 percent'
);

select is(
  has_table_privilege('anon', 'public.reibi_payment_schedules', 'SELECT'),
  false,
  'browser anon role cannot read payment schedules'
);

select is(
  has_function_privilege('anon', 'public.reibi_reconcile_remittance(bigint,bigint[],numeric,text,text)', 'EXECUTE'),
  false,
  'browser anon role cannot reconcile remittances'
);

insert into public.reibi_enterprises (org_code, org_name, partner_code)
values ('BATCH-C-TEST', 'Batch C Test Enterprise', 'DIST-C-TEST');

insert into public.reibi_distributors (
  org_code, distributor_type, name, level_code, commission_a_percent
) values ('DIST-C-TEST', 'primary', 'Batch C Distributor', 'silver', 35);

select throws_ok(
  $$update public.reibi_distributors
    set commission_a_percent = 36
    where org_code = 'DIST-C-TEST'$$,
  'P0001',
  '經銷商單層分潤比例不可超過 35.00',
  'database guard rejects per-layer commission above the configured cap'
);

insert into public.reibi_payment_schedules (
  enterprise_id, installment_code, layer_code, description, amount, due_date, status
)
select id, 'A1', 'A', 'First annual software fee', 600000, current_date, '待付款'
from public.reibi_enterprises where org_code = 'BATCH-C-TEST';

insert into public.reibi_remittances (
  enterprise_id, org_code, corrected_name, amount, status, submitted_at
)
select id, org_code, org_name, 600000, '待審核', now()
from public.reibi_enterprises where org_code = 'BATCH-C-TEST';

select lives_ok(
  $$select public.reibi_reconcile_remittance(
      (select id from public.reibi_remittances where org_code = 'BATCH-C-TEST'),
      array[(select id from public.reibi_payment_schedules
             where enterprise_id = (select id from public.reibi_enterprises where org_code = 'BATCH-C-TEST'))],
      600000,
      'pgTAP',
      'full allocation'
    )$$,
  'remittance allocation completes atomically'
);

select is(
  (select status from public.reibi_payment_schedules
   where enterprise_id = (select id from public.reibi_enterprises where org_code = 'BATCH-C-TEST')),
  '已付款',
  'full allocation marks the schedule paid'
);

select is(
  (select paid_amount from public.reibi_payment_schedules
   where enterprise_id = (select id from public.reibi_enterprises where org_code = 'BATCH-C-TEST')),
  600000.00::numeric,
  'full allocation records the paid amount'
);

select is(
  (select status from public.reibi_remittances where org_code = 'BATCH-C-TEST'),
  '已沖帳',
  'matching remittance and due total is marked reconciled'
);

select is(
  (select count(*)::integer from public.reibi_remittance_allocations),
  1,
  'reconciliation creates one immutable allocation row'
);

select throws_ok(
  $$insert into public.reibi_payment_schedules (
      enterprise_id, installment_code, layer_code, description, amount, paid_amount, status
    ) select id, 'INVALID', 'A', 'invalid', 100, 101, '部分付款'
      from public.reibi_enterprises where org_code = 'BATCH-C-TEST'$$,
  '23514',
  null,
  'paid amount cannot exceed the schedule amount'
);

select * from finish();
rollback;
