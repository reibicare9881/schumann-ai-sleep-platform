# 🔄 前后端集成指南

## 📊 系统架构

```
┌─────────────────────────────────────────────────────┐
│  前端 (Next.js 3000)                                │
│  ├─ Sleep Platform UI                              │
│  ├─ Schumann Platform UI                           │
│  └─ Platform Switcher                              │
└──────────────────┬──────────────────────────────────┘
                   │
                   ↓ HTTP / REST
        ┌──────────────────────┐
        │  统一后端 API (8000)  │
        │  ✅ 已激活运行中      │
        └──────────────────────┘
                   │
        ┌──────────┴──────────┐
        ↓                     ↓
   ┌─────────────┐    ┌──────────────┐
   │  Sleep DB   │    │  Schumann DB │
   │ (内存存储)   │    │ (内存存储)    │
   └─────────────┘    └──────────────┘
```

---

## ✅ 快速检查清单

- [x] **后端激活** ✨
  ```bash
  🚀 统一多平台 API 已在 http://localhost:8000 运行
  📚 API 文档: http://localhost:8000/docs
  ```

- [x] **API 客户端创建** ✨
  ```typescript
  // lib/api.ts 已创建
  - 统一认证
  - 睡眠平台 API
  - 舒曼平台 API
  - 平台切换
  ```

- [ ] **前端集成** (下一步)
  - 更新 AuthProvider 使用后端认证
  - 更新评估页面调用后端 API
  - 更新报告页面获取后端数据

---

## 🔌 前端集成方式

### 方式 1: 在现有代码中集成

#### 步骤 1: 更新登入页面

**文件**: `frontend/app/login/page.tsx`

```typescript
import { API } from "@/lib/api";

// 在登入按钮点击时
const handleLogin = async () => {
  const result = await API.login('sleep', {
    role: 'individual'  // 或其他角色
  });
  
  if (result.status === 'success') {
    // 登入成功，存储 session
    const { user, session } = result.data;
    router.push('/dashboard');
  } else {
    console.error('登入失败:', result.message);
  }
};
```

#### 步骤 2: 更新评估提交

**文件**: `frontend/app/assessment/page.tsx`

```typescript
import { API } from "@/lib/api";

const handleSubmit = async () => {
  const session = API.getSession();
  
  const response = await API.submitAssessment({
    user_id: session.user_id,
    profile: { /* ... */ },
    sleep_scores: sAns,
    pain_scores: pAns,
    work_scores: wAns
  });
  
  if (response.status === 'success') {
    const reportId = response.data.report_id;
    router.push(`/report/${reportId}`);
  }
};
```

#### 步骤 3: 更新报告显示

**文件**: `frontend/app/report/[id]/page.tsx`

```typescript
import { API } from "@/lib/api";

export default function ReportPage({ params }) {
  const [report, setReport] = useState(null);
  
  useEffect(() => {
    const loadReport = async () => {
      const result = await API.getSleepReport(params.id);
      if (result.status === 'success') {
        setReport(result.data.report);
      }
    };
    
    loadReport();
  }, [params.id]);
  
  // 使用 report 数据渲染页面
}
```

### 方式 2: 完全替换本地存储

在 `lib/store.ts` 中添加后端同步：

```typescript
export const DB = {
  async saveReport(report: any) {
    // 先保存到本地（离线支持）
    // ...
    
    // 然后同步到后端
    const session = API.getSession();
    if (session) {
      await API.submitAssessment({
        user_id: session.user_id,
        profile: report.profile,
        sleep_scores: report.sAns,
        pain_scores: report.pAns,
        work_scores: report.wAns
      });
    }
  },
  
  async loadReports(userId: string) {
    // 先从本地加载
    // 然后从后端获取最新
    const result = await API.listSleepReports(userId);
    if (result.status === 'success') {
      return result.data.reports;
    }
  }
};
```

---

## 🎮 平台切换实现

### 在前端添加平台切换按钮

```typescript
// 组件: components/PlatformSwitcher.tsx

import { API } from "@/lib/api";

export function PlatformSwitcher() {
  const [currentPlatform, setCurrentPlatform] = useState('sleep');
  
  const handleSwitch = async (to: 'schumann' | 'sleep') => {
    const result = await API.switchPlatform(to);
    
    if (result.status === 'success') {
      setCurrentPlatform(to);
      // 导航到对应平台的首页
      if (to === 'schumann') {
        window.location.href = '/schumann'; // 假设有此路由
      } else {
        window.location.href = '/dashboard';
      }
    }
  };
  
  return (
    <div>
      <button onClick={() => handleSwitch('sleep')}>
        🌙 睡眠平台
      </button>
      <button onClick={() => handleSwitch('schumann')}>
        🧠 舒曼共振
      </button>
    </div>
  );
}
```

---

## 📝 后端 API 端点速查表

### 认证
```
POST   /api/auth/login                   登入
POST   /api/auth/logout                  登出
POST   /api/auth/switch-platform         切换平台
GET    /api/auth/user-platforms/{id}     获取可用平台
```

### 睡眠平台
```
POST   /api/sleep/assessment             提交评估
GET    /api/sleep/reports                获取报告列表
GET    /api/sleep/reports/{id}           获取单份报告
GET    /api/sleep/analysis/{user_id}     获取分析数据
GET    /api/sleep/kpi/{org_code}         获取组织 KPI
```

### 舒曼平台
```
POST   /api/schumann/upload              上传报告
GET    /api/schumann/reports             获取报告列表
GET    /api/schumann/reports/{id}        获取单份报告
```

### 系统
```
GET    /                                 健康检查
GET    /api/health                       详细健康检查
GET    /api/platforms                    获取平台列表
```

---

## 🧪 测试 API

### 使用 Swagger UI

```
http://localhost:8000/docs
```

### 使用 curl 测试

```bash
# 睡眠平台登入
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"platform": "sleep", "role": "individual"}'

# 提交评估
curl -X POST http://localhost:8000/api/sleep/assessment \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_123",
    "profile": {"age": 30, "gender": "male"},
    "sleep_scores": {"s1": 1, "s2": 2, "s3": 1, "s4": 2, "s5": 1, "s6": 1, "s7": 1},
    "pain_scores": {"p1": 5, "p2": 4, "p3": 3, "p4": 2, "p5": 1},
    "work_scores": {"w1": 2, "w2": 2, "w3": 1}
  }'
```

---

## 🔐 环境变量配置

### 前端环境变量

**文件**: `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 后端环境变量

**文件**: `backend/.env`

```env
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=True
FRONTEND_URL=http://localhost:3000
```

---

## 🚀 启动完整系统

### Terminal 1: 启动后端 ✅

```bash
cd c:\sleepm\backend
python main.py
# 输出: 🚀 统一多平台 API 正在啟動...
#      📖 文檔: http://localhost:8000/docs
```

### Terminal 2: 启动前端

```bash
cd c:\sleepm\frontend
npm run dev
# 输出: ▲ Next.js app running on http://localhost:3000
```

### 访问应用

- 🌐 **前端**: http://localhost:3000
- 📚 **API 文档**: http://localhost:8000/docs
- 💻 **后端**: http://localhost:8000

---

## 📊 数据流示例

### 睡眠评估流程

```
1️⃣ 用户在前端填写评估问卷
   ↓
2️⃣ 点击"提交"按钮
   ↓
3️⃣ 前端调用 API.submitAssessment()
   ↓
4️⃣ 后端验证数据并计算得分
   ↓
5️⃣ 后端保存报告到内存数据库
   ↓
6️⃣ 返回 report_id 到前端
   ↓
7️⃣ 前端重定向到 /report/{report_id}
   ↓
8️⃣ 前端调用 API.getSleepReport() 获取报告详情
   ↓
9️⃣ 前端展示报告和建议
```

### 平台切换流程

```
用户在睡眠平台
   ↓
点击"切换到舒曼平台"按钮
   ↓
前端调用 API.switchPlatform('schumann')
   ↓
后端建立新会话 (schumann_session_xxx)
   ↓
返回新的 session_id
   ↓
前端存储新会话
   ↓
前端导航到舒曼平台页面
```

---

## ⚠️ 常见问题

### Q: 如何连接真实数据库？

A: 目前后端使用内存存储（测试用）。要连接实际数据库：

1. **Supabase** (推荐)
```python
from supabase import create_client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
db.sleep_reports[report_id] = report
supabase.table("sleep_reports").insert(report).execute()
```

2. **PostgreSQL**
```python
import asyncpg
conn = await asyncpg.connect('postgresql://...')
```

3. **MongoDB**
```python
from pymongo import MongoClient
client = MongoClient('mongodb://...')
```

### Q: 如何处理离线场景？

A: 使用混合策略：
- 保存到 localStorage（离线）
- 当有网络时，同步到后端
- 使用 Service Worker 缓存

### Q: 如何添加认证令牌？

A: 在 API 请求中添加 JWT：

```typescript
async request<T>(endpoint: string, options: any) {
  const session = this.getSession();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (session?.session_id) {
    headers['Authorization'] = `Bearer ${session.session_id}`;
  }
  
  // 继续请求...
}
```

---

## 📋 下一步

- [ ] 测试后端 API（使用 Swagger UI）
- [ ] 集成前端登入页面
- [ ] 集成前端评估提交
- [ ] 集成前端报告显示
- [ ] 实现平台切换功能
- [ ] 添加真实数据库连接
- [ ] 部署到生产环境

---

## 📞 快速参考

| 组件 | 状态 | 地址 |
|-----|------|------|
| 前端 | ⏳ 待启动 | http://localhost:3000 |
| 后端 API | ✅ 运行中 | http://localhost:8000 |
| API 文档 | ✅ 可用 | http://localhost:8000/docs |
| 舒曼平台 API | ✅ 已实现 | /api/schumann/* |
| 睡眠平台 API | ✅ 已实现 | /api/sleep/* |

---

**祝你集成顺利！🎉**
