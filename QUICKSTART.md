# 🚀 快速开始 - 方案A集成

**当前状态**: ✅ 后端 + 前端认证层已就绪  
**集成进度**: 48% - 核心基础设施完成

---

## 🎯 5分钟快速验证

### 1️⃣ 启动后端 API

```bash
cd c:\sleepm
python backend\main.py
```

**预期输出**:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
```

✅ **检查点**: 访问 http://localhost:8000/docs (Swagger UI)

---

### 2️⃣ 启动前端开发服务器

```bash
cd c:\sleepm\frontend
npm run dev
```

**预期输出**:
```
> next dev

  ▲ Next.js 14.x.x
  - Local:        http://localhost:3000
```

✅ **检查点**: 访问 http://localhost:3000

---

### 3️⃣ 测试集成

```bash
python c:\sleepm\test_integration.py
```

**这会自动测试**:
- ✓ 后端连接
- ✓ 个人登入
- ✓ 组织登入  
- ✓ 评估提交
- ✓ 报告获取
- ✓ 平台切换

---

## 📱 手动测试流程

### 登入测试

1. 打开 http://localhost:3000
2. **个人模式**:
   - 点击"个人使用"
   - 输入任意姓名
   - 点击"进入"
   - ✅ 应该进入仪表板

3. **组织模式**:
   - 返回登入页面
   - 点击"单位/组织"
   - 选择"成员"角色
   - 代码: `ABC123`
   - 姓名: 任意
   - PIN: `1111`
   - 点击"登入"
   - ✅ 应该进入仪表板

---

### 查看浏览器控制台

打开开发者工具 (`F12`) → 检查 `Console` 选项卡

**你应该看到**:
```
[API] Initializing API client
[Auth] AuthProvider mounted
[Auth] Checking backend availability...
[Auth] Backend authentication successful ✓
[Auth] Session saved: user_xxx
```

**如果看到错误**:
```
[Auth] Backend unavailable, falling back to localStorage
```
这是正常的，系统会自动使用本地存储备用。

---

## 🧪 运行集成测试

### Python 集成测试 (推荐)

```bash
cd c:\sleepm
python test_integration.py
```

**输出示例**:
```
════════════════════════════════════════
✓ 健康检查    通过
✓ 个人登入    通过
✓ 组织登入    通过
✓ 评估提交    通过
✓ 报告列表    通过
✓ 平台切换    通过
════════════════════════════════════════

✓ 所有测试都通过了! (6/6)
✨ 前后端集成正常工作！
```

### PowerShell API 测试 (备选)

```powershell
cd c:\sleepm
.\test_api.ps1
```

---

## 🔧 故障排除

### ❌ "无法连接到后端"

**检查清单**:
- [ ] 后端在运行? (`python backend\main.py`)
- [ ] 端口 8000 是否被占用?
  ```bash
  netstat -ano | findstr :8000
  ```
- [ ] 防火墙是否阻止?
  - 尝试访问 http://localhost:8000/
  - 应该看到 JSON 响应

**解决方案**:
```bash
# 杀死占用 8000 端口的进程
netstat -ano | findstr :8000
# 记下 PID，然后
taskkill /PID <PID> /F

# 重启后端
python backend\main.py
```

---

### ❌ "前端无法连接到后端"

**检查清单**:
- [ ] `.env.local` 文件存在?
  ```bash
  type c:\sleepm\frontend\.env.local
  ```
  应该包含:
  ```
  NEXT_PUBLIC_API_URL=http://localhost:8000
  ```
  
- [ ] 需要重新启动前端?
  ```bash
  # 停止现有进程 (Ctrl+C)
  # 再启动一次
  npm run dev
  ```

**解决方案**:
```bash
# 创建 .env.local 文件
cd c:\sleepm\frontend
echo NEXT_PUBLIC_API_URL=http://localhost:8000 > .env.local

# 重启前端
npm run dev
```

---

### ❌ "PIN 验证失败"

**有效的测试 PIN**:
```
个人: 任意 (个人模式不需要 PIN)
成员: 1111
部长: 2222
管理: 3333
```

**测试组织代码**:
```
ABC123
```

---

### ❌ "登入后进不了仪表板"

**检查**:
1. 浏览器控制台有错误吗?
2. 会话是否正确保存?
   ```javascript
   // 在浏览器控制台执行
   localStorage.getItem('api_session')
   ```
3. 查看 Chrome DevTools → Network 选项卡
   - 检查 API 请求是否成功

---

## 📊 系统状态检查

### 后端状态

```bash
curl http://localhost:8000/
```

**正常响应**:
```json
{
  "status": "online",
  "service": "統一多平台 API",
  "platforms": ["schumann", "sleep"]
}
```

### API 文档

访问 **http://localhost:8000/docs** 查看所有可用端点

### 前端健康检查

打开 F12，在控制台运行:
```javascript
// 检查 API 是否初始化
window.__API__

// 检查会话
JSON.parse(localStorage.getItem('api_session') || '{}')

// 检查认证状态
window.__AUTH__  // 需要在组件中访问
```

---

## 📝 下一步任务

根据 [PLAN_A_PROGRESS.md](PLAN_A_PROGRESS.md) 中的清单：

| 优先级 | 任务 | 预计时间 | 状态 |
|------|------|---------|------|
| 🔴 | 评估页面集成 | 20分钟 | ⏳ 待开始 |
| 🔴 | 报告页面集成 | 15分钟 | ⏳ 待开始 |
| 🟡 | 历史/分析页面 | 25分钟 | ⏳ 待开始 |
| 🟡 | 平台切换器 UI | 10分钟 | ⏳ 待开始 |
| 🟢 | 数据迁移 | 1小时 | 📅 可选 |
| 🟢 | Supabase 集成 | 1小时 | 📅 可选 |

---

## 💡 提示

### 开发模式下的有用快捷键

```
前端:
  Ctrl+C          停止开发服务器
  npm run dev      重启开发服务器
  F12             打开开发者工具

后端:
  Ctrl+C          停止服务器
  python main.py  重启服务器
  访问 /docs      查看 Swagger API 文档
```

### 开发时常用命令

```bash
# 清理并重新安装依赖
cd c:\sleepm\frontend
rm node_modules
npm install
npm run dev

# 检查 TypeScript 错误
npm run type-check

# 构建生产版本 (可选)
npm run build
npm start
```

---

## ✅ 验证清单

完成这些检查后，系统应该完全就绪：

- [ ] 后端运行在 localhost:8000
- [ ] 前端运行在 localhost:3000
- [ ] 浏览器能访问 /docs API 文档
- [ ] 集成测试全部通过
- [ ] 可以通过登入页面登入
- [ ] 仪表板能打开 (进入前的重定向工作)
- [ ] 浏览器控制台无重大错误

**如果都通过了** ✨ → 你已准备好进行下一步页面集成！

---

## 📞 快速参考

### 重要文件位置

```
c:\sleepm\
├── backend\main.py              ← 后端 API
├── frontend\lib\api.ts          ← API 客户端
├── frontend\components\AuthProvider.tsx  ← 认证系统
├── frontend\app\login\page.tsx  ← 登入页面
├── PLAN_A_PROGRESS.md           ← 集成进度
├── INTEGRATION_GUIDE.md         ← 详细文档
├── test_integration.py          ← 自动化测试
└── test_api.ps1                 ← PowerShell 测试
```

### API 端点速览

```
后端可用性:
  GET  /                    # 健康检查

认证:
  POST /api/auth/login              # 登入
  POST /api/auth/logout             # 登出
  POST /api/auth/switch-platform    # 平台切换

睡眠平台:
  POST /api/sleep/assessment        # 提交评估
  GET  /api/sleep/reports           # 获取报告列表
  GET  /api/sleep/reports/{id}      # 获取单份报告

舒曼平台:
  POST /api/schumann/upload         # 上传报告
  GET  /api/schumann/reports        # 获取报告列表
```

---

**祝你测试顺利! 如有问题，查看详细文档 [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)** 🎉
