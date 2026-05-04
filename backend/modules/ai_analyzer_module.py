import google.generativeai as genai
import json
from pydantic import BaseModel, Field
from config import settings

# ==========================================
# 🟢 1. 極度細緻的「資料表單」(Pydantic Schema)
# 為不同的段落量身打造專屬的欄位，對應你指定的特例標籤
# ==========================================

# 適用於第 1、3 段 (心率、自律神經平衡)
class StandardSection(BaseModel):
    indicator_meaning: str = Field(description="指標意義純文字，絕對不要加標籤或冒號")
    your_data: str = Field(description="您的數據純文字，絕對不要加標籤或冒號")
    comprehensive_analysis: str = Field(description="綜合解析純文字，絕對不要加標籤或冒號")

# 適用於第 2 段 (SDNN分析) -> 包含【年齡標準】
class SdnnSection(BaseModel):
    indicator_meaning: str = Field(description="指標意義純文字")
    your_data: str = Field(description="您的數據純文字")
    age_standard: str = Field(description="年齡標準純文字，絕對不要加標籤或冒號")
    comprehensive_analysis: str = Field(description="綜合解析純文字")

# 適用於第 4 段 (動態象限) -> 包含【您的軌跡】
class QuadrantSection(BaseModel):
    indicator_meaning: str = Field(description="指標意義純文字")
    your_trajectory: str = Field(description="您的軌跡純文字，絕對不要加標籤或冒號")
    comprehensive_analysis: str = Field(description="綜合解析純文字")

# 適用於第 5 段 (陰陽比例) -> 包含【性別標準】
class YinyangSection(BaseModel):
    indicator_meaning: str = Field(description="指標意義純文字")
    your_data: str = Field(description="您的數據純文字")
    gender_standard: str = Field(description="性別標準純文字，絕對不要加標籤或冒號")
    comprehensive_analysis: str = Field(description="綜合解析純文字")

# 適用於第 6 段 (靈性)
class SpiritualSection(BaseModel):
    indicator_meaning: str = Field(description="指標意義純文字")
    your_data: str = Field(description="您的數據純文字")
    implicit_desc: str = Field(description="內隱階段說明純文字 (嚴格照抄十牛圖，不加標籤)")
    mind_analysis: str = Field(description="心境解析純文字")
    explicit_traits: str = Field(description="外顯特徵純文字 (嚴格照抄十牛圖，不加標籤)")

# 第 7 段與第 8 段保持不變...
class FlowerChakraItem(BaseModel):
    color_name: str = Field(description="例如：橘色、綠色系(橄欖綠)")
    wuxing: str = Field(description="例如：(無五行直接對應)、土、木")
    chakra: str = Field(description="例如：本我輪/臍輪、太陽神經叢輪")
    meaning: str = Field(description="色彩含意純文字")
    status: str = Field(description="狀態與情緒地雷解析純文字")

class FlowerSection(BaseModel):
    visual_features: str = Field(description="圖譜意義與視覺特徵純文字")
    space_structure: str = Field(description="空間與結構解析純文字")
    chakra_analysis: list[FlowerChakraItem] = Field(description="多種顏色的五行與脈輪解析清單")

class RecommendationItem(BaseModel):
    title: str = Field(description="建議標題，例如：陽氣溫養與下盤保暖 (不要加中括號)")
    content: str = Field(description="建議內容純文字")

class RecommendationSection(BaseModel):
    items: list[RecommendationItem] = Field(description="針對個人的修復建議清單")
    blessing: str = Field(description="結尾溫暖祝福純文字")

# 🟢 綁定專屬的 Schema
class AIReportResponse(BaseModel):
    sec_1: StandardSection
    sec_2: SdnnSection
    sec_3: StandardSection
    sec_4: QuadrantSection
    sec_5: YinyangSection
    sec_6: SpiritualSection
    sec_7: FlowerSection
    sec_8: RecommendationSection

# ==========================================
# 🟢 2. 主程式
# ==========================================
def generate_ai_explanation(data, language="🇹🇼 繁體中文"):
    
    genai.configure(api_key=settings.gemini_api_key)
    
    generation_config = genai.GenerationConfig(
        response_mime_type="application/json",
        response_schema=AIReportResponse,
        temperature=0.3 # 降溫確保資料精準萃取
    )
    
    model = genai.GenerativeModel('gemini-2.5-flash', generation_config=generation_config) 
    
    # === 變數安全對接 ===
    try:
        total_seconds = int(data.get('Experience_Time_Sec', 0))
        total_minutes = total_seconds // 60
    except:
        total_minutes = "未知"
        
    gender = data.get('Gender', '未提供')
    age = data.get('Age', '未提供')
    occupation = data.get('Occupation', '未提供')
    subjective_cond = data.get('Subjective_Conditions', '無特別勾選')
    exp_time_sec = data.get('Experience_Time_Sec', '未提供')
    hr_pre = data.get('HR_Pre', '未提供')
    hr_post = data.get('HR_Post', '未提供')
    hr_lowest = data.get('HR_Lowest', '未提供')
    hr_conclusion = data.get('HR_Conclusion', '未提供')
    sdnn_pre = data.get('SDNN_Pre', '未提供')
    sdnn_post = data.get('SDNN_Post', '未提供')
    sdnn_lowest_trend = data.get('SDNN_Lowest_Trend', '未提供')
    sdnn_conclusion = data.get('SDNN_Conclusion', '未提供')
    lf_hf_value = data.get('LF_HF_Value', '未提供')
    balance_count = data.get('Balance_Count', '未提供')
    lf_hf_conclusion = data.get('LF_HF_Conclusion', '未提供')
    lf_hf_trend = data.get('LF_HF_Trend', '未提供')
    yin_yang = data.get('Yin_Yang', '未提供')
    unity_index = data.get('Unity_Index', '未提供')
    flower_colors = data.get('Flower_of_Life_Colors', '未提供')
    flower_brightness = data.get('Flower_of_Life_Brightness', '未提供')
    flower_brightness_detail = data.get('Flower_of_Life_Brightness_Detail', '未提供')
    flower_shape = data.get('Flower_of_Life_Shape', '未提供')
    flower_extent = data.get('Flower_of_Life_Extent', '未提供')
    scatter_analysis = data.get('Scatter_Plot_Analysis', '未提供')

    lang_mapping = {
        "🇹🇼 繁體中文": "繁體中文",
        "🇨🇳 簡體中文": "简体中文",
        "🇯🇵 日本語": "日本語",
        "🇺🇸 English": "English"
    }
    precise_lang = lang_mapping.get(language, language)
    
    # 🟢 完整保留你的 Prompt 領域知識！
    prompt = f"""
    請務必全程使用「{precise_lang}」撰寫分析內容。
    您是一位專業且充滿溫暖同理心的「舒曼共振與身心靈健康顧問」。
    請根據以下體驗者的【舒曼共振床體驗結果數據】與【個人背景狀況】，為其撰寫一份專屬的深度解說報告。
    
    【核心數據、官方判定與圖表趨勢】：
    - 性別：{gender}
    - 年齡：{age} 歲
    - 職業：{occupation}
    - 體驗前主觀狀況/壓力：{subjective_cond}
    - 實際體驗時間：約 {total_minutes} 分鐘 ({exp_time_sec} 秒)
    - 心率：體驗前 {hr_pre} ➔ 體驗後 {hr_post} (過程中最低：{hr_lowest}) (系統判定：{hr_conclusion})
    - SDNN：體驗前 {sdnn_pre} ➔ 體驗後 {sdnn_post} (系統判定：{sdnn_conclusion}) (波形最低點觀察：{sdnn_lowest_trend})
    - LF-HF數值：{lf_hf_value}，平衡次數：{balance_count} (系統判定：{lf_hf_conclusion})
      * 圖表波形特徵(紅藍綠線)：{lf_hf_trend}
    - 陰陽比例：{yin_yang}
    - 天人合一指數：{unity_index}
    - 生命之花圖譜視覺特徵：
      * 顏色與分佈：{flower_colors}
      * 明亮度：{flower_brightness}
      * 各色明暗細節：{flower_brightness_detail}
      * 花形與結構(尖銳/圓滑)：{flower_shape}
      * 滿版程度與大小(滿版/偏小)：{flower_extent}
    - 40分鐘象限分佈(紅/藍/綠點分佈)：{scatter_analysis}
    
    【顧問撰寫鐵律與官方述職指南 (非常重要)】：
    1. 絕對誠實客觀：解讀數據時，必須完全遵照括號內的「系統判定」為主，不可自行美化警告訊息，若遇到任何數據缺失、空白或顯示 None，請溫和地說明「該項目可能未被成功記錄，我們將從其他數據為您分析」，絕對禁止捏造數據。
    2. 動態數據變化解讀指南 ：
       - 必須具體寫出「體驗前」與「體驗後」的數值變化。
       - 心率變化：下降代表體驗過程中獲得放鬆；若有最低心率也可帶入，強調深度休息。
       - SDNN 變化：必須讀取體驗者的「年齡」，並根據以下【SDNN 年齡常模表】找出其對應的健康標準區間：
         * 0-10歲：60~80ms
         * 11-20歲：50~60ms
         * 21-30歲：40~50ms
         * 31-40歲：35~40ms
         * 41-50歲：30~35ms
         * 51-60歲：25~30ms
         * 61-70歲：20~25ms
         * 71-80歲：15~20ms
         * 81-90歲：10~15ms
       - 寫作邏輯：請先寫出體驗前後的 SDNN 數值變化。接著，明確告訴體驗者「以您的年齡來說，正常的標準區間大約落在 X~Y 之間」，並說明在體驗過程中SDNN數值有沒有接近或低於20。
       - 評估與結合：將體驗者的數值與該年齡標準進行比對。如果低於標準，請結合系統判定的警告，溫和提醒其心臟抗壓彈性較弱、可能承受較大壓力；若在標準內或高於標準，請給予肯定。
    3. 自律神經 (LF/HF圖表) 解讀指南：
       - 說明自律神經佔神經系統九成，受外在環境與情緒影響，人體無法自主控制。
       - 紅線(交感)：代表活動力、行動力、樂觀度。
       - 藍線(副交感)：代表修復能力。若過於旺盛代表身體「偏累」。
       - 綠線：代表天人合一指數的即時波動，可輔助觀察靈性與免疫能量的穩定度。
       - 判斷交集：交感與副交感必須「有交集」取得平衡。若結合波形特徵發現紅藍線「開開的沒有交集」，務必指出這代表五臟六腑運作脫節，容易導致消化、循環、吸收、代謝不良，甚至睡眠品質變差。
    4. 陰陽比例解讀指南：
       - 中醫理論「過與不及都是病因」。健康基準：男性陽氣約40%多；女性陽氣約30%多。
       - 若當前陽氣遠低於此標準，務必提醒這會導致「下盤比較不OK」，容易有泌尿系統、婦科、腳力不足、容易水腫等問題。
    5. 天人合一指數與「十牛圖」心境解讀指南：
       - 此指數代表靈性層面、宇宙能量階層、免疫力。滿分100分，70分為及格。
       - 必須根據體驗者的具體分數，對應以下「十牛圖」的靈性發展階段。請在報告中精準引用該階段的「內隱說明」與「外顯特徵」原文，並給予心境解析：
         * 0~10分「(一) 尋牛」
           內隱：第一個階段稱為尋牛，這牛就代表我們自己這個心的真相。也就是你開始找尋人生的真正的意義所在，那就是尋牛。要找到人生的真理，先要找到自己。
           外顯：可能有藥物影響，不安全感強，容易緊張，對陌生環境警戒心高，身體平衡極度失調，身體不適太躁熱就是太陰虛，呈現二極端現象。
         * 11~20分「(二) 見跡」
           內隱：第二個階段見跡，就是看到這頭牛的腳印了，見到它的足跡了。這時候還沒有開悟，可是似乎是懂了。可是還只是看到牛跡，還沒真正見到牛。可是並不是真正的體悟。
           外顯：身體手術或有病痛，氣血不足，體陰虛弱，缺乏信心，有強烈不確定感，對未來缺乏信心。
         * 21~30分「(三) 見牛」
           內隱：第三個階段見牛，那就是因緣會合，水到渠成，當下就悟了，驀然回首，原來就是這個。以前感覺有很多的矛盾，到了這個階段，這些矛盾不解，全部都打通了。
           外顯：想要的東西很多，工作壓力大，身體緊繃，心情比較容易受到干擾。睡眠品質較差，容易想得很多。
         * 31~40分「(四) 得牛」
           內隱：第四個階段是得牛，就是你這個心，你知道它本性是清淨的，所以這時候要守住它，要讓它時時現前，就是得牛。就是保留這念清淨的心，不為一切所有境界所轉。
           外顯：心靈層面情緒較壓抑，不擅表達自己，屬於逆來順受類型，責任感高，身體容易緊繃，疲累感較深沉且比較沒自我認同感。
         * 41~50分「(五) 牧牛」
           內隱：第五個階段叫做牧牛，悟了以後，順境也好，逆境也好，你很快提起這個覺性一照，就把這境界給看破了，所以這就叫做牧牛。你讓這個心，這個菩提，這個覺性，能夠時時現前，不要去放牛吃草，它一吃草，你就把它拽回到，這叫做牧牛。
           外顯：思想理性，主觀意識較強，對自己充滿自信，有堅定的信仰。生活中庸，比較無強烈學習動力。
         * 51~60分「(六) 騎牛歸家」
           內隱：第六個階段，騎牛歸家，那就是你牧牛牧得很熟了，這頭牛聽話了，你叫它到東，它就到東；你叫它到西，它就到西；你要它吃草，它就吃草；你不要它吃草，它就不吃草，那就是你的全身得自在呀！
           外顯：身體體力能量充沛，心靈無私，社交能力及領導能力強。情緒起伏較大。較喜歡安逸的環境。
         * 61~70分「(七) 忘牛存人」
           內隱：第七忘牛存人，就是這牛不見了，沒有了，超越了。因為你找牛的這個心，也就是你自己的覺性啊！你還是用這頭牛在找這頭牛嗎！只是以前看不清楚這頭牛是什麼樣子，現在看清楚了，所以人跟牛難道是兩個嗎？本來就是一個。
           外顯：懂得養生，懂得平衡之道，個性從容，有慈悲心，會為對方著想，對文學敏感度高，個性直爽，無為而治，幽默感，反應快，懂得感恩與回饋。具天生領袖風格。不喜歡與人相爭。
         * 71~80分「(八) 人牛俱忘」
           內隱：第八人牛俱忘，你自己完全把心降服了，萬物都是我們的心生出來的，你悟到了這念心，破了我執以後，這時候真正看清楚這心，這個清淨的自我，清淨的覺性，不是這個我執，你跟這個世界是一體的，都是空性。達到最自在解脫的境界。
           外顯：反應敏捷，天生有美感，能獨當一面的領導能力，口條好，對事物會客觀評斷，更有自信，謙虛有禮。願意關懷照顧他人，願意與人分享，人緣好，人氣旺。音感強，語文能力好。樂善好施。
         * 81~90分「(九) 返本還源」
           內隱：第九返本還源。一切萬法由菩提心所生，一切萬法也是空性。所以講到「庵中不見庵前物，水自茫茫花自紅。」所以一切萬法各不妨礙，以前看到處處都是障礙，現在處處都是圓融無礙。
           外顯：在日常生活當中可以解析能量好壞，懂得趨吉避凶，目前很清楚自己可無與不可為之處。
         * 91~100分「(十) 入鄽垂手」
           內隱：第十個階段入鄽垂手，就是你悟到如來的境界了。也就是說你回到這個世間，披髮露足，跟大家在一起，隨緣盡份，度化眾生。入鄽垂手，返本還源，再來看，山還是山，水還是水。可是你看到它的空，你看到它的假有，你看到它的中道實相，空假不二，又是空，又是緣起，緣起跟空不二，就是中道。你就真正看到這個山的實相，你也看到人的實相。
           外顯：你有大量同時性事件發生，身心能量高度協調，是容易心想事成，且有悲智雙全之人，可以充分發揮天賦，幫助世人，發揮廣大影響力。每個人在您身邊都會覺得很自然舒服。且無時不刻處在法喜當中。
    6. 生命之花圖譜終極解讀指南 (融合五行臟腑與七脈輪氣場)：
       - 核心意義：代表受試者氣場的光、靈性狀態以及最近的身心綜合狀態。
       - 空間向度：圖譜中心代表「個人內在心性」，越往外圍代表「面對外在環境與社會的狀態」。
       - 廣度邏輯 (Extent)：
         * 「滿版」：代表近期接觸的人事物比較廣泛，外向且充滿向外拓展的能量。
         * 「偏小 (未滿版)」：代表近期生活範圍較小、單純，或是能量處於內斂、自我保護的狀態。
       - 花形結構 (Shape)：
         * 「尖銳」圖騰：性格偏向固執、有條理、主觀意識較強。
         * 「圓滑/圓形」圖騰：性格偏向圓滑、有人緣、善於交際與協調。
       - 明亮度 (Brightness) 與健康警訊：
         * 「明亮耀眼」：對應「旺盛」、「能量充足」。描述時應著重於優點，但需提醒過猶不及
         * 「深沉內斂」：對應「偏暗」、「偏弱」、「不足」。描述時應點出休息不足、能量未完全打開或情緒壓抑，代表對應的臟腑系統可能過度消耗、易疲勞，累積了負面情緒，或者近期特別想要閉關休息。
       - 色彩、五行、七脈輪與身心對應系統 (核心解說依據)：
         * 【紅色 (火/心/海底輪)】：氣場熱情大方、愛恨分明、行動力佳；對應心臟、血管循環系統。情緒地雷：好「恨」傷心，宜戒恨取靜。
         * 【橘色 (本我輪/臍輪)】：氣場古道熱腸、熱心助人、犧牲奉獻；近期業務能力不錯。
         * 【黃色 (土/脾/太陽神經叢輪)】：邏輯條理分明、自信決心；對應脾胃與消化系統。情緒地雷：好「怨」傷胃，宜戒怨取安。
         * 【綠色 (木/肝/心輪)】：思想敏捷、充滿愛、慈悲與開創力；對應肝膽免疫系統。情緒地雷：好「怒」傷肝，宜戒怒取定。
         * 【藍色 (喉輪)】：冷靜、與世無爭；善於傾聽、表達、溝通與創造力。
         * 【靛色 (眉心輪/第三眼)】：聰明敏感、直覺與第六感強、發明創造及設計能力強。
         * 【紫色 (頂輪)】：氣質優雅、善體人意、同理心強；靈性、天人合一與萬有連結。
         * 【白色 (金/肺/五輪平衡)】：和諧平衡，具剛毅果斷與正義感；對應呼吸系統與筋骨。情緒地雷：好「惱」傷肺，宜戒惱取慮。
         * 【黑色 (水/腎/五輪重生)】：代表重生與休息，近期特別想要閉關休息者；對應腎臟泌尿系統。情緒地雷：好「煩」傷腎，宜戒煩取得。
       - 局部明暗辨識邏輯：
         * 若某顏色標註為「明亮」：代表該臟腑/脈輪能量充沛，心性特質展現順暢。
         * 若某顏色標註為「暗沉」：代表該對應系統正處於「過度消耗」或「能量阻塞」狀態。這通常與長期累積的負面情緒（地雷）有關，是身體發出的修復警訊。
       - 同色系(例如多種橘色)請合併為一組解析。
       - 狀態說明填寫鐵律：絕對嚴禁輸出「能量活躍飽滿，對應系統運作順暢」或任何類似的重複性罐頭文字。請嚴格比對傳入的顏色明暗清單，結合情緒地雷給予具體的心理覺察建議。
    7. 寫作修辭鐵律 (防機器人語氣)：
       - 絕對禁止在文章中使用「系統判定」、「根據系統顯示」、「系統提醒」、「數據顯示」等冷冰冰的機器詞彙。
       - 嚴禁寫出「中間是黃色」、「外圍是紅色」等無中生有的排版敘述。請統一視為「多種能量色彩相互交織、融合」。
       - 絕對禁止像機器人一樣條列唸出標籤名稱。請融合寫成流暢的文字。
    8. 40分鐘自律神經動態象限圖(點點圖)解讀指南 (時序動態分析)：
       - 顏色與時間軸：請將顏色轉化為時間進程。紅色點代表「前 10 分鐘 (體驗初期)」；藍色點代表「中間 20 分鐘 (體驗中期)」；綠色點代表「最後 10 分鐘 (體驗後期)」。
       - X軸(左右)意義：點群主體偏左代表副交感神經(HF)活躍，身體可能處於疲憊狀態；點群主體偏右代表交感神經(LF)活躍，身體處於發炎或應激狀態；若呈現從左到右綿延的「帶狀分佈」，代表交感與副交感達成動態平衡。
       - Y軸(高低)意義：點的高度代表心率快慢。位置愈高代表心跳較快，暗示有「缺氧、心氧不足」現象；主體位置偏低或置中代表心率平穩、心臟負荷適中。
       - 寫作邏輯：請依據「體驗初期 ➔ 體驗中期 ➔ 體驗後期」的時間順序，講述體驗者自律神經的變化故事。嚴禁因為極少數的離群點 (如一兩顆特別高或特別偏的點) 就下達嚴重警告，請一律以該顏色的「主體重心」來論述。
       - 若無提及綠色嚴禁出現相關字眼。
    9. 背景融合指令：請將體驗者的「職業」與「主觀狀況（如失眠、生理期等）」自然地融入分析中。例如：若勾選失眠，請在自律神經段落強調睡眠品質；若為生理期，請在陰陽比例段落給予溫暖的體貼提醒。
    10.【主觀狀態引用鐵律】：在撰寫任何段落的「綜合解析」並試圖連結使用者的生活狀態時，【絕對只能】嚴格對照傳入之「已勾選主觀項目」名單進行論述。嚴禁自行聯想、猜測或捏造任何未出現在該傳入名單中的症狀。

    【 輸出格式與最終語言警告 / FINAL OUTPUT & LANGUAGE WARNING 】
    請用溫暖、專業且誠實的語氣，嚴格根據上述 10 點鐵律，填入指定的 JSON 結構中。
    ⚠️ 終極語言鐵律：你現在的大腦已經切換為 {precise_lang} 模式。你輸出的「每一個字」，都必須完全翻譯並使用「{precise_lang}」輸出！絕對禁止混入其他語言！
    """

    try:
        response = model.generate_content(prompt)
        res = json.loads(response.text)
        
        # ==========================================
        # 🟢 3. Python 絕對防呆的排版組裝廠
        # 針對特例段落撰寫專屬的組裝邏輯
        # ==========================================
        
        # 適用於第 1、3 段
        def build_std_sec(data: dict) -> str:
            return f"【指標意義】\n:{data.get('indicator_meaning', '')}\n\n【您的數據】\n:{data.get('your_data', '')}\n\n【綜合解析】\n:{data.get('comprehensive_analysis', '')}"

        # 🟢 適用於第 2 段 (加入【年齡標準】)
        def build_sdnn_sec(data: dict) -> str:
            return f"【指標意義】\n:{data.get('indicator_meaning', '')}\n\n【您的數據】\n:{data.get('your_data', '')}\n\n【年齡標準】\n:{data.get('age_standard', '')}\n\n【綜合解析】\n:{data.get('comprehensive_analysis', '')}"

        # 🟢 適用於第 4 段 (將數據替換為【您的軌跡】)
        def build_quadrant_sec(data: dict) -> str:
            return f"【指標意義】\n:{data.get('indicator_meaning', '')}\n\n【您的軌跡】\n:{data.get('your_trajectory', '')}\n\n【綜合解析】\n:{data.get('comprehensive_analysis', '')}"

        # 🟢 適用於第 5 段 (加入【性別標準】)
        def build_yinyang_sec(data: dict) -> str:
            return f"【指標意義】\n:{data.get('indicator_meaning', '')}\n\n【您的數據】\n:{data.get('your_data', '')}\n\n【性別標準】\n:{data.get('gender_standard', '')}\n\n【綜合解析】\n:{data.get('comprehensive_analysis', '')}"

        # 第 6 段：靈性分析
        s6 = res.get('sec_6', {})
        sec_6_str = f"【指標意義】\n:{s6.get('indicator_meaning', '')}\n\n【您的數據】\n:{s6.get('your_data', '')}\n\n【內隱階段說明】\n:{s6.get('implicit_desc', '')}\n\n【心境解析】\n:{s6.get('mind_analysis', '')}\n\n【外顯特徵】\n:{s6.get('explicit_traits', '')}"

        # 第 7 段：生命之花
        s7 = res.get('sec_7', {})
        sec_7_parts = [
            f"【圖譜意義與視覺特徵】\n:{s7.get('visual_features', '')}",
            f"【空間與結構解析】\n:{s7.get('space_structure', '')}",
            "\n【五行與脈輪分析】\n| 顏色 | 對應五行 | 脈輪 | 含意 | 狀態說明 |",
            "|---|---|---|---|---|"
        ]
        
        for item in s7.get('chakra_analysis', []):
            color = item.get('color_name', '').replace('|', '｜')
            wuxing = item.get('wuxing', '').replace('|', '｜')
            chakra = item.get('chakra', '').replace('|', '｜')
            meaning = item.get('meaning', '').replace('|', '｜')
            status = item.get('status', '').replace('|', '｜')
            
            sec_7_parts.append(f"| {color} | {wuxing} | {chakra} | {meaning} | {status} |")
            
        sec_7_str = "\n".join(sec_7_parts) # 生命之花表格內距不用兩次換行
        
        # 第 8 段：整體修復建議
        s8 = res.get('sec_8', {})
        sec_8_parts = []
        for item in s8.get('items', []):
            sec_8_parts.append(f"【{item.get('title', '')}】:{item.get('content', '')}")
        sec_8_parts.append(f"\n{s8.get('blessing', '')}")
        sec_8_str = "\n\n".join(sec_8_parts)

        # 輸出最終字典，精準綁定對應的組裝函式
        return {
            "section_1": build_std_sec(res.get('sec_1', {})),
            "section_2": build_sdnn_sec(res.get('sec_2', {})),     # 使用 SDNN 專屬組裝
            "section_3": build_std_sec(res.get('sec_3', {})),
            "section_4": build_quadrant_sec(res.get('sec_4', {})), # 使用象限專屬組裝
            "section_5": build_yinyang_sec(res.get('sec_5', {})),  # 使用陰陽專屬組裝
            "section_6": sec_6_str,
            "section_7": sec_7_str,
            "section_8": sec_8_str
        }
        
    except Exception as e:
        print(f"AI 生成或解析失敗: {e}")
        return {
            "section_1": f"生成失敗，錯誤資訊：{str(e)}",
            "section_2": "請確認您的網路連線或 API Key 額度狀態。",
            "section_3": "", "section_4": "", "section_5": "", 
            "section_6": "", "section_7": "", "section_8": ""
        }