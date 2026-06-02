import { DatabaseType } from './painData';

export const sleepDatabase: DatabaseType = {
  stress_insomnia: {
    name: "01. 壓力型入睡困難 (大腦停不下來)",
    pt: {
      roleName: "物理治療師觀點", colorClass: "bg-indigo-600",
      reason: "交感神經過度亢進，大腦皮質持續處於高頻 beta 波狀態，導致核心體溫無法順利下降、心率變異度(HRV)偏低，無法啟動睡眠機制。",
      education: "睡前60分鐘進行「數位排毒」，關閉工作訊息。可於睡前90分鐘洗熱水澡，利用身體退熱的生物反射幫助大腦降溫。",
      targetPoint: "橫膈膜區域（進行腹式呼吸驅動）及枕下肌群",
      action: "【橫膈膜呼吸導引】正躺，一手放胸口一手放腹部。執行「4-7-8呼吸法」：吸氣4秒、憋氣7秒、吐氣8秒。這能高度刺激迷走神經，強迫交感神經降速，釋放肌肉張力。"
    },
    tcm: {
      roleName: "中醫師觀點", colorClass: "bg-teal-700",
      reason: "多屬「肝鬱化火」或「心火內熾」。長期思慮過度傷及心脾，導致陽氣無法入於陰分，神不守舍因而無法入眠。",
      education: "傍晚過後避免談論刺激性話題，晚餐宜清淡。睡前可用溫熱水泡腳（可加入艾草或合歡皮），引火下行。",
      targetPoint: "足厥陰肝經、手少陰心經",
      action: "【漢方本草與溫通】建議選用內含酸棗仁、茯神、遠志之安神本草精油貼布，敷貼於足底湧泉穴，以溫通原理滋陰降火、寧心安神。"
    },
    meridian: {
      roleName: "經絡老師觀點", colorClass: "bg-amber-600",
      reason: "大腦思慮過多使能量過度集中於頭部，手少陰心經與足少陽膽經的經氣阻塞在頭部，造成上實下虛、陽不入陰。",
      education: "睡前使用圓頭經絡梳，由前額神庭穴往後梳理至後腦風池穴50次，將頭部淤積的壓力與浮陽引導下來。",
      targetPoint: "神門穴（手腕橫紋尺側凹陷處）、安眠穴（翳風與風池連線中點）",
      action: "【點穴安神導引】以拇指尖規律揉按雙側「神門穴」與耳後的「安眠穴」各3分鐘，力度以微感酸脹為佳，能迅速安定心神，安撫逆亂的經絡能量。"
    }
  }
};

const sleepRestPartsRecord: Record<string, string> = {
  "anxiety_insomnia": "02. 焦慮緊張型失眠",
  "environment_noise": "03. 環境噪音/光線敏感型失眠",
  "caffeine_effect": "04. 咖啡因/茶飲敏感型入睡困難",
  "screen_blue_light": "05. 睡前成癮 3C 藍光刺激",
  "late_exercise_exciting": "06. 睡前過度運動導致大腦亢進",
  "full_stomach": "07. 睡前吃太飽/胃不和則臥不安",
  "hungry_insomnia": "08. 夜間空腹飢餓型失眠",
  "temperature_uncomfortable": "09. 臥室核心溫度過高/過低",
  "fear_of_dark": "10. 黑暗恐懼/睡前安全感缺乏",
  "frequent_waking": "11. 淺眠易醒 (半夜稍微有聲音就醒)",
  "early_waking": "12. 早醒且無法再度入睡",
  "nightmare_distress": "13. 多夢易驚醒/惡夢困擾",
  "sleep_apnea_snore": "14. 慣性打呼/睡眠呼吸中止傾向",
  "nocturia_sleep": "15. 夜間頻尿中斷睡眠",
  "night_sweating": "16. 夜間盜汗/潮熱驚醒",
  "teeth_grinding": "17. 睡覺慣性磨牙 (顳顎關節緊繃)",
  "sleep_talking": "18. 睡中頻繁獨白 (說夢話)",
  "unrefreshing_sleep": "19. 越睡越累 (醒來感覺沒睡飽)",
  "body_pain_sleep": "20. 身體慢性酸痛引發的中斷醒來",
  "jet_lag": "21. 跨時區時差困擾",
  "shift_work": "22. 輪班工作生理時鐘紊亂",
  "delayed_sleep_phase": "23. 睡眠相位後移 (夜貓子型難早睡)",
  "irregular_schedule": "24. 假日報復性補眠規律破壞",
  "overwork_exhaustion": "25. 長期加班過度疲勞反而睡不著",
  "sedentary_no_fatigue": "26. 久坐缺乏身體活動 (累腦不累身)",
  "irregular_nap": "27. 午睡時間過長破壞夜間睡眠驅力",
  "alcohol_dependence": "28. 依賴酒精入睡 (中段易醒品質差)",
  "nicotine_excitement": "29. 睡前吸菸/尼古丁刺激血管",
  "seasonal_affective": "30. 日照不足/季節性睡眠節律失調",
  "menopause_insomnia": "31. 更年期荷爾蒙失調失眠",
  "pms_insomnia": "32. 經前症候群(PMS)情緒波動失眠",
  "postpartum_care": "33. 產後育兒餵奶多段式睡眠適應",
  "elderly_shallow_sleep": "34. 銀髮族睡眠驅力下降與早醒",
  "student_exam_stress": "35. 考生備考期大腦高度焦慮失眠",
  "travel_first_night": "36. 認床/旅行第一夜效應",
  "obesity_sleep_disturb": "37. 肥胖引發呼吸沉重與睡姿不適",
  "digestive_reflux": "38. 胃食道逆流引發夜間嗆醒",
  "restless_legs": "39. 睡前雙腿不寧/蟻行感抽動",
  "cold_nasal_congestion": "40. 感冒鼻塞流鼻水導致呼吸不順",
  "daytime_somnolence": "41. 日間過度嗜睡/開車易打瞌睡",
  "brain_fog": "42. 睡眠不足引發日間大腦霧氣感",
  "memory_decline": "43. 長期淺眠導致記憶力集中力下降",
  "tension_neck_morning": "44. 醒來總是頸肩僵硬緊繃",
  "morning_headache": "45. 晨起頭痛/大腦缺氧感",
  "dry_mouth_morning": "46. 晨起口乾舌燥 (慣性用口呼吸)",
  "dark_circles_edema": "47. 長期熬夜面部氣色暗沈與水腫",
  "sleep_anxiety_loop": "48. 害怕睡不著的「預期性焦慮」",
  "weekend_migraine": "49. 假日補眠過頭引發血管放鬆性頭痛",
  "circadian_low_energy": "50. 下午固定時段生理時鐘能量崩潰"
};

Object.keys(sleepRestPartsRecord).forEach((key) => {
  const displayName = sleepRestPartsRecord[key];
  sleepDatabase[key] = {
    name: displayName,
    pt: {
      roleName: "物理治療師觀點", colorClass: "bg-indigo-600",
      reason: `針對${displayName}，解剖力學與生理機制顯示其常伴隨肌肉神經的高張力、呼吸模式異常或睡眠環境不符合人體工學。`,
      education: "建議調整睡眠枕頭高度與床墊支撐力，維持脊椎在最放鬆的自然中立位。睡前進行漸進式肌肉放鬆術(PMR)，降低身體微覺醒次數。",
      targetPoint: "頸胸椎兩側豎脊肌群及核心呼吸肌群",
      action: "【肌肉神經釋壓】平躺於床上，有意識地將雙肩向上聳起維持5秒，隨後呼氣瞬間放鬆，連續執行5次，隨後配合深長慢呼吸以激活副交感神經。"
    },
    tcm: {
      roleName: "中醫師觀點", colorClass: "bg-teal-700",
      reason: `此睡眠表徵對應中醫「不寐」範疇。多因臟腑功能偏盛偏衰（如肝血不足、心腎不交、脾胃不和），導致營衛失調，神不入舍。`,
      education: "飲食上可配合百合、蓮子、大棗等食療進行日常調養。夜晚應避免耗傷陰血之行為，並針對下肢進行溫通保健以滋陰潛陽。",
      targetPoint: "足少陰腎經、足太陰脾經、任督二脈",
      action: "【經絡本草調理】建議睡前在背部或特定腧穴使用溫熱敷或漢方精油按摩，調和五臟氣血，使陰陽協調而能安穩入眠。"
    },
    meridian: {
      roleName: "經絡老師觀點", colorClass: "bg-amber-600",
      reason: `這反映了體內經絡能量生物時鐘（子午流注）失調，特定經絡（如少陽膽經、厥陰肝經、少陰心經）在夜間循行時產生了阻塞結節。`,
      education: "睡前應順著經絡走向，由上往下輕推揉腹部與四肢末端，疏通全身淤滯的能量，讓浮越的經氣歸元。",
      targetPoint: "神門穴、內關穴、太衝穴、湧泉穴等調神核心穴位",
      action: "【經絡點按調理】以圓頭按摩工具或指腹，在雙手「內關穴」（腕橫紋上兩寸）與足大趾處的「太衝穴」進行圈狀揉壓（每次3分鐘），平衡心肝兩經之能量氣血。"
    }
  };
});
