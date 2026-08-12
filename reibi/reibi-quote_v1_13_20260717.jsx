import React,{useState,useEffect}from"react";
const ce=React.createElement;

// ── DESIGN TOKENS ─────────────────────────────────────────────────────────────
const T={
  bg:"#f8f9fa",card:"#ffffff",border:"#dee2e6",
  teal:"#0f766e",tealBg:"#f0fdfa",tealLight:"#99f6e4",
  amber:"#b45309",amberBg:"#fffbeb",
  sage:"#166534",sageBg:"#f0fdf4",
  coral:"#be123c",coralBg:"#fff1f2",
  plum:"#6d28d9",plumBg:"#f5f3ff",
  navy:"#1e3a5f",navyBg:"#eff6ff",
  gold:"#92400e",goldBg:"#fef3c7",
  green:"#15803d",greenBg:"#f0fdf4",
  text:"#1e293b",muted:"#64748b",faint:"#94a3b8",
  red:"#dc2626",redBg:"#fef2f2",
  sh:"0 2px 12px rgba(15,118,110,.08)",
  sh2:"0 4px 24px rgba(15,118,110,.12)"
};

// -- PRICING DATA (機密：底價65折僅內部計算，對外不顯示) ─────────────────────
var PRICING={
  A:{
    tiers:[
      {max:100,label:"≤100人",annual:600000,note:"基本型"},
      {max:300,label:"101-300人",annual:1200000,note:"成長型"},
      {max:500,label:"301-500人",annual:1800000,note:"專業型"},
      {max:1000,label:"501-1000人",annual:3000000,note:"旗艦型"},
      {max:99999,label:"1000人+",annual:0,note:"客製議定"}
    ],
    payDiscount:{annual:0.95,semi:1.0,quarterly:1.03}
  },
  B:{
    bed:{name:"舒曼波雲朵床(7.83Hz，無加熱，無需預熱)",price:800000,floor:520000},
    chair:{name:"舒曼波樂活電動椅(7.83Hz)",price:750000,floor:487500},
    la200:{name:"UIS·REIBI LA200光能緩解疼痛體驗設備(660-808nm LLLT)",price:149400,floor:97110},
    bundles:[
      {name:"基本型 ≤100人",bed:1,chair:1,la200:1,total:1699400},
      {name:"成長型 101-300人",bed:2,chair:2,la200:2,total:3398800},
      {name:"專業型 301-500人",bed:3,chair:3,la200:3,total:5098200},
      {name:"旗艦型 501-1000人",bed:5,chair:5,la200:5,total:8497000},
      {name:"定制型 1000人+",bed:0,chair:0,la200:0,total:0}
    ]
  },
  C:{
    tiers:[
      {name:"基本型",execs:5,annual:35000,days:1},
      {name:"成長型",execs:10,annual:70000,days:1},
      {name:"專業型",execs:15,annual:105000,days:2},
      {name:"旗艦型",execs:30,annual:210000,days:4}
    ],
    highRisk:{price:14000,note:"高風險高管(連續橙/紅燈)半年一次"}
  },
  E:{
    warranty:{
      bed:{name:"雲朵床設備延保",rateMin:0.05,rateMax:0.10,note:"設備原價5-10%/年，第4年起適用"},
      chair:{name:"樂活椅設備延保",rateMin:0.05,rateMax:0.10,note:"設備原價5-10%/年，第4年起適用"},
      la200:{name:"LA200設備延保",rateMin:0.05,rateMax:0.10,note:"設備原價5-10%/年，第4年起適用"}
    },
    valueAdded:[
      {key:"annual_report",name:"年度健康加值報告",note:"成長型以上包含；基本型選購",price:30000},
      {key:"industry_white",name:"產業健康白皮書(企業版)",note:"去識別化數據企業專屬分析",price:50000},
      {key:"esg_report",name:"ESG健促揭露報告",note:"GRI 403-6格式，可直接引用永續報告書",price:40000},
      {key:"hr_consult",name:"年度HR健促顧問諮詢(4次)",note:"策略規劃+OKR設定+年度回顧",price:80000}
    ],
    cpiCap:0.05
  },
  D:{
    items:[
      {key:"poster",name:"基礎海報套組(ISI/BPI/888計畫，A2×6張)",min:15000,max:30000,days:"5-7工作日"},
      {key:"board",name:"健促公告欄設計(含888計畫/IDG/Ottawa Charter視覺化)",min:25000,max:50000,days:"7-10工作日"},
      {key:"display",name:"設備展示區佈置(說明牌+體驗區動線)",min:20000,max:40000,days:"含B層設備安裝同期"},
      {key:"qr",name:"QR Code貼紙組(防水霧面材質)",min:5000,max:10000,days:"3工作日"},
      {key:"digital",name:"數位看板內容(10-15張MP4，含後續更新)",min:30000,max:60000,days:"10-14工作日"},
      {key:"install",name:"現場佈置施工(張貼固定陳列，含差旅費)",min:10000,max:25000,days:"1-2天"}
    ],
    bundles:[
      {name:"基礎型",keys:["poster","qr"],min:20000,max:40000},
      {name:"標準型",keys:["poster","qr","board","install"],min:60000,max:120000},
      {name:"完整型",keys:["poster","qr","board","display","digital","install"],min:100000,max:200000}
    ],
    payment:"50%訂金 → 50%完工驗收"
  }
};

// v1.11新增：經銷商分潤等級表，抽成共用常數。原本只有「合作條件」步驟頁內嵌陣列這一份複製顯示用資料，
// 本次新增正式報價單列印文件也需要顯示同樣的表格，若各自寫一份會變成第三份「靜態複製」，跟l5.jsx更難同步(見錯誤AF)。
// ⚠️【COMM_TIERS_SYNC_v1｜2026-07-17】仍是靜態複製，唯一權威來源是l5.jsx的L5_COMM_LEVELS(決定實際
// 分潤金額的soft/device/exec %數值)，l5端數值調整時這裡仍需手動同步——但因Claude.ai artifact間storage
// 互相隔離，無法真正共用同一份JS物件，只能靠v1.13起改用「跟l5.jsx完全相同的鍵名結構」降低同步出錯機率：
// 物件(非陣列)，key=等級id(silver/gold/platinum/strategic)，值={l,threshold,soft,device,exec}，
// soft/device/exec為數字(不含%字元，畫面渲染時自行補"%")。l5.jsx異動L5_COMM_LEVELS時可整段Object複製
// 貼上到這裡，不需要再手動改鍵名或拆解百分比字串。threshold文字為對外正式文件用語，容許跟l5.jsx內部
// 管理頁措辭不同，但代表的數字門檻(800萬/2000萬/5000萬)必須一致。兩邊COMM_TIERS_SYNC_v1後的日期
// 標記務必同步更新為同一天，日期不同=尚未同步完成。
var DIST_COMM_TIERS={
  silver:{l:"🥈 銀牌",threshold:"首筆起",soft:8,device:10,exec:5},
  gold:{l:"🥇 金牌",threshold:"年累積≥800萬",soft:14,device:15,exec:8},
  platinum:{l:"🏆 白金",threshold:"年累積≥2000萬",soft:20,device:20,exec:12},
  strategic:{l:"⭐ 戰略",threshold:"年累積≥5000萬",soft:28,device:28,exec:18}
};

// ── DOC NUMBER GENERATOR ───────────────────────────────────────────────────────
var genDocNo=function(type,seq){
  var y=new Date().getFullYear().toString().slice(2);
  var m=String(new Date().getMonth()+1).padStart(2,"0");
  var s=String(seq||Math.floor(Math.random()*900)+100).padStart(3,"0");
  return type+"-"+y+m+"-"+s;
};
// v1.12新增：docNo流水號化，比照l5.jsx v2.12的nextSeqNum做法。seq若未提供，genDocNo仍會退回舊的隨機3碼(僅作保險，
// 正常呼叫都應搭配本函數算好的seq)。依「type前綴+年月」掃描既有清單(rq_quotes或rq_contracts)算出下一號，
// type內含特殊字元(如補充合約的"AD-"+原合約編號)一併處理，故先做正規表示式跳脫。
var nextDocSeq=function(list,type,ym){
  var max=0;
  var esc=type.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  var re=new RegExp("^"+esc+"-"+ym+"-(\\d{3,})$");
  (list||[]).forEach(function(o){
    var no=o&&o.docNo;
    if(!no)return;
    var m2=no.match(re);
    if(m2){var n=parseInt(m2[1],10);if(n>max)max=n;}
  });
  return String(max+1).padStart(3,"0");
};
var curYM=function(){
  return new Date().getFullYear().toString().slice(2)+String(new Date().getMonth()+1).padStart(2,"0");
};

// ── STORAGE ────────────────────────────────────────────────────────────────────
var stor={
  g:async function(k){try{var r=await window.storage.get(k);return r?r.value:null;}catch(e){return null;}},
  s:async function(k,v){try{await window.storage.set(k,typeof v==="string"?v:JSON.stringify(v));}catch(e){}},
  d:async function(k){try{await window.storage.delete(k);}catch(e){}}
};

// ── BATCH G：版本化搬移匯出 ─────────────────────────────────────────────────
function useArtifactExportButton(config){
  useEffect(function(){
    var button=document.createElement("button");
    button.textContent="匯出搬移資料";
    Object.assign(button.style,{position:"fixed",right:"18px",bottom:"18px",zIndex:"99999",border:"0",borderRadius:"999px",padding:"11px 17px",background:"#0f766e",color:"white",fontWeight:"800",boxShadow:"0 6px 22px rgba(15,23,42,.25)",cursor:"pointer"});
    button.onclick=async function(){
      button.disabled=true;button.textContent="整理資料中…";
      try{await exportArtifactData(config);}catch(error){alert("匯出失敗："+(error&&error.message?error.message:String(error)));}
      finally{button.disabled=false;button.textContent="匯出搬移資料";}
    };
    document.body.appendChild(button);
    return function(){button.remove();};
  },[]);
}
function stableExportJson(value){
  if(Array.isArray(value))return "["+value.map(stableExportJson).join(",")+"]";
  if(value&&typeof value==="object")return "{"+Object.keys(value).sort().map(function(key){return JSON.stringify(key)+":"+stableExportJson(value[key]);}).join(",")+"}";
  return JSON.stringify(value);
}
async function exportSha256(text){
  var digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map(function(byte){return byte.toString(16).padStart(2,"0");}).join("");
}
function exportKeyAllowed(key,config){
  var lower=String(key).toLowerCase();
  if(["sess","pin_","rc_","lk_","rem_","token","l5_session","rq_session","l5_active_context","l5_pin_","__rq_handoff_"].some(function(prefix){return lower===prefix||lower.indexOf(prefix)===0;}))return false;
  return config.exact.indexOf(key)>=0||config.prefixes.some(function(prefix){return key.indexOf(prefix)===0;});
}
function sanitizeExportValue(value){
  if(Array.isArray(value))return value.map(sanitizeExportValue);
  if(!value||typeof value!=="object")return value;
  var clean={};Object.keys(value).forEach(function(key){var compact=String(key).replace(/_/g,"").toLowerCase();if(["password","secret","token","pin","backupcode","activationcode","imgfull","imgthumb","imagebase64"].some(function(fragment){return compact.indexOf(fragment)>=0;}))return;clean[key]=sanitizeExportValue(value[key]);});return clean;
}
async function exportArtifactData(config){
  var keys=new Set(config.exact), discovered=[];
  if(window.storage&&typeof window.storage.list==="function"){
    try{var listed=await window.storage.list();discovered=Array.isArray(listed)?listed:(listed&&listed.keys)||[];}catch(error){}
  }
  discovered.forEach(function(item){var key=typeof item==="string"?item:item&&item.key;if(key&&exportKeyAllowed(key,config))keys.add(key);});
  var entries=[];
  for(var key of keys){
    if(!exportKeyAllowed(key,config))continue;
    var result=await window.storage.get(key).catch(function(){return null;});
    if(!result||result.value==null)continue;
    var value=result.value;try{value=JSON.parse(value);}catch(error){}
    entries.push({storage_key:key,value:sanitizeExportValue(value)});
  }
  if(!entries.length)throw new Error("找不到可搬移資料");
  var chunks=[],current=[],bytes=0,limit=7.5*1024*1024;
  entries.forEach(function(entry){var size=new TextEncoder().encode(stableExportJson(entry)).length;if(current.length&&(bytes+size>limit||current.length>=5000)){chunks.push(current);current=[];bytes=0;}current.push(entry);bytes+=size;});
  if(current.length)chunks.push(current);
  var stamp=new Date().toISOString();
  for(var index=0;index<chunks.length;index++){
    var envelope={schema_version:"reibi-artifact-export/1.0",source_artifact:config.source,source_version:config.version,exported_at:stamp,part:index+1,parts:chunks.length,entries:chunks[index]};
    envelope.export_sha256=await exportSha256(stableExportJson(envelope));
    var blob=new Blob([JSON.stringify(envelope,null,2)],{type:"application/json;charset=utf-8"}),url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;link.download="reibi-"+config.source+"-"+stamp.slice(0,10)+"-part"+(index+1)+"of"+chunks.length+".json";link.click();URL.revokeObjectURL(url);
  }
  alert("匯出完成："+entries.length+" 個 storage keys，共 "+chunks.length+" 個檔案。請妥善保管 JSON 與匯出前筆數截圖。");
}

// ── UI PRIMITIVES ──────────────────────────────────────────────────────────────
function Btn(props){
  var v=props.v||"primary",sz=props.sz||"md",sx=props.style||{};
  var sizes={sm:{padding:"5px 12px",fontSize:11},md:{padding:"9px 18px",fontSize:13},lg:{padding:"12px 24px",fontSize:14}};
  var vars={
    primary:{background:T.teal,color:"#fff",border:"none"},
    sage:{background:T.sageBg,color:T.sage,border:"1px solid #86efac"},
    amber:{background:T.amberBg,color:T.amber,border:"1px solid #fcd34d"},
    ghost:{background:"transparent",color:T.muted,border:"1px solid "+T.border},
    danger:{background:T.redBg,color:T.red,border:"1px solid #fca5a5"},
    plum:{background:T.plumBg,color:T.plum,border:"1px solid #c4b5fd"},
    navy:{background:T.navyBg,color:T.navy,border:"1px solid #93c5fd"},
    gold:{background:T.goldBg,color:T.gold,border:"1px solid #fcd34d"}
  };
  return ce("button",{onClick:props.disabled?undefined:props.onClick,
    style:Object.assign({},{borderRadius:8,cursor:props.disabled?"not-allowed":"pointer",fontWeight:600,fontFamily:"inherit",opacity:props.disabled?.5:1},
      props.full?{width:"100%",display:"block"}:{},sizes[sz]||sizes.md,vars[v]||vars.primary,sx)},props.children);
}
function Card(props){
  return ce("div",{className:props.className,onClick:props.onClick,style:Object.assign({},{background:T.card,border:"1px solid "+T.border,borderRadius:12,padding:18,boxShadow:T.sh},props.onClick?{cursor:"pointer"}:{},props.style||{})},props.children);
}
function IBox(props){
  var cols={teal:{background:T.tealBg,border:"1px solid "+T.tealLight,color:T.teal},amber:{background:T.amberBg,border:"1px solid #fcd34d",color:T.amber},red:{background:T.redBg,border:"1px solid #fca5a5",color:T.red},sage:{background:T.sageBg,border:"1px solid #86efac",color:T.sage},navy:{background:T.navyBg,border:"1px solid #93c5fd",color:T.navy},plum:{background:T.plumBg,border:"1px solid #c4b5fd",color:T.plum}};
  return ce("div",{style:Object.assign({},{borderRadius:8,padding:"10px 14px",fontSize:12,lineHeight:1.7},cols[props.c||"teal"]||cols.teal,props.style||{})},props.children);
}
function Tag(props){
  var m={teal:{bg:T.tealBg,c:T.teal},sage:{bg:T.sageBg,c:T.sage},amber:{bg:T.amberBg,c:T.amber},plum:{bg:T.plumBg,c:T.plum},red:{bg:T.redBg,c:T.red},gray:{bg:"#f1f5f9",c:T.muted},navy:{bg:T.navyBg,c:T.navy},gold:{bg:T.goldBg,c:T.gold}};
  var s=m[props.c||"teal"]||m.teal;
  return ce("span",{style:{display:"inline-block",padding:"2px 9px",borderRadius:20,fontSize:11,fontWeight:700,background:s.bg,color:s.c}},props.children);
}
function Inp(props){
  return ce("div",{style:props.style||{}},
    props.label&&ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4,fontWeight:600}},props.label),
    ce("input",{type:props.type||"text",value:props.value,onChange:props.onChange,placeholder:props.placeholder||"",
      style:{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box",color:T.text,outline:"none"}}));
}
function Sel(props){
  return ce("div",{style:props.style||{}},
    props.label&&ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4,fontWeight:600}},props.label),
    ce("select",{value:props.value,onChange:props.onChange,
      style:{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,color:T.text,background:T.card,outline:"none",boxSizing:"border-box"}},
      props.children));
}
function SecTitle(props){
  return ce("h3",{style:{fontSize:14,fontWeight:700,color:T.teal,marginBottom:12,marginTop:0,borderBottom:"2px solid "+T.tealLight,paddingBottom:6}},props.children);
}
function Toast(props){
  useEffect(function(){if(props.msg){var t=setTimeout(props.onDone,3000);return function(){clearTimeout(t);};};},[props.msg]);
  if(!props.msg)return null;
  return ce("div",{style:{background:T.text,color:"#fff",padding:"10px 22px",borderRadius:24,fontSize:13,fontWeight:600,textAlign:"center",margin:"8px auto 4px",maxWidth:460}},props.msg);
}
function Divider(){return ce("div",{style:{height:1,background:T.border,margin:"14px 0"}});}

// ── DOC STATUS BADGE ────────────────────────────────────────────────────────────
function StatusBadge(props){
  var m={
    "草稿":{bg:"#f1f5f9",c:T.muted},"已發送":{bg:T.navyBg,c:T.navy},
    "待確認":{bg:T.amberBg,c:T.amber},"已確認":{bg:T.sageBg,c:T.sage},
    "已轉合約":{bg:T.tealBg,c:T.teal},"作廢":{bg:T.redBg,c:T.red},
    "草稿(合約)":{bg:"#f1f5f9",c:T.muted},"待用印":{bg:T.amberBg,c:T.amber},
    "用印完成":{bg:T.sageBg,c:T.sage},"存檔":{bg:T.tealBg,c:T.teal},
    "執行中":{bg:T.greenBg,c:T.green},"已終止":{bg:T.redBg,c:T.red}
  };
  var s=m[props.status]||m["草稿"];
  return ce("span",{style:{padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700,background:s.bg,color:s.c}},props.status);
}

// ── DOC TYPE BADGE ─────────────────────────────────────────────────────────────
function TypeBadge(props){
  var m={
    "新案報價":{bg:T.tealBg,c:T.teal},"升級報價":{bg:T.amberBg,c:T.amber},
    "續約報價":{bg:T.sageBg,c:T.sage},"經銷商報價":{bg:T.navyBg,c:T.navy},
    "企業合約":{bg:T.tealBg,c:T.teal},"補充合約":{bg:T.amberBg,c:T.amber},
    "續約合約":{bg:T.sageBg,c:T.sage},"經銷商合約":{bg:T.navyBg,c:T.navy}
  };
  var s=m[props.type]||{bg:"#f1f5f9",c:T.muted};
  return ce("span",{style:{padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700,background:s.bg,color:s.c}},props.type);
}

// ── AMOUNT CALCULATOR ──────────────────────────────────────────────────────────
function calcAFee(memberCount,payMode){
  // v1.9修正錯誤AH：memberCount空白時，原本parseInt("")||0 => n=0，會被誤判進「≤100人」級距(0<=100)，
  // 導致QuickQuote/QuoteForm在使用者根本還沒輸入或選擇人數時，就已經算出NT$57.0萬的A層年費(基本型)並帶入試算總覽/儲存資料。
  // 空白視為「尚未輸入」，直接回傳0，不套用任何級距。
  if(memberCount===""||memberCount===null||memberCount===undefined)return{base:0,final:0,note:"尚未輸入人數"};
  var n=parseInt(memberCount)||0;
  var base=0;
  for(var i=0;i<PRICING.A.tiers.length;i++){
    if(n<=PRICING.A.tiers[i].max){base=PRICING.A.tiers[i].annual;break;}
  }
  if(base===0)return{base:0,final:0,note:"客製議定"};
  var disc=PRICING.A.payDiscount[payMode]||1.0;
  return{base:base,final:Math.round(base*disc),note:payMode==="annual"?"年繳享5%折扣":payMode==="quarterly"?"季繳含3%手續費":"半年繳"};
}

function calcUpgradeDiff(oldAnnual,newAnnual,upgradeDate,contractEnd){
  var diff=(newAnnual-oldAnnual)/12;
  var msLeft=new Date(contractEnd)-new Date(upgradeDate);
  var monthsLeft=Math.max(0,Math.ceil(msLeft/(1000*60*60*24*30)));
  return{monthDiff:Math.round(diff),monthsLeft:monthsLeft,supplement:Math.round(diff*monthsLeft)};
}

// ── HANDOFF HELPERS (跨系統資料交接) ────────────────────────────────────────────
var saveHandoff=async function(target,payload){
  var key="rq_handoff_"+target+"_"+Date.now();
  await stor.s(key,JSON.stringify(Object.assign({},payload,{_createdAt:new Date().toISOString()})));
  var idxKey="__rq_handoff_index_"+target;
  var idxRaw=await stor.g(idxKey);
  var idx=idxRaw?JSON.parse(idxRaw):[];
  idx.push(key);
  if(idx.length>20)idx=idx.slice(idx.length-20);
  await stor.s(idxKey,JSON.stringify(idx));
  return key;
};

// ── QUICK QUOTE (試算版面) ────────────────────────────────────────────────────
function QuickQuote(props){
  var onBack=props.onBack;
  var onConfirm=props.onConfirm;
  var session=props.session;
  var[toast,setToast]=useState("");

  var[clientName,setClientName]=useState("");
  var[contact,setContact]=useState("");
  var[phone,setPhone]=useState("");
  var[email,setEmail]=useState("");
  var[memberCount,setMemberCount]=useState("");
  var[payMode,setPayMode]=useState("annual");
  var[contractYears,setContractYears]=useState(3);
  var[discountPct,setDiscountPct]=useState("");

  var[bBed,setBBed]=useState(0);
  var[bChair,setBChair]=useState(0);
  var[bLA200,setBLA200]=useState(0);

  var[cTier,setCTier]=useState("");

  var[dPkg,setDPkg]=useState("");

  var[aOverride,setAOverride]=useState("");
  var[bOverride,setBOverride]=useState("");
  var[cOverride,setCOverride]=useState("");
  var[dOverride,setDOverride]=useState("");

  var applyTier=function(n){
    setMemberCount(String(n));
    var bb=PRICING.B.bundles.find(function(x){
      if(n<=100)return x.name.indexOf("基本型")===0;
      if(n<=300)return x.name.indexOf("成長型")===0;
      if(n<=500)return x.name.indexOf("專業型")===0;
      if(n<=1000)return x.name.indexOf("旗艦型")===0;
      return false;
    });
    if(bb){setBBed(bb.bed);setBChair(bb.chair);setBLA200(bb.la200);}
    var ct=PRICING.C.tiers.find(function(t){
      if(n<=100)return t.name==="基本型";
      if(n<=300)return t.name==="成長型";
      if(n<=500)return t.name==="專業型";
      if(n<=1000)return t.name==="旗艦型";
      return false;
    });
    if(ct)setCTier(ct.name);
  };

  var aCalc=calcAFee(memberCount,payMode);
  var discMulti=1-(Math.min(99,Math.max(0,parseFloat(discountPct)||0))/100);
  var aFeeBase=aOverride?(parseInt(aOverride)||0)*10000:Math.round(aCalc.final*discMulti);
  var bFeeBase=bOverride?(parseInt(bOverride)||0)*10000:Math.round((bBed*PRICING.B.bed.price+bChair*PRICING.B.chair.price+bLA200*PRICING.B.la200.price)*discMulti);
  var cTierData=PRICING.C.tiers.find(function(t){return t.name===cTier;});
  var cFeeBase=cOverride?(parseInt(cOverride)||0)*10000:Math.round((cTierData?cTierData.annual:0)*discMulti);
  var dBundle=PRICING.D.bundles.find(function(x){return x.name===dPkg;});
  var dFeeBase=dOverride?(parseInt(dOverride)||0)*10000:(dBundle?Math.round((dBundle.min+dBundle.max)/2*discMulti):0);

  var totalYearFee=aFeeBase+cFeeBase;
  var total3Year=totalYearFee*contractYears+bFeeBase+dFeeBase;

  // v1.10修正錯誤AI：原本驗證失敗只靠頁面最上方的Toast提示「請填入客戶名稱」，
  // 但此頁面內容很長，使用者通常已捲動到底部按鈕處，看不到頂部的Toast，誤以為按鈕「無反應」。
  // 改為同時在按鈕正上方顯示行內錯誤訊息，並保留原本的頂部Toast雙重提示。
  var[confirmErr,setConfirmErr]=useState("");
  var doConfirm=function(){
    if(!clientName.trim()){setToast("請填入客戶名稱");setConfirmErr("⚠️ 請先回到上方填入「客戶公司名稱」，才能轉為正式報價單");return;}
    setConfirmErr("");
    var preDoc={
      clientName,contact,phone,email,memberCount,
      payMode,contractYears,
      aCustom:String(Math.round(aFeeBase/10000*10)/10),
      bBed,bChair,bLA200,
      cTier,cCustomFee:cFeeBase>0?String(Math.round(cFeeBase/10000*10)/10):"",
      dNote:dPkg?("試算套組："+dPkg+"，估算NT$"+(dFeeBase/10000).toFixed(0)+"萬"):"",
      note:discountPct?("試算折數備註：折扣"+discountPct+"%"):"",
      _fromQuickQuote:true
    };
    if(onConfirm)onConfirm(preDoc);
  };

  return ce("div",{style:{display:"grid",gap:14}},
    ce(Toast,{msg:toast,onDone:function(){setToast("");}}),
    ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
      ce("button",{onClick:onBack,style:{background:"none",border:"none",cursor:"pointer",color:T.teal,fontSize:13,fontWeight:700,fontFamily:"inherit"}},"<- 返回"),
      ce(Tag,{c:"navy"},"試算模式")),
    ce(IBox,{c:"navy"},"快速試算ABCD四層費用。選擇方案級距後系統自動帶入模板價格，可調整折數或逐項手動覆寫。確認後可一鍵轉為正式報價單。"),

    ce(Card,null,
      ce(SecTitle,null,"客戶基本資料"),
      ce("div",{style:{display:"grid",gap:10}},
        ce(Inp,{label:"客戶公司名稱 *",value:clientName,onChange:function(e){setClientName(e.target.value);}}),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}},
          ce(Inp,{label:"聯絡人",value:contact,onChange:function(e){setContact(e.target.value);}}),
          ce(Inp,{label:"電話",value:phone,onChange:function(e){setPhone(e.target.value);}})),
        ce(Inp,{label:"Email",value:email,onChange:function(e){setEmail(e.target.value);}}))),

    ce(Card,null,
      ce(SecTitle,null,"方案級距快選"),
      ce("div",{style:{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}},
        // v1.9修正錯誤AH：原本按鈕數字(50/150/350/700)只是隨意示意值，跟PRICING.A.tiers實際定義的級距上限(100/300/500/1000)對不上，
        // 使用者反映「人數的級距不是我們原本預設的人數」。改為直接取PRICING.A.tiers前4階(排除1000人+客製議定階)，數字與標籤兩邊都跟權威定義同源。
        PRICING.A.tiers.filter(function(t){return t.max<99999;}).map(function(t){return{n:t.max,l:t.label+"("+t.note+")"};}).map(function(p){
          return ce("button",{key:p.n,onClick:function(){applyTier(p.n);},
            style:{padding:"6px 12px",borderRadius:16,border:"1px solid "+(memberCount===String(p.n)?T.teal:T.border),fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:memberCount===String(p.n)?T.teal:"transparent",color:memberCount===String(p.n)?"#fff":T.muted}},p.l);
        })),
      ce(Inp,{label:"或自行輸入人數",value:memberCount,type:"number",onChange:function(e){setMemberCount(e.target.value.replace(/[^0-9]/g,""));}}),
      ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:8}},
        ce(Sel,{label:"付款方式",value:payMode,onChange:function(e){setPayMode(e.target.value);}},
          ce("option",{value:"annual"},"年繳"),ce("option",{value:"semi"},"半年繳"),ce("option",{value:"quarterly"},"季繳")),
        ce(Sel,{label:"合約年期",value:String(contractYears),onChange:function(e){setContractYears(parseInt(e.target.value));}},
          ce("option",{value:"1"},"1年"),ce("option",{value:"2"},"2年"),ce("option",{value:"3"},"3年")),
        ce(Inp,{label:"整體折數%(選填)",value:discountPct,type:"number",onChange:function(e){setDiscountPct(e.target.value);},placeholder:"例：10"}))),

    ce(Card,null,
      ce(SecTitle,null,"A層 軟體年授權費"),
      // v1.10修正錯誤AI：原本「模板價」直接顯示aCalc.final(已內含年繳5%折扣的金額，如57.0萬)，
      // 但PRICING.A.tiers定義的annual數字(如60萬)才是該級距的官方模板價，付款方式折扣是另一層調整，混在一起顯示會讓人誤以為模板價本身算錯。
      // 改為模板價顯示未折扣的級距基本金額，付款方式折扣後金額另起一行清楚標示。
      ce(IBox,{c:"teal",style:{fontSize:11,marginBottom:8}},
        "模板價(未折扣)：NT$"+(aCalc.base/10000).toFixed(1)+"萬/年"+
        (aCalc.base!==aCalc.final?"\n"+aCalc.note+"後：NT$"+(aCalc.final/10000).toFixed(1)+"萬/年":"")+
        (discountPct?"\n再加整體折扣"+discountPct+"%後：NT$"+(Math.round(aCalc.final*discMulti)/10000).toFixed(1)+"萬/年":"")),
      ce(Inp,{label:"A層年費(萬元，留空使用模板價×折數)",type:"number",value:aOverride,onChange:function(e){setAOverride(e.target.value);},placeholder:String(Math.round(aFeeBase/10000*10)/10)})),

    ce(Card,null,
      ce(SecTitle,null,"B層 硬體設備"),
      ce("div",{style:{display:"grid",gap:8}},
        [{k:"bed",l:"雲朵床",p:PRICING.B.bed.price,v:bBed,set:setBBed},
         {k:"chair",l:"樂活椅",p:PRICING.B.chair.price,v:bChair,set:setBChair},
         {k:"la200",l:"LA200",p:PRICING.B.la200.price,v:bLA200,set:setBLA200}].map(function(item){
          return ce("div",{key:item.k,style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
            ce("div",{style:{fontSize:12,color:T.text}},item.l+"(NT$"+(item.p/10000).toFixed(2)+"萬/台)"),
            ce("div",{style:{display:"flex",alignItems:"center",gap:8}},
              ce("button",{onClick:function(){item.set(Math.max(0,item.v-1));},style:{width:24,height:24,borderRadius:"50%",border:"1px solid "+T.border,background:T.bg,cursor:"pointer",fontFamily:"inherit"}},"-"),
              ce("div",{style:{minWidth:20,textAlign:"center",fontWeight:700}},item.v),
              ce("button",{onClick:function(){item.set(item.v+1);},style:{width:24,height:24,borderRadius:"50%",border:"1px solid "+T.teal,background:T.tealBg,color:T.teal,cursor:"pointer",fontFamily:"inherit"}},"+")));
        })),
      ce(Inp,{label:"B層總額(萬元，留空使用模板計算×折數)",type:"number",value:bOverride,onChange:function(e){setBOverride(e.target.value);},style:{marginTop:8},placeholder:String(Math.round(bFeeBase/10000*10)/10)})),

    ce(Card,null,
      ce(SecTitle,null,"C層 高管健促服務"),
      ce(Sel,{label:"服務方案",value:cTier,onChange:function(e){setCTier(e.target.value);}},
        ce("option",{value:""},"不含C層"),
        PRICING.C.tiers.map(function(t){return ce("option",{key:t.name,value:t.name},t.name+" — "+t.execs+"人");})),
      ce(Inp,{label:"C層年費(萬元，留空使用模板價×折數)",type:"number",value:cOverride,onChange:function(e){setCOverride(e.target.value);},style:{marginTop:8},placeholder:String(Math.round(cFeeBase/10000*10)/10)})),

    ce(Card,null,
      ce(SecTitle,null,"D層 環境佈置(選配)"),
      ce(Sel,{label:"套組",value:dPkg,onChange:function(e){setDPkg(e.target.value);}},
        ce("option",{value:""},"不含D層"),
        PRICING.D.bundles.map(function(b){return ce("option",{key:b.name,value:b.name},b.name+"(NT$"+(b.min/10000)+"-"+(b.max/10000)+"萬)");})),
      ce(Inp,{label:"D層估算(萬元，留空使用模板區間中位×折數)",type:"number",value:dOverride,onChange:function(e){setDOverride(e.target.value);},style:{marginTop:8},placeholder:String(Math.round(dFeeBase/10000*10)/10)})),

    ce(Card,{style:{background:"linear-gradient(135deg,"+T.tealBg+",#fff)",border:"1px solid "+T.tealLight}},
      ce(SecTitle,null,"試算總覽"),
      ce("div",{style:{display:"grid",gap:6,fontSize:12}},
        ce("div",{style:{display:"flex",justifyContent:"space-between"}},ce("span",null,"A層年費"),ce("span",{style:{fontWeight:700}},"NT$"+(aFeeBase/10000).toFixed(1)+"萬")),
        ce("div",{style:{display:"flex",justifyContent:"space-between"}},ce("span",null,"B層一次性"),ce("span",{style:{fontWeight:700}},"NT$"+(bFeeBase/10000).toFixed(1)+"萬")),
        ce("div",{style:{display:"flex",justifyContent:"space-between"}},ce("span",null,"C層年費"),ce("span",{style:{fontWeight:700}},"NT$"+(cFeeBase/10000).toFixed(1)+"萬")),
        ce("div",{style:{display:"flex",justifyContent:"space-between"}},ce("span",null,"D層估算"),ce("span",{style:{fontWeight:700}},"NT$"+(dFeeBase/10000).toFixed(1)+"萬"))),
      ce("div",{style:{marginTop:10,paddingTop:10,borderTop:"1px solid "+T.tealLight,display:"flex",justifyContent:"space-between",alignItems:"center"}},
        ce("div",null,
          ce("div",{style:{fontSize:11,color:T.muted}},contractYears+"年總建置費"),
          ce("div",{style:{fontSize:20,fontWeight:900,color:T.teal}},"NT$"+(total3Year/10000).toFixed(0)+"萬"))),
      confirmErr&&ce(IBox,{c:"amber",style:{marginTop:10}},confirmErr),
      ce(Btn,{full:true,sz:"lg",style:{marginTop:12},onClick:doConfirm},"✅ 確認試算 → 轉為正式報價單")));
}

// ── QUOTE FORM ─────────────────────────────────────────────────────────────────
function QuoteForm(props){
  var onBack=props.onBack;
  var onSave=props.onSave;
  var session=props.session;
  var initDoc=props.initDoc||{};
  var docType=props.docType||"新案報價";
  var[step,setStep]=useState(1);
  var[toast,setToast]=useState("");

  // Client info
  var[clientName,setClientName]=useState(initDoc.clientName||"");
  var[clientAlias,setClientAlias]=useState(initDoc.clientAlias||"");
  var[address,setAddress]=useState(initDoc.address||"");
  var[contact,setContact]=useState(initDoc.contact||"");
  var[phone,setPhone]=useState(initDoc.phone||"");
  var[email,setEmail]=useState(initDoc.email||"");
  var[industry,setIndustry]=useState(initDoc.industry||"");
  var[memberCount,setMemberCount]=useState(initDoc.memberCount||"");
  var[partnerCode,setPartnerCode]=useState(initDoc.partnerCode||(session&&session.partnerOrgCode)||"");
  var[note,setNote]=useState(initDoc.note||"");
  // v1.3新增：接單來源(業務人員)+合作夥伴分潤(僅partnerCode為空時適用，邏輯比照l5.jsx NewCaseScreen)
  var[staffId,setStaffId]=useState(initDoc.staffId||(session&&session.staffId)||"");
  var[referralPartnerId,setReferralPartnerId]=useState(initDoc.referralPartnerId||"");
  var[referralPct,setReferralPct]=useState(initDoc.referralPct!=null?String(initDoc.referralPct):"");
  // v1.3新增：嘗試讀取l5.jsx寫入的清單(跨artifact storage共用性此前只驗證過l5讀quote方向，這是quote讀l5方向的第一次實測)
  var[l5Dists,setL5Dists]=useState(null); // null=尚未取得結果(載入中或未共用)，[]=已取得但清單為空，[...]=有資料
  var[l5Partners,setL5Partners]=useState(null);
  var[l5Staff,setL5Staff]=useState(null);
  useEffect(function(){
    stor.g("l5_distributors").then(function(d){try{setL5Dists(d?JSON.parse(d):[]);}catch(e){setL5Dists([]);}}).catch(function(){setL5Dists([]);});
    stor.g("l5_partners").then(function(d){try{setL5Partners(d?JSON.parse(d):[]);}catch(e){setL5Partners([]);}}).catch(function(){setL5Partners([]);});
    stor.g("l5_staff").then(function(d){try{setL5Staff(d?JSON.parse(d):[]);}catch(e){setL5Staff([]);}}).catch(function(){setL5Staff([]);});
  },[]);
  var partnerCodeValid=l5Dists&&l5Dists.length>0?l5Dists.some(function(d){return d.orgCode===partnerCode.trim();}):null;

  // A layer
  var[payMode,setPayMode]=useState(initDoc.payMode||"annual");
  var[contractYears,setContractYears]=useState(initDoc.contractYears||3);
  var[contractStart,setContractStart]=useState(initDoc.contractStart||"");
  var[contractEnd,setContractEnd]=useState(initDoc.contractEnd||"");
  var[aCustom,setACustom]=useState(initDoc.aCustom||"");

  // B layer
  var[bBed,setBBed]=useState(initDoc.bBed||0);
  var[bChair,setBChair]=useState(initDoc.bChair||0);
  var[bLA200,setBLA200]=useState(initDoc.bLA200||0);
  var[bCustomNote,setBCustomNote]=useState(initDoc.bCustomNote||"");

  // C layer
  var[cTier,setCTier]=useState(initDoc.cTier||"");
  var[cHighRisk,setCHighRisk]=useState(initDoc.cHighRisk||0);
  var[cCustomFee,setCCustomFee]=useState(initDoc.cCustomFee||"");

  // D layer
  var[dItems,setDItems]=useState(initDoc.dItems||{});
  var[dNote,setDNote]=useState(initDoc.dNote||"");
  // v1.5新增：健促場域可能分散多個地點(總公司/工廠等)，報價階段選填，正式現場勘查後由業務/客服補登完整
  var[dSites,setDSites]=useState(initDoc.dSites||[]);
  var[showSurvey,setShowSurvey]=useState(false);
  // v1.11新增：正式報價單單張列印格式(錯誤AJ待辦第2項)，isDist/非isDist各自有對應內容
  var[showQuoteDoc,setShowQuoteDoc]=useState(false);
  var[eWarrantyBed,setEWarrantyBed]=useState(initDoc.eWarrantyBed||false);
  var[eWarrantyChair,setEWarrantyChair]=useState(initDoc.eWarrantyChair||false);
  var[eWarrantyLA200,setEWarrantyLA200]=useState(initDoc.eWarrantyLA200||false);
  var[eWarrantyRate,setEWarrantyRate]=useState(initDoc.eWarrantyRate||"7");
  var[eValueAdded,setEValueAdded]=useState(initDoc.eValueAdded||{});
  var[eValueCustom,setEValueCustom]=useState(initDoc.eValueCustom||"");
  var[eCpiRate,setECpiRate]=useState(initDoc.eCpiRate||"");
  var[eCpiApply,setECpiApply]=useState(initDoc.eCpiApply||false);
  var[eNote,setENote]=useState(initDoc.eNote||"");

  // Upgrade fields
  var[origContractNo,setOrigContractNo]=useState(initDoc.origContractNo||"");
  var[origPlan,setOrigPlan]=useState(initDoc.origPlan||"");
  var[origAFee,setOrigAFee]=useState(initDoc.origAFee||"");
  var[upgradeDate,setUpgradeDate]=useState(initDoc.upgradeDate||new Date().toISOString().slice(0,10));
  var[origContractEnd,setOrigContractEnd]=useState(initDoc.origContractEnd||"");

  // Distributor fields
  // v1.8修正錯誤AG：doSave只把dist*欄位存進共用的clientName/contact/phone/email/clientAlias，從未存過distName等獨立key，
  // 導致經銷商報價單重新開啟編輯時這5個欄位全部初始化為空字串。fallback讀回共用欄位，讓既有已存資料(舊版存的)也能正確帶回。
  var[distName,setDistName]=useState(initDoc.distName||(docType==="經銷商報價"?initDoc.clientName:"")||"");
  var[distAlias,setDistAlias]=useState(initDoc.distAlias||(docType==="經銷商報價"?initDoc.clientAlias:"")||"");
  var[distContact,setDistContact]=useState(initDoc.distContact||(docType==="經銷商報價"?initDoc.contact:"")||"");
  var[distPhone,setDistPhone]=useState(initDoc.distPhone||(docType==="經銷商報價"?initDoc.phone:"")||"");
  var[distEmail,setDistEmail]=useState(initDoc.distEmail||(docType==="經銷商報價"?initDoc.email:"")||"");
  var[distRegion,setDistRegion]=useState(initDoc.distRegion||"");
  var[distLevel,setDistLevel]=useState(initDoc.distLevel||"silver");
  var[distHasSubAuth,setDistHasSubAuth]=useState(initDoc.distHasSubAuth||false);

  var isUpgrade=docType==="升級報價";
  var isRenewal=docType==="續約報價";
  var isDist=docType==="經銷商報價";

  var aCalc=calcAFee(memberCount,payMode);
  var bFee=(bBed*PRICING.B.bed.price)+(bChair*PRICING.B.chair.price)+(bLA200*PRICING.B.la200.price);
  var cTierData=PRICING.C.tiers.find(function(t){return t.name===cTier;})||null;
  var cFeeBase=cCustomFee?(parseInt(cCustomFee)||0)*10000:(cTierData?cTierData.annual:0);
  var cHighRiskFee=cHighRisk*PRICING.C.highRisk.price;
  var cFeeTotal=cFeeBase+cHighRiskFee;
  var dFeeMin=0,dFeeMax=0;
  PRICING.D.items.forEach(function(item){if(dItems[item.key]){dFeeMin+=item.min;dFeeMax+=item.max;}});

  // E layer fee calc
  var bOrigTotal=(bBed*PRICING.B.bed.price)+(bChair*PRICING.B.chair.price)+(bLA200*PRICING.B.la200.price);
  var eWarrantyFee=isRenewal?(
    (eWarrantyBed?PRICING.B.bed.price*(parseFloat(eWarrantyRate)||7)/100:0)+
    (eWarrantyChair?PRICING.B.chair.price*(parseFloat(eWarrantyRate)||7)/100:0)+
    (eWarrantyLA200?PRICING.B.la200.price*(parseFloat(eWarrantyRate)||7)/100:0)
  ):0;
  var eValueFee=isRenewal?Object.keys(eValueAdded).filter(function(k){return eValueAdded[k];}).reduce(function(a,k){
    var item=PRICING.E.valueAdded.find(function(v){return v.key===k;});
    return a+(item?item.price:0);
  },0)+(parseInt(eValueCustom)||0):0;
  var aBaseForCpi=aCustom?(parseInt(aCustom)||0)*10000:aCalc.final;
  var cpiMulti=isRenewal&&eCpiApply?1+(Math.min(parseFloat(eCpiRate)||0,PRICING.E.cpiCap)):1;
  var aFeeAfterCpi=isRenewal&&eCpiApply?Math.round(aBaseForCpi*cpiMulti):aBaseForCpi;
  var eTotalFee=eWarrantyFee+eValueFee;

  var upgradeCalc=isUpgrade&&origAFee&&origContractEnd?
    calcUpgradeDiff(origAFee?parseInt(origAFee)*10000:0,aFee,upgradeDate,origContractEnd):null;

  var aFee=aCustom?(parseInt(aCustom)||0)*10000:isRenewal&&eCpiApply?aFeeAfterCpi:aCalc.final;
  var totalYearFee=(isRenewal&&eCpiApply?aFeeAfterCpi:aFee)+cFeeTotal+eTotalFee;
  var total3Year=totalYearFee*contractYears+bFee;
  var dPackageName=dFeeMin>0?(dFeeMin<=40000?"基礎型":dFeeMin<=120000?"標準型":"完整型"):"";

  var doSave=async function(status){
    var docNo=initDoc.docNo;
    var listForSeq=null;
    if(!docNo){
      var typePrefix=isDist?"QT-P":isUpgrade?"QT-UP":isRenewal?"QT-RN":"QT";
      var existingForSeq=await stor.g("rq_quotes");
      listForSeq=existingForSeq?JSON.parse(existingForSeq):[];
      var ymNow=curYM();
      docNo=genDocNo(typePrefix,nextDocSeq(listForSeq,typePrefix,ymNow));
    }
    var doc={
      id:initDoc.id||"DOC_"+Date.now(),
      docNo,docType,status:status||"草稿",
      clientName:isDist?distName:clientName,
      clientAlias:isDist?distAlias:clientAlias,
      contact:isDist?distContact:contact,
      phone:isDist?distPhone:phone,
      email:isDist?distEmail:email,
      // v1.8修正錯誤AG：額外用獨立key保存一份，避免只靠共用欄位fallback，未來若共用欄位語意再變動不會又壞掉
      distName,distAlias,distContact,distPhone,distEmail,
      address,
      industry,memberCount,partnerCode,note,
      staffId,referralPartnerId:partnerCode.trim()?"":referralPartnerId,referralPct:partnerCode.trim()?null:(referralPartnerId?(parseFloat(referralPct)||0):null),
      payMode,contractYears,contractStart,contractEnd,
      // v1.8修正錯誤AG：經銷商報價單(isDist)不該有A/B/C/D層金額，A層原本因memberCount空白會被calcAFee誤算出最小級距金額(57.0萬)，
      // 存進aFee後在QuoteList被當成真實金額顯示，造成使用者誤以為「編輯/查看後只剩A層金額」。isDist時全部歸零。
      aFee:isDist?0:aFee,bFee:isDist?0:bFee,cFeeTotal:isDist?0:cFeeTotal,dFeeMin:isDist?0:dFeeMin,dFeeMax:isDist?0:dFeeMax,
      bBed,bChair,bLA200,bCustomNote,
      cTier,cHighRisk,cCustomFee,cFeeBase,cHighRiskFee,
      dItems,dNote,dSites,
      eWarrantyBed,eWarrantyChair,eWarrantyLA200,eWarrantyRate,
      eValueAdded,eValueCustom,eCpiRate,eCpiApply,eNote,
      eWarrantyFee,eValueFee,eTotalFee,aFeeAfterCpi,cpiMulti,
      origContractNo,origPlan,origAFee,upgradeDate,origContractEnd,upgradeCalc,
      distRegion,distLevel,distHasSubAuth,
      total3Year,totalYearFee,
      createdAt:initDoc.createdAt||new Date().toISOString(),
      updatedAt:new Date().toISOString(),
      createdBy:initDoc.createdBy||(session&&session.name)||"",
      versions:initDoc.versions?initDoc.versions.concat([{savedAt:new Date().toISOString(),status,by:session&&session.name}]):[{savedAt:new Date().toISOString(),status,by:session&&session.name}]
    };
    var existing=listForSeq?null:await stor.g("rq_quotes");
    var list=listForSeq||(existing?JSON.parse(existing):[]);
    var idx=list.findIndex(function(d){return d.id===doc.id;});
    if(idx>=0)list[idx]=doc;else list.unshift(doc);
    await stor.s("rq_quotes",JSON.stringify(list));
    if(onSave)onSave(doc);
    setToast("報價單 "+docNo+" 已儲存("+status+")");
  };

  var steps=isDist?["夥伴資訊","合作條件","確認"]:isUpgrade?["原合約","升級內容","費用確認"]:["客戶資料","費用配置","確認總覽"];

  if(showSurvey){
    var selectedDItems=PRICING.D.items.filter(function(item){return dItems[item.key];});
    return ce("div",{style:{display:"grid",gap:14}},
      ce("div",{className:"no-print",style:{display:"flex",justifyContent:"space-between"}},
        ce("button",{onClick:function(){setShowSurvey(false);},style:{background:"none",border:"none",cursor:"pointer",color:T.teal,fontSize:13,fontWeight:700,fontFamily:"inherit"}},"<- 返回報價單"),
        ce(Btn,{onClick:function(){
          var style=document.createElement("style");
          style.innerHTML="@media print{nav,header,.no-print{display:none!important}body{font-size:12px}}";
          document.head.appendChild(style);
          window.print();setToast("列印視窗已開啟，請選擇另存PDF");
        }},"🖨 列印/存為PDF")),
      ce(Card,{style:{lineHeight:1.9,fontSize:13,color:T.text}},
        ce("p",{style:{fontWeight:700,textAlign:"center",fontSize:16,marginBottom:4}},"麗媚生化科技有限公司\nREIBI BIO-Technology Co., Ltd."),
        ce("p",{style:{fontWeight:700,textAlign:"center",fontSize:14,marginBottom:20}},"D層 健康識能環境佈置 — 場勘需求單"),
        ce("div",{style:{display:"grid",gap:4,marginBottom:16,padding:12,background:T.bg,borderRadius:8}},
          ce("div",null,"客戶：" +(clientName||"—")+(address?"("+address+")":"")),
          ce("div",null,"聯絡人："+(contact||"—")+" · "+(phone||"—")),
          ce("div",null,"報價單號："+(initDoc.docNo||"(草稿，尚未儲存)")),
          ce("div",null,"製表日期："+new Date().toISOString().slice(0,10))),
        ce("p",{style:{fontWeight:700,marginBottom:6}},"客戶已選擇項目"),
        ce("div",{style:{display:"grid",gap:6,marginBottom:16}},
          selectedDItems.length>0?selectedDItems.map(function(item){
            return ce("div",{key:item.key,style:{display:"flex",justifyContent:"space-between",padding:"6px 10px",border:"1px solid "+T.border,borderRadius:6,fontSize:12}},
              ce("span",null,item.name),
              ce("span",{style:{color:T.muted}},"估算NT$"+(item.min/10000).toFixed(1)+"~"+(item.max/10000).toFixed(1)+"萬 · "+item.days));
          }):ce("div",{style:{fontSize:12,color:T.muted}},"(尚未勾選項目，請於報價單D層步驟勾選後再產生本單)")),
        ce("p",{style:{fontWeight:700,marginBottom:6}},"場域地點"),
        ce("div",{style:{display:"grid",gap:6,marginBottom:16}},
          dSites.length>0?dSites.map(function(s){
            return ce("div",{key:s.id,style:{padding:"8px 10px",border:"1px solid "+T.border,borderRadius:6,fontSize:12}},
              ce("div",{style:{fontWeight:700}},s.label||"(未命名場域)"),
              ce("div",{style:{color:T.muted}},s.address||"(地址待場勘後補登)"),
              s.note&&ce("div",{style:{color:T.muted,marginTop:2}},"備註："+s.note));
          }):[1,2,3].map(function(n){
            return ce("div",{key:n,style:{padding:"10px",border:"1px dashed "+T.border,borderRadius:6,fontSize:12,color:T.muted}},
              "場域"+n+"　名稱：________________　地址：____________________________");
          })),
        ce("div",{style:{padding:12,background:T.amberBg||"#fffbeb",borderRadius:8,fontSize:12,marginBottom:12}},
          ce("p",{style:{fontWeight:700,marginBottom:4}},"業務現場勘查記錄欄(現場填寫)"),
          ce("p",null,"現況空間/動線："),
          ce("p",{style:{marginTop:10}},"電力/網路可用性："),
          ce("p",{style:{marginTop:10}},"與B層設備安裝之協調事項："),
          ce("p",{style:{marginTop:10}},"勘查人員：________________　勘查日期：________________")),
        ce("p",{style:{fontSize:11,color:T.muted}},"付款方式："+PRICING.D.payment+"。正式報價需現場勘查確認後3-7工作日內提供。"),
        ce("p",{style:{fontSize:11,color:T.muted,textAlign:"center",marginTop:12}},"本文件由系統自動產生，如有疑問請聯繫 reibiservice@gmail.com")));
  }

  if(showQuoteDoc){
    var qDocNo=initDoc.docNo||"(草稿，尚未儲存，請先儲存後再列印以取得正式單號)";
    var qToday=new Date().toISOString().slice(0,10);
    var qValidUntil=new Date(Date.now()+30*24*60*60*1000).toISOString().slice(0,10);
    return ce("div",{style:{display:"grid",gap:14}},
      ce("div",{className:"no-print",style:{display:"flex",justifyContent:"space-between"}},
        ce("button",{onClick:function(){setShowQuoteDoc(false);},style:{background:"none",border:"none",cursor:"pointer",color:T.teal,fontSize:13,fontWeight:700,fontFamily:"inherit"}},"<- 返回報價單"),
        ce(Btn,{onClick:function(){
          var style=document.createElement("style");
          style.innerHTML="@media print{nav,header,.no-print{display:none!important}body{font-size:12px}}";
          document.head.appendChild(style);
          window.print();setToast("列印視窗已開啟，請選擇另存PDF");
        }},"🖨 列印/存為PDF")),
      ce(Card,{style:{lineHeight:1.9,fontSize:13,color:T.text}},
        ce("p",{style:{fontWeight:700,textAlign:"center",fontSize:16,marginBottom:4}},"麗媚生化科技有限公司\nREIBI BIO-Technology Co., Ltd."),
        ce("p",{style:{fontWeight:700,textAlign:"center",fontSize:14,marginBottom:20}},isDist?"經銷商合作報價／條件確認單":"報價單"),
        ce("div",{style:{display:"grid",gap:4,marginBottom:16,padding:12,background:T.bg,borderRadius:8}},
          ce("div",null,"報價單號："+qDocNo),
          ce("div",null,"報價日期："+qToday+"　有效期限：即日起30天內有效(至"+qValidUntil+")"),
          !isDist&&ce("div",null,"客戶："+(clientName||"—")+(clientAlias?"("+clientAlias+")":"")),
          !isDist&&address&&ce("div",null,"地址："+address),
          !isDist&&ce("div",null,"聯絡人："+(contact||"—")+" · "+(phone||"—")+(email?" · "+email:"")),
          !isDist&&industry&&ce("div",null,"產業別："+industry),
          isDist&&ce("div",null,"經銷商："+(distName||"—")+(distAlias?"("+distAlias+")":"")),
          isDist&&ce("div",null,"聯絡人："+(distContact||"—")+" · "+(distPhone||"—")+(distEmail?" · "+distEmail:"")),
          isDist&&ce("div",null,"負責區域："+(distRegion||"待確認"))),

        !isDist&&ce("div",{style:{marginBottom:16}},
          ce("p",{style:{fontWeight:700,marginBottom:6}},"費用明細"),
          ce("div",{style:{display:"grid",gap:6}},
            [
              {l:"A層 軟體年授權費",v:aFee>0?"NT$"+(aFee/10000).toFixed(1)+"萬/年":"不含",note:aCalc.note+"，"+contractYears+"年期"},
              {l:"B層 硬體設備(一次性)",v:bFee>0?"NT$"+(bFee/10000).toFixed(1)+"萬":"不含",note:bFee>0?"訂金30%→到貨40%→完工30%":""},
              {l:"C層 高管健促服務",v:cFeeTotal>0?"NT$"+(cFeeTotal/10000).toFixed(1)+"萬/年":"不含",note:cTier||""},
              {l:"D層 環境佈置(選配)",v:dFeeMin>0?"NT$"+(dFeeMin/10000).toFixed(0)+"~"+(dFeeMax/10000).toFixed(0)+"萬(估算)":"不含",note:dFeeMin>0?"需現場勘查確認正式金額":""}
            ].map(function(row){
              return ce("div",{key:row.l,style:{display:"flex",justifyContent:"space-between",padding:"6px 10px",border:"1px solid "+T.border,borderRadius:6,fontSize:12}},
                ce("div",null,ce("div",{style:{fontWeight:700}},row.l),row.note&&ce("div",{style:{fontSize:10,color:T.muted}},row.note)),
                ce("div",{style:{fontWeight:800,color:T.teal}},row.v));
            })),
          ce("div",{style:{marginTop:10,padding:"10px 14px",background:T.tealBg,borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center"}},
            ce("div",{style:{fontSize:12,color:T.muted}},contractYears+"年總建置費(A+C層×年期＋B+D層一次性)"),
            ce("div",{style:{fontSize:18,fontWeight:900,color:T.teal}},"NT$"+(total3Year/10000).toFixed(0)+"萬"))),

        isDist&&ce("div",{style:{marginBottom:16}},
          ce("p",{style:{fontWeight:700,marginBottom:6}},"分潤條件(依等級制度，正式規則詳見合約)"),
          ce("div",{style:{display:"grid",gap:6}},
            Object.entries(DIST_COMM_TIERS).map(function(entry){
              var k=entry[0];var row=entry[1];
              return ce("div",{key:k,style:{display:"flex",gap:6,padding:"6px 10px",border:"1px solid "+T.border,borderRadius:6,fontSize:11}},
                ce("span",{style:{fontWeight:700,color:T.navy,minWidth:70}},row.l),
                ce("span",{style:{color:T.muted,flex:1}},row.threshold),
                ce("span",{style:{color:T.teal,fontWeight:700,minWidth:44}},"A:"+row.soft+"%"),
                ce("span",{style:{color:T.teal,minWidth:70}},"B(含LA200):"+row.device+"%"),
                ce("span",{style:{color:T.amber,minWidth:44}},"C:"+row.exec+"%"));
            })),
          ce("div",{style:{fontSize:11,color:T.muted,marginTop:8}},"本筆合作初始等級："+(distLevel==="silver"?"🥈 銀牌":distLevel==="gold"?"🥇 金牌":"🏆 白金")+"。結算週期：月結制，每月30日彙整→隔月10日對帳→隔月15日匯款通知。")),

        !isDist&&ce(IBox,{c:"amber",style:{marginBottom:12,fontSize:11}},"以上金額均為含稅價（營業稅5%），不另外加收。"),
        note&&ce("div",{style:{marginBottom:12}},
          ce("p",{style:{fontWeight:700,marginBottom:4,fontSize:12}},"備註"),
          ce("p",{style:{fontSize:12,color:T.muted,whiteSpace:"pre-line"}},note)),
        ce("div",{style:{marginTop:20,paddingTop:12,borderTop:"1px solid "+T.border,fontSize:11,color:T.muted}},
          ce("p",null,"客服 LINE：@reibicare　Email：reibiservice@gmail.com　服務時間：週一至週五 09:00-18:00"),
          ce("p",{style:{marginTop:4}},"本報價單僅供洽談參考，正式合約以雙方用印版本為準。")),
        ce("div",{style:{marginTop:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:24}},
          ce("div",{style:{borderTop:"1px solid "+T.border,paddingTop:12}},
            ce("div",{style:{fontWeight:700,color:T.text,marginBottom:4}},"REIBI 業務簽章"),
            ce("div",{style:{fontSize:11,color:T.muted,marginTop:16}},"承辦人：________________"),
            ce("div",{style:{fontSize:11,color:T.muted,marginTop:8}},"日期：________________")),
          ce("div",{style:{borderTop:"1px solid "+T.border,paddingTop:12}},
            ce("div",{style:{fontWeight:700,color:T.text,marginBottom:4}},isDist?"經銷商確認":"客戶確認"),
            ce("div",{style:{fontSize:11,color:T.muted,marginTop:16}},"簽章：________________"),
            ce("div",{style:{fontSize:11,color:T.muted,marginTop:8}},"日期：________________")))));
  }

  return ce("div",{style:{display:"grid",gap:14}},
    ce(Toast,{msg:toast,onDone:function(){setToast("");}}),
    ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
      ce("button",{onClick:onBack,style:{background:"none",border:"none",cursor:"pointer",color:T.teal,fontSize:13,fontWeight:700,fontFamily:"inherit"}},"<- 返回"),
      ce(TypeBadge,{type:docType})),
    ce("div",{style:{display:"flex",alignItems:"center",gap:0,marginBottom:4}},
      steps.map(function(s,i){
        return ce("div",{key:s,style:{display:"flex",alignItems:"center",flex:i<steps.length-1?1:0}},
          ce("div",{style:{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:12,flexShrink:0,background:step>i+1?T.sage:step===i+1?T.teal:"#e2e8f0",color:step>=i+1?"#fff":T.muted}},
            step>i+1?"✓":i+1),
          i<steps.length-1&&ce("div",{style:{flex:1,height:2,background:step>i+1?T.sage:T.border}}));
      })),
    ce("div",{style:{display:"flex",justifyContent:"space-between",fontSize:11,color:T.muted,marginBottom:6}},
      steps.map(function(s){return ce("span",{key:s},s);})),

    // ── STEP 1 ──
    step===1&&!isDist&&!isUpgrade&&ce(Card,null,
      ce(SecTitle,null,"客戶基本資料"),
      ce("div",{style:{display:"grid",gap:10}},
        ce(Inp,{label:"客戶公司名稱 *",value:clientName,onChange:function(e){setClientName(e.target.value);},placeholder:"請填入正式公司名稱"}),
        ce(Inp,{label:"簡稱(用於文件代號)",value:clientAlias,onChange:function(e){setClientAlias(e.target.value.toUpperCase().slice(0,6));},placeholder:"例：TSMC"}),
        ce(Inp,{label:"公司登記地址(選填)",value:address,onChange:function(e){setAddress(e.target.value);},placeholder:"例：台北市信義區OO路OO號"}),
        ce(Inp,{label:"主要聯絡人 *",value:contact,onChange:function(e){setContact(e.target.value);}}),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}},
          ce(Inp,{label:"電話",value:phone,onChange:function(e){setPhone(e.target.value);},placeholder:"02-1234-5678"}),
          ce(Inp,{label:"Email",value:email,onChange:function(e){setEmail(e.target.value);},placeholder:"contact@company.com"})),
        ce(Sel,{label:"產業別",value:industry,onChange:function(e){setIndustry(e.target.value);}},
          ce("option",{value:""},"請選擇產業"),
          ["💻 科技","🏦 金融","🏭 製造","🛎 服務","🏥 醫療","🎓 教育","🏗 建築","📡 傳播","🏛 政府","🔹 其他"].map(function(ind){
            return ce("option",{key:ind,value:ind},ind);
          })),
        ce("div",{style:{display:"grid",gap:6}},
          ce("label",{style:{fontSize:12,color:T.muted,fontWeight:600}},"員工人數(決定A層費用)"),
          ce("div",{style:{display:"flex",gap:6,flexWrap:"wrap",marginBottom:4}},
            [50,100,200,300,500,1000].map(function(n){
              return ce("button",{key:n,onClick:function(){setMemberCount(String(n));},
                style:{padding:"4px 10px",borderRadius:16,border:"1px solid "+(memberCount===String(n)?T.teal:T.border),fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:memberCount===String(n)?T.teal:"transparent",color:memberCount===String(n)?"#fff":T.muted}},n+"人");
            })),
          ce(Inp,{value:memberCount,onChange:function(e){setMemberCount(e.target.value.replace(/[^0-9]/g,""));},placeholder:"或自行填入人數",type:"number"})),
        ce(Inp,{label:"接洽經銷商代碼(如有)",value:partnerCode,onChange:function(e){var v=e.target.value.toUpperCase();setPartnerCode(v);if(v.trim()){setReferralPartnerId("");setReferralPct("");}},placeholder:"例：PTN-WANG-25-001"}),
        partnerCode.trim()&&l5Dists!==null&&ce(IBox,{c:partnerCodeValid===true?"sage":partnerCodeValid===false?"red":"amber",style:{marginTop:-4}},
          partnerCodeValid===true?"✅ 已於l5經銷商清單核對到此代碼":
          partnerCodeValid===false?"⚠ l5經銷商清單中查無此代碼，請確認拼字或稍後由行政人員核對":
          "ℹ 尚未讀取到l5經銷商資料(可能是兩系統storage未共用，或l5尚未有任何經銷商)，代碼將以文字紀錄，正式建檔時由l5端人工核對"),
        ce("div",{style:{display:"grid",gap:6}},
          ce("label",{style:{fontSize:12,color:T.muted,fontWeight:600}},"承辦業務人員(選填)"),
          l5Staff&&l5Staff.length>0?ce("select",{value:staffId,onChange:function(e){setStaffId(e.target.value);},style:{padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,background:T.card}},
            ce("option",{value:""},"未指定"),
            l5Staff.map(function(s){return ce("option",{key:s.id||s.staffId,value:s.id||s.staffId},s.name||s.id||s.staffId);})):
          ce(Inp,{value:staffId,onChange:function(e){setStaffId(e.target.value);},placeholder:l5Staff===null?"讀取中...":"尚無l5業務人員清單資料，可先留空或手動填代號"})),
        !partnerCode.trim()&&ce("div",{style:{display:"grid",gap:8,padding:10,background:T.tealBg||"#f0fdfa",borderRadius:8}},
          ce("div",{style:{fontSize:12,fontWeight:700,color:T.teal}},"合作夥伴推薦(選填，僅REIBI自營單適用)"),
          l5Partners&&l5Partners.length>0?ce("select",{value:referralPartnerId,onChange:function(e){setReferralPartnerId(e.target.value);},style:{padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,background:T.card}},
            ce("option",{value:""},"無合作夥伴推薦"),
            l5Partners.map(function(p){return ce("option",{key:p.id,value:p.id},p.name||p.id);})):
          ce(Inp,{value:referralPartnerId,onChange:function(e){setReferralPartnerId(e.target.value);},placeholder:l5Partners===null?"讀取中...":"尚無l5合作夥伴清單資料，可先留空或手動填代號"}),
          referralPartnerId.trim()&&ce(Inp,{label:"本筆分潤%(可調整，建議5-10%)",type:"number",value:referralPct,onChange:function(e){setReferralPct(e.target.value);},placeholder:"8"})),
        ce(Inp,{label:"備註/特殊需求",value:note,onChange:function(e){setNote(e.target.value);},placeholder:"客戶特殊需求說明"}))),

    step===1&&isUpgrade&&ce(Card,null,
      ce(SecTitle,null,"原合約資訊"),
      ce(IBox,{c:"amber",style:{marginBottom:12}},"升級報價需關聯原合約，差額依剩餘月份按比例計算。"),
      ce("div",{style:{display:"grid",gap:10}},
        ce(Inp,{label:"原合約編號 *",value:origContractNo,onChange:function(e){setOrigContractNo(e.target.value.toUpperCase());},placeholder:"例：CT-2510-001"}),
        ce(Inp,{label:"客戶公司名稱 *",value:clientName,onChange:function(e){setClientName(e.target.value);}}),
        ce(Inp,{label:"原方案(文字說明)",value:origPlan,onChange:function(e){setOrigPlan(e.target.value);},placeholder:"例：成長型 101-300人"}),
        ce(Inp,{label:"原A層年授權費(萬元)",type:"number",value:origAFee,onChange:function(e){setOrigAFee(e.target.value);},placeholder:"例：120"}),
        ce(Inp,{label:"原合約結束日",type:"date",value:origContractEnd,onChange:function(e){setOrigContractEnd(e.target.value);}}),
        ce(Inp,{label:"升級生效日",type:"date",value:upgradeDate,onChange:function(e){setUpgradeDate(e.target.value);}}))),

    step===1&&isDist&&ce(Card,null,
      ce(SecTitle,null,"經銷商基本資料"),
      ce("div",{style:{display:"grid",gap:10}},
        ce(Inp,{label:"公司名稱 *",value:distName,onChange:function(e){setDistName(e.target.value);}}),
        ce(Inp,{label:"簡稱(2-4碼)",value:distAlias,onChange:function(e){setDistAlias(e.target.value.toUpperCase().slice(0,4));}}),
        ce(Inp,{label:"聯絡人 *",value:distContact,onChange:function(e){setDistContact(e.target.value);}}),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}},
          ce(Inp,{label:"電話",value:distPhone,onChange:function(e){setDistPhone(e.target.value);}}),
          ce(Inp,{label:"Email",value:distEmail,onChange:function(e){setDistEmail(e.target.value);}})),
        ce(Inp,{label:"負責區域",value:distRegion,onChange:function(e){setDistRegion(e.target.value);},placeholder:"例：北部(台北/新北/桃園)"}),
        ce(Sel,{label:"初始等級",value:distLevel,onChange:function(e){setDistLevel(e.target.value);}},
          ce("option",{value:"silver"},"🥈 銀牌(首筆起)"),
          ce("option",{value:"gold"},"🥇 金牌(年累積≥800萬)"),
          ce("option",{value:"platinum"},"🏆 白金(年累積≥2000萬)")),
        ce("div",{style:{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:T.bg,borderRadius:8}},
          ce("input",{type:"checkbox",checked:distHasSubAuth,onChange:function(e){setDistHasSubAuth(e.target.checked);},style:{width:16,height:16}}),
          ce("div",null,
            ce("div",{style:{fontSize:12,fontWeight:600,color:T.text}},"預授權開展次級經銷商"),
            ce("div",{style:{fontSize:11,color:T.muted}},"需麗媚審核，最多兩層制"))))),

    // ── STEP 2 ──
    step===2&&!isDist&&ce("div",{style:{display:"grid",gap:12}},
      ce(Card,null,
        ce(SecTitle,null,"A層 — 軟體平台年授權費"),
        ce("div",{style:{display:"grid",gap:10}},
          ce(Sel,{label:"付款方式",value:payMode,onChange:function(e){setPayMode(e.target.value);}},
            ce("option",{value:"annual"},"年繳(享5%折扣)"),
            ce("option",{value:"semi"},"半年繳"),
            ce("option",{value:"quarterly"},"季繳(含3%手續費)")),
          ce(Sel,{label:"合約年期",value:String(contractYears),onChange:function(e){setContractYears(parseInt(e.target.value));}},
            ce("option",{value:"1"},"1年"),ce("option",{value:"2"},"2年"),ce("option",{value:"3"},"3年(推薦)")),
          ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}},
            ce(Inp,{label:"合約開始日",type:"date",value:contractStart,onChange:function(e){setContractStart(e.target.value);}}),
            ce(Inp,{label:"合約結束日",type:"date",value:contractEnd,onChange:function(e){setContractEnd(e.target.value);}})),
          memberCount&&parseInt(memberCount)<=1000?
            ce(IBox,{c:"teal",style:{fontSize:11}},
              "系統計算年費：NT$"+(aCalc.final/10000).toFixed(1)+"萬/年("+aCalc.note+")\n此為系統建議售價，可依實際報價調整。"):
            ce(IBox,{c:"amber",style:{fontSize:11}},"1000人以上為客製報價，請填入下方自訂金額。"),
          ce(Inp,{label:"A層年授權費(萬元，可自訂報價)",type:"number",value:aCustom,onChange:function(e){setACustom(e.target.value);},placeholder:aCalc.final>0?"系統建議 NT$"+(aCalc.final/10000).toFixed(1)+"萬，留空使用建議值":"請填入客製報價金額"}))),
      ce(Card,null,
        ce(SecTitle,null,"B層 — 硬體設備(一次性)"),
        ce(IBox,{c:"teal",style:{marginBottom:10}},"付款方式：訂金30% → 到貨款40% → 完工款30%"),
        ce("div",{style:{display:"grid",gap:10}},
          [
            {k:"bed",l:PRICING.B.bed.name,p:PRICING.B.bed.price,v:bBed,set:setBBed},
            {k:"chair",l:PRICING.B.chair.name,p:PRICING.B.chair.price,v:bChair,set:setBChair},
            {k:"la200",l:PRICING.B.la200.name,p:PRICING.B.la200.price,v:bLA200,set:setBLA200}
          ].map(function(item){
            return ce(Card,{key:item.k,style:{padding:"10px 14px"}},
              ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
                ce("div",{style:{flex:1,paddingRight:10}},
                  ce("div",{style:{fontSize:11,fontWeight:600,color:T.text,lineHeight:1.5}},item.l),
                  ce("div",{style:{fontSize:10,color:T.muted}},"售價 NT$"+(item.p/10000).toFixed(2)+"萬/台")),
                ce("div",{style:{display:"flex",alignItems:"center",gap:8,flexShrink:0}},
                  ce("button",{onClick:function(){item.set(Math.max(0,item.v-1));},style:{width:26,height:26,borderRadius:"50%",border:"1px solid "+T.border,background:T.bg,cursor:"pointer",fontWeight:700,fontFamily:"inherit"}},"-"),
                  ce("div",{style:{fontSize:16,fontWeight:800,color:T.teal,minWidth:24,textAlign:"center"}},item.v),
                  ce("button",{onClick:function(){item.set(item.v+1);},style:{width:26,height:26,borderRadius:"50%",border:"1px solid "+T.teal,background:T.tealBg,cursor:"pointer",fontWeight:700,color:T.teal,fontFamily:"inherit"}},"+"))),
              item.v>0&&ce("div",{style:{fontSize:11,color:T.amber,marginTop:4,fontWeight:600}},"小計：NT$"+(item.v*item.p/10000).toFixed(2)+"萬"));
          })),
        bFee>0&&ce(IBox,{c:"amber",style:{marginTop:4,fontWeight:700}},"B層合計：NT$"+(bFee/10000).toFixed(2)+"萬"),
        ce(Inp,{label:"B層備註",value:bCustomNote,onChange:function(e){setBCustomNote(e.target.value);},placeholder:"例：含設備安裝調試、使用教育訓練"})),
      ce(Card,null,
        ce(SecTitle,null,"C層 — 高管健促服務費(年度)"),
        ce(IBox,{c:"sage",style:{marginBottom:10}},"兩項同時進行(自律神經量測+生物資訊檢測)，3-4位麗媚服務人員到場。付款與A層同期年繳(推薦)。"),
        ce("div",{style:{display:"grid",gap:8}},
          ce(Sel,{label:"服務方案",value:cTier,onChange:function(e){setCTier(e.target.value);}},
            ce("option",{value:""},"不含C層服務"),
            PRICING.C.tiers.map(function(t){
              return ce("option",{key:t.name,value:t.name},t.name+" — "+t.execs+"人 — NT$"+(t.annual/10000).toFixed(1)+"萬/年("+t.days+"天)");
            })),
          ce("div",{style:{display:"flex",alignItems:"center",gap:10}},
            ce("label",{style:{fontSize:12,color:T.muted,fontWeight:600,flexShrink:0}},"高風險高管加購(NT$1.4萬/人/年)："),
            ce("div",{style:{display:"flex",alignItems:"center",gap:8}},
              ce("button",{onClick:function(){setCHighRisk(Math.max(0,cHighRisk-1));},style:{width:26,height:26,borderRadius:"50%",border:"1px solid "+T.border,background:T.bg,cursor:"pointer",fontWeight:700,fontFamily:"inherit"}},"-"),
              ce("div",{style:{fontSize:14,fontWeight:800,color:T.teal,minWidth:24,textAlign:"center"}},cHighRisk),
              ce("button",{onClick:function(){setCHighRisk(cHighRisk+1);},style:{width:26,height:26,borderRadius:"50%",border:"1px solid "+T.teal,background:T.tealBg,cursor:"pointer",fontWeight:700,color:T.teal,fontFamily:"inherit"}},"+"))),
          ce(Inp,{label:"C層自訂年費(萬元，留空使用系統計算)",type:"number",value:cCustomFee,onChange:function(e){setCCustomFee(e.target.value);},placeholder:cTierData?"系統計算 NT$"+(cTierData.annual/10000).toFixed(1)+"萬":"選擇方案後自動帶入"}),
          cFeeTotal>0&&ce(IBox,{c:"sage",style:{fontSize:11}},"C層年費合計：NT$"+(cFeeTotal/10000).toFixed(1)+"萬/年"))),
      ce(Card,null,
        ce(SecTitle,null,"D層 — 健康識能環境佈置(選配)"),
        ce(IBox,{c:"teal",style:{marginBottom:10}},"付款方式：50%訂金 → 50%完工驗收。正式報價需現場勘查(3-7工作日)。"),
        ce("div",{style:{display:"grid",gap:6,marginBottom:10}},
          PRICING.D.items.map(function(item){
            return ce("div",{key:item.key,onClick:function(){setDItems(function(p){var n=Object.assign({},p);n[item.key]=!n[item.key];return n;});},
              style:{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:8,cursor:"pointer",border:"1px solid "+(dItems[item.key]?T.teal:T.border),background:dItems[item.key]?T.tealBg:T.card}},
              ce("div",{style:{width:16,height:16,borderRadius:4,border:"2px solid "+(dItems[item.key]?T.teal:T.faint),background:dItems[item.key]?T.teal:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}},
                dItems[item.key]&&ce("span",{style:{color:"#fff",fontSize:10,fontWeight:800}},"v")),
              ce("div",{style:{flex:1}},
                ce("div",{style:{fontSize:11,fontWeight:600,color:dItems[item.key]?T.teal:T.text}},item.name),
                ce("div",{style:{fontSize:10,color:T.muted}},"估算 NT$"+(item.min/10000).toFixed(1)+"萬~NT$"+(item.max/10000).toFixed(1)+"萬 · "+item.days)));
          })),
        dFeeMin>0&&ce(IBox,{c:"teal",style:{fontSize:11}},"D層估算：NT$"+(dFeeMin/10000).toFixed(0)+"萬 ~ NT$"+(dFeeMax/10000).toFixed(0)+"萬("+dPackageName+")\n正式報價需現場勘查確認，3-7工作日內提供。"),
        ce(Inp,{label:"D層備註",value:dNote,onChange:function(e){setDNote(e.target.value);}}),
        dFeeMin>0&&ce("div",{style:{marginTop:8}},
          ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}},
            ce("label",{style:{fontSize:12,color:T.muted,fontWeight:600}},"健促場域地點(選填，可留待現場勘查後由業務補登)"),
            ce("button",{onClick:function(){setDSites(dSites.concat([{id:"SITE_"+Date.now(),label:"",address:"",note:""}]));},
              style:{background:"none",border:"1px solid "+T.teal,color:T.teal,borderRadius:6,padding:"3px 8px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}},"+ 新增場域")),
          ce("div",{style:{fontSize:11,color:T.muted,marginBottom:8}},"企業可能有總公司/工廠等多個不同地址的場域，選填即可，不影響報價作業。"),
          dSites.map(function(site,idx){
            return ce("div",{key:site.id,style:{display:"grid",gap:6,padding:10,background:T.bg,borderRadius:8,marginBottom:6}},
              ce("div",{style:{display:"flex",gap:6,alignItems:"center"}},
                ce("input",{value:site.label,onChange:function(e){var v=e.target.value;setDSites(dSites.map(function(s,i){return i===idx?Object.assign({},s,{label:v}):s;}));},placeholder:"場域名稱(例：總公司/一廠)",style:{flex:1,padding:"7px 10px",borderRadius:6,border:"1px solid "+T.border,fontSize:12}}),
                ce("button",{onClick:function(){setDSites(dSites.filter(function(s,i){return i!==idx;}));},style:{background:"none",border:"none",color:T.coral,cursor:"pointer",fontSize:14,padding:"0 4px"}},"✕")),
              ce("input",{value:site.address,onChange:function(e){var v=e.target.value;setDSites(dSites.map(function(s,i){return i===idx?Object.assign({},s,{address:v}):s;}));},placeholder:"地址",style:{padding:"7px 10px",borderRadius:6,border:"1px solid "+T.border,fontSize:12}}),
              ce("input",{value:site.note,onChange:function(e){var v=e.target.value;setDSites(dSites.map(function(s,i){return i===idx?Object.assign({},s,{note:v}):s;}));},placeholder:"備註(例：預計佈置設備展示區+海報)",style:{padding:"7px 10px",borderRadius:6,border:"1px solid "+T.border,fontSize:12}}));
          }),
          ce(Btn,{v:"ghost",sz:"sm",onClick:function(){setShowSurvey(true);},style:{marginTop:4}},"📋 產生D層場勘需求單")))),

    step===2&&isDist&&ce(Card,null,
      ce(SecTitle,null,"合作條件"),
      ce(IBox,{c:"navy",style:{marginBottom:12}},"分潤條件依等級制度，詳見合約第3條。底價保護機制為內部規範，對外不在合約中揭露。A層(軟體授權)計入年累積業績，B層(設備，含LA200)/C層(顧問服務)不計入年累積業績但計入佣金。護欄機制：每層分潤%皆不得超過(100-REIBI保留下限%)，預設保留下限65%。"),
      ce("div",{style:{display:"grid",gap:10}},
        ce("div",{style:{display:"grid",gap:6}},
          Object.entries(DIST_COMM_TIERS).map(function(entry){
            var k=entry[0];var row=entry[1];
            return ce("div",{key:k,style:{display:"flex",gap:6,padding:"6px 10px",background:T.bg,borderRadius:6,fontSize:11}},
              ce("span",{style:{fontWeight:700,color:T.navy,minWidth:70}},row.l),
              ce("span",{style:{color:T.muted,flex:1}},row.threshold),
              ce("span",{style:{color:T.teal,fontWeight:700,minWidth:44}},"A:"+row.soft+"%"),
              ce("span",{style:{color:T.teal,minWidth:60}},"B(含LA200):"+row.device+"%"),
              ce("span",{style:{color:T.amber,minWidth:44}},"C:"+row.exec+"%"));
          }))),
        ce(IBox,{c:"amber"},"結算週期：月結制。每月30日彙整 → 隔月10日對帳 → 隔月15日匯款通知。")),

    // ── STEP 3 ──
    step===3&&ce("div",{style:{display:"grid",gap:12}},
      isUpgrade&&upgradeCalc&&upgradeCalc.supplement>0&&ce(IBox,{c:"amber"},
        ["升級差額計算：",
         "新A層年費：NT$"+(aFee/10000).toFixed(1)+"萬  原A層年費：NT$"+origAFee+"萬",
         "月差額：NT$"+(upgradeCalc.monthDiff/10000).toFixed(2)+"萬/月",
         "原合約剩餘："+upgradeCalc.monthsLeft+"個月",
         "本次補繳差額：NT$"+(upgradeCalc.supplement/10000).toFixed(2)+"萬"].join("\n")),
      ce(Card,null,
        ce(SecTitle,null,"報價總覽"),
        ce("div",{style:{marginBottom:12}},
          ce("div",{style:{fontSize:14,fontWeight:800,color:T.text}},isDist?distName:clientName),
          ce("div",{style:{fontSize:12,color:T.muted}},(isDist?distContact:contact)+" · "+(isDist?distPhone:phone))),
        ce("div",{style:{display:"grid",gap:8}},
          [
            {l:"A層 軟體年授權費"+(isRenewal&&eCpiApply?" (CPI已調整)":""),v:"NT$"+((isRenewal&&eCpiApply?aFeeAfterCpi:aFee)/10000).toFixed(1)+"萬/年",note:(isRenewal&&eCpiApply?"通膨調整+"+(eCpiRate||0)+"% · ":"")+aCalc.note+"，"+contractYears+"年期",show:!isDist},
            {l:"B層 硬體設備",v:bFee>0?"NT$"+(bFee/10000).toFixed(1)+"萬(一次)":"不含",note:"訂金30%→到貨40%→完工30%",show:!isDist},
            {l:"C層 高管健促服務",v:cFeeTotal>0?"NT$"+(cFeeTotal/10000).toFixed(1)+"萬/年":"不含",note:cTier||"",show:!isDist},
            {l:"D層 環境佈置(選配)",v:dFeeMin>0?"NT$"+(dFeeMin/10000).toFixed(0)+"萬起(估算)":"不含",note:"需現場勘查正式報價",show:!isDist},
            {l:"E層 延保與加值",v:eTotalFee>0?"NT$"+(eTotalFee/10000).toFixed(1)+"萬/年":"不含",note:isRenewal?"第4年起，選購":"",show:isRenewal&&!isDist},
            {l:"升級補繳差額",v:upgradeCalc?"NT$"+(upgradeCalc.supplement/10000).toFixed(2)+"萬":"",note:upgradeCalc?upgradeCalc.monthsLeft+"個月剩餘":"",show:isUpgrade&&!!upgradeCalc},
            {l:"分潤等級",v:distLevel==="silver"?"🥈 銀牌":distLevel==="gold"?"🥇 金牌":"🏆 白金",note:"依年累積業績自動升級",show:isDist},
            {l:"負責區域",v:distRegion||"待確認",note:"",show:isDist}
          ].filter(function(item){return item.show&&item.v;}).map(function(item){
            return ce("div",{key:item.l,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid "+T.border}},
              ce("div",null,
                ce("div",{style:{fontSize:12,fontWeight:600,color:T.text}},item.l),
                item.note&&ce("div",{style:{fontSize:10,color:T.muted}},item.note)),
              ce("div",{style:{fontSize:13,fontWeight:800,color:T.amber}},item.v));
          })),
        !isDist&&ce("div",{style:{marginTop:10,padding:"10px 14px",background:"linear-gradient(135deg,"+T.tealBg+",#fff)",borderRadius:8,border:"1px solid "+T.tealLight}},
          ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
            ce("div",null,
              ce("div",{style:{fontSize:12,fontWeight:700,color:T.muted}},"A+C層年費合計"),
              ce("div",{style:{fontSize:11,color:T.faint}},contractYears+"年累計 NT$"+(totalYearFee*contractYears/10000).toFixed(0)+"萬")),
            ce("div",{style:{textAlign:"right"}},
              ce("div",{style:{fontSize:18,fontWeight:900,color:T.teal}},"NT$"+(totalYearFee/10000).toFixed(1)+"萬/年"),
              bFee>0&&ce("div",{style:{fontSize:11,color:T.amber}},"+ B層設備 NT$"+(bFee/10000).toFixed(1)+"萬"))))),
      ce("div",{style:{display:"flex",gap:8}},
        ce(Btn,{v:"ghost",sz:"sm",onClick:function(){doSave("草稿");}},"💾 儲存草稿"),
        ce(Btn,{v:"amber",sz:"sm",onClick:function(){doSave("已發送");}},isDist?"📤 發送合作條件書":"📤 發送報價單"),
        ce(Btn,{v:"sage",sz:"sm",onClick:function(){doSave("已確認");}},"✅ 標記已確認")),
      ce(Btn,{v:"teal",sz:"sm",onClick:function(){setShowQuoteDoc(true);},style:{marginTop:8}},"📄 產生正式報價單(可列印/存PDF)")),

    step<steps.length&&ce(Btn,{onClick:function(){setStep(step+1);},full:true,sz:"lg",style:{marginTop:8}},
      "下一步 →"),
    step>1&&ce(Btn,{v:"ghost",onClick:function(){setStep(step-1);},style:{marginTop:4},full:true},"← 上一步"));
}

// ── QUOTE LIST ─────────────────────────────────────────────────────────────────
function QuoteList(props){
  var onNew=props.onNew;
  var onOpen=props.onOpen;
  var onToContract=props.onToContract;
  var onQuick=props.onQuick;
  var[quotes,setQuotes]=useState([]);
  var[search,setSearch]=useState("");
  var[filterType,setFilterType]=useState("all");
  var[filterStatus,setFilterStatus]=useState("all");
  var[toast,setToast]=useState("");

  useEffect(function(){
    stor.g("rq_quotes").then(function(d){if(d)setQuotes(JSON.parse(d));});
  },[]);

  var filtered=quotes.filter(function(q){
    var matchSearch=!search||(q.clientName&&q.clientName.includes(search))||(q.docNo&&q.docNo.includes(search.toUpperCase()));
    var matchType=filterType==="all"||q.docType===filterType;
    var matchStatus=filterStatus==="all"||q.status===filterStatus;
    return matchSearch&&matchType&&matchStatus;
  });

  var doVoid=async function(id){
    if(!window.confirm("確定要作廢此報價單？"))return;
    var all=await stor.g("rq_quotes");
    var list=all?JSON.parse(all):[];
    list=list.map(function(q){return q.id===id?Object.assign({},q,{status:"作廢"}):q;});
    await stor.s("rq_quotes",JSON.stringify(list));
    setQuotes(list);
    setToast("已作廢");
  };

  return ce("div",{style:{display:"grid",gap:12}},
    ce(Toast,{msg:toast,onDone:function(){setToast("");}}),
    ce("div",{style:{display:"flex",gap:8,flexWrap:"wrap"}},
      ce(Btn,{v:"teal",onClick:onQuick},"🧮 快速試算"),
      ce(Btn,{onClick:function(){onNew("新案報價");}},"+企業新案"),
      ce(Btn,{v:"amber",onClick:function(){onNew("升級報價");}},"+升級"),
      ce(Btn,{v:"sage",onClick:function(){onNew("續約報價");}},"+續約"),
      ce(Btn,{v:"navy",onClick:function(){onNew("經銷商報價");}},"+經銷商")),
    ce(Card,null,
      ce("div",{style:{display:"grid",gap:8}},
        ce(Inp,{label:"搜尋(客戶名稱 / 報價單號)",value:search,onChange:function(e){setSearch(e.target.value);}}),
        ce("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
          ["all","新案報價","升級報價","續約報價","經銷商報價"].map(function(t){
            return ce("button",{key:t,onClick:function(){setFilterType(t);},
              style:{padding:"4px 10px",borderRadius:20,border:"1px solid "+(filterType===t?T.teal:T.border),fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:filterType===t?T.teal:"transparent",color:filterType===t?"#fff":T.muted}},
              t==="all"?"全部類型":t);
          })),
        ce("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
          ["all","草稿","已發送","待確認","已確認","已轉合約","作廢"].map(function(s){
            return ce("button",{key:s,onClick:function(){setFilterStatus(s);},
              style:{padding:"4px 10px",borderRadius:20,border:"1px solid "+(filterStatus===s?T.plum:T.border),fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:filterStatus===s?T.plum:"transparent",color:filterStatus===s?"#fff":T.muted}},
              s==="all"?"全部狀態":s);
          })))),
    ce("div",{style:{fontSize:12,color:T.muted}},filtered.length+"筆"),
    filtered.length===0?ce(Card,{style:{textAlign:"center",padding:32,color:T.muted}},quotes.length===0?"尚無報價單，請點上方按鈕新增":"無符合條件的報價單"):
    ce("div",{style:{display:"grid",gap:8}},
      filtered.map(function(q){
        return ce(Card,{key:q.id,style:{padding:"12px 14px",borderLeft:"3px solid "+(q.status==="已確認"?T.sage:q.status==="作廢"?T.border:T.teal)}},
          ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}},
            ce("div",null,
              ce("div",{style:{fontWeight:700,fontSize:13,color:T.text}},q.clientName),
              ce("div",{style:{fontSize:11,color:T.muted,fontFamily:"monospace"}},q.docNo),
              ce("div",{style:{display:"flex",gap:6,marginTop:4}},
                ce(TypeBadge,{type:q.docType}),
                ce(StatusBadge,{status:q.status}))),
            ce("div",{style:{textAlign:"right"}},
              q.aFee>0&&ce("div",{style:{fontSize:12,fontWeight:700,color:T.amber}},"A層 NT$"+(q.aFee/10000).toFixed(1)+"萬/年"),
              q.bFee>0&&ce("div",{style:{fontSize:11,color:T.muted}},"B層 NT$"+(q.bFee/10000).toFixed(1)+"萬"),
              ce("div",{style:{fontSize:10,color:T.faint,marginTop:4}},q.updatedAt.slice(0,10)))),
          ce("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
            ce(Btn,{sz:"sm",v:"ghost",onClick:function(){onOpen(q);}},"\u270f 編輯/查看"),
            q.status==="已確認"&&q.docType!=="經銷商報價"&&ce(Btn,{sz:"sm",v:"sage",onClick:function(){onToContract(q);}},"\u21d2 轉為合約"),
            q.status==="已確認"&&q.docType==="經銷商報價"&&ce(Btn,{sz:"sm",v:"navy",onClick:function(){onToContract(q);}},"\u21d2 轉為經銷商合約"),
            q.status!=="作廢"&&q.status!=="已轉合約"&&ce(Btn,{sz:"sm",v:"danger",onClick:function(){doVoid(q.id);}},"\u2715 作廢")));
      })));
}

// ── CONTRACT VIEW ──────────────────────────────────────────────────────────────
function ContractView(props){
  var doc=props.doc;
  var onBack=props.onBack;
  var session=props.session;
  var onSaved=props.onSaved;
  var[status,setStatus]=useState(doc.status||"草稿(合約)");
  var[signedDate,setSignedDate]=useState(doc.signedDate||"");
  var[signNote,setSignNote]=useState(doc.signNote||"");
  var[toast,setToast]=useState("");
  var[woHandoffKey,setWoHandoffKey]=useState(doc.woHandoffKey||"");
  var[l5HandoffKey,setL5HandoffKey]=useState(doc.l5HandoffKey||"");
  // v1.7新增：帶出reibi-workorder關聯工單狀態(未執行/執行中/執行完成)，避免遺漏未建工單
  var[relatedWOs,setRelatedWOs]=useState(null);
  useEffect(function(){
    stor.g("rq_workorders").then(function(d){
      try{
        var list=d?JSON.parse(d):[];
        setRelatedWOs(list.filter(function(w){return w.contractNo===doc.docNo;}));
      }catch(e){setRelatedWOs([]);}
    }).catch(function(){setRelatedWOs([]);});
  },[]);
  var[showSurvey,setShowSurvey]=useState(false);
  var isDist=doc.docType==="經銷商合約";

  var doHandoffWorkOrder=async function(){
    var payload={
      clientName:doc.clientName,contractNo:doc.docNo,
      address:doc.address||"",
      contact:doc.contact,phone:doc.phone,email:doc.email,
      selectedItems:doc.dItems||{},
      dSites:doc.dSites||[],
      globalNote:"自合約 "+doc.docNo+" 自動帶入，D層估算 NT$"+((doc.dFeeMin||0)/10000).toFixed(0)+"-"+((doc.dFeeMax||0)/10000).toFixed(0)+"萬"
    };
    var key=await saveHandoff("workorder",payload);
    setWoHandoffKey(key);
    var all=await stor.g("rq_contracts");
    var list=all?JSON.parse(all):[];
    list=list.map(function(c){return c.id===doc.id?Object.assign({},c,{woHandoffKey:key}):c;});
    await stor.s("rq_contracts",JSON.stringify(list));
    setToast("已產生D層工單交接資料，請至 reibi-workorder 系統建立工單");
  };

  var doHandoffL5=async function(){
    var payload={
      orgName:doc.clientName,orgAlias:doc.clientAlias,
      address:doc.address||"",
      contact:doc.contact,phone:doc.phone,email:doc.email,
      memberCount:doc.memberCount,
      contractStart:doc.contractStart,contractEnd:doc.contractEnd,
      payMode:doc.payMode,
      cloudBeds:doc.bBed||0,relaxChairs:doc.bChair||0,la200:doc.bLA200||0,
      dPoster:!!(doc.dItems&&doc.dItems.poster),dBoard:!!(doc.dItems&&doc.dItems.board),
      dDigital:!!(doc.dItems&&doc.dItems.digital),dQR:!!(doc.dItems&&doc.dItems.qr),
      dDisplay:!!(doc.dItems&&doc.dItems.display),dInstall:!!(doc.dItems&&doc.dItems.install),
      cFee:doc.cFeeTotal?String(doc.cFeeTotal):"",
      partnerCode:doc.partnerCode||"",
      staffId:doc.staffId||"",
      referralPartnerId:doc.referralPartnerId||"",
      referralPct:doc.referralPct!=null?doc.referralPct:"",
      fromContractNo:doc.docNo,
      dSites:doc.dSites||[]
    };
    var key=await saveHandoff("l5",payload);
    setL5HandoffKey(key);
    var all=await stor.g("rq_contracts");
    var list=all?JSON.parse(all):[];
    list=list.map(function(c){return c.id===doc.id?Object.assign({},c,{l5HandoffKey:key}):c;});
    await stor.s("rq_contracts",JSON.stringify(list));
    setToast("已產生L5開通交接資料，請至 reibi-l5 系統「新案開通」載入");
  };

  var updateStatus=async function(newStatus,extra){
    var all=await stor.g("rq_contracts");
    var list=all?JSON.parse(all):[];
    var idx=list.findIndex(function(c){return c.id===doc.id;});
    var updated=Object.assign({},doc,{status:newStatus,signedDate:signedDate,signNote:signNote,updatedAt:new Date().toISOString()},extra||{});
    if(idx>=0)list[idx]=updated;else list.unshift(updated);
    await stor.s("rq_contracts",JSON.stringify(list));
    setStatus(newStatus);
    if(onSaved)onSaved(updated);
    setToast("合約狀態已更新："+newStatus);
  };

  if(showSurvey){
    var selectedDItems2=PRICING.D.items.filter(function(item){return doc.dItems&&doc.dItems[item.key];});
    var docSites=doc.dSites||[];
    return ce("div",{style:{display:"grid",gap:14}},
      ce("div",{className:"no-print",style:{display:"flex",justifyContent:"space-between"}},
        ce("button",{onClick:function(){setShowSurvey(false);},style:{background:"none",border:"none",cursor:"pointer",color:T.teal,fontSize:13,fontWeight:700,fontFamily:"inherit"}},"<- 返回合約"),
        ce(Btn,{onClick:function(){
          var style=document.createElement("style");
          style.innerHTML="@media print{nav,header,.no-print{display:none!important}body{font-size:12px}}";
          document.head.appendChild(style);
          window.print();setToast("列印視窗已開啟，請選擇另存PDF");
        }},"🖨 列印/存為PDF")),
      ce(Card,{style:{lineHeight:1.9,fontSize:13,color:T.text}},
        ce("p",{style:{fontWeight:700,textAlign:"center",fontSize:16,marginBottom:4}},"麗媚生化科技有限公司\nREIBI BIO-Technology Co., Ltd."),
        ce("p",{style:{fontWeight:700,textAlign:"center",fontSize:14,marginBottom:20}},"D層 健康識能環境佈置 — 場勘需求單"),
        ce("div",{style:{display:"grid",gap:4,marginBottom:16,padding:12,background:T.bg,borderRadius:8}},
          ce("div",null,"客戶："+(doc.clientName||"—")+(doc.address?"("+doc.address+")":"")),
          ce("div",null,"聯絡人："+(doc.contact||"—")+" · "+(doc.phone||"—")),
          ce("div",null,"合約編號："+(doc.docNo||"—")+"(源自報價單："+(doc.fromQuoteNo||"—")+")"),
          ce("div",null,"製表日期："+new Date().toISOString().slice(0,10))),
        ce("p",{style:{fontWeight:700,marginBottom:6}},"客戶已選擇項目"),
        ce("div",{style:{display:"grid",gap:6,marginBottom:16}},
          selectedDItems2.length>0?selectedDItems2.map(function(item){
            return ce("div",{key:item.key,style:{display:"flex",justifyContent:"space-between",padding:"6px 10px",border:"1px solid "+T.border,borderRadius:6,fontSize:12}},
              ce("span",null,item.name),
              ce("span",{style:{color:T.muted}},"估算NT$"+(item.min/10000).toFixed(1)+"~"+(item.max/10000).toFixed(1)+"萬 · "+item.days));
          }):ce("div",{style:{fontSize:12,color:T.muted}},"(本合約無D層項目)")),
        ce("p",{style:{fontWeight:700,marginBottom:6}},"場域地點"),
        ce("div",{style:{display:"grid",gap:6,marginBottom:16}},
          docSites.length>0?docSites.map(function(s){
            return ce("div",{key:s.id,style:{padding:"8px 10px",border:"1px solid "+T.border,borderRadius:6,fontSize:12}},
              ce("div",{style:{fontWeight:700}},s.label||"(未命名場域)"),
              ce("div",{style:{color:T.muted}},s.address||"(地址待場勘後補登)"),
              s.note&&ce("div",{style:{color:T.muted,marginTop:2}},"備註："+s.note));
          }):[1,2,3].map(function(n){
            return ce("div",{key:n,style:{padding:"10px",border:"1px dashed "+T.border,borderRadius:6,fontSize:12,color:T.muted}},
              "場域"+n+"　名稱：________________　地址：____________________________");
          })),
        ce("div",{style:{padding:12,background:T.amberBg||"#fffbeb",borderRadius:8,fontSize:12,marginBottom:12}},
          ce("p",{style:{fontWeight:700,marginBottom:4}},"業務現場勘查記錄欄(現場填寫)"),
          ce("p",null,"現況空間/動線："),
          ce("p",{style:{marginTop:10}},"電力/網路可用性："),
          ce("p",{style:{marginTop:10}},"與B層設備安裝之協調事項："),
          ce("p",{style:{marginTop:10}},"勘查人員：________________　勘查日期：________________")),
        ce("p",{style:{fontSize:11,color:T.muted}},"付款方式："+PRICING.D.payment+"。正式報價需現場勘查確認後3-7工作日內提供。"),
        ce("p",{style:{fontSize:11,color:T.muted,textAlign:"center",marginTop:12}},"本文件由系統自動產生，如有疑問請聯繫 reibiservice@gmail.com")));
  }

  return ce("div",{style:{display:"grid",gap:14}},
    ce(Toast,{msg:toast,onDone:function(){setToast("");}}),
    ce("button",{className:"no-print",onClick:onBack,style:{background:"none",border:"none",cursor:"pointer",color:T.teal,fontSize:13,fontWeight:700,fontFamily:"inherit"}},"<- 返回合約列表"),
    ce(Card,{className:"no-print",style:{background:"linear-gradient(135deg,#1e3a5f,#0f766e)",border:"none"}},
      ce("div",{style:{color:"#fff"}},
        ce("div",{style:{fontSize:11,opacity:.75,marginBottom:4}},doc.docNo),
        ce("div",{style:{fontSize:18,fontWeight:800,marginBottom:4}},doc.clientName),
        ce("div",{style:{display:"flex",gap:8,flexWrap:"wrap"}},
          ce("span",{style:{background:"rgba(255,255,255,.2)",padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700}},doc.docType),
          ce("span",{style:{background:"rgba(255,255,255,.2)",padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700}},status)))),
    ce(Card,{className:"no-print"},
      ce(SecTitle,null,"合約狀態管理"),
      ce("div",{style:{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}},
        ["草稿(合約)","已發送","待用印","用印完成","存檔"].map(function(s){
          return ce("button",{key:s,onClick:function(){setStatus(s);},
            style:{padding:"5px 12px",border:"1px solid "+(status===s?T.teal:T.border),borderRadius:20,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:status===s?T.teal:"transparent",color:status===s?"#fff":T.muted}},s);
        })),
      (status==="用印完成"||status==="存檔")&&ce("div",{style:{display:"grid",gap:8,marginBottom:10}},
        ce(Inp,{label:"用印日期",type:"date",value:signedDate,onChange:function(e){setSignedDate(e.target.value);}}),
        ce(Inp,{label:"備註(紙本存放位置/電子檔說明)",value:signNote,onChange:function(e){setSignNote(e.target.value);},placeholder:"例：紙本存放行政櫃A3，電子檔已存雲端Drive"})),
      ce(Btn,{onClick:function(){updateStatus(status);},full:true},"更新合約狀態")),
    ce(Card,null,
      ce(SecTitle,null,isDist?"麗媚生化科技有限公司 × "+doc.clientName+" 經銷商合作合約(草稿)":"麗媚生化科技有限公司服務合約(草稿)"),
      ce(IBox,{c:"amber",style:{marginBottom:12}},"此為系統自動生成之草稿合約，作為洽談基礎使用。正式合約需由麗媚法務審閱，雙方加蓋公司大小章後生效。"),
      isDist?ce("div",{style:{lineHeight:1.9,fontSize:12,color:T.text}},
        ce("p",{style:{fontWeight:700,textAlign:"center",fontSize:14,marginBottom:16}},
          "麗媚生化科技有限公司\nREIBI BIO-Technology Co., Ltd.\n經銷商合作合約"),
        ce("p",null,"合約編號："+doc.docNo),
        ce("p",null,"甲方(麗媚)：麗媚生化科技有限公司"),
        ce("p",null,"乙方(經銷商)："+doc.clientName),
        ce("p",null,"訂約日期：　　年　　月　　日"),
        ce("div",{style:{marginTop:12,paddingLeft:4}},
          [
            {n:"第一條 合約目的與授權範圍",t:"甲方授予乙方在雙方同意之區域內("+(doc.distRegion||"待確認")+")，以乙方名義推廣及銷售REIBI企業健康自主管理平台服務(A/B/C/D層)之非專屬代理權。"},
            {n:"第二條 授權區域與客戶管理",t:"乙方負責指定區域之客戶開發、關係維護及服務協調。客戶合約由甲乙雙方共同確認。所有客戶orgCode及平台帳號由甲方統一管理。"},
            {n:"第三條 分潤計算規則",t:"乙方依年累積簽約額享有對應等級分潤：銀牌A層8%/B層10%/C層5%/LA200另計15%；金牌A層12%；白金A層15%。詳細計算規則依甲方內部結算準則執行。"},
            {n:"第四條 次級經銷商管理",t:"乙方如欲發展次級合作夥伴，須事先取得甲方書面核准。最多兩層架構。甲方僅與乙方進行財務結算，乙方對次級合作夥伴之行為負連帶責任。"},
            {n:"第五條 對帳與付款",t:"採月結制。每月30日甲方彙整當月分潤明細；隔月10日雙方完成對帳確認；隔月15日甲方完成匯款並通知乙方。"},
            {n:"第六條 底價保護",t:"甲方設有最低報價保護機制，相關數字為甲方機密資訊，乙方不得對外揭露。乙方報價不得低於甲方規定之最低限額。"},
            {n:"第七條 保密義務",t:"雙方對合作期間所知悉之商業資訊、客戶資料、技術規格及定價策略負有永久保密義務。"},
            {n:"第八條 智慧財產授權",t:"甲方授予乙方在合約期間有限度使用REIBI品牌商標進行行銷推廣，但不得移轉、轉授或用於非本合約目的。"},
            {n:"第九條 REIBI Academy培訓義務",t:"乙方主要業務人員應於合約生效後三個月內完成甲方指定之基礎認證課程。"},
            {n:"第十條 違約責任",t:"任一方違反本合約，對方得書面通知限期改正(30天)；逾期未改正者，得終止合約並請求損害賠償。"},
            {n:"第十一條 合約期間與續約",t:"本合約期間為壹年，自用印日起算。期滿前60天，雙方書面確認是否續約；若無書面通知，視為續約一年。"},
            {n:"第十二條 爭議解決",t:"本合約依中華民國法律解釋，以台灣台北地方法院為第一審管轄法院。如有爭議，雙方應先以協商方式解決。"}
          ].map(function(art){
            return ce("div",{key:art.n,style:{marginBottom:10}},
              ce("div",{style:{fontWeight:700,color:T.navy,marginBottom:2}},art.n),
              ce("div",{style:{paddingLeft:10,color:T.text}},art.t));
          }))):
      ce("div",{style:{lineHeight:1.9,fontSize:12,color:T.text}},
        ce("p",{style:{fontWeight:700,textAlign:"center",fontSize:14,marginBottom:16}},
          "麗媚生化科技有限公司\nREIBI BIO-Technology Co., Ltd.\n企業健康自主管理平台服務合約"),
        ce("p",null,"合約編號："+doc.docNo),
        ce("p",null,"甲方(企業)："+doc.clientName),
        ce("p",null,"乙方(麗媚)：麗媚生化科技有限公司"),
        ce("p",null,"訂約日期：　　年　　月　　日"),
        doc.origContractNo&&ce("p",{style:{color:T.amber,fontWeight:700}},"本合約為補充合約，關聯原合約編號："+doc.origContractNo),
        ce("div",{style:{marginTop:12,paddingLeft:4}},
          [
            {n:"第一條 合約當事人",t:"甲方為"+doc.clientName+"(以下稱「甲方」)，乙方為麗媚生化科技有限公司(以下稱「乙方」)。雙方同意依本合約條款，就REIBI企業健康自主管理平台服務建立合作關係。"},
            {n:"第二條 服務範圍",t:["A層：軟體平台年授權費，含平台使用權、系統更新、資料儲存及技術支援。",
              "B層：硬體設備採購(依附件設備清單)，含安裝調試及人員教育訓練。",
              "C層：高管健康量測加值服務(自律神經量測+生物資訊檢測)，每年度執行一次。",
              "D層：健康識能環境佈置服務(選配，依附件規格確認)。"].join("\n")},
            {n:"第三條 授權人數與使用規範",t:"本合約授權員工使用人數上限為"+(doc.memberCount||"依報價單")+"人。授權範圍為甲方員工在工作相關情境下使用。甲方不得超出授權人數或將帳號轉讓第三方。"},
            {n:"第四條 合約期間",t:"本合約期間為"+(doc.contractYears||3)+"年，自"+(doc.contractStart||"　　年　　月　　日")+"起至"+(doc.contractEnd||"　　年　　月　　日")+"止。到期前90天，乙方將主動聯繫甲方確認續約事宜。"},
            {n:"第五條 費用與付款",t:["A層年授權費：NT$"+(doc.aFee?(doc.aFee/10000).toFixed(1):"依報價單")+"萬/年，付款方式："+({annual:"年繳享5%折扣",semi:"半年繳",quarterly:"季繳含3%手續費"}[doc.payMode]||"依報價單")+"。",
              doc.bFee>0?"B層設備費：NT$"+(doc.bFee/10000).toFixed(1)+"萬，付款里程碑：訂金30%→到貨款40%→完工款30%。":"",
              doc.cFeeTotal>0?"C層高管服務費：NT$"+(doc.cFeeTotal/10000).toFixed(1)+"萬/年，與A層同期繳付。":"",
              doc.dFeeMin>0?"D層環境佈置費：NT$"+(doc.dFeeMin/10000).toFixed(0)+"萬起(正式金額以現場勘查報價為準)，付款方式：50%訂金→50%完工驗收。":"",
              "以上金額均為含稅價（營業稅5%），不另外加收。"
              ].filter(Boolean).join("\n")},
            {n:"第六條 設備安裝與驗收",t:"B層設備由乙方負責運送、安裝及調試。安裝完成後甲方進行驗收確認，驗收合格後方進行完工款支付。設備保固期依各設備規格書。"},
            {n:"第七條 服務水準(SLA)",t:"系統可用率≥99.5%(例行維護除外)。系統維護通知提前48小時以LINE @reibicare及Email通知。緊急問題4小時內回應，一般問題1個工作日內處理。"},
            {n:"第八條 智慧財產權",t:"平台軟體、品牌商標、評估工具及AI模型之智慧財產權歸乙方所有。甲方員工之使用數據、評估結果及健康記錄歸甲方所有，乙方以代管方式處理。"},
            {n:"第九條 資料保護與隱私",t:"乙方採AES-256-GCM加密儲存資料，採k-匿名性(k≥5)及差分隱私保護個人健康數據。乙方不將甲方員工個人可識別資訊對外揭露，並依個資法及GDPR相關原則處理。"},
            {n:"第十條 保密義務",t:"雙方對合約內容、定價條件、企業內部健康數據及商業機密負有保密義務，不得對未授權第三方揭露。保密義務於合約期滿後繼續有效兩年。"},
            {n:"第十一條 違約責任",t:"若甲方逾期付款超過30天，乙方得暫停服務；超過60天，得終止合約。若乙方未達SLA標準，甲方得要求比例退費。"},
            {n:"第十二條 合約終止",t:"合約到期自然終止。任一方可於3個月前書面通知提前終止。終止後，乙方提供30天資料匯出期，期滿後刪除所有甲方資料。"},
            {n:"第十三條 升級與變更",t:"甲方如需升級方案或增購設備，雙方簽署補充合約(Addendum)。升級差額依原合約剩餘月份按比例計算，補充合約生效後更新平台設定。"},
            {n:"第十四條 大數據研究權利",t:"乙方對全台去識別化健康數據(k≥5匿名處理後)擁有分析、研究及發布之專屬權利，可用於學術研究、白皮書發布及政策倡議，不涉及任何可識別個人之資訊。"},
            {n:"第十五條 免責聲明",t:"REIBI平台為輔助性健康自主管理工具，不構成醫療診斷，不替代專業醫療照護。AI建議及評估結果為統計參考，個人效果因人而異。乙方對因不可抗力或第三方服務中斷所致損害不負賠償責任。"},
            {n:"第十六條 爭議解決",t:"本合約依中華民國法律解釋。如有爭議，雙方應先以協商方式解決；協商不成，以台灣台北地方法院為第一審管轄法院。"}
          ].map(function(art){
            return ce("div",{key:art.n,style:{marginBottom:12}},
              ce("div",{style:{fontWeight:700,color:T.navy,marginBottom:2}},art.n),
              ce("div",{style:{paddingLeft:10,color:T.text,whiteSpace:"pre-line"}},art.t));
          })),
        ce("div",{style:{marginTop:24,display:"grid",gridTemplateColumns:"1fr 1fr",gap:24}},
          ce("div",{style:{borderTop:"1px solid "+T.border,paddingTop:12}},
            ce("div",{style:{fontWeight:700,color:T.text,marginBottom:4}},"甲方蓋章"),
            ce("div",{style:{fontSize:11,color:T.muted}},doc.clientName),
            ce("div",{style:{fontSize:11,color:T.muted,marginTop:16}},"代表人簽章：________________"),
            ce("div",{style:{fontSize:11,color:T.muted,marginTop:8}},"日期：________________")),
          ce("div",{style:{borderTop:"1px solid "+T.border,paddingTop:12}},
            ce("div",{style:{fontWeight:700,color:T.text,marginBottom:4}},"乙方蓋章"),
            ce("div",{style:{fontSize:11,color:T.muted}},"麗媚生化科技有限公司"),
            ce("div",{style:{fontSize:11,color:T.muted,marginTop:16}},"代表人簽章：________________"),
            ce("div",{style:{fontSize:11,color:T.muted,marginTop:8}},"日期：________________")))),
    !isDist&&doc.dItems&&Object.keys(doc.dItems).some(function(k){return doc.dItems[k];})&&ce(Card,{className:"no-print"},
      ce(SecTitle,null,"D層場勘準備"),
      ce(IBox,{c:"teal",style:{marginBottom:10}},"客戶已選擇D層項目，業務現場勘查前可先產生場勘需求單，現場填寫後留存。"),
      ce(Btn,{v:"teal",onClick:function(){setShowSurvey(true);}},"📋 產生D層場勘需求單")),
    !isDist&&doc.dItems&&Object.keys(doc.dItems).some(function(k){return doc.dItems[k];})&&ce(Card,{className:"no-print"},
      ce(SecTitle,null,"D層工單執行狀態"),
      relatedWOs===null?ce("div",{style:{fontSize:12,color:T.muted}},"讀取中..."):
      relatedWOs.length===0?ce(IBox,{c:"amber"},"⚠ 尚未偵測到本合約的D層工單，請確認是否已至reibi-workorder系統建立工單，避免遺漏。"):
      ce("div",{style:{display:"grid",gap:6}},
        relatedWOs.map(function(w){
          var sc={"草稿":T.muted,"已發出":T.teal,"安裝中":T.amber,"待驗收":T.amber,"驗收完成":T.sage,"驗收異常":T.red}[w.status]||T.muted;
          return ce("div",{key:w.id,style:{display:"flex",justifyContent:"space-between",padding:"6px 10px",background:T.bg,borderRadius:6,fontSize:12}},
            ce("span",null,w.address||"(未填施工地址)"),
            ce("span",{style:{color:sc,fontWeight:700}},w.status||"未知狀態"));
        })),
      ce("div",{style:{fontSize:10,color:T.muted,marginTop:8}},"⚠ 此資料讀取自reibi-workorder的storage，跨artifact共用性尚待實測確認。")),
    !isDist&&ce(Card,{className:"no-print"},
      ce(SecTitle,null,"系統串接"),
      ce(IBox,{c:"navy",style:{marginBottom:10}},"將本合約客戶資訊一鍵帶入其他系統，避免重複輸入。對方系統開啟時會自動偵測並載入交接資料。"),
      ce("div",{style:{display:"flex",gap:8,flexWrap:"wrap"}},
        ce(Btn,{v:"amber",onClick:doHandoffWorkOrder},"🔧 → 產生D層工單交接"),
        ce(Btn,{v:"plum",onClick:doHandoffL5},"🔑 → 產生L5開通交接")),
      woHandoffKey&&ce(IBox,{c:"sage",style:{marginTop:8,fontSize:11}},"✅ 工單交接資料已建立："+woHandoffKey),
      l5HandoffKey&&ce(IBox,{c:"sage",style:{marginTop:8,fontSize:11}},"✅ L5開通交接資料已建立："+l5HandoffKey)),
    ce("div",{className:"no-print",style:{display:"flex",gap:8,flexWrap:"wrap"}},
      ce(Btn,{v:"sage",onClick:function(){
        var style=document.createElement("style");
        style.innerHTML="@media print{nav,header,.no-print{display:none!important}body{font-size:12px}}";
        document.head.appendChild(style);
        window.print();setToast("列印視窗已開啟，請選擇另存PDF");
      }},"列印/存PDF"),
      status==="用印完成"&&ce(Btn,{v:"primary",onClick:function(){updateStatus("存檔",{isArchived:true});}},
        "📁 確認電子存檔"))));

}

// ── CONTRACT LIST ──────────────────────────────────────────────────────────────
function ContractList(props){
  var onOpen=props.onOpen;
  var onNewAdj=props.onNewAdj;
  var[contracts,setContracts]=useState([]);
  var[search,setSearch]=useState("");
  var[filterStatus,setFilterStatus]=useState("all");
  var[filterType,setFilterType]=useState("all");
  var[toast,setToast]=useState("");

  useEffect(function(){
    stor.g("rq_contracts").then(function(d){if(d)setContracts(JSON.parse(d));});
  },[]);

  var filtered=contracts.filter(function(c){
    var matchSearch=!search||(c.clientName&&c.clientName.includes(search))||(c.docNo&&c.docNo.includes(search));
    var matchStatus=filterStatus==="all"||c.status===filterStatus;
    var matchType=filterType==="all"||c.docType===filterType;
    return matchSearch&&matchStatus&&matchType;
  });

  var daysLeft=function(contractEnd){
    if(!contractEnd)return null;
    return Math.ceil((new Date(contractEnd)-new Date())/(1000*60*60*24));
  };

  return ce("div",{style:{display:"grid",gap:12}},
    ce(Toast,{msg:toast,onDone:function(){setToast("");}}),
    ce(Card,null,
      ce("div",{style:{display:"grid",gap:8}},
        ce(Inp,{label:"搜尋(客戶名稱/合約編號)",value:search,onChange:function(e){setSearch(e.target.value);}}),
        ce("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
          ["all","企業合約","補充合約","續約合約","經銷商合約"].map(function(t){
            return ce("button",{key:t,onClick:function(){setFilterType(t);},
              style:{padding:"4px 10px",borderRadius:20,border:"1px solid "+(filterType===t?T.teal:T.border),fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:filterType===t?T.teal:"transparent",color:filterType===t?"#fff":T.muted}},
              t==="all"?"全部類型":t);
          })),
        ce("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
          ["all","草稿(合約)","已發送","待用印","用印完成","執行中","存檔"].map(function(s){
            return ce("button",{key:s,onClick:function(){setFilterStatus(s);},
              style:{padding:"4px 10px",borderRadius:20,border:"1px solid "+(filterStatus===s?T.plum:T.border),fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:filterStatus===s?T.plum:"transparent",color:filterStatus===s?"#fff":T.muted}},
              s==="all"?"全部狀態":s);
          })))),
    ce("div",{style:{fontSize:12,color:T.muted}},filtered.length+"份合約"),
    filtered.length===0?ce(Card,{style:{textAlign:"center",padding:32,color:T.muted}},contracts.length===0?"尚無合約，請從報價單轉入":"無符合條件的合約"):
    ce("div",{style:{display:"grid",gap:8}},
      filtered.map(function(c){
        var dl=daysLeft(c.contractEnd);
        var isWarn=dl!==null&&dl>=0&&dl<=90;
        var isExp=dl!==null&&dl<0;
        return ce(Card,{key:c.id,style:{padding:"12px 14px",borderLeft:"3px solid "+(c.status==="用印完成"||c.status==="執行中"?T.sage:c.status==="存檔"?T.border:T.teal)}},
          ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}},
            ce("div",null,
              ce("div",{style:{fontWeight:700,fontSize:13,color:T.text}},c.clientName),
              ce("div",{style:{fontSize:11,color:T.muted,fontFamily:"monospace"}},c.docNo),
              ce("div",{style:{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}},
                ce(TypeBadge,{type:c.docType}),
                ce(StatusBadge,{status:c.status}),
                isWarn&&ce(Tag,{c:"amber"},"續約警示 "+dl+"天"),
                isExp&&ce(Tag,{c:"red"},"已到期"))),
            ce("div",{style:{textAlign:"right"}},
              c.aFee>0&&ce("div",{style:{fontSize:12,fontWeight:700,color:T.amber}},"NT$"+(c.aFee/10000).toFixed(1)+"萬/年"),
              c.signedDate&&ce("div",{style:{fontSize:10,color:T.muted}},"用印："+c.signedDate))),
          ce("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
            ce(Btn,{sz:"sm",v:"ghost",onClick:function(){onOpen(c);}},"\u270f 查看/管理"),
            (c.status==="用印完成"||c.status==="執行中")&&c.docType!=="經銷商合約"&&c.docType!=="補充合約"&&ce(Btn,{sz:"sm",v:"amber",onClick:function(){onNewAdj(c,"upgrade");}},"\u2191 升級補充合約"),
            (c.status==="用印完成"||c.status==="執行中")&&c.docType!=="經銷商合約"&&c.docType!=="補充合約"&&ce(Btn,{sz:"sm",v:"sage",onClick:function(){onNewAdj(c,"renew");}},"\u21bb 啟動續約")));
      })));
}

// ── MAIN APP ───────────────────────────────────────────────────────────────────
export default function App(){
  useArtifactExportButton({source:"quote",version:"v1.13",exact:["rq_quotes","rq_contracts","rq_workorders","l5_staff","l5_partners","l5_distributors"],prefixes:[]});
  var[sess,setSess]=useState(null);
  var[loading,setLoading]=useState(true);
  var[tab,setTab]=useState("quotes");
  var[view,setView]=useState("list");
  var[currentDoc,setCurrentDoc]=useState(null);
  var[quoteType,setQuoteType]=useState("新案報價");
  var[toast,setToast]=useState("");
  // v1.2新增：接收reibi-l5.jsx「操作身份交接」，修正l5缺乏入口連結的問題
  var[l5Ctx,setL5Ctx]=useState(null);

  useEffect(function(){
    stor.g("rq_session").then(function(d){
      if(d){try{setSess(typeof d==="string"?JSON.parse(d):d);}catch(e){setSess(null);}}
      setLoading(false);
    });
    stor.g("l5_active_context").then(function(d){
      if(d){try{setL5Ctx(JSON.parse(d));}catch(e){setL5Ctx(null);}}
    });
  },[]);

  if(loading){
    return ce("div",{style:{minHeight:"100vh",background:"linear-gradient(135deg,#0f766e,#1e3a5f)",display:"flex",alignItems:"center",justifyContent:"center"}},
      ce("div",{style:{color:"#fff",fontSize:14,fontWeight:700}},"REIBI 報價合約系統載入中..."));
  }

  if(!sess){
    return ce("div",{style:{minHeight:"100vh",background:"linear-gradient(135deg,#0f766e,#1e3a5f)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}},
      ce("div",{style:{textAlign:"center",marginBottom:24}},
        ce("div",{style:{fontSize:36,marginBottom:8}},"📝"),
        ce("div",{style:{fontSize:20,fontWeight:900,color:"#fff"}},"REIBI 報價合約系統"),
        ce("div",{style:{fontSize:11,color:"rgba(255,255,255,.7)",marginTop:4}},"Quotation & Contract Management System")),
      ce("div",{style:{background:T.card,borderRadius:20,padding:28,maxWidth:380,width:"100%"}},
        l5Ctx?ce("div",null,
          ce(IBox,{c:"sage",style:{marginBottom:16}},"✅ 偵測到來自L5的操作身份交接：\n"+
            (l5Ctx.staffName?"承辦業務："+l5Ctx.staffName+"\n":"")+
            (l5Ctx.partnerCompany?"經銷商："+l5Ctx.partnerCompany+"("+l5Ctx.partnerOrgCode+")\n":"")+
            "設定時間："+new Date(l5Ctx.setAt).toLocaleString("zh-TW")),
          ce(Btn,{full:true,onClick:function(){
            var s={name:l5Ctx.staffName||l5Ctx.setBy||"L5使用者",role:"super",
              staffId:l5Ctx.staffId||"",partnerOrgCode:l5Ctx.partnerOrgCode||"",partnerCompany:l5Ctx.partnerCompany||""};
            stor.s("rq_session",JSON.stringify(s));
            setSess(s);
          }},"✅ 以此身份進入"),
          ce("div",{style:{marginTop:10}},
            ce(Btn,{full:true,v:"ghost",onClick:function(){setSess({name:"訪客",role:"super"});}},"不套用身份，直接進入(測試模式)"))):
        ce("div",null,
          ce(IBox,{c:"navy",style:{marginBottom:16}},"本系統為 REIBI 專屬管理系統(reibi-l5.jsx)的獨立報價合約模組。\n請先在L5「總覽」頁「📝報價合約快覽」設定操作身份，再切換到本artifact，會自動偵測並帶入。"),
          ce(Btn,{full:true,onClick:function(){setSess({name:"訪客",role:"super"});}},
            "直接進入(測試模式，未設定身份)"))),
      ce("div",{style:{marginTop:16,color:"rgba(255,255,255,.4)",fontSize:10,textAlign:"center"}},
        "© 2024-2025 麗媚生化科技有限公司 REIBI BIO-Technology Co., Ltd."));
  }

  var doToContract=async function(quote){
    var isDistQ=quote.docType==="經銷商報價";
    var contractType=quote.origContractNo?"補充合約":isDistQ?"經銷商合約":quote.docType==="續約報價"?"續約合約":"企業合約";
    var ctTypePrefix=isDistQ?"CT-P":quote.origContractNo?"AD-"+quote.origContractNo:quote.docType==="續約報價"?"CT-RN":"CT";
    var all=await stor.g("rq_contracts");
    var list=all?JSON.parse(all):[];
    var docNo=genDocNo(ctTypePrefix,nextDocSeq(list,ctTypePrefix,curYM()));
    var contract=Object.assign({},quote,{id:"CTR_"+Date.now(),docNo,docType:contractType,status:"草稿(合約)",fromQuoteNo:quote.docNo,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
    list.unshift(contract);
    await stor.s("rq_contracts",JSON.stringify(list));
    var qAll=await stor.g("rq_quotes");
    var qList=qAll?JSON.parse(qAll):[];
    qList=qList.map(function(q){return q.id===quote.id?Object.assign({},q,{status:"已轉合約",linkedContractNo:docNo}):q;});
    await stor.s("rq_quotes",JSON.stringify(qList));
    setTab("contracts");setView("detail");setCurrentDoc(contract);
    setToast("已從報價單 "+quote.docNo+" 轉入合約 "+docNo);
  };

  var doAdjustment=async function(origContract,adjType){
    var pre=adjType==="upgrade"?"新案開通 升級":"新案開通 續約";
    var adjTypePrefix=adjType==="upgrade"?"QT-UP":"QT-RN";
    var listForAdjSeq=await stor.g("rq_quotes");
    listForAdjSeq=listForAdjSeq?JSON.parse(listForAdjSeq):[];
    var newQuote={
      id:"DOC_"+Date.now(),
      docNo:genDocNo(adjTypePrefix,nextDocSeq(listForAdjSeq,adjTypePrefix,curYM())),
      docType:adjType==="upgrade"?"升級報價":"續約報價",
      status:"草稿",
      clientName:origContract.clientName,
      clientAlias:origContract.clientAlias,
      contact:origContract.contact,
      phone:origContract.phone,
      email:origContract.email,
      memberCount:origContract.memberCount,
      origContractNo:origContract.docNo,
      origPlan:origContract.docType,
      origAFee:origContract.aFee?(origContract.aFee/10000).toFixed(1):"",
      origContractEnd:origContract.contractEnd||"",
      upgradeDate:new Date().toISOString().slice(0,10),
      contractStart:adjType==="renew"?(origContract.contractEnd||""):"",
      payMode:origContract.payMode||"annual",
      contractYears:origContract.contractYears||3,
      createdAt:new Date().toISOString(),
      updatedAt:new Date().toISOString(),
      createdBy:sess&&sess.name
    };
    listForAdjSeq.unshift(newQuote);
    await stor.s("rq_quotes",JSON.stringify(listForAdjSeq));
    setTab("quotes");setView("form");setCurrentDoc(newQuote);setQuoteType(newQuote.docType);
    setToast("已從 "+origContract.docNo+" 建立"+(adjType==="upgrade"?"升級":"續約")+"報價單");
  };

  var TABS=[{k:"quotes",l:"📝 報價單"},{k:"contracts",l:"📄 合約"}];

  var doQuickConfirm=async function(preDoc){
    var listForQcSeq=await stor.g("rq_quotes");
    listForQcSeq=listForQcSeq?JSON.parse(listForQcSeq):[];
    var newQuote=Object.assign({},preDoc,{
      id:"DOC_"+Date.now(),
      docNo:genDocNo("QT",nextDocSeq(listForQcSeq,"QT",curYM())),
      docType:"新案報價",
      status:"草稿",
      createdAt:new Date().toISOString(),
      updatedAt:new Date().toISOString(),
      createdBy:sess&&sess.name
    });
    setTab("quotes");setView("form");setCurrentDoc(newQuote);setQuoteType("新案報價");
    setToast("試算已轉入報價單草稿，請確認後儲存");
  };

  return ce("div",{style:{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column"}},
    ce("div",{style:{background:"linear-gradient(135deg,#0f766e,#1e3a5f)",padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}},
      ce("div",{style:{display:"flex",alignItems:"center",gap:10}},
        ce("span",{style:{fontSize:22}},"📝"),
        ce("div",null,
          ce("div",{style:{fontSize:13,fontWeight:800,color:"#fff"}},"REIBI 報價合約系統"),
          ce("div",{style:{fontSize:10,color:"rgba(255,255,255,.7)"}},sess.name+" · Quotation & Contract"))),
      ce("button",{onClick:async function(){await stor.d("rq_session");setSess(null);},
        style:{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.3)",color:"#fff",padding:"5px 12px",borderRadius:8,cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit"}},"登出")),
    ce("div",{style:{display:"flex",gap:0,background:T.card,borderBottom:"1px solid "+T.border,flexShrink:0}},
      TABS.map(function(t){
        return ce("button",{key:t.k,onClick:function(){setTab(t.k);setView("list");setCurrentDoc(null);},
          style:{flex:1,padding:"12px 0",border:"none",borderBottom:"2px solid "+(tab===t.k?T.teal:"transparent"),cursor:"pointer",fontWeight:700,fontSize:13,fontFamily:"inherit",background:"transparent",color:tab===t.k?T.teal:T.muted}},t.l);
      })),
    ce("div",{style:{flex:1,maxWidth:760,width:"100%",margin:"0 auto",padding:"16px 14px 40px",boxSizing:"border-box"}},
      ce(Toast,{msg:toast,onDone:function(){setToast("");}}),
      tab==="quotes"&&view==="list"&&ce(QuoteList,{session:sess,
        onNew:function(type){setQuoteType(type);setCurrentDoc(null);setView("form");},
        onOpen:function(q){setCurrentDoc(q);setQuoteType(q.docType);setView("form");},
        onToContract:doToContract,
        onQuick:function(){setView("quick");}}),
      tab==="quotes"&&view==="quick"&&ce(QuickQuote,{session:sess,
        onBack:function(){setView("list");},
        onConfirm:doQuickConfirm}),
      tab==="quotes"&&view==="form"&&ce(QuoteForm,{session:sess,docType:quoteType,initDoc:currentDoc||{},
        onBack:function(){setView("list");setCurrentDoc(null);},
        onSave:function(doc){setCurrentDoc(doc);setToast("已儲存："+doc.docNo);}}),
      tab==="contracts"&&view==="list"&&ce(ContractList,{session:sess,
        onOpen:function(c){setCurrentDoc(c);setView("detail");},
        onNewAdj:doAdjustment}),
      tab==="contracts"&&view==="detail"&&currentDoc&&ce(ContractView,{session:sess,doc:currentDoc,
        onBack:function(){setView("list");setCurrentDoc(null);},
        onSaved:function(c){setCurrentDoc(c);}})),
    ce("div",{style:{textAlign:"center",padding:"12px 0",fontSize:10,color:T.faint}},
      "© 2024-2025 麗媚生化科技有限公司 REIBI BIO-Technology Co., Ltd. | 版權所有 All Rights Reserved."));
}
