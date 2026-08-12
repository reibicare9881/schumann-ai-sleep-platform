import React,{useState,useEffect,useCallback}from"react";
const ce=React.createElement;

// ── TOKENS ──────────────────────────────────────────────────────────────────
const T={bg:"#fdf9f4",card:"#fffffe",border:"#e8ddd0",
  teal:"#2d7d6e",tealBg:"#f0faf5",tealLight:"#a7e3cf",
  amber:"#c07820",amberBg:"#fff8ec",
  sage:"#3a7d44",sageBg:"#f2faf3",
  coral:"#c45c3a",coralBg:"#fff5f2",
  plum:"#7048c8",plumBg:"#f5f2fd",
  navy:"#2c4a72",navyBg:"#eef3fb",
  warm:"#8b5e3c",warmBg:"#fdf5ee",
  text:"#2d2520",muted:"#7a6e65",faint:"#b0a49c",
  red:"#c02020",redBg:"#fef3f3",
  sh:"0 2px 12px rgba(45,37,32,.08)"};
const LX={
  green:{c:"#15803d",bg:"#f0fdf4",br:"#86efac",lbl:"綠燈",em:"🟢"},
  yellow:{c:"#a16207",bg:"#fefce8",br:"#fde047",lbl:"黃燈",em:"🟡"},
  orange:{c:"#c2410c",bg:"#fff7ed",br:"#fdba74",lbl:"橙燈",em:"🟠"},
  red:{c:"#b91c1c",bg:"#fef2f2",br:"#fca5a5",lbl:"紅燈",em:"🔴"}};

// ── RBAC (8層) ───────────────────────────────────────────────────────────────
const ROLES={
  individual:{label:"個人用戶",icon:"👤",
    perms:["assess","history","checkin","points","appt","th","eap_personal","plan888","date_dl_personal","mental","diary"]},
  member:{label:"單位成員",icon:"🏢",
    perms:["assess","history","checkin","points","appt","th","eap_personal","plan888","submit_org","view_bulletin","date_dl_personal"]},
  dept_head:{label:"部門主管",icon:"📋",
    perms:["assess","history","checkin","points","appt","th","eap_personal","plan888","submit_org","view_bulletin","dept_okr","dl_dept","date_report","date_dl_dept"]},
  admin_hr:{label:"HR管理者",icon:"👥",
    perms:["kpi","okr_view","esg","highrisk","appt_view","date_report","dl","eap_mgmt","service","plan888","gri","date_dl_org"]},
  admin_finance:{label:"財務管理者",icon:"💰",
    perms:["kpi","okr_view","esg","roi","date_report","dl","date_dl_org","remit"]},
  admin_it:{label:"IT管理者",icon:"🔐",
    perms:["audit","security","date_report"]},
  admin:{label:"單位平台管理者",icon:"🔑",
    perms:["kpi","okr_view","okr_mgmt","esg","highrisk","appt_view","appt_mgmt","date_report","dl","dl_dept",
      "eap_mgmt","service","plan888","gri","audit","security","roi","dept_mgmt","acc_mgmt","params_edit",
      "annual_stats","date_dl_org","setup_wizard","remit"]},
  admin_reibi:{label:"REIBI超管",icon:"🛡",
    perms:["kpi","okr_view","esg","highrisk","appt_view","service","plan888","gri","audit","security","acc_mgmt","l5_crossorg"]},
  // v10.3.21新增：臨場醫護人員，僅能填寫/查看過負荷面談記錄，不含任何KPI/ESG/財務/個人逐筆評估權限
  // ⚠ 此角色非企業管理者，禁止加入isAdmRole判斷，僅供職業醫師/護理師/健康管理師使用
  occupational_health:{label:"臨場醫護人員",icon:"🩺",
    perms:["ow_interview"]},
};
const canDo=(role,p)=>!!(ROLES[role]&&ROLES[role].perms.includes(p));
const isAdmRole=(r)=>["admin","admin_hr","admin_finance","admin_it","admin_reibi"].includes(r);
const isMainAdmin=(r)=>r==="admin";

// ── ASSESSMENT DATA ──────────────────────────────────────────────────────────
const SQ=[
  {id:"s1",text:"過去一週，上床後需超過30分鐘才能入睡的頻率？",opts:["完全沒有","每週1-2次","每週3-4次","每週5-6次","每晚都有"]},
  {id:"s2",text:"夜間醒來難以再次入睡，或比預期早醒的頻率？",opts:["完全沒有","每週1-2次","每週3-4次","每週5-6次","每晚都有"]},
  {id:"s3",text:"您對目前整體睡眠品質感到滿意嗎？",opts:["非常滿意","滿意","普通","不滿意","非常不滿意"]},
  {id:"s4",text:"睡眠問題干擾日間工作、社交或學習的程度？",opts:["完全沒有","輕微","中等","明顯","嚴重"]},
  {id:"s5",text:"睡眠問題被別人注意到或自己在意的程度？",opts:["完全不在意","輕微","中等","明顯","非常嚴重"]},
  {id:"s6",text:"因睡眠問題感到擔心、苦惱或情緒低落的嚴重度？",opts:["完全沒有","輕微","中等","明顯","非常嚴重"]},
  {id:"s7",text:"整體而言，睡眠問題影響您生活品質的程度？",opts:["完全沒有","輕微","中等","明顯","嚴重"]},
];
const PQ=[
  {id:"p1",text:"過去一週平均疼痛程度？(0=無，10=最劇烈)"},
  {id:"p2",text:"過去一週最嚴重時的疼痛程度？"},
  {id:"p3",text:"疼痛干擾睡眠的程度？"},
  {id:"p4",text:"疼痛干擾日常活動的程度？"},
  {id:"p5",text:"疼痛讓您感到苦惱或低落的程度？"},
];
const WQ=[
  {id:"w1",text:"睡眠或疼痛問題影響工作專注力的程度？(0=無，10=嚴重)"},
  {id:"w2",text:"睡眠或疼痛問題降低工作效率的程度？"},
  {id:"w3",text:"過去一個月因睡眠或疼痛問題請假或早退的頻率？"},
];
const PLOCS=["頭部/頭痛","頸部/頸椎","肩膀","上背部","下背部/腰","手臂/手肘","手腕/手部","臀部/髖關節","大腿/膝蓋","小腿/踝部","足部","胸部","腹部","其他"];
const CICATS=[
  {cat:"綜合健康",items:["飲水8杯","戶外活動15分","作息規律","減少3C使用"]},
  {cat:"疼痛衛教",items:["每時起身3分","伸展運動","熱冷敷","維持正確姿勢"]},
  {cat:"睡眠衛教",items:["睡前停螢幕1小時","午後不攝取咖啡因","進行放鬆練習","定時就寢"]},
  {cat:"飲食衛教",items:["蔬果5份","少精製糖","三餐定時","七八分飽"]},
  {cat:"物理運動",items:["有氧運動30分","頸肩伸展","核心訓練","腰背保護動作"]},
  {cat:"REIBI體驗",items:["舒曼波體驗打卡","LA200體驗打卡"]},
];
const getSL=(t)=>{
  if(t<=7)return{key:"green",label:"睡眠品質良好",desc:"無臨床意義的失眠。",action:"維持規律作息，落實睡眠衛生習慣。"};
  if(t<=14)return{key:"yellow",label:"輕度失眠",desc:"輕度失眠，建議注意睡眠衛生。",action:"固定作息、減少咖啡因，進行睡眠衛生教育。"};
  if(t<=21)return{key:"orange",label:"中度失眠",desc:"中度失眠，已影響日常功能。",action:"建議至睡眠醫學科或精神科門診評估。"};
  return{key:"red",label:"重度失眠",desc:"重度失眠，強烈建議睡眠專科就診。",action:"積極就醫，可能需藥物治療或CBT-I。"};
};
const getPL=(t)=>{
  if(t<=12)return{key:"green",label:"疼痛輕微",desc:"疼痛輕微，對生活影響甚小。",action:"自我管理：熱敷、適度活動、伸展。"};
  if(t<=25)return{key:"yellow",label:"中度疼痛",desc:"中度疼痛，對睡眠或日常有影響。",action:"記錄疼痛日記，諮詢疼痛科或復健科。"};
  if(t<=38)return{key:"orange",label:"重度疼痛",desc:"重度疼痛，明顯干擾睡眠及生活。",action:"疼痛專科評估，藥物治療合併物理治療。"};
  return{key:"red",label:"極重度疼痛",desc:"極重度疼痛，需立即就醫評估。",action:"立即就醫，排除急性病變。"};
};

// ── STORAGE & DB ─────────────────────────────────────────────────────────────
const stor={
  g:async(k)=>{try{const r=await Promise.race([window.storage.get(k),new Promise(res=>setTimeout(()=>res(null),2000))]);return r&&r.value?JSON.parse(r.value):null;}catch{return null;}},
  s:async(k,v)=>{try{await Promise.race([window.storage.set(k,JSON.stringify(v)),new Promise(res=>setTimeout(res,2000))]);}catch{}},
  d:async(k)=>{try{await window.storage.delete(k);}catch{}},
};

// ── BATCH G：版本化搬移匯出 ─────────────────────────────────────────────────
function useArtifactExportButton(config){
  useEffect(function(){
    const button=document.createElement("button");button.textContent="匯出搬移資料";
    Object.assign(button.style,{position:"fixed",right:"18px",bottom:"18px",zIndex:"99999",border:"0",borderRadius:"999px",padding:"11px 17px",background:"#0f766e",color:"white",fontWeight:"800",boxShadow:"0 6px 22px rgba(15,23,42,.25)",cursor:"pointer"});
    button.onclick=async()=>{button.disabled=true;button.textContent="整理資料中…";try{await exportArtifactData(config);}catch(error){alert("匯出失敗："+(error&&error.message?error.message:String(error)));}finally{button.disabled=false;button.textContent="匯出搬移資料";}};
    document.body.appendChild(button);return()=>button.remove();
  },[]);
}
function stableExportJson(value){if(Array.isArray(value))return "["+value.map(stableExportJson).join(",")+"]";if(value&&typeof value==="object")return "{"+Object.keys(value).sort().map(key=>JSON.stringify(key)+":"+stableExportJson(value[key])).join(",")+"}";return JSON.stringify(value);}
async function exportSha256(text){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));return Array.from(new Uint8Array(digest)).map(byte=>byte.toString(16).padStart(2,"0")).join("");}
function exportKeyAllowed(key,config){const lower=String(key).toLowerCase();if(["sess","pin_","rc_","lk_","rem_","token","l5_session","rq_session","l5_active_context","l5_pin_","__rq_handoff_"].some(prefix=>lower===prefix||lower.startsWith(prefix)))return false;return config.exact.includes(key)||config.prefixes.some(prefix=>key.startsWith(prefix));}
function sanitizeExportValue(value){if(Array.isArray(value))return value.map(sanitizeExportValue);if(!value||typeof value!=="object")return value;const clean={};Object.keys(value).forEach(key=>{const compact=String(key).replace(/_/g,"").toLowerCase();if(["password","secret","token","pin","backupcode","activationcode","imgfull","imgthumb","imagebase64"].some(fragment=>compact.includes(fragment)))return;clean[key]=sanitizeExportValue(value[key]);});return clean;}
async function exportArtifactData(config){
  const keys=new Set(config.exact),cache=new Map(),orgs=new Set(),users=new Set();
  const read=async key=>{if(cache.has(key))return cache.get(key);const result=await window.storage.get(key).catch(()=>null);if(!result||result.value==null){cache.set(key,null);return null;}let value=result.value;try{value=JSON.parse(value);}catch(error){}cache.set(key,value);return value;};
  if(window.storage&&typeof window.storage.list==="function"){try{const listed=await window.storage.list(),items=Array.isArray(listed)?listed:(listed&&listed.keys)||[];items.forEach(item=>{const key=typeof item==="string"?item:item&&item.key;if(key&&exportKeyAllowed(key,config))keys.add(key);});}catch(error){}}
  const collect=(value,depth=0)=>{if(depth>6||value==null)return;if(Array.isArray(value)){value.slice(0,5000).forEach(item=>collect(item,depth+1));return;}if(typeof value!=="object")return;Object.entries(value).forEach(([key,child])=>{const name=key.toLowerCase();if(typeof child==="string"){if(["orgcode","org_code","entcode"].includes(name))orgs.add(child);if(["uid","userid","user_id","artifact_user_key","membercode"].includes(name))users.add(child);}collect(child,depth+1);});};
  for(const key of config.exact){const value=await read(key);collect(value);if(key==="reibi_orgs"&&Array.isArray(value))value.forEach(item=>{if(typeof item==="string")orgs.add(item);});}
  collect(await read("sess"));
  for(const spec of config.indexes){const values=await read(spec.key);if(Array.isArray(values))values.forEach(value=>{const code=typeof value==="string"?value:value&&value.orgCode;if(code)keys.add(spec.prefix+String(code).replace(/\W/g,"_"));});}
  [...orgs].slice(0,2000).forEach(code=>{const clean=String(code).replace(/\W/g,"_");config.orgPrefixes.forEach(prefix=>keys.add(prefix+clean));["ow","msk","bsrs5"].forEach(type=>keys.add("osh_cnt_"+type+"_"+clean));});
  [...users].slice(0,5000).forEach(uid=>{const clean=String(uid);config.userPrefixes.forEach(prefix=>keys.add(prefix+clean));});
  const entries=[];for(const key of keys){if(!exportKeyAllowed(key,config))continue;const value=await read(key);if(value!=null)entries.push({storage_key:key,value:sanitizeExportValue(value)});}
  if(!entries.length)throw new Error("找不到可搬移資料");
  const chunks=[];let current=[],bytes=0;const limit=7.5*1024*1024;entries.forEach(entry=>{const size=new TextEncoder().encode(stableExportJson(entry)).length;if(current.length&&(bytes+size>limit||current.length>=5000)){chunks.push(current);current=[];bytes=0;}current.push(entry);bytes+=size;});if(current.length)chunks.push(current);
  const stamp=new Date().toISOString();for(let index=0;index<chunks.length;index++){const envelope={schema_version:"reibi-artifact-export/1.0",source_artifact:config.source,source_version:config.version,exported_at:stamp,part:index+1,parts:chunks.length,entries:chunks[index]};envelope.export_sha256=await exportSha256(stableExportJson(envelope));const blob=new Blob([JSON.stringify(envelope,null,2)],{type:"application/json;charset=utf-8"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download="reibi-"+config.source+"-"+stamp.slice(0,10)+"-part"+(index+1)+"of"+chunks.length+".json";link.click();URL.revokeObjectURL(url);}
  alert("匯出完成："+entries.length+" 個 storage keys，共 "+chunks.length+" 個檔案。請妥善保管 JSON 與匯出前筆數截圖。");
}
const DB={
  sess:()=>stor.g("sess"),saveSess:(v)=>stor.s("sess",v),clearSess:()=>stor.d("sess"),
  rpts:()=>stor.g("rpts"),
  saveRpt:async(r)=>{let a=await DB.rpts()||[];a.unshift(r);if(a.length>50)a=a.slice(0,50);await stor.s("rpts",a);},
  pts:(uid)=>stor.g("pts_"+uid),
  addPts:async(uid,n)=>{let p=await DB.pts(uid)||0;p+=n;await stor.s("pts_"+uid,p);return p;},
  ci:(uid)=>stor.g("ci_"+uid),saveCi:(uid,v)=>stor.s("ci_"+uid,v),
  appts:(c)=>stor.g("appt_"+c),saveAppts:(c,v)=>stor.s("appt_"+c,v),
  orgRecs:(c)=>stor.g("org_"+c),
  saveOrgRec:async(code,rec)=>{
    let a=await DB.orgRecs(code)||[];
    a.unshift({sScore:rec.sScore,sKey:rec.sL&&rec.sL.key,pScore:rec.pScore,pKey:rec.pL&&rec.pL.key,wScore:rec.wScore,dept:(rec.profile&&rec.profile.dept)||"",ts:rec.ts});
    if(a.length>500)a=a.slice(0,500);await stor.s("org_"+code,a);},
  svcReqs:(c)=>stor.g("svc_"+c),saveSvcReq:async(c,r)=>{let a=await DB.svcReqs(c)||[];a.unshift(r);await stor.s("svc_"+c,a);},
  th:(uid)=>stor.g("th_"+uid),saveTh:(uid,v)=>stor.s("th_"+uid,v),
  // 職安法問卷填答活躍度計數器(僅計份數，不含職場不法侵害，不追蹤個人身份)
  oshCnt:(type,code)=>stor.g("osh_cnt_"+type+"_"+code.replace(/\W/g,"_")),
  bumpOshCnt:async(type,code)=>{
    const key="osh_cnt_"+type+"_"+code.replace(/\W/g,"_");
    const cur=await stor.g(key);
    const n=(cur?parseInt(cur,10):0)+1;
    await stor.s(key,String(n));
    return n;
  },
  // PIN management
  getPin:(c)=>stor.g("pin_"+c.replace(/\W/g,"_")),setPin:(c,h)=>stor.s("pin_"+c.replace(/\W/g,"_"),h),clearPin:(c)=>stor.d("pin_"+c.replace(/\W/g,"_")),
  getRC:(c)=>stor.g("rc_"+c.replace(/\W/g,"_")),setRC:(c,h)=>stor.s("rc_"+c.replace(/\W/g,"_"),h),
  getPRs:()=>stor.g("prs"),savePR:async(r)=>{let a=await DB.getPRs()||[];a.unshift(r);if(a.length>100)a=a.slice(0,100);await stor.s("prs",a);},
  updatePR:async(id,st)=>{let a=await DB.getPRs()||[];a=a.map(r=>r.id===id?{...r,status:st,resolvedTs:new Date().toISOString()}:r);await stor.s("prs",a);},
  getLk:(c)=>stor.g("lk_"+c.replace(/\W/g,"_")),setLk:(c,v)=>stor.s("lk_"+c.replace(/\W/g,"_"),v),
  // Org setup (wizard) — stores group codes set by admin
  getOrgSetup:(c)=>stor.g("setup_"+c.replace(/\W/g,"_")),
  saveOrgSetup:(c,v)=>stor.s("setup_"+c.replace(/\W/g,"_"),v),
  // 部門架構清單(v10.3.30新增，依orgCode各自獨立persist，取代DeptMgmtScreen原本每次重載都重置的寫死demo資料)
  getDeptStruct:(c)=>stor.g("dept_struct_"+c.replace(/\W/g,"_")),
  saveDeptStruct:(c,v)=>stor.s("dept_struct_"+c.replace(/\W/g,"_"),v),
  // Org params (ROI calculator params editable by admin)
  getParams:(c)=>stor.g("params_"+c.replace(/\W/g,"_")),
  saveParams:(c,v)=>stor.s("params_"+c.replace(/\W/g,"_"),v),
  // Remember login (⑪ auto-fill)
  getRemembered:(c)=>stor.g("rem_"+c.replace(/\W/g,"_")),
  saveRemembered:(c,v)=>stor.s("rem_"+c.replace(/\W/g,"_"),v),
  // REIBI-registered org codes (⑯)
  getRegisteredOrgs:()=>stor.g("reibi_orgs"),
  saveRegisteredOrgs:(v)=>stor.s("reibi_orgs",v),
  // Remittance claims (匯款對帳申請，供L5財務審核沖帳)
  getRemitClaims:(c)=>stor.g("remit_"+c.replace(/\W/g,"_")),
  saveRemitClaim:async(c,claim)=>{let a=await DB.getRemitClaims(c)||[];a.unshift(claim);if(a.length>100)a=a.slice(0,100);await stor.s("remit_"+c.replace(/\W/g,"_"),a);},
  // v10.3.22新增：個人訂閱(方向B階段1)，以memberCode為主鍵(個人用戶無持久uid，需獨立會員碼跨登入找回)
  getSubs:()=>stor.g("subs"),
  saveSubs:(v)=>stor.s("subs",v),
  upsertSub:async(rec)=>{
    let a=await DB.getSubs()||[];
    const idx=a.findIndex(function(s){return s.memberCode===rec.memberCode;});
    if(idx>=0){a[idx]=rec;}else{a.unshift(rec);if(a.length>500)a=a.slice(0,500);}
    await stor.s("subs",a);
    return rec;
  },
  findSub:async(code)=>{
    let a=await DB.getSubs()||[];
    return a.find(function(s){return s.memberCode===code;})||null;
  },
};
const AL={_l:[],rec(a,d,r){this._l.unshift({ts:new Date().toISOString(),action:a,detail:d||"",role:r||"",id:Math.random().toString(36).slice(2,7)});if(this._l.length>100)this._l.pop();},all(){return[...this._l];}};

// ── 版本管理系統 ─────────────────────────────────────────────────────────────
const CURRENT_VERSION={
  version:"v10.3.34",
  releaseDate:"2026-07-30",
  description:"DeptMgmtScreen「新增部門」快速選取清單改為依上層部門動態調整：建L2時顯示通用部門名稱，建L3時顯示對應組/課建議，建L4時顯示通用班/小組建議，加速企業用戶建置部門架構",
  changes:[
    "新增L3_SUGGESTIONS對照表，依PRESET_DEPTS既有30個L2部門名稱各自提供2-4個常見組/課建議(例如「人力資源部」→薪酬福利組/招募甄選組/教育訓練組/員工關係組)；自訂命名的L2部門(不在對照表裡)退回L3_GENERIC通用建議(規劃組/執行組/管理組/支援組)",
    "新增L4_GENERIC通用班/小組建議(第一組/第二組/第三組/早班/中班/晚班/A組/B組)，因班/小組命名慣例分歧大，不特別對應每個L3部門，統一提供通用選項",
    "「展開建議清單」按鈕文字與內容依目前選擇的「上層部門」層級即時切換：未選或選L1上層→顯示通用L2部門名稱(30項)；選L2上層→顯示該部門對應的L3組/課建議；選L3上層→顯示通用L4班/小組建議",
    "操作說明頁「新增部門」項目文字同步更新，說明建議清單會動態調整；空清單提示文字用詞同步微調",
  ],
};


const DB_VERSIONS_KEY="reibi_versions";
const DB_SNAPSHOTS_KEY="reibi_snapshots";

const VersionDB={
  getHistory:()=>stor.g(DB_VERSIONS_KEY),
  saveVersion:async(v)=>{
    let hist=await VersionDB.getHistory()||[];
    // 避免重複
    if(!hist.find(function(h){return h.version===v.version;})){
      hist.unshift({...v,savedAt:new Date().toISOString()});
      if(hist.length>20)hist=hist.slice(0,20); // 保留最多20版
      await stor.s(DB_VERSIONS_KEY,hist);
    }
  },
  getSnapshots:()=>stor.g(DB_SNAPSHOTS_KEY),
  saveSnapshot:async(label,data)=>{
    let snaps=await VersionDB.getSnapshots()||[];
    snaps.unshift({label,savedAt:new Date().toISOString(),id:"snap_"+Date.now().toString(36),data});
    if(snaps.length>5)snaps=snaps.slice(0,5); // 保留最近5份快照
    await stor.s(DB_SNAPSHOTS_KEY,snaps);
    return snaps[0].id;
  },
  restoreSnapshot:async(id)=>{
    const snaps=await VersionDB.getSnapshots()||[];
    return snaps.find(function(s){return s.id===id;})||null;
  },
  deleteSnapshot:async(id)=>{
    let snaps=await VersionDB.getSnapshots()||[];
    snaps=snaps.filter(function(s){return s.id!==id;});
    await stor.s(DB_SNAPSHOTS_KEY,snaps);
  },
};



// ── AUTH HELPERS ─────────────────────────────────────────────────────────────
const hashPin=async(p)=>{const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode("REIBI:"+p));return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,"0")).join("").slice(0,32);};
const genRC=()=>{const c="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";return Array.from({length:8},()=>c[Math.floor(Math.random()*c.length)]).join("");};
const PIN_MAX=5,PIN_MS=30*60*1000;
const checkLk=async(code)=>{const d=await DB.getLk(code);if(!d)return{locked:false,remaining:PIN_MAX};if(d.at&&Date.now()-d.at<PIN_MS)return{locked:true,mins:Math.ceil((PIN_MS-(Date.now()-d.at))/60000)};return{locked:false,remaining:PIN_MAX-(d.fails||0)};};
const failPin=async(code)=>{const d=await DB.getLk(code)||{fails:0};const f=(d.fails||0)+1;await DB.setLk(code,f>=PIN_MAX?{fails:f,at:Date.now()}:{fails:f});AL.rec("PIN_FAIL","f="+f,code);return{locked:f>=PIN_MAX,remaining:PIN_MAX-f};};
const clearLk=async(code)=>DB.setLk(code,{fails:0});
const callAI=async(prompt,tok=2500)=>{try{const ctrl=new AbortController();setTimeout(()=>ctrl.abort(),65000);const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",signal:ctrl.signal,headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:tok,messages:[{role:"user",content:prompt}]})});const d=await r.json();const b=d.content&&d.content.find(x=>x.type==="text");return b?b.text:"";}catch{return"";}};

// ── 個人訂閱(v10.3.22新增，方向B階段1) ─────────────────────────────────────────
const SUB_PLANS=[
  {k:"monthly",label:"月繳體驗",months:1},
  {k:"quarterly",label:"季繳方案",months:3},
  {k:"annual",label:"年繳方案(最優惠)",months:12},
];
const addMonths=(dateStr,months)=>{const d=new Date(dateStr);d.setMonth(d.getMonth()+months);return d.toISOString();};
// 到期採「延遲判定」：不主動背景改寫storage，讀取時一律用此函數判斷實際狀態(符合「自動降級但保留歷史資料」決策)
const effectiveSubStatus=(sub)=>{
  if(!sub)return null;
  if(sub.status==="active"&&sub.expiresAt&&new Date(sub.expiresAt)<new Date())return"expired";
  return sub.status;
};
const daysUntil=(dateStr)=>{if(!dateStr)return null;return Math.ceil((new Date(dateStr)-new Date())/(24*60*60*1000));};

// ── 啟用碼機制(v10.3.23新增) ──────────────────────────────────────────────
// 個人訂閱審核/發票/入帳改於reibi-l5.jsx處理(獨立artifact，storage與主平台隔離)。
// 核准後由reibi-l5.jsx產生9碼啟用碼，人工經LINE/Email轉交，使用者於主平台自行輸入完成啟用，
// 全程不需REIBI員工登入主平台。⚠ reibi-l5.jsx端須實作「完全相同」的編碼演算法，兩邊獨立維護，
// 任何一邊調整演算法都必須同步另一邊，否則產生的碼會驗證失敗。
const ACT_EPOCH=new Date("2026-01-01T00:00:00Z").getTime();
const ACT_PLAN_CHAR={monthly:"M",quarterly:"Q",annual:"A"};
const ACT_CHAR_PLAN={M:"monthly",Q:"quarterly",A:"annual"};
const encodeExpDays=(expiresAtISO)=>{
  const days=Math.round((new Date(expiresAtISO).getTime()-ACT_EPOCH)/86400000);
  return days.toString(36).toUpperCase().padStart(4,"0");
};
const decodeExpDays=(enc)=>{
  const days=parseInt(enc,36);
  if(isNaN(days))return null;
  return new Date(ACT_EPOCH+days*86400000).toISOString();
};
// 驗證碼綁定memberCode：同一段啟用碼貼到別的會員帳號下會驗證失敗(非密碼學安全，僅防呆/防誤用)
const activationChecksum=async(memberCode,planChar,expEnc)=>{
  const h=await hashPin("ACT:"+memberCode+"|"+planChar+"|"+expEnc);
  return h.slice(0,4).toUpperCase();
};
const makeActivationCode=async(memberCode,planKey,expiresAtISO)=>{
  const planChar=ACT_PLAN_CHAR[planKey]||"M";
  const expEnc=encodeExpDays(expiresAtISO);
  const checksum=await activationChecksum(memberCode,planChar,expEnc);
  return planChar+expEnc+checksum;
};
const verifyActivationCode=async(code,memberCode)=>{
  const c=(code||"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"");
  if(c.length!==9)return null;
  const planChar=c[0],expEnc=c.slice(1,5),checksum=c.slice(5,9);
  if(!ACT_CHAR_PLAN[planChar])return null;
  const expected=await activationChecksum(memberCode,planChar,expEnc);
  if(expected!==checksum)return null;
  const expiresAt=decodeExpDays(expEnc);
  if(!expiresAt)return null;
  return{plan:ACT_CHAR_PLAN[planChar],expiresAt};
};

// ── DEFAULT ROI PARAMS ───────────────────────────────────────────────────────
const DEFAULT_PARAMS={sickDays:8,avgDailySalary:3200,insuranceSaving:12000,productivityGain:15,implementCost:600000,currency:"NT$"};

// ── UI PRIMITIVES ─────────────────────────────────────────────────────────────
function Btn({onClick,children,v="primary",sz="md",disabled,full,style:sx}){
  const sizes={sm:{padding:"5px 12px",fontSize:12},md:{padding:"9px 18px",fontSize:13},lg:{padding:"12px 22px",fontSize:14}};
  const vars={primary:{background:T.teal,color:"#fff"},sage:{background:T.sageBg,color:T.sage,border:"1px solid #86efac"},amber:{background:T.amberBg,color:T.amber,border:"1px solid #fcd34d"},ghost:{background:"transparent",color:T.muted,border:"1px solid "+T.border},danger:{background:T.redBg,color:T.red,border:"1px solid #fca5a5"},plum:{background:T.plumBg,color:T.plum,border:"1px solid #c4b5fd"},navy:{background:T.navyBg,color:T.navy,border:"1px solid #93c5fd"}};
  return ce("button",{onClick:disabled?undefined:onClick,style:{border:"none",borderRadius:8,cursor:disabled?"not-allowed":"pointer",fontWeight:600,fontFamily:"inherit",opacity:disabled?.5:1,transition:"all .12s",...(full?{width:"100%",display:"block"}:{}),...(sizes[sz]||sizes.md),...(vars[v]||vars.primary),...sx}},children);}
function Card({children,style:sx,onClick}){return ce("div",{onClick,style:{background:T.card,border:"1px solid "+T.border,borderRadius:12,padding:18,boxShadow:T.sh,...(onClick?{cursor:"pointer"}:{}),...sx}},children);}
function Tag({c="teal",children}){const m={teal:{bg:T.tealBg,color:T.teal},sage:{bg:T.sageBg,color:T.sage},amber:{bg:T.amberBg,color:T.amber},plum:{bg:T.plumBg,color:T.plum},red:{bg:T.redBg,color:T.red},gray:{bg:"#f5f5f4",color:T.muted},navy:{bg:T.navyBg,color:T.navy}};const s=m[c]||m.teal;return ce("span",{style:{display:"inline-block",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700,background:s.bg,color:s.color}},children);}
function LBadge({k}){const lx=LX[k]||LX.green;return ce("span",{style:{display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:12,fontWeight:700,background:lx.bg,color:lx.c,border:"1px solid "+lx.br}},lx.em+" "+lx.lbl);}
function IBox({c="teal",children,style:sx}){const cols={teal:{background:T.tealBg,border:"1px solid "+T.tealLight,color:T.teal},amber:{background:T.amberBg,border:"1px solid #fcd34d",color:T.amber},red:{background:T.redBg,border:"1px solid #fca5a5",color:T.red},sage:{background:T.sageBg,border:"1px solid #86efac",color:T.sage},navy:{background:T.navyBg,border:"1px solid #93c5fd",color:T.navy}};return ce("div",{style:{borderRadius:8,padding:"10px 12px",fontSize:12,lineHeight:1.7,...(cols[c]||cols.teal),...sx}},children);}
function Divider(){return ce("div",{style:{height:1,background:T.border,margin:"14px 0"}});}
function SecTitle({children}){return ce("h3",{style:{fontSize:14,fontWeight:700,color:T.teal,marginBottom:12,marginTop:0,borderBottom:"2px solid "+T.tealLight,paddingBottom:6}},children);}
function Toast({msg,onDone}){useEffect(()=>{if(msg){const t=setTimeout(onDone,2800);return()=>clearTimeout(t);}},[msg]);if(!msg)return null;return ce("div",{style:{background:T.text,color:"#fff",padding:"10px 22px",borderRadius:24,fontSize:13,fontWeight:600,textAlign:"center",margin:"8px auto 4px",maxWidth:420}},msg);}
function Inp({label,type="text",value,onChange,placeholder,style:sx}){return ce("div",{style:{...sx}},label&&ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4}},label),ce("input",{type,value,onChange,placeholder,style:{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box"}}));}

// ── TOP BANNER (⑬) ───────────────────────────────────────────────────────────
function TopBanner(){
  return ce("div",{style:{background:"linear-gradient(135deg,"+T.teal+",#065f46)",color:"#fff",padding:"10px 20px",textAlign:"center"}},
    ce("div",{style:{fontSize:13,fontWeight:700,letterSpacing:1,marginBottom:2}},"🌿 REIBI 健康自主管理平台"),
    ce("div",{style:{fontSize:11,opacity:.85,lineHeight:1.6}},"注意自己的健康 · 自己的健康自己照顧 · 健康促進從每週評估開始"),
    ce("div",{style:{fontSize:10,opacity:.65,marginTop:2}},"WHO Ottawa Charter · IDG内在發展目標 · SDG 3/8/10/17 · ESG社會責任 · 888計畫"));}

// ── NAV BAR ──────────────────────────────────────────────────────────────────
function NavBar({session,onNav,pts}){
  const ri=ROLES[session&&session.role]||{};
  const c=session&&(session.role==="individual"?"teal":isMainAdmin(session.role)?"plum":isAdmRole(session.role)?"amber":"sage")||"teal";
  return ce("div",{style:{background:T.card,borderBottom:"1px solid "+T.border,padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:"0 1px 4px rgba(0,0,0,.05)"}},
    ce("div",{style:{display:"flex",alignItems:"center",gap:10,cursor:"pointer"},onClick:()=>onNav("home")},
      ce("span",{style:{fontSize:22}},"🌿"),
      ce("div",null,ce("div",{style:{fontWeight:800,fontSize:14,color:T.teal}},"REIBI BIO-Technology"),ce("div",{style:{fontSize:10,color:T.muted}},"健康自主管理"))),
    ce("div",{style:{display:"flex",alignItems:"center",gap:8}},
      pts>0&&ce("span",{style:{fontSize:12,color:T.amber,fontWeight:700}},"⭐"+pts),
      ce(Tag,{c},ri.icon+" "+ri.label),
      ce(Btn,{sz:"sm",v:"ghost",onClick:()=>onNav("logout")},"登出")));}

// ── SCREEN WRAPPER ────────────────────────────────────────────────────────────
function Screen({title,onBack,children,maxW=640,action}){
  return ce("div",{style:{minHeight:"80vh",background:T.bg,paddingBottom:40}},
    ce("div",{style:{maxWidth:maxW,margin:"0 auto",padding:"20px 16px"}},
      (onBack||action)&&ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}},
        onBack?ce("button",{onClick:onBack,style:{background:"none",border:"none",cursor:"pointer",color:T.teal,fontSize:13,fontWeight:700,display:"flex",alignItems:"center",gap:5}},"← 返回"):ce("div"),
        action&&action),
      !onBack&&!action&&title&&ce("div",{style:{marginBottom:16}}),
      title&&ce("h2",{style:{fontSize:20,fontWeight:700,color:T.text,marginTop:0,marginBottom:18}},title),
      children,
      ce("div",{style:{marginTop:32,paddingTop:12,borderTop:"1px solid "+T.border,textAlign:"center"}},
        ce("div",{style:{fontSize:11,color:T.faint,lineHeight:1.8}},"© 2024-2026 麗媚生化科技有限公司 REIBI BIO-Technology Co., Ltd."),
        ce("div",{style:{fontSize:10,color:T.faint}},"平台軟體著作權所有，翻版必究 · 本平台為輔助性健康自主管理工具，不構成醫療診斷"),
        ce("div",{style:{fontSize:10,color:T.faint,marginTop:2}},"服務：LINE @reibicare · reibiservice@gmail.com · 週一至週五 09:00-18:00"))));}

// ── FIRST-TIME SETUP WIZARD (②③ 方案B) ───────────────────────────────────────

function SetupWizard({orgCode,orgName,onComplete}){
  const[step,setStep]=useState(0);
  const[memberPwd,setMemberPwd]=useState("");
  const[headPwd,setHeadPwd]=useState("");
  const[adminPin,setAdminPin]=useState("");
  const[adminPin2,setAdminPin2]=useState("");
  const[rc,setRc]=useState("");
  const[err,setErr]=useState("");
  const[copied,setCopied]=useState(false);

  const doSetup=async()=>{
    if(!memberPwd||memberPwd.length<4){setErr("單位成員密碼至少4位");return;}
    if(!headPwd||headPwd.length<4){setErr("部門主管密碼至少4位");return;}
    if(!adminPin||adminPin.length<4){setErr("管理者PIN至少4位");return;}
    if(adminPin!==adminPin2){setErr("管理者PIN兩次不一致");return;}
    const code=genRC();
    const ph=await hashPin(adminPin);
    const rh=await hashPin(code);
    // Store hashed admin PIN and recovery code
    await DB.setPin(orgCode,ph);
    await DB.setRC(orgCode,rh);
    await clearLk(orgCode);
    // Store group codes (hashed) — note: member/head codes stored as hash
    const mh=await hashPin(memberPwd);
    const hh=await hashPin(headPwd);
    await DB.saveOrgSetup(orgCode,{memberHash:mh,headHash:hh,setupTs:new Date().toISOString(),orgName});
    AL.rec("SETUP_COMPLETE","wizard done",orgCode);
    setRc(code);setStep(1);
  };

  if(step===1){
    return ce("div",{style:{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:20}},
      ce("div",{style:{width:"100%",maxWidth:500}},
        ce(Card,null,
          ce("div",{style:{textAlign:"center",marginBottom:20}},
            ce("div",{style:{fontSize:40,marginBottom:8}},"🔐"),
            ce("h3",{style:{fontSize:18,fontWeight:700,color:T.text,margin:0}},"請儲存管理者備用碼"),
            ce("p",{style:{fontSize:12,color:T.red,marginTop:6,fontWeight:600}},"⚠ 此備用碼僅顯示一次，忘記PIN時使用。請截圖或抄寫保存。")),
          ce("div",{style:{background:"#1c1917",borderRadius:12,padding:"20px",textAlign:"center",marginBottom:16}},
            ce("div",{style:{fontSize:11,color:"#a8a29e",marginBottom:8,letterSpacing:2}},"管理者備用碼(8碼)"),
            ce("div",{style:{fontSize:28,fontWeight:800,letterSpacing:6,color:"#fcd34d",fontFamily:"monospace"}},rc),
            ce("div",{style:{fontSize:11,color:"#78716c",marginTop:8}},"單位代碼："+orgCode+" · "+orgName)),
          ce(IBox,{c:"amber",style:{marginBottom:16}},
            ce("p",{style:{margin:"0 0 6px",fontWeight:700}},"設定摘要(去識別化，請另行紙本記錄密碼)"),
            ce("p",{style:{margin:0}},"✅ 單位成員密碼：已設定("+memberPwd.length+"位)"),
            ce("p",{style:{margin:0}},"✅ 部門主管密碼：已設定("+headPwd.length+"位)"),
            ce("p",{style:{margin:0}},"✅ 管理者PIN：已設定("+adminPin.length+"位)")),
          ce(IBox,{c:"teal",style:{marginBottom:16}},
            "📌 請將成員密碼、主管密碼分別告知各人員(建議紙本傳達，勿透過通訊軟體明文傳送)。",
            ce("br"),
            "成員收到密碼後即可登入使用各自權限內的功能。"),
          ce("div",{style:{display:"flex",gap:8}},
            ce(Btn,{v:"ghost",full:true,onClick:()=>{navigator.clipboard&&navigator.clipboard.writeText("REIBI備用碼 "+orgCode+": "+rc);setCopied(true);}},copied?"✅ 已複製":"複製備用碼"),
            ce(Btn,{full:true,onClick:onComplete},"完成設定，進入管理後台")))));
  }

  return ce("div",{style:{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:20}},
    ce("div",{style:{width:"100%",maxWidth:520}},
      ce("div",{style:{textAlign:"center",marginBottom:24}},
        ce("div",{style:{fontSize:40,marginBottom:8}},"🏢"),
        ce("h2",{style:{fontSize:20,fontWeight:700,color:T.text,margin:0}},"首次設定精靈"),
        ce("p",{style:{fontSize:13,color:T.muted,marginTop:6}},"單位："+orgName+" ("+orgCode+")"),
        ce("p",{style:{fontSize:12,color:T.amber,marginTop:4}},"⚙ 此步驟由單位平台管理者執行，設定完成後才開放成員登入")),
      ce(Card,null,
        ce(IBox,{c:"navy",style:{marginBottom:20}},
          "🔒 個資保護說明：以下設定的密碼均以SHA-256雜湊儲存，系統不儲存明文密碼。建議以紙本方式通知各人員，避免數位傳送造成洩漏。"),
        ce("div",{style:{display:"grid",gap:16}},
          ce("div",null,
            ce(SecTitle,null,"① 單位成員群組密碼(L2)"),
            ce(IBox,{c:"teal",style:{marginBottom:10}},"所有單位成員使用同一組密碼登入，建議定期更換。密碼為去識別化登入憑據，不與個人身份綁定。"),
            ce(Inp,{label:"單位成員密碼(至少4位)",type:"password",value:memberPwd,onChange:e=>setMemberPwd(e.target.value),placeholder:"設定成員群組密碼"})),
          ce("div",null,
            ce(SecTitle,null,"② 部門主管群組密碼(L3)"),
            ce(IBox,{c:"amber",style:{marginBottom:10}},"所有部門主管使用同一組密碼登入，可查閱本部門去識別化OKR報告。"),
            ce(Inp,{label:"部門主管密碼(至少4位)",type:"password",value:headPwd,onChange:e=>setHeadPwd(e.target.value),placeholder:"設定主管群組密碼"})),
          ce("div",null,
            ce(SecTitle,null,"③ 單位平台管理者 PIN(L4主)"),
            ce(IBox,{c:"red",style:{marginBottom:10}},"管理者PIN為個人專屬，錯誤5次鎖定30分鐘，並記錄於稽核日誌。設定後系統生成8碼備用碼請妥善保存。"),
            ce(Inp,{label:"管理者PIN(至少4位)",type:"password",value:adminPin,onChange:e=>setAdminPin(e.target.value),placeholder:"設定管理者個人PIN"}),
            ce("div",{style:{marginTop:8}},
              ce(Inp,{label:"確認管理者PIN",type:"password",value:adminPin2,onChange:e=>setAdminPin2(e.target.value),placeholder:"再次輸入PIN"}))),
          err&&ce(IBox,{c:"red"},err),
          ce(Btn,{onClick:doSetup,full:true,sz:"lg"},"完成設定並生成備用碼")))));
}


function LoginScreen({onLogin,onForgotPin}){
  const[mode,setMode]=useState(null);
  const[name,setName]=useState("");
  const[oc,setOc]=useState("");
  const[role,setRole]=useState("member");
  const[pwd,setPwd]=useState("");
  const[loading,setLoading]=useState(false);
  const[err,setErr]=useState("");
  const[lk,setLk]=useState(null);
  const[showSetup,setShowSetup]=useState(false);
  const[pendingAdmin,setPendingAdmin]=useState(null);
  const[ocErr,setOcErr]=useState("");
  // v10.3.31新增：登入時部門選擇(必填)，適用單位成員/部門主管/HR管理者/財務管理者/IT管理者
  const DEPT_REQUIRED_ROLES=["member","dept_head","admin_hr","admin_finance","admin_it"];
  const[deptList,setDeptList]=useState([]);
  const[deptSel,setDeptSel]=useState("");
  const needsDept=mode==="org"&&DEPT_REQUIRED_ROLES.indexOf(role)>=0;

  // ⑪ Auto-fill remembered name
  useEffect(()=>{
    if(oc.trim().length>=3){
      DB.getRemembered(oc.trim().toUpperCase()).then(rem=>{
        if(rem&&rem.name&&!name)setName(rem.name);
      });
    }
  },[oc]);

  // v10.3.31新增：依單位代碼載入「部門管理」persist後的正式部門清單，供登入時選擇
  useEffect(()=>{
    if(needsDept&&oc.trim().length>=3){
      DB.getDeptStruct(oc.trim().toUpperCase()).then(function(d){setDeptList(d||[]);});
    }else{
      setDeptList([]);
    }
  },[oc,needsDept]);
  useEffect(()=>{setDeptSel("");},[oc,role]);

  // Lockout check for admin roles
  useEffect(()=>{
    if(oc.trim().length>=3&&isAdmRole(role)){
      checkLk(oc.trim().toUpperCase()).then(info=>setLk(info.locked?info:null));
    }else if(oc.trim().length>=3&&role==="occupational_health"){
      checkLk(oc.trim().toUpperCase()+"_OH").then(info=>setLk(info.locked?info:null));
    }else setLk(null);
  },[oc,role]);

  const doLogin=async()=>{
    setErr("");setOcErr("");setLoading(true);
    await new Promise(r=>setTimeout(r,400));
    if(mode===null){setErr("請先選擇使用方式：個人使用 或 單位/組織");setLoading(false);return;}
    if(mode==="individual"){
      if(!name.trim()){setErr("請輸入名稱(可使用代稱，僅用於本機顯示)");setLoading(false);return;}
      const uid="I_"+Math.random().toString(36).slice(2,8).toUpperCase();
      AL.rec("LOGIN","individual",name.trim());
      onLogin({uid,name:name.trim(),role:"individual",loginTs:new Date().toISOString()});
      setLoading(false);return;
    }
    if(!oc.trim()){setErr("請填入單位代碼");setLoading(false);return;}
    if(!name.trim()){setErr("請填入名稱(可使用代稱，用於稽核記錄)");setLoading(false);return;}
    const code=oc.trim().toUpperCase();

    // ⑯ Verify org code is REIBI-registered
    // L5 special login
    if(code==="REIBI_L5"&&role==="admin_reibi"){
      const ph=await DB.getPin("REIBI_L5");
      if(!ph){
        const s={uid:"L5_"+name.trim().slice(0,4),name:name.trim(),role:"admin_reibi",orgCode:"REIBI_L5",orgName:"麗媚生化科技",loginTs:new Date().toISOString()};
        setPendingAdmin(s);setShowSetup(true);setLoading(false);return;
      }
      const ih=await hashPin(pwd);
      if(ih!==ph){const res=await failPin("REIBI_L5");setErr("L5 PIN錯誤，還有"+res.remaining+"次機會。如忘記PIN，登入後至 L5後台→我的PIN→緊急重設。");setLoading(false);return;}
      await clearLk("REIBI_L5");
      const sess={uid:"L5_"+name.trim().slice(0,4),name:name.trim(),role:"admin_reibi",orgCode:"REIBI_L5",orgName:"麗媚生化科技",loginTs:new Date().toISOString()};
      await DB.saveRemembered("REIBI_L5",{name:name.trim(),role:"admin_reibi"});
      AL.rec("L5_LOGIN","",name.trim());onLogin(sess);setLoading(false);return;
    }
    const registeredOrgs=await DB.getRegisteredOrgs()||["REIBI2025","DEMO001","TEST001"];
    if(code!=="REIBI_L5"&&!registeredOrgs.includes(code)){
      setOcErr("此單位代碼尚未在REIBI平台註冊。請聯絡麗媚確認：reibiservice@gmail.com");
      setLoading(false);return;
    }

    // Check if org has been set up
    const setup=await DB.getOrgSetup(code);

    if(isMainAdmin(role)){
      if(!pwd.trim()){setErr("請填入管理者PIN");setLoading(false);return;}
      const lkInfo=await checkLk(code);
      if(lkInfo.locked){setErr("PIN已鎖定，請等待"+lkInfo.mins+"分鐘後再試，或使用備用碼重設。");setLoading(false);return;}
      const storedPin=await DB.getPin(code);
      if(!storedPin){
        // First time — trigger setup wizard
        const s={uid:code+"_admin_"+name.trim().slice(0,4),name:name.trim(),role:"admin",orgCode:code,orgName:setup&&setup.orgName||code,loginTs:new Date().toISOString()};
        setPendingAdmin(s);setShowSetup(true);setLoading(false);return;
      }
      const ih=await hashPin(pwd);
      if(ih!==storedPin){
        const res=await failPin(code);
        AL.rec("PIN_WRONG","r="+res.remaining,name.trim());
        setErr(res.locked?"PIN錯誤次數過多，帳號已鎖定30分鐘。請使用備用碼重設或聯絡麗媚客服。":"PIN錯誤，還有"+res.remaining+"次機會。"+(res.remaining<=2?"再錯誤將鎖定帳號！":""));
        setLoading(false);return;
      }
      await clearLk(code);
    } else if(role==="occupational_health"){
      // v10.3.21新增：臨場醫護人員獨立邀請碼(與admin PIN完全分離，職責分離)
      if(!setup){setErr("此單位尚未完成首次設定，請聯絡單位平台管理者先完成設定。");setLoading(false);return;}
      if(!pwd.trim()){setErr("請填入臨場醫護人員邀請碼");setLoading(false);return;}
      const ohLkInfo=await checkLk(code+"_OH");
      if(ohLkInfo.locked){setErr("邀請碼已鎖定，請等待"+ohLkInfo.mins+"分鐘後再試，或聯絡單位平台管理者重新設定。");setLoading(false);return;}
      const ohPin=await DB.getPin(code+"_OH");
      if(!ohPin){setErr("此單位尚未開通臨場醫護人員登入，請聯絡單位平台管理者於「臨場醫護人員設定」頁面設定邀請碼。");setLoading(false);return;}
      const ihOH=await hashPin(pwd);
      if(ihOH!==ohPin){
        const resOH=await failPin(code+"_OH");
        setErr(resOH.locked?"邀請碼錯誤次數過多，已鎖定30分鐘。請聯絡單位平台管理者重設。":"邀請碼錯誤，還有"+resOH.remaining+"次機會。");
        setLoading(false);return;
      }
      await clearLk(code+"_OH");
    } else {
      // Non-admin roles: check group code and require org to be set up
      if(!setup){setErr("此單位尚未完成首次設定，請聯絡單位平台管理者先完成設定。");setLoading(false);return;}
      if(!pwd.trim()){setErr("請填入群組密碼");setLoading(false);return;}
      const ih=await hashPin(pwd);
      if(role==="member"&&ih!==setup.memberHash){setErr("單位成員密碼錯誤，請向單位平台管理者確認。");setLoading(false);return;}
      if(role==="dept_head"&&ih!==setup.headHash){setErr("部門主管密碼錯誤，請向單位平台管理者確認。");setLoading(false);return;}
      // L4a/b/c require pin verification — simplified: use admin PIN for now
      if(["admin_hr","admin_finance","admin_it"].includes(role)){
        const storedPin=await DB.getPin(code);
        if(!storedPin){setErr("此單位尚未完成管理者設定，請聯絡單位平台管理者。");setLoading(false);return;}
        const ih2=await hashPin(pwd);
        if(ih2!==storedPin){setErr("管理者PIN錯誤");setLoading(false);return;}
      }
    }

    // v10.3.31新增：部門必填驗證(member/dept_head/admin_hr/admin_finance/admin_it)
    if(needsDept){
      if(deptList.length===0){setErr("此單位尚未建立部門資料，請聯繫單位平台管理者於「部門管理」建立部門後再登入。");setLoading(false);return;}
      if(!deptSel){setErr("請選擇您的部門。");setLoading(false);return;}
    }

    const uid=code+"_"+role+"_"+name.trim().slice(0,4)+"_"+Math.random().toString(36).slice(2,5);
    const sess={uid,name:name.trim(),role,orgCode:code,orgName:(setup&&setup.orgName)||code,loginTs:new Date().toISOString()};
    if(needsDept)sess.dept=deptSel;
    // ⑪ Remember name for next login
    await DB.saveRemembered(code,{name:name.trim(),role});
    AL.rec("LOGIN",role,name.trim());
    onLogin(sess);setLoading(false);
  };

  if(showSetup&&pendingAdmin){
    return ce(SetupWizard,{orgCode:pendingAdmin.orgCode,orgName:pendingAdmin.orgName||pendingAdmin.orgCode,onComplete:()=>{setShowSetup(false);AL.rec("LOGIN","admin_first",pendingAdmin.name);onLogin(pendingAdmin);}});
  }

  const orgRoles=Object.entries(ROLES).filter(([k])=>k!=="individual");
  const isAdminRole=isAdmRole(role);
  const pwdLabel=isMainAdmin(role)?"管理者PIN *(首次登入後系統引導設定)":role==="dept_head"?"部門主管群組密碼 *":role==="member"?"單位成員群組密碼 *":role==="occupational_health"?"臨場醫護人員邀請碼 *(需向單位平台管理者取得)":"管理者PIN *";

  return ce("div",{style:{minHeight:"100vh",background:"linear-gradient(160deg,#f5f9f5 0%,#fdf9f2 50%,#f8f4ef 100%)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",padding:"0 0 40px"}},
    ce("div",{style:{width:"100%",background:"linear-gradient(135deg,"+T.teal+",#1a5c4e)",padding:"28px 24px 32px",textAlign:"center",marginBottom:0}},
      ce("div",{style:{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:10}},
        ce("div",{style:{fontSize:32}},"🌿"),
        ce("div",null,
          ce("div",{style:{fontSize:16,fontWeight:800,color:"#fff",letterSpacing:1}},"麗媚生化科技 REIBI · 健康自主管理平台"),
          ce("div",{style:{fontSize:11,color:"rgba(255,255,255,.75)",marginTop:2}},"REIBI BIO-Technology · Health Self-Management Platform"))),
      ce("div",{style:{background:"rgba(255,255,255,.12)",borderRadius:12,padding:"14px 16px",marginTop:12,textAlign:"left"}},
        ce("div",{style:{fontSize:15,fontWeight:700,color:"#fff",marginBottom:6}},"💚 自己的健康，自己照顧"),
        ce("div",{style:{fontSize:12,color:"rgba(255,255,255,.85)",lineHeight:1.8}},"養成關注健康的習慣，從「知道」到「做到」，落實身心健康自主管理。",ce("br"),"睡眠品質、疼痛管理與慢病防治，一次掌握，讓每位夥伴都能活得更健康。")),
      ce("div",{style:{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center",marginTop:12}},
        ["🔍 健康識能提升","💊 慢病三高管理","🌙 睡眠品質改善","💪 疼痛緩解","📊 企業健康KPI","🌱 ESG社會責任"].map(tag=>ce("div",{key:tag,style:{background:"rgba(255,255,255,.2)",color:"#fff",borderRadius:20,padding:"4px 10px",fontSize:11,fontWeight:600}},tag)))),
    ce("div",{style:{width:"100%",maxWidth:480,padding:"0 20px"}},
      ce("div",{style:{textAlign:"center",padding:"24px 0 16px"}},
        ce("h2",{style:{fontSize:20,fontWeight:800,color:T.text,margin:"0 0 4px"}},"健康自主管理評估系統"),
        ce("div",{style:{fontSize:13,color:T.muted}},"睡眠 × 疼痛聯合評估 · ISI & BPI 國際量表")),
      ce(Card,null,
        mode===null?ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:20}},
          [{k:"individual",icon:"👤",l:"個人使用",desc:"免費使用\n個人健康自主管理\n完整AI評估報告"},{k:"org",icon:"🏢",l:"單位 / 組織",desc:"企業/機構適用\n多層級角色分權\nOKR績效管理"}].map(m=>ce(Card,{key:m.k,onClick:()=>setMode(m.k),style:{textAlign:"center",cursor:"pointer",padding:"20px 14px",border:"2px solid "+T.border}},
            ce("div",{style:{fontSize:40,marginBottom:8}},m.icon),
            ce("div",{style:{fontWeight:700,fontSize:15,color:T.teal,marginBottom:4}},m.l),
            ce("div",{style:{fontSize:11,color:T.muted,lineHeight:1.7,whiteSpace:"pre-line"}},m.desc)))):
        mode==="org"&&ce("div",null,
          ce("button",{onClick:()=>setMode(null),style:{background:"none",border:"none",cursor:"pointer",color:T.teal,fontSize:12,display:"block",textAlign:"left",marginBottom:10,fontFamily:"inherit"}},"← 返回選擇")),
        mode==="individual"&&ce("button",{onClick:()=>setMode(null),style:{background:"none",border:"none",cursor:"pointer",color:T.teal,fontSize:12,display:"block",textAlign:"left",marginBottom:10,fontFamily:"inherit"}},"← 返回選擇"),
        ce("div",{style:{display:"grid",gap:12}},
          mode==="individual"&&ce("div",null,
            ce("div",{style:{background:T.sageBg,border:"1px solid "+T.tealLight,borderRadius:10,padding:"12px 14px",marginBottom:8}},
              ce("div",{style:{fontWeight:700,fontSize:13,color:T.sage,marginBottom:6}},"💚 個人免費使用 · 無需單位代碼"),
              ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,fontSize:11,marginBottom:8}},
                ["✅ 每週評估(ISI+BPI+WQ)","✅ AI六面向個人化建議","✅ 四色燈號即時顯示","✅ 22項行動打卡積分","✅ 個人PDF報告下載","✅ 三高/BMI數值管理","✅ 睡眠日記+疼痛日誌","✅ 身心健康評估(PHQ-4)","✅ 過勞風險自我檢視"].map(function(t){return ce("div",{key:t,style:{color:T.sage}},t);})),
              ce("div",{style:{borderTop:"1px solid "+T.tealLight,paddingTop:6,marginTop:2}},
                ce("div",{style:{fontSize:11,color:T.amber,fontWeight:600,marginBottom:4}},"⭐ 訂閱版另增功能："),
                ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,fontSize:11}},
                  ["🤖 AI個人報告(2,000字)","📈 無限次歷史趨勢追蹤","📊 我的改善曲線","📅 優先預約健管體驗","🔔 定期評估提醒","💬 個人健康顧問諮詢"].map(function(t){return ce("div",{key:t,style:{color:T.amber}},t);})))),
            ce(Inp,{label:"名稱(可使用代稱，不需真實姓名)*",value:name,onChange:e=>setName(e.target.value),placeholder:"輸入代稱即可"})),
          mode==="org"&&ce("div",null,
            ce(Inp,{label:"名稱(可使用代稱，用於稽核記錄)*",value:name,onChange:e=>setName(e.target.value),placeholder:"輸入名稱"})),
          mode==="org"&&ce("div",null,
            ce(Inp,{label:"單位代碼 *(由REIBI麗媚設定提供)",value:oc,onChange:e=>setOc(e.target.value),placeholder:"例：REIBI2025"}),
            ocErr&&ce("p",{style:{fontSize:11,color:T.red,margin:"4px 0 0"}},ocErr)),
          mode==="org"&&ce("div",null,
            ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4}},"角色"),
            ce("select",{value:role,onChange:e=>setRole(e.target.value),style:{width:"100%",padding:"10px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,color:T.text,background:T.card}},
              orgRoles.map(([k,v])=>ce("option",{key:k,value:k},v.icon+" "+v.label)))),
          needsDept&&ce("div",null,
            ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4}},"您的部門 *"),
            deptList.length>0?ce("select",{value:deptSel,onChange:e=>setDeptSel(e.target.value),style:{width:"100%",padding:"10px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,color:T.text,background:T.card}},
              ce("option",{value:""},"請選擇部門"),
              deptList.map(function(d){var pad=["","　","　　","　　　"][d.level-1]||"";return ce("option",{key:d.id,value:d.name},pad+d.name);})):
              (oc.trim().length>=3?ce(IBox,{c:"amber",style:{marginTop:2}},"此單位尚未建立部門資料，請聯繫單位平台管理者於「部門管理」建立部門後再登入。"):ce("div",{style:{fontSize:11,color:T.muted}},"請先填入單位代碼。"))),
          mode==="org"&&ce("div",null,
            ce(Inp,{label:pwdLabel,type:"password",value:pwd,onChange:e=>setPwd(e.target.value),placeholder:"輸入密碼/PIN"}),
            lk&&lk.locked&&ce(IBox,{c:"red",style:{marginTop:6}},"🔒 PIN已鎖定，需等待 "+lk.mins+" 分鐘後才可重試。"),
            isMainAdmin(role)&&ce("div",{style:{display:"flex",justifyContent:"flex-end",marginTop:4}},
              ce("button",{onClick:onForgotPin,style:{background:"none",border:"none",cursor:"pointer",color:T.teal,fontSize:11,fontWeight:700,textDecoration:"underline",fontFamily:"inherit"}},"忘記PIN？"))),
          err&&ce(IBox,{c:"red"},err),
          ce(Btn,{onClick:doLogin,disabled:loading||(lk&&lk.locked)||(needsDept&&(deptList.length===0||!deptSel)),sz:"lg",full:true},loading?"登入中...":"登入")),
        ce(Divider),
        ce("div",{style:{fontSize:10,color:T.faint,textAlign:"center",lineHeight:1.7}},"AES-256-GCM加密 · Zero Trust驗證 · k-匿名性處理 · 個資法/GDPR保護")),
      ce("div",{style:{marginTop:16,textAlign:"center",padding:"10px 0",borderTop:"1px solid "+T.border}},
        ce("div",{style:{fontSize:10,color:T.faint,lineHeight:1.7}},"\u00a9 2024-2026 \u9e97\u5a9a\u751f\u5316\u79d1\u6280\u6709\u9650\u516c\u53f8 REIBI BIO-Technology Co., Ltd. \u00b7 \u5e73\u53f0\u8edf\u9ad4\u8457\u4f5c\u6b0a\u6240\u6709\uff0c\u7ffb\u7248\u5fc5\u7a76"),
        ce("div",{style:{fontSize:10,color:T.faint}},"\u672c\u5e73\u53f0\u70ba\u8f14\u52a9\u6027\u5065\u5eb7\u81ea\u4e3b\u7ba1\u7406\u5de5\u5177\uff0c\u4e0d\u69cb\u6210\u91ab\u7642\u8a3a\u65b7"))));
}


function ForgotPin({onBack}){
  const[tab,setTab]=useState("rc");const[oc,setOc]=useState("");const[rc,setRc]=useState("");const[np,setNp]=useState("");const[cp,setCp]=useState("");const[mn,setMn]=useState("");const[em,setEm]=useState("");const[err,setErr]=useState("");const[ok2,setOk2]=useState("");const[loading,setLoading]=useState(false);const[tid,setTid]=useState("");
  const doRC=async()=>{setErr("");if(!oc||!rc){setErr("請填入單位代碼與備用碼");return;}if(np.length<4){setErr("新PIN至少4位");return;}if(np!==cp){setErr("兩次PIN不一致");return;}setLoading(true);const code=oc.trim().toUpperCase();const sh=await DB.getRC(code);const ih=await hashPin(rc.trim().toUpperCase());if(sh&&ih!==sh){setErr("備用碼錯誤。如備用碼也遺失，請切換至「聯絡客服」頁籤。");setLoading(false);return;}const ph=await hashPin(np);const nc=genRC();await DB.setPin(code,ph);await DB.setRC(code,await hashPin(nc));await clearLk(code);AL.rec("PIN_RC_OK","",code);setOk2("PIN已成功重設！請用新PIN重新登入。");setLoading(false);};
  const doManual=async()=>{setErr("");if(!oc||!mn||!em){setErr("請填寫所有必填欄位");return;}if(!em.includes("@")){setErr("請輸入有效的Email");return;}setLoading(true);const id="PR-"+Date.now().toString(36).toUpperCase().slice(-6);await DB.savePR({id,orgCode:oc.trim().toUpperCase(),managerName:mn.trim(),contactEmail:em.trim(),status:"待審核",ts:new Date().toISOString()});AL.rec("PIN_PR",id,oc);setTid(id);setLoading(false);};
  return ce("div",{style:{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:20}},ce("div",{style:{width:"100%",maxWidth:480}},ce("button",{onClick:onBack,style:{background:"none",border:"none",cursor:"pointer",color:T.teal,fontSize:13,fontWeight:700,marginBottom:16,display:"flex",alignItems:"center",gap:5}},"← 返回登入"),ce(Card,null,ce("div",{style:{textAlign:"center",marginBottom:20}},ce("div",{style:{fontSize:36,marginBottom:8}},"🔓"),ce("h2",{style:{fontSize:18,fontWeight:700,color:T.text,margin:0}},"忘記管理者 PIN")),ce("div",{style:{display:"flex",gap:0,marginBottom:20,background:T.bg,borderRadius:10,padding:3}},[{k:"rc",l:"🔐 備用碼重設"},{k:"manual",l:"📞 聯絡客服"}].map(t=>ce("button",{key:t.k,onClick:()=>{setTab(t.k);setErr("");setOk2("");},style:{flex:1,padding:"8px 0",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12,background:tab===t.k?T.card:T.bg,color:tab===t.k?T.teal:T.muted,fontFamily:"inherit"}},t.l))),tab==="rc"&&(ok2?ce("div",{style:{textAlign:"center",padding:16}},ce("div",{style:{fontSize:28,marginBottom:8}},"✅"),ce("p",{style:{color:T.sage,fontWeight:600}},ok2),ce(Btn,{onClick:onBack,style:{marginTop:12}},"返回登入")):ce("div",{style:{display:"grid",gap:12}},ce(IBox,{c:"teal"},"💡 備用碼於首次設定精靈時生成(8碼英數字)。"),ce(Inp,{label:"單位代碼 *",value:oc,onChange:e=>setOc(e.target.value),placeholder:"例：REIBI2025"}),ce(Inp,{label:"備用碼(8碼)*",value:rc,onChange:e=>setRc(e.target.value.toUpperCase()),placeholder:"例：AB3D7EFG"}),ce(Inp,{label:"新PIN(至少4位)*",type:"password",value:np,onChange:e=>setNp(e.target.value),placeholder:"新PIN"}),ce(Inp,{label:"確認新PIN *",type:"password",value:cp,onChange:e=>setCp(e.target.value),placeholder:"再次輸入"}),err&&ce(IBox,{c:"red"},err),ce(Btn,{onClick:doRC,disabled:loading,full:true},loading?"驗證中...":"驗證備用碼並重設PIN"))),tab==="manual"&&(tid?ce("div",{style:{textAlign:"center",padding:16}},ce("div",{style:{fontSize:28,marginBottom:8}},"📬"),ce("div",{style:{fontWeight:700,color:T.sage,marginBottom:4}},"申請已送出"),ce("div",{style:{fontSize:20,fontWeight:800,color:T.teal,letterSpacing:2}},tid),ce(IBox,{c:"teal",style:{marginTop:12,textAlign:"left"}},"LINE：@reibicare",ce("br"),"Email：reibiservice@gmail.com"),ce(Btn,{onClick:onBack,style:{marginTop:12}},"返回登入")):ce("div",{style:{display:"grid",gap:12}},ce(IBox,{c:"amber"},"⚠ 人工審核需提供：①管理者授權書(公司大小章)②管理者身份證明。"),ce(Inp,{label:"單位代碼 *",value:oc,onChange:e=>setOc(e.target.value),placeholder:"例：REIBI2025"}),ce(Inp,{label:"管理者姓名 *",value:mn,onChange:e=>setMn(e.target.value),placeholder:"您的姓名"}),ce(Inp,{label:"聯絡 Email *",type:"email",value:em,onChange:e=>setEm(e.target.value),placeholder:"yourname@company.com"}),err&&ce(IBox,{c:"red"},err),ce(Btn,{onClick:doManual,disabled:loading,full:true},loading?"送出中...":"送出人工審核申請"))))));
}


function AssessWizard({session,onComplete,onBack}){
  const[step,setStep]=useState(0);
  const[ok,setOk]=useState(false);
  const[prof,setProf]=useState({name:(session&&session.name)||"",age:"",gender:"",dept:"",locs:[]});
  const[sA,setSA]=useState({});const[pA,setPA]=useState({});const[wA,setWA]=useState({});
  const[noPain,setNoPain]=useState(false);const[busy,setBusy]=useState(false);
  const sScore=Object.values(sA).reduce((a,b)=>a+b,0);
  const pScore=noPain?0:Object.values(pA).reduce((a,b)=>a+b,0);
  const wScore=Object.values(wA).reduce((a,b)=>a+b,0);
  const sL=getSL(sScore);const pL=getPL(pScore);
  const uid=(session&&session.uid)||"g";
  const doSubmit=async()=>{
    setBusy(true);setStep(5);
    const prompt="台灣健康顧問，循證醫學建議。年齡:"+(prof.age||"未填")+" 睡眠ISI:"+sScore+"/28("+sL.label+") 疼痛BPI:"+pScore+"/50("+pL.label+") 工作:"+wScore+"/30\n回傳純JSON從{開始，6鍵各120字繁體：{\"generalHealth\":\"\",\"sleepEducation\":\"\",\"painEducation\":\"\",\"dietaryAdvice\":\"\",\"physicalTherapy\":\"\",\"reibiProducts\":\"\"}";
    const txt=await callAI(prompt);
    let recs=null;try{const m=txt.match(/\{[\s\S]*\}/);if(m)recs=JSON.parse(m[0]);}catch{}
    const report={id:Math.random().toString(36).slice(2,10),ts:new Date().toISOString(),profile:prof,sScore,sL,pScore,pL,wScore,recs,noPain};
    await DB.saveRpt(report);
    if(session&&session.orgCode&&canDo(session.role,"submit_org"))await DB.saveOrgRec(session.orgCode,report);
    const newPts=await DB.addPts(uid,10);
    AL.rec("ASSESS","done",session&&session.role);
    onComplete(report,newPts);
  };
  if(step===5)return ce(Screen,{onBack,maxW:560},ce(Card,{style:{textAlign:"center",padding:48}},ce("div",{style:{fontSize:40,marginBottom:16}},"⚙"),ce("h3",{style:{color:T.teal}},"AI分析中..."),ce("p",{style:{color:T.muted,fontSize:13}},"正在生成個人化建議，請稍候。")));
  const backFn=step===0?onBack:()=>setStep(s=>s-1);
  const steps=["聲明","資料","睡眠","疼痛","工作"];
  return ce(Screen,{onBack:backFn,maxW:560},
    ce("div",{style:{marginBottom:20}},
      ce("div",{style:{display:"flex",justifyContent:"space-between",fontSize:11,color:T.muted,marginBottom:6}},steps.map((l,i)=>ce("span",{key:l,style:{fontWeight:i===step?700:400,color:i===step?T.teal:T.faint}},l))),
      ce("div",{style:{height:4,background:"#e7e5e4",borderRadius:2}},ce("div",{style:{width:(step/4*100)+"%",height:"100%",background:T.teal,borderRadius:2,transition:"width .3s"}}))),
    step===0&&ce(Card,null,
      ce("div",{style:{textAlign:"center",marginBottom:20}},ce("div",{style:{fontSize:36,marginBottom:8}},"📜"),ce("h3",{style:{fontSize:18,fontWeight:700,color:T.text}},"誠實填寫聲明")),
      ce(IBox,{c:"amber",style:{marginBottom:16}},"本評估採用 ISI 失眠嚴重度量表及 BPI 疼痛量表(國際認可工具)，所填資訊依嚴格隱私政策保護，資料全程去識別化處理。本平台為輔助性健康自主管理工具，不構成醫療診斷。"),
      ce("label",{style:{display:"flex",gap:10,cursor:"pointer",marginBottom:20,alignItems:"flex-start"}},ce("input",{type:"checkbox",checked:ok,onChange:e=>setOk(e.target.checked),style:{marginTop:3,accentColor:T.teal}}),ce("span",{style:{fontSize:13,color:T.text,lineHeight:1.7}},"本人聲明所填資訊為本人真實健康狀況，理解此評估之目的並同意資料使用條款。")),
      ce(Btn,{onClick:()=>setStep(1),disabled:!ok,full:true},"開始評估")),
    step===1&&ce(Card,null,
      ce(SecTitle,null,"基本資料"),
      ce("div",{style:{display:"grid",gap:12}},
        [["名稱(可使用代稱)","name","text"],["年齡(歲)","age","number"]].map(([l,k,t])=>ce(Inp,{key:k,label:l,type:t,value:prof[k],onChange:e=>setProf(p=>({...p,[k]:e.target.value}))})),
        ce("div",null,
          ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4}},"性別"),
          ce("div",{style:{display:"flex",gap:8}},[{v:"male",l:"男性"},{v:"female",l:"女性"},{v:"other",l:"不填"}].map(opt=>ce("button",{key:opt.v,onClick:()=>setProf(p=>({...p,gender:opt.v})),style:{flex:1,padding:"8px 0",borderRadius:8,border:"1px solid "+(prof.gender===opt.v?T.teal:T.border),background:prof.gender===opt.v?T.tealBg:T.card,color:prof.gender===opt.v?T.teal:T.muted,fontSize:12,cursor:"pointer",fontWeight:prof.gender===opt.v?700:400,fontFamily:"inherit"}},opt.l)))),
        ce("div",null,ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:6}},"疼痛部位(可複選)"),
          ce("div",{style:{display:"flex",flexWrap:"wrap",gap:6}},PLOCS.map(loc=>ce("button",{key:loc,onClick:()=>setProf(p=>({...p,locs:p.locs.includes(loc)?p.locs.filter(x=>x!==loc):[...p.locs,loc]})),style:{padding:"4px 10px",borderRadius:20,border:"1px solid "+(prof.locs.includes(loc)?T.teal:T.border),background:prof.locs.includes(loc)?T.tealBg:T.card,color:prof.locs.includes(loc)?T.teal:T.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit"}},loc))))),
      ce(Btn,{onClick:()=>setStep(2),full:true,style:{marginTop:20}},"下一步")),
    step===2&&ce(Card,null,
      ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}},ce(SecTitle,null,"🌙 睡眠評估(ISI)"),ce(LBadge,{k:sL.key})),
      SQ.map(q=>ce("div",{key:q.id,style:{marginBottom:18}},
        ce("p",{style:{fontSize:13,color:T.text,fontWeight:600,margin:"0 0 8px",lineHeight:1.6}},q.text),
        q.opts.map(function(opt,i){const sel=sA[q.id]===i;return ce("button",{key:i,onClick:()=>setSA(a=>({...a,[q.id]:i})),style:{display:"block",width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid "+(sel?T.teal:T.border),background:sel?T.tealBg:T.card,color:sel?T.teal:T.muted,fontSize:13,cursor:"pointer",textAlign:"left",marginBottom:4,fontWeight:sel?600:400,fontFamily:"inherit"}},opt);}))),
      ce(Btn,{onClick:()=>setStep(3),full:true,disabled:Object.keys(sA).length<SQ.length},"下一步")),
    step===3&&ce(Card,null,
      ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}},ce(SecTitle,null,"🩺 疼痛評估(BPI)"),!noPain&&ce(LBadge,{k:pL.key})),
      ce("label",{style:{display:"flex",gap:8,alignItems:"center",cursor:"pointer",marginBottom:16,padding:"8px 12px",background:T.sageBg,borderRadius:8}},ce("input",{type:"checkbox",checked:noPain,onChange:e=>setNoPain(e.target.checked),style:{accentColor:T.sage}}),ce("span",{style:{fontSize:13,color:T.sage,fontWeight:600}},"過去一週完全無疼痛")),
      !noPain&&PQ.map(q=>ce("div",{key:q.id,style:{marginBottom:18}},ce("p",{style:{fontSize:13,color:T.text,fontWeight:600,margin:"0 0 8px"}},q.text),ce("div",{style:{display:"flex",gap:4,flexWrap:"wrap"}},[0,1,2,3,4,5,6,7,8,9,10].map(function(n){const sel=pA[q.id]===n;return ce("button",{key:n,onClick:()=>setPA(a=>({...a,[q.id]:n})),style:{width:36,height:36,borderRadius:8,border:"1px solid "+(sel?T.coral:T.border),background:sel?T.coralBg:T.card,color:sel?T.coral:T.muted,fontSize:13,cursor:"pointer",fontWeight:sel?700:400,fontFamily:"inherit"}},n);})))),
      ce(Btn,{onClick:()=>setStep(4),full:true,disabled:!noPain&&Object.keys(pA).length<PQ.length},"下一步")),
    step===4&&ce(Card,null,
      ce(SecTitle,null,"💼 工作影響評估(WQ)"),
      WQ.map(q=>ce("div",{key:q.id,style:{marginBottom:18}},ce("p",{style:{fontSize:13,color:T.text,fontWeight:600,margin:"0 0 8px"}},q.text),ce("div",{style:{display:"flex",gap:4,flexWrap:"wrap"}},[0,1,2,3,4,5,6,7,8,9,10].map(function(n){const sel=wA[q.id]===n;return ce("button",{key:n,onClick:()=>setWA(a=>({...a,[q.id]:n})),style:{width:36,height:36,borderRadius:8,border:"1px solid "+(sel?T.amber:T.border),background:sel?T.amberBg:T.card,color:sel?T.amber:T.muted,fontSize:13,cursor:"pointer",fontWeight:sel?700:400,fontFamily:"inherit"}},n);})))),
      ce(Btn,{onClick:doSubmit,full:true,disabled:Object.keys(wA).length<WQ.length||busy},"完成評估 · 生成AI建議")));
}


function ResultScreen({report,session,pts,onBack,onNav}){
  const{sScore,sL,pScore,pL,wScore,recs}=report;
  const[tab,setTab]=useState("overview");
  const recItems=[{k:"generalHealth",icon:"🏥",title:"整體健康建議",color:T.teal},{k:"sleepEducation",icon:"🌙",title:"睡眠改善策略",color:"#1d4ed8"},{k:"painEducation",icon:"🩺",title:"疼痛管理教育",color:T.coral},{k:"dietaryAdvice",icon:"🥗",title:"飲食調整建議",color:T.sage},{k:"physicalTherapy",icon:"🏃",title:"運動物理治療",color:T.amber},{k:"reibiProducts",icon:"⚡",title:"REIBI體驗建議",color:T.plum}];
  return ce(Screen,{onBack,maxW:640},
    ce("div",{style:{background:"linear-gradient(135deg,"+T.teal+",#065f46)",borderRadius:14,padding:"20px 20px 16px",marginBottom:16,color:"#fff",textAlign:"center"}},
      ce("div",{style:{fontSize:11,opacity:.7,letterSpacing:2,marginBottom:6}},"REIBI 健康評估報告"),
      ce("h2",{style:{fontSize:18,fontWeight:700,margin:"0 0 4px"}},"評估完成 ✓"),
      ce("p",{style:{fontSize:11,opacity:.7,margin:"0 0 14px"}},((report.profile&&report.profile.name)||"匿名")+" · "+new Date(report.ts).toLocaleDateString("zh-TW")+" · +10⭐ 累計"+pts),
      ce("div",{style:{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}},[{l:"睡眠ISI",s:sScore,m:28},{l:"疼痛BPI",s:pScore,m:50},{l:"工作影響",s:wScore,m:30}].map(x=>ce("div",{key:x.l,style:{background:"rgba(255,255,255,.18)",borderRadius:10,padding:"8px 14px",textAlign:"center",minWidth:80}},ce("div",{style:{fontSize:10,opacity:.8,marginBottom:2}},x.l),ce("div",{style:{fontSize:18,fontWeight:700}},x.s,ce("span",{style:{fontSize:10}}," /"+x.m)))))),
    ce("div",{style:{display:"flex",gap:4,marginBottom:14,background:T.card,borderRadius:10,padding:4,border:"1px solid "+T.border}},[{k:"overview",l:"概覽"},{k:"recs",l:"AI建議"},{k:"actions",l:"行動"}].map(t=>ce("button",{key:t.k,onClick:()=>setTab(t.k),style:{flex:1,padding:"7px 0",border:"none",borderRadius:7,cursor:"pointer",fontWeight:700,fontSize:12,background:tab===t.k?T.teal:T.card,color:tab===t.k?"#fff":T.muted,fontFamily:"inherit"}},t.l))),
    tab==="overview"&&ce("div",{style:{display:"grid",gap:12}},
      [{s:sScore,m:28,lv:sL,label:"🌙 睡眠評估(ISI)"},{s:pScore,m:50,lv:pL,label:"🩺 疼痛評估(BPI)"}].map(function(x){const lx=LX[x.lv&&x.lv.key]||LX.green;return ce(Card,{key:x.label,style:{borderLeft:"4px solid "+lx.c}},ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}},ce("div",null,ce("div",{style:{fontWeight:700,fontSize:14,color:T.text,marginBottom:4}},x.label),ce(LBadge,{k:x.lv&&x.lv.key})),ce("div",{style:{fontSize:24,fontWeight:800,color:lx.c}},x.s,ce("span",{style:{fontSize:12}}," /"+x.m))),ce("div",{style:{background:lx.bg,border:"1px solid "+lx.br,borderRadius:8,padding:"8px 12px",marginTop:10,fontSize:12,color:T.muted}},ce("p",{style:{margin:"0 0 4px"}},x.lv&&x.lv.desc),ce("p",{style:{margin:0,color:lx.c,fontWeight:600}},"▸ "+(x.lv&&x.lv.action))),(x.lv&&(x.lv.key==="red"||x.lv.key==="orange"))&&ce(IBox,{c:"red",style:{marginTop:8}},"⚠ 建議盡快就醫 · 緊急：1925安心專線 · 119"));}),
      ce(Card,{style:{background:T.amberBg,border:"1px solid #fcd34d"}},ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},ce("div",null,ce("div",{style:{fontWeight:700,fontSize:13,color:T.amber}},"⭐ 積分 / 個人健康OKR"),ce("div",{style:{fontSize:22,fontWeight:800,color:T.amber,marginTop:2}},pts+" 點")),ce(Btn,{v:"amber",sz:"sm",onClick:()=>onNav("points")},"查看積分")))),
    tab==="recs"&&ce("div",{style:{display:"grid",gap:10}},recItems.map(r=>ce(Card,{key:r.k,style:{borderLeft:"4px solid "+r.color}},ce("div",{style:{fontWeight:700,fontSize:13,color:r.color,marginBottom:6}},r.icon+" "+r.title),ce("p",{style:{fontSize:13,color:T.muted,lineHeight:1.8,margin:0}},(recs&&recs[r.k])||FB[r.k]))),ce(Card,{style:{background:"#fdf4ff",border:"1px solid #e9d5ff"}},ce("div",{style:{fontWeight:700,fontSize:13,color:T.plum,marginBottom:6}},"💡 自主健管體驗建議"),ce("div",{style:{fontSize:12,color:T.muted,lineHeight:1.8}},sScore>14?"舒曼波：每週"+(sScore>21?"4-5":"3-4")+"次":"舒曼波：每週1-2次",ce("br"),pScore>12?"LA200：每週"+(pScore>38?"3次以上":"2-3次"):"LA200：每週1次"))),
    tab==="actions"&&ce("div",{style:{display:"grid",gap:10}},
      [{icon:"📅",label:"預約自主健管體驗",nav:"appt",v:"primary"},{icon:"✅",label:"22項行動打卡(今日+5積分)",nav:"checkin",v:"sage"},{icon:"🩸",label:"更新三高/BMI數值(+20積分)",nav:"th",v:"amber"},{icon:"⭐",label:"查看積分與兌換",nav:"points",v:"amber"}].map(a=>ce(Btn,{key:a.label,v:a.v,full:true,onClick:()=>onNav(a.nav)},a.icon+" "+a.label)),
      ce("div",{style:{borderTop:"1px solid "+T.border,paddingTop:12,marginTop:4}},
        ce("div",{style:{fontSize:12,color:T.muted,marginBottom:8,textAlign:"center"}},"報告與記錄"),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}},
          ce(Btn,{v:"ghost",sz:"sm",onClick:()=>onNav("personal_report")},"📄 我的健康報告"),
          ce(Btn,{v:"ghost",sz:"sm",onClick:()=>onNav("history")},"📊 歷史評估記錄")))));
}


function PersonalReportScreen({report,session,onBack,allReports,onNav,isPro}){
  const[tab,setTab]=useState("cover");
  const[content,setContent]=useState("");const[loading,setLoading]=useState(false);const[prog,setProg]=useState(0);const[failed,setFailed]=useState(false);
  const[mentalHist,setMentalHist]=useState([]);
  const muid=(session&&session.uid)||"g";
  useEffect(function(){
    stor.g("mental_hist_"+muid).then(function(d){if(d)setMentalHist(JSON.parse(d));});
  },[]);
  if(!report)return ce(Screen,{onBack,title:"個人報告"},ce(Card,{style:{textAlign:"center",padding:40}},"請先完成評估"));
  const{sScore,sL,pScore,pL,wScore,profile,ts,recs}=report;
  const lastPhq=mentalHist.find(function(h){return h.type==="phq4";});
  const lastPss=mentalHist.find(function(h){return h.type==="pss4";});
  const lastMind=mentalHist.find(function(h){return h.type==="mind3";});
  const name=(profile&&profile.name)||"匿名";
  const age=(profile&&profile.age)||"—";
  const gender=(profile&&profile.gender)==="male"?"男性":(profile&&profile.gender)==="female"?"女性":"—";

  const genPersonalReport=async()=>{
    setLoading(true);setProg(0);setFailed(false);
    const hist=allReports&&allReports.slice(0,6).map(r=>"日期:"+r.ts.slice(0,10)+" 睡眠:"+r.sScore+"/28("+( r.sL&&r.sL.label||"")+") 疼痛:"+r.pScore+"/50").join("；");
    const prompt="你是台灣健康管理顧問，引用2022-2025循證醫學。請生成完整個人健康評估報告(至少2000字，繁體中文)，包含：\n"+
      "一、評量目的與說明\n二、睡眠評估結果分析(ISI量表)\n三、疼痛評估結果分析(BPI量表)\n"+
      "四、睡眠與疼痛雙向關聯說明(引用IASP 2019：88%慢性疼痛患者存在睡眠問題)\n"+
      "五、工作效率影響分析\n六、改善建議(生活習慣調整、睡眠衛生、姿勢與活動建議，僅談非藥物、非保健品的生活型態調整，不要推薦任何具體保健品成分、廠牌或劑量)\n"+
      "七、REIBI健康體驗建議：僅推薦以下兩項REIBI自有產品，不要提及其他任何保健品/藥品/穿戴裝置或第三方產品——舒曼波自律神經調節體驗(7.83Hz，有助睡眠品質改善與壓力緩解)及LA200光能緩解疼痛體驗(660-808nm LLLT，有效緩解肌肉疼痛)之適用建議\n"+
      "八、建議追蹤時間表\n\n"+
      "⚠️ 重要限制：全文不得推薦、提及任何具體保健品成分(如褪黑激素、鎂、魚油等)、劑量、廠牌或第三方穿戴裝置，本平台不販售這些產品，提及可能誤導使用者。如需談到日常改善，僅限生活習慣、姿勢、睡眠衛生、飲食型態(不指定成分/劑量)等非產品化建議。\n\n"+
      "個人資料：姓名代碼:"+name+" 年齡:"+age+" 性別:"+gender+"\n"+
      "本次評估：睡眠ISI:"+sScore+"/28("+( sL&&sL.label||"")+") 疼痛BPI:"+pScore+"/50("+( pL&&pL.label||"")+") 工作影響:"+wScore+"/30\n"+
      (hist?"歷史記錄(最近6次)："+hist:"");
    let t=0;const pi=setInterval(()=>{t+=5;setProg(Math.min(t,90));},400);
    const txt=await callAI(prompt,7000);
    clearInterval(pi);setProg(100);setLoading(false);
    if(txt){setContent(txt);}else{setFailed(true);}
  };

  const tabs=[{k:"cover",l:"封面"},{k:"basis",l:"評量來源"},{k:"sleep",l:"睡眠報告"},{k:"pain",l:"疼痛報告"},{k:"mental",l:"身心健康"},{k:"combined",l:"綜合報告"},{k:"improve",l:"AI改善建議"},{k:"annual",l:"年度改善"}];
  const lx=LX[sL&&sL.key]||LX.green;const plx=LX[pL&&pL.key]||LX.green;

  return ce(Screen,{onBack,title:"📄 我的健康報告",maxW:700,action:
    content&&ce(Btn,{sz:"sm",v:"navy",onClick:()=>{const blob=new Blob([content],{type:"text/plain"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="個人健康報告_"+new Date(ts).toLocaleDateString("zh-TW").replace(/\//g,"-")+".txt";a.click();}},"⬇ 下載報告")},
    ce("div",{style:{overflowX:"auto",marginBottom:12}},
      ce("div",{style:{display:"flex",gap:6,minWidth:"max-content"}},tabs.map(t=>ce("button",{key:t.k,onClick:()=>setTab(t.k),style:{padding:"7px 14px",border:"none",borderRadius:20,cursor:"pointer",fontWeight:700,fontSize:12,background:tab===t.k?T.teal:T.card,color:tab===t.k?"#fff":T.muted,fontFamily:"inherit",whiteSpace:"nowrap",border:"1px solid "+(tab===t.k?T.teal:T.border)}},t.l)))),

    tab==="cover"&&ce(Card,{style:{background:"linear-gradient(135deg,"+T.teal+",#1a5c4e)",color:"#fff",textAlign:"center",padding:"40px 24px"}},
      ce("div",{style:{fontSize:40,marginBottom:16}},"🌿"),
      ce("div",{style:{fontSize:11,opacity:.7,letterSpacing:3,marginBottom:8}},"麗媚生化科技 REIBI BIO-Technology"),
      ce("h2",{style:{fontSize:22,fontWeight:800,margin:"0 0 4px"}},"個人健康自主管理評估報告"),
      ce("div",{style:{fontSize:13,opacity:.8,marginBottom:20}},"睡眠 × 疼痛 聯合評估 · ISI & BPI 國際量表"),
      ce("div",{style:{background:"rgba(255,255,255,.15)",borderRadius:10,padding:"14px 20px",display:"inline-block",textAlign:"left",minWidth:240}},
        [["評估對象",name],["年齡",age+"歲"],["性別",gender],["評估日期",new Date(ts).toLocaleDateString("zh-TW")],["報告編號",report.id&&report.id.slice(0,8).toUpperCase()]].map(([l,v])=>
          ce("div",{key:l,style:{display:"flex",justifyContent:"space-between",gap:20,padding:"4px 0",borderBottom:"1px solid rgba(255,255,255,.2)",fontSize:13}},
            ce("span",{style:{opacity:.75}},l+":"),ce("span",{style:{fontWeight:700}},v)))),
      ce("div",{style:{display:"flex",gap:10,justifyContent:"center",marginTop:16}},
        [{l:"睡眠ISI",s:sScore,m:28,lx},{l:"疼痛BPI",s:pScore,m:50,lx:plx}].map(x=>ce("div",{key:x.l,style:{background:"rgba(255,255,255,.18)",borderRadius:8,padding:"10px 16px",textAlign:"center"}},
          ce("div",{style:{fontSize:10,opacity:.75}},x.l),
          ce("div",{style:{fontSize:20,fontWeight:800}},x.s,ce("span",{style:{fontSize:10}},"/"+x.m)),
          ce("div",{style:{fontSize:11,fontWeight:600}},x.lx.lbl)))),
      ce("div",{style:{marginTop:16,fontSize:11,opacity:.6}},"本報告為輔助性健康自主管理工具，不構成醫療診斷。")),

    tab==="basis"&&ce(Card,null,
      ce(SecTitle,null,"評量目的與來源依據"),
      ce(IBox,{c:"teal",style:{marginBottom:14}},ce("strong",null,"評量目的："),"用以因應台灣政府提倡健康自主管理，藉由自我評量，了解自我健康型態，提升自主管理意識，並透過健康促進進而達到疼痛緩解以及睡眠品質提升。"),
      ce("div",{style:{display:"grid",gap:12}},
        [
          {title:"ISI 失眠嚴重度量表",content:"Insomnia Severity Index(ISI)：國際公認失眠評估工具，7題，0-28分，信效度經充分驗證(Morin CM et al., Sleep Medicine, 2011)。評分區間：0-7分無臨床意義失眠(綠燈)；8-14分輕度(黃燈)；15-21分中度(橙燈)；22-28分重度失眠(紅燈)。廣泛應用於職場睡眠健康篩查及臨床研究。"},
          {title:"BPI 簡明疼痛量表",content:"Brief Pain Inventory(BPI)：國際疼痛研究學會(IASP)認可工具，評估疼痛強度及對日常生活七大面向之干擾程度(活動、情緒、行走、工作、與人關係、睡眠、享受生活)，信效度廣泛驗證(Cleeland CS, 1991)。評分區間：0-12分輕度(綠燈)；13-25分中度(黃燈)；26-38分重度(橙燈)；39-50分極重度(紅燈)。"},
          {title:"PHQ-4 情緒健康快篩",content:"Patient Health Questionnaire-4(PHQ-4)：結合PHQ-2憂鬱篩查與GAD-2焦慮篩查，共4題，0-12分。由Kroenke K等人(2009)開發，為國際廣泛使用之精簡心理健康篩查工具。評分區間：0-2分正常(綠燈)；3-5分輕度困擾(黃燈)；6-8分中度(橙燈)；9-12分重度(紅燈)。本評估為輔助篩查工具，不構成醫療診斷，如有疑慮請諮詢身心科醫師。"},
          {title:"PSS-4 感知壓力量表",content:"Perceived Stress Scale-4(PSS-4)：Cohen S等人(1983)開發的感知壓力量表精簡版，評估個人對生活壓力程度的主觀感受，共4題，0-16分。廣泛應用於職場心理健康及壓力研究。評分區間：0-5分低壓力(綠燈)；6-10分中度壓力(黃燈)；11-16分高壓力(紅燈)。對應《職業安全衛生法》第6條職場心理健康保護義務。"},
          {title:"睡眠、疼痛與身心三維關聯",content:"臨床研究證實，慢性疼痛是導致失眠的重要原因之一，高達88%的慢性疼痛患者存在睡眠問題(IASP, 2019)。睡眠與疼痛存在雙向關聯：疼痛干擾入睡；睡眠剝奪降低疼痛閾值。壓力與情緒困擾進一步強化此惡性循環——焦慮增加夜間覺醒，情緒低落降低疼痛耐受度。三維同步評估(ISI×BPI×PHQ-4)有助完整掌握個人健康狀態。若同時存在上述困擾，請完整告知醫師。"},
          {title:"政策依據",content:"台灣衛生福利部「2023-2026年國民健康白皮書」、國民健康署「三高慢病整合照護計畫(888計畫)」、《職業安全衛生法》第6條職場心理健康保護。國際框架：WHO Ottawa Charter(1986)五大行動領域、WHO非傳染病全球行動計畫(2013-2030)。"},
          {title:"來源標準",content:"GRI 403-6「促進員工健康」、GRI 403-9「在職失能及缺勤」、ESG企業永續管理架構(E環境/S社會/G治理)、聯合國永續發展目標SDG 3良好健康、SDG 8體面工作、SDG 10減少不平等、SDG 17夥伴關係。IDG內在發展目標五大維度(Being/Thinking/Relating/Collaborating/Acting)。"},
        ].map(item=>ce(Card,{key:item.title,style:{borderLeft:"4px solid "+T.teal,padding:"12px 14px"}},
          ce("div",{style:{fontWeight:700,fontSize:13,color:T.teal,marginBottom:6}},item.title),
          ce("p",{style:{fontSize:13,color:T.muted,lineHeight:1.8,margin:0}},item.content))))),

    tab==="sleep"&&ce(Card,null,
      ce(SecTitle,null,"🌙 睡眠評估結果(ISI)"),
      ce("div",{style:{display:"flex",alignItems:"center",gap:16,padding:"14px",background:lx.bg,border:"1px solid "+lx.br,borderRadius:10,marginBottom:14}},
        ce("div",{style:{fontSize:40,fontWeight:800,color:lx.c}},sScore),
        ce("div",null,
          ce("div",{style:{fontSize:11,color:T.muted}},"ISI 總分 / 28"),
          ce(LBadge,{k:sL&&sL.key}),
          ce("p",{style:{fontSize:12,color:T.muted,margin:"6px 0 0",lineHeight:1.6}},sL&&sL.desc))),
      ce("div",{style:{background:lx.bg,borderRadius:8,padding:"10px 14px",fontSize:12,color:lx.c,fontWeight:600,marginBottom:14}},"▸ 建議行動："+( sL&&sL.action)),
      (sL&&(sL.key==="red"||sL.key==="orange"))&&ce(IBox,{c:"red",style:{marginBottom:14}},"⚠ 重度/中度失眠建議盡快就醫 · 1925安心專線(24小時)")),

    tab==="pain"&&ce(Card,null,
      ce(SecTitle,null,"🩺 疼痛評估結果(BPI)"),
      ce("div",{style:{display:"flex",alignItems:"center",gap:16,padding:"14px",background:plx.bg,border:"1px solid "+plx.br,borderRadius:10,marginBottom:14}},
        ce("div",{style:{fontSize:40,fontWeight:800,color:plx.c}},pScore),
        ce("div",null,
          ce("div",{style:{fontSize:11,color:T.muted}},"BPI 總分 / 50"),
          ce(LBadge,{k:pL&&pL.key}),
          ce("p",{style:{fontSize:12,color:T.muted,margin:"6px 0 0",lineHeight:1.6}},pL&&pL.desc))),
      ce("div",{style:{background:plx.bg,borderRadius:8,padding:"10px 14px",fontSize:12,color:plx.c,fontWeight:600,marginBottom:14}},"▸ 建議行動："+( pL&&pL.action)),
      profile&&profile.locs&&profile.locs.length>0&&ce("div",{style:{marginTop:10}},
        ce("div",{style:{fontSize:12,fontWeight:600,color:T.text,marginBottom:6}},"疼痛部位："),
        ce("div",{style:{display:"flex",flexWrap:"wrap",gap:6}},profile.locs.map(loc=>ce(Tag,{key:loc,c:"coral"},loc))))),

    tab==="mental"&&ce("div",{style:{display:"grid",gap:12}},
      ce(IBox,{c:"plum",style:{marginBottom:4}},"身心健康與睡眠疼痛密切相關：壓力與焦慮是失眠的主要誘因之一，情緒低落亦會降低疼痛忍受度，形成「疼痛→失眠→情緒惡化→疼痛加劇」的惡性循環。"),
      (lastPhq||lastPss||lastMind)&&ce(Card,{style:{borderLeft:"4px solid "+T.plum}},
        ce(SecTitle,null,"💚 我的最近評估結果"),
        ce("div",{style:{display:"grid",gap:8}},
          [lastPhq&&{icon:"💚",title:"情緒健康快篩(PHQ-4)",score:lastPhq.score+"/12",level:lastPhq.level,ts:lastPhq.ts},
           lastPss&&{icon:"🧘",title:"職場壓力評估(PSS-4)",score:lastPss.score+"/16",level:lastPss.level,ts:lastPss.ts},
           lastMind&&{icon:"🌿",title:"正念覺察自評",score:lastMind.score+"/9",level:lastMind.level,ts:lastMind.ts}
          ].filter(Boolean).map(function(item){
            var lx2=LX[item.level]||LX.green;
            return ce("div",{key:item.title,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:lx2.bg,borderRadius:8,border:"1px solid "+lx2.br}},
              ce("div",null,
                ce("div",{style:{fontWeight:700,fontSize:13,color:T.text}},item.icon+" "+item.title),
                ce("div",{style:{fontSize:11,color:T.muted,marginTop:2}},item.ts&&item.ts.slice(0,10))),
              ce("div",{style:{textAlign:"right"}},
                ce("div",{style:{fontSize:16,fontWeight:800,color:lx2.c}},item.score),
                ce(LBadge,{k:item.level})));
          }))),
      ce(Card,{style:{borderLeft:"4px solid "+T.plum}},
        ce(SecTitle,null,"💚 身心評估建議"),
        ce("div",{style:{display:"grid",gap:8}},
          [{icon:"💚",title:"情緒健康快篩(PHQ-4)",desc:"4題2分鐘，評估焦慮與憂鬱程度。建議每週進行一次，追蹤情緒變化趨勢。",nav:"mental"},
           {icon:"🧘",title:"職場壓力評估(PSS-4)",desc:"4題3分鐘，量測感知壓力程度。建議每月進行一次，配合ISI/BPI評估一起分析。",nav:"mental"},
           {icon:"🌙",title:"睡眠日記(每日記錄)",desc:"每日2分鐘，記錄睡眠時間與品質，2週為一個循環。系統自動計算睡眠效率。",nav:"sleep_diary"},
           {icon:"📓",title:"疼痛日誌(每日記錄)",desc:"每日2分鐘，記錄疼痛強度與觸發因素，4週為一個循環。協助醫師精準評估。",nav:"pain_diary"},
          ].map(function(item){
            return ce(Card,{key:item.title,style:{borderLeft:"3px solid "+T.plum,padding:"10px 14px"}},
              ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}},
                ce("div",{style:{flex:1}},
                  ce("div",{style:{fontWeight:700,fontSize:13,color:T.plum,marginBottom:4}},item.icon+" "+item.title),
                  ce("div",{style:{fontSize:12,color:T.muted,lineHeight:1.7}},item.desc)),
                onBack&&ce(Btn,{sz:"sm",v:"ghost",onClick:function(){if(onNav)onNav(item.nav);else if(onBack)onBack();}},item.icon+" 前往")));
          }))),
      ce(Card,{style:{borderLeft:"4px solid "+T.teal}},
        ce(SecTitle,null,"身心健康與三維評估關聯"),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}},
          [{l:"睡眠",s:sScore,m:28,lx,icon:"🌙"},{l:"疼痛",s:pScore,m:50,lx:plx,icon:"🩺"},{l:"工作影響",s:wScore,m:30,lx:LX.green,icon:"💼"}].map(function(x){
            return ce("div",{key:x.l,style:{background:x.lx.bg,borderRadius:8,padding:"10px 6px",textAlign:"center",border:"1px solid "+x.lx.br}},
              ce("div",{style:{fontSize:16}},x.icon),
              ce("div",{style:{fontSize:10,color:T.muted,marginTop:2}},x.l),
              ce("div",{style:{fontSize:18,fontWeight:800,color:x.lx.c}},x.s));
          })),
        ce("p",{style:{fontSize:12,color:T.muted,lineHeight:1.8,margin:0}},"研究顯示，壓力與情緒困擾會加重失眠(ISI)與疼痛感知(BPI)，三者形成相互強化的循環。建議同步追蹤身心評估數據，以獲得更完整的健康管理圖像。"))),

    tab==="combined"&&ce(Card,null,
      ce(SecTitle,null,"綜合評估報告"),
      ce(IBox,{c:"amber",style:{marginBottom:14}},"睡眠、疼痛與身心健康三維關聯：高達88%的慢性疼痛患者存在睡眠問題(IASP, 2019)。壓力與情緒困擾進一步強化此惡性循環。建議三維同步評估與整合性介入。"),
      ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}},
        [{l:"🌙 睡眠ISI",s:sScore,m:28,lx},{l:"🩺 疼痛BPI",s:pScore,m:50,lx:plx},{l:"💚 身心PHQ",s:lastPhq?lastPhq.score:"—",m:12,lx:lastPhq?(LX[lastPhq.level]||LX.green):LX.green}].map(function(x){
          return ce("div",{key:x.l,style:{background:x.lx.bg,borderRadius:10,padding:"12px 8px",textAlign:"center",border:"1px solid "+x.lx.br}},
            ce("div",{style:{fontWeight:600,fontSize:11,color:T.muted,marginBottom:4}},x.l),
            ce("div",{style:{fontSize:22,fontWeight:800,color:x.lx.c}},x.s,ce("span",{style:{fontSize:10}},"/"+x.m)));
        })),
      ce(IBox,{c:"plum",style:{marginBottom:14}},"💚 建議同步進行「身心健康」評估(PHQ-4情緒快篩 + PSS-4壓力評估)，以獲得完整的三維健康圖像。",onNav&&ce("button",{onClick:function(){onNav("mental");},style:{display:"block",marginTop:6,padding:"4px 12px",borderRadius:6,border:"1px solid "+T.plum,background:T.plumBg,color:T.plum,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}},"💚 前往身心健康評估")),
      ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}},
        [{l:"🌙 睡眠",s:sScore,m:28,lx},{l:"🩺 疼痛",s:pScore,m:50,lx:plx},{l:"💼 工作影響",s:wScore,m:30,lx:LX.green}].slice(0,2).map(x=>ce("div",{key:x.l,style:{background:x.lx.bg,borderRadius:10,padding:"14px",textAlign:"center",border:"1px solid "+x.lx.br}},
          ce("div",{style:{fontWeight:600,fontSize:12,color:T.muted,marginBottom:6}},x.l),
          ce("div",{style:{fontSize:28,fontWeight:800,color:x.lx.c}},x.s,ce("span",{style:{fontSize:12}},"/"+x.m))))),
      ce("div",{style:{background:T.bg,borderRadius:8,padding:"10px 14px",marginBottom:14}},
        ce("div",{style:{fontWeight:600,fontSize:12,color:T.text,marginBottom:4}},"工作影響評估"),
        ce("div",{style:{fontSize:28,fontWeight:800,color:T.teal}},wScore,ce("span",{style:{fontSize:12,color:T.muted}},"/30")),
        ce("div",{style:{fontSize:12,color:T.muted}},"睡眠/疼痛對工作專注力、效率及缺勤之影響程度"))),

    tab==="improve"&&ce("div",null,
      !content&&!loading&&ce(Card,{style:{textAlign:"center",padding:36}},
        ce("div",{style:{fontSize:40,marginBottom:12}},"🤖"),
        ce("h3",{style:{color:T.teal,marginBottom:8}},"AI個人化改善建議"),
        ce("p",{style:{color:T.muted,fontSize:13,marginBottom:6}},"結合最近3年健康/睡眠/疼痛/飲食/物理治療衛教知識，以及麗媚生化科技REIBI產品建議。"),
        ce("p",{style:{color:T.faint,fontSize:12,marginBottom:20}},"預計需要30-60秒，字數約2000字以上。"),
        !isPro&&ce(IBox,{c:"amber",style:{marginBottom:12}},"⭐ AI個人報告為訂閱版功能。免費版可查閱封面、評量來源、睡眠/疼痛/綜合報告。"),
        failed&&ce(IBox,{c:"red",style:{marginBottom:12}},"⚠ 報告生成失敗或逾時，請檢查網路連線後重試。"),
        isPro?
          ce(Btn,{onClick:genPersonalReport,sz:"lg",v:"amber"},failed?"🔄 重新生成AI個人報告":"🤖 生成AI個人報告(2000字+)"):
          ce(Btn,{onClick:function(){onNav&&onNav("subscribe");},sz:"lg",v:"amber"},"⭐ 升級訂閱解鎖AI報告")),
      loading&&ce(Card,{style:{padding:30}},
        ce("div",{style:{textAlign:"center",marginBottom:12}},ce("div",{style:{fontSize:24}},"⚙"),ce("div",{style:{fontWeight:700,color:T.teal,marginTop:8}},"AI分析中...")),
        ce("div",{style:{height:6,background:"#e7e5e4",borderRadius:3}},ce("div",{style:{width:prog+"%",height:"100%",background:T.teal,borderRadius:3,transition:"width .3s"}})),
        ce("div",{style:{textAlign:"center",fontSize:12,color:T.muted,marginTop:6}},prog+"%")),
      content&&ce(Card,{style:{whiteSpace:"pre-wrap",lineHeight:1.9,fontSize:13,color:T.text}},content)),

    tab==="annual"&&ce("div",{style:{display:"grid",gap:12}},
      !isPro?ce(Card,{style:{textAlign:"center",padding:36}},
        ce("div",{style:{fontSize:40,marginBottom:12}},"📈"),
        ce("h3",{style:{color:T.teal,marginBottom:8}},"年度改善追蹤報告"),
        ce("p",{style:{color:T.muted,fontSize:13,marginBottom:6}},"彙整您歷次評估的長期趨勢，掌握完整改善軌跡。"),
        ce(IBox,{c:"amber",style:{marginBottom:12}},"⭐ 年度改善追蹤報告為訂閱版功能。免費版可查閱封面、評量來源、睡眠/疼痛/綜合報告。"),
        ce(Btn,{onClick:function(){onNav&&onNav("subscribe");},sz:"lg",v:"amber"},"⭐ 升級訂閱解鎖年度改善報告")):
      allReports&&allReports.length>1?ce("div",null,
        ce(SecTitle,null,"年度改善追蹤報告"),
        ce(IBox,{c:"teal",style:{marginBottom:12}},"以下為您歷次評估的趨勢分析。評估次數越多，改善軌跡越清晰。"),
        allReports.slice(0,8).map(function(r,i){
          var sl=LX[r.sL&&r.sL.key]||LX.green;var pl=LX[r.pL&&r.pL.key]||LX.green;
          var prev=allReports[i+1];
          var sTrend=prev?(r.sScore<prev.sScore?"↓改善":"→持平"):null;
          var pTrend=prev?(r.pScore<prev.pScore?"↓改善":"→持平"):null;
          return ce(Card,{key:r.id,style:{padding:"12px 14px",borderLeft:"4px solid "+(i===0?T.teal:T.border)}},
            ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}},
              ce("div",null,
                ce("div",{style:{fontSize:12,color:T.muted}},r.ts&&r.ts.slice(0,10)),
                i===0&&ce(Tag,{c:"teal"},"最新")),
              ce("div",{style:{display:"flex",gap:8}},
                ce("span",{style:{fontSize:12,color:sl.c,fontWeight:700}},"睡眠:"+r.sScore+" "+(sTrend||"")),
                ce("span",{style:{fontSize:12,color:pl.c,fontWeight:700}},"疼痛:"+r.pScore+" "+(pTrend||"")))));
        })):
        ce(Card,{style:{textAlign:"center",padding:30,color:T.muted}},"目前僅有一次評估記錄，累積更多評估後可查閱年度改善趨勢。"))
  );
}


function HistoryScreen({reports,onBack,onView,session,isPro,onNav}){
  const[df,setDf]=useState("");const[dt,setDt]=useState("");
  const canDl=canDo(session&&session.role,"date_dl_personal")||canDo(session&&session.role,"date_dl_dept")||canDo(session&&session.role,"date_dl_org");
  // v10.3.24新增：免費版個人用戶歷史趨勢僅開放最近3個月，訂閱版無限制(第十一節功能差異表)
  const role=session&&session.role;
  const isFreeIndividual=role==="individual"&&!isPro;
  const winStart=new Date();winStart.setMonth(winStart.getMonth()-3);
  const winStartStr=winStart.toISOString().slice(0,10);
  const allReports=reports||[];
  const visibleReports=isFreeIndividual?allReports.filter(function(r){const d=r.ts&&r.ts.slice(0,10);return d&&d>=winStartStr;}):allReports;
  const hiddenCount=allReports.length-visibleReports.length;
  const flt=visibleReports&&visibleReports.filter(r=>{const d=r.ts&&r.ts.slice(0,10);if(df&&d<df)return false;if(dt&&d>dt)return false;return true;})||[];
  return ce(Screen,{title:"📊 歷史評估記錄",onBack,maxW:600},
    isFreeIndividual&&hiddenCount>0&&ce(IBox,{c:"amber",style:{marginBottom:14}},ce("strong",null,"⭐ 免費版僅顯示最近3個月記錄"),ce("br"),"您還有 "+hiddenCount+" 筆較早的評估記錄已保留，升級訂閱版可查閱完整歷史。",ce("div",{style:{marginTop:6}},ce(Btn,{sz:"sm",v:"amber",onClick:function(){onNav&&onNav("subscribe");}},"⭐ 升級訂閱版"))),
    ce(Card,{style:{marginBottom:14,padding:"12px 16px"}},
      ce("div",{style:{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}},
        ce("input",{type:"date",value:df,onChange:e=>setDf(e.target.value),style:{padding:"6px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:13}}),
        ce("span",{style:{color:T.muted}},"～"),
        ce("input",{type:"date",value:dt,onChange:e=>setDt(e.target.value),style:{padding:"6px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:13}}),
        ce(Btn,{sz:"sm",v:"ghost",onClick:()=>{setDf("");setDt("");}},"清除"),
        canDl&&flt.length>0&&ce(Btn,{sz:"sm",v:"navy",onClick:()=>{const rows=flt.map(r=>[r.ts&&r.ts.slice(0,10),r.sScore+"/28",r.sL&&r.sL.label,r.pScore+"/50",r.pL&&r.pL.label,r.wScore+"/30"].join("\t")).join("\n");const blob=new Blob(["日期\t睡眠分數\t睡眠燈號\t疼痛分數\t疼痛燈號\t工作影響\n"+rows],{type:"text/plain"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="評估記錄_"+new Date().toLocaleDateString("zh-TW").replace(/\//g,"-")+".txt";a.click();}},"⬇ 下載記錄"))),
    !flt.length?ce(Card,{style:{textAlign:"center",padding:40}},ce("div",{style:{fontSize:40,marginBottom:12}},"📋"),ce("p",{style:{color:T.muted}},"尚無評估記錄")):
    ce("div",{style:{display:"grid",gap:10}},flt.map(function(r){const sl=LX[r.sL&&r.sL.key]||LX.green;const pl=LX[r.pL&&r.pL.key]||LX.green;return ce(Card,{key:r.id,onClick:()=>onView(r),style:{cursor:"pointer"}},ce("div",{style:{display:"flex",justifyContent:"space-between",marginBottom:8}},ce("span",{style:{fontSize:12,color:T.muted}},r.ts&&r.ts.slice(0,10)),ce("span",{style:{fontSize:11,color:T.faint}},"#"+r.id.slice(0,6).toUpperCase())),ce("div",{style:{display:"flex",gap:8}},[{bg:sl.bg,c:sl.c,l:"睡眠",s:r.sScore,m:28},{bg:pl.bg,c:pl.c,l:"疼痛",s:r.pScore,m:50},{bg:T.tealBg,c:T.teal,l:"工作",s:r.wScore,m:30}].map(x=>ce("div",{key:x.l,style:{flex:1,background:x.bg,borderRadius:8,padding:"6px 10px",textAlign:"center"}},ce("div",{style:{fontSize:10,color:T.muted}},x.l),ce("div",{style:{fontSize:16,fontWeight:800,color:x.c}},x.s,ce("span",{style:{fontSize:9}},"/"+x.m))))));})));
}


function HomeDashboard({session,pts,onNav,reports,mySub}){
  const role=session&&session.role;
  const last=reports&&reports[0];
  const slx=last&&LX[last.sL&&last.sL.key];const plx=last&&LX[last.pL&&last.pL.key];
  // ⑦ Admin does NOT have assess perm
  const isAdmin=isMainAdmin(role);
  const rptCount=(reports&&reports.length)||0;
  // my[] 依屬性分組：A健康評估類 → B紀錄追蹤類 → C資源福利類
  var myA=[
    {icon:"📋",label:"開始評估",nav:"assess",show:canDo(role,"assess"),acc:T.teal,grp:"A"},
    {icon:"📅",label:"自主健管預約排程",nav:"appt",show:canDo(role,"appt")||canDo(role,"assess"),acc:T.sage,grp:"A"},
    {icon:"✅",label:"行動打卡",nav:"checkin",show:canDo(role,"checkin"),acc:T.amber,grp:"A"},
    {icon:"🩸",label:"三高/BMI管理",nav:"th",show:canDo(role,"th")||role==="individual",acc:T.coral,grp:"A"},
    {icon:"💚",label:"身心健康",nav:"mental",show:canDo(role,"assess")||role==="individual",acc:T.sage,grp:"A"},
    {icon:"⚡",label:"過勞風險自評",nav:"overwork",show:canDo(role,"assess")||role==="individual",acc:T.coral,grp:"A"},
    {icon:"⚠️",label:"職安法合規問卷",nav:"osh_hub",show:canDo(role,"assess")&&role!=="individual",acc:T.navy,grp:"A"},
  ];
  var myB=[
    {icon:"📊",label:"歷史記錄",nav:"history",show:canDo(role,"history"),acc:"#4b5563",grp:"B"},
    {icon:"📄",label:"我的健康報告",nav:"personal_report",show:canDo(role,"history"),acc:T.warm,grp:"B"},
    {icon:"🌙",label:"睡眠日記",nav:"sleep_diary",show:canDo(role,"assess")||role==="individual",acc:"#4338ca",grp:"B"},
    {icon:"📓",label:"疼痛日誌",nav:"pain_diary",show:canDo(role,"assess")||role==="individual",acc:T.coral,grp:"B"},
    {icon:"📈",label:"我的改善曲線",nav:"curve888",show:(canDo(role,"history")||role==="individual")&&rptCount>=1,acc:T.teal,grp:"B"},
  ];
  var myC=[
    {icon:"⭐",label:"積分中心",nav:"points",show:canDo(role,"points"),acc:T.plum,grp:"C"},
    {icon:"💚",label:"健康關懷資源",nav:"eap",show:canDo(role,"eap_personal"),acc:"#15803d",grp:"C"},
    {icon:"⭐",label:"升級訂閱版",nav:"subscribe",show:role==="individual"&&!session.orgCode,acc:T.amber,grp:"C"},
    {icon:"🗺",label:"體驗場域",nav:"venue",show:role==="individual",acc:T.navy,grp:"C"},
    {icon:"🌿",label:"關於REIBI",nav:"about_reibi",show:true,acc:T.teal,grp:"C"},
    {icon:"📝",label:"體驗回饋",nav:"feedback",show:(role==="individual"&&rptCount>=3)||(role==="member"&&rptCount>=4)||(role==="dept_head"&&rptCount>=4),acc:T.plum,grp:"C"},
  ];
  var myAf=myA.filter(function(t){return t.show;});
  var myBf=myB.filter(function(t){return t.show;});
  var myCf=myC.filter(function(t){return t.show;});
  const my=myAf.concat(myBf).concat(myCf);
  // adm[] 依角色身份分組(v10.3.20 六群組重組)：健康數據分析→職安法規合規→ESG永續揭露→員工服務→財務帳務→IT系統設定
  var admHealth=[
    {icon:"📈",label:"KPI總覽",nav:"kpi",show:canDo(role,"kpi"),acc:T.teal},
    {icon:"🎯",label:"OKR報告",nav:"rpt_okr",show:canDo(role,"okr_view"),acc:T.teal},
    {icon:"📊",label:"年度統計報表",nav:"annual",show:canDo(role,"annual_stats"),acc:T.teal},
    {icon:"📊",label:"部門健康趨勢",nav:"dept_trend",show:canDo(role,"kpi")&&isAdmRole(role),acc:T.teal},
    {icon:"📋",label:"888計畫",nav:"plan888",show:canDo(role,"plan888")&&isAdmRole(role),acc:T.teal},
    {icon:"📅",label:"888週介入時間軸",nav:"plan888_timeline",show:canDo(role,"plan888")&&isAdmRole(role),acc:T.teal},
    {icon:"📝",label:"回饋彙整報告",nav:"feedback_report",show:isAdmRole(role)||role==="admin_reibi",acc:T.teal},
  ];
  var admOhs=[
    {icon:"⚠",label:"高風險分析",nav:"rpt_hr",show:canDo(role,"highrisk"),acc:T.coral},
    {icon:"⚡",label:"過負荷彙整管理",nav:"overwork_hr",show:canDo(role,"highrisk")||canDo(role,"eap_mgmt"),acc:T.coral},
    {icon:"\ud83d\udccb",label:"預防計畫書",nav:"ohs_plan",show:canDo(role,"highrisk"),acc:T.coral},
    {icon:"🩺",label:"過負荷面談記錄填報",nav:"oh_interview",show:canDo(role,"ow_interview"),acc:T.coral},
    {icon:"📊",label:"職安問卷填答活躍度",nav:"osh_activity",show:canDo(role,"highrisk"),acc:T.coral},
  ];
  var admEsg=[
    {icon:"🌱",label:"ESG報告",nav:"rpt_esg",show:canDo(role,"esg"),acc:T.sage},
    {icon:"📋",label:"GRI 403-6揭露",nav:"gri_report",show:canDo(role,"gri"),acc:T.sage},
    {icon:"💰",label:"ROI財務效益",nav:"rpt_roi",show:canDo(role,"roi"),acc:T.sage},
  ];
  var admEmp=[
    {icon:"📅",label:"自主健管排程",nav:"appt",show:canDo(role,"appt_view")||canDo(role,"appt_mgmt"),acc:T.plum},
    {icon:"🤝",label:"EAP工具箱",nav:"eap",show:canDo(role,"eap_mgmt"),acc:T.plum},
    {icon:"🛎",label:"服務申請",nav:"service",show:canDo(role,"service"),acc:T.plum},
    {icon:"👤",label:"人員/權限變更申請",nav:"change_req",show:canDo(role,"admin")||canDo(role,"admin_hr"),acc:T.plum},
  ];
  var admFin=[
    {icon:"📋",label:"帳款管理",nav:"payable",show:canDo(role,"remit")||canDo(role,"admin"),acc:T.amber},
    {icon:"🧾",label:"匯款對帳申請",nav:"remit",show:canDo(role,"remit"),acc:T.amber},
    {icon:"💼",label:"方案與定價",nav:"pricing",show:isMainAdmin(role),acc:T.amber},
  ];
  var admIt=[
    {icon:"🏢",label:"部門管理",nav:"dept_mgmt",show:isMainAdmin(role),acc:T.navy},
    {icon:"👥",label:"帳號上限管控",nav:"acc_limit",show:isMainAdmin(role),acc:T.navy},
    {icon:"🏷",label:"行業分類設定",nav:"industry",show:isMainAdmin(role),acc:T.navy},
    {icon:"⚙",label:"ROI參數設定",nav:"params",show:canDo(role,"params_edit"),acc:T.navy},
    {icon:"🔐",label:"稽核日誌",nav:"audit",show:canDo(role,"audit"),acc:T.navy},
    {icon:"🔐",label:"安全架構文件",nav:"security_doc",show:canDo(role,"security"),acc:T.navy},
    {icon:"🔒",label:"隱私安全中心",nav:"privacy",show:isMainAdmin(role),acc:T.navy},
    {icon:"🗝",label:"PIN重設工單",nav:"pinreset",show:canDo(role,"audit")&&!isAdmRole(role)||false,acc:T.navy},
    {icon:"🩺",label:"臨場醫護人員設定",nav:"oh_setup",show:isMainAdmin(role),acc:T.navy},
  ];
  var admHealthF=admHealth.filter(function(t){return t.show;});
  var admOhsF=admOhs.filter(function(t){return t.show;});
  var admEsgF=admEsg.filter(function(t){return t.show;});
  var admEmpF=admEmp.filter(function(t){return t.show;});
  var admFinF=admFin.filter(function(t){return t.show;});
  var admItF=admIt.filter(function(t){return t.show;});
  const adm=admHealthF.concat(admOhsF).concat(admEsgF).concat(admEmpF).concat(admFinF).concat(admItF);
  return ce("div",{style:{maxWidth:680,margin:"0 auto",padding:"16px 16px 40px"}},
    isAdmin&&ce(IBox,{c:"navy",style:{marginBottom:16}},ce("strong",null,"🔑 "+session.name+" · 單位平台管理者"),ce("br"),"單位："+session.orgName+" ("+session.orgCode+") · 您可管理所有功能及參數設定，無需進行健康評估。"),
    !isAdmin&&!last&&role!=="admin_reibi"&&role!=="occupational_health"&&ce(IBox,{c:"teal",style:{marginBottom:14}},"👋 歡迎，"+session.name+"！請點選「開始評估」完成您的第一次健康評估。"),
    role==="admin_reibi"&&ce(IBox,{c:"navy",style:{marginBottom:14}},ce("strong",null,"🛡 REIBI 超管後台"),ce("br"),"您以 L5 麗媚超管身份登入。請直接使用下方管理功能。"),
    role==="occupational_health"&&ce(IBox,{c:"coral",style:{marginBottom:14}},ce("strong",null,"🩺 臨場醫護人員"),ce("br"),"您以臨場醫護人員身份登入，僅能填寫/查看過負荷面談記錄，全程去識別化，不會顯示KPI/ESG/財務等管理報告。"),
    (role==="individual"&&mySub&&effectiveSubStatus(mySub)==="active"&&daysUntil(mySub.expiresAt)!==null&&daysUntil(mySub.expiresAt)<=30)&&ce(IBox,{c:"amber",style:{marginBottom:14}},ce("strong",null,"⏳ 訂閱即將到期"),ce("br"),"您的「"+mySub.planLabel+"」訂閱將於"+daysUntil(mySub.expiresAt)+"天後("+new Date(mySub.expiresAt).toLocaleDateString("zh-TW")+")到期，到期後將自動降級為免費版(歷史資料會保留)。",onNav&&ce("button",{onClick:function(){onNav("subscribe");},style:{display:"block",marginTop:6,padding:"4px 12px",borderRadius:6,border:"1px solid "+T.amber,background:"#fff",color:T.amber,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}},"立即續訂")),
    (role==="individual"&&mySub&&effectiveSubStatus(mySub)==="expired")&&ce(IBox,{c:"red",style:{marginBottom:14}},ce("strong",null,"⚠ 訂閱已到期"),ce("br"),"已自動降級為免費版，所有歷史資料完整保留。",onNav&&ce("button",{onClick:function(){onNav("subscribe");},style:{display:"block",marginTop:6,padding:"4px 12px",borderRadius:6,border:"1px solid "+T.red,background:"#fff",color:T.red,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}},"重新申請訂閱")),
    last&&!isAdmin&&ce(Card,{style:{marginBottom:14,background:"linear-gradient(135deg,"+T.tealBg+",#fff)",border:"1px solid "+T.tealLight}},
      ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}},ce("div",{style:{fontSize:13,fontWeight:700,color:T.teal}},"上次評估"),ce("div",{style:{fontSize:11,color:T.muted}},new Date(last.ts).toLocaleDateString("zh-TW"))),
      ce("div",{style:{display:"flex",gap:10}},
        slx&&ce("div",{style:{flex:1,background:slx.bg,borderRadius:8,padding:"8px 12px",textAlign:"center",border:"1px solid "+slx.br}},ce("div",{style:{fontSize:10,color:T.muted,marginBottom:2}},"睡眠ISI"),ce("div",{style:{fontSize:18,fontWeight:800,color:slx.c}},last.sScore,ce("span",{style:{fontSize:10}},"/28")),ce("div",{style:{fontSize:10,color:slx.c,fontWeight:600}},slx.lbl)),
        plx&&ce("div",{style:{flex:1,background:plx.bg,borderRadius:8,padding:"8px 12px",textAlign:"center",border:"1px solid "+plx.br}},ce("div",{style:{fontSize:10,color:T.muted,marginBottom:2}},"疼痛BPI"),ce("div",{style:{fontSize:18,fontWeight:800,color:plx.c}},last.pScore,ce("span",{style:{fontSize:10}},"/50")),ce("div",{style:{fontSize:10,color:plx.c,fontWeight:600}},plx.lbl)),
        ce("div",{style:{flex:1,background:T.amberBg,borderRadius:8,padding:"8px 12px",textAlign:"center",border:"1px solid #fcd34d"}},ce("div",{style:{fontSize:10,color:T.muted,marginBottom:2}},"積分"),ce("div",{style:{fontSize:18,fontWeight:800,color:T.amber}},"⭐"+pts)))),
    (myAf.length>0||myBf.length>0||myCf.length>0)?ce("div",{style:{marginBottom:20}},
      myAf.length>0&&ce("div",{style:{marginBottom:14}},
        ce("div",{style:{fontSize:12,fontWeight:700,color:T.teal,marginBottom:8,paddingLeft:2,display:"flex",alignItems:"center",gap:6}},
          ce("span",{style:{width:3,height:14,background:T.teal,borderRadius:2,display:"inline-block"}}),
          "健康評估"),
        ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}},
          myAf.map(function(t){return ce(Card,{key:t.nav,onClick:function(){onNav(t.nav);},style:{padding:"14px 12px",textAlign:"center",borderTop:"3px solid "+t.acc,cursor:"pointer"}},ce("div",{style:{fontSize:24,marginBottom:6}},t.icon),ce("div",{style:{fontSize:12,fontWeight:700,color:T.text}},t.label));}))),
      myBf.length>0&&ce("div",{style:{marginBottom:14}},
        ce("div",{style:{fontSize:12,fontWeight:700,color:T.warm,marginBottom:8,paddingLeft:2,display:"flex",alignItems:"center",gap:6}},
          ce("span",{style:{width:3,height:14,background:T.warm,borderRadius:2,display:"inline-block"}}),
          "紀錄追蹤"),
        ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}},
          myBf.map(function(t){return ce(Card,{key:t.nav,onClick:function(){onNav(t.nav);},style:{padding:"14px 12px",textAlign:"center",borderTop:"3px solid "+t.acc,cursor:"pointer"}},ce("div",{style:{fontSize:24,marginBottom:6}},t.icon),ce("div",{style:{fontSize:12,fontWeight:700,color:T.text}},t.label));}))),
      myCf.length>0&&ce("div",{style:{marginBottom:0}},
        ce("div",{style:{fontSize:12,fontWeight:700,color:T.plum,marginBottom:8,paddingLeft:2,display:"flex",alignItems:"center",gap:6}},
          ce("span",{style:{width:3,height:14,background:T.plum,borderRadius:2,display:"inline-block"}}),
          "資源福利"),
        ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}},
          myCf.map(function(t){return ce(Card,{key:t.nav,onClick:function(){onNav(t.nav);},style:{padding:"14px 12px",textAlign:"center",borderTop:"3px solid "+t.acc,cursor:"pointer"}},ce("div",{style:{fontSize:24,marginBottom:6}},t.icon),ce("div",{style:{fontSize:12,fontWeight:700,color:T.text}},t.label));})))):null,
    (admHealthF.length>0||admOhsF.length>0||admEsgF.length>0||admEmpF.length>0||admFinF.length>0||admItF.length>0)?ce("div",null,
      ce("div",{style:{fontSize:13,fontWeight:700,color:T.muted,marginBottom:12}},isAdmin?"管理功能":"管理者功能"),
      admHealthF.length>0&&ce("div",{style:{marginBottom:14}},
        ce("div",{style:{fontSize:12,fontWeight:700,color:T.teal,marginBottom:8,paddingLeft:2,display:"flex",alignItems:"center",gap:6}},
          ce("span",{style:{width:3,height:14,background:T.teal,borderRadius:2,display:"inline-block"}}),
          "健康數據分析"),
        ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}},
          admHealthF.map(function(t){return ce(Card,{key:t.nav+t.label,onClick:function(){onNav(t.nav);},style:{padding:"14px 12px",textAlign:"center",cursor:"pointer",borderTop:"3px solid "+(t.acc||T.teal)}},ce("div",{style:{fontSize:22,marginBottom:4}},t.icon),ce("div",{style:{fontSize:11,fontWeight:700,color:T.text}},t.label));}))),
      admOhsF.length>0&&ce("div",{style:{marginBottom:14}},
        ce("div",{style:{fontSize:12,fontWeight:700,color:T.coral,marginBottom:8,paddingLeft:2,display:"flex",alignItems:"center",gap:6}},
          ce("span",{style:{width:3,height:14,background:T.coral,borderRadius:2,display:"inline-block"}}),
          "職安法規合規"),
        ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}},
          admOhsF.map(function(t){return ce(Card,{key:t.nav+t.label,onClick:function(){onNav(t.nav);},style:{padding:"14px 12px",textAlign:"center",cursor:"pointer",borderTop:"3px solid "+(t.acc||T.coral)}},ce("div",{style:{fontSize:22,marginBottom:4}},t.icon),ce("div",{style:{fontSize:11,fontWeight:700,color:T.text}},t.label));}))),
      admEsgF.length>0&&ce("div",{style:{marginBottom:14}},
        ce("div",{style:{fontSize:12,fontWeight:700,color:T.sage,marginBottom:8,paddingLeft:2,display:"flex",alignItems:"center",gap:6}},
          ce("span",{style:{width:3,height:14,background:T.sage,borderRadius:2,display:"inline-block"}}),
          "ESG永續揭露"),
        ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}},
          admEsgF.map(function(t){return ce(Card,{key:t.nav+t.label,onClick:function(){onNav(t.nav);},style:{padding:"14px 12px",textAlign:"center",cursor:"pointer",borderTop:"3px solid "+(t.acc||T.sage)}},ce("div",{style:{fontSize:22,marginBottom:4}},t.icon),ce("div",{style:{fontSize:11,fontWeight:700,color:T.text}},t.label));}))),
      admEmpF.length>0&&ce("div",{style:{marginBottom:14}},
        ce("div",{style:{fontSize:12,fontWeight:700,color:T.plum,marginBottom:8,paddingLeft:2,display:"flex",alignItems:"center",gap:6}},
          ce("span",{style:{width:3,height:14,background:T.plum,borderRadius:2,display:"inline-block"}}),
          "員工服務"),
        ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}},
          admEmpF.map(function(t){return ce(Card,{key:t.nav+t.label,onClick:function(){onNav(t.nav);},style:{padding:"14px 12px",textAlign:"center",cursor:"pointer",borderTop:"3px solid "+(t.acc||T.plum)}},ce("div",{style:{fontSize:22,marginBottom:4}},t.icon),ce("div",{style:{fontSize:11,fontWeight:700,color:T.text}},t.label));}))),
      admFinF.length>0&&ce("div",{style:{marginBottom:14}},
        ce("div",{style:{fontSize:12,fontWeight:700,color:T.amber,marginBottom:8,paddingLeft:2,display:"flex",alignItems:"center",gap:6}},
          ce("span",{style:{width:3,height:14,background:T.amber,borderRadius:2,display:"inline-block"}}),
          "財務帳務"),
        ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}},
          admFinF.map(function(t){return ce(Card,{key:t.nav+t.label,onClick:function(){onNav(t.nav);},style:{padding:"14px 12px",textAlign:"center",cursor:"pointer",borderTop:"3px solid "+(t.acc||T.amber)}},ce("div",{style:{fontSize:22,marginBottom:4}},t.icon),ce("div",{style:{fontSize:11,fontWeight:700,color:T.text}},t.label));}))),
      admItF.length>0&&ce("div",{style:{marginBottom:0}},
        ce("div",{style:{fontSize:12,fontWeight:700,color:T.navy,marginBottom:8,paddingLeft:2,display:"flex",alignItems:"center",gap:6}},
          ce("span",{style:{width:3,height:14,background:T.navy,borderRadius:2,display:"inline-block"}}),
          "IT系統設定"),
        ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}},
          admItF.map(function(t){return ce(Card,{key:t.nav+t.label,onClick:function(){onNav(t.nav);},style:{padding:"14px 12px",textAlign:"center",cursor:"pointer",borderTop:"3px solid "+(t.acc||T.navy)}},ce("div",{style:{fontSize:22,marginBottom:4}},t.icon),ce("div",{style:{fontSize:11,fontWeight:700,color:T.text}},t.label));})))):null
  );
}


function ApptScreen({session,onBack,prefillVenue,onPrefillUsed,isPro}){
  const code=(session&&(session.orgCode||session.uid))||"g";
  const canMgmt=canDo(session&&session.role,"appt_mgmt");
  const canView=canDo(session&&session.role,"appt_view")||canDo(session&&session.role,"appt_mgmt");
  // v10.3.24新增：個人訂閱版「優先預約自主健管體驗」排程優先權(第十一節功能差異表)，僅適用L1個人用戶，企業員工權益由企業合約決定不受此限制
  const isPriorityBooker=(session&&session.role)==="individual"&&!!isPro;
  const[appts,setAppts]=useState([]);
  const[svc,setSvc]=useState("");const[date,setDate]=useState("");const[time,setTime]=useState("");
  const[note,setNote]=useState(prefillVenue?"場域："+prefillVenue:"");
  const[filterDate,setFilterDate]=useState("");
  const[toast,setToast]=useState("");
  const[viewMode,setViewMode]=useState("list");
  useEffect(()=>{
    DB.appts(code).then(a=>{
      if(a)setAppts(a);
    });
    if(prefillVenue&&onPrefillUsed)onPrefillUsed();
  },[]);
  const scM={"待確認":{bg:T.amberBg,c:T.amber,br:"#fcd34d"},"已確認":{bg:T.sageBg,c:T.sage,br:"#86efac"},"已完成":{bg:"#f0f4fb",c:"#4b5563",br:"#cbd5e1"},"已取消":{bg:T.redBg,c:T.red,br:"#fca5a5"}};
  const svcs=["舒曼波自律神經調節體驗","LA200光能緩解疼痛體驗","生物資訊檢測","自律神經量測","綜合健康諮詢"];
  const FREE_EXP_SVCS=["舒曼波自律神經調節體驗","LA200光能緩解疼痛體驗"];
  const myName=(session&&session.name)||"用戶";
  const usedFreeExp=appts.some(function(a){
    return a.name===myName&&FREE_EXP_SVCS.indexOf(a.svc)>=0&&a.status!=="已取消";
  });
  const isFreeExpSvc=FREE_EXP_SVCS.indexOf(svc)>=0;
  const times=["09:00","10:00","11:00","13:30","14:30","15:30","16:30"];
  const doSub=async()=>{
    if(!svc||!date||!time)return;
    const na={id:"a"+Date.now(),svc,date,time,note,status:"待確認",name:(session&&session.name)||"用戶",ts:new Date().toISOString(),
      isFreeExp:isFreeExpSvc&&!usedFreeExp,isPriority:isPriorityBooker};
    const u=[na,...appts];setAppts(u);await DB.saveAppts(code,u);
    const idxRaw=await stor.g("l5_appt_index");
    const idxList=idxRaw?JSON.parse(idxRaw):[];
    idxList.push(code);
    await stor.s("l5_appt_index",JSON.stringify(Array.from(new Set(idxList))));
    setSvc("");setDate("");setTime("");setNote("");
    setToast("預約已送出・等候麗媚確認");AL.rec("APPT",svc,session&&session.role);
  };
  const doConfirm=async(id)=>{const u=appts.map(x=>x.id===id?{...x,status:"已確認"}:x);setAppts(u);await DB.saveAppts(code,u);setToast("預約已確認");};
  const doCancel=async(id,note)=>{const u=appts.map(x=>x.id===id?{...x,status:"已取消",note:note||x.note}:x);setAppts(u);await DB.saveAppts(code,u);setToast("預約已取消");};
  const filtered=filterDate?appts.filter(a=>a.date===filterDate):appts;
  // ⑩ Print/download for admin
  const doPrint=()=>{
    const rows=filtered.map(a=>[a.date,a.time,a.svc,a.name,a.status,a.note||""].join("\t")).join("\n");
    const hdr="日期\t時間\t項目\t預約者\t狀態\t備註";
    const blob=new Blob([hdr+"\n"+rows],{type:"text/plain"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download="自主健管預約排程_"+new Date().toLocaleDateString("zh-TW").replace(/\//g,"-")+".txt";a.click();
    setToast("排程已下載");
  };
  return ce(Screen,{title:"📅 自主健管預約排程",onBack,maxW:700,action:canMgmt&&ce("div",{style:{display:"flex",gap:8}},ce(Btn,{sz:"sm",v:"navy",onClick:doPrint},"⬇ 下載/列印排程"))},
    ce(Toast,{msg:toast,onDone:()=>setToast("")}),
    // ① 每日預約表 header
    ce(Card,{style:{marginBottom:14,padding:"12px 16px"}},
      ce("div",{style:{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}},
        ce("div",{style:{fontWeight:700,fontSize:13,color:T.text}},"📋 每日預約排程表"),
        ce("div",{style:{flex:1,minWidth:160}},
          ce("input",{type:"date",value:filterDate,onChange:e=>setFilterDate(e.target.value),style:{padding:"6px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,width:"100%"}})),
        filterDate&&ce(Btn,{sz:"sm",v:"ghost",onClick:()=>setFilterDate("")},"清除篩選"),
        ce("div",{style:{fontSize:12,color:T.muted}},"共 "+filtered.length+" 筆"))),
    // Booking form (non-admin users)
    !isMainAdmin(session&&session.role)&&!canView&&ce(Card,{style:{marginBottom:14}},
      ce(SecTitle,null,"新增預約申請"),
      prefillVenue&&ce(IBox,{c:"sage",style:{marginBottom:10}},"✅ 已從「體驗場域」帶入場域資訊：「"+prefillVenue+"」，已自動填入備註欄，請繼續選擇服務項目與時段。"),
      isFreeExpSvc&&usedFreeExp&&ce(IBox,{c:"amber",style:{marginBottom:10}},"⚠ 您已預約過舒曼波或LA200免費體驗(每人限一次)。本次預約將不再享有首次免費資格，送出後麗媚客服將另行報價或安排積分兌換。"),
      isPriorityBooker&&ce(IBox,{c:"sage",style:{marginBottom:10}},"⭐ 您享有訂閱版「優先預約」權益，送出後將優先排入確認排程。"),
      (session&&session.role)==="individual"&&!isPro&&ce(IBox,{c:"amber",style:{marginBottom:10}},"訂閱版可享優先預約自主健管體驗排程權益。"),
      ce("div",{style:{display:"grid",gap:10}},
        ce("select",{value:svc,onChange:e=>setSvc(e.target.value),style:{padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,background:T.card}},ce("option",{value:""},"選擇服務項目"),...svcs.map(s=>ce("option",{key:s},s))),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}},
          ce("input",{type:"date",value:date,onChange:e=>setDate(e.target.value),style:{padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13}}),
          ce("select",{value:time,onChange:e=>setTime(e.target.value),style:{padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,background:T.card}},ce("option",{value:""},"時段"),...times.map(t=>ce("option",{key:t},t)))),
        ce("input",{value:note,onChange:e=>setNote(e.target.value),placeholder:"備註(選填)",style:{padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13}})),
      ce(IBox,{c:"amber",style:{marginTop:10}},"⚠ 送出後狀態為「待確認」，麗媚確認後透過LINE通知您。確認後24h及1h前發送提醒。"),
      ce(Btn,{onClick:doSub,full:true,style:{marginTop:12},disabled:!svc||!date||!time},
        isFreeExpSvc&&usedFreeExp?"送出預約申請(非免費)":"送出自主健管預約申請")),
    // ① Schedule list — 項目/日期/時間/預約者/備註
    ce("div",{style:{display:"grid",gap:10}},
      filtered.length===0?ce(Card,{style:{textAlign:"center",padding:30,color:T.muted}},"目前無預約記錄"):
      filtered.slice().sort(function(a,b){
        // v10.3.24：優先預約排程優先權，待確認狀態中訂閱版優先權者排在同日期最前面
        var aPri=a.status==="待確認"&&a.isPriority?0:1;
        var bPri=b.status==="待確認"&&b.isPriority?0:1;
        if(aPri!==bPri)return aPri-bPri;
        return a.date.localeCompare(b.date);
      }).map(function(a){
        const sc=scM[a.status]||scM["待確認"];
        return ce(Card,{key:a.id,style:{padding:"12px 16px"}},
          ce("div",{style:{display:"grid",gridTemplateColumns:"auto 1fr auto",gap:12,alignItems:"start"}},
            ce("div",{style:{minWidth:80,textAlign:"center",background:T.bg,borderRadius:8,padding:"6px 10px"}},
              ce("div",{style:{fontSize:11,color:T.muted}},"日期"),
              ce("div",{style:{fontWeight:800,fontSize:13,color:T.text}},a.date),
              ce("div",{style:{fontWeight:700,fontSize:12,color:T.teal}},a.time)),
            ce("div",null,
              ce("div",{style:{display:"flex",alignItems:"center",gap:6,marginBottom:2}},
                ce("div",{style:{fontWeight:700,fontSize:13,color:T.text}},a.svc),
                a.isFreeExp&&ce(Tag,{c:"sage"},"🎁 免費體驗"),
                a.isPriority&&ce(Tag,{c:"amber"},"⭐ 優先預約")),
              ce("div",{style:{fontSize:12,color:T.muted}},"預約者："+a.name+(a.note?" · 備註："+a.note:""))),
            ce("span",{style:{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,background:sc.bg,color:sc.c,border:"1px solid "+sc.br,whiteSpace:"nowrap"}},a.status)),
          canMgmt&&a.status==="待確認"&&ce("div",{style:{display:"flex",gap:6,marginTop:8}},
            ce(Btn,{sz:"sm",v:"sage",onClick:()=>doConfirm(a.id)},"✅ 確認"),
            ce(Btn,{sz:"sm",v:"danger",onClick:()=>doCancel(a.id)},"取消")),
          a.status==="已確認"&&ce("div",{style:{fontSize:12,color:T.sage,marginTop:6}},"📢 服務前24h及1h將透過LINE提醒"));
      })));
}


function CheckinScreen({session,onBack,onPtsChange}){
  const uid=(session&&session.uid)||"g";const[ci,setCi]=useState({});const[pts,setPts]=useState(0);const[toast,setToast]=useState("");
  useEffect(()=>{DB.ci(uid).then(d=>setCi(d||{}));DB.pts(uid).then(p=>setPts(p||0));},[]);
  const today=new Date().toDateString();const done=Object.values(ci).filter(v=>v===today).length;
  const doCheck=async(item)=>{if(ci[item]===today){setToast("今日已打卡此項目");return;}if(ci[item]&&new Date(ci[item])>new Date(Date.now()-7*864e5)){setToast("同項目需間隔7天");return;}const nc={...ci,[item]:today};setCi(nc);await DB.saveCi(uid,nc);const np=await DB.addPts(uid,5);setPts(np);if(onPtsChange)onPtsChange(np);setToast("+5 積分！");AL.rec("CI",item,session&&session.role);};
  return ce(Screen,{title:"✅ 22項行動打卡",onBack,maxW:600},ce(Toast,{msg:toast,onDone:()=>setToast("")}),
    ce(IBox,{c:"sage",style:{marginBottom:14}},"透過記錄日常健康促進行動，養成持續關注自己健康的習慣。這些不是強制任務，只是幫助您留意平常已經在做、或可以嘗試的小事——每完成一項就代表您為自己的健康多投入了一點關注。"),
    ce(Card,{style:{background:T.amberBg,border:"1px solid #fcd34d",marginBottom:14}},ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},ce("div",null,ce("div",{style:{fontWeight:700,color:T.amber}},"今日打卡 "+done+"/22"),ce("div",{style:{fontSize:12,color:T.muted}},"每項5積分 · 日限1次 · 同項間隔7天")),ce("div",{style:{fontSize:20,fontWeight:800,color:T.amber}},"⭐"+pts))),CICATS.map(cat=>ce("div",{key:cat.cat,style:{marginBottom:16}},ce("div",{style:{fontSize:12,fontWeight:700,color:T.muted,marginBottom:8}},cat.cat),ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}},cat.items.map(item=>ce("button",{key:item,onClick:()=>doCheck(item),style:{padding:"10px 12px",borderRadius:10,border:"1px solid "+(ci[item]===today?"#86efac":T.border),background:ci[item]===today?T.sageBg:T.card,color:ci[item]===today?T.sage:T.muted,fontSize:12,fontWeight:ci[item]===today?700:400,cursor:"pointer",textAlign:"left",fontFamily:"inherit"}},(ci[item]===today?"✅ ":"")+item))))));
}


function ThreeHighsScreen({session,onBack,onPtsChange,orgRecs}){
  const uid=(session&&session.uid)||"g";const[data,setData]=useState({status:"none",bp_sys:"",bp_dia:"",glucose:"",ldl:"",weight:"",height:"",waist:""});const[saved,setSaved]=useState(false);const[toast,setToast]=useState("");
  const[deptSel,setDeptSel]=useState("");const[deptConsent,setDeptConsent]=useState(false);
  useEffect(()=>{DB.th(uid).then(d=>{
    if(d){setData(d);setDeptSel(d.dept||(session&&session.dept)||"");setDeptConsent(!!d.deptConsent);}
    else if(session&&session.dept){setDeptSel(session.dept);}
  });},[]);
  const bmi=data.weight&&data.height?Math.round(data.weight/Math.pow(data.height/100,2)*10)/10:"—";
  // v10.3.30改為讀取「部門管理」(DeptMgmtScreen)persist後的正式部門清單，取代原本從已提交org評估記錄動態蒐集profile.dept字串的做法(該做法是因DeptMgmtScreen當初未persist才採用的暫代方案，見PROJECT_INSTRUCTIONS第四十一節/第五十九節2026-07-27段落)
  const[deptOptions,setDeptOptions]=useState([]);
  useEffect(()=>{
    if(session&&session.orgCode){
      DB.getDeptStruct(session.orgCode).then(function(d){
        if(d&&d.length)setDeptOptions(d.map(function(x){return x.name;}).sort());
      });
    }
  },[session&&session.orgCode]);
  var aggOrgTH=async function(){
    if(!session||!session.orgCode)return;
    var orgCode=session.orgCode;
    var membKey="org_members_"+orgCode.replace(/\W/g,"_");
    var membRaw=await stor.g(membKey);
    if(!membRaw)return;
    var uids=JSON.parse(membRaw);
    var thList=await Promise.all(uids.map(function(u){return stor.g("th_"+u);}));
    var filled=thList.filter(Boolean).map(function(r){return JSON.parse(r);});
    // k≥5 匿名性門檻(企業整體層級)
    if(filled.length<5){
      await stor.s("org_th_"+orgCode.replace(/\W/g,"_"),JSON.stringify({n:filled.length,suppressed:true,updatedAt:new Date().toISOString()}));
    }else{
      var hasBP=filled.filter(function(d){return d.bp_sys&&d.bp_sys!=="";});
      var hasGlu=filled.filter(function(d){return d.glucose&&d.glucose!=="";});
      var hasLDL=filled.filter(function(d){return d.ldl&&d.ldl!=="";});
      var controlled={
        bp:hasBP.filter(function(d){return parseInt(d.bp_sys)<130&&parseInt(d.bp_dia)<80;}).length,
        glu:hasGlu.filter(function(d){return parseFloat(d.glucose)<100;}).length,
        ldl:hasLDL.filter(function(d){return parseFloat(d.ldl)<100;}).length
      };
      // v10.3.20新增：異常門檻(非達標門檻)，供OverworkHRScreen三高危險因子指標使用
      var bpHighRisk=hasBP.filter(function(d){return parseInt(d.bp_sys)>140||parseInt(d.bp_dia)>90;}).length;
      var gluHighRisk=hasGlu.filter(function(d){return parseFloat(d.glucose)>100;}).length;
      var thHighEither=filled.filter(function(d){
        var bpHigh=d.bp_sys&&d.bp_sys!==""&&(parseInt(d.bp_sys)>140||parseInt(d.bp_dia)>90);
        var gluHigh=d.glucose&&d.glucose!==""&&parseFloat(d.glucose)>100;
        return bpHigh||gluHigh;
      }).length;
      var thAnyFilled=filled.filter(function(d){return (d.bp_sys&&d.bp_sys!=="")||(d.glucose&&d.glucose!=="");}).length;
      var agg={
        n:filled.length,totalMembers:uids.length,suppressed:false,
        bpFilled:hasBP.length,bpControlled:controlled.bp,bpHighRisk:bpHighRisk,
        gluFilled:hasGlu.length,gluControlled:controlled.glu,gluHighRisk:gluHighRisk,
        ldlFilled:hasLDL.length,ldlControlled:controlled.ldl,
        thHighEither:thHighEither,thAnyFilled:thAnyFilled,
        coverageRate:Math.round(filled.length/uids.length*100),
        updatedAt:new Date().toISOString()
      };
      await stor.s("org_th_"+orgCode.replace(/\W/g,"_"),JSON.stringify(agg));
    }
    // v10.3.25新增：部門層級opt-in彙整(k≥5門檻，僅納入deptConsent===true的人)
    var consented=filled.filter(function(d){return d.deptConsent&&d.dept;});
    var byDeptRaw={};
    consented.forEach(function(d){
      if(!byDeptRaw[d.dept])byDeptRaw[d.dept]=[];
      byDeptRaw[d.dept].push(d);
    });
    var byDept={};
    Object.keys(byDeptRaw).forEach(function(dn){
      var list=byDeptRaw[dn];
      if(list.length<5){byDept[dn]={n:list.length,suppressed:true};return;}
      var dBP=list.filter(function(d){return d.bp_sys&&d.bp_sys!=="";});
      var dGlu=list.filter(function(d){return d.glucose&&d.glucose!=="";});
      var dLDL=list.filter(function(d){return d.ldl&&d.ldl!=="";});
      byDept[dn]={
        n:list.length,suppressed:false,
        bpFilled:dBP.length,bpControlled:dBP.filter(function(d){return parseInt(d.bp_sys)<130&&parseInt(d.bp_dia)<80;}).length,
        gluFilled:dGlu.length,gluControlled:dGlu.filter(function(d){return parseFloat(d.glucose)<100;}).length,
        ldlFilled:dLDL.length,ldlControlled:dLDL.filter(function(d){return parseFloat(d.ldl)<100;}).length,
        bpHighRisk:dBP.filter(function(d){return parseInt(d.bp_sys)>140||parseInt(d.bp_dia)>90;}).length,
        gluHighRisk:dGlu.filter(function(d){return parseFloat(d.glucose)>100;}).length
      };
    });
    await stor.s("org_th_dept_"+orgCode.replace(/\W/g,"_"),JSON.stringify({byDept:byDept,totalConsented:consented.length,updatedAt:new Date().toISOString()}));
  };

  const doSave=async()=>{
    const isFirst=!(await DB.th(uid));
    await DB.saveTh(uid,{...data,dept:deptConsent?deptSel:"",deptConsent:deptConsent,ts:new Date().toISOString()});
    const add=isFirst?20:10;
    const np=await DB.addPts(uid,add);
    if(onPtsChange)onPtsChange(np);
    setSaved(true);
    setToast("已儲存！+"+add+"積分");
    AL.rec("TH",data.status,session&&session.role);
    // 背景彙整三高到組織層級(k≥5匿名保護)
    aggOrgTH().catch(function(){});
  };
  return ce(Screen,{title:"🩸 三高/BMI 數值管理",onBack,maxW:560},ce(Toast,{msg:toast,onDone:()=>setToast("")}),ce(IBox,{c:"amber",style:{marginBottom:14}},"✨ 首次填入 +20積分 · 年度更新 +10積分 · 確診者月度更新 +5積分 · 數值為選填，僅個人可見，不上傳至單位統計。\n確診三高族群病情控制率將由系統單獨追蹤(去識別化)，為888計畫最有臨床意義的指標。"),ce(Card,{style:{marginBottom:14}},ce(SecTitle,null,"您目前的健康狀況"),[{v:"none",l:"目前無三高問題",desc:"年度健檢後提醒更新"},{v:"borderline",l:"三高前期/臨界狀況",desc:"每季提醒更新"},{v:"diagnosed",l:"已確診三高(治療中)",desc:"每月提醒更新"}].map(opt=>ce("label",{key:opt.v,style:{display:"flex",gap:10,cursor:"pointer",padding:"8px 0",borderBottom:"1px solid "+T.border,alignItems:"flex-start"}},ce("input",{type:"radio",name:"status",value:opt.v,checked:data.status===opt.v,onChange:()=>setData(d=>({...d,status:opt.v})),style:{marginTop:3,accentColor:T.teal}}),ce("div",null,ce("div",{style:{fontSize:13,fontWeight:600,color:T.text}},opt.l),ce("div",{style:{fontSize:11,color:T.muted}},opt.desc))))),ce(Card,{style:{marginBottom:14}},ce(SecTitle,null,"數值輸入(均選填)"),ce("div",{style:{display:"grid",gap:10}},ce("div",null,ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4}},"血壓 mmHg(達標：<130/80)"),ce("div",{style:{display:"flex",gap:8}},ce("input",{value:data.bp_sys,onChange:e=>setData(d=>({...d,bp_sys:e.target.value})),placeholder:"收縮壓",style:{flex:1,padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13}}),ce("span",{style:{lineHeight:"38px",color:T.muted}},"/"),ce("input",{value:data.bp_dia,onChange:e=>setData(d=>({...d,bp_dia:e.target.value})),placeholder:"舒張壓",style:{flex:1,padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13}}))),ce(Inp,{label:"空腹血糖 mg/dL(達標：<100)",value:data.glucose,onChange:e=>setData(d=>({...d,glucose:e.target.value})),placeholder:"填入數值"}),ce(Inp,{label:"LDL血脂 mg/dL(達標：<100)",value:data.ldl,onChange:e=>setData(d=>({...d,ldl:e.target.value})),placeholder:"填入數值"}),ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}},[["身高cm","height"],["體重kg","weight"],["腰圍cm(達標：男<90/女<80)","waist"]].map(([l,k])=>ce(Inp,{key:k,label:l,value:data[k],onChange:e=>setData(d=>({...d,[k]:e.target.value})),placeholder:"—"}))),data.weight&&data.height&&ce(IBox,{c:"teal"},"BMI："+bmi+"(目標：18.5-24)"+(data.waist?" · 腰圍："+data.waist+"cm(國健署代謝症候群標準：男性<90cm、女性<80cm)":"")))),ce(Card,{style:{marginBottom:14}},ce(SecTitle,null,"部門統計授權(選填)"),ce("p",{style:{fontSize:11,color:T.muted,margin:"0 0 8px"}},"若您同意，貴公司可看到「去識別化」的部門三高統計(需該部門至少5人同意才會顯示，絕不會單獨顯示您的個人數值)。不同意不影響任何個人權益，數值僅供AI建議與您個人查看。"),session&&session.orgCode?(deptOptions.length>0?ce("div",{style:{display:"grid",gap:8}},ce("label",{style:{display:"flex",gap:8,alignItems:"center",cursor:"pointer"}},ce("input",{type:"checkbox",checked:deptConsent,onChange:function(e){setDeptConsent(e.target.checked);},style:{accentColor:T.teal}}),ce("span",{style:{fontSize:12,color:T.text}},"同意將部門資訊用於去識別化統計")),deptConsent&&ce("div",null,ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4}},"您的部門"),ce("select",{value:deptSel,onChange:function(e){setDeptSel(e.target.value);},style:{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,background:T.card}},ce("option",{value:""},"請選擇部門"),deptOptions.map(function(dn){return ce("option",{key:dn,value:dn},dn);})))):ce("div",{style:{fontSize:11,color:T.muted}},"貴單位尚未建立部門資料，請聯繫單位平台管理者於「部門管理」建立部門架構後再回來選擇。")):ce("div",{style:{fontSize:11,color:T.muted}},"個人版無單位歸屬，此欄位不適用。")),ce(Card,{style:{background:T.amberBg,border:"1px solid #fcd34d",marginBottom:14}},
    ce("div",{style:{fontWeight:700,fontSize:13,color:T.amber,marginBottom:4}},"📅 年度健檢提醒"),
    ce("p",{style:{fontSize:12,color:T.muted,margin:0}},"年度健康檢查季即將來臨！完成健檢後，請記得回到平台更新您的三高數值，讓AI建議更貼近您的真實健康狀況。",ce("br"),"更新三高數值可獲得 ⭐20積分。三高數值為選填，僅個人可見，不上傳至單位統計。")),
  ce(IBox,{c:"amber",style:{marginBottom:10}},"📅 年度健檢季即將來臨！完成健檢後請更新三高數值，讓AI建議更貼近您的健康狀況。更新獲得⭐20積分。"),ce(Btn,{onClick:doSave,full:true},"儲存數值"),saved&&ce("p",{style:{fontSize:12,color:T.sage,textAlign:"center",marginTop:10}},"✅ 已儲存。AI建議將在下次評估時納入三高數值。"));
}


// ── FEEDBACK SCREEN ──────────────────────────────────────────────────────────
// 觸發規則：個人L1→第3次評估後；企業L2→第4次；L3主管→第4次(加3題)；L4→季度
// 儲存key：feedback:{uid}:{YYYY-Q}
function FeedbackScreen({session,onBack,reports,onPtsChange}){
  var role=(session&&session.role)||"individual";
  var uid=(session&&session.uid)||"anon";
  var isL3=role==="dept_head";
  var isL4=(role==="admin"||role==="admin_hr"||role==="admin_finance"||role==="admin_it");
  var isIndividual=(role==="individual");
  var rptCount=(reports&&reports.length)||0;
  var hasExp=reports&&reports.some(function(r){return r.checkins&&(r.checkins.schumann||r.checkins.la200||r.checkins.bioinfo||r.checkins.hrv);});

  var[step,setStep]=useState("loading");
  var[q1,setQ1]=useState(0);
  var[q2,setQ2]=useState(0);
  var[q3,setQ3]=useState("");
  var[q4,setQ4]=useState([]);
  var[q5,setQ5]=useState(0);
  var[q6,setQ6]=useState([]);
  var[q7s,setQ7s]=useState({sleep:0,pain:0,energy:0});
  var[q8,setQ8]=useState("");
  var[q9,setQ9]=useState("");
  var[q10,setQ10]=useState(0);
  var[q11,setQ11]=useState([]);
  var[q12,setQ12]=useState("");
  var[done,setDone]=useState(false);
  var[saving,setSaving]=useState(false);
  var[alreadyDone,setAlreadyDone]=useState(false);

  var now=new Date();
  var qKey="Q"+(Math.floor((now.getMonth())/3)+1);
  var fbKey="feedback:"+uid+":"+now.getFullYear()+"-"+qKey;

  useEffect(function(){
    stor.g(fbKey).then(function(v){
      if(v){setAlreadyDone(true);setStep("done_already");}
      else{setStep("survey");}
    });
  },[fbKey]);

  var q4Opts=["評估提醒功能","AI建議內容","積分獎勵制度","體驗預約便利性","報告下載功能","介面操作便利性"];
  var q6Opts=["舒曼波自律神經調節體驗","LA200光能疼痛緩解體驗","生物資訊檢測","自律神經量測"];
  var q11Opts=["員工參與率分析","部門健康趨勢報告","ESG/GRI自動報表","積分兌換多元化","體驗預約管理","與HRIS串接"];

  function toggleArr(arr,setArr,v){
    if(arr.includes(v)){setArr(arr.filter(function(x){return x!==v;}));}
    else{setArr(arr.concat([v]));}
  }

  var doSave=async function(){
    setSaving(true);
    var payload={
      uid:uid,role:role,ts:new Date().toISOString(),quarter:now.getFullYear()+"-"+qKey,
      q1:q1,q2:q2,q3:q3,q4:q4,q5:q5,
      q6:q6,q7:q7s,q8:q8,
      q9:q9,q10:q10,q11:q11,q12:q12,
      rptCount:rptCount,hasExp:hasExp
    };
    await stor.s(fbKey,payload);
    var fbListKey="feedback_list:"+(session&&session.orgCode||"personal");
    var existing=await stor.g(fbListKey)||[];
    existing.push({uid:uid,role:role,ts:payload.ts,quarter:payload.quarter,q1:q1,q5:q5,q10:q10});
    await stor.s(fbListKey,existing);
    var addPts=isL3?15:10;
    if(onPtsChange){
      var DB2=window._REIBI_DB;
      if(DB2&&DB2.addPts){var np=await DB2.addPts(uid,addPts);onPtsChange(np);}
    }
    setSaving(false);
    setDone(true);
    setStep("done");
  };

  var StarRow=function(props){
    var val=props.val;var setVal=props.setVal;var label=props.label;
    return ce("div",{style:{marginBottom:16}},
      ce("div",{style:{fontSize:13,fontWeight:600,color:T.text,marginBottom:8}},label),
      ce("div",{style:{display:"flex",gap:8}},
        [1,2,3,4,5].map(function(n){
          return ce("button",{key:n,onClick:function(){setVal(n);},style:{fontSize:28,background:"none",border:"none",cursor:"pointer",color:val>=n?"#f59e0b":"#d1d5db",padding:"2px 4px",lineHeight:1}},"★");
        })),
      val>0&&ce("div",{style:{fontSize:11,color:T.muted,marginTop:4}},[" ","很不滿意","不滿意","普通","滿意","非常滿意"][val]));
  };
  var ChkGroup=function(props){
    var opts=props.opts;var arr=props.arr;var setArr=props.setArr;
    return ce("div",{style:{display:"flex",flexWrap:"wrap",gap:8}},
      opts.map(function(o){
        var on=arr.includes(o);
        return ce("button",{key:o,onClick:function(){toggleArr(arr,setArr,o);},style:{padding:"6px 12px",borderRadius:20,border:"1px solid "+(on?T.teal:T.border),background:on?T.tealBg:"#fff",color:on?T.teal:T.muted,fontSize:12,cursor:"pointer",fontWeight:on?700:400}},o);
      }));
  };
  var NPSRow=function(props){
    var val=props.val;var setVal=props.setVal;
    return ce("div",{style:{marginBottom:16}},
      ce("div",{style:{fontSize:13,fontWeight:600,color:T.text,marginBottom:8}},"您願意推薦給身邊的朋友或同事嗎？(NPS，0=完全不願意，10=非常願意)"),
      ce("div",{style:{display:"flex",gap:4,flexWrap:"wrap"}},
        [0,1,2,3,4,5,6,7,8,9,10].map(function(n){
          var on=val===n;
          return ce("button",{key:n,onClick:function(){setVal(n);},style:{width:36,height:36,borderRadius:6,border:"1px solid "+(on?T.teal:T.border),background:on?T.teal:"#fff",color:on?"#fff":T.text,fontSize:13,fontWeight:on?700:400,cursor:"pointer"}},n);
        })),
      val>=0&&val<=6&&ce("div",{style:{fontSize:11,color:T.coral,marginTop:4}},"批評者(0-6)"),
      val>=7&&val<=8&&ce("div",{style:{fontSize:11,color:T.amber,marginTop:4}},"被動者(7-8)"),
      val>=9&&ce("div",{style:{fontSize:11,color:T.sage,marginTop:4}},"推薦者(9-10)"));
  };

  if(step==="loading"){
    return ce(Screen,{title:"📝 體驗回饋",onBack:onBack,maxW:540},
      ce(Card,{style:{textAlign:"center",padding:40}},ce("div",{style:{fontSize:32}},"⏳"),ce("p",{style:{color:T.muted}},"載入中...")));
  }
  if(step==="done_already"){
    return ce(Screen,{title:"📝 體驗回饋",onBack:onBack,maxW:540},
      ce(Card,{style:{textAlign:"center",padding:40}},
        ce("div",{style:{fontSize:48,marginBottom:12}},"✅"),
        ce("h3",{style:{color:T.teal,marginBottom:8}},"本季回饋已完成"),
        ce("p",{style:{color:T.muted,fontSize:13}},"感謝您本季的寶貴意見！下一季開放後將再次通知。"),
        ce(Btn,{onClick:onBack,full:true,style:{marginTop:16}},"返回")));
  }
  if(step==="done"){
    return ce(Screen,{title:"📝 體驗回饋",onBack:onBack,maxW:540},
      ce(Card,{style:{textAlign:"center",padding:40}},
        ce("div",{style:{fontSize:48,marginBottom:12}},"🎉"),
        ce("h3",{style:{color:T.teal,marginBottom:8}},"感謝您的寶貴回饋！"),
        ce("p",{style:{color:T.muted,fontSize:13}},"您已獲得 ⭐"+(isL3?"15":"10")+"積分獎勵，您的意見將幫助REIBI持續優化服務品質。"),
        ce(Btn,{onClick:onBack,full:true,style:{marginTop:16}},"返回首頁")));
  }

  var titleLabel=isL4?"📊 企業季度滿意度問卷":isL3?"📝 主管體驗回饋問卷(8+3題)":(hasExp?"📝 完整體驗回饋(8題)":"📝 平台體驗回饋(5題)");
  var subLabel=isIndividual?("第"+rptCount+"次評估後 · 個人回饋"):("第"+rptCount+"次評估後 · "+(isL3?"主管版":"員工版"));
  var ptsLabel=isL3?"+15積分":"+10積分";

  return ce(Screen,{title:titleLabel,onBack:onBack,maxW:560},
    ce(IBox,{c:"amber",style:{marginBottom:14}},subLabel+" · 完成後獲得 ⭐"+ptsLabel+" · 約3-5分鐘 · 結果去識別化彙整，不識別個人"),

    ce(Card,{style:{marginBottom:12}},
      ce(SecTitle,null,"A. 整體平台體驗"),
      ce(StarRow,{val:q1,setVal:setQ1,label:"Q1. 整體而言，您對 REIBI 平台的使用體驗滿意度？"}),
      ce(StarRow,{val:q2,setVal:setQ2,label:"Q2. AI 健康建議對您的實際幫助程度？"}),
      ce("div",{style:{marginBottom:16}},
        ce("div",{style:{fontSize:13,fontWeight:600,color:T.text,marginBottom:8}},"Q3. 使用平台後，您對自身健康狀態的掌握度是否提升？"),
        ["是，明顯提升","部分提升","無明顯變化","否"].map(function(o){
          return ce("label",{key:o,style:{display:"flex",alignItems:"center",gap:8,padding:"6px 0",cursor:"pointer",fontSize:13}},
            ce("input",{type:"radio",name:"q3",value:o,checked:q3===o,onChange:function(){setQ3(o);},style:{accentColor:T.teal}}),o);
        })),
      ce("div",{style:{marginBottom:16}},
        ce("div",{style:{fontSize:13,fontWeight:600,color:T.text,marginBottom:8}},"Q4. 您最希望改善或新增的功能？(可複選)"),
        ce(ChkGroup,{opts:q4Opts,arr:q4,setArr:setQ4})),
      ce(NPSRow,{val:q5,setVal:setQ5})),

    hasExp&&!isL4&&ce(Card,{style:{marginBottom:12}},
      ce(SecTitle,null,"B. REIBI 健促體驗回饋"),
      ce("div",{style:{marginBottom:16}},
        ce("div",{style:{fontSize:13,fontWeight:600,color:T.text,marginBottom:8}},"Q6. 您完成過哪些 REIBI 健促體驗？(可複選)"),
        ce(ChkGroup,{opts:q6Opts,arr:q6,setArr:setQ6})),
      ce("div",{style:{marginBottom:16}},
        ce("div",{style:{fontSize:13,fontWeight:600,color:T.text,marginBottom:8}},"Q7. 健促體驗後，您在以下面向的改善感受？"),
        [["sleep","睡眠品質"],["pain","疼痛緩解"],["energy","精神活力"]].map(function(pair){
          var k=pair[0];var lbl=pair[1];
          return ce("div",{key:k,style:{marginBottom:10}},
            ce("div",{style:{fontSize:12,color:T.muted,marginBottom:4}},lbl),
            ce("div",{style:{display:"flex",gap:6}},
              [1,2,3,4,5].map(function(n){
                var on=q7s[k]>=n;
                return ce("button",{key:n,onClick:function(){var nx={};nx[k]=n;setQ7s(Object.assign({},q7s,nx));},style:{fontSize:22,background:"none",border:"none",cursor:"pointer",color:on?"#f59e0b":"#d1d5db",padding:"1px 3px",lineHeight:1}},"★");
              })));
        })),
      ce("div",{style:{marginBottom:8}},
        ce("div",{style:{fontSize:13,fontWeight:600,color:T.text,marginBottom:6}},"Q8. 體驗的整體「值得感」？以及您是否願意繼續參與？"),
        ["非常值得，一定繼續","值得，會繼續","普通，考慮中","較不值得","不願意繼續"].map(function(o){
          return ce("label",{key:o,style:{display:"flex",alignItems:"center",gap:8,padding:"5px 0",cursor:"pointer",fontSize:13}},
            ce("input",{type:"radio",name:"q8",value:o,checked:q8===o,onChange:function(){setQ8(o);},style:{accentColor:T.teal}}),o);
        }))),

    isL3&&ce(Card,{style:{marginBottom:12}},
      ce(SecTitle,null,"C. 主管視角(部門管理)"),
      ce("div",{style:{marginBottom:16}},
        ce("div",{style:{fontSize:13,fontWeight:600,color:T.text,marginBottom:8}},"Q9. 您感受到部門整體員工參與健康評估的積極度？"),
        ["高(超過預期)","中(符合預期)","低(低於預期)"].map(function(o){
          return ce("label",{key:o,style:{display:"flex",alignItems:"center",gap:8,padding:"6px 0",cursor:"pointer",fontSize:13}},
            ce("input",{type:"radio",name:"q9",value:o,checked:q9===o,onChange:function(){setQ9(o);},style:{accentColor:T.teal}}),o);
        })),
      ce(StarRow,{val:q10,setVal:setQ10,label:"Q10. 健康數據報告對您進行部門管理與關懷的幫助度？"}),
      ce("div",{style:{marginBottom:8}},
        ce("div",{style:{fontSize:13,fontWeight:600,color:T.text,marginBottom:8}},"Q11. 您希望哪些部門管理功能更完善？(可複選)"),
        ce(ChkGroup,{opts:q11Opts,arr:q11,setArr:setQ11}))),

    isL4&&ce(Card,{style:{marginBottom:12}},
      ce(SecTitle,null,"B. 企業管理者視角"),
      ce("div",{style:{marginBottom:16}},
        ce("div",{style:{fontSize:13,fontWeight:600,color:T.text,marginBottom:8}},"Q6. 本季健促方案是否達到預期成效？"),
        ["是，明顯達標","部分達標","尚未顯現","低於預期"].map(function(o){
          return ce("label",{key:o,style:{display:"flex",alignItems:"center",gap:8,padding:"6px 0",cursor:"pointer",fontSize:13}},
            ce("input",{type:"radio",name:"q6l4",value:o,checked:q8===o,onChange:function(){setQ8(o);},style:{accentColor:T.teal}}),o);
        })),
      ce(StarRow,{val:q10,setVal:setQ10,label:"Q7. 員工健康數據報告的完整性與管理實用性？"}),
      ce("div",{style:{marginBottom:16}},
        ce("div",{style:{fontSize:13,fontWeight:600,color:T.text,marginBottom:8}},"Q8. 您最希望下季強化的功能方向？(可複選)"),
        ce(ChkGroup,{opts:q11Opts,arr:q11,setArr:setQ11}))),

    ce(Card,{style:{marginBottom:16}},
      ce(SecTitle,null,"最後一題"),
      ce("div",{style:{fontSize:13,fontWeight:600,color:T.text,marginBottom:8}},isL4?"Q8. 其他建議(開放填寫)":"Q5/Q8. 您對平台最想說的一句話或建議？"),
      ce("textarea",{value:q12,onChange:function(e){setQ12(e.target.value);},placeholder:"歡迎填寫任何建議、讚美或改善方向...",rows:3,style:{width:"100%",padding:"10px 12px",border:"1px solid "+T.border,borderRadius:8,fontSize:13,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"}})),

    ce(IBox,{c:"teal",style:{marginBottom:14}},"回饋結果將以去識別化方式彙整，不識別個人，僅用於平台優化與市場分析(已於首次設定同意)。"),
    ce(Btn,{onClick:doSave,full:true,v:"sage",disabled:saving||(q1===0&&q2===0)},saving?"儲存中...":"✅ 送出回饋並獲得積分"),
    ce("p",{style:{fontSize:11,color:T.faint,textAlign:"center",marginTop:8}},"Q1、Q2 為必填(1-5星)，其餘均為選填"));
}


// ── FEEDBACK REPORT SCREEN (L4/L5 查看彙整回饋) ──────────────────────────────
function FeedbackReportScreen({session,onBack}){
  var role=(session&&session.role)||"";
  var orgCode=(session&&session.orgCode)||"personal";
  var[list,setList]=useState([]);
  var[loaded,setLoaded]=useState(false);

  useEffect(function(){
    stor.g("feedback_list:"+orgCode).then(function(v){
      setList(v||[]);setLoaded(true);
    });
  },[orgCode]);

  var total=list.length;
  var avgQ1=total?Math.round(list.reduce(function(s,r){return s+(r.q1||0);},0)/total*10)/10:0;
  var avgQ5=total?Math.round(list.filter(function(r){return r.q5>=0;}).reduce(function(s,r){return s+(r.q5||0);},0)/Math.max(1,list.filter(function(r){return r.q5>=0;}).length)*10)/10:0;
  var nps9=list.filter(function(r){return r.q5>=9;}).length;
  var nps7=list.filter(function(r){return r.q5>=7&&r.q5<=8;}).length;
  var nps6=list.filter(function(r){return r.q5<=6&&r.q5>0;}).length;
  var npsScore=total?(Math.round((nps9-nps6)/total*100)):0;

  return ce(Screen,{title:"📊 回饋彙整報告",onBack:onBack,maxW:600},
    !loaded?ce(Card,{style:{textAlign:"center",padding:40}},ce("div",{style:{fontSize:32}},"⏳"),"載入中..."):
    total===0?ce(Card,{style:{textAlign:"center",padding:40}},
      ce("div",{style:{fontSize:40,marginBottom:12}},"📭"),
      ce("p",{style:{color:T.muted}},"尚無回饋資料，請等待員工/用戶完成問卷。")):
    ce("div",null,
      ce(IBox,{c:"teal",style:{marginBottom:14}},"以下為去識別化彙整統計(n="+total+")。個別回饋不可識別個人，符合k-匿名性原則。"),
      ce(Card,{style:{marginBottom:12}},
        ce(SecTitle,null,"核心指標"),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}},
          ce("div",{style:{textAlign:"center",background:T.tealBg,borderRadius:8,padding:"14px 8px"}},
            ce("div",{style:{fontSize:26,fontWeight:800,color:T.teal}},total),
            ce("div",{style:{fontSize:11,color:T.muted}},"有效回饋數")),
          ce("div",{style:{textAlign:"center",background:T.amberBg,borderRadius:8,padding:"14px 8px"}},
            ce("div",{style:{fontSize:26,fontWeight:800,color:T.amber}},"★"+avgQ1),
            ce("div",{style:{fontSize:11,color:T.muted}},"整體滿意度均值")),
          ce("div",{style:{textAlign:"center",background:T.sageBg,borderRadius:8,padding:"14px 8px"}},
            ce("div",{style:{fontSize:26,fontWeight:800,color:T.sage}},npsScore),
            ce("div",{style:{fontSize:11,color:T.muted}},"NPS 淨推薦值")))),
      ce(Card,{style:{marginBottom:12}},
        ce(SecTitle,null,"NPS 分佈(推薦意願)"),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}},
          ce("div",{style:{textAlign:"center",background:T.sageBg,borderRadius:8,padding:10}},
            ce("div",{style:{fontSize:22,fontWeight:800,color:T.sage}},nps9),
            ce("div",{style:{fontSize:11,color:T.muted}},"推薦者(9-10)")),
          ce("div",{style:{textAlign:"center",background:T.amberBg,borderRadius:8,padding:10}},
            ce("div",{style:{fontSize:22,fontWeight:800,color:T.amber}},nps7),
            ce("div",{style:{fontSize:11,color:T.muted}},"被動者(7-8)")),
          ce("div",{style:{textAlign:"center",background:T.redBg,borderRadius:8,padding:10}},
            ce("div",{style:{fontSize:22,fontWeight:800,color:T.red}},nps6),
            ce("div",{style:{fontSize:11,color:T.muted}},"批評者(0-6)")))),
      ce(Card,null,
        ce(SecTitle,null,"最近回饋紀錄(去識別化)"),
        list.slice(0,10).map(function(r,i){
          return ce("div",{key:i,style:{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid "+T.border,fontSize:12}},
            ce("span",{style:{color:T.muted}},r.quarter+" · "+r.role),
            ce("div",{style:{display:"flex",gap:12}},
              ce("span",{style:{color:T.amber}},"★"+r.q1),
              ce("span",{style:{color:T.teal}},"NPS:"+r.q5)));
        }))));
}


function PointsScreen({pts,onBack}){
  const earn=[{l:"完成週ISI+BPI評估",p:"10"},{l:"燈號改善(降一等級)",p:"20分"},{l:"燈號維持綠燈",p:"5/週"},{l:"連續12週完成評估",p:"60"},{l:"行動打卡(22項各5分)",p:"5/項"},{l:"首次填入三高數值",p:"20"},{l:"年度更新三高數值",p:"10"},
    {l:"確診者月度更新三高",p:"5分/次"},{l:"完成週ISI+BPI評估(AI個人報告生成)",p:"10"},
    {l:"完成舒曼波體驗",p:"15"},{l:"完成LA200體驗",p:"15"},{l:"參與生物資訊檢測",p:"20"},
    {l:"完成自律神經量測",p:"30"},{l:"單位OKR整體達標",p:"50"}];
  const rdm=[{l:"生物資訊檢測",p:100,pts:"100點"},{l:"自律神經量測",p:200,pts:"200點"},{l:"積分換取加次(健促體驗)",p:50,pts:"50點"},{l:"優先預約名額",p:30,pts:"30點"},{l:"企業自訂獎勵",p:0,pts:"彈性設定"}];
  return ce(Screen,{title:"⭐ 積分中心",onBack,maxW:600},ce(Card,{style:{background:T.amberBg,border:"1px solid #fcd34d",marginBottom:14,textAlign:"center"}},ce("div",{style:{fontSize:36,fontWeight:800,color:T.amber}},"⭐ "+pts),ce("div",{style:{fontSize:13,color:T.muted}},"目前積分 · 有效期 2 年")),ce(Card,{style:{marginBottom:14}},ce(SecTitle,null,"積分獲取方式"),earn.map(it=>ce("div",{key:it.l,style:{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid "+T.border,fontSize:13}},ce("span",{style:{color:T.text}},it.l),ce("span",{style:{color:T.amber,fontWeight:700}},"+"+it.p)))),ce(Card,null,ce(SecTitle,null,"積分兌換"),rdm.map(it=>ce("div",{key:it.l,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid "+T.border}},ce("span",{style:{fontSize:13,color:T.text}},it.l),ce("div",{style:{display:"flex",alignItems:"center",gap:8}},ce("span",{style:{fontSize:13,color:T.amber,fontWeight:700}},it.pts||it.p+"點"),ce(Btn,{sz:"sm",v:"amber",disabled:pts<it.p,onClick:()=>alert("請聯絡客服兌換：LINE @reibicare")},"兌換"))))));
}


function EAPScreen({session,onBack,onNav}){
  const adm=canDo(session&&session.role,"eap_mgmt");
  const cats=[
    {k:"A",label:"即時危機資源",color:T.red,items:[
      {l:"1925 安心專線(24小時)",link:"tel:1925",btn:"撥打"},
      {l:"119 緊急救護",link:"tel:119",btn:"撥打"},
      {l:"1800 自殺防治專線",link:"tel:1800",btn:"撥打"}
    ]},
    {k:"B",label:"外部醫療資源",color:T.coral,items:[
      {l:"睡眠醫學科",link:null,btn:null},
      {l:"精神科/身心科",link:null,btn:null},
      {l:"復健科",link:null,btn:null},
      {l:"疼痛科",link:null,btn:null},
      {l:"家庭醫學科",link:null,btn:null}
    ]},
    {k:"C",label:"政府資源",color:T.amber,items:[
      {l:"1955 勞工諮詢",link:"tel:1955",btn:"撥打"},
      {l:"社區心理衛生中心",link:"https://www.mohw.gov.tw/cp-88-48057-1.html",btn:"查詢"},
      {l:"國健署諮詢平台",link:"https://www.hpa.gov.tw",btn:"前往"}
    ]},
    {k:"D",label:"身旁支援資源",color:T.teal,items:[
      {l:"麗媚健康顧問諮詢",link:"https://line.me/R/ti/p/@reibicare",btn:"聯絡"},
      {l:"家庭醫師或診所",link:null,btn:null},
      {l:"信任的家人或朋友",link:null,btn:null}
    ]},
    {k:"E",label:"延伸資源",color:T.plum,items:[
      {l:"REIBI 自主健管預約",link:null,btn:"前往預約",nav:"appt"},
      {l:"衛福部心理健康專區",link:"https://www.mohw.gov.tw/cp-16-48057-1.html",btn:"前往"},
      {l:"台灣憂鬱症防治協會",link:"https://www.depression.org.tw",btn:"前往"}
    ]}
  ];
  return ce(Screen,{title:adm?"🤝 EAP管理者工具箱":"💚 健康關懷資源",onBack,maxW:600},adm&&ce(IBox,{c:"amber",style:{marginBottom:14}},"⚠ 提供EAP資源給員工時，請以去識別化方式發布公告，嚴禁強制要求。以員工自願為前提。"),!adm&&ce(IBox,{c:"sage",style:{marginBottom:14}},"💚 本頁資源完全保密，僅個人可見。所有聯繫均由您自主決定，平台不記錄您的查閱行為。"),cats.map(cat=>ce(Card,{key:cat.k,style:{marginBottom:10,borderLeft:"4px solid "+cat.color}},ce("div",{style:{fontWeight:700,fontSize:13,color:cat.color,marginBottom:8}},cat.k+"類 · "+cat.label),cat.items.map(function(it){
      var label=typeof it==="string"?it:it.l;
      var link=typeof it==="object"?it.link:null;
      var btn=typeof it==="object"?it.btn:null;
      return ce("div",{key:label,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid "+T.border}},
        ce("span",{style:{fontSize:13,color:T.text}},label),
        ce("div",{style:{display:"flex",gap:6}},
          (link||it.nav)&&ce("button",{onClick:function(){if(it.nav&&onNav)onNav(it.nav);else window.open(link,"_blank");},style:{padding:"4px 10px",borderRadius:6,border:"1px solid "+T.teal,background:T.tealBg,color:T.teal,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}},btn||"前往"),
          adm&&ce(Btn,{sz:"sm",v:"ghost",onClick:function(){alert("可複製後貼入公告系統");}},"複製")));
    }))));
}


function PayableScreen({session,onBack}){
  const code=(session&&session.orgCode)||"";
  const uid=(session&&session.uid)||"";
  const[orgData,setOrgData]=useState(null);
  const[claims,setClaims]=useState([]);
  const[invoices,setInvoices]=useState([]);
  const[toast,setToast]=useState("");

  useEffect(function(){
    if(!code)return;
    // 讀取L5建立的企業資料(從共用storage key)
    stor.g("l5_enterprises").then(function(d){
      if(!d)return;
      var list=JSON.parse(d);
      var ent=list.find(function(e){return e.orgCode===code;});
      setOrgData(ent||null);
    });
    // 讀取本企業的對帳申請記錄
    stor.g("remit_"+code.replace(/\W/g,"_")).then(function(d){if(d)setClaims(JSON.parse(d));});
    // 讀取REIBI對本企業開立的發票(從共用storage key)
    stor.g("l5_invoices").then(function(d){
      if(!d)return;
      var list=JSON.parse(d);
      setInvoices(list.filter(function(inv){return inv.orgCode===code;}));
    });
  },[code]);

  const PLAN_P={"基本":60,"成長":120,"專業":180,"旗艦":300};
  var buildPayable=function(){
    if(!orgData)return[];
    var ent=orgData;
    var aFee=ent.aLayerFee||(PLAN_P[ent.plan||"成長"]||0)*10000;
    var bFee=ent.bLayerFee||0;
    var cFee=ent.cLayerFee||0;
    var dFee=ent.dLayerFee||0;
    var cs=ent.contractStart||"";
    var y1=cs?new Date(new Date(cs).setFullYear(new Date(cs).getFullYear()+1)).toISOString().slice(0,10):"";
    var y2=cs?new Date(new Date(cs).setFullYear(new Date(cs).getFullYear()+2)).toISOString().slice(0,10):"";
    var rows=[
      {layer:"A",desc:"軟體平台年授權費(第1年)",amount:aFee,due:cs,status:ent.payA1||"待付款"},
      {layer:"A",desc:"軟體平台年授權費(第2年)",amount:aFee,due:y1,status:ent.payA2||"未到期"},
      {layer:"A",desc:"軟體平台年授權費(第3年)",amount:aFee,due:y2,status:ent.payA3||"未到期"},
    ];
    if(bFee>0){
      rows.push({layer:"B",desc:"設備費—訂金(30%)",amount:Math.round(bFee*0.3),due:cs,status:ent.payB1||"待付款"});
      rows.push({layer:"B",desc:"設備費—到貨款(40%)",amount:Math.round(bFee*0.4),due:"",status:ent.payB2||"待確認"});
      rows.push({layer:"B",desc:"設備費—完工款(30%)",amount:Math.round(bFee*0.3),due:"",status:ent.payB3||"待確認"});
    }
    if(cFee>0){
      rows.push({layer:"C",desc:"高管健促服務費(第1年，"+(ent.cLayerExecs||0)+"人)",amount:cFee,due:cs,status:ent.payC1||"待付款"});
      rows.push({layer:"C",desc:"高管健促服務費(第2年)",amount:cFee,due:y1,status:ent.payC2||"未到期"});
      rows.push({layer:"C",desc:"高管健促服務費(第3年)",amount:cFee,due:y2,status:ent.payC3||"未到期"});
    }
    if(dFee>0){
      rows.push({layer:"D",desc:"識能環境佈置費—訂金(50%)",amount:Math.round(dFee*0.5),due:cs,status:ent.payD1||"待付款"});
      rows.push({layer:"D",desc:"識能環境佈置費—驗收款(50%)",amount:Math.round(dFee*0.5),due:"",status:ent.payD2||"待確認"});
    }
    return rows.filter(function(r){return r.amount>0;});
  };

  var payable=buildPayable();
  var totalUnpaid=payable.filter(function(r){return r.status==="待付款"||r.status==="部分付款";}).reduce(function(a,r){return a+r.amount;},0);
  var totalPaid=payable.filter(function(r){return r.status==="已付款";}).reduce(function(a,r){return a+r.amount;},0);
  var LAYER_C={A:{bg:T.tealBg,c:T.teal},B:{bg:T.navyBg,c:T.navy},C:{bg:T.plumBg,c:T.plum},D:{bg:T.amberBg,c:T.amber}};
  var STATUS_C={"待付款":{c:T.red},"已付款":{c:T.sage},"未到期":{c:T.faint},"待確認":{c:T.muted},"部分付款":{c:T.amber}};

  return ce(Screen,{title:"📋 帳款管理",onBack:onBack,maxW:600},
    ce(Toast,{msg:toast,onDone:function(){setToast("");}}),
    ce(IBox,{c:"navy",style:{marginBottom:12}},"本頁顯示貴公司與REIBI麗媚之間，依合約各層(A/B/C/D)產生的應付帳款項目、付款狀態與對應發票資訊。付款請至「匯款對帳申請」上傳匯款單，REIBI財務人員確認後更新付款狀態。"),
    !orgData&&ce(Card,{style:{textAlign:"center",padding:32,color:T.muted}},"載入中或無企業合約資料..."),
    orgData&&ce("div",{style:{display:"grid",gap:12}},
      ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}},
        ce(Card,{style:{padding:"12px 14px"}},
          ce("div",{style:{fontSize:11,color:T.muted}},"待付款合計"),
          ce("div",{style:{fontSize:20,fontWeight:800,color:T.red}},"NT$"+(totalUnpaid/10000).toFixed(1)+"萬")),
        ce(Card,{style:{padding:"12px 14px"}},
          ce("div",{style:{fontSize:11,color:T.muted}},"已付款合計"),
          ce("div",{style:{fontSize:20,fontWeight:800,color:T.sage}},"NT$"+(totalPaid/10000).toFixed(1)+"萬"))),
      ce(Card,null,
        ce(SecTitle,null,"應付帳款明細(依合約各層)"),
        payable.length===0?ce("div",{style:{textAlign:"center",padding:20,color:T.muted}},"無合約帳款資料"):
        ce("div",{style:{display:"grid",gap:6}},
          payable.map(function(r,i){
            var lc=LAYER_C[r.layer]||LAYER_C.A;
            var sc=STATUS_C[r.status]||STATUS_C["未到期"];
            var isOverdue=r.due&&new Date(r.due)<new Date()&&r.status!=="已付款";
            return ce("div",{key:i,style:{display:"flex",justifyContent:"space-between",alignItems:"center",
              padding:"10px 12px",borderRadius:8,border:"1px solid "+(isOverdue?T.red:T.border),
              background:isOverdue?T.redBg:T.card}},
              ce("div",null,
                ce("div",{style:{display:"flex",alignItems:"center",gap:6,marginBottom:3}},
                  ce("span",{style:{padding:"1px 7px",borderRadius:10,fontSize:10,fontWeight:700,background:lc.bg,color:lc.c}},r.layer+"層"),
                  ce("span",{style:{fontSize:12,fontWeight:700,color:T.text}},r.desc)),
                ce("div",{style:{fontSize:11,color:T.muted}},r.due?"到期："+r.due+(isOverdue?" ⚠ 已逾期":""):"待里程碑確認")),
              ce("div",{style:{textAlign:"right"}},
                ce("div",{style:{fontSize:14,fontWeight:800,color:T.amber}},"NT$"+r.amount.toLocaleString()),
                ce("div",{style:{fontSize:11,fontWeight:700,color:sc.c}},r.status)));
          }))),
      invoices.length>0&&ce(Card,null,
        ce(SecTitle,null,"REIBI對本公司開立的發票記錄"),
        ce("div",{style:{display:"grid",gap:6}},
          invoices.map(function(inv){
            var sc={"已開票":{bg:T.amberBg,c:T.amber},"待收款":{bg:T.navyBg,c:T.navy},"已收款":{bg:T.sageBg,c:T.sage},"作廢":{bg:T.redBg,c:T.red}}[inv.status]||{bg:T.amberBg,c:T.amber};
            return ce("div",{key:inv.id,style:{display:"flex",justifyContent:"space-between",alignItems:"center",
              padding:"10px 12px",borderRadius:8,border:"1px solid "+T.border}},
              ce("div",null,
                ce("div",{style:{fontSize:12,fontWeight:700,color:T.text}},"發票 "+inv.invoiceNo),
                ce("div",{style:{fontSize:11,color:T.muted}},inv.invoiceDate+" · "+inv.layer+"層"+
                  (inv.items&&inv.items.length?" · "+inv.items.map(function(it){return it.desc;}).join("、"):"")+
                  (inv.notes?" · "+inv.notes:""))),
              ce("div",{style:{textAlign:"right"}},
                ce("div",{style:{fontSize:13,fontWeight:800,color:T.amber}},"NT$"+inv.total.toLocaleString()),
                ce("span",{style:{padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,background:sc.bg,color:sc.c}},inv.status)));
          }))),
      claims.length>0&&ce(Card,null,
        ce(SecTitle,null,"我的匯款對帳記錄"),
        claims.slice(0,5).map(function(c){
          var sc={"待審核":{c:T.amber},"已沖帳":{c:T.sage},"金額不符":{c:T.coral},"已拒絕":{c:T.red}}[c.status]||{c:T.muted};
          return ce("div",{key:c.id,style:{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid "+T.border}},
            ce("div",null,
              ce("div",{style:{fontSize:12,fontWeight:700,color:T.text}},"NT$"+(c.correctedAmount||0).toLocaleString()),
              ce("div",{style:{fontSize:11,color:T.muted}},c.correctedDate+" · "+(c.correctedName||""))),
            ce("span",{style:{fontSize:11,fontWeight:700,color:sc.c}},c.status));
        })),
      ce(Btn,{full:true,v:"sage",onClick:function(){if(onBack)onBack("remittance");}},
        "💳 上傳匯款單 / 提出對帳申請")));
}

function ChangeRequestScreen({session,onBack}){
  const code=(session&&session.orgCode)||"";
  const role=(session&&session.role)||"";
  const isAdmin=role==="admin"||role==="admin_hr"||role==="admin_finance"||role==="admin_it";
  const[type,setType]=useState("");
  const[subject,setSubject]=useState("");
  const[reason,setReason]=useState("");
  const[contactName,setContactName]=useState((session&&session.name)||"");
  const[contactPhone,setContactPhone]=useState("");
  const[otp,setOtp]=useState("");
  const[otpInput,setOtpInput]=useState("");
  const[otpSent,setOtpSent]=useState(false);
  const[otpVerified,setOtpVerified]=useState(false);
  const[requests,setRequests]=useState([]);
  const[toast,setToast]=useState("");
  const[step,setStep]=useState(1);

  const TYPES=["管理者PIN重設","成員群組密碼重設","主管群組密碼重設","新增/刪除平台管理者","變更單位負責人","其他人員/權限變更"];

  React.useEffect(function(){
    stor.g("change_req_"+code.replace(/\W/g,"_")).then(function(d){if(d)setRequests(JSON.parse(d));});
  },[code]);

  var genOTP=function(){
    var n=Math.floor(100000+Math.random()*900000).toString();
    setOtp(n);setOtpSent(true);setOtpInput("");setOtpVerified(false);
    setToast("驗證碼已模擬送出(正式上線將發送至聯絡Email)：【REIBI驗證碼】"+n+"，10分鐘內有效，請勿轉發。");
  };

  var verifyOTP=function(){
    if(otpInput===otp){setOtpVerified(true);setToast("驗證成功，請繼續填寫申請內容");setStep(2);}
    else setToast("驗證碼錯誤，請重新嘗試");
  };

  var doSubmit=async function(){
    if(!type||!subject||!reason){setToast("請填寫所有必填欄位");return;}
    var req={id:"CR_"+Date.now(),orgCode:code,orgName:(session&&session.orgName)||"",
      type,subject,reason,contactName,contactPhone,
      submittedAt:new Date().toISOString(),submittedBy:(session&&session.name)||"",
      status:"待審核",reviewNote:""};
    var list=[req,...requests];
    setRequests(list);
    await stor.s("change_req_"+code.replace(/\W/g,"_"),JSON.stringify(list));
    // 寫入L5可見的跨企業索引
    var idxRaw=await stor.g("l5_change_req_index");
    var idx=idxRaw?JSON.parse(idxRaw):[];
    idx.push(code+"_"+req.id);
    if(idx.length>200)idx=idx.slice(idx.length-200);
    await stor.s("l5_change_req_index",JSON.stringify(idx));
    setType("");setSubject("");setReason("");setOtpSent(false);setOtpVerified(false);setStep(1);
    setToast("申請已送出！REIBI客服將在2個工作日內聯絡確認，完成後更新付款時程狀態。如緊急請加 LINE：@reibicare");
    AL.rec("CHANGE_REQ",type,code);
  };

  var SC={"待審核":{c:T.amber,bg:T.amberBg},"已完成":{c:T.sage,bg:T.sageBg},"已拒絕":{c:T.red,bg:T.redBg}};

  return ce(Screen,{title:"👤 人員與權限變更申請",onBack:onBack,maxW:560},
    ce(Toast,{msg:toast,onDone:function(){setToast("");}}),
    !isAdmin&&ce(IBox,{c:"red",style:{marginBottom:12}},"⚠ 此功能僅限單位平台管理者(admin/HR/財務/IT管理者)提交。"),
    isAdmin&&ce("div",{style:{display:"grid",gap:12}},
      ce(IBox,{c:"navy"},"人員與權限變更申請流程：提交申請→OTP驗證(防止員工私自申請)→REIBI客服核對身份→協助完成變更。變更完成後REIBI將透過電話/LINE通知新認證資訊，請勿以Email明文傳送密碼。"),
      step===1&&ce(Card,null,
        ce(SecTitle,null,"Step 1：身份驗證(OTP)"),
        ce(IBox,{c:"amber",style:{marginBottom:10,fontSize:11}},"為防止員工私自申請重要變更，每次送出前需透過OTP驗證確認為授權人員。(正式上線：OTP發送至企業登記Email；目前為模擬模式，驗證碼會顯示在頁面提示中)"),
        ce("div",{style:{display:"grid",gap:8}},
          ce(Inp,{label:"申請人姓名",value:contactName,onChange:function(e){setContactName(e.target.value);;},placeholder:"本人姓名"}),
          ce(Inp,{label:"聯絡電話(供REIBI確認用)",value:contactPhone,onChange:function(e){setContactPhone(e.target.value);},placeholder:"0912-345-678"}),
          !otpSent?ce(Btn,{full:true,v:"sage",onClick:genOTP},"📱 發送驗證碼(OTP)"):
          ce("div",{style:{display:"grid",gap:8}},
            ce(Inp,{label:"輸入驗證碼(6位數)",value:otpInput,onChange:function(e){setOtpInput(e.target.value);},placeholder:"000000",type:"tel"}),
            ce("div",{style:{display:"flex",gap:6}},
              ce(Btn,{full:true,v:"sage",onClick:verifyOTP,disabled:!otpInput},"✅ 驗證"),
              ce(Btn,{v:"ghost",onClick:genOTP},"重新發送"))))),
      step===2&&otpVerified&&ce(Card,null,
        ce(SecTitle,null,"Step 2：填寫變更申請"),
        ce("div",{style:{display:"grid",gap:10}},
          ce(Select,{label:"變更類型 *",value:type,onChange:function(e){setType(e.target.value);}},
            ce("option",{value:""},"請選擇變更類型"),
            TYPES.map(function(t){return ce("option",{key:t,value:t},t);})),
          ce(Inp,{label:"申請主旨 * (如：張三離職，需重設管理者PIN)",value:subject,onChange:function(e){setSubject(e.target.value);},placeholder:"請具體說明變更內容"}),
          ce("div",null,
            ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4,fontWeight:600}},"變更原因 *"),
            ce("textarea",{value:reason,onChange:function(e){setReason(e.target.value);},
              rows:3,placeholder:"請說明變更原因(人事異動/遺失密碼/角色調整等)",
              style:{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,
                fontSize:12,fontFamily:"inherit",boxSizing:"border-box",resize:"vertical"}})),
          ce(IBox,{c:"teal",style:{fontSize:11}},"送出後REIBI客服將在2個工作日內致電確認身份，請確保聯絡電話 "+contactPhone+" 可接聽。如需緊急處理請直接加LINE @reibicare。"),
          ce(Btn,{full:true,v:"sage",sz:"lg",disabled:!type||!subject||!reason,onClick:doSubmit},"📋 送出申請"))),
      requests.length>0&&ce(Card,null,
        ce(SecTitle,null,"申請記錄"),
        ce("div",{style:{display:"grid",gap:6}},
          requests.slice(0,10).map(function(r){
            var sc=SC[r.status]||SC["待審核"];
            return ce("div",{key:r.id,style:{padding:"10px 0",borderBottom:"1px solid "+T.border}},
              ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
                ce("div",null,
                  ce("div",{style:{fontSize:12,fontWeight:700,color:T.text}},r.type),
                  ce("div",{style:{fontSize:11,color:T.muted}},r.submittedAt.slice(0,10)+" · "+r.submittedBy+" · "+r.subject)),
                ce("span",{style:{padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,background:sc.bg,color:sc.c}},r.status)),
              r.reviewNote&&ce("div",{style:{fontSize:11,color:T.muted,marginTop:4}},"REIBI回覆："+r.reviewNote));
          })))));
}

function RemittanceUploadScreen({session,onBack}){
  const code=(session&&session.orgCode)||"";
  const[claims,setClaims]=useState([]);
  const[toast,setToast]=useState("");
  const[imgData,setImgData]=useState(null);
  const[imgPreview,setImgPreview]=useState("");
  const[recognizing,setRecognizing]=useState(false);
  const[aiResult,setAiResult]=useState(null);
  const[manualName,setManualName]=useState("");
  const[manualAccount,setManualAccount]=useState("");
  const[manualDate,setManualDate]=useState("");
  const[manualAmount,setManualAmount]=useState("");
  const[matchedOrg,setMatchedOrg]=useState(null);
  const[note,setNote]=useState("");

  useEffect(()=>{DB.getRemitClaims(code).then(c=>setClaims(c||[]));},[]);

  const onFile=(e)=>{
    const f=e.target.files&&e.target.files[0];
    if(!f)return;
    const reader=new FileReader();
    reader.onload=()=>{setImgPreview(reader.result);setImgData(reader.result.split(",")[1]);};
    reader.readAsDataURL(f);
  };

  const doRecognize=async()=>{
    if(!imgData){setToast("請先選擇匯款單照片");return;}
    setRecognizing(true);
    try{
      const ctrl=new AbortController();setTimeout(()=>ctrl.abort(),20000);
      const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",signal:ctrl.signal,headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:500,messages:[{role:"user",content:[{type:"image",source:{type:"base64",media_type:"image/jpeg",data:imgData}},{type:"text",text:"這是一張銀行匯款單或轉帳收據照片。請僅以JSON格式回覆(不要有任何其他文字或Markdown)，格式為：{\"name\":\"匯款戶名\",\"account\":\"匯款帳號末5碼或完整帳號\",\"date\":\"YYYY-MM-DD格式的匯款日期\",\"amount\":數字格式的匯款金額(不含逗號)}。若任一欄位無法辨識請填空字串或0。"}]}]})});
      const d=await r.json();
      const b=d.content&&d.content.find(x=>x.type==="text");
      let parsed=null;
      if(b&&b.text){try{parsed=JSON.parse(b.text.replace(/```json|```/g,"").trim());}catch(e){parsed=null;}}
      if(!parsed){setToast("AI辨識失敗，請手動填寫或重新上傳清晰照片");setRecognizing(false);return;}
      setAiResult(parsed);
      setManualName(parsed.name||"");
      setManualAccount(parsed.account||"");
      setManualDate(parsed.date||"");
      setManualAmount(parsed.amount?String(parsed.amount):"");
      const ents=await stor.g("l5_enterprises");
      const list=ents?JSON.parse(ents):[];
      const found=list.find(e=>parsed.name&&(e.orgName&&e.orgName.includes(parsed.name)||parsed.name.includes(e.orgName||"###")));
      setMatchedOrg(found||null);
      setToast(found?"辨識完成，已自動比對到單位："+found.orgName:"辨識完成，但未能自動比對到單位，請確認戶名");
    }catch(e){setToast("辨識逾時或發生錯誤，請手動填寫");}
    setRecognizing(false);
  };

  const doSubmit=async()=>{
    if(!manualName.trim()||!manualAmount){setToast("請至少填入戶名與金額");return;}
    const claim={
      id:"RC_"+Date.now(),
      orgCode:matchedOrg?matchedOrg.orgCode:code,
      orgNameGuess:matchedOrg?matchedOrg.orgName:manualName,
      aiOriginal:aiResult||null,
      correctedName:manualName,correctedAccount:manualAccount,correctedDate:manualDate,correctedAmount:Number(manualAmount)||0,
      imgThumb:imgPreview?imgPreview.slice(0,120):"",
      imgFull:imgPreview||"",
      note,
      status:"待審核",
      submittedBy:(session&&session.name)||"",
      submittedRole:(session&&session.role)||"",
      submittedAt:new Date().toISOString(),
    };
    await DB.saveRemitClaim(code,claim);
    const idx=await stor.g("l5_remit_index");
    const idxList=idx?JSON.parse(idx):[];
    idxList.push(code+"_"+claim.id);
    await stor.s("l5_remit_index",JSON.stringify(idxList));
    setClaims(c=>[claim,...c]);
    setImgData(null);setImgPreview("");setAiResult(null);setManualName("");setManualAccount("");setManualDate("");setManualAmount("");setMatchedOrg(null);setNote("");
    setToast("對帳申請已送出，REIBI財務審核後將自動更新付款狀態");
    AL.rec("REMIT_CLAIM",claim.id,session&&session.role);
  };

  const scM={"待審核":{bg:T.amberBg,c:T.amber},"已沖帳":{bg:T.sageBg,c:T.sage},"金額不符":{bg:T.coralBg,c:T.coral},"已拒絕":{bg:T.redBg,c:T.red}};

  return ce(Screen,{title:"🧾 匯款對帳申請",onBack,maxW:640},
    ce(Toast,{msg:toast,onDone:()=>setToast("")}),
    ce(IBox,{c:"navy",style:{marginBottom:14}},"上傳匯款單照片，AI將自動辨識匯款戶名、帳號、日期與金額，並嘗試比對您的單位代碼。確認資訊後送出，REIBI財務人員審核確認後將自動更新付款時程狀態。"),
    ce(Card,{style:{marginBottom:14}},
      ce(SecTitle,null,"步驟1：上傳匯款單照片"),
      ce("input",{type:"file",accept:"image/*",onChange:onFile,style:{fontSize:12,marginBottom:10}}),
      imgPreview&&ce("img",{src:imgPreview,style:{maxWidth:"100%",borderRadius:8,border:"1px solid "+T.border,marginBottom:10}}),
      ce(Btn,{onClick:doRecognize,disabled:!imgData||recognizing,full:true},recognizing?"AI辨識中...":"🔍 開始AI辨識")),
    (aiResult||imgPreview)&&ce(Card,{style:{marginBottom:14}},
      ce(SecTitle,null,"步驟2：確認辨識結果(可手動修正)"),
      aiResult&&ce(IBox,{c:"teal",style:{marginBottom:10,fontSize:11}},"AI原始辨識值(不可修改，僅供對照)："+(aiResult.name||"—")+" / "+(aiResult.account||"—")+" / "+(aiResult.date||"—")+" / NT$"+(aiResult.amount||0)),
      matchedOrg&&ce(IBox,{c:"sage",style:{marginBottom:10}},"✅ 已比對到單位：「"+matchedOrg.orgName+"」("+matchedOrg.orgCode+")"),
      !matchedOrg&&aiResult&&ce(IBox,{c:"amber",style:{marginBottom:10}},"⚠ 未能自動比對到單位，請確認戶名是否與企業全名一致，REIBI財務人員審核時將協助確認"),
      ce("div",{style:{display:"grid",gap:8}},
        ce("input",{value:manualName,onChange:e=>setManualName(e.target.value),placeholder:"匯款戶名(修正值)",style:{padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13}}),
        ce("input",{value:manualAccount,onChange:e=>setManualAccount(e.target.value),placeholder:"匯款帳號(修正值)",style:{padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13}}),
        ce("input",{type:"date",value:manualDate,onChange:e=>setManualDate(e.target.value),style:{padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13}}),
        ce("input",{type:"number",value:manualAmount,onChange:e=>setManualAmount(e.target.value),placeholder:"匯款金額(修正值，新台幣)",style:{padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13}}),
        ce("textarea",{value:note,onChange:e=>setNote(e.target.value),placeholder:"備註(選填，例如：本次為A層+B層合併匯款)",rows:2,style:{padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,resize:"vertical",fontFamily:"inherit"}})),
      ce(Btn,{onClick:doSubmit,full:true,style:{marginTop:10}},"📤 送出對帳申請")),
    claims.length>0&&ce(Card,null,
      ce(SecTitle,null,"我的對帳申請記錄"),
      claims.map(function(c){const sc=scM[c.status]||scM["待審核"];
        const hasDiff=typeof c.diffAmount==="number"&&c.diffAmount!==0;
        return ce("div",{key:c.id,style:{padding:"10px 0",borderBottom:"1px solid "+T.border}},
        ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
          ce("div",null,
            ce("div",{style:{fontSize:13,fontWeight:700,color:T.text}},"NT$"+(c.correctedAmount||0).toLocaleString()),
            ce("div",{style:{fontSize:11,color:T.muted}},(c.correctedDate||"—")+" · "+(c.correctedName||"—"))),
          ce("span",{style:{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,background:sc.bg,color:sc.c}},c.status)),
        c.status==="金額不符"&&ce("div",{style:{marginTop:8,padding:"10px 12px",borderRadius:8,background:T.coralBg,border:"1px solid "+T.coral}},
          ce("div",{style:{display:"flex",justifyContent:"space-between",fontSize:11,color:T.text,marginBottom:4}},
            ce("span",null,"申報沖帳金額"),ce("span",{style:{fontWeight:700}},"NT$"+(c.correctedAmount||0).toLocaleString())),
          typeof c.totalDueAmount==="number"&&ce("div",{style:{display:"flex",justifyContent:"space-between",fontSize:11,color:T.text,marginBottom:4}},
            ce("span",null,"對應應付金額"),ce("span",{style:{fontWeight:700}},"NT$"+c.totalDueAmount.toLocaleString())),
          hasDiff&&ce("div",{style:{display:"flex",justifyContent:"space-between",fontSize:13,color:T.coral,fontWeight:800,paddingTop:4,borderTop:"1px dashed "+T.coral}},
            ce("span",null,"差額"),ce("span",null,(c.diffAmount>0?"短少 ":"溢付 ")+"NT$"+Math.abs(c.diffAmount).toLocaleString())),
          c.reviewNote&&ce("div",{style:{fontSize:11,color:T.text,marginTop:6}},"💬 財務備註："+c.reviewNote),
          (c.reviewedBy||c.reviewedAt)&&ce("div",{style:{fontSize:10,color:T.muted,marginTop:4}},
            "審核："+(c.reviewedBy||"—")+(c.reviewedAt?" · "+c.reviewedAt.slice(0,16).replace("T"," "):""))),
        c.status==="已拒絕"&&c.reviewNote&&ce("div",{style:{fontSize:11,color:T.red,marginTop:4}},"拒絕原因："+c.reviewNote),
        c.status==="已沖帳"&&ce("div",{style:{fontSize:11,color:T.sage,marginTop:4}},
          "✓ 已於"+(c.reviewedAt?c.reviewedAt.slice(0,10):"")+"完成沖帳"+(c.reviewedBy?"("+c.reviewedBy+")":"")));}))
  );
}


function ServiceScreen({session,onBack}){
  const code=(session&&(session.orgCode||session.uid))||"g";const[reqs,setReqs]=useState([]);const[type,setType]=useState("");const[detail,setDetail]=useState("");const[toast,setToast]=useState("");
  const types=["設備報修","教育訓練安排","量測服務預約","升方案申請","其他客製需求"];const scM={"待處理":{bg:T.amberBg,c:T.amber},"已排程":{bg:T.tealBg,c:T.teal},"進行中":{bg:T.sageBg,c:T.sage},"已完成":{bg:"#f1f5f9",c:"#475569"}};
  useEffect(()=>{DB.svcReqs(code).then(r=>setReqs(r||[]));},[]);
  const doSub=async()=>{if(!type)return;const req={id:"r"+Date.now(),type,detail,status:"待處理",ts:new Date().toISOString(),submitter:(session&&session.name)||"用戶"};await DB.saveSvcReq(code,req);setReqs(r=>[req,...r]);setType("");setDetail("");setToast("申請已送出！麗媚客服將於 2 個工作日內聯繫確認。緊急請加 LINE：@reibicare");AL.rec("SVC",type,session&&session.role);};
  return ce(Screen,{title:"🛎 服務申請中心",onBack,maxW:600},ce(Toast,{msg:toast,onDone:()=>setToast("")}),ce(Card,{style:{marginBottom:14}},ce(SecTitle,null,"新增申請"),ce("select",{value:type,onChange:e=>setType(e.target.value),style:{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,background:T.card,marginBottom:10}},ce("option",{value:""},"選擇申請類型"),...types.map(t=>ce("option",{key:t},t))),ce("textarea",{value:detail,onChange:e=>setDetail(e.target.value),placeholder:"詳細說明(選填)",rows:3,style:{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,resize:"vertical",fontFamily:"inherit",boxSizing:"border-box",marginBottom:10}}),ce(IBox,{c:"teal",style:{marginBottom:12}},"📋 送出後，麗媚客服將於 2 個工作日內聯繫確認。",ce("br"),"📞 緊急需求請直接聯繫 LINE 官方帳號：",ce("a",{href:"https://line.me/R/ti/p/@reibicare",target:"_blank",style:{color:T.teal,fontWeight:700}},"@reibicare")),ce(Btn,{onClick:doSub,full:true,disabled:!type},"送出申請")),reqs.length>0&&ce(Card,null,ce(SecTitle,null,"申請記錄"),reqs.map(function(r){const sc=scM[r.status]||scM["待處理"];return ce("div",{key:r.id,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid "+T.border}},ce("div",null,ce("div",{style:{fontSize:13,fontWeight:600,color:T.text}},r.type),ce("div",{style:{fontSize:11,color:T.muted}},r.ts&&r.ts.slice(0,10)+" · "+r.submitter)),ce("span",{style:{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,background:sc.bg,color:sc.c}},r.status));})));
}


function AccLimitScreen({session,onBack}){
  var plans=[
    {name:"基本型",limit:100,color:T.sage},
    {name:"成長型",limit:300,color:T.teal},
    {name:"專業型",limit:500,color:T.amber},
    {name:"旗艦型",limit:1000,color:T.plum},
  ];
  var orgCode=(session&&session.orgCode)||"demo";
  var plan=(session&&session.plan)||"基本型";
  var found=plans.find(function(p){return p.name===plan;})||plans[0];
  var limit=found.limit;
  var used=Math.floor(limit*0.72);
  var pct=Math.round(used/limit*100);
  var warn=pct>=90;
  return ce(Screen,{title:"👥 帳號上限管控",onBack:onBack,maxW:600},
    ce(Card,{style:{marginBottom:14}},
      ce(SecTitle,null,"目前方案使用狀況"),
      ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}},
        ce("span",{style:{fontSize:13,color:T.muted}},"方案"),
        ce("span",{style:{fontWeight:700,color:found.color,fontSize:13}},found.name)),
      ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}},
        ce("span",{style:{fontSize:13,color:T.muted}},"已啟用人數"),
        ce("span",{style:{fontWeight:700,fontSize:13,color:T.text}},used+" 人")),
      ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}},
        ce("span",{style:{fontSize:13,color:T.muted}},"方案上限"),
        ce("span",{style:{fontWeight:700,fontSize:13,color:T.text}},limit+" 人")),
      ce("div",{style:{background:T.border,borderRadius:20,height:10,overflow:"hidden",marginBottom:8}},
        ce("div",{style:{width:pct+"%",height:"100%",borderRadius:20,background:warn?T.amber:T.teal,transition:"width 0.4s"}})),
      ce("div",{style:{display:"flex",justifyContent:"space-between",fontSize:11,color:T.muted}},
        ce("span","使用率 "+pct+"%"),
        ce("span","剩餘 "+(limit-used)+" 人")),
      warn&&ce(IBox,{c:"amber",style:{marginTop:12}},"⚠ 使用人數已達方案上限的 "+pct+"%(警示閾值 90%)，如需增加人數請聯繫麗媚升級方案。")),
    ce(Card,{style:{marginBottom:14}},
      ce(SecTitle,null,"各方案帳號上限對照"),
      plans.map(function(p){
        var active=p.name===plan;
        return ce("div",{key:p.name,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",borderRadius:8,marginBottom:6,background:active?p.color+"18":"transparent",border:"1px solid "+(active?p.color:T.border)}},
          ce("div",null,
            ce("span",{style:{fontWeight:700,fontSize:13,color:active?p.color:T.text}},p.name),
            active&&ce("span",{style:{fontSize:10,background:p.color,color:"#fff",borderRadius:10,padding:"2px 8px",marginLeft:8}},"目前方案")),
          ce("span",{style:{fontWeight:700,fontSize:13,color:active?p.color:T.muted}},"≤ "+p.limit.toLocaleString()+" 人"));
      })),
    ce(IBox,{c:"teal"},"需要升級方案？請至「服務申請中心」→ 選擇「升方案申請」送出申請，或直接聯繫 LINE：",ce("a",{href:"https://line.me/R/ti/p/@reibicare",target:"_blank",style:{color:T.teal,fontWeight:700}},"@reibicare")));
}

function OHSetupScreen({session,onBack}){
  var orgCode=(session&&session.orgCode)||"demo";
  var[hasPin,setHasPin]=React.useState(false);
  var[rosterVisible,setRosterVisible]=React.useState(false);
  var[roster,setRoster]=React.useState([]);
  var[newPin,setNewPin]=React.useState("");
  var[confirmPin,setConfirmPin]=React.useState("");
  var[newEmp,setNewEmp]=React.useState({empId:"",dept:""});
  var[toast,setToast]=React.useState("");
  var[loading,setLoading]=React.useState(false);
  function loadAll(){
    DB.getPin(orgCode+"_OH").then(function(p){setHasPin(!!p);});
    DB.getOrgSetup(orgCode).then(function(s){setRosterVisible(!!(s&&s.ohRosterVisible));});
    stor.g("ow_roster_"+orgCode).then(function(d){if(d){try{setRoster(JSON.parse(d));}catch(e){setRoster([]);}}});
  }
  React.useEffect(function(){loadAll();},[]);
  async function doSetPin(){
    if(newPin.length<4){setToast("邀請碼至少4位");return;}
    if(newPin!==confirmPin){setToast("兩次輸入邀請碼不一致");return;}
    setLoading(true);
    var h=await hashPin(newPin);
    await DB.setPin(orgCode+"_OH",h);
    await clearLk(orgCode+"_OH");
    AL.rec("OH_PIN_SET","",session.name);
    setNewPin("");setConfirmPin("");setLoading(false);setHasPin(true);
    setToast("臨場醫護人員邀請碼已設定完成");
  }
  async function doClearPin(){
    await DB.clearPin(orgCode+"_OH");
    await clearLk(orgCode+"_OH");
    AL.rec("OH_PIN_CLEAR","",session.name);
    setHasPin(false);
    setToast("邀請碼已清除，臨場醫護人員暫時無法登入");
  }
  function toggleRoster(){
    var v=!rosterVisible;
    setRosterVisible(v);
    DB.getOrgSetup(orgCode).then(function(s){
      var merged=Object.assign({},s||{},{ohRosterVisible:v});
      DB.saveOrgSetup(orgCode,merged);
    });
    AL.rec("OH_ROSTER_TOGGLE",v?"on":"off",session.name);
  }
  function doAddRosterEntry(){
    if(!newEmp.empId.trim()){setToast("請填入員工代號");return;}
    var rec={empId:newEmp.empId.trim(),dept:newEmp.dept.trim()};
    var nl=[rec,...roster];
    setRoster(nl);
    stor.s("ow_roster_"+orgCode,JSON.stringify(nl));
    setNewEmp({empId:"",dept:""});
  }
  function doDeleteRosterEntry(empId){
    var nl=roster.filter(function(r){return r.empId!==empId;});
    setRoster(nl);
    stor.s("ow_roster_"+orgCode,JSON.stringify(nl));
  }
  return ce(Screen,{title:"🩺 臨場醫護人員設定",onBack:onBack,maxW:640},
    ce(Toast,{msg:toast,onDone:function(){setToast("");}}),
    ce(IBox,{c:"navy",style:{marginBottom:14}},"此角色僅能填寫/查看過負荷面談記錄(去識別化)，不會看到KPI/ESG/財務報表或個人ISI/BPI逐筆評估內容。登入邀請碼與單位平台管理者PIN完全獨立，符合職責分離(SoD)原則。"),
    ce(Card,{style:{marginBottom:14}},
      ce(SecTitle,null,"登入邀請碼"),
      ce("div",{style:{fontSize:12,color:T.muted,marginBottom:10}},"目前狀態："+(hasPin?"✅ 已設定(臨場醫護人員可使用此邀請碼登入)":"⚠ 尚未設定(臨場醫護人員暫時無法登入)")),
      ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}},
        ce("div",null,
          ce("div",{style:{fontSize:12,color:T.muted,marginBottom:4}},"新邀請碼(至少4位)"),
          ce("input",{type:"password",value:newPin,onChange:function(e){setNewPin(e.target.value);},style:{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box"}})),
        ce("div",null,
          ce("div",{style:{fontSize:12,color:T.muted,marginBottom:4}},"確認邀請碼"),
          ce("input",{type:"password",value:confirmPin,onChange:function(e){setConfirmPin(e.target.value);},style:{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box"}}))),
      ce("div",{style:{display:"flex",gap:10}},
        ce(Btn,{onClick:doSetPin,disabled:loading,v:"teal"},hasPin?"更新邀請碼":"設定邀請碼"),
        hasPin&&ce(Btn,{onClick:doClearPin,v:"coral"},"清除邀請碼(暫停登入)"))),
    ce(Card,{style:{marginBottom:14}},
      ce(SecTitle,null,"部門/員工代號清單檢視權限"),
      ce("div",{style:{fontSize:12,color:T.muted,marginBottom:10}},"開啟後，臨場醫護人員填寫面談記錄時可從清單挑選員工代號(仍為去識別化代號，非真實姓名)；關閉則僅能依HR提供的代號手動輸入。"),
      ce("div",{style:{display:"flex",alignItems:"center",gap:10}},
        ce("button",{onClick:toggleRoster,style:{padding:"7px 16px",borderRadius:20,border:"1px solid "+(rosterVisible?T.teal:T.border),background:rosterVisible?T.tealBg:T.card,color:rosterVisible?T.teal:T.muted,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit"}},rosterVisible?"✅ 已開放清單檢視":"⭕ 未開放(僅手動輸入)"))),
    ce(Card,null,
      ce(SecTitle,null,"員工代號清單管理("+roster.length+"筆)"),
      ce(IBox,{c:"amber",style:{marginBottom:10}},"僅可填入去識別化員工代號(如EMP-0042)及部門名稱，禁止填入真實姓名。"),
      ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:8,marginBottom:12}},
        ce("input",{type:"text",placeholder:"員工代號，如EMP-0042",value:newEmp.empId,onChange:function(e){var v=e.target.value;setNewEmp(function(p){return Object.assign({},p,{empId:v});});},style:{padding:"8px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box"}}),
        ce("input",{type:"text",placeholder:"部門(選填)",value:newEmp.dept,onChange:function(e){var v=e.target.value;setNewEmp(function(p){return Object.assign({},p,{dept:v});});},style:{padding:"8px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box"}}),
        ce(Btn,{onClick:doAddRosterEntry,sz:"sm"},"+ 新增")),
      roster.length===0?ce(IBox,{c:"teal"},"尚無清單項目，可於上方新增，或維持關閉狀態讓臨場醫護人員手動輸入。"):
      ce("div",{style:{display:"grid",gap:6}},
        roster.map(function(r){
          return ce("div",{key:r.empId,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 10px",background:T.bg,borderRadius:8}},
            ce("div",{style:{fontSize:12,color:T.text}},r.empId+(r.dept?" · "+r.dept:"")),
            ce("button",{onClick:function(){doDeleteRosterEntry(r.empId);},style:{border:"none",background:"none",color:T.coral,cursor:"pointer",fontSize:12,fontWeight:700}},"刪除"));
        }))));
}

function DeptMgmtScreen({session,onBack}){
  var PRESET_DEPTS=["人力資源部","資訊技術部","財務會計部","行政總務部","業務發展部","研發部","法務部","市場行銷部","客戶服務部","採購部","品質管理部","生產製造部","倉儲物流部","公共關係部","風險管理部","稽核部","策略規劃部","數位轉型部","永續發展部","健康促進部","設施管理部","保全部","餐飲服務部","培訓發展部","客戶關係部","醫療保健部","法規事務所","社會責任部","資安部","國際業務部"];
  // v10.3.34新增：依「上層部門」動態提供L3(組/課)建議清單，key需對齊PRESET_DEPTS的部門名稱
  var L3_SUGGESTIONS={
    "人力資源部":["薪酬福利組","招募甄選組","教育訓練組","員工關係組"],
    "資訊技術部":["系統開發組","資訊安全組","網路維運組","數位轉型組"],
    "財務會計部":["總帳出納組","稅務會計組","成本管理組","財務規劃組"],
    "行政總務部":["總務採購組","文書檔案組","環境安全組"],
    "業務發展部":["北區業務組","中區業務組","南區業務組","大客戶開發組"],
    "研發部":["產品研發組","技術研究組","品質驗證組"],
    "法務部":["契約審查組","智慧財產組","法遵風控組"],
    "市場行銷部":["品牌企劃組","數位行銷組","公關活動組"],
    "客戶服務部":["客服中心組","售後服務組","客訴處理組"],
    "採購部":["原料採購組","設備採購組","供應商管理組"],
    "品質管理部":["品保組","品管組","稽核驗證組"],
    "生產製造部":["製造一組","製造二組","製程改善組"],
    "倉儲物流部":["倉儲管理組","配送物流組","庫存管控組"],
    "公共關係部":["媒體聯繫組","企業形象組"],
    "風險管理部":["營運風險組","財務風險組","法遵風險組"],
    "稽核部":["內部稽核組","財務稽核組"],
    "策略規劃部":["企業策略組","專案管理組"],
    "數位轉型部":["系統整合組","流程自動化組","數據分析組"],
    "永續發展部":["環境永續組","社會責任組","公司治理組"],
    "健康促進部":["健康管理組","職場安全組","心理健康組"],
    "設施管理部":["廠務工程組","設備維護組"],
    "保全部":["駐點保全組","監控中心組"],
    "餐飲服務部":["內場廚務組","外場服務組"],
    "培訓發展部":["新人訓練組","專業培訓組","領導發展組"],
    "客戶關係部":["會員經營組","顧客體驗組"],
    "醫療保健部":["臨場健康組","醫護服務組"],
    "法規事務所":["法規遵循組","合規審查組"],
    "社會責任部":["志工服務組","公益專案組"],
    "資安部":["資安防護組","資安監控組","資安稽核組"],
    "國際業務部":["亞太業務組","歐美業務組","跨境合規組"],
  };
  // 自訂命名的L2部門(不在上方清單裡)，L3建議退回這組通用選項
  var L3_GENERIC=["規劃組","執行組","管理組","支援組"];
  // L4(班/小組)命名慣例較分歧，不特別對應每個L3，統一提供通用班/組建議
  var L4_GENERIC=["第一組","第二組","第三組","早班","中班","晚班","A組","B組"];
  var LEVEL_COLORS=[T.teal,T.amber,T.sage,T.plum];
  var LEVEL_LABELS=["一層","二層","三層","四層"];
  var NOTICE_PRESETS=[
    {title:"健康週評估提醒",body:"本週健康評估(ISI睡眠+BPI疼痛)已開放，請於本週內完成填寫，評估後可獲得積分獎勵，歡迎踴躍參與。"},
    {title:"舒曼波體驗活動",body:"本期舒曼波自律神經調節體驗開放預約，名額有限，先搶先贏。請至「自主健管預約排程」完成預約，體驗後可獲得積分。"},
    {title:"LA200光能疼痛緩解體驗",body:"LA200光能設備體驗開放預約，適合有慢性疼痛或肩頸酸痛困擾的同仁，請把握名額。"},
    {title:"888計畫本季啟動",body:"本季888健康促進計畫正式啟動，目標：8小時睡眠、8千步活動、8杯水補充。完成打卡即可累積積分，達標可獲額外獎勵。"},
    {title:"生物資訊檢測開放",body:"本梯次生物資訊檢測(100積分兌換)開放預約，限額優先處理。如需兌換請至「積分中心」完成兌換後再預約。"},
    {title:"自律神經量測體驗",body:"本期自律神經量測體驗(200積分兌換)開放預約，名額有限。量測結果將納入個人健康報告，建議有睡眠或壓力困擾之同仁優先報名。"},
    {title:"ESG健康促進成果公告",body:"本季企業健促成果已出爐！感謝全體同仁積極參與，整體健康改善率達標，相關數據已納入ESG年度報告，持續努力！"},
    {title:"職場健康日活動",body:"公司舉辦職場健康日活動，當日安排健康評估、體驗活動及健康講座，歡迎各部門同仁報名參加。"},
    {title:"積分兌換截止提醒",body:"本季積分兌換活動將於月底截止，請把握時間至「積分中心」查詢累計點數並完成兌換，逾期積分不補發。"},
    {title:"新功能上線通知",body:"REIBI平台已完成系統更新，新增功能請至各功能頁面查看。如有操作問題，歡迎聯繫單位平台管理者或麗媚客服 LINE @reibicare。"},
  ];
  var orgCode=(session&&session.orgCode)||"g";
  var[tab,setTab]=useState("dept");
  var[showManual,setShowManual]=useState(false);
  var[printMode,setPrintMode]=useState(false);
  var[tplOpen,setTplOpen]=useState(false);
  var[tplCopyMsg,setTplCopyMsg]=useState("");
  var[deptsLoaded,setDeptsLoaded]=useState(false);
  var[depts,setDepts]=useState([]);
  // v10.3.30新增：真正persist部門架構清單(依orgCode各自獨立)，取代原本每次重新整理就重置回9筆寫死demo資料的既有缺陷
  useEffect(function(){
    DB.getDeptStruct(orgCode).then(function(d){
      if(d)setDepts(d);
      setDeptsLoaded(true);
    });
  },[orgCode]);
  var[newName,setNewName]=useState("");
  var[newParent,setNewParent]=useState("");
  var[showPreset,setShowPreset]=useState(false);
  var[importMsg,setImportMsg]=useState("");
  var[notices,setNotices]=useState([
    {id:"n1",title:"健康週評估提醒",body:"本週健康評估(ISI睡眠+BPI疼痛)已開放，請於本週內完成填寫。",quota:0,reg:0,date:"2026-07-15",status:"開放"},
    {id:"n2",title:"舒曼波體驗活動",body:"本期舒曼波體驗開放預約，名額有限，先搶先贏。",quota:10,reg:7,date:"2026-07-20",status:"報名中"},
  ]);
  var[nTitle,setNTitle]=useState("");
  var[nBody,setNBody]=useState("");
  var[nQuota,setNQuota]=useState("");
  var[nDate,setNDate]=useState("");
  var[selPreset,setSelPreset]=useState("");
  var[showPresetNotice,setShowPresetNotice]=useState(false);
  var tabs=[{k:"dept",label:"部門架構"},{k:"manual",label:"操作說明"},{k:"import",label:"匯入/初始化"},{k:"notice",label:"公告中心"},{k:"signup",label:"報名管控"}];
  var getLevel=function(id){var d=depts.find(function(x){return x.id===id;});return d?d.level:0;};
  // v10.3.34新增：依目前選擇的「上層部門」動態決定快速選取清單(建L2用通用部門名稱/建L3用對應組課建議/建L4用通用班組建議)
  var parentDeptObj=newParent?depts.find(function(d){return d.id===newParent;}):null;
  var contextPresets=PRESET_DEPTS;
  var presetLabel="常見部門名稱(L2)";
  if(parentDeptObj){
    if(parentDeptObj.level===2){
      contextPresets=L3_SUGGESTIONS[parentDeptObj.name]||L3_GENERIC;
      presetLabel="「"+parentDeptObj.name+"」常見組/課建議";
    }else if(parentDeptObj.level===3){
      contextPresets=L4_GENERIC;
      presetLabel="「"+parentDeptObj.name+"」常見班/小組建議";
    }else{
      contextPresets=PRESET_DEPTS;
      presetLabel="常見部門名稱(L2)";
    }
  }
  var addDept=function(){
    if(!newName.trim())return;
    var parentLevel=newParent?getLevel(newParent):0;
    var lv=parentLevel+1;
    if(lv>4){alert("已達最大層數(4層)");return;}
    var d={id:"d"+Date.now(),name:newName.trim(),level:lv,parent:newParent,count:0};
    var na=[...depts,d];
    setDepts(na);
    DB.saveDeptStruct(orgCode,na);
    setNewName("");
  };
  var delDept=function(id){
    var hasChild=depts.some(function(d){return d.parent===id;});
    if(hasChild){alert("請先刪除該部門下的所有子部門");return;}
    var na=depts.filter(function(d){return d.id!==id;});
    setDepts(na);
    DB.saveDeptStruct(orgCode,na);
  };
  var renderTree=function(parentId,depth){
    var children=depts.filter(function(d){return d.parent===(parentId||"");});
    if(children.length===0)return null;
    return children.map(function(d){
      var lc=LEVEL_COLORS[(d.level-1)%4];
      var indent=(d.level-1)*18;
      return ce("div",{key:d.id},
        ce("div",{style:{display:"flex",alignItems:"center",padding:"7px 0",paddingLeft:indent,borderBottom:"1px solid "+T.border}},
          ce("span",{style:{width:8,height:8,borderRadius:"50%",background:lc,display:"inline-block",marginRight:8,flexShrink:0}}),
          ce("span",{style:{fontSize:13,fontWeight:d.level===1?700:500,color:T.text,flex:1}},d.name),
          ce("span",{style:{fontSize:10,color:lc,marginRight:8,background:lc+"18",padding:"2px 6px",borderRadius:8}},LEVEL_LABELS[d.level-1]),
          d.count>0&&ce("span",{style:{fontSize:11,color:T.muted,marginRight:8}},d.count+" 人"),
          ce("button",{onClick:function(){delDept(d.id);},style:{fontSize:11,color:T.red,background:"none",border:"none",cursor:"pointer",padding:"2px 6px"}},"刪")),
        renderTree(d.id,depth+1));
    });
  };
  var applyPreset=function(idx){
    if(idx==="")return;
    var p=NOTICE_PRESETS[parseInt(idx)];
    if(!p)return;
    setNTitle(p.title);
    setNBody(p.body);
    setSelPreset(idx);
  };
  var addNotice=function(){
    if(!nTitle.trim())return;
    var q=parseInt(nQuota)||0;
    var n={id:"n"+Date.now(),title:nTitle.trim(),body:nBody.trim(),quota:q,reg:0,date:nDate||"待定",status:q>0?"報名中":"開放"};
    setNotices(function(a){return[n,...a];});
    setNTitle("");setNBody("");setNQuota("");setNDate("");setSelPreset("");
  };
  var handleImport=function(e){
    var file=e.target.files&&e.target.files[0];
    if(!file)return;
    setImportMsg("已接收「"+file.name+"」("+Math.round(file.size/1024)+"KB)。正式匯入功能需後端支援，麗媚將協助初始化部門架構，請透過 LINE @reibicare 傳送 Excel 檔案，3 個工作日內完成設定。");
  };
  // v10.3.33修正：原本用Blob+createObjectURL+<a>觸發下載，在Claude.ai發布的artifact沙盒環境會被封鎖(「這項內容已遭到封鎖」)，
  // 改為顯示範本文字內容+複製到剪貼簿按鈕，避開下載動作，純文字複製在沙盒環境下可正常運作
  var TEMPLATE_CSV="部門名稱,層級(1-4),上層部門名稱,人數\n總公司,1,,\n人力資源部,2,總公司,8\n薪酬福利組,3,人力資源部,3";
  var copyTemplate=function(){
    if(navigator&&navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(TEMPLATE_CSV).then(function(){
        setTplCopyMsg("✅ 已複製到剪貼簿，請貼到Excel或記事本，另存新檔為.csv即可使用。");
      }).catch(function(){
        setTplCopyMsg("複製失敗，請直接點選下方文字框內容，Ctrl+A全選後Ctrl+C複製。");
      });
    }else{
      setTplCopyMsg("請直接點選下方文字框內容，Ctrl+A全選後Ctrl+C複製。");
    }
  };
  // v10.3.32新增：部門架構確認書(依目前已persist的正式部門清單自動產生，可列印/存為PDF)
  var deptLbl=function(id){var d=depts.find(function(x){return x.id===id;});return d?d.name:"—";};
  var manualItems=[
    {icon:"🏗",title:"層級定義",desc:"最多支援 4 層部門架構。建議規劃：L1 = 公司/集團，L2 = 部門，L3 = 組/課，L4 = 班/小組。每層以顏色區分(綠/琥珀/鼠尾草/紫)。"},
    {icon:"➕",title:"新增部門",desc:"Step 1：在「上層部門」下拉選擇父部門(留空則建立第一層根部門)。Step 2：輸入部門名稱。Step 3：點「新增」。也可展開建議清單快速填入——清單會依所選上層部門動態調整(建L2顯示通用部門名稱、建L3顯示對應組/課建議、建L4顯示通用班/組名稱)。"},
    {icon:"🗑",title:"刪除部門",desc:"點擊部門右側「刪」按鈕。注意：若該部門下仍有子部門，系統將攔截刪除並提示「請先刪除子部門」，須由最底層逐層往上刪除。"},
    {icon:"📁",title:"Excel 匯入",desc:"至「匯入/初始化」Tab，選擇格式為「部門名稱｜層級(1-4)｜上層部門名稱｜人數」的 .xlsx 或 .csv 檔案。正式匯入需麗媚後端協助。"},
    {icon:"🤝",title:"麗媚協助初始化",desc:"新簽約企業可免費申請麗媚顧問協助設定部門架構。請準備好組織架構圖或部門清單，透過 LINE @reibicare 聯繫，3 個工作日內完成。"},
    {icon:"📢",title:"公告中心",desc:"可從 10 個預設公告範本快速套用(標題+內容自動填入)，再視需要修改；也可直接自行輸入標題與內容。設定名額後可啟用報名管控。"},
    {icon:"👥",title:"報名管控",desc:"公告設定名額後，可在「報名管控」Tab 查看進度條與已/可報名人數。名額滿後自動標示「名額已滿」，顯示紅色警示框線。"},
  ];
  if(printMode){
    var sortedDepts=depts.slice().sort(function(a,b){return a.level-b.level||a.name.localeCompare(b.name);});
    var totalCount=depts.reduce(function(s,d){return s+(Number(d.count)||0);},0);
    return ce("div",{style:{minHeight:"100vh",background:"#fff",padding:"20px 24px",maxWidth:800,margin:"0 auto",color:"#222",fontFamily:"inherit"}},
      ce("style",null,"@media print{.dept-noprint{display:none !important;}body{background:#fff;}} .dept-ptable{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px;} .dept-ptable th,.dept-ptable td{border:1px solid #ccc;padding:6px 8px;text-align:left;}"),
      ce("div",{className:"dept-noprint",style:{display:"flex",gap:10,marginBottom:18}},
        ce(Btn,{onClick:function(){window.print();}},"🖨 列印/存為PDF"),
        ce(Btn,{v:"ghost",onClick:function(){setPrintMode(false);}},"← 返回編輯")),
      ce("div",{style:{textAlign:"center",marginBottom:20,borderBottom:"2px solid #333",paddingBottom:12}},
        ce("h1",{style:{fontSize:20,margin:0}},"部門架構確認書"),
        ce("div",{style:{fontSize:13,marginTop:6,color:"#555"}},"單位名稱："+((session&&session.orgName)||orgCode)+"　單位代碼："+orgCode),
        ce("div",{style:{fontSize:12,marginTop:4,color:"#777"}},"製表日期："+new Date().toLocaleDateString("zh-TW")+"　部門總數："+depts.length+"　登記總人數："+totalCount)),
      ce("h3",null,"部門架構清單"),
      depts.length===0?ce("p",{style:{color:"#888",fontSize:12}},"尚無部門資料。"):
      ce("table",{className:"dept-ptable"},
        ce("thead",null,ce("tr",null,["層級","部門名稱","上層部門","人數"].map(function(h){return ce("th",{key:h},h);}))),
        ce("tbody",null,sortedDepts.map(function(d){
          return ce("tr",{key:d.id},
            ce("td",null,"L"+d.level),
            ce("td",null,(["","　","　　","　　　"][d.level-1]||"")+d.name),
            ce("td",null,d.parent?deptLbl(d.parent):"—"),
            ce("td",null,d.count||0));
        }))),
      ce("h3",null,"確認簽署"),
      ce("table",{className:"dept-ptable"},
        ce("tbody",null,
          ce("tr",null,ce("td",{style:{width:"50%"}},"企業HR確認簽名：＿＿＿＿＿＿＿＿＿＿"),ce("td",null,"日期：＿＿＿＿＿＿＿＿＿＿")),
          ce("tr",null,ce("td",null,"麗媚顧問確認簽名：＿＿＿＿＿＿＿＿＿＿"),ce("td",null,"日期：＿＿＿＿＿＿＿＿＿＿")))),
      ce("div",{style:{fontSize:11,color:"#999",marginTop:20}},"本確認書由REIBI企業健康自主管理平台依系統實際登錄之部門架構自動產生，僅供雙方核對存查之用。"));
  }
  return ce(Screen,{title:"🏢 部門管理",onBack:onBack,maxW:660},
    ce("div",{style:{display:"flex",gap:6,marginBottom:16,borderBottom:"2px solid "+T.border,paddingBottom:12,flexWrap:"wrap"}},
      tabs.map(function(t){
        return ce("button",{key:t.k,onClick:function(){setTab(t.k);},style:{padding:"7px 14px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:tab===t.k?700:400,fontSize:12,background:tab===t.k?T.teal:"transparent",color:tab===t.k?"#fff":T.muted}},t.label);
      })),
    tab==="dept"&&ce("div",null,
      ce(IBox,{c:"navy",style:{marginBottom:12}},
        "📌 部門架構最多 4 層。新增前請先選擇「上層部門」，層級由系統自動判定。",
        ce("button",{onClick:function(){setTab("manual");},style:{marginLeft:8,fontSize:11,color:T.teal,background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}},"查看操作說明")),
      ce(Card,{style:{marginBottom:12}},
        ce(SecTitle,null,"新增部門"),
        ce("div",{style:{fontSize:11,color:T.muted,marginBottom:4}},"上層部門(留空 = 第一層根部門)"),
        ce("select",{value:newParent,onChange:function(e){setNewParent(e.target.value);},style:{width:"100%",padding:"8px 10px",border:"1px solid "+T.border,borderRadius:8,fontSize:13,background:T.card,marginBottom:8}},
          ce("option",{value:""},"— 第一層(根部門)—"),
          depts.filter(function(d){return d.level<4;}).map(function(d){
            var pad=["","　","　　","　　　"][d.level-1]||"";
            return ce("option",{key:d.id,value:d.id},pad+d.name+" (L"+d.level+")");
          })),
        ce("div",{style:{display:"flex",gap:8,marginBottom:8}},
          ce("input",{value:newName,onChange:function(e){setNewName(e.target.value);},placeholder:"部門名稱",style:{flex:1,padding:"8px 12px",border:"1px solid "+T.border,borderRadius:8,fontSize:13}}),
          ce(Btn,{sz:"sm",onClick:addDept,disabled:!newName.trim()},"新增")),
        ce("button",{onClick:function(){setShowPreset(function(v){return!v;});},style:{fontSize:11,color:T.teal,background:"none",border:"none",cursor:"pointer",padding:0,marginBottom:showPreset?8:0}},showPreset?"▲ 收起建議清單":"▼ 展開「"+presetLabel+"」("+contextPresets.length+"項)"),
        showPreset&&ce("div",{style:{display:"flex",flexWrap:"wrap",gap:4,marginTop:6}},
          contextPresets.map(function(p){
            return ce("button",{key:p,onClick:function(){setNewName(p);},style:{padding:"3px 10px",borderRadius:20,border:"1px solid "+T.border,background:T.bg,fontSize:11,cursor:"pointer",color:T.muted}},p);
          }))),
      ce(Card,null,
        ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}},
          ce(SecTitle,{style:{margin:0}},"部門架構("+depts.length+" 個)"),
          ce("div",{style:{display:"flex",gap:4}},
            LEVEL_LABELS.map(function(l,i){
              return ce("span",{key:l,style:{fontSize:10,color:LEVEL_COLORS[i],background:LEVEL_COLORS[i]+"18",padding:"2px 6px",borderRadius:8}},l);
            }))),
        depts.length>0&&ce("div",{style:{marginBottom:10}},
          ce(Btn,{v:"ghost",sz:"sm",onClick:function(){setPrintMode(true);}},"📄 產生部門架構確認書")),
        deptsLoaded&&depts.length===0?ce(IBox,{c:"teal",style:{marginTop:8}},"尚無部門資料，請於上方新增，或展開「常見部門名稱建議」快速建立第一個部門。"):renderTree("",0))),
    tab==="manual"&&ce("div",null,
      ce(IBox,{c:"teal",style:{marginBottom:12}},"本頁說明部門管理各項功能的操作方式與注意事項。"),
      manualItems.map(function(m){
        return ce(Card,{key:m.title,style:{marginBottom:10,borderLeft:"4px solid "+T.teal}},
          ce("div",{style:{display:"flex",gap:10,alignItems:"flex-start"}},
            ce("span",{style:{fontSize:22,flexShrink:0}},m.icon),
            ce("div",null,
              ce("div",{style:{fontWeight:700,fontSize:13,color:T.teal,marginBottom:4}},m.title),
              ce("div",{style:{fontSize:12,color:T.muted,lineHeight:1.8}},m.desc))));
      }),
      ce(IBox,{c:"amber",style:{marginTop:4}},
        "💡 建議做法：先規劃好紙本架構圖(最多4層)，再逐層由上往下新增。",ce("br"),
        "如需大量部門匯入，請至「匯入/初始化」Tab 或聯繫麗媚協助。")),
    tab==="import"&&ce("div",null,
      ce(Card,{style:{marginBottom:12}},
        ce(SecTitle,null,"Excel 匯入"),
        ce(IBox,{c:"teal",style:{marginBottom:12}},
          "📋 Excel 格式：欄位順序為「部門名稱｜層級(1-4)｜上層部門名稱｜人數」",ce("br"),
          "第一列為標題列(自動略過)，每行一個部門。"),
        ce("div",{style:{marginBottom:12}},
          ce(Btn,{v:"ghost",sz:"sm",onClick:function(){setTplOpen(function(v){return!v;});setTplCopyMsg("");}},tplOpen?"▲ 收起範本內容":"📋 顯示/複製匯入範本"),
          tplOpen&&ce("div",{style:{marginTop:8}},
            ce("textarea",{readOnly:true,value:TEMPLATE_CSV,onFocus:function(e){e.target.select();},style:{width:"100%",minHeight:80,fontFamily:"monospace",fontSize:12,padding:8,border:"1px solid "+T.border,borderRadius:8,background:T.bg,boxSizing:"border-box"}}),
            ce("div",{style:{display:"flex",gap:8,marginTop:6,alignItems:"center",flexWrap:"wrap"}},
              ce(Btn,{sz:"sm",onClick:copyTemplate},"📄 複製到剪貼簿"),
              ce("span",{style:{fontSize:11,color:T.muted}},"或點上方文字框，Ctrl+A全選、Ctrl+C複製")),
            tplCopyMsg&&ce("p",{style:{fontSize:11,color:T.teal,marginTop:6}},tplCopyMsg),
            ce("p",{style:{fontSize:11,color:T.muted,marginTop:6}},"複製後貼到Excel或記事本，另存新檔為.csv即可使用。"))),
        ce("div",{style:{border:"2px dashed "+T.border,borderRadius:12,padding:"24px",textAlign:"center",marginBottom:12}},
          ce("div",{style:{fontSize:32,marginBottom:8}},"📁"),
          ce("div",{style:{fontSize:13,color:T.muted,marginBottom:12}},"點選選擇 Excel 檔案(.xlsx / .csv)"),
          ce("input",{type:"file",accept:".xlsx,.xls,.csv",onChange:handleImport,style:{display:"block",margin:"0 auto",fontSize:12}})),
        importMsg&&ce(IBox,{c:"sage"},importMsg)),
      ce(Card,null,
        ce(SecTitle,null,"麗媚協助初始化"),
        ce(IBox,{c:"amber",style:{marginBottom:12}},"🤝 新簽約企業可申請麗媚協助一次性部門初始化設定(免費)"),
        ce("div",{style:{fontSize:13,color:T.text,lineHeight:1.8}},
          "服務內容：",ce("br"),
          "① 由麗媚顧問與企業HR確認部門架構(最多4層)",ce("br"),
          "② 匯入完整部門清單並設定人數",ce("br"),
          "③ 確認主管分層授權對應關係",ce("br"),
          "④ 完成後提供架構確認書"),
        ce("div",{style:{marginTop:12,padding:"10px 14px",background:T.tealBg,borderRadius:8,fontSize:12,color:T.teal}},
          "申請方式：LINE @reibicare 或 Email：reibiservice@gmail.com",ce("br"),
          "作業時間：收到資料後 3 個工作日內完成"))),
    tab==="notice"&&ce("div",null,
      ce(Card,{style:{marginBottom:12}},
        ce(SecTitle,null,"新增公告"),
        ce("div",{style:{marginBottom:10}},
          ce("div",{style:{fontSize:11,color:T.muted,marginBottom:4}},"快速套用預設範本(選填，套用後可自由修改)"),
          ce("select",{value:selPreset,onChange:function(e){applyPreset(e.target.value);},style:{width:"100%",padding:"8px 10px",border:"1px solid "+T.border,borderRadius:8,fontSize:13,background:T.card}},
            ce("option",{value:""},"— 選擇預設公告範本 —"),
            NOTICE_PRESETS.map(function(p,i){
              return ce("option",{key:i,value:i},(i+1)+". "+p.title);
            }))),
        ce("div",{style:{fontSize:11,color:T.muted,marginBottom:4}},"公告標題"),
        ce("input",{value:nTitle,onChange:function(e){setNTitle(e.target.value);},placeholder:"輸入公告標題",style:{width:"100%",padding:"8px 12px",border:"1px solid "+T.border,borderRadius:8,fontSize:13,marginBottom:8,boxSizing:"border-box"}}),
        ce("div",{style:{fontSize:11,color:T.muted,marginBottom:4}},"內容說明(選填)"),
        ce("textarea",{value:nBody,onChange:function(e){setNBody(e.target.value);},placeholder:"輸入公告內容，或套用範本後修改",rows:3,style:{width:"100%",padding:"8px 12px",border:"1px solid "+T.border,borderRadius:8,fontSize:13,resize:"vertical",fontFamily:"inherit",boxSizing:"border-box",marginBottom:8}}),
        ce("div",{style:{display:"flex",gap:8,marginBottom:10}},
          ce("div",{style:{flex:1}},
            ce("div",{style:{fontSize:11,color:T.muted,marginBottom:4}},"名額(留空=無限制)"),
            ce("input",{value:nQuota,onChange:function(e){setNQuota(e.target.value);},placeholder:"例：20",type:"number",min:"0",style:{width:"100%",padding:"8px 12px",border:"1px solid "+T.border,borderRadius:8,fontSize:13,boxSizing:"border-box"}})),
          ce("div",{style:{flex:1}},
            ce("div",{style:{fontSize:11,color:T.muted,marginBottom:4}},"活動日期"),
            ce("input",{value:nDate,onChange:function(e){setNDate(e.target.value);},type:"date",style:{width:"100%",padding:"8px 12px",border:"1px solid "+T.border,borderRadius:8,fontSize:13,boxSizing:"border-box"}}))),
        ce(Btn,{onClick:addNotice,full:true,disabled:!nTitle.trim()},"發布公告")),
      ce(Card,null,
        ce(SecTitle,null,"已發布公告("+notices.length+" 則)"),
        notices.length===0&&ce("p",{style:{fontSize:13,color:T.muted,textAlign:"center",padding:"16px 0"}},"尚無公告"),
        notices.map(function(n){
          var full=n.quota>0&&n.reg>=n.quota;
          return ce("div",{key:n.id,style:{padding:"10px 0",borderBottom:"1px solid "+T.border}},
            ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}},
              ce("span",{style:{fontWeight:700,fontSize:13,color:T.text}},n.title),
              ce("span",{style:{fontSize:11,padding:"2px 8px",borderRadius:10,background:full?T.redBg:T.tealBg,color:full?T.red:T.teal,fontWeight:700}},n.status)),
            n.body&&ce("p",{style:{fontSize:12,color:T.muted,margin:"2px 0 4px"}},n.body),
            ce("div",{style:{fontSize:11,color:T.muted}},"日期："+n.date+(n.quota>0?"　名額："+n.reg+"/"+n.quota:"")));
        }))),
    tab==="signup"&&ce("div",null,
      ce(Card,null,
        ce(SecTitle,null,"報名管控"),
        notices.filter(function(n){return n.quota>0;}).length===0&&ce(IBox,{c:"amber"},"目前無設定名額的公告，請在「公告中心」設定活動名額以啟用報名管控。"),
        notices.filter(function(n){return n.quota>0;}).map(function(n){
          var pct=Math.round(n.reg/n.quota*100);
          var full=n.reg>=n.quota;
          return ce(Card,{key:n.id,style:{marginBottom:10,border:"1px solid "+(full?T.red:T.border)}},
            ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}},
              ce("span",{style:{fontWeight:700,fontSize:13,color:full?T.red:T.text}},n.title),
              ce("span",{style:{fontSize:12,fontWeight:700,padding:"2px 10px",borderRadius:20,background:full?T.redBg:T.tealBg,color:full?T.red:T.teal}},full?"名額已滿":pct+"%")),
            ce("div",{style:{background:T.border,borderRadius:20,height:8,overflow:"hidden",marginBottom:6}},
              ce("div",{style:{width:pct+"%",height:"100%",background:full?T.red:T.teal,borderRadius:20}})),
            ce("div",{style:{display:"flex",justifyContent:"space-between",fontSize:11,color:T.muted}},
              ce("span","已報名 "+n.reg+" 人"),
              ce("span","名額上限 "+n.quota+" 人")));
        }))));
}

function IndustryScreen({session,onBack}){
  var INDUSTRIES=[
    {key:"tech",label:"科技",icon:"💻",color:T.teal,subs:["半導體","軟體服務","硬體製造","雲端服務","AI大數據","電信通訊","電子商務","資安","遊戲","其他科技"]},
    {key:"finance",label:"金融",icon:"🏦",color:T.navy,subs:["銀行","保險","證券","投信","租賃","票券","電子支付","會計師事務所","財務顧問","其他金融"]},
    {key:"mfg",label:"製造",icon:"🏭",color:T.warm,subs:["電子零組件","機械設備","汽車零件","食品加工","紡織成衣","化學材料","塑膠橡膠","金屬製品","印刷包裝","其他製造"]},
    {key:"service",label:"服務",icon:"🛎",color:T.amber,subs:["零售業","餐飲業","物流運輸","觀光旅遊","不動產","物業管理","顧問諮詢","清潔維護","人力仲介","其他服務"]},
    {key:"medical",label:"醫療",icon:"🏥",color:T.red,subs:["醫院診所","藥局","醫療器材","生技製藥","長照機構","復健診所","健康檢查","心理諮商","牙醫","其他醫療"]},
    {key:"edu",label:"教育",icon:"🎓",color:T.sage,subs:["大專院校","中小學","補習班","幼兒園","職業訓練","線上學習","特殊教育","圖書館","研究單位","其他教育"]},
    {key:"const",label:"建築",icon:"🏗",color:T.coral,subs:["建設公司","營造廠","室內設計","建築師事務所","工程顧問","景觀設計","設施管理","水電工程","消防工程","其他建築"]},
    {key:"media",label:"傳播",icon:"📡",color:T.plum,subs:["電視廣播","平面媒體","數位媒體","廣告公關","出版社","影視製作","音樂娛樂","直播平台","社群媒體","其他傳播"]},
    {key:"gov",label:"政府",icon:"🏛",color:"#334155",subs:["中央機關","地方機關","公立學校","公立醫院","國營事業","社會福利","環保單位","警消單位","交通單位","其他公部門"]},
    {key:"other",label:"其他",icon:"🔹",color:T.muted,subs:["農林漁牧","礦業","公益組織","宗教團體","社區發展","體育運動","藝術文化","法律事務所","其他行業","待分類"]},
  ];
  var[selIndustry,setSelIndustry]=useState("");
  var[selSub,setSelSub]=useState("");
  var[customSub,setCustomSub]=useState("");
  var[saved,setSaved]=useState(false);
  var found=INDUSTRIES.find(function(i){return i.key===selIndustry;})||null;
  var doSave=function(){
    if(!selIndustry)return;
    setSaved(true);
    setTimeout(function(){setSaved(false);},3000);
  };
  return ce(Screen,{title:"🏷 行業分類設定",onBack:onBack,maxW:640},
    ce(IBox,{c:"teal",style:{marginBottom:14}},"設定企業所屬行業，有助於 REIBI 提供更精準的職場健康分析與產業比較基準。"),
    ce(Card,{style:{marginBottom:12}},
      ce(SecTitle,null,"10 大行業分類"),
      ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}},
        INDUSTRIES.map(function(ind){
          var active=selIndustry===ind.key;
          return ce("button",{key:ind.key,onClick:function(){setSelIndustry(ind.key);setSelSub("");setCustomSub("");setSaved(false);},style:{padding:"10px 4px",borderRadius:10,border:"2px solid "+(active?ind.color:T.border),background:active?ind.color+"18":T.card,cursor:"pointer",textAlign:"center"}},
            ce("div",{style:{fontSize:20,marginBottom:4}},ind.icon),
            ce("div",{style:{fontSize:11,fontWeight:700,color:active?ind.color:T.muted}},ind.label));
        }))),
    found&&ce(Card,{style:{marginBottom:12,borderLeft:"4px solid "+found.color}},
      ce(SecTitle,null,"子業種("+found.label+" — 選 1 或自訂)"),
      ce("div",{style:{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}},
        found.subs.map(function(s){
          var active=selSub===s;
          return ce("button",{key:s,onClick:function(){setSelSub(active?"":s);setCustomSub("");},style:{padding:"5px 12px",borderRadius:20,border:"1px solid "+(active?found.color:T.border),background:active?found.color:"transparent",color:active?"#fff":T.muted,fontSize:12,cursor:"pointer",fontWeight:active?700:400}},s);
        })),
      ce("div",{style:{fontSize:11,color:T.muted,marginBottom:6}},"或輸入自訂子業種："),
      ce("div",{style:{display:"flex",gap:8}},
        ce("input",{value:customSub,onChange:function(e){setCustomSub(e.target.value);setSelSub("");},placeholder:"自訂子業種名稱",style:{flex:1,padding:"8px 12px",border:"1px solid "+T.border,borderRadius:8,fontSize:13}}),
        ce(Btn,{sz:"sm",onClick:function(){},disabled:!customSub.trim()},"套用"))),
    found&&ce(Card,{style:{marginBottom:12}},
      ce(SecTitle,null,"目前設定"),
      ce("div",{style:{display:"flex",gap:12,alignItems:"center",padding:"10px 0"}},
        ce("span",{style:{fontSize:28}},found.icon),
        ce("div",null,
          ce("div",{style:{fontWeight:700,fontSize:15,color:found.color}},found.label+(selSub||customSub?" / "+(selSub||customSub):" — 尚未選擇子業種")),
          ce("div",{style:{fontSize:11,color:T.muted,marginTop:2}},"行業代碼："+found.key.toUpperCase()+(selSub?" - "+selSub.slice(0,4):"")))),
      ce(Btn,{onClick:doSave,v:"sage",full:true,disabled:!selIndustry},"儲存行業設定"),
      saved&&ce("div",{style:{marginTop:8,fontSize:12,color:T.sage,textAlign:"center"}},"行業分類已儲存！")),
    ce(IBox,{c:"amber"},"行業分類設定完成後，REIBI 將自動對應：",ce("br"),
      "① 同產業健康基準比較(去識別化)",ce("br"),
      "② 職業健康風險提示(如製造業疼痛率、科技業失眠率)",ce("br"),
      "③ ESG GRI 403 產業別揭露建議"));
}

function SubscribeScreen({session,onBack,onUpdateSess,mySub,onSubChange}){
  var TERMS_VERSION="v1-20260705";
  var TERMS_POINTS=["訂閱申請採人工審核制：送出後請透過LINE或Email提供付款證明，麗媚將於1-2個工作日內確認並啟用。","訂閱到期後將自動降級為免費版，所有歷史資料完整保留，不會刪除。","個人會員碼為找回訂閱狀態的唯一憑證，請自行妥善保存；遺失僅能聯絡客服人工核對身分後協助處理。","訂閱費用一經啟用後，若有退款需求請洽客服個案處理，不提供自動退款機制。","本服務條款可能隨營運需要調整，調整後將於平台公告。"];
  var freeFeats=["每週健康評估(ISI+BPI+WQ，共19題)","AI六面向個人化建議(睡眠/疼痛/飲食/運動/三高/REIBI體驗)","四色燈號即時健康狀態","個人歷史趨勢追蹤(最近3個月)","📄 個人完整PDF報告下載","🩸 三高/BMI數值管理(年度健檢提醒)","22項行動打卡積分制度","🌙 睡眠日記 + 疼痛日誌","🧠 身心健康評估(PHQ-4情緒+PSS-4壓力)","⚡ 過勞風險自我檢視(8題)","EAP健康關懷資源參考(保密)"];
  var proFeats=["📄 個人完整PDF報告(含封面/來源/AI改善建議，2,000字+)","📈 無限次歷史趨勢追蹤與年度改善報告","📊 我的改善曲線(ISI/BPI/WQ折線圖)","🩸 三高/BMI數值管理模組(年度健檢提醒)","🧠 身心健康深度分析(MHI三子指標)","⚡ 過勞風險深度追蹤(趨勢分析)","📅 優先預約自主健管體驗排程","⭐ 積分兌換加值服務(生物資訊/自律神經量測等)","🔔 定期評估提醒推播","💬 個人健康顧問諮詢(每月1次)"];
  var[view,setView]=React.useState(mySub?"status":"compare");
  var[form,setForm]=React.useState({plan:"monthly",contact:""});
  var[agreed,setAgreed]=React.useState(false);
  var[lookupCode,setLookupCode]=React.useState("");
  var[actCode,setActCode]=React.useState("");
  var[actErr,setActErr]=React.useState("");
  var[actLoading,setActLoading]=React.useState(false);
  var[err,setErr]=React.useState("");
  var[loading,setLoading]=React.useState(false);
  var[justCreated,setJustCreated]=React.useState(false);
  var[copied,setCopied]=React.useState(false);

  function setF(k,v){setForm(function(f){var u={};u[k]=v;return Object.assign({},f,u);});}

  async function doApply(){
    setErr("");
    if(!agreed){setErr("請先閱讀並勾選同意訂閱服務條款");return;}
    setLoading(true);
    var isNew=!(session&&session.memberCode);
    var code=(session&&session.memberCode)||genRC();
    var planDef=SUB_PLANS.find(function(p){return p.k===form.plan;})||SUB_PLANS[0];
    var rec={
      memberCode:code,
      name:(session&&session.name)||"",
      contact:form.contact||"",
      plan:planDef.k,planLabel:planDef.label,
      status:"pending",
      requestedAt:new Date().toISOString(),
      approvedAt:null,expiresAt:null,adminNote:"",
      consentAt:new Date().toISOString(),consentVersion:TERMS_VERSION
    };
    await DB.upsertSub(rec);
    if(isNew&&onUpdateSess){await onUpdateSess({memberCode:code});}
    if(onSubChange)onSubChange(rec);
    setJustCreated(isNew);
    setLoading(false);
    setView("status");
  }

  async function doLookup(){
    setErr("");
    var code=lookupCode.trim().toUpperCase();
    if(!code){setErr("請輸入會員碼");return;}
    setLoading(true);
    var found=await DB.findSub(code);
    setLoading(false);
    if(!found){setErr("查無此會員碼對應的訂閱紀錄，請確認代碼是否正確(區分大小寫，建議直接複製貼上)。");return;}
    if(onUpdateSess){await onUpdateSess({memberCode:code});}
    if(onSubChange)onSubChange(found);
    setView("status");
  }

  // v10.3.23新增：啟用碼自助啟用(個人訂閱審核已改至reibi-l5.jsx人工處理，核准後產生此碼)
  async function doActivate(){
    setActErr("");
    var code=(session&&session.memberCode)||(mySub&&mySub.memberCode);
    if(!code){setActErr("請先申請訂閱或輸入會員碼找回，才能使用啟用碼。");return;}
    if(!actCode.trim()){setActErr("請輸入啟用碼");return;}
    setActLoading(true);
    var result=await verifyActivationCode(actCode,code);
    setActLoading(false);
    if(!result){setActErr("啟用碼無效，請確認是否完整複製，或聯絡客服確認是否對應此會員碼。");return;}
    var planDef=SUB_PLANS.find(function(p){return p.k===result.plan;})||SUB_PLANS[0];
    var updated=Object.assign({},mySub||{memberCode:code,name:(session&&session.name)||"",contact:""},{
      status:"active",plan:result.plan,planLabel:planDef.label,
      approvedAt:new Date().toISOString(),expiresAt:result.expiresAt,adminNote:""
    });
    await DB.upsertSub(updated);
    if(onSubChange)onSubChange(updated);
    setActCode("");
    setView("status");
  }

  var effStatus=mySub?effectiveSubStatus(mySub):null;
  var daysLeft=mySub&&mySub.expiresAt?daysUntil(mySub.expiresAt):null;

  if(view==="apply"){
    return ce(Screen,{title:"⭐ 申請訂閱",onBack:function(){setView(mySub?"status":"compare");},maxW:560},
      ce(IBox,{c:"navy",style:{marginBottom:14}},"目前訂閱採人工審核制：送出申請後，請透過LINE或Email提供付款證明，麗媚將於1-2個工作日內確認款項並啟用您的訂閱。到期後將自動降級為免費版，所有歷史資料完整保留。"),
      err&&ce(IBox,{c:"red",style:{marginBottom:14}},err),
      ce(Card,null,
        ce(SecTitle,null,"選擇方案"),
        ce("div",{style:{display:"grid",gap:8,marginBottom:14}},
          SUB_PLANS.map(function(p){
            var sel=form.plan===p.k;
            return ce("button",{key:p.k,onClick:function(){setF("plan",p.k);},style:{padding:"12px 14px",borderRadius:10,border:"1px solid "+(sel?T.amber:T.border),background:sel?T.amberBg:T.card,color:sel?T.amber:T.text,fontSize:13,fontWeight:sel?700:400,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}},p.label+"("+p.months+"個月)");
          })),
        ce("div",{style:{marginBottom:14}},
          ce("div",{style:{fontSize:12,color:T.muted,marginBottom:4}},"聯絡方式(電話/LINE ID/Email，選填，加速對帳確認)"),
          ce("input",{type:"text",value:form.contact,placeholder:"如：0912345678 或 LINE ID",onChange:function(e){setF("contact",e.target.value);},style:{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box"}})),
        ce("div",{style:{background:T.bg,borderRadius:10,padding:"12px 14px",marginBottom:14}},
          ce("div",{style:{fontSize:12,fontWeight:700,color:T.text,marginBottom:6}},"訂閱服務條款摘要"),
          TERMS_POINTS.map(function(t,i){return ce("div",{key:i,style:{fontSize:11,color:T.muted,marginBottom:3,display:"flex",gap:6}},ce("span",null,"•"),t);}),
          ce("label",{style:{display:"flex",alignItems:"flex-start",gap:8,marginTop:10,cursor:"pointer"}},
            ce("input",{type:"checkbox",checked:agreed,onChange:function(e){setAgreed(e.target.checked);},style:{marginTop:2,flexShrink:0}}),
            ce("span",{style:{fontSize:12,color:T.text,fontWeight:600}},"我已閱讀並同意上述訂閱服務條款"))),
        ce(Btn,{onClick:doApply,disabled:loading||!agreed,v:"amber",full:true},loading?"送出中...":"送出訂閱申請")));
  }

  if(view==="lookup"){
    return ce(Screen,{title:"🔑 找回訂閱狀態",onBack:function(){setView("compare");},maxW:520},
      ce(IBox,{c:"teal",style:{marginBottom:14}},"如果您曾在其他裝置或登入過程中申請過訂閱，請輸入當時取得的「個人會員碼」找回訂閱狀態。"),
      err&&ce(IBox,{c:"red",style:{marginBottom:14}},err),
      ce(Card,null,
        ce("div",{style:{fontSize:12,color:T.muted,marginBottom:4}},"個人會員碼(8碼)"),
        ce("input",{type:"text",value:lookupCode,placeholder:"如：AB3D9F2K",onChange:function(e){setLookupCode(e.target.value.toUpperCase());},style:{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:14,letterSpacing:2,boxSizing:"border-box",marginBottom:12}}),
        ce(Btn,{onClick:doLookup,disabled:loading,v:"teal",full:true},loading?"查詢中...":"查詢我的訂閱狀態")));
  }

  if(view==="status"&&mySub){
    return ce(Screen,{title:"⭐ 我的訂閱狀態",onBack:onBack,maxW:560},
      justCreated&&ce(IBox,{c:"amber",style:{marginBottom:14}},
        ce("strong",null,"🎉 已產生您的個人會員碼，請務必保存！"),ce("br"),
        "此代碼用於未來在其他裝置或重新登入時找回訂閱狀態，遺失將無法自行復原，請截圖或抄下保存。"),
      ce(Card,{style:{marginBottom:14,textAlign:"center",border:"2px solid "+T.amber}},
        ce("div",{style:{fontSize:11,color:T.muted,marginBottom:6}},"個人會員碼"),
        ce("div",{style:{fontSize:24,fontWeight:800,color:T.amber,letterSpacing:3,marginBottom:10}},mySub.memberCode),
        ce(Btn,{sz:"sm",v:"ghost",onClick:function(){navigator.clipboard.writeText(mySub.memberCode).then(function(){setCopied(true);setTimeout(function(){setCopied(false);},2000);});}},copied?"✅ 已複製":"📋 複製會員碼")),
      effStatus==="pending"&&ce(Card,{style:{marginBottom:14,border:"1px solid #fcd34d",background:T.amberBg}},
        ce("div",{style:{fontWeight:700,color:T.amber,marginBottom:8}},"⏳ 待審核"),
        ce("div",{style:{fontSize:13,color:T.text,marginBottom:10}},"已提交「"+mySub.planLabel+"」訂閱申請，麗媚將於1-2個工作日內確認款項並啟用。如需加速，請透過LINE或Email提供付款證明並附上您的會員碼。"),
        ce(Btn,{v:"amber",onClick:function(){window.open("https://line.me/R/ti/p/@reibicare","_blank");}},"💬 LINE @reibicare 提供付款證明")),
      (effStatus==="pending"||effStatus==="expired"||effStatus==="rejected")&&ce(Card,{style:{marginBottom:14}},
        ce(SecTitle,null,"已收到啟用碼？在此輸入立即啟用"),
        ce("div",{style:{fontSize:12,color:T.muted,marginBottom:10}},"麗媚確認款項後會透過LINE或Email提供一段啟用碼，請完整複製貼上於下方。"),
        actErr&&ce(IBox,{c:"red",style:{marginBottom:10}},actErr),
        ce("div",{style:{display:"flex",gap:8}},
          ce("input",{type:"text",value:actCode,placeholder:"如：M06B7F3A",onChange:function(e){setActCode(e.target.value.toUpperCase());},style:{flex:1,padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:14,letterSpacing:2,boxSizing:"border-box"}}),
          ce(Btn,{onClick:doActivate,disabled:actLoading,v:"sage"},actLoading?"驗證中...":"啟用"))),
      effStatus==="active"&&ce(Card,{style:{marginBottom:14,border:"1px solid #86efac",background:T.sageBg}},
        ce("div",{style:{fontWeight:700,color:T.sage,marginBottom:8}},"✅ 訂閱中"),
        ce("div",{style:{fontSize:13,color:T.text,marginBottom:6}},"方案："+mySub.planLabel),
        ce("div",{style:{fontSize:13,color:T.text,marginBottom:6}},"到期日："+new Date(mySub.expiresAt).toLocaleDateString("zh-TW")),
        (daysLeft!==null&&daysLeft<=30)&&ce(IBox,{c:"amber",style:{marginTop:8}},"⚠ 訂閱將於"+daysLeft+"天後到期，到期後將自動降級為免費版(歷史資料會保留)，如需續訂請及早申請。")),
      effStatus==="expired"&&ce(Card,{style:{marginBottom:14,border:"1px solid #fca5a5",background:T.redBg}},
        ce("div",{style:{fontWeight:700,color:T.red,marginBottom:8}},"⚠ 訂閱已到期"),
        ce("div",{style:{fontSize:13,color:T.text,marginBottom:10}},"已自動降級為免費版，所有歷史資料完整保留。可隨時重新申請恢復訂閱版功能。"),
        ce(Btn,{v:"amber",onClick:function(){setView("apply");}},"重新申請訂閱")),
      effStatus==="rejected"&&ce(Card,{style:{marginBottom:14,border:"1px solid #fca5a5",background:T.redBg}},
        ce("div",{style:{fontWeight:700,color:T.red,marginBottom:8}},"申請未通過"),
        mySub.adminNote&&ce("div",{style:{fontSize:13,color:T.text,marginBottom:10}},"說明："+mySub.adminNote),
        ce(Btn,{v:"amber",onClick:function(){setView("apply");}},"重新申請")),
      ce(IBox,{c:"teal"},"如有任何問題，歡迎聯絡：",ce("br"),
        ce("a",{href:"https://line.me/R/ti/p/@reibicare",target:"_blank",style:{color:T.teal,fontWeight:700,display:"block",marginTop:6,fontSize:13}},"💬 LINE @reibicare(點此加入)"),
        ce("span",{style:{fontSize:11,color:T.muted}},"或 📧 reibiservice@gmail.com　週一至週五 09:00-18:00")));
  }

  return ce(Screen,{title:"⭐ 訂閱方案",onBack:onBack,maxW:560},
    ce("div",{style:{display:"grid",gap:14}},
      ce(Card,{style:{border:"2px solid "+T.tealLight}},
        ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}},
          ce("div",null,
            ce("div",{style:{fontWeight:800,fontSize:16,color:T.teal}},"免費版"),
            ce("div",{style:{fontSize:22,fontWeight:800,color:T.text,marginTop:2}},"NT$ 0",ce("span",{style:{fontSize:12,color:T.muted}}," / 永久"))),
          ce("div",{style:{background:T.sageBg,color:T.sage,fontWeight:700,fontSize:12,padding:"4px 12px",borderRadius:20}},"目前使用中")),
        freeFeats.map(function(f){return ce("div",{key:f,style:{display:"flex",gap:8,alignItems:"flex-start",padding:"4px 0",fontSize:13,color:T.muted}},ce("span",{style:{color:T.sage,flexShrink:0}},"✅"),f);})),
      ce(Card,{style:{border:"2px solid "+T.amber,background:"linear-gradient(135deg,"+T.amberBg+",#fffffe)"}},
        ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}},
          ce("div",null,
            ce("div",{style:{fontWeight:800,fontSize:16,color:T.amber}},"訂閱版 Pro"),
            ce("div",{style:{fontSize:22,fontWeight:800,color:T.amber,marginTop:2}},"洽詢定價",ce("span",{style:{fontSize:12,color:T.muted}}," / 月"))),
          ce("div",{style:{background:T.amberBg,color:T.amber,fontWeight:700,fontSize:12,padding:"4px 12px",borderRadius:20,border:"1px solid #fcd34d"}},"⭐ 升級")),
        ce(IBox,{c:"teal",style:{marginBottom:10}},"包含免費版所有功能，另增加："),
        proFeats.map(function(f){return ce("div",{key:f,style:{display:"flex",gap:8,alignItems:"flex-start",padding:"4px 0",fontSize:13,color:T.text}},ce("span",{style:{color:T.amber,flexShrink:0,fontSize:14}},f.slice(0,2)),f.slice(2));}),
        ce("div",{style:{display:"flex",gap:8,marginTop:16}},
          ce(Btn,{v:"amber",full:true,onClick:function(){setView("apply");}},"🚀 立即申請訂閱"),
          ce(Btn,{v:"ghost",full:true,onClick:function(){setView("lookup");}},"🔑 已有會員碼"))),
      ce(IBox,{c:"teal"},"💡 訂閱申請採人工審核制(短期)，送出申請後請提供付款證明加速確認。如需了解詳情，歡迎直接聯絡：",ce("br"),
        ce("a",{href:"https://line.me/R/ti/p/@reibicare",target:"_blank",style:{color:T.teal,fontWeight:700,display:"block",marginTop:6,fontSize:13}},"💬 LINE @reibicare(點此加入)"),
        ce("span",{style:{fontSize:11,color:T.muted}},"或 📧 reibiservice@gmail.com　週一至週五 09:00-18:00"))));
}


function PrivacyScreen({session,onBack}){
  const[optIn,setOptIn]=useState(false);const[saved,setSaved]=useState(false);
  return ce(Screen,{title:"🔒 隱私安全中心",onBack,maxW:600},
    ce(IBox,{c:"navy",style:{marginBottom:14}},
      ce("strong",null,"個資保護聲明"),ce("br"),
      "本平台依台灣個資法、GDPR概念及HIPAA-ready架構設計。您的健康評估資料：",ce("br"),
      "① 全程去識別化處理(k-匿名性 k≥5，差分隱私保護)",ce("br"),
      "② 不含任何個人直接識別資訊(Non-PHI)",ce("br"),
      "③ 三高數值僅個人可見，不上傳至單位統計",ce("br"),
      "④ 您可隨時行使刪除權(Right to Erasure)"),
    ce(Card,{style:{marginBottom:14}},
      ce(SecTitle,null,"大數據研究 Opt-in(自願)"),
      ce(IBox,{c:"amber",style:{marginBottom:10}},"以下為自願性同意，拒絕不影響任何平台功能或服務。大數據研究發表前需通過IRB倫理審查。"),
      ce("label",{style:{display:"flex",gap:10,cursor:"pointer",alignItems:"flex-start",padding:"12px",background:T.bg,borderRadius:8}},
        ce("input",{type:"checkbox",checked:optIn,onChange:e=>setOptIn(e.target.checked),style:{marginTop:3,accentColor:T.teal}}),
        ce("div",null,
          ce("div",{style:{fontWeight:600,fontSize:13,color:T.text,marginBottom:4}},"我同意將我的去識別化評估數據用於REIBI大數據健康研究"),
          ce("div",{style:{fontSize:12,color:T.muted}},"資料用途：改善平台演算法、學術研究發表(需IRB審查)、跨企業匿名健康趨勢分析。資料型態：僅含ISI/BPI/WQ分數及燈號，不含個人識別資訊。可隨時撤回同意。"))),
      ce(Btn,{onClick:()=>setSaved(true),v:"sage",style:{marginTop:12}},optIn?"✅ 確認同意":"✅ 確認拒絕(預設)"),
      saved&&ce("p",{style:{fontSize:12,color:T.sage,marginTop:8}},"✅ 您的選擇已儲存。")),
    ce(Card,null,
      ce(SecTitle,null,"資料刪除權"),
      ce(IBox,{c:"red",style:{marginBottom:10}},"⚠ 刪除後無法復原。您的所有本地評估記錄、積分及設定將被清除。"),
      ce(Btn,{v:"danger",onClick:()=>{if(window.confirm("確定要刪除所有個人資料嗎？此操作無法復原。")){localStorage.clear();alert("資料已清除，請重新整理頁面。");}}},"申請刪除我的所有資料")));
}


function ParamsScreen({session,onBack}){
  var code=(session&&session.orgCode)||"g";
  var[params,setParams]=useState(DEFAULT_PARAMS);
  var[saved,setSaved]=useState(false);
  var[toast,setToast]=useState("");
  var[tab,setTab]=useState("slider");
  var[roiScenario,setRoiScenario]=useState("neutral");
  useEffect(function(){DB.getParams(code).then(function(p){if(p)setParams(p);});},[]);
  var doSave=async function(){
    await DB.saveParams(code,Object.assign({},params,{updatedTs:new Date().toISOString()}));
    setSaved(true);setToast("參數已儲存");
    AL.rec("PARAMS_SAVED","",session&&session.role);
  };
  // ROI 即時計算
  var n=params.headcount||1000;
  var improveRate=(params.improveRate||60)/100;
  var improvedN=Math.round(n*improveRate);
  var sickSave=Math.round((params.sickDaysReduced||2)*params.avgDailySalary*n);
  var insSave=Math.round((params.insuranceSaving||12000)*n);
  var avgMonthly=params.avgMonthlySalary||50000;
  var prodGain=(params.productivityGain||15)/100;
  var prodSave=Math.round((avgMonthly/22)*prodGain*240*improvedN);
  var totalBenefit=sickSave+insSave+prodSave;
  var cost=params.implementCost||6000000;
  var scenMul=roiScenario==="conservative"?0.6:roiScenario==="optimistic"?1.4:1.0;
  var scenBenefit=Math.round(totalBenefit*scenMul);
  var roi3yr=Math.round((scenBenefit*3-cost)/cost*100);
  var payback=cost>0?Math.round(cost/scenBenefit*12):0;
  // 3年效益SVG折線圖數據(保守/中性/樂觀三線)
  var SVG_W=340;var SVG_H=120;var SVG_PAD=32;
  var yrs=[0,1,2,3];
  var mkLine=function(mul){return yrs.map(function(y){return Math.round(totalBenefit*mul*y-cost);});};
  var lines3={conservative:mkLine(0.6),neutral:mkLine(1.0),optimistic:mkLine(1.4)};
  var allVals=[];
  Object.values(lines3).forEach(function(arr){arr.forEach(function(v){allVals.push(v);});});
  var minV=Math.min.apply(null,allVals);var maxV=Math.max.apply(null,allVals);
  var rangeV=maxV-minV||1;
  var toX=function(i){return SVG_PAD+(i/3)*(SVG_W-SVG_PAD*2);};
  var toY=function(v){return SVG_H-SVG_PAD-(v-minV)/rangeV*(SVG_H-SVG_PAD*2);};
  var mkPath=function(vals){return vals.map(function(v,i){return (i===0?"M":"L")+toX(i)+","+toY(v);}).join(" ");};
  // D層場佈投報
  var dLayerCost=params.dLayerCost||90000;
  var participantBoost=(params.participantBoost||12)/100;
  var boostedN=Math.round(n*participantBoost);
  var dLayerROI=Math.round(boostedN*(params.avgDailySalary||3200)*0.5);

  var SliderRow=function(sp){
    var label=sp.label;var desc=sp.desc;var k=sp.k;var min=sp.min;var max=sp.max;var step=sp.step||1;var unit=sp.unit||"";var val=params[k]!==undefined?params[k]:sp.def;
    return ce("div",{style:{marginBottom:14}},
      ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:3}},
        ce("label",{style:{fontSize:13,fontWeight:700,color:T.text}},label),
        ce("span",{style:{fontSize:16,fontWeight:800,color:T.teal}},unit==="NT$"?"NT$"+Number(val).toLocaleString():val+unit)),
      ce("input",{type:"range",min:min,max:max,step:step,value:val,
        onChange:function(e){setParams(function(p){var u={};u[k]=Number(e.target.value);return Object.assign({},p,u);});setSaved(false);},
        style:{width:"100%",accentColor:T.teal,cursor:"pointer"}}),
      ce("div",{style:{display:"flex",justifyContent:"space-between",fontSize:10,color:T.faint,marginTop:2}},
        ce("span",null,unit==="NT$"?"NT$"+Number(min).toLocaleString():min+unit),
        ce("span",{style:{fontSize:11,color:T.muted}},desc),
        ce("span",null,unit==="NT$"?"NT$"+Number(max).toLocaleString():max+unit)));
  };

  return ce(Screen,{title:"\u2699 ROI\u53c3\u6578\u8a2d\u5b9a\u8207\u8a66\u7b97",onBack,maxW:680},
    ce(Toast,{msg:toast,onDone:function(){setToast("");}}),
    ce(IBox,{c:"navy",style:{marginBottom:14}},"\ud83d\udd11 \u6b64\u9801\u9762\u50c5\u55ae\u4f4d\u5e73\u53f0\u7ba1\u7406\u8005\u53ef\u4fee\u6539\u3002\u6240\u6709\u6578\u5024\u7531\u8cbb\u55ae\u55ae\u4f4d\u4f9d\u5be6\u969b\u60c5\u6cc1\u81ea\u884c\u8a55\u4f30\u8a2d\u5b9a\uff0c\u4fee\u6539\u5f8c\u5f71\u97ffESG/ROI\u5831\u544a\u7684\u8a08\u7b97\u7d50\u679c\u3002\u8a66\u7b97\u70baWPAI\u6a21\u64ec\u60c5\u5883\uff0c\u4e0d\u69cb\u6210\u8ca1\u52d9\u627f\u8afe\u3002"),
    ce("div",{style:{display:"flex",gap:4,marginBottom:14}},
      [{k:"slider",l:"\ud83c\udfae \u6ed1\u8277\u8a66\u7b97\u5668"},{k:"dLayer",l:"\ud83c\udfe2 D\u5c64\u5834\u4f48\u6295\u5831"},{k:"manual",l:"\u2699 \u9032\u968e\u53c3\u6578"}].map(function(t){
        return ce("button",{key:t.k,onClick:function(){setTab(t.k);},style:{padding:"7px 16px",border:"1px solid "+(tab===t.k?T.teal:T.border),borderRadius:20,cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:"inherit",background:tab===t.k?T.teal:T.card,color:tab===t.k?"#fff":T.muted}},t.l);
      })),

    tab==="slider"&&ce("div",{style:{display:"grid",gap:12}},
      ce(Card,null,
        ce(SecTitle,null,"\u53c3\u6578\u8a2d\u5b9a\uff08\u62d6\u52d5\u5373\u6642\u66f4\u65b0\uff09"),
        ce(SliderRow,{label:"\u5c31\u696d\u4eba\u6578",k:"headcount",min:50,max:5000,step:50,unit:"\u4eba",desc:"\u5168\u516c\u53f8\u5c31\u696d\u4eba\u6578",def:1000}),
        ce(SliderRow,{label:"\u5065\u5eb7\u6539\u5584\u7387",k:"improveRate",min:20,max:90,step:5,unit:"%",desc:"\u9884\u671f\u71c8\u865f\u6539\u5584\u4eba\u6578\u6bd4\u4f8b",def:60}),
        ce(SliderRow,{label:"\u5e74\u75c5\u5047\u6e1b\u5c11\u5929\u6578",k:"sickDaysReduced",min:0,max:10,step:0.5,unit:"\u5929",desc:"\u5065\u4fc3\u4ecb\u5165\u5f8c\u6bcf\u4eba\u6bcf\u5e74\u6e1b\u5c11",def:2}),
        ce(SliderRow,{label:"\u54e1\u5de5\u5e73\u5747\u65e5\u85aa",k:"avgDailySalary",min:1000,max:10000,step:200,unit:"NT$",desc:"\u6708\u85aa\u00f722\u5de5\u4f5c\u65e5",def:3200}),
        ce(SliderRow,{label:"\u54e1\u5de5\u5e73\u5747\u6708\u85aa",k:"avgMonthlySalary",min:30000,max:200000,step:5000,unit:"NT$",desc:"\u7528\u65bc\u751f\u7522\u529b\u7d93\u6fdf\u50f9\u5024\u8a08\u7b97",def:50000}),
        ce(SliderRow,{label:"\u4fdd\u96aa\u6210\u672c\u7bc0\u7701",k:"insuranceSaving",min:0,max:50000,step:1000,unit:"NT$",desc:"\u6bcf\u4eba\u6bcf\u5e74\u9810\u4f30\u7bc0\u7701",def:12000}),
        ce(SliderRow,{label:"\u751f\u7522\u529b\u63d0\u5347\u6bd4\u4f8b",k:"productivityGain",min:3,max:30,step:1,unit:"%",desc:"WPAI\u6a21\u578b\u4fdd\u5b88\u4f30\u7b97",def:15}),
        ce(SliderRow,{label:"\u5c0e\u5165\u6210\u672c\uff083\u5e74\uff09",k:"implementCost",min:1000000,max:20000000,step:500000,unit:"NT$",desc:"A+B+C\u4e09\u5c64\u7e3d\u8cbb\u7528",def:6000000})),
      ce(Card,{style:{background:"linear-gradient(135deg,"+T.navyBg+",#fff)",borderLeft:"4px solid "+T.navy}},
        ce(SecTitle,null,"\ud83d\udcca ROI \u5373\u6642\u8a66\u7b97\u7d50\u679c"),
        // 三情境快速切換
        ce("div",{style:{display:"flex",gap:6,marginBottom:14}},
          [{k:"conservative",l:"保守情境",mul:0.6,note:"健康改善率×0.6"},
           {k:"neutral",l:"中性情境",mul:1.0,note:"以設定參數計算"},
           {k:"optimistic",l:"樂觀情境",mul:1.4,note:"健康改善率×1.4"}
          ].map(function(sc){
            var active=roiScenario===sc.k;
            return ce("button",{key:sc.k,onClick:function(){setRoiScenario(sc.k);},
              style:{flex:1,padding:"8px 4px",border:"2px solid "+(active?T.navy:T.border),borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:11,fontFamily:"inherit",
                background:active?"linear-gradient(135deg,"+T.navy+",#2c5282)":T.card,color:active?"#fff":T.muted,transition:"all .15s"}},
              ce("div",{style:{fontWeight:700,fontSize:12}},sc.l),
              ce("div",{style:{fontSize:9,opacity:0.8,marginTop:2}},sc.note));
          })),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}},
          [{l:"\u5e74\u75c5\u5047\u6210\u672c\u7bc0\u7701",v:"NT$"+(sickSave/10000).toFixed(1)+"\u842c",c:T.teal},
           {l:"\u4fdd\u96aa\u6210\u672c\u7bc0\u7701",v:"NT$"+(insSave/10000).toFixed(1)+"\u842c",c:T.sage},
           {l:"\u751f\u7522\u529b\u7d93\u6fdf\u50f9\u5024",v:"NT$"+(prodSave/10000).toFixed(1)+"\u842c",c:T.amber},
           {l:"\u5e74\u7d3c\u6548\u76ca\u5408\u8a08",v:"NT$"+(totalBenefit/10000).toFixed(1)+"\u842c",c:T.navy}].map(function(k){
            return ce(Card,{key:k.l,style:{padding:"10px 14px",textAlign:"center"}},
              ce("div",{style:{fontSize:18,fontWeight:800,color:k.c}},k.v),
              ce("div",{style:{fontSize:10,color:T.muted,marginTop:3}},k.l));
          })),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}},
          [{l:"3\u5e74\u6de8ROI",v:(roi3yr>0?"+":"")+roi3yr+"%",c:roi3yr>=300?T.sage:roi3yr>=100?T.amber:T.coral},
           {l:"\u56de\u672c\u671f",v:payback<=12?payback+"\u500b\u6708":Math.round(payback/12*10)/10+"\u5e74",c:payback<=18?T.sage:T.amber}].map(function(k){
            return ce(Card,{key:k.l,style:{padding:"12px 14px",textAlign:"center",background:T.bg}},
              ce("div",{style:{fontSize:24,fontWeight:800,color:k.c}},k.v),
              ce("div",{style:{fontSize:11,fontWeight:700,color:T.muted,marginTop:4}},k.l));
          })),
        ce(IBox,{c:"teal"},[
          "\u6295\u5165 NT$"+(cost/10000).toFixed(0)+"\u842c\uff0c3\u5e74\u7e3d\u6548\u76ca NT$"+(scenBenefit*3/10000).toFixed(0)+"\u842c",
          "\u6bcf\u6295\u5165 1 \u5143\uff0c\u9810\u671f\u56de\u6536 "+(scenBenefit*3/cost).toFixed(1)+" \u5143\uff08\u570b\u969b\u6a19\u6cd5 3-5 \u5143\uff09",
          "\u6539\u5584\u4eba\u6578\uff1a"+improvedN+"\u4eba\uff08\u5c31\u696d "+n+" \u4eba\u00d7"+Math.round(improveRate*100)+"%\uff09"
        ].join("\n")),
        // SVG 三年效益折線圖(保守/中性/樂觀)
        ce("div",{style:{marginTop:14}},
          ce(SecTitle,null,"\ud83d\udcc8 3\u5e74\u6548\u76ca\u8da8\u52e2(NT$\u842c)"),
          ce("svg",{width:SVG_W,height:SVG_H,style:{display:"block",margin:"0 auto"}},
            // zero line
            minV<0&&maxV>0&&ce("line",{x1:SVG_PAD,y1:toY(0),x2:SVG_W-SVG_PAD,y2:toY(0),stroke:T.border,strokeWidth:1,strokeDasharray:"4,3"}),
            // grid lines Y
            [0.25,0.5,0.75].map(function(r,i){
              var yy=SVG_PAD+(1-r)*(SVG_H-SVG_PAD*2);
              return ce("line",{key:i,x1:SVG_PAD,y1:yy,x2:SVG_W-SVG_PAD,y2:yy,stroke:T.border,strokeWidth:0.5});
            }),
            // X axis labels
            yrs.map(function(y){
              return ce("text",{key:y,x:toX(y),y:SVG_H-4,textAnchor:"middle",fontSize:10,fill:T.faint},"Y"+y);
            }),
            // paths
            ce("path",{d:mkPath(lines3.conservative),stroke:T.coral,strokeWidth:2,fill:"none",strokeDasharray:"5,3"}),
            ce("path",{d:mkPath(lines3.neutral),stroke:T.navy,strokeWidth:2.5,fill:"none"}),
            ce("path",{d:mkPath(lines3.optimistic),stroke:T.sage,strokeWidth:2,fill:"none",strokeDasharray:"5,3"}),
            // dots for active scenario
            lines3[roiScenario].map(function(v,i){
              return ce("circle",{key:i,cx:toX(i),cy:toY(v),r:4,fill:roiScenario==="conservative"?T.coral:roiScenario==="optimistic"?T.sage:T.navy,stroke:"#fff",strokeWidth:2});
            }),
            // Y axis labels (min/max)
            ce("text",{x:SVG_PAD-4,y:SVG_PAD+4,textAnchor:"end",fontSize:9,fill:T.faint},(maxV/10000).toFixed(0)+"\u842c"),
            ce("text",{x:SVG_PAD-4,y:SVG_H-SVG_PAD+4,textAnchor:"end",fontSize:9,fill:T.faint},(minV/10000).toFixed(0)+"\u842c")
          ),
          // Legend
          ce("div",{style:{display:"flex",gap:16,justifyContent:"center",marginTop:6}},
            [{l:"保守",c:T.coral,dash:true},{l:"中性",c:T.navy,dash:false},{l:"樂觀",c:T.sage,dash:true}].map(function(lg){
              return ce("div",{key:lg.l,style:{display:"flex",alignItems:"center",gap:4}},
                ce("svg",{width:24,height:4},ce("line",{x1:0,y1:2,x2:24,y2:2,stroke:lg.c,strokeWidth:lg.dash?1.5:2.5,strokeDasharray:lg.dash?"5,3":"none"})),
                ce("span",{style:{fontSize:10,color:T.muted}},lg.l));
            })))
        ),
      ce("div",{style:{display:"flex",gap:8,justifyContent:"flex-end"}},
        ce(Btn,{onClick:doSave,sz:"lg"},"儲存參數"),
        saved?ce(Tag,{c:"sage",style:{alignSelf:"center"}},"✅ 已儲存"):null)),

    tab==="dLayer"&&ce("div",{style:{display:"grid",gap:12}},
      ce(Card,null,
        ce(SecTitle,null,"D層健康識能環境佈置 — 投報試算"),
        ce(IBox,{c:"amber",style:{marginBottom:12}},"D層為選配項目。研究顯示健康識能環境佈置可提升員工對平台的認知與使用率，預期參與率提升 +10-15%，將直接影響 A 層ROI 效益。"),
        ce(SliderRow,{label:"D層佈置費用",k:"dLayerCost",min:20000,max:200000,step:10000,unit:"NT$",desc:"基礎型 NT$2-4萬 / 標準型 NT$6-12萬 / 完整型 NT$10-20萬",def:90000}),
        ce(SliderRow,{label:"參與率提升預估",k:"participantBoost",min:5,max:20,step:1,unit:"%",desc:"健康識能環境提升參與率(保守估算)",def:12})),
      ce(Card,{style:{background:"linear-gradient(135deg,"+T.amberBg+",#fff)",borderLeft:"4px solid "+T.amber}},
        ce(SecTitle,null,"D層投報分析"),
        ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12}},
          [{l:"佈置費用",v:"NT$"+(dLayerCost/10000).toFixed(1)+"萬",c:T.coral},
           {l:"提升人數",v:boostedN+"人",c:T.teal},
           {l:"額外效益",v:"NT$"+(dLayerROI/10000).toFixed(1)+"萬/年",c:T.sage}].map(function(k){
            return ce(Card,{key:k.l,style:{padding:"10px",textAlign:"center"}},
              ce("div",{style:{fontSize:17,fontWeight:800,color:k.c}},k.v),
              ce("div",{style:{fontSize:10,color:T.muted,marginTop:3}},k.l));
          })),
        ce("div",{style:{display:"grid",gap:8}},
          [{pkg:"基礎型",items:"海報套組+QR Code+衛教摺頁架設",fee:"NT$2-4萬",boost:"+5-8%"},
           {pkg:"標準型",items:"基礎型+健康公告欄+燈號展示板+施工",fee:"NT$6-12萬",boost:"+10-12%"},
           {pkg:"完整型",items:"標準型+數位看板+REIBI識別物料+場域規劃",fee:"NT$10-20萬",boost:"+13-15%"}].map(function(r){
            return ce("div",{key:r.pkg,style:{display:"flex",gap:10,padding:"10px 14px",background:T.bg,borderRadius:8,alignItems:"flex-start"}},
              ce("div",{style:{minWidth:60}},
                ce("div",{style:{fontWeight:800,fontSize:12,color:T.amber}},r.pkg),
                ce(Tag,{c:"amber",style:{marginTop:4}},r.boost)),
              ce("div",null,
                ce("div",{style:{fontSize:12,color:T.text,marginBottom:2}},r.items),
                ce("div",{style:{fontSize:11,color:T.muted}},r.fee)));
          })))),

    tab==="manual"&&ce("div",{style:{display:"grid",gap:12}},
      ce(Card,null,
        ce(SecTitle,null,"進階參數設定(手動輸入)"),
        ce("div",{style:{display:"grid",gap:12}},
          [{k:"headcount",label:"就業人數(人)",desc:"全公司就業人數",placeholder:"1000"},
           {k:"sickDays",label:"年平均病假天數(天)",desc:"依HR數據或業界均值",placeholder:"8"},
           {k:"avgDailySalary",label:"員工平均日薪(NT$)",desc:"月薪÷22工作日",placeholder:"3200"},
           {k:"insuranceSaving",label:"保險成本節省(NT$/人/年)",desc:"健促介入後預估節省",placeholder:"12000"},
           {k:"productivityGain",label:"生產力提升比例(%)",desc:"WPAI模型保守估算",placeholder:"15"},
           {k:"implementCost",label:"系統導入成本(NT$)",desc:"含軟體授權+設備+服務費",placeholder:"6000000"}].map(function(f){
            return ce("div",{key:f.k},
              ce("label",{style:{fontSize:12,fontWeight:700,color:T.text,display:"block",marginBottom:2}},f.label),
              ce("div",{style:{fontSize:11,color:T.muted,marginBottom:5}},f.desc),
              ce("input",{type:"number",value:params[f.k]||"",
                onChange:function(e){setParams(function(p){var u={};u[f.k]=Number(e.target.value);return Object.assign({},p,u);});setSaved(false);},
                placeholder:f.placeholder,
                style:{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box"}}));
          })),
        ce(Btn,{onClick:doSave,full:true,sz:"lg",style:{marginTop:8}},"儲存所有參數"),
        saved?ce("div",{style:{textAlign:"center",fontSize:12,color:T.sage,marginTop:8}},"✅ 參數已儲存，下次生成報告時自動套用。"):null)));
}


function AnnualStatsScreen({session,onBack,orgRecs}){
  const[dateFrom,setDateFrom]=useState("");
  const[dateTo,setDateTo]=useState("");
  const recs=orgRecs||[];
  const filtered=recs.filter(r=>{
    if(!r.ts)return true;
    const d=r.ts.slice(0,10);
    if(dateFrom&&d<dateFrom)return false;
    if(dateTo&&d>dateTo)return false;
    return true;
  });
  const n=filtered.length;
  const cnt=(key,val)=>filtered.filter(r=>r[key]===val).length;
  const lights={green:cnt("sKey","green"),yellow:cnt("sKey","yellow"),orange:cnt("sKey","orange"),red:cnt("sKey","red")};
  const painLights={green:cnt("pKey","green"),yellow:cnt("pKey","yellow"),orange:cnt("pKey","orange"),red:cnt("pKey","red")};
  const highRisk=lights.red+lights.orange;
  const kpiSleep=n?Math.round(lights.green/n*100):0;
  const kpiPain=n?Math.round(painLights.green/n*100):0;
  var mGreen=n?Math.round(filtered.filter(function(r){return r.mhiLevel==="green";}).length/n*100):0;
  var mHigh=n?Math.round(filtered.filter(function(r){return r.mhiLevel==="red"||r.mhiLevel==="orange";}).length/n*100):0;
  var owHigh=n?Math.round(filtered.filter(function(r){return r.owScore&&r.owScore>=4;}).length/n*100):0;
  // MHI三子指標彙整(僅統計有mhiScore的記錄)
  var mhiRecs=filtered.filter(function(r){return typeof r.mhiScore==="number";});
  var mhiN=mhiRecs.length;
  var avgNum=function(arr,key){return arr.length?Math.round(arr.reduce(function(a,r){return a+(r[key]||0);},0)/arr.length):null;};
  var mhiAvg=mhiN?avgNum(mhiRecs,"mhiScore"):null;
  var phqAvg=mhiN?avgNum(mhiRecs.filter(function(r){return r.phqNorm!=null;}),"phqNorm"):null;
  var pssAvg=mhiN?avgNum(mhiRecs.filter(function(r){return r.pssNorm!=null;}),"pssNorm"):null;
  var mindAvg=mhiN?avgNum(mhiRecs.filter(function(r){return r.mindNorm!=null;}),"mindNorm"):null;
  var mhiGoodPct=mhiN?Math.round(mhiRecs.filter(function(r){return r.mhiScore>=70;}).length/mhiN*100):null;
  var mhiCautionPct=mhiN?Math.round(mhiRecs.filter(function(r){return r.mhiScore<50;}).length/mhiN*100):null;
  // 趨勢折線：依月份計算每月mhiAvg、sleepGreen%、painGreen%
  var monthMap={};
  filtered.forEach(function(r){
    if(!r.ts)return;
    var ym=r.ts.slice(0,7);
    if(!monthMap[ym])monthMap[ym]={sleep:0,sleepN:0,pain:0,painN:0,mhi:0,mhiN:0};
    monthMap[ym].sleepN++;
    if(r.sKey==="green")monthMap[ym].sleep++;
    monthMap[ym].painN++;
    if(r.pKey==="green")monthMap[ym].pain++;
    if(typeof r.mhiScore==="number"){monthMap[ym].mhiN++;monthMap[ym].mhi+=r.mhiScore;}
  });
  var months=Object.keys(monthMap).sort();
  var trendData=months.map(function(m){
    var d=monthMap[m];
    return {m:m.slice(5),sleep:d.sleepN?Math.round(d.sleep/d.sleepN*100):null,
      pain:d.painN?Math.round(d.pain/d.painN*100):null,
      mhi:d.mhiN?Math.round(d.mhi/d.mhiN):null};
  });
  // SVG折線圖
  function TrendLine(props){
    var data=props.data||[];var W=340;var H=90;var px=28;var py=10;
    var vals=data.map(function(d){return d.v;}).filter(function(v){return v!==null;});
    if(!vals.length)return ce("div",{style:{fontSize:11,color:T.faint,textAlign:"center",padding:16}},"(尚無趨勢資料)");
    var min=0;var max=100;
    function sx(i){return px+i*(W-px*2)/(data.length-1||1);}
    function sy(v){return H-py-(v-min)/(max-min)*(H-py*2);}
    var pts=data.filter(function(d){return d.v!==null;}).map(function(d,_,arr){return [sx(data.indexOf(d)),sy(d.v)];});
    var path=pts.map(function(p,i){return (i===0?"M":"L")+p[0]+","+p[1];}).join(" ");
    return ce("svg",{width:"100%",viewBox:"0 0 "+W+" "+H,style:{display:"block"}},
      ce("line",{x1:px,y1:H-py,x2:W-px,y2:H-py,stroke:T.border,strokeWidth:1}),
      [80,60,40].map(function(v){return ce("line",{key:v,x1:px,y1:sy(v),x2:W-px,y2:sy(v),stroke:T.border,strokeWidth:.5,strokeDasharray:"3,3"});}),
      ce("path",{d:path,fill:"none",stroke:props.color||T.teal,strokeWidth:2,strokeLinejoin:"round"}),
      data.map(function(d,i){return d.v!==null?ce("circle",{key:i,cx:sx(i),cy:sy(d.v),r:3,fill:props.color||T.teal}):null;}),
      data.map(function(d,i){return ce("text",{key:"l"+i,x:sx(i),y:H,textAnchor:"middle",fontSize:8,fill:T.muted},d.m);}),
      pts.length>0&&ce("text",{x:W-px,y:sy(pts[pts.length-1][1])-6,textAnchor:"end",fontSize:9,fill:props.color||T.teal,fontWeight:700},data.filter(function(d){return d.v!==null;}).slice(-1)[0].v+(props.unit||"%")));
  }
  // OKR三階段
  const stage=kpiSleep>=80&&kpiPain>=80?"績優表揚":kpiSleep>=60&&kpiPain>=60?"優良肯定":"自主評核";
  const stageColor=stage==="績優表揚"?T.sage:stage==="優良肯定"?T.amber:T.muted;
  return ce(Screen,{title:"📊 年度統計報表",onBack,maxW:680,action:
    ce(Btn,{sz:"sm",v:"navy",onClick:()=>{
      const mhiLine=mhiAvg!==null?"MHI身心健康指數平均："+mhiAvg+"分 (n="+mhiN+")\nPHQ-4情緒(正規化)："+(phqAvg!==null?phqAvg+"分":"尚無資料")+"\nPSS-4壓力(正規化)："+(pssAvg!==null?pssAvg+"分":"尚無資料")+"\n正念覺察(正規化)："+(mindAvg!==null?mindAvg+"分":"尚無資料"):"MHI：尚無評估資料";
      const txt=["年度統計報表 — "+session.orgName,"日期區間："+( dateFrom||"不限")+" ~ "+(dateTo||"不限"),"","=== 睡眠燈號分佈 ===","綠燈(良好)："+lights.green+"人 ("+Math.round(lights.green/Math.max(n,1)*100)+"%)","黃燈(輕度)："+lights.yellow+"人","橙燈(中度)："+lights.orange+"人","紅燈(重度)："+lights.red+"人","","=== 疼痛燈號分佈 ===","綠燈(輕微)："+painLights.green+"人 ("+Math.round(painLights.green/Math.max(n,1)*100)+"%)","黃燈："+painLights.yellow+"人","橙燈："+painLights.orange+"人","紅燈："+painLights.red+"人","","=== 身心健康(MHI) ===",mhiLine,"","=== KPI達成率 ===","睡眠良好率："+kpiSleep+"%(目標80%)","疼痛輕微率："+kpiPain+"%(目標80%)","過勞高風險："+owHigh+"%(目標≤20%)","三階段評核："+stage,"","備注：本報告全程去識別化，不含個人識別資料。k-匿名性k≥5+差分隱私保護。"].join("\n");
      const blob=new Blob([txt],{type:"text/plain"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="年度統計_"+new Date().toLocaleDateString("zh-TW").replace(/\//g,"-")+".txt";a.click();
    }},"⬇ 下載報表")},
    ce(Card,{style:{marginBottom:14,padding:"12px 16px"}},
      ce("div",{style:{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}},
        ce("div",{style:{fontWeight:600,fontSize:13,color:T.text}},"查詢區間："),
        ce("input",{type:"date",value:dateFrom,onChange:e=>setDateFrom(e.target.value),style:{padding:"6px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:13}}),
        ce("span",{style:{color:T.muted}},"～"),
        ce("input",{type:"date",value:dateTo,onChange:e=>setDateTo(e.target.value),style:{padding:"6px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:13}}),
        ce(Btn,{sz:"sm",v:"ghost",onClick:()=>{setDateFrom("");setDateTo("");}  },"清除"),
        ce("div",{style:{fontSize:12,color:T.muted}},"共 "+n+" 筆資料"))),
    ce(Card,{style:{marginBottom:14,borderLeft:"4px solid "+stageColor}},
      ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
        ce("div",null,
          ce("div",{style:{fontSize:11,color:T.muted,marginBottom:2}},"自主評核 → 優良肯定 → 績優表揚"),
          ce("div",{style:{fontSize:20,fontWeight:800,color:stageColor}},"🏆 "+stage),
          ce("div",{style:{fontSize:12,color:T.muted,marginTop:2}},"睡眠良好率 "+kpiSleep+"% · 疼痛輕微率 "+kpiPain+"%(目標各≥80%)")),
        ce(Tag,{c:stage==="績優表揚"?"sage":stage==="優良肯定"?"amber":"gray"},stage))),
    ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}},
      ce(Card,null,
        ce(SecTitle,null,"🌙 睡眠燈號分佈"),
        Object.entries(lights).map(([k,v])=>{const lx=LX[k]||LX.green;return ce("div",{key:k,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"1px solid "+T.border}},ce("span",{style:{color:lx.c,fontSize:13,fontWeight:600}},lx.em+" "+lx.lbl),ce("div",{style:{textAlign:"right"}},ce("span",{style:{fontWeight:800,color:lx.c}},v+"人"),n>0&&ce("span",{style:{fontSize:11,color:T.muted,marginLeft:6}},"("+Math.round(v/n*100)+"%)")));})
      ),
      ce(Card,null,
        ce(SecTitle,null,"🩺 疼痛燈號分佈"),
        Object.entries(painLights).map(([k,v])=>{const lx=LX[k]||LX.green;return ce("div",{key:k,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"1px solid "+T.border}},ce("span",{style:{color:lx.c,fontSize:13,fontWeight:600}},lx.em+" "+lx.lbl),ce("div",{style:{textAlign:"right"}},ce("span",{style:{fontWeight:800,color:lx.c}},v+"人"),n>0&&ce("span",{style:{fontSize:11,color:T.muted,marginLeft:6}},"("+Math.round(v/n*100)+"%)")));})
      )
    ),
    // MHI完整分析區塊
    ce(Card,{style:{marginTop:14,borderLeft:"4px solid "+T.plum}},
      ce(SecTitle,null,"🧠 身心健康(MHI)完整分析"),
      mhiN===0?ce(IBox,{c:"amber",style:{fontSize:11}},"尚無MHI評估資料。成員需完成PHQ-4(情緒)、PSS-4(壓力)、正念自評三項評估，管理者開啟分析頁面後自動彙整。(v10.3.16起新增)"):
      ce("div",{style:{display:"grid",gap:12}},
        // 綜合指數+良好率
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}},
          ce(Card,{style:{background:T.plumBg,textAlign:"center",padding:"12px 8px"}},
            ce("div",{style:{fontSize:10,color:T.muted,marginBottom:4}},"MHI 綜合指數(平均)"),
            ce("div",{style:{fontSize:28,fontWeight:800,color:T.plum}},mhiAvg!==null?mhiAvg+"分":"—"),
            ce("div",{style:{fontSize:10,color:T.muted}},"0-100，越高越好，n="+mhiN)),
          ce(Card,{style:{background:T.sageBg,textAlign:"center",padding:"12px 8px"}},
            ce("div",{style:{fontSize:10,color:T.muted,marginBottom:4}},"身心良好率(≥70分)"),
            ce("div",{style:{fontSize:28,fontWeight:800,color:T.sage}},mhiGoodPct!==null?mhiGoodPct+"%":"—"),
            ce("div",{style:{fontSize:10,color:T.muted}},mhiCautionPct!==null?"需關注(<50分)："+mhiCautionPct+"%":""))),
        // 三子指標橫條
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}},
          [{label:"PHQ-4 情緒健康",val:phqAvg,color:"#be185d",bg:"#fdf2f8",desc:"越高=情緒越穩定"},
           {label:"PSS-4 壓力管理",val:pssAvg,color:T.amber,bg:T.amberBg,desc:"越高=壓力越低"},
           {label:"正念覺察",val:mindAvg,color:T.navy,bg:T.navyBg,desc:"自評正規化分"}
          ].map(function(item){
            return ce(Card,{key:item.label,style:{background:item.bg,textAlign:"center",padding:"10px 6px"}},
              ce("div",{style:{fontSize:10,color:T.muted,marginBottom:4}},item.label),
              ce("div",{style:{fontSize:20,fontWeight:800,color:item.color}},item.val!==null?item.val+"分":"—"),
              ce("div",{style:{height:4,background:"#e7e5e4",borderRadius:2,marginTop:6}},
                item.val!==null&&ce("div",{style:{width:item.val+"%",height:"100%",background:item.color,borderRadius:2}})),
              ce("div",{style:{fontSize:9,color:T.faint,marginTop:4}},item.desc));
          })),
        // 趨勢折線圖
        trendData.length>=2&&ce("div",null,
          ce("div",{style:{fontWeight:600,fontSize:12,color:T.muted,marginBottom:8}},"月度趨勢(最近"+trendData.length+"個月)"),
          ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}},
            [{key:"sleep",label:"🌙 睡眠良好率",color:T.teal},{key:"pain",label:"🩺 疼痛輕微率",color:T.sage},{key:"mhi",label:"🧠 MHI平均分",color:T.plum,unit:"分"}].map(function(tr){
              return ce(Card,{key:tr.key,style:{padding:"8px"}},
                ce("div",{style:{fontSize:10,color:T.muted,marginBottom:4}},tr.label),
                ce(TrendLine,{data:trendData.map(function(d){return {m:d.m,v:d[tr.key]};}),color:tr.color,unit:tr.unit||"%"}));
            }))))),
    ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:14}},
      ce(Card,null,
        ce(SecTitle,null,"⚡ 過勞風險統計"),
        ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid "+T.border}},
          ce("span",{style:{fontSize:13,color:T.red,fontWeight:600}},"🔴 高風險"),
          ce("span",{style:{fontWeight:800,color:T.red}},owHigh+"%")),
        ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0"}},
          ce("span",{style:{fontSize:13,color:T.sage,fontWeight:600}},"🟢 正常"),
          ce("span",{style:{fontWeight:800,color:T.sage}},(100-owHigh)+"%")),
        ce(IBox,{c:"amber",style:{marginTop:8,fontSize:11}},"過勞自評8題分數≥4為高風險")),
      ce(Card,null,
        ce(SecTitle,null,"📈 KPI / OKR 達成率"),
        [{label:"睡眠良好率(ISI綠燈)",val:kpiSleep,target:80,color:T.teal},{label:"疼痛輕微率(BPI綠燈)",val:kpiPain,target:80,color:T.sage},{label:"高風險比例(橙+紅燈)",val:n?Math.round(highRisk/n*100):0,target:20,color:T.red,rev:true},{label:"身心良好率(MHI≥70)",val:mhiGoodPct!==null?mhiGoodPct:0,target:80,color:T.plum}].map(function(m){
          const ok=m.rev?m.val<=m.target:m.val>=m.target;
          return ce("div",{key:m.label,style:{marginBottom:8}},
            ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}},
              ce("span",{style:{fontSize:11,color:T.text}},m.label),
              ce("div",{style:{display:"flex",alignItems:"center",gap:4}},ce("span",{style:{fontWeight:800,color:m.color,fontSize:13}},m.val+"%"),ce(Tag,{c:ok?"sage":"amber",style:{fontSize:9}},ok?"達標":"未達"))),
            ce("div",{style:{height:4,background:"#e7e5e4",borderRadius:2}},ce("div",{style:{width:Math.min(m.val,100)+"%",height:"100%",background:m.color,borderRadius:2}})));
        }))),
    ce(IBox,{c:"teal",style:{marginTop:14}},"ℹ 本報告全程去識別化處理(k-匿名性 k≥5，差分隱私保護)。不含任何個人識別資料。MHI為v10.3.16起新增，歷史紀錄中無mhiScore的筆數不計入MHI統計。"));
}


function AIReportScreen({onBack,orgRecs,title,reportType,params}){
  const[content,setContent]=useState("");const[loading,setLoading]=useState(false);const[prog,setProg]=useState(0);
  const[dateFrom,setDateFrom]=useState("");const[dateTo,setDateTo]=useState("");
  const recs=orgRecs||[];
  const filtered=dateFrom||dateTo?recs.filter(r=>{const d=r.ts&&r.ts.slice(0,10);if(dateFrom&&d<dateFrom)return false;if(dateTo&&d>dateTo)return false;return true;}):recs;
  const n=filtered.length;
  const p=params||DEFAULT_PARAMS;
  const prompts={
    esg:"你是ESG永續報告顧問。請生成完整ESG健康效益報告，涵蓋：\n①GRI 403-6健促覆蓋率揭露 ②SDG 3/8/10/17量化對應 ③IDG五大維度×WHO Ottawa Charter框架 ④888計畫三個80%達成分析 ⑤WHO NCD行動計畫2030對標 ⑥衛福部白皮書2023-2026對應\n⑦降本/增效/新商模三大利基點：\n- 降本：病假減少(年均"+p.sickDays+"天×日薪NT$"+p.avgDailySalary+")、保險節省(NT$"+p.insuranceSaving+"/人/年)\n- 增效：生產力提升"+p.productivityGain+"%、工作效率改善\n- 新商模：ESG量化報告作為供應鏈/IRESGr/IPO利基\n繁體中文，正式格式，至少2500字。",
    okr:"你是企業健康OKR顧問。請生成完整OKR績效報告，涵蓋：睡眠/疼痛/工作效率三大KPI達成率、888計畫8項指標、「自主評核→優良肯定→績優表揚」三階段評核說明、獎酬建議、下季OKR設定建議。繁體中文，至少2000字。",
    highrisk:"你是職場健康風險顧問。請生成高風險族群分析報告(全程去識別化)，涵蓋：紅/橙燈比例、重度失眠/極重度疼痛員工分布、EAP介入建議、後續追蹤方案。繁體中文，至少2000字。",
    kpi:"請生成KPI三大指標完整報告：ISI睡眠改善率、BPI疼痛改善率、WQ工作效率提升率，含三高補充指標覆蓋率說明、三階段管理評核進度。繁體中文，至少2000字。",
    roi:"你是企業健促ROI財務顧問。依以下參數生成ROI財務效益完整分析：\n病假天數:"+p.sickDays+"天/人/年、日薪:NT$"+p.avgDailySalary+"、保險節省:NT$"+p.insuranceSaving+"/人/年、生產力提升:"+p.productivityGain+"%、導入成本:NT$"+p.implementCost+"。\n涵蓋：WPAI公式量化、醫療成本節省、三年投資回報預測(ROI計算)、CAPEX/OPEX分析、與業界benchmark比較。繁體中文，正式格式，至少2000字。",
    plan888:"請生成888計畫達成率完整分析：三個80%進度(早期發現三高/接受生活諮商/病情有效控制)、8項健康指標逐一分析、三階段管理評核。繁體中文，至少2000字。",
  };
  const doGen=async()=>{
    setLoading(true);setContent("");setProg(0);
    const stats="員工總數:"+n+" 睡眠綠燈:"+filtered.filter(r=>r.sKey==="green").length+"人 橙燈:"+filtered.filter(r=>r.sKey==="orange").length+"人 紅燈:"+filtered.filter(r=>r.sKey==="red").length+"人 日期區間:"+(dateFrom||"不限")+"~"+(dateTo||"不限");
    const prompt=(prompts[reportType]||prompts.esg)+"\n\n企業健康數據(去識別化)："+stats;
    let t=0;const pi=setInterval(()=>{t+=6;setProg(Math.min(t,90));},300);
    const txt=await callAI(prompt,7000);
    clearInterval(pi);setProg(100);setContent(txt||"報告生成失敗，請重試。若問題持續，請聯絡麗媚客服。");setLoading(false);
  };
  return ce(Screen,{title:title||"📊 AI完整報告",onBack,maxW:700,action:content&&ce(Btn,{sz:"sm",v:"navy",onClick:()=>{const blob=new Blob([content],{type:"text/plain"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=(title||"報告")+"_"+new Date().toLocaleDateString("zh-TW").replace(/\//g,"-")+".txt";a.click();}},"⬇ 下載報告")},
    // ⑭ Date range filter
    ce(Card,{style:{marginBottom:14,padding:"12px 16px"}},
      ce("div",{style:{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}},
        ce("div",{style:{fontWeight:600,fontSize:13,color:T.text}},"日期區間："),
        ce("input",{type:"date",value:dateFrom,onChange:e=>setDateFrom(e.target.value),style:{padding:"6px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:13}}),
        ce("span",{style:{color:T.muted}},"～"),
        ce("input",{type:"date",value:dateTo,onChange:e=>setDateTo(e.target.value),style:{padding:"6px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:13}}),
        ce(Btn,{sz:"sm",v:"ghost",onClick:()=>{setDateFrom("");setDateTo("");}},"清除"),
        ce("div",{style:{fontSize:12,color:T.muted}},"共 "+n+" 筆資料("+( dateFrom||"不限")+" ~ "+(dateTo||"不限")+")"))),
    !content&&!loading&&ce(Card,{style:{textAlign:"center",padding:40}},ce("div",{style:{fontSize:40,marginBottom:16}},"📄"),ce("h3",{style:{color:T.teal,marginBottom:8}},"生成 "+title),ce("p",{style:{color:T.muted,fontSize:13,marginBottom:20}},"AI將依去識別化健康數據生成完整報告，預計需要30-60秒。"),ce(Btn,{onClick:doGen,sz:"lg"},"開始生成報告")),
    loading&&ce(Card,{style:{padding:30}},ce("div",{style:{textAlign:"center",marginBottom:16}},ce("div",{style:{fontSize:24,marginBottom:8}},"⚙"),ce("div",{style:{fontWeight:700,color:T.teal}},"AI分析中...")),ce("div",{style:{height:8,background:"#e7e5e4",borderRadius:4}},ce("div",{style:{width:prog+"%",height:"100%",background:T.teal,borderRadius:4,transition:"width .3s"}})),ce("div",{style:{textAlign:"center",fontSize:12,color:T.muted,marginTop:8}},prog+"%")),
    content&&ce(Card,{style:{whiteSpace:"pre-wrap",lineHeight:1.8,fontSize:13,color:T.text}},content));
}


function KPIScreen({onBack,orgRecs}){
  const recs=orgRecs||[];const n=recs.length;
  const gS=n?Math.round(recs.filter(r=>r.sKey==="green").length/n*100):0;
  const gP=n?Math.round(recs.filter(r=>r.pKey==="green").length/n*100):0;
  const hi=n?Math.round(recs.filter(r=>r.sKey==="red"||r.sKey==="orange").length/n*100):0;
  // MHI 綜合與三子指標(僅統計有 mhiScore 的記錄)
  var mhiRecs=recs.filter(function(r){return typeof r.mhiScore==="number";});
  var mhiN=mhiRecs.length;
  var avgNum=function(arr,key){return arr.length?Math.round(arr.reduce(function(a,r){return a+(r[key]||0);},0)/arr.length):null;};
  var mhiAvg=mhiN?avgNum(mhiRecs,"mhiScore"):null;
  var phqAvg=mhiN?avgNum(mhiRecs.filter(function(r){return r.phqNorm!=null;}),"phqNorm"):null;
  var pssAvg=mhiN?avgNum(mhiRecs.filter(function(r){return r.pssNorm!=null;}),"pssNorm"):null;
  var mindAvg=mhiN?avgNum(mhiRecs.filter(function(r){return r.mindNorm!=null;}),"mindNorm"):null;
  var mhiGreen=mhiN?Math.round(mhiRecs.filter(function(r){return r.mhiLevel==="green";}).length/mhiN*100):null;
  return ce(Screen,{title:"📈 KPI 總覽",onBack,maxW:640},
    ce(Card,{style:{background:T.tealBg,border:"1px solid "+T.tealLight,marginBottom:14}},
      ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
        ce("div",null,ce("div",{style:{fontWeight:700,color:T.teal}},"本期評估人數"),ce("div",{style:{fontSize:30,fontWeight:800,color:T.teal}},n)),
        ce("div",{style:{fontSize:12,color:T.muted,textAlign:"right"}},"888計畫目標：各指標達80%"))),
    ce("div",{style:{display:"grid",gap:12}},
      [{label:"睡眠良好率(ISI綠燈)",val:gS,target:80,color:T.teal,rev:false},
       {label:"疼痛輕微率(BPI綠燈)",val:gP,target:80,color:T.sage,rev:false},
       {label:"高風險比例(橙+紅燈)",val:hi,target:20,color:T.red,rev:true},
       {label:"評估參與率",val:n>0?100:0,target:80,color:T.amber,rev:false}
      ].map(function(m){
        const ok=m.rev?m.val<=m.target:m.val>=m.target;
        return ce(Card,{key:m.label},
          ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}},
            ce("div",{style:{fontWeight:600,fontSize:13,color:T.text}},m.label),
            ce("div",{style:{display:"flex",alignItems:"center",gap:8}},
              ce("span",{style:{fontSize:22,fontWeight:800,color:m.color}},m.val+"%"),
              ce(Tag,{c:ok?"sage":"amber"},ok?"達標":"未達標"))),
          ce("div",{style:{height:6,background:"#e7e5e4",borderRadius:3}},
            ce("div",{style:{width:Math.min(m.val,100)+"%",height:"100%",background:m.color,borderRadius:3}})));
      })),
    ce(Card,{style:{marginTop:12,borderLeft:"4px solid "+T.plum}},
      ce(SecTitle,null,"🧠 MHI 身心健康指數 KPI"),
      mhiN===0?ce(IBox,{c:"amber",style:{fontSize:11}},"尚無 MHI 評估資料。成員需完成 PHQ-4(情緒)、PSS-4(壓力)、正念自評三項評估，管理者開啟分析頁面後自動彙整。"):
      ce("div",{style:{display:"grid",gap:10}},
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:4}},
          ce(Card,{style:{background:T.plumBg,textAlign:"center",padding:"12px 8px"}},
            ce("div",{style:{fontSize:10,color:T.muted,marginBottom:4}},"MHI 綜合指數(平均)"),
            ce("div",{style:{fontSize:28,fontWeight:800,color:T.plum}},mhiAvg!==null?mhiAvg+"分":"—"),
            ce("div",{style:{fontSize:10,color:T.muted}},"0-100分，越高越好，n="+mhiN)),
          ce(Card,{style:{background:T.sageBg,textAlign:"center",padding:"12px 8px"}},
            ce("div",{style:{fontSize:10,color:T.muted,marginBottom:4}},"身心良好率(MHI綠燈)"),
            ce("div",{style:{fontSize:28,fontWeight:800,color:T.sage}},mhiGreen!==null?mhiGreen+"%":"—"),
            ce("div",{style:{fontSize:10,color:T.muted}},"目標≥80%",mhiGreen!==null&&mhiGreen>=80&&ce(Tag,{c:"sage",style:{marginLeft:6}},"達標")))),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}},
          [{label:"PHQ-4 情緒",val:phqAvg,color:"#be185d",bg:"#fdf2f8",desc:"正規化分(越高=情緒越穩定)"},
           {label:"PSS-4 壓力",val:pssAvg,color:T.amber,bg:T.amberBg,desc:"正規化分(越高=壓力越低)"},
           {label:"正念覺察",val:mindAvg,color:T.navy,bg:T.navyBg,desc:"自評正規化分"}
          ].map(function(item){
            return ce(Card,{key:item.label,style:{background:item.bg,textAlign:"center",padding:"10px 6px"}},
              ce("div",{style:{fontSize:10,color:T.muted,marginBottom:4}},item.label),
              ce("div",{style:{fontSize:20,fontWeight:800,color:item.color}},item.val!==null?item.val+"分":"—"),
              ce("div",{style:{fontSize:9,color:T.faint}},item.desc));
          })))),
    ce(IBox,{c:"teal",style:{marginTop:14}},"ℹ 三高數據為選填，KPI計算以有填報者為分母。差分隱私及k-匿名性保護(k≥5)。MHI為v10.3.16起新增，歷史紀錄中無mhiScore的筆數不計入MHI統計。"));
}


function Plan888Screen({onBack,orgRecs,orgTH}){
  const recs=orgRecs||[];const n=recs.length;
  var thVal=null;var thNote="";
  if(orgTH&&!orgTH.suppressed&&orgTH.n>=5){
    thVal=orgTH.coverageRate||0;
    thNote="實際填報"+orgTH.n+"/"+orgTH.totalMembers+"人 ("+orgTH.coverageRate+"%)";
  }else if(orgTH&&orgTH.suppressed){
    thNote="填報人數不足5人，依k≥5匿名保護原則暫不顯示統計(已有"+orgTH.n+"人填報，再補"+(5-orgTH.n)+"人即可)";
  }else{
    thNote="尚無填報記錄，成員填入三高數值後自動計算";
  }
  // MHI統計
  var mhiRecs=recs.filter(function(r){return typeof r.mhiScore==="number";});
  var mhiN=mhiRecs.length;
  var mhiGoodPct=mhiN>=5?Math.round(mhiRecs.filter(function(r){return r.mhiScore>=70;}).length/mhiN*100):null;
  var mhiVal=mhiGoodPct;
  var mhiNote=mhiN===0?"尚無MHI評估資料。成員需完成PHQ-4+PSS-4+正念自評三項，管理者進入分析頁面後自動彙整":
    mhiN<5?"MHI評估筆數不足5筆(k≥5保護，目前"+mhiN+"筆)，達5筆後自動計算":
    "MHI綜合指數≥70分(良好)比例，n="+mhiN;
  const goals=[
    {label:"80% 早期發現三高",desc:"三高數值填報覆蓋率",val:thVal,note:thNote,icon:"🔍"},
    {label:"80% 接受生活諮商",desc:"AI建議生成率+行動打卡完成率",val:n>0?Math.round(n/Math.max(n,1)*100):0,note:"以已提交評估視為已收到AI建議(近似值)",icon:"💊"},
    {label:"80% 病情獲有效控制",desc:"睡眠+疼痛燈號改善率(橙/紅→黃/綠)",val:n>0?Math.round(recs.filter(function(r){return r.sKey==="green"&&r.pKey==="green";}).length/n*100):0,note:"依評估紀錄計算睡眠+疼痛皆達綠燈比例",icon:"💪"},
    {label:"MHI 身心健康達標率",desc:"MHI綜合指數≥70分(良好)佔比",val:mhiVal,note:mhiNote,icon:"🧠",isExtra:true}
  ];
  const inds=[
    {n:"①",l:"睡眠品質(ISI)",s:"<8分",f:"每週",t:"主要"},
    {n:"②",l:"疼痛管理(BPI)",s:"<13分",f:"每週",t:"主要"},
    {n:"③",l:"工作效率(WQ)",s:"改善≥20%",f:"每週",t:"主要"},
    {n:"④",l:"血壓管理",s:"<130/80",f:"年度更新",t:"補充"},
    {n:"⑤",l:"血糖管理",s:"空腹<100",f:"年度更新",t:"補充"},
    {n:"⑥",l:"血脂(LDL)",s:"<100",f:"年度更新",t:"補充"},
    {n:"⑦",l:"BMI/腰圍管理",s:"BMI 18.5-24",f:"每月",t:"次要"},
    {n:"⑧",l:"評估參與率",s:"≥80%",f:"每週",t:"主要"},
    {n:"⑧+",l:"MHI 身心健康(PHQ-4+PSS-4+正念)",s:"MHI≥70分",f:"依各子評估",t:"強化"}
  ];
  return ce(Screen,{title:"📋 888計畫達成率",onBack,maxW:640},
    ce("div",{style:{display:"grid",gap:10,marginBottom:16}},
      goals.map(function(g){
        var ok=g.val!==null&&g.val>=80;
        var borderColor=g.isExtra?T.plum:(ok?T.sage:g.val===null?T.faint:T.amber);
        return ce(Card,{key:g.label,style:{borderLeft:"4px solid "+borderColor}},
          ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}},
            ce("div",null,
              ce("div",{style:{fontWeight:700,fontSize:13,color:g.isExtra?T.plum:T.text}},g.icon+" "+g.label+(g.isExtra?" (延伸追蹤)":"")),
              ce("div",{style:{fontSize:11,color:T.muted}},g.desc)),
            ce("div",{style:{textAlign:"right"}},
              ce("div",{style:{fontSize:22,fontWeight:800,color:ok?T.sage:g.val===null?T.faint:g.isExtra?T.plum:T.amber}},
                g.val===null?"尚無資料":g.val+"%"),
              g.val!==null&&ce(Tag,{c:ok?"sage":g.isExtra?"plum":"amber"},ok?"達標":g.isExtra?"追蹤中":"未達標"))),
          g.val!==null&&ce("div",{style:{height:5,background:"#e7e5e4",borderRadius:3}},
            ce("div",{style:{width:Math.min(g.val,100)+"%",height:"100%",background:ok?T.sage:g.isExtra?T.plum:T.amber,borderRadius:3}})),
          g.note&&ce("div",{style:{fontSize:10,color:g.val===null?T.faint:T.muted,marginTop:6}},"ℹ "+g.note));
      })),
    ce(Card,null,
      ce(SecTitle,null,"8+1項健康指標"),
      ce(IBox,{c:"plum",style:{marginBottom:8,fontSize:11}},"⑧+ 為REIBI平台延伸追蹤指標，補強888計畫原有8項，新增身心健康維度。"),
      inds.map(function(ind){
        return ce("div",{key:ind.n,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid "+T.border,fontSize:12,background:ind.t==="強化"?T.plumBg:"transparent",paddingLeft:ind.t==="強化"?6:0,borderRadius:ind.t==="強化"?4:0}},
          ce("div",null,
            ce("span",{style:{fontWeight:700,color:ind.t==="強化"?T.plum:T.teal,marginRight:6}},ind.n),
            ce("span",{style:{color:T.text}},ind.l),
            ce("span",{style:{color:T.muted,marginLeft:6}},"("+ind.f+")")),
          ce("div",{style:{display:"flex",gap:6,alignItems:"center"}},
            ce("span",{style:{color:T.muted,fontSize:11}},ind.s),
            ce(Tag,{c:ind.t==="主要"?"teal":ind.t==="補充"?"gray":ind.t==="強化"?"plum":"amber"},ind.t)));
      })));
}


function AuditScreen({onBack}){
  const logs=AL.all();
  return ce(Screen,{title:"🔐 稽核日誌",onBack,maxW:640},ce(IBox,{c:"teal",style:{marginBottom:14}},"本工作階段存取記錄(最新100筆)· 稽核姓名綁定 · 零信任(Zero Trust)驗證 · AES-256-GCM加密"),logs.length===0?ce(Card,{style:{textAlign:"center",padding:30,color:T.muted}},"本工作階段無記錄"):ce("div",{style:{display:"grid",gap:6}},logs.map(l=>ce(Card,{key:l.id,style:{padding:"8px 14px",borderLeft:"3px solid "+(l.action.includes("FAIL")||l.action.includes("WRONG")?T.red:l.action.includes("OK")||l.action.includes("done")||l.action.includes("COMPLETE")?T.sage:T.teal)}},ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},ce("div",null,ce("span",{style:{fontSize:12,fontWeight:700,color:T.text}},l.action),l.detail&&ce("span",{style:{fontSize:11,color:T.muted,marginLeft:8}},l.detail)),ce("span",{style:{fontSize:10,color:T.faint,whiteSpace:"nowrap"}},new Date(l.ts).toLocaleTimeString("zh-TW")+" · "+l.role))))));
}


function SecurityDocScreen({onBack}){
  const sections=[
    {title:"一、平台架構概述",content:"REIBI健康自主管理平台為純瀏覽器型(Browser-Based)SaaS應用，無需企業端安裝任何軟體或硬體基礎設施。所有運算在用戶端執行，資料透過加密通道傳輸。"},
    {title:"二、加密標準",content:"資料加密：AES-256-GCM(Galois/Counter Mode)非對稱加密。金鑰衍生：PBKDF2(100,000次迭代，SHA-256)。傳輸加密：TLS 1.3(所有API通訊)。PIN雜湊：SHA-256(加鹽，REIBI-SALT-2025-v1)。"},
    {title:"三、零信任架構(Zero Trust Architecture)",content:"應用層ZTA：每次敏感操作均重新驗證Session有效性(30分鐘閒置自動登出)。最小權限原則：RBAC八層角色，每角色僅存取必要功能，職責分離(SoD)。稽核日誌：所有存取行為記錄至個人名稱，PIN錯誤5次鎖定30分鐘。免部署：REIBI為純應用層ZTA，企業無需自行建置PDP/PEP/PIP基礎設施，降低IT導入成本。"},
    {title:"四、隱私保護機制",content:"k-匿名性(k≥5)：統計報告中，群組人數低於5人時自動抑制輸出，防止個人身份推斷。差分隱私(Differential Privacy)：Laplace機制，epsilon=0.8，在計數統計中加入隨機噪音。去識別化：組織報告全程移除個人直接識別資訊，僅保留匿名化指標。資料最小化：三高數值為選填，系統不強制收集超出必要範圍的個人資料。"},
    {title:"五、RBAC八層角色 + 雙層驗證",content:"L1個人用戶→L2單位成員→L3部門主管→L4a HR管理者→L4b財務管理者→L4c IT管理者→L4主要管理者→L5 REIBI超管。雙層驗證：第一層群組碼(成員/主管)，第二層個人名稱+PIN(管理者)。IDG五大維度整合：Being存在覺察(四色燈號)、Thinking批判思維(AI循證建議)、Relating同理關係(EAP資源)、Collaborating協作共創(OKR/ESG/GRI)、Acting行動實踐(行動打卡22項)。"},
    {title:"六、法規合規",content:"台灣個資法：資料處理目的明確，設有刪除權(Right to Erasure)入口。GDPR概念設計：資料最小化、目的限制、存取透明化。HIPAA-ready：本平台儲存匿名評估分數(非PHI)，一般使用無需HIPAA認證。如需與醫療院所系統整合，可簽署BAA(商業夥伴協議)，建議委託資策會或勤業眾信進行第三方稽核。"},
    {title:"七、建議給IT部門",content:"瀏覽器需求：Chrome 90+ / Safari 14+ / Firefox 88+(支援WebCrypto API)。網路需求：HTTPS(443埠)，無需開放其他連接埠。資安審查：建議每年進行滲透測試，可委託中華資安國際(CHT Security)或叡揚資訊。緊急聯絡：資安事件請聯絡REIBI IT：reibiservice@gmail.com(24小時內回應)。"},
  ];
  return ce(Screen,{title:"🔐 安全架構文件(IT技術評估用)",onBack,maxW:700},
    ce(IBox,{c:"navy",style:{marginBottom:16}},"本文件供企業IT/資安部門技術評估使用。版本：v10(2025)· 麗媚生化科技 REIBI · 機密文件"),
    sections.map(s=>ce(Card,{key:s.title,style:{marginBottom:12,borderLeft:"4px solid "+T.teal}},
      ce("div",{style:{fontWeight:700,fontSize:13,color:T.teal,marginBottom:8}},s.title),
      ce("p",{style:{fontSize:13,color:T.muted,lineHeight:1.8,margin:0}},s.content))),
    ce(IBox,{c:"amber",style:{marginTop:8}},"BAA(Business Associate Agreement)：本平台儲存匿名評估分數，非HIPAA定義之PHI。旗艦型客戶如需與醫療院所系統整合，可選購BAA服務，建議委託資策會、勤業眾信(Deloitte Taiwan)、安侯建業(KPMG Taiwan)或中華資安國際進行第三方稽核。"));
}


function PricingScreen({onBack}){
  const planA=[
    {range:"≤100人",annual:"NT$60萬/年",yr3:"NT$180萬"},
    {range:"101–300人",annual:"NT$120萬/年",yr3:"NT$360萬"},
    {range:"301–500人",annual:"NT$180萬/年",yr3:"NT$540萬"},
    {range:"501–1,000人",annual:"NT$300萬/年",yr3:"NT$900萬"},
    {range:"1,000人+",annual:"客製議定",yr3:"客製"},
  ];
  const planB=[
    {icon:"🟢",plan:"基本型 ≤100人",bed:"1台",chair:"1台",la200:"1組",fee:"NT$169.94萬"},
    {icon:"🔵",plan:"成長型 101–300人",bed:"2台",chair:"2台",la200:"2組",fee:"NT$339.88萬"},
    {icon:"🟡",plan:"專業型 301–500人",bed:"3台",chair:"3台",la200:"3組",fee:"NT$509.82萬"},
    {icon:"🔴",plan:"旗艦型 501–1,000人",bed:"5台",chair:"5台",la200:"5組",fee:"NT$849.70萬"},
  ];
  const planC=[
    {plan:"基本型 5人",annual:"NT$3.5萬",yr3:"NT$10.5萬",days:"1天"},
    {plan:"成長型 10人",annual:"NT$7萬",yr3:"NT$21萬",days:"1天"},
    {plan:"專業型 15人",annual:"NT$10.5萬",yr3:"NT$31.5萬",days:"1–2天"},
    {plan:"旗艦型 30人",annual:"NT$21萬",yr3:"NT$63萬",days:"3–4天"},
  ];
  const total=[
    {icon:"🟢",plan:"基本型 ≤100人",a:"NT$180萬",b:"NT$169.94萬",cv:"NT$10.5萬",t:"約NT$360萬"},
    {icon:"🔵",plan:"成長型 101–300人",a:"NT$360萬",b:"NT$339.88萬",cv:"NT$21萬",t:"約NT$721萬"},
    {icon:"🟡",plan:"專業型 301–500人",a:"NT$540萬",b:"NT$509.82萬",cv:"NT$31.5萬",t:"約NT$1,081萬"},
    {icon:"🔴",plan:"旗艦型 501–1,000人",a:"NT$900萬",b:"NT$849.70萬",cv:"NT$63萬",t:"約NT$1,813萬"},
  ];
  const thdr=(labels)=>ce("div",{style:{display:"grid",gridTemplateColumns:"repeat("+labels.length+",1fr)",gap:8,padding:"6px 0",borderBottom:"2px solid "+T.border,marginBottom:6}},labels.map(l=>ce("div",{key:l,style:{fontSize:11,fontWeight:700,color:T.muted}},l)));
  const trow=(cells,highlight)=>ce("div",{style:{display:"grid",gridTemplateColumns:"repeat("+cells.length+",1fr)",gap:8,padding:"6px 0",borderBottom:"1px solid "+T.border,background:highlight?T.amberBg:"transparent"}},cells.map((v,i)=>ce("div",{key:i,style:{fontSize:12,color:i===cells.length-1?T.amber:T.text,fontWeight:i===cells.length-1?700:400}},v)));
  return ce(Screen,{title:"💼 服務方案與定價",onBack,maxW:700},
    ce(IBox,{c:"navy",style:{marginBottom:16}},"以下為四層整合定價(3年建置費)。A層軟體年授權 + B層硬體設備 + C層高管量測 + D層健康識能環境佈置(選配)。帳號上限：依方案人數上限，達限時攔截並提醒升級方案。實際報價依方案規格而定，請聯絡麗媚業務：reibiservice@gmail.com"),
    ce(Card,{style:{marginBottom:14}},
      ce(SecTitle,null,"Layer A · 軟體平台年授權費"),
      thdr(["人數規模","年授權費","3年費用"]),
      planA.map(r=>trow([r.range,r.annual,r.yr3],r.range==="≤100人"))),
    ce(Card,{style:{marginBottom:14}},
      ce(SecTitle,null,"Layer B · 硬體設備(一次性採購)"),
      ce(IBox,{c:"teal",style:{marginBottom:10}},"舒曼波雲朵床(7.83Hz，NT$80萬/台)· 舒曼波樂活電動椅(7.83Hz，NT$75萬/台)· UIS•REIBI LA200光能緩解疼痛體驗設備(660-808nm LLLT，NT$14.94萬/組)"),
      thdr(["方案","雲朵床","樂活椅","LA200","設備費"]),
      planB.map(r=>trow([r.icon+" "+r.plan,r.bed,r.chair,r.la200,r.fee]))),
    ce(Card,{style:{marginBottom:14}},
      ce(SecTitle,null,"Layer C · 高管健康量測加值服務(年度)"),
      ce(IBox,{c:"amber",style:{marginBottom:10}},"自律神經量測(50分/人，8-10人/天)+ 生物資訊檢測(25分/人，16-20人/天)同時進行，3-4位麗媚服務人員"),
      thdr(["方案","年費","3年費用","服務天數"]),
      planC.map(r=>trow([r.plan,r.annual,r.yr3,r.days]))),
    ce(Card,{style:{marginBottom:14}},
      ce(SecTitle,null,"Layer D · 健康識能環境佈置(選配)"),
      ce(IBox,{c:"teal",style:{marginBottom:10}},"一次性佈置費用。協助企業建立實體健康識能環境，強化員工健康意識與REIBI品牌識別。付款：50%訂金→50%完工驗收。"),
      thdr(["套組","內容項目","費用估算"]),
      [{pkg:"基礎型",items:"健康主題海報套組(6張)+ QR Code 評估入口貼紙 + 衛教摺頁架設",fee:"NT$2-4萬"},{pkg:"標準型",items:"基礎型全部 + 健康公告欄(客製布版)+ 燈號說明展示板 + 到場施工",fee:"NT$6-12萬"},{pkg:"完整型",items:"標準型全部 + 數位看板輸出 + REIBI品牌識別物料 + 場域動線規劃",fee:"NT$10-20萬"}].map(function(r){return trow([r.pkg,r.items,r.fee]);})),
    ce(Card,{style:{background:T.amberBg,border:"1px solid #fcd34d"}},
      ce(SecTitle,null,"四層整合定價(3年總建置費)"),
      ce(IBox,{c:"amber",style:{marginBottom:10}},"D層為選配，下表以標準型(NT$6-12萬)中間值NT$9萬計入參考。"),
      thdr(["方案","A層軟體","B層設備","C層高管","D層場佈","3年總費"]),
      [{icon:"🟢",plan:"基本型 ≤100人",a:"NT$180萬",b:"NT$169.94萬",cv:"NT$10.5萬",d:"NT$9萬",t:"約NT$369萬"},{icon:"🔵",plan:"成長型 101–300人",a:"NT$360萬",b:"NT$339.88萬",cv:"NT$21萬",d:"NT$9萬",t:"約NT$730萬"},{icon:"🟡",plan:"專業型 301–500人",a:"NT$540萬",b:"NT$509.82萬",cv:"NT$31.5萬",d:"NT$12萬",t:"約NT$1,093萬"},{icon:"🔴",plan:"旗艦型 501–1,000人",a:"NT$900萬",b:"NT$849.70萬",cv:"NT$63萬",d:"NT$15萬",t:"約NT$1,828萬"}].map(function(r){return trow([r.icon+" "+r.plan,r.a,r.b,r.cv,r.d,r.t],true);})),
      ce(IBox,{c:"navy",style:{marginTop:10}},"D層場佈為選配項目，不含於A+B+C三層基本報價中。建議於導入初期一併規劃，可強化員工對平台的認知與使用率(預期提升參與率+10-15%)。"));
}


function GRIScreen({onBack,orgRecs,params}){
  var recs=orgRecs||[];var n=recs.length;var p=params||DEFAULT_PARAMS;
  var gS=n?Math.round(recs.filter(function(r){return r.sKey==="green";}).length/n*100):0;
  var gP=n?Math.round(recs.filter(function(r){return r.pKey==="green";}).length/n*100):0;
  // MHI量化數據
  var mhiRecs=recs.filter(function(r){return typeof r.mhiScore==="number";});
  var mhiN=mhiRecs.length;
  var avgNum=function(arr,key){return arr.length?Math.round(arr.reduce(function(a,r){return a+(r[key]||0);},0)/arr.length):null;};
  var mhiAvg=mhiN>=5?avgNum(mhiRecs,"mhiScore"):null;
  var phqAvg=mhiN>=5?avgNum(mhiRecs.filter(function(r){return r.phqNorm!=null;}),"phqNorm"):null;
  var pssAvg=mhiN>=5?avgNum(mhiRecs.filter(function(r){return r.pssNorm!=null;}),"pssNorm"):null;
  var mindAvg=mhiN>=5?avgNum(mhiRecs.filter(function(r){return r.mindNorm!=null;}),"mindNorm"):null;
  var mhiGoodPct=mhiN>=5?Math.round(mhiRecs.filter(function(r){return r.mhiScore>=70;}).length/mhiN*100):null;
  var mhiLine=mhiN>=5?
    "身心健康指數(MHI)綜合平均："+mhiAvg+"/100(n="+mhiN+")。身心良好率(MHI≥70分)："+mhiGoodPct+"%。三子指標正規化平均：PHQ-4情緒調節 "+(phqAvg!==null?phqAvg+"分":"—")+"、PSS-4壓力管理 "+(pssAvg!==null?pssAvg+"分":"—")+"、正念覺察 "+(mindAvg!==null?mindAvg+"分":"—")+"(0-100分，越高越好)。":
    "身心健康(MHI)追蹤：情緒調節(PHQ-4)/壓力管理(PSS-4)/正念覺察三子指標，樣本累積中(目前"+mhiN+"筆，k≥5後輸出量化數據)。";
  var[toast,setToast]=useState("");
  var[copied,setCopied]=useState("");
  var doCopy=function(key,text){
    navigator.clipboard.writeText(text).then(function(){
      setCopied(key);
      setToast("已複製「"+key+"」段落，可直接貼入永續報告書");
      setTimeout(function(){setCopied("");},2000);
    }).catch(function(){
      setToast("複製失敗，請手動選取文字複製");
    });
  };
  var items=[
    {std:"GRI 403-6",title:"促進員工健康",
     content:"本企業透過REIBI健康自主管理平台，提供員工每週ISI失眠嚴重度量表(7題)及BPI疼痛干擾量表(5題)評估，輔以WQ工作效率量表(3題)，共19題。評估結果以四色燈號(綠/黃/橙/紅)即時呈現，AI生成六面向個人化健康建議(睡眠/疼痛/飲食/運動/三高管理/REIBI體驗)。平台採AES-256-GCM加密、k-匿名性(k≥5)與差分隱私(epsilon=0.8)保護員工隱私。"},
    {std:"GRI 403-6a",title:"健促覆蓋率",
     content:"覆蓋員工人數："+n+"人。本期健促方案覆蓋率：100%(平台對全體員工開放)。睡眠健康良好率(ISI綠燈)："+gS+"%。疼痛輕微率(BPI綠燈)："+gP+"%。"+mhiLine},
    {std:"GRI 403-9",title:"在職失能及缺勤(WQ指標)+過勞高風險揭露",
     content:(function(){
       var owHighRisk=recs.filter(function(r){return (r.sKey==="red"||r.sKey==="orange")&&(r.pKey==="red"||r.pKey==="orange");});
       var owPct=n>0?Math.round(owHighRisk.length/n*100):0;
       var owLine=n>=5?"過勞高風險族群(ISI+BPI雙燈橙紅交叉指標)："+owHighRisk.length+"人/"+n+"人("+owPct+"%)。依職業促發腦心血管疾病預防指引，已設定評估頻率與追蹤機制。":"過勞高風險指標：評估人數不足(目前"+n+"人，k≥5後輸出量化數據)。";
       return "工作效率量表(WQ)評估睡眠/疼痛對工作專注力、效率及缺勤傾向之影響。依WPAI(工作生產力活動損害問卷)公式量化經濟效益。年平均病假天數(企業自設)："+p.sickDays+"天。平均日薪(企業自設)：NT$"+p.avgDailySalary+"。就業人數："+(p.headcount||"(未設定)")+"人。預估年病假成本節省：NT$"+(p.sickDays*(p.avgDailySalary||3200)*(p.headcount||0)).toLocaleString()+"。"+owLine;
     })()},
    {std:"GRI 401-2",title:"員工福利",
     content:"REIBI平台提供：①舒曼波自律神經調節體驗(7.83Hz)②LA200光能緩解疼痛體驗(660-808nm LLLT)③生物資訊檢測④自律神經量測⑤AI個人化健康建議⑥積分獎勵制度(22項行動打卡、健促體驗積分換取加次)。以上均為企業健促福利，不替代醫療照護。"},
    {std:"SDG 3",title:"良好健康與福祉",
     content:"對標WHO NCD全球行動計畫(2013-2030)：減少NCD過早死亡30%、高血壓降低33%。本期高風險(橙+紅燈)比例："+( n?Math.round(recs.filter(function(r){return r.sKey==="red"||r.sKey==="orange";}).length/n*100):0)+"%。888計畫三個80%目標：早期發現三高、接受生活諮商、病情獲有效控制。"},
    {std:"SDG 8",title:"體面工作與經濟成長",
     content:"工作效率(WQ)量化：透過WPAI公式評估健促介入對工作生產力之提升。生產力提升預估：+"+p.productivityGain+"%(企業自設)。888計畫8項健康指標持續追蹤，協助員工維持最佳工作狀態，降低因健康問題導致的工時損失。"},
    {std:"SDG 10",title:"減少不平等",
     content:"評估參與率："+(n>0?"100%(平台對全體員工開放)":"—")+"。888計畫目標：≥80%員工參與健康促進方案。平台提供L1個人至L5管理層RBAC八層角色，確保各層級員工均能平等獲得健康促進資源。"},
    {std:"SDG 17",title:"促進目標夥伴關係",
     content:"GRI 403-6/403-9格式揭露，支援企業永續報告書直接引用。IDG(內在成長目標)×WHO Ottawa Charter×REIBI三方架構，結合政府政策、企業管理與國際健促框架，共同推動台灣職場健康永續發展。ESG第三方查核請委託KPMG、Deloitte、BSI等機構。"},
  ];
  var allText=items.map(function(i){return "["+i.std+" "+i.title+"]\n"+i.content;}).join("\n\n");
  return ce(Screen,{title:"\ud83d\udccb GRI 403-6 \u683c\u5f0f\u63ed\u9732",onBack,maxW:700,action:
    ce("div",{style:{display:"flex",gap:6}},
      ce(Btn,{sz:"sm",v:"sage",onClick:function(){doCopy("全部段落",allText);}},"📋 複製全部"),
      ce(Btn,{sz:"sm",v:"navy",onClick:function(){
        var ts=new Date().toLocaleDateString("zh-TW").replace(/\//g,"-");
        var blob=new Blob([allText],{type:"text/plain;charset=utf-8"});
        var url=URL.createObjectURL(blob);
        var a=document.createElement("a");a.href=url;a.download="GRI403-6\u63ed\u9732_"+ts+".txt";a.click();
        URL.revokeObjectURL(url);
        setToast("GRI報告已下載");
      }},"⬇ 下載"))},
    ce(Toast,{msg:toast,onDone:function(){setToast("");}}),
    ce(IBox,{c:"navy",style:{marginBottom:14}},"本頁依GRI通用準則(GRI Universal Standards 2021)及GRI 403職業健康與安全準則格式生成。可直接引用於企業ESG/永續報告書。每段右上角「📋 複製」可單獨複製貼入報告書。"),
    items.map(function(item){
      var isCopied=copied===item.std;
      return ce(Card,{key:item.std,style:{marginBottom:10,borderLeft:"4px solid "+T.teal}},
        ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}},
          ce("div",{style:{display:"flex",gap:10,alignItems:"center"}},
            ce(Tag,{c:"teal"},item.std),
            ce("div",{style:{fontWeight:700,fontSize:13,color:T.text}},item.title)),
          ce("button",{
            onClick:function(){doCopy(item.std,"["+item.std+" "+item.title+"]\n"+item.content);},
            style:{padding:"4px 12px",border:"1px solid "+(isCopied?T.sage:T.border),borderRadius:20,cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit",background:isCopied?T.sageBg:T.card,color:isCopied?T.sage:T.muted,transition:"all .15s"}},
            isCopied?"✅ 已複製":"📋 複製")),
        ce("p",{style:{fontSize:13,color:T.muted,lineHeight:1.8,margin:0}},item.content));
    }),
    ce(IBox,{c:"amber",style:{marginTop:8}},"ℹ 以上揭露內容為系統自動生成，最終ESG報告需由企業負責人審核確認，並委託第三方查核機構(如KPMG、Deloitte、BSI)進行獨立驗證。"));
}


function L5AdminScreen({onBack}){
  const[tab,setTab]=useState("orgs");
  const[versions,setVersions]=useState([]);
  const[snapshots,setSnapshots]=useState([]);
  const[snapLabel,setSnapLabel]=useState("");
  const[toast,setToast]=useState("");
  const[prs,setPrs]=useState([]);
  const[orgs,setOrgs]=useState(["REIBI2025","DEMO001","TEST001"]);
  const[newOrg,setNewOrg]=useState("");
  const[newOrgName,setNewOrgName]=useState("");
  const[loading,setLoading]=useState(false);
  const[restoreTarget,setRestoreTarget]=useState(null);
  const[pinOld,setPinOld]=useState("");
  const[pinNew,setPinNew]=useState("");
  const[pinNew2,setPinNew2]=useState("");
  const[pinErr,setPinErr]=useState("");
  const[pinOk,setPinOk]=useState(false);

  useEffect(function(){
    VersionDB.getHistory().then(function(h){setVersions(h||[]);});
    VersionDB.getSnapshots().then(function(s){setSnapshots(s||[]);});
    DB.getPRs().then(function(r){setPrs(r||[]);});
    DB.getRegisteredOrgs().then(function(o){if(o&&o.length)setOrgs(o);});
    // Auto-save current version on first load
    VersionDB.saveVersion(CURRENT_VERSION).then(function(){
      VersionDB.getHistory().then(function(h){setVersions(h||[]);});
    });
    AL.rec("L5_ACCESS","admin screen","admin_reibi");
  },[]);

  const doAddOrg=async function(){
    if(!newOrg.trim())return;
    const code=newOrg.trim().toUpperCase();
    const updated=[...orgs,code];
    await DB.saveRegisteredOrgs(updated);
    setOrgs(updated);
    setNewOrg("");setNewOrgName("");
    setToast("單位代碼 "+code+" 已新增");
    AL.rec("L5_ADD_ORG",code,"admin_reibi");
  };

  const doRemoveOrg=async function(code){
    if(!window.confirm("確定要移除單位代碼 "+code+" 嗎？此操作不可逆，該單位成員將無法登入。"))return;
    const updated=orgs.filter(function(o){return o!==code;});
    await DB.saveRegisteredOrgs(updated);
    setOrgs(updated);
    setToast("單位代碼 "+code+" 已移除");
    AL.rec("L5_REMOVE_ORG",code,"admin_reibi");
  };

  const doSnapshot=async function(){
    if(!snapLabel.trim()){setToast("請填入快照名稱");return;}
    setLoading(true);
    const data={orgs,versionInfo:CURRENT_VERSION,ts:new Date().toISOString()};
    const id=await VersionDB.saveSnapshot(snapLabel,data);
    const snaps=await VersionDB.getSnapshots()||[];
    setSnapshots(snaps);
    setSnapLabel("");
    setToast("快照「"+snapLabel+"」已儲存(ID: "+id+")");
    AL.rec("L5_SNAPSHOT",snapLabel,"admin_reibi");
    setLoading(false);
  };

  const doRestore=async function(snap){
    if(!window.confirm("確定要回溯至快照「"+snap.label+"」("+snap.savedAt.slice(0,10)+")嗎？"))return;
    setRestoreTarget(snap);
    // Restore orgs from snapshot
    if(snap.data&&snap.data.orgs){
      await DB.saveRegisteredOrgs(snap.data.orgs);
      setOrgs(snap.data.orgs);
    }
    setToast("已回溯至快照「"+snap.label+"」");
    AL.rec("L5_RESTORE",snap.label,"admin_reibi");
    setRestoreTarget(null);
  };

  const doResolvePR=async function(pr,action){
    await DB.updatePR(pr.id,action==="approve"?"已清除PIN·等待重設":"已拒絕");
    if(action==="approve")await DB.clearPin(pr.orgCode);
    const updated=await DB.getPRs()||[];
    setPrs(updated);
    setToast(action==="approve"?"PIN已清除，請通知管理者重新設定":"已拒絕申請");
    AL.rec("L5_PIN_"+(action==="approve"?"CLEAR":"REJECT"),pr.orgCode,"admin_reibi");
  };

  const tabs=[{k:"overview",l:"系統總覽"},{k:"orgs",l:"單位管理"},{k:"versions",l:"版本記錄"},{k:"snapshots",l:"快照備份"},{k:"pinreset",l:"PIN工單"},{k:"audit",l:"稽核日誌"},{k:"mypin",l:"🔑 我的PIN"}];
  const scM={"待審核":{bg:T.amberBg,c:T.amber},"已清除PIN·等待重設":{bg:T.sageBg,c:T.sage},"已拒絕":{bg:T.redBg,c:T.red}};

  return ce(Screen,{title:"🛡 L5 麗媚後台管理員",onBack,maxW:700},
    ce(Toast,{msg:toast,onDone:function(){setToast("");}}),
    ce(IBox,{c:"red",style:{marginBottom:14}},"🔐 L5 安全操作區 · 所有操作均記錄於稽核日誌 · 版本："+CURRENT_VERSION.version),
    // Tabs
    ce("div",{style:{display:"flex",gap:4,marginBottom:16,overflowX:"auto"}},
      tabs.map(function(t){return ce("button",{key:t.k,onClick:function(){setTab(t.k);},style:{padding:"7px 14px",border:"none",borderRadius:20,cursor:"pointer",fontWeight:700,fontSize:12,background:tab===t.k?T.teal:T.card,color:tab===t.k?"#fff":T.muted,fontFamily:"inherit",whiteSpace:"nowrap",border:"1px solid "+(tab===t.k?T.teal:T.border)}},t.l);})),

    // ⓪ 系統總覽
    tab==="overview"&&ce("div",{style:{display:"grid",gap:14}},
      ce(IBox,{c:"teal",style:{marginBottom:4}},"REIBI 系統群由四個獨立 Artifact 組成，共用 window.storage 資料層。以下為各系統快覽。"),
      ce(Card,{style:{borderLeft:"4px solid "+T.teal}},
        ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}},
          ce("div",null,
            ce("div",{style:{fontWeight:800,fontSize:15,color:T.teal}},"🏥 REIBI 主平台(reibi-v10)"),
            ce("div",{style:{fontSize:12,color:T.muted,marginTop:2}},"v10.3.17 · L1-L5 八層 RBAC · ~4,649行")),
          ce(Tag,{c:"teal"},"當前系統")),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,fontSize:12}},
          ["個人健康評估(ISI+BPI+MHI+WQ)","過勞風險自評(8題+危險因子)","888計畫達成率追蹤","睡眠日記/疼痛日誌/身心健康","KPI/OKR/ESG/GRI/ROI報告","HR高風險分析與面談記錄","年度統計報表+AI報告生成","積分中心/打卡/EAP資源"].map(function(item){
            return ce("div",{key:item,style:{padding:"4px 8px",background:T.tealBg,borderRadius:6,color:T.teal}},"\u2022 "+item);
          }))),
      ce(Card,{style:{borderLeft:"4px solid "+T.plum}},
        ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}},
          ce("div",null,
            ce("div",{style:{fontWeight:800,fontSize:15,color:T.plum}},"🛡 L5後台管理系統(reibi-l5)"),
            ce("div",{style:{fontSize:12,color:T.muted,marginTop:2}},"v1.0 · REIBI內部 + 經銷商L6 · ~2,867行")),
          ce(Tag,{c:"plum"},"獨立系統")),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,fontSize:12}},
          ["新案開通(A/B/C/D四層)","企業/付款時程管理","授權管理+經銷商分潤","服務工單+LINE推播","大數據分析(ISI+BPI+MHI)","報表中心(6張+CSV匯出)","點線面策略地圖","名冊查詢/滿意度/NPS"].map(function(item){
            return ce("div",{key:item,style:{padding:"4px 8px",background:T.plumBg,borderRadius:6,color:T.plum}},"\u2022 "+item);
          }))),
      ce(Card,{style:{borderLeft:"4px solid "+T.amber}},
        ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}},
          ce("div",null,
            ce("div",{style:{fontWeight:800,fontSize:15,color:T.amber}},"📄 報價合約系統(reibi-quote)"),
            ce("div",{style:{fontSize:12,color:T.muted,marginTop:2}},"v1.0 · REIBI業務+L6經銷商 · ~962行")),
          ce(Tag,{c:"amber"},"獨立系統")),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,fontSize:12}},
          ["A/B/C/D/E五層報價建立","A層費用自動計算(付款折扣)","升級差額+剩餘月份試算","企業合約(16條)+補充合約","經銷商合作合約(12條)","合約列表+升級+續約流程"].map(function(item){
            return ce("div",{key:item,style:{padding:"4px 8px",background:T.amberBg,borderRadius:6,color:T.amber}},"\u2022 "+item);
          }))),
      ce(Card,{style:{borderLeft:"4px solid "+T.coral}},
        ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}},
          ce("div",null,
            ce("div",{style:{fontWeight:800,fontSize:15,color:T.coral}},"🔧 D層出貨驗收工單(reibi-workorder)"),
            ce("div",{style:{fontSize:12,color:T.muted,marginTop:2}},"v1.0 · D層場域工程用 · ~574行")),
          ce(Tag,{c:"coral"},"獨立系統")),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,fontSize:12}},
          ["工單建立(6項D層服務)","規格下拉+自訂項目","驗收作業(逐項通過/異常)","Punch List追蹤","工單狀態篩選+警示提醒"].map(function(item){
            return ce("div",{key:item,style:{padding:"4px 8px",background:T.coralBg,borderRadius:6,color:T.coral}},"\u2022 "+item);
          }))),
      ce(Card,{style:{background:T.navyBg,border:"1px solid "+T.border}},
        ce(SecTitle,null,"Storage Key 對照"),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,fontSize:12}},
          [["主平台","reibi_session / reibi_rpts / reibi_pts"],["L5後台","l5_session / l5_enterprises / l5_distributors"],["報價系統","rq_session / rq_quotes / rq_contracts"],["工單系統","rq_workorders"]].map(function(pair){
            return ce("div",{key:pair[0],style:{padding:"6px 10px",background:T.card,borderRadius:6}},
              ce("div",{style:{fontWeight:700,color:T.navy,fontSize:11}},pair[0]),
              ce("div",{style:{color:T.muted,fontSize:10,marginTop:2}},pair[1]));
          })))),

    // ① 單位管理
    tab==="orgs"&&ce("div",{style:{display:"grid",gap:12}},
      ce(Card,null,
        ce(SecTitle,null,"新增單位代碼"),
        ce(IBox,{c:"navy",style:{marginBottom:10}},"單位代碼由麗媚設定後，企業才能登入使用平台。代碼建議格式：大寫英文+年份，如 COMPANY2025"),
        ce("div",{style:{display:"grid",gap:8}},
          ce(Inp,{label:"單位代碼(英文大寫)",value:newOrg,onChange:function(e){setNewOrg(e.target.value.toUpperCase());},placeholder:"例：COMPANY2025"}),
          ce(Inp,{label:"單位名稱(備註用)",value:newOrgName,onChange:function(e){setNewOrgName(e.target.value);},placeholder:"例：XX科技有限公司"}),
          ce(Btn,{onClick:doAddOrg,disabled:!newOrg.trim()},"新增單位代碼"))),
      ce(Card,null,
        ce(SecTitle,null,"已登記單位("+orgs.length+"個)"),
        orgs.length===0?ce("p",{style:{color:T.muted,fontSize:13}},"尚無登記單位"):
        ce("div",{style:{display:"grid",gap:6}},
          orgs.map(function(code){return ce("div",{key:code,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:T.bg,borderRadius:8}},
            ce("div",null,
              ce("span",{style:{fontWeight:700,color:T.teal,fontSize:14}},code)),
            ce(Btn,{sz:"sm",v:"danger",onClick:function(){doRemoveOrg(code);}},"移除"));
          })))),

    // ② 版本記錄
    tab==="versions"&&ce("div",{style:{display:"grid",gap:10}},
      ce(Card,{style:{borderLeft:"4px solid "+T.teal}},
        ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}},
          ce("div",null,
            ce("div",{style:{fontWeight:800,fontSize:15,color:T.teal}},CURRENT_VERSION.version),
            ce("div",{style:{fontSize:12,color:T.muted}},"發布日期："+CURRENT_VERSION.releaseDate),
            ce("div",{style:{fontSize:12,color:T.muted,marginTop:2}},CURRENT_VERSION.description)),
          ce(Tag,{c:"teal"},"當前版本")),
        ce("div",{style:{marginTop:10,fontSize:12,color:T.muted}},"本版更新："),
        CURRENT_VERSION.changes.map(function(ch){return ce("div",{key:ch,style:{fontSize:12,color:T.text,padding:"2px 0"}},
          "• "+ch);})),
      versions.filter(function(v){return v.version!==CURRENT_VERSION.version;}).length===0?
        ce(IBox,{c:"teal"},"目前僅有當前版本記錄。每次進入L5後台時系統自動記錄版本。"):
        versions.filter(function(v){return v.version!==CURRENT_VERSION.version;}).map(function(v){
          return ce(Card,{key:v.version,style:{borderLeft:"4px solid "+T.border}},
            ce("div",{style:{display:"flex",justifyContent:"space-between"}},
              ce("div",null,
                ce("div",{style:{fontWeight:700,fontSize:13,color:T.text}},v.version),
                ce("div",{style:{fontSize:11,color:T.muted}},"發布："+v.releaseDate+" · 記錄於："+v.savedAt.slice(0,10))),
              ce(Tag,{c:"gray"},"歷史版本")),
            v.description&&ce("div",{style:{fontSize:12,color:T.muted,marginTop:4}},v.description));
        })),

    // ③ 快照備份
    tab==="snapshots"&&ce("div",{style:{display:"grid",gap:12}},
      ce(Card,null,
        ce(SecTitle,null,"建立系統快照"),
        ce(IBox,{c:"amber",style:{marginBottom:10}},"快照會儲存當前已登記的單位代碼清單及版本資訊。更新前建議先建立快照，出問題時可一鍵回溯。系統最多保留5份快照。"),
        ce(Inp,{label:"快照名稱(說明用途)",value:snapLabel,onChange:function(e){setSnapLabel(e.target.value);},placeholder:"例：v10.3.1正式上線前備份"}),
        ce(Btn,{onClick:doSnapshot,disabled:!snapLabel.trim()||loading,style:{marginTop:8}},loading?"儲存中...":"建立快照")),
      snapshots.length===0?ce(IBox,{c:"teal"},"尚無快照記錄。建議每次重大更新前建立快照。"):
      ce(Card,null,
        ce(SecTitle,null,"快照記錄(最多5份)"),
        snapshots.map(function(snap){
          var isTarget=restoreTarget&&restoreTarget.id===snap.id;
          return ce(Card,{key:snap.id,style:{padding:"10px 14px",borderLeft:"4px solid "+(isTarget?T.amber:T.border)}},
            ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}},
              ce("div",null,
                ce("div",{style:{fontWeight:700,fontSize:13,color:T.text}},snap.label),
                ce("div",{style:{fontSize:11,color:T.muted}},"儲存於："+snap.savedAt.slice(0,16).replace("T"," "))),
              ce("div",{style:{display:"flex",gap:6}},
                ce(Btn,{sz:"sm",v:"amber",onClick:function(){doRestore(snap);}},"回溯此版本"),
                ce(Btn,{sz:"sm",v:"danger",onClick:async function(){
                  if(!window.confirm("確定刪除快照「"+snap.label+"」？"))return;
                  await VersionDB.deleteSnapshot(snap.id);
                  const s=await VersionDB.getSnapshots()||[];
                  setSnapshots(s);
                  setToast("快照已刪除");
                }},"刪除"))));
        }))),

    // ④ PIN工單
    tab==="pinreset"&&ce("div",{style:{display:"grid",gap:10}},
      ce(IBox,{c:"red",style:{marginBottom:4}},"PIN強制清除為不可逆操作。請確認管理者身份(需授權書)後執行。"),
      prs.length===0?ce(Card,{style:{textAlign:"center",padding:30,color:T.muted,fontSize:13}},"目前無PIN重設申請"):
      prs.map(function(pr){
        var sc=scM[pr.status]||scM["待審核"];
        return ce(Card,{key:pr.id,style:{borderLeft:"4px solid "+sc.c}},
          ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}},
            ce("div",null,
              ce("div",{style:{fontWeight:700,fontSize:13,color:T.text}},"工單 "+pr.id),
              ce("div",{style:{fontSize:12,color:T.muted}},"單位："+pr.orgCode+" · "+pr.managerName),
              ce("div",{style:{fontSize:11,color:T.muted}},"📧 "+pr.contactEmail+" · "+pr.ts.slice(0,10))),
            ce("span",{style:{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,background:sc.bg,color:sc.c}},pr.status)),
          pr.status==="待審核"&&ce("div",{style:{display:"flex",gap:8,marginTop:8}},
            ce(Btn,{sz:"sm",v:"danger",onClick:function(){doResolvePR(pr,"approve");}},"強制清除PIN"),
            ce(Btn,{sz:"sm",v:"ghost",onClick:function(){doResolvePR(pr,"reject");}},"拒絕申請")));
      })),

    // ⑤ 稽核日誌
    tab==="audit"&&ce("div",null,
      ce(IBox,{c:"teal",style:{marginBottom:10}},"本工作階段全系統操作記錄(最新100筆)"),
      AL.all().length===0?ce(Card,{style:{textAlign:"center",padding:30,color:T.muted}},"本工作階段無記錄"):
      ce("div",{style:{display:"grid",gap:6}},
        AL.all().map(function(l){
          return ce(Card,{key:l.id,style:{padding:"8px 14px",borderLeft:"3px solid "+(l.action.includes("FAIL")||l.action.includes("WRONG")||l.action.includes("REMOVE")?T.red:l.action.includes("L5")?T.plum:T.teal)}},
            ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
              ce("div",null,
                ce("span",{style:{fontSize:12,fontWeight:700,color:T.text}},l.action),
                l.detail&&ce("span",{style:{fontSize:11,color:T.muted,marginLeft:8}},l.detail),
                l.role&&ce("span",{style:{fontSize:10,color:T.faint,marginLeft:8}},"["+l.role+"]")),
              ce("span",{style:{fontSize:10,color:T.faint,whiteSpace:"nowrap"}},l.ts.slice(11,19))));
        }))),

    // ⑥ 我的PIN
    tab==="mypin"&&ce("div",{style:{display:"grid",gap:12}},
      ce(Card,null,
        ce(SecTitle,null,"更改 L5 超管 PIN"),
        ce(IBox,{c:"red",style:{marginBottom:12}},"PIN為L5超管最高權限憑證，請妥善保管，定期更換。"),
        ce("div",{style:{display:"grid",gap:10}},
          ce(Inp,{label:"目前PIN",type:"password",value:pinOld,onChange:function(e){setPinOld(e.target.value);}}),
          ce(Inp,{label:"新PIN(6-12碼)",type:"password",value:pinNew,onChange:function(e){setPinNew(e.target.value);}}),
          ce(Inp,{label:"確認新PIN",type:"password",value:pinNew2,onChange:function(e){setPinNew2(e.target.value);}})),
        pinErr&&ce("div",{style:{color:T.red,fontSize:12,marginTop:6}},pinErr),
        pinOk&&ce("div",{style:{color:T.sage,fontSize:12,marginTop:6,fontWeight:700}},"PIN已成功更新"),
        ce(Btn,{onClick:async function(){
          if(!pinOld||!pinNew||!pinNew2){setPinErr("請填寫所有欄位");return;}
          if(pinNew.length<6){setPinErr("新PIN需至少6碼");return;}
          if(pinNew!==pinNew2){setPinErr("兩次新PIN不一致");return;}
          var stored=await DB.getPin("REIBI2025")||"";
          var enc=await crypto.subtle.digest("SHA-256",new TextEncoder().encode("REIBI-SALT-2025-v1"+pinOld));
          var hex=Array.from(new Uint8Array(enc)).map(function(b){return b.toString(16).padStart(2,"0");}).join("");
          if(stored&&stored!==hex){setPinErr("目前PIN不正確");return;}
          var enc2=await crypto.subtle.digest("SHA-256",new TextEncoder().encode("REIBI-SALT-2025-v1"+pinNew));
          var hex2=Array.from(new Uint8Array(enc2)).map(function(b){return b.toString(16).padStart(2,"0");}).join("");
          await DB.savePin("REIBI2025",hex2);
          setPinOld("");setPinNew("");setPinNew2("");setPinErr("");setPinOk(true);
          AL.rec("L5_PIN_CHANGE","自行更改","admin_reibi");
        },full:true,style:{marginTop:12}},"更新PIN"))));
}



// ── 關於 REIBI 完整定位聲明 ──────────────────────────────────────────────────
function AboutREIBIScreen({session,onBack}){
  var[tab,setTab]=useState("mission");
  var[copied,setCopied]=useState(false);
  var isAdm=session&&(isAdmRole(session.role)||isMainAdmin(session.role));
  var tabs=isAdm?[{k:"mission",l:"使命與定位"},{k:"framework",l:"理論框架"},{k:"stakeholder",l:"利害關係人"},{k:"sdg",l:"SDG對標"},{k:"888",l:"888計畫"}]:[{k:"mission",l:"關於REIBI"},{k:"personal",l:"個人健康說明"},{k:"sdg",l:"平台特色"},{k:"888",l:"888計畫"}];
  var sdgs=[
    {n:"SDG 3",t:"良好健康與福祉",desc:"提升企業員工睡眠、疼痛、身心健康三維指標，量化健康改善率。",color:T.sage},
    {n:"SDG 8",t:"尊嚴就業與經濟成長",desc:"降低因病缺勤率，提升工作效率(WPAI工作效率問卷)，改善企業生產力。",color:T.teal},
    {n:"SDG 10",t:"減少不平等",desc:"提供中小企業、製造業、服務業同等高品質健康自主管理工具，打破健促資源不均。",color:T.navy},
    {n:"SDG 17",t:"夥伴關係",desc:"IDG+WHO+REIBI三方架構，結合政府、企業、社會力量共同推動職場健促。",color:T.plum},
  ];
  var stakeholders=[
    {role:"董事會",icon:"🏛",color:T.navy,benefits:[
      "ESG健康揭露合規(GRI 403-6/403-9)",
      "企業永續評分提升(MSCI/CDP/DJSI)",
      "健康資本投資ROI可視化(WPAI模型)",
      "人力斷層風險管理：高風險員工早期預警",
      "供應鏈ESG健康標準：採購競爭籌碼",
      "IPO/IR加分：ESG量化數據即時生成"]},
    {role:"CEO / COO",icon:"🎯",color:T.teal,benefits:[
      "888計畫三個80%：KPI達成率儀表板",
      "病假率↓ → 生產力↑ 量化週報",
      "OKR健康獎金計算公式自動套用",
      "跨部門健康KPI比較(去識別化)",
      "領導示範效應：高管健康量測服務",
      "決策品質提升：以數據驅動健促策略"]},
    {role:"CFO / 財務長",icon:"💰",color:T.amber,benefits:[
      "病假成本節省量化(天數×日薪×人數)",
      "醫療保費談判數據：健促成效報告",
      "ROI試算器：投入1元回收3-6元標竿",
      "A/B/C/D四層費用透明化，CAPEX/OPEX規劃",
      "3年投資回報期預測(可調滑桿即時試算)",
      "GRI 403-9在職失能成本量化揭露"]},
    {role:"CHRO / 人資長",icon:"👥",color:T.sage,benefits:[
      "一鍵生成GRI 403-6/403-9合規報告段落",
      "高風險員工(橙/紅燈)早期預警系統",
      "EAP心理資源整合管理(五類資源)",
      "HR年度評估排程 + 員工30天前提醒",
      "888計畫三個80%執行追蹤",
      "高風險面談記錄數位化(醫師/健管師)"]},
    {role:"IT管理者",icon:"🔐",color:T.plum,benefits:[
      "零部署：純瀏覽器型SaaS，無需安裝任何軟體",
      "AES-256-GCM加密 + TLS 1.3傳輸保護",
      "零信任架構(ZTA)：RBAC八層角色分離",
      "k-匿名性(k≥5)+ 差分隱私(epsilon=0.8)",
      "稽核日誌：所有操作記錄至個人名稱",
      "台灣個資法合規 + GDPR概念設計"]},
    {role:"福利委員 / 員工代表",icon:"🎁",color:T.coral,benefits:[
      "免費個人健康評估(ISI+BPI+MHI)不限次數",
      "AI六面向個人化健康建議(每次評估生成)",
      "22項行動打卡積分兌換健促福利",
      "首次設備體驗免費(舒曼波/LA200)",
      "EAP資源：心理/睡眠/疼痛/三高/職涯諮詢",
      "隱私保護：個人資料不上傳至組織統計"]},
  ];
  var v43text=["REIBI麗媚生化科技企業健康自主管理平台，以「內在發展目標(IDG)」為內在驅動力，以WHO Ottawa Charter(1986)健康促進五大行動領域及WHO非傳染病全球行動計畫(2013–2030)減少NCD過早死亡30%為國際框架，以ESG企業永續管理架構及GRI 403-6「促進員工健康」揭露準則為報告基礎，以台灣衛生福利部「2023–2026年國民健康白皮書」及國民健康署「三高慢病整合照護計畫(888計畫)」為本土政策錨點，以聯合國永續發展目標SDG 3/8/10/17為方向，透過ISI失眠嚴重程度指數及BPI簡明疼痛量表等國際認證工具，協助企業將員工健康促進轉化為可量化的ESG永續成果——從個人的內在覺察，到組織的健康文化，再到社會的永續健康，REIBI致力於實現「自己的健康，自己照顧」的完整轉化路徑。","本平台為輔助性健康自主管理工具，不為認證機構，不構成醫療診斷。"].join("\n\n");
  return ce(Screen,{title:isAdm?"\ud83c\udf3f \u95dc\u65bcREIBI \u2014 \u4f01\u696d\u5065\u5eb7\u81ea\u4e3b\u7ba1\u7406\u5e73\u53f0":"\ud83c\udf3f \u95dc\u65bcREIBI \u2014 \u5065\u5eb7\u81ea\u4e3b\u7ba1\u7406\u5e73\u53f0",onBack,maxW:700},
    ce("div",{style:{display:"flex",gap:4,marginBottom:16,overflowX:"auto",flexWrap:"wrap"}},
      tabs.map(function(t){return ce("button",{key:t.k,onClick:function(){setTab(t.k);},style:{padding:"7px 14px",border:"1px solid "+(tab===t.k?T.teal:T.border),borderRadius:20,cursor:"pointer",fontWeight:700,fontSize:12,background:tab===t.k?T.teal:T.card,color:tab===t.k?"#fff":T.muted,fontFamily:"inherit",whiteSpace:"nowrap"}},t.l);})),

    tab==="mission"&&ce("div",{style:{display:"grid",gap:14}},
      ce(Card,{style:{background:"linear-gradient(135deg,"+T.tealBg+",#fff)",borderLeft:"4px solid "+T.teal}},
        ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}},
          ce("div",{style:{fontSize:16,fontWeight:800,color:T.teal}},"麗媚生化科技 · REIBI BIO-Technology"),
          ce("button",{
            onClick:function(){
              navigator.clipboard.writeText(v43text).then(function(){setCopied(true);setTimeout(function(){setCopied(false);},2000);});
            },
            style:{padding:"4px 12px",border:"1px solid "+(copied?T.sage:T.border),borderRadius:20,cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit",background:copied?T.sageBg:T.card,color:copied?T.sage:T.muted,whiteSpace:"nowrap"}},
            copied?"✅ 已複製":"📋 複製定位聲明")),
        ce("div",{style:{fontSize:12,color:T.muted,lineHeight:1.9,marginBottom:10}},v43text),
        ce(IBox,{c:"teal",style:{fontSize:11}},"v4.3 定稿 · 適用於業務簡報、ESG報告、標書投標")),
      ce(Card,null,
        ce(SecTitle,null,"三大核心主張"),
        ce("div",{style:{display:"grid",gap:10}},
          [["🔬 科學化","ISI國際睡眠量表+BPI簡式疼痛量表+MHI身心健康指數+WQ工作效率問卷，四維度循證評估"],["📊 量化化","KPI改善率/問題盛行率/全體貢獻率三公式，OKR獎金計算，ROI財務效益試算(WPAI模型)"],["🌱 永續化","GRI 403-6職場健康揭露，SDG 3/8/10/17對標，與ESG永續報告書直接整合"]].map(function(item){
            return ce("div",{key:item[0],style:{padding:"12px 16px",background:T.tealBg,borderRadius:10}},
              ce("div",{style:{fontWeight:700,fontSize:13,color:T.teal,marginBottom:4}},item[0]),
              ce("div",{style:{fontSize:12,color:T.muted,lineHeight:1.7}},item[1]));
          }))),
      ce(Card,null,
        ce(SecTitle,null,"平台架構：四層服務"),
        ce("div",{style:{display:"grid",gap:8}},
          [{l:"A層",t:"軟體平台年授權",desc:"健康評估+KPI/OKR/ESG/GRI全功能，年繳/半年/季繳",c:T.teal},
           {l:"B層",t:"設備費",desc:"舒曼波自律神經調節設備＋LA200光能設備(一次性)",c:T.amber},
           {l:"C層",t:"高管健促服務費",desc:"高階主管專屬健康顧問服務，年度循環",c:T.sage},
           {l:"D層",t:"健康識能環境佈置(選配)",desc:"場域規劃、數位看板、健康識能物料",c:T.coral}].map(function(item){
            return ce("div",{key:item.l,style:{display:"flex",gap:12,padding:"10px 14px",background:T.bg,borderRadius:8,alignItems:"flex-start"}},
              ce("div",{style:{fontWeight:800,fontSize:14,color:item.c,minWidth:36}},item.l),
              ce("div",null,
                ce("div",{style:{fontWeight:700,fontSize:13,color:T.text}},item.t),
                ce("div",{style:{fontSize:12,color:T.muted,marginTop:2}},item.desc)));
          })))),

    tab==="framework"&&ce("div",{style:{display:"grid",gap:14}},
      ce(Card,{style:{borderLeft:"4px solid "+T.plum}},
        ce("div",{style:{fontWeight:800,fontSize:15,color:T.plum,marginBottom:8}},"IDG — Inner Development Goals(內在成長目標)"),
        ce("div",{style:{fontSize:12,color:T.muted,lineHeight:1.8,marginBottom:10}},"由全球100+位科學家共同發展，SDG達成的關鍵內在能力框架。REIBI將IDG五維度整合至平台設計："),
        ce("div",{style:{display:"grid",gap:6}},
          [{d:"Being 存在覺察",r:"四色燈號系統(綠/黃/橙/紅)引導自我健康覺察"},
           {d:"Thinking 批判思維",r:"AI循證建議，依個人指標客製化行動方案"},
           {d:"Relating 同理關係",r:"EAP心理資源整合，高風險主動關懷"},
           {d:"Collaborating 協作共創",r:"OKR部門健康目標共創，ESG/GRI集體揭露"},
           {d:"Acting 行動實踐",r:"22項日常健管行動打卡，積分激勵機制"}].map(function(item){
            return ce("div",{key:item.d,style:{padding:"8px 12px",background:T.plumBg,borderRadius:8,display:"flex",gap:10}},
              ce("div",{style:{fontWeight:700,fontSize:12,color:T.plum,minWidth:100}},item.d),
              ce("div",{style:{fontSize:12,color:T.muted,lineHeight:1.6}},item.r));
          }))),
      ce(Card,{style:{borderLeft:"4px solid "+T.teal}},
        ce("div",{style:{fontWeight:800,fontSize:15,color:T.teal,marginBottom:8}},"WHO 渥太華健促憲章(Ottawa Charter, 1986)"),
        ce("div",{style:{fontSize:12,color:T.muted,lineHeight:1.8,marginBottom:10}},"WHO全球健促行動五大方向，REIBI平台架構完全對應："),
        ce("div",{style:{display:"grid",gap:6}},
          [["建立健康公共政策","GRI 403-6合規報告，協助企業建立職場健康政策"],["創造支持性環境","D層健康識能環境佈置，打造健康職場場域"],["強化社區行動","888計畫80%參與率，集體健管文化建立"],["發展個人技能","ISI+BPI+MHI四維評估，提升個人健康識能"],["調整衛生服務走向","EAP+自主健管排程+設備體驗，整合預防性服務"]].map(function(item){
            return ce("div",{key:item[0],style:{padding:"8px 12px",background:T.tealBg,borderRadius:8,display:"flex",gap:10}},
              ce("div",{style:{fontWeight:700,fontSize:12,color:T.teal,minWidth:110}},item[0]),
              ce("div",{style:{fontSize:12,color:T.muted,lineHeight:1.6}},item[1]));
          })))),

    tab==="stakeholder"&&ce("div",{style:{display:"grid",gap:12}},
      ce(IBox,{c:"navy",style:{marginBottom:4}},"REIBI 為企業六大決策角色提供專屬價值，確保健康投資獲得跨層級支持。"),
      stakeholders.map(function(s){
        return ce(Card,{key:s.role,style:{borderLeft:"4px solid "+s.color}},
          ce("div",{style:{display:"flex",gap:12,alignItems:"flex-start"}},
            ce("div",{style:{fontSize:28,flexShrink:0}},s.icon),
            ce("div",{style:{flex:1}},
              ce("div",{style:{fontWeight:800,fontSize:14,color:s.color,marginBottom:8}},s.role),
              ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}},
                s.benefits.map(function(b){
                  return ce("div",{key:b,style:{fontSize:11,color:T.muted,display:"flex",gap:5,alignItems:"flex-start",padding:"3px 0"}},
                    ce("span",{style:{color:s.color,fontWeight:700,flexShrink:0,fontSize:12}},"\u2713"),
                    b);
                })))));
      })),

    tab==="personal"&&ce("div",{style:{display:"grid",gap:14}},
      ce(Card,{style:{background:T.tealBg,border:"1px solid "+T.tealLight}},
        ce("div",{style:{fontSize:14,fontWeight:800,color:T.teal,marginBottom:8}},"\u70ba\u4ec0\u9ebc\u9700\u8981\u5065\u5eb7\u81ea\u4e3b\u7ba1\u7406\uff1f"),
        ce("p",{style:{fontSize:13,color:T.text,lineHeight:1.8,margin:0}},"\u73fe\u4ee3\u4eba\u9762\u81e8\u7db2\u8def\u9ad8\u538b\u3001\u9577\u671f\u4e45\u5750\u3001\u7761\u7720\u4e0d\u8db3\u8207\u6162\u6027\u75bc\u75db\uff0c\u5c0d\u5de5\u4f5c\u6548\u7387\u8207\u751f\u6d3b\u54c1\u8cea\u7522\u751f\u6df1\u9060\u5f71\u97ff\u3002REIBI \u5e73\u53f0\u5e6b\u52a9\u60a8\u900f\u904e\u79d1\u5b78\u91cf\u8868\uff0c\u5ba2\u89c0\u4e86\u89e3\u81ea\u5df1\u7684\u5065\u5eb7\u72c0\u614b\uff0c\u4e26\u63d0\u4f9b\u4e2a\u4eba\u5316\u5efa\u8b70\u3002")),
      ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}},
        [{icon:"🌙",title:"\u7761\u7720\u54c1\u8cea",desc:"ISI\u570b\u969b\u5931\u7720\u91cf\u8868\uff0c7\u984c\u8a55\u4f3c\uff0c0-28\u5206\uff0c\u56db\u8272\u71c8\u865f\u5373\u6642\u986f\u793a",color:T.teal},
         {icon:"🩸",title:"\u75bc\u75db\u7ba1\u7406",desc:"BPI\u7c21\u660e\u75bc\u75db\u91cf\u8868\uff0c\u8a55\u4f30\u75bc\u75db\u5f37\u5ea6\u8207\u5c0d\u751f\u6d3b\u5f71\u97ff\uff0c\u63d0\u4f9b\u81ea\u6211\u7ba1\u7406\u5efa\u8b70",color:T.coral},
         {icon:"💪",title:"\u5de5\u4f5c\u6548\u80fd",desc:"WQ\u5de5\u4f5c\u6548\u7387\u554f\u5377\uff0c\u91cf\u5316\u5065\u5eb7\u554f\u984c\u5c0d\u5de5\u4f5c\u7684\u5be6\u969b\u5f71\u97ff",color:T.plum},
         {icon:"🧠",title:"\u8eab\u5fc3\u5065\u5eb7",desc:"PHQ-4\u60c5\u7dd2\u7b4b\u67e5 + PSS-4\u58d3\u529b\u91cf\u8868\uff0c\u5168\u9762\u63c9\u7167\u5fc3\u7406\u5065\u5eb7",color:T.amber}].map(function(it){
          return ce(Card,{key:it.title,style:{padding:"12px",textAlign:"center"}},
            ce("div",{style:{fontSize:28,marginBottom:6}},it.icon),
            ce("div",{style:{fontSize:12,fontWeight:700,color:it.color,marginBottom:4}},it.title),
            ce("div",{style:{fontSize:11,color:T.muted,lineHeight:1.6}},it.desc));
        })),
      ce(Card,null,
        ce("div",{style:{fontWeight:700,fontSize:13,color:T.text,marginBottom:10}},"\u514d\u8cbb\u529f\u80fd\u6e05\u55ae"),
        ["\u2705 \u6bcf\u9031\u5065\u5eb7\u8a55\u4f30\uff08ISI+BPI+WQ\uff0c\u517119\u984c\uff09","\u2705 AI\u516d\u9762\u5411\u500b\u4eba\u5316\u5efa\u8b70","\u2705 \u56db\u8272\u71c8\u865f\u5373\u6642\u5065\u5eb7\u72c0\u614b","\u2705 \u5c55\u958b\u6b77\u53f2\u8da8\u52e2\u8ffd\u8e64\uff08\u6700\u8fd13\u500b\u6708\uff09","\u2705 22\u9805\u884c\u52d5\u6253\u5361\u7a4d\u5206\u5236\u5ea6","\u2705 \u4e09\u9ad8/BMI\u6578\u503c\u7ba1\u7406","\u2705 \u7761\u7720\u65e5\u8a18 + \u75bc\u75db\u65e5\u8a8c","\u2705 \u8eab\u5fc3\u5065\u5eb7\u8a55\u4f30\uff08PHQ-4+PSS-4\uff09","\u2705 \u904e\u52de\u98a8\u96aa\u81ea\u6211\u6aa2\u8996\uff088\u984c\uff09"].map(function(f){
          return ce("div",{key:f,style:{display:"flex",gap:8,padding:"4px 0",fontSize:12,color:T.text}},f);
        }),
        ce(IBox,{c:"teal",style:{marginTop:10}},"\u514d\u8cbb\u7248\u5305\u542b\u4e0a\u8ff0\u6240\u6709\u529f\u80fd\uff0c\u7121\u9700\u4fe1\u7528\u5361\uff0c\u7d42\u8eab\u514d\u8cbb\u4f7f\u7528\u3002")),
      ce(IBox,{c:"teal"},"\u672c\u5e73\u53f0\u70ba\u8f14\u52a9\u6027\u5065\u5eb7\u81ea\u4e3b\u7ba1\u7406\u5de5\u5177\uff0c\u4e0d\u69cb\u6210\u91ab\u7642\u8a3a\u65b7\u3002\u5982\u6709\u5065\u5eb7\u76f8\u95dc\u7591\u616e\uff0c\u8acb\u5c0b\u6c42\u5c08\u696d\u91ab\u7642\u5354\u52a9\u3002")),
    tab==="sdg"&&ce("div",{style:{display:"grid",gap:12}},
      ce(IBox,{c:"sage",style:{marginBottom:4}},"REIBI 平台對應聯合國 SDGs 四大目標，可直接用於 ESG 永續報告書揭露。"),
      sdgs.map(function(s){
        return ce(Card,{key:s.n,style:{borderLeft:"4px solid "+s.color}},
          ce("div",{style:{display:"flex",gap:12,alignItems:"flex-start"}},
            ce("div",{style:{fontWeight:800,fontSize:16,color:s.color,minWidth:60}},s.n),
            ce("div",null,
              ce("div",{style:{fontWeight:700,fontSize:13,color:T.text,marginBottom:4}},s.t),
              ce("div",{style:{fontSize:12,color:T.muted,lineHeight:1.7}},s.desc))));
      }),
      ce(Card,{style:{background:T.sageBg,border:"1px solid "+T.border}},
        ce(SecTitle,null,"量化揭露指標(可直接納入ESG報告)"),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,fontSize:12}},
          ["健康評估覆蓋率(%)","燈號改善率：橙/紅→黃/綠(%)","工作效率改善率(WPAI，%)","高風險員工追蹤完成率(%)","888計畫三大目標達成率(%)","EAP資源使用率(%)","病假成本節省(NT$)","3年投資回報率(%)"].map(function(item){
            return ce("div",{key:item,style:{padding:"6px 10px",background:T.card,borderRadius:6,display:"flex",alignItems:"center",gap:8}},
              ce("span",{style:{color:T.sage,fontWeight:700}},"\u25cf"),
              item);
          })))),

    tab==="888"&&ce("div",{style:{display:"grid",gap:12}},
      ce(Card,{style:{background:"linear-gradient(135deg,#f0fdf4,#fff)",borderLeft:"4px solid "+T.sage}},
        ce("div",{style:{fontSize:18,fontWeight:800,color:T.sage,marginBottom:4}},"888 計畫"),
        ce("div",{style:{fontSize:13,color:T.muted,lineHeight:1.8}},"源自 WHO 健康城市運動精神，REIBI 以「3個80%」為核心KPI，8週為介入週期，8項指標為量化依據，建立企業可操作的健康自主管理里程碑。對標衛福部 2023-2026 國民健康白皮書與國健署三高慢病整合照護計畫。")),
      ce(Card,null,
        ce(SecTitle,null,"三個 80% 核心目標"),
        ce("div",{style:{display:"grid",gap:10}},
          [{n:"80%",t:"早期發現三高",desc:"三高數值填報覆蓋率達80%，建立員工健康基線",icon:"🔍",c:T.teal},
           {n:"80%",t:"接受生活諮商",desc:"AI建議生成率+行動打卡完成率達80%，形成健管習慣",icon:"💊",c:T.sage},
           {n:"80%",t:"病情獲有效控制",desc:"燈號改善率(橙/紅→黃/綠)達80%，量化健促效果",icon:"💪",c:T.amber}].map(function(item){
            return ce("div",{key:item.t,style:{padding:"12px 16px",background:T.bg,borderRadius:10,display:"flex",gap:14,alignItems:"center"}},
              ce("div",{style:{textAlign:"center",minWidth:50}},
                ce("div",{style:{fontSize:22}},""+item.icon),
                ce("div",{style:{fontWeight:800,fontSize:16,color:item.c}},item.n)),
              ce("div",null,
                ce("div",{style:{fontWeight:700,fontSize:13,color:T.text,marginBottom:3}},item.t),
                ce("div",{style:{fontSize:12,color:T.muted,lineHeight:1.6}},item.desc)));
          })))));
}
function Curve888Screen({session,onBack,reports}){
  var rpts=reports||[];
  var dims=[{key:"s",label:"\u7761\u7720 ISI",color:"#2d7d6e"},{key:"p",label:"\u75bc\u75db BPI",color:"#c45c3a"},{key:"w",label:"\u5de5\u4f5c WQ",color:"#7048c8"}];
  var[curDim,setCurDim]=useState("s");
  var[showTable,setShowTable]=useState(false);
  var sorted=rpts.slice().sort(function(a,b){return (a.date||"")>(b.date||"")?1:-1;});
  var maxN=8;
  var pts=sorted.slice(-maxN);
  var dimData=pts.map(function(r){
    var v=0;
    if(curDim==="s"){v=r.sScore||0;}
    else if(curDim==="p"){v=r.pScore||0;}
    else{v=r.wScore||0;}
    var lx=curDim==="s"?r.sL:curDim==="p"?r.pL:r.wL;
    var col=lx?LX[lx.key]:null;
    return {v:v,col:col?col.color:T.faint,date:r.date||"",label:r.date?r.date.slice(5):""};
  });
  var maxV=curDim==="s"?28:curDim==="p"?10:100;
  var W=320;var H=140;var px=30;var py=16;
  var n=dimData.length;
  var sx=function(i){return n<2?(W/2):px+i/(n-1)*(W-px*2);};
  var sy=function(v){return py+(H-py*2)*(1-v/maxV);};
  var ptStr=dimData.map(function(d,i){return sx(i)+","+sy(d.v);}).join(" ");
  var dim=dims.find(function(d){return d.key===curDim;})||dims[0];
  var first=pts[0];var last=pts[pts.length-1];
  var improved=pts.length>=2&&(curDim!=="w"?(last.v<first.v||false):(last.v>first.v||false));
  function getVStr(d){
    if(curDim==="s"){return d.sScore!=null?d.sScore+"\u5206":"--";}
    if(curDim==="p"){return d.pScore!=null?d.pScore+"\u5206":"--";}
    return d.wScore!=null?d.wScore+"%":"--";
  }
  return ce(Screen,{title:"\ud83d\udcc8 \u6211\u7684\u6539\u5584\u66f2\u7dda",onBack:onBack,maxW:640},
    ce(Card,{style:{background:T.tealBg,border:"1px solid "+T.tealLight,marginBottom:14}},
      ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
        ce("div",null,
          ce("div",{style:{fontWeight:700,color:T.teal,fontSize:13}},"\u888b\u81ea\u8a55\u4f30\u8a18\u9304"),
          ce("div",{style:{fontSize:22,fontWeight:800,color:T.teal}},pts.length+"\u6b21")),
        pts.length>=2?ce(Tag,{c:improved?"sage":"amber"},improved?"\u8da8\u52e2\u6539\u5584\u2191":"\u9700\u6301\u7e8c\u95dc\u6ce8"):null)),
    ce("div",{style:{display:"flex",gap:8,marginBottom:12}},
      dims.map(function(d){
        return ce("button",{key:d.key,onClick:function(){setCurDim(d.key);},style:{flex:1,padding:"7px 4px",borderRadius:8,border:"2px solid "+(curDim===d.key?d.color:T.border),background:curDim===d.key?d.color:"transparent",color:curDim===d.key?"#fff":T.muted,fontWeight:700,fontSize:12,cursor:"pointer"}},d.label);
      })),
    pts.length<2?ce(IBox,{c:"amber"},"\u9700\u81f3\u5c11 2 \u6b21\u8a55\u4f30\u624d\u53ef\u986f\u793a\u66f2\u7dda\u5716\u8868\u3002"):
    ce(Card,{style:{marginBottom:12,overflow:"hidden"}},
      ce("div",{style:{fontWeight:600,fontSize:12,color:T.muted,marginBottom:6}},dim.label+"\u6b77\u53f2\u8da8\u52e2"),
      ce("svg",{width:"100%",height:H,viewBox:"0 0 "+W+" "+H,style:{display:"block"}},
        ce("line",{x1:px,y1:H-py,x2:W-px,y2:H-py,stroke:T.border,strokeWidth:1}),
        n>=2?ce("polyline",{points:ptStr,fill:"none",stroke:dim.color,strokeWidth:2.5,strokeLinejoin:"round"}):null,
        dimData.map(function(d,i){
          return ce("g",{key:"pt"+i},
            ce("circle",{cx:sx(i),cy:sy(d.v),r:6,fill:d.col||dim.color,stroke:"#fff",strokeWidth:2}),
            ce("text",{x:sx(i),y:H-3,textAnchor:"middle",fontSize:9,fill:T.muted},d.label));
        }))),
    ce("div",{style:{display:"flex",gap:8,marginBottom:12}},
      pts.length>=2?ce(Card,{style:{flex:1,textAlign:"center",background:T.sageBg}},
        ce("div",{style:{fontSize:11,color:T.muted,marginBottom:2}},"\u8d77\u59cb"),
        ce("div",{style:{fontSize:16,fontWeight:800,color:T.sage}},getVStr(pts[0])),
        ce("div",{style:{fontSize:10,color:T.muted}},pts[0].date||"")):null,
      pts.length>=2?ce(Card,{style:{flex:1,textAlign:"center",background:T.tealBg}},
        ce("div",{style:{fontSize:11,color:T.muted,marginBottom:2}},"\u6700\u65b0"),
        ce("div",{style:{fontSize:16,fontWeight:800,color:T.teal}},getVStr(pts[pts.length-1])),
        ce("div",{style:{fontSize:10,color:T.muted}},pts[pts.length-1].date||"")):null),
    ce("button",{onClick:function(){setShowTable(!showTable);},style:{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,background:"transparent",color:T.muted,fontSize:12,cursor:"pointer",marginBottom:8}},showTable?"\u6536\u8d77\u660e\u7d30\u8868":"\u5c55\u958b\u5168\u90e8\u8a18\u9304 ("+pts.length+"\u6b21)"),
    showTable?ce(Card,null,
      pts.map(function(r,i){
        var sLx=r.sL?LX[r.sL.key]:null;
        var pLx=r.pL?LX[r.pL.key]:null;
        return ce("div",{key:"row"+i,style:{display:"flex",alignItems:"center",padding:"7px 0",borderBottom:i<pts.length-1?"1px solid "+T.border:"none",gap:8,fontSize:12}},
          ce("div",{style:{width:60,color:T.muted,flexShrink:0}},r.date?r.date.slice(5):("\u7b2c"+(i+1)+"\u6b21")),
          ce("div",{style:{flex:1}},
            sLx?ce(Tag,{c:sLx.key},"\u7761"+sLx.label):null),
          ce("div",{style:{flex:1}},
            pLx?ce(Tag,{c:pLx.key},"\u75bc"+pLx.label):null),
          ce("div",{style:{width:40,textAlign:"right",color:T.muted}},r.wScore!=null?r.wScore+"%":"--"));
      })):null,
    ce(IBox,{c:"teal",style:{marginTop:8}},"\u66f2\u7dda\u986f\u793a\u6700\u8fd1 8 \u6b21\u5c0d\u61c9\u8a55\u4f30\u7d50\u679c\uff0c\u5e6b\u52a9\u60a8\u78ba\u8a8d\u5065\u5eb7\u6539\u5584\u52a8\u614b\u3002")
  );
}

function DeptTrendScreen({session,onBack,orgRecs}){
  var recs=orgRecs||[];
  // v10.3.30改為讀取「部門管理」(DeptMgmtScreen)persist後的正式部門清單，取代原本從orgRecs動態蒐集profile.dept字串的做法(該做法是因DeptMgmtScreen當初未persist才採用的暫代方案，見PROJECT_INSTRUCTIONS第四十一節/第五十九節2026-07-27段落)
  var[deptStruct,setDeptStruct]=useState([]);
  useEffect(function(){
    if(session&&session.orgCode){
      DB.getDeptStruct(session.orgCode).then(function(d){if(d)setDeptStruct(d);});
    }
  },[session&&session.orgCode]);
  var depts=deptStruct.map(function(d){return d.name;}).sort();
  // v10.3.25新增：三高部門層級opt-in統計(需個人同意+k≥5門檻)
  var[thDeptAgg,setThDeptAgg]=useState(null);
  useEffect(function(){
    if(session&&session.orgCode){
      stor.g("org_th_dept_"+session.orgCode.replace(/\W/g,"_")).then(function(d){if(d)setThDeptAgg(JSON.parse(d));});
    }
  },[session&&session.orgCode]);
  var[selDept,setSelDept]=useState("all");
  var[weeks,setWeeks]=useState(8);
  var[dateFrom,setDateFrom]=useState("");
  var[dateTo,setDateTo]=useState("");
  var useCustom=!!(dateFrom||dateTo);
  var cutoff=new Date();
  cutoff.setDate(cutoff.getDate()-weeks*7);
  var deptFiltered=selDept==="all"?recs:recs.filter(function(r){return r.dept===selDept;});
  // v10.3.20修正：submittedAt實際時序篩選(過去weeks完全為裝飾，未真正過濾)；自訂日期區間優先於週數按鈕
  var filtered=deptFiltered.filter(function(r){
    var d=r.submittedAt?r.submittedAt.slice(0,10):null;
    if(useCustom){
      if(dateFrom&&d&&d<dateFrom)return false;
      if(dateTo&&d&&d>dateTo)return false;
      return true;
    }
    if(!r.submittedAt)return true;// 舊資料無時間戳記，相容性保留
    return new Date(r.submittedAt)>=cutoff;
  });
  var n=filtered.length;
  var gS=n?Math.round(filtered.filter(function(r){return r.sKey==="green";}).length/n*100):0;
  var yS=n?Math.round(filtered.filter(function(r){return r.sKey==="yellow";}).length/n*100):0;
  var oS=n?Math.round(filtered.filter(function(r){return r.sKey==="orange";}).length/n*100):0;
  var rS=n?Math.round(filtered.filter(function(r){return r.sKey==="red";}).length/n*100):0;
  var gP=n?Math.round(filtered.filter(function(r){return r.pKey==="green";}).length/n*100):0;
  var yP=n?Math.round(filtered.filter(function(r){return r.pKey==="yellow";}).length/n*100):0;
  var oP=n?Math.round(filtered.filter(function(r){return r.pKey==="orange";}).length/n*100):0;
  var rP=n?Math.round(filtered.filter(function(r){return r.pKey==="red";}).length/n*100):0;
  var gW=n?Math.round(filtered.filter(function(r){return (r.wScore||0)>=70;}).length/n*100):0;
  var owHighN=filtered.filter(function(r){return r.owScore&&r.owScore>=4;}).length;
  var owHighD=n?Math.round(owHighN/n*100):0;
  // MHI 燈號分佈：僅統計有 mhiLevel 的記錄，避免舊資料(無MHI評估)稀釋比例；k≥5匿名保護
  var mhiRecs=filtered.filter(function(r){return !!r.mhiLevel;});
  var mhiN=mhiRecs.length;
  var gMHI=mhiN?Math.round(mhiRecs.filter(function(r){return r.mhiLevel==="green";}).length/mhiN*100):0;
  var yMHI=mhiN?Math.round(mhiRecs.filter(function(r){return r.mhiLevel==="yellow";}).length/mhiN*100):0;
  var oMHI=mhiN?Math.round(mhiRecs.filter(function(r){return r.mhiLevel==="orange";}).length/mhiN*100):0;
  var rMHI=mhiN?Math.round(mhiRecs.filter(function(r){return r.mhiLevel==="red";}).length/mhiN*100):0;
  var kpis=[
    {label:"\u7761\u7720\u826f\u597d\u7387",val:gS,target:80,color:T.teal},
    {label:"\u75bc\u75db\u8f15\u5fae\u7387",val:gP,target:80,color:T.sage},
    {label:"\u5de5\u4f5c\u6548\u80fd\u7387",val:gW,target:80,color:T.plum},
    {label:"\u8eab\u5fc3\u5065\u5eb7\u7387",val:gMHI,target:80,color:T.amber}
  ];
  var deptRanks=depts.map(function(d){
    var dr=recs.filter(function(r){return r.dept===d;});
    var dn=dr.length;
    var dg=dn?Math.round((dr.filter(function(r){return r.sKey==="green";}).length+dr.filter(function(r){return r.pKey==="green";}).length)/(dn*2)*100):0;
    return {dept:d,n:dn,score:dg};
  }).sort(function(a,b){return b.score-a.score;});
  var W=320;var H=120;var px=28;var py=12;
  var barW=Math.min(32,Math.max(8,(W-px*2)/(depts.length||1)-4));
  function BarChart(props){
    var items=props.items||[];
    var bW=Math.min(28,Math.max(6,(W-px*2)/(items.length||1)-3));
    return ce("svg",{width:"100%",height:H,viewBox:"0 0 "+W+" "+H,style:{display:"block"}},
      ce("line",{x1:px,y1:H-py,x2:W-px,y2:H-py,stroke:T.border,strokeWidth:1}),
      items.map(function(item,i){
        var bx=px+i*(bW+3);
        var bh=Math.round((H-py*2)*item.val/100);
        var by=(H-py)-bh;
        return ce("g",{key:"b"+i},
          ce("rect",{x:bx,y:by,width:bW,height:bh,fill:item.color,rx:2}),
          ce("text",{x:bx+bW/2,y:H-2,textAnchor:"middle",fontSize:8,fill:T.muted},item.label.slice(0,3)));
      }));
  }
  var sData=[{val:gS,color:LX.green.c,label:"\u7da0\u71c8"},{val:yS,color:LX.yellow.c,label:"\u9ec3\u71c8"},{val:oS,color:LX.orange.c,label:"\u6a59\u71c8"},{val:rS,color:LX.red.c,label:"\u7d05\u71c8"}];
  var pData=[{val:gP,color:LX.green.c,label:"\u7da0\u71c8"},{val:yP,color:LX.yellow.c,label:"\u9ec3\u71c8"},{val:oP,color:LX.orange.c,label:"\u6a59\u71c8"},{val:rP,color:LX.red.c,label:"\u7d05\u71c8"}];
  var mhiData=[{val:gMHI,color:LX.green.c,label:"\u7da0\u71c8"},{val:yMHI,color:LX.yellow.c,label:"\u9ec3\u71c8"},{val:oMHI,color:LX.orange.c,label:"\u6a59\u71c8"},{val:rMHI,color:LX.red.c,label:"\u7d05\u71c8"}];
  return ce(Screen,{title:"\ud83d\udcca \u90e8\u9580\u5065\u5eb7\u8da8\u52e2",onBack:onBack,maxW:640},
    ce(Card,{style:{marginBottom:12}},
      ce("div",{style:{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}},
        ce("div",{style:{fontSize:12,fontWeight:600,color:T.muted,flexShrink:0}},"\u90e8\u9580\uff1a"),
        ce("select",{value:selDept,onChange:function(e){setSelDept(e.target.value);},style:{flex:1,minWidth:80,padding:"5px 8px",borderRadius:6,border:"1px solid "+T.border,fontSize:12,background:T.card}},
          ce("option",{value:"all"},"\u5168\u90e8\u90e8\u9580"),
          depts.map(function(d){return ce("option",{key:d,value:d},d);})),
        ce("div",{style:{fontSize:12,fontWeight:600,color:T.muted,flexShrink:0}},"\u671f\u9593\uff1a"),
        [4,8,12].map(function(w){
          return ce("button",{key:w,disabled:useCustom,onClick:function(){setWeeks(w);setDateFrom("");setDateTo("");},style:{padding:"5px 10px",borderRadius:6,border:"1px solid "+(weeks===w&&!useCustom?T.teal:T.border),background:weeks===w&&!useCustom?T.teal:"transparent",color:weeks===w&&!useCustom?"#fff":useCustom?T.faint:T.muted,fontSize:11,cursor:useCustom?"not-allowed":"pointer",fontWeight:weeks===w&&!useCustom?700:400,opacity:useCustom?0.5:1}},w+"\u9031");
        })),
      ce("div",{style:{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginTop:10,paddingTop:10,borderTop:"1px solid "+T.border}},
        ce("div",{style:{fontSize:12,fontWeight:600,color:T.muted,flexShrink:0}},"\u81ea\u8a02\u5340\u9593\uff1a"),
        ce("input",{type:"date",value:dateFrom,onChange:function(e){setDateFrom(e.target.value);},style:{padding:"5px 8px",borderRadius:6,border:"1px solid "+T.border,fontSize:12}}),
        ce("span",{style:{fontSize:12,color:T.muted}},"\u81f3"),
        ce("input",{type:"date",value:dateTo,onChange:function(e){setDateTo(e.target.value);},style:{padding:"5px 8px",borderRadius:6,border:"1px solid "+T.border,fontSize:12}}),
        useCustom?ce("button",{onClick:function(){setDateFrom("");setDateTo("");},style:{padding:"5px 10px",borderRadius:6,border:"1px solid "+T.border,background:"transparent",color:T.muted,fontSize:11,cursor:"pointer"}},"\u6e05\u9664"):null),
      useCustom?ce("div",{style:{fontSize:11,color:T.amber,marginTop:6}},"\u26a0 \u5df2\u5957\u7528\u81ea\u8a02\u65e5\u671f\u5340\u9593\uff0c\u9031\u6578\u6309\u9215\u66ab\u505c\u7528\uff08\u9078\u64c7\u9031\u6578\u5c07\u81ea\u52d5\u6e05\u9664\u81ea\u8a02\u5340\u9593\uff09"):null),
    ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}},
      kpis.map(function(k){
        var ok=k.val>=k.target;
        return ce(Card,{key:k.label,style:{textAlign:"center",padding:"12px 6px"}},
          ce("div",{style:{fontSize:10,color:T.muted,marginBottom:4}},k.label),
          ce("div",{style:{fontSize:22,fontWeight:800,color:k.color}},k.val+"%"),
          ce(Tag,{c:ok?"sage":"amber",style:{fontSize:9}},ok?"\u9054\u6a19":"\u672a\u9054"));
      })),
    ce(Card,{style:{marginBottom:12}},
      ce("div",{style:{fontWeight:600,fontSize:12,color:T.muted,marginBottom:8}},"\u7761\u7720\u71c8\u865f\u5206\u5e03\uff08\u56db\u8272\uff09"),
      n===0?ce("div",{style:{fontSize:12,color:T.faint,textAlign:"center",padding:16}},"\u5c1a\u7121\u8cc7\u6599"):ce(BarChart,{items:sData})),
    ce(Card,{style:{marginBottom:12}},
      ce("div",{style:{fontWeight:600,fontSize:12,color:T.muted,marginBottom:8}},"\u75bc\u75db\u71c8\u865f\u5206\u5e03\uff08\u56db\u8272\uff09"),
      n===0?ce("div",{style:{fontSize:12,color:T.faint,textAlign:"center",padding:16}},"\u5c1a\u7121\u8cc7\u6599"):ce(BarChart,{items:pData})),
    ce(Card,{style:{marginBottom:12}},
      ce("div",{style:{fontWeight:600,fontSize:12,color:T.muted,marginBottom:8}},"MHI \u8eab\u5fc3\u5065\u5eb7\u71c8\u865f\u5206\u5e03\uff08\u56db\u8272\uff09"),
      mhiN<5?ce("div",{style:{fontSize:12,color:T.faint,textAlign:"center",padding:16}},mhiN===0?"\u5c1a\u7121MHI\u8a55\u4f30\u8cc7\u6599":"MHI\u8a55\u4f30\u7b46\u6578\u4e0d\u8db3\uff08k\u22655\u4fdd\u8b77\uff0c\u76ee\u524d"+mhiN+"\u7b46\uff09\uff0c\u9054\u5230\u4ee5\u4e0a\u5f8c\u81ea\u52d5\u986f\u793a"):ce(BarChart,{items:mhiData})),
    ce(Card,{style:{marginBottom:12}},
      ce("div",{style:{fontWeight:600,fontSize:12,color:T.muted,marginBottom:8}},"\u904e\u52de\u9ad8\u98a8\u96aa\u6bd4\u4f8b\uff08\u904e\u52de\u81ea\u8a55\u2265\uff14\u5206\uff09"),
      n===0?ce("div",{style:{fontSize:12,color:T.faint,textAlign:"center",padding:16}},"\u5c1a\u7121\u8cc7\u6599"):ce("div",{style:{display:"grid",gap:6}},
        ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0"}},
          ce("span",{style:{fontSize:13,color:LX.red.c,fontWeight:600}},"\ud83d\udd34 \u9ad8\u98a8\u96aa"),
          ce("span",{style:{fontWeight:800,color:LX.red.c}},owHighD+"%\uff08"+owHighN+"\u4eba\uff09")),
        ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0"}},
          ce("span",{style:{fontSize:13,color:LX.green.c,fontWeight:600}},"\ud83d\udfe2 \u6b63\u5e38"),
          ce("span",{style:{fontWeight:800,color:LX.green.c}},(100-owHighD)+"%\uff08"+(n-owHighN)+"\u4eba\uff09")))),
    deptRanks.length>0?ce(Card,{style:{marginBottom:12}},
      ce("div",{style:{fontWeight:600,fontSize:12,color:T.muted,marginBottom:8}},"\u90e8\u9580\u6392\u884c\uff08\u7d9c\u5408\u9054\u6210\u7387\uff0c\u5168\u671f\u9593\uff0c\u4e0d\u53d7\u4e0a\u65b9\u6642\u5e8f\u7be9\u9078\u5f71\u97ff\uff09"),
      deptRanks.map(function(d,i){
        var medal=i===0?"\u{1F947}":i===1?"\u{1F948}":i===2?"\u{1F949}":"";
        return ce("div",{key:d.dept,style:{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:i<deptRanks.length-1?"1px solid "+T.border:"none"}},
          ce("div",{style:{width:20,fontSize:14}},medal||(i+1+".")),
          ce("div",{style:{flex:1,fontSize:13,fontWeight:600,color:T.text}},d.dept),
          ce("div",{style:{fontSize:11,color:T.muted}},d.n+"\u4eba"),
          ce("div",{style:{fontSize:14,fontWeight:800,color:d.score>=80?T.teal:d.score>=60?T.amber:T.red}},d.score+"%"));
      })):ce(IBox,{c:"amber"},"\u5c1a\u7121\u90e8\u9580\u8cc7\u6599\u3002"),
    ce(Card,{style:{marginBottom:12}},
      ce("div",{style:{fontWeight:600,fontSize:12,color:T.muted,marginBottom:4}},"🩸 三高部門統計(個人自願授權，去識別化)"),
      ce("p",{style:{fontSize:11,color:T.muted,margin:"0 0 8px"}},"僅納入曾在「三高/BMI數值管理」勾選同意的員工，且該部門需至少5人同意才會顯示，絕不揭露個人數值。"),
      thDeptAgg&&thDeptAgg.byDept&&Object.keys(thDeptAgg.byDept).length>0?Object.keys(thDeptAgg.byDept).sort().map(function(dn){
        var dd=thDeptAgg.byDept[dn];
        if(dd.suppressed)return ce("div",{key:dn,style:{padding:"7px 0",borderBottom:"1px solid "+T.border,fontSize:12,color:T.muted}},dn+"：同意人數不足5人，暫不顯示(目前"+dd.n+"人)");
        return ce("div",{key:dn,style:{padding:"7px 0",borderBottom:"1px solid "+T.border}},
          ce("div",{style:{fontWeight:600,fontSize:13,color:T.text,marginBottom:3}},dn+"("+dd.n+"人同意)"),
          ce("div",{style:{display:"flex",gap:12,fontSize:11,color:T.muted,flexWrap:"wrap"}},
            dd.bpFilled>0?ce("span",null,"血壓達標 "+dd.bpControlled+"/"+dd.bpFilled):null,
            dd.gluFilled>0?ce("span",null,"血糖達標 "+dd.gluControlled+"/"+dd.gluFilled):null,
            dd.ldlFilled>0?ce("span",null,"血脂達標 "+dd.ldlControlled+"/"+dd.ldlFilled):null,
            (dd.bpHighRisk>0||dd.gluHighRisk>0)?ce("span",{style:{color:T.coral,fontWeight:600}},"異常高風險 "+(dd.bpHighRisk+dd.gluHighRisk)+"人次"):null));
      }):ce("div",{style:{fontSize:12,color:T.muted}},"目前尚無部門同意將三高資料用於統計，或同意人數未達門檻。")),
    n===0?ce(IBox,{c:"amber",style:{marginTop:8}},"\u5c1a\u7121\u7b26\u5408\u7be9\u9078\u689d\u4ef6\u7684\u8a55\u4f30\u8cc7\u6599\uff0c\u8acb\u653e\u5bec\u671f\u9593\u6216\u78ba\u8a8d\u90e8\u9580\u9078\u64c7\u3002"):null,
    ce(IBox,{c:"teal",style:{marginTop:8}},"\u8da8\u52e2\u6578\u636e\u4f9d submittedAt \u6642\u9593\u6233\u5be6\u969b\u904e\u6ffe\uff08\u82e5\u8a18\u9304\u672a\u5305\u542b submittedAt\uff0c\u4ecd\u4fdd\u7559\u4ee5\u514d\u820a\u8cc7\u6599\u6d88\u5931\uff09\u3002\u81ea\u8a02\u65e5\u671f\u5340\u9593\u512a\u5148\u65bc\u9031\u6578\u6309\u9215\u3002")
  );
}

function VenueScreen({session,onBack}){
  var[selected,setSelected]=useState(null);
  var[showMap,setShowMap]=useState(false);
  var venues=[
    {id:"taipei",city:"台北",name:"台北體驗中心",addr:"台北市信義區忠孝東路五段",area:"信義/松山區",transport:["捷運板南線忠孝復興站步行5分鐘","捷運文湖線忠孝復興站步行8分鐘","忠孝東路公車站牌步行2分鐘"],hours:"週一至週五 09:00-18:00(週六10:00-15:00需預約)",services:["舒曼波自律神經調節體驗(45分鐘)","LA200光能緩解疼痛體驗(30分鐘)","生物資訊檢測(20分鐘)","自律神經量測(15分鐘)","健康顧問一對一諮詢"],note:"首次體驗免費(每人限一次)・需提前3日預約確認",color:T.teal,icon:"🏙"},
    {id:"newtp",city:"新北",name:"新北體驗中心",addr:"新北市板橋區文化路一段",area:"板橋/新埔區",transport:["捷運板南線新埔站步行5分鐘","捷運板南線板橋站步行10分鐘","文化路公車站牌步行3分鐘"],hours:"週二至週六 09:00-18:00(週一休館)",services:["舒曼波自律神經調節體驗(45分鐘)","LA200光能緩解疼痛體驗(30分鐘)","生物資訊檢測(20分鐘)","自律神經量測(15分鐘)"],note:"首次體驗免費(每人限一次)・需提前2日預約確認",color:T.navy,icon:"🏘"}
  ];
  return ce(Screen,{title:"🗺 REIBI 體驗場域",onBack,maxW:680},
    ce(IBox,{c:"teal",style:{marginBottom:14}},"選擇最近的體驗場域，預約您的首次免費健康體驗(每人限一次)。體驗後搭配評估結果，為您量身規劃健管方案。"),
    ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}},
      venues.map(function(v){
        var isSel=selected===v.id;
        return ce("div",{key:v.id,onClick:function(){setSelected(isSel?null:v.id);},style:{padding:"16px",borderRadius:12,border:"2px solid "+(isSel?v.color:T.border),background:isSel?"linear-gradient(135deg,"+T.tealBg+",#fff)":T.card,cursor:"pointer",transition:"all .15s"}},
          ce("div",{style:{fontSize:28,marginBottom:6}},v.icon),
          ce("div",{style:{fontWeight:800,fontSize:14,color:isSel?v.color:T.text}},v.name),
          ce("div",{style:{fontSize:12,color:T.muted,marginTop:4}},v.area),
          isSel&&ce(Tag,{c:"teal",style:{marginTop:8}},"已選擇"));
      })),
    selected&&ce("div",{style:{display:"grid",gap:12}},function(){
      var v=venues.find(function(x){return x.id===selected;});
      return [
        ce(Card,{key:"info",style:{borderLeft:"4px solid "+v.color}},
          ce("div",{style:{fontWeight:800,fontSize:15,color:v.color,marginBottom:10}},v.icon+" "+v.name),
          ce("div",{style:{display:"grid",gap:8}},
            ce("div",null,
              ce("div",{style:{fontSize:11,fontWeight:700,color:T.muted,marginBottom:3}},"地址"),
              ce("div",{style:{fontSize:13,color:T.text}},v.addr)),
            ce("div",null,
              ce("div",{style:{fontSize:11,fontWeight:700,color:T.muted,marginBottom:3}},"開放時間"),
              ce("div",{style:{fontSize:13,color:T.text}},v.hours)),
            ce("div",null,
              ce("div",{style:{fontSize:11,fontWeight:700,color:T.muted,marginBottom:6}},"交通方式"),
              v.transport.map(function(tr){
                return ce("div",{key:tr,style:{fontSize:12,color:T.muted,display:"flex",gap:6,alignItems:"flex-start",marginBottom:4}},
                  ce("span",{style:{color:v.color,flexShrink:0}},"🚇"),
                  tr);
              })))),
        ce(Card,{key:"svcs"},
          ce(SecTitle,null,"可體驗服務"),
          v.services.map(function(sv){
            return ce("div",{key:sv,style:{padding:"8px 12px",borderBottom:"1px solid "+T.border,fontSize:12,color:T.text,display:"flex",gap:8,alignItems:"center"}},
              ce("span",{style:{color:v.color,fontWeight:700}},"\u2022"),
              sv);
          }),
          ce(IBox,{c:"amber",style:{marginTop:12}},v.note)),
        ce("div",{key:"btns",style:{display:"grid",gap:8}},
          ce(Btn,{full:true,v:"sage",onClick:function(){if(props.onBookAppt)props.onBookAppt(v.name);}},"📅 站內預約「"+v.name+"」"),
          ce(Btn,{full:true,v:"ghost",onClick:function(){
            window.open("https://line.me/R/ti/p/@reibicare","_blank");
          }},"📱 LINE預約 @reibicare"),
          ce("a",{href:"mailto:reibiservice@gmail.com?subject="+v.name+"%E9%AB%94%E9%A9%97%E9%A0%90%E7%B4%84",style:{display:"block",textAlign:"center",padding:"12px",borderRadius:10,border:"1px solid "+T.border,fontSize:13,color:T.teal,fontWeight:700,textDecoration:"none",background:T.card}},"📧 Email預約 reibiservice@gmail.com"),
          ce("div",{style:{fontSize:11,color:T.faint,textAlign:"center"}},"服務時間：週一至週五 09:00-18:00"))
      ];
    }()),
    !selected&&ce(Card,{style:{textAlign:"center",padding:24,color:T.muted}},
      ce("div",{style:{fontSize:36,marginBottom:8}},"📍"),
      ce("div",{style:{fontSize:13}},["請選擇上方場域，","查看詳細資訊及預約方式"].join(""))));
}


// ── 888計畫 8週介入時間軸 ────────────────────────────────────────────────────
function Plan888TimelineScreen({onBack,orgRecs}){
  var recs=orgRecs||[];
  var n=recs.length;
  var[selWeek,setSelWeek]=useState(null);
  var weeks=[
    {w:1,title:"基線建立",color:T.navy,icon:"📋",desc:"全員完成第一次健康評估(ISI+BPI+MHI+WQ)，建立個人健康基線。HR確認參與率目標。",actions:["所有員工完成初次四維健康評估","三高數值填報(選填，建立個人基線)","HR確認參與率統計(目標達80%)","系統自動生成初始燈號分布圖"],kpi:"初始參與率",target:"≥60%",milestone:"基線完成"},
    {w:2,title:"識能啟動",color:T.teal,icon:"💡",desc:"健康識能宣導週。員工了解四色燈號意義、ISI/BPI/MHI三維指標、行動打卡22項目。",actions:["主管說明大會：888計畫三個80%目標","四色燈號意義宣導(綠/黃/橙/紅)","行動打卡22項啟動(建議每日至少1項)","EAP資源介紹：心理/睡眠/疼痛諮詢管道"],kpi:"行動打卡開始率",target:"≥50%",milestone:"識能啟動"},
    {w:3,title:"習慣養成",color:T.sage,icon:"🌱",desc:"聚焦行動打卡習慣養成。每日健康行為記錄、AI個人化建議精讀、積分激勵機制啟動。",actions:["每日行動打卡持續執行","閱讀個人AI健管建議","積分累積：每日打卡+5點、每週評估+20點","高風險員工(橙/紅燈)由HR主動關懷聯繫"],kpi:"每週打卡完成率",target:"≥60%",milestone:"習慣養成"},
    {w:4,title:"中期評估",color:T.amber,icon:"📊",desc:"完成第二次健康評估，進行燈號前後比較分析。HR生成KPI中期報告，調整介入策略。",actions:["全員完成第二次健康評估","HR查看燈號改善率報告(中期KPI)","OKR中期盤點：各部門達成率檢視","持續紅燈員工安排面談/EAP轉介"],kpi:"燈號改善率(4週)",target:"≥30%",milestone:"中期盤點"},
    {w:5,title:"深化介入",color:T.coral,icon:"🎯",desc:"針對中期評估高風險族群深化介入。個人健管報告分析、EAP資源媒合、設備體驗預約。",actions:["橙/紅燈員工：建議預約REIBI設備體驗","個人健康報告下載與自主規劃","部門主管OKR健康目標調整","三高數值更新(已填報員工)"],kpi:"高風險介入完成率",target:"≥70%",milestone:"深化介入"},
    {w:6,title:"積分衝刺",color:T.plum,icon:"⭐",desc:"積分系統衝刺週。鼓勵員工累積積分兌換健康福利，強化持續參與動力。",actions:["積分排行榜公布(去識別化)","健康福利兌換方案說明","部門健康文化活動(可選)","睡眠日記/疼痛日誌數據回顧"],kpi:"積分參與率",target:"≥70%",milestone:"激勵衝刺"},
    {w:7,title:"成效追蹤",color:T.warm,icon:"📈",desc:"完成第三次健康評估，生成完整8週前後比較報告。準備KPI/OKR/ESG/GRI報告生成。",actions:["全員完成第三次健康評估","系統生成8週趨勢比較報告","KPI三大指標計算：改善率/盛行率/貢獻率","GRI 403-6揭露數據確認"],kpi:"三次評估完成率",target:"≥75%",milestone:"成效評估"},
    {w:8,title:"成果揭露",color:T.sage,icon:"🏆",desc:"888計畫成果總結。AI生成完整OKR+ESG+ROI報告，提交董事會/CEO健康資本投資回報報告。",actions:["AI生成完整健促成效報告(ESG/GRI/ROI)","OKR健康獎金計算與發放","向董事會提交健康資本ROI報告","規劃下一循環(可依需求調整週期)"],kpi:"三個80%達成率",target:"≥80%",milestone:"計畫完成"},
  ];
  var sortedRecs=recs.slice().sort(function(a,b){return (a.ts||"")>(b.ts||"")?1:-1;});
  var half=Math.ceil(sortedRecs.length/2);
  var earlyHalf=sortedRecs.slice(0,half);
  var lateHalf=sortedRecs.slice(half);
  var greenRate=function(list,key){
    return list.length?Math.round(list.filter(function(r){return r[key]==="green";}).length/list.length*100):0;
  };
  // 80%病情有效控制：以「睡眠+疼痛皆轉為綠燈」比例近似燈號改善成效(real data, 依org_{code}彙整紀錄計算)
  var controlRate=n?Math.round(recs.filter(function(r){return r.sKey==="green"&&r.pKey==="green";}).length/n*100):0;
  // 80%接受生活諮商：以「有提交評估」視為有接受循證建議引導之代理指標(org層級暫無打卡完成率彙整，故以評估提交率近似)
  var consultRate=n?Math.round(n/Math.max(n,1)*100):0; // 暫以100%(已提交=已收到建議)，待串接行動打卡組織彙整後精確化
  var goals=[
    {label:"80% 早期發現三高",val:null,c:T.teal,icon:"🔍",note:"三高數值目前僅存於個人端(th_{uid})，尚無組織層級彙整，無法計算覆蓋率"},
    {label:"80% 接受生活諮商",val:n>0?consultRate:0,c:T.sage,icon:"💊",note:n>0?"以「已提交評估視為已收到AI建議」近似計算，待串接22項打卡組織彙整後精確化":null},
    {label:"80% 病情有效控制",val:n>0?controlRate:0,c:T.amber,icon:"💪",note:n>0?"依組織評估紀錄計算：睡眠+疼痛皆達綠燈之比例":null},
  ];
  var selWkDetail=null;
  if(selWeek){
    var wkd=weeks.find(function(x){return x.w===selWeek;});
    selWkDetail=ce(Card,{style:{borderLeft:"4px solid "+wkd.color,marginBottom:14}},
      ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}},
        ce("div",null,
          ce("div",{style:{fontSize:20,display:"inline",marginRight:8}},wkd.icon),
          ce("span",{style:{fontWeight:800,fontSize:15,color:wkd.color}},"第 "+wkd.w+"週 · "+wkd.title)),
        ce(Tag,{c:"teal"},wkd.milestone)),
      ce("div",{style:{fontSize:12,color:T.muted,lineHeight:1.8,marginBottom:12}},wkd.desc),
      ce(SecTitle,null,"本週行動項目"),
      ce("div",{style:{display:"grid",gap:6}},
        wkd.actions.map(function(act){
          return ce("div",{key:act,style:{padding:"8px 12px",background:T.bg,borderRadius:8,fontSize:12,color:T.text,display:"flex",gap:8,alignItems:"flex-start"}},
            ce("span",{style:{color:wkd.color,fontWeight:700,flexShrink:0}},"✓"),
            act);
        })),
      ce("div",{style:{display:"flex",gap:12,marginTop:12,padding:"10px 14px",background:wkd.color,borderRadius:8,color:"#fff",alignItems:"center"}},
        ce("div",{style:{flex:1}},
          ce("div",{style:{fontSize:11,opacity:.8}},"本週KPI"),
          ce("div",{style:{fontWeight:800,fontSize:13}},wkd.kpi)),
        ce("div",{style:{textAlign:"right"}},
          ce("div",{style:{fontSize:11,opacity:.8}},"目標"),
          ce("div",{style:{fontWeight:800,fontSize:16}},wkd.target))));
  }
  return ce(Screen,{title:"📋 888計畫 8週介入時間軸",onBack,maxW:700},
    ce(IBox,{c:"sage",style:{marginBottom:14}},"888計畫以8週為一個介入循環，三個80%為核心KPI，8項健康指標為量化依據。點選各週查看詳細行動內容。"),
    ce(Card,{style:{marginBottom:14}},
      ce(SecTitle,null,"三個80%達成追蹤"),
      ce("div",{style:{display:"grid",gap:8}},
        goals.map(function(g){
          var ok=g.val!==null&&g.val>=80;
          return ce("div",{key:g.label},
            ce("div",{style:{display:"flex",alignItems:"center",gap:12}},
              ce("span",{style:{fontSize:16}},g.icon),
              ce("div",{style:{flex:1}},
                ce("div",{style:{display:"flex",justifyContent:"space-between",marginBottom:4}},
                  ce("span",{style:{fontSize:12,color:T.text,fontWeight:700}},g.label),
                  ce("span",{style:{fontSize:12,fontWeight:800,color:ok?T.sage:g.c}},g.val===null?"尚無資料":n>0?g.val+"%":"—")),
                ce("div",{style:{height:8,background:"#e7e5e4",borderRadius:4}},
                  (n>0&&g.val!==null)?ce("div",{style:{width:Math.min(g.val,100)+"%",height:"100%",background:ok?T.sage:g.c,borderRadius:4}}):null))),
            g.note&&ce("div",{style:{fontSize:10,color:T.faint,marginTop:2,marginLeft:28}},"ℹ "+g.note));
        })),
      n===0?ce("div",{style:{textAlign:"center",fontSize:12,color:T.faint,marginTop:8}},"(尚無組織評估資料)"):null),
    n>=2&&ce(Card,{style:{marginBottom:14}},
      ce(SecTitle,null,"📈 改善趨勢(前半期 vs 近期，依組織評估紀錄)"),
      ce(IBox,{c:"navy",style:{marginBottom:10,fontSize:11}},"以全部 "+n+" 筆組織評估紀錄依時間排序對半切分：前半期"+earlyHalf.length+"筆 vs 近期"+lateHalf.length+"筆，比較綠燈率變化。"),
      ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}},
        [{label:"睡眠綠燈率",key:"sKey",c:T.teal},{label:"疼痛綠燈率",key:"pKey",c:T.coral}].map(function(m){
          var ev=greenRate(earlyHalf,m.key);var lv=greenRate(lateHalf,m.key);var diff=lv-ev;
          return ce("div",{key:m.label,style:{padding:"10px 12px",background:T.bg,borderRadius:8}},
            ce("div",{style:{fontSize:11,color:T.muted,marginBottom:6}},m.label),
            ce("div",{style:{display:"flex",alignItems:"baseline",gap:8}},
              ce("span",{style:{fontSize:13,color:T.faint}},ev+"%"),
              ce("span",{style:{fontSize:13,color:T.faint}},"→"),
              ce("span",{style:{fontSize:18,fontWeight:800,color:m.c}},lv+"%")),
            ce("div",{style:{fontSize:11,fontWeight:700,color:diff>0?T.sage:diff<0?T.red:T.muted,marginTop:2}},
              diff>0?"↑ 改善 +"+diff+"%":diff<0?"↓ 退步 "+diff+"%":"持平"));
        }))),
    ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}},
      weeks.map(function(wk){
        var isSel=selWeek===wk.w;
        return ce("div",{key:wk.w,onClick:function(){setSelWeek(isSel?null:wk.w);},style:{padding:"12px 8px",borderRadius:10,border:"2px solid "+(isSel?wk.color:T.border),background:isSel?wk.color:T.card,cursor:"pointer",textAlign:"center",transition:"all .15s"}},
          ce("div",{style:{fontSize:20,marginBottom:4}},wk.icon),
          ce("div",{style:{fontSize:11,fontWeight:800,color:isSel?"#fff":wk.color}},"W"+wk.w),
          ce("div",{style:{fontSize:10,fontWeight:700,color:isSel?"rgba(255,255,255,.85)":T.text,marginTop:2,lineHeight:1.3}},wk.title),
          ce(Tag,{c:"gray",style:{marginTop:6,fontSize:9,padding:"2px 6px",opacity:isSel?0:1}},wk.milestone));
      })),
    selWkDetail,
    selWeek?null:ce(IBox,{c:"teal"},"點選上方任一週次，查看詳細行動內容與KPI目標。"),
    ce(Card,null,
      ce(SecTitle,null,"8項健康指標"),
      [{n:"①",l:"睡眠品質(ISI)",s:"<8分",f:"每週",t:"主要"},
       {n:"②",l:"疼痛管理(BPI)",s:"<13分",f:"每週",t:"主要"},
       {n:"③",l:"工作效率(WQ)",s:"改善≥20%",f:"每週",t:"主要"},
       {n:"④",l:"血壓管理",s:"<130/80",f:"年度更新",t:"補充"},
       {n:"⑤",l:"血糖管理",s:"空腹<100",f:"年度更新",t:"補充"},
       {n:"⑥",l:"血脂(LDL)",s:"<100",f:"年度更新",t:"補充"},
       {n:"⑦",l:"BMI/腰圍管理",s:"BMI 18.5-24",f:"每月",t:"次要"},
       {n:"⑧",l:"評估參與率",s:"≥80%",f:"每週",t:"主要"}].map(function(ind){
        return ce("div",{key:ind.n,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid "+T.border,fontSize:12}},
          ce("div",null,
            ce("span",{style:{fontWeight:700,color:T.teal,marginRight:6}},ind.n),
            ce("span",{style:{color:T.text}},ind.l),
            ce("span",{style:{color:T.muted,marginLeft:6}},"("+ind.f+")")),
          ce("div",{style:{display:"flex",gap:6,alignItems:"center"}},
            ce("span",{style:{color:T.muted,fontSize:11}},ind.s),
            ce(Tag,{c:ind.t==="主要"?"teal":ind.t==="次要"?"amber":"gray"},ind.t)));
      })));
}


// ── 睡眠日記 Sleep Diary (2週循環) ──────────────────────────────────────────
function SleepDiaryScreen({session,onBack,onPtsChange}){
  var uid=(session&&session.uid)||"g";
  var[entries,setEntries]=React.useState([]);
  var[today,setToday]=React.useState({bed:"",sleep:"",wakes:"",wake:"",quality:0});
  var[saved,setSaved]=React.useState(false);
  var[tab,setTab]=React.useState("record");

  React.useEffect(function(){
    stor.g("sleep_diary_"+uid).then(function(d){
      if(d)setEntries(JSON.parse(d));
    });
    var todayKey=new Date().toISOString().slice(0,10);
    stor.g("sleep_diary_today_"+uid).then(function(d){
      if(d){var p=JSON.parse(d);if(p.date===todayKey){setToday(p);setSaved(true);}}
    });
  },[]);

  function calcEff(bed,sleepMin,wakes,wake){
    try{
      var bedH=parseInt(bed.split(":")[0]);var bedM=parseInt(bed.split(":")[1]);
      var wakeH=parseInt(wake.split(":")[0]);var wakeM=parseInt(wake.split(":")[1]);
      var inBedMin=((wakeH*60+wakeM)-(bedH*60+bedM)+1440)%1440;
      var asleepMin=inBedMin-(parseInt(sleepMin)||0)-(parseInt(wakes)||0)*10;
      return Math.max(0,Math.min(100,Math.round(asleepMin/inBedMin*100)));
    }catch(e){return null;}
  }

  var doSave=function(){
    var todayKey=new Date().toISOString().slice(0,10);
    var eff=calcEff(today.bed,today.sleep,today.wakes,today.wake);
    var entry={...today,date:todayKey,eff:eff,ts:new Date().toISOString()};
    var newEntries=[entry,...entries.filter(function(e){return e.date!==todayKey;})];
    setEntries(newEntries);setSaved(true);
    stor.s("sleep_diary_"+uid,JSON.stringify(newEntries));
    stor.s("sleep_diary_today_"+uid,JSON.stringify(entry));
    DB.addPts(uid,3).then(function(np){if(onPtsChange)onPtsChange(np);});
  };

  var stars=function(n){return [1,2,3,4,5].map(function(i){
    return ce("button",{key:i,onClick:function(){setToday(function(p){return{...p,quality:i};});},
      style:{background:"none",border:"none",fontSize:22,cursor:"pointer",color:i<=today.quality?"#f59e0b":"#d1d5db",padding:"0 2px"}},i<=today.quality?"★":"☆");
  });};

  var last14=entries.slice(0,14);

  return ce(Screen,{title:"🌙 睡眠日記",onBack:onBack,maxW:560},
    ce("div",{style:{display:"flex",gap:4,marginBottom:14}},
      [{k:"record",l:"今日記錄"},{k:"history",l:"近2週記錄"},{k:"tips",l:"睡眠衛教"}].map(function(t){
        return ce("button",{key:t.k,onClick:function(){setTab(t.k);},
          style:{flex:1,padding:"8px 0",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12,
            background:tab===t.k?T.teal:T.card,color:tab===t.k?"#fff":T.muted,fontFamily:"inherit",
            border:"1px solid "+(tab===t.k?T.teal:T.border)}},t.l);
      })),

    tab==="record"&&ce("div",{style:{display:"grid",gap:12}},
      ce(IBox,{c:"teal"},"睡眠日記每日記錄，2週為一個循環。系統自動計算睡眠效率並產生改善建議。每日完成 +3積分"),
      saved&&ce(IBox,{c:"sage"},"✅ 今日已記錄完成"),
      ce(Card,null,
        ce(SecTitle,null,"今日睡眠記錄("+new Date().toLocaleDateString("zh-TW")+")"),
        ce("div",{style:{display:"grid",gap:10}},
          ce(Inp,{label:"昨晚上床時間",type:"time",value:today.bed,onChange:function(e){setToday(function(p){return{...p,bed:e.target.value};});}}),
          ce(Inp,{label:"入睡花了幾分鐘",type:"number",value:today.sleep,placeholder:"例：20",onChange:function(e){setToday(function(p){return{...p,sleep:e.target.value};});}}),
          ce(Inp,{label:"半夜醒來幾次",type:"number",value:today.wakes,placeholder:"0",onChange:function(e){setToday(function(p){return{...p,wakes:e.target.value};});}}),
          ce(Inp,{label:"最終起床時間",type:"time",value:today.wake,onChange:function(e){setToday(function(p){return{...p,wake:e.target.value};});}}))),
      ce(Card,null,
        ce("div",{style:{fontWeight:600,fontSize:13,color:T.muted,marginBottom:8}},"整體睡眠品質"),
        ce("div",{style:{display:"flex",alignItems:"center",gap:8}},
          stars(today.quality),
          today.quality>0&&ce("span",{style:{fontSize:12,color:T.muted}},["","很差","偏差","普通","良好","很好"][today.quality])),
        today.bed&&today.wake&&ce("div",{style:{marginTop:10,padding:"8px 12px",background:T.tealBg,borderRadius:8,fontSize:13,color:T.teal}},
          "預估睡眠效率：",ce("strong",null,(calcEff(today.bed,today.sleep,today.wakes,today.wake)||"—")+"%"),
          "(≥85%為理想)")),
      ce(Btn,{onClick:doSave,disabled:!today.bed||!today.wake||!today.quality,full:true,sz:"lg"},"儲存今日睡眠記錄 +3積分")),

    tab==="history"&&ce("div",{style:{display:"grid",gap:8}},
      last14.length===0?ce(IBox,{c:"teal"},"尚無記錄，從今天開始建立睡眠日記吧！"):
      last14.map(function(e){
        var effColor=e.eff>=85?T.sage:e.eff>=70?T.amber:T.red;
        return ce(Card,{key:e.date,style:{padding:"10px 14px"}},
          ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
            ce("div",null,
              ce("div",{style:{fontWeight:700,fontSize:13,color:T.text}},e.date),
              ce("div",{style:{fontSize:11,color:T.muted}},"上床:"+e.bed+" 起床:"+e.wake+" 入睡:"+e.sleep+"分鐘")),
            ce("div",{style:{textAlign:"right"}},
              e.eff!=null&&ce("div",{style:{fontSize:16,fontWeight:800,color:effColor}},e.eff+"%"),
              ce("div",{style:{fontSize:11,color:T.muted}},"睡眠效率"),
              ce("div",null,[1,2,3,4,5].map(function(i){return ce("span",{key:i,style:{color:i<=e.quality?"#f59e0b":"#d1d5db",fontSize:12}},i<=e.quality?"★":"☆");})))));
      })),

    tab==="tips"&&ce(Card,null,
      ce(SecTitle,null,"睡眠衛教重點"),
      ce("div",{style:{display:"grid",gap:10}},
        [
          {t:"睡眠效率目標","c":"≥85%為理想。若效率偏低，建議減少在床時間，待困意充足再上床(睡眠限制療法CBT-I核心技術)。"},
          {t:"固定作息","c":"無論幾點入睡，每天同一時間起床。週末補眠勿超過1小時，避免社交時差打亂生理時鐘。"},
          {t:"睡前準備","c":"睡前1小時避免螢幕藍光，可進行放鬆伸展、冥想或溫水淋浴(體溫下降有助入睡)。"},
          {t:"舒曼波體驗","c":"7.83Hz地球舒曼共振頻率有助調節自律神經，建議睡前30分鐘體驗，輔助身心放鬆準備入睡。"},
        ].map(function(item){
          return ce(Card,{key:item.t,style:{borderLeft:"4px solid "+T.teal,padding:"10px 14px"}},
            ce("div",{style:{fontWeight:700,fontSize:13,color:T.teal,marginBottom:4}},item.t),
            ce("p",{style:{fontSize:12,color:T.muted,lineHeight:1.7,margin:0}},item.c));
        })))
  );
}

// ── 疼痛日誌 Pain Journal (4週循環) ─────────────────────────────────────────
function PainDiaryScreen({session,onBack,onPtsChange}){
  var uid=(session&&session.uid)||"g";
  var[entries,setEntries]=React.useState([]);
  var[today,setToday]=React.useState({level:0,times:[],triggers:[],relief:[],workImpact:0});
  var[saved,setSaved]=React.useState(false);
  var[tab,setTab]=React.useState("record");

  React.useEffect(function(){
    stor.g("pain_diary_"+uid).then(function(d){if(d)setEntries(JSON.parse(d));});
    var todayKey=new Date().toISOString().slice(0,10);
    stor.g("pain_diary_today_"+uid).then(function(d){
      if(d){var p=JSON.parse(d);if(p.date===todayKey){setToday(p);setSaved(true);}}
    });
  },[]);

  function toggleArr(arr,val){return arr.includes(val)?arr.filter(function(x){return x!==val;}):[...arr,val];}

  var doSave=function(){
    var todayKey=new Date().toISOString().slice(0,10);
    var entry={...today,date:todayKey,ts:new Date().toISOString()};
    var newEntries=[entry,...entries.filter(function(e){return e.date!==todayKey;})];
    setEntries(newEntries);setSaved(true);
    stor.s("pain_diary_"+uid,JSON.stringify(newEntries));
    stor.s("pain_diary_today_"+uid,JSON.stringify(entry));
    DB.addPts(uid,3).then(function(np){if(onPtsChange)onPtsChange(np);});
  };

  var painColor=function(n){return n===0?T.sage:n<=3?T.sage:n<=6?T.amber:T.red;};
  var levels=[0,1,2,3,4,5,6,7,8,9,10];
  var timesOpts=["清晨","上午","下午","傍晚","夜晚","全天"];
  var trigOpts=["久坐","長時間站立","體力勞動","氣候變化","壓力/情緒","睡眠不足","其他"];
  var reliefOpts=["休息","伸展運動","舒曼波體驗","LA200光能體驗","熱敷/冷敷","藥物","其他"];

  return ce(Screen,{title:"🩺 疼痛日誌",onBack:onBack,maxW:560},
    ce("div",{style:{display:"flex",gap:4,marginBottom:14}},
      [{k:"record",l:"今日記錄"},{k:"history",l:"近4週記錄"},{k:"tips",l:"疼痛衛教"}].map(function(t){
        return ce("button",{key:t.k,onClick:function(){setTab(t.k);},
          style:{flex:1,padding:"8px 0",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12,
            background:tab===t.k?T.coral:T.card,color:tab===t.k?"#fff":T.muted,fontFamily:"inherit",
            border:"1px solid "+(tab===t.k?T.coral:T.border)}},t.l);
      })),

    tab==="record"&&ce("div",{style:{display:"grid",gap:12}},
      ce(IBox,{c:"teal"},"疼痛日誌每日記錄，4週為一個循環。記錄疼痛型態有助醫師精準評估。每日完成 +3積分"),
      saved&&ce(IBox,{c:"sage"},"✅ 今日已記錄完成"),
      ce(Card,null,
        ce(SecTitle,null,"今日最高疼痛強度(0-10)"),
        ce("div",{style:{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center",margin:"10px 0"}},
          levels.map(function(n){
            var sel=today.level===n;
            return ce("button",{key:n,onClick:function(){setToday(function(p){return{...p,level:n};});},
              style:{width:36,height:36,borderRadius:"50%",border:"2px solid "+(sel?painColor(n):T.border),
                background:sel?painColor(n):T.card,color:sel?"#fff":T.text,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}},n);
          })),
        today.level>0&&ce("div",{style:{textAlign:"center",fontSize:12,color:painColor(today.level),fontWeight:600}},
          today.level<=3?"輕度疼痛":today.level<=6?"中度疼痛":"重度疼痛")),
      ce(Card,null,
        ce(SecTitle,null,"疼痛時段(可複選)"),
        ce("div",{style:{display:"flex",gap:8,flexWrap:"wrap"}},
          timesOpts.map(function(opt){
            var sel=today.times.includes(opt);
            return ce("button",{key:opt,onClick:function(){setToday(function(p){return{...p,times:toggleArr(p.times,opt)};});},
              style:{padding:"6px 12px",borderRadius:20,border:"1px solid "+(sel?T.coral:T.border),
                background:sel?T.coralBg:T.card,color:sel?T.coral:T.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit"}},opt);
          }))),
      ce(Card,null,
        ce(SecTitle,null,"可能觸發因素(可複選)"),
        ce("div",{style:{display:"flex",gap:8,flexWrap:"wrap"}},
          trigOpts.map(function(opt){
            var sel=today.triggers.includes(opt);
            return ce("button",{key:opt,onClick:function(){setToday(function(p){return{...p,triggers:toggleArr(p.triggers,opt)};});},
              style:{padding:"6px 12px",borderRadius:20,border:"1px solid "+(sel?T.amber:T.border),
                background:sel?T.amberBg:T.card,color:sel?T.amber:T.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit"}},opt);
          }))),
      ce(Card,null,
        ce(SecTitle,null,"今日緩解方式(可複選)"),
        ce("div",{style:{display:"flex",gap:8,flexWrap:"wrap"}},
          reliefOpts.map(function(opt){
            var sel=today.relief.includes(opt);
            return ce("button",{key:opt,onClick:function(){setToday(function(p){return{...p,relief:toggleArr(p.relief,opt)};});},
              style:{padding:"6px 12px",borderRadius:20,border:"1px solid "+(sel?T.sage:T.border),
                background:sel?T.sageBg:T.card,color:sel?T.sage:T.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit"}},opt);
          }))),
      ce(Btn,{onClick:doSave,disabled:!today.level&&today.level!==0,full:true,sz:"lg"},"儲存今日疼痛記錄 +3積分")),

    tab==="history"&&ce("div",{style:{display:"grid",gap:8}},
      entries.length===0?ce(IBox,{c:"teal"},"尚無記錄，從今天開始建立疼痛日誌吧！"):
      entries.slice(0,28).map(function(e){
        return ce(Card,{key:e.date,style:{padding:"10px 14px"}},
          ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
            ce("div",null,
              ce("div",{style:{fontWeight:700,fontSize:13,color:T.text}},e.date),
              e.triggers&&e.triggers.length>0&&ce("div",{style:{fontSize:11,color:T.muted,marginTop:2}},
                "觸發："+e.triggers.join("、"))),
            ce("div",{style:{textAlign:"right"}},
              ce("div",{style:{fontSize:22,fontWeight:800,color:painColor(e.level)}},e.level),
              ce("div",{style:{fontSize:10,color:T.muted}},"/10"))));
      })),

    tab==="tips"&&ce(Card,null,
      ce(SecTitle,null,"疼痛衛教重點"),
      ce("div",{style:{display:"grid",gap:10}},
        [
          {t:"IASP 2019 睡眠疼痛雙向關聯","c":"88%慢性疼痛患者存在睡眠問題。睡眠剝奪會降低疼痛閾值、增強疼痛感受。改善睡眠是疼痛管理的重要一環。"},
          {t:"紀錄疼痛型態","c":"連續記錄2-4週可找出疼痛觸發規律。建議就醫時攜帶疼痛日誌，幫助醫師進行精準診斷與治療規劃。"},
          {t:"LA200光能體驗","c":"660-808nm低能量雷射(LLLT)有效緩解肌肉疼痛，建議每週1-3次(依燈號調整)，搭配伸展運動效果更佳。"},
          {t:"非藥物疼痛管理","c":"熱敷(慢性疼痛)/冷敷(急性)、輕度有氧運動、腹式呼吸放鬆、正念冥想均有助降低疼痛感受強度。"},
        ].map(function(item){
          return ce(Card,{key:item.t,style:{borderLeft:"4px solid "+T.coral,padding:"10px 14px"}},
            ce("div",{style:{fontWeight:700,fontSize:13,color:T.coral,marginBottom:4}},item.t),
            ce("p",{style:{fontSize:12,color:T.muted,lineHeight:1.7,margin:0}},item.c));
        })))
  );
}

// ── 過負荷評估(個人版)Overwork Risk Self-Check ────────────────────────────
var OWQ=[
  {id:"ow1",cat:"工作時間",text:"過去一個月，平均每週工作(含加班)超過幾小時？",opts:["40小時以下(0)","40-50小時(1)","51-60小時(2)","61-70小時(3)","71小時以上(4)"]},
  {id:"ow2",cat:"休假狀況",text:"過去一個月，您有幾天完全無法休息(含假日出勤或在家處理公務)？",opts:["0天(0)","1-2天(1)","3-5天(2)","6-10天(3)","11天以上(4)"]},
  {id:"ow3",cat:"睡眠品質",text:"因工作原因導致睡眠不足(少於6小時)的頻率？",opts:["完全沒有(0)","每月1-2次(1)","每週1-2次(2)","每週3-4次(3)","幾乎每天(4)"]},
  {id:"ow4",cat:"身體症狀",text:"近期是否有以下過勞身體警訊？(頭痛、心悸、胸悶、頸肩痠痛、容易疲倦)",opts:["完全沒有(0)","偶爾出現(1)","每週出現(2)","幾乎每天(3)","嚴重影響生活(4)"]},
  {id:"ow5",cat:"心理壓力",text:"您對目前工作量與期限的壓力感受？",opts:["輕鬆可應付(0)","稍有壓力(1)","明顯壓力(2)","壓力很大(3)","無法負荷(4)"]},
  {id:"ow6",cat:"工作自主性",text:"您是否有權決定工作方式或調整工作量？",opts:["完全可自主(0)","多數可自主(1)","部分可自主(2)","很少能自主(3)","完全無法(4)"]},
  {id:"ow7",cat:"心理負擔",text:"下班後仍持續擔憂工作(包含假日)的頻率？",opts:["完全沒有(0)","偶爾(1)","每週數次(2)","幾乎每天(3)","全天無法停止(4)"]},
  {id:"ow8",cat:"社交功能",text:"因工作過度忙碌而減少家人、朋友或休閒活動的程度？",opts:["沒有影響(0)","輕微減少(1)","明顯減少(2)","幾乎沒有私人時間(3)","完全沒有私人生活(4)"]},
];
var OW_RISK_FACTORS=[
  {label:"長期加班(月平均超過45小時)",key:"rf1"},
  {label:"輪班制或夜班工作",key:"rf2"},
  {label:"有高血壓、糖尿病或心臟病史",key:"rf3"},
  {label:"近期有親人重大傷病或喪親事件",key:"rf4"},
  {label:"主管或同事關係緊張",key:"rf5"},
  {label:"工作績效壓力極大(考核、業績)",key:"rf6"},
  {label:"近一年曾出現心悸、胸痛或暈眩",key:"rf7"},
  {label:"每天坐辦公室超過8小時、缺乏運動",key:"rf8"},
];
function owLevel(t,isOrg){
  if(t<=8)return{key:"green",label:"低風險",desc:"目前工作負荷在可接受範圍，維持現有習慣並定期自我評估。",action:"維持規律運動與作息，每年評估一次。"};
  if(t<=16)return{key:"yellow",label:"中等風險",desc:"部分過勞危險因子存在，建議主動調整工作方式並關注身體訊號。",action:isOrg?"每月自我評估一次，與主管溝通工作負荷，落實休假。":"每月自我評估一次，主動調整工作安排，落實休假與運動。"};
  if(t<=24)return{key:"orange",label:"高風險",desc:"過勞風險明顯，建議盡快進行職業健康面談並調整工作量。",action:isOrg?"建議告知HR或主管，安排臨場健康服務醫師面談，填寫過負荷評估問卷。":"建議諮詢職業醫師或家庭醫師，主動調整工作量，填寫過負荷自評問卷。"};
  return{key:"red",label:"極高風險",desc:"過勞警示！請立即採取行動降低工作負荷。",action:isOrg?"立即通知主管或HR，安排職業醫學科評估，必要時啟動病假或輔導機制。":"立即諮詢職業醫師或家庭醫師，考慮調整工作型態，必要時申請就醫協助。安心專線：1925"};
}
function OverworkScreen({session,onBack,onNav,onPtsChange,orgRecs}){
  var uid=(session&&session.uid)||"g";
  var orgCode=(session&&session.orgCode)||"";
  var[mode,setMode]=React.useState("menu");
  var[ans,setAns]=React.useState([]);
  var[rfAns,setRfAns]=React.useState([]);
  var[history,setHistory]=React.useState([]);
  var[last,setLast]=React.useState(null);
  var[owSchedule,setOwSchedule]=React.useState(null);
  React.useEffect(function(){
    stor.g("ow_hist_"+uid).then(function(d){
      if(d){var h=JSON.parse(d);setHistory(h);if(h.length>0)setLast(h[0]);}
    });
    if(orgCode){
      stor.g("ow_schedule_"+orgCode).then(function(d){if(d)setOwSchedule(JSON.parse(d));});
    }
  },[]);
  function calcNextReminder(sch){
    if(!sch||!sch.dates||sch.dates.length===0)return null;
    var today=new Date();today.setHours(0,0,0,0);
    var allDates=sch.dates.concat(sch.highRiskDates||[]);
    var best=null;
    for(var i=0;i<allDates.length;i++){
      if(!allDates[i])continue;
      var d=new Date(allDates[i]);d.setHours(0,0,0,0);
      var diff=Math.floor((d-today)/(1000*60*60*24));
      if(diff>=0&&diff<=30){
        if(!best||diff<best.daysLeft)best={date:allDates[i],daysLeft:diff,label:sch.label||"過負荷評估"};
      }
    }
    return best;
  }
  var nextReminder=calcNextReminder(owSchedule);
  function doSave(){
    var total=ans.reduce(function(s,v){return s+(v||0);},0);
    var rfCount=rfAns.length;
    var finalScore=total+Math.min(rfCount,4);
    var lv=owLevel(finalScore,!!orgCode);
    var rec={ts:new Date().toISOString(),score:finalScore,level:lv.key,label:lv.label,rfCount:rfCount,ans:ans.slice(),rfAns:rfAns.slice()};
    var newHist=[rec,...history].slice(0,12);
    stor.s("ow_hist_"+uid,JSON.stringify(newHist));
    if(orgCode)DB.bumpOshCnt("ow",orgCode);
    setHistory(newHist);setLast(rec);
    if(onPtsChange)onPtsChange(function(p){return p+10;});
    setMode("result");
  }
  var lx=last&&(LX[last.level]||LX.green);
  if(mode==="quiz"){
    var allAns=ans.length>=OWQ.length&&ans.every(function(v){return v!==undefined;});
    return ce(Screen,{title:"⚡ 過勞風險評估",onBack:function(){setMode("menu");},maxW:560},
      ce(IBox,{c:"amber",style:{marginBottom:14}},"8題 · 約4分鐘 · 完成後 +10積分 · 建議每年至少評估1次(高風險族群每6個月)"),
      ce("div",{style:{display:"grid",gap:14}},
        OWQ.map(function(q,qi){
          return ce(Card,{key:q.id},
            ce("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:8}},
              ce(Tag,{c:"amber"},q.cat),
              ce("span",{style:{fontSize:13,fontWeight:700,color:T.text}},q.text)),
            ce("div",{style:{display:"grid",gap:6}},
              q.opts.map(function(opt,oi){
                var val=parseInt(opt.match(/\((\d)\)/)[1]);
                var sel=ans[qi]===val;
                return ce("button",{key:opt,onClick:function(){
                  var na=ans.slice();na[qi]=val;setAns(na);},
                  style:{padding:"8px 12px",borderRadius:8,border:"1px solid "+(sel?T.amber:T.border),
                    background:sel?T.amberBg:T.card,color:sel?T.amber:T.text,fontSize:12,
                    textAlign:"left",cursor:"pointer",fontFamily:"inherit",fontWeight:sel?700:400}},opt);
              })));
        })),
      ce(Card,{style:{marginTop:4}},
        ce("div",{style:{fontWeight:700,fontSize:13,color:T.coral,marginBottom:10}},"常見過勞危險因子(可複選)"),
        ce("div",{style:{display:"grid",gap:8}},
          OW_RISK_FACTORS.map(function(rf){
            var sel=rfAns.indexOf(rf.key)>-1;
            return ce("button",{key:rf.key,onClick:function(){
              setRfAns(function(prev){return sel?prev.filter(function(k){return k!==rf.key;}):[...prev,rf.key];});},
              style:{padding:"8px 12px",borderRadius:8,border:"1px solid "+(sel?T.coral:T.border),
                background:sel?T.coralBg:T.card,color:sel?T.coral:T.text,fontSize:12,
                textAlign:"left",cursor:"pointer",fontFamily:"inherit",fontWeight:sel?700:400,display:"flex",alignItems:"center",gap:8}},
              ce("span",{style:{fontSize:14}},sel?"☑":"☐"),rf.label);
          }))),
      ce(Btn,{onClick:doSave,disabled:!allAns,full:true,sz:"lg",style:{marginTop:14}},"完成評估 +10積分"));
  }
  if(mode==="result"&&last){
    var lv2=owLevel(last.score,!!orgCode);var lx2=LX[lv2.key]||LX.green;
    return ce(Screen,{title:"⚡ 過勞評估結果",onBack:function(){setMode("menu");},maxW:520},
      ce(Card,{style:{textAlign:"center",padding:28,background:lx2.bg,border:"1px solid "+lx2.br,marginBottom:14}},
        ce("div",{style:{fontSize:48,fontWeight:800,color:lx2.c}},last.score),
        ce("div",{style:{fontSize:12,color:T.muted,marginBottom:8}},"過勞風險總分(參考值)"),
        ce(LBadge,{k:lv2.key}),
        ce("p",{style:{color:T.muted,fontSize:13,marginTop:10,lineHeight:1.8}},lv2.desc)),
      last.rfCount>0&&ce(IBox,{c:"coral",style:{marginBottom:14}},"您勾選了 "+last.rfCount+" 項過勞危險因子，已計入風險加權。"),
      ce(Card,{style:{borderLeft:"4px solid "+lx2.c,marginBottom:14}},
        ce("div",{style:{fontWeight:700,fontSize:13,color:lx2.c,marginBottom:6}},"建議行動"),
        ce("p",{style:{fontSize:13,color:T.muted,lineHeight:1.8,margin:0}},lv2.action)),
      (lv2.key==="orange"||lv2.key==="red")&&ce("div",{style:{marginBottom:14}},
        ce(IBox,{c:"red",style:{marginBottom:8}},
          orgCode?
            "⚠ 高過勞風險 · 建議告知HR或主管，安排臨場健康服務醫師面談 · 安心專線：1925":
            "⚠ 高過勞風險 · 建議諮詢職業醫師或家庭醫師進行進一步評估 · 安心專線：1925"),
        ce("div",{style:{display:"flex",gap:8,flexWrap:"wrap"}},
          ce(Btn,{v:"sage",onClick:function(){if(onNav)onNav("eap");}},
            "💚 查看健康關懷資源"),
          ce("a",{href:"tel:1925",style:{display:"flex",alignItems:"center",padding:"8px 16px",borderRadius:8,background:T.redBg,color:T.red,fontSize:13,fontWeight:700,textDecoration:"none",border:"1px solid "+T.red}},
            "📞 安心專線 1925"))),
      ce(Card,{style:{marginBottom:14}},
        ce("div",{style:{fontWeight:700,fontSize:13,color:T.text,marginBottom:10}},"相關資訊"),
        ce("div",{style:{display:"grid",gap:6}},
          (orgCode?
            ["《職業安全衛生法》第6條：雇主對異常工作負荷有預防義務","勞動部「異常工作負荷促發疾病預防指引」","GRI 403-9：在職失能及缺勤揭露","職業促發腦心血管疾病預防：月加班逾45小時屬高風險"]:
            ["勞工健康保護規則：勞工可向雇主申請健康諮詢","職業促發腦心血管疾病預防：長時間過勞為重要危險因子","安心專線1925：24小時免費心理健康諮詢服務","建議定期進行年度健康檢查，主動了解自身健康狀況"]
          ).map(function(t){
            return ce("div",{key:t,style:{fontSize:12,color:T.muted,padding:"4px 8px",background:T.bg,borderRadius:6}},t);
          }))),
      ce(Btn,{onClick:function(){setMode("menu");},full:true},"返回"));
  }
  if(mode==="history"){
    return ce(Screen,{title:"⚡ 過勞評估記錄",onBack:function(){setMode("menu");},maxW:520},
      history.length===0?ce(Card,{style:{textAlign:"center",padding:36,color:T.muted}},"尚無評估記錄"):
      ce("div",{style:{display:"grid",gap:10}},
        history.map(function(h){
          var lx3=LX[h.level]||LX.green;
          return ce(Card,{key:h.ts,style:{borderLeft:"4px solid "+lx3.c}},
            ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
              ce("div",null,
                ce("div",{style:{fontSize:12,color:T.muted}},h.ts.slice(0,10)),
                ce("div",{style:{fontSize:16,fontWeight:800,color:lx3.c}},h.score+" 分"),
                ce("div",{style:{fontSize:11,color:T.muted}},"危險因子："+h.rfCount+" 項")),
              ce(LBadge,{k:h.level})));
        })));
  }
  return ce(Screen,{title:"⚡ 過勞風險自我檢視",onBack:onBack,maxW:560},
    nextReminder?ce("div",{style:{marginBottom:14,padding:"12px 16px",background:nextReminder.daysLeft<=7?LX.red.bg:LX.orange.bg,border:"2px solid "+(nextReminder.daysLeft<=7?LX.red.br:LX.orange.br),borderRadius:10}},
      ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
        ce("div",null,
          ce("div",{style:{fontWeight:800,fontSize:13,color:nextReminder.daysLeft<=7?LX.red.c:LX.orange.c}},"⏰ 公司排程提醒："+nextReminder.label),
          ce("div",{style:{fontSize:12,color:T.muted,marginTop:2}},"預定評估日期："+nextReminder.date+(nextReminder.daysLeft===0?"(今天！)":nextReminder.daysLeft===1?"(明天)":"(還有"+nextReminder.daysLeft+"天)"))),
        ce(Btn,{sz:"sm",v:"amber",onClick:function(){setAns([]);setRfAns([]);setMode("quiz");}},"立即評估"))):null,
    ce(IBox,{c:"amber",style:{marginBottom:14}},"依據勞動部「異常工作負荷促發疾病預防指引」，定期評估過勞風險，協助及早發現並採取因應措施。"),
    last?ce(Card,{style:{marginBottom:14,background:lx.bg,border:"1px solid "+lx.br}},
      ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
        ce("div",null,
          ce("div",{style:{fontSize:11,color:T.muted}},"上次評估："+last.ts.slice(0,10)),
          ce("div",{style:{fontSize:22,fontWeight:800,color:lx.c}},last.score+" 分"),
          ce(LBadge,{k:last.level})),
        ce("div",{style:{textAlign:"right",fontSize:12,color:T.muted}},"危險因子：",ce("br"),last.rfCount+" 項")))
    :ce(IBox,{c:"teal",style:{marginBottom:14}},"尚未評估 · 建議每年完成一次，高風險族群每6個月評估一次"),
    ce("div",{style:{display:"grid",gap:10}},
      ce(Card,{onClick:function(){setAns([]);setRfAns([]);setMode("quiz");},style:{cursor:"pointer",borderLeft:"4px solid "+T.amber}},
        ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
          ce("div",null,
            ce("div",{style:{fontWeight:700,fontSize:14,color:T.amber}},"⚡ 過勞風險量表"),
            ce("div",{style:{fontSize:12,color:T.muted,marginTop:3}},"8題 + 危險因子勾選 · 約4分鐘 · +10積分")),
          ce("div",{style:{fontSize:20}},"▶"))),
      ce(Card,{style:{borderLeft:"4px solid "+T.navy}},
        ce("div",{style:{fontWeight:700,fontSize:13,color:T.navy,marginBottom:8}},"常見過勞危險因子說明"),
        ce("div",{style:{display:"grid",gap:6}},
          ["月加班超過45小時：腦心血管疾病風險顯著提升","夜班/輪班：生理時鐘紊亂，睡眠品質下降","有三高(高血壓/糖尿病/高血脂)病史：心臟負荷加大","長期久坐與缺乏運動：代謝症候群風險上升","人際衝突與職場霸凌：心理健康影響工作負荷感"].map(function(t){
            return ce("div",{key:t,style:{fontSize:12,color:T.muted,padding:"4px 0",borderBottom:"1px solid "+T.border}},t);
          }))),
      history.length>0&&ce(Btn,{v:"ghost",full:true,onClick:function(){setMode("history");}},"📊 查看歷史評估記錄")));
}

// ── HR過負荷彙整管理(管理者版)Overwork HR Dashboard ───────────────────────
function OverworkHRScreen({session,onBack,orgRecs,orgTH}){
  var recs=orgRecs||[];
  var n=recs.length;
  var orgCode=(session&&session.orgCode)||"demo";
  var[loading,setLoading]=React.useState(false);
  var[report,setReport]=React.useState("");
  var[prog,setProg]=React.useState(0);
  var[schedule,setSchedule]=React.useState({label:"年度過負荷評估",dates:["",""],notifyDays:30,highRiskDates:[""],note:""});
  var[schedSaved,setSchedSaved]=React.useState(false);
  var[trackList,setTrackList]=React.useState([]);
  var[newTrack,setNewTrack]=React.useState({empId:"",dept:"",riskLv:"orange",followDate:"",note:"",status:"待追蹤"});
  var[showTrackForm,setShowTrackForm]=React.useState(false);
  React.useEffect(function(){
    stor.g("ow_schedule_"+orgCode).then(function(d){if(d)setSchedule(JSON.parse(d));});
    stor.g("ow_tracklist_"+orgCode).then(function(d){if(d)setTrackList(JSON.parse(d));});
  },[]);
  function setSF(k,v){setSchedule(function(s){var u={};u[k]=v;return Object.assign({},s,u);});}
  function setDateAt(arr,idx,val){var a=arr.slice();a[idx]=val;return a;}
  function doSaveSchedule(){
    var clean=Object.assign({},schedule,{
      dates:schedule.dates.filter(function(d){return d&&d.length>0;}),
      highRiskDates:schedule.highRiskDates.filter(function(d){return d&&d.length>0;})
    });
    stor.s("ow_schedule_"+orgCode,JSON.stringify(clean));
    setSchedSaved(true);setTimeout(function(){setSchedSaved(false);},2500);
  }
  function doAddTrack(){
    if(!newTrack.empId){return;}
    var rec=Object.assign({},newTrack,{id:"TK"+Date.now(),createdAt:new Date().toISOString()});
    var nl=[rec,...trackList];
    setTrackList(nl);
    stor.s("ow_tracklist_"+orgCode,JSON.stringify(nl));
    setNewTrack({empId:"",dept:"",riskLv:"orange",followDate:"",note:"",status:"待追蹤"});
    setShowTrackForm(false);
  }
  function doUpdateTrackStatus(id,status){
    var nl=trackList.map(function(t){return t.id===id?Object.assign({},t,{status:status}):t;});
    setTrackList(nl);
    stor.s("ow_tracklist_"+orgCode,JSON.stringify(nl));
  }
  // 三高組織層級風險指標(來自org_th_{orgCode})
  var thRiskNote="";var thWarning=false;
  if(orgTH&&!orgTH.suppressed&&orgTH.n>=5){
    var bpUnctrl=orgTH.bpFilled?Math.round((orgTH.bpFilled-orgTH.bpControlled)/orgTH.bpFilled*100):null;
    if(bpUnctrl!==null&&bpUnctrl>=30){thWarning=true;}
    thRiskNote="血壓填報"+orgTH.bpFilled+"人，未達控制標準(≥130/80)："+(bpUnctrl!==null?bpUnctrl+"%":"—")+"。三高填報覆蓋率："+orgTH.coverageRate+"%(Framingham心血管風險需參考個人血脂值，組織層級以覆蓋率+控制率代理)。";
  }else{
    thRiskNote="三高填報資料"+(orgTH&&orgTH.suppressed?"筆數不足(k<5保護，目前"+orgTH.n+"筆)":"尚無")+"，無法計算心血管組織風險。建議HR鼓勵成員填報三高數值。";
  }
  // 模擬：從orgRecs交叉比對高風險燈號(ISI橙紅+BPI橙紅)作為過勞高風險代理指標
  var highSleep=recs.filter(function(r){return r.sKey==="red"||r.sKey==="orange";});
  var highPain=recs.filter(function(r){return r.pKey==="red"||r.pKey==="orange";});
  var bothHigh=recs.filter(function(r){return (r.sKey==="red"||r.sKey==="orange")&&(r.pKey==="red"||r.pKey==="orange");});
  var highRisk=bothHigh.length;
  var pct=n>0?Math.round(highRisk/n*100):0;
  var sleepPct=n>0?Math.round(highSleep.length/n*100):0;
  var painPct=n>0?Math.round(highPain.length/n*100):0;
  var riskLv=pct>=30?"red":pct>=15?"orange":pct>=8?"yellow":"green";
  var riskLx=LX[riskLv]||LX.green;
  // v10.3.20新增：健康危險因子指標(三高未達標率+MHI平均分數+三高過勞雙重高風險估算)
  var thHasData=orgTH&&!orgTH.suppressed&&orgTH.n>=5;
  var bpBadPct=thHasData&&orgTH.bpFilled?Math.round((orgTH.bpHighRisk||0)/orgTH.bpFilled*100):null;
  var gluBadPct=thHasData&&orgTH.gluFilled?Math.round((orgTH.gluHighRisk||0)/orgTH.gluFilled*100):null;
  var thEitherPct=thHasData&&orgTH.thAnyFilled?Math.round((orgTH.thHighEither||0)/orgTH.thAnyFilled*100):null;
  var mhiRecsHR=recs.filter(function(r){return typeof r.mhiScore==="number";});
  var mhiAvgHR=mhiRecsHR.length?Math.round(mhiRecsHR.reduce(function(a,r){return a+r.mhiScore;},0)/mhiRecsHR.length):null;
  // 雙重高風險人數為統計估算值(假設過勞與三高風險相互獨立)，非個人層級真實交叉比對人數——
  // th_{uid}與orgRecs均已去識別化，架構上無法確認「同一人」是否同時符合兩項條件(詳見PROJECT_INSTRUCTIONS§41)
  var dualRiskEst=(thEitherPct!==null&&n>0)?Math.round(n*(pct/100)*(thEitherPct/100)):null;
  var FREQ_TABLE=[
    {type:"一般員工(月加班45小時以下)",freq:"每年1次",law:"職安法施行細則"},
    {type:"高風險族群(月加班45-80小時)",freq:"每6個月1次",law:"職業促發腦心血管疾病預防指引"},
    {type:"極高風險(月加班80小時以上)",freq:"立即安排醫師面談",law:"勞基法第84條之2"},
    {type:"確診三高員工",freq:"每3個月追蹤一次",law:"888計畫"},
  ];
  async function genReport(){
    setLoading(true);setProg(0);
    var iv=setInterval(function(){setProg(function(p){return Math.min(p+3,92);});},400);
    var summary=["評估人數:"+n,"高風險(雙燈橙紅):"+highRisk+"人("+pct+"%)","睡眠異常:"+highSleep.length+"人("+sleepPct+"%)","疼痛異常:"+highPain.length+"人("+painPct+"%)"].join("；");
    try{
      var resp=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-6",max_tokens:1000,
          messages:[{role:"user",content:["你是職業衛生顧問，請依據勞動部「異常工作負荷促發疾病預防指引」，針對以下企業健康數據生成過勞高風險族群分析報告(繁體中文，約800字)。",
            "數據摘要："+summary,
            "請包含：①過勞高風險判斷依據(ISI+BPI交叉燈號)②建議立即行動項目③評估頻率建議④法規對應(職安法、GRI 403-9)⑤HR介入建議⑤免責聲明。",
            "全程去識別化，不含個人資料。"].join("\n")}]})});
      var data=await resp.json();
      clearInterval(iv);setProg(100);
      var txt=data.content&&data.content.filter(function(c){return c.type==="text";}).map(function(c){return c.text;}).join("");
      setReport(txt||"報告生成失敗，請稍後再試。");
    }catch(e){clearInterval(iv);setReport("網路錯誤，請稍後再試。");}
    setLoading(false);
  }
  function doDownloadReport(){
    if(!report){return;}
    var ts=new Date().toLocaleDateString("zh-TW").replace(/\//g,"-");
    var hdr=["過勞高風險族群分析報告","單位："+((session&&session.orgName)||"—"),"生成日期："+ts,"評估人數："+n+"人 · 雙重高風險："+highRisk+"人("+pct+"%)","",""].join("\n");
    var blob=new Blob([hdr+report],{type:"text/plain;charset=utf-8"});
    var url=URL.createObjectURL(blob);
    var a=document.createElement("a");a.href=url;a.download="過勞高風險分析報告_"+ts+".txt";a.click();
    URL.revokeObjectURL(url);
  }
  // v10.3.21新增：①個人面談記錄逐筆下載(去識別化)
  async function doDownloadPersonalInterviews(){
    var raw=await stor.g("ow_int_"+orgCode);
    var logs=[];
    if(raw){try{logs=JSON.parse(raw);}catch(e){logs=[];}}
    var ts2=new Date().toLocaleDateString("zh-TW").replace(/\//g,"-");
    var RLx={doctor:"臨場健康服務醫師",nurse:"護理師",hm:"健康管理師",hr:"HR專員"};
    var hdr2=["個人面談記錄逐筆報告(去識別化)","單位："+((session&&session.orgName)||"—"),"生成日期："+ts2,"總筆數："+logs.length+"筆(僅以員工代號記錄，不含真實姓名)","",""].join("\n");
    var body2=logs.length===0?"尚無面談記錄。":logs.map(function(log,idx){
      var flags2=[log.iFlag?"睡眠":null,log.bFlag?"疼痛":null,log.pFlag?"壓力":null].filter(Boolean).join("、")||"無";
      var lx6=LX[log.riskLv];
      return ["【"+(idx+1)+"】面談日期："+log.date,
        "員工代號："+log.empId,
        "面談人員："+(RLx[log.role]||log.role)+" "+log.interviewer,
        "風險等級："+(lx6?lx6.lbl:log.riskLv),
        "過勞量表分數："+(log.owScore||"—"),
        "平台交叉燈號異常："+flags2,
        "採行措施："+(log.action||"—"),
        "下次追蹤日期："+(log.followDate||"—"),
        "備註："+(log.note||"—"),""].join("\n");
    }).join("\n");
    var blob2=new Blob([hdr2+body2],{type:"text/plain;charset=utf-8"});
    var url2=URL.createObjectURL(blob2);
    var a2=document.createElement("a");a2.href=url2;a2.download="個人面談記錄_"+ts2+".txt";a2.click();
    URL.revokeObjectURL(url2);
  }
  // v10.3.21新增：②部門彙整下載(k≥5匿名保護，與其他部門統計門檻一致)
  function doDownloadDeptSummary(){
    var byDept={};
    recs.forEach(function(r){
      var d=r.dept&&r.dept.trim()?r.dept.trim():"未填部門";
      if(!byDept[d]){byDept[d]={n:0,high:0,sleep:0,pain:0};}
      byDept[d].n++;
      var sHi=r.sKey==="red"||r.sKey==="orange";
      var pHi=r.pKey==="red"||r.pKey==="orange";
      if(sHi){byDept[d].sleep++;}
      if(pHi){byDept[d].pain++;}
      if(sHi&&pHi){byDept[d].high++;}
    });
    var deptNames=Object.keys(byDept).sort();
    var ts3=new Date().toLocaleDateString("zh-TW").replace(/\//g,"-");
    var hdr3=["部門彙整過負荷統計報告","單位："+((session&&session.orgName)||"—"),"生成日期："+ts3,"匿名保護門檻：k≥5(未達門檻部門不顯示明細統計，與其他部門統計一致)","",""].join("\n");
    var body3=deptNames.length===0?"尚無部門統計資料(需先有評估記錄且含部門資訊)。":deptNames.map(function(d){
      var s=byDept[d];
      if(s.n<5){return "【"+d+"】筆數不足(k<5保護，目前"+s.n+"筆)，無法顯示統計，需累積至≥5筆才可解鎖。";}
      var hp2=Math.round(s.high/s.n*100);
      var sp2=Math.round(s.sleep/s.n*100);
      var pp2=Math.round(s.pain/s.n*100);
      return "【"+d+"】評估人數："+s.n+"人 · 睡眠異常："+s.sleep+"人("+sp2+"%) · 疼痛異常："+s.pain+"人("+pp2+"%) · 雙重高風險："+s.high+"人("+hp2+"%)";
    }).join("\n");
    var note3=["","※三高數值因架構限制(th_{uid}去識別化、無dept欄位)，無法納入部門層級統計，詳見PROJECT_INSTRUCTIONS第四十一節。"].join("\n");
    var blob3=new Blob([hdr3+body3+note3],{type:"text/plain;charset=utf-8"});
    var url3=URL.createObjectURL(blob3);
    var a3=document.createElement("a");a3.href=url3;a3.download="部門彙整報告_"+ts3+".txt";a3.click();
    URL.revokeObjectURL(url3);
  }
  return ce(Screen,{title:"⚡ 異常工作負荷評估彙整",onBack:onBack,maxW:680},
    ce(Card,{style:{background:T.navyBg,border:"1px solid #90aecf",marginBottom:14}},
      ce("div",{style:{display:"flex",gap:12,alignItems:"flex-start"}},
        ce("div",{style:{fontSize:28}},"\u{1F4CA}"),
        ce("div",null,
          ce("div",{style:{fontWeight:800,fontSize:14,color:T.navy,marginBottom:6}},"\u904e\u52de\u98a8\u96aa\u6578\u4f4d\u5316\u770b\u677f \u2014 \u5e73\u53f0\u5448\u73fe\u65b9\u5f0f"),
          ce("div",{style:{fontSize:12,color:T.text,lineHeight:1.8}},
            "\u2460 \u5a54\u5c64\u6578\u636e\uff1a\u904e\u52de\u81ea\u8a55\uff088\u984c\uff09\u7531\u54e1\u5de5\u5728\u300c\u904e\u52de\u98a8\u96aa\u81ea\u6211\u6aa2\u8996\u300d\u9801\u9762\u5b8c\u6210\uff0c\u7cfb\u7d71\u81ea\u52d5\u5716\u8868\u5316\u3002",ce("br"),
            "\u2461 \u4ea4\u53c9\u6307\u6a19\uff1aISI\u7761\u7720\u71c8\u865f\xd7BPI\u75bc\u75db\u71c8\u865f\uff0c\u53cc\u71c8\u6a59\u7d05\u6642\u5224\u5b9a\u9ad8\u98a8\u96aa\u3002",ce("br"),
            "\u2462 \u5373\u6642\u9810\u8b66\uff1a\u9ad8\u98a8\u96aa\u6bd4\u4f8b\u8d85\u8d8a\u95be\u503c\uff08\u9644\u8a2a\u9838\u706f\u865f\uff09\u7acb\u5373\u986f\u793a\u8b66\u793a\u3002",ce("br"),
            "\u2463 AI\u5831\u544a\uff1a\u4e00\u9375\u751f\u6210\u7b26\u5408\u52de\u52d5\u90e8\u6307\u5f15\u7684\u904e\u52de\u6de8\u5316\u5206\u6790\u5831\u544a\u3002",ce("br"),
            "\u2464 \u6cd5\u898f\u9023\u7d50\uff1a\u8207\u300a\u8077\u696d\u5b89\u5168\u885b\u751f\u6cd5\u300b\u7b2c6\u689d\u53ca\u52de\u52d5\u90e8\u6307\u5f15\u76f4\u63a5\u5c0d\u61c9\uff0c\u53ef\u76f4\u63a5\u5f15\u7528\u81f3ESG/GRI\u5831\u544a\u3002")))),
    // 三高與心血管風險組織指標(v10.3.19新增)
    ce(Card,{style:{marginBottom:14,borderLeft:"4px solid "+(thWarning?T.red:T.amber)}},
      ce(SecTitle,null,"🩸 三高及心血管疾病風險指標(組織層級)"),
      ce(IBox,{c:thWarning?"red":"amber",style:{marginBottom:10,fontSize:11}},
        "三高(高血壓/高血糖/高血脂)為過勞促發腦心血管疾病的主要共病危險因子，依888計畫三高確診員工需每3個月追蹤一次。以下為組織層級去識別化統計(k≥5保護)。"),
      orgTH&&!orgTH.suppressed&&orgTH.n>=5?
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}},
          [{l:"三高填報覆蓋率",v:orgTH.coverageRate+"%",note:"填報"+orgTH.n+"/"+orgTH.totalMembers+"人",c:orgTH.coverageRate>=80?T.sage:T.amber},
           {l:"血壓達控制標準",v:orgTH.bpFilled?Math.round(orgTH.bpControlled/orgTH.bpFilled*100)+"%":"—",note:"<130/80 mmHg達標率",c:T.teal},
           {l:"血糖達控制標準",v:orgTH.gluFilled?Math.round(orgTH.gluControlled/orgTH.gluFilled*100)+"%":"—",note:"空腹<100 mg/dL達標率",c:T.sage}
          ].map(function(item){
            return ce(Card,{key:item.l,style:{textAlign:"center",padding:"10px 8px"}},
              ce("div",{style:{fontSize:10,color:T.muted,marginBottom:4}},item.l),
              ce("div",{style:{fontSize:20,fontWeight:800,color:item.c}},item.v),
              ce("div",{style:{fontSize:9,color:T.faint}},item.note));
          })):
        ce(IBox,{c:"amber",style:{fontSize:11}},thRiskNote),
      ce("div",{style:{fontSize:11,color:T.muted,marginTop:6}},thRiskNote)),
    // 高風險追蹤名單(v10.3.19新增)
    ce(Card,{style:{marginBottom:14,borderLeft:"4px solid "+T.coral}},
      ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}},
        ce(SecTitle,{style:{marginBottom:0}},"📋 高風險族群追蹤名單"),
        ce(Btn,{sz:"sm",v:"coral",onClick:function(){setShowTrackForm(!showTrackForm);}},
          showTrackForm?"▲ 收合":"＋ 新增追蹤")),
      ce(IBox,{c:"coral",style:{marginBottom:10,fontSize:11}},"橙/紅燈高風險員工追蹤管理。採去識別化員工代號(HR自行管理對應關係，勿填入真實姓名)。依法保存3年。"),
      showTrackForm&&ce("div",{style:{padding:"12px",background:T.coralBg,borderRadius:8,marginBottom:10,display:"grid",gap:8}},
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}},
          ce("div",null,
            ce("label",{style:{fontSize:11,color:T.muted,display:"block",marginBottom:3}},"員工代號(去識別化)*"),
            ce("input",{value:newTrack.empId,onChange:function(e){setNewTrack(function(p){return Object.assign({},p,{empId:e.target.value});});},
              placeholder:"如：HR-2026-001",style:{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:12,boxSizing:"border-box"}})),
          ce("div",null,
            ce("label",{style:{fontSize:11,color:T.muted,display:"block",marginBottom:3}},"部門"),
            ce("input",{value:newTrack.dept,onChange:function(e){setNewTrack(function(p){return Object.assign({},p,{dept:e.target.value});});},
              placeholder:"如：業務部",style:{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:12,boxSizing:"border-box"}}))),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}},
          ce("div",null,
            ce("label",{style:{fontSize:11,color:T.muted,display:"block",marginBottom:3}},"風險等級"),
            ce("select",{value:newTrack.riskLv,onChange:function(e){setNewTrack(function(p){return Object.assign({},p,{riskLv:e.target.value});});},
              style:{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:12}},
              ce("option",{value:"orange"},"橙燈 — 高風險"),
              ce("option",{value:"red"},"紅燈 — 極高風險"))),
          ce("div",null,
            ce("label",{style:{fontSize:11,color:T.muted,display:"block",marginBottom:3}},"追蹤日期"),
            ce("input",{type:"date",value:newTrack.followDate,onChange:function(e){setNewTrack(function(p){return Object.assign({},p,{followDate:e.target.value});});},
              style:{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:12,boxSizing:"border-box"}}))),
        ce("div",null,
          ce("label",{style:{fontSize:11,color:T.muted,display:"block",marginBottom:3}},"備註(危害因子/建議措施)"),
          ce("textarea",{value:newTrack.note,onChange:function(e){setNewTrack(function(p){return Object.assign({},p,{note:e.target.value});});},
            rows:2,placeholder:"如：月加班>60小時+ISI橙燈，建議安排職醫面談",
            style:{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:11,boxSizing:"border-box",resize:"vertical"}})),
        ce(Btn,{v:"coral",full:true,onClick:doAddTrack,disabled:!newTrack.empId},"＋ 加入追蹤名單")),
      trackList.length===0?
        ce("div",{style:{textAlign:"center",padding:"16px",color:T.muted,fontSize:12}},"尚無追蹤記錄"):
        ce("div",{style:{display:"grid",gap:6}},
          trackList.slice(0,20).map(function(t){
            var lx4=LX[t.riskLv]||LX.orange;
            var daysLeft=t.followDate?Math.ceil((new Date(t.followDate)-new Date())/(1000*60*60*24)):null;
            var isOverdue=daysLeft!==null&&daysLeft<0;
            var isSoon=daysLeft!==null&&daysLeft>=0&&daysLeft<=14;
            return ce("div",{key:t.id,style:{padding:"10px 12px",borderRadius:8,border:"1px solid "+(isOverdue?T.red:isSoon?T.amber:T.border),background:isOverdue?T.redBg:T.card}},
              ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}},
                ce("div",null,
                  ce("div",{style:{fontSize:12,fontWeight:700,color:T.text}},t.empId+(t.dept?" · "+t.dept:"")),
                  ce("div",{style:{fontSize:10,color:T.muted}},
                    t.followDate?"追蹤日："+t.followDate+(isOverdue?" ⚠逾期"+Math.abs(daysLeft)+"天":isSoon?" ⏰"+daysLeft+"天後":""):"")),
                ce("div",{style:{display:"flex",gap:4,alignItems:"center"}},
                  ce("span",{style:{padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,background:lx4.bg,color:lx4.c}},lx4.lbl),
                  ce("span",{style:{padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,background:t.status==="已完成"?T.sageBg:T.amberBg,color:t.status==="已完成"?T.sage:T.amber}},t.status))),
              t.note&&ce("div",{style:{fontSize:10,color:T.muted,marginTop:4}},t.note),
              ce("div",{style:{display:"flex",gap:6,marginTop:6}},
                ["待追蹤","進行中","已完成"].map(function(s){
                  return ce("button",{key:s,onClick:function(){doUpdateTrackStatus(t.id,s);},
                    style:{padding:"3px 8px",borderRadius:6,border:"1px solid "+(t.status===s?T.teal:T.border),
                      fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:t.status===s?700:400,
                      background:t.status===s?T.tealBg:"transparent",color:t.status===s?T.teal:T.muted}},s);
                })));
          }))),
    ce(IBox,{c:"amber",style:{marginBottom:14}},"依《職業安全衛生法》第6條及勞動部「異常工作負荷促發疾病預防指引」，本頁面彙整員工睡眠×疼痛交叉燈號，作為過勞高風險代理指標，供HR主動介入參考。"),
    ce(Card,{style:{marginBottom:14,borderTop:"3px solid "+T.teal}},
      ce(SecTitle,null,"📅 年度評估排程設定(HR專用)"),
      ce(IBox,{c:"teal",style:{marginBottom:12}},"設定後，員工在「過勞風險自評」頁面將於距評估日30天內自動顯示提醒。提醒將顯示評估活動名稱、日期及倒數天數。"),
      ce("div",{style:{marginBottom:10}},
        ce("div",{style:{fontSize:12,color:T.muted,marginBottom:4}},"評估活動名稱(顯示於員工提醒)"),
        ce("input",{type:"text",value:schedule.label,onChange:function(e){setSF("label",e.target.value);},placeholder:"如：年度過負荷評估、上半年健康評估...",style:{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box"}})),
      ce("div",{style:{marginBottom:10}},
        ce("div",{style:{fontSize:12,color:T.muted,marginBottom:6}},"一般員工評估日期(最多4個，每年)"),
        ce("div",{style:{display:"grid",gap:8}},
          [0,1,2,3].map(function(i){
            return ce("div",{key:i,style:{display:"flex",gap:8,alignItems:"center"}},
              ce("span",{style:{fontSize:12,color:T.muted,minWidth:32}},"第"+(i+1)+"次"),
              ce("input",{type:"date",value:(schedule.dates&&schedule.dates[i])||"",
                onChange:function(e){setSF("dates",setDateAt(schedule.dates||["","","",""],i,e.target.value));},
                style:{flex:1,padding:"8px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:13}}));
          }))),
      ce("div",{style:{marginBottom:10}},
        ce("div",{style:{fontSize:12,color:T.muted,marginBottom:6}},"高風險族群追蹤日期(橙/紅燈員工，最多2個)"),
        ce("div",{style:{display:"grid",gap:8}},
          [0,1].map(function(i){
            return ce("div",{key:i,style:{display:"flex",gap:8,alignItems:"center"}},
              ce("span",{style:{fontSize:12,color:T.muted,minWidth:32}},"追蹤"+(i+1)),
              ce("input",{type:"date",value:(schedule.highRiskDates&&schedule.highRiskDates[i])||"",
                onChange:function(e){setSF("highRiskDates",setDateAt(schedule.highRiskDates||["",""],i,e.target.value));},
                style:{flex:1,padding:"8px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:13}}));
          }))),
      ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}},
        ce("div",null,
          ce("div",{style:{fontSize:12,color:T.muted,marginBottom:4}},"提前幾天開始提醒"),
          ce("div",{style:{display:"flex",gap:8}},
            [7,14,30,60].map(function(d){
              var sel=schedule.notifyDays===d;
              return ce("button",{key:d,onClick:function(){setSF("notifyDays",d);},
                style:{flex:1,padding:"7px 0",borderRadius:8,border:"1px solid "+(sel?T.teal:T.border),
                  background:sel?T.tealBg:T.card,color:sel?T.teal:T.muted,fontSize:12,
                  cursor:"pointer",fontFamily:"inherit",fontWeight:sel?700:400}},d+"天");
            }))),
        ce("div",null,
          ce("div",{style:{fontSize:12,color:T.muted,marginBottom:4}},"備註(不顯示給員工)"),
          ce("input",{type:"text",value:schedule.note||"",onChange:function(e){setSF("note",e.target.value);},
            placeholder:"如：配合年度健檢時程",
            style:{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:12,boxSizing:"border-box"}}))),
      ce("div",{style:{display:"flex",gap:10,alignItems:"center"}},
        ce(Btn,{onClick:doSaveSchedule,v:"teal",full:true},"儲存排程設定"),
        schedSaved&&ce("span",{style:{fontSize:12,color:T.sage,fontWeight:700}},"✅ 已儲存！員工將於設定日期前"+schedule.notifyDays+"天收到提醒")),
      ce(IBox,{c:"navy",style:{marginTop:10}},"提醒機制說明：員工進入「過勞風險自評」頁面時，系統自動讀取本排程，若距任一評估日期在30天以內，首頁將顯示倒數提醒banner(含評估名稱、剩餘天數、立即評估按鈕)。高風險族群追蹤日期亦同步觸發。")),
    n===0?ce(Card,{style:{textAlign:"center",padding:36,color:T.muted}},"尚無員工評估資料"):ce("div",{style:{display:"grid",gap:14}},
      ce(Card,null,
        ce(SecTitle,null,"整體過勞風險概覽"),
        ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}},
          [{label:"評估人數",val:n+"人",c:T.teal},{label:"睡眠異常(橙+紅)",val:highSleep.length+"人 ("+sleepPct+"%)",c:LX.orange.c},{label:"疼痛異常(橙+紅)",val:highPain.length+"人 ("+painPct+"%)",c:LX.orange.c},{label:"雙重高風險",val:highRisk+"人 ("+pct+"%)",c:riskLx.c},{label:"建議立即面談",val:highRisk+"人",c:T.coral},{label:"達標目標",val:"雙高<8%",c:T.sage}].map(function(m){
            return ce(Card,{key:m.label,style:{textAlign:"center",padding:"10px 8px",background:T.bg}},
              ce("div",{style:{fontSize:11,color:T.muted,marginBottom:4}},m.label),
              ce("div",{style:{fontSize:16,fontWeight:800,color:m.c}},m.val));
          })),
        ce("div",{style:{background:riskLx.bg,border:"1px solid "+riskLx.br,borderRadius:10,padding:"12px 16px"}},
          ce("div",{style:{display:"flex",alignItems:"center",gap:10}},
            ce(LBadge,{k:riskLv}),
            ce("div",null,
              ce("div",{style:{fontWeight:700,fontSize:13,color:riskLx.c}},"整體過勞風險等級："+riskLx.lbl),
              ce("div",{style:{fontSize:12,color:T.muted,marginTop:2}},pct>=30?"建議立即進行全面過負荷評估並安排醫師面談":pct>=15?"建議針對雙高族群優先安排面談":pct>=8?"持續監控，建議半年評估一次":"整體風險可接受，維持年度評估"))))),
      ce(Card,null,
        ce(SecTitle,null,"🩺 健康危險因子指標(三高+MHI)"),
        ce(IBox,{c:"amber",style:{marginBottom:10,fontSize:11}},"血壓/血糖未達標率來自三高組織彙整(k≥5保護，異常門檻：血壓>140/90 mmHg、空腹血糖>100 mg/dL)。MHI平均分數僅統計有填寫mhiScore之記錄。雙重高風險為統計估算值，非個人層級真實交叉比對(架構限制，詳見PROJECT_INSTRUCTIONS§41)。"),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}},
          [
            {label:"血壓未達標率",val:bpBadPct!==null?bpBadPct+"%":"—",note:bpBadPct!==null?">140/90 mmHg("+orgTH.bpHighRisk+"/"+orgTH.bpFilled+"人)":"三高資料不足或未填報血壓",c:bpBadPct!==null&&bpBadPct>=30?T.red:T.amber},
            {label:"血糖未達標率",val:gluBadPct!==null?gluBadPct+"%":"—",note:gluBadPct!==null?">100 mg/dL("+orgTH.gluHighRisk+"/"+orgTH.gluFilled+"人)":"三高資料不足或未填報血糖",c:gluBadPct!==null&&gluBadPct>=30?T.red:T.amber},
            {label:"MHI平均分數",val:mhiAvgHR!==null?mhiAvgHR+"分":"—",note:mhiAvgHR!==null?mhiRecsHR.length+"筆記錄平均(滿分100)":"尚無MHI評估記錄",c:mhiAvgHR!==null&&mhiAvgHR<50?T.red:T.sage},
            {label:"三高+過勞雙重高風險(估算)",val:dualRiskEst!==null?dualRiskEst+"人":"—",note:dualRiskEst!==null?"假設兩項風險相互獨立之統計估算，非真實個人清單":"三高資料不足，無法估算",c:T.coral}
          ].map(function(m){
            return ce(Card,{key:m.label,style:{textAlign:"center",padding:"10px 8px",background:T.bg}},
              ce("div",{style:{fontSize:11,color:T.muted,marginBottom:4}},m.label),
              ce("div",{style:{fontSize:18,fontWeight:800,color:m.c}},m.val),
              ce("div",{style:{fontSize:9,color:T.faint,marginTop:2}},m.note));
          }))),
      ce(Card,null,
        ce(SecTitle,null,"評估頻率建議(法規依據)"),
        ce("div",{style:{display:"grid",gap:8}},
          FREQ_TABLE.map(function(f){
            return ce("div",{key:f.type,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",background:T.bg,borderRadius:8}},
              ce("div",null,
                ce("div",{style:{fontWeight:600,fontSize:13,color:T.text}},f.type),
                ce("div",{style:{fontSize:11,color:T.muted}},f.law)),
              ce(Tag,{c:"amber"},f.freq));
          }))),
      ce(Card,null,
        ce(SecTitle,null,"HR介入行動清單"),
        ce("div",{style:{display:"grid",gap:8}},
          [{step:"1",title:"立即通知高風險員工",desc:"以雙燈橙紅為篩選條件，由HR主動關懷並邀請自主填報「過負荷評估問卷」",c:T.red},{step:"2",title:"安排臨場健康服務醫師面談",desc:"依勞動部指引，極高風險員工應優先安排面談，記錄並簽署面談結果表",c:T.coral},{step:"3",title:"填報「異常工作負荷執行紀錄表」",desc:"相關文件及記錄依規定至少保存3年(對應圖示流程末端)",c:T.amber},{step:"4",title:"回饋作為改善指標",desc:"定期檢討執行成效，更新「異常工作負荷促發疾病預防計畫」",c:T.sage}].map(function(item){
            return ce(Card,{key:item.step,style:{borderLeft:"4px solid "+item.c,padding:"10px 14px"}},
              ce("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:4}},
                ce("div",{style:{width:22,height:22,borderRadius:"50%",background:item.c,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,flexShrink:0}},item.step),
                ce("div",{style:{fontWeight:700,fontSize:13,color:item.c}},item.title)),
              ce("p",{style:{fontSize:12,color:T.muted,margin:0,lineHeight:1.7,paddingLeft:30}},item.desc));
          }))),
      ce(Card,null,
        ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}},
          ce("div",{style:{flex:1}},ce(SecTitle,null,"AI分析：過勞高風險族群報告")),
          report&&ce(Btn,{sz:"sm",v:"sage",onClick:doDownloadReport},"⬇ 下載txt")),
        ce(IBox,{c:"amber",style:{marginBottom:10}},"以下報告為AI依據健康數據摘要自動生成，全程去識別化，僅供管理參考，不構成醫療診斷或法律依據。"),
        !report&&!loading&&ce(Btn,{onClick:genReport,full:true,v:"amber"},"⚡ 生成AI過勞風險分析報告"),
        loading&&ce("div",null,
          ce("div",{style:{textAlign:"center",padding:"12px 0",color:T.amber,fontWeight:700}},"⚙ AI分析中..."),
          ce("div",{style:{height:6,background:"#e7e5e4",borderRadius:3}},
            ce("div",{style:{width:prog+"%",height:"100%",background:T.amber,borderRadius:3,transition:"width .3s"}}))),
        report&&ce("div",{style:{whiteSpace:"pre-wrap",lineHeight:1.9,fontSize:13,color:T.text,marginTop:10}},report)),
      ce(Card,null,
        ce(SecTitle,null,"勞動部官方三大評估工具(ESG可直接引用)"),
        ce(IBox,{c:"navy",style:{marginBottom:10}},"以下三大工具為勞動部「異常工作負荷促發疾病預防指引」官方標準版本，各行業通用，可直接引用於ESG/GRI報告書。"),
        ce("div",{style:{display:"grid",gap:10}},
          [{num:"①",title:"過勞量表(自覺疲勞量表)",sub:"個人過勞量表+工作過勞量表，共17題",desc:"由日本產業衛生學會改編，評估主觀疲勞、長工時、人際衝突等。分數0-100，85分以上為高度過勞風險，建議醫師面談。可直接用於GRI 403-9在職失能與缺勤量化。",esg:"GRI 403-9 在職失能及缺勤",freq:"每年1次；高風險族群每6個月",c:T.amber},{num:"②",title:"過負荷評估問卷",sub:"工作量要求×自主決定權×職場支持，共30題",desc:"對應「工作需求-控制-支持模式(JD-C-S)」，識別職業性心理健康風險，分數越高過負荷越嚴重。為面談前必填問卷，醫師依此提供生活/保健/就醫指導。",esg:"GRI 403-6 促進員工健康",freq:"每年1次；面談前必填",c:T.coral},{num:"③",title:"工作型態評估表",sub:"輪班制×不規則作息×異常環境因子",desc:"評估輪班/夜班/長途出差/極端環境等工作型態，配合Framingham Cardiac Risk Score進行綜合心血管風險分級，提供生活/保健/就醫指導。記錄保存至少3年。",esg:"GRI 403-9 職業安全健康管理",freq:"每年健檢一併評估；異動輪班制度時重評",c:T.navy}].map(function(tool){
            return ce(Card,{key:tool.num,style:{borderLeft:"4px solid "+tool.c,padding:"12px 14px"}},
              ce("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:6}},
                ce("div",{style:{width:28,height:28,borderRadius:"50%",background:tool.c,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,flexShrink:0}},tool.num),
                ce("div",null,
                  ce("div",{style:{fontWeight:700,fontSize:13,color:tool.c}},tool.title),
                  ce("div",{style:{fontSize:11,color:T.muted}},tool.sub))),
              ce("p",{style:{fontSize:12,color:T.muted,lineHeight:1.8,margin:"0 0 8px"}},tool.desc),
              ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}},
                ce("div",{style:{background:T.bg,borderRadius:6,padding:"6px 8px"}},
                  ce("div",{style:{fontSize:10,color:T.faint,marginBottom:2}},"ESG對應"),
                  ce("div",{style:{fontSize:11,color:T.text,fontWeight:600}},tool.esg)),
                ce("div",{style:{background:T.amberBg,borderRadius:6,padding:"6px 8px"}},
                  ce("div",{style:{fontSize:10,color:T.faint,marginBottom:2}},"評估頻率"),
                  ce("div",{style:{fontSize:11,color:T.amber,fontWeight:600}},tool.freq))));
          }))),
      ce(Card,null,
        ce(SecTitle,null,"📥 分層報告下載"),
        ce(IBox,{c:"navy",style:{marginBottom:10}},"依需求選擇下載範圍：①個人面談記錄逐筆(去識別化)、②部門彙整統計(k≥5匿名保護，與其他部門統計門檻一致)、③單位整體AI分析報告。"),
        ce("div",{style:{display:"grid",gap:8}},
          ce(Btn,{v:"teal",full:true,onClick:doDownloadPersonalInterviews},"① 下載個人面談記錄(逐筆,txt)"),
          ce(Btn,{v:"amber",full:true,onClick:doDownloadDeptSummary},"② 下載部門彙整報告(txt)"),
          ce(Btn,{v:"sage",full:true,disabled:!report,onClick:doDownloadReport},report?"③ 下載單位整體AI報告(txt)":"③ 單位整體AI報告(請先於下方生成後再下載)"))),
      ce(Card,null,
        ce(SecTitle,null,"醫師/健康管理師面談填報記錄"),
        ce(IBox,{c:"teal",style:{marginBottom:10}},"依勞動部指引，面談結果應填寫「面談結果及採行措施表」，由醫師/健管師簽署，公司留存至少3年。本模組為數位化去識別化記錄。"),
        ce(OWInterviewLog,{session:session,orgCode:(session&&session.orgCode)||""})),
      ce(Card,null,
        ce(SecTitle,null,"交叉評估：過勞高風險進階判斷矩陣"),
        ce(IBox,{c:"plum",style:{marginBottom:10}},"整合 ISI(睡眠)× BPI(疼痛)× PSS(壓力)× 過勞量表，提供進階風險分級依據，可作為健康自主管理提報、ESG報告與防護措施依據。"),
        ce("div",{style:{overflowX:"auto",marginBottom:10}},
          ce("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:11}},
            ce("thead",null,
              ce("tr",{style:{background:T.plumBg}},
                ["情境","ISI睡眠","BPI疼痛","PSS壓力","風險等級","建議行動"].map(function(h){
                  return ce("th",{key:h,style:{padding:"8px 10px",textAlign:"left",fontWeight:700,color:T.plum,borderBottom:"2px solid #d8b4fe",whiteSpace:"nowrap"}},h);
                }))),
            ce("tbody",null,
              [{combo:"全部正常",isi:"0-7",bpi:"0-12",pss:"0-5",lv:"green",act:"年度評估維持現況"},{combo:"睡眠輕度異常",isi:"8-14",bpi:"0-12",pss:"0-10",lv:"yellow",act:"自我管理，每季追蹤"},{combo:"任一面向中度",isi:"15-21",bpi:"13-25",pss:"11-16",lv:"orange",act:"主動關懷+填報過負荷問卷"},{combo:"任一紅燈/雙橙",isi:"22+",bpi:"26+",pss:"11+",lv:"red",act:"立即安排醫師面談，啟動計畫"}].map(function(row,ri){
                var lx3=LX[row.lv]||LX.green;
                return ce("tr",{key:row.combo,style:{background:ri%2===0?T.card:T.bg}},
                  ce("td",{style:{padding:"8px 10px",fontWeight:600}},row.combo),
                  ce("td",{style:{padding:"8px 10px",color:T.muted}},row.isi),
                  ce("td",{style:{padding:"8px 10px",color:T.muted}},row.bpi),
                  ce("td",{style:{padding:"8px 10px",color:T.muted}},row.pss),
                  ce("td",{style:{padding:"8px 10px"}},ce("span",{style:{background:lx3.bg,color:lx3.c,border:"1px solid "+lx3.br,borderRadius:6,padding:"2px 8px",fontWeight:700}},lx3.lbl)),
                  ce("td",{style:{padding:"8px 10px",color:T.text}},row.act));
              })))),
        ce(IBox,{c:"amber"},"交叉評估結果可作為：①過負荷預防計畫執行依據 ②ESG/GRI 403-9揭露數據 ③健康自主管理提報附件 ④職業醫學科面談轉介依據 ⑤職安法第6條雇主盡責證明")),
      ce(IBox,{c:"teal"},"上市櫃公司依金管會2025年起永續報告書強制規範，須揭露GRI 403-9在職失能及缺勤相關數據，本頁三大工具說明與交叉矩陣可直接引用。")));
}

// ── 面談填報記錄子元件 ───────────────────────────────────────────────────────
function OWInterviewLog({session,orgCode,roster}){
  var rosterList=roster||[];
  var code=orgCode||"demo";
  var[logs,setLogs]=React.useState([]);
  var[mode,setMode]=React.useState("list");
  var initForm={date:"",interviewer:"",role:"doctor",empId:"",riskLv:"orange",owScore:"",iFlag:false,bFlag:false,pFlag:false,action:"",followDate:"",note:""};
  var[form,setForm]=React.useState(initForm);
  React.useEffect(function(){
    stor.g("ow_int_"+code).then(function(d){if(d)setLogs(JSON.parse(d));});
  },[]);
  function setF(k,v){setForm(function(f){var u={};u[k]=v;return Object.assign({},f,u);});}
  function doSave(){
    var rec=Object.assign({},form,{id:"owi"+Date.now(),ts:new Date().toISOString()});
    var nl=[rec,...logs].slice(0,50);
    stor.s("ow_int_"+code,JSON.stringify(nl));
    setLogs(nl);setMode("list");setForm(initForm);
  }
  var RL={doctor:"臨場健康服務醫師",nurse:"護理師",hm:"健康管理師",hr:"HR專員"};
  if(mode==="add"){
    return ce("div",{style:{display:"grid",gap:10}},
      ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}},
        ce("div",null,
          ce("div",{style:{fontSize:12,color:T.muted,marginBottom:4}},"面談日期"),
          ce("input",{type:"date",value:form.date,onChange:function(e){setF("date",e.target.value);},style:{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box"}})),
        ce("div",null,
          ce("div",{style:{fontSize:12,color:T.muted,marginBottom:4}},"面談人員"),
          ce("input",{type:"text",value:form.interviewer,placeholder:"姓名",onChange:function(e){setF("interviewer",e.target.value);},style:{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box"}}))),
      ce("div",null,
        ce("div",{style:{fontSize:12,color:T.muted,marginBottom:4}},"面談者身份"),
        ce("div",{style:{display:"flex",gap:8,flexWrap:"wrap"}},
          Object.keys(RL).map(function(k){
            var sel=form.role===k;
            return ce("button",{key:k,onClick:function(){setF("role",k);},style:{padding:"6px 12px",borderRadius:8,border:"1px solid "+(sel?T.teal:T.border),background:sel?T.tealBg:T.card,color:sel?T.teal:T.text,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:sel?700:400}},RL[k]);
          }))),
      ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}},
        ce("div",null,
          ce("div",{style:{fontSize:12,color:T.muted,marginBottom:4}},"員工代碼(去識別化)"),
          rosterList.length>0?
            ce("select",{value:form.empId,onChange:function(e){setF("empId",e.target.value);},style:{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box"}},
              [ce("option",{key:"_ph",value:""},"請選擇員工代號")].concat(rosterList.map(function(r){return ce("option",{key:r.empId,value:r.empId},r.empId+(r.dept?"("+r.dept+")":""));}))):
            ce("input",{type:"text",value:form.empId,placeholder:"如：EMP-0042",onChange:function(e){setF("empId",e.target.value);},style:{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box"}})),
        ce("div",null,
          ce("div",{style:{fontSize:12,color:T.muted,marginBottom:4}},"過勞量表分數(0-100)"),
          ce("input",{type:"number",value:form.owScore,placeholder:"0-100",min:0,max:100,onChange:function(e){setF("owScore",e.target.value);},style:{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box"}}))),
      ce("div",null,
        ce("div",{style:{fontSize:12,color:T.muted,marginBottom:6}},"平台交叉燈號異常(可複選)"),
        ce("div",{style:{display:"flex",gap:8,flexWrap:"wrap"}},
          [{k:"iFlag",l:"🌙 ISI睡眠"},{k:"bFlag",l:"🩺 BPI疼痛"},{k:"pFlag",l:"🧠 PSS壓力"}].map(function(fi){
            var sel=form[fi.k];
            return ce("button",{key:fi.k,onClick:function(){setF(fi.k,!sel);},style:{padding:"6px 10px",borderRadius:8,border:"1px solid "+(sel?T.coral:T.border),background:sel?T.coralBg:T.card,color:sel?T.coral:T.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:sel?700:400}},fi.l);
          }))),
      ce("div",null,
        ce("div",{style:{fontSize:12,color:T.muted,marginBottom:4}},"風險等級判定"),
        ce("div",{style:{display:"flex",gap:8}},
          ["green","yellow","orange","red"].map(function(lv){
            var lx4=LX[lv];var sel=form.riskLv===lv;
            return ce("button",{key:lv,onClick:function(){setF("riskLv",lv);},style:{padding:"6px 12px",borderRadius:8,border:"1px solid "+(sel?lx4.br:T.border),background:sel?lx4.bg:T.card,color:sel?lx4.c:T.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:sel?700:400}},lx4.lbl);
          }))),
      ce("div",null,
        ce("div",{style:{fontSize:12,color:T.muted,marginBottom:4}},"採行措施/建議事項"),
        ce("textarea",{value:form.action,onChange:function(e){setF("action",e.target.value);},placeholder:"如：調整工作量、排休假、轉介復健科、每月追蹤...",rows:3,style:{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:12,lineHeight:1.7,resize:"vertical",boxSizing:"border-box",fontFamily:"inherit"}})),
      ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}},
        ce("div",null,
          ce("div",{style:{fontSize:12,color:T.muted,marginBottom:4}},"下次追蹤日期"),
          ce("input",{type:"date",value:form.followDate,onChange:function(e){setF("followDate",e.target.value);},style:{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box"}})),
        ce("div",null,
          ce("div",{style:{fontSize:12,color:T.muted,marginBottom:4}},"備註"),
          ce("input",{type:"text",value:form.note,placeholder:"其他說明",onChange:function(e){setF("note",e.target.value);},style:{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box"}}))),
      ce("div",{style:{display:"flex",gap:10}},
        ce(Btn,{onClick:doSave,disabled:!form.date||!form.interviewer||!form.empId,v:"teal",full:true},"儲存面談記錄"),
        ce(Btn,{onClick:function(){setMode("list");},v:"ghost",full:true},"取消")));
  }
  return ce("div",null,
    ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}},
      ce("div",{style:{fontSize:12,color:T.muted}},"已記錄："+logs.length+" 筆(依規定保存至少3年)"),
      ce(Btn,{onClick:function(){setMode("add");},sz:"sm",v:"teal"},"+ 新增面談記錄")),
    logs.length===0?ce(IBox,{c:"teal"},"尚無面談記錄 · 點選右上角新增"):
    ce("div",{style:{display:"grid",gap:8}},
      logs.slice(0,8).map(function(log){
        var lx5=LX[log.riskLv]||LX.green;
        var flags=[log.iFlag?"睡眠":null,log.bFlag?"疼痛":null,log.pFlag?"壓力":null].filter(Boolean);
        return ce("div",{key:log.id,style:{padding:"10px 12px",background:lx5.bg,border:"1px solid "+lx5.br,borderRadius:8}},
          ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}},
            ce("div",{style:{fontSize:12,fontWeight:700,color:lx5.c}},log.date+" · "+log.empId),
            ce(LBadge,{k:log.riskLv})),
          ce("div",{style:{fontSize:11,color:T.muted}},RL[log.role]+" · "+log.interviewer+(log.owScore?" · 過勞分數:"+log.owScore:"")),
          flags.length>0&&ce("div",{style:{fontSize:11,color:T.coral,marginTop:2}},"異常燈號："+flags.join("、")),
          log.action&&ce("div",{style:{fontSize:11,color:T.text,marginTop:4}},"措施："+log.action),
          log.followDate&&ce("div",{style:{fontSize:11,color:T.teal,marginTop:2}},"下次追蹤："+log.followDate));
      })));
}

// ── OHInterviewScreen — 臨場醫護人員獨立填報入口(v10.3.21新增) ───────────────
// 僅包裝OWInterviewLog，不含任何KPI/ESG/財務/個人逐筆評估內容，供occupational_health角色使用
function OHInterviewScreen({session,onBack}){
  var orgCode=(session&&session.orgCode)||"demo";
  var[rosterVisible,setRosterVisible]=React.useState(false);
  var[roster,setRoster]=React.useState([]);
  React.useEffect(function(){
    DB.getOrgSetup(orgCode).then(function(s){setRosterVisible(!!(s&&s.ohRosterVisible));});
    stor.g("ow_roster_"+orgCode).then(function(d){if(d){try{setRoster(JSON.parse(d));}catch(e){setRoster([]);}}});
  },[]);
  return ce(Screen,{title:"🩺 過負荷面談記錄填報",onBack:onBack,maxW:680},
    ce(IBox,{c:"teal",style:{marginBottom:14}},"您以臨場醫護人員身份登入，僅能填寫/查看過負荷面談記錄，全程去識別化(以員工代號記錄，非真實姓名)。本頁不會顯示KPI、ESG、財務等管理報告，亦不會顯示員工個人ISI/BPI逐筆評估內容。"),
    ce(Card,null,
      ce(SecTitle,null,"醫師/健康管理師面談填報記錄"),
      ce(IBox,{c:"navy",style:{marginBottom:10}},"依勞動部指引，面談結果應填寫「面談結果及採行措施表」，由醫師/健管師簽署，公司留存至少3年。"+(rosterVisible?"下方員工代號可由清單選取(單位平台管理者已開通)。":"請填入單位平台管理者/HR提供的去識別化員工代號。")),
      ce(OWInterviewLog,{session:session,orgCode:orgCode,roster:rosterVisible?roster:[]})));
}


// ── OHSPlanScreen — 異常工作負荷促發疾病預防計畫 ────────────────────────────
// 危害辨識→風險評估→預防措施→定期檢討→報告生成
var OHS_HAZARDS=[
  "長時間工作/超時加班","夜班/輪班制作業","不規則作息/頻繁出差","重體力勞動/搬運",
  "高度精神緊張/情緒勞動","人際衝突/職場暴力","高溫/低溫環境","噪音暴露",
  "化學品接觸","肌肉骨骼負荷(久坐/久站/重複動作)","高風險駕駛","其他(自填)"
];
var OHS_MEASURES=[
  "調整班表/減少超時","提供彈性工時","安排定期健康檢查","安排職業醫師面談",
  "導入EAP輔導方案","職場壓力管理教育訓練","改善工作環境(溫度/噪音/照明)",
  "人機工學改善(座椅/桌高/工具)","設置危害通報機制","定期安全衛生委員會",
  "高風險員工個案追蹤","其他(自填)"
];
function OHSPlanScreen({session,onBack,orgRecs,orgTH}){
  var orgCode=(session&&session.orgCode)||"demo";
  var recs=orgRecs||[];
  var n=recs.length;
  var[tab,setTab]=React.useState("hazard");
  var[toast,setToast]=React.useState("");
  var[loading,setLoading]=React.useState(false);
  var[report,setReport]=React.useState("");
  var[printMode,setPrintMode]=React.useState(false);
  // Hazard list state
  var[hazards,setHazards]=React.useState([]);
  var[newHazard,setNewHazard]=React.useState({name:"",severity:"medium",freq:"low",custom:false,customName:""});
  var[showHazardForm,setShowHazardForm]=React.useState(false);
  // Risk matrix state: severity x freq → risk level
  // Prevention measures
  var[measures,setMeasures]=React.useState([]);
  var[newMeasure,setNewMeasure]=React.useState({hazardRef:"",measure:"",owner:"",dueDate:"",verifyDate:"",status:"計畫中",customMeasure:""});
  var[showMeasureForm,setShowMeasureForm]=React.useState(false);
  // Review records
  var[reviews,setReviews]=React.useState([]);
  var[newReview,setNewReview]=React.useState({date:"",reviewer:"",findings:"",actions:"",nextDate:""});
  var[showReviewForm,setShowReviewForm]=React.useState(false);
  // Plan metadata
  var[meta,setMeta]=React.useState({planName:"異常工作負荷促發疾病預防計畫",companyName:"",preparedBy:"",approvedBy:"",version:"1.0",startDate:"",endDate:""});
  React.useEffect(function(){
    stor.g("ohs_hazards_"+orgCode).then(function(d){if(d)setHazards(JSON.parse(d));});
    stor.g("ohs_measures_"+orgCode).then(function(d){if(d)setMeasures(JSON.parse(d));});
    stor.g("ohs_reviews_"+orgCode).then(function(d){if(d)setReviews(JSON.parse(d));});
    stor.g("ohs_meta_"+orgCode).then(function(d){if(d)setMeta(JSON.parse(d));});
  },[]);
  function saveHazards(list){stor.s("ohs_hazards_"+orgCode,JSON.stringify(list));}
  function saveMeasures(list){stor.s("ohs_measures_"+orgCode,JSON.stringify(list));}
  function saveReviews(list){stor.s("ohs_reviews_"+orgCode,JSON.stringify(list));}
  function saveMeta(m){stor.s("ohs_meta_"+orgCode,JSON.stringify(m));}
  // Risk matrix: severity(high/medium/low) x freq(high/medium/low) → risk
  var RISK_MATRIX={
    high:{high:"extreme",medium:"high",low:"medium"},
    medium:{high:"high",medium:"medium",low:"low"},
    low:{high:"medium",medium:"low",low:"low"}
  };
  var RISK_COLOR={extreme:{bg:"#fef2f2",c:"#b91c1c",label:"極高風險",action:"立即採取預防措施"},
    high:{bg:"#fff7ed",c:"#c2410c",label:"高風險",action:"優先排定改善措施"},
    medium:{bg:"#fefce8",c:"#a16207",label:"中等風險",action:"計畫性改善"},
    low:{bg:"#f0fdf4",c:"#15803d",label:"低風險",action:"定期監控"}};
  var SEV_OPTS=[{k:"high",l:"嚴重"},{k:"medium",l:"中等"},{k:"low",l:"輕微"}];
  var FREQ_OPTS=[{k:"high",l:"頻繁"},{k:"medium",l:"偶爾"},{k:"low",l:"罕見"}];
  var STATUS_OPTS=["計畫中","進行中","已完成","已驗收","暫緩"];
  var STATUS_COLOR={計畫中:T.navy,進行中:T.amber,已完成:T.sage,已驗收:T.teal,暫緩:T.coral};
  function doAddHazard(){
    var name=newHazard.custom?newHazard.customName:newHazard.name;
    if(!name){setToast("請選擇或填入危害類型");return;}
    var risk=RISK_MATRIX[newHazard.severity]?RISK_MATRIX[newHazard.severity][newHazard.freq]:"medium";
    var rec={id:"HZ"+Date.now(),name:name,severity:newHazard.severity,freq:newHazard.freq,risk:risk,createdAt:new Date().toISOString().slice(0,10)};
    var nl=[rec,...hazards];
    setHazards(nl);saveHazards(nl);
    setNewHazard({name:"",severity:"medium",freq:"low",custom:false,customName:""});
    setShowHazardForm(false);
    setToast("危害項目已新增");
  }
  function doDeleteHazard(id){
    var nl=hazards.filter(function(h){return h.id!==id;});
    setHazards(nl);saveHazards(nl);
    setToast("已刪除危害項目");
  }
  function doAddMeasure(){
    if(!newMeasure.hazardRef&&!newMeasure.measure&&!newMeasure.customMeasure){setToast("請填入必要欄位");return;}
    var mName=newMeasure.measure==="其他(自填)"?newMeasure.customMeasure:newMeasure.measure;
    var rec={id:"MS"+Date.now(),hazardRef:newMeasure.hazardRef,measure:mName,owner:newMeasure.owner,dueDate:newMeasure.dueDate,verifyDate:newMeasure.verifyDate,status:newMeasure.status,createdAt:new Date().toISOString().slice(0,10)};
    var nl=[...measures,rec];
    setMeasures(nl);saveMeasures(nl);
    setNewMeasure({hazardRef:"",measure:"",owner:"",dueDate:"",verifyDate:"",status:"計畫中",customMeasure:""});
    setShowMeasureForm(false);
    setToast("預防措施已新增");
  }
  function doUpdateMeasureStatus(id,status){
    var nl=measures.map(function(m){return m.id===id?Object.assign({},m,{status:status}):m;});
    setMeasures(nl);saveMeasures(nl);
  }
  function doAddReview(){
    if(!newReview.date||!newReview.reviewer){setToast("請填入檢討日期與主持人");return;}
    var rec=Object.assign({},newReview,{id:"RV"+Date.now(),createdAt:new Date().toISOString().slice(0,10)});
    var nl=[rec,...reviews];
    setReviews(nl);saveReviews(nl);
    setNewReview({date:"",reviewer:"",findings:"",actions:"",nextDate:""});
    setShowReviewForm(false);
    setToast("檢討記錄已新增");
  }
  async function doGenReport(){
    setLoading(true);setReport("");
    var highRisk=recs.filter(function(r){return (r.sKey==="red"||r.sKey==="orange")&&(r.pKey==="red"||r.pKey==="orange");});
    var extremeH=hazards.filter(function(h){return h.risk==="extreme"||h.risk==="high";});
    var pendingM=measures.filter(function(m){return m.status==="計畫中"||m.status==="進行中";});
    var prompt=["你是職業衛生顧問，請依據《職業安全衛生法》第6條及勞動部「異常工作負荷促發疾病預防指引」，",
      "生成一份完整的「"+meta.planName+"」正式計畫書(繁體中文，約1500字，正式公文格式)。",
      "企業資訊："+meta.companyName+"，版本："+meta.version+"，計畫期間："+meta.startDate+"至"+meta.endDate+"，",
      "製作人："+meta.preparedBy+"，核准人："+meta.approvedBy+"。",
      "危害辨識項目共"+hazards.length+"項，其中高風險/極高風險："+extremeH.length+"項："+extremeH.map(function(h){return h.name;}).join("、")+"。",
      "預防措施共"+measures.length+"項，待完成："+pendingM.length+"項。",
      "健康評估人數："+n+"人，過勞高風險(雙燈橙紅)："+highRisk.length+"人("+(n>0?Math.round(highRisk.length/n*100):0)+"%)。",
      "計畫書需包含：①目的與法規依據 ②適用範圍 ③危害辨識與風險評估摘要 ④預防措施計畫表摘要 ",
      "⑤評估頻率與醫師面談機制 ⑥緊急處置流程 ⑦定期檢討機制 ⑧免責聲明。",
      "格式：使用章節標題，條列式，可直接送交主管機關或ESG報告引用。全程去識別化。"].join("");
    // Fix: 全形()in above string
    try{
      var resp=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1000,messages:[{role:"user",content:prompt}]})});
      var data=await resp.json();
      var txt=data.content&&data.content.filter(function(c){return c.type==="text";}).map(function(c){return c.text;}).join("");
      setReport(txt||"報告生成失敗，請稍後再試。");
    }catch(e){setReport("網路錯誤，請稍後再試。");}
    setLoading(false);
  }
  function doDownloadReport(){
    if(!report){return;}
    var ts=new Date().toLocaleDateString("zh-TW").replace(/\//g,"-");
    var blob=new Blob([meta.planName+"\n版本："+meta.version+"\n日期："+ts+"\n\n"+report],{type:"text/plain;charset=utf-8"});
    var url=URL.createObjectURL(blob);
    var a=document.createElement("a");a.href=url;a.download=meta.planName.replace(/\s/g,"_")+"_"+ts+".txt";a.click();
    URL.revokeObjectURL(url);
  }
  if(printMode){
    var sevLbl=function(k){var f=SEV_OPTS.find(function(s){return s.k===k;});return f?f.l:k;};
    var freqLbl=function(k){var f=FREQ_OPTS.find(function(s){return s.k===k;});return f?f.l:k;};
    var measHazName=function(hid){var h=hazards.find(function(x){return x.id===hid;});return h?h.name:"—";};
    var matrixCells=[];
    ["high","medium","low"].forEach(function(sv){
      ["high","medium","low"].forEach(function(fq){
        var rk=RISK_MATRIX[sv][fq];
        var cnt=hazards.filter(function(h){return h.severity===sv&&h.freq===fq;}).length;
        matrixCells.push({sv:sv,fq:fq,rk:rk,cnt:cnt});
      });
    });
    return ce("div",{style:{minHeight:"100vh",background:"#fff",padding:"20px 24px",maxWidth:800,margin:"0 auto",color:"#222",fontFamily:"inherit"}},
      ce("style",null,"@media print{.ohs-noprint{display:none !important;}body{background:#fff;}} .ohs-ptable{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px;} .ohs-ptable th,.ohs-ptable td{border:1px solid #ccc;padding:6px 8px;text-align:left;}"),
      ce("div",{className:"ohs-noprint",style:{display:"flex",gap:10,marginBottom:18}},
        ce(Btn,{onClick:function(){window.print();}},"🖨 列印/存為PDF"),
        ce(Btn,{v:"ghost",onClick:function(){setPrintMode(false);}},"← 返回編輯")),
      ce("div",{style:{textAlign:"center",marginBottom:20,borderBottom:"2px solid #333",paddingBottom:12}},
        ce("h1",{style:{fontSize:20,margin:0}},meta.planName||"異常工作負荷促發疾病預防計畫"),
        ce("div",{style:{fontSize:13,marginTop:6,color:"#555"}},(meta.companyName||((session&&session.orgName)||"—"))+" · 版本"+(meta.version||"1.0")+" · 製作日期："+new Date().toLocaleDateString("zh-TW")),
        (meta.startDate||meta.endDate)&&ce("div",{style:{fontSize:12,color:"#777",marginTop:4}},"計畫期間："+(meta.startDate||"—")+" ～ "+(meta.endDate||"—")),
        (meta.preparedBy||meta.approvedBy)&&ce("div",{style:{fontSize:11,color:"#888",marginTop:4}},"製作人："+(meta.preparedBy||"—")+" · 核准人："+(meta.approvedBy||"—"))),
      ce("h3",null,"一、危害辨識清單"),
      hazards.length===0?ce("p",{style:{color:"#888",fontSize:12}},"尚無危害辨識記錄。"):
      ce("table",{className:"ohs-ptable"},
        ce("thead",null,ce("tr",null,["危害類型","嚴重度","頻率","風險等級","建立日期"].map(function(h){return ce("th",{key:h},h);}))),
        ce("tbody",null,hazards.map(function(h){
          var rc2=RISK_COLOR[h.risk]||RISK_COLOR.low;
          return ce("tr",{key:h.id},
            ce("td",null,h.name),
            ce("td",null,sevLbl(h.severity)),
            ce("td",null,freqLbl(h.freq)),
            ce("td",{style:{color:rc2.c,fontWeight:700}},rc2.label),
            ce("td",null,h.createdAt));
        }))),
      ce("h3",null,"二、風險評估矩陣(嚴重度×頻率)"),
      ce("table",{className:"ohs-ptable"},
        ce("thead",null,ce("tr",null,["嚴重度＼頻率","頻繁","偶爾","罕見"].map(function(h){return ce("th",{key:h},h);}))),
        ce("tbody",null,["high","medium","low"].map(function(sv){
          return ce("tr",{key:sv},
            ce("td",{style:{fontWeight:700}},sevLbl(sv)),
            ["high","medium","low"].map(function(fq){
              var cell=matrixCells.find(function(c){return c.sv===sv&&c.fq===fq;});
              var rc3=RISK_COLOR[cell.rk]||RISK_COLOR.low;
              return ce("td",{key:fq,style:{color:rc3.c,fontWeight:cell.cnt>0?700:400}},rc3.label+(cell.cnt>0?"("+cell.cnt+"項)":""));
            }));
        }))),
      ce("h3",null,"三、預防措施計畫"),
      measures.length===0?ce("p",{style:{color:"#888",fontSize:12}},"尚無預防措施記錄。"):
      ce("table",{className:"ohs-ptable"},
        ce("thead",null,ce("tr",null,["對應危害","措施內容","負責人","預計完成","驗收日期","狀態"].map(function(h){return ce("th",{key:h},h);}))),
        ce("tbody",null,measures.map(function(m){
          return ce("tr",{key:m.id},
            ce("td",null,measHazName(m.hazardRef)),
            ce("td",null,m.measure),
            ce("td",null,m.owner||"—"),
            ce("td",null,m.dueDate||"—"),
            ce("td",null,m.verifyDate||"—"),
            ce("td",null,m.status));
        }))),
      ce("h3",null,"四、定期檢討記錄"),
      reviews.length===0?ce("p",{style:{color:"#888",fontSize:12}},"尚無定期檢討記錄。"):
      reviews.map(function(rv){
        return ce("div",{key:rv.id,style:{marginBottom:10,fontSize:12}},
          ce("div",{style:{fontWeight:700}},rv.date+" 定期檢討 · 主持人："+rv.reviewer),
          rv.findings&&ce("div",null,"主要發現："+rv.findings),
          rv.actions&&ce("div",null,"後續行動："+rv.actions),
          rv.nextDate&&ce("div",{style:{color:"#666"}},"下次檢討預定日期："+rv.nextDate));
      }),
      ce("h3",null,"五、計畫書全文"),
      report?ce("div",{style:{whiteSpace:"pre-wrap",fontSize:12,lineHeight:1.8}},report):ce("p",{style:{color:"#888",fontSize:12}},"尚未生成AI計畫書全文，請先於「生成計畫書」頁籤生成後再預覽列印。"),
      ce("div",{style:{marginTop:24,fontSize:10,color:"#999",borderTop:"1px solid #ddd",paddingTop:8}},"本計畫書由REIBI企業健康自主管理平台輔助生成，僅供管理參考，不構成法律或醫療專業建議。"));
  }
  var TABS=[{k:"meta",l:"\ud83d\udcdd 計畫資訊"},{k:"hazard",l:"\u26a0 危害辨識"},{k:"matrix",l:"\ud83d\udcca 風險矩陣"},{k:"measure",l:"\ud83d\udee1 預防措施"},{k:"review",l:"\ud83d\udd04 定期檢討"},{k:"report",l:"\ud83d\udccb 生成計畫書"}];
  var highRiskObs=hazards.filter(function(h){return h.risk==="extreme"||h.risk==="high";});
  var completedM=measures.filter(function(m){return m.status==="已完成"||m.status==="已驗收";});
  return ce(Screen,{title:"\u{26A1} \u7570\u5e38\u5de5\u4f5c\u8ca0\u8377\u4fc3\u767c\u75be\u75c5\u9810\u9632\u8a08\u756b",onBack:onBack,maxW:720},
    ce(Toast,{msg:toast,onDone:function(){setToast("");}}),
    ce(IBox,{c:"navy",style:{marginBottom:14}},"\u{1F4CB} \u4f9d\u300a\u8077\u696d\u5b89\u5168\u885b\u751f\u6cd5\u300b\u7b2c6\u689d\u53ca\u52de\u52d5\u90e8\u300c\u7570\u5e38\u5de5\u4f5c\u8ca0\u8377\u4fc3\u767c\u75be\u75c5\u9810\u9632\u6307\u5f15\u300d\uff0c\u96c6\u5718\u61c9\u5efa\u7acb\u5b8c\u6574\u9810\u9632\u8a08\u756b\u5e76\u5b9a\u671f\u68c0\u8a0e\u3002\u672c\u9801\u5e6b\u52a9HR\u5efa\u7acb\u3001\u57f7\u884c\u3001\u8aa8\u9304\u5168\u5c4a\u751f\u547d\u9031\u671f\u3002\u5185\u5bb9\u53ef\u76f4\u63a5\u5f15\u7528\u81f3GRI 403-9\u63ed\u9732\u3002"),
    ce("div",{style:{display:"flex",justifyContent:"flex-end",marginBottom:10}},
      ce(Btn,{v:"navy",sz:"sm",onClick:function(){setPrintMode(true);}},"🖨 預覽列印/存PDF")),
    // Progress summary
    ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}},
      [{l:"危害辨識",v:hazards.length+"項",sub:(highRiskObs.length>0?highRiskObs.length+"項高/極高":"\u2705 無高風險"),c:highRiskObs.length>0?T.coral:T.teal},
       {l:"預防措施",v:measures.length+"項",sub:completedM.length+"/"+measures.length+" 已完成",c:T.amber},
       {l:"定期檢討",v:reviews.length+"次",sub:reviews.length>0?"最近："+reviews[0].date:"尚無記錄",c:T.plum},
       {l:"計畫書",v:report?"已生成":"未生成",sub:report?"\u2705 可下載":"點擊生成計畫書",c:report?T.sage:T.navy}
      ].map(function(x){return ce("div",{key:x.l,style:{background:T.card,border:"1px solid "+T.border,borderRadius:10,padding:"10px 12px",textAlign:"center"}},
        ce("div",{style:{fontSize:18,fontWeight:800,color:x.c}},x.v),
        ce("div",{style:{fontSize:10,fontWeight:700,color:T.muted,marginTop:2}},x.l),
        ce("div",{style:{fontSize:10,color:T.faint,marginTop:2}},x.sub));})
    ),
    // Tabs
    ce("div",{style:{display:"flex",gap:4,marginBottom:14,flexWrap:"wrap"}},
      TABS.map(function(t){
        return ce("button",{key:t.k,onClick:function(){setTab(t.k);},style:{padding:"7px 14px",border:"1px solid "+(tab===t.k?T.teal:T.border),borderRadius:20,cursor:"pointer",fontWeight:700,fontSize:11,fontFamily:"inherit",background:tab===t.k?T.teal:T.card,color:tab===t.k?"#fff":T.muted}},t.l);
      })
    ),

    // ── Tab: 計畫資訊 ──
    tab==="meta"&&ce("div",{style:{display:"grid",gap:12}},
      ce(Card,null,
        ce(SecTitle,null,"\ud83d\udcdd 計畫基本資訊"),
        ce(IBox,{c:"teal",style:{marginBottom:12}},"填寫後計畫書可自動帶入企業名稱、版本、日期等資訊。所有欄位均為選填，可依實際需要調整。"),
        ce("div",{style:{display:"grid",gap:10}},
          [{k:"planName",l:"計畫名稱",ph:"異常工作負荷促發疾病預防計畫"},
           {k:"companyName",l:"企業名稱",ph:"麗媚生化科技有限公司"},
           {k:"preparedBy",l:"製作人",ph:"HR主管姓名"},
           {k:"approvedBy",l:"核准人",ph:"負責人/總經理"},
           {k:"version",l:"計畫版本",ph:"1.0"},
           {k:"startDate",l:"計畫起始日期",ph:"2026-01-01"},
           {k:"endDate",l:"計畫截止日期",ph:"2026-12-31"}
          ].map(function(f){
            return ce("div",{key:f.k},
              ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4}},f.l),
              ce("input",{type:"text",value:meta[f.k]||"",placeholder:f.ph,
                onChange:function(e){var v=e.target.value;setMeta(function(m){var u={};u[f.k]=v;return Object.assign({},m,u);});},
                style:{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box"}}));
          })),
        ce("div",{style:{display:"flex",justifyContent:"flex-end",marginTop:12}},
          ce(Btn,{onClick:function(){saveMeta(meta);setToast("計畫資訊已儲存");}},"儲存資訊")))),

    // ── Tab: 危害辨識 ──
    tab==="hazard"&&ce("div",{style:{display:"grid",gap:12}},
      ce(Card,null,
        ce(SecTitle,null,"\u26a0 危害辨識清單"),
        ce(IBox,{c:"amber",style:{marginBottom:12}},"依勞動部指引，應辨識可能促發腦心血管疾病的工作危害。點擊「新增危害」選擇類型並評估嚴重度與發生頻率，系統自動計算風險等級。"),
        !showHazardForm&&ce(Btn,{onClick:function(){setShowHazardForm(true);}},"\ud83d\udd0d 新增危害項目"),
        showHazardForm&&ce(Card,{style:{background:T.bg,marginTop:12}},
          ce(SecTitle,null,"新增危害項目"),
          ce("div",{style:{marginBottom:10}},
            ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4}},"危害類型"),
            ce("select",{value:newHazard.name,onChange:function(e){var v=e.target.value;setNewHazard(function(h){return Object.assign({},h,{name:v,custom:v==="其他(自填)"});});},
              style:{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box"}},
              ce("option",{value:""},"— 選擇危害類型 —"),
              OHS_HAZARDS.map(function(h){return ce("option",{key:h,value:h},h);}))),
          newHazard.custom&&ce("div",{style:{marginBottom:10}},
            ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4}},"自填危害名稱"),
            ce("input",{type:"text",value:newHazard.customName,placeholder:"請描述危害名稱",
              onChange:function(e){var v=e.target.value;setNewHazard(function(h){return Object.assign({},h,{customName:v});});},
              style:{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box"}})),
          ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}},
            ce("div",null,
              ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4}},"嚴重度"),
              ce("select",{value:newHazard.severity,onChange:function(e){var v=e.target.value;setNewHazard(function(h){return Object.assign({},h,{severity:v});});},
                style:{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box"}},
                SEV_OPTS.map(function(o){return ce("option",{key:o.k,value:o.k},o.l);}))),
            ce("div",null,
              ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4}},"發生頻率"),
              ce("select",{value:newHazard.freq,onChange:function(e){var v=e.target.value;setNewHazard(function(h){return Object.assign({},h,{freq:v});});},
                style:{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box"}},
                FREQ_OPTS.map(function(o){return ce("option",{key:o.k,value:o.k},o.l);}))),
          ),
          ce("div",{style:{marginBottom:10}},
            ce("div",{style:{fontSize:12,color:T.muted,marginBottom:4}},"預估風險等級"),
            (function(){
              var risk=RISK_MATRIX[newHazard.severity]&&RISK_MATRIX[newHazard.severity][newHazard.freq]||"medium";
              var rc=RISK_COLOR[risk]||RISK_COLOR.medium;
              return ce("div",{style:{display:"inline-block",padding:"4px 14px",borderRadius:20,background:rc.bg,color:rc.c,fontSize:12,fontWeight:700}},rc.label+" — "+rc.action);
            })()),
          ce("div",{style:{display:"flex",gap:8,marginTop:12}},
            ce(Btn,{onClick:doAddHazard},"新增"),
            ce(Btn,{v:"ghost",onClick:function(){setShowHazardForm(false);}},"取消"))
        ),
        hazards.length===0&&!showHazardForm&&ce(IBox,{c:"teal",style:{marginTop:12}},"尚無危害辨識項目。點擊「新增危害項目」開始建立危害清單。"),
        hazards.length>0&&ce("div",{style:{marginTop:12,display:"grid",gap:8}},
          hazards.map(function(h){
            var rc=RISK_COLOR[h.risk]||RISK_COLOR.medium;
            return ce("div",{key:h.id,style:{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:rc.bg,border:"1px solid "+(h.risk==="extreme"?"#fca5a5":T.border),borderRadius:8}},
              ce("div",{style:{flex:1}},
                ce("div",{style:{fontWeight:700,fontSize:13,color:T.text}},h.name),
                ce("div",{style:{fontSize:11,color:T.muted,marginTop:2}},"嚴重度："+SEV_OPTS.find(function(o){return o.k===h.severity;}).l+" | 頻率："+FREQ_OPTS.find(function(o){return o.k===h.freq;}).l+" | 建立："+h.createdAt)),
              ce("div",{style:{display:"flex",gap:8,alignItems:"center"}},
                ce("span",{style:{padding:"3px 10px",borderRadius:20,background:"rgba(0,0,0,0.06)",fontSize:11,fontWeight:700,color:rc.c}},rc.label),
                ce("button",{onClick:function(){doDeleteHazard(h.id);},style:{border:"none",background:"none",cursor:"pointer",fontSize:13,color:T.faint,padding:"2px 6px"}},"\u2715")));
          }))
      )
    ),

    // ── Tab: 風險矩陣 ──
    tab==="matrix"&&ce("div",{style:{display:"grid",gap:12}},
      ce(Card,null,
        ce(SecTitle,null,"\ud83d\udcca 風險評估矩陣"),
        ce(IBox,{c:"teal",style:{marginBottom:14}},"依嚴重度×發生頻率交叉評估風險等級。矩陣顏色對應風險程度，每個格內顯示本計畫已辨識的相關危害數量。"),
        ce("div",{style:{overflowX:"auto"}},
          ce("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:12}},
            ce("thead",null,
              ce("tr",null,
                ce("th",{style:{padding:"8px 12px",textAlign:"center",background:T.bg,border:"1px solid "+T.border}},"嚴重度 \\ 頻率"),
                FREQ_OPTS.map(function(f){
                  return ce("th",{key:f.k,style:{padding:"8px 12px",textAlign:"center",background:T.bg,border:"1px solid "+T.border,fontWeight:700,color:T.text}},f.l);
                }))),
            ce("tbody",null,
              SEV_OPTS.map(function(s){
                return ce("tr",{key:s.k},
                  ce("td",{style:{padding:"8px 12px",fontWeight:700,color:T.text,background:T.bg,border:"1px solid "+T.border}},s.l),
                  FREQ_OPTS.map(function(f){
                    var risk=RISK_MATRIX[s.k][f.k];
                    var rc=RISK_COLOR[risk]||RISK_COLOR.medium;
                    var count=hazards.filter(function(h){return h.severity===s.k&&h.freq===f.k;}).length;
                    return ce("td",{key:f.k,style:{padding:"12px",textAlign:"center",background:rc.bg,border:"1px solid "+T.border}},
                      ce("div",{style:{fontWeight:800,fontSize:13,color:rc.c}},rc.label),
                      count>0&&ce("div",{style:{marginTop:4,padding:"2px 8px",borderRadius:20,background:"rgba(0,0,0,0.08)",fontSize:11,fontWeight:700,color:rc.c,display:"inline-block"}},count+"項危害"));
                  }));
              })))),
        ce("div",{style:{marginTop:12,display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}},
          Object.entries(RISK_COLOR).map(function(entry){
            var k=entry[0];var rc=entry[1];
            var cnt=hazards.filter(function(h){return h.risk===k;}).length;
            return ce("div",{key:k,style:{padding:"10px 12px",background:rc.bg,borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center"}},
              ce("div",null,
                ce("div",{style:{fontWeight:700,fontSize:12,color:rc.c}},rc.label),
                ce("div",{style:{fontSize:11,color:T.muted,marginTop:2}},rc.action)),
              ce("div",{style:{fontSize:22,fontWeight:800,color:rc.c}},cnt));
          }))
      )
    ),

    // ── Tab: 預防措施 ──
    tab==="measure"&&ce("div",{style:{display:"grid",gap:12}},
      ce(Card,null,
        ce(SecTitle,null,"\ud83d\udee1 預防措施計畫"),
        ce(IBox,{c:"amber",style:{marginBottom:12}},"針對危害辨識結果制定預防措施，指定負責人與期程，並記錄驗收日期。完成率影響計畫書品質評分。"),
        !showMeasureForm&&ce(Btn,{onClick:function(){setShowMeasureForm(true);}},"\ud83d\udd0d 新增預防措施"),
        showMeasureForm&&ce(Card,{style:{background:T.bg,marginTop:12}},
          ce(SecTitle,null,"新增預防措施"),
          ce("div",{style:{display:"grid",gap:10}},
            ce("div",null,
              ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4}},"對應危害"),
              ce("select",{value:newMeasure.hazardRef,onChange:function(e){var v=e.target.value;setNewMeasure(function(m){return Object.assign({},m,{hazardRef:v});});},
                style:{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box"}},
                ce("option",{value:""},"— 選擇危害項目 —"),
                hazards.map(function(h){return ce("option",{key:h.id,value:h.id},h.name);}),
                ce("option",{value:"general"},"一般性措施(未對應特定危害)"))),
            ce("div",null,
              ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4}},"預防措施"),
              ce("select",{value:newMeasure.measure,onChange:function(e){var v=e.target.value;setNewMeasure(function(m){return Object.assign({},m,{measure:v});});},
                style:{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box"}},
                ce("option",{value:""},"— 選擇措施 —"),
                OHS_MEASURES.map(function(m){return ce("option",{key:m,value:m},m);}))),
            newMeasure.measure==="其他(自填)"&&ce("div",null,
              ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4}},"自填措施內容"),
              ce("input",{type:"text",value:newMeasure.customMeasure,placeholder:"請描述措施內容",
                onChange:function(e){var v=e.target.value;setNewMeasure(function(m){return Object.assign({},m,{customMeasure:v});});},
                style:{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box"}})),
            ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}},
              ce("div",null,
                ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4}},"負責人"),
                ce("input",{type:"text",value:newMeasure.owner,placeholder:"HR主管",onChange:function(e){var v=e.target.value;setNewMeasure(function(m){return Object.assign({},m,{owner:v});});},style:{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box"}})),
              ce("div",null,
                ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4}},"期程日期"),
                ce("input",{type:"date",value:newMeasure.dueDate,onChange:function(e){var v=e.target.value;setNewMeasure(function(m){return Object.assign({},m,{dueDate:v});});},style:{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box"}})),
              ce("div",null,
                ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4}},"驗收日期"),
                ce("input",{type:"date",value:newMeasure.verifyDate,onChange:function(e){var v=e.target.value;setNewMeasure(function(m){return Object.assign({},m,{verifyDate:v});});},style:{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box"}}))
            ),
            ce("div",null,
              ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4}},"狀態"),
              ce("select",{value:newMeasure.status,onChange:function(e){var v=e.target.value;setNewMeasure(function(m){return Object.assign({},m,{status:v});});},
                style:{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box"}},
                STATUS_OPTS.map(function(s){return ce("option",{key:s,value:s},s);})))),
          ce("div",{style:{display:"flex",gap:8,marginTop:12}},
            ce(Btn,{onClick:doAddMeasure},"新增"),
            ce(Btn,{v:"ghost",onClick:function(){setShowMeasureForm(false);}},"取消"))
        ),
        measures.length===0&&!showMeasureForm&&ce(IBox,{c:"teal",style:{marginTop:12}},"尚無預防措施。點擊「新增預防措施」開始建立計畫。"),
        measures.length>0&&ce("div",{style:{marginTop:12,display:"grid",gap:8}},
          measures.map(function(m){
            var hz=hazards.find(function(h){return h.id===m.hazardRef;});
            var sc=STATUS_COLOR[m.status]||T.navy;
            return ce("div",{key:m.id,style:{padding:"12px",background:T.bg,border:"1px solid "+T.border,borderRadius:8}},
              ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}},
                ce("div",{style:{fontWeight:700,fontSize:13,color:T.text,flex:1}},m.measure),
                ce("select",{value:m.status,onChange:function(e){var v=e.target.value;doUpdateMeasureStatus(m.id,v);},
                  style:{padding:"3px 8px",borderRadius:20,border:"1px solid "+sc,fontSize:11,fontWeight:700,color:sc,background:"rgba(0,0,0,0.04)",cursor:"pointer",fontFamily:"inherit"}},
                  STATUS_OPTS.map(function(s){return ce("option",{key:s,value:s},s);}))),
              ce("div",{style:{fontSize:11,color:T.muted}},
                hz?"對應危害："+hz.name:"一般性措施"),
              ce("div",{style:{display:"flex",gap:12,marginTop:4,fontSize:11,color:T.faint}},
                m.owner&&ce("span",null,"負責人："+m.owner),
                m.dueDate&&ce("span",null,"期程："+m.dueDate),
                m.verifyDate&&ce("span",null,"驗收："+m.verifyDate)));
          })))
    ),

    // ── Tab: 定期檢討 ──
    tab==="review"&&ce("div",{style:{display:"grid",gap:12}},
      ce(Card,null,
        ce(SecTitle,null,"\ud83d\udd04 定期檢討記錄"),
        ce(IBox,{c:"teal",style:{marginBottom:12}},"勞動部指引建議至少每年辦理一次計畫成效檢討，高風險企業建議每半年一次。記錄保存至少3年。"),
        !showReviewForm&&ce(Btn,{onClick:function(){setShowReviewForm(true);}},"\ud83d\uddd2 新增檢討記錄"),
        showReviewForm&&ce(Card,{style:{background:T.bg,marginTop:12}},
          ce(SecTitle,null,"新增定期檢討記錄"),
          ce("div",{style:{display:"grid",gap:10}},
            ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}},
              ce("div",null,
                ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4}},"檢討日期 *"),
                ce("input",{type:"date",value:newReview.date,onChange:function(e){var v=e.target.value;setNewReview(function(r){return Object.assign({},r,{date:v});});},style:{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box"}})),
              ce("div",null,
                ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4}},"主持人 *"),
                ce("input",{type:"text",value:newReview.reviewer,placeholder:"職稱/姓名",onChange:function(e){var v=e.target.value;setNewReview(function(r){return Object.assign({},r,{reviewer:v});});},style:{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box"}}))),
            ce("div",null,
              ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4}},"主要發現與評估"),
              ce("textarea",{value:newReview.findings,placeholder:"本期計畫執行情況、問題發現、指標數字等...",rows:3,onChange:function(e){var v=e.target.value;setNewReview(function(r){return Object.assign({},r,{findings:v});});},style:{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box",resize:"vertical"}})),
            ce("div",null,
              ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4}},"後續行動事項"),
              ce("textarea",{value:newReview.actions,placeholder:"計畫修正方向、新增措施、責任人...",rows:2,onChange:function(e){var v=e.target.value;setNewReview(function(r){return Object.assign({},r,{actions:v});});},style:{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box",resize:"vertical"}})),
            ce("div",null,
              ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4}},"下次檢討預定日期"),
              ce("input",{type:"date",value:newReview.nextDate,onChange:function(e){var v=e.target.value;setNewReview(function(r){return Object.assign({},r,{nextDate:v});});},style:{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box"}}))),
          ce("div",{style:{display:"flex",gap:8,marginTop:12}},
            ce(Btn,{onClick:doAddReview},"儲存記錄"),
            ce(Btn,{v:"ghost",onClick:function(){setShowReviewForm(false);}},"取消"))
        ),
        reviews.length===0&&!showReviewForm&&ce(IBox,{c:"amber",style:{marginTop:12}},"尚無定期檢討記錄。建議至少每年辦理一次計畫成效檢討。"),
        reviews.length>0&&ce("div",{style:{marginTop:12,display:"grid",gap:10}},
          reviews.map(function(rv){
            return ce("div",{key:rv.id,style:{padding:"12px",background:T.bg,border:"1px solid "+T.border,borderRadius:8}},
              ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}},
                ce("div",{style:{fontWeight:700,fontSize:13,color:T.text}},rv.date+" 定期檢討"),
                ce(Tag,{c:"teal"},rv.reviewer)),
              rv.findings&&ce("div",{style:{fontSize:12,color:T.muted,marginBottom:4}},"\ud83d\udcdd "+rv.findings),
              rv.actions&&ce("div",{style:{fontSize:12,color:T.navy}},"\ud83d\udea7 "+rv.actions),
              rv.nextDate&&ce("div",{style:{fontSize:11,color:T.teal,marginTop:4}},"\ud83d\uddd3 下次檢討："+rv.nextDate));
          })))
    ),

    // ── Tab: 生成計畫書 ──
    tab==="report"&&ce("div",{style:{display:"grid",gap:12}},
      ce(Card,null,
        ce(SecTitle,null,"\ud83d\udccb 生成正式計畫書"),
        ce(IBox,{c:"navy",style:{marginBottom:12}},"根據您已建立的危害辨識、預防措施、定期檢討記錄，AI自動生成符合職安法第6條及勞動部指引格式的正式計畫書，可直接下載或複製貼入公文。"),
        ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}},
          [{l:"危害項目",v:hazards.length,ok:hazards.length>=3},
           {l:"預防措施",v:measures.length,ok:measures.length>=3},
           {l:"定期檢討",v:reviews.length,ok:reviews.length>=1}
          ].map(function(x){
            return ce("div",{key:x.l,style:{padding:"10px",background:x.ok?T.sageBg:T.amberBg,border:"1px solid "+(x.ok?"#86efac":"#fcd34d"),borderRadius:8,textAlign:"center"}},
              ce("div",{style:{fontSize:20,fontWeight:800,color:x.ok?T.sage:T.amber}},x.v),
              ce("div",{style:{fontSize:11,color:T.muted,marginTop:2}},x.l),
              ce("div",{style:{fontSize:10,marginTop:2,color:x.ok?T.sage:T.amber}},x.ok?"\u2705 充足":"\u26a0 建議至少"+(x.l.includes("定期")?"1":"3")+"項"));
          })),
        ce("div",{style:{display:"flex",gap:8,marginBottom:12}},
          ce(Btn,{onClick:doGenReport,disabled:loading||hazards.length===0},loading?"AI 生成中...":"\ud83e\udd16 生成計畫書(AI)"),
          report&&ce(Btn,{v:"sage",onClick:doDownloadReport},"\u2b07 下載txt"),
          ce(Btn,{v:"navy",onClick:function(){setPrintMode(true);}},"🖨 預覽列印/存PDF")),
        loading&&ce("div",{style:{height:4,background:T.border,borderRadius:2,overflow:"hidden",marginBottom:12}},
          ce("div",{style:{height:"100%",width:"60%",background:T.teal,animation:"none"}})),
        report&&ce("div",null,
          ce(Divider),
          ce(SecTitle,null,"\ud83d\udcce 計畫書內容"),
          ce("div",{style:{background:T.bg,border:"1px solid "+T.border,borderRadius:8,padding:"16px",fontSize:12,lineHeight:1.9,color:T.text,whiteSpace:"pre-wrap",maxHeight:480,overflowY:"auto"}},report),
          ce("div",{style:{display:"flex",gap:8,marginTop:10}},
            ce(Btn,{v:"ghost",onClick:function(){navigator.clipboard.writeText(report).then(function(){setToast("已複製計畫書");});}},"\ud83d\udccb 複製"),
            ce(Btn,{v:"sage",onClick:doDownloadReport},"\u2b07 下載txt"))),
        !report&&!loading&&ce(IBox,{c:"teal",style:{marginTop:8}},"建議先完成危害辨識(3項以上)和預防措施(3項以上)，再生成計畫書，內容更完整。")
      )
    )
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 職安法合規問卷模組群(v10.3.26新增，2026-07-21)
// ⚠️ 僅企業/單位同仁可見(role!=="individual")，個人用戶不需要此模組
// ⚠️ 四表皆為個人自評+個人結果，不含組織彙整分析(先求有再求好，詳見PROJECT_INSTRUCTIONS.md第五十九節)
// ⚠️ 過勞(OverworkScreen)為既有模組沿用，不在此區塊重複定義，僅在OSHHubScreen中一併串接入口
// ═══════════════════════════════════════════════════════════════════════════

// ── 肌肉骨骼症狀調查表 Musculoskeletal Symptom Survey (NMQ) ────────────────
// 法規依據：《職業安全衛生法》第6條第2項、《職業安全衛生設施規則》第324條之1
// 題本來源：勞動部職安署《人因性危害預防計畫指引》(103年8月)附錄一「肌肉骨骼症狀調查表」(引用NMQ)
// ⚠️ 官方原表另有「有危害/確診疾病」等級，需搭配病假/離職率等企業HR資料才能判定，
// 本自評版僅能由問卷本身推算「無危害/疑似有危害」兩級，其餘請引導使用者洽貴公司職安/人資單位
var MSK_PARTS=[
  {id:"neck",label:"頸部"},{id:"back_up",label:"上背"},{id:"back_low",label:"下背"},
  {id:"shoulder_l",label:"左肩"},{id:"shoulder_r",label:"右肩"},
  {id:"elbow_l",label:"左手肘/前臂"},{id:"elbow_r",label:"右手肘/前臂"},
  {id:"wrist_l",label:"左手/手腕"},{id:"wrist_r",label:"右手/手腕"},
  {id:"hip_l",label:"左臀/大腿"},{id:"hip_r",label:"右臀/大腿"},
  {id:"knee_l",label:"左膝"},{id:"knee_r",label:"右膝"},
  {id:"ankle_l",label:"左腳踝/腳"},{id:"ankle_r",label:"右腳踝/腳"}
];
var MSK_SCALE_HINT="0=不痛可自由活動 · 1=微痛到極限會酸痛可忽略 · 2=中等疼痛超過一半會酸痛可能影響工作 · 3=劇痛只剩一半關節活動會影響工作 · 4=非常劇痛只剩1/4影響自主活動能力 · 5=極度劇痛完全無法自主活動";
function mskLevel(maxScore,screened){
  if(!screened||maxScore<=2)return{key:"green",label:"無危害",desc:screened?"雖有症狀通報，但各部位酸痛/不適評分皆在2分以下(輕微範圍)。":"過去1年內無持續2週以上的疲勞、酸痛、發麻等症狀，目前無明顯人因性危害徵兆。",action:"持續維持良好作業姿勢與適度休息，建議每年評估1次。"};
  return{key:"yellow",label:"疑似有危害",desc:"至少一個部位酸痛/不適評分達3分以上，可能與重複性作業或不良姿勢有關。",action:"建議告知貴公司職業安全衛生/人資單位，安排人因工程危害評估或職業醫學科諮詢；亦可先自行調整作業姿勢(如桌椅高度、增加休息頻率)。"};
}
function MSKScreen({session,onBack,onPtsChange}){
  var uid=(session&&session.uid)||"g";
  var orgCode=(session&&session.orgCode)||"";
  var[mode,setMode]=React.useState("menu");
  var[screened,setScreened]=React.useState(null);
  var[dur,setDur]=React.useState("");
  var[scores,setScores]=React.useState({});
  var[history,setHistory]=React.useState([]);
  var[last,setLast]=React.useState(null);
  React.useEffect(function(){
    stor.g("msk_hist_"+uid).then(function(d){if(d){var h=JSON.parse(d);setHistory(h);if(h.length>0)setLast(h[0]);}});
  },[]);
  function doSave(){
    var maxScore=0;
    MSK_PARTS.forEach(function(p){var v=scores[p.id]||0;if(v>maxScore)maxScore=v;});
    var lv=mskLevel(maxScore,screened);
    var rec={ts:new Date().toISOString(),screened:screened,dur:dur,maxScore:maxScore,scores:Object.assign({},scores),level:lv.key,label:lv.label};
    var newHist=[rec,...history].slice(0,12);
    stor.s("msk_hist_"+uid,JSON.stringify(newHist));
    if(orgCode)DB.bumpOshCnt("msk",orgCode);
    setHistory(newHist);setLast(rec);
    if(onPtsChange)onPtsChange(function(p){return p+10;});
    setMode("result");
  }
  var lx=last&&(LX[last.level]||LX.green);
  if(mode==="screen"){
    return ce(Screen,{title:"🦴 肌肉骨骼症狀調查",onBack:function(){setMode("menu");},maxW:560},
      ce(IBox,{c:"amber",style:{marginBottom:14}},"依勞動部職安署《人因性危害預防計畫指引》肌肉骨骼症狀調查表(NMQ)設計"),
      ce(Card,null,
        ce("div",{style:{fontWeight:700,fontSize:13,marginBottom:10}},"您在過去的1年內，身體是否有長達2星期以上的疲勞、酸痛、發麻、刺痛等不舒服，或關節活動受到限制？"),
        ce("div",{style:{display:"flex",gap:10}},
          ce(Btn,{v:screened===false?"amber":"ghost",onClick:function(){setScreened(false);}},"否"),
          ce(Btn,{v:screened===true?"amber":"ghost",onClick:function(){setScreened(true);}},"是"))),
      screened===true&&ce(Card,{style:{marginTop:10}},
        ce("div",{style:{fontWeight:700,fontSize:13,marginBottom:10}},"上述症狀持續多久時間？"),
        ce("div",{style:{display:"grid",gap:6}},
          ["1個月","3個月","6個月","1年","3年","3年以上"].map(function(d){
            var sel=dur===d;
            return ce("button",{key:d,onClick:function(){setDur(d);},
              style:{padding:"8px 12px",borderRadius:8,border:"1px solid "+(sel?T.amber:T.border),background:sel?T.amberBg:T.card,color:sel?T.amber:T.text,fontSize:12,textAlign:"left",cursor:"pointer",fontFamily:"inherit",fontWeight:sel?700:400}},d);
          }))),
      ce(Btn,{onClick:function(){if(screened===false){doSave();return;}if(screened===true&&dur){setMode("quiz");return;}},
        disabled:screened===null||(screened===true&&!dur),full:true,sz:"lg",style:{marginTop:14}},screened===false?"完成調查":"下一步：症狀部位評分"));
  }
  if(mode==="quiz"){
    var allSet=MSK_PARTS.every(function(p){return scores[p.id]!==undefined;});
    return ce(Screen,{title:"🦴 症狀部位評分",onBack:function(){setMode("screen");},maxW:600},
      ce(IBox,{c:"amber",style:{marginBottom:14}},MSK_SCALE_HINT),
      ce("div",{style:{display:"grid",gap:10}},
        MSK_PARTS.map(function(p){
          return ce(Card,{key:p.id},
            ce("div",{style:{fontWeight:700,fontSize:13,marginBottom:8}},p.label),
            ce("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
              [0,1,2,3,4,5].map(function(v){
                var sel=scores[p.id]===v;
                return ce("button",{key:v,onClick:function(){setScores(function(s){var n=Object.assign({},s);n[p.id]=v;return n;});},
                  style:{width:36,height:36,borderRadius:8,border:"1px solid "+(sel?T.coral:T.border),background:sel?T.coralBg:T.card,color:sel?T.coral:T.text,fontSize:13,fontWeight:sel?800:400,cursor:"pointer",fontFamily:"inherit"}},v);
              })));
        })),
      ce(Btn,{onClick:doSave,disabled:!allSet,full:true,sz:"lg",style:{marginTop:14}},"完成評估 +10積分"));
  }
  if(mode==="result"&&last){
    var lv2=mskLevel(last.maxScore,last.screened);var lx2=LX[lv2.key]||LX.green;
    return ce(Screen,{title:"🦴 肌肉骨骼調查結果",onBack:function(){setMode("menu");},maxW:520},
      ce(Card,{style:{textAlign:"center",padding:28,background:lx2.bg,border:"1px solid "+lx2.br,marginBottom:14}},
        last.screened?ce("div",{style:{fontSize:48,fontWeight:800,color:lx2.c}},last.maxScore):null,
        last.screened&&ce("div",{style:{fontSize:12,color:T.muted,marginBottom:8}},"最高部位評分"),
        ce(LBadge,{k:lv2.key}),
        ce("p",{style:{color:T.muted,fontSize:13,marginTop:10,lineHeight:1.8}},lv2.desc)),
      ce(Card,{style:{borderLeft:"4px solid "+lx2.c,marginBottom:14}},
        ce("div",{style:{fontWeight:700,fontSize:13,color:lx2.c,marginBottom:6}},"建議行動"),
        ce("p",{style:{fontSize:13,color:T.muted,lineHeight:1.8,margin:0}},lv2.action)),
      lv2.key==="yellow"&&ce(IBox,{c:"amber",style:{marginBottom:14}},"⚠ 本問卷為個人自評風險篩檢工具，「有危害／確診疾病」等級需搭配病假/離職率等企業內部資料判定，建議由貴公司職安/人資單位進一步評估。"),
      ce(Card,{style:{marginBottom:14}},
        ce("div",{style:{fontWeight:700,fontSize:13,color:T.text,marginBottom:10}},"法規依據"),
        ce("div",{style:{display:"grid",gap:6}},
          ["《職業安全衛生法》第6條第2項：預防重複性作業促發肌肉骨骼疾病","《職業安全衛生設施規則》第324條之1：人因性危害預防措施","勞動部職安署《人因性危害預防計畫指引》附錄一：肌肉骨骼症狀調查表(NMQ)"].map(function(t){
            return ce("div",{key:t,style:{fontSize:12,color:T.muted,padding:"4px 8px",background:T.bg,borderRadius:6}},t);
          }))),
      ce(Btn,{onClick:function(){setMode("menu");},full:true},"返回"));
  }
  if(mode==="history"){
    return ce(Screen,{title:"🦴 調查記錄",onBack:function(){setMode("menu");},maxW:520},
      history.length===0?ce(Card,{style:{textAlign:"center",padding:36,color:T.muted}},"尚無調查記錄"):
      ce("div",{style:{display:"grid",gap:10}},
        history.map(function(h){
          var lx3=LX[h.level]||LX.green;
          return ce(Card,{key:h.ts,style:{borderLeft:"4px solid "+lx3.c}},
            ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
              ce("div",null,ce("div",{style:{fontSize:12,color:T.muted}},h.ts.slice(0,10)),ce("div",{style:{fontSize:16,fontWeight:800,color:lx3.c}},h.screened?h.maxScore+" 分":"無症狀通報")),
              ce(LBadge,{k:h.level})));
        })));
  }
  return ce(Screen,{title:"🦴 肌肉骨骼症狀調查",onBack,maxW:560},
    ce(IBox,{c:"amber",style:{marginBottom:14}},"依《職業安全衛生法》第6條第2項與勞動部職安署人因性危害預防計畫指引，定期調查肌肉骨骼症狀，及早發現重複性作業危害。"),
    last?ce(Card,{style:{marginBottom:14,background:lx.bg,border:"1px solid "+lx.br}},
      ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
        ce("div",null,ce("div",{style:{fontSize:11,color:T.muted}},"上次調查："+last.ts.slice(0,10)),ce(LBadge,{k:last.level}))))
    :ce(IBox,{c:"teal",style:{marginBottom:14}},"尚未調查 · 建議每年完成一次"),
    ce("div",{style:{display:"grid",gap:10}},
      ce(Card,{onClick:function(){setScreened(null);setDur("");setScores({});setMode("screen");},style:{cursor:"pointer",borderLeft:"4px solid "+T.amber}},
        ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
          ce("div",null,ce("div",{style:{fontWeight:700,fontSize:14,color:T.amber}},"🦴 開始症狀調查"),ce("div",{style:{fontSize:12,color:T.muted,marginTop:3}},"15部位評分 · 約5分鐘 · +10積分")),
          ce("div",{style:{fontSize:20}},"▶"))),
      history.length>0&&ce(Btn,{v:"ghost",full:true,onClick:function(){setMode("history");}},"📊 查看歷史記錄")));
}

// ── BSRS-5簡式健康量表(心情溫度計) ───────────────────────────────────────
// 法規依據：《職業安全衛生法》第6條，雇主應採取措施保護勞工身心健康
// 量表來源：臺大醫學院李明濱教授等人發展，衛生福利部/各地衛生局公開版本
// ⚠️ 與現有PHQ-4/PSS-4(MentalWellnessScreen)用途區隔：PHQ-4/PSS-4為個人每週健康自評工具，
// BSRS-5為職安法合規導向的週期性問卷，兩者並存但不重複計入同一份報告(見PROJECT_INSTRUCTIONS.md第五十九節)
var BSRS_Q=[
  {id:"b1",text:"感覺緊張不安"},{id:"b2",text:"覺得容易苦惱或動怒"},{id:"b3",text:"感覺憂鬱、心情低落"},
  {id:"b4",text:"覺得比不上別人"},{id:"b5",text:"睡眠困難，譬如難以入睡、易醒或早醒"}
];
var BSRS_OPTS=["完全沒有(0)","輕微(1)","中等程度(2)","厲害(3)","非常厲害(4)"];
function bsrsLevel(sum,item6){
  var base;
  if(sum<=5)base={key:"green",label:"一般",desc:"整體情緒狀態穩定，屬一般範圍。",action:"維持良好生活作息與情緒調適習慣。"};
  else if(sum<=9)base={key:"yellow",label:"輕度情緒困擾",desc:"近期情緒困擾程度屬輕度。",action:"建議找家人或朋友談談，抒發情緒，給予自己適度支持。"};
  else if(sum<=14)base={key:"orange",label:"中度情緒困擾",desc:"近期情緒困擾程度屬中度。",action:"建議尋求心理諮商或接受專業諮詢。"};
  else base={key:"red",label:"重度情緒困擾",desc:"近期情緒困擾程度屬重度，需高關懷。",action:"建議轉介精神科/身心科治療或接受專業輔導，可撥打安心專線1925。"};
  if(item6>=2)return{key:"red",label:base.label+"／自殺意念關懷",desc:base.desc+" 另您在附加題「有無自殺的想法」評分達中等程度以上。",action:"不論總分高低，建議立即尋求專業協助，可撥打安心專線1925(24小時)或就近至身心科/精神科就診。",item6Flag:true};
  return base;
}
function BSRSScreen({session,onBack,onPtsChange}){
  var uid=(session&&session.uid)||"g";
  var orgCode=(session&&session.orgCode)||"";
  var[mode,setMode]=React.useState("menu");
  var[ans,setAns]=React.useState([]);
  var[item6,setItem6]=React.useState(undefined);
  var[history,setHistory]=React.useState([]);
  var[last,setLast]=React.useState(null);
  React.useEffect(function(){
    stor.g("bsrs5_hist_"+uid).then(function(d){if(d){var h=JSON.parse(d);setHistory(h);if(h.length>0)setLast(h[0]);}});
  },[]);
  function doSave(){
    var sum=ans.reduce(function(s,v){return s+(v||0);},0);
    var lv=bsrsLevel(sum,item6);
    var rec={ts:new Date().toISOString(),sum:sum,item6:item6,level:lv.key,label:lv.label,item6Flag:!!lv.item6Flag};
    var newHist=[rec,...history].slice(0,12);
    stor.s("bsrs5_hist_"+uid,JSON.stringify(newHist));
    if(orgCode)DB.bumpOshCnt("bsrs5",orgCode);
    setHistory(newHist);setLast(rec);
    if(onPtsChange)onPtsChange(function(p){return p+10;});
    setMode("result");
  }
  var lx=last&&(LX[last.level]||LX.green);
  if(mode==="quiz"){
    var allAns=ans.length>=BSRS_Q.length&&ans.every(function(v){return v!==undefined;})&&item6!==undefined;
    return ce(Screen,{title:"💙 簡式健康量表(BSRS-5)",onBack:function(){setMode("menu");},maxW:560},
      ce(IBox,{c:"sage",style:{marginBottom:14}},"請仔細回想「最近一星期中(包括今天)」，下列問題使您感到困擾或苦惱的程度"),
      ce("div",{style:{display:"grid",gap:14}},
        BSRS_Q.map(function(q,qi){
          return ce(Card,{key:q.id},
            ce("div",{style:{fontWeight:700,fontSize:13,color:T.text,marginBottom:8}},q.text),
            ce("div",{style:{display:"grid",gap:6}},
              BSRS_OPTS.map(function(opt){
                var val=parseInt(opt.match(/\((\d)\)/)[1]);
                var sel=ans[qi]===val;
                return ce("button",{key:opt,onClick:function(){var na=ans.slice();na[qi]=val;setAns(na);},
                  style:{padding:"8px 12px",borderRadius:8,border:"1px solid "+(sel?T.sage:T.border),background:sel?T.sageBg:T.card,color:sel?T.sage:T.text,fontSize:12,textAlign:"left",cursor:"pointer",fontFamily:"inherit",fontWeight:sel?700:400}},opt);
              })));
        })),
      ce(Card,{style:{marginTop:4,borderLeft:"4px solid "+T.coral}},
        ce("div",{style:{fontWeight:700,fontSize:13,color:T.coral,marginBottom:8}},"（附加題）最近一星期，您是否有自殺的想法？"),
        ce("div",{style:{display:"grid",gap:6}},
          BSRS_OPTS.map(function(opt){
            var val=parseInt(opt.match(/\((\d)\)/)[1]);
            var sel=item6===val;
            return ce("button",{key:opt,onClick:function(){setItem6(val);},
              style:{padding:"8px 12px",borderRadius:8,border:"1px solid "+(sel?T.coral:T.border),background:sel?T.coralBg:T.card,color:sel?T.coral:T.text,fontSize:12,textAlign:"left",cursor:"pointer",fontFamily:"inherit",fontWeight:sel?700:400}},opt);
          }))),
      ce(Btn,{onClick:doSave,disabled:!allAns,full:true,sz:"lg",style:{marginTop:14}},"完成評估 +10積分"));
  }
  if(mode==="result"&&last){
    var lv2=bsrsLevel(last.sum,last.item6);var lx2=LX[lv2.key]||LX.green;
    return ce(Screen,{title:"💙 BSRS-5 評估結果",onBack:function(){setMode("menu");},maxW:520},
      ce(Card,{style:{textAlign:"center",padding:28,background:lx2.bg,border:"1px solid "+lx2.br,marginBottom:14}},
        ce("div",{style:{fontSize:48,fontWeight:800,color:lx2.c}},last.sum),
        ce("div",{style:{fontSize:12,color:T.muted,marginBottom:8}},"BSRS-5 總分(前5題，滿分20)"),
        ce(LBadge,{k:lv2.key}),
        ce("p",{style:{color:T.muted,fontSize:13,marginTop:10,lineHeight:1.8}},lv2.desc)),
      ce(Card,{style:{borderLeft:"4px solid "+lx2.c,marginBottom:14}},
        ce("div",{style:{fontWeight:700,fontSize:13,color:lx2.c,marginBottom:6}},"建議行動"),
        ce("p",{style:{fontSize:13,color:T.muted,lineHeight:1.8,margin:0}},lv2.action)),
      (lv2.item6Flag||lv2.key==="red")&&ce("div",{style:{marginBottom:14}},
        ce(IBox,{c:"red",style:{marginBottom:8}},"⚠ 高度情緒困擾 · 24小時安心專線：1925"),
        ce("a",{href:"tel:1925",style:{display:"inline-flex",alignItems:"center",padding:"8px 16px",borderRadius:8,background:T.redBg,color:T.red,fontSize:13,fontWeight:700,textDecoration:"none",border:"1px solid "+T.red}},"📞 安心專線 1925")),
      ce(Card,{style:{marginBottom:14}},
        ce("div",{style:{fontWeight:700,fontSize:13,color:T.text,marginBottom:10}},"法規依據"),
        ce("div",{style:{display:"grid",gap:6}},
          ["《職業安全衛生法》第6條：雇主應採取措施保護勞工身心健康","簡式健康量表(BSRS-5)：臺大醫學院李明濱教授等人發展，衛福部公開量表","24小時安心專線：1925"].map(function(t){
            return ce("div",{key:t,style:{fontSize:12,color:T.muted,padding:"4px 8px",background:T.bg,borderRadius:6}},t);
          }))),
      ce(Btn,{onClick:function(){setMode("menu");},full:true},"返回"));
  }
  if(mode==="history"){
    return ce(Screen,{title:"💙 BSRS-5 記錄",onBack:function(){setMode("menu");},maxW:520},
      history.length===0?ce(Card,{style:{textAlign:"center",padding:36,color:T.muted}},"尚無評估記錄"):
      ce("div",{style:{display:"grid",gap:10}},
        history.map(function(h){
          var lx3=LX[h.level]||LX.green;
          return ce(Card,{key:h.ts,style:{borderLeft:"4px solid "+lx3.c}},
            ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
              ce("div",null,ce("div",{style:{fontSize:12,color:T.muted}},h.ts.slice(0,10)),ce("div",{style:{fontSize:16,fontWeight:800,color:lx3.c}},h.sum+" 分")),
              ce(LBadge,{k:h.level})));
        })));
  }
  return ce(Screen,{title:"💙 簡式健康量表(BSRS-5)",onBack,maxW:560},
    ce(IBox,{c:"sage",style:{marginBottom:14}},"又稱「心情溫度計」，依《職業安全衛生法》第6條精神，協助您快速了解自己近期的情緒狀態。"),
    last?ce(Card,{style:{marginBottom:14,background:lx.bg,border:"1px solid "+lx.br}},
      ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
        ce("div",null,ce("div",{style:{fontSize:11,color:T.muted}},"上次評估："+last.ts.slice(0,10)),ce("div",{style:{fontSize:22,fontWeight:800,color:lx.c}},last.sum+" 分"),ce(LBadge,{k:last.level}))))
    :ce(IBox,{c:"teal",style:{marginBottom:14}},"尚未評估 · 建議定期自我檢視"),
    ce("div",{style:{display:"grid",gap:10}},
      ce(Card,{onClick:function(){setAns([]);setItem6(undefined);setMode("quiz");},style:{cursor:"pointer",borderLeft:"4px solid "+T.sage}},
        ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
          ce("div",null,ce("div",{style:{fontWeight:700,fontSize:14,color:T.sage}},"💙 開始評估"),ce("div",{style:{fontSize:12,color:T.muted,marginTop:3}},"5題+1附加題 · 約2分鐘 · +10積分")),
          ce("div",{style:{fontSize:20}},"▶"))),
      history.length>0&&ce(Btn,{v:"ghost",full:true,onClick:function(){setMode("history");}},"📊 查看歷史記錄")));
}

// ── 職場不法侵害風險自評 ────────────────────────────────────────────────
// 法規依據：《職業安全衛生法》第6條第3項、《執行職務遭受不法侵害預防指引》(勞動部職安署，第五版，115年7月)
// ⚠️ 官方無固定題本個人自評版(原指引為組織風險評估矩陣工具)，本題組依最新版指引風險分類(職場暴力/
// 性騷擾/跟蹤騷擾/就業歧視)自行設計，僅作個人風險自評篩檢，非正式申訴管道(結果頁已加註提醒)
var VIOL_CATS=[
  {id:"violence",label:"職場暴力",desc:"如威脅、辱罵、恐嚇、肢體衝突、丟擲物品等"},
  {id:"harass",label:"性騷擾",desc:"如不受歡迎的性意味言語、肢體接觸、要求或暗示"},
  {id:"stalk",label:"跟蹤騷擾",desc:"如重複性監視、盯梢、尾隨、通訊騷擾等造成心生畏怖之行為"},
  {id:"discrim",label:"就業歧視",desc:"如因性別、年齡、身心障礙、種族等因素受到不公平對待"}
];
var VIOL_OPTS=["從未發生(0)","曾發生1-2次(1)","偶爾發生(2)","經常發生(3)"];
function violLevel(maxScore){
  if(maxScore<=1)return{key:"green",label:"無明顯風險徵兆",desc:"目前各類職場不法侵害風險自評結果偏低。",action:"持續留意職場互動狀況，如有異常請隨時提出。"};
  if(maxScore===2)return{key:"yellow",label:"建議留意",desc:"至少一類風險類型自評為「偶爾發生」，建議提高關注。",action:"建議與信任的同事、主管或人資單位討論所遭遇的狀況，及早釐清處理。"};
  return{key:"red",label:"建議提高關注並考慮正式申訴",desc:"至少一類風險類型自評為「經常發生」。",action:"建議儘速透過貴公司內部申訴管道正式申訴，並可尋求信任同事、主管或人資單位協助。"};
}
function ViolenceScreen({session,onBack,onPtsChange}){
  var uid=(session&&session.uid)||"g";
  var[mode,setMode]=React.useState("menu");
  var[ans,setAns]=React.useState({});
  var[history,setHistory]=React.useState([]);
  var[last,setLast]=React.useState(null);
  React.useEffect(function(){
    stor.g("viol_hist_"+uid).then(function(d){if(d){var h=JSON.parse(d);setHistory(h);if(h.length>0)setLast(h[0]);}});
  },[]);
  function doSave(){
    var maxScore=0;var scoresCopy=Object.assign({},ans);
    VIOL_CATS.forEach(function(c){var v=ans[c.id]||0;if(v>maxScore)maxScore=v;});
    var lv=violLevel(maxScore);
    var rec={ts:new Date().toISOString(),maxScore:maxScore,ans:scoresCopy,level:lv.key,label:lv.label};
    var newHist=[rec,...history].slice(0,12);
    stor.s("viol_hist_"+uid,JSON.stringify(newHist));
    setHistory(newHist);setLast(rec);
    if(onPtsChange)onPtsChange(function(p){return p+10;});
    setMode("result");
  }
  var lx=last&&(LX[last.level]||LX.green);
  if(mode==="quiz"){
    var allAns=VIOL_CATS.every(function(c){return ans[c.id]!==undefined;});
    return ce(Screen,{title:"🛡 職場不法侵害風險自評",onBack:function(){setMode("menu");},maxW:560},
      ce(IBox,{c:"navy",style:{marginBottom:14}},"請回想「過去半年」，是否曾遭遇下列情形。本問卷為風險自評工具，非正式申訴管道。"),
      ce("div",{style:{display:"grid",gap:14}},
        VIOL_CATS.map(function(c){
          return ce(Card,{key:c.id},
            ce("div",{style:{fontWeight:700,fontSize:13,color:T.text,marginBottom:2}},c.label),
            ce("div",{style:{fontSize:11,color:T.muted,marginBottom:8}},c.desc),
            ce("div",{style:{display:"grid",gap:6}},
              VIOL_OPTS.map(function(opt){
                var val=parseInt(opt.match(/\((\d)\)/)[1]);
                var sel=ans[c.id]===val;
                return ce("button",{key:opt,onClick:function(){setAns(function(a){var n=Object.assign({},a);n[c.id]=val;return n;});},
                  style:{padding:"8px 12px",borderRadius:8,border:"1px solid "+(sel?T.navy:T.border),background:sel?T.navyBg:T.card,color:sel?T.navy:T.text,fontSize:12,textAlign:"left",cursor:"pointer",fontFamily:"inherit",fontWeight:sel?700:400}},opt);
              })));
        })),
      ce(Btn,{onClick:doSave,disabled:!allAns,full:true,sz:"lg",style:{marginTop:14}},"完成自評 +10積分"));
  }
  if(mode==="result"&&last){
    var lv2=violLevel(last.maxScore);var lx2=LX[lv2.key]||LX.green;
    return ce(Screen,{title:"🛡 職場不法侵害自評結果",onBack:function(){setMode("menu");},maxW:520},
      ce(Card,{style:{textAlign:"center",padding:28,background:lx2.bg,border:"1px solid "+lx2.br,marginBottom:14}},
        ce(LBadge,{k:lv2.key}),
        ce("p",{style:{color:T.muted,fontSize:13,marginTop:10,lineHeight:1.8}},lv2.desc)),
      ce(Card,{style:{borderLeft:"4px solid "+lx2.c,marginBottom:14}},
        ce("div",{style:{fontWeight:700,fontSize:13,color:lx2.c,marginBottom:6}},"建議行動"),
        ce("p",{style:{fontSize:13,color:T.muted,lineHeight:1.8,margin:0}},lv2.action)),
      ce(IBox,{c:"red",style:{marginBottom:14}},"⚠ 本問卷為風險自評工具，若您已遭受不法侵害，請立即透過貴公司內部申訴管道正式申訴，不需等待或依賴此問卷。"),
      ce(Card,{style:{marginBottom:14}},
        ce("div",{style:{fontWeight:700,fontSize:13,color:T.text,marginBottom:10}},"法規依據"),
        ce("div",{style:{display:"grid",gap:6}},
          ["《職業安全衛生法》第6條第3項：預防勞工遭受身體或精神不法侵害","《執行職務遭受不法侵害預防指引》(勞動部職安署，第五版，115年7月)","風險類型：職場暴力／性騷擾／跟蹤騷擾／就業歧視"].map(function(t){
            return ce("div",{key:t,style:{fontSize:12,color:T.muted,padding:"4px 8px",background:T.bg,borderRadius:6}},t);
          }))),
      ce(Btn,{onClick:function(){setMode("menu");},full:true},"返回"));
  }
  if(mode==="history"){
    return ce(Screen,{title:"🛡 自評記錄",onBack:function(){setMode("menu");},maxW:520},
      history.length===0?ce(Card,{style:{textAlign:"center",padding:36,color:T.muted}},"尚無自評記錄"):
      ce("div",{style:{display:"grid",gap:10}},
        history.map(function(h){
          var lx3=LX[h.level]||LX.green;
          return ce(Card,{key:h.ts,style:{borderLeft:"4px solid "+lx3.c}},
            ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
              ce("div",null,ce("div",{style:{fontSize:12,color:T.muted}},h.ts.slice(0,10))),ce(LBadge,{k:h.level})));
        })));
  }
  return ce(Screen,{title:"🛡 職場不法侵害風險自評",onBack,maxW:560},
    ce(IBox,{c:"navy",style:{marginBottom:14}},"依《職業安全衛生法》第6條第3項與《執行職務遭受不法侵害預防指引》，定期自評職場不法侵害風險。"),
    last?ce(Card,{style:{marginBottom:14,background:lx.bg,border:"1px solid "+lx.br}},
      ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
        ce("div",null,ce("div",{style:{fontSize:11,color:T.muted}},"上次自評："+last.ts.slice(0,10)),ce(LBadge,{k:last.level}))))
    :ce(IBox,{c:"teal",style:{marginBottom:14}},"尚未自評 · 建議定期自我檢視"),
    ce("div",{style:{display:"grid",gap:10}},
      ce(Card,{onClick:function(){setAns({});setMode("quiz");},style:{cursor:"pointer",borderLeft:"4px solid "+T.navy}},
        ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
          ce("div",null,ce("div",{style:{fontWeight:700,fontSize:14,color:T.navy}},"🛡 開始自評"),ce("div",{style:{fontSize:12,color:T.muted,marginTop:3}},"4類風險題組 · 約2分鐘 · +10積分")),
          ce("div",{style:{fontSize:20}},"▶"))),
      history.length>0&&ce(Btn,{v:"ghost",full:true,onClick:function(){setMode("history");}},"📊 查看歷史記錄")));
}

// ── 職安法合規問卷 統一入口(僅企業/單位同仁可見，個人用戶不顯示) ──────────
function OSHHubScreen({session,onBack,onNav}){
  var uid=(session&&session.uid)||"g";
  var[lastOW,setLastOW]=React.useState(null);
  var[lastMSK,setLastMSK]=React.useState(null);
  var[lastBSRS,setLastBSRS]=React.useState(null);
  var[lastViol,setLastViol]=React.useState(null);
  React.useEffect(function(){
    stor.g("ow_hist_"+uid).then(function(d){if(d){var h=JSON.parse(d);if(h.length>0)setLastOW(h[0]);}});
    stor.g("msk_hist_"+uid).then(function(d){if(d){var h=JSON.parse(d);if(h.length>0)setLastMSK(h[0]);}});
    stor.g("bsrs5_hist_"+uid).then(function(d){if(d){var h=JSON.parse(d);if(h.length>0)setLastBSRS(h[0]);}});
    stor.g("viol_hist_"+uid).then(function(d){if(d){var h=JSON.parse(d);if(h.length>0)setLastViol(h[0]);}});
  },[]);
  var items=[
    {icon:"⚡",title:"過勞風險自評",nav:"overwork",last:lastOW,acc:T.coral,law:"職安法第6條第2項"},
    {icon:"🦴",title:"肌肉骨骼症狀調查",nav:"msk",last:lastMSK,acc:T.amber,law:"職安法第6條第2項"},
    {icon:"💙",title:"簡式健康量表(BSRS-5)",nav:"bsrs5",last:lastBSRS,acc:T.sage,law:"職安法第6條"},
    {icon:"🛡",title:"職場不法侵害風險自評",nav:"violence",last:lastViol,acc:T.navy,law:"職安法第6條第3項"}
  ];
  return ce(Screen,{title:"⚠️ 職安法合規問卷",onBack,maxW:600},
    ce(IBox,{c:"amber",style:{marginBottom:14}},"依《職業安全衛生法》相關規定，提供四項自評問卷，協助您及早發現健康與職場風險。填答結果僅供個人查看，不做部門/組織彙整。"),
    ce("div",{style:{display:"grid",gap:10}},
      items.map(function(it){
        var lx=it.last&&(LX[it.last.level]||LX.green);
        return ce(Card,{key:it.nav,onClick:function(){if(onNav)onNav(it.nav);},style:{cursor:"pointer",borderLeft:"4px solid "+it.acc}},
          ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
            ce("div",null,
              ce("div",{style:{fontWeight:700,fontSize:14,color:it.acc}},it.icon+" "+it.title),
              ce("div",{style:{fontSize:11,color:T.muted,marginTop:3}},it.law+(it.last?" · 上次填答："+it.last.ts.slice(0,10):" · 尚未填答")),
              it.last&&ce("div",{style:{marginTop:6}},ce(LBadge,{k:it.last.level}))),
            ce("div",{style:{fontSize:20}},"▶")));
      })));
}

// ── 職安問卷填答活躍度(管理者查看，僅份數統計，非個人完成率) ─────────────────
// ⚠️ 不含職場不法侵害(該問卷刻意不追蹤填答活躍度，避免暗示未填=有問題，詳見PROJECT_INSTRUCTIONS.md第五十九節)
// ⚠️ 這是「填答份數」而非「完成率」——因單位成員/部門主管帳號採群組密碼登入、每次登入uid皆隨機產生，
// 系統沒有穩定的員工個人身份可比對「誰填了/誰沒填」，無法計算精確的 已填人數/總人數 完成率，
// 只能統計「送出過幾份」，同一人重複填寫會被重複計入，不代表填答人數
function OSHActivityScreen({session,onBack}){
  var orgCode=(session&&session.orgCode)||"";
  var[counts,setCounts]=React.useState({ow:0,msk:0,bsrs5:0});
  var[loading,setLoading]=React.useState(true);
  React.useEffect(function(){
    if(!orgCode){setLoading(false);return;}
    Promise.all([DB.oshCnt("ow",orgCode),DB.oshCnt("msk",orgCode),DB.oshCnt("bsrs5",orgCode)]).then(function(r){
      setCounts({ow:r[0]?parseInt(r[0],10):0,msk:r[1]?parseInt(r[1],10):0,bsrs5:r[2]?parseInt(r[2],10):0});
      setLoading(false);
    });
  },[]);
  var items=[
    {icon:"⚡",title:"過勞風險自評",n:counts.ow,acc:T.coral},
    {icon:"🦴",title:"肌肉骨骼症狀調查",n:counts.msk,acc:T.amber},
    {icon:"💙",title:"簡式健康量表(BSRS-5)",n:counts.bsrs5,acc:T.sage}
  ];
  return ce(Screen,{title:"📊 職安問卷填答活躍度",onBack,maxW:600},
    ce(IBox,{c:"navy",style:{marginBottom:14}},"統計單位累計送出的問卷份數，用於了解整體填答活躍度。⚠️ 因單位成員採群組密碼登入、無穩定個人身份可比對，此為「送出份數」而非「已填人數/總人數」的精確完成率，同一人重複填寫會重複計入。職場不法侵害風險自評刻意不列入統計(避免暗示未填=有異常)。"),
    loading?ce(Card,{style:{textAlign:"center",padding:36,color:T.muted}},"載入中…"):
    ce("div",{style:{display:"grid",gap:10}},
      items.map(function(it){
        return ce(Card,{key:it.title,style:{borderLeft:"4px solid "+it.acc}},
          ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
            ce("div",{style:{fontWeight:700,fontSize:14,color:it.acc}},it.icon+" "+it.title),
            ce("div",{style:{fontSize:24,fontWeight:800,color:it.acc}},it.n+" 份")));
      })));
}

// ── 心理/情緒/壓力評估 Mental Wellness ──────────────────────────────────────
// 三維雷達圖(ISI睡眠 × BPI疼痛 × MHI身心，純SVG，無外部圖表庫)
// 三軸皆正規化為 0-100，分數越高代表狀態越好(ISI/BPI已反轉：100=無症狀，0=最嚴重)
function RadarChart3(props){
  var data=props.data||[]; // [{label,value(0-100),color}]
  var W=240,H=240,cx=W/2,cy=H/2,R=86;
  var n=data.length||3;
  var angle=function(i){return -Math.PI/2+(i*2*Math.PI/n);};
  var pt=function(i,r){return [cx+r*Math.cos(angle(i)),cy+r*Math.sin(angle(i))];};
  var rings=[0.25,0.5,0.75,1];
  var dataPts=data.map(function(d,i){var p=pt(i,R*Math.max(0,Math.min(100,d.value))/100);return p[0]+","+p[1];}).join(" ");
  return ce("svg",{width:"100%",height:H,viewBox:"0 0 "+W+" "+H},
    rings.map(function(r,ri){
      var ringPts=data.map(function(d,i){var p=pt(i,R*r);return p[0]+","+p[1];}).join(" ");
      return ce("polygon",{key:"ring"+ri,points:ringPts,fill:"none",stroke:"#e2e8f0",strokeWidth:1});
    }),
    data.map(function(d,i){
      var p=pt(i,R);
      return ce("line",{key:"axis"+i,x1:cx,y1:cy,x2:p[0],y2:p[1],stroke:"#e2e8f0",strokeWidth:1});
    }),
    ce("polygon",{points:dataPts,fill:(props.fillColor||"#2d7d6e")+"33",stroke:props.fillColor||"#2d7d6e",strokeWidth:2}),
    data.map(function(d,i){
      var p=pt(i,R*Math.max(0,Math.min(100,d.value))/100);
      return ce("circle",{key:"pt"+i,cx:p[0],cy:p[1],r:4,fill:d.color||props.fillColor||"#2d7d6e"});
    }),
    data.map(function(d,i){
      var lp=pt(i,R+22);
      return ce("text",{key:"lbl"+i,x:lp[0],y:lp[1],fontSize:11,fontWeight:700,fill:"#2d2520",
        textAnchor:i===0?"middle":(lp[0]<cx-5?"end":lp[0]>cx+5?"start":"middle")},d.label+(d.value!==null&&d.value!==undefined?"("+d.value+")":""));
    }));
}

function MentalWellnessScreen({session,onBack,onPtsChange,onRptChange}){
  var uid=(session&&session.uid)||"g";
  var[mode,setMode]=React.useState("menu");
  var[phqAns,setPhqAns]=React.useState([]);
  var[pssAns,setPssAns]=React.useState([]);
  var[mindAns,setMindAns]=React.useState([]);
  var[history,setHistory]=React.useState([]);
  var[rpts,setRptsLocal]=React.useState([]);

  React.useEffect(function(){
    stor.g("mental_hist_"+uid).then(function(d){if(d)setHistory(JSON.parse(d));});
    DB.rpts().then(function(r){if(r)setRptsLocal(r);});
  },[]);

  // PHQ-4 題目
  var PHQ4=[
    {q:"在過去2週，您有多常被以下問題困擾？",sub:"感覺神經緊張、焦慮或緊繃",key:"phq1"},
    {q:"",sub:"無法停止或控制擔憂",key:"phq2"},
    {q:"",sub:"對事物失去興趣或樂趣",key:"phq3"},
    {q:"",sub:"感到心情低落、沮喪或絕望",key:"phq4"},
  ];
  var PHQ_OPTS=["完全沒有(0)","幾天(1)","超過一半時間(2)","幾乎每天(3)"];

  // PSS-10 題目(精簡，使用4題版PSS-4)
  var PSS4=[
    {q:"過去一個月，您多常因為發生預期之外的事情而感到心煩意亂？",key:"pss1",reverse:false},
    {q:"過去一個月，您多常感到無法控制生活中的重要事情？",key:"pss2",reverse:false},
    {q:"過去一個月，您多常感到自信，有能力處理個人問題？",key:"pss3",reverse:true},
    {q:"過去一個月，您多常感到事情順心如意？",key:"pss4",reverse:true},
  ];
  var PSS_OPTS=["從不(0)","幾乎從不(1)","有時(2)","相當頻繁(3)","非常頻繁(4)"];

  // 正念簡易自評(3題，非正式量表，快速累積版)
  var MIND3=[
    {q:"過去一週，您有多常能專注於當下，而不被雜念分心？",key:"mind1"},
    {q:"過去一週，您有多常在情緒升起時，能先觀察而不立刻反應？",key:"mind2"},
    {q:"過去一週，您有多常留意自己的呼吸或身體感受來放鬆自己？",key:"mind3"},
  ];
  var MIND_OPTS=["幾乎沒有(0)","偶爾(1)","經常(2)","幾乎總是(3)"];

  function calcMind(ans){return ans.reduce(function(s,v){return s+v;},0);}
  function mindLevel(score){
    if(score>=7)return{key:"green",label:"良好",desc:"正念覺察能力良好"};
    if(score>=4)return{key:"yellow",label:"普通",desc:"可多加練習正念覺察"};
    return{key:"red",label:"待加強",desc:"建議嘗試簡單正念練習，如深呼吸或身體掃描"};
  }

  function doSaveMind(){
    var score=calcMind(mindAns);
    var level=mindLevel(score);
    var entry={type:"mind3",score:score,level:level.key,ans:mindAns,ts:new Date().toISOString()};
    var newHist=[entry,...history];
    setHistory(newHist);
    stor.s("mental_hist_"+uid,JSON.stringify(newHist));
    DB.addPts(uid,5).then(function(np){if(onPtsChange)onPtsChange(np);});
    setMode("mind_result");
  }

  // MHI 身心健康指數(情緒PHQ-4 + 壓力PSS-4 + 正念mind3 三維合成，0-100，分數越高越好)
  function calcMHI(lastPhq,lastPss,lastMind){
    var phqPart=lastPhq?Math.max(0,100-Math.round((lastPhq.score/12)*100)):null;
    var pssPart=lastPss?Math.max(0,100-Math.round((lastPss.score/16)*100)):null;
    var mindPart=lastMind?Math.round((lastMind.score/9)*100):null;
    var parts=[phqPart,pssPart,mindPart].filter(function(p){return p!==null;});
    if(!parts.length)return null;
    var avg=Math.round(parts.reduce(function(a,b){return a+b;},0)/parts.length);
    return {score:avg,phqPart:phqPart,pssPart:pssPart,mindPart:mindPart,complete:parts.length===3};
  }
  function mhiLevel(score){
    if(score>=75)return{key:"green",label:"良好"};
    if(score>=50)return{key:"yellow",label:"普通"};
    if(score>=30)return{key:"orange",label:"待關注"};
    return{key:"red",label:"需關注"};
  }

  function calcPHQ(ans){return ans.reduce(function(s,v){return s+v;},0);}
  function calcPSS(ans){
    var s=0;
    for(var i=0;i<ans.length;i++){
      s+=(i===2||i===3)?(4-ans[i]):ans[i];
    }
    return s;
  }

  function phqLevel(score){
    if(score<=2)return{key:"green",label:"正常",desc:"目前情緒狀態良好",action:"維持現有生活習慣，定期評估"};
    if(score<=5)return{key:"yellow",label:"輕度",desc:"輕度焦慮或情緒低落",action:"建議練習放鬆技巧，規律運動改善情緒"};
    if(score<=8)return{key:"orange",label:"中度",desc:"中度情緒困擾",action:"建議諮詢心理衛生專業人員"};
    return{key:"red",label:"重度",desc:"需要專業協助",action:"建議盡快就醫：身心科/精神科，1925安心專線"};
  }
  function pssLevel(score){
    if(score<=5)return{key:"green",label:"低壓力"};
    if(score<=10)return{key:"yellow",label:"中度壓力"};
    return{key:"red",label:"高壓力"};
  }

  function doSavePHQ(){
    var score=calcPHQ(phqAns);
    var level=phqLevel(score);
    var entry={type:"phq4",score:score,level:level.key,ans:phqAns,ts:new Date().toISOString()};
    var newHist=[entry,...history];
    setHistory(newHist);
    stor.s("mental_hist_"+uid,JSON.stringify(newHist));
    DB.addPts(uid,5).then(function(np){if(onPtsChange)onPtsChange(np);});
    setMode("phq_result");
  }
  function doSavePSS(){
    var score=calcPSS(pssAns);
    var level=pssLevel(score);
    var entry={type:"pss4",score:score,level:level.key,ans:pssAns,ts:new Date().toISOString()};
    var newHist=[entry,...history];
    setHistory(newHist);
    stor.s("mental_hist_"+uid,JSON.stringify(newHist));
    DB.addPts(uid,10).then(function(np){if(onPtsChange)onPtsChange(np);});
    setMode("pss_result");
  }

  var lastPHQ=history.find(function(h){return h.type==="phq4";});
  var lastPSS=history.find(function(h){return h.type==="pss4";});
  var lastMind=history.find(function(h){return h.type==="mind3";});
  var mhi=calcMHI(lastPHQ,lastPSS,lastMind);
  var lastISI=rpts&&rpts.length?rpts[0]:null;

  // Result views
  if(mode==="phq_result"&&lastPHQ){
    var pl=phqLevel(lastPHQ.score);var lx=LX[pl.key]||LX.green;
    return ce(Screen,{title:"PHQ-4 結果",onBack:function(){setMode("menu");},maxW:520},
      ce(Card,{style:{textAlign:"center",padding:30,background:lx.bg,border:"1px solid "+lx.br}},
        ce("div",{style:{fontSize:48,fontWeight:800,color:lx.c}},lastPHQ.score),
        ce("div",{style:{fontSize:12,color:T.muted,marginBottom:8}},"PHQ-4 總分 / 12"),
        ce(LBadge,{k:pl.key}),
        ce("p",{style:{color:T.muted,fontSize:13,marginTop:10}},pl.desc),
        ce("div",{style:{background:lx.bg,borderRadius:8,padding:"10px",marginTop:10,fontSize:12,color:lx.c,fontWeight:600}},"▸ "+pl.action)),
      (pl.key==="orange"||pl.key==="red")&&ce(IBox,{c:"red",style:{marginTop:12}},"⚠ 建議諮詢專業人員 · 1925安心專線(24小時)"),
      ce(IBox,{c:"teal",style:{marginTop:12}},"本評估為輔助篩查工具，不構成醫療診斷。如有疑慮請諮詢身心科醫師。"),
      ce(Btn,{onClick:function(){setMode("menu");},full:true,style:{marginTop:14}},"返回主選單"));
  }
  if(mode==="pss_result"&&lastPSS){
    var sl=pssLevel(lastPSS.score);var sx=LX[sl.key]||LX.green;
    return ce(Screen,{title:"壓力評估結果",onBack:function(){setMode("menu");},maxW:520},
      ce(Card,{style:{textAlign:"center",padding:30,background:sx.bg,border:"1px solid "+sx.br}},
        ce("div",{style:{fontSize:48,fontWeight:800,color:sx.c}},lastPSS.score),
        ce("div",{style:{fontSize:12,color:T.muted,marginBottom:8}},"PSS-4 總分 / 16"),
        ce(LBadge,{k:sl.key})),
      ce(IBox,{c:"teal",style:{marginTop:12}},"本評估為輔助工具，不構成醫療診斷。職場壓力如持續偏高，建議與主管或HR溝通調整工作負荷。"),
      ce(Btn,{onClick:function(){setMode("menu");},full:true,style:{marginTop:14}},"返回主選單"));
  }
  if(mode==="mind_result"&&lastMind){
    var ml=mindLevel(lastMind.score);var mx=LX[ml.key]||LX.green;
    return ce(Screen,{title:"正念覺察結果",onBack:function(){setMode("menu");},maxW:520},
      ce(Card,{style:{textAlign:"center",padding:30,background:mx.bg,border:"1px solid "+mx.br}},
        ce("div",{style:{fontSize:48,fontWeight:800,color:mx.c}},lastMind.score),
        ce("div",{style:{fontSize:12,color:T.muted,marginBottom:8}},"正念自評 總分 / 9"),
        ce(LBadge,{k:ml.key}),
        ce("p",{style:{color:T.muted,fontSize:13,marginTop:10}},ml.desc)),
      ce(IBox,{c:"navy",style:{marginTop:12}},"本題組為快速自評，非正式心理測驗，僅供個人覺察參考。"),
      ce(Btn,{onClick:function(){setMode("menu");},full:true,style:{marginTop:14}},"返回主選單"));
  }

  // PHQ-4 questionnaire
  if(mode==="phq"){
    return ce(Screen,{title:"💚 情緒健康快篩(PHQ-4)",onBack:function(){setMode("menu");},maxW:540},
      ce(IBox,{c:"teal",style:{marginBottom:14}},"4題 · 約2分鐘 · 完成後 +5積分 · 僅個人可見，不上傳至單位統計"),
      ce("div",{style:{display:"grid",gap:14}},
        PHQ4.map(function(q,qi){
          return ce(Card,{key:q.key},
            qi===0&&ce("div",{style:{fontWeight:600,fontSize:13,color:T.muted,marginBottom:8}},q.q),
            ce("div",{style:{fontWeight:700,fontSize:14,color:T.text,marginBottom:10}},q.sub),
            ce("div",{style:{display:"grid",gap:6}},
              PHQ_OPTS.map(function(opt,oi){
                var sel=phqAns[qi]===oi;
                return ce("button",{key:opt,onClick:function(){
                  var newAns=[...phqAns];newAns[qi]=oi;setPhqAns(newAns);},
                  style:{padding:"8px 12px",borderRadius:8,border:"1px solid "+(sel?T.teal:T.border),
                    background:sel?T.tealBg:T.card,color:sel?T.teal:T.text,fontSize:12,textAlign:"left",
                    cursor:"pointer",fontFamily:"inherit",fontWeight:sel?700:400}},opt);
              })));
        })),
      ce(Btn,{onClick:doSavePHQ,disabled:phqAns.length<4||phqAns.some(function(v){return v===undefined;}),full:true,sz:"lg",style:{marginTop:14}},"完成並查看結果 +5積分"));
  }

  // PSS-4 questionnaire
  if(mode==="pss"){
    return ce(Screen,{title:"🧘 壓力評估(PSS-4)",onBack:function(){setMode("menu");},maxW:540},
      ce(IBox,{c:"amber",style:{marginBottom:14}},"4題 · 約3分鐘 · 完成後 +10積分 · 每月一次為佳"),
      ce("div",{style:{display:"grid",gap:14}},
        PSS4.map(function(q,qi){
          return ce(Card,{key:q.key},
            ce("div",{style:{fontWeight:700,fontSize:13,color:T.text,marginBottom:10}},q.q),
            ce("div",{style:{display:"grid",gap:6}},
              PSS_OPTS.map(function(opt,oi){
                var sel=pssAns[qi]===oi;
                return ce("button",{key:opt,onClick:function(){
                  var newAns=[...pssAns];newAns[qi]=oi;setPssAns(newAns);},
                  style:{padding:"8px 12px",borderRadius:8,border:"1px solid "+(sel?T.amber:T.border),
                    background:sel?T.amberBg:T.card,color:sel?T.amber:T.text,fontSize:12,textAlign:"left",
                    cursor:"pointer",fontFamily:"inherit",fontWeight:sel?700:400}},opt);
              })));
        })),
      ce(Btn,{onClick:doSavePSS,disabled:pssAns.length<4||pssAns.some(function(v){return v===undefined;}),full:true,sz:"lg",style:{marginTop:14}},"完成並查看結果 +10積分"));
  }

  // 正念簡易自評問卷
  if(mode==="mind"){
    return ce(Screen,{title:"🍃 正念覺察自評",onBack:function(){setMode("menu");},maxW:540},
      ce(IBox,{c:"navy",style:{marginBottom:14}},"3題 · 約1分鐘 · 完成後 +5積分 · 快速自評，非正式量表，僅供個人覺察參考"),
      ce("div",{style:{display:"grid",gap:14}},
        MIND3.map(function(q,qi){
          return ce(Card,{key:q.key},
            ce("div",{style:{fontWeight:700,fontSize:13,color:T.text,marginBottom:10}},q.q),
            ce("div",{style:{display:"grid",gap:6}},
              MIND_OPTS.map(function(opt,oi){
                var sel=mindAns[qi]===oi;
                return ce("button",{key:opt,onClick:function(){
                  var newAns=[...mindAns];newAns[qi]=oi;setMindAns(newAns);},
                  style:{padding:"8px 12px",borderRadius:8,border:"1px solid "+(sel?T.navy:T.border),
                    background:sel?T.navyBg:T.card,color:sel?T.navy:T.text,fontSize:12,textAlign:"left",
                    cursor:"pointer",fontFamily:"inherit",fontWeight:sel?700:400}},opt);
              })));
        })),
      ce(Btn,{onClick:doSaveMind,disabled:mindAns.length<3||mindAns.some(function(v){return v===undefined;}),full:true,sz:"lg",style:{marginTop:14}},"完成並查看結果 +5積分"));
  }

  // Main menu
  var radarData=[
    {label:"睡眠",value:lastISI?Math.round(100-(lastISI.sScore/28)*100):null,color:T.teal},
    {label:"疼痛",value:lastISI?Math.round(100-(lastISI.pScore/50)*100):null,color:T.coral},
    {label:"身心(MHI)",value:mhi?mhi.score:null,color:T.plum}
  ];
  var radarHasData=radarData.some(function(d){return d.value!==null;});
  var radarDataFilled=radarData.map(function(d){return Object.assign({},d,{value:d.value===null?0:d.value});});

  return ce(Screen,{title:"💚 身心健康管理",onBack:onBack,maxW:560},
    ce(IBox,{c:"teal",style:{marginBottom:14}},"身心三維評估：睡眠(ISI)× 疼痛(BPI)× 心理(PHQ-4/PSS/正念)\n全程保密，僅個人可見，不上傳至單位統計。"),
    radarHasData&&ce(Card,{style:{marginBottom:14}},
      ce(SecTitle,null,"🎯 個人身心三維雷達圖"),
      ce(RadarChart3,{data:radarDataFilled,fillColor:T.plum}),
      mhi&&!mhi.complete&&ce(IBox,{c:"amber",style:{marginTop:8,fontSize:11}},"MHI 目前僅根據"+[lastPHQ&&"情緒",lastPSS&&"壓力",lastMind&&"正念"].filter(Boolean).join("+")+"計算，完成全部3項評估可得更完整指數"),
      mhi&&mhi.complete&&ce(IBox,{c:"sage",style:{marginTop:8,fontSize:11}},"MHI 身心健康指數："+mhi.score+"/100("+mhiLevel(mhi.score).label+")· 已綜合情緒+壓力+正念三項評估")),
    ce("div",{style:{display:"grid",gap:12}},
      ce(Card,{onClick:function(){setPhqAns([]);setMode("phq");},style:{cursor:"pointer",borderLeft:"4px solid "+T.teal}},
        ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
          ce("div",null,
            ce("div",{style:{fontWeight:700,fontSize:14,color:T.teal}},"💚 情緒健康快篩(PHQ-4)"),
            ce("div",{style:{fontSize:12,color:T.muted,marginTop:3}},"4題 · 2分鐘 · 焦慮+憂鬱兩面向 · +5積分")),
          lastPHQ&&ce(LBadge,{k:lastPHQ.level}))),
      ce(Card,{onClick:function(){setPssAns([]);setMode("pss");},style:{cursor:"pointer",borderLeft:"4px solid "+T.amber}},
        ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
          ce("div",null,
            ce("div",{style:{fontWeight:700,fontSize:14,color:T.amber}},"🧘 職場壓力評估(PSS-4)"),
            ce("div",{style:{fontSize:12,color:T.muted,marginTop:3}},"4題 · 3分鐘 · 每月一次 · +10積分")),
          lastPSS&&ce(LBadge,{k:lastPSS.level}))),
      ce(Card,{onClick:function(){setMindAns([]);setMode("mind");},style:{cursor:"pointer",borderLeft:"4px solid "+T.navy}},
        ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
          ce("div",null,
            ce("div",{style:{fontWeight:700,fontSize:14,color:T.navy}},"🍃 正念覺察自評"),
            ce("div",{style:{fontSize:12,color:T.muted,marginTop:3}},"3題 · 1分鐘 · 快速自評 · +5積分")),
          lastMind&&ce(LBadge,{k:lastMind.level}))),
      history.length>0&&ce(Card,null,
        ce(SecTitle,null,"最近評估記錄"),
        ce("div",{style:{display:"grid",gap:6}},
          history.slice(0,5).map(function(h){
            var lx=LX[h.level]||LX.green;
            var typeLabel=h.type==="phq4"?"PHQ-4":h.type==="pss4"?"PSS-4":"正念自評";
            return ce("div",{key:h.ts,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid "+T.border}},
              ce("div",null,
                ce("span",{style:{fontSize:12,color:T.muted}},h.ts.slice(0,10)+" · "),
                ce("span",{style:{fontSize:12,fontWeight:600,color:T.text}},typeLabel)),
              ce("div",{style:{display:"flex",alignItems:"center",gap:8}},
                ce("span",{style:{fontSize:14,fontWeight:700,color:lx.c}},h.score),
                ce(LBadge,{k:h.level})));
          })))));
}


export default function App(){
  useArtifactExportButton({
    source:"main",version:"v10.3.34",
    exact:["rpts","prs","reibi_orgs","subs","l5_enterprises","l5_invoices","l5_remit_index","l5_appt_index","l5_change_req_index","l5_health_agg_index"],
    prefixes:["pts_","ci_","th_","appt_","org_","svc_","osh_cnt_","setup_","dept_struct_","params_","remit_","change_req_","sleep_diary_","sleep_diary_today_","pain_diary_","pain_diary_today_","ow_hist_","ow_schedule_","ow_tracklist_","ow_int_","ow_roster_","ohs_hazards_","ohs_measures_","ohs_reviews_","ohs_meta_","msk_hist_","bsrs5_hist_","viol_hist_","mental_hist_","org_th_","org_th_dept_","l5_health_agg_","feedback_list:"],
    orgPrefixes:["appt_","org_","svc_","setup_","dept_struct_","params_","remit_","change_req_","ow_schedule_","ow_tracklist_","ow_int_","ow_roster_","ohs_hazards_","ohs_measures_","ohs_reviews_","ohs_meta_","org_th_","org_th_dept_","l5_health_agg_"],
    userPrefixes:["pts_","ci_","th_","sleep_diary_","sleep_diary_today_","pain_diary_","pain_diary_today_","ow_hist_","msk_hist_","bsrs5_hist_","viol_hist_","mental_hist_","feedback_list:"],
    indexes:[{key:"l5_remit_index",prefix:"remit_"},{key:"l5_appt_index",prefix:"appt_"},{key:"l5_change_req_index",prefix:"change_req_"},{key:"l5_health_agg_index",prefix:"l5_health_agg_"}]
  });
  const[sess,setSess]=useState(null);
  const[screen,setScreen]=useState("login");
  const[pts,setPts]=useState(0);
  const[rpts,setRpts]=useState([]);
  const[orgRecs,setOrgRecs]=useState([]);
  const[orgTH,setOrgTH]=useState(null);
  const[vr,setVr]=useState(null);
  const[loaded,setLoaded]=useState(false);
  const[toast,setToast]=useState("");
  const[orgParams,setOrgParams]=useState(DEFAULT_PARAMS);
  const[mySub,setMySub]=useState(null);

  useEffect(()=>{
    DB.sess().then(async s=>{
      if(s){
        setSess(s);setScreen("home");
        DB.pts(s.uid).then(p=>setPts(p||0));
        DB.rpts().then(r=>setRpts(r||[]));
        if(s.memberCode){DB.findSub(s.memberCode).then(function(sub){setMySub(sub);});}
        if(s.orgCode){
        DB.orgRecs(s.orgCode).then(r=>setOrgRecs(r||[]));
        DB.getParams(s.orgCode).then(p=>setOrgParams(p||DEFAULT_PARAMS));
        stor.g("org_th_"+s.orgCode.replace(/\W/g,"_")).then(function(d){if(d)setOrgTH(JSON.parse(d));});
      }
      }
      setLoaded(true);
    });
  },[]);

  const doLogin=async(s)=>{
    await DB.saveSess(s);setSess(s);
    const p=await DB.pts(s.uid)||0;setPts(p);
    const r=await DB.rpts()||[];setRpts(r);
    if(s.memberCode){const sub=await DB.findSub(s.memberCode);setMySub(sub);}else{setMySub(null);}
    if(s.orgCode){
      const or=await DB.orgRecs(s.orgCode)||[];setOrgRecs(or);
      const prm=await DB.getParams(s.orgCode)||DEFAULT_PARAMS;setOrgParams(prm);
      stor.g("org_th_"+s.orgCode.replace(/\W/g,"_")).then(function(d){if(d)setOrgTH(JSON.parse(d));});
      // 登記uid到組織成員清單(供三高組織彙整使用)
      const membKey="org_members_"+s.orgCode.replace(/\W/g,"_");
      const membRaw=await stor.g(membKey);
      const membList=membRaw?JSON.parse(membRaw):[];
      if(membList.indexOf(s.uid)<0){
        membList.push(s.uid);
        if(membList.length>500)membList.splice(0,membList.length-500);
        await stor.s(membKey,JSON.stringify(membList));
      }
    }
    setScreen("home");setToast("登入成功，歡迎 "+s.name);
    AL.rec("SESSION_START",s.role,s.name);
  };
  // v10.3.22新增：個人訂閱綁定memberCode到目前session並持久化(方向B階段1)
  const onUpdateSess=async(patch)=>{
    const updated=Object.assign({},sess,patch);
    await DB.saveSess(updated);
    setSess(updated);
  };
  const doLogout=async()=>{
    AL.rec("LOGOUT",(sess&&sess.role)||"",(sess&&sess.name)||"");
    await DB.clearSess();setSess(null);setScreen("login");setPts(0);setRpts([]);setOrgRecs([]);setMySub(null);
  };
  // 背景MHI彙整：每次管理者進入分析頁面時，計算當前個人MHI並附加到org_最新記錄
  const MGMT_SCREENS=["kpi","plan888","gri","rpt_esg","rpt_okr","rpt_hr","rpt_overwork","annualstats","deptrend"];
  const bgAggMHI=useCallback(async function(s){
    if(!s||!s.orgCode||!s.uid)return;
    if(!canDo(s.role,"submit_org"))return;
    try{
      var mentalRaw=await stor.g("mental_hist_"+s.uid);
      if(!mentalRaw)return;
      var mentalHist=JSON.parse(mentalRaw);
      var lastPHQ=mentalHist.find(function(h){return h.type==="phq4";});
      var lastPSS=mentalHist.find(function(h){return h.type==="pss4";});
      var lastMind=mentalHist.find(function(h){return h.type==="mind3";});
      var parts=[];
      if(lastPHQ)parts.push(Math.max(0,100-Math.round((lastPHQ.score/12)*100)));
      if(lastPSS)parts.push(Math.max(0,100-Math.round((lastPSS.score/16)*100)));
      if(lastMind)parts.push(Math.round((lastMind.score/9)*100));
      if(!parts.length)return;
      var mhiScore=Math.round(parts.reduce(function(a,b){return a+b;},0)/parts.length);
      var orgRaw=await DB.orgRecs(s.orgCode);
      var recs=orgRaw||[];
      if(!recs.length)return;
      // upsert：更新最近一筆(若最近7天內有記錄)
      var recent=recs[0];
      var ageMs=new Date()-new Date(recent.ts||0);
      var phqNorm=lastPHQ?Math.max(0,100-Math.round((lastPHQ.score/12)*100)):null;
      var pssNorm=lastPSS?Math.max(0,100-Math.round((lastPSS.score/16)*100)):null;
      var mindNorm=lastMind?Math.round((lastMind.score/9)*100):null;
      var mhiLv=mhiScore>=75?"green":mhiScore>=50?"yellow":mhiScore>=30?"orange":"red";
      if(ageMs<7*24*60*60*1000){
        recs[0]=Object.assign({},recs[0],{mhiScore:mhiScore,mhiLevel:mhiLv,
          phqNorm:phqNorm,pssNorm:pssNorm,mindNorm:mindNorm,
          mhiTs:new Date().toISOString()});
        await stor.s("org_"+s.orgCode,recs);
        setOrgRecs(recs.slice());
      }
      // 同步計算並寫入l5_health_agg_{orgCode}(供L5跨企業整合分析讀取)
      var n=recs.length;
      if(n>=5){
        var sleepScores=recs.filter(function(r){return typeof r.sScore==="number";});
        var painScores=recs.filter(function(r){return typeof r.pScore==="number";});
        var mhiScores=recs.filter(function(r){return typeof r.mhiScore==="number";});
        var greenRate=function(list,key){return list.length?Math.round(list.filter(function(r){return r[key]==="green";}).length/list.length*100):null;};
        var avg=function(list,key){return list.length?Math.round(list.reduce(function(a,r){return a+(r[key]||0);},0)/list.length):null;};
        var agg={
          orgCode:s.orgCode,n:n,updatedAt:new Date().toISOString(),
          sleepAvg:avg(sleepScores,"sScore"),sleepGreenRate:greenRate(recs,"sKey"),
          painAvg:avg(painScores,"pScore"),painGreenRate:greenRate(recs,"pKey"),
          mhiAvg:mhiScores.length>=5?avg(mhiScores,"mhiScore"):null,
          mhiN:mhiScores.length,
          phqAvg:mhiScores.length>=5?avg(mhiScores.filter(function(r){return r.phqNorm!=null;}),"phqNorm"):null,
          pssAvg:mhiScores.length>=5?avg(mhiScores.filter(function(r){return r.pssNorm!=null;}),"pssNorm"):null,
          mindAvg:mhiScores.length>=5?avg(mhiScores.filter(function(r){return r.mindNorm!=null;}),"mindNorm"):null,
          // 正規化0-100(越高越好)
          sleepNorm:sleepScores.length?Math.round(100-avg(sleepScores,"sScore")/28*100):null,
          painNorm:painScores.length?Math.round(100-avg(painScores,"pScore")/50*100):null
        };
        var aggKey="l5_health_agg_"+s.orgCode.replace(/\W/g,"_");
        await stor.s(aggKey,JSON.stringify(agg));
        // 更新索引
        var idxRaw=await stor.g("l5_health_agg_index");
        var idx=idxRaw?JSON.parse(idxRaw):[];
        if(idx.indexOf(s.orgCode)<0){idx.push(s.orgCode);await stor.s("l5_health_agg_index",JSON.stringify(idx));}
      }
    }catch(e){}
  },[]);

  const nav=useCallback(function(s){
    if(s==="logout"){doLogout();return;}
    setScreen(s);
    if(MGMT_SCREENS.indexOf(s)>=0&&sess)bgAggMHI(sess);
  },[sess]);
  const[prefillVenue,setPrefillVenue]=useState(null);
  const navToAppt=useCallback((venueName)=>{setPrefillVenue(venueName);setScreen("appt");},[]);
  const onAC=(r,np)=>{setRpts(p=>[r,...p]);setVr(r);setPts(np);setScreen("result");};

  if(!loaded)return ce("div",{style:{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center"}},ce("div",{style:{textAlign:"center"}},ce("div",{style:{fontSize:48,marginBottom:12}},"🌿"),ce("p",{style:{color:T.muted}},"載入中...")));
  if(!sess||screen==="login")return ce(LoginScreen,{onLogin:doLogin,onForgotPin:()=>setScreen("forgotpin")});
  if(screen==="forgotpin")return ce(ForgotPin,{onBack:()=>setScreen("login")});

  const rptScreens={
    rpt_esg:{title:"🌱 ESG健康效益報告(企業永續/人力資本健康/降本增效/社會責任利基點)",type:"esg"},
    rpt_okr:{title:"🎯 OKR績效報告",type:"okr"},
    rpt_hr:{title:"⚠ 高風險族群分析",type:"highrisk"},
    rpt_kpi:{title:"📊 KPI三大指標報告",type:"kpi"},
    rpt_roi:{title:"💰 ROI財務效益報告",type:"roi"},
    rpt_888:{title:"📋 888計畫完整報告",type:"plan888"},
    rpt_gri:{title:"📋 GRI 403-6 AI完整報告",type:"gri"},
  };
  const rm=rptScreens[screen];
  // v10.3.22新增：個人訂閱功能閘門(僅限L1個人用戶，企業員工功能由企業合約決定，不受此限制)
  const isPro=sess&&(sess.role!=="individual"||(mySub&&effectiveSubStatus(mySub)==="active"));
  const onSubChange=(sub)=>{setMySub(sub);};

  return ce("div",{style:{fontFamily:"system-ui,'Noto Sans TC',sans-serif",color:T.text,minHeight:"100vh",background:T.bg}},
    ce(Toast,{msg:toast,onDone:()=>setToast("")}),
    ce(TopBanner),
    ce(NavBar,{session:sess,onNav:nav,pts}),
    screen==="home"&&ce(HomeDashboard,{session:sess,pts,onNav:nav,reports:rpts,mySub}),
    screen==="assess"&&ce(AssessWizard,{session:sess,onBack:()=>nav("home"),onComplete:onAC}),
    screen==="result"&&vr&&ce(ResultScreen,{report:vr,session:sess,pts,onBack:()=>nav("home"),onNav:nav}),
    screen==="personal_report"&&ce(PersonalReportScreen,{report:vr||rpts[0],session:sess,onBack:()=>nav(vr?"result":"home"),allReports:rpts,onNav:nav,isPro}),
    screen==="history"&&ce(HistoryScreen,{reports:rpts,onBack:()=>nav("home"),onView:r=>{setVr(r);nav("result");},session:sess,isPro,onNav:nav}),
    screen==="checkin"&&ce(CheckinScreen,{session:sess,onBack:()=>nav("home"),onPtsChange:setPts}),
    screen==="th"&&ce(ThreeHighsScreen,{session:sess,onBack:()=>nav("home"),onPtsChange:setPts,orgRecs}),
    screen==="points"&&ce(PointsScreen,{pts,onBack:()=>nav("home")}),
    screen==="appt"&&ce(ApptScreen,{session:sess,onBack:()=>nav("home"),prefillVenue:prefillVenue,onPrefillUsed:()=>setPrefillVenue(null),isPro}),
    screen==="acc_limit"&&ce(AccLimitScreen,{session:sess,onBack:()=>nav("home")}),
    screen==="oh_setup"&&ce(OHSetupScreen,{session:sess,onBack:()=>nav("home")}),
    screen==="dept_mgmt"&&ce(DeptMgmtScreen,{session:sess,onBack:()=>nav("home")}),
    screen==="industry"&&ce(IndustryScreen,{session:sess,onBack:()=>nav("home")}),
    screen==="service"&&ce(ServiceScreen,{session:sess,onBack:()=>nav("home")}),
    screen==="change_req"&&ce(ChangeRequestScreen,{session:sess,onBack:()=>nav("home")}),
    screen==="payable"&&ce(PayableScreen,{session:sess,onBack:function(target){if(target==="remittance")nav("remit");else nav("home");}}),
    screen==="remit"&&ce(RemittanceUploadScreen,{session:sess,onBack:()=>nav("home")}),
    screen==="eap"&&ce(EAPScreen,{session:sess,onBack:()=>nav("home"),onNav:nav}),
    screen==="kpi"&&ce(KPIScreen,{onBack:()=>nav("home"),orgRecs}),
    screen==="plan888"&&ce(Plan888Screen,{onBack:()=>nav("home"),orgRecs,orgTH}),
    screen==="audit"&&ce(AuditScreen,{onBack:()=>nav("home")}),
    screen==="params"&&ce(ParamsScreen,{session:sess,onBack:()=>nav("home")}),
    screen==="annual"&&ce(AnnualStatsScreen,{session:sess,onBack:()=>nav("home"),orgRecs}),
    screen==="l5admin"&&ce(L5AdminScreen,{onBack:()=>nav("home"),onNav:nav}),
    screen==="pinreset"&&ce(L5AdminScreen,{onBack:()=>nav("home"),onNav:nav}),
    rm&&ce(AIReportScreen,{onBack:()=>nav("home"),orgRecs,title:rm.title,reportType:rm.type,params:orgParams}),
    screen==="security_doc"&&ce(SecurityDocScreen,{onBack:()=>nav("home")}),
    screen==="pricing"&&ce(PricingScreen,{onBack:()=>nav("home")}),
    screen==="privacy"&&ce(PrivacyScreen,{session:sess,onBack:()=>nav("home")}),
    screen==="subscribe"&&ce(SubscribeScreen,{session:sess,onBack:()=>nav("home"),onUpdateSess,mySub,onSubChange}),
    screen==="gri_report"&&ce(GRIScreen,{onBack:()=>nav("home"),orgRecs,params:orgParams}),
    screen==="sleep_diary"&&ce(SleepDiaryScreen,{session:sess,onBack:()=>nav("home"),onPtsChange:setPts}),
    screen==="pain_diary"&&ce(PainDiaryScreen,{session:sess,onBack:()=>nav("home"),onPtsChange:setPts}),
    screen==="mental"&&ce(MentalWellnessScreen,{session:sess,onBack:()=>nav("home"),onPtsChange:setPts}),
    screen==="overwork"&&ce(OverworkScreen,{session:sess,onBack:()=>nav("home"),onNav:nav,onPtsChange:setPts,orgRecs}),
    screen==="overwork_hr"&&ce(OverworkHRScreen,{session:sess,onBack:()=>nav("home"),orgRecs,orgTH}),
    screen==="ohs_plan"&&ce(OHSPlanScreen,{session:sess,onBack:()=>nav("home"),orgRecs,orgTH}),
    screen==="oh_interview"&&ce(OHInterviewScreen,{session:sess,onBack:()=>nav("home")}),
    screen==="osh_hub"&&ce(OSHHubScreen,{session:sess,onBack:()=>nav("home"),onNav:nav}),
    screen==="osh_activity"&&ce(OSHActivityScreen,{session:sess,onBack:()=>nav("home")}),
    screen==="msk"&&ce(MSKScreen,{session:sess,onBack:()=>nav("home"),onPtsChange:setPts}),
    screen==="bsrs5"&&ce(BSRSScreen,{session:sess,onBack:()=>nav("home"),onPtsChange:setPts}),
    screen==="violence"&&ce(ViolenceScreen,{session:sess,onBack:()=>nav("home"),onPtsChange:setPts}),
    screen==="feedback"&&ce(FeedbackScreen,{session:sess,onBack:()=>nav("home"),reports:rpts,onPtsChange:setPts}),
    screen==="feedback_report"&&ce(FeedbackReportScreen,{session:sess,onBack:()=>nav("home")}),
    screen==="about_reibi"&&ce(AboutREIBIScreen,{session:sess,onBack:()=>nav("home")}),
    screen==="venue"&&ce(VenueScreen,{session:sess,onBack:()=>nav("home"),onBookAppt:navToAppt}),
    screen==="plan888_timeline"&&ce(Plan888TimelineScreen,{onBack:()=>nav("home"),orgRecs}),
    screen==="curve888"&&ce(Curve888Screen,{session:sess,onBack:()=>nav("home"),reports:rpts}),
    screen==="dept_trend"&&ce(DeptTrendScreen,{session:sess,onBack:()=>nav("home"),orgRecs})
  );
}
