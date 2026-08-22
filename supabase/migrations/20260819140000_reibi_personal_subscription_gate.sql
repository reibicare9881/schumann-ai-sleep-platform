-- 個人訂閱與登入帳號綁定，讓功能閘門有依據可查。
--
-- 現況：reibi_subscriptions 只有 member_code 這個自由文字欄位。Artifact 用它是
-- 因為當時沒有帳號系統 —— 會員碼就是找回訂閱狀態的唯一憑證，使用者得自己保存。
-- 新系統有 Supabase Auth，訂閱應該綁在 profiles.id 上，理由跟 Artifact 的跨檔案
-- 交接索引改用外鍵是同一個：有真正的關聯就不該再靠使用者手抄一組代碼。
--
-- member_code 保留不動：Artifact 匯入資料靠它對應，而且它仍是人可讀的客服查詢碼。
-- profile_id 可為 null，代表 L5 代客建立、使用者尚未以啟用碼認領的訂閱。

alter table public.reibi_subscriptions
  add column if not exists profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists activated_at timestamptz;

comment on column public.reibi_subscriptions.profile_id is
  '認領這筆訂閱的登入帳號。null 代表尚未被使用者以啟用碼認領。';
comment on column public.reibi_subscriptions.activated_at is
  '使用者輸入啟用碼完成認領的時間。與 approved_at（財務核准）不同。';

-- 功能閘門每次請求都要查「這個帳號現在有沒有有效訂閱」，
-- 走 profile_id + status，並取最晚到期的一筆。
create index if not exists reibi_subscriptions_profile_status_idx
  on public.reibi_subscriptions (profile_id, status, expires_at desc)
  where profile_id is not null;

-- 一組啟用碼只能認領一次。已認領的訂閱不可被另一個帳號重複認領：
-- 這個唯一索引擋的是同一個 profile 重複持有同一筆訂閱之外的情況，
-- 真正的「一碼一用」由 activated_at 是否為 null 在應用層判定並以此索引兜底。
create unique index if not exists reibi_subscriptions_activation_hash_key
  on public.reibi_subscriptions (activation_code_hash)
  where activation_code_hash is not null;
