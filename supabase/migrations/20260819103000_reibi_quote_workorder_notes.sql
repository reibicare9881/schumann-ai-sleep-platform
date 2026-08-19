-- 補回四個 Artifact 報價單與工單的備註／明細欄位。
--
-- 盤點結果（docs/reibi-jsx-migration-gap-report.md 的 B1、B2、B4、B5，加上盤點
-- 過程另外發現的 eNote）指出：這些欄位在 Artifact 是實際輸入項，業務會在上面
-- 記錄議價條件與交付範圍，但新資料庫從未建欄位，因此表單即使做出來也無處可存。
--
-- 兩類欄位：
--   1. 備註類（note／b_custom_note／d_note／e_note／global_note／special_terms）：
--      純文字，不參與任何計算。
--   2. C 層拆分（c_fee_base／c_high_risk_fee）：原本只存合併後的 c_layer_fee，
--      看不出「方案費 + 高風險高管加購」的組成。兩個新欄位是明細，
--      c_layer_fee 仍是唯一被計算與分潤引用的權威欄位，維持不變。

alter table public.reibi_quotes
  add column if not exists note text,
  add column if not exists b_custom_note text,
  add column if not exists d_note text,
  add column if not exists e_note text,
  -- 檢查約束寫在欄位定義上，才會跟著 if not exists 一起省略；
  -- Postgres 沒有 add constraint if not exists，分開寫重跑會炸。
  add column if not exists c_fee_base numeric(14,2) not null default 0 check (c_fee_base >= 0),
  add column if not exists c_high_risk_fee numeric(14,2) not null default 0 check (c_high_risk_fee >= 0);

comment on column public.reibi_quotes.note is
  'Artifact QuoteForm 的整體備註；不參與計算。';
comment on column public.reibi_quotes.b_custom_note is
  'B 層設備配置備註（例如客製機型、交期特別約定）。';
comment on column public.reibi_quotes.d_note is
  'D 層環境佈置備註；正式金額仍以場勘後的 d_layer_fee_min／max 為準。';
comment on column public.reibi_quotes.e_note is
  'E 層延保與加值服務備註；僅續約報價適用。';
comment on column public.reibi_quotes.c_fee_base is
  'C 層方案費（未含高風險高管加購、未乘折數）。明細欄位，c_layer_fee 才是權威金額。';
comment on column public.reibi_quotes.c_high_risk_fee is
  'C 層高風險高管加購費（人數 × 14,000，未乘折數）。明細欄位。';

alter table public.reibi_work_orders
  add column if not exists global_note text,
  add column if not exists special_terms text;

comment on column public.reibi_work_orders.global_note is
  'Artifact WorkOrderForm 的整體備註，適用於全部施工項目。';
comment on column public.reibi_work_orders.special_terms is
  '本工單的特殊條款，例如加班費分攤、現場限制、客戶自備材料。';
