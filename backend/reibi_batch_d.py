from __future__ import annotations

import re
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from passlib.context import CryptContext
from pydantic import BaseModel, ConfigDict, Field, field_validator

from auth import get_current_user
from roles import has_permission


# 個人健康端點只寫入登入者自己的 profile，維持角色列舉即可；
# 其餘守門改由 roles.py 的權限推導，避免 registry 與實際授權脫節。
PERSONAL_ROLES = {"individual", "member", "dept_head"}
ASSESSMENT_POINTS = {"phq4": 5, "pss4": 10, "mind3": 5, "ow": 10, "msk": 10, "bsrs5": 10, "violence": 10}

ACTION_CATEGORIES: dict[str, list[tuple[str, str]]] = {
    "綜合健康": [("water_8", "飲水8杯"), ("outdoor_15", "戶外活動15分"), ("regular_routine", "作息規律"), ("less_screen", "減少3C使用")],
    "疼痛衛教": [("stand_hourly", "每時起身3分"), ("stretch", "伸展運動"), ("heat_cold", "熱冷敷"), ("posture", "維持正確姿勢")],
    "睡眠衛教": [("screen_off", "睡前停螢幕1小時"), ("no_caffeine", "午後不攝取咖啡因"), ("relaxation", "進行放鬆練習"), ("fixed_bedtime", "定時就寢")],
    "飲食衛教": [("fruit_veg", "蔬果5份"), ("less_sugar", "少精製糖"), ("regular_meals", "三餐定時"), ("portion_control", "七八分飽")],
    "物理運動": [("aerobic_30", "有氧運動30分"), ("neck_stretch", "頸肩伸展"), ("core_training", "核心訓練"), ("back_protection", "腰背保護動作")],
    "REIBI體驗": [("schumann", "舒曼波體驗打卡"), ("la200", "LA200體驗打卡")],
}
ACTION_LABELS = {code: label for rows in ACTION_CATEGORIES.values() for code, label in rows}
MSK_PARTS = {
    "neck", "back_up", "back_low", "shoulder_l", "shoulder_r", "elbow_l", "elbow_r",
    "wrist_l", "wrist_r", "hip_l", "hip_r", "knee_l", "knee_r", "ankle_l", "ankle_r",
}
VIOLENCE_KEYS = {"violence", "harass", "stalk", "discrim"}
RISK_MATRIX = {
    "high": {"high": "extreme", "medium": "high", "low": "medium"},
    "medium": {"high": "high", "medium": "medium", "low": "low"},
    "low": {"high": "medium", "medium": "low", "low": "low"},
}

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _execute(query: Any, message: str) -> list[dict[str, Any]]:
    try:
        response = query.execute()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=message) from exc
    return response.data or []


def _require_role(user: dict[str, Any], roles: set[str], detail: str) -> dict[str, Any]:
    if user.get("role") not in roles:
        raise HTTPException(status_code=403, detail=detail)
    return user


def _require_any_permission(user: dict[str, Any], permissions: tuple[str, ...], detail: str) -> dict[str, Any]:
    if not any(has_permission(user, permission) for permission in permissions):
        raise HTTPException(status_code=403, detail=detail)
    return user


def require_personal_health(user: dict = Depends(get_current_user)) -> dict:
    return _require_role(user, PERSONAL_ROLES, "此功能僅限個人、單位成員或部門主管使用")


def require_ohs_manager(user: dict = Depends(get_current_user)) -> dict:
    return _require_any_permission(user, ("ohs_manage",), "此功能僅限具備職安管理權限的帳號使用")


def require_occupational(user: dict = Depends(get_current_user)) -> dict:
    return _require_any_permission(
        user, ("ohs_manage", "oh_interview"), "此功能僅限臨場醫護或具備職安管理權限的帳號使用"
    )


def require_aggregate_viewer(user: dict = Depends(get_current_user)) -> dict:
    # 彙整資料的 k≥5 與單位範圍由 SQL 與 _org_code() 保障，守門只決定「誰有資格看彙整」。
    return _require_any_permission(
        user, ("org_analytics", "department_analytics"), "沒有組織彙整資料權限"
    )


def _profile_id(user: dict[str, Any]) -> str:
    try:
        return str(uuid.UUID(str(user.get("uid"))))
    except (ValueError, TypeError, AttributeError) as exc:
        raise HTTPException(status_code=401, detail="登入身份缺少有效使用者 ID") from exc


def _org_code(user: dict[str, Any], requested: Optional[str] = None, *, required: bool = False) -> Optional[str]:
    if user.get("role") == "reibi_super":
        value = requested
    else:
        value = user.get("org_code")
        if requested and value and requested.upper() != str(value).upper():
            raise HTTPException(status_code=403, detail="不可存取其他單位資料")
    value = str(value).strip().upper() if value else None
    if value and not re.fullmatch(r"[A-Z0-9_-]{2,40}", value):
        raise HTTPException(status_code=422, detail="單位代碼格式不正確")
    if required and not value:
        raise HTTPException(status_code=422, detail="此操作需要單位代碼")
    return value


def _rpc(client: Any, name: str, params: dict[str, Any], message: str) -> Any:
    try:
        response = client.rpc(name, params).execute()
    except Exception as exc:
        detail = str(exc)
        if "7-day interval" in detail:
            raise HTTPException(status_code=409, detail="同一項行動需間隔 7 天才能再次打卡") from exc
        if "insufficient points" in detail:
            raise HTTPException(status_code=409, detail="積分不足") from exc
        raise HTTPException(status_code=502, detail=message) from exc
    return response.data


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ActionCheckin(StrictModel):
    action_code: str
    checked_on: date = Field(default_factory=date.today)


class PointsRedeem(StrictModel):
    reward_code: str = Field(min_length=1, max_length=80)
    reward_label: str = Field(min_length=1, max_length=120)
    cost: int = Field(ge=1, le=100000)


class PointsAdjustment(StrictModel):
    profile_id: uuid.UUID
    points: int = Field(ge=-100000, le=100000)
    reason: str = Field(min_length=2, max_length=300)

    @field_validator("points")
    @classmethod
    def nonzero(cls, value: int) -> int:
        if value == 0:
            raise ValueError("積分調整不可為 0")
        return value


class SleepDiaryWrite(StrictModel):
    entry_date: date = Field(default_factory=date.today)
    bed_time: str = Field(pattern=r"^[0-2][0-9]:[0-5][0-9]$")
    sleep_latency_minutes: int = Field(ge=0, le=720)
    night_awakenings: int = Field(ge=0, le=50)
    wake_time: str = Field(pattern=r"^[0-2][0-9]:[0-5][0-9]$")
    quality: int = Field(ge=1, le=5)


class PainDiaryWrite(StrictModel):
    entry_date: date = Field(default_factory=date.today)
    level: int = Field(ge=0, le=10)
    body_locations: list[str] = Field(default_factory=list, max_length=20)
    times: list[str] = Field(default_factory=list, max_length=10)
    triggers: list[str] = Field(default_factory=list, max_length=20)
    relief: list[str] = Field(default_factory=list, max_length=20)
    work_impact: int = Field(ge=0, le=10)


class VitalWrite(StrictModel):
    health_status: Literal["none", "borderline", "diagnosed"] = "none"
    systolic: Optional[int] = Field(None, ge=50, le=300)
    diastolic: Optional[int] = Field(None, ge=30, le=200)
    fasting_glucose: Optional[float] = Field(None, ge=20, le=1000)
    ldl: Optional[float] = Field(None, ge=0, le=1000)
    height_cm: Optional[float] = Field(None, ge=50, le=260)
    weight_kg: Optional[float] = Field(None, ge=10, le=500)
    waist_cm: Optional[float] = Field(None, ge=20, le=300)
    department_key: Optional[str] = Field(None, max_length=120)
    department_consent: bool = False


class AssessmentWrite(StrictModel):
    assessment_type: Literal["phq4", "pss4", "mind3", "ow", "msk", "bsrs5", "violence"]
    answers: Any
    risk_factors: list[str] = Field(default_factory=list, max_length=20)
    screened: Optional[bool] = None
    duration: Optional[str] = Field(None, max_length=40)
    suicide_ideation: Optional[int] = Field(None, ge=0, le=4)
    # 預設不同意：沒有明確勾選就不進入所屬企業的組織彙整
    consent_org_aggregate: bool = False


class FeedbackWrite(StrictModel):
    period_key: str = Field(pattern=r"^[0-9]{4}-Q[1-4]$")
    answers: dict[str, Any]
    satisfaction_score: Optional[int] = Field(None, ge=1, le=5)
    nps_score: Optional[int] = Field(None, ge=0, le=10)
    free_text: Optional[str] = Field(None, max_length=2000)


class EapResourceWrite(StrictModel):
    category_code: Literal["A", "B", "C", "D", "E"]
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    phone: Optional[str] = Field(None, max_length=40)
    url: Optional[str] = Field(None, max_length=1000)
    is_emergency: bool = False
    is_active: bool = True
    sort_order: int = Field(ge=0, le=10000, default=0)

    @field_validator("url")
    @classmethod
    def safe_url(cls, value: Optional[str]) -> Optional[str]:
        if value and not re.match(r"^https?://", value, re.IGNORECASE):
            raise ValueError("網址只允許 http 或 https")
        return value


class OccupationalPinWrite(StrictModel):
    pin: str = Field(min_length=4, max_length=72)
    roster_visible: bool = False


class OhsRecordWrite(StrictModel):
    record_type: Literal["hazard", "measure", "review", "meta", "roster", "schedule", "tracking", "interview"]
    status: Optional[str] = Field(None, max_length=80)
    risk_level: Optional[Literal["low", "medium", "high", "extreme", "green", "yellow", "orange", "red"]] = None
    owner: Optional[str] = Field(None, max_length=120)
    due_date: Optional[date] = None
    verified_at: Optional[date] = None
    payload: dict[str, Any] = Field(default_factory=dict)


def calculate_sleep_efficiency(payload: SleepDiaryWrite) -> int:
    bed_h, bed_m = map(int, payload.bed_time.split(":"))
    wake_h, wake_m = map(int, payload.wake_time.split(":"))
    in_bed = ((wake_h * 60 + wake_m) - (bed_h * 60 + bed_m) + 1440) % 1440
    if in_bed == 0:
        return 0
    asleep = in_bed - payload.sleep_latency_minutes - payload.night_awakenings * 10
    return max(0, min(100, round(asleep / in_bed * 100)))


def score_assessment(payload: AssessmentWrite) -> dict[str, Any]:
    kind = payload.assessment_type
    if kind in {"phq4", "pss4", "mind3", "ow", "bsrs5"}:
        if not isinstance(payload.answers, list):
            raise HTTPException(status_code=422, detail="此量表答案必須是分數陣列")
    if kind == "phq4":
        _validate_scores(payload.answers, 4, 0, 3)
        score = sum(payload.answers)
        level = "green" if score <= 2 else "yellow" if score <= 5 else "orange" if score <= 8 else "red"
        label = {"green": "正常", "yellow": "輕度", "orange": "中度", "red": "重度"}[level]
    elif kind == "pss4":
        _validate_scores(payload.answers, 4, 0, 4)
        score = payload.answers[0] + payload.answers[1] + (4 - payload.answers[2]) + (4 - payload.answers[3])
        level = "green" if score <= 5 else "yellow" if score <= 10 else "red"
        label = {"green": "低壓力", "yellow": "中度壓力", "red": "高壓力"}[level]
    elif kind == "mind3":
        _validate_scores(payload.answers, 3, 0, 3)
        score = sum(payload.answers)
        level = "green" if score >= 7 else "yellow" if score >= 4 else "red"
        label = {"green": "良好", "yellow": "普通", "red": "待加強"}[level]
    elif kind == "ow":
        _validate_scores(payload.answers, 8, 0, 4)
        score = sum(payload.answers) + min(len(set(payload.risk_factors)), 4)
        level = "green" if score <= 8 else "yellow" if score <= 16 else "orange" if score <= 24 else "red"
        label = {"green": "低風險", "yellow": "中等風險", "orange": "高風險", "red": "極高風險"}[level]
    elif kind == "msk":
        if payload.screened is None or not isinstance(payload.answers, dict):
            raise HTTPException(status_code=422, detail="NMQ 需要症狀篩檢結果與 15 部位分數")
        unknown = set(payload.answers) - MSK_PARTS
        if unknown or (payload.screened and set(payload.answers) != MSK_PARTS):
            raise HTTPException(status_code=422, detail="NMQ 部位欄位不完整")
        for value in payload.answers.values():
            if not isinstance(value, int) or not 0 <= value <= 5:
                raise HTTPException(status_code=422, detail="NMQ 分數需介於 0 到 5")
        score = max(payload.answers.values(), default=0)
        level = "green" if not payload.screened or score <= 2 else "yellow"
        label = "無危害" if level == "green" else "疑似有危害"
    elif kind == "bsrs5":
        _validate_scores(payload.answers, 5, 0, 4)
        if payload.suicide_ideation is None:
            raise HTTPException(status_code=422, detail="BSRS-5 需要附加題答案")
        score = sum(payload.answers)
        level = "green" if score <= 5 else "yellow" if score <= 9 else "orange" if score <= 14 else "red"
        if payload.suicide_ideation >= 2:
            level = "red"
        label = {"green": "一般", "yellow": "輕度情緒困擾", "orange": "中度情緒困擾", "red": "高度關懷"}[level]
    else:
        if not isinstance(payload.answers, dict) or set(payload.answers) != VIOLENCE_KEYS:
            raise HTTPException(status_code=422, detail="不法侵害自評需要四類風險答案")
        for value in payload.answers.values():
            if not isinstance(value, int) or not 0 <= value <= 3:
                raise HTTPException(status_code=422, detail="不法侵害分數需介於 0 到 3")
        score = max(payload.answers.values())
        level = "green" if score <= 1 else "yellow" if score == 2 else "red"
        label = {"green": "無明顯風險徵兆", "yellow": "建議留意", "red": "建議正式求助／申訴"}[level]

    emergency = kind == "bsrs5" and (payload.suicide_ideation or 0) >= 2
    recommendation = _recommendation(kind, level, emergency)
    return {"score": score, "level": level, "label": label, "flagged": level in {"orange", "red"},
            "emergency": emergency, "recommendations": recommendation}


def _validate_scores(values: list[Any], size: int, low: int, high: int) -> None:
    if len(values) != size or any(not isinstance(value, int) or value < low or value > high for value in values):
        raise HTTPException(status_code=422, detail=f"量表需要 {size} 題，每題分數介於 {low} 到 {high}")


def _recommendation(kind: str, level: str, emergency: bool) -> dict[str, Any]:
    if emergency:
        return {"action": "請立即尋求專業協助；可撥打 1925 安心專線，若有立即危險請撥 119。", "phone": "1925"}
    if kind == "violence" and level == "red":
        return {"action": "本工具不是正式申訴管道；請儘速使用單位正式申訴機制並尋求可信任人員協助。"}
    if level in {"orange", "red"}:
        return {"action": "建議儘快洽詢醫療、心理或職業健康專業人員。"}
    if level == "yellow":
        return {"action": "建議持續觀察、調整作息與工作負荷，並定期重新評估。"}
    return {"action": "維持目前健康習慣並定期自我檢視。"}


def _bmi(vital: dict[str, Any]) -> Optional[float]:
    height = vital.get("height_cm")
    weight = vital.get("weight_kg")
    if not height or not weight:
        return None
    return round(float(weight) / ((float(height) / 100) ** 2), 1)


def vital_reward(has_existing: bool, health_status: str, today: date) -> tuple[int, str]:
    if not has_existing:
        return 20, "three_highs:first"
    if health_status == "diagnosed":
        return 5, f"three_highs:monthly:{today.strftime('%Y-%m')}"
    return 10, f"three_highs:annual:{today.year}"


def next_vital_due(updated_at: str, health_status: str) -> str:
    updated = datetime.fromisoformat(str(updated_at).replace("Z", "+00:00"))
    days = 30 if health_status == "diagnosed" else 90 if health_status == "borderline" else 365
    return (updated.date() + timedelta(days=days)).isoformat()


def calculate_mhi(phq_score: Optional[float], pss_score: Optional[float], mind_score: Optional[float]) -> Optional[dict[str, Any]]:
    parts = {
        "phq": None if phq_score is None else max(0, 100 - round(float(phq_score) / 12 * 100)),
        "pss": None if pss_score is None else max(0, 100 - round(float(pss_score) / 16 * 100)),
        "mind": None if mind_score is None else round(float(mind_score) / 9 * 100),
    }
    available = [value for value in parts.values() if value is not None]
    if not available:
        return None
    score = round(sum(available) / len(available))
    level = "green" if score >= 75 else "yellow" if score >= 50 else "orange" if score >= 30 else "red"
    return {"score": score, "level": level, "parts": parts, "complete": len(available) == 3}


def create_reibi_batch_d_router(client: Any) -> APIRouter:
    router = APIRouter(prefix="/api/reibi/health", tags=["REIBI Batch D"])

    @router.get("/actions")
    def actions(current_user: dict = Depends(require_personal_health)):
        pid = _profile_id(current_user)
        rows = _execute(client.table("reibi_action_checkins").select("action_code,action_label,checked_on,created_at")
                        .eq("profile_id", pid).order("checked_on", desc=True).limit(100), "無法讀取行動打卡")
        balance = _rpc(client, "reibi_point_balance", {"p_profile_id": pid}, "無法讀取積分")
        return {"status": "success", "data": {"categories": ACTION_CATEGORIES, "checkins": rows, "balance": balance or 0}}

    @router.post("/actions", status_code=status.HTTP_201_CREATED)
    def checkin(payload: ActionCheckin, current_user: dict = Depends(require_personal_health)):
        label = ACTION_LABELS.get(payload.action_code)
        if not label:
            raise HTTPException(status_code=422, detail="未知的行動項目")
        result = _rpc(client, "reibi_checkin_action", {
            "p_profile_id": _profile_id(current_user), "p_org_code": _org_code(current_user),
            "p_action_code": payload.action_code, "p_action_label": label, "p_checked_on": payload.checked_on.isoformat(),
        }, "無法完成行動打卡")
        return {"status": "success", "data": result}

    @router.get("/points")
    def points(current_user: dict = Depends(require_personal_health)):
        pid = _profile_id(current_user)
        rows = _execute(client.table("reibi_point_ledger").select("id,event_code,event_key,points,metadata,created_at")
                        .eq("profile_id", pid).order("created_at", desc=True).limit(200), "無法讀取積分明細")
        balance = _rpc(client, "reibi_point_balance", {"p_profile_id": pid}, "無法讀取積分餘額")
        return {"status": "success", "data": {"balance": balance or 0, "ledger": rows}}

    @router.post("/points/redeem")
    def redeem(payload: PointsRedeem, current_user: dict = Depends(require_personal_health)):
        pid = _profile_id(current_user)
        result = _rpc(client, "reibi_adjust_points", {
            "p_profile_id": pid, "p_org_code": _org_code(current_user), "p_event_code": "redeem",
            "p_event_key": f"redeem:{payload.reward_code}:{uuid.uuid4()}", "p_points": -payload.cost,
            "p_metadata": {"reward_code": payload.reward_code, "reward_label": payload.reward_label},
            "p_created_by": pid,
        }, "無法兌換積分")
        return {"status": "success", "data": result}

    @router.post("/points/adjust")
    def adjust_points(payload: PointsAdjustment, current_user: dict = Depends(require_ohs_manager)):
        org = _org_code(current_user, required=current_user.get("role") != "reibi_super")
        target = _execute(client.table("profiles").select("id,org_code").eq("id", str(payload.profile_id)).limit(1), "無法核對使用者")
        if not target or (org and target[0].get("org_code") != org):
            raise HTTPException(status_code=404, detail="找不到此單位使用者")
        result = _rpc(client, "reibi_adjust_points", {
            "p_profile_id": str(payload.profile_id), "p_org_code": target[0].get("org_code"), "p_event_code": "adjustment",
            "p_event_key": f"adjustment:{uuid.uuid4()}", "p_points": payload.points,
            "p_metadata": {"reason": payload.reason}, "p_created_by": current_user.get("name") or current_user.get("uid"),
        }, "無法調整積分")
        return {"status": "success", "data": result}

    @router.get("/diaries/{diary_type}")
    def list_diary(diary_type: Literal["sleep", "pain"], current_user: dict = Depends(require_personal_health)):
        rows = _execute(client.table("reibi_health_diary_entries").select("id,diary_type,entry_date,source_payload,created_at,updated_at")
                        .eq("profile_id", _profile_id(current_user)).eq("diary_type", diary_type)
                        .order("entry_date", desc=True).limit(28), "無法讀取健康日誌")
        return {"status": "success", "data": rows}

    def save_diary(kind: str, entry_date: date, values: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
        pid = _profile_id(current_user)
        saved = _execute(client.table("reibi_health_diary_entries").upsert({
            "profile_id": pid, "artifact_user_key": pid, "diary_type": kind, "entry_date": entry_date.isoformat(),
            "source_payload": values, "updated_at": _now(),
        }, on_conflict="profile_id,diary_type,entry_date"), "無法儲存健康日誌")
        points = _rpc(client, "reibi_adjust_points", {
            "p_profile_id": pid, "p_org_code": _org_code(current_user), "p_event_code": f"{kind}_diary",
            "p_event_key": f"diary:{kind}:{entry_date.isoformat()}", "p_points": 3,
            "p_metadata": {"entry_date": entry_date.isoformat()}, "p_created_by": pid,
        }, "日誌已儲存，但無法更新積分")
        return {"entry": saved[0], "points": points}

    @router.put("/diaries/sleep")
    def save_sleep(payload: SleepDiaryWrite, current_user: dict = Depends(require_personal_health)):
        values = payload.model_dump(mode="json")
        values["sleep_efficiency"] = calculate_sleep_efficiency(payload)
        return {"status": "success", "data": save_diary("sleep", payload.entry_date, values, current_user)}

    @router.put("/diaries/pain")
    def save_pain(payload: PainDiaryWrite, current_user: dict = Depends(require_personal_health)):
        return {"status": "success", "data": save_diary("pain", payload.entry_date, payload.model_dump(mode="json"), current_user)}

    @router.get("/vitals")
    def get_vitals(current_user: dict = Depends(require_personal_health)):
        rows = _execute(client.table("reibi_vital_profiles").select("*").eq("profile_id", _profile_id(current_user)).limit(1), "無法讀取三高資料")
        data = rows[0] if rows else None
        if data:
            data["bmi"] = _bmi(data)
            data["next_update_due"] = next_vital_due(data["updated_at"], data["health_status"])
        return {"status": "success", "data": data}

    @router.put("/vitals")
    def save_vitals(payload: VitalWrite, current_user: dict = Depends(require_personal_health)):
        pid = _profile_id(current_user)
        org = _org_code(current_user)
        existing = _execute(
            client.table("reibi_vital_profiles").select("profile_id").eq("profile_id", pid).limit(1),
            "無法核對既有三高資料",
        )
        values = payload.model_dump()
        if not org:
            values.update({"department_key": None, "department_consent": False})
        elif payload.department_consent and not payload.department_key:
            raise HTTPException(status_code=422, detail="同意部門彙整時必須選擇部門")
        if not payload.department_consent:
            values["department_key"] = None
        values.update({"profile_id": pid, "org_code": org, "source_payload": {}, "updated_at": _now()})
        rows = _execute(client.table("reibi_vital_profiles").upsert(values, on_conflict="profile_id"), "無法儲存三高資料")
        reward_points, reward_key = vital_reward(bool(existing), payload.health_status, date.today())
        points = _rpc(client, "reibi_adjust_points", {
            "p_profile_id": pid, "p_org_code": org, "p_event_code": "three_highs",
            "p_event_key": reward_key, "p_points": reward_points,
            "p_metadata": {"department_consent": values["department_consent"]}, "p_created_by": pid,
        }, "三高資料已儲存，但無法更新積分")
        result = rows[0]; result["bmi"] = _bmi(result)
        result["next_update_due"] = next_vital_due(result["updated_at"], result["health_status"])
        return {"status": "success", "data": {"vitals": result, "points": points}}

    @router.get("/vitals/aggregate")
    def vital_aggregate(org_code: Optional[str] = None, department: Optional[str] = None,
                        current_user: dict = Depends(require_aggregate_viewer)):
        org = _org_code(current_user, org_code, required=True)
        if current_user.get("role") == "dept_head":
            own_department = current_user.get("dept")
            if not own_department:
                raise HTTPException(status_code=403, detail="部門主管登入資訊缺少部門")
            if department and department != own_department:
                raise HTTPException(status_code=403, detail="不可查閱其他部門")
            department = own_department
        result = _rpc(client, "reibi_three_highs_aggregate", {"p_org_code": org, "p_department_key": department}, "無法產生三高彙整")
        return {"status": "success", "data": result}

    @router.post("/assessments", status_code=status.HTTP_201_CREATED)
    def submit_assessment(payload: AssessmentWrite, current_user: dict = Depends(require_personal_health)):
        pid = _profile_id(current_user); org = _org_code(current_user)
        scored = score_assessment(payload)
        artifact_id = str(uuid.uuid4())
        answers = {"values": payload.answers, "risk_factors": payload.risk_factors, "screened": payload.screened,
                   "duration": payload.duration, "suicide_ideation": payload.suicide_ideation}
        rows = _execute(client.table("reibi_health_assessments").insert({
            "artifact_id": artifact_id, "profile_id": pid, "artifact_user_key": pid, "org_code": org,
            "department_key": current_user.get("dept"), "assessment_type": payload.assessment_type,
            "score": scored["score"], "level_code": scored["level"], "level_label": scored["label"],
            "is_flagged": scored["flagged"], "answers": answers, "recommendations": scored["recommendations"],
            "source_payload": {}, "assessed_at": _now(),
            "consent_org_aggregate": payload.consent_org_aggregate,
        }), "無法儲存健康評估")
        points = _rpc(client, "reibi_adjust_points", {
            "p_profile_id": pid, "p_org_code": org, "p_event_code": payload.assessment_type,
            "p_event_key": f"assessment:{artifact_id}", "p_points": ASSESSMENT_POINTS[payload.assessment_type],
            "p_metadata": {"assessment_type": payload.assessment_type}, "p_created_by": pid,
        }, "評估已儲存，但無法更新積分")
        data = dict(rows[0]); data.update({"emergency": scored["emergency"], "points": points})
        return {"status": "success", "data": data}

    @router.get("/assessments")
    def list_assessments(assessment_type: Optional[str] = None, current_user: dict = Depends(require_personal_health)):
        query = client.table("reibi_health_assessments").select("id,assessment_type,score,secondary_score,level_code,level_label,is_flagged,answers,recommendations,assessed_at").eq("profile_id", _profile_id(current_user))
        if assessment_type:
            query = query.eq("assessment_type", assessment_type)
        rows = _execute(query.order("assessed_at", desc=True).limit(100), "無法讀取評估歷史")
        return {"status": "success", "data": rows}

    @router.get("/assessments/mhi")
    def mental_health_index(current_user: dict = Depends(require_personal_health)):
        rows = _execute(client.table("reibi_health_assessments").select("assessment_type,score,assessed_at")
                        .eq("profile_id", _profile_id(current_user)).in_("assessment_type", ["phq4", "pss4", "mind3"])
                        .order("assessed_at", desc=True).limit(100), "無法計算 MHI")
        latest = {kind: next((row for row in rows if row["assessment_type"] == kind), None) for kind in ("phq4", "pss4", "mind3")}
        result = calculate_mhi(*(latest[kind]["score"] if latest[kind] else None for kind in ("phq4", "pss4", "mind3")))
        return {"status": "success", "data": result}

    @router.get("/assessments/activity")
    def assessment_activity(org_code: Optional[str] = None, current_user: dict = Depends(require_ohs_manager)):
        org = _org_code(current_user, org_code, required=True)
        rows = _execute(client.table("reibi_health_assessments").select("assessment_type").eq("org_code", org)
                        .in_("assessment_type", ["ow", "msk", "bsrs5"]), "無法讀取職安填答活躍度")
        raw_counts = {kind: sum(1 for row in rows if row["assessment_type"] == kind) for kind in ("ow", "msk", "bsrs5")}
        counts = {kind: count if count >= 5 else None for kind, count in raw_counts.items()}
        return {"status": "success", "data": {
            "counts": counts,
            "suppressed": [kind for kind, count in raw_counts.items() if count < 5],
            "note": "此為送出份數，不是完成率；不含職場不法侵害。少於 5 份不顯示。",
        }}

    @router.get("/assessments/reminders")
    def assessment_reminders(current_user: dict = Depends(require_personal_health)):
        org = _org_code(current_user)
        if not org:
            return {"status": "success", "data": []}
        start, end = date.today(), date.today() + timedelta(days=30)
        rows = _execute(
            client.table("reibi_ohs_records")
            .select("id,due_date,source_payload")
            .eq("org_code", org).eq("record_type", "schedule")
            .gte("due_date", start.isoformat()).lte("due_date", end.isoformat())
            .order("due_date"),
            "無法讀取評估提醒",
        )
        department = current_user.get("dept")
        visible = [
            row for row in rows
            if not row.get("source_payload", {}).get("department_key")
            or row.get("source_payload", {}).get("department_key") == department
        ]
        return {"status": "success", "data": visible}

    @router.get("/timeline")
    def timeline(current_user: dict = Depends(require_personal_health)):
        pid = _profile_id(current_user)
        actions = _execute(client.table("reibi_action_checkins").select("action_label,checked_on,created_at").eq("profile_id", pid).order("created_at", desc=True).limit(30), "無法讀取行動時間軸")
        diaries = _execute(client.table("reibi_health_diary_entries").select("diary_type,entry_date,source_payload,updated_at").eq("profile_id", pid).order("entry_date", desc=True).limit(30), "無法讀取日誌時間軸")
        assessments = _execute(client.table("reibi_health_assessments").select("assessment_type,score,level_code,assessed_at").eq("profile_id", pid).order("assessed_at", desc=True).limit(30), "無法讀取評估時間軸")
        ledger = _execute(client.table("reibi_point_ledger").select("points,created_at").eq("profile_id", pid)
                          .gte("created_at", f"{date.today().year}-01-01T00:00:00Z").order("created_at"), "無法讀取 888 曲線")
        events = ([{"type": "action", "at": row["created_at"], **row} for row in actions]
                  + [{"type": "diary", "at": row["updated_at"], **row} for row in diaries]
                  + [{"type": "assessment", "at": row["assessed_at"], **row} for row in assessments])
        events.sort(key=lambda row: row.get("at") or "", reverse=True)
        weekly: dict[str, int] = {}
        for row in ledger:
            day = datetime.fromisoformat(str(row["created_at"]).replace("Z", "+00:00")).date()
            monday = date.fromordinal(day.toordinal() - day.weekday()).isoformat()
            weekly[monday] = weekly.get(monday, 0) + int(row["points"])
        curve = [{"week": week, "points": points} for week, points in sorted(weekly.items())][-12:]
        return {"status": "success", "data": {"events": events[:60], "curve": curve}}

    @router.post("/feedback", status_code=status.HTTP_201_CREATED)
    def submit_feedback(payload: FeedbackWrite, current_user: dict = Depends(require_personal_health)):
        pid = _profile_id(current_user); org = _org_code(current_user)
        rows = _execute(client.table("reibi_feedback_surveys").insert({
            "profile_id": pid, "org_code": org, "department_key": current_user.get("dept"),
            "period_key": payload.period_key, "audience_role": current_user.get("role"), "answers": payload.answers,
            "satisfaction_score": payload.satisfaction_score, "nps_score": payload.nps_score, "free_text": payload.free_text,
        }), "此季度已填寫或無法儲存回饋")
        award = 15 if current_user.get("role") == "dept_head" else 10
        points = _rpc(client, "reibi_adjust_points", {
            "p_profile_id": pid, "p_org_code": org, "p_event_code": "feedback", "p_event_key": f"feedback:{payload.period_key}",
            "p_points": award, "p_metadata": {"period_key": payload.period_key}, "p_created_by": pid,
        }, "回饋已儲存，但無法更新積分")
        return {"status": "success", "data": {"feedback": rows[0], "points": points}}

    @router.get("/feedback/aggregate")
    def feedback_aggregate(period_key: str = Query(pattern=r"^[0-9]{4}-Q[1-4]$"), org_code: Optional[str] = None,
                           department: Optional[str] = None, current_user: dict = Depends(require_aggregate_viewer)):
        org = _org_code(current_user, org_code, required=True)
        if current_user.get("role") == "dept_head":
            department = current_user.get("dept")
            if not department:
                raise HTTPException(status_code=403, detail="部門主管登入資訊缺少部門")
        result = _rpc(client, "reibi_feedback_aggregate", {"p_org_code": org, "p_period_key": period_key, "p_department_key": department}, "無法產生回饋彙整")
        return {"status": "success", "data": result}

    @router.get("/eap")
    def list_eap(current_user: dict = Depends(get_current_user)):
        org = _org_code(current_user)
        query = client.table("reibi_eap_resources").select("id,org_code,category_code,title,description,phone,url,is_emergency,is_active,sort_order")
        query = query.or_(f"org_code.is.null,org_code.eq.{org}") if org else query.is_("org_code", "null")
        rows = _execute(query.eq("is_active", True).order("category_code").order("sort_order"), "無法讀取 EAP 資源")
        return {"status": "success", "data": rows}

    @router.post("/eap", status_code=status.HTTP_201_CREATED)
    def create_eap(payload: EapResourceWrite, current_user: dict = Depends(require_ohs_manager)):
        org = _org_code(current_user, required=current_user.get("role") != "reibi_super")
        values = payload.model_dump(); values.update({"org_code": org, "created_by": current_user.get("name")})
        rows = _execute(client.table("reibi_eap_resources").insert(values), "無法建立 EAP 資源")
        return {"status": "success", "data": rows[0]}

    @router.put("/eap/{resource_id}")
    def update_eap(resource_id: int, payload: EapResourceWrite, current_user: dict = Depends(require_ohs_manager)):
        org = _org_code(current_user, required=current_user.get("role") != "reibi_super")
        existing = _execute(client.table("reibi_eap_resources").select("id,org_code").eq("id", resource_id).limit(1), "無法核對 EAP 資源")
        if not existing or (org and existing[0].get("org_code") != org):
            raise HTTPException(status_code=404, detail="找不到 EAP 資源")
        values = payload.model_dump(); values["updated_at"] = _now()
        rows = _execute(client.table("reibi_eap_resources").update(values).eq("id", resource_id), "無法更新 EAP 資源")
        return {"status": "success", "data": rows[0]}

    @router.put("/occupational-access")
    def occupational_access(payload: OccupationalPinWrite, current_user: dict = Depends(require_ohs_manager)):
        org = _org_code(current_user, required=True)
        rows = _execute(client.table("organizations").update({
            "occupational_health_pin": pwd_context.hash(payload.pin), "oh_roster_visible": payload.roster_visible,
        }).eq("org_code", org), "無法更新臨場醫護登入設定")
        if not rows:
            raise HTTPException(status_code=404, detail="找不到單位")
        return {"status": "success", "data": {"org_code": org, "enabled": True, "roster_visible": payload.roster_visible}}

    def check_ohs_scope(user: dict[str, Any], record_type: Optional[str], requested_org: Optional[str]) -> str:
        org = _org_code(user, requested_org, required=True)
        if user.get("role") == "occupational_health" and record_type not in {None, "interview", "roster"}:
            raise HTTPException(status_code=403, detail="臨場醫護只能存取去識別化 roster 與面談記錄")
        return org

    @router.get("/ohs")
    def list_ohs(record_type: Optional[str] = None, org_code: Optional[str] = None,
                 current_user: dict = Depends(require_occupational)):
        org = check_ohs_scope(current_user, record_type, org_code)
        if current_user.get("role") == "occupational_health" and record_type is None:
            record_type = "interview"
        if current_user.get("role") == "occupational_health" and record_type == "roster":
            setting = _execute(client.table("organizations").select("oh_roster_visible").eq("org_code", org).limit(1), "無法核對 roster 權限")
            if not setting or not setting[0].get("oh_roster_visible"):
                raise HTTPException(status_code=403, detail="單位管理者尚未開放 roster 檢視")
        query = client.table("reibi_ohs_records").select("id,artifact_id,org_code,record_type,status,risk_level,owner,due_date,verified_at,source_payload,created_at,updated_at").eq("org_code", org)
        if record_type:
            query = query.eq("record_type", record_type)
        rows = _execute(query.order("created_at", desc=True).limit(500), "無法讀取職安資料")
        return {"status": "success", "data": rows}

    @router.post("/ohs", status_code=status.HTTP_201_CREATED)
    def create_ohs(payload: OhsRecordWrite, org_code: Optional[str] = None,
                   current_user: dict = Depends(require_occupational)):
        org = check_ohs_scope(current_user, payload.record_type, org_code)
        if current_user.get("role") == "occupational_health" and payload.record_type != "interview":
            raise HTTPException(status_code=403, detail="臨場醫護只能新增面談記錄")
        source = dict(payload.payload)
        if payload.record_type in {"roster", "interview", "tracking"}:
            employee_key = source.get("employee_key")
            if not isinstance(employee_key, str) or not re.fullmatch(r"[A-Za-z0-9_-]{2,40}", employee_key):
                raise HTTPException(status_code=422, detail="必須使用 2–40 位英數、底線或連字號的去識別化員工代碼")
            source.pop("employee_name", None)
            source.pop("name", None)
        risk = payload.risk_level
        if payload.record_type == "hazard":
            severity, frequency = source.get("severity"), source.get("frequency")
            if severity not in RISK_MATRIX or frequency not in RISK_MATRIX[severity]:
                raise HTTPException(status_code=422, detail="危害需要 high／medium／low 的嚴重度與頻率")
            risk = RISK_MATRIX[severity][frequency]
        artifact_id = str(uuid.uuid4())
        values = payload.model_dump(exclude={"payload"}, mode="json")
        values.update({"artifact_id": artifact_id, "org_code": org, "risk_level": risk, "source_payload": source})
        rows = _execute(client.table("reibi_ohs_records").insert(values), "無法建立職安記錄")
        return {"status": "success", "data": rows[0]}

    @router.put("/ohs/{record_id}")
    def update_ohs(record_id: int, payload: OhsRecordWrite, org_code: Optional[str] = None,
                   current_user: dict = Depends(require_occupational)):
        org = check_ohs_scope(current_user, payload.record_type, org_code)
        existing = _execute(client.table("reibi_ohs_records").select("id,org_code,record_type").eq("id", record_id).limit(1), "無法核對職安記錄")
        if not existing or existing[0]["org_code"] != org or existing[0]["record_type"] != payload.record_type:
            raise HTTPException(status_code=404, detail="找不到職安記錄")
        if current_user.get("role") == "occupational_health" and payload.record_type != "interview":
            raise HTTPException(status_code=403, detail="臨場醫護只能更新面談記錄")
        source = dict(payload.payload)
        source.pop("employee_name", None); source.pop("name", None)
        risk = payload.risk_level
        if payload.record_type == "hazard":
            severity, frequency = source.get("severity"), source.get("frequency")
            if severity not in RISK_MATRIX or frequency not in RISK_MATRIX[severity]:
                raise HTTPException(status_code=422, detail="危害需要 high／medium／low 的嚴重度與頻率")
            risk = RISK_MATRIX[severity][frequency]
        values = payload.model_dump(exclude={"record_type", "payload"}, mode="json")
        values.update({"source_payload": source, "risk_level": risk, "updated_at": _now()})
        rows = _execute(client.table("reibi_ohs_records").update(values).eq("id", record_id).eq("org_code", org), "無法更新職安記錄")
        return {"status": "success", "data": rows[0]}

    @router.delete("/ohs/{record_id}")
    def delete_ohs(record_id: int, org_code: Optional[str] = None,
                   current_user: dict = Depends(require_ohs_manager)):
        org = _org_code(current_user, org_code, required=True)
        rows = _execute(client.table("reibi_ohs_records").delete().eq("id", record_id).eq("org_code", org), "無法刪除職安記錄")
        if not rows:
            raise HTTPException(status_code=404, detail="找不到職安記錄")
        return {"status": "success", "data": {"id": record_id}}

    @router.get("/ohs/plan/snapshot")
    def ohs_snapshot(org_code: Optional[str] = None, current_user: dict = Depends(require_ohs_manager)):
        org = _org_code(current_user, org_code, required=True)
        rows = _execute(client.table("reibi_ohs_records").select("id,artifact_id,record_type,status,risk_level,owner,due_date,verified_at,source_payload,created_at,updated_at")
                        .eq("org_code", org).in_("record_type", ["hazard", "measure", "review", "meta"])
                        .order("created_at"), "無法產生 OHS 計畫快照")
        grouped = {key: [row for row in rows if row["record_type"] == key] for key in ("hazard", "measure", "review", "meta")}
        return {"status": "success", "data": {"org_code": org, "generated_at": _now(), **grouped}}

    return router
