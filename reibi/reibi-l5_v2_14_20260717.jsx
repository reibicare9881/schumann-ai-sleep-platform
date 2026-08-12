import React,{useState,useEffect,useCallback}from"react";
const ce=React.createElement;

// ── DESIGN TOKENS ────────────────────────────────────────────────────────────
const T={
  bg:"#f5f7fa",card:"#ffffff",border:"#e2e8f0",
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

// ── STORAGE HELPERS ───────────────────────────────────────────────────────────
const stor={
  g:async function(k){
    try{var r=await window.storage.get(k);return r?r.value:null;}catch(e){return null;}
  },
  s:async function(k,v){
    try{await window.storage.set(k,typeof v==="string"?v:JSON.stringify(v));}catch(e){}
  },
  d:async function(k){
    try{await window.storage.delete(k);}catch(e){}
  }
};

// ── PIN / AUTH ────────────────────────────────────────────────────────────────
const hashPin=async function(p){
  var b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode("REIBI_L5:"+p));
  return Array.from(new Uint8Array(b)).map(function(x){return x.toString(16).padStart(2,"0");}).join("").slice(0,32);
};

const genCode=function(len){
  var c="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({length:len},function(){return c[Math.floor(Math.random()*c.length)];}).join("");
};

// v2.12新增：orgCode流水號化。seq若未提供則退回舊的隨機3碼(僅作保險，正常呼叫都應搭配nextSeqNum算好的值)。
const nextSeqNum=function(list,prefix,yr){
  var max=0;
  (list||[]).forEach(function(o){
    var code=typeof o==="string"?o:(o&&o.orgCode);
    if(!code)return;
    var m=code.match(new RegExp("^"+prefix+"-[A-Z0-9]+-"+yr+"-(\\d{3,})$"));
    if(m){var n=parseInt(m[1],10);if(n>max)max=n;}
  });
  return String(max+1).padStart(3,"0");
};
const genOrgCode=function(type,alias,year,seq){
  var prefix=type==="partner"?"PTN":type==="sub"?"SUB":"ORG";
  var yr=(year||new Date().getFullYear().toString().slice(2));
  var s=seq||String(Math.floor(Math.random()*900)+100);
  var al=(alias||"XX").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,4).padEnd(2,"X");
  return prefix+"-"+al+"-"+yr+"-"+s;
};

// ── 個人訂閱啟用碼(v2.1新增) ──────────────────────────────────────────────────
// 個人訂閱審核/發票/入帳在此檔案處理(v10.3.23決策，見主平台PROJECT_INSTRUCTIONS第五十七節)。
// 主平台與本檔案storage完全隔離，核准後透過「啟用碼」單向轉交(人工經LINE/Email)，
// 客戶自行在主平台輸入解鎖，全程不需REIBI員工登入主平台寫入資料。
//
// ⚠⚠⚠ 極重要：此處必須用actHashPin(鹽值"REIBI:")，不可用上面的hashPin(鹽值"REIBI_L5:")！
// 兩者鹽值不同，若誤用L5既有hashPin，產生的啟用碼在主平台側全部會驗證失敗。
// 這裡故意獨立宣告一個新函數，避免跟L5登入用的hashPin搞混。
const actHashPin=async function(p){
  var b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode("REIBI:"+p));
  return Array.from(new Uint8Array(b)).map(function(x){return x.toString(16).padStart(2,"0");}).join("").slice(0,32);
};
const ACT_EPOCH=new Date("2026-01-01T00:00:00Z").getTime();
const ACT_PLAN_CHAR={monthly:"M",quarterly:"Q",annual:"A"};
// 方案定義必須與主平台SUB_PLANS的months數字一致，否則到期日算出來會對不上
const PERSONAL_SUB_PLANS=[
  {k:"monthly",label:"月繳體驗",months:1},
  {k:"quarterly",label:"季繳方案",months:3},
  {k:"annual",label:"年繳方案(最優惠)",months:12}
];
const encodeExpDays=function(expiresAtISO){
  var days=Math.round((new Date(expiresAtISO).getTime()-ACT_EPOCH)/86400000);
  return days.toString(36).toUpperCase().padStart(4,"0");
};
// checksum綁定memberCode：同一組碼貼到別的會員帳號會驗證失敗(防呆用途，非密碼學安全)
const activationChecksum=async function(memberCode,planChar,expEnc){
  var h=await actHashPin("ACT:"+memberCode+"|"+planChar+"|"+expEnc);
  return h.slice(0,4).toUpperCase();
};
const makeActivationCode=async function(memberCode,planKey,expiresAtISO){
  var planChar=ACT_PLAN_CHAR[planKey]||"M";
  var expEnc=encodeExpDays(expiresAtISO);
  var checksum=await activationChecksum(memberCode,planChar,expEnc);
  return planChar+expEnc+checksum;
};
const addMonthsISO=function(dateISO,months){
  var d=new Date(dateISO);
  d.setMonth(d.getMonth()+months);
  return d.toISOString();
};

// ── ROLES ─────────────────────────────────────────────────────────────────────
const L5_ROLES={
  super:{key:"super",label:"超級管理員",icon:"🔑",color:T.plum,bg:T.plumBg,
    perms:["all"]},
  finance:{key:"finance",label:"財務管理員",icon:"💰",color:T.amber,bg:T.amberBg,
    perms:["overview_finance","new_case_build","enterprise","payment","distributor","auth_view","manual","reports","personal_sub"]},
  data:{key:"data",label:"數據分析師",icon:"📊",color:T.teal,bg:T.tealBg,
    perms:["overview_data","bigdata","map","strategy","manual","reports"]},
  cs:{key:"cs",label:"客服管理員",icon:"📅",color:T.sage,bg:T.sageBg,
    perms:["overview_cs","tickets","line_push","service_req","manual","reports","personal_sub"]},
  partner_primary:{key:"partner_primary",label:"主經銷商",icon:"🤝",color:T.navy,bg:T.navyBg,
    perms:["overview_partner","my_enterprises","my_payment","my_commission","my_sub","service_req_submit","manual_partner"]},
  partner_sub:{key:"partner_sub",label:"次級經銷商",icon:"🤝",color:T.navy,bg:T.navyBg,
    perms:["overview_partner","my_enterprises","my_payment","my_commission","service_req_submit","manual_partner"]}
};

const hasPerm=function(role,perm){
  if(!role||!L5_ROLES[role])return false;
  var perms=L5_ROLES[role].perms;
  return perms.includes("all")||perms.includes(perm);
};

// ── 經銷商分潤計算(唯一權威來源，v2.6重新定義等級表) ────────────────────────────
// v2.6變更：A/B/C層等級%全面重新定義(每層各自隨等級遞增，不再B/C固定不變)；
// LA200不再獨立算15%+底價保護，併入B層設備一起用B層%計算(使用者2026-07-07決定)；
// 新增REIBI保留下限護欄(每層各自檢查，非三層合計)，預設65%，可由super於「系統設定」調整。
// ⚠️【COMM_TIERS_SYNC_v1｜2026-07-17】此為分潤等級表(soft/device/exec %數值)唯一權威來源。
// quote.jsx的DIST_COMM_TIERS是靜態複製，因Claude.ai artifact間storage互相隔離，無法真正共用同一份JS物件
// (詳見PROJECT_INSTRUCTIONS.md第41節/第59節)，只能靠「相同資料結構」降低人工同步出錯機率(錯誤AF)。
// 兩邊鍵名已統一為：物件(非陣列)，key=等級id(silver/gold/platinum/strategic)，
// 值={l,threshold,soft,device,exec}，soft/device/exec為數字(不含%字元)。
// 【異動SOP】改這裡的soft/device/exec數值後，務必：
//   1. 同步更新quote.jsx對應的DIST_COMM_TIERS物件(可整段Object複製貼上，鍵名已一致不需再手動改)
//   2. 兩邊COMM_TIERS_SYNC_v1後面的日期標記一併更新為同一天，下次比對時日期不同=尚未同步完成
//   3. threshold欄位文字本身允許兩邊措辭不同(l5.jsx為內部管理頁用語，quote.jsx為對外正式文件用語)，
//      但代表的數字門檻(800萬/2000萬/5000萬)必須一致
const L5_COMM_LEVELS={
  silver:{l:"🥈 銀牌",threshold:"首筆起",soft:8,device:10,exec:5},
  gold:{l:"🥇 金牌",threshold:">=800萬",soft:14,device:15,exec:8},
  platinum:{l:"🏆 白金",threshold:">=2000萬",soft:20,device:20,exec:12},
  strategic:{l:"⭐ 戰略",threshold:">=5000萬",soft:28,device:28,exec:18}
};
const L5_COMM_PLAN_PRICES={"基本":600000,"成長":1200000,"專業":1800000,"旗艦":3000000};
const L5_COMM_DEFAULT_MIN_RETAIN_PCT=65; // REIBI每層保留下限預設值(即每層分潤%上限=100-此值)，可於系統設定調整
// A層(soft)/B層(device，含LA200)/C層(exec)分潤：企業對應費用 × 等級%，三層各自獨立計算，互不影響
const calcDistComm=function(dist,enterprises){
  var lv=L5_COMM_LEVELS[dist.level||"silver"];
  var soft=0,device=0,execc=0;
  (enterprises||[]).forEach(function(e){
    if(e.partnerCode!==dist.orgCode)return;
    var aFee=e.aLayerFee||(L5_COMM_PLAN_PRICES[e.plan||"基本"]||240000);
    var bFee=e.bLayerFee||0; // 含LA200，不再拆開算獨立底價保護(v2.6起併入B層)
    var cFee=e.cLayerFee||0;
    var softPct=(dist.softOverride!==undefined&&dist.softOverride!==null)?dist.softOverride:lv.soft;
    var devicePct=(dist.deviceOverride!==undefined&&dist.deviceOverride!==null)?dist.deviceOverride:lv.device;
    var execPct=(dist.execOverride!==undefined&&dist.execOverride!==null)?dist.execOverride:lv.exec;
    soft+=aFee*(softPct/100);
    device+=bFee*(devicePct/100);
    execc+=cFee*(execPct/100);
  });
  return{soft:Math.round(soft),device:Math.round(device),exec:Math.round(execc),
    total:Math.round(soft+device+execc)};
};
// 護欄檢查：單一層(A或B或C)的分潤%是否超過REIBI保留下限換算出的上限(每層各自檢查，不看三層合計)
const checkRetainGuard=function(pct,minRetainPct){
  var cap=100-(minRetainPct!==undefined&&minRetainPct!==null?minRetainPct:L5_COMM_DEFAULT_MIN_RETAIN_PCT);
  return pct<=cap;
};

// ── 企業A/B/C/D層應收明細(唯一權威來源，v2.4新增) ──────────────────────────────
// 修正既有缺陷：原本PaymentScreen自己維護一份完整版(含A2/A3/C層/D層)，
// 但ReportsScreen(付款時程追蹤表)另外維護一份簡化版(只有A1/B1/B2/B3，漏了A2/A3/C層/D層)，
// 導致同一份「應收帳款」在兩個畫面看到的項目數不一致。現統一只保留這一份，兩處都呼叫buildEntPaymentRows。
const L5_PAY_PLAN_PRICES={"基本":600000,"成長":1200000,"專業":1800000,"旗艦":3000000};
const buildEntPaymentRows=function(ent){
  var rows=[];
  var aFee=ent.aLayerFee||(L5_PAY_PLAN_PRICES[ent.plan||"基本"]||240000);
  var payMode=ent.payMode||"annual";
  var contractStart=ent.contractStart||"";
  var y1=contractStart?new Date(new Date(contractStart).setFullYear(new Date(contractStart).getFullYear()+1)).toISOString().slice(0,10):"";
  var y2=contractStart?new Date(new Date(contractStart).setFullYear(new Date(contractStart).getFullYear()+2)).toISOString().slice(0,10):"";
  rows.push({id:ent.id+"_A1",entId:ent.id,entName:ent.orgName,layer:"A層",
    desc:"軟體授權第1年("+{annual:"年繳-5%",semi:"半年繳",quarterly:"季繳+3%"}[payMode]+")",
    amount:aFee,dueDate:contractStart,status:ent.payA1||"待付款",notifiedAt:ent.notifiedA1||""});
  rows.push({id:ent.id+"_A2",entId:ent.id,entName:ent.orgName,layer:"A層",
    desc:"軟體授權第2年",amount:aFee,dueDate:y1,
    status:ent.payA2||"未到期",notifiedAt:ent.notifiedA2||""});
  rows.push({id:ent.id+"_A3",entId:ent.id,entName:ent.orgName,layer:"A層",
    desc:"軟體授權第3年",amount:aFee,dueDate:y2,
    status:ent.payA3||"未到期",notifiedAt:ent.notifiedA3||""});
  var bTotal=ent.bLayerFee||0;
  if(bTotal>0){
    rows.push({id:ent.id+"_B1",entId:ent.id,entName:ent.orgName,layer:"B層",
      desc:"設備訂金(30%)",amount:Math.round(bTotal*0.3),dueDate:contractStart,status:ent.payB1||"待付款",notifiedAt:ent.notifiedB1||""});
    rows.push({id:ent.id+"_B2",entId:ent.id,entName:ent.orgName,layer:"B層",
      desc:"設備到貨款(40%)",amount:Math.round(bTotal*0.4),dueDate:"",status:ent.payB2||"待確認",notifiedAt:ent.notifiedB2||""});
    rows.push({id:ent.id+"_B3",entId:ent.id,entName:ent.orgName,layer:"B層",
      desc:"設備完工款(30%)",amount:Math.round(bTotal*0.3),dueDate:"",status:ent.payB3||"待確認",notifiedAt:ent.notifiedB3||""});
  }
  var cTotal=ent.cLayerFee||0;
  if(cTotal>0){
    rows.push({id:ent.id+"_C1",entId:ent.id,entName:ent.orgName,layer:"C層",
      desc:"高管健促服務第1年("+(ent.cLayerExecs||0)+"人)",amount:cTotal,
      dueDate:contractStart,status:ent.payC1||"待付款",notifiedAt:ent.notifiedC1||""});
    rows.push({id:ent.id+"_C2",entId:ent.id,entName:ent.orgName,layer:"C層",
      desc:"高管健促服務第2年",amount:cTotal,dueDate:y1,
      status:ent.payC2||"未到期",notifiedAt:ent.notifiedC2||""});
    rows.push({id:ent.id+"_C3",entId:ent.id,entName:ent.orgName,layer:"C層",
      desc:"高管健促服務第3年",amount:cTotal,dueDate:y2,
      status:ent.payC3||"未到期",notifiedAt:ent.notifiedC3||""});
  }
  var dTotal=ent.dLayerFee||0;
  if(dTotal>0){
    rows.push({id:ent.id+"_D1",entId:ent.id,entName:ent.orgName,layer:"D層",
      desc:"識能佈置訂金(50%)",amount:Math.round(dTotal*0.5),
      dueDate:contractStart,status:ent.payD1||"待付款",notifiedAt:ent.notifiedD1||""});
    rows.push({id:ent.id+"_D2",entId:ent.id,entName:ent.orgName,layer:"D層",
      desc:"識能佈置驗收款(50%)",amount:Math.round(dTotal*0.5),
      dueDate:"",status:ent.payD2||"待確認",notifiedAt:ent.notifiedD2||""});
  }
  return rows;
};

// ── UI PRIMITIVES ─────────────────────────────────────────────────────────────
function Btn(props){
  var onClick=props.onClick,children=props.children,v=props.v||"primary",sz=props.sz||"md",disabled=props.disabled,full=props.full,sx=props.style||{};
  var sizes={sm:{padding:"5px 12px",fontSize:11},md:{padding:"9px 18px",fontSize:13},lg:{padding:"12px 24px",fontSize:14}};
  var vars={
    primary:{background:T.teal,color:"#fff",border:"none"},
    sage:{background:T.sageBg,color:T.sage,border:"1px solid #86efac"},
    amber:{background:T.amberBg,color:T.amber,border:"1px solid #fcd34d"},
    ghost:{background:"transparent",color:T.muted,border:"1px solid "+T.border},
    danger:{background:T.redBg,color:T.red,border:"1px solid #fca5a5"},
    plum:{background:T.plumBg,color:T.plum,border:"1px solid #c4b5fd"},
    navy:{background:T.navyBg,color:T.navy,border:"1px solid #93c5fd"},
    gold:{background:T.goldBg,color:T.gold,border:"1px solid #fcd34d"},
    green:{background:T.greenBg,color:T.green,border:"1px solid #86efac"}
  };
  return ce("button",{
    onClick:disabled?undefined:onClick,
    style:Object.assign({},
      {borderRadius:8,cursor:disabled?"not-allowed":"pointer",fontWeight:600,fontFamily:"inherit",
       opacity:disabled?.5:1,transition:"all .12s",outline:"none"},
      full?{width:"100%",display:"block"}:{},
      sizes[sz]||sizes.md,
      vars[v]||vars.primary,
      sx)
  },children);
}

function Card(props){
  return ce("div",{onClick:props.onClick,style:Object.assign({},
    {background:T.card,border:"1px solid "+T.border,borderRadius:12,padding:18,boxShadow:T.sh},
    props.onClick?{cursor:"pointer"}:{},
    props.style||{})},props.children);
}

function IBox(props){
  var cols={
    teal:{background:T.tealBg,border:"1px solid "+T.tealLight,color:T.teal},
    amber:{background:T.amberBg,border:"1px solid #fcd34d",color:T.amber},
    red:{background:T.redBg,border:"1px solid #fca5a5",color:T.red},
    sage:{background:T.sageBg,border:"1px solid #86efac",color:T.sage},
    navy:{background:T.navyBg,border:"1px solid #93c5fd",color:T.navy},
    plum:{background:T.plumBg,border:"1px solid #c4b5fd",color:T.plum},
    gold:{background:T.goldBg,border:"1px solid #fcd34d",color:T.gold}
  };
  return ce("div",{style:Object.assign({},
    {borderRadius:8,padding:"10px 14px",fontSize:12,lineHeight:1.7},
    cols[props.c||"teal"]||cols.teal,
    props.style||{})},props.children);
}

function Tag(props){
  var m={
    teal:{bg:T.tealBg,color:T.teal},sage:{bg:T.sageBg,color:T.sage},
    amber:{bg:T.amberBg,color:T.amber},plum:{bg:T.plumBg,color:T.plum},
    red:{bg:T.redBg,color:T.red},gray:{bg:"#f1f5f9",color:T.muted},
    navy:{bg:T.navyBg,color:T.navy},gold:{bg:T.goldBg,color:T.gold},
    green:{bg:T.greenBg,color:T.green}
  };
  var s=m[props.c||"teal"]||m.teal;
  return ce("span",{style:{display:"inline-block",padding:"2px 9px",borderRadius:20,fontSize:11,fontWeight:700,background:s.bg,color:s.color}},props.children);
}

function Inp(props){
  return ce("div",{style:props.style||{}},
    props.label&&ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4,fontWeight:600}},props.label),
    ce("input",{type:props.type||"text",value:props.value,onChange:props.onChange,placeholder:props.placeholder||"",list:props.list||undefined,
      style:{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,
        boxSizing:"border-box",color:T.text,background:T.card,outline:"none"}}));
}

function Select(props){
  return ce("div",{style:props.style||{}},
    props.label&&ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4,fontWeight:600}},props.label),
    ce("select",{value:props.value,onChange:props.onChange,
      style:{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,
        color:T.text,background:T.card,outline:"none",boxSizing:"border-box"}},
      props.children));
}

function SecTitle(props){
  return ce("h3",{style:{fontSize:14,fontWeight:700,color:T.teal,marginBottom:12,marginTop:0,
    borderBottom:"2px solid "+T.tealLight,paddingBottom:6}},props.children);
}

function Divider(){return ce("div",{style:{height:1,background:T.border,margin:"14px 0"}});}

function Toast(props){
  useEffect(function(){
    if(props.msg){var t=setTimeout(props.onDone,3000);return function(){clearTimeout(t);};}
  },[props.msg]);
  if(!props.msg)return null;
  return ce("div",{style:{background:T.text,color:"#fff",padding:"10px 22px",borderRadius:24,
    fontSize:13,fontWeight:600,textAlign:"center",margin:"8px auto 4px",maxWidth:460,
    boxShadow:"0 4px 16px rgba(0,0,0,.2)"}},props.msg);
}

function StatusBadge(props){
  var m={
    "啟用中":{bg:"#f0fdf4",c:"#166534",br:"#86efac"},
    "試用中":{bg:"#fffbeb",c:"#92400e",br:"#fcd34d"},
    "暫停":{bg:"#fef2f2",c:"#dc2626",br:"#fca5a5"},
    "終止":{bg:"#f8fafc",c:"#64748b",br:"#e2e8f0"},
    "待啟用":{bg:"#f5f3ff",c:"#6d28d9",br:"#c4b5fd"}
  };
  var s=m[props.status]||m["待啟用"];
  return ce("span",{style:{padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700,
    background:s.bg,color:s.c,border:"1px solid "+s.br}},props.status);
}

function PlanBadge(props){
  var m={
    "基本":{bg:"#f1f5f9",c:"#475569"},
    "成長":{bg:"#f0fdfa",c:"#0f766e"},
    "專業":{bg:"#eff6ff",c:"#1e3a5f"},
    "旗艦":{bg:"#fef3c7",c:"#92400e"}
  };
  var s=m[props.plan]||m["基本"];
  return ce("span",{style:{padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700,
    background:s.bg,color:s.c}},props.plan||"基本");
}

// ── DATE RANGE PICKER ─────────────────────────────────────────────────────────
function DateRangePicker(props){
  var presets=[
    {l:"本月",v:"this_month"},{l:"上月",v:"last_month"},
    {l:"本季",v:"this_quarter"},{l:"上季",v:"last_quarter"},
    {l:"本年度",v:"this_year"},{l:"上年度",v:"last_year"},
    {l:"自訂",v:"custom"}
  ];
  var[preset,setPreset]=useState("this_month");
  var[start,setStart]=useState("");
  var[end,setEnd]=useState("");

  var calcRange=function(p){
    var now=new Date();
    var y=now.getFullYear();
    var m=now.getMonth();
    if(p==="this_month")return{s:new Date(y,m,1).toISOString().slice(0,10),e:new Date(y,m+1,0).toISOString().slice(0,10)};
    if(p==="last_month")return{s:new Date(y,m-1,1).toISOString().slice(0,10),e:new Date(y,m,0).toISOString().slice(0,10)};
    if(p==="this_quarter"){var q=Math.floor(m/3);return{s:new Date(y,q*3,1).toISOString().slice(0,10),e:new Date(y,q*3+3,0).toISOString().slice(0,10)};}
    if(p==="last_quarter"){var q2=Math.floor(m/3)-1;var yy=q2<0?y-1:y;var qq=q2<0?3:q2;return{s:new Date(yy,qq*3,1).toISOString().slice(0,10),e:new Date(yy,qq*3+3,0).toISOString().slice(0,10)};}
    if(p==="this_year")return{s:y+"-01-01",e:y+"-12-31"};
    if(p==="last_year")return{s:(y-1)+"-01-01",e:(y-1)+"-12-31"};
    return null;
  };

  var doPreset=function(p){
    setPreset(p);
    if(p!=="custom"){var r=calcRange(p);if(r&&props.onChange)props.onChange(r.s,r.e);}
  };

  useEffect(function(){var r=calcRange("this_month");if(r&&props.onChange)props.onChange(r.s,r.e);},[]);

  return ce("div",{style:{background:T.bg,borderRadius:10,padding:"10px 14px",marginBottom:14}},
    ce("div",{style:{display:"flex",gap:6,flexWrap:"wrap",marginBottom:preset==="custom"?8:0}},
      presets.map(function(p){
        return ce("button",{key:p.v,onClick:function(){doPreset(p.v);},
          style:{padding:"4px 10px",borderRadius:20,border:"1px solid "+(preset===p.v?T.teal:T.border),
            fontSize:11,fontWeight:700,cursor:"pointer",
            background:preset===p.v?T.teal:"transparent",
            color:preset===p.v?"#fff":T.muted,fontFamily:"inherit"}},p.l);
      })),
    preset==="custom"&&ce("div",{style:{display:"flex",gap:8,alignItems:"center",marginTop:6}},
      ce("input",{type:"date",value:start,onChange:function(e){setStart(e.target.value);},
        style:{flex:1,padding:"6px 8px",borderRadius:6,border:"1px solid "+T.border,fontSize:12}}),
      ce("span",{style:{color:T.muted,fontSize:12}},"—"),
      ce("input",{type:"date",value:end,onChange:function(e){setEnd(e.target.value);},
        style:{flex:1,padding:"6px 8px",borderRadius:6,border:"1px solid "+T.border,fontSize:12}}),
      ce(Btn,{sz:"sm",onClick:function(){if(start&&end&&props.onChange)props.onChange(start,end);}},"查詢")));
}

// ── MINI CHART (Bar) ─────────────────────────────────────────────────────────
function MiniBar(props){
  var data=props.data||[];
  var max=Math.max.apply(null,data.map(function(d){return d.v||0;}))||1;
  return ce("div",{style:{display:"flex",alignItems:"flex-end",gap:4,height:props.h||60}},
    data.map(function(d){
      var pct=Math.round((d.v/max)*100);
      return ce("div",{key:d.l,style:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}},
        ce("div",{style:{width:"100%",background:props.color||T.teal,borderRadius:"3px 3px 0 0",
          height:pct+"%",minHeight:d.v>0?4:0,transition:"height .3s"}}),
        ce("div",{style:{fontSize:9,color:T.faint,textAlign:"center"}},d.l));
    }));
}

// 三維雷達圖(企業平均：睡眠ISI × 疼痛BPI × 身心MHI，純SVG，無外部圖表庫)
// 三軸皆正規化為 0-100，分數越高代表狀態越好
// TODO(正式串接)：目前為模擬數據，正式上線需由主平台寫入去識別化彙總統計(見下方「跨系統匯總資料結構設計」)
function RadarChart3(props){
  var data=props.data||[];
  var W=240,H=240,cx=W/2,cy=H/2,R=86;
  var n=data.length||3;
  var angle=function(i){return -Math.PI/2+(i*2*Math.PI/n);};
  var pt=function(i,r){return [cx+r*Math.cos(angle(i)),cy+r*Math.sin(angle(i))];};
  var rings=[0.25,0.5,0.75,1];
  var dataPts=data.map(function(d,i){var p=pt(i,R*Math.max(0,Math.min(100,d.value))/100);return p[0]+","+p[1];}).join(" ");
  return ce("svg",{width:"100%",height:H,viewBox:"0 0 "+W+" "+H},
    rings.map(function(r,ri){
      var ringPts=data.map(function(d,i){var p=pt(i,R*r);return p[0]+","+p[1];}).join(" ");
      return ce("polygon",{key:"ring"+ri,points:ringPts,fill:"none",stroke:T.border,strokeWidth:1});
    }),
    data.map(function(d,i){
      var p=pt(i,R);
      return ce("line",{key:"axis"+i,x1:cx,y1:cy,x2:p[0],y2:p[1],stroke:T.border,strokeWidth:1});
    }),
    ce("polygon",{points:dataPts,fill:(props.fillColor||T.plum)+"33",stroke:props.fillColor||T.plum,strokeWidth:2}),
    data.map(function(d,i){
      var p=pt(i,R*Math.max(0,Math.min(100,d.value))/100);
      return ce("circle",{key:"pt"+i,cx:p[0],cy:p[1],r:4,fill:d.color||props.fillColor||T.plum});
    }),
    data.map(function(d,i){
      var lp=pt(i,R+22);
      return ce("text",{key:"lbl"+i,x:lp[0],y:lp[1],fontSize:11,fontWeight:700,fill:T.text,
        textAnchor:i===0?"middle":(lp[0]<cx-5?"end":lp[0]>cx+5?"start":"middle")},d.label+"("+d.value+")");
    }));
}

// 通用 CSV 真實匯出工具(Blob+a標籤下載，無外部套件，UTF-8 BOM確保Excel開啟不亂碼)
function downloadCSV(filename,rows){
  // rows: 二維陣列 [[欄1,欄2,...],...]，第一列建議為標題列
  var esc=function(v){
    var s=(v===null||v===undefined)?"":String(v);
    if(/[",\n]/.test(s))s='"'+s.replace(/"/g,'""')+'"';
    return s;
  };
  var csv=rows.map(function(r){return r.map(esc).join(",");}).join("\r\n");
  var blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  var url=URL.createObjectURL(blob);
  var a=document.createElement("a");
  a.href=url;
  a.download=filename.indexOf(".csv")>=0?filename:filename+".csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function(){URL.revokeObjectURL(url);},1000);
}

// ── MODAL ─────────────────────────────────────────────────────────────────────
function Modal(props){
  if(!props.open)return null;
  return ce("div",{
    style:{position:"absolute",top:0,left:0,right:0,bottom:0,
      background:"rgba(0,0,0,.45)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",
      minHeight:"100vh"}},
    ce("div",{style:{background:T.card,borderRadius:16,padding:24,maxWidth:480,width:"90%",
      boxShadow:T.sh2,maxHeight:"80vh",overflowY:"auto"}},
      props.children));
}

// ── LOGIN SCREEN ──────────────────────────────────────────────────────────────
function LoginScreen(props){
  var onLogin=props.onLogin;
  var[mode,setMode]=useState(null);
  var[role,setRole]=useState("");
  var[name,setName]=useState("");
  var[pin,setPin]=useState("");
  var[loading,setLoading]=useState(false);
  var[err,setErr]=useState("");
  var[firstTime,setFirstTime]=useState(false);
  var[firstTimePartner,setFirstTimePartner]=useState(null);
  var[newPin,setNewPin]=useState("");
  var[newPin2,setNewPin2]=useState("");
  var[partnerOrgCode,setPartnerOrgCode]=useState("");
  var[partnerCompany,setPartnerCompany]=useState("");

  var internalRoles=[
    {k:"super",icon:"🔑",label:"超級管理員",desc:"全功能．企業開通．授權管理"},
    {k:"finance",icon:"💰",label:"財務管理員",desc:"費用建置．分潤對帳．報表"},
    {k:"data",icon:"📊",label:"數據分析師",desc:"大數據分析．白皮書匯出"},
    {k:"cs",icon:"📅",label:"客服管理員",desc:"工單排程．LINE推播．服務申請"}
  ];
  var partnerRoles=[
    {k:"partner_primary",icon:"🤝",label:"主經銷商",desc:"管理企業．查看佣金．次級管理"},
    {k:"partner_sub",icon:"🤝",label:"次級經銷商",desc:"管理企業．查看佣金"}
  ];

  var doLogin=async function(){
    setErr("");
    if(!role){setErr("請選擇角色");return;}
    if(!name.trim()){setErr("請填入姓名");return;}
    if(!pin.trim()||pin.length<4){setErr("PIN至少4位");return;}
    var isPartnerRole=role==="partner_primary"||role==="partner_sub";
    if(isPartnerRole){
      if(!partnerOrgCode.trim()){setErr("請填入貴公司REIBI授權代碼");return;}
      if(!partnerCompany.trim()){setErr("請填入公司名稱");return;}
    }
    setLoading(true);
    await new Promise(function(r){setTimeout(r,400);});
    if(isPartnerRole){
      var dists=await stor.g("l5_distributors");
      var distList=dists?JSON.parse(dists):[];
      var inputCode=partnerOrgCode.trim().toUpperCase();
      var inputName=partnerCompany.trim();
      var matched=distList.find(function(d){
        var codeMatch=d.orgCode===inputCode;
        var nameMatch=d.name&&(d.name.includes(inputName)||inputName.includes(d.name.slice(0,4)));
        return codeMatch&&nameMatch&&d.status==="active";
      });
      if(!matched){
        var codeOnly=distList.find(function(d){return d.orgCode===inputCode;});
        if(codeOnly&&codeOnly.status==="active"){
          setErr("公司名稱與授權代碼不符，請確認後再試。如有疑問請洽麗媚：LINE @reibicare");
        } else {
          setErr("此公司不存在或尚未取得授權，請洽麗媚公司查詢。LINE @reibicare | Email: reibiservice@gmail.com");
        }
        setLoading(false);return;
      }
      var dummy_matched=matched;
      matched=dummy_matched;
      var storedPin=await stor.g("l5_pin_partner_"+matched.id);
      if(!storedPin){
        setFirstTimePartner(matched);setFirstTime(true);setLoading(false);return;
      }
      var h2=await hashPin(pin);
      if(h2!==storedPin){setErr("PIN錯誤，請再試一次。");setLoading(false);return;}
      var sess2={role:role,name:name.trim(),partnerOrgCode:matched.orgCode,partnerCompany:matched.name,partnerId:matched.id,loginTs:new Date().toISOString()};
      await stor.s("l5_session",JSON.stringify(sess2));
      onLogin(sess2);
      setLoading(false);return;
    }
    var stored=await stor.g("l5_pin_"+role);
    if(!stored){
      setFirstTime(true);setLoading(false);return;
    }
    var h=await hashPin(pin);
    if(h!==stored){setErr("PIN錯誤，請再試一次。");setLoading(false);return;}
    var sess={role:role,name:name.trim(),loginTs:new Date().toISOString()};
    await stor.s("l5_session",JSON.stringify(sess));
    onLogin(sess);
    setLoading(false);
  };

  var doSetPin=async function(){
    if(newPin.length<4){setErr("新PIN至少4位");return;}
    if(newPin!==newPin2){setErr("兩次PIN不一致");return;}
    var h=await hashPin(newPin);
    if(firstTimePartner){
      // v2.4修正：既有bug — 原本此處一律寫入"l5_pin_"+role(所有同類型經銷商共用一個key)，
      // 且建立的session缺少partnerOrgCode/partnerCompany/partnerId，導致經銷商登入後在
      // DistributorScreen/EnterpriseScreen/PaymentScreen等畫面完全看不到自己的資料(欄位名稱也對不上)。
      await stor.s("l5_pin_partner_"+firstTimePartner.id,h);
      var sess2={role:role,name:name.trim(),partnerOrgCode:firstTimePartner.orgCode,partnerCompany:firstTimePartner.name,partnerId:firstTimePartner.id,loginTs:new Date().toISOString()};
      await stor.s("l5_session",JSON.stringify(sess2));
      onLogin(sess2);
      return;
    }
    await stor.s("l5_pin_"+role,h);
    var sess={role:role,name:name.trim(),loginTs:new Date().toISOString()};
    await stor.s("l5_session",JSON.stringify(sess));
    onLogin(sess);
  };

  if(firstTime){
    return ce("div",{style:{minHeight:"100vh",background:"linear-gradient(135deg,#0f766e,#1e3a5f)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:20}},
      ce("div",{style:{background:T.card,borderRadius:20,padding:32,maxWidth:400,width:"100%",boxShadow:T.sh2}},
        ce("div",{style:{textAlign:"center",marginBottom:20}},
          ce("div",{style:{fontSize:32,marginBottom:8}},"🔐"),
          ce("h2",{style:{fontSize:18,fontWeight:800,color:T.text,margin:0}},"首次登入 — 設定PIN"),
          ce("p",{style:{fontSize:12,color:T.muted,marginTop:6}},"角色："+L5_ROLES[role].icon+" "+L5_ROLES[role].label+(firstTimePartner?"("+firstTimePartner.name+" · "+firstTimePartner.orgCode+")":""))),
        ce(IBox,{c:"amber",style:{marginBottom:16}},firstTimePartner?"首次使用請設定專屬PIN碼(至少4位)。此PIN僅供「"+firstTimePartner.name+"」使用，設定後需妥善保管，遺忘時請聯絡麗媚客服重設。":"首次使用請設定專屬PIN碼(至少4位)。設定後需妥善保管，遺忘時請聯絡超級管理員重設。"),
        ce("div",{style:{display:"grid",gap:10}},
          ce(Inp,{label:"設定新PIN *",type:"password",value:newPin,onChange:function(e){setNewPin(e.target.value);},placeholder:"至少4位"}),
          ce(Inp,{label:"再次確認PIN *",type:"password",value:newPin2,onChange:function(e){setNewPin2(e.target.value);},placeholder:"請再輸入一次"}),
          err&&ce(IBox,{c:"red"},err),
          ce(Btn,{onClick:doSetPin,full:true,sz:"lg"},"確認設定，進入系統"))));
  }

  return ce("div",{style:{minHeight:"100vh",background:"linear-gradient(135deg,#0f766e 0%,#1e3a5f 60%,#2d1b69 100%)",
    display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}},
    ce("div",{style:{textAlign:"center",marginBottom:24}},
      ce("div",{style:{fontSize:40,marginBottom:8}},"🛡"),
      ce("div",{style:{fontSize:22,fontWeight:900,color:"#fff",letterSpacing:1}},"REIBI 專屬管理系統"),
      ce("div",{style:{fontSize:12,color:"rgba(255,255,255,.7)",marginTop:4}},"REIBI BIO-Technology · Internal Management System")),
    ce("div",{style:{background:T.card,borderRadius:20,padding:28,maxWidth:480,width:"100%",boxShadow:T.sh2}},
      mode===null&&ce("div",null,
        ce("div",{style:{fontSize:13,fontWeight:700,color:T.muted,marginBottom:14,textAlign:"center"}},"請選擇登入類型"),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:8}},
          ce(Card,{onClick:function(){setMode("internal");setRole("");},
            style:{textAlign:"center",padding:"20px 16px",cursor:"pointer",
              border:"2px solid "+T.border,borderRadius:14}},
            ce("div",{style:{fontSize:32,marginBottom:8}},"🏢"),
            ce("div",{style:{fontWeight:700,fontSize:14,color:T.teal}},"麗媚管理人員"),
            ce("div",{style:{fontSize:11,color:T.muted,marginTop:4}},"內部四角色")),
          ce(Card,{onClick:function(){setMode("partner");setRole("");},
            style:{textAlign:"center",padding:"20px 16px",cursor:"pointer",
              border:"2px solid "+T.border,borderRadius:14}},
            ce("div",{style:{fontSize:32,marginBottom:8}},"🤝"),
            ce("div",{style:{fontWeight:700,fontSize:14,color:T.navy}},"授權夥伴登入"),
            ce("div",{style:{fontSize:11,color:T.muted,marginTop:4}},"主經銷商 / 次級")))),

      mode==="internal"&&ce("div",null,
        ce("button",{onClick:function(){setMode(null);setRole("");setErr("");},
          style:{background:"none",border:"none",cursor:"pointer",color:T.teal,fontSize:12,
            fontWeight:700,marginBottom:14,fontFamily:"inherit"}},
          "← 返回選擇"),
        ce("div",{style:{fontSize:13,fontWeight:700,color:T.muted,marginBottom:10}},"選擇角色"),
        ce("div",{style:{display:"grid",gap:8,marginBottom:14}},
          internalRoles.map(function(r){
            var info=L5_ROLES[r.k];
            return ce("div",{key:r.k,onClick:function(){setRole(r.k);},
              style:{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:10,
                cursor:"pointer",border:"2px solid "+(role===r.k?info.color:T.border),
                background:role===r.k?info.bg:T.card,transition:"all .12s"}},
              ce("div",{style:{fontSize:24}}),
              ce("div",null,
                ce("div",{style:{fontWeight:700,fontSize:13,color:role===r.k?info.color:T.text}},r.icon+" "+r.label),
                ce("div",{style:{fontSize:11,color:T.muted}},r.desc)));
          })),
        role&&ce("div",{style:{display:"grid",gap:10}},
          ce(Inp,{label:"姓名 *",value:name,onChange:function(e){setName(e.target.value);},placeholder:"請填入姓名"}),
          ce(Inp,{label:"PIN *",type:"password",value:pin,onChange:function(e){setPin(e.target.value);},placeholder:"請輸入PIN碼"}),
          err&&ce(IBox,{c:"red"},err),
          ce(Btn,{onClick:doLogin,disabled:loading,full:true,sz:"lg"},loading?"驗證中...":"登入"))),

      mode==="partner"&&ce("div",null,
        ce("button",{onClick:function(){setMode(null);setRole("");setErr("");},
          style:{background:"none",border:"none",cursor:"pointer",color:T.teal,fontSize:12,
            fontWeight:700,marginBottom:14,fontFamily:"inherit"}},
          "← 返回選擇"),
        ce(IBox,{c:"navy",style:{marginBottom:14}},"🤝 授權夥伴登入\n請選擇您的合作角色，使用麗媚提供的初始PIN登入後可自行修改。"),
        ce("div",{style:{display:"grid",gap:8,marginBottom:14}},
          partnerRoles.map(function(r){
            return ce("div",{key:r.k,onClick:function(){setRole(r.k);},
              style:{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:10,
                cursor:"pointer",border:"2px solid "+(role===r.k?T.navy:T.border),
                background:role===r.k?T.navyBg:T.card,transition:"all .12s"}},
              ce("div",null,
                ce("div",{style:{fontWeight:700,fontSize:13,color:role===r.k?T.navy:T.text}},r.icon+" "+r.label),
                ce("div",{style:{fontSize:11,color:T.muted}},r.desc)));
          })),
        role&&ce("div",{style:{display:"grid",gap:10}},
          ce(IBox,{c:"amber",style:{fontSize:11}},"請填入貴公司資料，系統將驗證是否為 REIBI 授權合作夥伴。未取得授權請洽麗媚：LINE @reibicare"),
          ce(Inp,{label:"公司名稱 *",value:partnerCompany,onChange:function(e){setPartnerCompany(e.target.value);},placeholder:"請填入貴公司正式名稱"}),
          ce(Inp,{label:"REIBI 授權代碼 *(由麗媚提供)",value:partnerOrgCode,onChange:function(e){setPartnerOrgCode(e.target.value.toUpperCase());},placeholder:"例：PTN-WANG-25-001"}),
          ce(Inp,{label:"聯絡人姓名 *",value:name,onChange:function(e){setName(e.target.value);},placeholder:"請填入您的姓名"}),
          ce(Inp,{label:"PIN *(首次使用麗媚提供的初始PIN)",type:"password",value:pin,onChange:function(e){setPin(e.target.value);},placeholder:"請輸入PIN碼"}),
          err&&ce(IBox,{c:"red"},err),
          ce(Btn,{onClick:doLogin,disabled:loading,full:true,sz:"lg",v:"navy"},loading?"驗證授權中...":"登入夥伴系統")))),
    ce("div",{style:{marginTop:20,textAlign:"center",color:"rgba(255,255,255,.5)",fontSize:11}},
      "僅供麗媚授權人員使用 · 所有操作均記錄於稽核日誌"),
    ce("div",{style:{marginTop:6,textAlign:"center",color:"rgba(255,255,255,.3)",fontSize:10}},
      "© 2024-2025 麗媚生化科技有限公司 REIBI BIO-Technology Co., Ltd. | 版權所有 All Rights Reserved."));
}

// ── OVERVIEW SCREEN ───────────────────────────────────────────────────────────
function OverviewScreen(props){
  var session=props.session;
  var role=session&&session.role;
  var[enterprises,setEnterprises]=useState([]);
  var[distributors,setDistributors]=useState([]);
  var[tickets,setTickets]=useState([]);
  var[personalSubs,setPersonalSubs]=useState([]);

  useEffect(function(){
    stor.g("l5_enterprises").then(function(d){if(d)setEnterprises(JSON.parse(d));});
    stor.g("l5_distributors").then(function(d){if(d)setDistributors(JSON.parse(d));});
    stor.g("l5_tickets").then(function(d){if(d)setTickets(JSON.parse(d));});
    stor.g("l5_personal_subs").then(function(d){if(d)setPersonalSubs(JSON.parse(d));});
  },[]);

  var activeEnts=enterprises.filter(function(e){return e.status==="啟用中";});
  var trialEnts=enterprises.filter(function(e){return e.status==="試用中";});
  var totalMembers=enterprises.reduce(function(a,e){return a+(parseInt(e.memberCount)||0);},0);
  var alertEnts=enterprises.filter(function(e){
    var used=parseInt(e.usedCount)||0;
    var total=parseInt(e.memberCount)||1;
    return (used/total)>=0.9;
  });
  var pendingTickets=tickets.filter(function(t){return t.status==="待處理";});
  var expiringSoon=enterprises.filter(function(e){
    if(!e.contractEnd)return false;
    var d=(new Date(e.contractEnd)-new Date())/(1000*60*60*24);
    return d>=0&&d<=30;
  });

  var annualRevEst=enterprises.reduce(function(a,e){
    var plan=e.plan||"基本";
    var prices={"基本":600000,"成長":1200000,"專業":1800000,"旗艦":3000000};
    return a+(prices[plan]||120000);
  },0);

  // v2.2新增：個人訂閱(B2C)已核准累計收款彙整，與企業年收預估並列呈現(第十九節中優先待辦)
  var approvedPSubs=personalSubs.filter(function(r){return r.status==="已核准";});
  var personalSubRevenue=approvedPSubs.reduce(function(a,r){return a+(parseInt(r.amount)||0);},0);

  var kpis=[
    {icon:"🏢",label:"企業總數",value:enterprises.length,sub:"啟用"+activeEnts.length+" · 試用"+trialEnts.length,color:T.teal,show:true},
    {icon:"👥",label:"總服務人數",value:totalMembers,sub:"跨所有企業",color:T.navy,show:hasPerm(role,"overview_finance")||hasPerm(role,"all")},
    {icon:"💰",label:"年收預估",value:"NT$"+(annualRevEst/10000).toFixed(0)+"萬",sub:"A層授權費合計",color:T.amber,show:hasPerm(role,"overview_finance")||hasPerm(role,"all")},
    {icon:"⭐",label:"個人訂閱(B2C)收款",value:"NT$"+personalSubRevenue.toLocaleString(),sub:approvedPSubs.length+"筆已核准(不含經銷商分潤)",color:T.gold,show:hasPerm(role,"overview_finance")||hasPerm(role,"all")},
    {icon:"🤝",label:"經銷商數",value:distributors.length,sub:"主"+distributors.filter(function(d){return d.type==="primary";}).length+" · 次級"+distributors.filter(function(d){return d.type==="sub";}).length,color:T.plum,show:hasPerm(role,"all")||hasPerm(role,"overview_finance")}
  ].filter(function(k){return k.show;});

  var alerts=[];
  if(alertEnts.length>0)alerts.push({icon:"⚠",color:T.amber,msg:"帳號使用率≥90% — "+alertEnts.length+"家企業需關注"});
  if(expiringSoon.length>0)alerts.push({icon:"📅",color:T.coral,msg:"30天內合約到期 — "+expiringSoon.length+"家企業"});
  if(pendingTickets.length>0)alerts.push({icon:"🎫",color:T.teal,msg:"待處理工單 — "+pendingTickets.length+"件"});

  var monthlyData=[
    {l:"1月",v:2},{l:"2月",v:3},{l:"3月",v:1},{l:"4月",v:4},
    {l:"5月",v:2},{l:"6月",v:5},{l:"7月",v:3},{l:"8月",v:4},
    {l:"9月",v:6},{l:"10月",v:3},{l:"11月",v:5},{l:"12月",v:7}
  ];

  var[quoteStats,setQuoteStats]=useState({pending:0,confirmed:0,total:0});
  var[contractStats,setContractStats]=useState({pending_sign:0,active:0,expiring90:0,total:0});
  var[woStats,setWoStats]=useState({pending:0,anomaly:0,total:0});
  // v2.5新增：報價合約系統操作身份交接(修正l5缺入口連結問題)
  var[staffListLink,setStaffListLink]=useState([]);
  var[linkStaffId,setLinkStaffId]=useState("");
  var[linkSetOk,setLinkSetOk]=useState(false);

  useEffect(function(){
    stor.g("rq_quotes").then(function(d){
      if(d){
        var list=JSON.parse(d);
        setQuoteStats({
          pending:list.filter(function(q){return q.status==="已發送"||q.status==="待確認";}).length,
          confirmed:list.filter(function(q){return q.status==="已確認";}).length,
          total:list.length
        });
      }
    });
    stor.g("rq_contracts").then(function(d){
      if(d){
        var list=JSON.parse(d);
        var now=new Date();
        setContractStats({
          pending_sign:list.filter(function(c){return c.status==="待用印";}).length,
          active:list.filter(function(c){return c.status==="用印完成"||c.status==="執行中";}).length,
          expiring90:list.filter(function(c){
            if(!c.contractEnd)return false;
            var d=(new Date(c.contractEnd)-now)/(1000*60*60*24);
            return d>=0&&d<=90;
          }).length,
          total:list.length
        });
      }
    });
    stor.g("rq_workorders").then(function(d){
      if(d){
        var list=JSON.parse(d);
        setWoStats({
          pending:list.filter(function(w){return w.status==="待驗收";}).length,
          anomaly:list.filter(function(w){return w.status==="驗收異常";}).length,
          total:list.length
        });
      }
    });
    stor.g("l5_staff").then(function(d){if(d)setStaffListLink(JSON.parse(d));});
  },[]);

  return ce("div",{style:{display:"grid",gap:14}},
    ce(Card,{style:{background:"linear-gradient(135deg,#0f766e,#1e3a5f)",border:"none"}},
      ce("div",{style:{color:"#fff"}},
        ce("div",{style:{fontSize:13,opacity:.8,marginBottom:4}},"歡迎回來"),
        ce("div",{style:{fontSize:20,fontWeight:800,marginBottom:2}},session.name+" "+L5_ROLES[role].icon),
        ce("div",{style:{fontSize:11,opacity:.7}},L5_ROLES[role].label+" · "+new Date().toLocaleDateString("zh-TW")))),
    alerts.length>0&&ce("div",{style:{display:"grid",gap:6}},
      alerts.map(function(a,i){
        return ce("div",{key:i,style:{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",
          borderRadius:10,background:"#fff",border:"1px solid "+T.border}},
          ce("span",{style:{fontSize:18}}),
          ce("div",{style:{flex:1,fontSize:12,fontWeight:600,color:a.color}},a.icon+" "+a.msg));
      })),
    ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}},
      kpis.map(function(k){
        return ce(Card,{key:k.label,style:{padding:"14px 16px"}},
          ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}},
            ce("div",null,
              ce("div",{style:{fontSize:11,color:T.muted,marginBottom:4}}),
              ce("div",{style:{fontSize:22,fontWeight:800,color:k.color}},k.value),
              ce("div",{style:{fontSize:11,color:T.muted,marginTop:2}},k.sub)),
            ce("div",{style:{fontSize:28}},k.icon)),
          ce("div",{style:{fontSize:11,fontWeight:700,color:T.muted,marginTop:6}},k.label));
      })),
    (hasPerm(role,"overview_finance")||hasPerm(role,"all"))&&personalSubRevenue>0&&ce(IBox,{c:"teal",style:{fontSize:11}},"⭐ 個人訂閱(B2C)為麗媚直接對個人消費者收款，與企業A層授權費(年收預估)計算基礎不同(一為實收金額/一為推估金額)，且不進入經銷商分潤計算(詳見「💹月結分潤明細表」)，此處僅並列呈現方便掌握企業+個人訂閱之整體營收全貌。"),
    (hasPerm(role,"all")||hasPerm(role,"reports"))&&ce(Card,null,
      ce(SecTitle,null,"📝 報價合約快覽"),
      ce(IBox,{c:"teal",style:{marginBottom:10,fontSize:11}},"報價合約系統(reibi-quote.jsx)為獨立artifact，以下為即時統計。⚠ 因為是不同artifact，這裡的按鈕無法直接把您「傳送」過去(Claude.ai介面沒有跨artifact跳轉功能)——正確用法：①先在下方設定您目前的操作身份 ②在對話的artifact清單中手動切換到「Reibi quote v1.1」③該系統開啟時會自動偵測剛才設定的身份並帶入報價單。"),
      ce("div",{style:{display:"flex",gap:8,alignItems:"flex-end",marginBottom:10,flexWrap:"wrap"}},
        ce("div",{style:{flex:1,minWidth:160}},
          ce(Select,{label:"目前操作身份(承辦業務，選填)",value:linkStaffId,onChange:function(e){setLinkStaffId(e.target.value);setLinkSetOk(false);}},
            ce("option",{value:""},"— 不指定 —"),
            staffListLink.map(function(s){return ce("option",{key:s.id,value:s.id},s.name+"("+s.title+")");}))),
        ce(Btn,{sz:"sm",onClick:function(){
          var s=staffListLink.find(function(x){return x.id===linkStaffId;});
          var ctx={staffId:linkStaffId||"",staffName:s?s.name:"",
            partnerOrgCode:(session&&session.partnerOrgCode)||"",partnerCompany:(session&&session.partnerCompany)||"",
            setBy:session.name,setAt:new Date().toISOString()};
          stor.s("l5_active_context",JSON.stringify(ctx)).then(function(){setLinkSetOk(true);});
        }},"✅ 設定操作身份")),
      linkSetOk&&ce(IBox,{c:"sage",style:{marginBottom:10,fontSize:11}},"已設定，請切換到「Reibi quote v1.1」artifact查看是否已自動帶入。"),
      ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:10}},
        [{l:"待確認報價",v:quoteStats.pending,c:T.amber,warn:quoteStats.pending>0},
         {l:"已確認待轉合約",v:quoteStats.confirmed,c:T.teal,warn:quoteStats.confirmed>0},
         {l:"報價單總計",v:quoteStats.total,c:T.muted,warn:false}].map(function(k){
          return ce(Card,{key:k.l,style:{padding:"10px",textAlign:"center",border:"1px solid "+(k.warn?T.amber:T.border)}},
            ce("div",{style:{fontSize:18,fontWeight:800,color:k.c}},k.v),
            ce("div",{style:{fontSize:10,color:T.muted,marginTop:4}},k.l));
        })),
      ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}},
        [{l:"待用印合約",v:contractStats.pending_sign,c:T.amber,warn:contractStats.pending_sign>0},
         {l:"執行中合約",v:contractStats.active,c:T.sage,warn:false},
         {l:"90天內到期",v:contractStats.expiring90,c:contractStats.expiring90>0?T.coral:T.muted,warn:contractStats.expiring90>0}].map(function(k){
          return ce(Card,{key:k.l,style:{padding:"10px",textAlign:"center",border:"1px solid "+(k.warn?T.amber:T.border)}},
            ce("div",{style:{fontSize:18,fontWeight:800,color:k.c}},k.v),
            ce("div",{style:{fontSize:10,color:T.muted,marginTop:4}},k.l));
        }))),
    (hasPerm(role,"all")||hasPerm(role,"tickets"))&&ce(Card,null,
      ce(SecTitle,null,"📋 D層工單快覽"),
      ce(IBox,{c:"teal",style:{marginBottom:10,fontSize:11}},"工單系統(reibi-workorder.jsx)為獨立artifact，以下為即時統計。同樣無法直接跳轉，請先在下方設定操作身份，再手動切換到「Reibi workorder v1.1」，系統會自動偵測並帶入。"),
      ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:10}},
        [{l:"待驗收",v:woStats.pending,c:T.amber,warn:woStats.pending>0},
         {l:"驗收異常",v:woStats.anomaly,c:T.red,warn:woStats.anomaly>0},
         {l:"工單總計",v:woStats.total,c:T.muted,warn:false}].map(function(k){
          return ce(Card,{key:k.l,style:{padding:"10px",textAlign:"center",border:"1px solid "+(k.warn?T.amber:T.border)}},
            ce("div",{style:{fontSize:18,fontWeight:800,color:k.c}},k.v),
            ce("div",{style:{fontSize:10,color:T.muted,marginTop:4}},k.l));
        })),
      ce("div",{style:{display:"flex",gap:8,alignItems:"flex-end",flexWrap:"wrap"}},
        ce("div",{style:{flex:1,minWidth:160}},
          ce(Select,{label:"目前操作身份(承辦業務，選填)",value:linkStaffId,onChange:function(e){setLinkStaffId(e.target.value);setLinkSetOk(false);}},
            ce("option",{value:""},"— 不指定 —"),
            staffListLink.map(function(s){return ce("option",{key:s.id,value:s.id},s.name+"("+s.title+")");}))),
        ce(Btn,{sz:"sm",onClick:function(){
          var s=staffListLink.find(function(x){return x.id===linkStaffId;});
          var ctx={staffId:linkStaffId||"",staffName:s?s.name:"",
            partnerOrgCode:(session&&session.partnerOrgCode)||"",partnerCompany:(session&&session.partnerCompany)||"",
            setBy:session.name,setAt:new Date().toISOString()};
          stor.s("l5_active_context",JSON.stringify(ctx)).then(function(){setLinkSetOk(true);});
        }},"✅ 設定操作身份")),
      linkSetOk&&ce(IBox,{c:"sage",style:{marginTop:8,fontSize:11}},"已設定，請切換到「Reibi workorder v1.1」artifact查看是否已自動帶入。")),
    (hasPerm(role,"all")||hasPerm(role,"overview_finance"))&&enterprises.length>0&&ce(Card,null,
      ce(SecTitle,null,"本年度企業開通趨勢(模擬)"),
      ce(MiniBar,{data:monthlyData,color:T.teal,h:70}),
      ce("div",{style:{textAlign:"right",fontSize:10,color:T.faint,marginTop:4}},"* 正式後端上線後連接真實數據")));
}

// ── NEW CASE SCREEN ───────────────────────────────────────────────────────────
function NewCaseScreen(props){
  var onBack=props.onBack;
  var onNav=props.onNav;
  var session=props.session;
  var role=session&&session.role;
  var isSuper=role==="super";
  var isFinance=role==="finance";
  var[step,setStep]=useState(1);
  var[toast,setToast]=useState("");
  var[result,setResult]=useState(null);
  var[loading,setLoading]=useState(false);
  var[showCredLetter,setShowCredLetter]=useState(false); // v2.12新增：開通成功後可列印/存PDF通行密碼函，或下載TXT
  var[caseType,setCaseType]=useState("enterprise");

  // Step1 fields
  var[orgName,setOrgName]=useState("");
  var[orgAlias,setOrgAlias]=useState("");
  var[contact,setContact]=useState("");
  var[phone,setPhone]=useState("");
  var[email,setEmail]=useState("");
  var[ubn,setUbn]=useState("");
  var[address,setAddress]=useState("");
  var[dSites,setDSites]=useState([]);
  var[plan,setPlan]=useState("成長");
  var[partnerCode,setPartnerCode]=useState("");
  var[memberCount,setMemberCount]=useState("");
  var[contractStart,setContractStart]=useState("");
  var[contractEnd,setContractEnd]=useState("");
  var[consultant,setConsultant]=useState("");
  // v2.5新增(Q4)：合作夥伴推薦，僅REIBI自營單(partnerCode為空)適用
  var[partnersList,setPartnersList]=useState([]);
  var[referralPartnerId,setReferralPartnerId]=useState("");
  var[referralPct,setReferralPct]=useState("");
  var[staffList,setStaffList]=useState([]);
  var[staffId,setStaffId]=useState("");
  // v2.12新增：企業/經銷商清單，供orgCode流水號預覽與「接案經銷商代碼」下拉選單使用
  var[enterprisesForSeq,setEnterprisesForSeq]=useState([]);
  var[distributorsForPick,setDistributorsForPick]=useState([]);
  useEffect(function(){
    stor.g("l5_partners").then(function(d){if(d)setPartnersList(JSON.parse(d));});
    stor.g("l5_staff").then(function(d){if(d)setStaffList(JSON.parse(d));});
    stor.g("l5_enterprises").then(function(d){if(d)setEnterprisesForSeq(JSON.parse(d));});
    stor.g("l5_distributors").then(function(d){if(d)setDistributorsForPick(JSON.parse(d));});
  },[]);

  // Step2 fields - B layer
  var[cloudBeds,setCloudBeds]=useState(0);
  var[relaxChairs,setRelaxChairs]=useState(0);
  var[la200,setLa200]=useState(0);
  // Step2b - D layer
  var[dPoster,setDPoster]=useState(false);
  var[dBoard,setDBoard]=useState(false);
  var[dDigital,setDDigital]=useState(false);
  var[dQR,setDQR]=useState(false);
  var[dDisplay,setDDisplay]=useState(false);
  var[dInstall,setDInstall]=useState(false);
  var dPackage=function(){
    var cnt=[dPoster,dBoard,dDigital,dQR,dDisplay,dInstall].filter(function(x){return x;}).length;
    if(cnt===0)return null;
    if(cnt<=2)return{name:"基礎型",min:20000,max:40000};
    if(cnt<=4)return{name:"標準型",min:60000,max:120000};
    return{name:"完整型",min:100000,max:200000};
  };

  // Step3 fields
  var[payMode,setPayMode]=useState("annual");
  var[cFee,setCFee]=useState("");
  var[cNote,setCNote]=useState("");
  var[cExecs,setCExecs]=useState(0);
  var[dFee,setDFee]=useState("");
  var[dNote,setDNote]=useState("");

  var[contractYears,setContractYears]=useState(3);
  var[aFeeOverride,setAFeeOverride]=useState("");
  var[handoffApplied,setHandoffApplied]=useState(false);
  var[handoffNotice,setHandoffNotice]=useState("");

  useEffect(function(){
    stor.g("__rq_handoff_index_l5").then(function(idxRaw){
      var idx=idxRaw?JSON.parse(idxRaw):[];
      if(!idx.length)return;
      var lastKey=idx[idx.length-1];
      stor.g(lastKey).then(function(raw){
        if(!raw)return;
        var payload;
        try{payload=JSON.parse(raw);}catch(e){return;}
        if(payload.orgName)setOrgName(payload.orgName);
        if(payload.orgAlias)setOrgAlias(payload.orgAlias);
        if(payload.contact)setContact(payload.contact);
        if(payload.phone)setPhone(payload.phone);
        if(payload.email)setEmail(payload.email);
        if(payload.memberCount)setMemberCount(String(payload.memberCount));
        if(payload.contractStart)setContractStart(payload.contractStart);
        if(payload.contractEnd)setContractEnd(payload.contractEnd);
        if(payload.payMode)setPayMode(payload.payMode);
        if(payload.cloudBeds)setCloudBeds(payload.cloudBeds);
        if(payload.relaxChairs)setRelaxChairs(payload.relaxChairs);
        if(payload.la200)setLa200(payload.la200);
        if(payload.dPoster)setDPoster(true);
        if(payload.dBoard)setDBoard(true);
        if(payload.dDigital)setDDigital(true);
        if(payload.dQR)setDQR(true);
        if(payload.dDisplay)setDDisplay(true);
        if(payload.dInstall)setDInstall(true);
        if(payload.cFee)setCFee(payload.cFee);
        if(payload.partnerCode)setPartnerCode(payload.partnerCode);
        if(payload.staffId)setStaffId(payload.staffId);
        if(payload.address)setAddress(payload.address);
        if(payload.dSites&&payload.dSites.length)setDSites(payload.dSites);
        if(!payload.partnerCode&&payload.referralPartnerId){setReferralPartnerId(payload.referralPartnerId);if(payload.referralPct)setReferralPct(String(payload.referralPct));}
        var n=parseInt(payload.memberCount)||0;
        if(n<=100)setPlan("基本");else if(n<=300)setPlan("成長");else if(n<=500)setPlan("專業");else if(n<=1000)setPlan("旗艦");
        setHandoffApplied(true);
        setHandoffNotice("已自動帶入合約 "+(payload.fromContractNo||"")+" 的客戶資訊與ABCD層配置"+((payload.staffId||payload.referralPartnerId)?"，含接單來源資訊":"")+"，請確認後執行開通");
      });
    });
  },[]);

  var PLAN_PRICES={"基本":600000,"成長":1200000,"專業":1800000,"旗艦":3000000};
  var BED_PRICE=800000,CHAIR_PRICE=750000,LA200_PRICE=149400;
  var aBase=PLAN_PRICES[plan]||1200000;
  var aBaseEffective=(aFeeOverride&&parseInt(aFeeOverride)>0)?parseInt(aFeeOverride):(plan==="custom"?0:(PLAN_PRICES[plan]||1200000));
  var aFinal=aFeeOverride&&parseInt(aFeeOverride)>0?parseInt(aFeeOverride):(payMode==="annual"?Math.round(aBaseEffective*0.95):payMode==="quarterly"?Math.round(aBaseEffective*1.03):aBaseEffective);
  var bTotal=cloudBeds*BED_PRICE+relaxChairs*CHAIR_PRICE+la200*LA200_PRICE;

  var doExecute=async function(){
    if(!isSuper){setToast("僅超級管理員可執行開通");return;}
    setLoading(true);
    await new Promise(function(r){setTimeout(r,800);});
    var alias=orgAlias.trim()||orgName.trim().slice(0,4);
    var yrNow=new Date().getFullYear().toString().slice(2);
    var existingForSeq=await stor.g("l5_enterprises");
    var listForSeq=existingForSeq?JSON.parse(existingForSeq):[];
    var seqPrefix=caseType==="partner"?"PTN":"ORG";
    var seqNow=nextSeqNum(listForSeq,seqPrefix,yrNow);
    var orgCode=genOrgCode(caseType==="partner"?"partner":"enterprise",alias,"",seqNow);
    var initPin=genCode(8);
    var backupCode=genCode(8);
    var memberPin=genCode(6);
    var deptPin=genCode(6);
    var adminPin=genCode(8);
    var newCase={
      id:"CASE_"+Date.now(),
      type:caseType,orgCode,orgName:orgName.trim(),orgAlias:alias,
      contact:contact.trim(),phone:phone.trim(),email:email.trim(),ubn:ubn.trim(),address:address.trim(),dSites:dSites,
      plan,memberCount:parseInt(memberCount)||0,cLayerFee:parseInt(cFee)||0,cLayerNote:cNote.trim(),cLayerExecs:cExecs,
      dLayerFee:parseInt(dFee)||0,dLayerNote:dNote.trim(),
      contractStart,contractEnd,consultant:consultant.trim(),
      partnerCode:partnerCode.trim(),
      referralPartnerId:partnerCode.trim()?"":(referralPartnerId||""),
      referralPct:partnerCode.trim()?null:(referralPartnerId?(parseFloat(referralPct)||0):null),
      staffId:staffId||"",
      devices:{cloudBeds,relaxChairs,la200},
      dLayer:{poster:dPoster,board:dBoard,digital:dDigital,qr:dQR,display:dDisplay,install:dInstall},
      payMode,aLayerFee:aFinal,bLayerFee:bTotal,contractYears:contractYears,
      status:"啟用中",usedCount:0,
      initPin,backupCode,memberPin,deptPin,adminPin,
      createdAt:new Date().toISOString(),
      createdBy:session.name
    };
    var existing=await stor.g("l5_enterprises");
    var list=existing?JSON.parse(existing):[];
    list.unshift(newCase);
    await stor.s("l5_enterprises",JSON.stringify(list));
    setResult(newCase);
    setLoading(false);
  };

  if(result&&showCredLetter){
    return ce(CredentialLetter,{type:"enterprise",onBack:function(){setShowCredLetter(false);},data:{
      name:result.orgName,code:result.orgCode,ubn:result.ubn,
      pins:[
        {label:"企業初始密碼(超管首次登入)",value:result.initPin},
        {label:"備用密碼",value:result.backupCode},
        {label:"一般會員密碼",value:result.memberPin},
        {label:"部門主管密碼",value:result.deptPin},
        {label:"企業管理員密碼",value:result.adminPin}
      ]
    }});
  }
  if(result){
    var doDownloadTxt=function(){
      var lines=[
        "REIBI 企業健康自主管理平台 — 開通代號與密碼",
        "企業名稱："+result.orgName,
        "單位代碼(orgCode)："+result.orgCode,
        "首次登入臨時PIN(72小時內有效)："+result.initPin,
        "備用碼(緊急重設PIN用)："+result.backupCode,
        "成員群組碼："+result.memberPin,
        "部門主管碼："+result.deptPin,
        "管理者初始PIN："+result.adminPin,
        "產生時間："+new Date().toISOString(),
        "",
        "⚠ 請妥善保管，勿與第三人共用；首次登入後請立即更改密碼。"
      ].join("\n");
      var blob=new Blob([lines],{type:"text/plain;charset=utf-8"});
      var url=URL.createObjectURL(blob);
      var a=document.createElement("a");
      a.href=url;a.download="REIBI開通資訊_"+result.orgCode+".txt";
      document.body.appendChild(a);a.click();document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };
    return ce("div",{style:{display:"grid",gap:14}},
      ce(IBox,{c:"sage",style:{fontSize:14,fontWeight:700}},"🎉 開通成功！"+result.orgName),
      ce(Card,null,
        ce(SecTitle,null,"自動生成的代號與密碼"),
        ce(IBox,{c:"red",style:{marginBottom:12}},"⚠ 以下資訊請立即抄錄，僅顯示一次！妥善提供給企業聯絡人。"),
        ce("div",{style:{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}},
          ce(Btn,{sz:"sm",v:"navy",onClick:function(){setShowCredLetter(true);}},"🖨 列印/存為PDF(通行密碼函)"),
          ce(Btn,{sz:"sm",v:"ghost",onClick:doDownloadTxt},"📄 下載TXT")),
        ce("div",{style:{display:"grid",gap:8}},
          [
            {l:"單位代碼(orgCode)",v:result.orgCode,desc:"企業登入時填入"},
            {l:"首次登入臨時PIN(72小時內有效)",v:result.initPin,desc:"登入後強制更改"},
            {l:"備用碼(緊急重設PIN用)",v:result.backupCode,desc:"請企業妥善保管"},
            {l:"成員群組碼",v:result.memberPin,desc:"全體員工共用"},
            {l:"部門主管碼",v:result.deptPin,desc:"主管角色使用"},
            {l:"管理者初始PIN",v:result.adminPin,desc:"L4管理者使用"}
          ].map(function(item){
            return ce("div",{key:item.l,style:{padding:"10px 14px",background:T.bg,borderRadius:8,
              border:"1px solid "+T.border}},
              ce("div",{style:{fontSize:11,color:T.muted,marginBottom:2}},item.l),
              ce("div",{style:{fontWeight:800,fontSize:16,color:T.text,letterSpacing:2,fontFamily:"monospace"}},item.v),
              ce("div",{style:{fontSize:10,color:T.faint,marginTop:2}},item.desc));
          }))),
      ce(Card,null,
        ce(SecTitle,null,"LINE推播開通通知"),
        ce(IBox,{c:"teal",style:{marginBottom:10}},
          ["企業名稱："+result.orgName,
           "單位代碼："+result.orgCode,
           "臨時PIN："+result.initPin,
           "請於72小時內登入平台完成設定",
           "平台入口：REIBI健康自主管理平台",
           "服務聯絡：LINE @reibicare"].join("\n")),
        ce(Btn,{v:"sage",onClick:function(){setToast("已複製推播內容，請貼至LINE @reibicare發送");}},"📋 複製推播內容")),
      ce(Btn,{onClick:function(){setResult(null);setStep(1);setOrgName("");setOrgAlias("");setContact("");setPhone("");setEmail("");setPlan("成長");setPartnerCode("");setMemberCount("");setContractStart("");setContractEnd("");setConsultant("");setCloudBeds(0);setRelaxChairs(0);setLa200(0);setDPoster(false);setDBoard(false);setDDigital(false);setDQR(false);setDDisplay(false);setDInstall(false);setCFee("");setCNote("");setCExecs(0);setPayMode("annual");setReferralPartnerId("");setReferralPct("");setStaffId("");},full:true,v:"ghost"},"新增另一筆"),
      ce(Toast,{msg:toast,onDone:function(){setToast("");}}));
  }

  return ce("div",{style:{display:"grid",gap:14}},
    ce(Toast,{msg:toast,onDone:function(){setToast("");}}),
    handoffApplied&&ce(IBox,{c:"sage"},"✅ "+handoffNotice),
    // v2.5修正：移除「企業/單位」vs「經銷商」分類選擇器。
    // 既有缺陷(非本次引入)：caseType==="partner"時，doExecute仍會組出企業專屬欄位(人數/四組企業PIN/A-D層費用)
    // 並整包寫入l5_enterprises，導致「新增經銷商」實際上產生一筆錯誤的假企業記錄，且不會出現在
    // DistributorScreen(讀l5_distributors)，也無法被calcDistComm分潤計算納入。
    // 修正方式：NewCaseScreen統一只做企業開案，經銷商一律回DistributorScreen「+新增經銷商」建立(資料結構正確)。
    // caseType變數保留但永遠為"enterprise"，避免動到下方大量既有的caseType條件判斷(風險最低的修法)。
    ce("div",{style:{display:"flex",alignItems:"center",gap:0,marginBottom:8}},
      [1,2,3].map(function(s){
        return ce("div",{key:s,style:{display:"flex",alignItems:"center",flex:s<3?1:0}},
          ce("div",{style:{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",
            justifyContent:"center",fontWeight:800,fontSize:13,flexShrink:0,
            background:step>=s?T.teal:"#e2e8f0",color:step>=s?"#fff":T.muted}},s),
          s<3&&ce("div",{style:{flex:1,height:2,background:step>s?T.teal:"#e2e8f0"}}));
      })),
    ce("div",{style:{display:"flex",justifyContent:"space-between",fontSize:11,color:T.muted,marginBottom:10}},
      ce("span",null,"基本資料"),ce("span",null,"設備配置"),ce("span",null,"付款方式")),

    step===1&&ce(Card,null,
      ce(SecTitle,null,"Step 1 — 企業基本資料"),
      ce(IBox,{c:"navy",style:{fontSize:11,marginBottom:10}},"要新增/管理經銷商？請至「經銷商」頁面。",
        onNav&&ce("div",{style:{marginTop:6}},ce(Btn,{sz:"sm",v:"navy",onClick:function(){onNav("distributor");}},"🤝 前往經銷商管理"))),
      ce("div",{style:{display:"grid",gap:10}},
        ce(Inp,{label:"名稱 *",value:orgName,onChange:function(e){setOrgName(e.target.value);},placeholder:"企業/單位名稱"}),
        ce(Inp,{label:"代號縮寫(2-4碼英文，用於orgCode)*",value:orgAlias,onChange:function(e){setOrgAlias(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,4));},placeholder:"例：TSMC / BEST"}),
        orgAlias&&ce(IBox,{c:"teal",style:{fontSize:11}},
          "預覽代碼："+genOrgCode("enterprise",orgAlias,"",nextSeqNum(enterprisesForSeq,"ORG",new Date().getFullYear().toString().slice(2)))),
        ce(Inp,{label:"聯絡人 *",value:contact,onChange:function(e){setContact(e.target.value);},placeholder:"主要聯絡人姓名"}),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}},
          ce(Inp,{label:"電話",value:phone,onChange:function(e){setPhone(e.target.value);},placeholder:"0912-345-678"}),
          ce(Inp,{label:"Email",value:email,onChange:function(e){setEmail(e.target.value);},placeholder:"contact@company.com"})),
        ce(Inp,{label:"統一編號(選填，可日後補登)",value:ubn,onChange:function(e){setUbn(e.target.value.replace(/[^0-9]/g,"").slice(0,8));},placeholder:"8碼數字"}),
        ce(Inp,{label:"公司登記地址(選填)",value:address,onChange:function(e){setAddress(e.target.value);},placeholder:"例：台北市信義區OO路OO號"}),
        ce("div",{style:{marginTop:4}},
          ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}},
            ce("label",{style:{fontSize:12,color:T.muted,fontWeight:600}},"健促場域地點(選填，若由quote.jsx場勘需求單匯入會自動帶入)"),
            ce("button",{onClick:function(){setDSites(dSites.concat([{id:"SITE_"+Date.now(),label:"",address:"",note:""}]));},
              style:{background:"none",border:"1px solid "+T.teal,color:T.teal,borderRadius:6,padding:"3px 8px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}},"+ 新增場域")),
          dSites.map(function(site,idx){
            return ce("div",{key:site.id,style:{display:"grid",gap:6,padding:10,background:T.bg,borderRadius:8,marginBottom:6}},
              ce("div",{style:{display:"flex",gap:6,alignItems:"center"}},
                ce("input",{value:site.label,onChange:function(e){var v=e.target.value;setDSites(dSites.map(function(s,i){return i===idx?Object.assign({},s,{label:v}):s;}));},placeholder:"場域名稱(例：總公司/一廠)",style:{flex:1,padding:"7px 10px",borderRadius:6,border:"1px solid "+T.border,fontSize:12}}),
                ce("button",{onClick:function(){setDSites(dSites.filter(function(s,i){return i!==idx;}));},style:{background:"none",border:"none",color:T.coral,cursor:"pointer",fontSize:14,padding:"0 4px"}},"✕")),
              ce("input",{value:site.address,onChange:function(e){var v=e.target.value;setDSites(dSites.map(function(s,i){return i===idx?Object.assign({},s,{address:v}):s;}));},placeholder:"地址",style:{padding:"7px 10px",borderRadius:6,border:"1px solid "+T.border,fontSize:12}}),
              ce("input",{value:site.note,onChange:function(e){var v=e.target.value;setDSites(dSites.map(function(s,i){return i===idx?Object.assign({},s,{note:v}):s;}));},placeholder:"備註",style:{padding:"7px 10px",borderRadius:6,border:"1px solid "+T.border,fontSize:12}}));
          })),
        caseType==="enterprise"&&ce(IBox,{c:"navy",style:{fontSize:11,marginBottom:0}},
          "四層服務架構說明：",ce("br"),
          "A層 軟體平台年授權費(循環)| B層 設備費：雲朵床/樂活椅/LA200(一次性)",ce("br"),
          "C層 高管健促服務費(循環)| D層 健康識能環境佈置(選配一次性)"),
        caseType==="enterprise"&&ce(Select,{label:"方案等級 * (A層年授權費，依人數規模建議)",value:plan,onChange:function(e){
          var newPlan=e.target.value;
          setPlan(newPlan);setAFeeOverride("");
          var DEFAULT_DEVICES={"基本":{bed:1,chair:0,la:0},"成長":{bed:1,chair:1,la:0},"專業":{bed:2,chair:1,la:1},"旗艦":{bed:2,chair:2,la:1},"custom":{bed:0,chair:0,la:0}};
          var dd=DEFAULT_DEVICES[newPlan]||{bed:0,chair:0,la:0};
          setCloudBeds(dd.bed);setRelaxChairs(dd.chair);setLa200(dd.la);
        }},
          ["基本","成長","專業","旗艦"].map(function(p){
            var PLAN_NOTE={"基本":"≤100人","成長":"101-300人","專業":"301-500人","旗艦":"501-1000人"};
            return ce("option",{key:p,value:p},p+"("+PLAN_NOTE[p]+") — 原價 NT$"+((PLAN_PRICES[p]||0)/10000).toFixed(0)+"萬/年");
          }),
          ce("option",{value:"custom"},"⚫ 定制型(1000人+)— 客製報價")),
        plan&&caseType==="enterprise"&&ce("div",{style:{display:"grid",gap:8}},
          ce(IBox,{c:"teal",style:{fontSize:11}},
            plan==="custom"?"定制型：人數1000+，費用請依客戶需求自填下方欄位":"A層年授權費原價：NT$"+(PLAN_PRICES[plan]/10000).toFixed(0)+"萬/年 × "+contractYears+"年 = NT$"+(PLAN_PRICES[plan]/10000*contractYears).toFixed(0)+"萬(軟體平台使用費，依合約期間結算)"),
          ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}},
            ce("div",null,
              ce("label",{style:{fontSize:11,color:T.muted,display:"block",marginBottom:3,fontWeight:600}},"合約年限(年)"),
              ce("div",{style:{display:"flex",gap:4}},
                [1,2,3,5].map(function(y){
                  return ce("button",{key:y,onClick:function(){setContractYears(y);},
                    style:{padding:"4px 8px",borderRadius:8,border:"1px solid "+(contractYears===y?T.teal:T.border),
                      fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                      background:contractYears===y?T.tealBg:"transparent",color:contractYears===y?T.teal:T.muted}},y+"年");
                }))),
            ce(Inp,{label:"A層實際收費(元，留空=依原價)",type:"number",value:aFeeOverride,
              onChange:function(e){setAFeeOverride(e.target.value);},
              placeholder:"優惠價請在此填入，例：500000"}),
            aFeeOverride&&parseInt(aFeeOverride)>0&&ce(IBox,{c:"amber",style:{fontSize:10,alignSelf:"flex-end"}},
              "優惠幅度："+Math.round((1-(parseInt(aFeeOverride)/(PLAN_PRICES[plan]||1))*100))+"% off"))),
        caseType==="enterprise"&&ce(Inp,{label:"接案經銷商代碼(如有)",value:partnerCode,list:"distCodeOptions",onChange:function(e){setPartnerCode(e.target.value);if(e.target.value.trim()){setReferralPartnerId("");setReferralPct("");}},placeholder:"例：PTN-WANG-25-001(可從清單選，或手動輸入)"}),
        caseType==="enterprise"&&ce("datalist",{id:"distCodeOptions"},
          distributorsForPick.map(function(d){return ce("option",{key:d.id,value:d.orgCode},d.name+"("+d.orgCode+")");})),
        caseType==="enterprise"&&!partnerCode.trim()&&ce("div",{style:{display:"grid",gap:8}},
          ce(IBox,{c:"navy",style:{fontSize:11}},"這是REIBI自營單(無經銷商代碼)。若有合作夥伴(異業轉介/推薦人/ESG夥伴)協助促成，可在此指定分潤，僅適用自營單，不與經銷商分潤疊加。"),
          ce(Select,{label:"合作夥伴(選填)",value:referralPartnerId,onChange:function(e){
            setReferralPartnerId(e.target.value);
            var p=partnersList.find(function(x){return x.id===e.target.value;});
            setReferralPct(p?String(p.defaultPct):"");
          }},
            ce("option",{value:""},"— 無合作夥伴 —"),
            partnersList.map(function(p){return ce("option",{key:p.id,value:p.id},p.name+"(預設"+p.defaultPct+"%)");})),
          referralPartnerId&&ce(Inp,{label:"本筆分潤%(可調整，建議5-10%)",type:"number",value:referralPct,onChange:function(e){setReferralPct(e.target.value);},placeholder:"8"})),
        caseType==="enterprise"&&ce("div",null,
          ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4,fontWeight:600}},"授權人數上限 *"),
          ce("div",{style:{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}},
            [100,300,500,1000].map(function(n){
              return ce("button",{key:n,onClick:function(){setMemberCount(String(n));},
                style:{padding:"4px 10px",borderRadius:16,border:"1px solid "+(memberCount===String(n)?T.teal:T.border),
                  fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                  background:memberCount===String(n)?T.teal:"transparent",
                  color:memberCount===String(n)?"#fff":T.muted}},n+"人");
            })),
          ce(Inp,{value:memberCount,onChange:function(e){setMemberCount(e.target.value.replace(/[^0-9]/g,""));},placeholder:"或自行填寫人數(例：150)",type:"number"})),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}},
          ce(Inp,{label:"合約開始日 *",type:"date",value:contractStart,onChange:function(e){setContractStart(e.target.value);}}),
          ce(Inp,{label:"合約結束日 *",type:"date",value:contractEnd,onChange:function(e){setContractEnd(e.target.value);}})),
        ce(Inp,{label:"麗媚負責顧問",value:consultant,onChange:function(e){setConsultant(e.target.value);},placeholder:"指定健促顧問姓名"}),
        caseType==="enterprise"&&ce(Select,{label:"承辦業務(選填，接單歸戶統計用)",value:staffId,onChange:function(e){setStaffId(e.target.value);}},
          ce("option",{value:""},"— 無 —"),
          staffList.map(function(s){return ce("option",{key:s.id,value:s.id},s.name+"("+s.title+")");})),
        ce(Btn,{onClick:function(){
          if(!orgName.trim()||!orgAlias.trim()||!contact.trim()||(!memberCount&&caseType==="enterprise")||!contractStart||!contractEnd){
            setToast("請填寫所有必填欄位(*)");return;
          }
          setStep(2);
        },full:true,sz:"lg",disabled:!isSuper&&!isFinance},"下一步：設備配置 →"),
        !isSuper&&!isFinance&&ce(IBox,{c:"amber",style:{marginTop:4}},"⚠ 僅超級管理員與財務管理員可建立新案"))),

    step===2&&ce("div",{style:{display:"grid",gap:12}},
      ce(Card,null,
        ce(SecTitle,null,"Step 2 — B層設備配置"),
        ce(IBox,{c:"navy",style:{marginBottom:12}},"常駐設備(企業現場)：已依「方案等級」帶入建議預設台數，可再自行調整，費用即時計算。設備數量可為0。\n活動攜帶設備(麗媚服務時另行準備)：自律神經量測套件、生物資訊量測套件(不計入B層費用)。"),
        ce("div",{style:{display:"grid",gap:10}},
          [
            {l:"舒曼波雲朵床(7.83Hz含全頻段，無加熱，無需預熱)",icon:"🛏",v:cloudBeds,set:setCloudBeds,price:BED_PRICE},
            {l:"舒曼波樂活電動椅(7.83Hz含全頻段)",icon:"🪑",v:relaxChairs,set:setRelaxChairs,price:CHAIR_PRICE},
            {l:"UIS•REIBI LA200光能緩解疼痛體驗設備(660-808nm LLLT，3機1體)",icon:"💡",v:la200,set:setLa200,price:LA200_PRICE}
          ].map(function(item){
            return ce(Card,{key:item.l,style:{padding:"12px 14px"}},
              ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
                ce("div",null,
                  ce("div",{style:{fontWeight:700,fontSize:13,color:T.text}},item.icon+" "+item.l),
                  ce("div",{style:{fontSize:11,color:T.muted}},"定價 NT$"+(item.price/10000).toFixed(2)+"萬")),
                ce("div",{style:{display:"flex",alignItems:"center",gap:10}},
                  ce("button",{onClick:function(){item.set(Math.max(0,item.v-1));},
                    style:{width:28,height:28,borderRadius:"50%",border:"1px solid "+T.border,
                      background:T.bg,cursor:"pointer",fontWeight:700,fontSize:16,
                      display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit"}},"-"),
                  ce("div",{style:{fontSize:18,fontWeight:800,color:T.teal,minWidth:28,textAlign:"center"}},item.v),
                  ce("button",{onClick:function(){item.set(item.v+1);},
                    style:{width:28,height:28,borderRadius:"50%",border:"1px solid "+T.teal,
                      background:T.tealBg,cursor:"pointer",fontWeight:700,fontSize:16,
                      color:T.teal,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit"}},"+"))),
              item.v>0&&ce("div",{style:{fontSize:12,color:T.amber,marginTop:6,fontWeight:600}},
                "小計：NT$"+(item.v*item.price/10000).toFixed(2)+"萬"));
          })),
        bTotal>0&&ce(IBox,{c:"amber",style:{marginTop:4,fontWeight:700}},
          "B層設備總計(原價)：NT$"+(bTotal/10000).toFixed(2)+"萬(訂金30% / 到貨40% / 完工30%)"),
        plan==="custom"&&ce(IBox,{c:"plum",style:{fontSize:11,marginTop:4}},"⚫ 定制型：設備數量請依客戶需求自行調整上方台數。1000人+企業通常對應5台以上，請依現場勘查結果報價。")),
      ce(Card,null,
        ce(SecTitle,null,"Step 2b — D層環境佈置(選配)"),
        ce(IBox,{c:"teal",style:{marginBottom:10}},"以下均為選配項目，勾選後提供費用估算範圍。正式報價需現場勘查(3-7工作日)。"),
        ce("div",{style:{display:"grid",gap:8}},
          [
            {l:"基礎海報套組(A2×6張)",v:dPoster,set:setDPoster,est:"1.5-3萬"},
            {l:"健促公告欄設計(含視覺化)",v:dBoard,set:setDBoard,est:"2.5-5萬"},
            {l:"數位看板內容(10-15張MP4)",v:dDigital,set:setDDigital,est:"3-6萬"},
            {l:"QR Code貼紙組(防水霧面)",v:dQR,set:setDQR,est:"0.5-1萬"},
            {l:"設備展示區佈置",v:dDisplay,set:setDDisplay,est:"2-4萬"},
            {l:"現場佈置施工(含差旅)",v:dInstall,set:setDInstall,est:"1-2.5萬"}
          ].map(function(item){
            return ce("div",{key:item.l,onClick:function(){item.set(!item.v);},
              style:{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:8,
                cursor:"pointer",border:"1px solid "+(item.v?T.teal:T.border),
                background:item.v?T.tealBg:T.card}},
              ce("div",{style:{width:18,height:18,borderRadius:4,border:"2px solid "+(item.v?T.teal:T.faint),
                background:item.v?T.teal:"transparent",display:"flex",alignItems:"center",
                justifyContent:"center",flexShrink:0}},
                item.v&&ce("span",{style:{color:"#fff",fontSize:12,fontWeight:800}},"✓")),
              ce("div",{style:{flex:1}},
                ce("div",{style:{fontSize:12,fontWeight:600,color:item.v?T.teal:T.text}},item.l),
                ce("div",{style:{fontSize:11,color:T.muted}},"估算：NT$"+item.est)));
          })),
        dPackage()&&ce(IBox,{c:"sage",style:{marginTop:10,fontWeight:700}},
          "D層套組："+dPackage().name+" · 估算 NT$"+(dPackage().min/10000).toFixed(0)+"萬 — NT$"+(dPackage().max/10000).toFixed(0)+"萬\n正式報價需現場勘查，3-7工作日內提供。")),
      ce(Card,null,
        ce(SecTitle,null,"Step 2c — C層 高管健促服務費(年度一次，可選)"),
        ce(IBox,{c:"plum",style:{marginBottom:10,fontSize:11}},"C層為選配，年度服務含自律神經量測+生物資訊檢測(兩項同時進行，3-4位麗媚服務人員)。標準費率：5人NT$3.5萬/年、10人NT$7萬/年、15人NT$10.5萬/年、30人NT$21萬/年。高風險高管(連續橙/紅燈)半年一次，費用NT$14,000/人/年另計。"),
        ce("div",{style:{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}},
          [{n:5,p:35000,d:"1天"},{n:10,p:70000,d:"1天"},{n:15,p:105000,d:"1-2天"},{n:30,p:210000,d:"3-4天"}].map(function(opt){
            var isActive=parseInt(cExecs)===opt.n&&parseInt(cFee)===opt.p;
            return ce("button",{key:opt.n,onClick:function(){setCExecs(opt.n);setCFee(String(opt.p));},
              style:{padding:"6px 12px",borderRadius:8,border:"1px solid "+(isActive?T.plum:T.border),
                fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                background:isActive?T.plumBg:"transparent",color:isActive?T.plum:T.muted}},
              opt.n+"人 NT$"+(opt.p/10000).toFixed(1)+"萬 ("+opt.d+")");
          })),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}},
          ce(Inp,{label:"服務高管/主管人數(可自填)",type:"number",value:String(cExecs),
            onChange:function(e){setCExecs(parseInt(e.target.value)||0);},placeholder:"例：5"}),
          ce(Inp,{label:"年服務費用(元，原價或優惠價)",type:"number",value:cFee,
            onChange:function(e){setCFee(e.target.value);},placeholder:"例：35000"})),
        ce(Inp,{label:"C層備註(方案說明/特殊條件/高風險追蹤說明)",value:cNote,
          onChange:function(e){setCNote(e.target.value);},placeholder:"例：含半年高風險高管追蹤 NT$14,000/人"}),
        cFee&&parseInt(cFee)>0&&ce(IBox,{c:"sage",style:{fontSize:11,marginTop:4}},
          "C層確認費用：NT$"+(parseInt(cFee)/10000).toFixed(2)+"萬/年 × "+contractYears+"年 = NT$"+(parseInt(cFee)*contractYears/10000).toFixed(2)+"萬(與A層同期繳)")),
      ce(Card,null,
        ce(SecTitle,null,"Step 2d — D層 確認費用(有正式報價後填入)"),
        ce(IBox,{c:"amber",style:{marginBottom:10,fontSize:11}},"上方勾選為估算範圍參考，待現場勘查完成正式報價後，於此填入D層確認金額，將加入付款時程追蹤(50%訂金+50%驗收)。"),
        ce(Inp,{label:"D層確認費用(元，尚未報價可留空)",type:"number",value:dFee,
          onChange:function(e){setDFee(e.target.value);},placeholder:"例：80000"}),
        ce(Inp,{label:"D層備註(套組內容/特殊說明)",value:dNote,
          onChange:function(e){setDNote(e.target.value);},placeholder:"例：含數位看板+現場施工"}),
        dFee&&ce(IBox,{c:"sage",style:{fontSize:11,marginTop:4}},
          "D層確認費用：NT$"+(parseInt(dFee)/10000).toFixed(2)+"萬(訂金50% NT$"+(parseInt(dFee)/2/10000).toFixed(2)+"萬 + 驗收款50% NT$"+(parseInt(dFee)/2/10000).toFixed(2)+"萬)")),
      ce("div",{style:{display:"flex",gap:8}},
        ce(Btn,{v:"ghost",onClick:function(){setStep(1);}},
          "← 返回"),
        ce(Btn,{onClick:function(){setStep(3);},full:true,sz:"lg",disabled:!isSuper&&!isFinance},
          "下一步：付款方式 →"))),

    step===3&&ce("div",{style:{display:"grid",gap:12}},
      ce(Card,null,
        ce(SecTitle,null,"Step 3 — A層付款方式"),
        ce("div",{style:{display:"grid",gap:8}},
          [
            {v:"annual",l:"年繳(享5%折扣)",desc:"全年一次付清，折扣後 NT$"+(Math.round(aBaseEffective*0.95)/10000).toFixed(2)+"萬"},
            {v:"semi",l:"半年繳",desc:"每半年付款，全年 NT$"+(aBaseEffective/10000).toFixed(0)+"萬"},
            {v:"quarterly",l:"季繳(+3%手續費)",desc:"每季付款，含費全年 NT$"+(Math.round(aBaseEffective*1.03)/10000).toFixed(2)+"萬"}
          ].map(function(m){
            return ce("div",{key:m.v,onClick:function(){setPayMode(m.v);},
              style:{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:10,
                cursor:"pointer",border:"2px solid "+(payMode===m.v?T.teal:T.border),
                background:payMode===m.v?T.tealBg:T.card}},
              ce("div",{style:{width:20,height:20,borderRadius:"50%",border:"2px solid "+(payMode===m.v?T.teal:T.faint),
                background:payMode===m.v?T.teal:"transparent",flexShrink:0}}),
              ce("div",null,
                ce("div",{style:{fontWeight:700,fontSize:13,color:payMode===m.v?T.teal:T.text}},m.l),
                ce("div",{style:{fontSize:11,color:T.muted}},m.desc)));
          }))),
      ce(Card,null,
        ce(SecTitle,null,"四層費用總覽"),
        ce("div",{style:{display:"grid",gap:8}},
          [
            {l:"A層 · 軟體平台年授權",v:(aFeeOverride&&parseInt(aFeeOverride)>0?"NT$"+(parseInt(aFeeOverride)/10000).toFixed(2)+"萬/年 (優惠，原價NT$"+(PLAN_PRICES[plan]||0)/10000+"萬)":"NT$"+(aFinal/10000).toFixed(2)+"萬/年"),note:"("+plan+"方案"+({annual:"年繳-5%",semi:"半年繳",quarterly:"季繳+3%"}[payMode])+" × "+contractYears+"年)",show:plan!=="custom"},
            {l:"A層 · 定制型(1000人+)",v:"客製報價",note:"年限："+contractYears+"年，請依客戶需求確認",show:plan==="custom"},
            {l:"B層 · 設備費(一次性)",v:bTotal>0?"NT$"+(bTotal/10000).toFixed(2)+"萬":"未選配",note:"訂金30%→到貨40%→完工30%",show:true},
            {l:"C層 · 高管健促服務費",v:cFee&&parseInt(cFee)>0?"NT$"+(parseInt(cFee)/10000).toFixed(1)+"萬/年"+(cExecs>0?" ("+cExecs+"人)":""):"待報價",note:cNote||"依服務人數與方案定價，與A層同期繳",show:true},
            {l:"D層 · 環境佈置(選配)",v:dPackage()?"NT$"+(dPackage().min/10000).toFixed(0)+"萬起":"未選配",note:"正式報價需現場勘查",show:true}
          ].filter(function(item){return item.show;}).map(function(item){
            return ce("div",{key:item.l,style:{display:"flex",justifyContent:"space-between",
              alignItems:"center",padding:"8px 0",borderBottom:"1px solid "+T.border}},
              ce("div",null,
                ce("div",{style:{fontSize:12,fontWeight:600,color:T.text}},item.l),
                ce("div",{style:{fontSize:11,color:T.muted}},item.note)),
              ce("div",{style:{fontSize:13,fontWeight:800,color:T.amber,textAlign:"right"}},item.v));
          }))),
      ce("div",{style:{display:"flex",gap:8}},
        ce(Btn,{v:"ghost",onClick:function(){setStep(2);}},
          "← 返回"),
        isSuper?ce(Btn,{onClick:doExecute,full:true,sz:"lg",v:"sage",disabled:loading},
          loading?"開通中...":"🚀 執行開通"):
        isFinance?ce(IBox,{c:"amber",style:{flex:1}},"✅ 資料已備妥，請通知超級管理員執行開通"):
        ce(IBox,{c:"red",style:{flex:1}},"僅超級管理員可執行開通"))));
}

// ── ENTERPRISE MANAGEMENT SCREEN ─────────────────────────────────────────────
// ── CREDENTIAL LETTER (通行密碼函，企業/經銷商共用，v2.8新增) ─────────────────────
// 合約/開通成立後產生的正式憑證文件，走既有「HTML+瀏覽器列印/存PDF」模式(同ContractView draft合約)。
// 遺失時可由對應管理畫面重新開啟此畫面再列印一次，不會重設既有PIN(除非使用者另外執行PIN重設功能)。
function CredentialLetter(props){
  var type=props.type; // "distributor" | "enterprise"
  var data=props.data||{};
  var onBack=props.onBack;
  useEffect(function(){
    var style=document.createElement("style");
    style.innerHTML="@media print{nav,header,.no-print{display:none!important}body{font-size:12px}}";
    document.head.appendChild(style);
    return function(){document.head.removeChild(style);};
  },[]);
  var title=type==="distributor"?"REIBI 授權經銷商通行密碼函":"REIBI 企業通行密碼函";
  return ce("div",{style:{display:"grid",gap:14}},
    ce("div",{className:"no-print",style:{display:"flex",justifyContent:"space-between"}},
      ce("button",{onClick:onBack,style:{background:"none",border:"none",cursor:"pointer",color:T.teal,fontSize:13,fontWeight:700,fontFamily:"inherit"}},"<- 返回"),
      ce(Btn,{onClick:function(){window.print();}},"🖨 列印/存為PDF")),
    ce(Card,{style:{lineHeight:1.9,fontSize:13,color:T.text}},
      ce("p",{style:{fontWeight:700,textAlign:"center",fontSize:16,marginBottom:4}},"麗媚生化科技有限公司\nREIBI BIO-Technology Co., Ltd."),
      ce("p",{style:{fontWeight:700,textAlign:"center",fontSize:14,marginBottom:20}},title),
      ce("div",{style:{display:"grid",gap:4,marginBottom:16,padding:12,background:T.bg,borderRadius:8}},
        ce("div",null,(type==="distributor"?"經銷商名稱":"企業/單位名稱")+"："+(data.name||"—")),
        ce("div",null,"代號："+(data.code||"—")),
        ce("div",null,"統一編號："+(data.ubn||"(未登記)")),
        ce("div",null,"發函日期："+new Date().toISOString().slice(0,10))),
      ce("p",null,"茲核發下列"+(type==="distributor"?"經銷商":"企業")+"登入憑證，請妥善保管，勿與第三人共用："),
      ce("div",{style:{display:"grid",gap:6,marginBottom:16}},
        (data.pins||[]).map(function(p){
          return ce("div",{key:p.label,style:{display:"flex",justifyContent:"space-between",padding:"6px 10px",border:"1px solid "+T.border,borderRadius:6}},
            ce("span",{style:{color:T.muted}},p.label),
            ce("span",{style:{fontWeight:800,fontFamily:"monospace",letterSpacing:1}},p.value||"—"));
        })),
      ce("div",{style:{padding:12,background:T.amberBg||"#fffbeb",borderRadius:8,fontSize:12,marginBottom:12}},
        ce("p",{style:{fontWeight:700,marginBottom:4}},"操作說明"),
        ce("p",null,"1. 請至REIBI"+(type==="distributor"?"經銷商後台(reibi-l5)":"企業健康自主管理平台")+"登入頁輸入代號與對應密碼。"),
        ce("p",null,"2. 首次登入請立即修改密碼，並自行留存新密碼。"),
        ce("p",null,"3. 密碼函遺失時，請聯繫REIBI客服(LINE：@reibicare)申請補發，管理端可重新開啟本畫面列印，不影響現有密碼設定。"),
        ce("p",null,"4. 如需重設密碼本身(非僅補印文件)，請洽REIBI客服另行辦理，重設後原密碼函即失效。")),
      ce("p",{style:{fontSize:11,color:T.muted,textAlign:"center"}},"本文件由系統自動產生，如有疑問請聯繫 reibiservice@gmail.com")));
}

function EnterpriseScreen(props){
  var session=props.session;
  var role=session&&session.role;
  var canEdit=hasPerm(role,"all");
  var isPartner=role==="partner_primary"||role==="partner_sub";
  var[enterprises,setEnterprises]=useState([]);
  var[search,setSearch]=useState("");
  var[filterStatus,setFilterStatus]=useState("all");
  var[filterPlan,setFilterPlan]=useState("all");
  var[selected,setSelected]=useState(null);
  var[editMode,setEditMode]=useState(false);
  var[toast,setToast]=useState("");
  var[dateStart,setDateStart]=useState("");
  var[dateEnd,setDateEnd]=useState("");
  var[showDetail,setShowDetail]=useState(false);
  var[showCredLetter,setShowCredLetter]=useState(false);

  useEffect(function(){
    stor.g("l5_enterprises").then(function(d){
      if(d){
        var list=JSON.parse(d);
        if(isPartner){
          list=list.filter(function(e){return e.partnerCode===session.partnerOrgCode;});
        }
        setEnterprises(list);
      }
    });
  },[]);

  var saveEnterprise=async function(updated){
    var all=await stor.g("l5_enterprises");
    var list=all?JSON.parse(all):[];
    var idx=list.findIndex(function(e){return e.id===updated.id;});
    if(idx>=0)list[idx]=updated;
    else list.unshift(updated);
    await stor.s("l5_enterprises",JSON.stringify(list));
    setEnterprises(function(prev){
      var ni=prev.findIndex(function(e){return e.id===updated.id;});
      if(ni>=0){var n2=prev.slice();n2[ni]=updated;return n2;}
      return [updated].concat(prev);
    });
    setSelected(updated);
    setToast("已儲存變更");
    setEditMode(false);
  };

  var filtered=enterprises.filter(function(e){
    var matchSearch=!search||
      (e.orgName&&e.orgName.includes(search))||
      (e.orgCode&&e.orgCode.includes(search.toUpperCase()))||
      (e.contact&&e.contact.includes(search));
    var matchStatus=filterStatus==="all"||e.status===filterStatus;
    var matchPlan=filterPlan==="all"||e.plan===filterPlan;
    var matchDate=true;
    if(dateStart&&e.contractStart)matchDate=matchDate&&e.contractStart>=dateStart;
    if(dateEnd&&e.contractEnd)matchDate=matchDate&&e.contractEnd<=dateEnd;
    return matchSearch&&matchStatus&&matchPlan&&matchDate;
  });

  var alertCount=enterprises.filter(function(e){
    var used=parseInt(e.usedCount)||0;var total=parseInt(e.memberCount)||1;
    return (used/total)>=0.9;
  }).length;

  if(showDetail&&selected&&showCredLetter){
    return ce(CredentialLetter,{type:"enterprise",onBack:function(){setShowCredLetter(false);},data:{
      name:selected.orgName,code:selected.orgCode,ubn:selected.ubn,
      pins:[
        {label:"企業初始密碼(超管首次登入)",value:selected.initPin},
        {label:"備用密碼",value:selected.backupCode},
        {label:"一般會員密碼",value:selected.memberPin},
        {label:"部門主管密碼",value:selected.deptPin},
        {label:"企業管理員密碼",value:selected.adminPin}
      ]
    }});
  }
  if(showDetail&&selected){
    var ent=selected;
    var used=parseInt(ent.usedCount)||0;
    var total=parseInt(ent.memberCount)||1;
    var usePct=Math.round((used/total)*100);
    var daysLeft=ent.contractEnd?Math.ceil((new Date(ent.contractEnd)-new Date())/(1000*60*60*24)):null;
    var isAlert=usePct>=90;
    var isExpiring=daysLeft!==null&&daysLeft<=30&&daysLeft>=0;
    var isExpired=daysLeft!==null&&daysLeft<0;
    return ce("div",{style:{display:"grid",gap:12}},
      ce(Toast,{msg:toast,onDone:function(){setToast("");}}),
      ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
        ce("button",{onClick:function(){setShowDetail(false);setSelected(null);setEditMode(false);},
          style:{background:"none",border:"none",cursor:"pointer",color:T.teal,fontSize:13,
            fontWeight:700,display:"flex",alignItems:"center",gap:4,fontFamily:"inherit"}},
          "← 返回企業列表"),
        canEdit&&ce(Btn,{v:"ghost",sz:"sm",onClick:function(){setShowCredLetter(true);}},"📜 通行密碼函")),
      ce(Card,{style:{borderLeft:"4px solid "+(isAlert?T.amber:T.teal)}},
        ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}},
          ce("div",null,
            ce("div",{style:{fontSize:18,fontWeight:800,color:T.text}},ent.orgName),
            ce("div",{style:{fontSize:12,color:T.muted,marginTop:2}},ent.orgCode+" · "+ent.contact)),
          ce("div",{style:{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}},
            ce(StatusBadge,{status:ent.status||"待啟用"}),
            ce(PlanBadge,{plan:ent.plan||"基本"}))),
        isAlert&&ce(IBox,{c:"amber",style:{marginBottom:10}},
          "⚠ 帳號使用率已達 "+usePct+"% — 已達方案上限的90%，請聯繫麗媚升級方案。"),
        isExpiring&&ce(IBox,{c:"amber",style:{marginBottom:10}},
          "📅 合約將於 "+daysLeft+" 天後到期("+ent.contractEnd+")，請儘早安排續約。"),
        isExpired&&ce(IBox,{c:"red",style:{marginBottom:10}},
          "🔴 合約已於 "+ent.contractEnd+" 到期，請立即處理續約事宜。"),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}},
          [
            {l:"合約期間",v:(ent.contractStart||"-")+" ~ "+(ent.contractEnd||"-")},
            {l:"負責顧問",v:ent.consultant||"未指定"},
            {l:"接案經銷商",v:ent.partnerCode||"直客"},
            {l:"授權人數",v:(used+"/"+total+" ("+usePct+"%)")},
            {l:"聯絡電話",v:ent.phone||"-"},
            {l:"Email",v:ent.email||"-"}
          ].map(function(item){
            return ce("div",{key:item.l,style:{padding:"8px 10px",background:T.bg,borderRadius:8}},
              ce("div",{style:{fontSize:10,color:T.muted,marginBottom:2}},item.l),
              ce("div",{style:{fontSize:12,fontWeight:600,color:T.text}},item.v));
          })),
        ce("div",{style:{marginBottom:12}},
          ce("div",{style:{fontSize:11,color:T.muted,marginBottom:4}},"帳號使用率"),
          ce("div",{style:{height:8,background:T.bg,borderRadius:4,overflow:"hidden"}},
            ce("div",{style:{height:"100%",width:Math.min(usePct,100)+"%",
              background:usePct>=90?T.amber:usePct>=70?T.coral:T.teal,borderRadius:4,
              transition:"width .3s"}})),
          ce("div",{style:{fontSize:11,color:usePct>=90?T.amber:T.muted,marginTop:4,fontWeight:usePct>=90?700:400}},
            used+" / "+total+" 人("+usePct+"%)")),
        canEdit&&ce("div",{style:{display:"flex",gap:8,flexWrap:"wrap"}},
          ce(Btn,{sz:"sm",onClick:function(){setEditMode(true);}},
            "✏ 編輯資料"),
          ce(Btn,{sz:"sm",v:"amber",onClick:function(){
            var newStatus=ent.status==="啟用中"?"暫停":"啟用中";
            saveEnterprise(Object.assign({},ent,{status:newStatus}));
          }},ent.status==="啟用中"?"⏸ 暫停授權":"▶ 恢復啟用"),
          ce(Btn,{sz:"sm",v:"sage",onClick:function(){setToast("LINE通知功能：請手動發送至 @reibicare，企業代碼："+ent.orgCode);}},
            "💬 LINE通知企業"))),
      editMode&&canEdit&&ce(Card,null,
        ce(SecTitle,null,"編輯企業資料"),
        ce("div",{style:{display:"grid",gap:10}},
          ce(Select,{label:"方案等級",value:ent.plan||"成長",onChange:function(e){setSelected(Object.assign({},ent,{plan:e.target.value}));}},
            ["基本","成長","專業","旗艦"].map(function(p){return ce("option",{key:p,value:p},p);})),
          ce(Select,{label:"狀態",value:ent.status||"啟用中",onChange:function(e){setSelected(Object.assign({},ent,{status:e.target.value}));}},
            ["啟用中","試用中","暫停","終止","待啟用"].map(function(s){return ce("option",{key:s,value:s},s);})),
          ce(Inp,{label:"授權人數上限",type:"number",value:ent.memberCount||"",
            onChange:function(e){setSelected(Object.assign({},ent,{memberCount:e.target.value}));}}),
          ce(Inp,{label:"合約結束日",type:"date",value:ent.contractEnd||"",
            onChange:function(e){setSelected(Object.assign({},ent,{contractEnd:e.target.value}));}}),
          ce(Inp,{label:"負責顧問",value:ent.consultant||"",
            onChange:function(e){setSelected(Object.assign({},ent,{consultant:e.target.value}));}}),
          ce(Inp,{label:"統一編號",value:ent.ubn||"",
            onChange:function(e){setSelected(Object.assign({},ent,{ubn:e.target.value.replace(/[^0-9]/g,"").slice(0,8)}));}}),
          ce(Inp,{label:"公司登記地址",value:ent.address||"",
            onChange:function(e){setSelected(Object.assign({},ent,{address:e.target.value}));}}),
          ce("div",{style:{marginTop:4}},
            ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}},
              ce("label",{style:{fontSize:12,color:T.muted,fontWeight:600}},"健促場域地點(業務現場勘查後於此補登/更新)"),
              ce("button",{onClick:function(){setSelected(Object.assign({},ent,{dSites:(ent.dSites||[]).concat([{id:"SITE_"+Date.now(),label:"",address:"",note:""}])}));},
                style:{background:"none",border:"1px solid "+T.teal,color:T.teal,borderRadius:6,padding:"3px 8px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}},"+ 新增場域")),
            (ent.dSites||[]).map(function(site,idx){
              return ce("div",{key:site.id,style:{display:"grid",gap:6,padding:10,background:T.bg,borderRadius:8,marginBottom:6}},
                ce("div",{style:{display:"flex",gap:6,alignItems:"center"}},
                  ce("input",{value:site.label,onChange:function(e){var v=e.target.value;var list=(ent.dSites||[]).map(function(s,i){return i===idx?Object.assign({},s,{label:v}):s;});setSelected(Object.assign({},ent,{dSites:list}));},placeholder:"場域名稱(例：總公司/一廠)",style:{flex:1,padding:"7px 10px",borderRadius:6,border:"1px solid "+T.border,fontSize:12}}),
                  ce("button",{onClick:function(){var list=(ent.dSites||[]).filter(function(s,i){return i!==idx;});setSelected(Object.assign({},ent,{dSites:list}));},style:{background:"none",border:"none",color:T.coral,cursor:"pointer",fontSize:14,padding:"0 4px"}},"✕")),
                ce("input",{value:site.address,onChange:function(e){var v=e.target.value;var list=(ent.dSites||[]).map(function(s,i){return i===idx?Object.assign({},s,{address:v}):s;});setSelected(Object.assign({},ent,{dSites:list}));},placeholder:"地址",style:{padding:"7px 10px",borderRadius:6,border:"1px solid "+T.border,fontSize:12}}),
                ce("input",{value:site.note,onChange:function(e){var v=e.target.value;var list=(ent.dSites||[]).map(function(s,i){return i===idx?Object.assign({},s,{note:v}):s;});setSelected(Object.assign({},ent,{dSites:list}));},placeholder:"備註",style:{padding:"7px 10px",borderRadius:6,border:"1px solid "+T.border,fontSize:12}}));
            })),
          ce("div",{style:{display:"flex",gap:8}},
            ce(Btn,{v:"ghost",onClick:function(){setEditMode(false);}},"取消"),
            ce(Btn,{onClick:function(){saveEnterprise(ent);},full:true},"儲存變更")))));
  }

  return ce("div",{style:{display:"grid",gap:12}},
    ce(Toast,{msg:toast,onDone:function(){setToast("");}}),
    alertCount>0&&ce(IBox,{c:"amber"},
      "⚠ "+alertCount+" 家企業帳號使用率≥90%，請留意並主動聯繫。"),
    ce(Card,null,
      ce(SecTitle,null,"查詢篩選"),
      ce(DateRangePicker,{onChange:function(s,e){setDateStart(s);setDateEnd(e);}}),
      ce("div",{style:{display:"grid",gap:8}},
        ce(Inp,{label:"搜尋(企業名稱 / 代碼 / 聯絡人)",value:search,
          onChange:function(e){setSearch(e.target.value);},placeholder:"輸入關鍵字..."}),
        ce("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
          ["all","啟用中","試用中","暫停","終止"].map(function(s){
            return ce("button",{key:s,onClick:function(){setFilterStatus(s);},
              style:{padding:"4px 10px",borderRadius:20,border:"1px solid "+(filterStatus===s?T.teal:T.border),
                fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                background:filterStatus===s?T.teal:"transparent",
                color:filterStatus===s?"#fff":T.muted}},
              s==="all"?"全部狀態":s);
          })),
        ce("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
          ["all","基本","成長","專業","旗艦"].map(function(p){
            return ce("button",{key:p,onClick:function(){setFilterPlan(p);},
              style:{padding:"4px 10px",borderRadius:20,border:"1px solid "+(filterPlan===p?T.plum:T.border),
                fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                background:filterPlan===p?T.plum:"transparent",
                color:filterPlan===p?"#fff":T.muted}},
              p==="all"?"全部方案":p);
          })))),
    ce("div",{style:{fontSize:12,color:T.muted,marginBottom:4}},
      "共 "+filtered.length+" 筆"+(filtered.length!==enterprises.length?"(篩選中，共"+enterprises.length+"筆)":"")),
    filtered.length===0?ce(Card,{style:{textAlign:"center",padding:32,color:T.muted}},
      enterprises.length===0?"尚無企業資料，請至「新案開通」建立第一筆。":"無符合條件的企業"):
    ce("div",{style:{display:"grid",gap:8}},
      filtered.map(function(ent){
        var used=parseInt(ent.usedCount)||0;
        var total=parseInt(ent.memberCount)||1;
        var usePct=Math.round((used/total)*100);
        var isAlert=usePct>=90;
        var daysLeft=ent.contractEnd?Math.ceil((new Date(ent.contractEnd)-new Date())/(1000*60*60*24)):null;
        var isExpiring=daysLeft!==null&&daysLeft<=30&&daysLeft>=0;
        var isExpired=daysLeft!==null&&daysLeft<0;
        return ce(Card,{key:ent.id,onClick:function(){setSelected(ent);setShowDetail(true);setEditMode(false);},
          style:{padding:"12px 14px",cursor:"pointer",
            borderLeft:"3px solid "+(isAlert?T.amber:isExpired?T.red:isExpiring?T.coral:T.teal)}},
          ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}},
            ce("div",{style:{flex:1}},
              ce("div",{style:{fontWeight:700,fontSize:13,color:T.text,marginBottom:2}},ent.orgName),
              ce("div",{style:{fontSize:11,color:T.muted}},ent.orgCode+" · "+ent.contact),
              ce("div",{style:{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}},
                ce(StatusBadge,{status:ent.status||"待啟用"}),
                ce(PlanBadge,{plan:ent.plan||"基本"}),
                isAlert&&ce(Tag,{c:"amber"},"⚠ 帳號"+usePct+"%"),
                isExpiring&&ce(Tag,{c:"amber"},"📅 "+daysLeft+"天到期"),
                isExpired&&ce(Tag,{c:"red"},"🔴 已到期"))),
            ce("div",{style:{fontSize:11,color:T.faint,textAlign:"right",marginLeft:8}},
              used+"/"+total+"人")));
      })));
}

// ── PAYMENT SCREEN ────────────────────────────────────────────────────────────
function PaymentScreen(props){
  var session=props.session;
  var role=session&&session.role;
  var isPartner=role==="partner_primary"||role==="partner_sub";
  var[enterprises,setEnterprises]=useState([]);
  var[filterEnt,setFilterEnt]=useState("all");
  var[filterLayer,setFilterLayer]=useState("all");
  var[filterStatus,setFilterStatus]=useState("all");
  var[toast,setToast]=useState("");
  var[dateStart,setDateStart]=useState("");
  var[dateEnd,setDateEnd]=useState("");
  var[remitClaims,setRemitClaims]=useState([]);
  var[reviewingClaim,setReviewingClaim]=useState(null);
  var[reviewAmount,setReviewAmount]=useState("");
  var[reviewRowIds,setReviewRowIds]=useState({});
  var[reviewNote,setReviewNote]=useState("");
  var[copiedAll,setCopiedAll]=useState(false);
  var[ledger,setLedger]=useState([]);
  var canReview=hasPerm(role,"all")||hasPerm(role,"payment");

  var loadRemitClaims=function(){
    stor.g("l5_remit_index").then(function(idxRaw){
      var idx=idxRaw?JSON.parse(idxRaw):[];
      if(!idx.length){setRemitClaims([]);return;}
      var orgCodes=Array.from(new Set(idx.map(function(k){return k.split("_")[0];})));
      Promise.all(orgCodes.map(function(oc){return stor.g("remit_"+oc.replace(/\W/g,"_"));})).then(function(results){
        var all=[];
        results.forEach(function(raw,i){
          if(!raw)return;
          var arr=JSON.parse(raw);
          arr.forEach(function(claim){all.push(Object.assign({},claim,{_orgCodeKey:orgCodes[i]}));});
        });
        all.sort(function(a,b){return new Date(b.submittedAt)-new Date(a.submittedAt);});
        setRemitClaims(all);
      });
    });
  };

  useEffect(function(){
    stor.g("l5_enterprises").then(function(d){
      if(d){
        var list=JSON.parse(d);
        if(isPartner){list=list.filter(function(e){return e.partnerCode===session.partnerOrgCode;});}
        setEnterprises(list);
      }
    });
    loadRemitClaims();
    stor.g("l5_payment_ledger").then(function(d){if(d)setLedger(JSON.parse(d));});
  },[]);

  var buildPaymentRows=buildEntPaymentRows;

  var allRows=[];
  enterprises.forEach(function(ent){
    var rows=buildPaymentRows(ent);
    rows.forEach(function(r){allRows.push(r);});
  });

  var filtered=allRows.filter(function(r){
    var matchEnt=filterEnt==="all"||r.entId===filterEnt;
    var matchLayer=filterLayer==="all"||r.layer===filterLayer;
    var matchStatus=filterStatus==="all"||r.status===filterStatus;
    var matchDate=true;
    if(dateStart&&r.dueDate)matchDate=matchDate&&r.dueDate>=dateStart;
    if(dateEnd&&r.dueDate)matchDate=matchDate&&r.dueDate<=dateEnd;
    return matchEnt&&matchLayer&&matchStatus&&matchDate;
  });

  var redRows=filtered.filter(function(r){
    if(!r.dueDate||r.status==="已付款")return false;
    return new Date(r.dueDate)<new Date();
  });
  var orangeRows=filtered.filter(function(r){
    if(!r.dueDate||r.status==="已付款")return false;
    var d=(new Date(r.dueDate)-new Date())/(1000*60*60*24);
    return d>=0&&d<=30;
  });

  var reminderRows=allRows.filter(function(r){
    if(!r.dueDate||r.status==="已付款"||r.status==="未到期"||r.status==="待確認")return false;
    var d=(new Date(r.dueDate)-new Date())/(1000*60*60*24);
    return d<=30;
  }).sort(function(a,b){return new Date(a.dueDate)-new Date(b.dueDate);});

  var todayStr=new Date().toISOString().slice(0,10);

  var markNotified=async function(row){
    var field="notified"+row.id.split("_").pop();
    var all=await stor.g("l5_enterprises");
    var list=all?JSON.parse(all):[];
    var idx=list.findIndex(function(e){return e.id===row.entId;});
    if(idx>=0){
      list[idx][field]=todayStr;
      await stor.s("l5_enterprises",JSON.stringify(list));
      setEnterprises(list);
      setToast("已標記「"+row.entName+" "+row.layer+"」為已通知("+todayStr+")");
    }
  };

  var copyAllReminders=function(){
    var lines=reminderRows.map(function(r){
      var isOv=new Date(r.dueDate)<new Date();
      return (isOv?"🔴 已逾期":"🟠 30天內到期")+" | "+r.entName+" "+r.layer+" "+r.desc+" | NT$"+r.amount.toLocaleString()+" | 到期"+r.dueDate+(r.notifiedAt?"(已於"+r.notifiedAt+"通知)":"");
    });
    var text="【REIBI 付款提醒清單 "+todayStr+"】共"+reminderRows.length+"筆\n"+lines.join("\n");
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(function(){setCopiedAll(true);setToast("已複製全部提醒清單("+reminderRows.length+"筆)");setTimeout(function(){setCopiedAll(false);},2000);});
    }else{
      window.prompt("請手動複製以下內容：",text);
    }
  };

  var markAllNotified=async function(){
    var all=await stor.g("l5_enterprises");
    var list=all?JSON.parse(all):[];
    reminderRows.forEach(function(row){
      var field="notified"+row.id.split("_").pop();
      var idx=list.findIndex(function(e){return e.id===row.entId;});
      if(idx>=0)list[idx][field]=todayStr;
    });
    await stor.s("l5_enterprises",JSON.stringify(list));
    setEnterprises(list);
    setToast("已將全部 "+reminderRows.length+" 筆標記為已通知("+todayStr+")");
  };

  var updatePayStatus=async function(rowId,entId,field,newStatus){
    var all=await stor.g("l5_enterprises");
    var list=all?JSON.parse(all):[];
    var idx=list.findIndex(function(e){return e.id===entId;});
    if(idx>=0){
      list[idx][field]=newStatus;
      await stor.s("l5_enterprises",JSON.stringify(list));
      setEnterprises(function(prev){
        var n=prev.slice();
        var i=n.findIndex(function(e){return e.id===entId;});
        if(i>=0)n[i]=Object.assign({},n[i],JSON.parse("{\""+field+"\":\""+newStatus+"\"}"));
        return n;
      });
      setToast("付款狀態已更新");
    }
  };

  var getFieldFromId=function(rowId){
    var suffix=rowId.split("_").pop();
    return "pay"+suffix;
  };

  var statusColor=function(s,dueDate){
    if(s==="已付款")return{bg:"#f0fdf4",c:"#166534"};
    if(s==="部分付款")return{bg:T.amberBg,c:T.coral};
    if(dueDate&&new Date(dueDate)<new Date())return{bg:T.redBg,c:T.red};
    var d=dueDate?(new Date(dueDate)-new Date())/(1000*60*60*24):999;
    if(d<=30)return{bg:T.amberBg,c:T.amber};
    return{bg:"#f8fafc",c:T.muted};
  };

  var openReview=function(claim){
    setReviewingClaim(claim);
    setReviewAmount(String(claim.correctedAmount||0));
    setReviewRowIds({});
    setReviewNote("");
  };

  var toggleReviewRow=function(rowId){
    setReviewRowIds(function(p){var n=Object.assign({},p);n[rowId]=!n[rowId];return n;});
  };

  var saveClaimStatus=async function(claim,newStatus,extra){
    var key="remit_"+claim._orgCodeKey.replace(/\W/g,"_");
    var raw=await stor.g(key);
    var arr=raw?JSON.parse(raw):[];
    arr=arr.map(function(c){return c.id===claim.id?Object.assign({},c,{status:newStatus},extra||{}):c;});
    await stor.s(key,JSON.stringify(arr));
    loadRemitClaims();
  };

  var doReconcile=async function(){
    if(!reviewingClaim)return;
    var selectedRowIds=Object.keys(reviewRowIds).filter(function(k){return reviewRowIds[k];});
    if(!selectedRowIds.length){setToast("請至少勾選一筆要沖帳的應付項目");return;}
    var remainAmount=Number(reviewAmount)||0;
    var entId=reviewingClaim.matchedEntId||(selectedRowIds[0]?selectedRowIds[0].split("_")[0]:null);
    var selectedRows=allRows.filter(function(r){return selectedRowIds.indexOf(r.id)>=0;});
    if(!selectedRows.length){setToast("找不到對應的應付項目");return;}
    entId=selectedRows[0].entId;
    var totalDue=selectedRows.reduce(function(a,r){return a+r.amount;},0);
    var isMismatch=remainAmount!==totalDue;
    var all=await stor.g("l5_enterprises");
    var list=all?JSON.parse(all):[];
    var idx=list.findIndex(function(e){return e.id===entId;});
    if(idx<0){setToast("找不到對應企業");return;}
    selectedRows.forEach(function(row){
      var field=getFieldFromId(row.id);
      if(remainAmount>=row.amount){
        list[idx][field]="已付款";
        remainAmount-=row.amount;
      }else if(remainAmount>0){
        list[idx][field]="部分付款";
      }
    });
    await stor.s("l5_enterprises",JSON.stringify(list));
    var ledgerRaw=await stor.g("l5_payment_ledger");
    var ledger=ledgerRaw?JSON.parse(ledgerRaw):[];
    ledger.unshift({
      id:"LG_"+Date.now(),
      claimId:reviewingClaim.id,
      entId:entId,entName:list[idx].orgName,
      reconciledRows:selectedRowIds,
      claimedAmount:Number(reviewAmount)||0,
      totalDueAmount:totalDue,
      isMismatch:isMismatch,
      diffAmount:(Number(reviewAmount)||0)-totalDue,
      reviewedBy:session&&session.name,
      reviewedAt:new Date().toISOString(),
      reviewNote:reviewNote,
      aiOriginal:reviewingClaim.aiOriginal||null,
      correctedValues:{name:reviewingClaim.correctedName,account:reviewingClaim.correctedAccount,date:reviewingClaim.correctedDate,amount:reviewingClaim.correctedAmount}
    });
    await stor.s("l5_payment_ledger",JSON.stringify(ledger));
    setLedger(ledger);
    await saveClaimStatus(reviewingClaim,isMismatch?"金額不符":"已沖帳",{
      reviewNote:isMismatch?"沖帳金額NT$"+(Number(reviewAmount)||0)+"與應付NT$"+totalDue+"不符，差額NT$"+((Number(reviewAmount)||0)-totalDue):reviewNote,
      reconciledRowIds:selectedRowIds,
      totalDueAmount:totalDue,
      diffAmount:(Number(reviewAmount)||0)-totalDue,
      reviewedBy:session&&session.name,
      reviewedAt:new Date().toISOString()
    });
    stor.g("l5_enterprises").then(function(d){if(d)setEnterprises(JSON.parse(d));});
    setReviewingClaim(null);
    setToast(isMismatch?"已沖帳但金額不符，已標記供財務追蹤":"沖帳完成，付款狀態已更新");
  };

  var doRejectClaim=async function(claim){
    var reason=window.prompt("請輸入拒絕原因(將顯示給申請人)","");
    if(reason===null)return;
    await saveClaimStatus(claim,"已拒絕",{reviewNote:reason,reviewedBy:session&&session.name,reviewedAt:new Date().toISOString()});
    setToast("已拒絕此對帳申請");
  };

  var totalPending=filtered.filter(function(r){return r.status!=="已付款"&&r.status!=="未到期"&&r.status!=="待確認";}).reduce(function(a,r){return a+r.amount;},0);
  var totalPaid=filtered.filter(function(r){return r.status==="已付款";}).reduce(function(a,r){return a+r.amount;},0);

  var thisMonthYM=new Date().toISOString().slice(0,7);
  var thisMonthLedger=ledger.filter(function(l){return (l.reviewedAt||"").slice(0,7)===thisMonthYM;});
  var mtMismatch=thisMonthLedger.filter(function(l){return l.isMismatch;}).length;
  var mtClaimed=thisMonthLedger.reduce(function(a,l){return a+(l.claimedAmount||0);},0);
  var mtDue=thisMonthLedger.reduce(function(a,l){return a+(l.totalDueAmount||0);},0);

  return ce("div",{style:{display:"grid",gap:12}},
    ce(Toast,{msg:toast,onDone:function(){setToast("");}}),
    canReview&&remitClaims.filter(function(c){return c.status==="待審核";}).length>0&&ce(Card,{style:{border:"2px solid "+T.amber}},
      ce(SecTitle,null,"📋 待審核對帳申請("+remitClaims.filter(function(c){return c.status==="待審核";}).length+"筆)"),
      ce(IBox,{c:"amber",style:{marginBottom:10}},"客戶端上傳匯款單後AI自動辨識，請核對辨識結果與企業應付金額後確認沖帳。"),
      remitClaims.filter(function(c){return c.status==="待審核";}).map(function(c){
        return ce(Card,{key:c.id,style:{padding:"10px 14px",marginBottom:8,background:T.bg}},
          ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}},
            ce("div",null,
              ce("div",{style:{fontWeight:700,fontSize:13,color:T.text}},c.correctedName||c.orgNameGuess),
              ce("div",{style:{fontSize:11,color:T.muted,marginTop:2}},(c.correctedDate||"—")+" · 帳號"+(c.correctedAccount||"—")),
              ce("div",{style:{fontSize:11,color:T.muted,marginTop:2}},"申請人："+c.submittedBy+" · "+(c.submittedAt||"").slice(0,16).replace("T"," "))),
            ce("div",{style:{textAlign:"right"}},
              ce("div",{style:{fontSize:16,fontWeight:800,color:T.amber}},"NT$"+(c.correctedAmount||0).toLocaleString()))),
          ce("div",{style:{display:"flex",gap:6,marginTop:8}},
            ce(Btn,{sz:"sm",v:"sage",onClick:function(){openReview(c);}},"✅ 審核沖帳"),
            ce(Btn,{sz:"sm",v:"danger",onClick:function(){doRejectClaim(c);}},"✗ 拒絕")));
      })),
    reviewingClaim&&ce(Card,{style:{border:"2px solid "+T.teal}},
      ce(SecTitle,null,"沖帳作業：「"+(reviewingClaim.correctedName||reviewingClaim.orgNameGuess)+"」"),
      ce(IBox,{c:"teal",style:{marginBottom:10,fontSize:11}},"AI原始辨識(不可修改)："+(reviewingClaim.aiOriginal?JSON.stringify(reviewingClaim.aiOriginal):"無")),
      ce("div",{style:{marginBottom:10}},
        ce("label",{style:{fontSize:12,color:T.muted,fontWeight:600,display:"block",marginBottom:4}},"沖帳金額(可調整)"),
        ce("input",{type:"number",value:reviewAmount,onChange:function(e){setReviewAmount(e.target.value);},
          style:{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:14,boxSizing:"border-box"}})),
      ce("div",{style:{marginBottom:10}},
        ce("label",{style:{fontSize:12,color:T.muted,fontWeight:600,display:"block",marginBottom:6}},"勾選要沖銷的應付項目(支援跨層勾選，部分沖銷自動標記)"),
        allRows.filter(function(r){return r.entName&&(r.entName===reviewingClaim.correctedName||(reviewingClaim.orgNameGuess&&r.entName===reviewingClaim.orgNameGuess));}).filter(function(r){return r.status!=="已付款";}).map(function(r){
          return ce("div",{key:r.id,onClick:function(){toggleReviewRow(r.id);},
            style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",marginBottom:4,borderRadius:8,cursor:"pointer",
              border:"1px solid "+(reviewRowIds[r.id]?T.teal:T.border),background:reviewRowIds[r.id]?T.tealBg:T.card}},
            ce("div",null,
              ce("div",{style:{fontSize:12,fontWeight:600,color:T.text}},r.layer+" "+r.desc),
              ce("div",{style:{fontSize:10,color:T.muted}},"到期："+(r.dueDate||"—"))),
            ce("div",{style:{fontSize:13,fontWeight:700,color:T.amber}},"NT$"+r.amount.toLocaleString()));
        })),
      ce("input",{value:reviewNote,onChange:function(e){setReviewNote(e.target.value);},placeholder:"審核備註(選填)",
        style:{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,boxSizing:"border-box",marginBottom:10}}),
      ce("div",{style:{display:"flex",gap:8}},
        ce(Btn,{v:"sage",onClick:doReconcile,full:true},"✅ 確認沖帳"),
        ce(Btn,{v:"ghost",onClick:function(){setReviewingClaim(null);}},"取消"))),
    canReview&&reminderRows.length>0&&ce(Card,{style:{border:"2px solid "+T.coral}},
      ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:8}},
        ce(SecTitle,{style:{marginBottom:0}},"🔔 待產生提醒清單("+reminderRows.length+"筆，逾期+30天內到期)"),
        ce("div",{style:{display:"flex",gap:6}},
          ce(Btn,{sz:"sm",v:copiedAll?"sage":"amber",onClick:copyAllReminders},copiedAll?"✓ 已複製":"📋 一鍵複製全部"),
          ce(Btn,{sz:"sm",v:"ghost",onClick:markAllNotified},"✓ 全部標記已通知"))),
      ce("div",{style:{display:"grid",gap:6,maxHeight:320,overflowY:"auto"}},
        reminderRows.map(function(r){
          var isOv=new Date(r.dueDate)<new Date();
          return ce("div",{key:r.id,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",
            borderRadius:8,border:"1px solid "+T.border,background:isOv?T.redBg:T.amberBg}},
            ce("div",null,
              ce("div",{style:{fontSize:12,fontWeight:700,color:T.text}},(isOv?"🔴 ":"🟠 ")+r.entName+" · "+r.layer+" "+r.desc),
              ce("div",{style:{fontSize:10,color:T.muted,marginTop:2}},"到期"+r.dueDate+" · NT$"+r.amount.toLocaleString()+
                (r.notifiedAt?"　✓ 已於"+r.notifiedAt+"通知":"")) ),
            ce(Btn,{sz:"sm",v:r.notifiedAt===todayStr?"sage":"ghost",onClick:function(){markNotified(r);}},
              r.notifiedAt===todayStr?"✓ 今日已通知":"標記已通知"));
        }))),
    (redRows.length>0||orangeRows.length>0)&&ce("div",{style:{display:"grid",gap:6}},
      redRows.length>0&&ce(IBox,{c:"red"},"🔴 逾期未付 "+redRows.length+" 筆，總計 NT$"+(redRows.reduce(function(a,r){return a+r.amount;},0)/10000).toFixed(1)+"萬"),
      orangeRows.length>0&&ce(IBox,{c:"amber"},"🟠 30天內到期 "+orangeRows.length+" 筆，總計 NT$"+(orangeRows.reduce(function(a,r){return a+r.amount;},0)/10000).toFixed(1)+"萬")),
    ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}},
      ce(Card,{style:{padding:"12px 14px"}},
        ce("div",{style:{fontSize:11,color:T.muted}},"待收款總計"),
        ce("div",{style:{fontSize:20,fontWeight:800,color:T.amber}},"NT$"+(totalPending/10000).toFixed(1)+"萬")),
      ce(Card,{style:{padding:"12px 14px"}},
        ce("div",{style:{fontSize:11,color:T.muted}},"已收款總計"),
        ce("div",{style:{fontSize:20,fontWeight:800,color:T.green}},"NT$"+(totalPaid/10000).toFixed(1)+"萬"))),
    canReview&&ce(Card,{style:{background:"linear-gradient(135deg,"+T.tealBg+",#fff)"}},
      ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
        ce(SecTitle,{style:{marginBottom:0}},"🧾 本月("+thisMonthYM+")對帳總表"),
        ce("span",{style:{fontSize:11,color:T.muted}},"完整月結報表請至 報表中心")),
      ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:8}},
        [{l:"本月沖帳筆數",v:thisMonthLedger.length+"筆"},
         {l:"金額不符筆數",v:mtMismatch+"筆",c:mtMismatch>0?T.red:T.sage},
         {l:"沖帳/應付總額",v:"NT$"+mtClaimed.toLocaleString()+" / NT$"+mtDue.toLocaleString()}].map(function(k){
          return ce("div",{key:k.l},
            ce("div",{style:{fontSize:10,color:T.muted}},k.l),
            ce("div",{style:{fontSize:14,fontWeight:800,color:k.c||T.teal}},k.v));
        }))),
    ce(Card,null,
      ce(SecTitle,null,"篩選查詢"),
      ce(DateRangePicker,{onChange:function(s,e){setDateStart(s);setDateEnd(e);}}),
      ce("div",{style:{display:"grid",gap:8}},
        ce(Select,{label:"企業",value:filterEnt,onChange:function(e){setFilterEnt(e.target.value);}},
          ce("option",{value:"all"},"全部企業"),
          enterprises.map(function(e){return ce("option",{key:e.id,value:e.id},e.orgName);})),
        ce("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
          ["all","A層","B層","C層","D層"].map(function(l){
            return ce("button",{key:l,onClick:function(){setFilterLayer(l);},
              style:{padding:"4px 10px",borderRadius:20,border:"1px solid "+(filterLayer===l?T.teal:T.border),
                fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                background:filterLayer===l?T.teal:"transparent",
                color:filterLayer===l?"#fff":T.muted}},
              l==="all"?"全部層":l);
          })),
        ce("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
          ["all","待付款","已付款","部分付款","逾期","未到期","待確認"].map(function(s){
            return ce("button",{key:s,onClick:function(){setFilterStatus(s);},
              style:{padding:"4px 10px",borderRadius:20,border:"1px solid "+(filterStatus===s?T.plum:T.border),
                fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                background:filterStatus===s?T.plum:"transparent",
                color:filterStatus===s?"#fff":T.muted}},
              s==="all"?"全部狀態":s);
          })))),
    filtered.length===0?ce(Card,{style:{textAlign:"center",padding:32,color:T.muted}},"無符合條件的付款記錄"):
    ce("div",{style:{display:"grid",gap:8}},
      filtered.map(function(row){
        var sc=statusColor(row.status,row.dueDate);
        var isOverdue=row.dueDate&&new Date(row.dueDate)<new Date()&&row.status!=="已付款";
        var field=getFieldFromId(row.id);
        return ce(Card,{key:row.id,style:{padding:"12px 14px",borderLeft:"3px solid "+(isOverdue?T.red:sc.c)}},
          ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}},
            ce("div",{style:{flex:1}},
              ce("div",{style:{fontWeight:700,fontSize:12,color:T.text}},row.entName),
              ce("div",{style:{fontSize:11,color:T.muted,marginTop:2}},row.layer+" · "+row.desc),
              row.dueDate&&ce("div",{style:{fontSize:11,color:isOverdue?T.red:T.muted,marginTop:2}},
                "到期："+row.dueDate+(isOverdue?" ⚠ 已逾期":"")+(row.notifiedAt?"　✓ 已於"+row.notifiedAt+"通知":"")) ),
            ce("div",{style:{textAlign:"right",marginLeft:10}},
              ce("div",{style:{fontSize:14,fontWeight:800,color:T.amber}},"NT$"+(row.amount/10000).toFixed(1)+"萬"),
              ce("span",{style:{padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,
                background:sc.bg,color:sc.c}},row.status))),
          hasPerm(role,"all")||hasPerm(role,"payment")?ce("div",{style:{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}},
            ["待付款","已付款","逾期"].map(function(s){
              return ce(Btn,{key:s,sz:"sm",v:s==="已付款"?"sage":s==="逾期"?"danger":"ghost",
                disabled:row.status===s,
                onClick:function(){updatePayStatus(row.id,row.entId,field,s);}},s);
            }),
            ce(Btn,{sz:"sm",v:"amber",onClick:function(){
              var txt="LINE提醒："+row.entName+" "+row.layer+" "+row.desc+" NT$"+row.amount.toLocaleString()+" 請盡快付款，聯絡 @reibicare";
              if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt);
              markNotified(row);
            }},"💬 LINE提醒+標記")):null);
      })));
}

// ── AUTH MGMT SCREEN ──────────────────────────────────────────────────────────
function AuthMgmtScreen(props){
  var session=props.session;
  var role=session&&session.role;
  var canEdit=hasPerm(role,"all");
  var[enterprises,setEnterprises]=useState([]);
  var[toast,setToast]=useState("");
  var[search,setSearch]=useState("");
  var[filterStatus,setFilterStatus]=useState("all");
  var[dateStart,setDateStart]=useState("");
  var[dateEnd,setDateEnd]=useState("");

  useEffect(function(){
    stor.g("l5_enterprises").then(function(d){
      if(d)setEnterprises(JSON.parse(d));
    });
  },[]);

  var saveField=async function(entId,field,value){
    var all=await stor.g("l5_enterprises");
    var list=all?JSON.parse(all):[];
    var idx=list.findIndex(function(e){return e.id===entId;});
    if(idx>=0){
      list[idx][field]=value;
      await stor.s("l5_enterprises",JSON.stringify(list));
      setEnterprises(function(prev){
        var n=prev.slice();
        var i=n.findIndex(function(e){return e.id===entId;});
        if(i>=0)n[i]=Object.assign({},n[i],JSON.parse("{\""+field+"\":\""+value+"\"}" ));
        return n;
      });
      setToast("授權資訊已更新");
    }
  };

  var filtered=enterprises.filter(function(e){
    var matchSearch=!search||(e.orgName&&e.orgName.includes(search))||(e.orgCode&&e.orgCode.includes(search.toUpperCase()));
    var matchStatus=filterStatus==="all"||e.status===filterStatus;
    var matchDate=true;
    if(dateStart&&e.contractStart)matchDate=matchDate&&e.contractStart>=dateStart;
    if(dateEnd&&e.contractEnd)matchDate=matchDate&&e.contractEnd<=dateEnd;
    return matchSearch&&matchStatus&&matchDate;
  });

  var now=new Date();
  var expiring=filtered.filter(function(e){
    if(!e.contractEnd)return false;
    var d=(new Date(e.contractEnd)-now)/(1000*60*60*24);
    return d>=0&&d<=30;
  });
  var expired=filtered.filter(function(e){
    if(!e.contractEnd)return false;
    return new Date(e.contractEnd)<now;
  });

  var[showPinPanel,setShowPinPanel]=useState({});
  var[newPinInput,setNewPinInput]=useState({});
  var[pinResetOk,setPinResetOk]=useState({});
  var[changeReqs,setChangeReqs]=useState([]);

  useEffect(function(){
    stor.g("l5_enterprises").then(function(d){
      if(d)setEnterprises(JSON.parse(d));
    });
    // 載入所有待審核的人員變更申請
    stor.g("l5_change_req_index").then(function(idxRaw){
      var idx=idxRaw?JSON.parse(idxRaw):[];
      if(!idx.length)return;
      var orgCodes=Array.from(new Set(idx.map(function(k){return k.split("_")[0];})));
      Promise.all(orgCodes.map(function(oc){
        return stor.g("change_req_"+oc.replace(/\W/g,"_")).then(function(raw){return {oc:oc,raw:raw};});
      })).then(function(results){
        var all=[];
        results.forEach(function(r){
          if(!r.raw)return;
          var list=JSON.parse(r.raw);
          list.forEach(function(req){all.push(req);});
        });
        all.sort(function(a,b){return (b.submittedAt||"")>(a.submittedAt||"")?1:-1;});
        setChangeReqs(all);
      });
    });
  },[]);

  var doReviewChangeReq=async function(req,status,note){
    var key="change_req_"+req.orgCode.replace(/\W/g,"_");
    var raw=await stor.g(key);
    var list=raw?JSON.parse(raw):[];
    var idx=list.findIndex(function(r){return r.id===req.id;});
    if(idx>=0){
      list[idx].status=status;
      list[idx].reviewNote=note||"";
      list[idx].reviewedBy=session&&session.name;
      list[idx].reviewedAt=new Date().toISOString();
      await stor.s(key,JSON.stringify(list));
    }
    setChangeReqs(function(prev){return prev.map(function(r){
      return r.id===req.id?Object.assign({},r,{status:status,reviewNote:note||"",reviewedBy:session&&session.name}):r;
    });});
    setToast("申請「"+req.type+"("+req.orgName+")」已標記為"+status);
  };

  var pendingReqs=changeReqs.filter(function(r){return r.status==="待審核";});

  var hashPin=async function(p){
    var b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode("REIBI:"+p));
    return Array.from(new Uint8Array(b)).map(function(x){return x.toString(16).padStart(2,"0");}).join("").slice(0,32);
  };

  var genRC=function(){
    var chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var result="";
    for(var i=0;i<8;i++)result+=chars[Math.floor(Math.random()*chars.length)];
    return result;
  };

  var doResetPin=async function(ent,newPin){
    if(!newPin||newPin.length<4){setToast("新PIN至少4位");return;}
    var ph=await hashPin(newPin);
    await stor.s("pin_"+ent.orgCode.replace(/\W/g,"_"),ph);
    var nc=genRC();
    var rh=await hashPin(nc);
    await stor.s("rc_"+ent.orgCode.replace(/\W/g,"_"),rh);
    var all=await stor.g("l5_enterprises");
    var list=all?JSON.parse(all):[];
    var idx=list.findIndex(function(e){return e.id===ent.id;});
    if(idx>=0){
      list[idx].adminPin=newPin;
      list[idx].backupCode=nc;
      list[idx].pinResetAt=new Date().toISOString();
      list[idx].pinResetBy=session&&session.name;
      await stor.s("l5_enterprises",JSON.stringify(list));
      setEnterprises(list);
    }
    // 記錄變更申請已處理
    var crRaw=await stor.g("l5_change_requests");
    var crList=crRaw?JSON.parse(crRaw):[];
    crList.push({id:"CR_"+Date.now(),orgCode:ent.orgCode,orgName:ent.orgName,type:"PIN重設",
      newPin:newPin,newBackupCode:nc,processedBy:session&&session.name,processedAt:new Date().toISOString()});
    await stor.s("l5_change_requests",JSON.stringify(crList));
    setPinResetOk(function(prev){return Object.assign({},prev,{[ent.id]:nc});});
    setNewPinInput(function(prev){return Object.assign({},prev,{[ent.id]:"" });});
    setToast("「"+ent.orgName+"」管理者PIN已重設，新備用碼已產生，請立即通知企業聯絡人");
  };

  return ce("div",{style:{display:"grid",gap:12}},
    ce(Toast,{msg:toast,onDone:function(){setToast("");}}),
    pendingReqs.length>0&&ce(Card,{style:{border:"2px solid "+T.plum}},
      ce(SecTitle,null,"📋 待處理人員變更申請("+pendingReqs.length+"筆)"),
      ce(IBox,{c:"plum",style:{marginBottom:10,fontSize:11}},"企業透過主平台提交的人員/權限變更申請，需REIBI客服電話確認身份後協助處理。處理完成後請標記「已完成」，並備註說明。"),
      ce("div",{style:{display:"grid",gap:8}},
        pendingReqs.map(function(r){
          return ce("div",{key:r.id,style:{padding:"10px 12px",borderRadius:8,border:"1px solid "+T.plum,background:T.plumBg}},
            ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}},
              ce("div",null,
                ce("div",{style:{fontWeight:700,fontSize:13,color:T.text}},r.orgName+" · "+r.type),
                ce("div",{style:{fontSize:11,color:T.muted}},r.submittedAt.slice(0,10)+" · 申請人："+r.submittedBy),
                ce("div",{style:{fontSize:12,color:T.text,marginTop:4}},"主旨："+r.subject),
                ce("div",{style:{fontSize:11,color:T.muted,marginTop:2}},"原因："+r.reason),
                ce("div",{style:{fontSize:11,color:T.muted,marginTop:2}},"聯絡："+r.contactName+" "+r.contactPhone)),
              ce("span",{style:{padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,background:T.amberBg,color:T.amber}},"待審核")),
            ce("div",{style:{display:"flex",gap:6}},
              ce(Btn,{sz:"sm",v:"sage",onClick:function(){
                var note=window.prompt("請輸入完成備註(例：已重設PIN並電話通知聯絡人)","");
                if(note===null)return;
                doReviewChangeReq(r,"已完成",note);
              }},"✅ 標記已完成"),
              ce(Btn,{sz:"sm",v:"danger",onClick:function(){
                var note=window.prompt("請輸入拒絕原因","");
                if(note===null)return;
                doReviewChangeReq(r,"已拒絕",note);
              }},"✗ 拒絕"),
              r.type.includes("PIN")&&ce(Btn,{sz:"sm",v:"amber",onClick:function(){
                setShowPinPanel(function(prev){
                  var ent=enterprises.find(function(e){return e.orgCode===r.orgCode;});
                  if(ent)return Object.assign({},prev,{[ent.id]:true});
                  return prev;
                });
                setToast("已展開「"+r.orgName+"」的PIN管理面板，請在下方找到該企業並重設PIN");
              }},"🔐 開啟PIN管理")));
        }))),
    ce(IBox,{c:"amber"},"⚠ 安全示警：初始 memberPin/deptPin/adminPin 為開通時明文生成，若企業已自行變更PIN，此處顯示的為舊值(已過期)。管理者adminPin在主平台以SHA-256雜湊儲存，無法反查明文，只能重設。重設PIN將同步產生新備用碼，請立即透過安全管道通知企業聯絡人。"),
    (expiring.length>0||expired.length>0)&&ce("div",{style:{display:"grid",gap:6}},
      expired.length>0&&ce(IBox,{c:"red"},"🔴 已到期授權 "+expired.length+" 家，請立即處理"),
      expiring.length>0&&ce(IBox,{c:"amber"},"📅 30天內到期 "+expiring.length+" 家："+expiring.map(function(e){return e.orgName;}).join("、"))),
    ce(Card,null,
      ce(SecTitle,null,"授權查詢"),
      ce(DateRangePicker,{onChange:function(s,e){setDateStart(s);setDateEnd(e);}}),
      ce("div",{style:{display:"grid",gap:8}},
        ce(Inp,{label:"搜尋",value:search,onChange:function(e){setSearch(e.target.value);},placeholder:"企業名稱或代碼"}),
        ce("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
          ["all","啟用中","試用中","暫停","終止"].map(function(s){
            return ce("button",{key:s,onClick:function(){setFilterStatus(s);},
              style:{padding:"4px 10px",borderRadius:20,border:"1px solid "+(filterStatus===s?T.teal:T.border),
                fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                background:filterStatus===s?T.teal:"transparent",
                color:filterStatus===s?"#fff":T.muted}},
              s==="all"?"全部":s);
          })))),
    filtered.length===0?ce(Card,{style:{textAlign:"center",padding:32,color:T.muted}},"無符合條件的授權記錄"):
    ce("div",{style:{display:"grid",gap:8}},
      filtered.map(function(ent){
        var daysLeft=ent.contractEnd?Math.ceil((new Date(ent.contractEnd)-now)/(1000*60*60*24)):null;
        var isExpired=daysLeft!==null&&daysLeft<0;
        var isExpiring=daysLeft!==null&&daysLeft>=0&&daysLeft<=30;
        var contractPct=0;
        if(ent.contractStart&&ent.contractEnd){
          var total=new Date(ent.contractEnd)-new Date(ent.contractStart);
          var elapsed=now-new Date(ent.contractStart);
          contractPct=Math.min(100,Math.max(0,Math.round((elapsed/total)*100)));
        }
        var showPin=showPinPanel[ent.id];
        return ce(Card,{key:ent.id,style:{padding:"12px 14px",
          borderLeft:"3px solid "+(isExpired?T.red:isExpiring?T.amber:T.teal)}},
          ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}},
            ce("div",null,
              ce("div",{style:{fontWeight:700,fontSize:13,color:T.text}},ent.orgName),
              ce("div",{style:{fontSize:11,color:T.muted}},ent.orgCode+" · "+ent.plan+"方案")),
            ce("div",{style:{display:"flex",gap:4,flexDirection:"column",alignItems:"flex-end"}},
              ce(StatusBadge,{status:ent.status||"待啟用"}),
              daysLeft!==null&&ce("span",{style:{fontSize:10,fontWeight:700,
                color:isExpired?T.red:isExpiring?T.amber:T.muted}},
                isExpired?"已逾期"+Math.abs(daysLeft)+"天":
                isExpiring?"剩"+daysLeft+"天":
                "剩"+daysLeft+"天"))),
          ent.contractStart&&ent.contractEnd&&ce("div",{style:{marginBottom:8}},
            ce("div",{style:{fontSize:10,color:T.muted,marginBottom:3}},
              "合約進度 "+ent.contractStart+" → "+ent.contractEnd),
            ce("div",{style:{height:6,background:T.bg,borderRadius:3,overflow:"hidden"}},
              ce("div",{style:{height:"100%",width:contractPct+"%",
                background:isExpired?T.red:isExpiring?T.amber:T.teal,borderRadius:3}})),
            ce("div",{style:{fontSize:10,color:T.muted,marginTop:2}},contractPct+"%完成")),
          canEdit&&ce("div",{style:{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}},
            ce(Select,{value:ent.plan||"成長",onChange:function(e){saveField(ent.id,"plan",e.target.value);},
              style:{flex:1,minWidth:100}},
              ["基本","成長","專業","旗艦"].map(function(p){return ce("option",{key:p,value:p},p);})),
            ce(Select,{value:ent.status||"啟用中",onChange:function(e){saveField(ent.id,"status",e.target.value);},
              style:{flex:1,minWidth:100}},
              ["啟用中","試用中","暫停","終止"].map(function(s){return ce("option",{key:s,value:s},s);})),
            ce(Btn,{sz:"sm",v:"sage",onClick:function(){
              setToast("LINE通知："+ent.orgName+" 授權將於"+(daysLeft||0)+"天後到期，請聯繫麗媚續約。@reibicare");
            }},"💬 LINE通知"),
            ce(Btn,{sz:"sm",v:showPin?"amber":"ghost",onClick:function(){
              setShowPinPanel(function(prev){return Object.assign({},prev,{[ent.id]:!prev[ent.id]});});
              setPinResetOk(function(prev){return Object.assign({},prev,{[ent.id]:null});});
            }},showPin?"▲ 收合PIN管理":"🔐 PIN管理")),
          showPin&&ce("div",{style:{padding:"10px 12px",background:T.redBg,borderRadius:8,border:"1px solid "+T.red}},
            ce(IBox,{c:"red",style:{fontSize:10,marginBottom:8}},"⚠ 安全警告：以下資料屬高度機密，查閱即記錄至稽核日誌。初始值僅供開通參考，企業若已自行修改則以下值已過期。adminPin已雜湊無法顯示明文，只能重設新值。"),
            ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}},
              [{l:"成員群組密碼(初始)",v:ent.memberPin||"—",note:"所有成員共用"},
               {l:"主管群組密碼(初始)",v:ent.deptPin||"—",note:"部門主管共用"},
               {l:"備用碼(最新)",v:ent.backupCode||"—",note:"企業主動申請或REIBI重設後更新"},
               {l:"PIN最近一次重設",v:ent.pinResetAt?ent.pinResetAt.slice(0,10)+"("+ent.pinResetBy+")":"—",note:""}
              ].map(function(item){
                return ce("div",{key:item.l,style:{padding:"8px 10px",background:T.card,borderRadius:6}},
                  ce("div",{style:{fontSize:10,color:T.muted}},item.l),
                  ce("div",{style:{fontSize:12,fontWeight:700,color:T.red,letterSpacing:"0.1em"}},item.v),
                  item.note&&ce("div",{style:{fontSize:9,color:T.faint}},item.note));
              })),
            pinResetOk[ent.id]&&ce(IBox,{c:"sage",style:{fontSize:11,marginBottom:8}},
              "✅ PIN重設完成！新備用碼："+pinResetOk[ent.id]+" — 請立即透過電話/LINE安全管道告知企業聯絡人「"+ent.contact+"」，切勿以Email明文傳送。"),
            ce("div",{style:{display:"flex",gap:8,alignItems:"flex-end"}},
              ce("div",{style:{flex:1}},
                ce("label",{style:{fontSize:11,color:T.muted,display:"block",marginBottom:4,fontWeight:600}},"重設管理者PIN(新值，至少4位)"),
                ce("input",{type:"password",value:newPinInput[ent.id]||"",
                  onChange:function(e){setNewPinInput(function(prev){return Object.assign({},prev,{[ent.id]:e.target.value});});},
                  placeholder:"輸入新PIN…",
                  style:{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+T.red,fontSize:13,boxSizing:"border-box",fontFamily:"inherit"}})),
              ce(Btn,{v:"danger",onClick:function(){doResetPin(ent,newPinInput[ent.id]||"");}},
                "🔄 重設PIN"))));
      })));
}

// ── DISTRIBUTOR SCREEN ────────────────────────────────────────────────────────
function DistributorScreen(props){
  var session=props.session;
  var role=session&&session.role;
  var canEdit=hasPerm(role,"all");
  var canFinance=hasPerm(role,"all")||hasPerm(role,"distributor");
  var isPartner=role==="partner_primary"||role==="partner_sub";
  var[distributors,setDistributors]=useState([]);
  var[enterprises,setEnterprises]=useState([]);
  var[selected,setSelected]=useState(null);
  var[showDetail,setShowDetail]=useState(false);
  var[showCredLetter,setShowCredLetter]=useState(false);
  var[showAdd,setShowAdd]=useState(false);
  var[subContractTarget,setSubContractTarget]=useState(null);
  var[showSubContract,setShowSubContract]=useState(false);
  var[toast,setToast]=useState("");
  var[filterLevel,setFilterLevel]=useState("all");
  var[newD,setNewD]=useState({name:"",alias:"",contact:"",phone:"",email:"",ubn:"",address:"",level:"silver",type:"primary",parentId:"",region:"",note:"",staffId:""});
  var[commOverride,setCommOverride]=useState({});
  // v2.6新增：A/B/C層分潤%開放自填(每層各自)，並讀取REIBI保留下限護欄設定
  var[pctOverride,setPctOverride]=useState({});
  var[minRetainPct,setMinRetainPct]=useState(L5_COMM_DEFAULT_MIN_RETAIN_PCT);
  var[newRetainPct,setNewRetainPct]=useState("");
  useEffect(function(){
    stor.g("l5_settings").then(function(d){
      if(d){var s=JSON.parse(d);if(s.minReibiRetainPct!==undefined)setMinRetainPct(s.minReibiRetainPct);}
    });
  },[]);
  var saveRetainPct=async function(){
    var v=parseFloat(newRetainPct);
    if(!v||v<0||v>100){setToast("請填入0-100之間的數字");return;}
    var raw=await stor.g("l5_settings");
    var s=raw?JSON.parse(raw):{};
    s.minReibiRetainPct=v;
    await stor.s("l5_settings",JSON.stringify(s));
    setMinRetainPct(v);setNewRetainPct("");
    setToast("REIBI保留下限已更新為"+v+"%(即每層分潤%上限="+(100-v)+"%)");
  };
  var[payoutNote,setPayoutNote]=useState({});
  var[commLedger,setCommLedger]=useState([]);
  // v2.4新增：經銷商PIN查詢/重設(補齊經銷商端與企業端EnterpriseScreen同等機制的缺口)
  var[pinStatus,setPinStatus]=useState({});
  var[showPinPanel,setShowPinPanel]=useState({});
  var[newDistPin,setNewDistPin]=useState({});
  var[distPinResetOk,setDistPinResetOk]=useState({});
  var[staffList,setStaffList]=useState([]); // v2.13新增：經銷商建檔「對應服務人員」下拉選單資料來源
  var LEVELS=L5_COMM_LEVELS;
  useEffect(function(){
    stor.g("l5_distributors").then(function(d){if(d)setDistributors(JSON.parse(d));});
    stor.g("l5_enterprises").then(function(d){if(d)setEnterprises(JSON.parse(d));});
    stor.g("l5_commission_ledger").then(function(d){if(d)setCommLedger(JSON.parse(d));});
    stor.g("l5_staff").then(function(d){if(d)setStaffList(JSON.parse(d));}); // v2.13新增
  },[]);
  var calcComm=calcDistComm;
  var checkPinStatus=function(distId){
    stor.g("l5_pin_partner_"+distId).then(function(v){
      setPinStatus(function(p){return Object.assign({},p,{[distId]:!!v});});
    });
  };
  var doResetDistPin=async function(dist,newPin){
    if(!newPin||newPin.length<4){setToast("新PIN至少4位");return;}
    var h=await hashPin(newPin);
    await stor.s("l5_pin_partner_"+dist.id,h);
    var crRaw=await stor.g("l5_change_requests");
    var crList=crRaw?JSON.parse(crRaw):[];
    crList.push({id:"CR_"+Date.now(),orgCode:dist.orgCode,orgName:dist.name,type:"經銷商PIN重設",
      processedBy:session&&session.name,processedAt:new Date().toISOString()});
    await stor.s("l5_change_requests",JSON.stringify(crList));
    setPinStatus(function(p){return Object.assign({},p,{[dist.id]:true});});
    setNewDistPin(function(p){return Object.assign({},p,{[dist.id]:""});});
    setDistPinResetOk(function(p){return Object.assign({},p,{[dist.id]:true});});
    setToast("「"+dist.name+"」PIN已重設，請立即透過電話/LINE安全管道告知經銷商聯絡人，切勿以Email明文傳送");
  };
  var doClearDistPin=async function(dist){
    await stor.d("l5_pin_partner_"+dist.id);
    var crRaw=await stor.g("l5_change_requests");
    var crList=crRaw?JSON.parse(crRaw):[];
    crList.push({id:"CR_"+Date.now(),orgCode:dist.orgCode,orgName:dist.name,type:"經銷商PIN清除(改回首次登入設定)",
      processedBy:session&&session.name,processedAt:new Date().toISOString()});
    await stor.s("l5_change_requests",JSON.stringify(crList));
    setPinStatus(function(p){return Object.assign({},p,{[dist.id]:false});});
    setDistPinResetOk(function(p){return Object.assign({},p,{[dist.id]:false});});
    setToast("「"+dist.name+"」PIN已清除，下次登入將視為首次登入，需重新自行設定PIN");
  };
  var saveDist=async function(d){
    var all=await stor.g("l5_distributors");
    var list=all?JSON.parse(all):[];
    var idx=list.findIndex(function(x){return x.id===d.id;});
    if(idx>=0)list[idx]=d;else list.unshift(d);
    await stor.s("l5_distributors",JSON.stringify(list));
    setDistributors(list);setSelected(d);setToast("已儲存");
  };
  var thisYM=function(){var n=new Date();return n.getFullYear()+"-"+String(n.getMonth()+1).padStart(2,"0");};
  var doConfirmPayout=async function(dist,amount){
    if(!amount){setToast("請先確認分潤金額");return;}
    var ym=thisYM();
    var already=commLedger.find(function(l){return l.distId===dist.id&&l.month===ym;});
    if(already){setToast("本月("+ym+")已確認過出帳，請至下方查看記錄");return;}
    var entry={
      id:"CL_"+Date.now(),
      distId:dist.id,distName:dist.name,distCode:dist.orgCode,
      month:ym,
      amount:Math.round(amount),
      isOverride:!!dist.commOverride,
      note:payoutNote[dist.id]||"",
      confirmedBy:session.name,
      confirmedAt:new Date().toISOString(),
      status:"已確認待匯款"
    };
    var ledger=[entry].concat(commLedger);
    await stor.s("l5_commission_ledger",JSON.stringify(ledger));
    setCommLedger(ledger);
    setPayoutNote(function(p){var n=Object.assign({},p);delete n[dist.id];return n;});
    setToast("已確認 "+dist.name+" "+ym+" 分潤出帳，待15日匯款");
  };
  var doMarkPaid=async function(entryId){
    var ledger=commLedger.map(function(l){return l.id===entryId?Object.assign({},l,{status:"已匯款",paidAt:new Date().toISOString(),paidBy:session.name}):l;});
    await stor.s("l5_commission_ledger",JSON.stringify(ledger));
    setCommLedger(ledger);
    setToast("已標記為已匯款");
  };
  var doAdd=async function(){
    if(!newD.name.trim()||!newD.alias.trim()){setToast("請填入名稱與縮寫");return;}
    var distYrNow=new Date().getFullYear().toString().slice(2);
    var distSeqPrefix=newD.type==="sub"?"SUB":"PTN";
    var distSeqNow=nextSeqNum(distributors,distSeqPrefix,distYrNow);
    var orgCode=genOrgCode(newD.type==="sub"?"sub":"partner",newD.alias,"",distSeqNow);
    var initPin=genCode(8);
    var d=Object.assign({},newD,{id:"DIST_"+Date.now(),orgCode,initPin,managedOrgs:[],yearlyTotal:0,createdAt:new Date().toISOString(),createdBy:session.name,status:"active"});
    await saveDist(d);
    setShowAdd(false);
    setNewD({name:"",alias:"",contact:"",phone:"",email:"",ubn:"",address:"",level:"silver",type:"primary",parentId:"",region:"",note:"",staffId:""});
    setToast("已建立 "+d.name+" · 代碼："+d.orgCode+" · 初始PIN："+d.initPin);
  };
  var filtered=distributors.filter(function(d){
    if(isPartner)return d.orgCode===session.partnerOrgCode||d.parentId===session.partnerOrgCode;
    return filterLevel==="all"||d.level===filterLevel;
  });
  var myEnts=function(dist){return enterprises.filter(function(e){return e.partnerCode===dist.orgCode;});};
  if(showDetail&&selected&&showCredLetter){
    return ce(CredentialLetter,{type:"distributor",onBack:function(){setShowCredLetter(false);},data:{
      name:selected.name,code:selected.orgCode,ubn:selected.ubn,
      pins:[{label:"經銷商登入初始密碼",value:selected.initPin}]
    }});
  }
  if(showDetail&&selected){
    var dist=selected;
    var ents=myEnts(dist);
    var comm=calcComm(dist,enterprises);
    var lv=LEVELS[dist.level||"silver"];
    var subs=distributors.filter(function(d){return d.parentId===dist.orgCode;});
    var dispComm=dist.commOverride||comm.total;
    return ce("div",{style:{display:"grid",gap:12}},
      ce(Toast,{msg:toast,onDone:function(){setToast("");}}),
      ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
        ce("button",{onClick:function(){setShowDetail(false);setSelected(null);},
          style:{background:"none",border:"none",cursor:"pointer",color:T.teal,fontSize:13,fontWeight:700,fontFamily:"inherit"}},
          "<- 返回列表"),
        canEdit&&ce(Btn,{v:"ghost",sz:"sm",onClick:function(){setShowCredLetter(true);}},"📜 通行密碼函")),
      ce(Card,{style:{borderLeft:"4px solid "+T.navy}},
        ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}},
          ce("div",null,
            ce("div",{style:{fontSize:18,fontWeight:800,color:T.text}},dist.name),
            ce("div",{style:{fontSize:12,color:T.muted}},dist.orgCode+" · "+(dist.contact||""))),
          ce(Tag,{c:"navy"},lv.l)),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}},
          [{l:"管理企業",v:ents.length+"家"},{l:"次級經銷商",v:subs.length+"個"},{l:"電話",v:dist.phone||"-"},{l:"Email",v:dist.email||"-"},{l:"統一編號",v:dist.ubn||"-"},{l:"公司登記地址",v:dist.address||"-"},{l:"對應服務人員",v:(staffList.find(function(s){return s.id===dist.staffId;})||{}).name||"未指定"}].map(function(item){
            return ce("div",{key:item.l,style:{padding:"8px 10px",background:T.bg,borderRadius:8}},
              ce("div",{style:{fontSize:10,color:T.muted}},item.l),
              ce("div",{style:{fontSize:12,fontWeight:600,color:T.text}},item.v));
          }))),
      ce(Card,null,
        ce(SecTitle,null,"本月分潤"),
        ce(IBox,{c:"navy",style:{marginBottom:10}},"A/B/C三層各自依「"+lv.l+"」等級%計算(如下方有個別設定則以設定值為準)。"),
        ce("div",{style:{display:"grid",gap:6,marginBottom:10}},
          [{l:"A層軟體 ("+lv.soft+"%)",v:comm.soft},{l:"B層設備(含LA200) ("+lv.device+"%)",v:comm.device},{l:"C層顧問服務 ("+lv.exec+"%)",v:comm.exec}].map(function(item){
            return ce("div",{key:item.l,style:{display:"flex",justifyContent:"space-between",padding:"6px 10px",background:T.bg,borderRadius:6}},
              ce("span",{style:{fontSize:11,color:T.muted}},item.l),
              ce("span",{style:{fontSize:12,fontWeight:700,color:T.navy}},"NT$"+(item.v/10000).toFixed(1)+"萬"));
          })),
        ce("div",{style:{display:"flex",justifyContent:"space-between",padding:"8px 10px",background:T.navyBg,borderRadius:8,fontWeight:800,marginBottom:10}},
          ce("span",{style:{fontSize:13,color:T.navy}},"合計"),
          ce("span",{style:{fontSize:16,color:T.navy}},"NT$"+(dispComm/10000).toFixed(1)+"萬")),
        dist.commOverride&&ce(IBox,{c:"amber",style:{marginBottom:8}},"⚠ 手動修改：NT$"+(dist.commOverride/10000).toFixed(1)+"萬 — "+dist.commOverrideBy+" ("+dist.commOverrideAt.slice(0,10)+")"),
        canFinance&&ce("div",{style:{marginBottom:12,padding:"10px 12px",background:T.bg,borderRadius:8}},
          ce("div",{style:{fontSize:12,fontWeight:700,color:T.text,marginBottom:8}},"逐層分潤%自填(每層上限"+(100-minRetainPct)+"%，超過會被擋下)"),
          ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}},
            [{k:"soft",l:"A層%",dv:lv.soft},{k:"device",l:"B層%(含LA200)",dv:lv.device},{k:"exec",l:"C層%",dv:lv.exec}].map(function(f){
              return ce("div",{key:f.k},
                ce("label",{style:{fontSize:10,color:T.muted,display:"block",marginBottom:3}},f.l),
                ce("input",{type:"number",placeholder:String(dist[f.k+"Override"]!==undefined&&dist[f.k+"Override"]!==null?dist[f.k+"Override"]:f.dv),
                  value:(pctOverride[dist.id]&&pctOverride[dist.id][f.k]!==undefined)?pctOverride[dist.id][f.k]:"",
                  onChange:function(e){setPctOverride(function(p){var n=Object.assign({},p);n[dist.id]=Object.assign({},n[dist.id],{[f.k]:e.target.value});return n;});},
                  style:{width:"100%",padding:"6px 8px",borderRadius:6,border:"1px solid "+T.border,fontSize:12,boxSizing:"border-box"}}));
            })),
          ce(Btn,{sz:"sm",v:"amber",onClick:function(){
            var ov=pctOverride[dist.id]||{};
            var updates={};
            var failed=[];
            ["soft","device","exec"].forEach(function(k){
              if(ov[k]!==undefined&&ov[k]!==""){
                var v=parseFloat(ov[k]);
                if(isNaN(v)||v<0){failed.push(k+"(需為≥0數字)");return;}
                if(!checkRetainGuard(v,minRetainPct)){failed.push(k+"("+v+"%超過上限"+(100-minRetainPct)+"%)");return;}
                updates[k+"Override"]=v;
              }
            });
            if(failed.length>0){setToast("以下欄位未通過護欄檢查，未儲存："+failed.join("、"));return;}
            if(Object.keys(updates).length===0){setToast("請至少填一層");return;}
            saveDist(Object.assign({},dist,updates,{pctOverrideBy:session.name,pctOverrideAt:new Date().toISOString()}));
            setPctOverride(function(p){var n=Object.assign({},p);delete n[dist.id];return n;});
            setToast("已更新「"+dist.name+"」逐層分潤%");
          }},"套用分層%自填"),
          (dist.softOverride!==undefined||dist.deviceOverride!==undefined||dist.execOverride!==undefined)&&
            ce("div",{style:{fontSize:10,color:T.muted,marginTop:6}},"目前已自填："+
              [dist.softOverride!==undefined?"A層"+dist.softOverride+"%":null,
               dist.deviceOverride!==undefined?"B層"+dist.deviceOverride+"%":null,
               dist.execOverride!==undefined?"C層"+dist.execOverride+"%":null].filter(Boolean).join("、")+
              "("+(dist.pctOverrideBy||"")+" · "+(dist.pctOverrideAt?dist.pctOverrideAt.slice(0,10):"")+")")),
        canFinance&&ce("div",{style:{display:"flex",gap:8}},
          ce("input",{type:"number",placeholder:"手動調整金額",value:commOverride[dist.id]||"",
            onChange:function(e){setCommOverride(function(p){var n=Object.assign({},p);n[dist.id]=e.target.value;return n;});},
            style:{flex:1,padding:"7px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:12}}),
          ce(Btn,{sz:"sm",v:"amber",onClick:function(){
            var ov=commOverride[dist.id];
            if(!ov){setToast("請填入金額");return;}
            saveDist(Object.assign({},dist,{commOverride:parseInt(ov),commOverrideBy:session.name,commOverrideAt:new Date().toISOString()}));
          }},"套用 ⚠")),
        canFinance&&ce("div",{style:{marginTop:12,padding:"10px 12px",background:T.tealBg,borderRadius:8,border:"1px solid "+T.tealLight}},
          ce("div",{style:{fontSize:12,fontWeight:700,color:T.teal,marginBottom:8}},"📋 本月("+thisYM()+")分潤出帳確認"),
          commLedger.find(function(l){return l.distId===dist.id&&l.month===thisYM();})?
            (function(){var e=commLedger.find(function(l){return l.distId===dist.id&&l.month===thisYM();});
              return ce("div",null,
                ce("div",{style:{fontSize:12,color:T.text,marginBottom:4}},"✅ 已確認出帳：NT$"+e.amount.toLocaleString()+"("+e.confirmedBy+" · "+e.confirmedAt.slice(0,10)+")"),
                ce("div",{style:{fontSize:11,color:T.muted,marginBottom:8}},"狀態："+e.status),
                e.status==="已確認待匯款"&&ce(Btn,{sz:"sm",v:"sage",onClick:function(){doMarkPaid(e.id);}},"✅ 標記已匯款(15日)"));})():
            ce("div",null,
              ce("input",{value:payoutNote[dist.id]||"",onChange:function(ev){setPayoutNote(function(p){var n=Object.assign({},p);n[dist.id]=ev.target.value;return n;});},
                placeholder:"出帳備註(選填)",style:{width:"100%",padding:"7px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:12,marginBottom:8,boxSizing:"border-box"}}),
              ce(Btn,{sz:"sm",v:"teal",onClick:function(){doConfirmPayout(dist,dispComm);}},"✅ 確認本月分潤出帳(NT$"+(dispComm/10000).toFixed(1)+"萬)"))),
        ce("div",{style:{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}},
          ce(Btn,{sz:"sm",v:"navy",onClick:function(){setToast("LINE通知複製："+dist.name+" 本月佣金 NT$"+(dispComm/10000).toFixed(1)+"萬，預計15日匯款。");}},"💬 LINE通知"),
          canEdit&&ce(Btn,{sz:"sm",v:"sage",onClick:function(){
            var nextL=dist.level==="silver"?"gold":dist.level==="gold"?"platinum":"platinum";
            saveDist(Object.assign({},dist,{level:nextL}));
          }},"⬆ 升級等級"),
          canFinance&&ce(Btn,{sz:"sm",v:showPinPanel[dist.id]?"amber":"ghost",onClick:function(){
            var willShow=!showPinPanel[dist.id];
            setShowPinPanel(function(p){return Object.assign({},p,{[dist.id]:willShow});});
            setDistPinResetOk(function(p){return Object.assign({},p,{[dist.id]:false});});
            if(willShow)checkPinStatus(dist.id);
          }},showPinPanel[dist.id]?"▲ 收合PIN管理":"🔐 PIN管理"))),
      canFinance&&showPinPanel[dist.id]&&ce(Card,{style:{border:"1px solid "+T.red,background:T.redBg}},
        ce(SecTitle,null,"🔐 經銷商登入PIN管理"),
        ce(IBox,{c:"red",style:{fontSize:11,marginBottom:10}},"⚠ 經銷商PIN以雜湊儲存於「l5_pin_partner_"+dist.id+"」，無法反查明文。可直接設定新PIN並口頭/LINE告知經銷商，或清除PIN讓經銷商下次登入時自行重新設定(視同首次登入)。"),
        ce("div",{style:{padding:"8px 10px",background:T.card,borderRadius:8,marginBottom:10}},
          ce("div",{style:{fontSize:10,color:T.muted}},"目前PIN設定狀態"),
          ce("div",{style:{fontSize:13,fontWeight:700,color:pinStatus[dist.id]?T.sage:T.amber}},
            pinStatus[dist.id]===undefined?"查詢中…":pinStatus[dist.id]?"✅ 已設定(經銷商已完成首次登入)":"⚠ 尚未設定(經銷商尚未首次登入，或已被清除)")),
        distPinResetOk[dist.id]&&ce(IBox,{c:"sage",style:{fontSize:11,marginBottom:8}},"✅ PIN已重設完成！請立即透過電話/LINE安全管道告知經銷商聯絡人「"+(dist.contact||dist.name)+"」，切勿以Email明文傳送。"),
        ce("div",{style:{display:"flex",gap:8,alignItems:"flex-end",marginBottom:10}},
          ce("div",{style:{flex:1}},
            ce("label",{style:{fontSize:11,color:T.muted,display:"block",marginBottom:4,fontWeight:600}},"直接設定新PIN(至少4位)"),
            ce("input",{type:"password",value:newDistPin[dist.id]||"",
              onChange:function(e){setNewDistPin(function(p){return Object.assign({},p,{[dist.id]:e.target.value});});},
              placeholder:"輸入新PIN…",
              style:{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+T.red,fontSize:13,boxSizing:"border-box",fontFamily:"inherit"}})),
          ce(Btn,{v:"danger",onClick:function(){doResetDistPin(dist,newDistPin[dist.id]||"");}},"🔄 重設PIN")),
        ce(Btn,{sz:"sm",v:"ghost",onClick:function(){
          if(window.confirm("確定要清除「"+dist.name+"」的PIN嗎？清除後下次登入會視為首次登入，需經銷商自行重新設定PIN。")){doClearDistPin(dist);}
        }},"🗑 清除PIN(改回首次登入)")),
      commLedger.filter(function(l){return l.distId===dist.id;}).length>0&&ce(Card,null,
        ce(SecTitle,null,"分潤出帳歷史"),
        ce("div",{style:{display:"grid",gap:6}},
          commLedger.filter(function(l){return l.distId===dist.id;}).map(function(l){
            return ce("div",{key:l.id,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:T.bg,borderRadius:8}},
              ce("div",null,
                ce("div",{style:{fontSize:12,fontWeight:700,color:T.text}},l.month+" · NT$"+l.amount.toLocaleString()),
                ce("div",{style:{fontSize:10,color:T.muted}},"確認："+l.confirmedBy+" "+l.confirmedAt.slice(0,10)+(l.paidAt?" · 匯款："+l.paidAt.slice(0,10):""))),
              ce("span",{style:{padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,
                background:l.status==="已匯款"?T.sageBg:T.amberBg,color:l.status==="已匯款"?T.sage:T.amber}},l.status));
          }))),
      ents.length>0&&ce(Card,null,
        ce(SecTitle,null,"管理企業 ("+ents.length+")"),
        ce("div",{style:{display:"grid",gap:6}},
          ents.map(function(e){
            return ce("div",{key:e.id,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:T.bg,borderRadius:8}},
              ce("div",null,
                ce("div",{style:{fontSize:12,fontWeight:600,color:T.text}},e.orgName),
                ce("div",{style:{fontSize:10,color:T.muted}},e.orgCode+" · "+e.plan+"方案")),
              ce("div",{style:{fontSize:11,color:T.amber,fontWeight:700}},"NT$"+((e.aLayerFee||0)/10000).toFixed(1)+"萬"));
          }))),
      subs.length>0&&ce(Card,null,
        ce(SecTitle,null,"次級經銷商 ("+subs.length+")"),
        ce(IBox,{c:"amber",style:{marginBottom:8}},"麗媚只與主結算，主自行分配給次級，主負連帶責任。三方合約(麗媚+主+次級)由麗媚提供標準範本，三方用印後生效，麗媚 L5 登記核准。"),
        ce("div",{style:{display:"grid",gap:6}},
          subs.map(function(s){
            return ce("div",{key:s.id,style:{padding:"10px 12px",background:T.bg,borderRadius:8,border:"1px solid "+T.border}},
              ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
                ce("div",null,
                  ce("div",{style:{fontSize:12,fontWeight:600,color:T.text}},s.name),
                  ce("div",{style:{fontSize:10,color:T.muted}},s.orgCode+(s.subContractStart?" · 生效："+s.subContractStart:""))),
                ce("div",{style:{display:"flex",gap:6,alignItems:"center"}},
                  ce(Tag,{c:"navy"},LEVELS[s.level||"silver"].l),
                  canEdit&&ce(Btn,{sz:"sm",v:"plum",onClick:function(){setSubContractTarget(s);setShowSubContract(true);}},
                    "📄 三方合約"))),
              (s.subCommA||s.subCommB||s.subCommC)&&ce("div",{style:{fontSize:10,color:T.plum,marginTop:4,display:"flex",gap:12}},
                s.subCommA&&ce("span",null,"A層→次:"+s.subCommA+"%"),
                s.subCommB&&ce("span",null,"B層→次:"+s.subCommB+"%"),
                s.subCommC&&ce("span",null,"C層→次:"+s.subCommC+"%")));
          }))));
  }
  return ce("div",{style:{display:"grid",gap:12}},
    ce(Toast,{msg:toast,onDone:function(){setToast("");}}),
    showSubContract&&subContractTarget&&(function(){
      var parentDist=distributors.find(function(d){return d.orgCode===subContractTarget.parentId;});
      var sub=subContractTarget;
      return ce("div",{style:{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,.5)",zIndex:999,
        display:"flex",alignItems:"flex-start",justifyContent:"center",overflowY:"auto",padding:"20px"}},
        ce("div",{style:{background:T.card,borderRadius:12,padding:20,maxWidth:680,width:"100%",marginTop:20}},
          ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}},
            ce(SecTitle,{style:{marginBottom:0}},"📄 三方合約草稿 — "+sub.name),
            ce("div",{style:{display:"flex",gap:6}},
              ce(Btn,{sz:"sm",v:"amber",onClick:function(){
                var lines=["麗媚生化科技有限公司 × "+(parentDist?parentDist.name:"主")+" × "+sub.name+" 三方經銷商合作合約(草稿)","","甲方(麗媚)：麗媚生化科技有限公司","乙方(主經銷商)："+(parentDist?parentDist.name:"待填"),"丙方(次級)："+sub.name,"生效日："+(sub.subContractStart||"待填"),"","第三條 分潤再分配：A層→丙"+(sub.subCommA||"___")+"% ／ B層→丙"+(sub.subCommB||"___")+"% ／ C層→丙"+(sub.subCommC||"___")+"%(乙方月結後7工作日內支付)","","(完整條款詳見系統三方合約草稿頁面，複製後交法務審閱)"];
                var txt=lines.join("\n");
                if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt);
                setToast("三方合約摘要已複製");
              }},"📋 複製摘要"),
              ce(Btn,{sz:"sm",v:"ghost",onClick:function(){setShowSubContract(false);setSubContractTarget(null);}},"✕"))),
          ce(IBox,{c:"plum",style:{marginBottom:12,fontSize:11}},"以下為系統自動生成之三方合約草稿。請複製後交由麗媚法務審閱，三方加蓋公司大小章後生效，並在L5登記核准後始為有效。"),
          ce("div",{style:{fontSize:11,color:T.text,lineHeight:1.9,background:T.bg,padding:16,borderRadius:8,maxHeight:440,overflowY:"auto"}},
            ce("p",{style:{fontWeight:800,textAlign:"center",fontSize:13,marginBottom:12}},"麗媚生化科技有限公司\nREIBI BIO-Technology Co., Ltd.\n三方經銷商合作合約"),
            ce("p",null,"合約編號：CT-3P-"+new Date().toISOString().slice(0,10).replace(/-/g,"")+"-"+sub.orgCode),
            ce("p",null,"甲方(麗媚)：麗媚生化科技有限公司"),
            ce("p",null,"乙方(主經銷商)："+(parentDist?parentDist.name:"待填")),
            ce("p",null,"丙方(次級)："+sub.name),
            ce("p",null,"三方合約生效日："+(sub.subContractStart||"待填")),
            [{n:"第一條 合約目的",t:"甲方核准乙方發展丙方作為次級合作夥伴，協助推廣REIBI企業健康自主管理平台服務(A/B/C/D層)。"},
             {n:"第二條 授權範圍與限制",t:"丙方在乙方指導下推廣REIBI服務，不得直接繞過乙方與甲方進行財務結算或服務調整。"},
             {n:"第三條 財務結算與分潤再分配",t:"甲方之所有財務結算對象為乙方，不對丙方直接結算。乙方應依下列比例分配予丙方：A層 "+(sub.subCommA||"___")+"% ／ B層 "+(sub.subCommB||"___")+"% ／ C層 "+(sub.subCommC||"___")+"%。乙方應於甲方月結匯款後7個工作日內完成分配。"},
             {n:"第四條 連帶責任",t:"乙方對丙方之業務行為、客戶服務及財務責任負連帶責任。"},
             {n:"第五條 客戶資料與平台管理",t:"所有客戶orgCode及平台帳號由甲方統一管理，丙方不得自行建立或修改。"},
             {n:"第六條 保密義務",t:"三方對合約內容、定價、分潤比例及客戶資料負有永久保密義務。"},
             {n:"第七條 甲方核准機制",t:"本合約需甲方書面核准並完成L5登記後方為有效，甲方有權拒絕核准或撤銷次級資格。"},
             {n:"第八條 合約期間",t:"本合約期間為壹年，自三方用印日起算，期滿前30天申請續約確認。"},
             {n:"第九條 違約與終止",t:"任一方嚴重違反本合約，其他方得書面通知終止，丙方應立即停止以REIBI合作夥伴名義進行業務活動。"},
             {n:"第十條 爭議解決",t:"本合約依中華民國法律，以台灣台北地方法院為第一審管轄法院。"}
            ].map(function(art){
              return ce("div",{key:art.n,style:{marginBottom:8}},
                ce("div",{style:{fontWeight:700,color:T.navy,marginBottom:2}},art.n),
                ce("div",{style:{paddingLeft:10,color:T.text}},art.t));
            }),
            ce("div",{style:{marginTop:16,borderTop:"1px solid "+T.border,paddingTop:12,display:"grid",gap:6}},
              ce("p",null,"甲方簽章：_______________(麗媚生化科技有限公司)"),
              ce("p",null,"乙方簽章：_______________("+(parentDist?parentDist.name:"主經銷商")+")"),
              ce("p",null,"丙方簽章：_______________("+sub.name+")")))));
    })(),
    ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}},
      [{l:"主經銷商",v:distributors.filter(function(d){return d.type==="primary";}).length,c:T.navy},
       {l:"次級",v:distributors.filter(function(d){return d.type==="sub";}).length,c:T.teal},
       {l:"合作企業",v:enterprises.filter(function(e){return e.partnerCode;}).length,c:T.amber}].map(function(k){
        return ce(Card,{key:k.l,style:{padding:"12px 14px",textAlign:"center"}},
          ce("div",{style:{fontSize:22,fontWeight:800,color:k.c}},k.v),
          ce("div",{style:{fontSize:11,color:T.muted,marginTop:4}},k.l));
      })),
    canEdit&&ce(Card,{style:{border:"1px solid "+T.plum,background:T.plumBg}},
      ce(SecTitle,null,"🛡 REIBI保留下限護欄設定"),
      ce(IBox,{c:"navy",style:{fontSize:11,marginBottom:10}},"目前REIBI每層(A/B/C各自)保留下限："+minRetainPct+"%，即分潤%上限="+(100-minRetainPct)+"%。個別經銷商的分潤%自填不得超過此上限，超過會被擋下。此設定可隨服務量能/成本結構變化調整，僅超級管理員可修改。"),
      ce("div",{style:{display:"flex",gap:8,alignItems:"flex-end"}},
        ce(Inp,{label:"新的REIBI保留下限%",type:"number",value:newRetainPct,onChange:function(e){setNewRetainPct(e.target.value);},placeholder:String(minRetainPct)}),
        ce(Btn,{sz:"sm",v:"plum",onClick:saveRetainPct},"更新"))),
    ce(Card,null,
      ce(SecTitle,null,"分潤等級制度"),
      ce("div",{style:{overflowX:"auto"}},
        ce("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:11}},
          ce("thead",null,ce("tr",{style:{background:T.bg}},
            ["等級","門檻","A層","B層設備(含LA200)","C層"].map(function(h){return ce("th",{key:h,style:{padding:"6px 8px",textAlign:"left",color:T.muted,fontWeight:700}},h);}))),
          ce("tbody",null,Object.entries(LEVELS).map(function(entry){
            var k=entry[0];var lv=entry[1];
            return ce("tr",{key:k,style:{borderTop:"1px solid "+T.border}},
              ce("td",{style:{padding:"6px 8px",fontWeight:700,color:T.navy}},lv.l),
              ce("td",{style:{padding:"6px 8px",color:T.muted}},lv.threshold),
              ce("td",{style:{padding:"6px 8px",color:T.teal,fontWeight:700}},lv.soft>0?lv.soft+"%":"另議"),
              ce("td",{style:{padding:"6px 8px",color:T.teal}},lv.device>0?lv.device+"%":"另議"),
              ce("td",{style:{padding:"6px 8px",color:T.teal}},lv.exec>0?lv.exec+"%":"另議"));
          }))))),
    canEdit&&ce("div",{style:{display:"flex",justifyContent:"flex-end"}},
      ce(Btn,{onClick:function(){setShowAdd(!showAdd);}},showAdd?"取消":"+ 新增經銷商")),
    showAdd&&ce(Card,null,
      ce(SecTitle,null,"新增經銷商"),
      ce("div",{style:{display:"grid",gap:10}},
        ce("div",{style:{display:"flex",gap:0,background:T.bg,borderRadius:8,padding:3}},
          [{v:"primary",l:"主經銷商"},{v:"sub",l:"次級"}].map(function(t){
            return ce("button",{key:t.v,onClick:function(){setNewD(function(p){return Object.assign({},p,{type:t.v});});},
              style:{flex:1,padding:"7px 0",border:"none",borderRadius:6,cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:"inherit",
                background:newD.type===t.v?T.card:"transparent",color:newD.type===t.v?T.teal:T.muted}},t.l);
          })),
        ce(Inp,{label:"名稱 *",value:newD.name,onChange:function(e){setNewD(function(p){return Object.assign({},p,{name:e.target.value});});}}),
        ce(Inp,{label:"縮寫 (2-4碼) *",value:newD.alias,onChange:function(e){setNewD(function(p){return Object.assign({},p,{alias:e.target.value.toUpperCase().slice(0,4)});});}}),
        newD.alias&&ce(IBox,{c:"teal",style:{fontSize:11}},"預覽："+genOrgCode(newD.type==="sub"?"sub":"partner",newD.alias,"",nextSeqNum(distributors,newD.type==="sub"?"SUB":"PTN",new Date().getFullYear().toString().slice(2)))),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}},
          ce(Inp,{label:"聯絡人",value:newD.contact,onChange:function(e){setNewD(function(p){return Object.assign({},p,{contact:e.target.value});});}}),
          ce(Inp,{label:"電話",value:newD.phone,onChange:function(e){setNewD(function(p){return Object.assign({},p,{phone:e.target.value});});}})),
        ce(Inp,{label:"統一編號(選填，可日後補登)",value:newD.ubn,onChange:function(e){setNewD(function(p){return Object.assign({},p,{ubn:e.target.value.replace(/[^0-9]/g,"").slice(0,8)});});},placeholder:"8碼數字"}),
        ce(Inp,{label:"公司登記地址(選填)",value:newD.address,onChange:function(e){setNewD(function(p){return Object.assign({},p,{address:e.target.value});});},placeholder:"例：台北市信義區OO路OO號"}),
        ce(Select,{label:"初始等級",value:newD.level,onChange:function(e){setNewD(function(p){return Object.assign({},p,{level:e.target.value});})}},
          Object.entries(LEVELS).map(function(entry){return ce("option",{key:entry[0],value:entry[0]},entry[1].l);})),
        ce(Select,{label:"負責區域",value:newD.region,onChange:function(e){setNewD(function(p){return Object.assign({},p,{region:e.target.value});})}},
          ce("option",{value:""},"請選擇區域"),
          [{v:"north",l:"北部"},{v:"central",l:"中部"},{v:"south",l:"南部"},{v:"east",l:"東部"},{v:"overseas",l:"海外"}].map(function(r){return ce("option",{key:r.v,value:r.v},r.l);})),
        ce(Select,{label:"對應服務人員(選填，連結REIBI內部業務人員)",value:newD.staffId,onChange:function(e){setNewD(function(p){return Object.assign({},p,{staffId:e.target.value});})}},
          ce("option",{value:""},"未指定"),
          staffList.map(function(s){return ce("option",{key:s.id,value:s.id},s.name);})),
        newD.type==="sub"&&ce(Select,{label:"隸屬主經銷商",value:newD.parentId,onChange:function(e){setNewD(function(p){return Object.assign({},p,{parentId:e.target.value});})}},
          ce("option",{value:""},"請選擇"),
          distributors.filter(function(d){return d.type==="primary";}).map(function(d){return ce("option",{key:d.id,value:d.orgCode},d.name);})),
        newD.type==="sub"&&ce("div",null,
          ce(IBox,{c:"plum",style:{fontSize:11,marginBottom:8}},"主→次分潤再分配比例(麗媚只與主結算，主自行分配給次；此比例將載入三方合約)"),
          ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}},
            ce(Inp,{label:"A層給次%",type:"number",value:String(newD.subCommA||0),onChange:function(e){setNewD(function(p){return Object.assign({},p,{subCommA:parseInt(e.target.value)||0});});},placeholder:"例：5"}),
            ce(Inp,{label:"B層給次%",type:"number",value:String(newD.subCommB||0),onChange:function(e){setNewD(function(p){return Object.assign({},p,{subCommB:parseInt(e.target.value)||0});});},placeholder:"例：6"}),
            ce(Inp,{label:"C層給次%",type:"number",value:String(newD.subCommC||0),onChange:function(e){setNewD(function(p){return Object.assign({},p,{subCommC:parseInt(e.target.value)||0});});},placeholder:"例：3"}))),
        newD.type==="sub"&&ce(Inp,{label:"三方合約生效日",type:"date",value:newD.subContractStart||"",onChange:function(e){setNewD(function(p){return Object.assign({},p,{subContractStart:e.target.value});});}}),
        ce(Btn,{onClick:doAdd,full:true},"建立經銷商"))),
    ce("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
      ["all","silver","gold","platinum","strategic"].map(function(l){
        return ce("button",{key:l,onClick:function(){setFilterLevel(l);},
          style:{padding:"4px 10px",borderRadius:20,border:"1px solid "+(filterLevel===l?T.navy:T.border),
            fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
            background:filterLevel===l?T.navy:"transparent",color:filterLevel===l?"#fff":T.muted}},
          l==="all"?"全部等級":LEVELS[l]?LEVELS[l].l:l);
      })),
    filtered.length===0?ce(Card,{style:{textAlign:"center",padding:32,color:T.muted}},distributors.length===0?"尚無經銷商":"無符合條件"):
    ce("div",{style:{display:"grid",gap:8}},
      filtered.map(function(dist){
        var ents=myEnts(dist);
        var comm=calcComm(dist,enterprises);
        var lv=LEVELS[dist.level||"silver"];
        return ce(Card,{key:dist.id,onClick:function(){setSelected(dist);setShowDetail(true);},style:{padding:"12px 14px",cursor:"pointer",borderLeft:"3px solid "+T.navy}},
          ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}},
            ce("div",null,
              ce("div",{style:{fontWeight:700,fontSize:13,color:T.text}},dist.name),
              ce("div",{style:{fontSize:11,color:T.muted,marginTop:2}},dist.orgCode+" · "+(dist.contact||"")),
              ce("div",{style:{display:"flex",gap:6,marginTop:6}},
                ce(Tag,{c:"navy"},lv.l),ce(Tag,{c:"gray"},ents.length+"家企業"),
                dist.commOverride&&ce(Tag,{c:"amber"},"手動修改"))),
            ce("div",{style:{textAlign:"right"}},
              ce("div",{style:{fontSize:11,color:T.muted}},"本月分潤"),
              ce("div",{style:{fontSize:15,fontWeight:800,color:T.amber}},"NT$"+((dist.commOverride||comm.total)/10000).toFixed(1)+"萬"))));
      })));
}

// ── PARTNERS SCREEN — 合作夥伴清單(v2.5新增，Q4實作) ─────────────────────────────
// 適用範圍：僅REIBI自營單(企業紀錄無partnerCode時)可指定合作夥伴推薦，經銷商單不適用這套
// (經銷商單走calcDistComm既有分潤，兩套機制刻意不疊加，避免混淆)。
// 分潤基礎：報價單A+B+C層總額(v2.12更正，D層環境佈置費用不列入分潤基礎)，非僅A層。
function PartnersScreen(props){
  var session=props.session;
  var role=session&&session.role;
  var[partners,setPartners]=useState([]);
  var[enterprises,setEnterprises]=useState([]);
  var[showAdd,setShowAdd]=useState(false);
  var[editingId,setEditingId]=useState(null);
  var[newP,setNewP]=useState({name:"",contact:"",phone:"",defaultPct:8,note:""});
  var[toast,setToast]=useState("");

  useEffect(function(){
    stor.g("l5_partners").then(function(d){if(d)setPartners(JSON.parse(d));});
    stor.g("l5_enterprises").then(function(d){if(d)setEnterprises(JSON.parse(d));});
  },[]);

  var savePartners=async function(list){await stor.s("l5_partners",JSON.stringify(list));setPartners(list);};

  var doAdd=async function(){
    if(!newP.name.trim()){setToast("請填入夥伴名稱");return;}
    var pct=parseFloat(newP.defaultPct);
    if(!pct||pct<=0||pct>100){setToast("預設分潤%請填0-100之間的數字");return;}
    if(editingId){
      var updated=partners.map(function(p){return p.id===editingId?Object.assign({},p,newP,{defaultPct:pct}):p;});
      await savePartners(updated);
      setToast("已更新「"+newP.name+"」");
    }else{
      var p=Object.assign({},newP,{id:"PTR_"+Date.now(),defaultPct:pct,createdAt:new Date().toISOString(),createdBy:session.name});
      await savePartners([p].concat(partners));
      setToast("已新增合作夥伴「"+p.name+"」");
    }
    setShowAdd(false);setEditingId(null);
    setNewP({name:"",contact:"",phone:"",defaultPct:8,note:""});
  };

  var doDelete=async function(p){
    if(!window.confirm("確定要刪除合作夥伴「"+p.name+"」嗎？(不影響已存在的企業紀錄上的歷史分潤設定)"))return;
    await savePartners(partners.filter(function(x){return x.id!==p.id;}));
    setToast("已刪除「"+p.name+"」");
  };

  var statsFor=function(p){
    var referred=enterprises.filter(function(e){return e.referralPartnerId===p.id;});
    var totalAmt=referred.reduce(function(a,e){
      var base=(e.aLayerFee||0)+(e.bLayerFee||0)+(e.cLayerFee||0); // v2.12修正：D層為費用不分潤(依業主更正)
      return a+Math.round(base*((e.referralPct!==undefined?e.referralPct:p.defaultPct)/100));
    },0);
    return{count:referred.length,totalAmt:totalAmt};
  };

  return ce("div",{style:{display:"grid",gap:14}},
    ce(Toast,{msg:toast,onDone:function(){setToast("");}}),
    ce(IBox,{c:"navy"},"合作夥伴(異業轉介/推薦人/ESG夥伴)僅適用「REIBI自營單」——企業建檔時若沒有填「接案經銷商代碼」，才能指定合作夥伴分潤；已有經銷商代碼的企業不適用這套(避免跟經銷商分潤重疊)。分潤基礎為報價單A+B+C層總額，D層(環境佈置)為費用，不列入分潤基礎。"),
    ce(Card,null,
      ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}},
        ce(SecTitle,null,"合作夥伴清單"),
        ce(Btn,{sz:"sm",onClick:function(){setShowAdd(true);setEditingId(null);setNewP({name:"",contact:"",phone:"",defaultPct:8,note:""});}},"+ 新增合作夥伴")),
      showAdd&&ce(Card,{style:{border:"1px solid "+T.teal,marginBottom:12}},
        ce(SecTitle,null,editingId?"編輯合作夥伴":"新增合作夥伴"),
        ce("div",{style:{display:"grid",gap:10}},
          ce(Inp,{label:"名稱 *",value:newP.name,onChange:function(e){setNewP(Object.assign({},newP,{name:e.target.value}));},placeholder:"個人姓名或公司/機構名稱"}),
          ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}},
            ce(Inp,{label:"聯絡人",value:newP.contact,onChange:function(e){setNewP(Object.assign({},newP,{contact:e.target.value}));}}),
            ce(Inp,{label:"電話",value:newP.phone,onChange:function(e){setNewP(Object.assign({},newP,{phone:e.target.value}));}})),
          ce(Inp,{label:"預設分潤%(建議5-10%，可於個別企業建檔時調整)",type:"number",value:newP.defaultPct,onChange:function(e){setNewP(Object.assign({},newP,{defaultPct:e.target.value}));},placeholder:"8"}),
          ce(Inp,{label:"備註",value:newP.note,onChange:function(e){setNewP(Object.assign({},newP,{note:e.target.value}));},placeholder:"例：ESG夥伴/異業轉介來源說明"}),
          ce("div",{style:{display:"flex",gap:8}},
            ce(Btn,{onClick:doAdd},editingId?"儲存":"新增"),
            ce(Btn,{v:"ghost",onClick:function(){setShowAdd(false);setEditingId(null);}},"取消")))),
      partners.length===0?ce("div",{style:{textAlign:"center",padding:32,color:T.muted}},"尚無合作夥伴，點上方「+新增合作夥伴」建立第一筆。"):
      ce("div",{style:{display:"grid",gap:8}},
        partners.map(function(p){
          var st=statsFor(p);
          return ce(Card,{key:p.id,style:{padding:"12px 14px"}},
            ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}},
              ce("div",null,
                ce("div",{style:{fontWeight:700,fontSize:14,color:T.text}},p.name),
                ce("div",{style:{fontSize:11,color:T.muted}},(p.contact||"-")+" · "+(p.phone||"-")+" · 預設"+p.defaultPct+"%"),
                p.note&&ce("div",{style:{fontSize:11,color:T.faint,marginTop:2}},p.note)),
              ce("div",{style:{textAlign:"right"}},
                ce("div",{style:{fontSize:11,color:T.muted}},"累計介紹"),
                ce("div",{style:{fontSize:16,fontWeight:800,color:T.teal}},st.count+"筆"),
                ce("div",{style:{fontSize:12,fontWeight:700,color:T.amber,marginTop:2}},"NT$"+st.totalAmt.toLocaleString()))),
            ce("div",{style:{display:"flex",gap:8,marginTop:10}},
              ce(Btn,{sz:"sm",v:"ghost",onClick:function(){setNewP({name:p.name,contact:p.contact,phone:p.phone,defaultPct:p.defaultPct,note:p.note});setEditingId(p.id);setShowAdd(true);}},"✏ 編輯"),
              ce(Btn,{sz:"sm",v:"danger",onClick:function(){doDelete(p);}},"🗑 刪除")));
        }))));
}

// ── STAFF SCREEN — REIBI業務人員清單(v2.5新增，Q3-2實作) ─────────────────────────
// 用於記錄「哪個REIBI內部人員承辦/接洽了這筆案件」，跟經銷商/合作夥伴分潤完全獨立——
// 業務人員是REIBI員工，獎金屬於內部薪資/HR範疇，此處僅做「歸戶」統計(接單陳歷)，
// 不在calcDistComm裡計算任何百分比分潤。可與經銷商代碼/合作夥伴推薦同時存在於同一筆企業紀錄
// (例如：某經銷商簽的單，仍由某REIBI業務窗口協助跟催，兩者不互斥)。
function StaffScreen(props){
  var session=props.session;
  var role=session&&session.role;
  var[staffList,setStaffList]=useState([]);
  var[enterprises,setEnterprises]=useState([]);
  var[showAdd,setShowAdd]=useState(false);
  var[editingId,setEditingId]=useState(null);
  var[newS,setNewS]=useState({name:"",empCode:"",title:"業務",titleCustom:"",phone:"",email:"",note:""});
  var[toast,setToast]=useState("");

  useEffect(function(){
    stor.g("l5_staff").then(function(d){if(d)setStaffList(JSON.parse(d));});
    stor.g("l5_enterprises").then(function(d){if(d)setEnterprises(JSON.parse(d));});
  },[]);

  var saveStaff=async function(list){await stor.s("l5_staff",JSON.stringify(list));setStaffList(list);};

  var doAdd=async function(){
    if(!newS.name.trim()){setToast("請填入姓名");return;}
    var finalS=Object.assign({},newS,{title:(newS.title==="其他"&&newS.titleCustom&&newS.titleCustom.trim())?newS.titleCustom.trim():newS.title});
    delete finalS.titleCustom;
    if(editingId){
      var updated=staffList.map(function(s){return s.id===editingId?Object.assign({},s,finalS):s;});
      await saveStaff(updated);
      setToast("已更新「"+finalS.name+"」");
    }else{
      var s=Object.assign({},finalS,{id:"STF_"+Date.now(),createdAt:new Date().toISOString(),createdBy:session.name});
      await saveStaff([s].concat(staffList));
      setToast("已新增業務人員「"+s.name+"」");
    }
    setShowAdd(false);setEditingId(null);
    setNewS({name:"",empCode:"",title:"業務",titleCustom:"",phone:"",email:"",note:""});
  };

  var doDelete=async function(s){
    if(!window.confirm("確定要刪除「"+s.name+"」嗎？(不影響已存在的企業紀錄上的歷史承辦人設定)"))return;
    await saveStaff(staffList.filter(function(x){return x.id!==s.id;}));
    setToast("已刪除「"+s.name+"」");
  };

  var countFor=function(s){
    return enterprises.filter(function(e){return e.staffId===s.id;}).length;
  };

  return ce("div",{style:{display:"grid",gap:14}},
    ce(Toast,{msg:toast,onDone:function(){setToast("");}}),
    ce(IBox,{c:"navy"},"REIBI業務人員清單，用於記錄接單承辦歸戶(接單陳歷統計)。獎金計算屬內部薪資/HR範疇，不在此系統計算，僅供歸戶統計。可跟經銷商代碼/合作夥伴推薦同時存在於同一筆企業紀錄。"),
    ce(Card,null,
      ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}},
        ce(SecTitle,null,"業務人員清單"),
        ce(Btn,{sz:"sm",onClick:function(){setShowAdd(true);setEditingId(null);setNewS({name:"",empCode:"",title:"業務",titleCustom:"",phone:"",email:"",note:""});}},"+ 新增業務人員")),
      showAdd&&ce(Card,{style:{border:"1px solid "+T.teal,marginBottom:12}},
        ce(SecTitle,null,editingId?"編輯業務人員":"新增業務人員"),
        ce("div",{style:{display:"grid",gap:10}},
          ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}},
            ce(Inp,{label:"姓名 *",value:newS.name,onChange:function(e){setNewS(Object.assign({},newS,{name:e.target.value}));}}),
            ce(Inp,{label:"員工編號",value:newS.empCode,onChange:function(e){setNewS(Object.assign({},newS,{empCode:e.target.value}));}})),
          ce(Select,{label:"職稱",value:newS.title,onChange:function(e){setNewS(Object.assign({},newS,{title:e.target.value}));}},
            ce("option",{value:"總經理"},"總經理"),ce("option",{value:"副總"},"副總"),ce("option",{value:"經理"},"經理"),ce("option",{value:"副理"},"副理"),ce("option",{value:"業務"},"業務"),ce("option",{value:"客服"},"客服"),ce("option",{value:"報價人員"},"報價人員"),ce("option",{value:"其他"},"其他(自行輸入)")),
          newS.title==="其他"&&ce(Inp,{label:"請輸入職稱",value:newS.titleCustom||"",onChange:function(e){setNewS(Object.assign({},newS,{titleCustom:e.target.value}));}}),
          ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}},
            ce(Inp,{label:"電話",value:newS.phone,onChange:function(e){setNewS(Object.assign({},newS,{phone:e.target.value}));}}),
            ce(Inp,{label:"Email",value:newS.email,onChange:function(e){setNewS(Object.assign({},newS,{email:e.target.value}));}})),
          ce(Inp,{label:"備註",value:newS.note,onChange:function(e){setNewS(Object.assign({},newS,{note:e.target.value}));}}),
          ce("div",{style:{display:"flex",gap:8}},
            ce(Btn,{onClick:doAdd},editingId?"儲存":"新增"),
            ce(Btn,{v:"ghost",onClick:function(){setShowAdd(false);setEditingId(null);}},"取消")))),
      staffList.length===0?ce("div",{style:{textAlign:"center",padding:32,color:T.muted}},"尚無業務人員資料，點上方「+新增業務人員」建立第一筆。"):
      ce("div",{style:{display:"grid",gap:8}},
        staffList.map(function(s){
          return ce(Card,{key:s.id,style:{padding:"12px 14px"}},
            ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}},
              ce("div",null,
                ce("div",{style:{fontWeight:700,fontSize:14,color:T.text}},s.name+(s.empCode?"("+s.empCode+")":"")),
                ce("div",{style:{fontSize:11,color:T.muted}},s.title+" · "+(s.phone||"-")+" · "+(s.email||"-")),
                s.note&&ce("div",{style:{fontSize:11,color:T.faint,marginTop:2}},s.note)),
              ce("div",{style:{textAlign:"right"}},
                ce("div",{style:{fontSize:11,color:T.muted}},"累計承辦"),
                ce("div",{style:{fontSize:16,fontWeight:800,color:T.teal}},countFor(s)+"筆"))),
            ce("div",{style:{display:"flex",gap:8,marginTop:10}},
              ce(Btn,{sz:"sm",v:"ghost",onClick:function(){setNewS({name:s.name,empCode:s.empCode,title:s.title,phone:s.phone,email:s.email,note:s.note});setEditingId(s.id);setShowAdd(true);}},"✏ 編輯"),
              ce(Btn,{sz:"sm",v:"danger",onClick:function(){doDelete(s);}},"🗑 刪除")));
        }))));
}

// ── TICKET SCREEN ─────────────────────────────────────────────────────────────
// ── 預約管理(彙整主平台站內預約) ──────────────────────────────────────────────
function ApptMgmtScreen(props){
  var session=props.session;
  var role=session&&session.role;
  var canManage=hasPerm(role,"all")||hasPerm(role,"tickets");
  var[enterprises,setEnterprises]=useState([]);
  var[allAppts,setAllAppts]=useState([]);
  var[filterStatus,setFilterStatus]=useState("待確認");
  var[toast,setToast]=useState("");

  var loadAppts=function(){
    stor.g("l5_appt_index").then(function(idxRaw){
      var idx=idxRaw?JSON.parse(idxRaw):[];
      if(!idx.length){setAllAppts([]);return;}
      Promise.all(idx.map(function(code){return stor.g("appt_"+code).then(function(raw){return {code:code,raw:raw};});})).then(function(results){
        var all=[];
        results.forEach(function(r){
          if(!r.raw)return;
          var arr=JSON.parse(r.raw);
          arr.forEach(function(a){all.push(Object.assign({},a,{_code:r.code}));});
        });
        all.sort(function(a,b){return new Date(b.ts||0)-new Date(a.ts||0);});
        setAllAppts(all);
      });
    });
  };

  useEffect(function(){
    stor.g("l5_enterprises").then(function(d){if(d)setEnterprises(JSON.parse(d));});
    loadAppts();
  },[]);

  var entNameFor=function(code){
    var ent=enterprises.find(function(e){return e.orgCode===code;});
    return ent?ent.orgName:"個人用戶("+code+")";
  };

  var markNoted=async function(appt){
    var key="appt_"+appt._code;
    var raw=await stor.g(key);
    var arr=raw?JSON.parse(raw):[];
    arr=arr.map(function(a){return a.id===appt.id?Object.assign({},a,{_l5Noted:true}):a;});
    await stor.s(key,JSON.stringify(arr));
    loadAppts();
    setToast("已標記為已知悉");
  };

  var filtered=allAppts.filter(function(a){return filterStatus==="all"||a.status===filterStatus;});
  var pendingCount=allAppts.filter(function(a){return a.status==="待確認";}).length;
  var scM={"待確認":{bg:T.amberBg,c:T.amber},"已確認":{bg:T.sageBg,c:T.sage},"已完成":{bg:"#f0f4fb",c:"#4b5563"},"已取消":{bg:T.redBg,c:T.red}};

  return ce("div",{style:{display:"grid",gap:12}},
    ce(Toast,{msg:toast,onDone:function(){setToast("");}}),
    ce(IBox,{c:"navy"},"彙整主平台「自主健管預約排程」(站內預約)的申請紀錄，供麗媚客服/業務掌握各企業及個人用戶的預約動態。此清單為唯讀彙整，實際確認/取消請至主平台對應企業帳號操作，或聯繫企業窗口協助確認。"),
    pendingCount>0&&ce(Card,{style:{border:"2px solid "+T.amber}},
      ce(SecTitle,null,"🔔 待確認預約("+pendingCount+"筆)"),
      allAppts.filter(function(a){return a.status==="待確認";}).map(function(a){
        return ce("div",{key:a._code+"_"+a.id,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",
          borderRadius:8,border:"1px solid "+T.border,background:a._l5Noted?T.bg:T.amberBg,marginBottom:6}},
          ce("div",null,
            ce("div",{style:{fontSize:12,fontWeight:700,color:T.text}},entNameFor(a._code)+" · "+a.svc),
            ce("div",{style:{fontSize:10,color:T.muted,marginTop:2}},a.date+" "+a.time+" · 預約人："+a.name+(a.isFreeExp?"　🎁 免費體驗":"")+(a._l5Noted?"　✓ 已知悉":""))),
          canManage&&!a._l5Noted&&ce(Btn,{sz:"sm",v:"ghost",onClick:function(){markNoted(a);}},"標記已知悉"));
      })),
    ce(Card,null,
      ce(SecTitle,null,"全部預約記錄"),
      ce("div",{style:{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}},
        ["all","待確認","已確認","已完成","已取消"].map(function(s){
          return ce("button",{key:s,onClick:function(){setFilterStatus(s);},
            style:{padding:"4px 12px",borderRadius:20,border:"1px solid "+(filterStatus===s?T.teal:T.border),
              fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
              background:filterStatus===s?T.teal:"transparent",color:filterStatus===s?"#fff":T.muted}},
            s==="all"?"全部":s);
        })),
      filtered.length===0?ce("div",{style:{textAlign:"center",padding:24,color:T.muted}},"無符合條件的預約記錄"):
      ce("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:11}},
        ce("thead",null,ce("tr",{style:{background:T.bg}},
          ["企業/個人","服務項目","日期","時間","預約人","狀態"].map(function(h){
            return ce("th",{key:h,style:{padding:"6px 8px",textAlign:"left",color:T.muted,fontWeight:700,borderBottom:"1px solid "+T.border}},h);
          }))),
        ce("tbody",null,
          filtered.map(function(a){
            var sc=scM[a.status]||scM["待確認"];
            return ce("tr",{key:a._code+"_"+a.id,style:{borderBottom:"1px solid "+T.border}},
              ce("td",{style:{padding:"6px 8px",fontWeight:600,color:T.text}},entNameFor(a._code)),
              ce("td",{style:{padding:"6px 8px",color:T.text}},a.svc+(a.isFreeExp?" 🎁":"")),
              ce("td",{style:{padding:"6px 8px",color:T.muted}},a.date),
              ce("td",{style:{padding:"6px 8px",color:T.muted}},a.time),
              ce("td",{style:{padding:"6px 8px",color:T.muted}},a.name),
              ce("td",{style:{padding:"6px 8px"}},
                ce("span",{style:{padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,background:sc.bg,color:sc.c}},a.status)));
          })))));
}

function InvoiceScreen(props){
  var session=props.session;
  var role=session&&session.role;
  var canEdit=hasPerm(role,"all")||hasPerm(role,"payment");
  var[enterprises,setEnterprises]=useState([]);
  var[invoices,setInvoices]=useState([]);
  var[showAdd,setShowAdd]=useState(false);
  var[filterOrg,setFilterOrg]=useState("all");
  var[filterStatus,setFilterStatus]=useState("all");
  var[toast,setToast]=useState("");
  var BLANK={orgCode:"",orgName:"",ubn:"",invoiceNo:"",invoiceDate:"",
    layer:"A",items:[{desc:"",qty:1,unitPrice:0}],
    taxExcl:0,tax:0,total:0,status:"已開票",notes:""};
  var[form,setForm]=useState(BLANK);

  useEffect(function(){
    stor.g("l5_enterprises").then(function(d){if(d)setEnterprises(JSON.parse(d));});
    stor.g("l5_invoices").then(function(d){if(d)setInvoices(JSON.parse(d));});
  },[]);

  var saveInvoices=async function(list){
    await stor.s("l5_invoices",JSON.stringify(list));
    setInvoices(list);
  };

  var calcTotals=function(items){
    var taxExcl=items.reduce(function(a,it){return a+(parseInt(it.qty)||1)*(parseInt(it.unitPrice)||0);},0);
    var tax=Math.round(taxExcl*0.05);
    return {taxExcl:taxExcl,tax:tax,total:taxExcl+tax};
  };

  var updateItem=function(idx,field,val){
    var items=form.items.map(function(it,i){
      if(i!==idx)return it;
      return Object.assign({},it,{[field]:val});
    });
    var totals=calcTotals(items);
    setForm(Object.assign({},form,{items:items},totals));
  };

  var addItem=function(){
    var items=form.items.concat([{desc:"",qty:1,unitPrice:0}]);
    setForm(Object.assign({},form,{items:items}));
  };

  var doAdd=async function(){
    if(!form.orgCode||!form.invoiceNo||!form.invoiceDate){
      setToast("請填寫企業、發票號碼、發票日期");return;
    }
    var inv=Object.assign({},form,{id:"INV_"+Date.now(),createdAt:new Date().toISOString(),createdBy:session.name,linkedClaimId:""});
    var list=[inv].concat(invoices);
    await saveInvoices(list);
    setForm(BLANK);setShowAdd(false);
    setToast("發票 "+inv.invoiceNo+" 已建立");
  };

  var updateStatus=async function(id,status){
    var list=invoices.map(function(inv){return inv.id===id?Object.assign({},inv,{status:status,updatedAt:new Date().toISOString(),updatedBy:session.name}):inv;});
    await saveInvoices(list);
    setToast("發票狀態已更新為「"+status+"」");
  };

  var LAYERS=["A","B","C","D"];
  var STATUS_C={"已開票":{bg:T.amberBg,c:T.amber},"待收款":{bg:T.navyBg,c:T.navy},"已收款":{bg:T.sageBg,c:T.sage},"作廢":{bg:T.redBg,c:T.red}};
  var filtered=invoices.filter(function(inv){
    return (filterOrg==="all"||inv.orgCode===filterOrg)&&(filterStatus==="all"||inv.status===filterStatus);
  });
  var totalPending=invoices.filter(function(inv){return inv.status==="待收款"||inv.status==="已開票";}).reduce(function(a,inv){return a+inv.total;},0);
  var totalReceived=invoices.filter(function(inv){return inv.status==="已收款";}).reduce(function(a,inv){return a+inv.total;},0);

  return ce("div",{style:{display:"grid",gap:12}},
    ce(Toast,{msg:toast,onDone:function(){setToast("");}}),
    ce(IBox,{c:"navy"},"【REIBI應收帳款 — 發票管理】記錄REIBI對企業客戶開立的發票，建立發票→待收款→已收款的追蹤軌跡，作為後續對帳/請款/沖帳作業的憑證依據。注意：目前為手動輸入，未串接電子發票系統(電子發票API需正式後端，已列入長期規劃)。"),
    ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}},
      ce(Card,{style:{padding:"12px 14px"}},
        ce("div",{style:{fontSize:11,color:T.muted}},"待收款總額(已開票+待收款)"),
        ce("div",{style:{fontSize:20,fontWeight:800,color:T.amber}},"NT$"+(totalPending/10000).toFixed(1)+"萬")),
      ce(Card,{style:{padding:"12px 14px"}},
        ce("div",{style:{fontSize:11,color:T.muted}},"已收款總額"),
        ce("div",{style:{fontSize:20,fontWeight:800,color:T.sage}},"NT$"+(totalReceived/10000).toFixed(1)+"萬"))),
    canEdit&&ce(Btn,{v:"sage",onClick:function(){setShowAdd(true);setForm(BLANK);}},"＋ 新增發票記錄"),
    showAdd&&ce(Card,{style:{border:"2px solid "+T.teal}},
      ce(SecTitle,null,"新增發票記錄"),
      ce("div",{style:{display:"grid",gap:10}},
        ce(Select,{label:"企業客戶 *",value:form.orgCode,onChange:function(e){
          var ent=enterprises.find(function(x){return x.orgCode===e.target.value;})||{};
          setForm(Object.assign({},form,{orgCode:e.target.value,orgName:ent.orgName||"",ubn:ent.ubn||ent.taxId||""}));
        }},
          ce("option",{value:""},"請選擇企業"),
          enterprises.map(function(e){return ce("option",{key:e.id,value:e.orgCode},e.orgName);})),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}},
          ce(Inp,{label:"統一編號(自動帶入)",value:form.ubn,onChange:function(e){setForm(Object.assign({},form,{ubn:e.target.value}));},placeholder:"00000000"}),
          ce(Select,{label:"對應服務層別",value:form.layer,onChange:function(e){setForm(Object.assign({},form,{layer:e.target.value}));}},
            LAYERS.map(function(l){return ce("option",{key:l,value:l},l+"層");}),
            ce("option",{value:"A+C"},"A+C層(合併)"),
            ce("option",{value:"多層"},"多層合併"))),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}},
          ce(Inp,{label:"發票號碼 *",value:form.invoiceNo,onChange:function(e){setForm(Object.assign({},form,{invoiceNo:e.target.value}));},placeholder:"例：AB-12345678"}),
          ce(Inp,{label:"開票日期 *",type:"date",value:form.invoiceDate,onChange:function(e){setForm(Object.assign({},form,{invoiceDate:e.target.value}));}})),
        ce("div",{style:{marginBottom:4}},
          ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}},
            ce("label",{style:{fontSize:12,color:T.muted,fontWeight:600}},"品項明細"),
            ce(Btn,{sz:"sm",v:"ghost",onClick:addItem},"＋ 新增品項")),
          form.items.map(function(it,idx){
            return ce("div",{key:idx,style:{display:"grid",gridTemplateColumns:"3fr 1fr 1fr",gap:6,marginBottom:6}},
              ce("input",{value:it.desc,onChange:function(e){updateItem(idx,"desc",e.target.value);},
                placeholder:"品項說明(例：A層軟體授權費2026年)",
                style:{padding:"7px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:12,fontFamily:"inherit"}}),
              ce("input",{type:"number",value:it.qty,onChange:function(e){updateItem(idx,"qty",e.target.value);},
                placeholder:"數量",
                style:{padding:"7px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:12,fontFamily:"inherit",textAlign:"right"}}),
              ce("input",{type:"number",value:it.unitPrice,onChange:function(e){updateItem(idx,"unitPrice",e.target.value);},
                placeholder:"單價",
                style:{padding:"7px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:12,fontFamily:"inherit",textAlign:"right"}}));
          })),
        ce(Card,{style:{background:T.bg,padding:"10px 12px"}},
          ce("div",{style:{display:"grid",gridTemplateColumns:"1fr auto",gap:4}},
            ce("span",{style:{fontSize:12,color:T.muted}},"未稅金額"),
            ce("span",{style:{fontSize:12,fontWeight:700}},"NT$"+form.taxExcl.toLocaleString()),
            ce("span",{style:{fontSize:12,color:T.muted}},"應付稅額(5%)"),
            ce("span",{style:{fontSize:12,fontWeight:700}},"NT$"+form.tax.toLocaleString()),
            ce("span",{style:{fontSize:13,fontWeight:800,color:T.amber}},"含稅金額"),
            ce("span",{style:{fontSize:15,fontWeight:800,color:T.amber}},"NT$"+form.total.toLocaleString()))),
        ce(Inp,{label:"備註(選填)",value:form.notes,onChange:function(e){setForm(Object.assign({},form,{notes:e.target.value}));},placeholder:"例：含A+C層服務費，請款期限30日"}),
        ce("div",{style:{display:"flex",gap:8}},
          ce(Btn,{v:"sage",onClick:doAdd,full:true},"✅ 儲存發票記錄"),
          ce(Btn,{v:"ghost",onClick:function(){setShowAdd(false);}},  "取消")))),
    ce(Card,null,
      ce(SecTitle,null,"發票記錄清單"),
      ce("div",{style:{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}},
        ce(Select,{value:filterOrg,onChange:function(e){setFilterOrg(e.target.value);}},
          ce("option",{value:"all"},"全部企業"),
          enterprises.map(function(e){return ce("option",{key:e.id,value:e.orgCode},e.orgName);})),
        ["all","已開票","待收款","已收款","作廢"].map(function(s){
          return ce("button",{key:s,onClick:function(){setFilterStatus(s);},
            style:{padding:"4px 12px",borderRadius:20,border:"1px solid "+(filterStatus===s?T.teal:T.border),
              fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
              background:filterStatus===s?T.teal:"transparent",color:filterStatus===s?"#fff":T.muted}},
            s==="all"?"全部狀態":s);
        })),
      filtered.length===0?ce("div",{style:{textAlign:"center",padding:24,color:T.muted}},"目前無發票記錄"):
      ce("div",{style:{display:"grid",gap:8}},
        filtered.map(function(inv){
          var sc=STATUS_C[inv.status]||STATUS_C["已開票"];
          return ce(Card,{key:inv.id,style:{padding:"12px 14px",borderLeft:"3px solid "+sc.c}},
            ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}},
              ce("div",null,
                ce("div",{style:{fontWeight:700,fontSize:13,color:T.text}},inv.invoiceNo+" · "+inv.orgName),
                ce("div",{style:{fontSize:11,color:T.muted,marginTop:2}},
                  inv.invoiceDate+" · "+inv.layer+"層 · 統編："+(inv.ubn||"-")+" · 開票人："+inv.createdBy),
                inv.items&&inv.items.length>0&&ce("div",{style:{fontSize:11,color:T.muted,marginTop:2}},
                  "品項："+inv.items.map(function(it){return it.desc+"×"+it.qty;}).join("、"))),
              ce("div",{style:{textAlign:"right"}},
                ce("div",{style:{fontSize:15,fontWeight:800,color:T.amber}},"NT$"+inv.total.toLocaleString()),
                ce("div",{style:{fontSize:10,color:T.muted}},"未稅 NT$"+inv.taxExcl.toLocaleString()+" + 稅 NT$"+inv.tax.toLocaleString()),
                ce("span",{style:{padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,background:sc.bg,color:sc.c}},inv.status))),
            canEdit&&ce("div",{style:{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}},
              ["已開票","待收款","已收款","作廢"].filter(function(s){return s!==inv.status;}).map(function(s){
                return ce(Btn,{key:s,sz:"sm",v:s==="已收款"?"sage":s==="作廢"?"danger":"ghost",
                  onClick:function(){updateStatus(inv.id,s);}},
                  s==="已收款"?"✅ 標記已收款":s==="作廢"?"✗ 作廢":s==="待收款"?"📋 標記待收款":"↩ 已開票");
              })),
            inv.notes&&ce("div",{style:{fontSize:11,color:T.muted,marginTop:6}},"備註："+inv.notes));
        }))));
}

// ── PersonalSubScreen — 個人訂閱審核(v2.1新增) ────────────────────────────────
// 對應主平台v10.3.23的個人認購機制：個人在主平台申請訂閱→本畫面人工核對付款證明後核准→
// 產生啟用碼→人工經LINE/Email轉交客戶→客戶於主平台自行輸入解鎖。
// ⚠ 本畫面完全不讀取主平台的個人使用者健康評估資料(storage隔離，讀不到也不需要讀)，
// 僅記錄客服/財務人員手動輸入的審核所需基本資訊(會員碼/方案/金額/發票號碼)。
function PersonalSubScreen(props){
  var session=props.session;
  var role=session&&session.role;
  var canEdit=hasPerm(role,"all")||hasPerm(role,"personal_sub");
  var[list,setList]=useState([]);
  var[showAdd,setShowAdd]=useState(false);
  var[filterStatus,setFilterStatus]=useState("all");
  var[toast,setToast]=useState("");
  var BLANK={memberCode:"",name:"",contact:"",plan:"monthly",amount:0,invoiceNo:"",note:""};
  var[form,setForm]=useState(BLANK);

  useEffect(function(){
    stor.g("l5_personal_subs").then(function(d){if(d)setList(JSON.parse(d));});
  },[]);

  var saveList=async function(l){
    await stor.s("l5_personal_subs",JSON.stringify(l));
    setList(l);
  };

  var doAdd=async function(){
    if(!form.memberCode.trim()){setToast("請填入客戶提供的個人會員碼");return;}
    var rec=Object.assign({},form,{
      id:"PSUB_"+Date.now(),
      memberCode:form.memberCode.trim().toUpperCase(),
      status:"待審核",
      requestedAt:new Date().toISOString(),
      approvedAt:"",expiresAt:"",activationCode:"",
      createdBy:session.name
    });
    await saveList([rec].concat(list));
    setForm(BLANK);setShowAdd(false);
    setToast("已建立「"+rec.memberCode+"」的訂閱審核記錄");
  };

  var doApprove=async function(rec){
    var planDef=PERSONAL_SUB_PLANS.find(function(p){return p.k===rec.plan;})||PERSONAL_SUB_PLANS[0];
    var now=new Date().toISOString();
    var expiresAt=addMonthsISO(now,planDef.months);
    var code=await makeActivationCode(rec.memberCode,rec.plan,expiresAt);
    var updated=list.map(function(r){
      return r.id===rec.id?Object.assign({},r,{status:"已核准",approvedAt:now,expiresAt:expiresAt,activationCode:code}):r;
    });
    await saveList(updated);
    setToast("已核准「"+rec.memberCode+"」，啟用碼已產生，請於下方複製轉交客戶");
  };

  var doReject=async function(rec){
    var updated=list.map(function(r){
      return r.id===rec.id?Object.assign({},r,{status:"已拒絕"}):r;
    });
    await saveList(updated);
    setToast("已拒絕「"+rec.memberCode+"」的申請");
  };

  var updateNote=function(id,val){
    setList(function(prev){return prev.map(function(r){return r.id===id?Object.assign({},r,{note:val}):r;});});
  };
  var saveNote=function(rec){
    saveList(list.map(function(r){return r.id===rec.id?rec:r;}));
  };

  var filtered=list.filter(function(r){return filterStatus==="all"||r.status===filterStatus;});
  var STATUS_C={"待審核":{bg:T.amberBg,c:T.amber},"已核准":{bg:T.sageBg,c:T.sage},"已拒絕":{bg:T.redBg,c:T.red}};
  var totalRevenue=list.filter(function(r){return r.status==="已核准";}).reduce(function(a,r){return a+(parseInt(r.amount)||0);},0);
  var pendingCount=list.filter(function(r){return r.status==="待審核";}).length;

  return ce("div",{style:{display:"grid",gap:12}},
    ce(Toast,{msg:toast,onDone:function(){setToast("");}}),
    ce(IBox,{c:"navy"},"【個人訂閱審核】客戶在主平台申請訂閱後，會透過LINE或Email提供付款證明，請核對後於此處核准。核准後系統自動產生「啟用碼」，請將此碼轉交客戶，客戶於主平台自行輸入即可解鎖訂閱功能。⚠ 此清單與主平台個人使用者的健康評估資料完全隔離(不同artifact，storage不互通)，僅記錄審核/開票/入帳所需的基本資訊，不會也不能讀取客戶的評估內容。"),
    ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}},
      ce(Card,{style:{padding:"12px 14px"}},
        ce("div",{style:{fontSize:11,color:T.muted}},"待審核申請數"),
        ce("div",{style:{fontSize:20,fontWeight:800,color:T.amber}},pendingCount+" 筆")),
      ce(Card,{style:{padding:"12px 14px"}},
        ce("div",{style:{fontSize:11,color:T.muted}},"已核准累計收款金額"),
        ce("div",{style:{fontSize:20,fontWeight:800,color:T.sage}},"NT$"+totalRevenue.toLocaleString()))),
    canEdit&&ce(Btn,{v:"sage",onClick:function(){setShowAdd(true);setForm(BLANK);}},"＋ 新增訂閱申請記錄"),
    showAdd&&ce(Card,{style:{border:"2px solid "+T.teal}},
      ce(SecTitle,null,"新增訂閱申請記錄(依客戶LINE/Email提供的資訊手動輸入)"),
      ce("div",{style:{display:"grid",gap:10}},
        ce(Inp,{label:"個人會員碼 *(客戶在主平台申請時取得的8碼)",value:form.memberCode,onChange:function(e){setForm(Object.assign({},form,{memberCode:e.target.value.toUpperCase()}));},placeholder:"如：AB3D9F2K"}),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}},
          ce(Inp,{label:"客戶稱呼",value:form.name,onChange:function(e){setForm(Object.assign({},form,{name:e.target.value}));}}),
          ce(Inp,{label:"聯絡方式",value:form.contact,onChange:function(e){setForm(Object.assign({},form,{contact:e.target.value}));},placeholder:"電話/LINE ID/Email"})),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}},
          ce(Select,{label:"訂閱方案",value:form.plan,onChange:function(e){setForm(Object.assign({},form,{plan:e.target.value}));}},
            PERSONAL_SUB_PLANS.map(function(p){return ce("option",{key:p.k,value:p.k},p.label+"("+p.months+"個月)");})),
          ce(Inp,{label:"收款金額(NT$)",type:"number",value:form.amount,onChange:function(e){setForm(Object.assign({},form,{amount:e.target.value}));}})),
        ce(Inp,{label:"發票號碼(選填，可核准後補填)",value:form.invoiceNo,onChange:function(e){setForm(Object.assign({},form,{invoiceNo:e.target.value}));},placeholder:"例：AB-12345678"}),
        ce(Inp,{label:"備註(選填)",value:form.note,onChange:function(e){setForm(Object.assign({},form,{note:e.target.value}));}}),
        ce("div",{style:{display:"flex",gap:8}},
          ce(Btn,{v:"sage",onClick:doAdd,full:true},"✅ 建立記錄"),
          ce(Btn,{v:"ghost",onClick:function(){setShowAdd(false);}},"取消")))),
    ce(Card,null,
      ce(SecTitle,null,"訂閱申請清單"),
      ce("div",{style:{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}},
        ["all","待審核","已核准","已拒絕"].map(function(s){
          return ce("button",{key:s,onClick:function(){setFilterStatus(s);},
            style:{padding:"4px 12px",borderRadius:20,border:"1px solid "+(filterStatus===s?T.teal:T.border),
              fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
              background:filterStatus===s?T.teal:"transparent",color:filterStatus===s?"#fff":T.muted}},
            s==="all"?"全部狀態":s);
        })),
      filtered.length===0?ce("div",{style:{textAlign:"center",padding:24,color:T.muted}},"目前無訂閱申請記錄"):
      ce("div",{style:{display:"grid",gap:8}},
        filtered.map(function(rec){
          var sc=STATUS_C[rec.status]||STATUS_C["待審核"];
          var planDef=PERSONAL_SUB_PLANS.find(function(p){return p.k===rec.plan;})||{};
          return ce(Card,{key:rec.id,style:{padding:"12px 14px",borderLeft:"3px solid "+sc.c}},
            ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}},
              ce("div",null,
                ce("div",{style:{fontWeight:700,fontSize:13,color:T.text}},"會員碼 "+rec.memberCode+(rec.name?"("+rec.name+")":"")),
                ce("div",{style:{fontSize:11,color:T.muted,marginTop:2}},
                  (planDef.label||rec.plan)+" · 申請日："+rec.requestedAt.slice(0,10)),
                rec.contact&&ce("div",{style:{fontSize:11,color:T.muted}},"聯絡方式："+rec.contact),
                rec.expiresAt&&ce("div",{style:{fontSize:11,color:T.muted}},"到期日："+rec.expiresAt.slice(0,10))),
              ce("div",{style:{textAlign:"right"}},
                parseInt(rec.amount)>0&&ce("div",{style:{fontSize:15,fontWeight:800,color:T.amber}},"NT$"+(parseInt(rec.amount)||0).toLocaleString()),
                ce("span",{style:{padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,background:sc.bg,color:sc.c}},rec.status))),
            rec.invoiceNo&&ce("div",{style:{fontSize:11,color:T.muted,marginTop:4}},"發票號碼："+rec.invoiceNo),
            canEdit&&rec.status==="待審核"&&ce("div",{style:{marginTop:8}},
              ce("input",{type:"text",value:rec.note||"",placeholder:"備註(選填)",onChange:function(e){updateNote(rec.id,e.target.value);},onBlur:function(){saveNote(rec);},
                style:{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid "+T.border,fontSize:11,fontFamily:"inherit",boxSizing:"border-box",marginBottom:8}}),
              ce("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
                ce(Btn,{sz:"sm",v:"sage",onClick:function(){doApprove(rec);}},"✅ 核准並產生啟用碼"),
                ce(Btn,{sz:"sm",v:"danger",onClick:function(){doReject(rec);}},"✗ 拒絕"))),
            !canEdit&&rec.note&&ce("div",{style:{fontSize:11,color:T.muted,marginTop:4}},"備註："+rec.note),
            rec.status==="已核准"&&rec.activationCode&&ce(Card,{style:{marginTop:10,background:T.sageBg,textAlign:"center",padding:"12px 10px"}},
              ce("div",{style:{fontSize:10,color:T.muted,marginBottom:4}},"啟用碼(請透過LINE/Email轉交客戶)"),
              ce("div",{style:{fontSize:20,fontWeight:800,color:T.sage,letterSpacing:3,marginBottom:8,fontFamily:"monospace"}},rec.activationCode),
              ce(Btn,{sz:"sm",v:"ghost",onClick:function(){
                navigator.clipboard.writeText(rec.activationCode).then(function(){setToast("已複製啟用碼");});
              }},"📋 複製啟用碼")));
        }))));
}

function TicketScreen(props){
  var session=props.session;
  var role=session&&session.role;
  var canManage=hasPerm(role,"all")||hasPerm(role,"tickets");
  var[tickets,setTickets]=useState([]);
  var[enterprises,setEnterprises]=useState([]);
  var[filterStatus,setFilterStatus]=useState("all");
  var[filterType,setFilterType]=useState("all");
  var[dateStart,setDateStart]=useState("");
  var[dateEnd,setDateEnd]=useState("");
  var[showAdd,setShowAdd]=useState(false);
  var[toast,setToast]=useState("");
  var[newT,setNewT]=useState({entId:"",type:"量測預約",priority:"一般",note:"",preferDate:""});
  var TYPES=["量測預約","設備訓練","報修","服務申請","合約諮詢","其他"];
  var PRIOS=["緊急","一般","低優先"];
  useEffect(function(){
    stor.g("l5_tickets").then(function(d){if(d)setTickets(JSON.parse(d));});
    stor.g("l5_enterprises").then(function(d){if(d)setEnterprises(JSON.parse(d));});
  },[]);
  var saveTks=async function(list){await stor.s("l5_tickets",JSON.stringify(list));setTickets(list);};
  var doAdd=async function(){
    if(!newT.entId){setToast("請選擇企業");return;}
    var ent=enterprises.find(function(e){return e.id===newT.entId;})||{};
    var t={id:"TK_"+Date.now(),entId:newT.entId,entName:ent.orgName||"未知",entCode:ent.orgCode||"",type:newT.type,priority:newT.priority,note:newT.note,preferDate:newT.preferDate,status:"待處理",createdAt:new Date().toISOString(),createdBy:session.name,handler:""};
    await saveTks([t].concat(tickets));
    setShowAdd(false);setNewT({entId:"",type:"量測預約",priority:"一般",note:"",preferDate:""});
    setToast("工單 "+t.id+" 已建立");
  };
  var updateTk=async function(id,fields){
    var updated=tickets.map(function(t){if(t.id!==id)return t;return Object.assign({},t,fields);});
    await saveTks(updated);setToast("已更新");
  };
  var filtered=tickets.filter(function(t){
    return (filterStatus==="all"||t.status===filterStatus)&&
           (filterType==="all"||t.type===filterType)&&
           (!dateStart||t.createdAt.slice(0,10)>=dateStart)&&
           (!dateEnd||t.createdAt.slice(0,10)<=dateEnd);
  });
  var pc=function(p){return p==="緊急"?{bg:T.redBg,c:T.red}:p==="一般"?{bg:T.amberBg,c:T.amber}:{bg:"#f8fafc",c:T.muted};};
  var sc=function(s){return s==="已完成"?{bg:T.sageBg,c:T.sage}:s==="處理中"?{bg:T.tealBg,c:T.teal}:s==="待處理"?{bg:T.amberBg,c:T.amber}:{bg:"#f8fafc",c:T.muted};};
  return ce("div",{style:{display:"grid",gap:12}},
    ce(Toast,{msg:toast,onDone:function(){setToast("");}}),
    ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}},
      [{l:"待處理",v:tickets.filter(function(t){return t.status==="待處理";}).length,c:T.amber},
       {l:"處理中",v:tickets.filter(function(t){return t.status==="處理中";}).length,c:T.teal},
       {l:"本期合計",v:filtered.length,c:T.navy}].map(function(k){
        return ce(Card,{key:k.l,style:{padding:"12px 14px",textAlign:"center"}},
          ce("div",{style:{fontSize:22,fontWeight:800,color:k.c}},k.v),
          ce("div",{style:{fontSize:11,color:T.muted,marginTop:4}},k.l));
      })),
    ce(Card,null,
      ce(SecTitle,null,"篩選查詢"),
      ce(DateRangePicker,{onChange:function(s,e){setDateStart(s);setDateEnd(e);}}),
      ce("div",{style:{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}},
        ["all","待處理","處理中","已完成","已關閉"].map(function(s){
          return ce("button",{key:s,onClick:function(){setFilterStatus(s);},
            style:{padding:"4px 10px",borderRadius:20,border:"1px solid "+(filterStatus===s?T.teal:T.border),fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:filterStatus===s?T.teal:"transparent",color:filterStatus===s?"#fff":T.muted}},
            s==="all"?"全部狀態":s);
        })),
      ce("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
        ["all"].concat(TYPES).map(function(t){
          return ce("button",{key:t,onClick:function(){setFilterType(t);},
            style:{padding:"4px 10px",borderRadius:20,border:"1px solid "+(filterType===t?T.plum:T.border),fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:filterType===t?T.plum:"transparent",color:filterType===t?"#fff":T.muted}},
            t==="all"?"全部類型":t);
        }))),
    ce("div",{style:{display:"flex",justifyContent:"flex-end"}},
      ce(Btn,{onClick:function(){setShowAdd(!showAdd);}},showAdd?"取消":"+ 新增工單")),
    showAdd&&ce(Card,null,
      ce(SecTitle,null,"新增服務工單"),
      ce("div",{style:{display:"grid",gap:10}},
        ce(Select,{label:"企業 *",value:newT.entId,onChange:function(e){setNewT(function(p){return Object.assign({},p,{entId:e.target.value});})}},
          ce("option",{value:""},"請選擇企業"),
          enterprises.map(function(e){return ce("option",{key:e.id,value:e.id},e.orgName);})),
        ce(Select,{label:"服務類型",value:newT.type,onChange:function(e){setNewT(function(p){return Object.assign({},p,{type:e.target.value});})}},
          TYPES.map(function(t){return ce("option",{key:t,value:t},t);})),
        ce(Select,{label:"優先程度",value:newT.priority,onChange:function(e){setNewT(function(p){return Object.assign({},p,{priority:e.target.value});})}},
          PRIOS.map(function(p){return ce("option",{key:p,value:p},p);})),
        ce(Inp,{label:"期望日期",type:"date",value:newT.preferDate,onChange:function(e){setNewT(function(p){return Object.assign({},p,{preferDate:e.target.value});});}}),
        ce("div",null,
          ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4,fontWeight:600}},"備註"),
          ce("textarea",{value:newT.note,onChange:function(e){setNewT(function(p){return Object.assign({},p,{note:e.target.value});});},rows:3,
            style:{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:12,fontFamily:"inherit",boxSizing:"border-box",resize:"vertical"}})),
        ce(Btn,{onClick:doAdd,full:true},"建立工單"))),
    filtered.length===0?ce(Card,{style:{textAlign:"center",padding:32,color:T.muted}},tickets.length===0?"尚無工單":"無符合條件"):
    ce("div",{style:{display:"grid",gap:8}},
      filtered.map(function(t){
        var p=pc(t.priority);var s=sc(t.status);
        return ce(Card,{key:t.id,style:{padding:"12px 14px",borderLeft:"3px solid "+s.c}},
          ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}},
            ce("div",null,
              ce("div",{style:{fontWeight:700,fontSize:12,color:T.text}},t.entName),
              ce("div",{style:{fontSize:11,color:T.muted,marginTop:2}},t.type+" · "+t.createdAt.slice(0,10)),
              t.preferDate&&ce("div",{style:{fontSize:11,color:T.teal,marginTop:2}},"期望："+t.preferDate),
              t.note&&ce("div",{style:{fontSize:11,color:T.muted,marginTop:2}},t.note)),
            ce("div",{style:{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}},
              ce("span",{style:{padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,background:s.bg,color:s.c}},t.status),
              ce("span",{style:{padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,background:p.bg,color:p.c}},t.priority))),
          canManage&&ce("div",{style:{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}},
            ["處理中","已完成","已關閉"].map(function(st){
              return ce(Btn,{key:st,sz:"sm",v:st==="已完成"?"sage":st==="處理中"?"primary":"ghost",disabled:t.status===st,
                onClick:function(){updateTk(t.id,{status:st,handler:session.name,updatedAt:new Date().toISOString()});}},st);
            }),
            ce(Btn,{sz:"sm",v:"navy",onClick:function(){setToast("LINE推播："+t.entName+" 您的「"+t.type+"」工單已更新，請至平台查看。");}},"💬 LINE")));
      })));
}

// ── LINE PUSH SCREEN ──────────────────────────────────────────────────────────
function LinePushScreen(props){
  var session=props.session;
  var[enterprises,setEnterprises]=useState([]);
  var[distributors,setDistributors]=useState([]);
  var[logs,setLogs]=useState([]);
  var[tab,setTab]=useState("send");
  var[targetType,setTargetType]=useState("enterprise");
  var[targetId,setTargetId]=useState("all");
  var[tmpl,setTmpl]=useState("expire");
  var[customMsg,setCustomMsg]=useState("");
  var[toast,setToast]=useState("");

  var TMPLS={
    expire:{l:"📅 合約到期提醒",gen:function(name){return ["致 "+name+" 管理者：","您的REIBI平台授權即將到期，請聯繫麗媚安排續約事宜。","如需協助請聯絡 LINE @reibicare"].join("\n");}},
    service:{l:"✅ 服務確認通知",gen:function(name){return ["致 "+name+" 管理者：","您預約的REIBI服務已確認排程，麗媚團隊將準時為您服務。","如需異動請聯絡 LINE @reibicare"].join("\n");}},
    commission:{l:"💰 佣金結算通知",gen:function(name){return ["致 "+name+" 夥伴：","本月佣金已完成結算，預計15日匯款至您的指定帳戶。","如有疑問請聯絡 LINE @reibicare"].join("\n");}},
    announce:{l:"📢 系統公告",gen:function(name){return ["致 "+name+"：","REIBI平台系統更新公告：系統將於近期進行例行維護，期間服務暫停約2小時。","感謝您的配合，詳情請關注 LINE @reibicare"].join("\n");}},
    welcome:{l:"🎉 開通歡迎通知",gen:function(name){return ["歡迎 "+name+" 加入REIBI健康自主管理平台！","您的帳號已啟用，請依照開通信函指示完成首次登入設定。","有任何問題請聯絡 LINE @reibicare"].join("\n");}},
    custom:{l:"✏ 自訂內容",gen:function(){return customMsg;}}
  };

  useEffect(function(){
    stor.g("l5_enterprises").then(function(d){if(d)setEnterprises(JSON.parse(d));});
    stor.g("l5_distributors").then(function(d){if(d)setDistributors(JSON.parse(d));});
    stor.g("l5_line_logs").then(function(d){if(d)setLogs(JSON.parse(d));});
  },[]);

  var getTargetName=function(){
    if(targetId==="all")return targetType==="enterprise"?"全體企業":"全體經銷商";
    var list=targetType==="enterprise"?enterprises:distributors;
    var found=list.find(function(x){return x.id===targetId;});
    return found?found.name||found.orgName:"未知";
  };

  var previewMsg=function(){
    var t=TMPLS[tmpl];
    if(!t)return "";
    if(tmpl==="custom")return customMsg;
    return t.gen(getTargetName());
  };

  var doSend=async function(){
    var msg=previewMsg();
    if(!msg.trim()){setToast("請填入訊息內容");return;}
    var log={
      id:"LOG_"+Date.now(),
      ts:new Date().toISOString(),
      targetType,targetId,targetName:getTargetName(),
      tmpl,msg,sender:session.name,
      status:"模擬發送"
    };
    var updated=[log].concat(logs);
    await stor.s("l5_line_logs",JSON.stringify(updated));
    setLogs(updated);
    setToast("推播已記錄(模擬)— 正式串接後將自動發送至 @reibicare");
  };

  return ce("div",{style:{display:"grid",gap:12}},
    ce(Toast,{msg:toast,onDone:function(){setToast("");}}),
    ce("div",{style:{display:"flex",gap:0,background:T.bg,borderRadius:10,padding:3}},
      [{k:"send",l:"發送推播"},{k:"logs",l:"推播記錄 ("+logs.length+")"}].map(function(t){
        return ce("button",{key:t.k,onClick:function(){setTab(t.k);},
          style:{flex:1,padding:"8px 0",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:"inherit",
            background:tab===t.k?T.card:"transparent",color:tab===t.k?T.teal:T.muted}},t.l);
      })),
    tab==="send"&&ce("div",{style:{display:"grid",gap:12}},
      ce(Card,null,
        ce(SecTitle,null,"發送對象"),
        ce("div",{style:{display:"flex",gap:0,background:T.bg,borderRadius:8,padding:3,marginBottom:10}},
          [{v:"enterprise",l:"🏢 企業"},{v:"distributor",l:"🤝 經銷商"}].map(function(t){
            return ce("button",{key:t.v,onClick:function(){setTargetType(t.v);setTargetId("all");},
              style:{flex:1,padding:"7px 0",border:"none",borderRadius:6,cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:"inherit",
                background:targetType===t.v?T.card:"transparent",color:targetType===t.v?T.teal:T.muted}},t.l);
          })),
        ce(Select,{label:"選擇對象",value:targetId,onChange:function(e){setTargetId(e.target.value);}},
          ce("option",{value:"all"},targetType==="enterprise"?"全體企業":"全體經銷商"),
          (targetType==="enterprise"?enterprises:distributors).map(function(x){
            return ce("option",{key:x.id,value:x.id},x.orgName||x.name);
          }))),
      ce(Card,null,
        ce(SecTitle,null,"訊息模板"),
        ce("div",{style:{display:"grid",gap:6,marginBottom:12}},
          Object.entries(TMPLS).map(function(entry){
            var k=entry[0];var t=entry[1];
            return ce("div",{key:k,onClick:function(){setTmpl(k);},
              style:{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:8,cursor:"pointer",
                border:"2px solid "+(tmpl===k?T.teal:T.border),background:tmpl===k?T.tealBg:T.card}},
              ce("div",{style:{width:18,height:18,borderRadius:"50%",border:"2px solid "+(tmpl===k?T.teal:T.faint),
                background:tmpl===k?T.teal:"transparent",flexShrink:0}}),
              ce("div",{style:{fontSize:12,fontWeight:600,color:tmpl===k?T.teal:T.text}},t.l));
          })),
        tmpl==="custom"&&ce("div",null,
          ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4,fontWeight:600}},"自訂訊息內容"),
          ce("textarea",{value:customMsg,onChange:function(e){setCustomMsg(e.target.value);},rows:5,
            style:{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:12,fontFamily:"inherit",boxSizing:"border-box",resize:"vertical"},
            placeholder:"請輸入推播內容..."})),
        previewMsg()&&ce("div",null,
          ce("div",{style:{fontSize:12,color:T.muted,fontWeight:700,marginBottom:6}},"預覽"),
          ce("div",{style:{background:T.bg,borderRadius:8,padding:"10px 12px",fontSize:12,color:T.text,
            whiteSpace:"pre-wrap",lineHeight:1.7,border:"1px solid "+T.border}},previewMsg())),
        ce("div",{style:{display:"flex",gap:8,marginTop:10}},
          ce(Btn,{v:"ghost",onClick:function(){
            if(navigator.clipboard)navigator.clipboard.writeText(previewMsg()).then(function(){setToast("已複製至剪貼板，請貼至LINE @reibicare");});
            else setToast("請手動複製上方訊息至LINE @reibicare");
          }},"📋 複製訊息"),
          ce(Btn,{onClick:doSend,full:true,v:"sage"},"📤 記錄發送")))),
    tab==="logs"&&ce("div",{style:{display:"grid",gap:8}},
      logs.length===0?ce(Card,{style:{textAlign:"center",padding:32,color:T.muted}},"尚無推播記錄"):
      logs.map(function(log){
        return ce(Card,{key:log.id,style:{padding:"10px 14px"}},
          ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}},
            ce("div",null,
              ce("div",{style:{fontSize:12,fontWeight:700,color:T.text}},log.targetName),
              ce("div",{style:{fontSize:11,color:T.muted}},TMPLS[log.tmpl]?TMPLS[log.tmpl].l:log.tmpl)),
            ce("div",{style:{textAlign:"right"}},
              ce("div",{style:{fontSize:10,color:T.faint}},log.ts.slice(0,16).replace("T"," ")),
              ce("div",{style:{fontSize:10,color:T.muted}},log.sender))),
          ce("div",{style:{fontSize:11,color:T.muted,background:T.bg,borderRadius:6,padding:"6px 8px",
            whiteSpace:"pre-wrap",lineHeight:1.6}},log.msg.slice(0,80)+(log.msg.length>80?"...":"")));
      })));
}

// ── BIG DATA SCREEN ───────────────────────────────────────────────────────────
function BigDataScreen(props){
  var session=props.session;
  var[enterprises,setEnterprises]=useState([]);
  var[tab,setTab]=useState("hpi");
  var[dateStart,setDateStart]=useState("");
  var[dateEnd,setDateEnd]=useState("");

  var[healthAggs,setHealthAggs]=useState([]);
  var[radarData,setRadarData]=useState(null);

  useEffect(function(){
    stor.g("l5_enterprises").then(function(d){if(d)setEnterprises(JSON.parse(d));});
    // 讀取主平台寫入的真實健康彙整資料(l5_health_agg_*)
    stor.g("l5_health_agg_index").then(function(idxRaw){
      var idx=idxRaw?JSON.parse(idxRaw):[];
      if(!idx.length)return;
      Promise.all(idx.map(function(oc){
        return stor.g("l5_health_agg_"+oc.replace(/\W/g,"_")).then(function(raw){return raw?JSON.parse(raw):null;});
      })).then(function(results){
        var valid=results.filter(Boolean);
        setHealthAggs(valid);
        if(!valid.length)return;
        var wAvg=function(key){
          var filled=valid.filter(function(r){return r[key]!==null&&r[key]!==undefined;});
          if(!filled.length)return null;
          var n=filled.reduce(function(a,r){return a+r.n;},0);
          return Math.round(filled.reduce(function(a,r){return a+(r[key]||0)*r.n;},0)/n);
        };
        var rd=[
          {label:"睡眠",value:wAvg("sleepNorm")!==null?wAvg("sleepNorm"):71,color:T.teal,isReal:wAvg("sleepNorm")!==null},
          {label:"疼痛",value:wAvg("painNorm")!==null?wAvg("painNorm"):64,color:T.coral,isReal:wAvg("painNorm")!==null},
          {label:"身心(MHI)",value:wAvg("mhiAvg")!==null?wAvg("mhiAvg"):58,color:T.plum,isReal:wAvg("mhiAvg")!==null}
        ];
        setRadarData(rd);
      });
    });
  },[]);

  var INDUSTRIES=[
    {key:"tech",l:"💻 科技",subs:["半導體","軟體服務","硬體製造","AI大數據","電信通訊","電子商務","其他科技"]},
    {key:"finance",l:"🏦 金融",subs:["銀行","保險","證券","電子支付","財務顧問","其他金融"]},
    {key:"mfg",l:"🏭 製造",subs:["電子零組件","機械設備","食品加工","化學材料","金屬製品","其他製造"]},
    {key:"service",l:"🛎 服務",subs:["零售業","餐飲業","物流運輸","觀光旅遊","顧問諮詢","其他服務"]},
    {key:"medical",l:"🏥 醫療",subs:["醫院診所","藥局","生技製藥","長照機構","健康檢查","其他醫療"]},
    {key:"edu",l:"🎓 教育",subs:["大專院校","中小學","補習班","職業訓練","研究單位","其他教育"]},
    {key:"const",l:"🏗 建築",subs:["建設公司","營造廠","工程顧問","室內設計","其他建築"]},
    {key:"media",l:"📡 傳播",subs:["電視廣播","數位媒體","廣告公關","影視製作","其他傳播"]},
    {key:"gov",l:"🏛 政府",subs:["中央機關","地方機關","公立學校","國營事業","其他公部門"]},
    {key:"other",l:"🔹 其他",subs:["農林漁牧","公益組織","體育運動","藝術文化","待分類"]}
  ];
  var HPI_DIST=[
    {l:"優秀 85+",v:18,c:"#15803d"},{l:"良好 70-84",v:32,c:T.teal},
    {l:"中等 55-69",v:28,c:T.amber},{l:"待改善 40-54",v:15,c:T.coral},
    {l:"需關注 <40",v:7,c:T.red}
  ];
  var SLEEP_TREND=[
    {l:"1月",v:62},{l:"2月",v:65},{l:"3月",v:68},{l:"4月",v:67},
    {l:"5月",v:70},{l:"6月",v:72},{l:"7月",v:71},{l:"8月",v:74},
    {l:"9月",v:76},{l:"10月",v:75},{l:"11月",v:78},{l:"12月",v:80}
  ];
  var PAIN_TREND=[
    {l:"1月",v:45},{l:"2月",v:42},{l:"3月",v:40},{l:"4月",v:38},
    {l:"5月",v:35},{l:"6月",v:33},{l:"7月",v:34},{l:"8月",v:31},
    {l:"9月",v:29},{l:"10月",v:28},{l:"11月",v:26},{l:"12月",v:25}
  ];
  var IND_DATA=INDUSTRIES.map(function(ind,i){
    return {l:ind.l,key:ind.key,hpi:55+Math.round(Math.sin(i)*15),n:5+i*3,trend:i%2===0?"↑":"→"};
  });

  // MHI 三維雷達圖(企業平均，模擬數據)
  // TODO(正式串接)：應由主平台依企業orgCode彙整去識別化(k>=5)統計後寫入共用key，
  // 例如 l5_mhi_agg_{orgCode} = {sleepAvg, painAvg, mhiAvg, n, updatedAt}，
  // 詳細欄位設計見本函數下方「跨系統匯總資料結構設計」註解區塊
  var RADAR_MOCK=[
    {label:"睡眠",value:71,color:T.teal},
    {label:"疼痛",value:64,color:T.coral},
    {label:"身心(MHI)",value:58,color:T.plum}
  ];

  /* ── 跨系統匯總資料結構設計(TODO，待正式串接，目前僅供設計參考不影響執行)──────
  目標：L5 BigDataScreen 顯示「企業平均 ISI×BPI×MHI 三維雷達圖」需要的真實資料，
  來源是主平台各企業員工個人的 rpts(含 sScore/pScore)與 mental_hist_{uid}(phq4/pss4/mind3)。
  由於四系統各自獨立 storage，無法跨 artifact 即時讀取，需採用「主平台彙整後寫入共用key」模式：

  寫入端(主平台，新增彙整函數，建議於管理者登入後背景執行或每日排程觸發)：
  async function aggregateMHIForOrg(orgCode){
    var members = 該企業所有成員uid清單; // 來源：org_{orgCode} 或現有單位成員清單
    var allRpts = await DB.rpts(); // 全體最新報告(含 sScore/pScore，按 uid 篩選該企業成員)
    var allMental = await Promise.all(members.map(uid=>stor.g("mental_hist_"+uid)));
    // 計算每位成員的 ISI正規化分數、BPI正規化分數、MHI綜合分數，再平均
    // k-匿名性：若該企業成員數 < 5，不可輸出(避免反推個人)
    if(members.length < 5) return; // k>=5 規則
    var agg = {
      orgCode: orgCode,
      sleepAvg: 平均(ISI正規化分數),
      painAvg: 平均(BPI正規化分數),
      mhiAvg: 平均(MHI綜合分數),
      n: members.length, // 樣本數(去識別化前提下可揭露總數，不可揭露個人)
      updatedAt: new Date().toISOString()
    };
    await stor.s("l5_mhi_agg_"+orgCode.replace(/\W/g,"_"), JSON.stringify(agg));
    // 同步更新索引，供L5端跨企業彙整查詢(仿照 l5_remit_index 模式)
    var idx = await stor.g("l5_mhi_agg_index");
    var idxList = idx?JSON.parse(idx):[];
    if(idxList.indexOf(orgCode)<0){idxList.push(orgCode);await stor.s("l5_mhi_agg_index",JSON.stringify(idxList));}
  }

  讀取端(L5 BigDataScreen，正式串接後取代 RADAR_MOCK)：
  useEffect(function(){
    stor.g("l5_mhi_agg_index").then(function(idxRaw){
      var idx = idxRaw?JSON.parse(idxRaw):[];
      Promise.all(idx.map(oc=>stor.g("l5_mhi_agg_"+oc.replace(/\W/g,"_")))).then(function(results){
        var aggs = results.filter(Boolean).map(r=>JSON.parse(r));
        var allAvg = {
          sleepAvg: 平均(aggs.map(a=>a.sleepAvg)),
          painAvg: 平均(aggs.map(a=>a.painAvg)),
          mhiAvg: 平均(aggs.map(a=>a.mhiAvg))
        };
        setRadarData([{label:"睡眠",value:allAvg.sleepAvg,...},...]);
      });
    });
  },[]);

  設計原則延續錯誤L(資料來源唯一性)：
  - l5_mhi_agg_{orgCode} 屬於「狀態」類資料(每次彙整覆寫)，非歷史軌跡，故沖寫而非append
  - l5_mhi_agg_index 索引陣列設計仿照既有 l5_remit_index pattern，維持專案一致性
  - k-匿名性門檻(k>=5)與現有大數據頁面「k>=5匿名性保護」聲明一致，不可另立標準
  ──────────────────────────────────────────────────────────────────────── */

  return ce("div",{style:{display:"grid",gap:12}},
    ce(IBox,{c:"navy"},"📊 大數據分析採 k>=5 匿名性保護，所有資料均已去識別化處理。(合約第14條 REIBI 專屬分析權利)"),
    ce(DateRangePicker,{onChange:function(s,e){setDateStart(s);setDateEnd(e);}}),
    ce("div",{style:{display:"flex",gap:4,flexWrap:"wrap",marginBottom:4}},
      [{k:"hpi",l:"HPI分布"},{k:"trend",l:"趨勢分析"},{k:"industry",l:"產業別"},{k:"report",l:"白皮書"}].map(function(t){
        return ce("button",{key:t.k,onClick:function(){setTab(t.k);},
          style:{padding:"6px 14px",border:"none",borderRadius:20,cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:"inherit",
            background:tab===t.k?T.teal:"transparent",color:tab===t.k?"#fff":T.muted,
            border:"1px solid "+(tab===t.k?T.teal:T.border)}},t.l);
      })),
    tab==="hpi"&&ce("div",{style:{display:"grid",gap:12}},
      ce(Card,null,
        ce(SecTitle,null,"全台 HPI 健康績效指數分布"),
        ce("div",{style:{display:"grid",gap:6,marginBottom:12}},
          HPI_DIST.map(function(d){
            return ce("div",{key:d.l,style:{display:"flex",alignItems:"center",gap:10}},
              ce("div",{style:{width:90,fontSize:11,color:T.muted,textAlign:"right",flexShrink:0}},d.l),
              ce("div",{style:{flex:1,height:20,background:T.bg,borderRadius:4,overflow:"hidden"}},
                ce("div",{style:{height:"100%",width:d.v+"%",background:d.c,borderRadius:4,
                  display:"flex",alignItems:"center",paddingLeft:6,boxSizing:"border-box"}})),
              ce("div",{style:{width:36,fontSize:12,fontWeight:700,color:d.c}},d.v+"%"));
          })),
        ce(IBox,{c:"teal"},"全台平均 HPI：68.4 · 參與企業："+enterprises.length+"家 · 去識別化人數："+enterprises.reduce(function(a,e){return a+(parseInt(e.usedCount)||0);},0)+"人")),
      ce(Card,null,
        ce(SecTitle,null,"🎯 身心三維雷達圖(企業平均，睡眠×疼痛×MHI)"),
        healthAggs.length===0?
          ce(IBox,{c:"amber",style:{marginBottom:10,fontSize:11}},"⚠ 目前為模擬示範數據。各企業管理者進入KPI頁面時將自動彙整去識別化資料(k≥5)，資料累積後此提示將消失。"):
          ce(IBox,{c:"sage",style:{marginBottom:10,fontSize:11}},"✅ 真實數據：已從 "+healthAggs.length+" 家企業(共"+healthAggs.reduce(function(a,r){return a+r.n;},0)+"筆評估)彙整。MHI欄位需k≥5筆MHI評估才顯示真實值。"),
        ce(RadarChart3,{data:radarData||[{label:"睡眠",value:71,color:T.teal},{label:"疼痛",value:64,color:T.coral},{label:"身心(MHI)",value:58,color:T.plum}],fillColor:T.plum}),
        healthAggs.length>0&&ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:8}},
          (radarData||[]).map(function(d){
            return ce("div",{key:d.label,style:{textAlign:"center",padding:"6px",background:T.bg,borderRadius:6}},
              ce("div",{style:{fontSize:11,fontWeight:700,color:d.color}},d.label),
              ce("div",{style:{fontSize:16,fontWeight:800,color:d.color}},d.value),
              ce("div",{style:{fontSize:9,color:T.faint}},d.isReal?"✅ 真實資料":"⚠ 模擬"));
          }))),
      ce(Card,null,
        ce(SecTitle,null,"企業別 HPI 概況(模擬)"),
        enterprises.length===0?ce(IBox,{c:"amber"},"尚無企業資料"):
        ce("div",{style:{display:"grid",gap:6}},
          enterprises.slice(0,8).map(function(e,i){
            var hpi=55+Math.round(Math.random()*30);
            var color=hpi>=70?"#15803d":hpi>=55?T.amber:T.red;
            return ce("div",{key:e.id,style:{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid "+T.border}},
              ce("div",{style:{flex:1,fontSize:12,color:T.text,fontWeight:600}},e.orgName),
              ce("div",{style:{width:120,height:8,background:T.bg,borderRadius:4,overflow:"hidden"}},
                ce("div",{style:{height:"100%",width:hpi+"%",background:color,borderRadius:4}})),
              ce("div",{style:{width:36,fontSize:12,fontWeight:800,color:color}},hpi));
          })))),
    tab==="trend"&&ce("div",{style:{display:"grid",gap:12}},
      ce(Card,null,
        ce(SecTitle,null,"睡眠品質改善趨勢(ISI 達標率 %)"),
        ce(MiniBar,{data:SLEEP_TREND,color:T.teal,h:80}),
        ce(IBox,{c:"sage",style:{marginTop:8}},"年度改善幅度：+18% | 達標率已從62%提升至80%")),
      ce(Card,null,
        ce(SecTitle,null,"疼痛緩解趨勢(BPI 高風險比例 %)"),
        ce(MiniBar,{data:PAIN_TREND,color:T.coral,h:80}),
        ce(IBox,{c:"sage",style:{marginTop:8}},"高風險比例持續下降：45% → 25%，改善幅度 -44%")),
      ce(Card,null,
        ce(SecTitle,null,"YoY 年度同期比較"),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}},
          [{l:"睡眠達標率",v2024:"62%",v2025:"80%",trend:"↑+18%",c:T.sage},
           {l:"疼痛緩解率",v2024:"41%",v2025:"59%",trend:"↑+18%",c:T.teal},
           {l:"888計畫完成",v2024:"55%",v2025:"73%",trend:"↑+18%",c:T.amber}].map(function(k){
            return ce(Card,{key:k.l,style:{padding:"10px",textAlign:"center"}},
              ce("div",{style:{fontSize:10,color:T.muted,marginBottom:4}},k.l),
              ce("div",{style:{fontSize:13,fontWeight:800,color:k.c}},k.trend),
              ce("div",{style:{fontSize:11,color:T.faint}},k.v2024+" → "+k.v2025));
          })))),
    tab==="industry"&&ce("div",{style:{display:"grid",gap:12}},
      ce(Card,null,
        ce(SecTitle,null,"產業別健康分析"),
        ce("div",{style:{display:"grid",gap:6}},
          IND_DATA.map(function(d){
            var color=d.hpi>=70?"#15803d":d.hpi>=55?T.amber:T.red;
            return ce("div",{key:d.l,style:{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",
              background:T.bg,borderRadius:8}},
              ce("div",{style:{flex:1}},
                ce("div",{style:{fontSize:12,fontWeight:600,color:T.text}},d.l),
                ce("div",{style:{fontSize:10,color:T.muted}},d.n+"家企業")),
              ce("div",{style:{width:80,height:6,background:T.border,borderRadius:3,overflow:"hidden"}},
                ce("div",{style:{height:"100%",width:d.hpi+"%",background:color,borderRadius:3}})),
              ce("div",{style:{width:40,fontSize:13,fontWeight:800,color:color}},d.hpi),
              ce("div",{style:{fontSize:12,fontWeight:700,color:d.trend==="↑"?T.sage:T.muted}},d.trend));
          })))),
    tab==="report"&&ce("div",{style:{display:"grid",gap:12}},
      ce(Card,null,
        ce(SecTitle,null,"產業健康白皮書匯出"),
        ce(IBox,{c:"navy",style:{marginBottom:12}},["依合約第14條，REIBI擁有全台去識別化健康數據的分析與發布權利。","白皮書可用於：學術研究發表、政府提案、企業ESG報告、保險業談判依據。"].join("\n")),
        ce("div",{style:{display:"grid",gap:8}},
          [
            {l:"年度健康趨勢白皮書",desc:"全台HPI趨勢 + 睡眠/疼痛改善數據",period:"2025全年",status:"可匯出"},
            {l:"Q3產業健康分析報告",desc:"各產業別HPI分布 + 重點發現",period:"2025 Q3",status:"可匯出"},
            {l:"企業健促ROI研究報告",desc:"WPAI量表 + 病假成本節省分析",period:"2025上半年",status:"準備中"}
          ].map(function(r){
            return ce(Card,{key:r.l,style:{padding:"12px 14px"}},
              ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}},
                ce("div",null,
                  ce("div",{style:{fontWeight:700,fontSize:13,color:T.text}},r.l),
                  ce("div",{style:{fontSize:11,color:T.muted,marginTop:2}},r.desc),
                  ce("div",{style:{fontSize:10,color:T.faint,marginTop:2}},"期間："+r.period)),
                ce(Tag,{c:r.status==="可匯出"?"sage":"gray"},r.status)),
              r.status==="可匯出"&&ce(Btn,{sz:"sm",v:"sage",style:{marginTop:8},onClick:function(){props.setToastExt&&props.setToastExt("白皮書匯出功能：正式後端上線後提供PDF下載");}},
                "📥 匯出報告"));
          })))));
}

// ── MANUAL SCREEN ─────────────────────────────────────────────────────────────
function ManualScreen(props){
  var session=props.session;
  var role=session&&session.role;
  var[tab,setTab]=useState("roles");
  var TABS=[
    {k:"roles",l:"角色說明"},
    {k:"new_case",l:"新案開通"},
    {k:"settle",l:"月結流程"},
    {k:"comm",l:"分潤規則"},
    {k:"faq",l:"常見問題"},
    {k:"emergency",l:"緊急操作"}
  ];
  var roleRows=[
    {r:"🔑 超級管理員",perms:"全功能，唯一可執行開通、修改方案、生成代號密碼"},
    {r:"💰 財務管理員",perms:"建置/維護新案資料、付款時程、分潤查帳、授權管理檢視、個人訂閱審核、報表"},
    {r:"📊 數據分析師",perms:"大數據HPI分析、點線面、趨勢報告、白皮書匯出，不含財務"},
    {r:"📅 客服管理員",perms:"服務工單、排程確認、LINE推播、服務申請回覆、個人訂閱審核、報表"},
    {r:"🤝 主經銷商",perms:"查看自己的企業/付款/佣金，次級管理，服務申請提交"},
    {r:"🤝 次級經銷商",perms:"查看自己的企業/付款/佣金，服務申請提交"}
  ];
  var faqList=[
    {q:"忘記PIN怎麼辦？",a:"請聯絡超級管理員，超管可至「系統設定」重設各角色PIN。超管本身忘記PIN請聯絡麗媚技術支援。"},
    {q:"orgCode格式是什麼？",a:"企業：ORG-[縮寫]-[年份]-[序號]，例：ORG-TSMC-25-001。經銷商：PTN-[縮寫]-[年份]-[序號]。"},
    {q:"企業登入主平台需要什麼？",a:"orgCode(單位代碼)+ 初始PIN(開通時生成，72小時有效)。首次登入後強制設定正式PIN。"},
    {q:"分潤計算何時更新？",a:"每月30日自動彙整，隔月10日對帳，隔月15日匯款。手動調整需附說明由超管或財務操作。"},
    {q:"帳號警示90%如何處理？",a:"聯繫超級管理員，在企業管理中修改方案等級或增加授權人數，並透過LINE通知企業管理者。"},
    {q:"次級經銷商如何核准？",a:"由主經銷商提出申請，超管在「經銷商管理」中建立次級，設定隸屬主經銷商後生效。"},
    {q:"D層環境佈置費如何計算？",a:"選配項目，現場勘查後3-7工作日提供正式報價。平台顯示估算範圍僅供參考。"},
    {q:"LINE推播怎麼實際發送？",a:"目前為模擬記錄，正式後端上線後串接LINE Messaging API自動發送。現階段請複製訊息手動發至@reibicare。"},
    {q:"合約到期沒有續約怎麼辦？",a:"在授權管理中將企業狀態改為「暫停」，LINE通知企業管理者，並追蹤續約進度。"},
    {q:"大數據分析的資料來自哪裡？",a:"目前為模擬示範數據，正式後端上線後串接主平台真實評估資料(去識別化後)。"}
  ];
  return ce("div",{style:{display:"grid",gap:12}},
    ce("div",{style:{display:"flex",gap:4,flexWrap:"wrap"}},
      TABS.map(function(t){
        return ce("button",{key:t.k,onClick:function(){setTab(t.k);},
          style:{padding:"6px 12px",border:"none",borderRadius:20,cursor:"pointer",fontWeight:700,fontSize:11,fontFamily:"inherit",
            background:tab===t.k?T.teal:"transparent",color:tab===t.k?"#fff":T.muted,
            border:"1px solid "+(tab===t.k?T.teal:T.border)}},t.l);
      })),
    tab==="roles"&&ce(Card,null,
      ce(SecTitle,null,"角色權限說明"),
      ce("div",{style:{display:"grid",gap:8}},
        roleRows.map(function(r){
          return ce("div",{key:r.r,style:{padding:"10px 12px",background:T.bg,borderRadius:8}},
            ce("div",{style:{fontWeight:700,fontSize:13,color:T.teal,marginBottom:4}},r.r),
            ce("div",{style:{fontSize:12,color:T.text,lineHeight:1.6}},r.perms));
        })),
      ce(IBox,{c:"amber",style:{marginTop:8}},"所有操作均記錄於稽核日誌，不可篡改。")),
    tab==="new_case"&&ce(Card,null,
      ce(SecTitle,null,"新案開通三步驟"),
      ce("div",{style:{display:"grid",gap:12}},
        [{step:"Step 1",title:"企業基本資料",who:"財務或超管",items:["企業名稱、聯絡人、電話、Email","方案等級(基本/成長/專業/旗艦)","接案經銷商代碼(如有)","授權人數上限","合約起迄日","麗媚負責顧問"]},
         {step:"Step 2",title:"B層設備配置",who:"財務或超管",items:["雲朵床/樂活椅/LA200 數量 ± 調整","即時計算B層費用(可依實際調整)"]},
         {step:"Step 2b",title:"D層環境佈置(選配)",who:"財務或超管",items:["勾選：海報/公告欄/數位看板/QR Code/設備展示/施工","套組估算(正式報價需現場勘查3-7工作日)"]},
         {step:"Step 2c",title:"C層 高管健促服務費",who:"財務或超管",items:["服務人數(高管/主管層)","年服務費用(依實際報價)","服務方案說明(選填)","與A層同期年繳推薦"]},
         {step:"Step 3",title:"付款方式確認",who:"財務或超管",items:["年繳(-5%)/ 半年繳 / 季繳(+3%)","四層費用總覽確認","財務完成後通知超管執行開通"]},
         {step:"🚀 執行開通",title:"生成代號密碼",who:"僅超管可執行",items:["自動生成 orgCode、initPin、backupCode","自動生成 memberPin、deptPin、adminPin","一鍵LINE推播開通通知給企業聯絡人"]}].map(function(s){
          return ce(Card,{key:s.step,style:{padding:"12px 14px",borderLeft:"3px solid "+(s.step==="🚀 執行開通"?T.amber:T.teal)}},
            ce("div",{style:{fontWeight:700,fontSize:13,color:s.step==="🚀 執行開通"?T.amber:T.teal}},s.step+" — "+s.title),
            ce("div",{style:{fontSize:11,color:T.muted,marginBottom:6}},"執行人："+s.who),
            s.items.map(function(item){return ce("div",{key:item,style:{fontSize:12,color:T.text,padding:"2px 0"}},"• "+item);}));
        }))),
    tab==="settle"&&ce(Card,null,
      ce(SecTitle,null,"月結流程時程"),
      ce("div",{style:{display:"grid",gap:10}},
        [{d:"每月30日",t:"系統彙整",desc:"自動計算當月A層分潤，財務管理員確認明細。",c:T.teal},
         {d:"隔月10日",t:"對帳確認",desc:"財務管理員完成對帳，標記「已對帳」，如有疑義在此期間溝通。",c:T.amber},
         {d:"隔月15日",t:"匯款通知",desc:"執行匯款，一鍵LINE通知主經銷商與次經銷商(含明細)。次經銷商與主經銷商的分潤由系統依等級差額制自動算好，不需主經銷商自行分配。",c:T.sage}].map(function(s){
          return ce("div",{key:s.d,style:{display:"flex",gap:12,padding:"10px 12px",background:T.bg,borderRadius:8}},
            ce("div",{style:{width:70,flexShrink:0,fontWeight:800,fontSize:12,color:s.c}},s.d),
            ce("div",null,
              ce("div",{style:{fontWeight:700,fontSize:13,color:T.text,marginBottom:2}},s.t),
              ce("div",{style:{fontSize:12,color:T.muted,lineHeight:1.6}},s.desc)));
        })),
      ce(IBox,{c:"amber",style:{marginTop:8}},"B層設備費(含LA200)不計入年累積業績(不影響等級升級)，但計入佣金。次經銷商全額拿自己等級的%，主經銷商拿「自己等級%－次經銷商等級%」的差額，由calcDistComm自動計算，不需人工分配。")),
    tab==="comm"&&ce(Card,null,
      ce(SecTitle,null,"分潤計算規則"),
      ce(IBox,{c:"navy",style:{marginBottom:12}},"v2.6起：A/B/C三層各自依等級%計算，互不影響。LA200已併入B層設備一起計算(不再獨立算底價保護)。護欄機制：每層分潤%皆不得超過(100-REIBI保留下限%)，預設保留下限65%。"),
      ce("div",{style:{display:"grid",gap:8}},
        [{l:"A層軟體",r:"銀8% / 金14% / 白金20% / 戰略28%",note:"計入年累積業績(升級門檻計算基礎)"},
         {l:"B層設備(含LA200)",r:"銀10% / 金15% / 白金20% / 戰略28%",note:"不計入年累積業績，但計入佣金"},
         {l:"C層高管服務",r:"銀5% / 金8% / 白金12% / 戰略18%",note:"不計入年累積業績，但計入佣金"}].map(function(item){
          return ce("div",{key:item.l,style:{padding:"10px 12px",background:T.bg,borderRadius:8}},
            ce("div",{style:{display:"flex",justifyContent:"space-between",marginBottom:4}},
              ce("span",{style:{fontWeight:700,fontSize:12,color:T.text}},item.l),
              ce("span",{style:{fontSize:12,color:T.teal,fontWeight:700}},item.r)),
            ce("div",{style:{fontSize:11,color:T.muted}},item.note));
        })),
      ce(IBox,{c:"teal",style:{marginTop:8}},"等級升級門檻(年累積A+C層簽約額)：銀牌首筆起 → 金牌>=800萬 → 白金>=2,000萬 → 戰略>=5,000萬(另議)")),
    tab==="faq"&&ce(Card,null,
      ce(SecTitle,null,"常見問題 FAQ"),
      ce("div",{style:{display:"grid",gap:8}},
        faqList.map(function(f,i){
          return ce("div",{key:i,style:{padding:"10px 12px",background:T.bg,borderRadius:8}},
            ce("div",{style:{fontWeight:700,fontSize:12,color:T.teal,marginBottom:4}},"Q"+(i+1)+". "+f.q),
            ce("div",{style:{fontSize:12,color:T.text,lineHeight:1.6}},"A："+f.a));
        }))),
    tab==="emergency"&&ce(Card,null,
      ce(SecTitle,null,"緊急操作指引"),
      ce(IBox,{c:"red",style:{marginBottom:12}},"緊急操作前請確認授權，所有操作均記錄稽核日誌，不可逆操作需書面授權。"),
      ce("div",{style:{display:"grid",gap:10}},
        [{t:"企業PIN遺失",s:"企業管理者至主平台使用備用碼重設PIN。備用碼也遺失→企業管理者Email申請→超管強制清除→企業重設。",c:T.amber},
         {t:"緊急暫停企業授權",s:"企業管理 → 選擇企業 → 修改狀態為「暫停」→ LINE通知企業管理者。",c:T.coral},
         {t:"L5角色PIN重設",s:"超管登入後至「系統設定」重設指定角色PIN。超管自身PIN遺失請聯絡麗媚技術支援。",c:T.red},
         {t:"緊急聯絡窗口",s:"LINE：@reibicare(09:00-18:00 週一至週五)\nEmail：reibiservice@gmail.com",c:T.teal}].map(function(item){
          return ce("div",{key:item.t,style:{padding:"10px 12px",borderLeft:"3px solid "+item.c,background:T.bg,borderRadius:8}},
            ce("div",{style:{fontWeight:700,fontSize:12,color:item.c,marginBottom:4}},item.t),
            ce("div",{style:{fontSize:12,color:T.text,lineHeight:1.6,whiteSpace:"pre-line"}},item.s));
        }))));
}

// ── REPORTS SCREEN ────────────────────────────────────────────────────────────
function ReportsScreen(props){
  var session=props.session;
  var role=session&&session.role;
  var[enterprises,setEnterprises]=useState([]);
  var[distributors,setDistributors]=useState([]);
  var[tickets,setTickets]=useState([]);
  var[paymentLedger,setPaymentLedger]=useState([]);
  var[commLedger,setCommLedger]=useState([]);
  var[personalSubs,setPersonalSubs]=useState([]);
  var[dateStart,setDateStart]=useState("");
  var[dateEnd,setDateEnd]=useState("");
  var[activeRpt,setActiveRpt]=useState("revenue_overview");
  var[selEntId,setSelEntId]=useState("");
  var[toast,setToast]=useState("");

  var PLAN_PRICES={"基本":600000,"成長":1200000,"專業":1800000,"旗艦":3000000};
  var LEVELS=L5_COMM_LEVELS;

  useEffect(function(){
    stor.g("l5_enterprises").then(function(d){if(d)setEnterprises(JSON.parse(d));});
    stor.g("l5_distributors").then(function(d){if(d)setDistributors(JSON.parse(d));});
    stor.g("l5_tickets").then(function(d){if(d)setTickets(JSON.parse(d));});
    stor.g("l5_payment_ledger").then(function(d){if(d)setPaymentLedger(JSON.parse(d));});
    stor.g("l5_commission_ledger").then(function(d){if(d)setCommLedger(JSON.parse(d));});
    stor.g("l5_personal_subs").then(function(d){if(d)setPersonalSubs(JSON.parse(d));});
  },[]);

  var filterByDate=function(list,field){
    return list.filter(function(item){
      var d=item[field]||"";
      return (!dateStart||d>=dateStart)&&(!dateEnd||d<=dateEnd);
    });
  };

  var RPTS=[
    {k:"revenue_overview",l:"💰 企業+個人訂閱營收總覽",grp:"總覽",show:hasPerm(role,"all")||hasPerm(role,"reports")},
    {k:"ent_statement",l:"🧾 企業對帳單",grp:"應收類(企業→REIBI)",show:hasPerm(role,"all")||hasPerm(role,"payment")||hasPerm(role,"reports")},
    {k:"plan_status",l:"📋 企業方案狀態總覽",grp:"應收類(企業→REIBI)",show:hasPerm(role,"all")||hasPerm(role,"reports")},
    {k:"payment_track",l:"💳 付款時程追蹤表",grp:"應收類(企業→REIBI)",show:hasPerm(role,"all")||hasPerm(role,"payment")||hasPerm(role,"reports")},
    {k:"monthly_recon",l:"🧾 月結對帳總表",grp:"應收類(企業→REIBI)",show:hasPerm(role,"all")||hasPerm(role,"payment")||hasPerm(role,"reports")},
    {k:"acc_alert",l:"⚠ 帳號警示報告",grp:"應收類(企業→REIBI)",show:hasPerm(role,"all")||hasPerm(role,"enterprise")||hasPerm(role,"reports")},
    {k:"comm_detail",l:"💹 月結分潤明細表",grp:"應付類(REIBI→經銷商)",show:hasPerm(role,"all")||hasPerm(role,"distributor")||hasPerm(role,"reports")},
    {k:"dist_perf",l:"🤝 經銷商業績彙整",grp:"應付類(REIBI→經銷商)",show:hasPerm(role,"all")||hasPerm(role,"distributor")||hasPerm(role,"reports")},
    {k:"ticket_log",l:"📅 服務工單記錄",grp:"其他",show:hasPerm(role,"all")||hasPerm(role,"tickets")||hasPerm(role,"reports")}
  ].filter(function(r){return r.show;});

  var rptEnts=filterByDate(enterprises,"contractStart");
  var rptTks=filterByDate(tickets,"createdAt");
  // v2.2新增：個人訂閱(B2C)已核准記錄，依approvedAt套用同一組日期篩選(與其他報表一致的篩選邏輯)
  var rptPSubs=filterByDate(personalSubs.filter(function(r){return r.status==="已核准";}),"approvedAt");

  var renderRevenueOverview=function(){
    var entRev=rptEnts.reduce(function(a,e){return a+(PLAN_PRICES[e.plan||"基本"]||0);},0);
    var psubRev=rptPSubs.reduce(function(a,r){return a+(parseInt(r.amount)||0);},0);
    var pendingCount=personalSubs.filter(function(r){return r.status==="待審核";}).length;
    var byPlanPSub={};
    rptPSubs.forEach(function(r){byPlanPSub[r.plan]=(byPlanPSub[r.plan]||0)+(parseInt(r.amount)||0);});
    return ce("div",{style:{display:"grid",gap:12}},
      ce(IBox,{c:"navy"},"本報表彙整「企業契約(A層授權費，B2B)」與「個人訂閱(B2C)」兩條營收線，方便一次掌握全貌。⚠ 兩者計算基礎不同：企業年收預估為依方案定價之推估值；個人訂閱為已核准記錄之實收金額。個人訂閱不透過經銷商分潤(經銷商分潤僅計算企業A/B層費用)，詳見「💹月結分潤明細表」。"),
      ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}},
        [{l:"企業年收預估(B2B)",v:"NT$"+(entRev/10000).toFixed(0)+"萬",c:T.teal,sub:rptEnts.length+"家企業"},
         {l:"個人訂閱已核准收款(B2C)",v:"NT$"+psubRev.toLocaleString(),c:T.gold,sub:rptPSubs.length+"筆已核准 · "+pendingCount+"筆待審核"}].map(function(k){
          return ce(Card,{key:k.l,style:{padding:"14px 16px"}},
            ce("div",{style:{fontSize:22,fontWeight:800,color:k.c}},k.v),
            ce("div",{style:{fontSize:11,color:T.muted,marginTop:4}},k.l),
            ce("div",{style:{fontSize:10,color:T.faint,marginTop:2}},k.sub));
        })),
      ce(Card,{style:{padding:"12px 14px",background:"linear-gradient(135deg,"+T.navyBg+",#fff)"}},
        ce("div",{style:{fontSize:11,color:T.muted}},"企業+個人訂閱 營收合計(僅供參考，基期不同不宜直接視為同一性質總額)"),
        ce("div",{style:{fontSize:24,fontWeight:800,color:T.navy}},"NT$"+((entRev+psubRev)/10000).toFixed(1)+"萬")),
      rptPSubs.length>0&&ce(Card,null,
        ce(SecTitle,null,"個人訂閱方案分布(已核准)"),
        Object.keys(byPlanPSub).map(function(pk){
          var planDef=PERSONAL_SUB_PLANS.find(function(p){return p.k===pk;})||{label:pk};
          var amt=byPlanPSub[pk];
          var pct=psubRev>0?Math.round((amt/psubRev)*100):0;
          return ce("div",{key:pk,style:{marginBottom:10}},
            ce("div",{style:{display:"flex",justifyContent:"space-between",marginBottom:4}},
              ce("span",{style:{fontSize:12,fontWeight:700,color:T.text}},planDef.label),
              ce("span",{style:{fontSize:12,color:T.amber,fontWeight:700}},"NT$"+amt.toLocaleString())),
            ce("div",{style:{height:8,background:T.bg,borderRadius:4,overflow:"hidden"}},
              ce("div",{style:{height:"100%",width:pct+"%",background:T.gold,borderRadius:4}})),
            ce("div",{style:{fontSize:10,color:T.muted,marginTop:2}},pct+"%"));
        })));
  };

  var renderEntStatement=function(){
    var ent=enterprises.find(function(e){return e.id===selEntId;});
    var picker=ce(Card,null,
      ce(SecTitle,null,"選擇企業"),
      ce(Select,{value:selEntId,onChange:function(e){setSelEntId(e.target.value);}},
        ce("option",{value:""},"請選擇企業…"),
        enterprises.slice().sort(function(a,b){return (a.orgName||"").localeCompare(b.orgName||"");}).map(function(e){
          return ce("option",{key:e.id,value:e.id},e.orgName+"("+e.orgCode+")");
        })));
    if(!ent){
      return ce("div",{style:{display:"grid",gap:12}},
        ce(IBox,{c:"navy",style:{fontSize:11}},"選擇一家企業，產生該企業完整的A/B/C/D層每月應收帳款對帳單(含歷史對帳沖帳記錄)，可複製後貼給企業窗口或財務用印附件。"),
        picker,
        enterprises.length===0&&ce(Card,{style:{textAlign:"center",padding:32,color:T.muted}},"尚無企業資料"));
    }
    var rows=buildEntPaymentRows(ent);
    var totalDue=rows.reduce(function(a,r){return a+r.amount;},0);
    var paidRows=rows.filter(function(r){return r.status==="已付款";});
    var unpaidRows=rows.filter(function(r){return r.status!=="已付款"&&r.status!=="未到期";});
    var overdueRows=rows.filter(function(r){return r.dueDate&&new Date(r.dueDate)<new Date()&&r.status!=="已付款"&&r.status!=="未到期";});
    var totalPaid=paidRows.reduce(function(a,r){return a+r.amount;},0);
    var totalUnpaid=unpaidRows.reduce(function(a,r){return a+r.amount;},0);
    var history=paymentLedger.filter(function(l){return l.entId===ent.id;}).sort(function(a,b){return (b.reviewedAt||"").localeCompare(a.reviewedAt||"");});
    var copyStatement=function(){
      var lines=[];
      lines.push("【REIBI 企業應收帳款對帳單】"+ent.orgName+"("+ent.orgCode+") · 產製日："+new Date().toLocaleDateString("zh-TW"));
      lines.push("方案："+(ent.plan||"基本")+" · 合約期間："+(ent.contractStart||"-")+" ~ "+(ent.contractEnd||"-"));
      lines.push("");
      lines.push("── 應收項目明細 ──");
      rows.forEach(function(r){
        lines.push("["+r.layer+"] "+r.desc+" NT$"+r.amount.toLocaleString()+" · 到期："+(r.dueDate||"-")+" · 狀態："+r.status);
      });
      lines.push("");
      lines.push("應收總額：NT$"+totalDue.toLocaleString()+" ／ 已付：NT$"+totalPaid.toLocaleString()+" ／ 待付(含逾期)：NT$"+totalUnpaid.toLocaleString());
      if(history.length>0){
        lines.push("");
        lines.push("── 歷史對帳沖帳記錄 ──");
        history.forEach(function(l){
          lines.push((l.reviewedAt||"").slice(0,10)+" 沖帳NT$"+(l.claimedAmount||0).toLocaleString()+" / 應付NT$"+(l.totalDueAmount||0).toLocaleString()+
            (l.isMismatch?"(差額NT$"+(l.diffAmount||0).toLocaleString()+")":"(金額相符)")+" · 覆核："+(l.reviewedBy||"-"));
        });
      }
      var text=lines.join("\n");
      if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text);setToast("已複製「"+ent.orgName+"」對帳單");}
      else window.prompt("請手動複製：",text);
    };
    return ce("div",{style:{display:"grid",gap:12}},
      picker,
      ce(Card,{style:{borderLeft:"4px solid "+T.teal}},
        ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}},
          ce("div",null,
            ce("div",{style:{fontSize:16,fontWeight:800,color:T.text}},ent.orgName),
            ce("div",{style:{fontSize:11,color:T.muted}},ent.orgCode+" · "+(ent.plan||"基本")+"方案 · 合約："+(ent.contractStart||"-")+" ~ "+(ent.contractEnd||"-"))),
          ce(Btn,{sz:"sm",v:"teal",onClick:copyStatement},"📋 複製對帳單"))),
      ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}},
        [{l:"應收總額",v:totalDue,c:T.navy},{l:"已付金額",v:totalPaid,c:T.sage},{l:"待付(含逾期)",v:totalUnpaid,c:overdueRows.length>0?T.red:T.amber}].map(function(k){
          return ce(Card,{key:k.l,style:{padding:"10px 14px"}},
            ce("div",{style:{fontSize:11,color:T.muted}},k.l),
            ce("div",{style:{fontSize:16,fontWeight:800,color:k.c}},"NT$"+k.v.toLocaleString()));
        })),
      overdueRows.length>0&&ce(IBox,{c:"red"},"⚠ 有 "+overdueRows.length+" 筆項目已逾期未付款，請儘速跟進。"),
      ce(Card,null,
        ce(SecTitle,null,"應收項目明細(A/B/C/D層)"),
        ce("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:11}},
          ce("thead",null,ce("tr",{style:{background:T.bg}},
            ["層級","項目","金額","到期日","狀態"].map(function(h){
              return ce("th",{key:h,style:{padding:"6px 8px",textAlign:"left",color:T.muted,fontWeight:700,borderBottom:"1px solid "+T.border}},h);
            }))),
          ce("tbody",null,
            rows.map(function(r){
              var isOv=r.dueDate&&new Date(r.dueDate)<new Date()&&r.status!=="已付款"&&r.status!=="未到期";
              return ce("tr",{key:r.id,style:{borderBottom:"1px solid "+T.border,background:isOv?T.redBg:"transparent"}},
                ce("td",{style:{padding:"6px 8px",color:T.navy,fontWeight:700}},r.layer),
                ce("td",{style:{padding:"6px 8px",color:T.text}},r.desc),
                ce("td",{style:{padding:"6px 8px",fontWeight:700,color:T.amber}},"NT$"+r.amount.toLocaleString()),
                ce("td",{style:{padding:"6px 8px",color:isOv?T.red:T.muted}},r.dueDate||"-"),
                ce("td",{style:{padding:"6px 8px"}},
                  ce("span",{style:{padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,
                    background:r.status==="已付款"?T.sageBg:isOv?T.redBg:T.amberBg,
                    color:r.status==="已付款"?T.sage:isOv?T.red:T.amber}},r.status)));
            })))),
      ce(Card,null,
        ce(SecTitle,null,"歷史對帳沖帳記錄"),
        history.length===0?ce("div",{style:{textAlign:"center",padding:20,color:T.muted,fontSize:12}},"尚無沖帳記錄"):
        ce("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:11}},
          ce("thead",null,ce("tr",{style:{background:T.bg}},
            ["審核日","沖帳金額","應付金額","差額","覆核人","狀態"].map(function(h){
              return ce("th",{key:h,style:{padding:"6px 8px",textAlign:"left",color:T.muted,fontWeight:700,borderBottom:"1px solid "+T.border}},h);
            }))),
          ce("tbody",null,
            history.map(function(l){
              return ce("tr",{key:l.id,style:{borderBottom:"1px solid "+T.border,background:l.isMismatch?T.redBg:"transparent"}},
                ce("td",{style:{padding:"6px 8px",color:T.muted}},(l.reviewedAt||"").slice(0,10)),
                ce("td",{style:{padding:"6px 8px",color:T.text}},"NT$"+(l.claimedAmount||0).toLocaleString()),
                ce("td",{style:{padding:"6px 8px",color:T.muted}},"NT$"+(l.totalDueAmount||0).toLocaleString()),
                ce("td",{style:{padding:"6px 8px",fontWeight:700,color:l.diffAmount===0?T.sage:T.red}},(l.diffAmount>0?"+":"")+"NT$"+(l.diffAmount||0).toLocaleString()),
                ce("td",{style:{padding:"6px 8px",color:T.muted}},l.reviewedBy||"-"),
                ce("td",{style:{padding:"6px 8px"}},l.isMismatch?(l.diffAmount<0?"部分付款":"金額不符"):"已沖帳"));
            })))));
  };

  var renderPlanStatus=function(){
    var byPlan={"基本":[],"成長":[],"專業":[],"旗艦":[]};
    rptEnts.forEach(function(e){if(byPlan[e.plan||"基本"])byPlan[e.plan||"基本"].push(e);});
    var totalRev=rptEnts.reduce(function(a,e){return a+(PLAN_PRICES[e.plan||"基本"]||0);},0);
    return ce("div",{style:{display:"grid",gap:12}},
      ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}},
        [{l:"企業總數",v:rptEnts.length},{l:"年收預估",v:"NT$"+(totalRev/10000).toFixed(0)+"萬"},
         {l:"啟用中",v:rptEnts.filter(function(e){return e.status==="啟用中";}).length},
         {l:"試用中",v:rptEnts.filter(function(e){return e.status==="試用中";}).length}].map(function(k){
          return ce(Card,{key:k.l,style:{padding:"10px 14px",textAlign:"center"}},
            ce("div",{style:{fontSize:18,fontWeight:800,color:T.teal}},k.v),
            ce("div",{style:{fontSize:11,color:T.muted,marginTop:4}},k.l));
        })),
      ce(Card,null,
        ce(SecTitle,null,"方案分布"),
        ["基本","成長","專業","旗艦"].map(function(p){
          var list=byPlan[p]||[];
          var pct=rptEnts.length>0?Math.round((list.length/rptEnts.length)*100):0;
          var rev=list.reduce(function(a,e){return a+(PLAN_PRICES[p]||0);},0);
          return ce("div",{key:p,style:{marginBottom:10}},
            ce("div",{style:{display:"flex",justifyContent:"space-between",marginBottom:4}},
              ce("span",{style:{fontSize:12,fontWeight:700,color:T.text}},p+"方案 ("+list.length+"家)"),
              ce("span",{style:{fontSize:12,color:T.amber,fontWeight:700}},"NT$"+(rev/10000).toFixed(0)+"萬")),
            ce("div",{style:{height:8,background:T.bg,borderRadius:4,overflow:"hidden"}},
              ce("div",{style:{height:"100%",width:pct+"%",background:T.teal,borderRadius:4}})),
            ce("div",{style:{fontSize:10,color:T.muted,marginTop:2}},pct+"%"));
        })),
      ce(Card,null,
        ce(SecTitle,null,"企業明細"),
        ce("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:11}},
          ce("thead",null,ce("tr",{style:{background:T.bg}},
            ["企業名稱","代碼","方案","狀態","人數","合約到期"].map(function(h){
              return ce("th",{key:h,style:{padding:"6px 8px",textAlign:"left",color:T.muted,fontWeight:700,borderBottom:"1px solid "+T.border}},h);
            }))),
          ce("tbody",null,
            rptEnts.map(function(e){
              var daysLeft=e.contractEnd?Math.ceil((new Date(e.contractEnd)-new Date())/(1000*60*60*24)):null;
              return ce("tr",{key:e.id,style:{borderBottom:"1px solid "+T.border}},
                ce("td",{style:{padding:"6px 8px",fontWeight:600,color:T.text}},e.orgName),
                ce("td",{style:{padding:"6px 8px",color:T.muted}},e.orgCode),
                ce("td",{style:{padding:"6px 8px"}},ce(PlanBadge,{plan:e.plan||"基本"})),
                ce("td",{style:{padding:"6px 8px"}},ce(StatusBadge,{status:e.status||"待啟用"})),
                ce("td",{style:{padding:"6px 8px",color:T.text}},(e.usedCount||0)+"/"+(e.memberCount||0)),
                ce("td",{style:{padding:"6px 8px",color:daysLeft!==null&&daysLeft<=30?T.amber:T.muted}},
                  e.contractEnd||"-"+(daysLeft!==null&&daysLeft<=30?" ("+daysLeft+"天)":"")));
            })))));
            
  };

  var renderPaymentTrack=function(){
    var allRows=[];
    rptEnts.forEach(function(e){
      buildEntPaymentRows(e).forEach(function(r){allRows.push(r);});
    });
    var overdue=allRows.filter(function(r){return r.dueDate&&new Date(r.dueDate)<new Date()&&r.status!=="已付款";});
    var pending=allRows.filter(function(r){return r.status==="待付款";});
    var paid=allRows.filter(function(r){return r.status==="已付款";});
    return ce("div",{style:{display:"grid",gap:12}},
      ce(IBox,{c:"navy",style:{fontSize:11}},"本表含A層(3年)/B層(3期)/C層(3年，若有簽)/D層(2期，若有簽)完整項目，與「企業管理」/「付款時程」頁面呈現一致(v2.4起統一改為共用buildEntPaymentRows)。「未到期」為尚未到繳款年度的項目，不計入逾期/待付款統計。"),
      ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}},
        [{l:"逾期未付",v:overdue.length,c:T.red},{l:"待付款",v:pending.length,c:T.amber},{l:"已付款",v:paid.length,c:T.green}].map(function(k){
          return ce(Card,{key:k.l,style:{padding:"10px",textAlign:"center"}},
            ce("div",{style:{fontSize:20,fontWeight:800,color:k.c}},k.v),
            ce("div",{style:{fontSize:11,color:T.muted,marginTop:4}},k.l));
        })),
      ce(Card,null,
        ce(SecTitle,null,"付款明細"),
        ce("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:11}},
          ce("thead",null,ce("tr",{style:{background:T.bg}},
            ["企業","層級","項目","金額","到期日","狀態"].map(function(h){
              return ce("th",{key:h,style:{padding:"6px 8px",textAlign:"left",color:T.muted,fontWeight:700,borderBottom:"1px solid "+T.border}},h);
            }))),
          ce("tbody",null,
            allRows.map(function(r,i){
              var isOv=r.dueDate&&new Date(r.dueDate)<new Date()&&r.status!=="已付款"&&r.status!=="未到期";
              return ce("tr",{key:r.id||i,style:{borderBottom:"1px solid "+T.border,background:isOv?T.redBg:"transparent"}},
                ce("td",{style:{padding:"6px 8px",fontWeight:600,color:T.text}},r.entName),
                ce("td",{style:{padding:"6px 8px",color:T.navy}},r.layer),
                ce("td",{style:{padding:"6px 8px",color:T.muted}},r.desc),
                ce("td",{style:{padding:"6px 8px",fontWeight:700,color:T.amber}},"NT$"+(r.amount/10000).toFixed(1)+"萬"),
                ce("td",{style:{padding:"6px 8px",color:isOv?T.red:T.muted}},r.dueDate||"-"),
                ce("td",{style:{padding:"6px 8px"}},
                  ce("span",{style:{padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,
                    background:r.status==="已付款"?T.sageBg:isOv?T.redBg:T.amberBg,
                    color:r.status==="已付款"?T.sage:isOv?T.red:T.amber}},r.status)));
            })))))
  };

  var renderMonthlyRecon=function(){
    var now=new Date();
    var ymNow=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0");
    var months=Array.from(new Set(paymentLedger.map(function(l){return (l.reviewedAt||"").slice(0,7);}).filter(Boolean)));
    if(!months.length)months=[ymNow];
    months.sort().reverse();
    var selMonth=dateStart?dateStart.slice(0,7):months[0];
    var monthEntries=paymentLedger.filter(function(l){return (l.reviewedAt||"").slice(0,7)===selMonth;});
    var reconciled=monthEntries.filter(function(l){return !l.isMismatch;});
    var partial=monthEntries.filter(function(l){return l.isMismatch&&l.diffAmount<0;});
    var mismatch=monthEntries.filter(function(l){return l.isMismatch&&l.diffAmount>0;});
    var totalClaimed=monthEntries.reduce(function(a,l){return a+(l.claimedAmount||0);},0);
    var totalDue=monthEntries.reduce(function(a,l){return a+(l.totalDueAmount||0);},0);
    var totalDiff=totalClaimed-totalDue;
    var copySummary=function(){
      var lines=monthEntries.map(function(l){
        return "「"+l.entName+"」沖帳NT$"+(l.claimedAmount||0).toLocaleString()+" / 應付NT$"+(l.totalDueAmount||0).toLocaleString()+
          (l.isMismatch?"(差額NT$"+l.diffAmount.toLocaleString()+")":"(金額相符)")+" · 覆核："+(l.reviewedBy||"-")+" · "+(l.reviewedAt||"").slice(0,10);
      });
      var text="【REIBI 月結對帳總表 "+selMonth+"】共"+monthEntries.length+"筆，已沖帳"+reconciled.length+"／部分付款"+partial.length+"／金額不符"+mismatch.length+"\n總沖帳金額NT$"+totalClaimed.toLocaleString()+" / 總應付NT$"+totalDue.toLocaleString()+" / 差額NT$"+totalDiff.toLocaleString()+"\n\n"+lines.join("\n");
      if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text);setToast("已複製"+selMonth+"月結對帳總表");}
      else window.prompt("請手動複製：",text);
    };
    return ce("div",{style:{display:"grid",gap:12}},
      ce(IBox,{c:"amber"},"【企業端 A/B/C/D層應收款】月結時程：每月30日彙整本月對帳申請 → 隔月10日完成對帳 → 隔月15日完成匯款。本表彙整 l5_payment_ledger 中所有「審核沖帳」軌跡，依審核月份分組。經銷商分潤應付款請見「💹 月結分潤明細表」(資料來源為 l5_commission_ledger，沖帳對象與本表不同)。"),
      ce("div",{style:{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}},
        ce("span",{style:{fontSize:12,color:T.muted,fontWeight:600}},"選擇月份："),
        months.map(function(m){
          return ce("button",{key:m,onClick:function(){setDateStart(m+"-01");},
            style:{padding:"4px 12px",borderRadius:20,border:"1px solid "+(selMonth===m?T.teal:T.border),
              fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
              background:selMonth===m?T.teal:"transparent",color:selMonth===m?"#fff":T.muted}},m);
        }),
        ce(Btn,{sz:"sm",v:"amber",onClick:copySummary},"📋 複製本月總表")),
      ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}},
        [{l:"申請總數",v:monthEntries.length,c:T.navy},
         {l:"已沖帳",v:reconciled.length,c:T.sage},
         {l:"部分付款",v:partial.length,c:T.amber},
         {l:"金額不符",v:mismatch.length,c:T.red}].map(function(k){
          return ce(Card,{key:k.l,style:{padding:"10px",textAlign:"center"}},
            ce("div",{style:{fontSize:20,fontWeight:800,color:k.c}},k.v),
            ce("div",{style:{fontSize:11,color:T.muted,marginTop:4}},k.l));
        })),
      ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}},
        [{l:"本月沖帳總額",v:totalClaimed,c:T.teal},
         {l:"本月應付總額",v:totalDue,c:T.navy},
         {l:"總差額",v:totalDiff,c:totalDiff===0?T.sage:T.red}].map(function(k){
          return ce(Card,{key:k.l,style:{padding:"10px 14px"}},
            ce("div",{style:{fontSize:11,color:T.muted}},k.l),
            ce("div",{style:{fontSize:16,fontWeight:800,color:k.c}},"NT$"+k.v.toLocaleString()));
        })),
      monthEntries.length===0?ce(Card,{style:{textAlign:"center",padding:32,color:T.muted}},"本月份無沖帳記錄"):
      ce(Card,null,
        ce(SecTitle,null,selMonth+" 沖帳明細(共"+monthEntries.length+"筆)"),
        ce("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:11}},
          ce("thead",null,ce("tr",{style:{background:T.bg}},
            ["企業","沖帳金額","應付金額","差額","覆核人","審核時間","狀態"].map(function(h){
              return ce("th",{key:h,style:{padding:"6px 8px",textAlign:"left",color:T.muted,fontWeight:700,borderBottom:"1px solid "+T.border}},h);
            }))),
          ce("tbody",null,
            monthEntries.map(function(l){
              return ce("tr",{key:l.id,style:{borderBottom:"1px solid "+T.border,background:l.isMismatch?T.redBg:"transparent"}},
                ce("td",{style:{padding:"6px 8px",fontWeight:600,color:T.text}},l.entName),
                ce("td",{style:{padding:"6px 8px",color:T.text}},"NT$"+(l.claimedAmount||0).toLocaleString()),
                ce("td",{style:{padding:"6px 8px",color:T.muted}},"NT$"+(l.totalDueAmount||0).toLocaleString()),
                ce("td",{style:{padding:"6px 8px",fontWeight:700,color:l.diffAmount===0?T.sage:T.red}},
                  (l.diffAmount>0?"+":"")+"NT$"+(l.diffAmount||0).toLocaleString()),
                ce("td",{style:{padding:"6px 8px",color:T.muted}},l.reviewedBy||"-"),
                ce("td",{style:{padding:"6px 8px",color:T.muted}},(l.reviewedAt||"").slice(0,10)),
                ce("td",{style:{padding:"6px 8px"}},
                  ce("span",{style:{padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,
                    background:l.isMismatch?T.redBg:T.sageBg,color:l.isMismatch?T.red:T.sage}},
                    l.isMismatch?(l.diffAmount<0?"部分付款":"金額不符"):"已沖帳")));
            })))));
  };

  var renderCommDetail=function(){
    var thisYM=function(){var n=new Date();return n.getFullYear()+"-"+String(n.getMonth()+1).padStart(2,"0");};
    var selMonth=dateStart?dateStart.slice(0,7):thisYM();
    var rows=distributors.map(function(d){
      var lv=LEVELS[d.level||"silver"];
      var myEnts=enterprises.filter(function(e){return e.partnerCode===d.orgCode;});
      var comm=calcDistComm(d,enterprises);
      var theoretical=comm.total;
      var ledgerEntry=commLedger.find(function(l){return l.distId===d.id&&l.month===selMonth;});
      return {name:d.name,code:d.orgCode,level:lv.l,entCount:myEnts.length,soft:comm.soft,device:comm.device,exec:comm.exec,
        theoretical:theoretical,override:d.commOverride||null,overrideBy:d.commOverrideBy||"",
        confirmed:ledgerEntry?ledgerEntry.amount:null,status:ledgerEntry?ledgerEntry.status:"尚未確認",confirmedAt:ledgerEntry?ledgerEntry.confirmedAt:null};
    });
    var grandTotalConfirmed=rows.filter(function(r){return r.confirmed!==null;}).reduce(function(a,r){return a+r.confirmed;},0);
    var grandTotalTheoretical=rows.reduce(function(a,r){return a+(r.override||r.theoretical);},0);
    var unconfirmedCount=rows.filter(function(r){return r.status==="尚未確認";}).length;
    return ce("div",{style:{display:"grid",gap:12}},
      ce(Card,{style:{padding:"12px 14px",background:"linear-gradient(135deg,"+T.navyBg+",#fff)"}},
        ce("div",{style:{fontSize:11,color:T.muted}},selMonth+" 已確認出帳合計"),
        ce("div",{style:{fontSize:24,fontWeight:800,color:T.navy}},"NT$"+(grandTotalConfirmed/10000).toFixed(1)+"萬"),
        ce("div",{style:{fontSize:11,color:T.muted,marginTop:4}},"共 "+rows.length+" 位經銷商 · 理論應付合計 NT$"+(grandTotalTheoretical/10000).toFixed(1)+"萬")),
      unconfirmedCount>0&&ce(IBox,{c:"amber"},"⚠ 本月尚有 "+unconfirmedCount+" 位經銷商分潤未確認出帳，請至「經銷商管理」逐一確認。"),
      ce(IBox,{c:"navy"},"【經銷商端分潤應付款】月結時程：30日彙整 → 隔月10日對帳 → 隔月15日匯款。「理論應付」= A層軟體+B層設備(含LA200)+C層顧問服務，三層各自依等級%計算，與「經銷商管理」頁面試算公式一致(v2.6起統一改為共用calcDistComm)。本表「已確認金額」彙整自 l5_commission_ledger 出帳確認軌跡，正式請款金額以已確認出帳記錄為準。企業A/B/C/D層應收款請見「🧾 月結對帳總表」(資料來源為 l5_payment_ledger，沖帳對象與本表不同)。"),
      ce(Card,null,
        ce(SecTitle,null,selMonth+" 分潤明細"),
        ce("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:11}},
          ce("thead",null,ce("tr",{style:{background:T.bg}},
            ["經銷商","等級","管理企業","理論應付","已確認金額","狀態","確認時間"].map(function(h){
              return ce("th",{key:h,style:{padding:"6px 8px",textAlign:"left",color:T.muted,fontWeight:700,borderBottom:"1px solid "+T.border}},h);
            }))),
          ce("tbody",null,
            rows.length===0?ce("tr",null,ce("td",{colSpan:7,style:{padding:20,textAlign:"center",color:T.muted}},"尚無經銷商資料")):
            rows.map(function(r){
              return ce("tr",{key:r.code,style:{borderBottom:"1px solid "+T.border,background:r.status==="尚未確認"?T.amberBg:"transparent"}},
                ce("td",{style:{padding:"6px 8px",fontWeight:600,color:T.text}},r.name),
                ce("td",{style:{padding:"6px 8px",color:T.navy,fontWeight:700}},r.level),
                ce("td",{style:{padding:"6px 8px",color:T.muted}},r.entCount+"家"),
                ce("td",{style:{padding:"6px 8px",color:T.muted}},"NT$"+((r.override||r.theoretical)/10000).toFixed(1)+"萬"+(r.override?" ⚠":"")),
                ce("td",{style:{padding:"6px 8px",fontWeight:800,color:r.confirmed!==null?T.sage:T.faint}},r.confirmed!==null?"NT$"+(r.confirmed/10000).toFixed(1)+"萬":"—"),
                ce("td",{style:{padding:"6px 8px"}},
                  ce("span",{style:{padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,
                    background:r.status==="已匯款"?T.sageBg:r.status==="已確認待匯款"?T.tealBg:T.amberBg,
                    color:r.status==="已匯款"?T.sage:r.status==="已確認待匯款"?T.teal:T.amber}},r.status)),
                ce("td",{style:{padding:"6px 8px",color:T.muted}},r.confirmedAt?r.confirmedAt.slice(0,10):"-"));
            })))));
  };

  var renderTicketLog=function(){
    var byType={};
    rptTks.forEach(function(t){byType[t.type]=(byType[t.type]||0)+1;});
    var byStatus={};
    rptTks.forEach(function(t){byStatus[t.status]=(byStatus[t.status]||0)+1;});
    return ce("div",{style:{display:"grid",gap:12}},
      ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}},
        [{l:"工單總數",v:rptTks.length,c:T.navy},{l:"已完成",v:byStatus["已完成"]||0,c:T.sage},
         {l:"處理中",v:byStatus["處理中"]||0,c:T.teal},{l:"待處理",v:byStatus["待處理"]||0,c:T.amber}].map(function(k){
          return ce(Card,{key:k.l,style:{padding:"10px",textAlign:"center"}},
            ce("div",{style:{fontSize:18,fontWeight:800,color:k.c}},k.v),
            ce("div",{style:{fontSize:11,color:T.muted,marginTop:4}},k.l));
        })),
      ce(Card,null,
        ce(SecTitle,null,"類型分布"),
        Object.entries(byType).map(function(entry){
          var t=entry[0];var n=entry[1];
          var pct=rptTks.length>0?Math.round((n/rptTks.length)*100):0;
          return ce("div",{key:t,style:{marginBottom:8}},
            ce("div",{style:{display:"flex",justifyContent:"space-between",marginBottom:3}},
              ce("span",{style:{fontSize:12,color:T.text}},t),ce("span",{style:{fontSize:12,fontWeight:700,color:T.muted}},n+"件 ("+pct+"%)") ),
            ce("div",{style:{height:6,background:T.bg,borderRadius:3,overflow:"hidden"}},
              ce("div",{style:{height:"100%",width:pct+"%",background:T.teal,borderRadius:3}})));
        })),
      ce(Card,null,
        ce(SecTitle,null,"工單記錄"),
        rptTks.length===0?ce("div",{style:{textAlign:"center",padding:20,color:T.muted}},"無工單記錄"):
        ce("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:11}},
          ce("thead",null,ce("tr",{style:{background:T.bg}},
            ["企業","類型","優先","狀態","建立日","處理人"].map(function(h){
              return ce("th",{key:h,style:{padding:"6px 8px",textAlign:"left",color:T.muted,fontWeight:700,borderBottom:"1px solid "+T.border}},h);
            }))),
          ce("tbody",null,
            rptTks.map(function(t){
              return ce("tr",{key:t.id,style:{borderBottom:"1px solid "+T.border}},
                ce("td",{style:{padding:"6px 8px",fontWeight:600,color:T.text}},t.entName),
                ce("td",{style:{padding:"6px 8px",color:T.muted}},t.type),
                ce("td",{style:{padding:"6px 8px",color:t.priority==="緊急"?T.red:T.amber}},t.priority),
                ce("td",{style:{padding:"6px 8px",fontWeight:700,color:t.status==="已完成"?T.sage:t.status==="處理中"?T.teal:T.amber}},t.status),
                ce("td",{style:{padding:"6px 8px",color:T.muted}},t.createdAt.slice(0,10)),
                ce("td",{style:{padding:"6px 8px",color:T.muted}},t.handler||"-"));
            })))));
  };

  var renderDistPerf=function(){
    var PLAN_P={"基本":600000,"成長":1200000,"專業":1800000,"旗艦":3000000};
    return ce("div",{style:{display:"grid",gap:12}},
      ce(IBox,{c:"navy",style:{fontSize:11}},"「分潤預估」為完整分潤試算(A層+B層設備含LA200+C層顧問服務)，與「經銷商管理」/「月結分潤明細表」採同一套calcDistComm公式，數字應一致。「年簽約額」僅計A層授權費，用於等級升級門檻判定(不含B/C層)。"),
      distributors.length===0?ce(Card,{style:{textAlign:"center",padding:32,color:T.muted}},"尚無經銷商資料"):
      ce(Card,null,
        ce(SecTitle,null,"經銷商業績彙整"),
        ce("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:11}},
          ce("thead",null,ce("tr",{style:{background:T.bg}},
            ["經銷商","等級","企業數","年簽約額","分潤預估","升級進度"].map(function(h){
              return ce("th",{key:h,style:{padding:"6px 8px",textAlign:"left",color:T.muted,fontWeight:700,borderBottom:"1px solid "+T.border}},h);
            }))),
          ce("tbody",null,
            distributors.filter(function(d){return d.type==="primary";}).map(function(d){
              var lv=LEVELS[d.level||"silver"];
              var myEnts=enterprises.filter(function(e){return e.partnerCode===d.orgCode;});
              var yearAmt=myEnts.reduce(function(a,e){return a+(e.aLayerFee||(PLAN_P[e.plan||"基本"]||0));},0);
              var comm=calcDistComm(d,enterprises);
              var nextLv=d.level==="silver"?{l:"金牌",need:8000000}:d.level==="gold"?{l:"白金",need:20000000}:null;
              var pct=nextLv?Math.min(100,Math.round((yearAmt/nextLv.need)*100)):100;
              return ce("tr",{key:d.id,style:{borderBottom:"1px solid "+T.border}},
                ce("td",{style:{padding:"6px 8px",fontWeight:600,color:T.text}},d.name),
                ce("td",{style:{padding:"6px 8px",color:T.navy,fontWeight:700}},lv.l),
                ce("td",{style:{padding:"6px 8px",color:T.muted}},myEnts.length+"家"),
                ce("td",{style:{padding:"6px 8px",fontWeight:700,color:T.amber}},"NT$"+(yearAmt/10000).toFixed(0)+"萬"),
                ce("td",{style:{padding:"6px 8px",color:T.teal}},"NT$"+(comm.total/10000).toFixed(1)+"萬"),
                ce("td",{style:{padding:"6px 8px"}},
                  nextLv?ce("div",null,
                    ce("div",{style:{fontSize:10,color:T.muted,marginBottom:2}},"距"+nextLv.l+" "+pct+"%"),
                    ce("div",{style:{height:4,background:T.bg,borderRadius:2,width:60}},
                      ce("div",{style:{height:"100%",width:pct+"%",background:pct>=100?T.sage:T.teal,borderRadius:2}}))):
                  ce(Tag,{c:"gold"},"最高等級")));
            })))));
  };

  var renderAccAlert=function(){
    var alerts=enterprises.filter(function(e){
      var used=parseInt(e.usedCount)||0;var total=parseInt(e.memberCount)||1;
      return (used/total)>=0.9;
    });
    var expiring=enterprises.filter(function(e){
      if(!e.contractEnd)return false;
      var d=(new Date(e.contractEnd)-new Date())/(1000*60*60*24);
      return d>=0&&d<=30;
    });
    var expired=enterprises.filter(function(e){
      return e.contractEnd&&new Date(e.contractEnd)<new Date();
    });
    return ce("div",{style:{display:"grid",gap:12}},
      ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}},
        [{l:"帳號>=90%",v:alerts.length,c:T.amber},{l:"30天內到期",v:expiring.length,c:T.coral},{l:"已到期",v:expired.length,c:T.red}].map(function(k){
          return ce(Card,{key:k.l,style:{padding:"10px",textAlign:"center"}},
            ce("div",{style:{fontSize:20,fontWeight:800,color:k.c}},k.v),
            ce("div",{style:{fontSize:11,color:T.muted,marginTop:4}},k.l));
        })),
      alerts.length>0&&ce(Card,null,
        ce(SecTitle,null,"帳號警示企業"),
        alerts.map(function(e){
          var used=parseInt(e.usedCount)||0;var total=parseInt(e.memberCount)||1;
          var pct=Math.round((used/total)*100);
          return ce("div",{key:e.id,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:T.amberBg,borderRadius:8,marginBottom:6,border:"1px solid #fcd34d"}},
            ce("div",null,
              ce("div",{style:{fontSize:12,fontWeight:700,color:T.text}},e.orgName),
              ce("div",{style:{fontSize:11,color:T.muted}},e.orgCode+" · "+e.plan+"方案")),
            ce("div",{style:{textAlign:"right"}},
              ce("div",{style:{fontSize:14,fontWeight:800,color:T.amber}},pct+"%"),
              ce("div",{style:{fontSize:10,color:T.muted}},used+"/"+total+"人")));
        })),
      (expiring.length>0||expired.length>0)&&ce(Card,null,
        ce(SecTitle,null,"合約到期警示"),
        expiring.concat(expired).map(function(e){
          var daysLeft=e.contractEnd?Math.ceil((new Date(e.contractEnd)-new Date())/(1000*60*60*24)):null;
          var isExp=daysLeft!==null&&daysLeft<0;
          return ce("div",{key:e.id,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",
            background:isExp?T.redBg:T.amberBg,borderRadius:8,marginBottom:6,
            border:"1px solid "+(isExp?"#fca5a5":"#fcd34d")}},
            ce("div",null,
              ce("div",{style:{fontSize:12,fontWeight:700,color:T.text}},e.orgName),
              ce("div",{style:{fontSize:11,color:T.muted}},e.contractEnd)),
            ce("div",{style:{fontSize:13,fontWeight:800,color:isExp?T.red:T.amber}},
              isExp?"已逾期":"剩"+daysLeft+"天"));
        })));
  };

  var renderContent=function(){
    if(activeRpt==="revenue_overview")return renderRevenueOverview();
    if(activeRpt==="ent_statement")return renderEntStatement();
    if(activeRpt==="plan_status")return renderPlanStatus();
    if(activeRpt==="payment_track")return renderPaymentTrack();
    if(activeRpt==="monthly_recon")return renderMonthlyRecon();
    if(activeRpt==="comm_detail")return renderCommDetail();
    if(activeRpt==="ticket_log")return renderTicketLog();
    if(activeRpt==="dist_perf")return renderDistPerf();
    if(activeRpt==="acc_alert")return renderAccAlert();
    return null;
  };

  var buildCSVRows=function(){
    if(activeRpt==="revenue_overview"){
      var entRev=rptEnts.reduce(function(a,e){return a+(PLAN_PRICES[e.plan||"基本"]||0);},0);
      var psubRev=rptPSubs.reduce(function(a,r){return a+(parseInt(r.amount)||0);},0);
      var rows=[["項目","家數/筆數","金額(NT$)"]];
      rows.push(["企業年收預估(B2B)",rptEnts.length,entRev]);
      rows.push(["個人訂閱已核准收款(B2C)",rptPSubs.length,psubRev]);
      rows.push(["合計(基期不同僅供參考)","-",entRev+psubRev]);
      return rows;
    }
    if(activeRpt==="ent_statement"){
      var ent=enterprises.find(function(e){return e.id===selEntId;});
      if(!ent)return[["請先於畫面選擇一家企業"]];
      var rows=[["企業","層級","項目","金額","到期日","狀態"]];
      buildEntPaymentRows(ent).forEach(function(r){rows.push([ent.orgName,r.layer,r.desc,r.amount,r.dueDate||"-",r.status]);});
      rows.push([]);
      rows.push(["── 歷史對帳沖帳記錄 ──"]);
      rows.push(["審核日","沖帳金額","應付金額","差額","覆核人","狀態"]);
      paymentLedger.filter(function(l){return l.entId===ent.id;}).forEach(function(l){
        rows.push([(l.reviewedAt||"").slice(0,10),l.claimedAmount||0,l.totalDueAmount||0,l.diffAmount||0,l.reviewedBy||"-",l.isMismatch?(l.diffAmount<0?"部分付款":"金額不符"):"已沖帳"]);
      });
      return rows;
    }
    if(activeRpt==="plan_status"){
      var rows=[["企業名稱","代碼","方案","狀態","已用人數","授權人數","合約到期"]];
      rptEnts.forEach(function(e){
        rows.push([e.orgName,e.orgCode,e.plan||"基本",e.status||"待啟用",e.usedCount||0,e.memberCount||0,e.contractEnd||"-"]);
      });
      return rows;
    }
    if(activeRpt==="payment_track"){
      var rows=[["企業","層級","項目","金額","到期日","狀態"]];
      rptEnts.forEach(function(e){
        buildEntPaymentRows(e).forEach(function(r){rows.push([e.orgName,r.layer,r.desc,r.amount,r.dueDate||"-",r.status]);});
      });
      return rows;
    }
    if(activeRpt==="monthly_recon"){
      var rows=[["企業","沖帳金額","應付金額","差額","覆核人","審核時間","狀態"]];
      paymentLedger.forEach(function(l){
        rows.push([l.entName,l.claimedAmount||0,l.totalDueAmount||0,l.diffAmount||0,l.reviewedBy||"-",(l.reviewedAt||"").slice(0,16).replace("T"," "),l.isMismatch?(l.diffAmount<0?"部分付款":"金額不符"):"已沖帳"]);
      });
      return rows;
    }
    if(activeRpt==="comm_detail"){
      var thisYM=function(){var n=new Date();return n.getFullYear()+"-"+String(n.getMonth()+1).padStart(2,"0");};
      var selMonth=dateStart?dateStart.slice(0,7):thisYM();
      var rows=[["經銷商","代碼","等級","管理企業數","理論應付(A+B含LA200+C層)","已確認金額","狀態","確認時間"]];
      distributors.forEach(function(d){
        var lv=LEVELS[d.level||"silver"];
        var myEnts=enterprises.filter(function(e){return e.partnerCode===d.orgCode;});
        var comm=calcDistComm(d,enterprises);
        var ledgerEntry=commLedger.find(function(l){return l.distId===d.id&&l.month===selMonth;});
        rows.push([d.name,d.orgCode,lv.l,myEnts.length,d.override||comm.total,
          ledgerEntry?ledgerEntry.amount:"-",ledgerEntry?ledgerEntry.status:"尚未確認",
          ledgerEntry&&ledgerEntry.confirmedAt?ledgerEntry.confirmedAt.slice(0,10):"-"]);
      });
      return rows;
    }
    if(activeRpt==="ticket_log"){
      var rows=[["企業","類型","優先","狀態","建立日","處理人"]];
      rptTks.forEach(function(t){
        rows.push([t.entName,t.type,t.priority,t.status,(t.createdAt||"").slice(0,10),t.handler||"-"]);
      });
      return rows;
    }
    if(activeRpt==="dist_perf"){
      var PLAN_P={"基本":600000,"成長":1200000,"專業":1800000,"旗艦":3000000};
      var rows=[["經銷商","等級","企業數","年簽約額(A層)","分潤預估(A+B含LA200+C層)"]];
      distributors.filter(function(d){return d.type==="primary";}).forEach(function(d){
        var lv=LEVELS[d.level||"silver"];
        var myEnts=enterprises.filter(function(e){return e.partnerCode===d.orgCode;});
        var yearAmt=myEnts.reduce(function(a,e){return a+(e.aLayerFee||(PLAN_P[e.plan||"基本"]||0));},0);
        var comm=calcDistComm(d,enterprises);
        rows.push([d.name,lv.l,myEnts.length,yearAmt,comm.total]);
      });
      return rows;
    }
    if(activeRpt==="acc_alert"){
      var rows=[["企業","代碼","方案","已用人數","授權人數","使用率","合約到期"]];
      enterprises.forEach(function(e){
        var used=parseInt(e.usedCount)||0;var total=parseInt(e.memberCount)||1;
        rows.push([e.orgName,e.orgCode,e.plan||"基本",used,total,Math.round((used/total)*100)+"%",e.contractEnd||"-"]);
      });
      return rows;
    }
    return [["無資料"]];
  };

  var doExportCSV=function(){
    var rows=buildCSVRows();
    if(rows.length<=1){setToast("此報表目前無資料可匯出");return;}
    var rptLabel=(RPTS.find(function(r){return r.k===activeRpt;})||{}).l||activeRpt;
    var cleanLabel=rptLabel.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g,"");
    var filename="REIBI_"+cleanLabel+"_"+new Date().toISOString().slice(0,10)+".csv";
    downloadCSV(filename,rows);
    setToast("已匯出 "+filename+"("+(rows.length-1)+"筆資料)");
  };

  return ce("div",{style:{display:"grid",gap:12}},
    ce(Toast,{msg:toast,onDone:function(){setToast("");}}),
    ce(DateRangePicker,{onChange:function(s,e){setDateStart(s);setDateEnd(e);}}),
    (function(){
      var groups=[];
      RPTS.forEach(function(r){
        var g=groups.find(function(x){return x.grp===r.grp;});
        if(!g){g={grp:r.grp,items:[]};groups.push(g);}
        g.items.push(r);
      });
      return ce("div",{style:{display:"grid",gap:6}},
        groups.map(function(g){
          return ce("div",{key:g.grp},
            ce("div",{style:{fontSize:10,color:T.faint,fontWeight:700,marginBottom:4}},g.grp),
            ce("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
              g.items.map(function(r){
                return ce("button",{key:r.k,onClick:function(){setActiveRpt(r.k);},
                  style:{padding:"6px 12px",border:"1px solid "+(activeRpt===r.k?T.teal:T.border),borderRadius:20,cursor:"pointer",
                    fontWeight:700,fontSize:11,fontFamily:"inherit",
                    background:activeRpt===r.k?T.teal:"transparent",color:activeRpt===r.k?"#fff":T.muted}},r.l);
              })));
        }));
    })(),
    renderContent(),
    ce("div",{style:{display:"flex",gap:8}},
      ce(Btn,{v:"sage",full:true,onClick:doExportCSV},"📥 匯出CSV(可用Excel開啟)"),
      ce(Btn,{v:"ghost",onClick:function(){window.print();}},"🖨 列印")));
}

// ── MAP SCREEN ────────────────────────────────────────────────────────────────
function MapScreen(props){
  var session=props.session;
  var[enterprises,setEnterprises]=useState([]);
  var REGIONS=[
    {k:"north",l:"北部",cities:["台北市","新北市","基隆市","桃園市","新竹縣市"],color:T.teal,target:40},
    {k:"central",l:"中部",cities:["台中市","彰化縣","南投縣","雲林縣","苗栗縣"],color:T.sage,target:20},
    {k:"south",l:"南部",cities:["高雄市","台南市","嘉義縣市","屏東縣"],color:T.amber,target:20},
    {k:"east",l:"東部",cities:["花蓮縣","台東縣","宜蘭縣"],color:T.coral,target:8},
    {k:"overseas",l:"海外",cities:["日本","新加坡","馬來西亞","越南"],color:T.plum,target:12}
  ];
  var MILESTONES=[
    {y:"2024",q:"Q4",desc:"北部首批10家企業開通，建立平台基礎",done:true},
    {y:"2025",q:"Q1",desc:"北部擴展至20家，啟動中部招商",done:true},
    {y:"2025",q:"Q2",desc:"中部10家開通，建立南部經銷商體系",done:true},
    {y:"2025",q:"Q3",desc:"南部啟動，東部試點，全台覆蓋率>60%",done:false},
    {y:"2025",q:"Q4",desc:"全台100家，海外市場探索(日本/新加坡)",done:false},
    {y:"2026",q:"Q2",desc:"海外首批落地，REIBI Academy三級制度完備",done:false}
  ];
  useEffect(function(){
    stor.g("l5_enterprises").then(function(d){if(d)setEnterprises(JSON.parse(d));});
  },[]);
  var totalTarget=REGIONS.reduce(function(a,r){return a+r.target;},0);
  var currentTotal=enterprises.length;
  return ce("div",{style:{display:"grid",gap:14}},
    ce(Card,{style:{background:"linear-gradient(135deg,#0f766e,#1e3a5f)",border:"none"}},
      ce("div",{style:{color:"#fff"}},
        ce("div",{style:{fontSize:13,opacity:.8,marginBottom:4}},"全台佈點目標"),
        ce("div",{style:{fontSize:28,fontWeight:900}},currentTotal+" / "+totalTarget+" 家"),
        ce("div",{style:{height:8,background:"rgba(255,255,255,.2)",borderRadius:4,marginTop:8,overflow:"hidden"}},
          ce("div",{style:{height:"100%",width:Math.min(100,Math.round((currentTotal/totalTarget)*100))+"%",background:"rgba(255,255,255,.8)",borderRadius:4}})),
        ce("div",{style:{fontSize:12,opacity:.8,marginTop:4}},Math.round((currentTotal/totalTarget)*100)+"% 達成率"))),
    ce("div",{style:{display:"grid",gap:8}},
      REGIONS.map(function(r){
        var cnt=enterprises.filter(function(e){return e.region===r.k;}).length;
        var pct=r.target>0?Math.min(100,Math.round((cnt/r.target)*100)):0;
        return ce(Card,{key:r.k,style:{padding:"12px 14px"}},
          ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}},
            ce("div",null,
              ce("div",{style:{fontWeight:700,fontSize:14,color:r.color}},r.l),
              ce("div",{style:{fontSize:11,color:T.muted,marginTop:2}},r.cities.join(" · "))),
            ce("div",{style:{textAlign:"right"}},
              ce("div",{style:{fontSize:18,fontWeight:800,color:r.color}},cnt+"/"+r.target),
              ce("div",{style:{fontSize:10,color:T.muted}},"目標 "+r.target+" 家"))),
          ce("div",{style:{height:6,background:T.bg,borderRadius:3,overflow:"hidden"}},
            ce("div",{style:{height:"100%",width:pct+"%",background:r.color,borderRadius:3,transition:"width .5s"}})),
          ce("div",{style:{fontSize:10,color:T.muted,marginTop:3}},pct+"% 達成"));
      })),
    ce(Card,null,
      ce(SecTitle,null,"擴展里程碑"),
      ce("div",{style:{display:"grid",gap:8}},
        MILESTONES.map(function(m){
          return ce("div",{key:m.y+m.q,style:{display:"flex",gap:12,alignItems:"flex-start"}},
            ce("div",{style:{flexShrink:0,width:20,height:20,borderRadius:"50%",marginTop:2,
              background:m.done?T.sage:T.bg,border:"2px solid "+(m.done?T.sage:T.border),
              display:"flex",alignItems:"center",justifyContent:"center"}},
              m.done&&ce("span",{style:{color:"#fff",fontSize:10,fontWeight:800}},"✓")),
            ce("div",{style:{flex:1,paddingBottom:8,borderBottom:"1px solid "+T.border}},
              ce("div",{style:{fontSize:11,fontWeight:700,color:m.done?T.sage:T.muted}},m.y+" "+m.q),
              ce("div",{style:{fontSize:12,color:m.done?T.text:T.faint}},m.desc)));
        }))));
}

// ── STRATEGY SCREEN ───────────────────────────────────────────────────────────
function StrategyScreen(props){
  var session=props.session;
  var[enterprises,setEnterprises]=useState([]);
  useEffect(function(){
    stor.g("l5_enterprises").then(function(d){if(d)setEnterprises(JSON.parse(d));});
  },[]);
  var PLAN_PRICES={"基本":600000,"成長":1200000,"專業":1800000,"旗艦":3000000};
  var annualRev=enterprises.reduce(function(a,e){return a+(PLAN_PRICES[e.plan||"基本"]||0);},0);
  var ACADEMY=[
    {level:"初級顧問",icon:"🌱",req:"完成REIBI基礎認證 + 3家企業輔導",benefit:"可獨立執行ISI/BPI評估報告解讀",color:T.sage},
    {level:"中級顧問",icon:"🌿",req:"初級顧問 + 10家企業 + 季度報告",benefit:"可執行企業健促計畫設計 + OKR制定",color:T.teal},
    {level:"高級顧問",icon:"🏆",req:"中級顧問 + 30家企業 + 白皮書貢獻",benefit:"可授課培訓 + 獨立撰寫產業分析報告",color:T.amber}
  ];
  var NPS_ITEMS=enterprises.filter(function(e){
    if(!e.contractStart)return false;
    var monthsActive=Math.floor((new Date()-new Date(e.contractStart))/(1000*60*60*24*30));
    return monthsActive===3||monthsActive===12;
  });
  var KPI_GOALS=[
    {l:"年度企業目標",current:enterprises.length,target:100,unit:"家",c:T.teal},
    {l:"年度營收目標",current:Math.round(annualRev/10000),target:3000,unit:"萬",c:T.amber},
    {l:"平均HPI目標",current:68,target:75,unit:"分",c:T.sage},
    {l:"888計畫達成率",current:65,target:80,unit:"%",c:T.plum}
  ];
  return ce("div",{style:{display:"grid",gap:14}},
    ce(Card,{style:{background:"linear-gradient(135deg,#1e3a5f,#0f766e)",border:"none"}},
      ce("div",{style:{color:"#fff"}},
        ce("div",{style:{fontSize:13,fontWeight:800,letterSpacing:.5,marginBottom:8}},"🧭 REIBI 2025 策略總覽"),
        ce("div",{style:{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}},
          KPI_GOALS.map(function(k){
            var pct=Math.min(100,Math.round((k.current/k.target)*100));
            return ce("div",{key:k.l,style:{background:"rgba(255,255,255,.1)",borderRadius:8,padding:"10px 12px"}},
              ce("div",{style:{fontSize:10,opacity:.8,marginBottom:2}},k.l),
              ce("div",{style:{fontSize:16,fontWeight:800}},k.current+k.unit+" / "+k.target+k.unit),
              ce("div",{style:{height:4,background:"rgba(255,255,255,.2)",borderRadius:2,marginTop:6}},
                ce("div",{style:{height:"100%",width:pct+"%",background:"rgba(255,255,255,.8)",borderRadius:2}})),
              ce("div",{style:{fontSize:10,opacity:.7,marginTop:2}},pct+"%達成"));
          })))),
    ce(Card,null,
      ce(SecTitle,null,"REIBI Academy 三級制度"),
      ce(IBox,{c:"teal",style:{marginBottom:12}},"REIBI Academy 培育健促顧問，提升服務品質與企業深度綁定。"),
      ACADEMY.map(function(a){
        return ce("div",{key:a.level,style:{display:"flex",gap:12,padding:"12px",background:T.bg,borderRadius:10,marginBottom:8,border:"1px solid "+T.border}},
          ce("div",{style:{fontSize:28,flexShrink:0}},a.icon),
          ce("div",{style:{flex:1}},
            ce("div",{style:{fontWeight:800,fontSize:13,color:a.color,marginBottom:4}},a.level),
            ce("div",{style:{fontSize:11,color:T.muted,marginBottom:4}},"資格："+a.req),
            ce("div",{style:{fontSize:11,color:T.text}},"權益："+a.benefit)));
      })),
    NPS_ITEMS.length>0&&ce(Card,null,
      ce(SecTitle,null,"NPS 客戶滿意度回訪提醒"),
      ce(IBox,{c:"amber",style:{marginBottom:10}},"以下企業已達回訪時間點(合約滿3個月或1年)，請安排麗媚客服主動聯繫。"),
      NPS_ITEMS.map(function(e){
        var months=Math.floor((new Date()-new Date(e.contractStart))/(1000*60*60*24*30));
        return ce("div",{key:e.id,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:T.amberBg,borderRadius:8,marginBottom:6,border:"1px solid #fcd34d"}},
          ce("div",null,
            ce("div",{style:{fontSize:12,fontWeight:700,color:T.text}},e.orgName),
            ce("div",{style:{fontSize:11,color:T.muted}},e.consultant?"負責顧問："+e.consultant:"未指定顧問")),
          ce(Tag,{c:"amber"},months===3?"滿3個月":"滿1年"));
      })),
    NPS_ITEMS.length===0&&ce(Card,null,
      ce(SecTitle,null,"NPS 客戶滿意度回訪"),
      ce(IBox,{c:"teal"},"目前無到期回訪企業。系統會自動標記合約滿3個月/1年的企業。")),
    ce(Card,null,
      ce(SecTitle,null,"關鍵戰略主軸"),
      ce("div",{style:{display:"grid",gap:8}},
        [
          {icon:"🏥",title:"健促覆蓋率",desc:"目標全台1000家中大型企業，5年覆蓋率30%"},
          {icon:"📊",title:"數據資產化",desc:"累積去識別化健康數據，建立台灣健康資料庫，提供學術研究與政策制定"},
          {icon:"🌏",title:"海外擴展",desc:"2026年進入日本/新加坡市場，借助當地經銷商體系快速落地"},
          {icon:"🎓",title:"REIBI Academy",desc:"三級顧問制度確保服務品質，創造健促顧問生態系"},
          {icon:"🤝",title:"ESG整合",desc:"協助企業完成GRI 403-6揭露，創造ESG差異化競爭優勢"}
        ].map(function(item){
          return ce("div",{key:item.title,style:{display:"flex",gap:10,padding:"10px 12px",background:T.bg,borderRadius:8}},
            ce("div",{style:{fontSize:22,flexShrink:0}},item.icon),
            ce("div",null,
              ce("div",{style:{fontWeight:700,fontSize:13,color:T.text,marginBottom:2}},item.title),
              ce("div",{style:{fontSize:11,color:T.muted,lineHeight:1.6}},item.desc)));
        }))));
}

// -- DIRECTORY SCREEN (名冊查詢) ────────────────────────────────────────────────
function DirectoryScreen(props){
  var session=props.session;
  var role=session&&session.role;
  var[enterprises,setEnterprises]=useState([]);
  var[distributors,setDistributors]=useState([]);
  var[tab,setTab]=useState("individual");
  var[search,setSearch]=useState("");
  var[dateStart,setDateStart]=useState("");
  var[dateEnd,setDateEnd]=useState("");
  var[toast,setToast]=useState("");

  var PLAN_PRICES={"基本":600000,"成長":1200000,"專業":1800000,"旗艦":3000000};
  var LEVELS={silver:"🥈 銀牌",gold:"🥇 金牌",platinum:"🏆 白金",strategic:"⭐ 戰略"};

  useEffect(function(){
    stor.g("l5_enterprises").then(function(d){if(d)setEnterprises(JSON.parse(d));});
    stor.g("l5_distributors").then(function(d){if(d)setDistributors(JSON.parse(d));});
  },[]);

  var filterEnt=function(list){
    return list.filter(function(e){
      var matchSearch=!search||(e.orgName&&e.orgName.includes(search))||(e.orgCode&&e.orgCode.toUpperCase().includes(search.toUpperCase()))||(e.contact&&e.contact.includes(search));
      var matchStart=!dateStart||!e.contractStart||e.contractStart>=dateStart;
      var matchEnd=!dateEnd||!e.contractEnd||e.contractEnd<=dateEnd;
      return matchSearch&&matchStart&&matchEnd;
    });
  };

  var copyTable=function(text){
    if(navigator.clipboard)navigator.clipboard.writeText(text).then(function(){setToast("已複製至剪貼板，可貼入Excel");});
    else setToast("請手動選取表格內容複製");
  };

  var buildEntCSV=function(list){
    var header="企業名稱\t代碼\t方案\t狀態\t授權人數\t合約開始\t合約結束\tA層費用\tB層費用\tC層費用\t接案經銷商\t負責顧問";
    var rows=list.map(function(e){
      return [e.orgName,e.orgCode,e.plan||"基本",e.status||"啟用中",(e.usedCount||0)+"/"+(e.memberCount||0),e.contractStart||"-",e.contractEnd||"-","NT$"+((e.aLayerFee||PLAN_PRICES[e.plan||"基本"]||0)/10000).toFixed(1)+"萬","NT$"+((e.bLayerFee||0)/10000).toFixed(1)+"萬","NT$"+((e.cLayerFee||0)/10000).toFixed(1)+"萬",e.partnerCode||"直客",e.consultant||"-"].join("\t");
    });
    return [header].concat(rows).join("\n");
  };

  var buildDistCSV=function(list){
    var header="經銷商名稱\t代碼\t等級\t類型\t聯絡人\t電話\t Email\t管理企業數\t隸屬主經銷商";
    var rows=list.map(function(d){
      var entCount=enterprises.filter(function(e){return e.partnerCode===d.orgCode;}).length;
      var parentName=d.parentId?distributors.find(function(x){return x.orgCode===d.parentId;}):null;
      return [d.name,d.orgCode,LEVELS[d.level||"silver"],d.type==="primary"?"主經銷商":"次級",d.contact||"-",d.phone||"-",d.email||"-",entCount,parentName?parentName.name:"-"].join("\t");
    });
    return [header].concat(rows).join("\n");
  };

  var buildEntCSVRows=function(list){
    var rows=[["企業名稱","代碼","方案","狀態","授權人數","合約開始","合約結束","A層費用","B層費用","C層費用","接案經銷商","負責顧問"]];
    list.forEach(function(e){
      rows.push([e.orgName,e.orgCode,e.plan||"基本",e.status||"啟用中",(e.usedCount||0)+"/"+(e.memberCount||0),e.contractStart||"-",e.contractEnd||"-",
        Math.round(e.aLayerFee||PLAN_PRICES[e.plan||"基本"]||0),Math.round(e.bLayerFee||0),Math.round(e.cLayerFee||0),e.partnerCode||"直客",e.consultant||"-"]);
    });
    return rows;
  };

  var buildDistCSVRows=function(list){
    var rows=[["經銷商名稱","代碼","等級","類型","聯絡人","電話","Email","管理企業數","隸屬主經銷商"]];
    list.forEach(function(d){
      var entCount=enterprises.filter(function(e){return e.partnerCode===d.orgCode;}).length;
      var parentName=d.parentId?distributors.find(function(x){return x.orgCode===d.parentId;}):null;
      rows.push([d.name,d.orgCode,LEVELS[d.level||"silver"],d.type==="primary"?"主經銷商":"次級",d.contact||"-",d.phone||"-",d.email||"-",entCount,parentName?parentName.name:"-"]);
    });
    return rows;
  };

  var doExportEntCSV=function(list){
    downloadCSV("REIBI_企業通訊錄_"+new Date().toISOString().slice(0,10)+".csv",buildEntCSVRows(list));
    setToast("已匯出企業通訊錄CSV("+list.length+"筆)");
  };
  var doExportDistCSV=function(list){
    downloadCSV("REIBI_經銷商通訊錄_"+new Date().toISOString().slice(0,10)+".csv",buildDistCSVRows(list));
    setToast("已匯出經銷商通訊錄CSV("+list.length+"筆)");
  };

  var filteredEnts=filterEnt(enterprises);
  var filteredDists=filterEnt(distributors);
  var primaryDists=distributors.filter(function(d){return d.type==="primary";});
  var subDists=distributors.filter(function(d){return d.type==="sub";});

  var daysLeft=function(contractEnd){
    if(!contractEnd)return null;
    return Math.ceil((new Date(contractEnd)-new Date())/(1000*60*60*24));
  };

  return ce("div",{style:{display:"grid",gap:12}},
    ce(Toast,{msg:toast,onDone:function(){setToast("");}}),
    ce("div",{style:{display:"flex",gap:0,background:T.bg,borderRadius:10,padding:3}},
      [{k:"individual",l:"👤 個人/用戶"},{k:"enterprise",l:"🏢 企業單位"},{k:"distributor",l:"🤝 經銷商關係"}].map(function(t){
        return ce("button",{key:t.k,onClick:function(){setTab(t.k);},
          style:{flex:1,padding:"8px 4px",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:11,fontFamily:"inherit",
            background:tab===t.k?T.card:"transparent",color:tab===t.k?T.teal:T.muted,
            boxShadow:tab===t.k?T.sh:"none"}},t.l);
      })),
    ce(Card,null,
      ce(SecTitle,null,"查詢條件"),
      ce(DateRangePicker,{onChange:function(s,e){setDateStart(s);setDateEnd(e);}}),
      ce(Inp,{label:"搜尋(名稱 / 代碼 / 聯絡人)",value:search,onChange:function(e){setSearch(e.target.value);},placeholder:"輸入關鍵字..."})),

    tab==="individual"&&ce("div",{style:{display:"grid",gap:10}},
      ce(IBox,{c:"navy"},"個人用戶資料儲存於各自的瀏覽器本地端，系統設計保護個人隱私，L5後台不直接存取個人評估數據。\n如需查詢特定企業成員使用情況，請至「企業管理」查看帳號使用率，或由企業管理者在主平台匯出。\n⚠「個人訂閱審核」畫面(v2.1新增)例外：僅記錄客戶主動透過LINE/Email提供的會員碼/方案/聯絡方式等訂閱申請資訊，不涉及、也讀取不到個人健康評估內容，兩者是完全不同的資料類別。"),
      ce(Card,null,
        ce(SecTitle,null,"可查詢的彙整指標"),
        ce("div",{style:{display:"grid",gap:8}},
          [{l:"企業成員帳號使用率",desc:"各企業已登入人數 / 授權上限，見「企業管理」",icon:"👥"},
           {l:"整體HPI分布",desc:"去識別化(k≥5匿名)，見「大數據分析」",icon:"📊"},
           {l:"評估完成率",desc:"正式後端上線後提供企業別達成率",icon:"📋"},
           {l:"個人報告下載",desc:"由企業成員自行在主平台下載，不經由L5後台",icon:"📄"}].map(function(item){
            return ce("div",{key:item.l,style:{display:"flex",gap:10,padding:"8px 10px",background:T.bg,borderRadius:8}},
              ce("div",{style:{fontSize:20}}),
              ce("div",null,
                ce("div",{style:{fontSize:12,fontWeight:700,color:T.text}},item.icon+" "+item.l),
                ce("div",{style:{fontSize:11,color:T.muted}},item.desc)));
          })))),

    tab==="enterprise"&&ce("div",{style:{display:"grid",gap:10}},
      ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
        ce("div",{style:{fontSize:12,color:T.muted}},"共 "+filteredEnts.length+" 筆"+(filteredEnts.length!==enterprises.length?" / 總計"+enterprises.length+"筆":"")),
        ce("div",{style:{display:"flex",gap:6}},
          ce(Btn,{sz:"sm",v:"sage",onClick:function(){doExportEntCSV(filteredEnts);}},"📥 匯出CSV"),
          ce(Btn,{sz:"sm",v:"ghost",onClick:function(){copyTable(buildEntCSV(filteredEnts));}},"📋 複製(貼Excel)"))),
      filteredEnts.length===0?ce(Card,{style:{textAlign:"center",padding:32,color:T.muted}},enterprises.length===0?"尚無企業資料":"無符合條件"):
      ce("div",{style:{overflowX:"auto"}},
        ce("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:11,background:T.card,borderRadius:10,overflow:"hidden"}},
          ce("thead",null,
            ce("tr",{style:{background:"linear-gradient(135deg,#0f766e,#1e3a5f)"}},
              ["企業名稱","代碼","方案","狀態","人數","合約開始","合約結束","A層費","B層費","C層費","合約到期","接案經銷商"].map(function(h){
                return ce("th",{key:h,style:{padding:"8px 10px",textAlign:"left",color:"#fff",fontWeight:700,fontSize:10,whiteSpace:"nowrap"}},h);
              }))),
          ce("tbody",null,
            filteredEnts.map(function(e,i){
              var dl=daysLeft(e.contractEnd);
              var isExp=dl!==null&&dl<0;
              var isWarn=dl!==null&&dl>=0&&dl<=30;
              var aFee=e.aLayerFee||(PLAN_PRICES[e.plan||"基本"]||0);
              return ce("tr",{key:e.id,style:{background:i%2===0?T.bg:T.card,borderBottom:"1px solid "+T.border}},
                ce("td",{style:{padding:"6px 10px",fontWeight:700,color:T.text,whiteSpace:"nowrap"}},e.orgName),
                ce("td",{style:{padding:"6px 10px",color:T.teal,fontFamily:"monospace",fontSize:10}},e.orgCode),
                ce("td",{style:{padding:"6px 10px"}},ce(PlanBadge,{plan:e.plan||"基本"})),
                ce("td",{style:{padding:"6px 10px"}},ce(StatusBadge,{status:e.status||"啟用中"})),
                ce("td",{style:{padding:"6px 10px",color:T.muted,textAlign:"center"}},(e.usedCount||0)+"/"+(e.memberCount||0)),
                ce("td",{style:{padding:"6px 10px",color:T.muted,whiteSpace:"nowrap"}},e.contractStart||"-"),
                ce("td",{style:{padding:"6px 10px",color:isExp?T.red:isWarn?T.amber:T.muted,fontWeight:isWarn||isExp?700:400,whiteSpace:"nowrap"}},e.contractEnd||"-"),
                ce("td",{style:{padding:"6px 10px",color:T.amber,fontWeight:700,whiteSpace:"nowrap"}},"NT$"+(aFee/10000).toFixed(1)+"萬"),
                ce("td",{style:{padding:"6px 10px",color:T.muted,whiteSpace:"nowrap"}},"NT$"+((e.bLayerFee||0)/10000).toFixed(1)+"萬"),
                ce("td",{style:{padding:"6px 10px",color:T.muted,whiteSpace:"nowrap"}},(e.cLayerFee&&e.cLayerFee>0)?"NT$"+(e.cLayerFee/10000).toFixed(1)+"萬":"-"),
                ce("td",{style:{padding:"6px 10px",color:isExp?T.red:isWarn?T.amber:T.muted,fontWeight:isWarn||isExp?700:400}},dl===null?"-":isExp?"已逾期":dl+"天"),
                ce("td",{style:{padding:"6px 10px",color:T.muted}},e.partnerCode||"直客"));
            }))))),

    tab==="distributor"&&ce("div",{style:{display:"grid",gap:10}},
      ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}},
        [{l:"主經銷商",v:primaryDists.length,c:T.navy},{l:"次級經銷商",v:subDists.length,c:T.teal},{l:"合作企業",v:enterprises.filter(function(e){return e.partnerCode;}).length,c:T.amber}].map(function(k){
          return ce(Card,{key:k.l,style:{padding:"10px",textAlign:"center"}},
            ce("div",{style:{fontSize:20,fontWeight:800,color:k.c}},k.v),
            ce("div",{style:{fontSize:10,color:T.muted,marginTop:4}},k.l));
        })),
      ce("div",{style:{display:"flex",justifyContent:"flex-end",gap:6}},
        ce(Btn,{sz:"sm",v:"sage",onClick:function(){doExportDistCSV(distributors);}},"📥 匯出CSV"),
        ce(Btn,{sz:"sm",v:"ghost",onClick:function(){copyTable(buildDistCSV(distributors));}},"📋 複製(貼Excel)")),
      primaryDists.length===0?ce(Card,{style:{textAlign:"center",padding:32,color:T.muted}},"尚無經銷商資料"):
      ce("div",{style:{display:"grid",gap:10}},
        primaryDists.map(function(p){
          var subs=distributors.filter(function(d){return d.parentId===p.orgCode;});
          var myEnts=enterprises.filter(function(e){return e.partnerCode===p.orgCode;});
          var subEnts=subs.reduce(function(all,s){return all.concat(enterprises.filter(function(e){return e.partnerCode===s.orgCode;}));}, []);
          var totalRev=myEnts.concat(subEnts).reduce(function(a,e){return a+(PLAN_PRICES[e.plan||"基本"]||0);},0);
          return ce(Card,{key:p.id,style:{borderLeft:"4px solid "+T.navy}},
            ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}},
              ce("div",null,
                ce("div",{style:{fontWeight:800,fontSize:14,color:T.navy}},p.name),
                ce("div",{style:{fontSize:11,color:T.muted,fontFamily:"monospace"}},p.orgCode),
                ce("div",{style:{fontSize:11,color:T.muted,marginTop:2}},"聯絡人："+(p.contact||"-")+" · "+(p.phone||"-"))),
              ce("div",{style:{textAlign:"right"}},
                ce(Tag,{c:"navy"},LEVELS[p.level||"silver"]),
                ce("div",{style:{fontSize:10,color:T.muted,marginTop:4}},"合計業績"),
                ce("div",{style:{fontSize:14,fontWeight:800,color:T.amber}},"NT$"+(totalRev/10000).toFixed(0)+"萬"))),
            ce("div",{style:{display:"flex",gap:10,flexWrap:"wrap",marginBottom:8}},
              ce(Tag,{c:"teal"},myEnts.length+"家直屬企業"),
              subs.length>0&&ce(Tag,{c:"gray"},subs.length+"個次級"),
              subs.length>0&&ce(Tag,{c:"gray"},subEnts.length+"家次級企業")),
            myEnts.length>0&&ce("div",{style:{display:"grid",gap:4,marginBottom:8}},
              myEnts.map(function(e){
                var aFee=e.aLayerFee||(PLAN_PRICES[e.plan||"基本"]||0);
                var dl=daysLeft(e.contractEnd);
                return ce("div",{key:e.id,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 8px",background:T.bg,borderRadius:6}},
                  ce("div",null,
                    ce("div",{style:{fontSize:11,fontWeight:600,color:T.text}},e.orgName),
                    ce("div",{style:{fontSize:10,color:T.muted}},e.contractStart+" ~ "+e.contractEnd)),
                  ce("div",{style:{textAlign:"right"}},
                    ce("div",{style:{fontSize:11,fontWeight:700,color:T.amber}},"NT$"+(aFee/10000).toFixed(1)+"萬/年"),
                    dl!==null&&ce("div",{style:{fontSize:10,color:dl<0?T.red:dl<=30?T.amber:T.faint}},dl<0?"已到期":dl+"天")));
              })),
            subs.length>0&&ce("div",{style:{borderTop:"1px solid "+T.border,paddingTop:8}},
              ce("div",{style:{fontSize:11,fontWeight:700,color:T.muted,marginBottom:6}},"次級經銷商"),
              subs.map(function(s){
                var sEnts=enterprises.filter(function(e){return e.partnerCode===s.orgCode;});
                return ce("div",{key:s.id,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 10px",background:T.navyBg,borderRadius:8,marginBottom:4}},
                  ce("div",null,
                    ce("div",{style:{fontSize:11,fontWeight:700,color:T.navy}},s.name),
                    ce("div",{style:{fontSize:10,color:T.muted}},s.orgCode+" · "+(s.contact||"-"))),
                  ce("div",{style:{textAlign:"right"}},
                    ce(Tag,{c:"gray"},LEVELS[s.level||"silver"]),
                    ce("div",{style:{fontSize:10,color:T.muted,marginTop:2}},sEnts.length+"家企業")));
              })));
        }))));
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App(){
  var[sess,setSess]=useState(null);
  var[loading,setLoading]=useState(true);
  var[screen,setScreen]=useState("overview");
  var[toast,setToast]=useState("");
  var[openCat,setOpenCat]=useState(""); // v2.12新增：上方導覽列分類下拉選單，記錄目前展開的分類

  useEffect(function(){
    stor.g("l5_session").then(function(d){
      if(d){
        try{
          var s=typeof d==="string"?JSON.parse(d):d;
          setSess(s);
        }catch(e){setSess(null);}
      }
      setLoading(false);
    });
  },[]);

  var doLogout=async function(){
    await stor.d("l5_session");
    setSess(null);
    setScreen("overview");
  };

  var nav=function(s){
    if(s==="logout"){doLogout();return;}
    setScreen(s);
  };

  if(loading){
    return ce("div",{style:{minHeight:"100vh",background:"linear-gradient(135deg,#0f766e,#1e3a5f)",
      display:"flex",alignItems:"center",justifyContent:"center"}},
      ce("div",{style:{color:"#fff",fontSize:14,fontWeight:700}},"REIBI 專屬管理系統 載入中..."));
  }

  if(!sess){
    return ce(LoginScreen,{onLogin:function(s){setSess(s);setScreen("overview");}});
  }

  var role=sess.role;
  var roleInfo=L5_ROLES[role]||L5_ROLES.cs;
  var isPartner=role==="partner_primary"||role==="partner_sub";

  var menuItems=[
    {k:"overview",icon:"📊",l:"總覽",show:true,cat:""},
    {k:"new_case",icon:"🆕",l:"新案開通",show:hasPerm(role,"all")||hasPerm(role,"new_case_build"),cat:"作業"},
    {k:"enterprises",icon:"🏢",l:"企業管理",show:hasPerm(role,"all")||hasPerm(role,"enterprise")||hasPerm(role,"my_enterprises"),cat:"作業"},
    {k:"tickets",icon:"📅",l:"服務工單",show:hasPerm(role,"all")||hasPerm(role,"tickets")||hasPerm(role,"service_req_submit"),cat:"作業"},
    {k:"appt_mgmt",icon:"🗓",l:"預約管理",show:hasPerm(role,"all")||hasPerm(role,"tickets"),cat:"作業"},
    {k:"map",icon:"🗺",l:"點線面",show:hasPerm(role,"all")||hasPerm(role,"map"),cat:"作業"},
    {k:"payment",icon:"💳",l:"付款時程",show:hasPerm(role,"all")||hasPerm(role,"payment")||hasPerm(role,"my_payment"),cat:"財務"},
    {k:"invoice",icon:"🧾",l:"發票管理",show:hasPerm(role,"all")||hasPerm(role,"payment"),cat:"財務"},
    {k:"personal_sub",icon:"⭐",l:"個人訂閱審核",show:hasPerm(role,"all")||hasPerm(role,"personal_sub"),cat:"財務"},
    {k:"distributor",icon:"🤝",l:"經銷商",show:hasPerm(role,"all")||hasPerm(role,"distributor")||hasPerm(role,"my_commission"),cat:"夥伴"},
    {k:"partners",icon:"🎗",l:"合作夥伴",show:hasPerm(role,"all")||hasPerm(role,"distributor"),cat:"夥伴"},
    {k:"staff",icon:"💼",l:"業務人員",show:hasPerm(role,"all")||hasPerm(role,"distributor"),cat:"夥伴"},
    {k:"bigdata",icon:"📈",l:"大數據",show:hasPerm(role,"all")||hasPerm(role,"bigdata"),cat:"系統"},
    {k:"line_push",icon:"💬",l:"LINE推播",show:hasPerm(role,"all")||hasPerm(role,"line_push"),cat:"系統"},
    {k:"auth_mgmt",icon:"🔑",l:"授權管理",show:hasPerm(role,"all")||hasPerm(role,"auth_view"),cat:"系統"},
    {k:"strategy",icon:"🧭",l:"策略",show:hasPerm(role,"all")||hasPerm(role,"strategy"),cat:"系統"},
    {k:"reports",icon:"📋",l:"報表",show:hasPerm(role,"all")||hasPerm(role,"reports"),cat:"系統"},
    {k:"directory",icon:"📑",l:"名冊查詢",show:hasPerm(role,"all")||hasPerm(role,"reports")||hasPerm(role,"enterprise")||hasPerm(role,"distributor"),cat:"系統"},
    {k:"manual",icon:"❓",l:"說明",show:true,cat:""}
  ].filter(function(m){return m.show;});
  // v2.12新增：分類下拉選單。cat為""的項目(總覽/說明)維持獨立按鈕，其餘依cat分組。
  var CAT_ORDER=["作業","財務","夥伴","系統"];
  var CAT_ICON={"作業":"🗂","財務":"💰","夥伴":"🎗","系統":"⚙"};
  var standaloneItems=menuItems.filter(function(m){return !m.cat;});
  var catGroups=CAT_ORDER.map(function(c){return{cat:c,items:menuItems.filter(function(m){return m.cat===c;})};}).filter(function(g){return g.items.length>0;});
  var activeCat=(menuItems.find(function(m){return m.k===screen;})||{}).cat;

  return ce("div",{style:{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column"}},
    ce("div",{style:{background:"linear-gradient(135deg,#0f766e,#1e3a5f)",padding:"12px 20px",
      display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}},
      ce("div",{style:{display:"flex",alignItems:"center",gap:10}},
        ce("span",{style:{fontSize:24}},"🛡"),
        ce("div",null,
          ce("div",{style:{fontSize:13,fontWeight:800,color:"#fff",letterSpacing:.5}},"REIBI 專屬管理系統"),
          ce("div",{style:{fontSize:10,color:"rgba(255,255,255,.7)"}},roleInfo.icon+" "+roleInfo.label+" · "+sess.name))),
      ce("button",{onClick:doLogout,
        style:{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.3)",
          color:"#fff",padding:"5px 12px",borderRadius:8,cursor:"pointer",fontSize:11,
          fontWeight:700,fontFamily:"inherit"}},"登出")),
    ce("div",{style:{position:"relative",flexShrink:0}},
      ce("div",{style:{display:"flex",gap:4,padding:"10px 14px",background:T.card,
        borderBottom:"1px solid "+T.border,overflowX:"auto"}},
        // 總覽固定第一個
        standaloneItems.filter(function(m){return m.k==="overview";}).map(function(m){
          return ce("button",{key:m.k,onClick:function(){setOpenCat("");nav(m.k);},
            style:{padding:"6px 12px",border:"none",borderRadius:20,cursor:"pointer",
              fontWeight:700,fontSize:11,fontFamily:"inherit",whiteSpace:"nowrap",
              background:screen===m.k?T.teal:"transparent",
              color:screen===m.k?"#fff":T.muted}},
            m.icon+" "+m.l);
        }),
        // 分類下拉按鈕
        catGroups.map(function(g){
          var isOpen=openCat===g.cat;
          var isActive=activeCat===g.cat;
          return ce("button",{key:g.cat,onClick:function(){setOpenCat(isOpen?"":g.cat);},
            style:{padding:"6px 12px",border:"none",borderRadius:20,cursor:"pointer",
              fontWeight:700,fontSize:11,fontFamily:"inherit",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:4,
              background:isOpen||isActive?T.teal:"transparent",
              color:isOpen||isActive?"#fff":T.muted}},
            CAT_ICON[g.cat]+" "+g.cat+" "+(isOpen?"▲":"▼"));
        }),
        // 說明固定最後
        standaloneItems.filter(function(m){return m.k==="manual";}).map(function(m){
          return ce("button",{key:m.k,onClick:function(){setOpenCat("");nav(m.k);},
            style:{padding:"6px 12px",border:"none",borderRadius:20,cursor:"pointer",
              fontWeight:700,fontSize:11,fontFamily:"inherit",whiteSpace:"nowrap",
              background:screen===m.k?T.teal:"transparent",
              color:screen===m.k?"#fff":T.muted}},
            m.icon+" "+m.l);
        })),
      openCat&&ce("div",{style:{position:"absolute",top:"100%",left:14,zIndex:20,
        background:T.card,border:"1px solid "+T.border,borderRadius:10,boxShadow:"0 6px 18px rgba(0,0,0,.12)",
        padding:6,display:"flex",flexDirection:"column",gap:2,minWidth:160}},
        (catGroups.find(function(g){return g.cat===openCat;})||{items:[]}).items.map(function(m){
          return ce("button",{key:m.k,onClick:function(){setOpenCat("");nav(m.k);},
            style:{padding:"8px 12px",border:"none",borderRadius:8,cursor:"pointer",textAlign:"left",
              fontWeight:700,fontSize:12,fontFamily:"inherit",whiteSpace:"nowrap",
              background:screen===m.k?T.tealBg:"transparent",
              color:screen===m.k?T.teal:T.text}},
            m.icon+" "+m.l);
        }))),
    ce("div",{style:{flex:1,maxWidth:760,width:"100%",margin:"0 auto",padding:"16px 14px 40px",
      boxSizing:"border-box"}},
      ce(Toast,{msg:toast,onDone:function(){setToast("");}}),
      screen==="overview"&&ce(OverviewScreen,{session:sess}),
      screen==="new_case"&&ce(NewCaseScreen,{session:sess,onBack:function(){nav("overview");},onNav:nav}),
      screen==="enterprises"&&ce(EnterpriseScreen,{session:sess}),
      screen==="payment"&&ce(PaymentScreen,{session:sess}),
      screen==="invoice"&&ce(InvoiceScreen,{session:sess}),
      screen==="personal_sub"&&ce(PersonalSubScreen,{session:sess}),
      screen==="auth_mgmt"&&ce(AuthMgmtScreen,{session:sess}),
      screen==="distributor"&&ce(DistributorScreen,{session:sess}),
      screen==="partners"&&ce(PartnersScreen,{session:sess}),
      screen==="staff"&&ce(StaffScreen,{session:sess}),
      screen==="tickets"&&ce(TicketScreen,{session:sess}),
      screen==="appt_mgmt"&&ce(ApptMgmtScreen,{session:sess}),
      screen==="line_push"&&ce(LinePushScreen,{session:sess}),
      screen==="bigdata"&&ce(BigDataScreen,{session:sess}),
      screen==="manual"&&ce(ManualScreen,{session:sess}),
      screen==="directory"&&ce(DirectoryScreen,{session:sess}),
      screen==="reports"&&ce(ReportsScreen,{session:sess}),
      screen==="map"&&ce(MapScreen,{session:sess}),
      screen==="strategy"&&ce(StrategyScreen,{session:sess}),
      screen!=="overview"&&screen!=="new_case"&&screen!=="enterprises"&&screen!=="payment"&&screen!=="invoice"&&screen!=="personal_sub"&&screen!=="auth_mgmt"&&screen!=="distributor"&&screen!=="partners"&&screen!=="staff"&&screen!=="tickets"&&screen!=="appt_mgmt"&&screen!=="line_push"&&screen!=="bigdata"&&screen!=="manual"&&screen!=="reports"&&screen!=="map"&&screen!=="strategy"&&screen!=="directory"&&ce(Card,{style:{textAlign:"center",padding:40,color:T.muted}},
        ce("div",{style:{fontSize:40,marginBottom:12}},"🚧"),
        ce("div",{style:{fontSize:14,fontWeight:700,color:T.text,marginBottom:6}},
          menuItems.find(function(m){return m.k===screen;})?
            (menuItems.find(function(m){return m.k===screen;}).icon+" "+
             menuItems.find(function(m){return m.k===screen;}).l+" — 開發中"):"模組載入中"),
        ce("div",{style:{fontSize:12,marginTop:6}},"第2批開發中，即將推出"),
        ce(Btn,{v:"ghost",onClick:function(){nav("overview");},style:{marginTop:14}},"← 返回總覽"))));
}
