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
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
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
  }) {
    const response = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        platform,
        ...loginData
      })
    });
    
    if (response.status === 'success' && response.data?.session) {
      this.setSession(response.data.session);
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
    
    const response = await this.request('/api/auth/switch-platform', {
      method: 'POST',
      query: {
        user_id: session.user_id,
        from_platform: session.platform,
        to_platform: toPlatform
      }
    });
    
    if (response.status === 'success' && response.data?.session) {
      this.setSession(response.data.session);
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
