begin;

-- 單位通行碼登入節流所依賴的資料表。
--
-- 應用層的節流檢查在讀取失敗時刻意「放行並記錄」，避免節流儲存出問題就把所有單位
-- 使用者擋在門外。代價是這張表若沒建立，防護會安靜地失效 —— 這正是本專案吃過虧的
-- 情境（程式 8/18 上線、migration 8/20 才套用，中間兩天無聲中斷）。所以這裡用結構
-- 測試把它釘住：表在、欄位在、索引在，且瀏覽器端角色拿不到。

select plan(11);

-- ── 資料表與欄位 ─────────────────────────────────────────────────────────────
select has_table('public', 'reibi_org_login_attempts',
  '單位通行碼登入嘗試表存在');

select has_column('public', 'reibi_org_login_attempts', 'org_hash',
  '以 org_hash 計數');

select col_not_null('public', 'reibi_org_login_attempts', 'org_hash',
  'org_hash 不可為 NULL：沒有單位歸屬的紀錄無法用於計數');

select has_column('public', 'reibi_org_login_attempts', 'role',
  '角色分開計數，成員與管理者的失敗次數不互相影響');

select has_column('public', 'reibi_org_login_attempts', 'ip_hash',
  '以 ip_hash 做第一層鎖定');

select col_is_null('public', 'reibi_org_login_attempts', 'ip_hash',
  'ip_hash 允許 NULL：取不到來源位址時仍要能記錄，只是跳過 IP 層');

select col_not_null('public', 'reibi_org_login_attempts', 'succeeded',
  'succeeded 不可為 NULL，否則「是否失敗」會出現第三種狀態');

-- ── 明文外洩防線 ─────────────────────────────────────────────────────────────
select hasnt_column('public', 'reibi_org_login_attempts', 'org_code',
  '不得存單位代碼明文');

select hasnt_column('public', 'reibi_org_login_attempts', 'ip',
  '不得存原始 IP');

-- ── 存取邊界 ─────────────────────────────────────────────────────────────────
select ok(
  (select relrowsecurity from pg_class where oid = 'public.reibi_org_login_attempts'::regclass),
  '啟用 RLS');

select ok(
  not has_table_privilege('anon', 'public.reibi_org_login_attempts', 'select')
  and not has_table_privilege('authenticated', 'public.reibi_org_login_attempts', 'select'),
  '瀏覽器端角色讀不到登入嘗試紀錄');

select * from finish();
rollback;
