import fitz  # PyMuPDF
from PIL import Image
import io
import json
import google.generativeai as genai
from config import settings



def convert_pdf_to_images(uploaded_pdf):
    # 此函數接受 Streamlit 上傳的檔案物件 (PDF 或圖片)
    uploaded_pdf.seek(0)
    try:
        # 嘗試作為 PDF 處理
        doc = fitz.open(stream=uploaded_pdf.read(), filetype="pdf")
        images = []
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            pix = page.get_pixmap(dpi=150) # 解析度 150 DPI
            img_bytes = pix.tobytes("png")
            image = Image.open(io.BytesIO(img_bytes))
            images.append(image)
        return images
    except Exception:
        # 如果不是 PDF，可能是圖片檔案，直接開啟
        uploaded_pdf.seek(0)
        return [Image.open(uploaded_pdf)]

def crop_focus_regions(main_image):
    """
    動態將主圖切出三個需要極高精準度的局部放大圖。
    ⚠️ 注意：這裡的座標是基於 dpi=150 (約 1240 x 1754 像素) 的預估值，
    請依據您實際轉出的圖片大小進行微調！座標格式為 (左, 上, 右, 下)
    """
    try:
        width, height = main_image.size
        # 若寬度大約是 1240，以下是預估的裁切比例：
        box_personal = (80, 90, 890, 165)
        box_subjective = (80, 165, 900, 230)   # 左上角
        box_flower = (890, 290, 1180, 510)      # 右上角
        box_scatter = (900, 90, 1180, 290)   # 右側中段
        box_lf_hf = (35, 1095, 1140, 1470)
        box_hr = (35, 535, 1135, 810)
        box_sdnn = (35, 815, 1135, 1090)
        box_yinyang = (38, 1468, 1140, 1725)
        box_tianren = (230, 515, 930, 540)
        
        
        img_personal = main_image.crop(box_personal)
        img_subj = main_image.crop(box_subjective)
        img_flower = main_image.crop(box_flower)
        img_scatter = main_image.crop(box_scatter)
        img_lf_hf = main_image.crop(box_lf_hf)
        img_hr = main_image.crop(box_hr)
        img_sdnn = main_image.crop(box_sdnn)
        img_yinyang = main_image.crop(box_yinyang)
        img_tianren = main_image.crop(box_tianren)
        
        
        return [img_personal, img_subj, img_flower, img_scatter, img_lf_hf, img_hr ,img_sdnn, img_yinyang, img_tianren]
    except Exception as e:
        print(f"裁切圖片時發生錯誤: {e}")
        return []

def extract_data_with_vision_ai(images):
    genai.configure(api_key=settings.gemini_api_key)
    
    # 使用輕量級的 Flash 模型
    model_name = 'gemini-2.5-flash'
    # model_name = 'gemini-2.5-flash-lite'
    
    # ⚠️ 核心優化 1：強制模型只能輸出 JSON 格式 (Response Schema)，徹底消滅 Markdown 符號錯誤
    generation_config = genai.GenerationConfig(
        response_mime_type="application/json"
    )
    model = genai.GenerativeModel(model_name, generation_config=generation_config)
    
    # ⚠️ 核心優化 2：準備「1張全圖 + 3張局部放大圖」的聯合影像陣列
    main_image = images[0]
    cropped_images = crop_focus_regions(main_image)
    vision_input_images = [main_image] + cropped_images

    # ⚠️ 核心優化 3：JSON 內部思維鏈 Prompt (加入 _step_ 欄位強迫模型檢查)
    prompt = """
    請作為一位專業的身心靈數據萃取助手，仔細閱讀這份「舒曼共振床體驗結果分析報告」。
    我為您上傳了 10 張圖片：
    - 第 1 張：完整報告全圖（僅作為整體版面空間的參考）。
    - 第 2 張：個人資料局部放大圖（請專注提取姓名、年齡、性別、職業、體驗時間、音樂）。
    - 第 3 張：主觀壓力區塊局部放大圖（請專注使用此圖判斷打勾狀態）。
    - 第 4 張：生命之花區塊局部放大圖（請專注使用此圖判斷顏色與形狀）。
    - 第 5 張：象限分佈圖局部放大圖（請專注使用此圖判斷點位座標）。
    - 第 6 張：LF/HF 波形局部放大圖（⚠️ 請專注使用此圖判斷紅藍線條的交織狀態，及提取）。
    - 第 7 張：HR 波形局部放大圖（⚠️ 包含圖表與文字。請專注提取體驗前後數值、最低心率與官方判定文字）。
    - 第 8 張：SDNN 波形局部放大圖（⚠️ 包含圖表與文字。請專注提取體驗前後數值、與官方判定文字）。
    - 第 9 張：陰陽波形局部放大圖（⚠️ 請專注使用此圖判斷上方文字的陰陽比例%，並完全照抄「代表：」後的文字）。
    - 第 10 張：天人合一、LF/HF指數放大圖（⚠️ 請專注使用此圖提取「天人合一指數：」後的數值，和「LF/HF：」後的數值）。

    目標數據與資訊：
    1. 核心數據：請嚴格依照下方 JSON 中標註的【圖片編號】前往對應的局部圖抓取數值。
    2. 主觀/壓力 (Subjective_Conditions)：標準選項為 [昨晚失眠多夢, 昨晚飲酒、咖啡、茶, 容易入睡, 感冒, 生理期, 有練氣功、禪修, 敏感體質, 其他, 婦科手術]。請看【第 3 張圖】，空框(☐)絕對封殺，只有打勾(☑)才能提取。
    3. 生命之花：請看【第 4 張圖】。排除黑底。明亮度分為「深沉內斂/明亮耀眼」。形狀分為「尖銳/圓滑」。佔比分為「滿版/偏小」。
    4. 象限分佈圖 (Scatter_Plot_Analysis)：請看【第 5 張圖】。以數值70的水平線與垂直中線為界，分別判斷紅/藍/綠三色的「水平分佈」與「垂直高度」。

    ⚠️【極度重要：你必須嚴格遵守以下 JSON 結構回傳】
    請先在 "_step_" 開頭的欄位填寫你的觀察檢查過程，最後再把確定的答案填入正式欄位：
    {   
        "_step_subjective_check": "在此逐一檢查方框是否有打勾 (⚠️請寫在同一行，嚴禁換行)...",
        "_step_flower_check": "在此逐色描述觀察到的明暗狀態、邊緣與佔比 (⚠️請寫在同一行，嚴禁換行)...",
        "_step_scatter_check": "在此紀錄三種顏色的分佈區間與高度 (⚠️請寫在同一行，嚴禁換行)...",
        
        "Name": "【看第 2 張圖】提取姓名",
        "Gender": "【看第 2 張圖】提取性別",
        "Age": "【看第 2 張圖】提取年齡(純數字)",
        "Occupation": "【看第 2 張圖】提取職業",
        "Experience_Date": "【看第 2 張圖】提取體驗日期",
        "Subjective_Conditions": "【看第 3 張圖】只輸出確定打勾的選項，以 | 隔開。無則填無",
        "Experience_Time_Sec": "【看第 1 張全圖】看最下方波形圖最右下角X軸數字",
        "Unity_Index": "【看第 10 張圖】提取「天人合一指數：」後方的純數字",
        "Balance_Count": "【看第 6 張圖】提取「平衡次數為：」後方的純數字",
        "HR_Pre": "【看第 7 張圖】嚴格提取『體驗前的心率為:』與『BPM』中間的數字",
        "HR_Post": "【看第 7 張圖】嚴格提取『體驗後的心率為:』與『BPM』中間的數字。⚠️絕對禁止抓成『最低心率』的值！",
        "HR_Lowest": "【看第 7 張圖】嚴格提取『過程中最低心率為:』與『BPM』中間的純數字",
        "HR_Conclusion": "【看第 7 張圖】完全照抄『代表：』後面的文字",
        "SDNN_Pre": "【看第 8 張圖】嚴格提取『體驗前的心率變異率為:』後的數字",
        "SDNN_Post": "【看第 8 張圖】嚴格提取『體驗後的心率變異率為:』後的數字",
        "SDNN_Lowest_Trend": "【看第 8 張圖】純視覺觀察藍色實體線條的波谷(最低點)。判斷在整個圖表中，藍線是否有「接近或向下跌破 Y 軸數值 20 的水平線」？請唯一輸出「有接近或低於20」或「皆保持在20以上」。",
        "SDNN_Conclusion": "【看第 8 張圖】完全照抄『代表：』後面的文字",
        "LF_HF_Value": "【看第 10 張圖】精準提取「LF-HF：」後方的純數字",
        "LF_HF_Conclusion": "【看第 6 張圖】提取交感副交感平衡相關的結論",
        "LF_HF_Trend": "【看第 6 張圖】直接觀察實體線條。描述紅線(交感)與藍線(副交感)是「高度交織重疊」還是「上下分開無交集」",
        "Yin_Yang": "【看第 9 張圖】提取陰陽比例數字，並 100% 複製『代表：』後面的印刷文字，不得增減一字，絕對禁止自行解釋",
        "Flower_of_Life_Colors": "【看第 4 張圖】請逐一列出圖譜中出現的所有實體顏色。",
        "Flower_of_Life_Brightness_Detail": "【看第 4 張圖】請針對上述顏色，逐一標註其視覺狀態。格式：[顏色：明亮/暗沉]。⚠️嚴禁因為圖面部分發光就將所有顏色一律腦補為明亮！",
        "Flower_of_Life_Brightness": "【看第 4 張圖】簡述整體的明暗調性。",
        "Flower_of_Life_Shape": "【看第 4 張圖】判斷尖銳或圓滑",
        "Flower_of_Life_Extent": "【看第 4 張圖】判斷滿版或偏小",
        "Scatter_Plot_Analysis": "【看第 5 張圖】觀察紅藍綠點水平分佈(X軸)。若點位綿延到最右邊，請判定為「水平置中均勻分佈」；嚴禁將滿版腦補成偏左或偏右。接著觀察垂直高度給出結論。"
    }
    """
    
    # 將 Prompt 與 4 張圖片一起發送
    request_content = [prompt] + vision_input_images
    response = model.generate_content(request_content)
    
    try:
        # 因為啟用了 response_mime_type="application/json"，回傳必定是純 JSON 字串
        extracted_data = json.loads(response.text.strip())
        
        # 移除供 AI 思考用的輔助欄位，讓最終字典保持乾淨
        keys_to_remove = ["_step_subjective_check", "_step_flower_check", "_step_scatter_check"]
        for k in keys_to_remove:
            extracted_data.pop(k, None)
        
        # 進一步的數據清理，確保數值類型正確
        for key in ["Unity_Index", "Balance_Count", "HR_Pre", "HR_Post", "SDNN_Pre", "SDNN_Post", "LF_HF_Value"]:
            if key in extracted_data:
                try:
                    raw_val = extracted_data[key]
                    if isinstance(raw_val, str):
                         cleaned_val = raw_val.strip().replace(" ", "")
                         extracted_data[key] = float(cleaned_val)
                except ValueError:
                    pass
        
        return extracted_data
    except Exception as e:
        raise ValueError(f"AI 解析失敗。錯誤資訊: {e}\nAI原始回應: {response.text}")

def parse_schumann_report(uploaded_file):
    # 主流程不變：檔案 -> 圖片清單 -> 視覺 AI 萃取
    images = convert_pdf_to_images(uploaded_file)
    extracted_data = extract_data_with_vision_ai(images)
    return extracted_data