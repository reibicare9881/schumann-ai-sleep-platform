import React,{useState,useEffect}from"react";
const ce=React.createElement;

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
  sh:"0 2px 12px rgba(15,118,110,.08)"
};

// ── D層服務項目主表 ────────────────────────────────────────────────────────────
var D_ITEMS=[
  {
    key:"poster",name:"基礎海報套組",
    unit:"張",defaultQty:6,
    specs:[
      {k:"size",label:"尺寸",options:["A2(420×594mm)","A1(594×841mm)","A0(841×1189mm)"]},
      {k:"material",label:"材質",options:["銅板紙霧膜","銅板紙亮膜","防水PP霧膜","布料帆布"]},
      {k:"content",label:"內容主題",options:["ISI睡眠量表說明","BPI疼痛量表說明","888計畫宣導","REIBI品牌識別","健促活動宣傳","自訂主題"]}
    ],
    deliverables:["海報成品(指定數量)","設計稿電子檔(PDF/AI格式)"],
    acceptCriteria:["尺寸正確","顏色符合打樣","內容無誤","數量完整"]
  },
  {
    key:"board",name:"健促公告欄設計",
    unit:"組",defaultQty:1,
    specs:[
      {k:"size",label:"公告欄尺寸",options:["60×90cm","90×120cm","120×180cm","客製尺寸"]},
      {k:"type",label:"類型",options:["固定式鋁框","可更換插槽式","軟木板+框","磁吸白板"]},
      {k:"content",label:"視覺內容",options:["888計畫+IDG框架","Ottawa Charter五大行動","健康評估指引","REIBI使用導引","組合式(多主題)"]}
    ],
    deliverables:["公告欄本體","背板內容印刷品","安裝五金配件","設計稿電子檔"],
    acceptCriteria:["公告欄安裝穩固","視覺內容清晰","尺寸符合規格","可更換機制正常運作"]
  },
  {
    key:"display",name:"設備展示區佈置",
    unit:"組",defaultQty:1,
    specs:[
      {k:"scope",label:"佈置範圍",options:["雲朵床展示區","樂活椅展示區","LA200展示區","全設備整合展示區"]},
      {k:"include",label:"包含項目",options:["設備說明牌(壓克力立牌)","體驗預約QR Code展架","動線指引地貼","背景展示牆貼","設備操作說明卡"]},
      {k:"install",label:"安裝方式",options:["獨立展示架","壁掛固定","桌面擺設","地面立式"]}
    ],
    deliverables:["說明牌成品","動線指引材料","安裝固定材料"],
    acceptCriteria:["說明牌清晰易讀","安裝穩固安全","動線流暢","與B層設備位置匹配"]
  },
  {
    key:"qr",name:"QR Code貼紙組",
    unit:"組",defaultQty:1,
    specs:[
      {k:"size",label:"貼紙尺寸",options:["5×5cm","8×8cm","10×10cm","客製尺寸"]},
      {k:"qty",label:"數量",options:["20張/組","50張/組","100張/組","客製數量"]},
      {k:"link",label:"連結內容",options:["REIBI平台入口","ISI評估入口","BPI評估入口","服務預約入口","員工健促資源","多合一入口頁"]},
      {k:"material",label:"材質",options:["防水霧面貼紙","防水亮面貼紙","可移除重貼","戶外抗UV"]}
    ],
    deliverables:["QR Code貼紙組(指定數量)","備用QR碼電子檔(PDF)"],
    acceptCriteria:["QR Code掃描正確","連結指向正確","貼紙材質符合規格","印刷清晰"]
  },
  {
    key:"digital",name:"數位看板內容",
    unit:"支",defaultQty:10,
    specs:[
      {k:"format",label:"影片格式",options:["MP4 16:9(1920×1080)","MP4 9:16(直式)","PNG靜態圖(可輪播)","GIF動態圖"]},
      {k:"duration",label:"每支長度",options:["15秒","30秒","60秒","靜態(不限)"]},
      {k:"content",label:"內容主題",options:["健康知識輪播","ISI/BPI說明","888計畫介紹","REIBI品牌形象","設備體驗介紹","企業客製主題"]},
      {k:"update",label:"後續更新",options:["包含1年更新服務(季更)","包含首次製作不含更新","另議更新服務費"]}
    ],
    deliverables:["數位影像/影片檔(指定支數)","播放清單設定說明","更新服務合約(如包含)"],
    acceptCriteria:["格式正確可播放","解析度符合規格","內容正確無誤","更新服務已確認"]
  },
  {
    key:"install",name:"現場佈置施工",
    unit:"次",defaultQty:1,
    specs:[
      {k:"scope",label:"施工範圍",options:["全項目安裝","僅海報/公告欄張貼","設備展示區布置","數位看板安裝調試","指定項目(見備註)"]},
      {k:"travel",label:"差旅費",options:["含差旅費(雙北地區)","含差旅費(北部地區)","另計差旅費(中南東部)","海外另議"]},
      {k:"duration",label:"施工時間",options:["半天(4小時)","1天(8小時)","2天","視施工量另議"]}
    ],
    deliverables:["施工完成照片記錄","現場確認清單"],
    acceptCriteria:["所有項目安裝完成","現場整潔無殘留","施工照片已交付","客戶現場確認"]
  }
];

// ── STORAGE ────────────────────────────────────────────────────────────────────
var stor={
  g:async function(k){try{var r=await window.storage.get(k);return r?r.value:null;}catch(e){return null;}},
  s:async function(k,v){try{await window.storage.set(k,typeof v==="string"?v:JSON.stringify(v));}catch(e){}},
  d:async function(k){try{await window.storage.delete(k);}catch(e){}}
};
var genWONo=function(){
  var y=new Date().getFullYear().toString().slice(2);
  var m=String(new Date().getMonth()+1).padStart(2,"0");
  return "WO-D-"+y+m+"-"+String(Math.floor(Math.random()*900)+100).padStart(3,"0");
};

// ── UI PRIMITIVES ──────────────────────────────────────────────────────────────
function Btn(props){
  var v=props.v||"primary",sz=props.sz||"md",sx=props.style||{};
  var sizes={sm:{padding:"5px 12px",fontSize:11},md:{padding:"9px 18px",fontSize:13},lg:{padding:"12px 24px",fontSize:14}};
  var vars={primary:{background:T.teal,color:"#fff",border:"none"},sage:{background:T.sageBg,color:T.sage,border:"1px solid #86efac"},amber:{background:T.amberBg,color:T.amber,border:"1px solid #fcd34d"},ghost:{background:"transparent",color:T.muted,border:"1px solid "+T.border},danger:{background:T.redBg,color:T.red,border:"1px solid #fca5a5"},navy:{background:T.navyBg,color:T.navy,border:"1px solid #93c5fd"}};
  return ce("button",{onClick:props.disabled?undefined:props.onClick,style:Object.assign({},{borderRadius:8,cursor:props.disabled?"not-allowed":"pointer",fontWeight:600,fontFamily:"inherit",opacity:props.disabled?.5:1},props.full?{width:"100%",display:"block"}:{},sizes[sz]||sizes.md,vars[v]||vars.primary,sx)},props.children);
}
function Card(props){return ce("div",{onClick:props.onClick,style:Object.assign({},{background:T.card,border:"1px solid "+T.border,borderRadius:12,padding:18,boxShadow:T.sh},props.onClick?{cursor:"pointer"}:{},props.style||{})},props.children);}
function IBox(props){
  var cols={teal:{background:T.tealBg,border:"1px solid "+T.tealLight,color:T.teal},amber:{background:T.amberBg,border:"1px solid #fcd34d",color:T.amber},red:{background:T.redBg,border:"1px solid #fca5a5",color:T.red},sage:{background:T.sageBg,border:"1px solid #86efac",color:T.sage},navy:{background:T.navyBg,border:"1px solid #93c5fd",color:T.navy}};
  return ce("div",{style:Object.assign({},{borderRadius:8,padding:"10px 14px",fontSize:12,lineHeight:1.7},cols[props.c||"teal"]||cols.teal,props.style||{})},props.children);
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
    ce("select",{value:props.value,onChange:props.onChange,style:{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,color:T.text,background:T.card,outline:"none",boxSizing:"border-box"}},props.children));
}
function SecTitle(props){return ce("h3",{style:{fontSize:14,fontWeight:700,color:T.teal,marginBottom:12,marginTop:0,borderBottom:"2px solid "+T.tealLight,paddingBottom:6}},props.children);}
function Toast(props){
  useEffect(function(){if(props.msg){var t=setTimeout(props.onDone,3000);return function(){clearTimeout(t);};};},[props.msg]);
  if(!props.msg)return null;
  return ce("div",{style:{background:T.text,color:"#fff",padding:"10px 22px",borderRadius:24,fontSize:13,fontWeight:600,textAlign:"center",margin:"8px auto 4px",maxWidth:460}},props.msg);
}
function Tag(props){
  var m={teal:{bg:T.tealBg,c:T.teal},sage:{bg:T.sageBg,c:T.sage},amber:{bg:T.amberBg,c:T.amber},red:{bg:T.redBg,c:T.red},gray:{bg:"#f1f5f9",c:T.muted},navy:{bg:T.navyBg,c:T.navy}};
  var s=m[props.c||"teal"]||m.teal;
  return ce("span",{style:{display:"inline-block",padding:"2px 9px",borderRadius:20,fontSize:11,fontWeight:700,background:s.bg,color:s.c}},props.children);
}
function StatusBadge(props){
  var m={"草稿":{bg:"#f1f5f9",c:T.muted},"已發出":{bg:T.navyBg,c:T.navy},"出貨中":{bg:T.amberBg,c:T.amber},"安裝中":{bg:T.tealBg,c:T.teal},"待驗收":{bg:T.goldBg,c:T.gold},"驗收完成":{bg:T.sageBg,c:T.sage},"驗收異常":{bg:T.redBg,c:T.red},"已存檔":{bg:"#f1f5f9",c:T.muted}};
  var s=m[props.status]||m["草稿"];
  return ce("span",{style:{padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700,background:s.bg,color:s.c}},props.status);
}

// ── WORKORDER FORM ─────────────────────────────────────────────────────────────
function WorkOrderForm(props){
  var onBack=props.onBack;
  var onSave=props.onSave;
  var session=props.session;
  var initWO=props.initWO||{};

  var[handoffApplied,setHandoffApplied]=useState(false);
  // v1.4新增：手動挑選既有合約/報價單(不限最新一筆handoff)、REIBI服務人員下拉
  var[availDocs,setAvailDocs]=useState(null); // null=讀取中/未共用
  var[l5Staff,setL5Staff]=useState(null);
  var[serviceStaffId,setServiceStaffId]=useState(initWO.serviceStaffId||"");
  useEffect(function(){
    Promise.all([stor.g("rq_contracts"),stor.g("rq_quotes")]).then(function(r){
      try{
        var contracts=r[0]?JSON.parse(r[0]):[];
        var quotes=r[1]?JSON.parse(r[1]):[];
        var docs=contracts.map(function(c){return Object.assign({},c,{__src:"合約"});})
          .concat(quotes.filter(function(q){return q.status==="已確認"||q.status==="已轉合約";}).map(function(q){return Object.assign({},q,{__src:"報價單"});}));
        setAvailDocs(docs);
      }catch(e){setAvailDocs([]);}
    }).catch(function(){setAvailDocs([]);});
    stor.g("l5_staff").then(function(d){try{setL5Staff(d?JSON.parse(d):[]);}catch(e){setL5Staff([]);}}).catch(function(){setL5Staff([]);});
  },[]);
  var pickDoc=function(doc){
    setClientName(doc.clientName||"");
    setContractNo(doc.docNo||"");
    setContact(doc.contact||"");
    setPhone(doc.phone||"");
    setEmail(doc.email||"");
    setAddress(doc.address||"");
    if(doc.dSites&&doc.dSites.length)setDSites(doc.dSites);
    if(doc.dItems)setSelectedItems(doc.dItems);
    setHandoffApplied(true);
    setHandoffNotice("已從"+doc.__src+" "+doc.docNo+" 帶入客戶資訊");
  };
  var[handoffNotice,setHandoffNotice]=useState("");

  var[clientName,setClientName]=useState(initWO.clientName||"");
  var[contractNo,setContractNo]=useState(initWO.contractNo||"");
  var[contact,setContact]=useState(initWO.contact||"");
  var[address,setAddress]=useState(initWO.address||"");
  var[phone,setPhone]=useState(initWO.phone||"");
  var[email,setEmail]=useState(initWO.email||"");
  var[scheduledDate,setScheduledDate]=useState(initWO.scheduledDate||"");
  var[period,setPeriod]=useState(initWO.period||"");
  var[globalNote,setGlobalNote]=useState(initWO.globalNote||"");
  var[specialTerms,setSpecialTerms]=useState(initWO.specialTerms||"");
  var[staffNames,setStaffNames]=useState(initWO.staffNames||"");
  var[selectedItems,setSelectedItems]=useState(initWO.selectedItems||{});
  var[itemSpecs,setItemSpecs]=useState(initWO.itemSpecs||{});
  var[itemQty,setItemQty]=useState(initWO.itemQty||{});
  var[itemNote,setItemNote]=useState(initWO.itemNote||{});
  var[customItems,setCustomItems]=useState(initWO.customItems||[]);
  var[newCustomItem,setNewCustomItem]=useState("");
  var[toast,setToast]=useState("");
  // v1.3新增：健促場域多地點(比照quote.jsx/l5.jsx的dSites結構),隨D層場勘需求單handoff一併帶入
  var[dSites,setDSites]=useState(initWO.dSites||[]);
  var[scopeConfirmReibi,setScopeConfirmReibi]=useState(initWO.scopeConfirmReibi||"");
  var[scopeConfirmReibiDate,setScopeConfirmReibiDate]=useState(initWO.scopeConfirmReibiDate||"");
  var[scopeConfirmClient,setScopeConfirmClient]=useState(initWO.scopeConfirmClient||"");
  var[scopeConfirmClientDate,setScopeConfirmClientDate]=useState(initWO.scopeConfirmClientDate||"");

  useEffect(function(){
    if(initWO.id)return;
    stor.g("__rq_handoff_index_workorder").then(function(idxRaw){
      var idx=idxRaw?JSON.parse(idxRaw):[];
      if(!idx.length)return;
      var lastKey=idx[idx.length-1];
      stor.g(lastKey).then(function(raw){
        if(!raw)return;
        var payload;
        try{payload=JSON.parse(raw);}catch(e){return;}
        if(payload.clientName)setClientName(payload.clientName);
        if(payload.contractNo)setContractNo(payload.contractNo);
        if(payload.contact)setContact(payload.contact);
        if(payload.address)setAddress(payload.address);
        if(payload.phone)setPhone(payload.phone);
        if(payload.email)setEmail(payload.email);
        if(payload.selectedItems)setSelectedItems(payload.selectedItems);
        if(payload.dSites&&payload.dSites.length)setDSites(payload.dSites);
        if(payload.globalNote)setGlobalNote(payload.globalNote);
        setHandoffApplied(true);
        setHandoffNotice("已自動帶入合約 "+(payload.contractNo||"")+" 的客戶資訊"+(payload.address||((payload.dSites||[]).length)?"、場域地址":"")+"與D層項目");
      });
    });
  },[]);



  var toggleItem=function(key){
    setSelectedItems(function(p){
      var n=Object.assign({},p);
      n[key]=!n[key];
      if(n[key]&&!itemQty[key]){
        var def=D_ITEMS.find(function(d){return d.key===key;});
        setItemQty(function(q){var nq=Object.assign({},q);nq[key]=def?def.defaultQty:1;return nq;});
      }
      return n;
    });
  };

  var setSpec=function(itemKey,specKey,val){
    setItemSpecs(function(p){
      var n=Object.assign({},p);
      n[itemKey]=Object.assign({},n[itemKey]||{});
      n[itemKey][specKey]=val;
      return n;
    });
  };

  var doSave=async function(status){
    var woNo=initWO.woNo||genWONo();
    var wo={
      id:initWO.id||"WO_"+Date.now(),
      woNo,status:status||"草稿",
      clientName,contractNo,contact,address,phone,email,dSites,serviceStaffId,
      scopeConfirmReibi,scopeConfirmReibiDate,scopeConfirmClient,scopeConfirmClientDate,
      scheduledDate,period,globalNote,specialTerms,staffNames,
      selectedItems,itemSpecs,itemQty,itemNote,customItems,
      createdAt:initWO.createdAt||new Date().toISOString(),
      updatedAt:new Date().toISOString(),
      createdBy:initWO.createdBy||(session&&session.name)||"",
      statusHistory:(initWO.statusHistory||[]).concat([{status,at:new Date().toISOString(),by:session&&session.name}])
    };
    var all=await stor.g("rq_workorders");
    var list=all?JSON.parse(all):[];
    var idx=list.findIndex(function(w){return w.id===wo.id;});
    if(idx>=0)list[idx]=wo;else list.unshift(wo);
    await stor.s("rq_workorders",JSON.stringify(list));
    if(onSave)onSave(wo);
    setToast("工單 "+woNo+" 已儲存("+status+")");
  };

  var selectedCount=Object.keys(selectedItems).filter(function(k){return selectedItems[k];}).length+customItems.length;

  return ce("div",{style:{display:"grid",gap:14}},
    ce(Toast,{msg:toast,onDone:function(){setToast("");}}),
    ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
      ce("button",{onClick:onBack,style:{background:"none",border:"none",cursor:"pointer",color:T.teal,fontSize:13,fontWeight:700,fontFamily:"inherit"}},"<- 返回工單列表"),
      ce(Tag,{c:"teal"},"D層環境佈置工單")),
    handoffApplied&&ce(IBox,{c:"sage"},"✅ "+handoffNotice),

    ce(Card,null,
      ce(SecTitle,null,"基本資訊"),
      ce("div",{style:{display:"grid",gap:10}},
        ce("div",null,
          ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4,fontWeight:600}},"從既有合約/報價單挑選(選填，會覆蓋以下欄位)"),
          availDocs&&availDocs.length>0?ce("select",{value:"",onChange:function(e){var d=availDocs.find(function(x){return x.docNo===e.target.value;});if(d)pickDoc(d);},
            style:{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,background:T.card}},
            ce("option",{value:""},"—請選擇—"),
            availDocs.map(function(d){return ce("option",{key:d.docNo,value:d.docNo},"["+d.__src+"] "+d.clientName+" · "+d.docNo);})):
          ce("div",{style:{fontSize:11,color:T.muted}},availDocs===null?"讀取中...":"尚未讀取到quote.jsx的合約/報價單資料(可能是storage未共用，或尚無已確認的報價單)，請直接手動填寫下方欄位")),
        ce(Inp,{label:"客戶公司名稱 *",value:clientName,onChange:function(e){setClientName(e.target.value);},placeholder:"請填入客戶名稱"}),
        ce(Inp,{label:"關聯合約/報價單號",value:contractNo,onChange:function(e){setContractNo(e.target.value.toUpperCase());},placeholder:"例：CT-2510-001"}),
        ce("div",null,
          ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4,fontWeight:600}},"REIBI服務人員(選填)"),
          l5Staff&&l5Staff.length>0?ce("select",{value:serviceStaffId,onChange:function(e){setServiceStaffId(e.target.value);},
            style:{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid "+T.border,fontSize:13,background:T.card}},
            ce("option",{value:""},"未指定"),
            l5Staff.map(function(s){return ce("option",{key:s.id,value:s.id},(s.title||"")+" "+s.name);})):
          ce(Inp,{value:serviceStaffId,onChange:function(e){setServiceStaffId(e.target.value);},placeholder:l5Staff===null?"讀取中...":"尚無l5業務人員清單資料，可先留空或手動填姓名"})),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}},
          ce(Inp,{label:"現場聯絡人 *",value:contact,onChange:function(e){setContact(e.target.value);}}),
          ce(Inp,{label:"聯絡電話",value:phone,onChange:function(e){setPhone(e.target.value);}})),
        ce(Inp,{label:"施工地址 *",value:address,onChange:function(e){setAddress(e.target.value);},placeholder:"請填入完整施工地址(含樓層/室)"}),
        dSites.length>0&&ce(IBox,{c:"teal",style:{fontSize:11}},
          ce("div",{style:{fontWeight:700,marginBottom:4}},"⚠ 客戶於報價/合約階段登記了"+dSites.length+"個健促場域，本工單一次僅能派工一個地址："),
          dSites.map(function(s,i){
            return ce("div",{key:s.id||i,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0"}},
              ce("span",null,(s.label||"(未命名)")+"："+(s.address||"(地址待補)")),
              ce("button",{onClick:function(){setAddress(s.address||"");},style:{background:"none",border:"1px solid "+T.teal,color:T.teal,borderRadius:6,padding:"2px 8px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}},"帶入此地址"));
          }),
          ce("div",{style:{marginTop:4,color:T.muted}},"若同一份合約需在多個場域施工，請針對每個場域各自建立一張工單。")),
        ce(Inp,{label:"Email",value:email,onChange:function(e){setEmail(e.target.value);},placeholder:"驗收單發送Email"}),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}},
          ce(Inp,{label:"預定施工日期",type:"date",value:scheduledDate,onChange:function(e){setScheduledDate(e.target.value);}}),
          ce(Inp,{label:"施工期間(文字說明)",value:period,onChange:function(e){setPeriod(e.target.value);},placeholder:"例：2025/10/15 09:00-17:00"})),
        ce(Inp,{label:"麗媚服務人員(姓名，逗號分隔)",value:staffNames,onChange:function(e){setStaffNames(e.target.value);},placeholder:"例：王小明、李大華"}))),

    ce(Card,null,
      ce(SecTitle,null,"服務項目選擇("+selectedCount+"項)"),
      ce(IBox,{c:"teal",style:{marginBottom:12}},"勾選本次工單包含的D層服務項目，每項可指定規格、數量及備註。"),
      ce("div",{style:{display:"grid",gap:10}},
        D_ITEMS.map(function(item){
          var isSelected=selectedItems[item.key]||false;
          var specs=itemSpecs[item.key]||{};
          var qty=itemQty[item.key]||item.defaultQty;
          var note=itemNote[item.key]||"";
          return ce("div",{key:item.key,style:{border:"1px solid "+(isSelected?T.teal:T.border),borderRadius:10,overflow:"hidden"}},
            ce("div",{onClick:function(){toggleItem(item.key);},
              style:{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",cursor:"pointer",background:isSelected?T.tealBg:T.card}},
              ce("div",{style:{width:20,height:20,borderRadius:6,border:"2px solid "+(isSelected?T.teal:T.faint),background:isSelected?T.teal:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}},
                isSelected&&ce("span",{style:{color:"#fff",fontSize:13,fontWeight:900}},"v")),
              ce("div",{style:{flex:1}},
                ce("div",{style:{fontWeight:700,fontSize:13,color:isSelected?T.teal:T.text}},item.name),
                ce("div",{style:{fontSize:11,color:T.muted}},"預設 "+item.defaultQty+item.unit))),
            isSelected&&ce("div",{style:{padding:"10px 14px",background:T.bg,borderTop:"1px solid "+T.tealLight}},
              ce("div",{style:{display:"grid",gap:8}},
                ce("div",{style:{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}},
                  ce("label",{style:{fontSize:12,color:T.muted,fontWeight:600,flexShrink:0}},"數量"),
                  ce("div",{style:{display:"flex",alignItems:"center",gap:6}},
                    ce("button",{onClick:function(){setItemQty(function(p){var n=Object.assign({},p);n[item.key]=Math.max(1,(n[item.key]||1)-1);return n;});},style:{width:24,height:24,borderRadius:"50%",border:"1px solid "+T.border,background:T.card,cursor:"pointer",fontWeight:700,fontFamily:"inherit"}},"-"),
                    ce("span",{style:{fontSize:15,fontWeight:800,color:T.teal,minWidth:28,textAlign:"center"}},qty),
                    ce("button",{onClick:function(){setItemQty(function(p){var n=Object.assign({},p);n[item.key]=(n[item.key]||1)+1;return n;});},style:{width:24,height:24,borderRadius:"50%",border:"1px solid "+T.teal,background:T.tealBg,cursor:"pointer",fontWeight:700,color:T.teal,fontFamily:"inherit"}},"+"),
                    ce("span",{style:{fontSize:12,color:T.muted}},item.unit)),
                  ce("input",{value:qty,type:"number",onChange:function(e){setItemQty(function(p){var n=Object.assign({},p);n[item.key]=parseInt(e.target.value)||1;return n;});},
                    style:{width:60,padding:"4px 8px",borderRadius:6,border:"1px solid "+T.border,fontSize:12,textAlign:"center"}})),
                item.specs.map(function(spec){
                  return ce(Sel,{key:spec.k,label:spec.label,value:specs[spec.k]||"",onChange:function(e){setSpec(item.key,spec.k,e.target.value);},style:{marginBottom:0}},
                    ce("option",{value:""},"請選擇"+spec.label),
                    spec.options.map(function(opt){return ce("option",{key:opt,value:opt},opt);}));
                }),
                ce("div",null,
                  ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4,fontWeight:600}},"項目備註(特殊要求)"),
                  ce("input",{value:note,onChange:function(e){setItemNote(function(p){var n=Object.assign({},p);n[item.key]=e.target.value;return n;});},
                    placeholder:"例：需對色打樣確認、配合B層設備安裝時程",
                    style:{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:12,boxSizing:"border-box"}})))));
        })),
      ce("div",{style:{marginTop:10,borderTop:"1px dashed "+T.border,paddingTop:10}},
        ce("div",{style:{fontSize:12,fontWeight:700,color:T.muted,marginBottom:6}},"自訂服務項目(選填)"),
        ce("div",{style:{display:"flex",gap:8,marginBottom:6}},
          ce("input",{value:newCustomItem,onChange:function(e){setNewCustomItem(e.target.value);},
            placeholder:"填入自訂服務項目名稱，例：LED燈箱製作",
            style:{flex:1,padding:"8px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:12}}),
          ce(Btn,{sz:"sm",onClick:function(){
            if(newCustomItem.trim()){setCustomItems(function(p){return p.concat([{name:newCustomItem.trim(),qty:1,note:""}]);});setNewCustomItem("");}
          }},"+加入")),
        customItems.map(function(ci,i){
          return ce("div",{key:i,style:{display:"flex",gap:6,alignItems:"center",padding:"6px 10px",background:T.bg,borderRadius:8,marginBottom:4}},
            ce("span",{style:{fontSize:12,flex:1,color:T.text}},ci.name),
            ce("button",{onClick:function(){setCustomItems(function(p){return p.filter(function(x,j){return j!==i;});});},
              style:{background:"none",border:"none",cursor:"pointer",color:T.red,fontWeight:700,fontSize:14,fontFamily:"inherit"}},"×"));
        }))),

    ce(Card,null,
      ce(SecTitle,null,"施工前交付範圍確認(選填)"),
      ce(IBox,{c:"teal",style:{marginBottom:10,fontSize:11}},"施工前可先與客戶對齊本次交付的品項/數量/場域，避免現場認知落差。此區塊為選填參考資訊，不影響工單狀態或後續驗收流程。"),
      ce("div",{style:{display:"grid",gap:6,marginBottom:12}},
        Object.keys(selectedItems).filter(function(k){return selectedItems[k];}).map(function(k){
          var def=D_ITEMS.find(function(d){return d.key===k;});
          var qty=itemQty[k]||(def?def.defaultQty:1);
          return ce("div",{key:k,style:{display:"flex",justifyContent:"space-between",padding:"6px 10px",background:T.bg,borderRadius:6,fontSize:12}},
            ce("span",null,(def?def.name:k)),ce("span",{style:{color:T.muted}},"× "+qty+(def?def.unit:"")));
        }),
        customItems.map(function(ci,i){
          return ce("div",{key:"c"+i,style:{display:"flex",justifyContent:"space-between",padding:"6px 10px",background:T.bg,borderRadius:6,fontSize:12}},
            ce("span",null,ci.name),ce("span",{style:{color:T.muted}},"自訂項目"));
        }),
        dSites.length>0&&ce("div",{style:{marginTop:4,fontSize:11,color:T.muted}},"場域："+dSites.map(function(s){return s.label;}).filter(Boolean).join("、")||"—")),
      ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}},
        ce("div",null,
          ce("label",{style:{fontSize:11,color:T.muted,display:"block",marginBottom:4,fontWeight:600}},"REIBI負責人確認"),
          ce(Inp,{value:scopeConfirmReibi,onChange:function(e){setScopeConfirmReibi(e.target.value);},placeholder:"姓名"}),
          ce(Inp,{type:"date",value:scopeConfirmReibiDate,onChange:function(e){setScopeConfirmReibiDate(e.target.value);}})),
        ce("div",null,
          ce("label",{style:{fontSize:11,color:T.muted,display:"block",marginBottom:4,fontWeight:600}},"客戶代表確認"),
          ce(Inp,{value:scopeConfirmClient,onChange:function(e){setScopeConfirmClient(e.target.value);},placeholder:"姓名"}),
          ce(Inp,{type:"date",value:scopeConfirmClientDate,onChange:function(e){setScopeConfirmClientDate(e.target.value);}})))),

    ce(Card,null,
      ce(SecTitle,null,"整體備註與特約條款"),
      ce("div",{style:{display:"grid",gap:10}},
        ce("div",null,
          ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4,fontWeight:600}},"整體備註"),
          ce("textarea",{value:globalNote,onChange:function(e){setGlobalNote(e.target.value);},rows:3,
            placeholder:"整體工單說明、施工注意事項、客戶特殊需求...",
            style:{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:12,fontFamily:"inherit",boxSizing:"border-box",resize:"vertical"}})),
        ce("div",null,
          ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4,fontWeight:600}},"特約條款(選填)"),
          ce("textarea",{value:specialTerms,onChange:function(e){setSpecialTerms(e.target.value);},rows:3,
            placeholder:"例：工程逾期每日賠償、延保不含人為損壞、驗收期限14天...",
            style:{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+T.border,fontSize:12,fontFamily:"inherit",boxSizing:"border-box",resize:"vertical"}}))),
      ce("div",{style:{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}},
        ce(Btn,{v:"ghost",sz:"sm",onClick:function(){doSave("草稿");}},"💾 儲存草稿"),
        ce(Btn,{v:"amber",sz:"sm",onClick:function(){doSave("已發出");}},"📤 發出工單"),
        ce(Btn,{v:"sage",sz:"sm",onClick:function(){doSave("待驗收");}},"✅ 標記待驗收"))));
}

// ── ACCEPTANCE VIEW ────────────────────────────────────────────────────────────
function AcceptanceView(props){
  var wo=props.wo;
  var onBack=props.onBack;
  var session=props.session;
  var onSaved=props.onSaved;
  var[checks,setChecks]=useState(wo.acceptChecks||{});
  var[checkNotes,setCheckNotes]=useState(wo.checkNotes||{});
  var[overallResult,setOverallResult]=useState(wo.overallResult||"");
  var[punchList,setPunchList]=useState(wo.punchList||"");
  var[clientSignName,setClientSignName]=useState(wo.clientSignName||"");
  var[acceptDate,setAcceptDate]=useState(wo.acceptDate||new Date().toISOString().slice(0,10));
  var[toast,setToast]=useState("");

  var activeItems=D_ITEMS.filter(function(item){return wo.selectedItems&&wo.selectedItems[item.key];});
  var totalChecks=activeItems.reduce(function(a,item){return a+item.acceptCriteria.length;},0);
  var passedChecks=Object.values(checks).filter(function(v){return v==="pass";}).length;
  var failedChecks=Object.values(checks).filter(function(v){return v==="fail";}).length;
  var allPassed=passedChecks===totalChecks&&totalChecks>0;

  var doSaveAccept=async function(status){
    var all=await stor.g("rq_workorders");
    var list=all?JSON.parse(all):[];
    var idx=list.findIndex(function(w){return w.id===wo.id;});
    var updated=Object.assign({},wo,{
      status:status,acceptChecks:checks,checkNotes:checkNotes,
      overallResult,punchList,clientSignName,acceptDate,
      updatedAt:new Date().toISOString(),
      statusHistory:(wo.statusHistory||[]).concat([{status,at:new Date().toISOString(),by:session&&session.name}])
    });
    if(idx>=0)list[idx]=updated;else list.unshift(updated);
    await stor.s("rq_workorders",JSON.stringify(list));
    if(onSaved)onSaved(updated);
    setToast("驗收記錄已儲存："+status);
  };

  return ce("div",{style:{display:"grid",gap:14}},
    ce(Toast,{msg:toast,onDone:function(){setToast("");}}),
    ce("button",{onClick:onBack,style:{background:"none",border:"none",cursor:"pointer",color:T.teal,fontSize:13,fontWeight:700,fontFamily:"inherit"}},"<- 返回工單"),
    ce(Card,{style:{background:"linear-gradient(135deg,#0f766e,#1e3a5f)",border:"none"}},
      ce("div",{style:{color:"#fff"}},
        ce("div",{style:{fontSize:11,opacity:.75}},"D層出貨驗收單"),
        ce("div",{style:{fontSize:18,fontWeight:800,marginTop:4}},wo.clientName),
        ce("div",{style:{fontSize:12,opacity:.8,marginTop:2}},wo.woNo+" · 合約："+(wo.contractNo||"-")),
        ce("div",{style:{display:"flex",gap:10,marginTop:8}},
          ce("span",{style:{background:"rgba(255,255,255,.2)",padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700}},
            passedChecks+"/"+totalChecks+" 項通過"),
          failedChecks>0&&ce("span",{style:{background:"rgba(220,38,38,.4)",padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700}},
            failedChecks+" 項異常")))),
    ce(Card,null,
      ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}},
        ce(Inp,{label:"驗收日期",type:"date",value:acceptDate,onChange:function(e){setAcceptDate(e.target.value);}}),
        ce(Inp,{label:"客戶代表姓名",value:clientSignName,onChange:function(e){setClientSignName(e.target.value);},placeholder:"客戶驗收確認人"})),
      ce("div",{style:{height:6,background:T.bg,borderRadius:3,overflow:"hidden",marginBottom:8}},
        ce("div",{style:{height:"100%",width:(totalChecks>0?Math.round((passedChecks/totalChecks)*100):0)+"%",background:allPassed?T.sage:T.teal,borderRadius:3,transition:"width .3s"}})),
      ce("div",{style:{fontSize:11,color:T.muted,marginBottom:4}},
        "驗收進度："+passedChecks+"/"+totalChecks+"項("+(totalChecks>0?Math.round((passedChecks/totalChecks)*100):0)+"%)")),
    ce("div",{style:{display:"grid",gap:10}},
      activeItems.map(function(item){
        var qty=wo.itemQty&&wo.itemQty[item.key]?wo.itemQty[item.key]:item.defaultQty;
        var specs=wo.itemSpecs&&wo.itemSpecs[item.key]||{};
        return ce(Card,{key:item.key},
          ce("div",{style:{fontWeight:700,fontSize:13,color:T.teal,marginBottom:10}},
            item.name+" × "+qty+item.unit),
          Object.keys(specs).length>0&&ce("div",{style:{marginBottom:10,padding:"6px 10px",background:T.bg,borderRadius:6}},
            Object.entries(specs).map(function(entry){
              var specKey=entry[0];var specVal=entry[1];
              return specVal?ce("div",{key:specKey,style:{fontSize:11,color:T.muted}},
                item.specs.find(function(s){return s.k===specKey;})?
                  item.specs.find(function(s){return s.k===specKey;}).label:specKey
                +": "+specVal):null;
            })),
          ce("div",{style:{display:"grid",gap:6}},
            item.acceptCriteria.map(function(crit){
              var checkKey=item.key+"_"+crit;
              var result=checks[checkKey]||"";
              var note=checkNotes[checkKey]||"";
              return ce("div",{key:crit,style:{padding:"8px 10px",borderRadius:8,border:"1px solid "+(result==="pass"?T.sage:result==="fail"?T.red:T.border),background:result==="pass"?T.sageBg:result==="fail"?T.redBg:T.bg}},
                ce("div",{style:{fontSize:12,fontWeight:600,color:T.text,marginBottom:6}},crit),
                ce("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
                  ["pass","fail","na"].map(function(r){
                    return ce("button",{key:r,onClick:function(){setChecks(function(p){var n=Object.assign({},p);n[checkKey]=r;return n;});},
                      style:{padding:"4px 12px",borderRadius:16,border:"1px solid "+(result===r?(r==="pass"?T.sage:r==="fail"?T.red:T.border):T.border),fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                        background:result===r?(r==="pass"?T.sageBg:r==="fail"?T.redBg:"#f1f5f9"):"transparent",
                        color:result===r?(r==="pass"?T.sage:r==="fail"?T.red:T.muted):T.muted}},
                      r==="pass"?"✓ 通過":r==="fail"?"✗ 異常":"N/A");
                  })),
                result==="fail"&&ce("input",{value:note,onChange:function(e){setCheckNotes(function(p){var n=Object.assign({},p);n[checkKey]=e.target.value;return n;});},
                  placeholder:"請說明異常狀況及要求改善方式",
                  style:{width:"100%",marginTop:6,padding:"6px 8px",borderRadius:6,border:"1px solid "+T.red,fontSize:11,boxSizing:"border-box"}}));
            })),
          wo.itemNote&&wo.itemNote[item.key]&&ce(IBox,{c:"teal",style:{marginTop:8,fontSize:11}},"項目備註："+wo.itemNote[item.key]));
      })),
    wo.customItems&&wo.customItems.length>0&&ce(Card,null,
      ce(SecTitle,null,"自訂項目確認"),
      wo.customItems.map(function(ci,i){
        var key="custom_"+i;
        var result=checks[key]||"";
        return ce("div",{key:i,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:T.bg,borderRadius:8,marginBottom:6}},
          ce("span",{style:{fontSize:12,fontWeight:600,color:T.text}},ci.name),
          ce("div",{style:{display:"flex",gap:4}},
            ["pass","fail","na"].map(function(r){
              return ce("button",{key:r,onClick:function(){setChecks(function(p){var n=Object.assign({},p);n[key]=r;return n;});},
                style:{padding:"3px 10px",borderRadius:16,border:"1px solid "+(result===r?(r==="pass"?T.sage:r==="fail"?T.red:T.border):T.border),fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                  background:result===r?(r==="pass"?T.sageBg:r==="fail"?T.redBg:"#f1f5f9"):"transparent",
                  color:result===r?(r==="pass"?T.sage:r==="fail"?T.red:T.muted):T.muted}},
                r==="pass"?"通過":r==="fail"?"異常":"N/A");
            })));
      })),
    ce(Card,null,
      ce(SecTitle,null,"整體驗收結論"),
      ce("div",{style:{display:"flex",gap:8,marginBottom:10}},
        ["驗收完成","驗收異常"].map(function(r){
          return ce("button",{key:r,onClick:function(){setOverallResult(r);},
            style:{flex:1,padding:"10px 0",border:"2px solid "+(overallResult===r?(r==="驗收完成"?T.sage:T.red):T.border),borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:13,fontFamily:"inherit",
              background:overallResult===r?(r==="驗收完成"?T.sageBg:T.redBg):"transparent",
              color:overallResult===r?(r==="驗收完成"?T.sage:T.red):T.muted}},
            r==="驗收完成"?"✓ "+r:"✗ "+r);
        })),
      overallResult==="驗收異常"&&ce("div",null,
        ce("label",{style:{fontSize:12,color:T.muted,display:"block",marginBottom:4,fontWeight:600}},"異常清單(Punch List)"),
        ce("textarea",{value:punchList,onChange:function(e){setPunchList(e.target.value);},rows:4,
          placeholder:"逐項列出異常項目及要求改善期限...\n例：1. 海報尺寸偏小，需重印，要求10工作日內完成\n    2. QR Code連結有誤，需重印",
          style:{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid "+T.red,fontSize:12,fontFamily:"inherit",boxSizing:"border-box",resize:"vertical"}})),
      overallResult&&ce("div",{style:{marginTop:10,padding:"12px 14px",background:T.bg,borderRadius:8,border:"1px solid "+T.border}},
        ce("div",{style:{fontSize:12,fontWeight:700,color:T.text,marginBottom:8}},"客戶簽認欄"),
        ce("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}},
          ce("div",null,
            ce("div",{style:{fontSize:11,color:T.muted,marginBottom:6}},"客戶代表："),
            ce("div",{style:{fontWeight:700,fontSize:14,color:T.text}},clientSignName||"(未填入)"),
            ce("div",{style:{height:40,borderBottom:"1px solid "+T.border,marginTop:16}}),
            ce("div",{style:{fontSize:10,color:T.muted,marginTop:4}},"簽名")),
          ce("div",null,
            ce("div",{style:{fontSize:11,color:T.muted,marginBottom:6}},"驗收日期："),
            ce("div",{style:{fontWeight:700,fontSize:14,color:T.text}},acceptDate),
            ce("div",{style:{fontSize:11,color:T.muted,marginTop:20}},"麗媚服務人員："+(wo.staffNames||"__________")))),
      ce("div",{style:{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}},
        ce(Btn,{v:"ghost",sz:"sm",onClick:function(){doSave("驗收中");}},"💾 暫存"),
        overallResult&&ce(Btn,{v:overallResult==="驗收完成"?"sage":"danger",onClick:function(){doSave(overallResult);},sz:"md"},
          overallResult==="驗收完成"?"✓ 完成驗收並存檔":"⚠ 記錄異常待改善"),
        ce(Btn,{v:"ghost",sz:"sm",onClick:function(){window.print();}},"列印驗收單")))));

}

// ── WORKORDER LIST ─────────────────────────────────────────────────────────────
function WorkOrderList(props){
  var onNew=props.onNew;
  var onOpen=props.onOpen;
  var onAccept=props.onAccept;
  var[wos,setWos]=useState([]);
  var[search,setSearch]=useState("");
  var[filterStatus,setFilterStatus]=useState("all");
  var[toast,setToast]=useState("");

  useEffect(function(){
    stor.g("rq_workorders").then(function(d){if(d)setWos(JSON.parse(d));});
  },[]);

  var filtered=wos.filter(function(w){
    var matchSearch=!search||(w.clientName&&w.clientName.includes(search))||(w.woNo&&w.woNo.includes(search.toUpperCase()));
    var matchStatus=filterStatus==="all"||w.status===filterStatus;
    return matchSearch&&matchStatus;
  });

  var pending=wos.filter(function(w){return w.status==="待驗收";}).length;
  var anomaly=wos.filter(function(w){return w.status==="驗收異常";}).length;

  return ce("div",{style:{display:"grid",gap:12}},
    ce(Toast,{msg:toast,onDone:function(){setToast("");}}),
    (pending>0||anomaly>0)&&ce("div",{style:{display:"grid",gap:6}},
      pending>0&&ce(IBox,{c:"amber"},"🔔 待驗收工單 "+pending+" 件，請安排驗收。"),
      anomaly>0&&ce(IBox,{c:"red"},"⚠ 驗收異常 "+anomaly+" 件，請追蹤改善進度。")),
    ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
      ce(Btn,{onClick:onNew},"+新增D層工單"),
      ce("div",{style:{fontSize:11,color:T.muted}},wos.length+"件工單")),
    ce(Card,null,
      ce("div",{style:{display:"grid",gap:8}},
        ce(Inp,{label:"搜尋(客戶名稱/工單號)",value:search,onChange:function(e){setSearch(e.target.value);}}),
        ce("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
          ["all","草稿","已發出","安裝中","待驗收","驗收完成","驗收異常","已存檔"].map(function(s){
            return ce("button",{key:s,onClick:function(){setFilterStatus(s);},
              style:{padding:"4px 10px",borderRadius:20,border:"1px solid "+(filterStatus===s?T.teal:T.border),fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:filterStatus===s?T.teal:"transparent",color:filterStatus===s?"#fff":T.muted}},
              s==="all"?"全部":s);
          })))),
    filtered.length===0?ce(Card,{style:{textAlign:"center",padding:32,color:T.muted}},wos.length===0?"尚無工單，請點「新增D層工單」":"無符合條件的工單"):
    ce("div",{style:{display:"grid",gap:8}},
      filtered.map(function(wo){
        var activeCount=Object.keys(wo.selectedItems||{}).filter(function(k){return wo.selectedItems[k];}).length+(wo.customItems||[]).length;
        return ce(Card,{key:wo.id,style:{padding:"12px 14px",borderLeft:"3px solid "+(wo.status==="驗收完成"?T.sage:wo.status==="驗收異常"?T.red:wo.status==="待驗收"?T.amber:T.teal)}},
          ce("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}},
            ce("div",null,
              ce("div",{style:{fontWeight:700,fontSize:13,color:T.text}},wo.clientName),
              ce("div",{style:{fontSize:11,color:T.muted,fontFamily:"monospace"}},wo.woNo),
              ce("div",{style:{display:"flex",gap:6,marginTop:4}},
                ce(StatusBadge,{status:wo.status}),
                ce(Tag,{c:"gray"},activeCount+"項服務"))),
            ce("div",{style:{textAlign:"right",fontSize:10,color:T.faint}},
              wo.scheduledDate||"",
              wo.contractNo&&ce("div",null,wo.contractNo))),
          ce("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
            ce(Btn,{sz:"sm",v:"ghost",onClick:function(){onOpen(wo);}},"✏ 編輯"),
            (wo.status==="已發出"||wo.status==="安裝中"||wo.status==="待驗收")&&ce(Btn,{sz:"sm",v:"sage",onClick:function(){onAccept(wo);}},
              "✓ 驗收作業"),
            wo.status==="驗收異常"&&ce(Btn,{sz:"sm",v:"danger",onClick:function(){onAccept(wo);}},
              "⚠ 查看異常")));
      })));
}

// ── MAIN APP ───────────────────────────────────────────────────────────────────
export default function App(){
  var[sess,setSess]=useState(null);
  var[loading,setLoading]=useState(true);
  var[view,setView]=useState("list");
  var[currentWO,setCurrentWO]=useState(null);
  var[viewMode,setViewMode]=useState("form");
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
      ce("div",{style:{color:"#fff",fontSize:14,fontWeight:700}},"REIBI 工單系統載入中..."));
  }

  if(!sess){
    return ce("div",{style:{minHeight:"100vh",background:"linear-gradient(135deg,#0f766e,#1e3a5f)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}},
      ce("div",{style:{textAlign:"center",marginBottom:24}},
        ce("div",{style:{fontSize:36,marginBottom:8}},"📋"),
        ce("div",{style:{fontSize:20,fontWeight:900,color:"#fff"}},"REIBI D層工單系統"),
        ce("div",{style:{fontSize:11,color:"rgba(255,255,255,.7)",marginTop:4}},"D Layer Delivery & Acceptance System")),
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
          ce(IBox,{c:"navy",style:{marginBottom:16}},"本系統為 REIBI 專屬管理系統的獨立工單模組。\n請先在L5「總覽」頁「📋D層工單快覽」設定操作身份，再切換到本artifact，會自動偵測並帶入。"),
          ce(Btn,{full:true,onClick:function(){setSess({name:"訪客",role:"super"});}},
            "直接進入(測試模式，未設定身份)"))),
      ce("div",{style:{marginTop:16,color:"rgba(255,255,255,.4)",fontSize:10,textAlign:"center"}},
        "© 2024-2025 麗媚生化科技有限公司 REIBI BIO-Technology Co., Ltd."));
  }

  return ce("div",{style:{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column"}},
    ce("div",{style:{background:"linear-gradient(135deg,#0f766e,#1e3a5f)",padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}},
      ce("div",{style:{display:"flex",alignItems:"center",gap:10}},
        ce("span",{style:{fontSize:22}},"📋"),
        ce("div",null,
          ce("div",{style:{fontSize:13,fontWeight:800,color:"#fff"}},"REIBI D層出貨驗收工單"),
          ce("div",{style:{fontSize:10,color:"rgba(255,255,255,.7)"}},sess.name+" · D Layer Delivery & Acceptance"))),
      ce("button",{onClick:async function(){await stor.d("rq_session");setSess(null);},
        style:{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.3)",color:"#fff",padding:"5px 12px",borderRadius:8,cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit"}},"登出")),
    ce("div",{style:{flex:1,maxWidth:760,width:"100%",margin:"0 auto",padding:"16px 14px 40px",boxSizing:"border-box"}},
      view==="list"&&ce(WorkOrderList,{session:sess,
        onNew:function(){setCurrentWO(null);setViewMode("form");setView("detail");},
        onOpen:function(wo){setCurrentWO(wo);setViewMode("form");setView("detail");},
        onAccept:function(wo){setCurrentWO(wo);setViewMode("accept");setView("detail");}}),
      view==="detail"&&viewMode==="form"&&ce(WorkOrderForm,{session:sess,initWO:currentWO||{},
        onBack:function(){setView("list");setCurrentWO(null);},
        onSave:function(wo){setCurrentWO(wo);}}),
      view==="detail"&&viewMode==="accept"&&currentWO&&ce(AcceptanceView,{session:sess,wo:currentWO,
        onBack:function(){setViewMode("form");},
        onSaved:function(wo){setCurrentWO(wo);setView("list");}})),
    ce("div",{style:{textAlign:"center",padding:"12px 0",fontSize:10,color:T.faint}},
      "© 2024-2025 麗媚生化科技有限公司 REIBI BIO-Technology Co., Ltd. | 版權所有 All Rights Reserved."));
}
