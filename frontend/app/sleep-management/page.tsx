"use client";

import { useState } from 'react';
import { sleepDatabase } from '@/lib/data/sleepData';
import { IssueData } from '@/lib/data/painData';
import Link from 'next/link';
import { ArrowLeft, Moon, HeartPulse } from 'lucide-react';

// Helper to get grouped options
const OPTION_GROUPS = [
  {
    label: "-- 入睡困難與障礙 --",
    options: ["stress_insomnia", "anxiety_insomnia", "environment_noise", "caffeine_effect", "screen_blue_light", "late_exercise_exciting", "full_stomach", "hungry_insomnia", "temperature_uncomfortable", "fear_of_dark"]
  },
  {
    label: "-- 睡眠維持與品質不良 --",
    options: ["frequent_waking", "early_waking", "nightmare_distress", "sleep_apnea_snore", "nocturia_sleep", "night_sweating", "teeth_grinding", "sleep_talking", "unrefreshing_sleep", "body_pain_sleep"]
  },
  {
    label: "-- 生活作息與生理時鐘失調 --",
    options: ["jet_lag", "shift_work", "delayed_sleep_phase", "irregular_schedule", "overwork_exhaustion", "sedentary_no_fatigue", "irregular_nap", "alcohol_dependence", "nicotine_excitement", "seasonal_affective"]
  },
  {
    label: "-- 特殊生理時期與族群 --",
    options: ["menopause_insomnia", "pms_insomnia", "postpartum_care", "elderly_shallow_sleep", "student_exam_stress", "travel_first_night", "obesity_sleep_disturb", "digestive_reflux", "restless_legs", "cold_nasal_congestion"]
  },
  {
    label: "-- 日間精神與睡眠延伸症狀 --",
    options: ["daytime_somnolence", "brain_fog", "memory_decline", "tension_neck_morning", "morning_headache", "dry_mouth_morning", "dark_circles_edema", "sleep_anxiety_loop", "weekend_migraine", "circadian_low_energy"]
  }
];

export default function SleepManagementPage() {
  const [currentPart, setCurrentPart] = useState<string>("stress_insomnia");
  const [currentRole, setCurrentRole] = useState<"pt" | "tcm" | "meridian">("pt");

  const data: IssueData = sleepDatabase[currentPart];
  const roleData = data[currentRole];

  return (
    <div className="bg-slate-50 text-slate-800 min-h-screen flex flex-col">
      {/* 🟢 頂部導航列 */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/login" className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors font-medium text-sm">
            <ArrowLeft className="w-4 h-4" /> 回登入頁
          </Link>
          <div className="flex gap-2">
            <Link href="/pain-education" className="flex items-center gap-2 px-3 py-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg text-sm font-medium transition-colors border border-transparent">
              <HeartPulse className="w-4 h-4" /> 疼痛衛教
            </Link>
            <Link href="/sleep-management" className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-bold border border-indigo-200">
              <Moon className="w-4 h-4" /> 睡眠專家
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8 flex-grow w-full">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-700 mb-2">
            <span className="mr-2">🌙</span>睡眠管理與健康促進專家系統
          </h1>
          <p className="text-slate-500">已建構 50 項常見睡眠困擾。請切換專家角色觀點獲取居家保健與介入建議。</p>
        </header>

        {/* Controls */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Selection */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">1. 選擇睡眠困擾 (共50項)</label>
              <select
                value={currentPart}
                onChange={(e) => setCurrentPart(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              >
                {OPTION_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map((opt) => (
                      <option key={opt} value={opt}>{sleepDatabase[opt].name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Role Switcher */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">2. 切換專家角色觀點</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setCurrentRole('pt')}
                  className={`role-btn py-3 px-2 rounded-lg font-medium text-center border-2 text-xs transition-all ${currentRole === 'pt' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                >
                  <span className="block mb-1 text-base">🩺</span>物理治療師
                </button>
                <button
                  onClick={() => setCurrentRole('tcm')}
                  className={`role-btn py-3 px-2 rounded-lg font-medium text-center border-2 text-xs transition-all ${currentRole === 'tcm' ? 'bg-teal-700 text-white border-teal-700' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                >
                  <span className="block mb-1 text-base">🌿</span>中醫師
                </button>
                <button
                  onClick={() => setCurrentRole('meridian')}
                  className={`role-btn py-3 px-2 rounded-lg font-medium text-center border-2 text-xs transition-all ${currentRole === 'meridian' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                >
                  <span className="block mb-1 text-base">👐</span>經絡老師
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
          <div className={`${roleData.colorClass} text-white px-6 py-4 flex items-center justify-between transition-colors duration-300`}>
            <span className="text-lg font-bold">{roleData.roleName}</span>
            <span className="bg-black/20 text-xs px-3 py-1 rounded-full uppercase tracking-wider font-semibold">
              {data.name}
            </span>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-md font-bold text-slate-900 flex items-center mb-2">
                <span className="w-1.5 h-5 bg-emerald-500 rounded-full mr-2"></span>核心成因分析
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100">
                {roleData.reason}
              </p>
            </div>

            <div>
              <h3 className="text-md font-bold text-slate-900 flex items-center mb-2">
                <span className="w-1.5 h-5 bg-amber-500 rounded-full mr-2"></span>日常睡眠衛教
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100">
                {roleData.education}
              </p>
            </div>

            <div className="border-t border-slate-100 pt-6">
              <h3 className="text-md font-bold text-indigo-900 flex items-center mb-3">
                <span className="mr-2 text-lg animate-pulse">🛏️</span>健康促進介入位置與保健法
              </h3>
              <div className="bg-rose-50 border border-rose-100 rounded-xl p-5">
                <h4 className="font-bold text-rose-700 text-base mb-2">建議位置：{roleData.targetPoint}</h4>
                <p className="text-slate-700 text-sm leading-relaxed">{roleData.action}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <section className="bg-slate-100 rounded-xl p-6 mb-6 text-xs text-slate-500 space-y-2">
          <h5 className="font-bold text-slate-700 text-sm mb-2">📖 學術參考與資料出處：</h5>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>物理治療學派：</strong>依據美國睡眠醫學會(AASM)睡眠衛生指南、自主神經系統檢測(HRV)臨床應用與深層肌肉放鬆技術。</li>
            <li><strong>中醫學派：</strong>依據《黃帝內經·素問》、《傷寒論》失眠辨證，遵循陰陽交替、營衛不和及五臟不寧之本草調理原則。</li>
            <li><strong>經絡能量學派：</strong>結合傳統經絡腧穴定位法、子午流注規律（如半夜子時行膽經、丑時行肝經）與現代生物共振睡眠調頻理論。</li>
          </ul>
        </section>
      </div>

      {/* Disclaimer */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-4 text-center border-t border-slate-800 mt-auto">
        <div className="max-w-4xl mx-auto px-4">
          <p className="font-semibold text-amber-500 mb-1">⚠️ 【重要免責聲明】</p>
          <p>本應用程式所提供之核心成因、睡眠衛教內容以及健康促進介入位置點（含呼吸調節、自主神經放鬆、穴位與經絡引導法）僅作為居家睡眠品質優化與自我保健促進之參考，**絕不具備醫療診斷、失眠症臨床治療、藥物開立或實質醫療行為之用途**。若您長期患有嚴重慢性失眠、重度睡眠呼吸中止或其他身體嚴重不適，請立即尋求合格醫師進行正規治療。</p>
        </div>
      </footer>
    </div>
  );
}
