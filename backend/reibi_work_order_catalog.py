"""D 層施工項目規格目錄（移植自 reibi-workorder_v1_4 的 D_ITEMS）。

Artifact 的工單不是自由文字表格：每個 D 層項目都帶著單位、預設數量、可選規格、
交付項目與**驗收標準**。驗收畫面就是把選中項目的 acceptCriteria 攤平成一份逐條
勾核清單，並用「已通過／總條數」算出驗收進度。

新系統原本只有 name／spec／quantity／note 四個自由欄位，等於把這份目錄整個丟掉：
規格沒有選項可選（同一個規格會被打成三種寫法）、交付項目沒有依據、驗收標準完全
不存在，驗收退化成每個項目一個 pass/fail。

這裡把目錄放回來，並提供把它攤平成驗收清單的函式。目錄是唯一權威來源，
API 與前端都從這裡讀，避免像 Artifact 那樣出現第二份靜態複製。
"""

from __future__ import annotations

from typing import Any, Optional

# 每個項目：key、名稱、單位、預設數量、規格選項、交付項目、驗收標準。
# 規格選項刻意保留 Artifact 的原始字串（含全形括號與尺寸寫法），
# 既有 Artifact 匯入資料才能對得上同一個值。
WORK_ORDER_ITEM_CATALOG: tuple[dict[str, Any], ...] = (
    {
        "key": "poster",
        "name": "基礎海報套組",
        "unit": "張",
        "default_quantity": 6,
        "specs": (
            {"key": "size", "label": "尺寸",
             "options": ("A2(420×594mm)", "A1(594×841mm)", "A0(841×1189mm)")},
            {"key": "material", "label": "材質",
             "options": ("銅板紙霧膜", "銅板紙亮膜", "防水PP霧膜", "布料帆布")},
            {"key": "content", "label": "內容主題",
             "options": ("ISI睡眠量表說明", "BPI疼痛量表說明", "888計畫宣導",
                         "REIBI品牌識別", "健促活動宣傳", "自訂主題")},
        ),
        "deliverables": ("海報成品(指定數量)", "設計稿電子檔(PDF/AI格式)"),
        "accept_criteria": ("尺寸正確", "顏色符合打樣", "內容無誤", "數量完整"),
    },
    {
        "key": "board",
        "name": "健促公告欄設計",
        "unit": "組",
        "default_quantity": 1,
        "specs": (
            {"key": "size", "label": "公告欄尺寸",
             "options": ("60×90cm", "90×120cm", "120×180cm", "客製尺寸")},
            {"key": "type", "label": "類型",
             "options": ("固定式鋁框", "可更換插槽式", "軟木板+框", "磁吸白板")},
            {"key": "content", "label": "視覺內容",
             "options": ("888計畫+IDG框架", "Ottawa Charter五大行動", "健康評估指引",
                         "REIBI使用導引", "組合式(多主題)")},
        ),
        "deliverables": ("公告欄本體", "背板內容印刷品", "安裝五金配件", "設計稿電子檔"),
        "accept_criteria": ("公告欄安裝穩固", "視覺內容清晰", "尺寸符合規格", "可更換機制正常運作"),
    },
    {
        "key": "display",
        "name": "設備展示區佈置",
        "unit": "組",
        "default_quantity": 1,
        "specs": (
            {"key": "scope", "label": "佈置範圍",
             "options": ("雲朵床展示區", "樂活椅展示區", "LA200展示區", "全設備整合展示區")},
            {"key": "include", "label": "包含項目",
             "options": ("設備說明牌(壓克力立牌)", "體驗預約QR Code展架", "動線指引地貼",
                         "背景展示牆貼", "設備操作說明卡")},
            {"key": "install", "label": "安裝方式",
             "options": ("獨立展示架", "壁掛固定", "桌面擺設", "地面立式")},
        ),
        "deliverables": ("說明牌成品", "動線指引材料", "安裝固定材料"),
        "accept_criteria": ("說明牌清晰易讀", "安裝穩固安全", "動線流暢", "與B層設備位置匹配"),
    },
    {
        "key": "qr",
        "name": "QR Code貼紙組",
        "unit": "組",
        "default_quantity": 1,
        "specs": (
            {"key": "size", "label": "貼紙尺寸",
             "options": ("5×5cm", "8×8cm", "10×10cm", "客製尺寸")},
            {"key": "qty", "label": "數量",
             "options": ("20張/組", "50張/組", "100張/組", "客製數量")},
            {"key": "link", "label": "連結內容",
             "options": ("REIBI平台入口", "ISI評估入口", "BPI評估入口", "服務預約入口",
                         "員工健促資源", "多合一入口頁")},
            {"key": "material", "label": "材質",
             "options": ("防水霧面貼紙", "防水亮面貼紙", "可移除重貼", "戶外抗UV")},
        ),
        "deliverables": ("QR Code貼紙組(指定數量)", "備用QR碼電子檔(PDF)"),
        "accept_criteria": ("QR Code掃描正確", "連結指向正確", "貼紙材質符合規格", "印刷清晰"),
    },
    {
        "key": "digital",
        "name": "數位看板內容",
        "unit": "支",
        "default_quantity": 10,
        "specs": (
            {"key": "format", "label": "影片格式",
             "options": ("MP4 16:9(1920×1080)", "MP4 9:16(直式)", "PNG靜態圖(可輪播)", "GIF動態圖")},
            {"key": "duration", "label": "每支長度",
             "options": ("15秒", "30秒", "60秒", "靜態(不限)")},
            {"key": "content", "label": "內容主題",
             "options": ("健康知識輪播", "ISI/BPI說明", "888計畫介紹", "REIBI品牌形象",
                         "設備體驗介紹", "企業客製主題")},
            {"key": "update", "label": "後續更新",
             "options": ("包含1年更新服務(季更)", "包含首次製作不含更新", "另議更新服務費")},
        ),
        "deliverables": ("數位影像/影片檔(指定支數)", "播放清單設定說明", "更新服務合約(如包含)"),
        "accept_criteria": ("格式正確可播放", "解析度符合規格", "內容正確無誤", "更新服務已確認"),
    },
    {
        "key": "install",
        "name": "現場佈置施工",
        "unit": "次",
        "default_quantity": 1,
        "specs": (
            {"key": "scope", "label": "施工範圍",
             "options": ("全項目安裝", "僅海報/公告欄張貼", "設備展示區布置",
                         "數位看板安裝調試", "指定項目(見備註)")},
            {"key": "travel", "label": "差旅費",
             "options": ("含差旅費(雙北地區)", "含差旅費(北部地區)", "另計差旅費(中南東部)", "海外另議")},
            {"key": "duration", "label": "施工時間",
             "options": ("半天(4小時)", "1天(8小時)", "2天", "視施工量另議")},
        ),
        "deliverables": ("施工完成照片記錄", "現場確認清單"),
        "accept_criteria": ("所有項目安裝完成", "現場整潔無殘留", "施工照片已交付", "客戶現場確認"),
    },
)

CATALOG_BY_KEY: dict[str, dict[str, Any]] = {item["key"]: item for item in WORK_ORDER_ITEM_CATALOG}
CATALOG_KEYS: frozenset[str] = frozenset(CATALOG_BY_KEY)


def catalog_payload() -> list[dict[str, Any]]:
    """目錄的 JSON 形式，供 API 回傳給前端渲染下拉選單與驗收清單。"""
    return [
        {
            "key": item["key"],
            "name": item["name"],
            "unit": item["unit"],
            "default_quantity": item["default_quantity"],
            "specs": [
                {"key": spec["key"], "label": spec["label"], "options": list(spec["options"])}
                for spec in item["specs"]
            ],
            "deliverables": list(item["deliverables"]),
            "accept_criteria": list(item["accept_criteria"]),
        }
        for item in WORK_ORDER_ITEM_CATALOG
    ]


def _selected_keys(items: Any) -> list[str]:
    """從工單的 items 取出被選中的目錄項目，維持目錄本身的順序。

    Artifact 用 selectedItems 這個 {key: bool} 物件記錄勾選狀態，
    匯入資料與新建工單都沿用同一個結構。
    """
    if not isinstance(items, dict):
        return []
    selected = items.get("selectedItems")
    if not isinstance(selected, dict):
        return []
    return [key for key in CATALOG_BY_KEY if selected.get(key)]


def acceptance_checklist(items: Any, acceptance: Any) -> dict[str, Any]:
    """把選中項目的驗收標準攤平成逐條清單，並算出通過進度。

    回傳的 total 只計算「目錄有定義驗收標準」的條目。自訂項目（customItems）
    沒有標準可對，不列入分母，否則進度永遠到不了 100%。
    """
    checks = acceptance.get("acceptChecks") if isinstance(acceptance, dict) else None
    notes = acceptance.get("checkNotes") if isinstance(acceptance, dict) else None
    checks = checks if isinstance(checks, dict) else {}
    notes = notes if isinstance(notes, dict) else {}

    item_payload = items if isinstance(items, dict) else {}
    quantities = item_payload.get("itemQty") if isinstance(item_payload.get("itemQty"), dict) else {}
    specs = item_payload.get("itemSpecs") if isinstance(item_payload.get("itemSpecs"), dict) else {}

    groups: list[dict[str, Any]] = []
    passed = failed = total = 0
    for key in _selected_keys(item_payload):
        definition = CATALOG_BY_KEY[key]
        rows = []
        for index, criterion in enumerate(definition["accept_criteria"]):
            check_id = f"{key}:{index}"
            result = checks.get(check_id)
            result = result if result in {"pass", "fail"} else None
            total += 1
            if result == "pass":
                passed += 1
            elif result == "fail":
                failed += 1
            rows.append({
                "check_id": check_id,
                "criterion": criterion,
                "result": result,
                "note": str(notes.get(check_id) or "") or None,
            })
        groups.append({
            "key": key,
            "name": definition["name"],
            "unit": definition["unit"],
            "quantity": _quantity(quantities.get(key), definition["default_quantity"]),
            "specs": {
                spec["key"]: specs.get(key, {}).get(spec["key"])
                for spec in definition["specs"]
                if isinstance(specs.get(key), dict) and specs[key].get(spec["key"])
            },
            "deliverables": list(definition["deliverables"]),
            "checks": rows,
        })

    return {
        "groups": groups,
        "total": total,
        "passed": passed,
        "failed": failed,
        "percent": round(passed / total * 100) if total else 0,
        "all_passed": total > 0 and passed == total,
    }


def _quantity(value: Any, fallback: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return fallback
    return parsed if parsed > 0 else fallback


def unknown_check_ids(items: Any, acceptance: Any) -> list[str]:
    """回傳 acceptChecks 中對不到任何已選項目驗收標準的 check_id。

    用來擋掉前端送來的孤兒鍵值：項目取消勾選後若舊的勾核殘留，
    驗收進度的分子會超過分母。
    """
    checks = acceptance.get("acceptChecks") if isinstance(acceptance, dict) else None
    if not isinstance(checks, dict):
        return []
    valid = {
        f"{key}:{index}"
        for key in _selected_keys(items)
        for index in range(len(CATALOG_BY_KEY[key]["accept_criteria"]))
    }
    return sorted(str(key) for key in checks if key not in valid)


def default_items_from_quote_config(config: Any) -> dict[str, Any]:
    """由報價的 D 層勾選推出工單初始 items，並帶入目錄的預設數量。

    Artifact 的 pickDoc 也是這樣做：從報價／合約帶入 dItems 後，
    驗收清單就自動有了對應的標準條目。
    """
    selected = config.get("dItems") if isinstance(config, dict) else None
    selected = selected if isinstance(selected, dict) else {}
    keys = [key for key in CATALOG_BY_KEY if selected.get(key)]
    return {
        "selectedItems": {key: True for key in keys},
        "itemQty": {key: CATALOG_BY_KEY[key]["default_quantity"] for key in keys},
        "itemSpecs": {},
        "itemNote": {},
        "customItems": [],
    }
