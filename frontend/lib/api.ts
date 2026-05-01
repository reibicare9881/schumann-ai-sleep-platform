/**
 * 统一 API 客户端
 * Unified API Client for Sleep Platform
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ==========================================
// 请求配置
// ==========================================

interface APIResponse<T = any> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  detail?: string;
}

interface Session {
  session_id: string;
  user_id: string;
  platform: string;
  role?: string;
  access_token?: string;
  name?: string; // 🌟 補上 name 欄位，讓 LocalStorage 可以記住使用者的名字
}

// ==========================================
// API 客户端
// ==========================================

export const API = {
  // 存储当前会话
  currentSession: null as Session | null,
  
  // 设置会话
  setSession(session: Session) {
    this.currentSession = session;
    if (typeof window !== 'undefined') {
      localStorage.setItem('api_session', JSON.stringify(session));
    }
  },
  
  // 获取会话
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
  
  // 清除会话
  clearSession() {
    this.currentSession = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('api_session');
    }
  },
  
  // ==========================================
  // 基础请求方法
  // ==========================================
  
  async request<T>(
    endpoint: string,
    options: RequestInit & { query?: Record<string, any> } = {}
  ): Promise<APIResponse<T>> {
    let url = `${API_BASE_URL}${endpoint}`;
    
    // 处理查询参数
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
    
    // 🌟 新增：預先組裝 Headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      // 如果 options.headers 存在，則展開它
      ...(options.headers as Record<string, string> || {}),
    };

    // 🌟 新增：如果 Session 裡面有 Token，就加上 Authorization
    if (session && session.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    
    try {
      const response = await fetch(url, {
        ...options,
        headers, // 🌟 修改：直接放入我們組裝好的 headers
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || data.message || '请求失败');
      }
      
      return data;
    } catch (error) {
      console.error('API 请求错误:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : '未知错误'
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
  // 认证相关
  // ==========================================
  
  async login(platform: 'schumann' | 'sleep', loginData: {
    role?: string;
    pin?: string;
    org_code?: string;
    name?: string;
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
        access_token: accessToken // 🌟 把 JWT Token 一起存進 Session 中
      });
    }
    
    return response;
  },
  
  async logout() {
    const session = this.getSession();
    if (!session) return { status: 'error', message: '未登录' };
    
    const response = await this.request('/api/auth/logout', {
      method: 'POST',
      query: {
        session_id: session.session_id,
        platform: session.platform
      }
    });
    
    this.clearSession();
    return response;
  },
  
  async switchPlatform(toPlatform: 'schumann' | 'sleep') {
    const session = this.getSession();
    if (!session) return { status: 'error', message: '未登录' };
    
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
  
  // 提交评估
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
  
  // 获取睡眠报告列表
  async listSleepReports(userId: string) {
    return this.request('/api/sleep/reports', {
      query: { user_id: userId }
    });
  },
  
  // 获取单份睡眠报告
  async getSleepReport(reportId: string) {
    return this.request(`/api/sleep/reports/${reportId}`);
  },
  
  // 获取睡眠分析
  async getSleepAnalysis(userId: string) {
    return this.request(`/api/sleep/analysis/${userId}`);
  },
  
  // 获取 KPI
  async getOrgKPI(orgCode: string) {
    return this.request(`/api/sleep/kpi/${orgCode}`);
  },
  
  // ==========================================
  // 舒曼共振平台 API
  // ==========================================
  
  // 获取舒曼报告列表
  async listSchumannReports(userId: string) {
    return this.request('/api/schumann/reports', {
      query: { user_id: userId }
    });
  },
  
  // 获取单份舒曼报告
  async getSchumannReport(reportId: string) {
    return this.request(`/api/schumann/reports/${reportId}`);
  },
  
  // 上传舒曼报告
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
  }
};

export default API;
