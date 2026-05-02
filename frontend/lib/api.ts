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
}

// ==========================================
// API 客戶端
// ==========================================

export const API = {
  // 儲存當前會話
  currentSession: null as Session | null,
  
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
    if (options.query) {
      const params = new URLSearchParams();
      Object.entries(options.query).forEach(([key, value]) => {
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
        throw new Error(data.detail || data.message || '請求失敗');
      }
      
      return data;
    } catch (error) {
      console.error('API 請求錯誤:', error);
      return {
        status: 'error',
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
  
  async login(platform: 'schumann' | 'sleep', loginData: {
    role?: string;
    pin?: string;
    org_code?: string;
    name?: string;
    org_name?: string;
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
  
  async getUserPlatforms(userId: string) {
    return this.request(`/api/auth/user-platforms/${userId}`);
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
  
  // 獲取 KPI
  async getOrgKPI(orgCode: string) {
    return this.request(`/api/sleep/kpi/${orgCode}`);
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
  
  // 上傳舒曼報告
  async uploadSchumannReport(userId: string, data: Record<string, any>) {
    return this.request('/api/schumann/upload', {
      method: 'POST',
      query: { user_id: userId },
      body: JSON.stringify(data)
    });
  },
  
  // ==========================================
  // 通用方法
  // ==========================================
  
  async getHealth() {
    return this.request('/api/health');
  },
};

export default API;
