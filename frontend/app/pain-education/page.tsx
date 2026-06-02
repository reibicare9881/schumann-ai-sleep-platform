"use client";

import { useState } from 'react';
import { painDatabase, IssueData } from '@/lib/data/painData';
import Link from 'next/link';
import { ArrowLeft, Moon, HeartPulse } from 'lucide-react';

// Helper to get grouped options
const OPTION_GROUPS = [
  {
    label: "-- 頭頸面部 --",
    options: ["tension_headache", "migraine", "occipital_neuralgia", "tmj_disorder", "cervical_stiffness", "cervical_radiculopathy", "eyestrain_headache"]
  },
  {
    label: "-- 肩胸背部 --",
    options: ["shoulder_impingement", "frozen_shoulder", "rotator_cuff_tendinitis", "levator_scapulae_pain", "rhomboid_strain", "thoracic_outlet", "intercostal_neuralgia", "thoracic_stiffness", "pectoralis_major_tightness"]
  },
  {
    label: "-- 腰薦尾椎 --",
    options: ["acute_lumbago", "lumbar_disc_herniation", "sciatica", "piriformis_syndrome", "si_joint_dysfunction", "psoas_muscle_tightness", "coccydynia"]
  },
  {
    label: "-- 上肢手部 --",
    options: ["tennis_elbow", "golfers_elbow", "olecranon_bursitis", "carpal_tunnel", "de_quervain_tenosynovitis", "trigger_finger", "wrist_sprain", "tfcc_injury", "finger_oa"]
  },
  {
    label: "-- 下肢臀腿膝足 --",
    options: ["hip_oa", "trochanteric_bursitis", "it_band_syndrome", "patellofemoral_pain", "knee_oa", "patellar_tendinitis", "meniscus_tear", "bakers_cyst", "shin_splints", "calf_strain", "achilles_tendinitis", "ankle_inversion_sprain", "high_ankle_sprain", "plantar_fasciitis", "tarsal_tunnel", "achilles_bursitis", "bunion_pain", "fibromyalgia"]
  }
];

export default function PainEducationPage() {
  const [currentPart, setCurrentPart] = useState<string>("tennis_elbow");
  const [currentRole, setCurrentRole] = useState<"pt" | "tcm" | "meridian">("pt");

  const data: IssueData = painDatabase[currentPart];
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
            <Link href="/pain-education" className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 text-rose-700 rounded-lg text-sm font-bold border border-rose-200">
              <HeartPulse className="w-4 h-4" /> 疼痛衛教
            </Link>
            <Link href="/sleep-management" className="flex items-center gap-2 px-3 py-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-sm font-medium transition-colors border border-transparent">
              <Moon className="w-4 h-4" /> 睡眠專家
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8 flex-grow w-full">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-700 mb-2">
            <span className="mr-2">❤️</span>疼痛衛教與健康促進專家系統
          </h1>
          <p className="text-slate-500">已擴充至 50 項常見疼痛部位。請切換專家角色觀點獲取導引。</p>
        </header>

        {/* Controls */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Selection */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">1. 選擇疼痛部位 (共50項)</label>
              <select
                value={currentPart}
                onChange={(e) => setCurrentPart(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              >
                {OPTION_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map((opt) => (
                      <option key={opt} value={opt}>{painDatabase[opt].name}</option>
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
                <span className="w-1.5 h-5 bg-emerald-500 rounded-full mr-2"></span>可能原因分析
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100">
                {roleData.reason}
              </p>
            </div>

            <div>
              <h3 className="text-md font-bold text-slate-900 flex items-center mb-2">
                <span className="w-1.5 h-5 bg-amber-500 rounded-full mr-2"></span>日常衛教建議
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100">
                {roleData.education}
              </p>
            </div>

            <div className="border-t border-slate-100 pt-6">
              <h3 className="text-md font-bold text-indigo-900 flex items-center mb-3">
                <span className="mr-2 text-lg animate-pulse">📍</span>健康促進介入位置與方法
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
            <li><strong>物理治療學派：</strong>依據《Magee 骨科物理治療評估學》、關節鬆動術(Maitland/Muligan)與軟組織貼紮臨床指引。</li>
            <li><strong>中醫學派：</strong>依據《中醫傷科學》、《針灸學》教材，遵循辨證論治、十二正經與奇經八脈之氣血走形原則。</li>
            <li><strong>經絡能量學派：</strong>結合《黃帝內經·靈樞·經脈篇》、傳統腧穴定位法與現代生物共振理論。</li>
          </ul>
        </section>
      </div>

      {/* Disclaimer */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-4 text-center border-t border-slate-800 mt-auto">
        <div className="max-w-4xl mx-auto px-4">
          <p className="font-semibold text-amber-500 mb-1">⚠️ 【重要免責聲明】</p>
          <p>本應用程式所提供之可能原因、衛教內容以及健康促進介入位置點僅作為居家健康管理與自我保健促進之參考，**絕不具備醫療診斷、醫療行為、處方簽開立或實質醫療治療之用途**。若您有持續性劇烈疼痛、局部發炎紅腫熱痛或其他身體嚴重不適，請立即尋求合格之專科醫師進行正規治療。</p>
        </div>
      </footer>
    </div>
  );
}
