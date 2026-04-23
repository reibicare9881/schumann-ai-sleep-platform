# import io
# import os
# import traceback
# from typing import Optional

# from fastapi import FastAPI, UploadFile, File, Form, HTTPException
# from fastapi.middleware.cors import CORSMiddleware
# from dotenv import load_dotenv
# from supabase import create_client, Client

# # 引入你原本的模組
# from modules.parser_module import parse_schumann_report
# from modules.ai_analyzer_module import generate_ai_explanation
# from modules.pdf_generator_module import create_full_report_pdf

# load_dotenv()

# app = FastAPI(title="舒曼共振 AI 後端 (Next.js 整合版)")

# # ==========================================
# # 1. 跨網域設定 (CORS) - 讓前端 Node.js 能存取
# # ==========================================
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],  # 正式環境建議改為 ['http://localhost:3000']
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # ==========================================
# # 2. 初始化 Supabase 客戶端
# # ==========================================
# SUPABASE_URL = os.getenv("SUPABASE_URL")
# SUPABASE_KEY = os.getenv("SUPABASE_KEY")
# supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
# GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# @app.get("/")
# def read_root():
#     return {"message": "舒曼共振分析 API 已啟動，等待前端請求。"}

# @app.post("/api/analyze")
# async def analyze_report(
#     user_id: str = Form(...),            # 從前端傳來的 UUID
#     assessment_round: int = Form(1),      # 週期 (1~5)
#     file: UploadFile = File(...)
# ):
#     try:
#         # --- A. 讀取與解析檔案 ---
#         file_content = await file.read()
#         file_stream = io.BytesIO(file_content)
        
#         # 1. AI 數據萃取 (27 個指標)
#         parsed_data = parse_schumann_report(file_stream, GEMINI_API_KEY)
        
#         # 2. AI 深度解說撰寫 (長篇文字)
#         # 假設你的模組返回 dict 或 str
#         ai_analysis_result = generate_ai_explanation(parsed_data, GEMINI_API_KEY)
        
#         # --- B. 生成 PDF 並上傳至 Storage ---
#         # 重置指針以供 PDF 模組讀取
#         file_stream.seek(0)
        
#         # 這裡將 AI 的各個 section 整理出來供 PDF 生成
#         sections = [
#             ("心率變化分析", ai_analysis_result.get("section_1", "")),
#             ("心律變異(SDNN)分析", ai_analysis_result.get("section_2", "")),
#             ("自律神經平衡狀態", ai_analysis_result.get("section_3", "")),
#             ("自律神經動態象限解析", ai_analysis_result.get("section_4", "")),
#             ("體內陰陽能量比例", ai_analysis_result.get("section_5", "")),
#             ("天人合一指數", ai_analysis_result.get("section_6", "")),
#             ("生命之花圖譜分析", ai_analysis_result.get("section_7", "")),
#             ("整體修復建議", ai_analysis_result.get("section_8", ""))
#         ]
        
#         pdf_bytes, _ = create_full_report_pdf(sections, file)
        
#         # 上傳至 Supabase Storage
#         file_path = f"{user_id}/report_{assessment_round}_{os.urandom(4).hex()}.pdf"
#         supabase.storage.from_("reports").upload(
#             path=file_path,
#             file=pdf_bytes,
#             file_options={"content-type": "application/pdf"}
#         )
#         report_url = supabase.storage.from_("reports").get_public_url(file_path)

#         # --- C. 將完整數據寫入資料庫 ---
#         db_record = {
#             "user_id": user_id,
#             "assessment_round": assessment_round,
#             "name_extracted": parsed_data.get("Name"),
#             "gender_extracted": parsed_data.get("Gender"),
#             "age_extracted": parsed_data.get("Age"),
#             "experience_date": parsed_data.get("Experience_Date"),
#             "subjective_conditions": parsed_data.get("Subjective_Conditions"),
#             "experience_time_sec": parsed_data.get("Experience_Time_Sec"),
#             "hr_pre": parsed_data.get("HR_Pre"),
#             "hr_post": parsed_data.get("HR_Post"),
#             "hr_lowest": parsed_data.get("HR_Lowest"),
#             "hr_conclusion": parsed_data.get("HR_Conclusion"),
#             "sdnn_pre": parsed_data.get("SDNN_Pre"),
#             "sdnn_post": parsed_data.get("SDNN_Post"),
#             "sdnn_lowest_trend": parsed_data.get("SDNN_Lowest_Trend"),
#             "sdnn_conclusion": parsed_data.get("SDNN_Conclusion"),
#             "unity_index": parsed_data.get("Unity_Index"),
#             "balance_count": parsed_data.get("Balance_Count"),
#             "lf_hf_value": parsed_data.get("LF_HF_Value"),
#             "lf_hf_conclusion": parsed_data.get("LF_HF_Conclusion"),
#             "lf_hf_trend": parsed_data.get("LF_HF_Trend"),
#             "yin_yang": parsed_data.get("Yin_Yang"),
#             "flower_colors": parsed_data.get("Flower_of_Life_Colors"),
#             "flower_brightness_detail": parsed_data.get("Flower_of_Life_Brightness_Detail"),
#             "flower_brightness": parsed_data.get("Flower_of_Life_Brightness"),
#             "flower_shape": parsed_data.get("Flower_of_Life_Shape"),
#             "flower_extent": parsed_data.get("Flower_of_Life_Extent"),
#             "scatter_plot_analysis": parsed_data.get("Scatter_Plot_Analysis"),
#             "ai_summary": str(ai_analysis_result),
#             "report_url": report_url,
#             "sleep_quality_score": 80  # 這裡未來可以加入你的計算公式
#         }

#         insert_res = supabase.table("analysis_records").insert(db_record).execute()

#         return {
#             "status": "success",
#             "record_id": insert_res.data[0]['id'] if insert_res.data else None,
#             "report_url": report_url,
#             "data": parsed_data
#         }

#     except Exception as e:
#         traceback.print_exc()
#         raise HTTPException(status_code=500, detail=str(e))


# TEST

import io
import os
import traceback
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from supabase import create_client, Client

# 引入你原本的模組
from modules.parser_module import parse_schumann_report
from modules.ai_analyzer_module import generate_ai_explanation
from modules.pdf_generator_module import create_full_report_pdf

load_dotenv()

app = FastAPI(title="舒曼共振 AI 後端 (測試模式)")

# ==========================================
# 1. 跨網域設定 (CORS)
# ==========================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 2. 初始化 Supabase 客戶端
# ==========================================
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

@app.get("/")
def read_root():
    return {"message": "舒曼共振分析 API 已啟動 (目前為 Mock 測試模式)"}

@app.post("/api/analyze")
async def analyze_report(
    user_id: str = Form(...),
    assessment_round: int = Form(1),
    file: UploadFile = File(...)
):
    try:
        # --- A. 模擬讀取檔案 (僅為了流程完整) ---
        file_content = await file.read()
        file_stream = io.BytesIO(file_content)
        
        # ==========================================
        # 🌟 測試模式：註解 AI 並提供假數據
        # ==========================================
        # 1. 模擬 AI 數據萃取 (27 個指標)
        # parsed_data = parse_schumann_report(file_stream, GEMINI_API_KEY)
        parsed_data = {
            "Name": "吳美鳳(測試)",
            "Gender": "女",
            "Age": 53,
            "Occupation": "商",
            "Experience_Date": "2026-04-20",
            "Subjective_Conditions": "測試用：容易入睡但淺眠",
            "Experience_Time_Sec": 672,
            "Unity_Index": 78,
            "Balance_Count": 12,
            "HR_Pre": 60,
            "HR_Post": 60,
            "HR_Lowest": 51,
            "HR_Conclusion": "體驗過程有效放鬆，且有進入到小睡狀態",
            "SDNN_Pre": 25,
            "SDNN_Post": 22,
            "SDNN_Lowest_Trend": "有接近或低於20",
            "SDNN_Conclusion": "心律彈性異常，建議就醫檢查",
            "LF_HF_Value": 18,
            "LF_HF_Conclusion": "交感副交感能量不平衡，身體處於疲累",
            "LF_HF_Trend": "高度交織重疊",
            "Yin_Yang": "陽28%/陰72% 代表:身體能量偏陰",
            "Flower_of_Life_Colors": "深紅,深藍,金色",
            "Flower_of_Life_Brightness_Detail": "[深紅：暗沉],[深藍：暗沉],[金色：明亮]",
            "Flower_of_Life_Brightness": "暗沉內斂",
            "Flower_of_Life_Shape": "尖銳",
            "Flower_of_Life_Extent": "滿版",
            "Scatter_Plot_Analysis": "測試數據：紅色與藍色點位水平置中均勻分佈。"
        }
        
        # 2. 模擬 AI 深度解說
        # ai_analysis_result = generate_ai_explanation(parsed_data, GEMINI_API_KEY)
        ai_analysis_result = {
            f"section_{i}": f"這是針對第 {i} 區塊的測試解說文字內容，用於驗證 PDF 生成。 " * 5 
            for i in range(1, 9)
        }
        # ==========================================
        
        # --- B. 生成 PDF 並上傳至 Storage ---
        # 重置指針以供 PDF 模組讀取
        await file.seek(0)
        
        sections = [
            ("心率變化分析", ai_analysis_result.get("section_1", "")),
            ("心律變異(SDNN)分析", ai_analysis_result.get("section_2", "")),
            ("自律神經平衡狀態", ai_analysis_result.get("section_3", "")),
            ("自律神經動態象限解析", ai_analysis_result.get("section_4", "")),
            ("體內陰陽能量比例", ai_analysis_result.get("section_5", "")),
            ("天人合一指數", ai_analysis_result.get("section_6", "")),
            ("生命之花圖譜分析", ai_analysis_result.get("section_7", "")),
            ("整體修復建議", ai_analysis_result.get("section_8", ""))
        ]
        
        # 執行 PDF 生成 (使用你剛修好路徑的模組)
        pdf_bytes, _ = create_full_report_pdf(sections, file)
        
        if pdf_bytes is None:
            raise HTTPException(status_code=500, detail="PDF 生成失敗，請檢查字體路徑")

        # 上傳至 Supabase Storage
        file_path = f"{user_id}/report_{assessment_round}_{os.urandom(4).hex()}.pdf"
        supabase.storage.from_("reports").upload(
            path=file_path,
            file=pdf_bytes,
            file_options={"content-type": "application/pdf"}
        )
        report_url = supabase.storage.from_("reports").get_public_url(file_path)

        # --- C. 將完整數據寫入資料庫 ---
        db_record = {
            "user_id": user_id,
            "assessment_round": assessment_round,
            "name_extracted": parsed_data.get("Name"),
            "gender_extracted": parsed_data.get("Gender"),
            "age_extracted": parsed_data.get("Age"),
            "experience_date": parsed_data.get("Experience_Date"),
            "subjective_conditions": parsed_data.get("Subjective_Conditions"),
            "experience_time_sec": parsed_data.get("Experience_Time_Sec"),
            "hr_pre": parsed_data.get("HR_Pre"),
            "hr_post": parsed_data.get("HR_Post"),
            "hr_lowest": parsed_data.get("HR_Lowest"),
            "hr_conclusion": parsed_data.get("HR_Conclusion"),
            "sdnn_pre": parsed_data.get("SDNN_Pre"),
            "sdnn_post": parsed_data.get("SDNN_Post"),
            "sdnn_lowest_trend": parsed_data.get("SDNN_Lowest_Trend"),
            "sdnn_conclusion": parsed_data.get("SDNN_Conclusion"),
            "unity_index": parsed_data.get("Unity_Index"),
            "balance_count": parsed_data.get("Balance_Count"),
            "lf_hf_value": parsed_data.get("LF_HF_Value"),
            "lf_hf_conclusion": parsed_data.get("LF_HF_Conclusion"),
            "lf_hf_trend": parsed_data.get("LF_HF_Trend"),
            "yin_yang": parsed_data.get("Yin_Yang"),
            "flower_colors": parsed_data.get("Flower_of_Life_Colors"),
            "flower_brightness_detail": parsed_data.get("Flower_of_Life_Brightness_Detail"),
            "flower_brightness": parsed_data.get("Flower_of_Life_Brightness"),
            "flower_shape": parsed_data.get("Flower_of_Life_Shape"),
            "flower_extent": parsed_data.get("Flower_of_Life_Extent"),
            "scatter_plot_analysis": parsed_data.get("Scatter_Plot_Analysis"),
            "ai_summary": str(ai_analysis_result),
            "report_url": report_url,
            "sleep_quality_score": 80
        }

        insert_res = supabase.table("analysis_records").insert(db_record).execute()

        return {
            "status": "success",
            "message": "測試模式：已跳過 AI，成功寫入假數據與生成 PDF",
            "record_id": insert_res.data[0]['id'] if insert_res.data else None,
            "report_url": report_url,
            "data": parsed_data
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
