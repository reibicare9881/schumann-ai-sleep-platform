/**
 * 統一 API 客戶端
 * Unified API Client for Sleep Platform
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ==========================================
// 請求配置
// ==========================================

interface APIResponse<T = any> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  detail?: string;
  /** 失敗時的 HTTP 狀態碼。402 代表付費牆，與一般錯誤要分開處理。 */
  status_code?: number;
}

interface Session {
  session_id?: string;
  user_id: string;
  platform: string;
  role?: string;
  access_token?: string;
  name?: string;
  org_code?: string;
  org_name?: string; 
  dept?: string;
  department_id?: number;
  partner_org_code?: string;
  distributor_id?: number;
}

// ==========================================
// API 客戶端
// ==========================================

export const API = {
  // 儲存當前會話
  currentSession: null as Session | null,
  workflowOrgCode: null as string | null,

  setWorkflowOrgCode(orgCode?: string | null) {
    this.workflowOrgCode = orgCode ? orgCode.toUpperCase() : null;
  },
  
  // 設置會話
  setSession(session: Session) {
    this.currentSession = session;
    if (typeof window !== 'undefined') {
      localStorage.setItem('api_session', JSON.stringify(session));
    }
  },
  
  // 獲取會話
  getSession(): Session | null {
    if (this.currentSession) return this.currentSession;
    
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('api_session');
      if (stored) {
        this.currentSession = JSON.parse(stored);
        return this.currentSession;
      }
    }
    return null;
  },
  
  // 清除會話
  clearSession() {
    this.currentSession = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('api_session');
    }
  },
  
  // ==========================================
  // 基礎請求方法
  // ==========================================
  
  async request<T>(
    endpoint: string,
    options: RequestInit & { query?: Record<string, any> } = {}
  ): Promise<APIResponse<T>> {
    let url = `${API_BASE_URL}${endpoint}`;
    
    // 處理查詢參數
    const workflowScoped = /^\/api\/reibi\/(business-catalogs|quotes(?:\/|$)|contracts(?:\/|$)|work-orders(?:\/|$))/.test(endpoint)
      && endpoint !== '/api/reibi/quotes/calculate';
    const query = workflowScoped && this.workflowOrgCode
      ? { ...options.query, org_code: this.workflowOrgCode }
      : options.query;
    if (query) {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
      const queryString = params.toString();
      if (queryString) url += `?${queryString}`;
    }

    // 🌟 新增：獲取當前 Session 
    const session = this.getSession();
    
    // 🌟 修正：先展開傳入的 headers (不再強制預設 application/json)
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };

    // 🌟 核心防呆：判斷是否為檔案上傳 (FormData)
    // 如果是 FormData，把 Content-Type 交給瀏覽器自動生成 (帶 boundary)
    // 如果不是 FormData 且沒有指定 Content-Type，才預設為 application/json
    if (options.body && options.body instanceof FormData) {
      delete headers['Content-Type'];
    } else if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    // 🌟 新增：如果 Session 裡面有 Token，就加上 Authorization
    if (session && session.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    
    try {
      const response = await fetch(url, {
        ...options,
        headers, // 🌟 修改：直接放入我們智慧判斷後的 headers
        cache: 'no-store'
      });
      
      const data = await response.json();

      if (!response.ok) {
        // 保留 HTTP 狀態碼。呼叫端需要分辨「付費牆（402）」與「真的失敗」——
        // 只丟一句 message 出去，升級提示會被當成錯誤訊息顯示。
        const failure = new Error(data.detail || data.message || '請求失敗') as Error & { status?: number };
        failure.status = response.status;
        throw failure;
      }

      return data;
    } catch (error) {
      console.error('API 請求錯誤:', error);
      return {
        status: 'error',
        status_code: (error as { status?: number })?.status,
        message: error instanceof Error ? error.message : '未知錯誤'
      };
    }
  },
  
  // ==========================================
  // 平台列表
  // ==========================================
  
  async getPlatforms() {
    return this.request('/api/platforms');
  },
  
  // ==========================================
  // 認證相關
  // ==========================================
  async verifyOrgCode(orgCode: string) {
    // 這個請求不會帶 Token
    return this.request(`/api/auth/verify-org/${orgCode}`);
  },
  
  async login(platform: 'schumann' | 'sleep', loginData: {
    role?: string;
    pin?: string;
    org_code?: string;
    name?: string;
    org_name?: string;
    dept?: string;
  }) {
    const response = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        platform,
        ...loginData
      })
    });
    
    // 🌟 處理 FastAPI 扁平化的回傳結構 (把 response 當作 any 來取值避開 TS 報錯)
    const rawResponse = response as any;
    const sessionData = rawResponse.data?.session || rawResponse.session;
    const accessToken = rawResponse.data?.access_token || rawResponse.access_token;

    if (response.status === 'success' && sessionData) {
      this.setSession({
        ...sessionData,
        platform: rawResponse.platform || platform,
        access_token: accessToken, // 🌟 把 JWT Token 一起存進 Session 中
        org_code: loginData.org_code,
        org_name: loginData.org_code
      });
    }
    
    return response;
  },

  async internalLogin(email: string, password: string, totpCode?: string) {
    const response = await this.request('/api/auth/internal/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, totp_code: totpCode || undefined })
    });
    const rawResponse = response as any;
    const sessionData = rawResponse.data?.session || rawResponse.session;
    const accessToken = rawResponse.data?.access_token || rawResponse.access_token;
    if (response.status === 'success' && sessionData && accessToken) {
      this.setSession({ ...sessionData, platform: 'sleep', access_token: accessToken });
    }
    return response;
  },

  async accountLogin(email: string, password: string, totpCode?: string) {
    const response = await this.request('/api/auth/account/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, totp_code: totpCode || undefined })
    });
    const rawResponse = response as any;
    const sessionData = rawResponse.data?.session || rawResponse.session;
    const accessToken = rawResponse.data?.access_token || rawResponse.access_token;
    if (response.status === 'success' && sessionData && accessToken) {
      this.setSession({ ...sessionData, platform: 'sleep', access_token: accessToken });
    }
    return response;
  },

  async getIdentityRoles() {
    return this.request('/api/auth/roles');
  },

  async listIdentityAccounts() {
    return this.request('/api/auth/accounts');
  },

  async getIdentityAccountScopes() {
    return this.request('/api/auth/account-scopes');
  },

  async inviteIdentityAccount(payload: Record<string, unknown>) {
    return this.request('/api/auth/accounts/invite', {
      method: 'POST', body: JSON.stringify(payload)
    });
  },

  async updateIdentityAccount(authUserId: string, payload: Record<string, unknown>) {
    return this.request(`/api/auth/accounts/${authUserId}`, {
      method: 'PATCH', body: JSON.stringify(payload)
    });
  },

  async revokeIdentitySessions(authUserId: string) {
    return this.request(`/api/auth/accounts/${authUserId}/revoke-sessions`, { method: 'POST' });
  },

  async completeIdentityInvite(accessToken: string, password: string) {
    return this.request('/api/auth/complete-invite', {
      method: 'POST', body: JSON.stringify({ access_token: accessToken, password })
    });
  },

  async enrollIdentityMfa(email: string, password: string) {
    return this.request('/api/auth/mfa/enroll', {
      method: 'POST', body: JSON.stringify({ email, password })
    });
  },

  async enrollCurrentIdentityMfa(password: string) {
    return this.request('/api/auth/mfa/self/enroll', {
      method: 'POST', body: JSON.stringify({ password })
    });
  },

  async verifyIdentityMfa(email: string, password: string, factorId: string, code: string) {
    return this.request('/api/auth/mfa/verify-enrollment', {
      method: 'POST', body: JSON.stringify({ email, password, factor_id: factorId, code })
    });
  },

  async verifyCurrentIdentityMfa(password: string, factorId: string, code: string) {
    return this.request('/api/auth/mfa/self/verify', {
      method: 'POST', body: JSON.stringify({ password, factor_id: factorId, code })
    });
  },
  
  async logout() {
    const session = this.getSession();
    if (!session) return { status: 'error', message: '未登入' };
    
    const response = await this.request('/api/auth/logout', {
      method: 'POST',
      query: {
        session_id: session.session_id || session.user_id || "stateless",
        platform: session.platform
      }
    });
    
    this.clearSession();
    return response;
  },
  
  async switchPlatform(toPlatform: 'schumann' | 'sleep') {
    const session = this.getSession();
    if (!session) return { status: 'error', message: '未登入' };
    
    // 🌟 防呆 1：如果 session.platform 遺失，強制預設為 'sleep'，避免後端報 422 錯誤
    const currentPlatform = session.platform || 'sleep';

    const response = await this.request('/api/auth/switch-platform', {
      method: 'POST',
      query: {
        user_id: session.user_id,
        from_platform: currentPlatform, // 確保這裡一定有值送出
        to_platform: toPlatform
      }
    });
    
    if (response.status === 'success' && response.data?.session) {
      // 🌟 防呆 2：切換平台成功後，把原本的名字繼承過去，避免重新整理後變成 undefined
      const newSessionData = {
        ...response.data.session,
        name: session.name || "使用者" 
      };
      this.setSession(newSessionData);
    }
    
    return response;
  },
  
  // ==========================================
  // 睡眠平台 API
  // ==========================================
  
  // 提交評估
  async submitAssessment(assessmentData: {
    user_id: string;
    profile: Record<string, any>;
    sleep_scores: Record<string, number>;
    pain_scores: Record<string, number>;
    work_scores: Record<string, number>;
    consent_org_aggregate?: boolean;
  }) {
    return this.request('/api/sleep/assessment', {
      method: 'POST',
      body: JSON.stringify(assessmentData)
    });
  },
  
  // 獲取睡眠報告列表
  async listSleepReports(userId: string) {
    return this.request('/api/sleep/reports', {
      query: { user_id: userId }
    });
  },
  
  // 獲取單份睡眠報告
  async getSleepReport(reportId: string) {
    return this.request(`/api/sleep/reports/${reportId}`);
  },
  
  // 獲取睡眠分析
  async getSleepAnalysis(userId: string) {
    return this.request(`/api/sleep/analysis/${userId}`);
  },

  async getOrgSettings(orgCode: string) {
    return this.request(`/api/org/settings/${orgCode}`);
  },

  async updateOrgSettings(orgCode: string, settings: any) {
    // 將前端的駝峰命名轉換為後端資料庫的蛇形命名
    const payload = {
      base_budget: settings.baseBudget,
      activation_pct: settings.activationPct,
      value_multiplier: settings.valueMultiplier,
      sick_days: settings.sickDays,
      daily_salary: settings.dailySalary,
      ins_saving: settings.insSaving,
      prod_gain: settings.prodGain,
      impl_cost: settings.implCost,
      eff_gain: settings.effGain
    };

    return this.request(`/api/org/settings/${orgCode}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },
  
  async getAppointments(orgCode: string, serviceType: string) {
    return this.request('/api/appointments', {
      query: { org_code: orgCode, service_type: serviceType }
    });
  },

  async getAppointmentSites() {
    return this.request('/api/appointments/sites');
  },

  async createAppointment(apptData: {
    user_id: string;
    execution_date: string;
    appointment_time: string;
    service_type: string;
    service_site_id?: number | null;
    note?: string | null;
  }) {
    return this.request('/api/appointments', {
      method: 'POST',
      body: JSON.stringify(apptData)
    });
  },

  async updateAppointmentStatus(apptId: string, status: string) {
    return this.request(`/api/appointments/${apptId}/status`, {
      method: 'PATCH',
      query: { status }
    });
  },

  async deleteAppointment(apptId: string) {
    return this.request(`/api/appointments/${apptId}`, {
      method: 'DELETE'
    });
  },

  // ==========================================
  // 舒曼共振平台 API
  // ==========================================
  
  // 獲取舒曼報告列表
  async listSchumannReports(userId: string) {
    return this.request('/api/schumann/reports', {
      query: { user_id: userId }
    });
  },
  
  // 獲取單份舒曼報告
  async getSchumannReport(reportId: string) {
    return this.request(`/api/schumann/reports/${reportId}`);
  },

  // 獲取舒曼歷史趨勢數據
  async getSchumannTrend(userId: string) {
    return this.request(`/api/schumann/trend/${userId}`);
  },
  
  // 獲取使用者所有歷史紀錄 (整合睡眠與舒曼)
  async getUserHistory(userId: string) {
    return this.request(`/api/history/${userId}`);
  },
  
  // 獲取 AI 獨立歷史趨勢分析
  async generateAITrend(userId: string, platform: 'sleep' | 'schumann') {
    return this.request(`/api/ai-trend/${userId}`, {
      method: 'POST',
      query: { platform }
    });
  },

  // 獲取最近一次的個人生理基本資料
  async getLatestProfile(userId: string) {
    return this.request(`/api/sleep/latest-profile/${userId}`, {
      method: 'GET'
    });
  },

  // ==========================================
  // REIBI 管理 API（目前限單位 admin）
  // ==========================================

  async getReibiOverview(orgCode?: string) {
    return this.request('/api/reibi/overview', { query: { org_code: orgCode } });
  },

  async getReibiL5Overview() {
    return this.request('/api/reibi/l5/overview');
  },

  async getReibiL5Regions() {
    return this.request('/api/reibi/l5/regions');
  },

  async getReibiAccountUsage() {
    return this.request('/api/reibi/enterprise/account-usage');
  },

  async listReibiOnboardingCases() {
    return this.request('/api/reibi/onboarding/cases');
  },

  async createReibiOnboardingCase(payload: Record<string, any>) {
    return this.request('/api/reibi/onboarding/cases', { method: 'POST', body: JSON.stringify(payload) });
  },

  async handoffReibiOnboardingCase(caseId: number) {
    return this.request(`/api/reibi/onboarding/cases/${caseId}/handoff`, { method: 'POST' });
  },

  async downloadReibiCredentialLetter(caseId: number) {
    const session = this.getSession();
    const response = await fetch(`${API_BASE_URL}/api/reibi/onboarding/cases/${caseId}/credential-letter`, {
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      cache: 'no-store',
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || '無法下載憑證函');
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `REIBI-credential-${caseId}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  },

  async saveReibiEnterprise(payload: Record<string, any>, orgCode?: string) {
    return this.request('/api/reibi/enterprise', {
      method: 'PUT',
      query: { org_code: orgCode },
      body: JSON.stringify(payload)
    });
  },

  async listReibiEnterpriseSites(orgCode?: string) {
    return this.request('/api/reibi/enterprise/sites', { query: { org_code: orgCode } });
  },

  async createReibiEnterpriseSite(payload: Record<string, any>, orgCode?: string) {
    return this.request('/api/reibi/enterprise/sites', {
      method: 'POST',
      query: { org_code: orgCode },
      body: JSON.stringify(payload)
    });
  },

  async updateReibiEnterpriseSite(siteId: number, payload: Record<string, any>, orgCode?: string) {
    return this.request(`/api/reibi/enterprise/sites/${siteId}`, {
      method: 'PATCH',
      query: { org_code: orgCode },
      body: JSON.stringify(payload)
    });
  },

  async deleteReibiEnterpriseSite(siteId: number, orgCode?: string) {
    return this.request(`/api/reibi/enterprise/sites/${siteId}`, { method: 'DELETE', query: { org_code: orgCode } });
  },

  async listReibiDepartments(orgCode?: string) {
    return this.request('/api/reibi/enterprise/departments', { query: { org_code: orgCode } });
  },

  async createReibiDepartment(payload: Record<string, any>, orgCode?: string) {
    return this.request('/api/reibi/enterprise/departments', {
      method: 'POST',
      query: { org_code: orgCode },
      body: JSON.stringify(payload)
    });
  },

  async updateReibiDepartment(departmentId: number, payload: Record<string, any>, orgCode?: string) {
    return this.request(`/api/reibi/enterprise/departments/${departmentId}`, {
      method: 'PATCH',
      query: { org_code: orgCode },
      body: JSON.stringify(payload)
    });
  },

  async deleteReibiDepartment(departmentId: number, orgCode?: string) {
    return this.request(`/api/reibi/enterprise/departments/${departmentId}`, { method: 'DELETE', query: { org_code: orgCode } });
  },

  async getReibiBusinessCatalogs() {
    return this.request('/api/reibi/business-catalogs');
  },

  async calculateReibiQuote(payload: Record<string, any>) {
    return this.request('/api/reibi/quotes/calculate', { method: 'POST', body: JSON.stringify(payload) });
  },

  async listReibiQuotes(page = 1, size = 50, status?: string, search?: string) {
    return this.request('/api/reibi/quotes', { query: { page, size, status, search } });
  },

  async createReibiQuote(payload: Record<string, any>) {
    return this.request('/api/reibi/quotes', { method: 'POST', body: JSON.stringify(payload) });
  },

  async updateReibiQuote(recordId: number, payload: Record<string, any>) {
    return this.request(`/api/reibi/quotes/${recordId}`, { method: 'PUT', body: JSON.stringify(payload) });
  },

  async convertReibiQuote(recordId: number, contractType: string, terms: Record<string, any> = {}) {
    return this.request(`/api/reibi/quotes/${recordId}/convert`, {
      method: 'POST', body: JSON.stringify({ contract_type: contractType, terms })
    });
  },

  async listReibiContracts(page = 1, size = 50, status?: string, search?: string) {
    return this.request('/api/reibi/contracts', { query: { page, size, status, search } });
  },

  async createReibiAdjustmentQuote(contractId: number, adjustmentType: 'upgrade' | 'renewal') {
    return this.request(`/api/reibi/contracts/${contractId}/adjustment-quote`, {
      method: 'POST', body: JSON.stringify({ adjustment_type: adjustmentType })
    });
  },

  async updateReibiContractExecution(contractId: number, payload: Record<string, any>) {
    return this.request(`/api/reibi/contracts/${contractId}/execution`, {
      method: 'PATCH', body: JSON.stringify(payload)
    });
  },

  async createReibiWorkOrderFromContract(contractId: number, payload: Record<string, any>) {
    return this.request(`/api/reibi/contracts/${contractId}/work-order`, {
      method: 'POST', body: JSON.stringify(payload)
    });
  },

  async listReibiWorkOrders(page = 1, size = 50, status?: string, search?: string) {
    return this.request('/api/reibi/work-orders', { query: { page, size, status, search } });
  },

  async getReibiWorkOrderCatalog() {
    return this.request('/api/reibi/work-orders/catalog');
  },

  async getReibiWorkOrder(recordId: number) {
    return this.request(`/api/reibi/work-orders/${recordId}`);
  },

  async updateReibiWorkOrder(recordId: number, payload: Record<string, any>) {
    return this.request(`/api/reibi/work-orders/${recordId}`, { method: 'PUT', body: JSON.stringify(payload) });
  },

  async acceptReibiWorkOrder(recordId: number, payload: Record<string, any>) {
    return this.request(`/api/reibi/work-orders/${recordId}/acceptance`, {
      method: 'POST', body: JSON.stringify(payload)
    });
  },

  async updateReibiDocumentStatus(kind: 'quotes' | 'contracts' | 'work-orders', recordId: number, status: string) {
    return this.request(`/api/reibi/${kind}/${recordId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  async listReibiOperationEnterprises() {
    return this.request('/api/reibi/operations/enterprises');
  },

  async syncReibiPayments(enterpriseId?: number) {
    return this.request('/api/reibi/finance/payments/sync', {
      method: 'POST', body: JSON.stringify({ enterprise_id: enterpriseId ?? null })
    });
  },

  async listReibiPayments(enterpriseId?: number) {
    return this.request('/api/reibi/finance/payments', { query: { page: 1, size: 500, enterprise_id: enterpriseId } });
  },

  async updateReibiPayment(paymentId: number, payload: Record<string, any>) {
    return this.request(`/api/reibi/finance/payments/${paymentId}`, { method: 'PATCH', body: JSON.stringify(payload) });
  },

  async listReibiRemittances() {
    return this.request('/api/reibi/finance/remittances', { query: { page: 1, size: 500 } });
  },

  async createReibiRemittance(payload: Record<string, any>) {
    return this.request('/api/reibi/finance/remittances', { method: 'POST', body: JSON.stringify(payload) });
  },

  async reconcileReibiRemittance(remittanceId: number, payload: Record<string, any>) {
    return this.request(`/api/reibi/finance/remittances/${remittanceId}/reconcile`, { method: 'POST', body: JSON.stringify(payload) });
  },

  async rejectReibiRemittance(remittanceId: number, reason: string) {
    return this.request(`/api/reibi/finance/remittances/${remittanceId}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
  },

  async listReibiInvoices() {
    return this.request('/api/reibi/finance/invoices', { query: { page: 1, size: 500 } });
  },

  async createReibiInvoice(payload: Record<string, any>) {
    return this.request('/api/reibi/finance/invoices', { method: 'POST', body: JSON.stringify(payload) });
  },

  async updateReibiInvoice(invoiceId: number, payload: Record<string, any>) {
    return this.request(`/api/reibi/finance/invoices/${invoiceId}`, { method: 'PUT', body: JSON.stringify(payload) });
  },

  async updateReibiInvoiceStatus(invoiceId: number, status: string) {
    return this.request(`/api/reibi/finance/invoices/${invoiceId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
  },

  async deleteReibiInvoice(invoiceId: number) {
    return this.request(`/api/reibi/finance/invoices/${invoiceId}`, { method: 'DELETE' });
  },

  async listReibiSubscriptions() { return this.request('/api/reibi/subscriptions'); },
  async createReibiSubscription(payload: Record<string, any>) {
    return this.request('/api/reibi/subscriptions', { method: 'POST', body: JSON.stringify(payload) });
  },
  async reviewReibiSubscription(id: number, payload: Record<string, any>) {
    return this.request(`/api/reibi/subscriptions/${id}/review`, { method: 'POST', body: JSON.stringify(payload) });
  },
  async reissueReibiSubscription(id: number) {
    return this.request(`/api/reibi/subscriptions/${id}/reissue`, { method: 'POST' });
  },

  async listReibiCatalog(kind: 'staff' | 'partners' | 'distributors') {
    return this.request(`/api/reibi/${kind}`);
  },
  async createReibiCatalog(kind: 'staff' | 'partners' | 'distributors', payload: Record<string, any>) {
    return this.request(`/api/reibi/${kind}`, { method: 'POST', body: JSON.stringify(payload) });
  },
  async updateReibiCatalog(kind: 'staff' | 'partners' | 'distributors', id: number, payload: Record<string, any>) {
    return this.request(`/api/reibi/${kind}/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },
  async deactivateReibiCatalog(kind: 'staff' | 'partners' | 'distributors', id: number) {
    return this.request(`/api/reibi/${kind}/${id}`, { method: 'DELETE' });
  },

  async getReibiFinanceSettings() { return this.request('/api/reibi/finance/settings'); },
  async updateReibiFinanceSettings(minRetain: number) {
    return this.request('/api/reibi/finance/settings', { method: 'PATCH', body: JSON.stringify({ min_reibi_retain_percent: minRetain }) });
  },
  async previewReibiCommissions() { return this.request('/api/reibi/commissions/preview'); },
  async listReibiCommissionLedger() { return this.request('/api/reibi/commissions/ledger'); },
  async confirmReibiCommission(distributorId: number, periodMonth: string, note = '') {
    return this.request('/api/reibi/commissions/ledger', { method: 'POST', body: JSON.stringify({ distributor_id: distributorId, period_month: periodMonth, note: note || null }) });
  },
  async markReibiCommissionPaid(ledgerId: number) {
    return this.request(`/api/reibi/commissions/ledger/${ledgerId}/paid`, { method: 'POST' });
  },

  // REIBI Batch D：個人健康、職安問卷、EAP 與 OHS
  async getReibiHealthActions() { return this.request('/api/reibi/health/actions'); },
  async checkinReibiHealthAction(actionCode: string, checkedOn?: string) {
    return this.request('/api/reibi/health/actions', { method: 'POST', body: JSON.stringify({ action_code: actionCode, checked_on: checkedOn }) });
  },
  // 個人訂閱閘門：狀態、申請與啟用碼認領
  async getReibiSubscription() { return this.request('/api/reibi/health/subscription'); },
  async applyReibiSubscription(payload: { plan_code: string; contact: string; agreed_terms_version: string }) {
    return this.request('/api/reibi/health/subscription/apply', { method: 'POST', body: JSON.stringify(payload) });
  },
  async activateReibiSubscription(activationCode: string) {
    return this.request('/api/reibi/health/subscription/activate', {
      method: 'POST', body: JSON.stringify({ activation_code: activationCode })
    });
  },
  async getReibiPoints() { return this.request('/api/reibi/health/points'); },
  async redeemReibiPoints(rewardCode: string) {
    // 點數由後端目錄決定，前端只送兌換品項代碼。
    return this.request('/api/reibi/health/points/redeem', { method: 'POST', body: JSON.stringify({ reward_code: rewardCode }) });
  },
  async getReibiDiary(kind: 'sleep' | 'pain') { return this.request(`/api/reibi/health/diaries/${kind}`); },
  async saveReibiDiary(kind: 'sleep' | 'pain', payload: Record<string, any>) {
    return this.request(`/api/reibi/health/diaries/${kind}`, { method: 'PUT', body: JSON.stringify(payload) });
  },
  async getReibiVitals() { return this.request('/api/reibi/health/vitals'); },
  async saveReibiVitals(payload: Record<string, any>) {
    return this.request('/api/reibi/health/vitals', { method: 'PUT', body: JSON.stringify(payload) });
  },
  async getReibiVitalAggregate(department?: string, orgCode?: string) {
    return this.request('/api/reibi/health/vitals/aggregate', { query: { department, org_code: orgCode } });
  },
  async submitReibiHealthAssessment(payload: Record<string, any>) {
    return this.request('/api/reibi/health/assessments', { method: 'POST', body: JSON.stringify(payload) });
  },
  async listReibiHealthAssessments(assessmentType?: string) {
    return this.request('/api/reibi/health/assessments', { query: { assessment_type: assessmentType } });
  },
  async getReibiMentalHealthIndex() { return this.request('/api/reibi/health/assessments/mhi'); },
  async getReibiAssessmentActivity(orgCode?: string) {
    return this.request('/api/reibi/health/assessments/activity', { query: { org_code: orgCode } });
  },
  async getReibiAssessmentReminders() { return this.request('/api/reibi/health/assessments/reminders'); },
  async getReibiHealthTimeline() { return this.request('/api/reibi/health/timeline'); },
  async submitReibiFeedback(payload: Record<string, any>) {
    return this.request('/api/reibi/health/feedback', { method: 'POST', body: JSON.stringify(payload) });
  },
  async getReibiFeedbackAggregate(periodKey: string, department?: string, orgCode?: string) {
    return this.request('/api/reibi/health/feedback/aggregate', { query: { period_key: periodKey, department, org_code: orgCode } });
  },
  async listReibiEapResources() { return this.request('/api/reibi/health/eap'); },
  async createReibiEapResource(payload: Record<string, any>) {
    return this.request('/api/reibi/health/eap', { method: 'POST', body: JSON.stringify(payload) });
  },
  async updateReibiEapResource(id: number, payload: Record<string, any>) {
    return this.request(`/api/reibi/health/eap/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },
  async setReibiOccupationalAccess(pin: string, rosterVisible: boolean) {
    return this.request('/api/reibi/health/occupational-access', { method: 'PUT', body: JSON.stringify({ pin, roster_visible: rosterVisible }) });
  },
  async listReibiOhs(recordType?: string, orgCode?: string) {
    return this.request('/api/reibi/health/ohs', { query: { record_type: recordType, org_code: orgCode } });
  },
  async createReibiOhs(payload: Record<string, any>, orgCode?: string) {
    return this.request('/api/reibi/health/ohs', { method: 'POST', query: { org_code: orgCode }, body: JSON.stringify(payload) });
  },
  async updateReibiOhs(id: number, payload: Record<string, any>, orgCode?: string) {
    return this.request(`/api/reibi/health/ohs/${id}`, { method: 'PUT', query: { org_code: orgCode }, body: JSON.stringify(payload) });
  },
  async deleteReibiOhs(id: number, orgCode?: string) {
    return this.request(`/api/reibi/health/ohs/${id}`, { method: 'DELETE', query: { org_code: orgCode } });
  },
  async getReibiOhsSnapshot(orgCode?: string) {
    return this.request('/api/reibi/health/ohs/plan/snapshot', { query: { org_code: orgCode } });
  },

  // REIBI Batch E：組織分析、跨企業 k 匿名與 Gemini 報告
  async getReibiResearchConsent() { return this.request('/api/reibi/analytics/consent'); },
  async setReibiResearchConsent(researchOptIn: boolean) {
    return this.request('/api/reibi/analytics/consent', { method: 'PUT', body: JSON.stringify({ research_opt_in: researchOptIn }) });
  },
  async getReibiAnalyticsOverview(query: Record<string, any> = {}) {
    return this.request('/api/reibi/analytics/overview', { query });
  },
  async getReibiAnalyticsSettings() { return this.request('/api/reibi/analytics/settings'); },
  async saveReibiAnalyticsSettings(payload: Record<string, any>) {
    return this.request('/api/reibi/analytics/settings', { method: 'PUT', body: JSON.stringify(payload) });
  },
  async getReibiDepartmentAnalytics(query: Record<string, any> = {}) {
    return this.request('/api/reibi/analytics/departments', { query });
  },
  async listReibiAnalyticsReports() { return this.request('/api/reibi/analytics/reports'); },
  async getReibiAnalyticsReport(id: number) { return this.request(`/api/reibi/analytics/reports/${id}`); },
  async generateReibiAnalyticsReport(payload: Record<string, any>) {
    return this.request('/api/reibi/analytics/reports', { method: 'POST', body: JSON.stringify(payload) });
  },
  async getReibiCrossOrgAnalytics(query: Record<string, any> = {}) {
    return this.request('/api/reibi/analytics/cross-org', { query });
  },
  async listReibiCrossOrgReports() { return this.request('/api/reibi/analytics/cross-org/reports'); },
  async getReibiAnalyticsDirectory(kind: 'enterprise' | 'distributor', query: Record<string, any> = {}) {
    return this.request('/api/reibi/analytics/directory', { query: { kind, ...query } });
  },

  // REIBI Batch F：設定、服務中心、公告、訊息與外部整合
  async getReibiServiceCatalog() { return this.request('/api/reibi/service/catalog'); },
  async preflightReibiDepartments(csvText: string) {
    return this.request('/api/reibi/enterprise/departments/preflight', { method: 'POST', body: JSON.stringify({ csv_text: csvText }) });
  },
  async importReibiDepartments(csvText: string, enterpriseId?: number) {
    return this.request('/api/reibi/enterprise/departments/import', { method: 'POST', query: { enterprise_id: enterpriseId }, body: JSON.stringify({ csv_text: csvText }) });
  },
  async getReibiArchitecture(enterpriseId?: number) { return this.request('/api/reibi/enterprise/architecture', { query: { enterprise_id: enterpriseId } }); },
  async getReibiServiceScope() { return this.request('/api/reibi/service/scope'); },
  async listReibiServiceTickets(status?: string) { return this.request('/api/reibi/service/tickets', { query: { status } }); },
  async createReibiServiceTicket(payload: Record<string, any>) {
    return this.request('/api/reibi/service/tickets', { method: 'POST', body: JSON.stringify(payload) });
  },
  async updateReibiServiceTicket(id: number, payload: Record<string, any>) {
    return this.request(`/api/reibi/service/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  async listReibiAnnouncements() { return this.request('/api/reibi/announcements'); },
  async createReibiAnnouncement(payload: Record<string, any>) {
    return this.request('/api/reibi/announcements', { method: 'POST', body: JSON.stringify(payload) });
  },
  async updateReibiAnnouncement(id: number, payload: Record<string, any>) {
    return this.request(`/api/reibi/announcements/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },
  async registerReibiAnnouncement(id: number) { return this.request(`/api/reibi/announcements/${id}/register`, { method: 'POST' }); },
  async cancelReibiAnnouncement(id: number) { return this.request(`/api/reibi/announcements/${id}/register`, { method: 'DELETE' }); },
  async listReibiMessages() { return this.request('/api/reibi/integrations/messages'); },
  async createReibiMessage(payload: Record<string, any>) {
    return this.request('/api/reibi/integrations/messages', { method: 'POST', body: JSON.stringify(payload) });
  },
  async dispatchReibiMessage(id: number) { return this.request(`/api/reibi/integrations/messages/${id}/dispatch`, { method: 'POST' }); },
  async createReibiAccessRequest(payload: Record<string, any>) {
    return this.request('/api/reibi/access-requests', { method: 'POST', body: JSON.stringify(payload) });
  },
  async listReibiAccessRequests() { return this.request('/api/reibi/access-requests'); },
  async reviewReibiAccessRequest(id: number, payload: Record<string, any>) {
    return this.request(`/api/reibi/access-requests/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  async analyzeReibiRemittance(remittanceId: number, mimeType: string, dataBase64: string) {
    return this.request('/api/reibi/finance/remittances/ocr', { method: 'POST', body: JSON.stringify({ remittance_id: remittanceId, mime_type: mimeType, data_base64: dataBase64 }) });
  },

  async validateReibiArtifact(payload: {
    source_artifact: 'main' | 'l5' | 'quote' | 'workorder';
    source_version?: string;
    entries: Array<{ storage_key: string; value: any }>;
  }) {
    return this.request('/api/reibi/artifacts/validate', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  async importReibiArtifact(payload: {
    schema_version?: 'reibi-artifact-export/1.0';
    source_artifact: 'main' | 'l5' | 'quote' | 'workorder';
    source_version?: string;
    exported_at?: string;
    part?: number;
    parts?: number;
    export_sha256?: string;
    entries: Array<{ storage_key: string; value: any }>;
  }) {
    return this.request('/api/reibi/artifacts/import', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  // ==========================================
  // 通用方法
  // ==========================================
  
  async getHealth() {
    return this.request('/');
  },
};

export default API;
