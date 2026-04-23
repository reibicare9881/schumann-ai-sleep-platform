from fpdf import FPDF
import os
import io
from pypdf import PdfWriter, PdfReader

def write_cjk_text(pdf, text, line_height=7):
    """專為中文字串設計的精準換行函數，徹底解決 multi_cell 的當機問題"""
    max_w = pdf.w - pdf.l_margin - pdf.r_margin - 2 # 留 2mm 緩衝區
    current_line = ""
    
    words = text.split(' ') if ' ' in text else list(text)
    
    if ' ' in text: 
        for word in words:
            if pdf.get_string_width(current_line + word + " ") > max_w:
                pdf.cell(0, line_height, txt=current_line, ln=True)
                current_line = word + " "
            else:
                current_line += word + " "
    else: 
        for char in text:
            if pdf.get_string_width(current_line + char) > max_w:
                pdf.cell(0, line_height, txt=current_line, ln=True)
                current_line = char
            else:
                current_line += char
                
    if current_line.strip():
        pdf.cell(0, line_height, txt=current_line.strip(), ln=True)

def create_full_report_pdf(sections, uploaded_file=None, language="🇹🇼 繁體中文"):
    # 🌟 這裡加入絕對路徑的定位邏輯
    current_dir = os.path.dirname(os.path.abspath(__file__))
    fonts_dir = os.path.join(current_dir, "..", "assets", "fonts")

    # 🌟 核心修改：動態切換字體檔案 (結合絕對路徑)
    if language == "🇯🇵 日本語":
        font_path = os.path.join(fonts_dir, "NotoSansJP-Regular.ttf")
        font_name = "NotoSansJP"
    elif language == "🇨🇳 簡體中文":
        font_path = os.path.join(fonts_dir, "NotoSansSC-Regular.ttf")
        font_name = "NotoSansSC"
    else: 
        # 繁體中文與英文共用 TC 字體
        font_path = os.path.join(fonts_dir, "NotoSansTC-Regular.ttf")
        font_name = "NotoSansTC"
        
    has_font = os.path.exists(font_path)
    
    if not has_font:
        # 這裡會印出完整的絕對路徑，如果還是找不到，看這行終端機訊息最準
        print(f"找不到字體檔案: {os.path.abspath(font_path)}") 
        return None, False
    
    # 🌟 根據選擇的語言設定對應的 PDF 標籤文字
    if language == "🇺🇸 English":
        main_title_text = "Schumann Resonance Deep Analysis Report"
        lbl_element = "Element"
        lbl_chakra = "Chakra"
        lbl_meaning = "Meaning"
        lbl_status = "Status"
    elif language == "🇯🇵 日本語":
        main_title_text = "シューマン共振 深層分析レポート"
        lbl_element = "五行"
        lbl_chakra = "チャクラ"
        lbl_meaning = "意味"
        lbl_status = "状態"
    elif language == "🇨🇳 簡體中文":
        main_title_text = "舒曼共振体验结果深度解析报告"
        lbl_element = "五行"
        lbl_chakra = "脉轮"
        lbl_meaning = "含意"
        lbl_status = "状态"
    else: # 🇹🇼 繁體中文
        main_title_text = "舒曼共振體驗結果深度解析報告"
        lbl_element = "五行"
        lbl_chakra = "脈輪"
        lbl_meaning = "含意"
        lbl_status = "狀態"

    pdf = FPDF()
    
    is_image = False
    is_pdf = False
    if uploaded_file is not None:
        # ⚠️ 注意：FastAPI 的 UploadFile 物件沒有 .name，而是 .filename
        file_ext = uploaded_file.filename.split('.')[-1].lower() 
        if file_ext in ['png', 'jpg', 'jpeg']:
            is_image = True
        elif file_ext == 'pdf':
            is_pdf = True

    if is_image:
        pdf.add_page()
        temp_img_path = f"temp_upload_img.{file_ext}"
        # ⚠️ 注意：FastAPI 需要用 await read() 取得 bytes，所以這裡做了一點適應性調整
        # 假設傳進來的是 bytes 或是已經 read 過的 BytesIO
        file_bytes = uploaded_file.file.read() if hasattr(uploaded_file, 'file') else uploaded_file.read()
        with open(temp_img_path, "wb") as f:
            f.write(file_bytes)
        
        pdf.image(temp_img_path, x=10, y=10, w=190, h=0)
        os.remove(temp_img_path) 

    pdf.add_page()
    pdf.add_font(font_name, '', font_path)
    
    pdf.set_font(font_name, '', 18)
    pdf.set_text_color(42, 90, 59) 
    pdf.cell(0, 15, txt=main_title_text, align='C', ln=True)
    pdf.ln(5)
    
    for title, content in sections:
        pdf.set_font(font_name, '', 14)
        pdf.set_text_color(255, 255, 255) 
        pdf.set_fill_color(79, 138, 101)  
        pdf.cell(0, 10, txt=f"  {title} ", align='L', fill=True, ln=True)
        pdf.ln(3)
        
        clean_content = content.replace("**", "").replace("* ", "• ")
        
        lines = clean_content.split('\n')
        for line in lines:
            line = line.strip()
            if not line:
                pdf.ln(2)
                continue
                
            if line.startswith("|") and line.endswith("|"):
                if "---" in line:
                    continue 
                    
                cells = [c.strip() for c in line.strip("|").split("|")]
                
                # 同時檢查中文與英文的表頭關鍵字，日文的「色」也防禦到了
                if len(cells) >= 2 and ("顏色" in cells[0] or "颜色" in cells[0] or "Color" in cells[0] or "色" in cells[0]):
                    continue 
                    
                if len(cells) >= 5:
                    color, wuxing, chakra, meaning, status = cells[:5]
                    
                    pdf.set_font( font_name, '', 12)
                    pdf.set_text_color(42, 90, 59) 
                    write_cjk_text(pdf, f"✦ {color} ({lbl_element}: {wuxing} / {lbl_chakra}: {chakra})", line_height=8)
                    
                    pdf.set_font( font_name, '', 11)
                    pdf.set_text_color(60, 60, 60)
                    write_cjk_text(pdf, f"  ▸ {lbl_meaning}: {meaning}", line_height=6)
                    write_cjk_text(pdf, f"  ▸ {lbl_status}: {status}", line_height=6)
                    pdf.ln(2)
                else:
                    pdf.set_font( font_name, '', 11)
                    pdf.set_text_color(0, 0, 0)
                    write_cjk_text(pdf, " | ".join(cells), line_height=6)
                continue
            
            if line.startswith("【") and "】" in line:
                end_idx = line.find("】") + 1
                title_part = line[:end_idx]
                rest_part = line[end_idx:].strip()
                
                pdf.set_font( font_name, '', 13)
                pdf.set_text_color(42, 90, 59) 
                write_cjk_text(pdf, title_part, line_height=8)
                
                if rest_part:
                    pdf.set_font( font_name, '', 12)
                    pdf.set_text_color(0, 0, 0)
                    write_cjk_text(pdf, rest_part, line_height=7)
            
            else:
                pdf.set_font( font_name, '', 12)
                pdf.set_text_color(0, 0, 0)
                write_cjk_text(pdf, line, line_height=7)

        pdf.ln(5) 
        
    text_pdf_bytes = pdf.output()

    if is_pdf:
        merger = PdfWriter()
        
        # ⚠️ 注意：FastAPI 的處理方式
        file_bytes = uploaded_file.file.read() if hasattr(uploaded_file, 'file') else uploaded_file.read()
        user_pdf = io.BytesIO(file_bytes)
        
        # 將讀取指針歸零
        user_pdf.seek(0)
        merger.append(user_pdf)
        
        text_pdf_io = io.BytesIO(text_pdf_bytes)
        merger.append(text_pdf_io)
        
        final_output = io.BytesIO()
        merger.write(final_output)
        merger.close()
        
        return final_output.getvalue(), True
        
    else:
        return bytes(text_pdf_bytes), True