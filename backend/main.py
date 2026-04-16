import io  # 🌟 必加：引入 io 模組
from fastapi import FastAPI, UploadFile, File, HTTPException
from modules.parser_module import parse_schumann_report
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="舒曼共振 AI 後端")

@app.get("/")
def read_root():
    return {"message": "舒曼共振分析 API 已啟動"}

@app.post("/api/analyze")
async def analyze_report(file: UploadFile = File(...)):
    try:
        # 1. 讀取位元組
        file_content = await file.read()
        
        # 2. 🌟 關鍵修正：將 bytes 轉為可 seek 的流對象
        file_stream = io.BytesIO(file_content)
        
        # 3. 呼叫模組時，傳入這個 stream 而不是原始 bytes
        api_key = os.getenv("GEMINI_API_KEY")
        parsed_data = parse_schumann_report(file_stream, api_key) # 這裡傳入 file_stream
        
        return {
            "status": "success",
            "extracted_data": parsed_data
        }
    except Exception as e:
        # 這裡會噴出詳細錯誤，方便你除錯
        import traceback
        traceback.print_exc() 
        raise HTTPException(status_code=500, detail=str(e))
    