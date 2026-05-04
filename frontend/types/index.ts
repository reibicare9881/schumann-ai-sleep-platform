// frontend/types/index.ts

export interface UserProfile {
  name: string;
  age?: number;
  gender?: string;
  dept?: string;
  orgRole?: string;
  industry?: string;
  shiftWork?: string;
  painLocations?: string[];
  // 依據你的 AssessmentData 結構補齊
}

export interface LevelInfo {
  key: string;
  label: string;
  desc?: string;
  action?: string;
}

// 這是前端經過 mapping 後的資料結構 (你在 history 或 dashboard 轉換後的格式)
export interface MappedSleepReport {
  id: string;
  uid: string;          // 從 user_id 轉換來
  ts: string;           // 從 created_at 轉換來
  sScore: number;       // 從 sleep_score 轉換來
  pScore: number;       // 從 pain_score 轉換來
  wScore: number;       // 從 work_score 轉換來
  sLevel: LevelInfo;
  pLevel: LevelInfo;
  sKey?: string;        // 某些頁面用到的簡化標籤
  pKey?: string;
  dept?: string;        // 為了方便高風險/KPI過濾拉出來的欄位
  profile: UserProfile;
  sAns?: any;
  pAns?: any;
}

// 這是後端 API 原始回傳的結構 (Snake Case)
export interface BackendSleepReport {
  id: string;
  user_id: string;
  org_code: string;
  platform: string;
  created_at: string;
  sleep_score: number;
  sleep_level: string;
  pain_score: number;
  pain_level: string;
  work_score: number;
  sleep_scores?: any; 
  pain_scores?: any;
  work_scores?: any;
  profile: UserProfile;
  status: string;
}