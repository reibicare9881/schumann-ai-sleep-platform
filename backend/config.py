from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # --- 🔐 核心資安與 AI 金鑰 (必填) ---
    gemini_api_key: str
    jwt_secret_key: str

    # --- 🗄️ Supabase 資料庫連線 (必填，原本缺漏) ---
    supabase_url: str
    supabase_service_role_key: str

    # --- 🌐 伺服器與 CORS 設定 (建議給預設值防呆) ---
    frontend_url: str = "http://localhost:3000"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    debug: bool = True

    class Config:
        env_file = ".env"
        # 加上這行，即使 .env 裡有其他沒定義在 class 裡的變數，也不會報錯
        extra = "ignore" 

settings = Settings()