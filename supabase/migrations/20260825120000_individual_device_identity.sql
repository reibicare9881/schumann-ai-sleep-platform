-- 個人模式改用裝置綁定身分。
--
-- 原本 `/api/auth/login` 的個人分支以 `full_name` 查 profiles：查不到就建新帳號，
-- **查得到就直接登入成那個人**。也就是任何人只要猜中或知道某位使用者用的名字，
-- 就能讀取他的睡眠評估、量表答案、三高數值與 AI 報告 —— 不需要密碼或任何驗證。
--
-- 這不是移植失誤，是設計沒跟著搬家：Artifact 的個人資料存在瀏覽器 localStorage，
-- 每台裝置各自獨立，「輸入姓名」只是自己裝置上的標籤，讀不到別人的東西。搬到共用
-- 資料庫之後，同一段邏輯就從「本機標籤」變成認證漏洞。
--
-- 改法：真正的身分是首次使用時由瀏覽器產生的隨機 token，姓名退回為顯示標籤。
--
-- 只存雜湊不存 token 本身 —— 它等同密碼，資料庫外洩時不該直接等於帳號被開。
-- 用不帶金鑰的 SHA-256 而非 HMAC：HMAC 金鑰一旦輪替，所有個人使用者會同時失去
-- 自己的帳號；而 token 是 128 bit 隨機值，無金鑰的 SHA-256 已無法被暴力還原。

alter table public.profiles
  add column if not exists device_token_hash text;

comment on column public.profiles.device_token_hash is
  'SHA-256 of the browser-generated device token. Individual sign-in resolves identity from this, never from full_name. Null for org roles and for accounts created before this change.';

-- 一組 token 只能對應一個帳號。條件索引讓既有的 null 值不互相衝突。
create unique index if not exists profiles_device_token_hash_unique
  on public.profiles (device_token_hash)
  where device_token_hash is not null;
