# Schumann Platform

Schumann Platform 是一個現代化的全棧應用，結合了 FastAPI 後端和 Next.js 前端。

## 項目結構

```
/schumann-platform
│
├── /backend            # FastAPI 專案 (AI 處理、數據運算)
│   ├── main.py         # API 入口
│   ├── modules/        # 移植過來的 parser, analyzer, pdf_generator
│   ├── requirements.txt
│   └── .env
│
├── /frontend           # Next.js / Node.js 專案 (使用者介面、Dashboard)
│   ├── /app            # Next.js App Router
│   ├── /components     # UI 元件 (如看板、圖表)
│   ├── .env.local
│   └── package.json
│
├── .gitignore          # 排除 venv, node_modules, .env
└── README.md
```

## 快速開始

### 後端 (Backend)

1. 創建虛擬環境
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
# 或
source venv/bin/activate  # macOS/Linux
```

2. 安裝依賴
```bash
pip install -r requirements.txt
```

3. 運行 API 服務器
```bash
python main.py
# 或
uvicorn main:app --reload
```

API 將在 `http://localhost:8000` 上運行

### 前端 (Frontend)

1. 安裝依賴
```bash
cd frontend
npm install
```

2. 運行開發服務器
```bash
npm run dev
```

前端將在 `http://localhost:3000` 上運行

## API 文檔

啟動後端服務後，訪問 `http://localhost:8000/docs` 查看 Swagger API 文檔。

## 環境變數

### Backend (.env)
- `API_HOST`: API 服務器主機 (預設: 0.0.0.0)
- `API_PORT`: API 服務器端口 (預設: 8000)
- `DEBUG`: 調試模式 (預設: True)
- `DATABASE_URL`: 數據庫連接字符串

### Frontend (.env.local)
- `NEXT_PUBLIC_API_URL`: 後端 API 基礎 URL

## 技術棧

- **後端**: FastAPI, Python
- **前端**: Next.js, React, TypeScript
- **包管理**: pip (Python), npm (Node.js)

## 開發

### 安裝前端依賴
```bash
cd frontend
npm install
```

### 建構生產版本

後端:
```bash
cd backend
# 準備部署...
```

前端:
```bash
cd frontend
npm run build
npm start
```

## 許可證

MIT
