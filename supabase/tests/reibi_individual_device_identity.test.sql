begin;

-- 個人模式的裝置綁定身分所依賴的結構。
--
-- 這個欄位在登入路徑上被讀取，因此與登入節流那張表的失效模式不同：節流表不存在時
-- 應用層設計為放行（防護靜默失效），這個欄位不存在時個人登入會直接失敗。結構測試
-- 因此更要緊 —— 它是「migration 沒套用」在部署前被抓到的唯一機會。

select plan(6);

select has_column('public', 'profiles', 'device_token_hash',
  'profiles 具備裝置 token 雜湊欄位');

select col_is_null('public', 'profiles', 'device_token_hash',
  '允許 NULL：組織角色與改動前建立的帳號都沒有這個值');

-- 一組 token 只能對應一個帳號，否則裝置身分就失去唯一性。
select has_index('public', 'profiles', 'profiles_device_token_hash_unique',
  '裝置 token 雜湊具備唯一索引');

select is(
  (select indisunique from pg_index where indexrelid = 'public.profiles_device_token_hash_unique'::regclass),
  true,
  '該索引必須是唯一索引，而非一般索引');

-- 條件式索引：既有的 NULL 值不該互相衝突，否則第二個組織帳號就建不起來。
select isnt(
  (select pg_get_expr(indpred, indrelid) from pg_index
    where indexrelid = 'public.profiles_device_token_hash_unique'::regclass),
  null,
  '必須是條件式索引（where not null），否則多個 NULL 會互相衝突');

-- 明文外洩防線：只存雜湊，不存 token 本身。
select hasnt_column('public', 'profiles', 'device_token',
  '不得存裝置 token 明文');

select * from finish();
rollback;
