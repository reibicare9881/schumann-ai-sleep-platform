# 麗媚生化科技 REIBI ｜ 健康自主管理平台
(Schumann Resonance & Sleep Health Platform)

本專案為企業級健康自主管理系統，結合 AI 數據分析與現代化 Web 架構，提供睡眠品質評估、疼痛追蹤、高風險族群預警與舒曼共振數據解析等全方位健康管理服務。

## 🌟 系統亮點 (Key Features)
* **雙軌平台架構**：整合「睡眠健康平台」與「舒曼共振平台」，單一帳號無縫切換。
* **多層級權限控制 (RBAC)**：支援個人用戶、單位成員、部門主管與高階管理員，資料存取嚴格去識別化。
* **企業級 KPI & OKR 儀表板**：自動計算健康促進指數 (HPI)、ROI 經濟效益與 ESG 永續健康指標。
* **AI 深度解析**：整合先進大型語言模型 (LLM)，將量子共振原始數據轉化為個人化身心靈解說報告。

## 🛡️ 安全與隱私 (Security & Privacy)
本系統高度重視醫療與健康個資保護，實作以下核心安全機制：
* **無狀態雲端架構**：採用 JWT (JSON Web Token) 進行身份驗證，後端完全無狀態化 (Stateless)。
* **Zero Trust 零信任驗證**：嚴格的路由保護機制，逾時自動登出，防範越權存取。
* **端到端加密準備**：前端敏感操作支援 Web Crypto API (AES-256-GCM) 緩存加密。
* **k-匿名性保護 (k-Anonymity)**：組織報表自動屏蔽少於最低門檻人數之部門，防止逆向識別個資。

## 🚀 技術堆疊 (Tech Stack)
* **Frontend**: Next.js (React), Tailwind CSS, TypeScript
* **Backend**: FastAPI (Python), Pydantic
* **Database & Auth**: Supabase (PostgreSQL)
* **AI Integration**: Google Gemini Vision & LLM

## ⚙️ 環境建置與啟動 (Getting Started)

### 1. 環境變數配置
請複製環境變數範例檔，並填入對應的 API 金鑰與資料庫連線資訊：
* 後端配置：參考 `backend/.env.example`
* 前端配置：參考 `frontend/.env.local.example`

### 2. 啟動後端 API 服務
```bash
cd backend
python -m venv venv
# 啟動虛擬環境 (Windows: venv\Scripts\activate / macOS: source venv/bin/activate)
pip install -r requirements.txt
uvicorn main:app --reload
```
### 3. 啟動前端使用者介面
```bash
cd frontend
npm install
npm run dev
```
## 📄 授權條款 (License)
* **Copyright © REIBI. All rights reserved.**
* **本系統版權所有，未經授權禁止任意重製、散佈或作為商業營利用途。**
