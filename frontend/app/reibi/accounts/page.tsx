"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { KeyRound, Loader2, RefreshCw, ShieldCheck, UserPlus } from "lucide-react";

import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";

type Row = Record<string, any>;

const input = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500";
const primary = "inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-sm font-black text-white hover:bg-teal-600 disabled:opacity-50";
const secondary = "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50";

export default function IdentityAccountsPage() {
  const { session } = useAuth();
  const [roles, setRoles] = useState<Row[]>([]);
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [scopes, setScopes] = useState<Row>({ enterprises: [], departments: [], distributors: [] });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [edits, setEdits] = useState<Record<string, Row>>({});
  const [draft, setDraft] = useState<Row>({ email: "", display_name: "", role: "member", org_code: "", department_id: "", distributor_id: "", staff_id: "", mfa_required: false });
  // 授權用量：邀請帳號前應該先看得到自己還剩多少名額。
  const [usage, setUsage] = useState<Row | null>(null);

  const allowed = ["admin", "reibi_super"].includes(session?.systemRole || "");
  const selectedRole = roles.find(role => role.key === draft.role);
  const manageableRoles = useMemo(
    () => session?.systemRole === "reibi_super"
      ? roles
      : roles.filter(role => ["member", "dept_head", "admin_hr", "admin_finance", "admin_it", "occupational_health"].includes(role.key)),
    [roles, session?.systemRole],
  );
  const departments = (scopes.departments || []).filter((row: Row) => (row.reibi_enterprises || {}).org_code === draft.org_code);
  const distributors = (scopes.distributors || []).filter((row: Row) => row.distributor_type === (draft.role === "partner_primary" ? "primary" : "sub"));

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError("");
    const [rolesResult, accountsResult, scopesResult]: any[] = await Promise.all([
      API.getIdentityRoles(), API.listIdentityAccounts(), API.getIdentityAccountScopes(),
    ]);
    const failed = [rolesResult, accountsResult, scopesResult].find(result => result.status !== "success");
    if (failed) setError(failed.message || failed.detail || "無法載入帳號管理資料");
    else {
      setRoles(rolesResult.data?.roles || []);
      setAccounts(accountsResult.data?.accounts || []);
      setScopes(scopesResult.data || { enterprises: [], departments: [], distributors: [] });
      if (session?.systemRole === "admin" && session?.orgCode) {
        setDraft(previous => ({ ...previous, org_code: session.orgCode }));
      }
    }
    setLoading(false);
  }, [allowed, session?.orgCode, session?.systemRole]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!allowed) return;
    API.getReibiAccountUsage()
      .then((res: any) => setUsage(res?.status === "success" ? res.data : null))
      .catch(() => setUsage(null));
  }, [allowed]);

  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true); setError(""); setMessage("");
    const response: any = await API.inviteIdentityAccount({
      email: draft.email,
      display_name: draft.display_name,
      role: draft.role,
      org_code: selectedRole?.requires_org ? draft.org_code : null,
      department_id: selectedRole?.requires_department ? Number(draft.department_id) : null,
      distributor_id: selectedRole?.requires_distributor ? Number(draft.distributor_id) : null,
      staff_id: draft.staff_id ? Number(draft.staff_id) : null,
      mfa_required: Boolean(draft.mfa_required),
    });
    if (response.status === "success") {
      setMessage(`邀請已寄到 ${draft.email}`);
      setDraft(previous => ({ ...previous, email: "", display_name: "", department_id: "", distributor_id: "", staff_id: "" }));
      await load();
    } else setError(response.message || response.detail || "寄送邀請失敗");
    setLoading(false);
  };

  const changeStatus = async (account: Row) => {
    setLoading(true); setError(""); setMessage("");
    const response: any = await API.updateIdentityAccount(account.auth_user_id, { is_active: !account.is_active });
    if (response.status === "success") { setMessage(account.is_active ? "帳號已停用，既有工作階段已撤銷" : "帳號已重新啟用"); await load(); }
    else setError(response.message || response.detail || "帳號更新失敗");
    setLoading(false);
  };

  const revoke = async (account: Row) => {
    setLoading(true); setError(""); setMessage("");
    const response: any = await API.revokeIdentitySessions(account.auth_user_id);
    if (response.status === "success") setMessage(`已撤銷 ${account.display_name} 的所有 SleepM 工作階段`);
    else setError(response.message || response.detail || "工作階段撤銷失敗");
    setLoading(false);
  };

  const saveRole = async (account: Row) => {
    const edit = edits[account.auth_user_id];
    if (!edit) return;
    const role = roles.find(item => item.key === edit.role);
    setLoading(true); setError(""); setMessage("");
    const response: any = await API.updateIdentityAccount(account.auth_user_id, {
      role: edit.role,
      org_code: role?.requires_org ? account.org_code : null,
      department_id: role?.requires_department ? Number(edit.department_id) : null,
      distributor_id: role?.requires_distributor ? Number(edit.distributor_id) : null,
    });
    if (response.status === "success") {
      setMessage("角色已更新，該帳號既有工作階段已撤銷");
      setEdits(previous => { const next = { ...previous }; delete next[account.auth_user_id]; return next; });
      await load();
    } else setError(response.message || response.detail || "角色更新失敗");
    setLoading(false);
  };

  if (!allowed) return <main className="mx-auto max-w-3xl p-8"><div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">此帳號沒有身分與角色管理權限。</div></main>;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><Link href="/reibi" className="text-xs font-bold text-teal-700">← 返回 REIBI 管理</Link><h1 className="mt-2 text-2xl font-black text-slate-900">身分與角色管理</h1><p className="mt-1 text-sm text-slate-500">角色與範圍由後端核定；前端選項只供操作。</p></div>
          <button type="button" className={secondary} onClick={() => void load()}><RefreshCw className="h-4 w-4" />重新整理</button>
        </div>
        {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
        {message && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}

        {usage && (
          <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="font-black text-slate-900">帳號上限管控</h2>
            <p className="mt-1 text-xs text-slate-500">
              授權上限以合約簽訂的人數為準；下方方案級距僅供升級參考。
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <div><div className="text-xs text-slate-500">目前方案</div><div className="mt-1 font-black text-slate-900">{usage.plan_label}</div></div>
              <div><div className="text-xs text-slate-500">已啟用人數</div><div className="mt-1 font-black text-slate-900">{usage.used_count} 人</div></div>
              <div><div className="text-xs text-slate-500">授權上限</div><div className="mt-1 font-black text-slate-900">{usage.member_limit || "未設定"}{usage.member_limit ? " 人" : ""}</div></div>
              <div><div className="text-xs text-slate-500">剩餘名額</div><div className="mt-1 font-black text-slate-900">{usage.remaining} 人</div></div>
            </div>

            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${usage.over_limit ? "bg-rose-600" : usage.warning ? "bg-amber-500" : "bg-teal-600"}`}
                style={{ width: `${Math.min(100, usage.percent)}%` }}
              />
            </div>
            <div className="mt-1.5 text-xs text-slate-500">使用率 {usage.percent}%</div>

            {usage.over_limit ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
                已啟用人數超過授權上限，請儘速聯繫麗媚調整方案。
              </div>
            ) : usage.warning ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                使用率已達 {usage.percent}%（警示門檻 {usage.warning_threshold}%），如需增加人數請於服務中心送出升方案申請。
              </div>
            ) : null}

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {(usage.plans || []).map((plan: Row) => (
                <div
                  key={plan.plan_code}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${plan.is_current ? "bg-teal-50 font-bold text-teal-800" : "bg-slate-50 text-slate-600"}`}
                >
                  <span>{plan.label}{plan.is_current ? "（目前方案）" : ""}</span>
                  <span>≤ {plan.limit.toLocaleString("zh-TW")} 人</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
          <form onSubmit={invite} className="h-fit rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-black text-slate-900"><UserPlus className="h-5 w-5 text-teal-700" />邀請可信帳號</h2>
            <p className="mt-2 text-xs leading-5 text-slate-500">收件人會透過 Supabase 邀請信設定密碼。高權限帳號預設建議啟用 MFA。</p>
            <label className="mt-4 block text-xs font-bold">姓名／顯示名稱<input required className={input} value={draft.display_name} onChange={event => setDraft({ ...draft, display_name: event.target.value })} /></label>
            <label className="mt-3 block text-xs font-bold">Email<input required type="email" className={input} value={draft.email} onChange={event => setDraft({ ...draft, email: event.target.value })} /></label>
            <label className="mt-3 block text-xs font-bold">角色<select required className={input} value={draft.role} onChange={event => { const role = roles.find(item => item.key === event.target.value); setDraft({ ...draft, role: event.target.value, org_code: role?.requires_org ? draft.org_code : "", department_id: "", distributor_id: "", mfa_required: Boolean(role?.mfa_recommended) }); }}>
              {manageableRoles.map(role => <option key={role.key} value={role.key}>{role.label}</option>)}
            </select></label>
            {selectedRole?.requires_org && <label className="mt-3 block text-xs font-bold">企業<select required disabled={session?.systemRole === "admin"} className={input} value={draft.org_code} onChange={event => setDraft({ ...draft, org_code: event.target.value, department_id: "" })}><option value="">請選擇</option>{(scopes.enterprises || []).map((row: Row) => <option key={row.org_code} value={row.org_code}>{row.org_name}（{row.org_code}）</option>)}</select></label>}
            {selectedRole?.requires_department && <label className="mt-3 block text-xs font-bold">部門<select required className={input} value={draft.department_id} onChange={event => setDraft({ ...draft, department_id: event.target.value })}><option value="">請選擇</option>{departments.map((row: Row) => <option key={row.id} value={row.id}>L{row.hierarchy_level} · {row.name}</option>)}</select></label>}
            {selectedRole?.requires_distributor && <label className="mt-3 block text-xs font-bold">經銷商<select required className={input} value={draft.distributor_id} onChange={event => setDraft({ ...draft, distributor_id: event.target.value })}><option value="">請選擇</option>{distributors.map((row: Row) => <option key={row.id} value={row.id}>{row.name}（{row.org_code}）</option>)}</select></label>}
            {session?.systemRole === "reibi_super" && selectedRole?.realm === "reibi" && <label className="mt-3 block text-xs font-bold">內部人員 ID（選填）<input type="number" min="1" className={input} value={draft.staff_id} onChange={event => setDraft({ ...draft, staff_id: event.target.value })} /></label>}
            <label className="mt-4 flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={Boolean(draft.mfa_required)} onChange={event => setDraft({ ...draft, mfa_required: event.target.checked })} />要求 MFA（需先完成 TOTP 設定）</label>
            <button disabled={loading || !selectedRole} className={`${primary} mt-5 w-full`}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}寄送邀請</button>
          </form>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-black"><ShieldCheck className="h-5 w-5 text-teal-700" />可信帳號</h2><span className="text-xs text-slate-500">{accounts.length} 筆</span></div>
            {loading && !accounts.length ? <div className="py-12 text-center text-sm text-slate-500">載入中…</div> : <div className="mt-4 space-y-3">{accounts.map(account => {
              const role = roles.find(item => item.key === account.internal_role);
              const edit = edits[account.auth_user_id];
              const editedRole = roles.find(item => item.key === edit?.role);
              const roleChoices = manageableRoles.filter(item => item.realm === role?.realm);
              const accountDepartments = (scopes.departments || []).filter((row: Row) => (row.reibi_enterprises || {}).org_code === account.org_code);
              const accountDistributors = (scopes.distributors || []).filter((row: Row) => row.distributor_type === (edit?.role === "partner_primary" ? "primary" : "sub"));
              const department = account.reibi_departments?.name;
              const distributor = account.reibi_distributors?.name;
              return <article key={account.auth_user_id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-black text-slate-900">{account.display_name}</div><div className="mt-1 text-xs text-slate-500">{account.email}</div></div><span className={`rounded-full px-2 py-1 text-[11px] font-black ${account.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{account.is_active ? "啟用" : "停用"}</span></div>
                <div className="mt-3 text-xs leading-5 text-slate-600"><b>{role?.label || account.internal_role}</b>{account.org_code && ` · ${account.org_code}`}{department && ` · ${department}`}{distributor && ` · ${distributor}`}<br />最近登入：{account.last_login_at ? new Date(account.last_login_at).toLocaleString("zh-TW") : "尚未登入"}{account.mfa_required ? " · 要求 MFA" : ""}</div>
                {edit && <div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-2"><label className="text-xs font-bold">新角色<select className={input} value={edit.role} onChange={event => { const nextRole = roles.find(item => item.key === event.target.value); setEdits(previous => ({ ...previous, [account.auth_user_id]: { ...edit, role: event.target.value, department_id: nextRole?.requires_department ? edit.department_id : "", distributor_id: nextRole?.requires_distributor ? "" : edit.distributor_id } })); }}>{roleChoices.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>{editedRole?.requires_department && <label className="text-xs font-bold">部門<select required className={input} value={edit.department_id || ""} onChange={event => setEdits(previous => ({ ...previous, [account.auth_user_id]: { ...edit, department_id: event.target.value } }))}><option value="">請選擇</option>{accountDepartments.map((row: Row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>}{editedRole?.requires_distributor && <label className="text-xs font-bold">經銷商<select required className={input} value={edit.distributor_id || ""} onChange={event => setEdits(previous => ({ ...previous, [account.auth_user_id]: { ...edit, distributor_id: event.target.value } }))}><option value="">請選擇</option>{accountDistributors.map((row: Row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>}<div className="flex items-end gap-2"><button type="button" disabled={loading || (editedRole?.requires_department && !edit.department_id) || (editedRole?.requires_distributor && !edit.distributor_id)} className={secondary} onClick={() => void saveRole(account)}>儲存角色</button><button type="button" className={secondary} onClick={() => setEdits(previous => { const next = { ...previous }; delete next[account.auth_user_id]; return next; })}>取消</button></div></div>}
                <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={loading || account.auth_user_id === session?.uid} className={secondary} onClick={() => void changeStatus(account)}>{account.is_active ? "停用帳號" : "重新啟用"}</button><button type="button" disabled={loading} className={secondary} onClick={() => void revoke(account)}><KeyRound className="h-3.5 w-3.5" />撤銷工作階段</button>{!edit && roleChoices.length > 1 && account.auth_user_id !== session?.uid && <button type="button" disabled={loading} className={secondary} onClick={() => setEdits(previous => ({ ...previous, [account.auth_user_id]: { role: account.internal_role, department_id: account.department_id || "", distributor_id: account.distributor_id || "" } }))}>變更角色</button>}</div>
              </article>;
            })}</div>}
          </section>
        </div>
      </div>
    </main>
  );
}
