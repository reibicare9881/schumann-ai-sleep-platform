export type RoleData = {
  roleName: string;
  colorClass: string;
  reason: string;
  education: string;
  targetPoint: string;
  action: string;
};

export type IssueData = {
  name: string;
  pt: RoleData;
  tcm: RoleData;
  meridian: RoleData;
};

export type DatabaseType = Record<string, IssueData>;

export const painDatabase: DatabaseType = {
  tension_headache: {
    name: "01. 緊張性頭痛",
    pt: {
      roleName: "物理治療師觀點", colorClass: "bg-indigo-600",
      reason: "長期不良姿勢導致枕下肌群、顳肌及上斜方肌持續性高張力緊繃，壓迫局部血管。",
      education: "避免維持低頭滑手機姿勢超過30分鐘，工作時定時進行收下巴運動以伸展後頸肌群。",
      targetPoint: "枕骨下緣肌群緊繃點（風池穴投影處肌肉）",
      action: "【軟組織放鬆】用雙手大拇指抵住後腦勺髮際線下方的肌肉深處，進行輕柔地向上推壓與揉動，每次3分鐘。"
    },
    tcm: {
      roleName: "中醫師觀點", colorClass: "bg-teal-700",
      reason: "多為風寒襲表、或因情志不遂導致肝鬱化火，循經上擾清竅，致使頭部氣血阻滯。",
      education: "忌食辛辣與寒涼食物，注意頭部避風寒，洗頭後必須立即將頭皮完全吹乾。",
      targetPoint: "足少陽膽經、督脈",
      action: "【清頭目藥貼】建議選用內含川芎、白芷之溫通本草貼布，敷貼於後頸大椎穴周邊，疏風散寒。"
    },
    meridian: {
      roleName: "經絡老師觀點", colorClass: "bg-amber-600",
      reason: "主要為督脈與膽經經氣受阻。上焦壓力過大，導致諸陽之會的頭部經絡發生節結。",
      education: "每日清晨或睡前，使用木梳或經絡刷由前額髮際線往後梳理至後腦勺，進行全頭經絡疏通。",
      targetPoint: "百會穴（頭頂正中）、太陽穴、風池穴",
      action: "【點穴釋壓】點按百會穴與雙側風池穴，雙手由頭側向後方推揉，引導氣血下行，釋放頭部壓力。"
    }
  },
  migraine: {
    name: "02. 偏頭痛",
    pt: {
      roleName: "物理治療師觀點", colorClass: "bg-indigo-600",
      reason: "顱內血管舒縮功能失調，常伴隨頸椎深層穩定肌群無力，引發神經血管敏感化。",
      education: "紀錄疼痛日記，避開強光、高分貝環境，發作時可在頸後進行局部冰敷降溫。",
      targetPoint: "胸鎖乳突肌、顳肌肌肉筋膜點",
      action: "【肌肉牽拉】將頭部轉向對側並微微後仰，輕柔拉伸胸鎖乳突肌，避免強力揉捏太陽穴以免微血管更擴張。"
    },
    tcm: {
      roleName: "中醫師觀點", colorClass: "bg-teal-700",
      reason: "多屬「少陽頭痛」，與肝陽上亢、氣滯血瘀或痰濕中阻有關，導致一側經絡暴痛。",
      education: "保持睡眠充足，少吃乾酪、巧克力等易誘發食物，保持心情舒暢避免肝火動炎。",
      targetPoint: "足少陽膽經、足厥陰肝經",
      action: "【經絡調和】在發作間歇期，於下肢遠端的太衝穴、足臨泣進行溫和循經按揉，引火下行。"
    },
    meridian: {
      roleName: "經絡老師觀點", colorClass: "bg-amber-600",
      reason: "膽經能量過度亢進或阻塞，導致頭部單側點脈搏動感強烈、經氣逆亂。",
      education: "可用雙手手掌輕蓋住雙耳，指尖朝後，輕彈後腦（鳴天鼓），每天30次以調和內部經氣。",
      targetPoint: "率谷穴（耳尖直上1.5寸）、率谷周邊膽經線",
      action: "【點擊疏按】以食指與中指指腹，輕輕揉按率谷穴，並順著耳廓後方向下推抹至肩部，疏通少陽經氣。"
    }
  },
  occipital_neuralgia: {
    name: "03. 後腦枕骨神經痛",
    pt: {
      roleName: "物理治療師觀點", colorClass: "bg-indigo-600",
      reason: "枕大神經、枕小神經在穿出枕下肌群筋膜時受到夾擠，多因長期頭前傾不良姿勢引起。",
      education: "電腦螢幕高度應與視線平齊，嚴禁躺在沙發扶手上看電視。",
      targetPoint: "第一、二頸椎後方之枕下肌群出神經孔處",
      action: "【神經滑動與放鬆】輕輕將下巴內收，手指平壓在後腦下緣，做微小的點頭動作，誘導神經滑動。"
    },
    tcm: {
      roleName: "中醫師觀點", colorClass: "bg-teal-700",
      reason: "屬於「太陽頭痛」，風寒之邪直中足太陽膀胱經，導致項背強痛、拘急不舒。",
      education: "外出時配戴圍巾，保護頸後「風府」、「風池」，切忌汗出當風。",
      targetPoint: "足太陽膀胱經、督脈",
      action: "【溫補督脈】建議使用熱敷袋或溫灸儀針對大椎穴、天柱穴進行熱促進，散寒通絡。"
    },
    meridian: {
      roleName: "經絡老師觀點", colorClass: "bg-amber-600",
      reason: "膀胱經與督脈在頸項交會處經氣淤滯，寒凝血瘀導致刺痛感。",
      education: "經常摩擦雙手掌心至發熱，隨後緊貼於後頸部上下揉搓，使後頸部產生溫熱感。",
      targetPoint: "天柱穴、玉枕穴",
      action: "【推點經筋】用拇指與食指扣住後頸兩側的大筋（膀胱經循行線），由上往下進行規律的捏緹與揉按。"
    }
  },
  tmj_disorder: {
    name: "04. 顳顎關節痛 (大小臉/咬合痛)",
    pt: {
      roleName: "物理治療師觀點", colorClass: "bg-indigo-600",
      reason: "咀嚼肌群（咬肌、顳肌、翼外肌）過度緊繃或左右肌力失衡，導致髕骨軟骨盤動作軌跡異常。",
      education: "避免單側咀嚼，少吃堅硬或需要過度咀嚼的食物（如魷魚絲、嚼口香糖）。",
      targetPoint: "咬肌與顳肌肌腹（下顎關節前方及太陽穴上方肌肉）",
      action: "【關節伸展與深層放鬆】微張口腔，用手指在面頰兩側咬肌處進行垂直於纖維方向的深度按壓與向下拉伸。"
    },
    tcm: {
      roleName: "中醫師觀點", colorClass: "bg-teal-700",
      reason: "多因胃經積熱，或因氣血不足、外感風邪留滯於少陽、陽明之經，導致關節開闔不利。",
      education: "保持排便通暢以清胃熱，發作期飲食以流質、軟食為主，減少關節負擔。",
      targetPoint: "足陽明胃經、手少陽三焦經",
      action: "【循經局部施治】選用清熱消腫貼布局部外敷，或配合遠端內庭穴、合谷穴按壓以清陽明之熱。"
    },
    meridian: {
      roleName: "經絡老師觀點", colorClass: "bg-amber-600",
      reason: "面部經絡網絡（尤其是胃經與小腸經）在耳前關節處交會受阻，經氣運行不暢。",
      education: "每日雙手輕擦面部（如乾洗臉動作），由下往上、由內往外，促進面部經絡微循環。",
      targetPoint: "下關穴、聽宮穴、頰車穴",
      action: "【點穴開竅】正坐張口，用食指尖點按耳屏前方的聽宮穴與下顎角前方的頰車穴，雙向揉動30次。"
    }
  },
  cervical_stiffness: {
    name: "05. 頸部僵硬 (落枕)",
    pt: {
      roleName: "物理治療師觀點", colorClass: "bg-indigo-600",
      reason: "睡眠時姿勢不良或頸部受涼，導致提肩胛肌或胸鎖乳突肌發生急性保護性痙攣。",
      education: "檢視枕頭高度（側臥時頸椎應呈水平線）。急性期24小時內不可過度強迫轉頭。",
      targetPoint: "提肩胛肌附著點（肩胛骨內上角緊繃處）",
      action: "【阻力放鬆法】頭向痛側轉動至微痛點，手給予對抗阻力，頭部向反方向出力5秒後放鬆，重複3次。"
    },
    tcm: {
      roleName: "中醫師觀點", colorClass: "bg-teal-700",
      reason: "體質氣血虛弱，睡眠時局部感受風寒濕邪，使頸部經絡氣血凝滯，「經筋」強直。",
      education: "落枕期間切忌大力旋轉扭動脖子以防二次傷害。可配戴軟頸圈或圍巾保暖。",
      targetPoint: "手太陽小腸經、督脈",
      action: "【遠端辨證取穴】利用針灸或重手法按壓手部奇穴「落枕穴」與小腸經「後溪穴」，同時令患者緩慢活動頸部。"
    },
    meridian: {
      roleName: "經絡老師觀點", colorClass: "bg-amber-600",
      reason: "督脈與小腸經經氣突發性嚴重淤阻，氣血無法上注於頸項，經筋失去濡養。",
      education: "平時多用雙手握拳，以拳背敲擊兩側肩井穴，保持頸肩經絡之活絡。",
      targetPoint: "外勞宮（落枕穴，手背食中指掌骨間點）、後溪穴",
      action: "【循經點按】用大拇指強力按壓手背上的落枕穴，一邊按壓一邊配合脖子輕微的點頭與左右緩慢轉動。"
    }
  },
  cervical_radiculopathy: {
    name: "06. 頸椎壓迫麻痛 (頸椎病)",
    pt: {
      roleName: "物理治療師觀點", colorClass: "bg-indigo-600",
      reason: "頸椎椎間盤突出或骨刺增生，壓迫到神經根，引發順著臂神經叢向下放射至手部的麻痛感。",
      education: "嚴禁做頸部大範圍環轉（甩頭）動作。若出現單側上肢突發無力、突發性步態不穩請速就醫。",
      targetPoint: "頸椎兩側椎間孔神經根出處",
      action: "【頸椎間歇牽引導引】正坐，雙手十指交叉抱住後腦勺，輕柔向上提拉，使頸椎間隙拉開，每次維持10秒。"
    },
    tcm: {
      roleName: "中醫師觀點", colorClass: "bg-teal-700",
      reason: "多因肝腎虧虛、氣血不足，外加長期勞損，导致督脈空虛，經絡血瘀寒凝，骨質增生。",
      education: "可多食用具有補益肝腎之食物。日常注意避寒，可局部外敷活血通絡之中藥膏盲。",
      targetPoint: "督脈、手足三陽經",
      action: "【溫經通絡】在中醫師指導下進行頸椎微調復位，或針對夾脊穴進行針灸，補益氣血、化瘀通絡。"
    },
    meridian: {
      roleName: "經絡老師觀點", colorClass: "bg-amber-600",
      reason: "手三陽經（大腸、小腸、三焦經）與督脈在頸椎處交會處嚴重經氣不通，能量出現結構性斷層。",
      education: "每日進行「燕飛」或「八段錦·五勞七傷往後瞧」之動作，舒緩並拉伸整條脊椎經絡。",
      targetPoint: "大椎穴、肩外俞穴、大杼穴",
      action: "【經絡點按與梳理】用指腹溫和揉按大椎穴，並由後頸向兩側肩膀方向進行雙手分推，引流淤滯的能量。"
    }
  },
  eyestrain_headache: {
    name: "07. 眼壓高伴隨頭痛",
    pt: {
      roleName: "物理治療師觀點", colorClass: "bg-indigo-600",
      reason: "長時間注視螢幕，眼外肌（睫狀肌等）過度疲勞，連帶誘發前額肌與顳肌反射性緊張痛。",
      education: "遵循「20-20-20」原則：每看螢幕20分鐘，雙眼直視20英尺（約6公尺）外物體20秒。",
      targetPoint: "眼眶周邊肌群、前額肌筋膜",
      action: "【眼部周邊熱敷與輕撫】使用溫熱毛巾敷於雙眼及前額5-10分鐘，隨後用指腹由印堂向外輕柔撫摩。"
    },
    tcm: {
      roleName: "中醫師觀點", colorClass: "bg-teal-700",
      reason: "肝開竅於目，長期熬夜或用眼過度導致肝血虧虛、目失所養，或肝經風熱上擾。",
      education: "平時可以枸杞、菊花、決明子泡茶飲用。晚上11點前務必入睡以養肝血。",
      targetPoint: "足厥陰肝經、足太陽膀胱經",
      action: "【明目外敷】可選用含有冰片、薄荷、黃連之明目眼貼外敷於閉合的雙眼上，達到清熱明目之效。"
    },
    meridian: {
      roleName: "經絡老師觀點", colorClass: "bg-amber-600",
      reason: "承接頭面部與眼周的所有經絡（如膀胱經、胃經、膽經）起點能量淤阻，清陽之氣無法上升。",
      education: "每日早晚各做一次古法眼球保健操：雙眼順時針、逆時針各轉動10圈，隨後用力閉眼再張開。",
      targetPoint: "睛明穴、攢竹穴、絲竹空穴、瞳子髎",
      action: "【點穴開導】用雙手食指、中指指腹，由眼頭（睛明）順著眉毛（攢竹、魚腰、絲竹空）輕柔點壓至眼尾。"
    }
  },
  tennis_elbow: {
    name: "24. 網球肘 (手肘外側痛)",
    pt: {
      roleName: "物理治療師觀點", colorClass: "bg-indigo-600",
      reason: "前臂伸肌群（尤其是伸腕短橈肌）長期反覆過度負荷，導致肱骨外上髁附著處出現微小撕裂與退化性發炎。",
      education: "急性期停止重複性抓握與手腕後伸動作。慢性期可配戴網球肘專用加壓帶於痛點下方兩指寬處。",
      targetPoint: "前臂伸肌群肌腹（手肘外側骨頭突起處往下約兩指寬處）",
      action: "【橫向纖維按摩法】雙手微屈，用另一手大拇指在緊繃的肌腹處，進行與肌肉走向垂直的橫向深層按壓放鬆。"
    },
    tcm: {
      roleName: "中醫師觀點", colorClass: "bg-teal-700",
      reason: "屬於中醫「傷筋」範疇。長期肘部勞作導致肘關節氣血運行不暢，經絡阻滯，復感風寒濕邪而致痛。",
      education: "注意手肘關節防寒保暖。日常可多利用溫水泡手或局部溫通熱敷，忌食冰冷寒涼食物。",
      targetPoint: "手陽明大腸經循行線路",
      action: "【通絡外敷】選用活血化瘀、溫經通絡之中藥膏盲貼敷於肘關節外側周邊，以通則不痛為原則調理。"
    },
    meridian: {
      roleName: "經絡老師觀點", colorClass: "bg-amber-600",
      reason: "手陽明大腸經與手少陽三焦經之經氣在肘關節處淤滯、結節，導致經絡能量無法順暢流注至末梢。",
      education: "每日早晚可用空掌交替拍打雙肘關節外側，每次50下，使局部微發熱，以促進氣血循環。",
      targetPoint: "曲池穴、手三里穴",
      action: "【點穴與經絡拍打】定位「曲池穴」與「手三里穴」，用大拇指指腹以螺旋揉按方式按壓，產生酸脹感為佳。"
    }
  }
};

const painRestPartsRecord: Record<string, string> = {
  "golfers_elbow": "25. 高爾夫球肘 (手肘內側痛)",
  "olecranon_bursitis": "26. 鷹嘴突滑囊炎 (肘尖腫痛)",
  "carpal_tunnel": "27. 腕隧道症候群 (滑鼠手)",
  "de_quervain_tenosynovitis": "28. 媽媽手 (大拇指側腕痛)",
  "trigger_finger": "29. 彈響指 (扳機指)",
  "wrist_sprain": "30. 手腕韌帶扭傷",
  "tfcc_injury": "31. 三角纖維軟骨複合體損傷",
  "finger_oa": "32. 手指退化性關節炎",
  "shoulder_impingement": "08. 肩膀夾擠症候群",
  "frozen_shoulder": "09. 五十肩 (肩關節粘連)",
  "rotator_cuff_tendinitis": "10. 旋轉肌袖發炎",
  "levator_scapulae_pain": "11. 肩胛提肌酸痛 (膏盲痛)",
  "rhomboid_strain": "12. 菱形肌拉傷 (上背痛)",
  "thoracic_outlet": "13. 胸廓出口症候群 (手麻)",
  "intercostal_neuralgia": "14. 肋間神經痛",
  "thoracic_stiffness": "15. 胸椎僵硬緊繃",
  "pectoralis_major_tightness": "16. 胸大肌緊繃 (含胸駝背)",
  "acute_lumbago": "17. 急性腰扭傷 (閃到腰)",
  "lumbar_disc_herniation": "18. 腰椎間盤突出",
  "sciatica": "19. 坐骨神經痛",
  "piriformis_syndrome": "20. 梨狀肌症候群 (臀部深處痛)",
  "si_joint_dysfunction": "21. 薦髂關節失能 (骨盆歪斜痛)",
  "psoas_muscle_tightness": "22. 腰大肌緊繃 (挺不直腰)",
  "coccydynia": "23. 尾骨疼痛",
  "hip_oa": "33. 髖關節退化性關節炎",
  "trochanteric_bursitis": "34. 大轉子滑囊炎 (大腿外側側臥痛)",
  "it_band_syndrome": "35. 髂脛束症候群 (跑步膝)",
  "patellofemoral_pain": "36. 髕骨股骨 pain (前膝痛)",
  "knee_oa": "37. 膝關節退化性磨損",
  "patellar_tendinitis": "38. 髕骨腱炎 (跳躍膝)",
  "meniscus_tear": "39. 半月板損傷 (卡頓鎖死)",
  "bakers_cyst": "40. 貝克氏滑囊炎 (膝窩腫脹)",
  "shin_splints": "41. 夾脛症 (內脛骨痛)",
  "calf_strain": "42. 小腿腓腸肌拉傷",
  "achilles_tendinitis": "43. 阿基里斯腱炎",
  "ankle_inversion_sprain": "44. 翻腳刀 (外踝韌帶扭傷)",
  "high_ankle_sprain": "45. 高位踝關節扭傷",
  "plantar_fasciitis": "46. 足底筋膜炎 (下床第一步痛)",
  "tarsal_tunnel": "47. 跗隧道症候群 (足底麻痛)",
  "achilles_bursitis": "48. 跟骨滑囊炎 (腳跟後側痛)",
  "bunion_pain": "49. 拇趾外翻紅腫痛",
  "fibromyalgia": "50. 全身性纖維肌痛症"
};

Object.keys(painRestPartsRecord).forEach((key) => {
  const displayName = painRestPartsRecord[key];
  painDatabase[key] = {
    name: displayName,
    pt: {
      roleName: "物理治療師觀點", colorClass: "bg-indigo-600",
      reason: `對應於${displayName}的運動解剖學因素。多因區域關節力學失衡、周邊肌肉過度勞損、或結締組織慢性微小創傷所引起。`,
      education: "急性期應遵循PRICE/PEACE原則進行動態休息，避免執行引發明顯刺痛的動作，慢性期應逐步進行循序漸進的阻力與穩定度功能重建。",
      targetPoint: "患部周邊功能受限之軟組織與肌腹位置",
      action: "【物理徒手促進】針對該部位周邊的緊繃肌腹，引導執行低強度的等長收縮訓練（維持5-10秒），配合周邊筋膜輕柔分推放鬆。"
    },
    tcm: {
      roleName: "中醫師觀點", colorClass: "bg-teal-700",
      reason: `此症狀在經典中歸屬「痺症」或「傷筋」。主因臟腑氣血失調，局部經脈防禦力下降，導致風、寒、濕、熱之邪乘虛侵襲，留滯關節。`,
      education: "調養期間應特別注意飲食清淡，嚴禁生冷、冰鎮與大寒之物，以免寒邪凝滯血脈。重視睡眠與局部患處的溫熱保暖。",
      targetPoint: "患側經絡循行線路與阿是穴（痛點）",
      action: "【溫通辨證導引】可運用溫熱敷袋或漢方本草精油貼布外敷於局部，促進局部的經絡氣血微循環，達到活血化瘀之效益。"
    },
    meridian: {
      roleName: "經絡老師觀點", colorClass: "bg-amber-600",
      reason: `對應${displayName}，主要為該區域所通過的十二正經、奇經八脈或經筋網絡發生能量淤阻，經氣無法順暢灌注。`,
      education: "平時應多做大範圍的關節鬆通操（如八段錦或易筋經），配合雙手摩擦發熱後，對患側進行大面積的溫熱輕撫。",
      targetPoint: "該區域主理經絡之母穴、原穴或交會穴",
      action: "【經絡點按調理】以大拇指或圓頭按摩棒，尋找該部位對應經絡的遠端關鍵穴位，進行規律的圈狀揉壓（每次3-5分鐘），直至產生酸脹感。"
    }
  };
});
